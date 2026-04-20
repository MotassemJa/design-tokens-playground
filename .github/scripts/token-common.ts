import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TokenValidator } from "./token-validator.ts";

export interface TokenValue {
  $value: string | number | object | boolean;
  $description?: string;
  $type?: string;
}

export interface TokenObject {
  [key: string]: TokenValue | TokenObject;
}

export interface TokenData {
  action: "create" | "update" | "delete";
  category?: string;
  hierarchyLevel?: string;
  domain?: string;
  theme?: string;
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

function normalizeHierarchyLevel(level?: string): "universal" | "system" | "semantic" | "component" | "legacy" {
  if (!level) return "legacy";
  const value = level.toLowerCase();
  if (value.includes("universal")) return "universal";
  if (value.includes("system")) return "system";
  if (value.includes("semantic")) return "semantic";
  if (value.includes("component")) return "component";
  return "legacy";
}

function sanitizeSegment(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "");
}

function toFilenameDomain(domain?: string): string {
  const normalized = sanitizeSegment(domain ?? "other");
  return DOMAIN_FILENAME_MAP[normalized] ?? normalized;
}

function getTokenFilePathForHierarchy(data: TokenData): string {
  const level = normalizeHierarchyLevel(data.hierarchyLevel);

  // Legacy behavior for older issue templates/scripts.
  if (level === "legacy") {
    return getTokenFilePath(data.category ?? "other");
  }

  const domain = toFilenameDomain(data.domain);
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

function buildHierarchicalTokenPath(data: TokenData): string {
  if (!data.name) {
    return "";
  }

  const level = normalizeHierarchyLevel(data.hierarchyLevel);
  const name = sanitizeSegment(data.name);
  const domain = sanitizeSegment(data.domain ?? "");
  const theme = sanitizeSegment(data.theme ?? "");

  // Legacy path builder support for old templates.
  if (level === "legacy") {
    return buildTokenPath(name, data.group);
  }

  if (level === "universal") {
    return `universal.${domain}.${name}`;
  }

  if (level === "system") {
    const themePart = theme && theme !== "universal" ? `${theme}.` : "";
    return `system.${themePart}${domain}.${name}`;
  }

  if (level === "semantic") {
    return `semantic.${domain}.${name}`;
  }

  return `component.${name}`;
}

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

export function getTokenFilePath(category: string): string {
  const categoryDir = join(TOKENS_DIR, category);

  if (!existsSync(categoryDir)) {
    mkdirSync(categoryDir, { recursive: true });
  }

  return join(categoryDir, "base.tokens.json");
}

export function readTokenFile(filePath: string): TokenObject {
  if (existsSync(filePath)) {
    const content = readFileSync(filePath, "utf8");
    return JSON.parse(content) as TokenObject;
  }
  return {};
}

export function writeTokenFile(filePath: string, data: TokenObject): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

export function buildTokenPath(tokenName: string, tokenGroup?: string): string {
  if (tokenGroup && tokenGroup.trim()) {
    return `${tokenGroup.trim()}.${tokenName}`;
  }
  return tokenName;
}

export function createToken(data: TokenData): void {
  const filePath = getTokenFilePathForHierarchy(data);
  const tokens = readTokenFile(filePath);

  if (!data.name) {
    console.error("Token name is required for create action");
    process.exit(1);
  }

  const tokenPath = buildHierarchicalTokenPath(data);
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

export function updateToken(data: TokenData): void {
  if (!data.tokenPath) {
    console.error("Token path (--token-path) is required for update action");
    process.exit(1);
  }

  const tokenPath = data.tokenPath;
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

export function deleteToken(data: TokenData): void {
  if (!data.tokenPath) {
    console.error("Token path (--token-path) is required for delete action");
    process.exit(1);
  }

  const tokenPath = data.tokenPath;
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
