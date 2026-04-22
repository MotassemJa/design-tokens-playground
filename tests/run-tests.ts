/**
 * Minimal test runner for the token validation + tokenscript pipeline.
 *
 * For each fixture directory under `tests/fixtures/<name>/`, it:
 *   1. loads tokens via `TokenLoader`
 *   2. runs `TokenValidator` (naming + hierarchy)
 *   3. runs `processTokens` (tokenscript) for value validation
 *
 * Fixtures whose directory name starts with `invalid-` are expected to fail.
 * Every other fixture must pass all checks.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { builders, processTokens } from "@tokens-studio/tokenscript-interpreter";
import { TokenLoader, type Hierarchy } from "../src/token-loader.js";
import { TokenValidator, type TokenGroup } from "../src/token-validator.js";

const FIXTURES_DIR = join(process.cwd(), "tests", "fixtures");

interface TestResult {
  name: string;
  expected: "pass" | "fail";
  actual: "pass" | "fail";
  details: string[];
}

function runFixture(fixtureName: string): TestResult {
  const fixtureDir = join(FIXTURES_DIR, fixtureName);
  const expected = fixtureName.startsWith("invalid-") ? "fail" : "pass";
  const details: string[] = [];

  let actual: "pass" | "fail" = "pass";

  try {
    const loader = new TokenLoader(fixtureDir);
    const tokensByHierarchy = loader.loadTokensByHierarchy();
    const tokens = loader.loadTokens();

    const validator = new TokenValidator();
    if (!validator.validate(tokensByHierarchy as Map<Hierarchy, TokenGroup>)) {
      actual = "fail";
      details.push(...validator.getErrors().map((e) => `[validator] ${e}`));
    }

    // Only run tokenscript when static validation passes so we get clearer failures.
    if (actual === "pass") {
      const result = processTokens(tokens, { builder: new builders.FlatObjectBuilder() });
      if (result.issues && result.issues.size > 0) {
        actual = "fail";
        for (const [path, issues] of result.issues) {
          for (const issue of issues) {
            const msg =
              issue && typeof issue === "object" && "message" in issue
                ? (issue as { message: string }).message
                : JSON.stringify(issue);
            details.push(`[tokenscript] ${path}: ${msg}`);
          }
        }
      }
    }
  } catch (error) {
    actual = "fail";
    details.push(`[loader] ${error instanceof Error ? error.message : String(error)}`);
  }

  return { name: fixtureName, expected, actual, details };
}

function main() {
  const fixtures = readdirSync(FIXTURES_DIR).filter((name) =>
    statSync(join(FIXTURES_DIR, name)).isDirectory()
  );

  let failed = 0;
  for (const fixture of fixtures) {
    const result = runFixture(fixture);
    const ok = result.actual === result.expected;
    const icon = ok ? "✅" : "❌";
    console.log(`${icon} ${fixture.padEnd(24)} expected=${result.expected}  actual=${result.actual}`);
    if (!ok) {
      failed++;
      for (const detail of result.details) console.log(`     ${detail}`);
    }
  }

  console.log("");
  console.log(`${fixtures.length - failed}/${fixtures.length} fixtures behaved as expected`);
  if (failed > 0) process.exit(1);
}

main();
