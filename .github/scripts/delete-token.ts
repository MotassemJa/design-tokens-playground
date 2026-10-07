#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { deleteToken, exitOnError, parseHierarchy, type TokenData } from "./token-common";

const argv = await yargs(hideBin(process.argv))
  .option("hierarchy", { type: "string", demandOption: true })
  .option("namespace", { type: "string" })
  .option("object", { type: "string" })
  .option("base", { type: "string" })
  .option("modifier", { type: "string" })
  .strict()
  .parseAsync();

const data: TokenData = {
  action: "delete",
  hierarchy: exitOnError(() => parseHierarchy(argv.hierarchy)),
  namespace: argv.namespace,
  object: argv.object,
  base: argv.base,
  modifier: argv.modifier,
};

deleteToken(data);
