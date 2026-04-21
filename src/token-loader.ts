import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TOKENS_ROOT = "tokens";
const TOKEN_FILENAME = "tokens.json";
const ALLOWED_HIERARCHIES = ["universal", "system", "semantic", "component"] as const;

export type Hierarchy = (typeof ALLOWED_HIERARCHIES)[number];
export { ALLOWED_HIERARCHIES, TOKEN_FILENAME, TOKENS_ROOT };

/**
 * Loads and merges token files from `tokens/{hierarchy}/tokens.json`.
 * Hierarchy is determined solely by folder; token paths carry no hierarchy prefix.
 */
export class TokenLoader {
  private readonly rootDir: string;

  constructor(rootDir: string = join(process.cwd(), TOKENS_ROOT)) {
    this.rootDir = rootDir;
  }

  /**
   * Returns each hierarchy's token tree separately, keyed by hierarchy name.
   * This is the primary load method — use it when hierarchy context is needed
   * (e.g. for reference validation).
   */
  loadTokensByHierarchy(): Map<Hierarchy, Record<string, unknown>> {
    if (!existsSync(this.rootDir)) {
      throw new Error(`Token directory '${this.rootDir}' does not exist.`);
    }

    this.assertLayoutStrict();

    const result = new Map<Hierarchy, Record<string, unknown>>();

    for (const hierarchy of ALLOWED_HIERARCHIES) {
      const filePath = join(this.rootDir, hierarchy, TOKEN_FILENAME);
      if (!existsSync(filePath)) continue;

      let content: Record<string, unknown>;
      try {
        content = JSON.parse(readFileSync(filePath, "utf-8"));
      } catch (error) {
        throw new Error(
          `Could not load token file '${filePath}': ${error instanceof Error ? error.message : String(error)}`
        );
      }

      result.set(hierarchy, content);
    }

    if (result.size === 0) {
      throw new Error(
        `No token files found in '${this.rootDir}'. Expected at least one of: ${ALLOWED_HIERARCHIES.map((h) => `${h}/${TOKEN_FILENAME}`).join(", ")}`
      );
    }

    return result;
  }

  /** Loads and merges all hierarchy token trees into a single flat object. */
  loadTokens(): Record<string, unknown> {
    const byHierarchy = this.loadTokensByHierarchy();
    const merged: Record<string, unknown> = {};
    for (const content of byHierarchy.values()) {
      this.mergeTokens(merged, content);
    }
    return merged;
  }

  private assertLayoutStrict(): void {
    const topEntries = readdirSync(this.rootDir, { withFileTypes: true });

    for (const entry of topEntries) {
      if (!entry.isDirectory()) continue;

      if (!ALLOWED_HIERARCHIES.includes(entry.name as Hierarchy)) {
        throw new Error(
          `Unexpected hierarchy '${entry.name}/' in '${this.rootDir}'. Allowed hierarchies: ${ALLOWED_HIERARCHIES.join(", ")}`
        );
      }

      const hierarchyDir = join(this.rootDir, entry.name);
      const hierarchyEntries = readdirSync(hierarchyDir);

      for (const name of hierarchyEntries) {
        const full = join(hierarchyDir, name);
        if (statSync(full).isDirectory()) {
          throw new Error(
            `Nested directories are not allowed under '${entry.name}/'. Put all tokens inside '${TOKEN_FILENAME}' (use DTCG groups).`
          );
        }

        if (name !== TOKEN_FILENAME && !name.toLowerCase().startsWith("readme")) {
          throw new Error(
            `Unexpected file '${entry.name}/${name}'. Only '${TOKEN_FILENAME}' is permitted per hierarchy.`
          );
        }
      }
    }
  }

  private mergeTokens(target: Record<string, unknown>, source: Record<string, unknown>): void {
    for (const key in source) {
      const value = source[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        if (!target[key] || typeof target[key] !== "object") {
          target[key] = {};
        }
        this.mergeTokens(target[key] as Record<string, unknown>, value as Record<string, unknown>);
      } else {
        target[key] = value;
      }
    }
  }
}
