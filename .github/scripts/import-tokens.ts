#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
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
  .strict()
  .parseAsync();

const data: ImportData = {
  hierarchy: exitOnError(() => parseHierarchy(argv.hierarchy)),
  mode: exitOnError(() => parseImportMode(argv.mode)),
  json: argv.json,
};

importTokens(data);
