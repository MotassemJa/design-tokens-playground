import type { DesignToken, DesignTokens, TransformedToken } from "style-dictionary/types";
import { getReferences, usesReferences } from "style-dictionary/utils";
import { toTokenMap, type Hierarchy } from "./token-loader.js";

/** Kebab-case segment: lowercase letters/digits, optional `-` between runs. */
const SEGMENT_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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

/** One error per segment of `path` that is not kebab-case. */
function segmentErrors(path: string): string[] {
  return path
    .split(".")
    .filter((segment) => !SEGMENT_PATTERN.test(segment))
    .map(
      (segment) =>
        `Segment '${segment}' in path '${path}' is not kebab-case (lowercase letters, digits, '-' only).`
    );
}

/**
 * Enforces:
 *  1. Curtis Nathan naming convention (kebab-case segments).
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

  /** Validates a fully-qualified dotted token path (kebab-case segments only). */
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
