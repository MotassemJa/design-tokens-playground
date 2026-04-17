import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface TokenValue {
  $value: string | number | object | boolean;
  $description?: string;
}

export interface TokenObject {
  [key: string]: TokenValue | TokenObject;
}

export interface TokenData {
  action: "create" | "update" | "delete";
  category: string;
  name?: string;
  group?: string;
  tokenPath?: string;
  value?: string;
  description?: string;
}

const TOKENS_DIR = join(process.cwd(), "tokens");

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
  const filePath = getTokenFilePath(data.category);
  const tokens = readTokenFile(filePath);

  if (!data.name) {
    console.error("Token name is required for create action");
    process.exit(1);
  }

  const tokenPath = buildTokenPath(data.name, data.group);
  const tokenValue = parseTokenValue(data.value ?? "");

  if (data.description) {
    tokenValue.$description = data.description;
  }

  if (getNestedValue(tokens, tokenPath)) {
    console.log(`Token already exists at path: ${tokenPath}`);
    console.log("Use update action to modify existing tokens.");
    process.exit(0);
  }

  setNestedValue(tokens, tokenPath, tokenValue);
  writeTokenFile(filePath, tokens);

  console.log(`Created token: ${tokenPath} = ${JSON.stringify(tokenValue)}`);
}

export function updateToken(data: TokenData): void {
  const filePath = getTokenFilePath(data.category);
  const tokens = readTokenFile(filePath);

  if (!data.tokenPath) {
    console.error("Token path (--token-path) is required for update action");
    process.exit(1);
  }

  const tokenPath = data.tokenPath;
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

  setNestedValue(tokens, tokenPath, tokenValue);
  writeTokenFile(filePath, tokens);

  console.log(`Updated token: ${tokenPath} = ${JSON.stringify(tokenValue)}`);
}

export function deleteToken(data: TokenData): void {
  const filePath = getTokenFilePath(data.category);
  const tokens = readTokenFile(filePath);

  if (!data.tokenPath) {
    console.error("Token path (--token-path) is required for delete action");
    process.exit(1);
  }

  const tokenPath = data.tokenPath;

  if (!getNestedValue(tokens, tokenPath)) {
    console.log(`Token not found at path: ${tokenPath}`);
    process.exit(1);
  }

  deleteNestedValue(tokens, tokenPath);
  cleanEmptyParents(tokens, tokenPath);
  writeTokenFile(filePath, tokens);

  console.log(`Deleted token: ${tokenPath}`);
}
