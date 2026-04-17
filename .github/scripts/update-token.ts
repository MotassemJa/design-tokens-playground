#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { updateToken, normalizeInputValue, type TokenData } from "./token-common.ts";

const argv = await yargs(hideBin(process.argv))
  .option("category", {
    alias: "c",
    type: "string",
    description: "Token category (e.g., color, typography)",
    demandOption: true,
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
  category: normalizeInputValue(argv.category) ?? "",
  tokenPath: normalizeInputValue(argv["token-path"]),
  value: normalizeInputValue(argv.value),
  description: normalizeInputValue(argv.description),
};

updateToken(tokenData);
