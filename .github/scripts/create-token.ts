#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createToken, type TokenData } from "./token-common.ts";

const argv = await yargs(hideBin(process.argv))
  .option("hierarchy", {
    type: "string",
    description: "Token hierarchy layer: universal | system | semantic | component",
    demandOption: true,
  })
  .option("namespace", {
    type: "string",
    description: "Namespace group: optional theme + domain (e.g. 'light.color')",
  })
  .option("object", { type: "string", description: "Object group (e.g. 'button.primary')" })
  .option("base", { type: "string", description: "Base group (e.g. 'color.background')" })
  .option("modifier", { type: "string", description: "Modifier group (e.g. 'hover.on-light')" })
  .option("value", { type: "string", description: "Token value", demandOption: true })
  .option("token-type", { type: "string", description: "DTCG $type" })
  .option("description", { type: "string", description: "Token description" })
  .strict()
  .parseAsync();

const data: TokenData = {
  action: "create",
  hierarchy: argv.hierarchy as TokenData["hierarchy"],
  namespace: argv.namespace,
  object: argv.object,
  base: argv.base,
  modifier: argv.modifier,
  value: argv.value,
  tokenType: argv["token-type"],
  description: argv.description,
};

createToken(data);
