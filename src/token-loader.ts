import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { DesignToken, DesignTokens, TransformedTokens } from "style-dictionary/types";
import { convertTokenData, stripMeta, typeDtcgDelegate } from "style-dictionary/utils";

const TOKENS_ROOT = "tokens";
const TOKEN_FILENAME = "tokens.json";
const ALLOWED_HIERARCHIES = ["design-values", "universal", "system", "semantic", "component"] as const;

export type Hierarchy = (typeof ALLOWED_HIERARCHIES)[number];
export { ALLOWED_HIERARCHIES, TOKEN_FILENAME, TOKENS_ROOT };

/**
 * Flattens a tree into Style Dictionary's token map, keyed `{a.b.c}`. Group
 * `$type` is delegated onto each token first, so every entry carries its own
 * effective type.
 */
export function toTokenMap(tree: DesignTokens): Map<string, DesignToken> {
  return convertTokenData(typeDtcgDelegate(tree), { output: "map", usesDtcg: true });
}

/** Rebuilds a tree from {@link toTokenMap} output, dropping SD's `key` prop. */
export function fromTokenMap(map: Map<string, DesignToken>): DesignTokens {
  const tree = convertTokenData(map, { output: "object", usesDtcg: true }) as TransformedTokens;
  return stripMeta(tree, { usesDtcg: true, strip: ["key"] }) as DesignTokens;
}

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
  loadTokensByHierarchy(): Map<Hierarchy, DesignTokens> {
    if (!existsSync(this.rootDir)) {
      throw new Error(`Token directory '${this.rootDir}' does not exist.`);
    }

    this.assertLayoutStrict();

    const result = new Map<Hierarchy, DesignTokens>();

    for (const hierarchy of ALLOWED_HIERARCHIES) {
      const filePath = join(this.rootDir, hierarchy, TOKEN_FILENAME);
      if (!existsSync(filePath)) continue;

      let content: DesignTokens;
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

  /**
   * Merges every hierarchy into one tree; a later layer wins on a duplicate
   * path. Group `$type` ends up on each token, and other group-level metadata
   * (`$description`, `$extensions`) is dropped.
   */
  loadTokens(): DesignTokens {
    const merged = new Map<string, DesignToken>();
    for (const tree of this.loadTokensByHierarchy().values()) {
      for (const [key, token] of toTokenMap(tree)) merged.set(key, token);
    }
    return fromTokenMap(merged);
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
}
