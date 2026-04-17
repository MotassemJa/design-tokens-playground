#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createToken, type TokenData } from "./token-common.ts";

const argv = await yargs(hideBin(process.argv))
  .option("category", {
    alias: "c",
    type: "string",
    description: "Token category (e.g., color, typography)",
    demandOption: true,
  })
  .option("name", {
    alias: "n",
    type: "string",
    description: "Token name",
    demandOption: true,
  })
  .option("value", {
    alias: "v",
    type: "string",
    description: "Token value",
    demandOption: true,
  })
  .option("group", {
    alias: "g",
    type: "string",
    description: "Token group (dot-separated path)",
  })
  .option("description", {
    alias: "d",
    type: "string",
    description: "Token description",
  })
  .strict()
  .parseAsync();

const tokenData: TokenData = {
  action: "create",
  category: argv.category,
  name: argv.name,
  group: argv.group,
  value: argv.value,
  description: argv.description,
};

createToken(tokenData);
