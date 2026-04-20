#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { deleteToken, type TokenData } from "./token-common.ts";

const argv = await yargs(hideBin(process.argv))
  .option("hierarchy-level", {
    alias: "l",
    type: "string",
    description: "Hierarchy level (universal, system, semantic, component)",
  })
  .option("domain", {
    alias: "m",
    type: "string",
    description: "Token domain/category",
  })
  .option("category", {
    alias: "c",
    type: "string",
    description: "Legacy token category",
  })
  .option("token-path", {
    alias: "p",
    type: "string",
    description: "Full token path to delete",
    demandOption: true,
  })
  .strict()
  .parseAsync();

const tokenData: TokenData = {
  action: "delete",
  category: argv.category,
  hierarchyLevel: argv["hierarchy-level"],
  domain: argv.domain,
  tokenPath: (argv["token-path"]),
};

deleteToken(tokenData);
