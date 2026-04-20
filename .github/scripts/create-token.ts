#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createToken, type TokenData } from "./token-common.ts";

/**
 * CLI argument parser for token creation requests.
 */
const argv = await yargs(hideBin(process.argv))
  .option("namespace-level", {
    type: "string",
    description: "Namespace level (universal, system, semantic, component)",
  })
  .option("namespace-theme", {
    type: "string",
    description: "Namespace theme for system level (light, dark, high-contrast)",
  })
  .option("namespace-domain", {
    type: "string",
    description: "Namespace domain (color, spacing, typography, etc.)",
  })
  .option("object-path", {
    alias: "o",
    type: "string",
    description: "Object path: group.component.element (dot notation, optional)",
  })
  .option("base-path", {
    alias: "b",
    type: "string",
    description: "Base path: category.concept.property (dot notation)",
  })
  .option("modifier-path", {
    alias: "x",
    type: "string",
    description: "Modifier path: variant.state.scale.mode (dot notation, optional)",
  })
  .option("hierarchy-level", {
    alias: "l",
    type: "string",
    description: "Hierarchy level (universal, system, semantic, component)",
  })
  .option("domain", {
    alias: "m",
    type: "string",
    description: "Token domain/category (color, spacing, typography, button, etc.)",
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
  .check((args) => {
    if (!args["namespace-level"] && !args["hierarchy-level"]) {
      throw new Error("Provide --namespace-level (or legacy --hierarchy-level)");
    }
    if (!args["base-path"] && !args["object-path"] && !args.name) {
      throw new Error("Provide --base-path (and optionally --object-path / --modifier-path), or legacy --name");
    }
    return true;
  })
  .strict()
  .parseAsync();

/**
 * Normalized payload passed to shared token creation logic.
 */
const tokenData: TokenData = {
  action: "create",
  category: argv.category,
  namespaceLevel: argv["namespace-level"],
  namespaceTheme: argv["namespace-theme"],
  namespaceDomain: argv["namespace-domain"],
  objectPath: argv["object-path"],
  basePath: argv["base-path"],
  modifierPath: argv["modifier-path"],
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
