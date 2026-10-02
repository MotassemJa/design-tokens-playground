import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TokenLoader, type Hierarchy } from "../src/token-loader.js";
import { TokenValidator, type TokenGroup } from "../src/token-validator.js";

const REPO_ROOT = process.cwd();
const FIXTURES_DIR = join(REPO_ROOT, "tests", "fixtures");
const TSX = join(REPO_ROOT, "node_modules", ".bin", "tsx");

export function getFixtureDir(name: string): string {
  return join(FIXTURES_DIR, name);
}

export function createFixtureLoader(name: string): TokenLoader {
  return new TokenLoader(getFixtureDir(name));
}

export function loadFixtureTokensByHierarchy(name: string): Map<Hierarchy, TokenGroup> {
  return createFixtureLoader(name).loadTokensByHierarchy() as Map<Hierarchy, TokenGroup>;
}

export function validateFixture(name: string): TokenValidator {
  const validator = new TokenValidator();
  validator.validate(loadFixtureTokensByHierarchy(name));
  return validator;
}

/**
 * Creates a throwaway working directory holding a copy of a token fixture at
 * `tokens/`, ready to be used as the cwd for an issue-ops script.
 */
export function createTokenWorkspace(fixture = "valid"): string {
  const dir = mkdtempSync(join(tmpdir(), "issue-ops-"));
  cpSync(getFixtureDir(fixture), join(dir, "tokens"), { recursive: true });
  return dir;
}

export interface ScriptResult {
  status: number;
  /** stdout and stderr combined, for asserting on a message either may carry. */
  output: string;
}

/**
 * Runs an issue-ops script the way a workflow does — as its own process, with
 * the workspace as cwd. The scripts resolve `tokens/` from `process.cwd()` at
 * module load, so this is what lets them be exercised against a fixture.
 */
export function runScript(script: string, args: string[], cwd: string): ScriptResult {
  const result = spawnSync(TSX, [join(REPO_ROOT, ".github", "scripts", script), ...args], {
    cwd,
    encoding: "utf8",
  });

  return {
    status: result.status ?? 1,
    output: (result.stdout ?? "") + (result.stderr ?? ""),
  };
}
