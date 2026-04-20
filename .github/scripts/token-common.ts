import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TokenValidator } from "./token-validator.ts";

/**
 * DTCG token leaf used by workflow helper scripts.
 */
export interface TokenValue {
  $value: string | number | object | boolean;
  $description?: string;
  $type?: string;
}

/**
 * Recursive token object used by script-side CRUD operations.
 */
export interface TokenObject {
  [key: string]: TokenValue | TokenObject;
}

/**
 * Input payload shared by create/update/delete workflow scripts.
 */
export interface TokenData {
  action: "create" | "update" | "delete";
  category?: string;
  hierarchyLevel?: string;
  domain?: string;
  theme?: string;
  namespaceLevel?: string;
  namespaceTheme?: string;
  namespaceDomain?: string;
  objectPath?: string;
  basePath?: string;
  modifierPath?: string;
  tokenType?: string;
  name?: string;
  group?: string;
  tokenPath?: string;
  value?: string;
  description?: string;
}

const TOKENS_DIR = join(process.cwd(), "tokens");

const DOMAIN_FILENAME_MAP: Record<string, string> = {
  color: "colors",
  typography: "typography",
  spacing: "spacing",
  size: "size",
  duration: "duration",
  border: "border",
  shadow: "shadow",
  button: "button",
  card: "card",
  input: "input",
  other: "other",
};

/**
 * Normalizes optional hierarchy level input from issue forms or CLI flags.
 */
function normalizeHierarchyLevel(level?: string): "universal" | "system" | "semantic" | "component" | "legacy" {
  if (!level) return "legacy";
  const value = level.toLowerCase();
  if (value.includes("universal")) return "universal";
  if (value.includes("system")) return "system";
  if (value.includes("semantic")) return "semantic";
  if (value.includes("component")) return "component";
  return "legacy";
}

/**
 * Resolves effective namespace layer from legacy and namespace-first inputs.
 */
function getNormalizedNamespaceLevel(data: TokenData): "universal" | "system" | "semantic" | "component" | "legacy" {
  return normalizeHierarchyLevel(data.namespaceLevel ?? data.hierarchyLevel);
}

/**
 * Resolves and sanitizes namespace domain segment.
 */
function getNormalizedNamespaceDomain(data: TokenData): string {
  return sanitizeSegment(data.namespaceDomain ?? data.domain ?? "");
}

/**
 * Resolves and sanitizes namespace theme segment.
 */
function getNormalizedNamespaceTheme(data: TokenData): string {
  return sanitizeSegment(data.namespaceTheme ?? data.theme ?? "");
}

/**
 * Sanitizes path/name segments for token paths and filenames.
 */
function sanitizeSegment(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "");
}

/**
 * Maps domain input to the domain segment used in token filenames.
 */
function toFilenameDomain(domain?: string): string {
  const normalized = sanitizeSegment(domain ?? "other");
  return DOMAIN_FILENAME_MAP[normalized] ?? normalized;
}

/**
 * Returns the token file path that should be mutated for a token operation.
 */
function getTokenFilePathForHierarchy(data: TokenData): string {
  const level = getNormalizedNamespaceLevel(data);

  // Legacy behavior for older issue templates/scripts.
  if (level === "legacy") {
    return getTokenFilePath(data.category ?? "other");
  }

  const domain = toFilenameDomain(data.namespaceDomain ?? data.domain);
  const layerDir = join(TOKENS_DIR, level);

  if (!existsSync(layerDir)) {
    mkdirSync(layerDir, { recursive: true });
  }

  switch (level) {
    case "universal":
      return join(layerDir, `base.${domain}.tokens.json`);
    case "system":
      return join(layerDir, `theme.${domain}.tokens.json`);
    case "semantic":
      return join(layerDir, `${domain}.tokens.json`);
    case "component":
      return join(layerDir, "base.tokens.json");
    default:
      return getTokenFilePath(data.category ?? "other");
  }
}

/**
 * Recursively lists token files below a directory.
 */
