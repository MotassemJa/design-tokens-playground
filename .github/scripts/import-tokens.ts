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
  .option("json", {
    type: "string",
    description: "The DTCG JSON document itself",
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
  json: argv.json,
};

const summary = importTokens(data);

if (argv.summary) {
  writeFileSync(argv.summary, formatImportSummary(summary, data) + "\n");
}
