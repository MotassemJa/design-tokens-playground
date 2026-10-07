import StyleDictionary from "style-dictionary";
import { createFixtureLoader, validateFixture } from "./test-helpers.js";

describe("token fixture pipeline", () => {
  it("resolves every reference in the valid fixture", async () => {
    const sd = new StyleDictionary({
      tokens: createFixtureLoader("valid").loadTokens(),
      platforms: { resolved: {} },
    });
    // tokenMap, not allTokens: under Jest's VM modules SD's plain-object check
    // fails across realms and leaves allTokens empty. tsx builds are unaffected.
    const { tokenMap } = await sd.getPlatformTokens("resolved");

    expect(tokenMap.size).toBeGreaterThan(0);
    for (const token of tokenMap.values()) {
      expect(JSON.stringify(token.$value)).not.toMatch(/\{[^}]+\}/);
    }
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