import type { Hierarchy } from "../src/token-loader.js";
import type { DesignTokens } from "style-dictionary/types";
import { TokenValidator } from "../src/token-validator.js";
import { loadFixtureTokensByHierarchy, validateFixture } from "./test-helpers.js";

describe("TokenValidator.validatePath", () => {
  it("accepts any casing DTCG allows", () => {
    expect(TokenValidator.validatePath("color.brand-primary.500")).toEqual([]);
    expect(TokenValidator.validatePath("text.lineHeights.Large_1")).toEqual([]);
  });

  it("rejects segments that break the DTCG name rules", () => {
    expect(TokenValidator.validatePath("color.{blue}.$500..x")).toEqual([
      "Segment '{blue}' in path 'color.{blue}.$500..x' is not a valid DTCG name (must be non-empty, not start with '$', and not contain '{' or '}').",
      "Segment '$500' in path 'color.{blue}.$500..x' is not a valid DTCG name (must be non-empty, not start with '$', and not contain '{' or '}').",
      "Segment '' in path 'color.{blue}.$500..x' is not a valid DTCG name (must be non-empty, not start with '$', and not contain '{' or '}').",
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
        expect.stringContaining("Segment '{blue}'"),
        expect.stringContaining("Segment '$primary'"),
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
        expect.stringContaining("Tries to reference does.not.exist, which is not defined."),
      ])
    );
  });

  it("reports two paths that become the same platform name", () => {
    const tokensByHierarchy = new Map<Hierarchy, DesignTokens>([
      ["universal", { text: { $type: "number", lineHeights: { normal: { $value: 1.2 } } } }],
      ["system", { text: { $type: "number", "line-heights": { normal: { $value: 1.5 } } } }],
    ]);
    const validator = new TokenValidator();

    expect(validator.validate(tokensByHierarchy)).toBe(false);
    expect(validator.getErrors()).toContain(
      "Tokens 'text.lineHeights.normal' and 'text.line-heights.normal' both become 'text-line-heights-normal' (name/kebab)."
    );
  });

  it("requires $type on a token with no ancestor group $type", () => {
    const tokensByHierarchy = new Map<Hierarchy, DesignTokens>([
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
    const tokensByHierarchy = new Map<Hierarchy, DesignTokens>([
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
    const tokensByHierarchy = new Map<Hierarchy, DesignTokens>([
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
    const tokensByHierarchy = new Map<Hierarchy, DesignTokens>([
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
    const tokensByHierarchy = new Map<Hierarchy, DesignTokens>([
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
    const tokensByHierarchy = new Map<Hierarchy, DesignTokens>([
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