#!/usr/bin/env node
/**
 * Prints the attachment URL held in an issue-form field, or fails.
 *
 * Reads the field from `TOKEN_FILE_FIELD` rather than argv: the field is
 * untrusted issue text and must not cross a shell argument.
 */
import { exitOnError, parseAttachmentUrl } from "./token-common";

console.log(exitOnError(() => parseAttachmentUrl(process.env.TOKEN_FILE_FIELD)));
