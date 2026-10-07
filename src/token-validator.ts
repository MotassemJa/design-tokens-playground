import StyleDictionary from "style-dictionary";
import type { DesignToken, DesignTokens, TransformedToken } from "style-dictionary/types";
import { getReferences, usesReferences } from "style-dictionary/utils";
import { toTokenMap, type Hierarchy } from "./token-loader.js";

/** The name transforms the build's platforms use: CSS (kebab) and JS/TS (pascal). */
const NAME_TRANSFORMS = ["name/kebab", "name/pascal"];

const HIERARCHY_ALLOWED_REFS: Record<Hierarchy, readonly Hierarchy[]> = {
  "design-values": ["design-values"],
  universal: ["design-values", "universal"],
  system: ["design-values", "universal", "system"],
  semantic: ["design-values", "universal", "system", "semantic"],
  component: ["design-values", "universal", "system", "semantic", "component"],
};

/** DTCG metadata keys (`$type`, `$description`, …) are never path segments. */
export function isDtcgMetadataKey(key: string): boolean {
  return key.startsWith("$");
}

/**
 * One error per segment of `path` that breaks the DTCG name rules: a name is
 * non-empty, does not start with `$` (reserved for metadata) and contains no
 * `{` or `}` (reference syntax). `.` is the path separator, so it never appears
 * inside a segment. Casing is free: Style Dictionary's name transforms produce
 * each platform's casing, and {@link TokenValidator} reports names that collide.
 */
function segmentErrors(path: string): string[] {
  return path
    .split(".")
    .filter((segment) => !segment || segment.startsWith("$") || /[{}]/.test(segment))
    .map(
      (segment) =>
        `Segment '${segment}' in path '${path}' is not a valid DTCG name (must be non-empty, not start with '$', and not contain '{' or '}').`
    );
}

/**
 * Enforces:
 *  1. DTCG naming rules for every path segment, at least two segments, and no
 *     two paths that become the same CSS or JS name.
 *  2. 5-layer hierarchy reference rules (hierarchy determined by source file,
 *     not by path prefix). Each layer may reference itself and any layer below it:
 *     design-values → design-values,
 *     universal → design-values/universal,
 *     system → design-values/universal/system,
 *     semantic → design-values/universal/system/semantic,
 *     component → design-values/universal/system/semantic/component.
 *
 * Tokens are walked as Style Dictionary token maps, so `$type` inheritance and
 * reference lookup are SD's own. DTCG value-shape validation is delegated to
 * TokenScript in the build pipeline (`processTokens`).
 */
export class TokenValidator {
  private errors: string[] = [];
  private warnings: string[] = [];

  /**
   * Validates tokens grouped by hierarchy.
   * Hierarchy is the folder the token file lives in — not part of the token path.
   */
  validate(tokensByHierarchy: Map<Hierarchy, DesignTokens>): boolean {
    this.errors = [];
    this.warnings = [];

    const layers = [...tokensByHierarchy].map(([hierarchy, tree]) => [hierarchy, toTokenMap(tree)] as const);

    // Every token across all layers, and the layer each one came from.
    const allTokens = new Map<string, DesignToken>();
    const hierarchyOf = new Map<string, Hierarchy>();
    for (const [hierarchy, tokenMap] of layers) {
      for (const [key, token] of tokenMap) {
        allTokens.set(key, token);
        hierarchyOf.set(key, hierarchy);
      }
    }

    this.validateNameCollisions([...hierarchyOf.keys()].map((key) => key.slice(1, -1)));

    for (const [hierarchy, tokenMap] of layers) {
      for (const [key, token] of tokenMap) {
        this.validateToken(key.slice(1, -1), token, hierarchy, allTokens, hierarchyOf);
      }
    }

    return this.errors.length === 0;
  }

  getErrors(): string[] {
    return this.errors;
  }

  getWarnings(): string[] {
    return this.warnings;
  }

  /** Validates a fully-qualified dotted token path. */
  static validatePath(path: string): string[] {
    if (!path) return ["Token path is empty."];

    const errors: string[] = [];
    if (path.split(".").length < 2) {
      errors.push(
        `Token path '${path}' must contain at least two segments (e.g. 'color.blue.500').`
      );
    }
    return [...errors, ...segmentErrors(path)];
  }

  /**
   * Any casing is allowed, so `lineHeights` and `line-heights` would both
   * become `--line-heights`. Style Dictionary only warns about that and lets
   * one token overwrite the other, so it is reported as an error here.
   */
  private validateNameCollisions(paths: string[]): void {
    for (const transform of NAME_TRANSFORMS) {
      const { transform: toName } = StyleDictionary.hooks.transforms[transform];
      const seen = new Map<string, string>();
      for (const path of paths) {
        const name = toName({ path: path.split(".") } as TransformedToken, {}, {}) as string;
        const other = seen.get(name);
        if (other === undefined) {
          seen.set(name, path);
        } else {
          this.errors.push(`Tokens '${other}' and '${path}' both become '${name}' (${transform}).`);
        }
      }
    }
  }

  private validateToken(
    path: string,
    token: DesignToken,
    hierarchy: Hierarchy,
    allTokens: Map<string, DesignToken>,
    hierarchyOf: Map<string, Hierarchy>
  ): void {
    this.errors.push(...segmentErrors(path));

    // typeDtcgDelegate already copied any ancestor group's $type onto the token.
    if (!token.$type) {
      this.errors.push(
        `Token '${path}' is missing required $type (not set on the token or any ancestor group).`
      );
    }
    if (token.$description !== undefined && typeof token.$description !== "string") {
      this.errors.push(`Token '${path}': $description must be a string.`);
    }
    if (
      token.$extensions !== undefined &&
      (typeof token.$extensions !== "object" || token.$extensions === null)
    ) {
      this.errors.push(`Token '${path}': $extensions must be an object.`);
    }

    if (!usesReferences(token.$value)) return;

    let references: TransformedToken[];
    try {
      references = getReferences(token.$value, allTokens as Map<string, TransformedToken>, {
        usesDtcg: true,
      });
    } catch (error) {
      // SD throws on the first reference it cannot find.
      this.errors.push(`Token '${path}': ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    const allowed = HIERARCHY_ALLOWED_REFS[hierarchy];
    for (const reference of references) {
      // getReferences tags each match with the path it was found at.
      const refPath = (reference.ref as string[]).join(".");
      const refHierarchy = hierarchyOf.get(`{${refPath}}`)!;
      if (!allowed.includes(refHierarchy)) {
        this.errors.push(
          `Hierarchy violation: '${hierarchy}' token '${path}' cannot reference '${refHierarchy}' token '${refPath}'. Allowed: ${allowed.join(", ")}.`
        );
      }
    }
  }
}
