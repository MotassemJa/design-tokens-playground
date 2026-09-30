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

  it("requires $type on a token with no ancestor group $type", () => {
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
    expect(validator.getErrors()).toContain(
      "Token 'color.blue.500' is missing required $type (not set on the token or any ancestor group)."
    );
  });

  it("inherits $type from an ancestor group (DTCG)", () => {
    const tokensByHierarchy = new Map<Hierarchy, TokenGroup>([
      [
        "universal",
        {
          color: {
            $type: "color",
            blue: {
              500: { $value: "#3B82F6" },
            },
            green: {
              500: { $value: "#22C55E", $description: "deep in a nested group" },
            },
          },
        },
      ],
    ]);
    const validator = new TokenValidator();

    expect(validator.validate(tokensByHierarchy)).toBe(true);
    expect(validator.getErrors()).toEqual([]);
  });

  it("does not treat DTCG metadata keys as path segments", () => {
    const tokensByHierarchy = new Map<Hierarchy, TokenGroup>([
      [
        "universal",
        {
          color: {
            $type: "color",
            $description: "group metadata, not a token",
            blue: { $value: "#3B82F6" },
          },
        },
      ],
    ]);
    const validator = new TokenValidator();

    expect(validator.validate(tokensByHierarchy)).toBe(true);
    expect(validator.getErrors()).toEqual([]);
  });

  it("lets a token's own $type win over the group's", () => {
    const tokensByHierarchy = new Map<Hierarchy, TokenGroup>([
      [
        "universal",
        {
          scale: {
            $type: "dimension",
            ratio: { $value: 1.5, $type: "number" },
          },
        },
      ],
    ]);
    const validator = new TokenValidator();

    expect(validator.validate(tokensByHierarchy)).toBe(true);
  });

  it("resolves references declared inside a group-typed tree", () => {
    const tokensByHierarchy = new Map<Hierarchy, TokenGroup>([
      [
        "universal",
        {
          color: {
            $type: "color",
            blue: { $value: "#3B82F6" },
          },
        },
      ],
      [
        "system",
        {
          brand: {
            $type: "color",
            primary: { $value: "{color.blue}" },
          },
        },
      ],
    ]);
    const validator = new TokenValidator();

    expect(validator.validate(tokensByHierarchy)).toBe(true);
    expect(validator.getErrors()).toEqual([]);
  });

  it("validates fixture references against discovered token paths", () => {
    const validator = new TokenValidator();
    const tokensByHierarchy = loadFixtureTokensByHierarchy("valid");

    expect(validator.validate(tokensByHierarchy)).toBe(true);
  });

  it("allows references within the same hierarchy", () => {
    const tokensByHierarchy = new Map<Hierarchy, TokenGroup>([
      [
        "system",
        {
          color: {
            blue: {
              500: {
                $value: "#3B82F6",
                $type: "color",
              },
              600: {
                $value: "{color.blue.500}",
                $type: "color",
              },
            },
          },
        },
      ],
    ]);
    const validator = new TokenValidator();

    expect(validator.validate(tokensByHierarchy)).toBe(true);
    expect(validator.getErrors()).toEqual([]);
  });
});