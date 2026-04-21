/**
 * Resolves token references in the format `{path.to.token}`.
 *
 * Supports exact references and embedded references inside string values.
 */
export class TokenReferenceResolver {
  private tokens: Record<string, unknown> = {};

  /**
   * Resolves all references in a token object clone.
   *
   * @param tokens Source token tree.
   * @returns New token tree with references resolved where possible.
   */
  resolveReferences(tokens: Record<string, unknown>): Record<string, unknown> {
    this.tokens = tokens;
    const resolved = JSON.parse(JSON.stringify(tokens));
    return this.resolveValue(resolved) as Record<string, unknown>;
  }

  /**
   * Recursively resolves references in primitive values, arrays, and objects.
   */
  private resolveValue(value: unknown, path: string[] = [], stack: string[] = []): unknown {
    if (typeof value === "string") {
      const exactReferenceMatch = value.match(/^\{([^}]+)\}$/);
      if (exactReferenceMatch) {
        return this.resolveReference(exactReferenceMatch[1], path, stack);
      }

      if (!value.includes("{") || !value.includes("}")) {
        return value;
      }

      const embeddedReferencePattern = /\{([^}]+)\}/g;
      return value.replace(embeddedReferencePattern, (fullMatch, refPath) => {
        const resolvedReference = this.resolveReference(refPath, path, stack);
        if (typeof resolvedReference === "string" || typeof resolvedReference === "number") {
          return String(resolvedReference);
        }

        if (typeof resolvedReference === "boolean") {
          return resolvedReference ? "true" : "false";
        }

        console.warn(
          `⚠️  Could not interpolate non-primitive reference: {${refPath}} at ${path.join(".")}`
        );
        return fullMatch;
      });
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => this.resolveValue(item, [...path, index.toString()], stack));
    }

    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.resolveValue(val, [...path, key], stack);
      }
      return result;
    }

    return value;
  }

  /**
   * Resolves a single reference path against the loaded token tree.
   *
   * Circular and unresolved references are preserved in original form.
   */
  private resolveReference(refPath: string, currentPath: string[], stack: string[]): unknown {
    if (stack.includes(refPath)) {
      console.warn(
        `⚠️  Circular reference detected: ${[...stack, refPath].join(" -> ")} at ${currentPath.join(".")}`
      );
      return `{${refPath}}`;
    }

    const parts = refPath.split(".");
    let current: unknown = this.tokens;

    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        console.warn(`⚠️  Unresolved reference: {${refPath}} at ${currentPath.join(".")}`);
        return `{${refPath}}`; // Return original reference if unresolved
      }
    }

    // If the referenced value is an object with $value, return the $value
    if (current && typeof current === "object" && "$value" in current) {
      return this.resolveValue(
        (current as { $value: unknown }).$value,
        [...currentPath, "$value"],
        [...stack, refPath]
      );
    }

    return this.resolveValue(current, currentPath, [...stack, refPath]);
  }
}