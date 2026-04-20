/**
 * Runtime schema validation for Design Tokens according to W3C DTCG format.
 */

/**
 * DTCG token node shape used by the runtime validator.
 */
export interface DesignTokenValue {
  $type?:
    | "color"
    | "dimension"
    | "duration"
    | "fontFamily"
    | "fontSize"
    | "fontWeight"
    | "lineHeight"
    | "letterSpacing"
    | "paragraphSpacing"
    | "textDecoration"
    | "textTransform"
    | "fontStyle"
    | "fontVariant"
    | "fontVariationSettings"
    | "textIndent"
    | "opacity"
    | "border"
    | "borderRadius"
    | "shadow"
    | "gradient"
    | "strokeStyle"
    | "transition"
    | "typography"
    | "transform"
    | "composition";
  $value: string | number | boolean | object | DesignTokenValue[];
  $description?: string;
  $extensions?: Record<string, unknown>;
  $deprecated?: boolean | string;
}

/**
 * Recursive token group containing nested groups and/or token values.
 */
export interface TokenGroup {
  [key: string]: DesignTokenValue | TokenGroup;
}

const VALID_TYPES = new Set([
  "color",
  "dimension",
  "duration",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "paragraphSpacing",
  "textDecoration",
  "textTransform",
  "fontStyle",
  "fontVariant",
  "fontVariationSettings",
  "textIndent",
  "opacity",
  "border",
  "borderRadius",
  "shadow",
  "gradient",
  "strokeStyle",
  "transition",
  "typography",
  "transform",
  "composition",
]);

const LEGACY_TYPE_ALIASES: Record<string, DesignTokenValue["$type"]> = {
  spacing: "dimension",
};

export class TokenValidator {
  private errors: string[] = [];
  private warnings: string[] = [];

  /**
   * Validates token schema and type/value compatibility.
   *
   * @param tokens Token tree to validate.
   * @param path Optional base path used for nested validation contexts.
   * @returns `true` when validation completes with no errors.
   */
  validate(tokens: TokenGroup, path: string = ""): boolean {
    this.errors = [];
    this.warnings = [];

    this.validateTokenGroup(tokens, path);

    return this.errors.length === 0;
  }

  /**
   * Validates hierarchy and cross-layer references according to the 4-layer structure:
   * universal → system → semantic → component
   * Each layer can only reference the layer immediately above it.
   */
  validateHierarchy(tokens: TokenGroup): void {
    this.validateCrossLayerReferences(tokens, "");
  }

  private validateCrossLayerReferences(group: TokenGroup, basePath: string = ""): void {
    for (const [key, value] of Object.entries(group)) {
      const currentPath = basePath ? `${basePath}.${key}` : key;

      if (this.isDesignToken(value)) {
        const token = value as DesignTokenValue;
        const tokenValue = String(token.$value);

        // Extract layer from token path
        const tokenLayer = this.extractLayer(currentPath);

        // Validate all references within this token
        const references = this.extractReferences(tokenValue);
        for (const ref of references) {
          this.validateReference(ref, currentPath, tokenLayer);
        }
      } else if (typeof value === "object" && value !== null) {
        this.validateCrossLayerReferences(value as TokenGroup, currentPath);
      }
    }
  }

  /**
   * Extracts the hierarchy layer from a token path.
   */
  private extractLayer(tokenPath: string): string | null {
    const match = tokenPath.match(/^(universal|system|semantic|component)/);
    return match ? match[1] : null;
  }

  /**
   * Extracts all `{...}` token references from a string value.
   */
  private extractReferences(value: string): string[] {
    const references: string[] = [];
    const regex = /\{([a-zA-Z0-9._-]+)\}/g;
    let match;

    while ((match = regex.exec(value)) !== null) {
      references.push(match[1]);
    }

    return references;
  }

