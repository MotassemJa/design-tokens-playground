import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DesignToken, DesignTokens } from "style-dictionary/types";
import { createTokenWorkspace, runScript } from "./test-helpers.js";

let workspace: string;

beforeEach(() => {
  workspace = createTokenWorkspace();
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

function readHierarchy(hierarchy: string): DesignTokens {
  return JSON.parse(
    readFileSync(join(workspace, "tokens", hierarchy, "tokens.json"), "utf8"),
  );
}

describe("create-token", () => {
  it("resolves references against every hierarchy, not just the one being written", () => {
    // `semantic` references a `system` token. While the tree was validated in
    // isolation this failed, which broke every create outside `design-values`.
    const result = runScript(
      "create-token.ts",
      [
        "--hierarchy", "semantic",
        "--namespace", "action",
        "--base", "color.background",
        "--modifier", "secondary",
        "--value", "{light.color.brand.primary}",
        "--token-type", "color",
        "--description", "secondary action background",
      ],
      workspace,
    );

    expect(result.output).not.toContain("which is not defined");
    expect(result.status).toBe(0);
    expect((readHierarchy("semantic") as any).action.color.background.secondary.$value).toBe(
      "{light.color.brand.primary}",
    );
  });

  it("rejects a reference to a token that exists nowhere", () => {
    const result = runScript(
      "create-token.ts",
      [
        "--hierarchy", "semantic",
        "--namespace", "action",
        "--base", "color.background",
        "--modifier", "broken",
        "--value", "{nope.not-here}",
        "--token-type", "color",
        "--description", "broken",
      ],
      workspace,
    );

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("which is not defined");
  });

  it("rejects a reference pointing up the hierarchy", () => {
    const result = runScript(
      "create-token.ts",
      [
        "--hierarchy", "universal",
        "--base", "color.bad",
        "--value", "{action.color.background.primary}",
        "--token-type", "color",
        "--description", "upward reference",
      ],
      workspace,
    );

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Hierarchy violation");
  });

  it("rejects a path segment that is not kebab-case", () => {
    const result = runScript(
      "create-token.ts",
      [
        "--hierarchy", "universal",
        "--base", "Color.Bad_Segment",
        "--value", "#000000",
        "--token-type", "color",
        "--description", "bad name",
      ],
      workspace,
    );

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Segment 'Color'");
    expect(result.output).toContain("Segment 'Bad_Segment'");
  });
});

describe("delete-token", () => {
  it("deletes a token nothing else references", () => {
    const result = runScript(
      "delete-token.ts",
      [
        "--hierarchy", "component",
        "--namespace", "button",
        "--object", "primary",
        "--base", "color.background",
      ],
      workspace,
    );

    expect(result.status).toBe(0);
    expect(readHierarchy("component")).toEqual({});
  });

  it("refuses to delete a token another layer still references", () => {
    // `system` resolves `{color.blue.500}`. Before deletes were validated this
    // succeeded and left a tree that could not build.
    const result = runScript(
      "delete-token.ts",
      ["--hierarchy", "universal", "--namespace", "color", "--base", "blue.500"],
      workspace,
    );

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      "Tries to reference color.blue.500, which is not defined.",
    );
  });

  it("leaves the file untouched when the delete is rejected", () => {
    const file = join(workspace, "tokens", "universal", "tokens.json");
    const before = readFileSync(file, "utf8");

    runScript(
      "delete-token.ts",
      ["--hierarchy", "universal", "--namespace", "color", "--base", "blue.500"],
      workspace,
    );

    expect(readFileSync(file, "utf8")).toBe(before);
  });
});

describe("update-token", () => {
  /** Gives the fixture leaf every DTCG reserved property. */
  function seedFullLeaf(): void {
    const file = join(workspace, "tokens", "design-values", "tokens.json");
    const tree = JSON.parse(readFileSync(file, "utf8"));
    tree.blue["500"].lightness = {
      $value: 0.4989,
      $type: "number",
      $description: "Lightness channel of blue-500",
      $extensions: { "com.example.tool": { id: "abc123" } },
      $deprecated: "use blue.600.lightness instead",
    };
    writeFileSync(file, JSON.stringify(tree, null, 2));
  }

  function readLeaf(): DesignToken {
    return (readHierarchy("design-values") as any).blue["500"].lightness;
  }

  it("keeps $extensions and $deprecated when only the value changes", () => {
    seedFullLeaf();

    const result = runScript(
      "update-token.ts",
      ["--hierarchy", "design-values", "--namespace", "blue", "--base", "500.lightness", "--value", "0.55"],
      workspace,
    );

    expect(result.status).toBe(0);
    expect(readLeaf()).toEqual({
      $value: 0.55,
      $type: "number",
      $description: "Lightness channel of blue-500",
      $extensions: { "com.example.tool": { id: "abc123" } },
      $deprecated: "use blue.600.lightness instead",
    });
  });

  it("still overrides $type and $description when they are supplied", () => {
    seedFullLeaf();

    runScript(
      "update-token.ts",
      [
        "--hierarchy", "design-values",
        "--namespace", "blue",
        "--base", "500.lightness",
        "--value", "0.55",
        "--token-type", "dimension",
        "--description", "rewritten",
      ],
      workspace,
    );

    const leaf = readLeaf();
    expect(leaf.$type).toBe("dimension");
    expect(leaf.$description).toBe("rewritten");
    expect(leaf.$extensions).toEqual({ "com.example.tool": { id: "abc123" } });
  });

  it("rejects an update to a token that does not exist", () => {
    const result = runScript(
      "update-token.ts",
      ["--hierarchy", "universal", "--base", "color.absent", "--value", "#000000"],
      workspace,
    );

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Token not found");
  });
});
