import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatImportSummary,
  type TokenTree,
} from "../.github/scripts/token-common.js";
import { createTokenWorkspace, runScript, type ScriptResult } from "./test-helpers.js";

let workspace: string;

beforeEach(() => {
  workspace = createTokenWorkspace();
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

interface ImportOptions {
  hierarchy?: string;
  mode?: string;
  summary?: boolean;
}

function runImport(document: unknown, options: ImportOptions = {}): ScriptResult {
  const file = join(workspace, "import.json");
  writeFileSync(file, typeof document === "string" ? document : JSON.stringify(document));

  const args = [
    "--hierarchy", options.hierarchy ?? "universal",
    "--mode", options.mode ?? "merge",
    "--file", file,
  ];
  if (options.summary) args.push("--summary", join(workspace, "summary.md"));

  return runScript("import-tokens.ts", args, workspace);
}

function readHierarchy(hierarchy: string): TokenTree {
  return JSON.parse(
    readFileSync(join(workspace, "tokens", hierarchy, "tokens.json"), "utf8"),
  );
}

function readSummary(): string {
  return readFileSync(join(workspace, "summary.md"), "utf8");
}

describe("import-tokens — merge", () => {
  it("keeps tokens that the imported document does not mention", () => {
    const result = runImport({ color: { red: { 500: { $value: "#EF4444", $type: "color" } } } });

    expect(result.status).toBe(0);
    const universal = readHierarchy("universal") as any;
    expect(universal.color.blue["500"].$value).toBe("#3B82F6");
    expect(universal.color.red["500"].$value).toBe("#EF4444");
  });

  it("overrides an existing leaf's value", () => {
    const result = runImport(
      { color: { blue: { 500: { $value: "#1D4ED8", $type: "color" } } } },
      { summary: true },
    );

    expect(result.status).toBe(0);
    expect((readHierarchy("universal") as any).color.blue["500"].$value).toBe("#1D4ED8");
    expect(readSummary()).toContain("0 added, 1 updated, 0 removed");
  });

  it("replaces a leaf wholesale instead of merging its keys", () => {
    // The incoming document types the group, not the leaf. Merging key by key
    // would strand the old leaf-level $type and $description.
    const result = runImport({
      color: {
        $type: "color",
        blue: { 500: { $value: "#1D4ED8" } },
      },
    });

    expect(result.status).toBe(0);
    expect((readHierarchy("universal") as any).color.blue["500"]).toEqual({
      $value: "#1D4ED8",
    });
  });

  it("reports a retyped group as a change rather than passing silently", () => {
    const result = runImport({ color: { $type: "color" } }, { summary: true });

    expect(result.status).toBe(0);
    expect(readSummary()).toContain("`color.$type`");
  });
});

describe("import-tokens — DTCG conformance", () => {
  it("accepts a group-level $type with no $type on any leaf", () => {
    const result = runImport(
      {
        space: {
          $type: "dimension",
          scale: { 100: { $value: "4px" }, 200: { $value: "8px" } },
        },
      },
      { summary: true },
    );

    expect(result.status).toBe(0);
    const summary = readSummary();
    expect(summary).toContain("`space.scale.100`");
    expect(summary).toContain("`space.scale.200`");
  });

  it("does not treat a $-prefixed group key as a token path segment", () => {
    const result = runImport({
      space: {
        $type: "dimension",
        $description: "group metadata, not a token",
        scale: { 100: { $value: "4px" } },
      },
    });

    expect(result.status).toBe(0);
    expect(result.output).not.toContain("Segment '$");
  });

  it("rejects a leaf with no $type on it or any ancestor group", () => {
    const result = runImport({ space: { scale: { 100: { $value: "4px" } } } });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("is missing required $type");
  });
});

describe("import-tokens — replace", () => {
  it("drops tokens missing from the imported document", () => {
    // `component` is the top layer, so nothing references what we drop here.
    const result = runImport(
      {
        card: {
          color: {
            background: { $value: "{action.color.background.primary}", $type: "color" },
          },
        },
      },
      { mode: "replace", hierarchy: "component", summary: true },
    );

    expect(result.status).toBe(0);
    const component = readHierarchy("component") as any;
    expect(component.button).toBeUndefined();
    expect(component.card.color.background.$value).toBe("{action.color.background.primary}");
    expect(readSummary()).toContain("`button.primary.color.background`");
  });

  it("refuses to drop a token that another hierarchy still references", () => {
    const result = runImport(
      { color: { green: { 500: { $value: "#22C55E", $type: "color" } } } },
      { mode: "replace", hierarchy: "universal" },
    );

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("does not exist in any hierarchy");
  });

  it("leaves the file untouched when the import is rejected", () => {
    const file = join(workspace, "tokens", "universal", "tokens.json");
    const before = readFileSync(file, "utf8");

    runImport(
      { color: { green: { 500: { $value: "#22C55E", $type: "color" } } } },
      { mode: "replace", hierarchy: "universal" },
    );

    expect(readFileSync(file, "utf8")).toBe(before);
  });
});

describe("import-tokens — validation", () => {
  it("lists every malformed path at once", () => {
    const result = runImport({
      Color: { Blue_500: { $value: "#3B82F6", $type: "color" } },
      space: { Bad_Segment: { $value: "4px", $type: "dimension" } },
    });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Segment 'Color'");
    expect(result.output).toContain("Segment 'Blue_500'");
    expect(result.output).toContain("Segment 'Bad_Segment'");
  });

  it("accepts a reference to a layer below", () => {
    const result = runImport(
      {
        light: {
          color: { brand: { secondary: { $value: "{color.blue.500}", $type: "color" } } },
        },
      },
      { hierarchy: "system", summary: true },
    );

    expect(result.status).toBe(0);
    expect(readSummary()).toContain("`light.color.brand.secondary`");
  });

  it("rejects a reference pointing up the hierarchy", () => {
    const result = runImport(
      { color: { bad: { $value: "{action.color.background.primary}", $type: "color" } } },
      { hierarchy: "universal" },
    );

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Hierarchy violation");
  });

  it("rejects a file that is not JSON", () => {
    const result = runImport("{ not json");

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Could not parse");
  });

  it("rejects a document that is not a token object", () => {
    const result = runImport([1, 2, 3]);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("must contain a DTCG token object");
  });

  it("rejects a file that does not exist", () => {
    const result = runScript(
      "import-tokens.ts",
      ["--hierarchy", "universal", "--file", join(workspace, "absent.json")],
      workspace,
    );

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Import file not found");
  });
});

describe("import-tokens — dropdown values", () => {
  it("tolerates the bracketed form that issue-form dropdowns produce", () => {
    const result = runImport(
      { color: { red: { 500: { $value: "#EF4444", $type: "color" } } } },
      { mode: "[merge]", hierarchy: "[universal]", summary: true },
    );

    expect(result.status).toBe(0);
    expect((readHierarchy("universal") as any).color.blue["500"]).toBeDefined();
    expect(readSummary()).toContain("**Hierarchy**: `universal` · **Mode**: `merge`");
  });

  it("rejects an unknown mode", () => {
    const result = runImport({}, { mode: "overwrite" });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Invalid mode 'overwrite'");
  });

  it("rejects an unknown hierarchy", () => {
    const result = runImport({}, { hierarchy: "made-up" });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Invalid hierarchy");
  });
});

describe("import-tokens — summary file", () => {
  it("is only written when --summary is passed", () => {
    runImport({ color: { red: { 500: { $value: "#EF4444", $type: "color" } } } });

    expect(existsSync(join(workspace, "summary.md"))).toBe(false);
  });
});

describe("formatImportSummary", () => {
  it("caps long lists and reports the remainder", () => {
    const added = Array.from({ length: 53 }, (_, i) => `color.shade.${i}`);
    const markdown = formatImportSummary(
      { added, updated: [], removed: [], unchanged: [], changed: true },
      { hierarchy: "[universal]" as never, mode: "[MERGE]", file: "x.json" },
    );

    expect(markdown).toContain("### Added (53)");
    expect(markdown).toContain("**Hierarchy**: `universal` · **Mode**: `merge`");
    expect(markdown).toContain("…and 3 more");
    expect(markdown).not.toContain("### Removed");
  });
});