function listTokenFiles(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    return [];
  }

  const entries = readdirSync(dirPath);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listTokenFiles(fullPath));
      continue;
    }
    if (entry.endsWith(".tokens.json")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Finds the first token file containing a given token path.
 */
function findTokenFileByPath(tokenPath: string): string | undefined {
  const tokenFiles = listTokenFiles(TOKENS_DIR);
  for (const filePath of tokenFiles) {
    const tokens = readTokenFile(filePath);
    if (getNestedValue(tokens, tokenPath)) {
      return filePath;
    }
  }
  return undefined;
}

/**
 * Builds a normalized hierarchical token path from TokenData input.
 */
function buildHierarchicalTokenPath(data: TokenData): string {
  const level = getNormalizedNamespaceLevel(data);
  const domain = getNormalizedNamespaceDomain(data);
  const theme = getNormalizedNamespaceTheme(data);
  const name = sanitizeSegment(data.name ?? "");
  const objectPath = sanitizeSegment(data.objectPath ?? "").replace(/^\.+|\.+$/g, "");
  const basePath = sanitizeSegment(data.basePath ?? "").replace(/^\.+|\.+$/g, "");
  const modifierPath = sanitizeSegment(data.modifierPath ?? "").replace(/^\.+|\.+$/g, "");

  // Legacy path builder support for old templates.
  if (level === "legacy") {
    const legacyName = name || objectPath || basePath;
    if (!legacyName) return "";
    return buildTokenPath(legacyName, data.group);
  }

  // Assemble the sub-path from object + base + modifier segments, skipping empty parts.
  const subParts = [objectPath, basePath, modifierPath].filter(Boolean);

  // For backward compat: if only objectPath is supplied (no basePath/modifierPath),
  // treat it as the full relative path (legacy issue-form behaviour).
  // If basePath is provided, use the explicit 3-segment composition.
  const relativePath = subParts.join(".");

  // Fallback: name-based legacy support.
  if (!relativePath && !name) {
    return "";
  }

  const resolvedRelative = relativePath || name;

  if (level === "universal") {
    const parts = ["universal", domain, resolvedRelative].filter(Boolean);
    return parts.join(".");
  }

  if (level === "system") {
    const themePart = theme && theme !== "universal" ? theme : "";
    const parts = ["system", themePart, domain, resolvedRelative].filter(Boolean);
    return parts.join(".");
  }

  if (level === "semantic") {
    const parts = ["semantic", domain, resolvedRelative].filter(Boolean);
    return parts.join(".");
  }

  // component — no domain prefix
  const parts = ["component", resolvedRelative].filter(Boolean);
  return parts.join(".");
}

/**
 * Parses raw CLI token values into a DTCG-compatible token value object.
 */
export function parseTokenValue(value: string): TokenValue {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object") {
      return { $value: parsed };
    }
    return { $value: parsed };
  } catch {
    return { $value: value.trim() };
  }
}


/**
 * Writes a value to a nested object path using dot notation.
 */
export function setNestedValue(
  obj: TokenObject,
  pathStr: string,
  value: TokenValue | TokenObject
): void {
  const parts = pathStr.split(".");
  let current: TokenObject | TokenValue | any = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];

    if (
      typeof current !== "object" ||
      current === null ||
      !(part in current) ||
      typeof current[part] !== "object"
    ) {
      (current as TokenObject)[part] = {} as TokenObject;
    }

    current = (current as TokenObject)[part] as TokenObject | TokenValue;
  }

  (current as TokenObject)[parts[parts.length - 1]] = value;
}

/**
 * Deletes a value at a nested object path.
 *
 * @returns `true` when the target key existed and was deleted.
 */
export function deleteNestedValue(obj: TokenObject, pathStr: string): boolean {
  const parts = pathStr.split(".");
  let current: TokenObject | TokenValue | any = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current !== "object" || current === null || !(part in current) || typeof current[part] !== "object") {
      return false;
    }
    current = (current as TokenObject)[part] as TokenObject | TokenValue;
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart in current) {
    delete (current as TokenObject)[lastPart];
    return true;
  }
  return false;
}

/**
 * Reads a value at a nested object path.
 */
export function getNestedValue(
  obj: TokenObject,
  pathStr: string
): TokenValue | TokenObject | undefined {
  const parts = pathStr.split(".");
  let current: TokenObject | TokenValue | undefined = obj;

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as TokenObject)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Removes now-empty parent objects after a child deletion.
 */
export function cleanEmptyParents(obj: TokenObject, pathStr: string): void {
  const parts = pathStr.split(".");

  for (let i = parts.length - 1; i > 0; i--) {
    const parentPath = parts.slice(0, i).join(".");
    const parent = getNestedValue(obj, parentPath);

    if (parent && typeof parent === "object" && Object.keys(parent).length === 0) {
      deleteNestedValue(obj, parentPath);
    } else {
      break;
    }
  }
}

/**
 * Legacy category-based token file path helper.
 */
export function getTokenFilePath(category: string): string {
  const categoryDir = join(TOKENS_DIR, category);

  if (!existsSync(categoryDir)) {
    mkdirSync(categoryDir, { recursive: true });
  }

  return join(categoryDir, "base.tokens.json");
}

/**
 * Reads a token file if present, otherwise returns an empty object.
 */
export function readTokenFile(filePath: string): TokenObject {
  if (existsSync(filePath)) {
    const content = readFileSync(filePath, "utf8");
    return JSON.parse(content) as TokenObject;
  }
  return {};
}

