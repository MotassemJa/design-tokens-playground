import { ALLOWED_HIERARCHIES, type Hierarchy } from "./token-loader.js";

export interface DesignTokenValue {
  $value: unknown;
  $type?: string;
  $description?: string;
  $extensions?: Record<string, unknown>;
  $deprecated?: boolean | string;
}

export interface TokenGroup {
  [key: string]: DesignTokenValue | TokenGroup;
}

/** Kebab-case segment: lowercase letters/digits, optional `-` between runs. */
const SEGMENT_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const HIERARCHY_ALLOWED_REFS: Record<Hierarchy, readonly Hierarchy[]> = {
  universal: [],
  system: ["universal"],
  semantic: ["system"],
  component: ["semantic"],
};

const REFERENCE_PATTERN = /\{([^}]+)\}/g;

/**
 * Enforces:
 *  1. Curtis Nathan naming convention (kebab-case segments).
 *  2. 4-layer hierarchy reference rules (hierarchy determined by source file,
 *     not by path prefix).
 *
 * DTCG value-shape validation is delegated to TokenScript in the build
 * pipeline (`processTokens`).
 */
export class TokenValidator {
  private errors: string[] = [];
  private warnings: string[] = [];

  /**
   * Validates tokens grouped by hierarchy.
   * Hierarchy is the folder the token file lives in — not part of the token path.
   */
  validate(tokensByHierarchy: Map<Hierarchy, TokenGroup>): boolean {
    this.errors = [];
    this.warnings = [];

    // Build a lookup: every leaf token path → its source hierarchy.
    const pathToHierarchy = new Map<string, Hierarchy>();
    for (const [hierarchy, tokens] of tokensByHierarchy) {
      this.collectPaths(tokens, [], hierarchy, pathToHierarchy);
    }

    for (const [hierarchy, tokens] of tokensByHierarchy) {
      this.walk(tokens, [], hierarchy, pathToHierarchy);
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
    const errors: string[] = [];
    if (!path) {
      errors.push("Token path is empty.");
      return errors;
    }

    const segments = path.split(".");
    if (segments.length < 2) {
      errors.push(
        `Token path '${path}' must contain at least two segments (e.g. 'color.blue.500').`
      );
    }

    for (const segment of segments) {
      if (!SEGMENT_PATTERN.test(segment)) {
        errors.push(
          `Segment '${segment}' in path '${path}' is not kebab-case (lowercase letters, digits, '-' only).`
        );
      }
    }

    return errors;
  }

  /** Recursively records all leaf token paths into `out`. */
  private collectPaths(
    node: TokenGroup | DesignTokenValue,
    path: string[],
    hierarchy: Hierarchy,
    out: Map<string, Hierarchy>
  ): void {
    if (!node || typeof node !== "object") return;
    if (this.isTokenLeaf(node)) {
      out.set(path.join("."), hierarchy);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      this.collectPaths(child as TokenGroup, [...path, key], hierarchy, out);
    }
  }

  private walk(
    node: TokenGroup | DesignTokenValue,
    path: string[],
    hierarchy: Hierarchy,
    pathToHierarchy: Map<string, Hierarchy>
  ): void {
    if (!node || typeof node !== "object") return;

    if (this.isTokenLeaf(node)) {
      this.validateLeaf(node as DesignTokenValue, path, hierarchy, pathToHierarchy);
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      const childPath = [...path, key];

      if (!SEGMENT_PATTERN.test(key)) {
        this.errors.push(
          `Segment '${key}' (at '${childPath.join(".")}') is not kebab-case (lowercase letters, digits, '-').`
        );
      }

      this.walk(child as TokenGroup, childPath, hierarchy, pathToHierarchy);
    }
  }

  private isTokenLeaf(value: unknown): value is DesignTokenValue {
    return (
      typeof value === "object" &&
      value !== null &&
      "$value" in (value as Record<string, unknown>)
    );
  }

  private validateLeaf(
    token: DesignTokenValue,
    path: string[],
    hierarchy: Hierarchy,
    pathToHierarchy: Map<string, Hierarchy>
  ): void {
    const pathStr = path.join(".");

    if (!("$value" in token)) {
      this.errors.push(`Token '${pathStr}' is missing required $value.`);
    }
    if (!token.$type) {
      this.errors.push(`Token '${pathStr}' is missing required $type.`);
    }
    if (token.$description !== undefined && typeof token.$description !== "string") {
      this.errors.push(`Token '${pathStr}': $description must be a string.`);
    }
    if (
      token.$extensions !== undefined &&
      (typeof token.$extensions !== "object" || token.$extensions === null)
    ) {
      this.errors.push(`Token '${pathStr}': $extensions must be an object.`);
    }

    this.validateReferences(token.$value, pathStr, hierarchy, pathToHierarchy);
  }

  private validateReferences(
    value: unknown,
    tokenPath: string,
    tokenLayer: Hierarchy,
    pathToHierarchy: Map<string, Hierarchy>
  ): void {
    if (typeof value !== "string") {
      if (value && typeof value === "object") {
        for (const inner of Object.values(value as Record<string, unknown>)) {
          this.validateReferences(inner, tokenPath, tokenLayer, pathToHierarchy);
        }
      }
      return;
    }

    let match: RegExpExecArray | null;
    REFERENCE_PATTERN.lastIndex = 0;
    while ((match = REFERENCE_PATTERN.exec(value)) !== null) {
      const refPath = match[1];

      const nameErrors = TokenValidator.validatePath(refPath);
      for (const msg of nameErrors) {
        this.errors.push(`Token '${tokenPath}' references '${refPath}': ${msg}`);
      }
      if (nameErrors.length > 0) continue;

      const refHierarchy = pathToHierarchy.get(refPath);
      if (refHierarchy === undefined) {
        this.errors.push(
          `Token '${tokenPath}' references '${refPath}' which does not exist in any hierarchy.`
        );
        continue;
      }

      const allowed = HIERARCHY_ALLOWED_REFS[tokenLayer] ?? [];
      if (!allowed.includes(refHierarchy)) {
        const allowedStr =
          allowed.length > 0 ? allowed.join(", ") : "no other layers (self-contained)";
        this.errors.push(
          `Hierarchy violation: '${tokenLayer}' token '${tokenPath}' cannot reference '${refHierarchy}' token '${refPath}'. Allowed: ${allowedStr}.`
        );
      }
    }
  }
}

