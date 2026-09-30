import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertTreeValid,
  deleteToken,
  updateToken,
  type TokenLeaf,
  type TokenTree,
} from "../.github/scripts/token-common.js";
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


describe("deleteToken", () => {
  let workDir: string;
  let tokensRoot: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "delete-token-"));
    tokensRoot = join(workDir, "tokens");
    cpSync(FIXTURE_ROOT, tokensRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  function readHierarchy(hierarchy: string): TokenTree {
    return JSON.parse(readFileSync(join(tokensRoot, hierarchy, "tokens.json"), "utf8"));
  }

  it("deletes a token nothing else references", () => {
    const { exited } = captureExit(() =>
      deleteToken({
        action: "delete",
        hierarchy: "component",
        namespace: "button",
        object: "primary",
        base: "color.background",
        tokensRoot,
      })
    );

    expect(exited).toBe(false);
    expect(readHierarchy("component")).toEqual({});
  });

  it("refuses to delete a token another layer still references", () => {
    // `system` resolves `{color.blue.500}`. Before deletes were validated this
    // succeeded and left a tree that could not build.
    const { exited, errors } = captureExit(() =>
      deleteToken({
        action: "delete",
        hierarchy: "universal",
        namespace: "color",
        base: "blue.500",
        tokensRoot,
      })
    );

    expect(exited).toBe(true);
    expect(errors.join("\n")).toContain(
      "references 'color.blue.500' which does not exist in any hierarchy"
    );
  });

  it("leaves the file untouched when the delete is rejected", () => {
    const before = readFileSync(join(tokensRoot, "universal", "tokens.json"), "utf8");

    captureExit(() =>
      deleteToken({
        action: "delete",
        hierarchy: "universal",
        namespace: "color",
        base: "blue.500",
        tokensRoot,
      })
    );

    expect(readFileSync(join(tokensRoot, "universal", "tokens.json"), "utf8")).toBe(before);
  });
});


describe("updateToken", () => {
  let workDir: string;
  let tokensRoot: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "update-token-"));
    tokensRoot = join(workDir, "tokens");
    cpSync(FIXTURE_ROOT, tokensRoot, { recursive: true });

    // The fixture leaf carries every DTCG reserved property.
    const file = join(tokensRoot, "design-values", "tokens.json");
    const tree = JSON.parse(readFileSync(file, "utf8"));
    tree.blue["500"].lightness = {
      $value: 0.4989,
      $type: "number",
      $description: "Lightness channel of blue-500",
      $extensions: { "com.example.tool": { id: "abc123" } },
      $deprecated: "use blue.600.lightness instead",
    };
    writeFileSync(file, JSON.stringify(tree, null, 2));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  function readLeaf(): TokenLeaf {
    const tree = JSON.parse(
      readFileSync(join(tokensRoot, "design-values", "tokens.json"), "utf8"),
    );
    return tree.blue["500"].lightness;
  }

  it("keeps $extensions and $deprecated when only the value changes", () => {
    const { exited } = captureExit(() =>
      updateToken({
        action: "update",
        hierarchy: "design-values",
        namespace: "blue",
        base: "500.lightness",
        value: "0.55",
        tokensRoot,
      }),
    );

    expect(exited).toBe(false);
    expect(readLeaf()).toEqual({
      $value: 0.55,
      $type: "number",
      $description: "Lightness channel of blue-500",
      $extensions: { "com.example.tool": { id: "abc123" } },
      $deprecated: "use blue.600.lightness instead",
    });
  });

  it("still overrides $type and $description when they are supplied", () => {
    captureExit(() =>
      updateToken({
        action: "update",
        hierarchy: "design-values",
        namespace: "blue",
        base: "500.lightness",
        value: "0.55",
        tokenType: "dimension",
        description: "rewritten",
        tokensRoot,
      }),
    );

    const leaf = readLeaf();
    expect(leaf.$type).toBe("dimension");
    expect(leaf.$description).toBe("rewritten");
    expect(leaf.$extensions).toEqual({ "com.example.tool": { id: "abc123" } });
  });
});
