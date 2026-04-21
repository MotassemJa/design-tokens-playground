import StyleDictionary, {
  type Config,
  type PlatformConfig,
  type File,
  type Transform
} from "style-dictionary";

/**
 * Preserves CSS function values during value transformation.
 *
 * This avoids accidental mutation of literals such as `clamp()` or `calc()`
 * when tokens are serialized for CSS output.
 */
export const cssFunctionTransform: Transform = {
  name: "css/function-preserve",
  type: "value",
  transitive: true,
  matcher: (token) => {
    // Apply to all tokens that might contain CSS functions
    return typeof token.value === "string" &&
           (token.value.includes("clamp(") ||
            token.value.includes("minmax(") ||
            token.value.includes("calc(") ||
            token.value.includes("var("));
  },
  transformer: (token) => {
    // Ensure CSS functions are preserved as-is
    return token.value;
  }
};

/**
 * Build toggles and output customization used by the token build pipeline.
 */
export interface BuildOptions {
  outputDir?: string;
  prefix?: string;
  includeReferences?: boolean;
  generateTypes?: boolean;
  generateJson?: boolean;
  generateCss?: boolean;
  generateJs?: boolean;
}

/**
 * Builds Style Dictionary platform configuration from runtime build options.
 */
export class BuildConfig {
  /**
   * @param options Build options coming from CLI arguments or defaults.
   */
  constructor(private options: BuildOptions) {}

  /**
   * Creates the CSS custom property output platform.
   *
   * @returns Style Dictionary platform config for `dist/css/variables.css`.
   */
  createCssPlatform(): PlatformConfig {
    const cssFileConfig: File = {
      format: "css/variables",
      destination: "variables.css",
    };

    return {
      transformGroup: "css",
      buildPath: `${this.options.outputDir}/css/`,
      prefix: this.options.prefix,
      options: {
        outputReferences: this.options.includeReferences,
      },
      files: [cssFileConfig],
    };
  }

  /**
   * Creates the JavaScript ESM output platform.
   *
   * @returns Style Dictionary platform config for `dist/tokens.js`.
   */
  createJsPlatform(): PlatformConfig {
    const jsFileConfig: File = {
      format: "javascript/es6",
      destination: "tokens.js",
    };

    return {
      transformGroup: "js",
      transforms: ["size/rem"],
      buildPath: `${this.options.outputDir}/`,
      prefix: this.options.prefix,
      files: [jsFileConfig],
    };
  }

  /**
   * Creates the TypeScript declaration output platform.
   *
   * @returns Style Dictionary platform config for `dist/tokens.d.ts`.
   */
  createTsPlatform(): PlatformConfig {
    const tsFileConfig: File = {
      format: "typescript/es6-declarations",
      destination: "tokens.d.ts",
    };

    return {
      transformGroup: "js",
      transforms: ["size/rem"],
      buildPath: `${this.options.outputDir}/`,
      prefix: this.options.prefix,
      files: [tsFileConfig],
    };
  }

  /**
   * Creates the full Style Dictionary config object for the active run.
   *
   * @param tokens Token tree to pass into Style Dictionary.
   * @returns Full Style Dictionary config with enabled platforms.
   */
  createConfig(tokens: Record<string, unknown>): Config {
    const platforms: Record<string, PlatformConfig> = {};

    if (this.options.generateCss) platforms.css = this.createCssPlatform();
    if (this.options.generateJs) platforms.js = this.createJsPlatform();
    if (this.options.generateTypes) platforms.ts = this.createTsPlatform();

    return {
      tokens,
      platforms,
    };
  }
}