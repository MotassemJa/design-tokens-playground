#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  formatImportSummary,
  importTokens,
  exitOnError,
  parseHierarchy,
  parseImportMode,
  type ImportData,
} from "./token-common";

const argv = await yargs(hideBin(process.argv))
  .option("hierarchy", {
    type: "string",
    description: "Token hierarchy layer: design-values | universal | system | semantic | component",
    demandOption: true,
  })
  .option("mode", {
    type: "string",
    default: "merge",
    description: "merge: overlay onto the existing file. replace: the file becomes this document.",
  })
  .option("file", {
    type: "string",
    description: "Path to the DTCG JSON document to import",
    demandOption: true,
  })
  .option("summary", {
    type: "string",
    description: "Write a markdown summary of the import to this path",
  })
  .strict()
  .parseAsync();

const data: ImportData = {
  hierarchy: exitOnError(() => parseHierarchy(argv.hierarchy)),
  mode: exitOnError(() => parseImportMode(argv.mode)),
  file: argv.file,
};

const summary = importTokens(data);

if (argv.summary) {
  writeFileSync(argv.summary, formatImportSummary(summary, data) + "\n");
}
