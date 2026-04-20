import { writeFileSync } from "node:fs";
import { join } from "node:path";
import StyleDictionary from "style-dictionary";
import { builders, processTokens } from "@tokens-studio/tokenscript-interpreter";
import { TokenLoader } from "./token-loader.js";
import { TokenReferenceResolver } from "./token-reference-resolver.js";
import { TokenValidator, type TokenGroup } from "./token-validator.js";
import { BuildConfig, type BuildOptions } from "./build-config.js";

const tokenLoader = new TokenLoader();

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeInterpretedValue(value: unknown): unknown {
  if (Array.isArray(value) && value.every((entry) => ["string", "number", "boolean"].includes(typeof entry))) {
    return value.join(" ");
  }

  return value;
}

function normalizeFlatInterpretedValues(flatValues: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(flatValues).map(([tokenPath, interpretedValue]) => [
      tokenPath,
      normalizeInterpretedValue(interpretedValue),
    ])
  );
}

function setNestedValue(target: Record<string, unknown>, path: string[], nextValue: unknown): void {
  let current: Record<string, unknown> = target;

  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const isLeaf = i === path.length - 1;

    if (isLeaf) {
      current[key] = nextValue;
      return;
    }

    const node = current[key];
    if (!node || typeof node !== "object") {
      current[key] = {};
    }

    current = current[key] as Record<string, unknown>;
  }
}

function applyInterpretedValues(
  tokens: Record<string, unknown>,
  flatInterpretedValues: Record<string, unknown>
): Record<string, unknown> {
  const cloned = deepClone(tokens);

  for (const [tokenPath, resolvedValue] of Object.entries(flatInterpretedValues)) {
    const pathParts = tokenPath.split(".");
    let current: unknown = cloned;

    for (const part of pathParts) {
      if (!current || typeof current !== "object" || !(part in (current as Record<string, unknown>))) {
        current = null;
        break;
      }

      current = (current as Record<string, unknown>)[part];
    }

    if (current && typeof current === "object" && "$value" in (current as Record<string, unknown>)) {
      (current as { $value: unknown }).$value = resolvedValue;
    }
  }

  return cloned;
}

function buildInterpretedJson(
  interpretedTokenTree: Record<string, unknown>,
  flatInterpretedValues: Record<string, unknown>
): Record<string, unknown> {
  const result = deepClone(interpretedTokenTree);

  for (const [tokenPath, resolvedValue] of Object.entries(flatInterpretedValues)) {
    setNestedValue(result, tokenPath.split("."), resolvedValue);
  }

  return result;
}

function formatIssues(issues: Map<string, unknown[]>, maxLines = 20): string {
  const lines: string[] = [];

  for (const [tokenPath, tokenIssues] of issues) {
    for (const issue of tokenIssues) {
      if (lines.length >= maxLines) {
        return `${lines.join("\n")}\n...and more issues omitted`;
      }

      if (issue && typeof issue === "object") {
        const issueObj = issue as Record<string, unknown>;
        const message =
          typeof issueObj.message === "string"
            ? issueObj.message
            : typeof issueObj.code === "string"
              ? issueObj.code
              : JSON.stringify(issueObj);
        lines.push(`- ${tokenPath}: ${message}`);
      } else {
        lines.push(`- ${tokenPath}: ${String(issue)}`);
      }
    }
  }

  return lines.join("\n");
}

export async function buildTokens(options: BuildOptions = {}) {
  const {
    outputDir = "dist",
    prefix = "ds",
    includeReferences = true,
    generateTypes = true,
    generateJson = true,
    generateCss = true,
    generateJs = true,
  } = options;

  console.log("🔨 Building design tokens...");

  // Load and merge source tokens
  const allTokens = tokenLoader.loadTokens();
  const validator = new TokenValidator();

  if (!validator.validate(allTokens as TokenGroup)) {
    const errors = validator.getErrors().map((error) => `- ${error}`).join("\n");
    throw new Error(`Token validation failed:\n${errors}`);
  }

  // Validate cross-layer hierarchy
  validator.validateHierarchy(allTokens as TokenGroup);
  const hierarchyErrors = validator.getErrors();
  if (hierarchyErrors.length > 0) {
    const errors = hierarchyErrors.map((error) => `- ${error}`).join("\n");
    throw new Error(`Token hierarchy validation failed:\n${errors}`);
  }

  const warnings = validator.getWarnings();
  if (warnings.length > 0) {
    console.warn("⚠️  Token validation warnings:");
    warnings.forEach((warning) => console.warn(`   - ${warning}`));
  }

  console.log("🎯 Interpreting tokens with tokenscript-interpreter...");
  const processed = processTokens(allTokens, {
    builder: new builders.FlatObjectBuilder(),
  });

  if (processed.issues && processed.issues.size > 0) {
    console.warn("⚠️  TokenScript interpretation reported issues. Falling back to original values for affected tokens.");
    console.warn(formatIssues(processed.issues));
  }

  const flatInterpretedValues = normalizeFlatInterpretedValues(toObject(processed.output));
  const interpretedTokens = applyInterpretedValues(allTokens, flatInterpretedValues);

  // Generate Style Dictionary platforms
  const config = new BuildConfig({
    outputDir,
    prefix,
    includeReferences,
    generateTypes,
    generateJson,
    generateCss,
    generateJs,
  }).createConfig(interpretedTokens);

  const sd = new StyleDictionary(config);

  await sd.buildAllPlatforms();

  if (generateJson) {
    console.log("📄 Generating enhanced JSON export...");

    const resolvedTokens = new TokenReferenceResolver().resolveReferences(interpretedTokens);
    const interpretedOutput = buildInterpretedJson(interpretedTokens, flatInterpretedValues);

    writeFileSync(join(process.cwd(), outputDir, "tokens.json"), JSON.stringify(allTokens, null, 2));
    writeFileSync(join(process.cwd(), outputDir, "tokens.resolved.json"), JSON.stringify(resolvedTokens, null, 2));
    writeFileSync(join(process.cwd(), outputDir, "tokens.interpreted.json"), JSON.stringify(interpretedOutput, null, 2));
  }

  console.log("✅ Design tokens built successfully!");
  console.log(`   📁 Output directory: ${outputDir}/`);
  if (generateCss) console.log(`   🎨 CSS variables: ${outputDir}/css/variables.css`);
  if (generateJs) console.log(`   📦 JavaScript module: ${outputDir}/tokens.js`);
  if (generateTypes) console.log(`   🔷 TypeScript types: ${outputDir}/tokens.d.ts`);
  if (generateJson) {
    console.log(`   📋 Raw tokens: ${outputDir}/tokens.json`);
    console.log(`   🔍 Resolved tokens: ${outputDir}/tokens.resolved.json`);
  }
}
