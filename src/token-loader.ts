import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Loads and merges token files from the filesystem.
 *
 * Token files are discovered recursively under `tokens/`.
 */
export class TokenLoader {
  private static readonly TOKENS_ROOT = "tokens";

  /**
   * Recursively discovers `*.tokens.json` files in directory order.
   */
  private discoverTokenFiles(dir: string): string[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.discoverTokenFiles(fullPath));
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".tokens.json")) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
    * Loads all token files and merges them into one token tree.
    *
    * @returns Merged token object used by validators/builders.
    * @throws Error When token root cannot be read, no files are found, or JSON cannot be parsed.
   */
  loadTokens(): Record<string, unknown> {
    const allTokens: Record<string, unknown> = {};
    const tokensRoot = join(process.cwd(), TokenLoader.TOKENS_ROOT);

    let tokenFiles: string[];
    try {
      tokenFiles = this.discoverTokenFiles(tokensRoot).sort();
    } catch (error) {
      throw new Error(
        `Could not read token directory '${TokenLoader.TOKENS_ROOT}': ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (tokenFiles.length === 0) {
      throw new Error(`No token files found under '${TokenLoader.TOKENS_ROOT}/'`);
    }

    for (const file of tokenFiles) {
      try {
        const content = JSON.parse(readFileSync(file, "utf-8"));
        this.mergeTokens(allTokens, content);
      } catch (error) {
        throw new Error(
          `Could not load token file '${file}': ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return allTokens;
  }

  /**
    * Deep-merges source token objects into the target token tree.
   */
  private mergeTokens(target: Record<string, unknown>, source: Record<string, unknown>): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== "object") {
          target[key] = {};
        }
        this.mergeTokens(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
      } else {
        target[key] = source[key];
      }
    }
  }
}