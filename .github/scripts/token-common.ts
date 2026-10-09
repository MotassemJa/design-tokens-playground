import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DesignToken, DesignTokens } from "style-dictionary/types";
import { convertToDTCG, flattenTokens } from "style-dictionary/utils";
import {
  ALLOWED_HIERARCHIES,
  TOKEN_FILENAME,
  TOKENS_ROOT,
  TokenLoader,
  type Hierarchy,
} from "../../src/token-loader";
import { TokenValidator, isDtcgMetadataKey } from "../../src/token-validator";

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

/** Reports a fatal error and exits. Typed `never` so callers narrow correctly. */
function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** {@link fail} for a headline plus one indented line per problem. */
function failWithList(headline: string, problems: string[]): never {
  return fail([headline, ...problems.map((p) => `  - ${p}`)].join("\n"));
}

/**
 * Reads a single value out of an issue-form dropdown.
 *
 * `issue-ops/parser` emits a dropdown as a JSON array (`["universal"]`), and
 * older forms of it as a bare bracketed value (`[universal]`). Both shapes, and
 * a plain string, normalize to the lowercase option text.
 */
export function parseDropdownValue(raw: unknown): string {
  const text = String(raw ?? "").trim();
  if (!text.startsWith("[")) return text.toLowerCase();

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return String(parsed[0] ?? "")
        .trim()
        .toLowerCase();
    }
  } catch {
    // Not JSON — fall through and treat it as the bare `[universal]` form.
  }

  return text
    .replace(/^\[+/, "")
    .replace(/\]+$/, "")
    .trim()
    .toLowerCase();
}

/**
 * Validates a raw hierarchy at the process boundary, so everything behind it
 * holds a real {@link Hierarchy} rather than whatever the form produced.
 */
export function parseHierarchy(raw: unknown): Hierarchy {
  const value = parseDropdownValue(raw) as Hierarchy;
  if (!ALLOWED_HIERARCHIES.includes(value)) {
    throw new Error(
      `Invalid hierarchy '${String(raw)}'. Allowed: ${ALLOWED_HIERARCHIES.join(", ")}`,
    );
  }
  return value;
}

/**
 * Runs a boundary parser, turning the error it throws into the same `❌ …` and
 * exit code every other failure in these scripts uses. The parsers throw rather
 * than exit so they stay ordinary functions; the CLI wrapper is where a process
 * is allowed to end.
 */
