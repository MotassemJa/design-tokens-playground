import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALLOWED_HIERARCHIES,
  TOKEN_FILENAME,
  TOKENS_ROOT,
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
 * Returns the validated hierarchy for a TokenData payload.
 */
export function getHierarchy(data: TokenData): Hierarchy {
  const rawHierarchy = String(data.hierarchy ?? "").trim();
  const normalizedHierarchy = rawHierarchy
    .replace(/^\[+/, "")
    .replace(/\]+$/, "")
    .trim()
    .toLowerCase() as Hierarchy;

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
export function getTokenFilePath(hierarchy: Hierarchy): string {
  const dir = join(TOKENS_DIR, hierarchy);
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
 * Validates a path against the Curtis Nathan convention. Exits on failure.
 */
function assertValidPath(tokenPath: string): void {
  const errors = TokenValidator.validatePath(tokenPath);
  if (errors.length > 0) {
    console.error("❌ Invalid token path (Curtis Nathan naming convention):");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
}

/**
 * Validates full token tree after an operation. Exits on failure.
 * Wraps the single-hierarchy tree into the Map form expected by TokenValidator.
 */
function assertTreeValid(tree: TokenTree, hierarchy: Hierarchy): void {
  const validator = new TokenValidator();
  const byHierarchy = new Map([[hierarchy, tree as TokenGroup]]);
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
