import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  formatImportSummary,
  importTokens,
  type ImportData,
  type TokenTree,
} from "../.github/scripts/token-common.js";
import { captureExit, getFixtureDir } from "./test-helpers.js";

let tokensRoot: string;
let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "import-tokens-"));
  tokensRoot = join(workDir, "tokens");
  cpSync(getFixtureDir("valid"), tokensRoot, { recursive: true });
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function runImport(
  document: unknown,
  overrides: Partial<ImportData> = {}
): ReturnType<typeof importTokens> {
  const file = join(workDir, "import.json");
  writeFileSync(file, typeof document === "string" ? document : JSON.stringify(document));
  return importTokens({ hierarchy: "universal", mode: "merge", file, tokensRoot, ...overrides });
}

function readHierarchy(hierarchy: string): TokenTree {
  return JSON.parse(readFileSync(join(tokensRoot, hierarchy, "tokens.json"), "utf8"));
}

describe("importTokens — merge", () => {
  it("keeps tokens that the imported document does not mention", () => {
    runImport({ color: { red: { 500: { $value: "#EF4444", $type: "color" } } } });

    const universal = readHierarchy("universal") as any;
    expect(universal.color.blue["500"].$value).toBe("#3B82F6");
    expect(universal.color.red["500"].$value).toBe("#EF4444");
  });

  it("overrides an existing leaf's value", () => {
    const summary = runImport({
      color: { blue: { 500: { $value: "#1D4ED8", $type: "color" } } },
    });

    expect((readHierarchy("universal") as any).color.blue["500"].$value).toBe("#1D4ED8");
    expect(summary.updated).toEqual(["color.blue.500"]);
    expect(summary.added).toEqual([]);
  });

  it("replaces a leaf wholesale instead of merging its keys", () => {
    // The incoming document types the group, not the leaf. Merging key by key
    // would strand the old leaf-level $type and $description.
    runImport({
      color: {
        $type: "color",
        blue: { 500: { $value: "#1D4ED8" } },
      },
    });

    const blue500 = (readHierarchy("universal") as any).color.blue["500"];
    expect(blue500).toEqual({ $value: "#1D4ED8" });
    expect(blue500.$type).toBeUndefined();
  });

  it("reports a retyped group as a change rather than passing silently", () => {
    const summary = runImport({ color: { $type: "color" } });

    expect(summary.added).toEqual(["color.$type"]);
  });
});

describe("importTokens — DTCG conformance", () => {
  it("accepts a group-level $type with no $type on any leaf", () => {
    const summary = runImport({
      space: {
        $type: "dimension",
        scale: { 100: { $value: "4px" }, 200: { $value: "8px" } },
      },
    });

    expect(summary.added).toEqual(["space.$type", "space.scale.100", "space.scale.200"]);
  });

  it("does not treat a $-prefixed group key as a token path segment", () => {
    const { exited } = captureExit(() =>
      runImport({
        space: {
          $type: "dimension",
          $description: "group metadata, not a token",
          scale: { 100: { $value: "4px" } },
        },
      })
    );

    expect(exited).toBe(false);
  });

  it("rejects a leaf with no $type on it or any ancestor group", () => {
    const { exited, errors } = captureExit(() =>
      runImport({ space: { scale: { 100: { $value: "4px" } } } })
    );

    expect(exited).toBe(true);
    expect(errors.join("\n")).toContain("is missing required $type");
  });
});

describe("importTokens — replace", () => {
  it("drops tokens missing from the imported document", () => {
    // `component` is the top layer, so nothing references what we drop here.
    const summary = runImport(
      { card: { color: { background: { $value: "{action.color.background.primary}", $type: "color" } } } },
      { mode: "replace", hierarchy: "component" }
    );

    const component = readHierarchy("component") as any;
    expect(component.button).toBeUndefined();
    expect(component.card.color.background.$value).toBe("{action.color.background.primary}");
    expect(summary.removed).toEqual(["button.primary.color.background"]);
  });

  it("refuses to drop a token that another hierarchy still references", () => {
    // `system` references `{color.blue.500}`; replacing universal without it
    // would ship a tree that cannot build.
    const { exited, errors } = captureExit(() =>
      runImport(
        { color: { green: { 500: { $value: "#22C55E", $type: "color" } } } },
        { mode: "replace", hierarchy: "universal" }
      )
    );

    expect(exited).toBe(true);
    expect(errors.join("\n")).toContain("does not exist in any hierarchy");
  });
});

describe("importTokens — validation", () => {
  it("lists every malformed path at once", () => {
    const { exited, errors } = captureExit(() =>
      runImport({
        Color: { Blue_500: { $value: "#3B82F6", $type: "color" } },
        space: { Bad_Segment: { $value: "4px", $type: "dimension" } },
      })
    );

    expect(exited).toBe(true);
    const output = errors.join("\n");
    expect(output).toContain("Segment 'Color'");
    expect(output).toContain("Segment 'Blue_500'");
    expect(output).toContain("Segment 'Bad_Segment'");
  });

  it("accepts a reference to a layer below (the cross-hierarchy guard)", () => {
    const summary = runImport(
      { light: { color: { brand: { secondary: { $value: "{color.blue.500}", $type: "color" } } } } },
      { hierarchy: "system" }
    );

    expect(summary.added).toEqual(["light.color.brand.secondary"]);
  });

  it("rejects a reference pointing up the hierarchy", () => {
    const { exited, errors } = captureExit(() =>
      runImport(
        { color: { bad: { $value: "{action.color.background.primary}", $type: "color" } } },
        { hierarchy: "universal" }
      )
    );

    expect(exited).toBe(true);
    expect(errors.join("\n")).toContain("Hierarchy violation");
  });

  it("rejects a file that is not JSON", () => {
    const { exited, errors } = captureExit(() => runImport("{ not json"));

    expect(exited).toBe(true);
    expect(errors.join("\n")).toContain("Could not parse");
  });

  it("rejects a document that is not a token object", () => {
    const { exited, errors } = captureExit(() => runImport([1, 2, 3]));

    expect(exited).toBe(true);
    expect(errors.join("\n")).toContain("must contain a DTCG token object");
  });
});

describe("formatImportSummary", () => {
  it("caps long lists and reports the remainder", () => {
    const added = Array.from({ length: 53 }, (_, i) => `color.shade.${i}`);
    const markdown = formatImportSummary(
      { added, updated: [], removed: [], unchanged: [], changed: true },
      { hierarchy: "universal", mode: "merge", file: "x.json" }
    );

    expect(markdown).toContain("### Added (53)");
    expect(markdown).toContain("…and 3 more");
    expect(markdown).not.toContain("### Removed");
  });
});