  /**
   * Enforces allowed cross-layer reference combinations.
   */
  private validateReference(refPath: string, tokenPath: string, tokenLayer: string | null): void {
    if (!tokenLayer) return; // Skip if token path doesn't match 4-layer structure

    const refLayer = this.extractLayer(refPath);

    if (!refLayer) {
      this.warnings.push(
        `Token at path '${tokenPath}' references '${refPath}' which is not part of the 4-layer hierarchy (universal/system/semantic/component)`
      );
      return;
    }

    const validReferences: Record<string, string[]> = {
      universal: [], // Universal tokens cannot reference any layer
      system: ["universal"], // System can only reference universal
      semantic: ["system"], // Semantic can only reference system
      component: ["semantic"], // Component can only reference semantic
    };

    const allowed = validReferences[tokenLayer];

    if (!allowed.includes(refLayer)) {
      this.errors.push(
        `Hierarchy violation: ${tokenLayer} token '${tokenPath}' cannot reference ${refLayer} token '${refPath}'. ${tokenLayer} tokens can only reference: ${allowed.length > 0 ? allowed.join(", ") : "no other layers (self-contained)"}`
      );
    }
  }

  /**
   * Recursively validates each node in a token group.
   */
  private validateTokenGroup(group: TokenGroup, basePath: string = ""): void {
    for (const [key, value] of Object.entries(group)) {
      const currentPath = basePath ? `${basePath}.${key}` : key;

      if (this.isDesignToken(value)) {
        this.validateToken(value as DesignTokenValue, currentPath);
      } else if (typeof value === "object" && value !== null) {
        this.validateTokenGroup(value as TokenGroup, currentPath);
      } else {
        this.errors.push(`Invalid token at path '${currentPath}': must be an object`);
      }
    }
  }

  /**
   * Detects whether a node is a token leaf based on `$value`.
   */
  private isDesignToken(value: unknown): boolean {
    return (
      typeof value === "object" &&
      value !== null &&
      "$value" in (value as Record<string, unknown>)
    );
  }

  /**
   * Validates a single token leaf.
   */
  private validateToken(token: DesignTokenValue, path: string): void {
    if (!Object.prototype.hasOwnProperty.call(token, "$value")) {
      this.errors.push(`Token at path '${path}' is missing required $value property`);
      return;
    }

    const normalizedType = this.normalizeType(token.$type, path);

    if (!normalizedType) {
      this.errors.push(`Token at path '${path}' is missing required $type property`);
    } else if (!VALID_TYPES.has(normalizedType)) {
      this.errors.push(
        `Token at path '${path}' has invalid $type '${token.$type}'. Valid types: ${Array.from(VALID_TYPES).join(", ")}`
      );
    }

    if (token.$description && typeof token.$description !== "string") {
      this.errors.push(`Token at path '${path}': $description must be a string`);
    }

    if (
      token.$deprecated &&
      typeof token.$deprecated !== "boolean" &&
      typeof token.$deprecated !== "string"
    ) {
      this.errors.push(
        `Token at path '${path}': $deprecated must be a boolean or string`
      );
    }

    if (token.$extensions && typeof token.$extensions !== "object") {
      this.errors.push(`Token at path '${path}': $extensions must be an object`);
    }

    this.validateTokenValue(token, path, normalizedType);
  }

  /**
   * Normalizes legacy token types to supported DTCG types where possible.
   */
  private normalizeType(type: DesignTokenValue["$type"], path: string): DesignTokenValue["$type"] | undefined {
    if (!type) return undefined;

    if (VALID_TYPES.has(type)) {
      return type;
    }

    const alias = LEGACY_TYPE_ALIASES[type];
    if (alias) {
      this.warnings.push(
        `Token at path '${path}': '$type' '${type}' is legacy, treating as '${alias}'.`
      );
      return alias;
    }

    return type;
  }

