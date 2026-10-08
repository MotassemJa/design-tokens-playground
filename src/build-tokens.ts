import { writeFileSync } from "node:fs";
import { join } from "node:path";
import StyleDictionary from "style-dictionary";
import { stripMeta } from "style-dictionary/utils";
import { ALLOWED_HIERARCHIES, TOKEN_FILENAME, TOKENS_ROOT, TokenLoader } from "./token-loader.js";
import { TokenValidator } from "./token-validator.js";
import { BuildConfig, type BuildOptions } from "./build-config.js";

/** The DTCG properties kept on each token in the resolved JSON export. */
const DTCG_PROPS = ["$value", "$type", "$description", "$extensions", "$deprecated"];

const tokenLoader = new TokenLoader();

/**
 * Runs the complete token build pipeline.
 *
 * Flow:
 * 1. Load and merge token files.
 * 2. Validate token schema and hierarchy.
 * 3. Build CSS/JS/types outputs with Style Dictionary.
 * 4. Write raw/resolved/interpreted JSON artifacts.
 *
 * @param options Optional build customization values.
 * @throws Error when token validation or hierarchy validation fails.
 */
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

  // Load tokens by hierarchy for validation; Style Dictionary reads the same
  // files itself for the build, lowest layer first.
  const tokensByHierarchy = tokenLoader.loadTokensByHierarchy();
  const source = ALLOWED_HIERARCHIES.map((hierarchy) => join(TOKENS_ROOT, hierarchy, TOKEN_FILENAME));
  const validator = new TokenValidator();

  if (!validator.validate(tokensByHierarchy)) {
    const errors = validator.getErrors().map((error) => `- ${error}`).join("\n");
    throw new Error(`Token validation failed:\n${errors}`);
  }

  const warnings = validator.getWarnings();
  if (warnings.length > 0) {
    console.warn("⚠️  Token validation warnings:");
    warnings.forEach((warning) => console.warn(`   - ${warning}`));
  }

  // Generate Style Dictionary platforms
  const config = new BuildConfig({
    outputDir,
    prefix,
    includeReferences,
    generateTypes,
    generateJson,
    generateCss,
    generateJs,
  }).createConfig(source);

  const sd = new StyleDictionary(config);

  await sd.buildAllPlatforms();

  if (generateJson) {
    console.log("📄 Generating enhanced JSON export...");

    // A platform with no transforms resolves every reference and leaves values
    // otherwise untouched. It writes the value-only tree itself; the resolved
    // tree that keeps each token's metadata is exported from it below.
    const resolver = new StyleDictionary({
      source,
      platforms: {
        resolved: {
          buildPath: `${outputDir}/`,
          files: [{ destination: "tokens.interpreted.json", format: "json/nested" }],
        },
      },
    });
    await resolver.buildAllPlatforms();
    const resolvedTokens = stripMeta(await resolver.exportPlatform("resolved"), {
      usesDtcg: true,
      keep: DTCG_PROPS,
    });

    // The merged tree before any platform resolves it: references stay as written.
    const rawTokens = stripMeta(sd.tokens, { usesDtcg: true, keep: DTCG_PROPS });

    writeFileSync(join(process.cwd(), outputDir, "tokens.json"), JSON.stringify(rawTokens, null, 2));
    writeFileSync(join(process.cwd(), outputDir, "tokens.resolved.json"), JSON.stringify(resolvedTokens, null, 2));
  }

  console.log("✅ Design tokens built successfully!");
  console.log(`   📁 Output directory: ${outputDir}/`);
  if (generateCss) console.log(`   🎨 CSS variables: ${outputDir}/css/variables.css`);
  if (generateJs) console.log(`   📦 JavaScript module: ${outputDir}/tokens.js`);
  if (generateTypes) console.log(`   🔷 TypeScript types: ${outputDir}/tokens.d.ts`);
  if (generateJson) {
    console.log(`   📋 Raw tokens: ${outputDir}/tokens.json`);
    console.log(`   🔍 Resolved tokens: ${outputDir}/tokens.resolved.json`);
    console.log(`   🧮 Resolved values: ${outputDir}/tokens.interpreted.json`);
  }
}
