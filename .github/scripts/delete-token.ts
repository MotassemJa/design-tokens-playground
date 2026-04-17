#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { deleteToken, normalizeInputValue, type TokenData } from "./token-common.ts";

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
    description: "Full token path to delete",
    demandOption: true,
  })
  .strict()
  .parseAsync();

const tokenData: TokenData = {
  action: "delete",
  category: normalizeInputValue(argv.category) ?? "",
  tokenPath: normalizeInputValue(argv["token-path"]),
};

deleteToken(tokenData);
