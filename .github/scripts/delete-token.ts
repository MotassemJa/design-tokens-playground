#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { deleteToken, type TokenData } from "./token-common.ts";

/**
 * CLI argument parser for token deletion requests.
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
  })
  .check((args) => {
    if (!args["token-path"] && !args["object-path"]) {
      throw new Error("Provide --object-path (or legacy --token-path)");
    }
    return true;
  })
  .strict()
  .parseAsync();

/**
 * Normalized payload passed to shared token deletion logic.
 */
const tokenData: TokenData = {
  action: "delete",
  category: argv.category,
  namespaceLevel: argv["namespace-level"],
  namespaceTheme: argv["namespace-theme"],
  namespaceDomain: argv["namespace-domain"],
  objectPath: argv["object-path"],
  basePath: argv["base-path"],
  modifierPath: argv["modifier-path"],
  hierarchyLevel: argv["hierarchy-level"],
  domain: argv.domain,
  tokenPath: argv["token-path"],
};

deleteToken(tokenData);
