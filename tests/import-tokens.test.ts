import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  parseDropdownValue,
  parseHierarchy,
  parseImportMode,
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
}

function runImport(document: unknown, options: ImportOptions = {}): ScriptResult {
  const json = typeof document === "string" ? document : JSON.stringify(document);

  const args = [
    "--hierarchy", options.hierarchy ?? "universal",
    "--mode", options.mode ?? "merge",
    "--json", json,
  ];
  return runScript("import-tokens.ts", args, workspace);
}

function readHierarchy(hierarchy: string): TokenTree {
  return JSON.parse(
    readFileSync(join(workspace, "tokens", hierarchy, "tokens.json"), "utf8"),
  );
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
    const result = runImport({
      color: { blue: { 500: { $value: "#1D4ED8", $type: "color" } } },
    });

    expect(result.status).toBe(0);
    expect((readHierarchy("universal") as any).color.blue["500"].$value).toBe("#1D4ED8");
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
    const result = runImport({ color: { $type: "color" } }, {});

    expect(result.status).toBe(0);
    expect((readHierarchy("universal") as any).color.$type).toBe("color");
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
    );

    expect(result.status).toBe(0);
    const space = (readHierarchy("universal") as any).space;
    expect(space.$type).toBe("dimension");
    expect(space.scale["100"]).toEqual({ $value: "4px" });
    expect(space.scale["200"]).toEqual({ $value: "8px" });
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
      { mode: "replace", hierarchy: "component" },
    );

    expect(result.status).toBe(0);
    const component = readHierarchy("component") as any;
    expect(component.button).toBeUndefined();
    expect(component.card.color.background.$value).toBe("{action.color.background.primary}");

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
      { hierarchy: "system" },
    );

    expect(result.status).toBe(0);
    expect(
      (readHierarchy("system") as any).light.color.brand.secondary.$value,
    ).toBe("{color.blue.500}");
  });

  it("rejects a reference pointing up the hierarchy", () => {
    const result = runImport(
      { color: { bad: { $value: "{action.color.background.primary}", $type: "color" } } },
      { hierarchy: "universal" },
    );

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Hierarchy violation");
  });

  it("rejects input that is not JSON", () => {
    const result = runImport("{ not json");

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Could not parse");
  });

  it("rejects a document that is not a token object", () => {
    const result = runImport([1, 2, 3]);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("must contain a token object");
  });

  it("rejects an empty document", () => {
    const result = runImport("   ");

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("The DTCG JSON was empty");
  });

  it("carries a document full of quotes and backticks through intact", () => {
    const hostile = "it's got `backticks`, \"quotes\" and $(echo pwned)";
    const result = runImport(
      { color: { teal: { 500: { $value: "#14B8A6", $type: "color", $description: hostile } } } },
    );

    expect(result.status).toBe(0);
    expect(
      (readHierarchy("universal") as any).color.teal["500"].$description,
    ).toBe(hostile);
  });
});

describe("import-tokens — dropdown values", () => {
  it("tolerates the bracketed form that issue-form dropdowns produce", () => {
    const result = runImport(
      { color: { red: { 500: { $value: "#EF4444", $type: "color" } } } },
      { mode: "[merge]", hierarchy: "[universal]" },
    );

    expect(result.status).toBe(0);
    expect((readHierarchy("universal") as any).color.blue["500"]).toBeDefined();
    expect((readHierarchy("universal") as any).color.red["500"].$value).toBe("#EF4444");
  });
});


describe("parseDropdownValue", () => {
  it.each([
    ["merge", "merge"],
    ["MERGE", "merge"],
    ["  merge  ", "merge"],
    // issue-ops/parser emits a dropdown as a JSON array.
    ['["merge"]', "merge"],
    ['[ "Merge" ]', "merge"],
    ['["universal","ignored"]', "universal"],
    // the bare bracketed form the original scripts defended against
    ["[merge]", "merge"],
    ["[UNIVERSAL]", "universal"],
  ])("reads %j as %j", (raw, expected) => {
    expect(parseDropdownValue(raw)).toBe(expected);
  });

  it("reads an empty or missing value as the empty string", () => {
    expect(parseDropdownValue(undefined)).toBe("");
    expect(parseDropdownValue("")).toBe("");
    expect(parseDropdownValue("[]")).toBe("");
  });
});

describe("parseHierarchy", () => {
  it("accepts every allowed hierarchy, in any dropdown shape", () => {
    expect(parseHierarchy("design-values")).toBe("design-values");
    expect(parseHierarchy('["component"]')).toBe("component");
    expect(parseHierarchy("[System]")).toBe("system");
  });

  it("rejects anything else, naming what is allowed", () => {
    expect(() => parseHierarchy("made-up")).toThrow(/Invalid hierarchy 'made-up'/);
    expect(() => parseHierarchy("made-up")).toThrow(/design-values, universal/);
    expect(() => parseHierarchy("")).toThrow(/Invalid hierarchy/);
  });
});

describe("parseImportMode", () => {
  it("accepts both modes, in any dropdown shape", () => {
    expect(parseImportMode("merge")).toBe("merge");
    expect(parseImportMode('["replace"]')).toBe("replace");
    expect(parseImportMode("[Merge]")).toBe("merge");
  });

  it("rejects anything else, naming what is allowed", () => {
    expect(() => parseImportMode("overwrite")).toThrow(/Invalid mode 'overwrite'/);
    expect(() => parseImportMode("overwrite")).toThrow(/merge, replace/);
  });
});
