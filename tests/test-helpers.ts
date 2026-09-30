import { jest } from "@jest/globals";
import { join } from "node:path";
import { TokenLoader, type Hierarchy } from "../src/token-loader.js";
import { TokenValidator, type TokenGroup } from "../src/token-validator.js";

const FIXTURES_DIR = join(process.cwd(), "tests", "fixtures");

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
 * Runs `run`, trapping the `process.exit(1)` that the issue-ops scripts use to
 * report a fatal error, and collecting what they printed to stderr.
 */
export function captureExit(run: () => void): { exited: boolean; errors: string[] } {
  const errors: string[] = [];
  const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
    throw new Error("__exit__");
  }) as never);
  const errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args.join(" "));
  });

  let exited = false;
  try {
    run();
  } catch (error) {
    if ((error as Error).message !== "__exit__") throw error;
    exited = true;
  } finally {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return { exited, errors };
}
