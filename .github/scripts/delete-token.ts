#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { deleteToken, type TokenData } from "./token-common.ts";

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
  hierarchy: argv.hierarchy as TokenData["hierarchy"],
  namespace: argv.namespace,
  object: argv.object,
  base: argv.base,
  modifier: argv.modifier,
};

deleteToken(data);
