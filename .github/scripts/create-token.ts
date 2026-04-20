#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createToken, type TokenData } from "./token-common.ts";

const argv = await yargs(hideBin(process.argv))
  .option("hierarchy-level", {
    alias: "l",
    type: "string",
    description: "Hierarchy level (universal, system, semantic, component)",
    demandOption: true,
  })
  .option("domain", {
    alias: "m",
    type: "string",
    description: "Token domain/category (color, spacing, typography, button, etc.)",
    demandOption: true,
  })
  .option("theme", {
    alias: "t",
    type: "string",
    description: "Theme for system tokens (light, dark, high-contrast, universal)",
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
    description: "Legacy token group (dot-separated path)",
  })
  .option("token-type", {
    alias: "y",
    type: "string",
    description: "DTCG token $type",
  })
  .option("category", {
    alias: "c",
    type: "string",
    description: "Legacy category field",
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
  hierarchyLevel: argv["hierarchy-level"],
  domain: argv.domain,
  theme: argv.theme,
  tokenType: argv["token-type"],
  name: argv.name,
  group: argv.group,
  value: argv.value,
  description: argv.description,
};

createToken(tokenData);
