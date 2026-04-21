import type { Hierarchy } from "../src/token-loader.js";
import { TokenValidator, type TokenGroup } from "../src/token-validator.js";
import { loadFixtureTokensByHierarchy, validateFixture } from "./test-helpers.js";

describe("TokenValidator.validatePath", () => {
  it("accepts kebab-case dotted paths", () => {
    expect(TokenValidator.validatePath("color.brand-primary.500")).toEqual([]);
  });

  it("rejects invalid path segments", () => {
    expect(TokenValidator.validatePath("Color.brand_primary")).toEqual([
      "Segment 'Color' in path 'Color.brand_primary' is not kebab-case (lowercase letters, digits, '-' only).",
      "Segment 'brand_primary' in path 'Color.brand_primary' is not kebab-case (lowercase letters, digits, '-' only).",
    ]);
  });
});

describe("TokenValidator", () => {
  it("accepts the valid fixture without errors", () => {
    const validator = validateFixture("valid");

    expect(validator.getErrors()).toEqual([]);
    expect(validator.getWarnings()).toEqual([]);
  });

  it("reports naming violations from the invalid naming fixture", () => {
    const validator = validateFixture("invalid-naming");

    expect(validator.getErrors()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Segment 'Color'"),
        expect.stringContaining("Segment 'Blue_500'"),
      ])
    );
  });

  it("reports hierarchy violations from the invalid hierarchy fixture", () => {
    const validator = validateFixture("invalid-hierarchy");

    expect(validator.getErrors()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Hierarchy violation"),
        expect.stringContaining("cannot reference 'semantic' token 'action.color.background.primary'"),
      ])
    );
  });

  it("reports missing references from the invalid reference fixture", () => {
    const validator = validateFixture("invalid-reference");

    expect(validator.getErrors()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("references 'does.not.exist' which does not exist in any hierarchy"),
      ])
    );
  });

  it("requires $type on token leaves", () => {
    const tokensByHierarchy = new Map<Hierarchy, TokenGroup>([
      [
        "universal",
        {
          color: {
            blue: {
              500: {
                $value: "#3B82F6",
              },
            },
          },
        },
      ],
    ]);
    const validator = new TokenValidator();

    expect(validator.validate(tokensByHierarchy)).toBe(false);
    expect(validator.getErrors()).toContain("Token 'color.blue.500' is missing required $type.");
  });

  it("validates fixture references against discovered token paths", () => {
    const validator = new TokenValidator();
    const tokensByHierarchy = loadFixtureTokensByHierarchy("valid");

    expect(validator.validate(tokensByHierarchy)).toBe(true);
  });
});