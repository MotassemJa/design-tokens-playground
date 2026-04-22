import { builders, processTokens } from "@tokens-studio/tokenscript-interpreter";
import { createFixtureLoader, validateFixture } from "./test-helpers.js";

describe("token fixture pipeline", () => {
  it("interprets the valid fixture without TokenScript issues", () => {
    const loader = createFixtureLoader("valid");
    const result = processTokens(loader.loadTokens(), {
      builder: new builders.FlatObjectBuilder(),
    });

    expect(result.issues?.size ?? 0).toBe(0);
  });

  it.each([
    ["invalid-naming"],
    ["invalid-hierarchy"],
    ["invalid-reference"],
  ])("fails static validation for %s before build-time interpretation", (fixtureName) => {
    const validator = validateFixture(fixtureName);

    expect(validator.getErrors().length).toBeGreaterThan(0);
  });
});