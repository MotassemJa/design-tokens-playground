import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALLOWED_HIERARCHIES,
  TOKEN_FILENAME,
  TOKENS_ROOT,
  TokenLoader,
  type Hierarchy,
} from "../../src/token-loader.ts";
import { TokenValidator, type TokenGroup } from "../../src/token-validator.ts";

export interface TokenLeaf {
  $value: unknown;
  $type?: string;
  $description?: string;
}

export interface TokenTree {
  [key: string]: TokenLeaf | TokenTree;
}

/**
 * Input payload from issue-form / CLI.
 */
export interface TokenData {
  action: "create" | "update" | "delete";
  hierarchy: Hierarchy;
  namespace?: string;
  object?: string;
  base?: string;
  modifier?: string;
  value?: string;
  tokenType?: string;
  description?: string;
}

const TOKENS_DIR = join(process.cwd(), TOKENS_ROOT);

/**
 * Assembles a Curtis Nathan path from the group fields (no hierarchy prefix).
 */
export function buildTokenPath(data: TokenData): string {
  const parts = [data.namespace, data.object, data.base, data.modifier]
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0);
  return parts.join(".");
}

/**
 * Strips the brackets that issue-form dropdown values arrive wrapped in
 * (`[system]`) and lowercases the result.
 */
export function normalizeChoice(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/^\[+/, "")
    .replace(/\]+$/, "")
    .trim()
    .toLowerCase();
}

/**
 * Returns the validated hierarchy for a TokenData payload.
 */
export function getHierarchy(data: { hierarchy: Hierarchy }): Hierarchy {
  const rawHierarchy = String(data.hierarchy ?? "").trim();
  const normalizedHierarchy = normalizeChoice(rawHierarchy) as Hierarchy;

  if (!ALLOWED_HIERARCHIES.includes(normalizedHierarchy)) {
    throw new Error(
      `Invalid hierarchy '${rawHierarchy}'. Allowed: ${ALLOWED_HIERARCHIES.join(", ")}`
    );
  }
  return normalizedHierarchy;
}

/**
 * Returns the single `tokens/{hierarchy}/tokens.json` file path.
 */
export function getTokenFilePath(hierarchy: Hierarchy, tokensRoot: string = TOKENS_DIR): string {
  const dir = join(tokensRoot, hierarchy);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return join(dir, TOKEN_FILENAME);
}

export function readTokenFile(filePath: string): TokenTree {
  if (!existsSync(filePath)) return {};
  return JSON.parse(readFileSync(filePath, "utf8")) as TokenTree;
}

export function writeTokenFile(filePath: string, data: TokenTree): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Parses a raw value into a DTCG leaf (JSON object or string).
 */
export function parseTokenValue(value: string): TokenLeaf {
  try {
    const parsed = JSON.parse(value);
    return { $value: parsed };
  } catch {
    return { $value: value.trim() };
  }
}

export function getNested(tree: TokenTree, tokenPath: string): TokenLeaf | TokenTree | undefined {
  const parts = tokenPath.split(".");
  let current: TokenLeaf | TokenTree | undefined = tree;
  for (const p of parts) {
    if (current && typeof current === "object" && p in current) {
      current = (current as TokenTree)[p];
    } else {
      return undefined;
    }
  }
  return current;
}

export function setNested(tree: TokenTree, tokenPath: string, value: TokenLeaf): void {
  const parts = tokenPath.split(".");
  let cursor: TokenTree = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cursor[key];
    if (!next || typeof next !== "object" || "$value" in next) {
      cursor[key] = {};
    }
    cursor = cursor[key] as TokenTree;
  }
  cursor[parts[parts.length - 1]] = value;
}

export function deleteNested(tree: TokenTree, tokenPath: string): boolean {
  const parts = tokenPath.split(".");
  let cursor: TokenTree = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cursor[key] || typeof cursor[key] !== "object") return false;
    cursor = cursor[key] as TokenTree;
  }
  const last = parts[parts.length - 1];
  if (last in cursor) {
    delete cursor[last];
    return true;
  }
  return false;
}

export function cleanEmptyParents(tree: TokenTree, tokenPath: string): void {
  const parts = tokenPath.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const parentPath = parts.slice(0, i).join(".");
    const parent = getNested(tree, parentPath);
    if (parent && typeof parent === "object" && !("$value" in parent) && Object.keys(parent).length === 0) {
      deleteNested(tree, parentPath);
    } else {
      break;
    }
  }
}

/**
 * Validates paths against the Curtis Nathan convention. Exits on failure,
 * reporting every offending path — an import of 200 tokens should not need 200
 * round-trips to surface 200 naming errors.
 */
