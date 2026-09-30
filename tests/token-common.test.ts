import { assertTreeValid, type TokenTree } from "../.github/scripts/token-common.js";
import { captureExit, getFixtureDir } from "./test-helpers.js";

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