  /**
   * Applies type-specific validation for a token value.
   */
  private validateTokenValue(
    token: DesignTokenValue,
    path: string,
    normalizedType: DesignTokenValue["$type"] | undefined
  ): void {
    const value = token.$value;

    switch (normalizedType) {
      case "color":
        if (!this.isValidColor(value)) {
          this.errors.push(
            `Token at path '${path}': invalid color value. Expected hex, rgb, hsl, or reference`
          );
        }
        break;

      case "dimension":
      case "fontSize":
      case "lineHeight":
      case "letterSpacing":
      case "paragraphSpacing":
      case "textIndent":
        if (
          typeof value !== "string" &&
          typeof value !== "number" &&
          !this.isTokenReference(String(value))
        ) {
          this.errors.push(`Token at path '${path}': invalid dimension value`);
        }
        break;

      case "duration":
        if (!this.isValidDuration(String(value))) {
          this.errors.push(
            `Token at path '${path}': invalid duration value. Expected format like '100ms' or '0.5s'`
          );
        }
        break;

      case "fontFamily":
      case "fontStyle":
      case "fontVariant":
      case "fontVariationSettings":
      case "textDecoration":
      case "textTransform":
        if (typeof value !== "string" && !this.isTokenReference(String(value))) {
          this.errors.push(
            `Token at path '${path}': invalid font/text value. Expected string or reference`
          );
        }
        break;

      case "fontWeight":
        if (!this.isValidFontWeight(value) && !this.isTokenReference(String(value))) {
          this.errors.push(
            `Token at path '${path}': invalid fontWeight. Expected 100-900, keyword, or reference`
          );
        }
        break;

      case "opacity":
        if (!this.isValidOpacity(value)) {
          this.errors.push(
            `Token at path '${path}': invalid opacity. Expected value between 0 and 1, or 0-100%`
          );
        }
        break;

      case "border":
      case "borderRadius":
      case "shadow":
      case "gradient":
      case "strokeStyle":
      case "transition":
      case "typography":
      case "transform":
      case "composition":
        if (typeof value !== "object" && typeof value !== "string") {
          this.warnings.push(
            `Token at path '${path}': complex type should be an object or string`
          );
        }
        break;
    }
  }

  /**
   * Checks whether a value is a valid color literal or reference.
   */
  private isValidColor(value: unknown): boolean {
    if (typeof value !== "string") return false;
    if (/^#[0-9A-F]{6}([0-9A-F]{2})?$/i.test(value)) return true;
    if (/^rgba?\(/.test(value)) return true;
    if (/^hsla?\(/.test(value)) return true;

    const namedColors = [
      "red",
      "blue",
      "green",
      "black",
      "white",
      "gray",
      "transparent",
    ];

    if (namedColors.includes(value.toLowerCase())) return true;
    if (this.isTokenReference(value)) return true;

    return false;
  }

  /**
   * Checks whether a value is a token reference of the form `{path.to.token}`.
   */
  private isTokenReference(value: string): boolean {
    return /^\{[a-zA-Z0-9._-]+\}$/.test(value);
  }

  /**
   * Checks whether a value is a valid duration literal or reference.
   */
  private isValidDuration(value: string): boolean {
    return /^\d+(\.\d+)?(ms|s)$/.test(value) || this.isTokenReference(value);
  }

  /**
   * Checks whether a value is a valid font-weight literal.
   */
  private isValidFontWeight(value: unknown): boolean {
    if (typeof value === "number" && value >= 100 && value <= 900) return true;

    if (typeof value === "string") {
      const validKeywords = [
        "thin",
        "extralight",
        "light",
        "normal",
        "medium",
        "semibold",
        "bold",
        "extrabold",
        "black",
      ];
      return validKeywords.includes(value.toLowerCase());
    }

    return false;
  }

  /**
   * Checks whether a value is a valid opacity literal or reference.
   */
  private isValidOpacity(value: unknown): boolean {
    if (typeof value === "number") {
      return (value >= 0 && value <= 1) || (value >= 0 && value <= 100);
    }

    if (typeof value === "string") {
      if (this.isTokenReference(value)) return true;
      if (value.endsWith("%")) {
        const num = parseFloat(value);
        return num >= 0 && num <= 100;
      }

      const num = parseFloat(value);
      return !Number.isNaN(num) && num >= 0 && num <= 1;
    }

    return false;
  }

  /**
   * Returns validation errors from the latest run.
   */
  getErrors(): string[] {
    return this.errors;
  }

  /**
   * Returns validation warnings from the latest run.
   */
  getWarnings(): string[] {
    return this.warnings;
  }
}
