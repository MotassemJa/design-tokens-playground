import { jest } from "@jest/globals";
import { assertTreeValid, type TokenTree } from "../.github/scripts/token-common.js";
import { getFixtureDir } from "./test-helpers.js";

/**
 * `assertTreeValid` exits the process on failure, so these tests trap
 * `process.exit` and turn it into a throw.
 */
function captureExit(run: () => void): { exited: boolean; errors: string[] } {
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

const FIXTURE_ROOT = getFixtureDir("valid");

describe("assertTreeValid", () => {
  it("resolves references against every hierarchy, not just the one being written", () => {
    // `semantic` references a `system` token. Validating the semantic tree in
    // isolation reported it as missing, which broke every create/update outside
    // `design-values`.
    const tree: TokenTree = {
      action: {
        color: {
          background: {
            primary: { $value: "{light.color.brand.primary}", $type: "color" },
          },
        },
      },
    };

    const { exited, errors } = captureExit(() => assertTreeValid(tree, "semantic", FIXTURE_ROOT));

    expect(errors).toEqual([]);
    expect(exited).toBe(false);
  });

  it("still rejects a reference to a token that exists nowhere", () => {
    const tree: TokenTree = {
      action: {
        color: { background: { primary: { $value: "{nope.not-here}", $type: "color" } } },
      },
    };

    const { exited, errors } = captureExit(() => assertTreeValid(tree, "semantic", FIXTURE_ROOT));

    expect(exited).toBe(true);
    expect(errors.join("\n")).toContain("does not exist in any hierarchy");
  });

  it("still rejects a reference pointing up the hierarchy", () => {
    const tree: TokenTree = {
      color: { blue: { 500: { $value: "{action.color.background.primary}", $type: "color" } } },
    };

    const { exited, errors } = captureExit(() => assertTreeValid(tree, "universal", FIXTURE_ROOT));

    expect(exited).toBe(true);
    expect(errors.join("\n")).toContain("Hierarchy violation");
  });
});
