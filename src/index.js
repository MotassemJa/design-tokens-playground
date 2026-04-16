import StyleDictionary from "style-dictionary";

const sd = new StyleDictionary({
  source: ["tokens/**/*.tokens.json"],
  platforms: {
    css: {
      transformGroup: "css",
      buildPath: "dist/css/",
      options: {
        outputReferences: true,
      },
      files: [
        {
          format: "css/variables",
          destination: "variables.css",
        },
      ],
    },
  },
});

await sd.buildAllPlatforms();