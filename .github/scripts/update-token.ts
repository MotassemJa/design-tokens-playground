#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { updateToken, type TokenData } from "./token-common.ts";

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
    description: "Full token path to update",
    demandOption: true,
  })
  .option("value", {
    alias: "v",
    type: "string",
    description: "Token value",
    demandOption: true,
  })
  .option("description", {
    alias: "d",
    type: "string",
    description: "Token description",
  })
  .strict()
  .parseAsync();

const tokenData: TokenData = {
  action: "update",
  category: argv.category,
  hierarchyLevel: argv["hierarchy-level"],
  domain: argv.domain,
  tokenPath: argv["token-path"],
  value: argv.value,
  description: argv.description,
};

updateToken(tokenData);
