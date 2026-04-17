#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Type definitions
interface TokenValue {
  $value: string | number | object | boolean;
  $description?: string;
}

interface TokenObject {
  [key: string]: TokenValue | TokenObject;
}

interface TokenData {
  action: "create" | "update" | "delete";
  category: string;
  tokenName?: string;
  tokenGroup?: string;
  tokenPath?: string;
  tokenValue?: string;
  description?: string;
}

const tokenData: TokenData = JSON.parse(process.argv[2] ?? "{}");

const TOKENS_DIR: string = join(process.cwd(), "tokens");

/**
 * Parse a token value, handling complex types like typography objects
 */
function parseTokenValue(value: string): TokenValue {
  // Try to parse as JSON first (for complex values like typography)
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object") {
      return { $value: parsed };
    }
    return { $value: parsed };
  } catch {
    // Return as string $value
    return { $value: value.trim() };
  }
}

/**
 * Set a nested value in an object using dot notation path
 */
function setNestedValue(
  obj: TokenObject,
  pathStr: string,
  value: TokenValue | TokenObject
): void {
  const parts: string[] = pathStr.split(".");
  let current: TokenObject | TokenValue = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part: string = parts[i];
    if (!(part in current) || typeof current[part] !== "object") {
      (current as TokenObject)[part] = {} as TokenObject;
    }
    current = (current as TokenObject)[part] as TokenObject | TokenValue;
  }

  (current as TokenObject)[parts[parts.length - 1]] = value;
}

/**
 * Delete a nested value from an object using dot notation path
 */
function deleteNestedValue(obj: TokenObject, pathStr: string): boolean {
  const parts: string[] = pathStr.split(".");
  let current: TokenObject | TokenValue = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part: string = parts[i];
    if (!(part in current) || typeof current[part] !== "object") {
      return false; // Path doesn't exist
    }
    current = (current as TokenObject)[part] as TokenObject | TokenValue;
  }

  const lastPart: string = parts[parts.length - 1];
  if (lastPart in current) {
    delete (current as TokenObject)[lastPart];
    return true;
  }
  return false;
}

/**
 * Get a nested value from an object using dot notation path
 */
function getNestedValue(
  obj: TokenObject,
  pathStr: string
): TokenValue | TokenObject | undefined {
  const parts: string[] = pathStr.split(".");
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
 * Clean empty parent objects after deletion
 */
function cleanEmptyParents(obj: TokenObject, pathStr: string): void {
  const parts: string[] = pathStr.split(".");

  // Work backwards through the path
  for (let i = parts.length - 1; i > 0; i--) {
    const parentPath: string = parts.slice(0, i).join(".");
    const parent = getNestedValue(obj, parentPath);

    if (parent && typeof parent === "object" && Object.keys(parent).length === 0) {
      deleteNestedValue(obj, parentPath);
    } else {
      break; // Stop if parent is not empty
    }
  }
}

/**
 * Get or create the token file for a category
 */
function getTokenFilePath(category: string): string {
  const categoryDir: string = join(TOKENS_DIR, category);

  // Ensure category directory exists
  if (!existsSync(categoryDir)) {
    mkdirSync(categoryDir, { recursive: true });
  }

  return join(categoryDir, "base.tokens.json");
}

/**
 * Read token file or return empty object
 */
function readTokenFile(filePath: string): TokenObject {
  if (existsSync(filePath)) {
    const content: string = readFileSync(filePath, "utf8");
    return JSON.parse(content) as TokenObject;
  }
  return {};
}

/**
 * Write token file with pretty formatting
 */
function writeTokenFile(filePath: string, data: TokenObject): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Build the full token path including group
 */
function buildTokenPath(tokenName: string, tokenGroup?: string): string {
  if (tokenGroup && tokenGroup.trim()) {
    return `${tokenGroup.trim()}.${tokenName}`;
  }
  return tokenName;
}

/**
 * Create a new token
 */
function createToken(data: TokenData): void {
  const filePath: string = getTokenFilePath(data.category);
  const tokens: TokenObject = readTokenFile(filePath);

  const tokenPath: string = buildTokenPath(
    data.tokenName ?? "",
    data.tokenGroup
  );
  const tokenValue: TokenValue = parseTokenValue(data.tokenValue ?? "");

  // Add description/comment if provided
  if (data.description) {
    tokenValue.$description = data.description;
  }

  // Check if token already exists
  if (getNestedValue(tokens, tokenPath)) {
    console.log(`Token already exists at path: ${tokenPath}`);
    console.log("Use update action to modify existing tokens.");
    process.exit(0);
  }

  setNestedValue(tokens, tokenPath, tokenValue);
  writeTokenFile(filePath, tokens);

  console.log(
    `Created token: ${tokenPath} = ${JSON.stringify(tokenValue)}`
  );
}

/**
 * Update an existing token
 */
function updateToken(data: TokenData): void {
  const filePath: string = getTokenFilePath(data.category);
  const tokens: TokenObject = readTokenFile(filePath);

  const tokenPath: string = data.tokenPath ?? "";
  const existing = getNestedValue(tokens, tokenPath);

  if (!existing) {
    console.log(`Token not found at path: ${tokenPath}`);
    process.exit(1);
  }

  const tokenValue: TokenValue = parseTokenValue(data.tokenValue ?? "");

  // Preserve existing comment if no new description
  if (
    typeof existing === "object" &&
    "$description" in existing &&
    !data.description
  ) {
    tokenValue.$description = (existing as TokenValue).$description;
  } else if (data.description) {
    tokenValue.$description = data.description;
  }

  setNestedValue(tokens, tokenPath, tokenValue);
  writeTokenFile(filePath, tokens);

  console.log(
    `Updated token: ${tokenPath} = ${JSON.stringify(tokenValue)}`
  );
}

/**
 * Delete a token
 */
function deleteToken(data: TokenData): void {
  const filePath: string = getTokenFilePath(data.category);
  const tokens: TokenObject = readTokenFile(filePath);

  const tokenPath: string = data.tokenPath ?? "";

  if (!getNestedValue(tokens, tokenPath)) {
    console.log(`Token not found at path: ${tokenPath}`);
    process.exit(1);
  }

  deleteNestedValue(tokens, tokenPath);
  cleanEmptyParents(tokens, tokenPath);
  writeTokenFile(filePath, tokens);

  console.log(`Deleted token: ${tokenPath}`);
}

// Main execution
console.log("Processing token request:", tokenData);

switch (tokenData.action) {
  case "create":
    createToken(tokenData);
    break;
  case "update":
    updateToken(tokenData);
    break;
  case "delete":
    deleteToken(tokenData);
    break;
  default:
    console.error(`Unknown action: ${tokenData.action}`);
    process.exit(1);
}