/**
 * Writes a token object to disk with stable pretty formatting.
 */
export function writeTokenFile(filePath: string, data: TokenObject): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Legacy token path helper that prepends an optional group.
 */
export function buildTokenPath(tokenName: string, tokenGroup?: string): string {
  if (tokenGroup && tokenGroup.trim()) {
    return `${tokenGroup.trim()}.${tokenName}`;
  }
  return tokenName;
}

/**
 * Creates a token in the resolved target file and validates before write.
 */
export function createToken(data: TokenData): void {
  const filePath = getTokenFilePathForHierarchy(data);
  const tokens = readTokenFile(filePath);

  if (!data.name && !data.objectPath) {
    console.error("Either token name (--name) or object path (--object-path) is required for create action");
    process.exit(1);
  }

  const tokenPath = buildHierarchicalTokenPath(data);
  if (!tokenPath) {
    console.error("Could not determine token path from namespace/object inputs");
    process.exit(1);
  }
  const tokenValue = parseTokenValue(data.value ?? "");

  if (data.description) {
    tokenValue.$description = data.description;
  }

  if (data.tokenType) {
    tokenValue.$type = data.tokenType;
  } else if (data.category) {
    tokenValue.$type = data.category;
  }

  if (getNestedValue(tokens, tokenPath)) {
    console.log(`Token already exists at path: ${tokenPath}`);
    console.log("Use update action to modify existing tokens.");
    process.exit(0);
  }

  setNestedValue(tokens, tokenPath, tokenValue);

  // Validate before writing
  const validator = new TokenValidator();
  if (!validator.validate(tokens)) {
    console.error("❌ Token validation failed:");
    validator.getErrors().forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  if (validator.getWarnings().length > 0) {
    console.warn("⚠️  Validation warnings:");
    validator.getWarnings().forEach((warning) => console.warn(`  - ${warning}`));
  }

  writeTokenFile(filePath, tokens);

  console.log(`✅ Created token: ${tokenPath} = ${JSON.stringify(tokenValue)}`);
}

/**
 * Updates an existing token and validates the file before write.
 */
export function updateToken(data: TokenData): void {
  if (!data.tokenPath && !data.objectPath) {
    console.error("Token path (--token-path) or object path (--object-path) is required for update action");
    process.exit(1);
  }

  const tokenPath = data.tokenPath ?? buildHierarchicalTokenPath(data);
  const filePath = findTokenFileByPath(tokenPath) ?? getTokenFilePathForHierarchy(data);
  const tokens = readTokenFile(filePath);
  const existing = getNestedValue(tokens, tokenPath);

  if (!existing) {
    console.log(`Token not found at path: ${tokenPath}`);
    process.exit(1);
  }

  const tokenValue = parseTokenValue(data.value ?? "");

  if (typeof existing === "object" && "$description" in existing && !data.description) {
    tokenValue.$description = (existing as TokenValue).$description;
  } else if (data.description) {
    tokenValue.$description = data.description;
  }

  if (typeof existing === "object" && "$type" in existing && !data.tokenType) {
    tokenValue.$type = (existing as TokenValue).$type;
  } else if (data.tokenType) {
    tokenValue.$type = data.tokenType;
  }

  setNestedValue(tokens, tokenPath, tokenValue);

  // Validate before writing
  const validator = new TokenValidator();
  if (!validator.validate(tokens)) {
    console.error("❌ Token validation failed:");
    validator.getErrors().forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  if (validator.getWarnings().length > 0) {
    console.warn("⚠️  Validation warnings:");
    validator.getWarnings().forEach((warning) => console.warn(`  - ${warning}`));
  }

  writeTokenFile(filePath, tokens);

  console.log(`✅ Updated token: ${tokenPath} = ${JSON.stringify(tokenValue)}`);
}

/**
 * Deletes an existing token and prunes empty parent groups.
 */
export function deleteToken(data: TokenData): void {
  if (!data.tokenPath && !data.objectPath) {
    console.error("Token path (--token-path) or object path (--object-path) is required for delete action");
    process.exit(1);
  }

  const tokenPath = data.tokenPath ?? buildHierarchicalTokenPath(data);
  const filePath = findTokenFileByPath(tokenPath) ?? getTokenFilePathForHierarchy(data);
  const tokens = readTokenFile(filePath);

  if (!getNestedValue(tokens, tokenPath)) {
    console.log(`Token not found at path: ${tokenPath}`);
    process.exit(1);
  }

  deleteNestedValue(tokens, tokenPath);
  cleanEmptyParents(tokens, tokenPath);
  writeTokenFile(filePath, tokens);

  console.log(`Deleted token: ${tokenPath}`);
}
