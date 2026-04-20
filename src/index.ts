#!/usr/bin/env node

import { buildTokens } from "./build-tokens.js";
import type { BuildOptions } from "./build-config.js";

/**
 * Parses CLI arguments into build options.
 *
 * Supported flags mirror the CLI help output and map directly to
 * {@link BuildOptions} consumed by the build pipeline.
 *
 * @param args Raw process arguments after the node/script prefix.
 * @returns Normalized build options with defaults applied.
 */
function parseArgs(args: string[]): BuildOptions {
  const options: BuildOptions = {
    outputDir: "dist",
    prefix: "ds",
    includeReferences: true,
    generateTypes: true,
    generateJson: true,
    generateCss: true,
    generateJs: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--output-dir":
      case "-o":
        options.outputDir = args[++i];
        break;
      case "--prefix":
      case "-p":
        options.prefix = args[++i];
        break;
      case "--no-references":
        options.includeReferences = false;
        break;
      case "--no-types":
        options.generateTypes = false;
        break;
      case "--no-json":
        options.generateJson = false;
        break;
      case "--no-css":
        options.generateCss = false;
        break;
      case "--no-js":
        options.generateJs = false;
        break;
    }
  }

  return options;
}

/**
 * Prints CLI usage instructions to stdout.
 */
function printHelp(): void {
  console.log(`
🎨 Design Tokens Builder

Usage: npm run build [options]

Options:
  --output-dir, -o    Output directory (default: dist)
  --prefix, -p        CSS variable prefix (default: ds)
  --no-references     Don't include references in CSS output
  --no-types          Don't generate TypeScript definitions
  --no-json           Don't generate JSON exports
  --no-css            Don't generate CSS variables
  --no-js             Don't generate JavaScript module
  --help, -h          Show this help

Examples:
  npm run build
  npm run build --prefix myapp --output-dir build
  npm run build --no-types --no-json
`);
}

/**
 * CLI entrypoint for local and CI token builds.
 *
 * The function short-circuits for help flags and otherwise executes
 * the token build with parsed options.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  try {
    await buildTokens(parseArgs(args));
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { buildTokens, type BuildOptions };