export function assertValidPaths(tokenPaths: string[]): void {
  const errors = tokenPaths.flatMap((p) => TokenValidator.validatePath(p));
  if (errors.length > 0) {
    console.error("❌ Invalid token path (Curtis Nathan naming convention):");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
}

function assertValidPath(tokenPath: string): void {
  assertValidPaths([tokenPath]);
}

/**
 * Validates the token tree after an operation. Exits on failure.
 *
 * Loads every hierarchy and overlays the modified tree for the one being
 * written. Validating the single tree in isolation is not enough: references
 * carry no hierarchy prefix, so any cross-layer `{ref}` would be reported as
 * missing and every operation outside `design-values` would fail.
 *
 * @param tokensRoot Token root to load the other hierarchies from. Defaults to
 * the repository's `tokens/` directory; tests point it at a fixture.
 */
export function assertTreeValid(
  tree: TokenTree,
  hierarchy: Hierarchy,
  tokensRoot: string = TOKENS_DIR
): void {
  const validator = new TokenValidator();
  const byHierarchy = new TokenLoader(tokensRoot).loadTokensByHierarchy() as Map<
    Hierarchy,
    TokenGroup
  >;
  byHierarchy.set(hierarchy, tree as TokenGroup);
  if (!validator.validate(byHierarchy)) {
    console.error("❌ Token validation failed:");
    validator.getErrors().forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  validator.getWarnings().forEach((w) => console.warn(`⚠️  ${w}`));
}

/**
 * Creates a token under the correct hierarchy bucket.
 */
export function createToken(data: TokenData): void {
  const tokenPath = buildTokenPath(data);
  assertValidPath(tokenPath);

  const hierarchy = getHierarchy(data);
  const filePath = getTokenFilePath(hierarchy);
  const tree = readTokenFile(filePath);

  if (getNested(tree, tokenPath)) {
    console.log(`Token already exists at path: ${tokenPath}. Use the update action instead.`);
    process.exit(0);
  }

  const leaf = parseTokenValue(data.value ?? "");
  if (data.tokenType) leaf.$type = data.tokenType;
  if (data.description) leaf.$description = data.description;

  setNested(tree, tokenPath, leaf);
  assertTreeValid(tree, hierarchy);
  writeTokenFile(filePath, tree);

  console.log(`✅ Created token: ${tokenPath}`);
}

/**
 * Updates an existing token's value/type/description.
 */
export function updateToken(data: TokenData): void {
  const tokenPath = buildTokenPath(data);
  assertValidPath(tokenPath);

  const hierarchy = getHierarchy(data);
  const filePath = getTokenFilePath(hierarchy);
  const tree = readTokenFile(filePath);

  const existing = getNested(tree, tokenPath);
  if (!existing || typeof existing !== "object" || !("$value" in existing)) {
    console.error(`Token not found at path: ${tokenPath}`);
    process.exit(1);
  }

  const leaf = parseTokenValue(data.value ?? "");
  leaf.$type = data.tokenType ?? (existing as TokenLeaf).$type;
  leaf.$description = data.description ?? (existing as TokenLeaf).$description;

  setNested(tree, tokenPath, leaf);
  assertTreeValid(tree, hierarchy);
  writeTokenFile(filePath, tree);

  console.log(`✅ Updated token: ${tokenPath}`);
}

/**
 * Deletes a token and cleans up empty parent groups.
 */
export function deleteToken(data: TokenData): void {
  const tokenPath = buildTokenPath(data);
  assertValidPath(tokenPath);

  const hierarchy = getHierarchy(data);
  const filePath = getTokenFilePath(hierarchy);
  const tree = readTokenFile(filePath);

  if (!getNested(tree, tokenPath)) {
    console.error(`Token not found at path: ${tokenPath}`);
    process.exit(1);
  }

  deleteNested(tree, tokenPath);
  cleanEmptyParents(tree, tokenPath);
  writeTokenFile(filePath, tree);

  console.log(`🗑️  Deleted token: ${tokenPath}`);
}

/**
 * Input payload for an import request.
 */
export interface ImportData {
  hierarchy: Hierarchy;
  /** `merge` or `replace`; tolerates the `[merge]` form dropdowns produce. */
  mode: string;
  /** Path to the DTCG JSON document to import. */
  file: string;
  /** Token root to write into. Defaults to the repository's `tokens/`. */
  tokensRoot?: string;
}

export interface ImportSummary {
  added: string[];
  updated: string[];
  removed: string[];
  unchanged: string[];
  changed: boolean;
}

/** Reports a fatal error and exits. Typed `never` so callers narrow correctly. */
function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function isLeaf(node: unknown): boolean {
  return !!node && typeof node === "object" && "$value" in (node as Record<string, unknown>);
}

function isDtcgMetadataKey(key: string): boolean {
  return key.startsWith("$");
}

/**
 * Records every addressable entry of a tree as `path -> serialized value`:
 * token leaves, plus group-level DTCG metadata such as an inherited `$type`.
 * Group metadata is included so that retyping a group is reported as a change
 * rather than passing silently — the leaves below it are untouched but their
 * effective type is not.
 */
function collectEntries(
  node: TokenTree,
  path: string[] = [],
  out: Map<string, string> = new Map()
): Map<string, string> {
  if (isLeaf(node)) {
    out.set(path.join("."), JSON.stringify(node));
    return out;
  }

  for (const [key, child] of Object.entries(node)) {
    const childPath = [...path, key];
    if (isDtcgMetadataKey(key)) {
      out.set(childPath.join("."), JSON.stringify(child));
    } else if (child && typeof child === "object") {
      collectEntries(child as TokenTree, childPath, out);
    }
  }

  return out;
}

/** Every token path in a tree, ignoring DTCG metadata keys. */
export function collectLeafPaths(node: TokenTree, path: string[] = [], out: string[] = []): string[] {
  if (isLeaf(node)) {
    out.push(path.join("."));
    return out;
  }

  for (const [key, child] of Object.entries(node)) {
    if (isDtcgMetadataKey(key)) continue;
    if (child && typeof child === "object") {
      collectLeafPaths(child as TokenTree, [...path, key], out);
    }
  }

  return out;
}

/**
 * Deep-merges `incoming` onto `target`, stopping at token leaves.
 *
 * A node carrying `$value` is replaced wholesale, never merged key by key:
 * recursing into it would strand the previous `$type` / `$description` when the
 * incoming document types the group instead of the leaf, which is exactly the
 * stale metadata an override is meant to clear.
 */
export function mergeTokenTrees(target: TokenTree, incoming: TokenTree): TokenTree {
  for (const [key, value] of Object.entries(incoming)) {
    if (isDtcgMetadataKey(key) || isLeaf(value)) {
      target[key] = value;
      continue;
    }

    const existing = target[key];
    if (!existing || typeof existing !== "object" || isLeaf(existing)) {
      target[key] = {};
    }
    mergeTokenTrees(target[key] as TokenTree, value as TokenTree);
  }

  return target;
}

/** Renders an import summary as markdown for the PR body. */
export function formatImportSummary(summary: ImportSummary, data: ImportData): string {
  const cap = 50;
  const section = (title: string, entries: string[]): string => {
    if (entries.length === 0) return "";
    const shown = entries.slice(0, cap).map((e) => `- \`${e}\``);
    const rest = entries.length - shown.length;
    if (rest > 0) shown.push(`- …and ${rest} more`);
    return `### ${title} (${entries.length})\n${shown.join("\n")}\n\n`;
  };

  const header =
    `**Hierarchy**: \`${normalizeChoice(data.hierarchy)}\` · ` +
    `**Mode**: \`${normalizeChoice(data.mode)}\`\n\n` +
    `${summary.added.length} added, ${summary.updated.length} updated, ` +
    `${summary.removed.length} removed, ${summary.unchanged.length} unchanged.\n\n`;

  return (
    header +
    section("Added", summary.added) +
    section("Updated", summary.updated) +
    section("Removed", summary.removed)
  ).trim();
}

/**
 * Imports a DTCG JSON document into one hierarchy.
 *
 * The document is assumed DTCG-conform and is not normalized: `$type` stays on
 * whichever group or token declared it, and the validator resolves inheritance.
 */
export function importTokens(data: ImportData): ImportSummary {
  const tokensRoot = data.tokensRoot ?? TOKENS_DIR;
  const hierarchy = getHierarchy(data);

  const mode = normalizeChoice(data.mode);
  if (mode !== "merge" && mode !== "replace") {
    fail(`❌ Invalid mode '${data.mode}'. Allowed: merge, replace`);
  }

  if (!existsSync(data.file)) {
    fail(`❌ Import file not found: ${data.file}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(data.file, "utf8"));
  } catch (error) {
    fail(
      `❌ Could not parse '${data.file}' as JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(`❌ '${data.file}' must contain a DTCG token object at the top level.`);
  }
  const incoming = parsed as TokenTree;

  assertValidPaths(collectLeafPaths(incoming));

  const filePath = getTokenFilePath(hierarchy, tokensRoot);
  const before = collectEntries(readTokenFile(filePath));

  const tree = mode === "replace" ? incoming : mergeTokenTrees(readTokenFile(filePath), incoming);

  const after = collectEntries(tree);

  const summary: ImportSummary = {
    added: [...after.keys()].filter((k) => !before.has(k)).sort(),
    updated: [...after.keys()].filter((k) => before.has(k) && before.get(k) !== after.get(k)).sort(),
    removed: [...before.keys()].filter((k) => !after.has(k)).sort(),
    unchanged: [...after.keys()].filter((k) => before.get(k) === after.get(k)).sort(),
    changed: false,
  };
  summary.changed =
    summary.added.length > 0 || summary.updated.length > 0 || summary.removed.length > 0;

  assertTreeValid(tree, hierarchy, tokensRoot);
  writeTokenFile(filePath, tree);

  console.log(
    `✅ Imported into '${hierarchy}' (${mode}): ${summary.added.length} added, ` +
      `${summary.updated.length} updated, ${summary.removed.length} removed, ` +
      `${summary.unchanged.length} unchanged.`
  );

  return summary;
}