export function exitOnError<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    return fail(`❌ ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** The modes an import can run in. */
export const IMPORT_MODES = ["merge", "replace"] as const;

export type ImportMode = (typeof IMPORT_MODES)[number];

/** Validates a raw import mode at the process boundary. */
export function parseImportMode(raw: unknown): ImportMode {
  const value = parseDropdownValue(raw) as ImportMode;
  if (!IMPORT_MODES.includes(value)) {
    throw new Error(
      `Invalid mode '${String(raw)}'. Allowed: ${IMPORT_MODES.join(", ")}`,
    );
  }
  return value;
}

/**
 * Returns the single `tokens/{hierarchy}/tokens.json` file path.
 */
export function getTokenFilePath(hierarchy: Hierarchy): string {
  const dir = join(TOKENS_DIR, hierarchy);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return join(dir, TOKEN_FILENAME);
}

export function readTokenFile(filePath: string): DesignTokens {
  if (!existsSync(filePath)) return {};
  return JSON.parse(readFileSync(filePath, "utf8")) as DesignTokens;
}

export function writeTokenFile(filePath: string, data: DesignTokens): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Parses a raw value into a DTCG leaf (JSON object or string).
 */
export function parseTokenValue(value: string): DesignToken {
  try {
    const parsed = JSON.parse(value);
    return { $value: parsed };
  } catch {
    return { $value: value.trim() };
  }
}

export function getNested(
  tree: DesignTokens,
  tokenPath: string,
): DesignToken | DesignTokens | undefined {
  const parts = tokenPath.split(".");
  let current: DesignToken | DesignTokens | undefined = tree;
  for (const p of parts) {
    if (current && typeof current === "object" && p in current) {
      // A path segment is never a DTCG metadata key: a leading `$` is not a
      // valid name, so assertValidPaths rejects it long before we walk it.
      current = (current as DesignTokens)[p] as DesignToken | DesignTokens | undefined;
    } else {
      return undefined;
    }
  }
  return current;
}

export function setNested(
  tree: DesignTokens,
  tokenPath: string,
  value: DesignToken,
): void {
  const parts = tokenPath.split(".");
  let cursor: DesignTokens = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cursor[key];
    if (!next || typeof next !== "object" || "$value" in next) {
      cursor[key] = {};
    }
    cursor = cursor[key] as DesignTokens;
  }
  cursor[parts[parts.length - 1]] = value;
}

export function deleteNested(tree: DesignTokens, tokenPath: string): boolean {
  const parts = tokenPath.split(".");
  let cursor: DesignTokens = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cursor[key] || typeof cursor[key] !== "object") return false;
    cursor = cursor[key] as DesignTokens;
  }
  const last = parts[parts.length - 1];
  if (last in cursor) {
    delete cursor[last];
    return true;
  }
  return false;
}

export function cleanEmptyParents(tree: DesignTokens, tokenPath: string): void {
  const parts = tokenPath.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const parentPath = parts.slice(0, i).join(".");
    const parent = getNested(tree, parentPath);
    if (
      parent &&
      typeof parent === "object" &&
      !("$value" in parent) &&
      Object.keys(parent).length === 0
    ) {
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
    failWithList("❌ Invalid token path (Curtis Nathan naming convention):", errors);
  }
}

/**
 * Validates the token tree after an operation. Exits on failure.
 *
 * Loads every hierarchy and overlays the modified tree for the one being
 * written. Validating the single tree in isolation is not enough: references
 * carry no hierarchy prefix, so any cross-layer `{ref}` would be reported as
 * missing and every operation outside `design-values` would fail.
 */
export function assertTreeValid(tree: DesignTokens, hierarchy: Hierarchy): void {
  const validator = new TokenValidator();
  const byHierarchy = new TokenLoader().loadTokensByHierarchy();
  byHierarchy.set(hierarchy, tree);
  if (!validator.validate(byHierarchy)) {
    failWithList("❌ Token validation failed:", validator.getErrors());
  }
  validator.getWarnings().forEach((w) => console.warn(`⚠️  ${w}`));
}

/**
 * The `$type` a token at `tokenPath` inherits: that of its nearest ancestor
 * group carrying one, if any.
 */
export function inheritedType(tree: DesignTokens, tokenPath: string): string | undefined {
  let type = tree.$type;
  let node: unknown = tree;
  for (const part of tokenPath.split(".").slice(0, -1)) {
    node = (node as DesignTokens)[part];
    if (!node || typeof node !== "object") break;
    const groupType = (node as DesignTokens).$type;
    if (typeof groupType === "string") type = groupType;
  }
  return type;
}

/**
 * Gives a leaf the requested `$type`, writing it on the leaf only where a
 * group does not already supply it. A leaf whose own `$type` matches the
 * inherited one drops it, so the group stays the single source.
 */
function applyType(leaf: DesignToken, type: string, inherited: string | undefined): void {
  if (type === inherited) delete leaf.$type;
  else leaf.$type = type;
}

/**
 * Creates a token under the correct hierarchy bucket.
 */
export function createToken(data: TokenData): void {
  const tokenPath = buildTokenPath(data);
  assertValidPaths([tokenPath]);

  const hierarchy = data.hierarchy;
  const filePath = getTokenFilePath(hierarchy);
  const tree = readTokenFile(filePath);

  if (getNested(tree, tokenPath)) {
    console.log(
      `Token already exists at path: ${tokenPath}. Use the update action instead.`,
    );
    process.exit(0);
  }

  const leaf = parseTokenValue(data.value ?? "");
  if (data.tokenType) applyType(leaf, data.tokenType, inheritedType(tree, tokenPath));
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
  assertValidPaths([tokenPath]);

  const hierarchy = data.hierarchy;
  const filePath = getTokenFilePath(hierarchy);
  const tree = readTokenFile(filePath);

  const existing = getNested(tree, tokenPath);
  if (!existing || typeof existing !== "object" || !("$value" in existing)) {
    fail(`❌ Token not found at path: ${tokenPath}`);
  }

  // Spread the existing leaf first: an update manages $value, $type and
  // $description, and must not drop $extensions, $deprecated or anything else
  // the token already carries.
  const leaf: DesignToken = {
    ...(existing as DesignToken),
    ...parseTokenValue(data.value ?? ""),
  };
  if (data.tokenType) applyType(leaf, data.tokenType, inheritedType(tree, tokenPath));
  if (data.description) leaf.$description = data.description;

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
  assertValidPaths([tokenPath]);

  const hierarchy = data.hierarchy;
  const filePath = getTokenFilePath(hierarchy);
  const tree = readTokenFile(filePath);

  if (!getNested(tree, tokenPath)) {
    fail(`❌ Token not found at path: ${tokenPath}`);
  }

  deleteNested(tree, tokenPath);
  cleanEmptyParents(tree, tokenPath);
  // Deleting a token another layer still references would ship a tree that
  // cannot build, so the delete is validated like any other write.
  assertTreeValid(tree, hierarchy);
  writeTokenFile(filePath, tree);

  console.log(`🗑️  Deleted token: ${tokenPath}`);
}

/**
 * Input payload for an import request.
 */
export interface ImportData {
  hierarchy: Hierarchy;
  mode: ImportMode;
  /** The DTCG JSON document itself, as text. */
  json: string;
}

function isLeaf(node: unknown): boolean {
  return (
    !!node &&
    typeof node === "object" &&
    "$value" in (node as Record<string, unknown>)
  );
}

/**
 * Deep-merges `incoming` onto `target`, stopping at token leaves.
 *
 * A node carrying `$value` is replaced wholesale, never merged key by key:
 * recursing into it would strand the previous `$type` / `$description` when the
 * incoming document types the group instead of the leaf, which is exactly the
 * stale metadata an override is meant to clear.
 */
export function mergeTokenTrees(
  target: DesignTokens,
  incoming: DesignTokens,
): DesignTokens {
  for (const [key, value] of Object.entries(incoming)) {
    if (isDtcgMetadataKey(key) || isLeaf(value)) {
      target[key] = value;
      continue;
    }

    const existing = target[key];
    if (!existing || typeof existing !== "object" || isLeaf(existing)) {
      target[key] = {};
    }
    mergeTokenTrees(target[key] as DesignTokens, value as DesignTokens);
  }

  return target;
}

/**
 * Imports a DTCG JSON document into one hierarchy.
 *
 * The document is DTCG, or legacy Style Dictionary JSON converted to it. It is
 * not otherwise normalized: `$type` stays on whichever group or token declared
 * it, and the validator resolves inheritance.
 */
export function importTokens(data: ImportData): void {
  const hierarchy = data.hierarchy;

  // The issue form renders the field with `render: json`, so GitHub wraps the
  // value in a ```json … ``` fence. Take what is inside it.
  const json = data.json.trim().replace(/^```[\w-]*|```$/g, "").trim();

  if (json.length === 0) {
    fail("❌ The DTCG JSON was empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    fail(
      `❌ Could not parse the DTCG JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const isTokenObject =
    !!parsed && typeof parsed === "object" && !Array.isArray(parsed);
  if (!isTokenObject) {
    fail("❌ The DTCG JSON must contain a token object at the top level.");
  }
  // A legacy Style Dictionary document (`value`/`type`/`description`) is
  // converted to DTCG; a DTCG one passes through unchanged. Types stay where
  // the document declared them.
  const incoming = convertToDTCG(parsed as DesignTokens, { applyTypesToGroup: false });

  // flattenTokens keys each leaf as `{a.b.c}`; strip the braces for the path.
  assertValidPaths(flattenTokens(incoming, true).map((t) => t.key!.slice(1, -1)));

  const filePath = getTokenFilePath(hierarchy);

  const tree =
    data.mode === "replace"
      ? incoming
      : mergeTokenTrees(readTokenFile(filePath), incoming);

  assertTreeValid(tree, hierarchy);
  writeTokenFile(filePath, tree);

  console.log(`✅ Imported into '${hierarchy}' (${data.mode}).`);
}
