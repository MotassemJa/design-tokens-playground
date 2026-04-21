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