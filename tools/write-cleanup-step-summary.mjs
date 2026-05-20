#!/usr/bin/env node
/* global process */

import { appendFileSync } from "node:fs";
import { renderCleanupSummaryMarkdown } from "../dist/cleanup-summary/index.js";

const args = process.argv.slice(2);
const stepSummaryPath = _requireOption(args, "--step-summary-path");
const summaryJson = process.env.CLEANUP_SUMMARY_JSON;
if (!summaryJson) {
  throw new Error("missing required env var: CLEANUP_SUMMARY_JSON");
}
const summary = JSON.parse(summaryJson);

appendFileSync(stepSummaryPath, renderCleanupSummaryMarkdown(summary, {}));

function _requireOption(args, optionName) {
  const value = _readOption(args, optionName);
  if (!value) {
    throw new Error(`missing required option: ${optionName}`);
  }

  return value;
}

function _readOption(args, optionName) {
  const index = args.indexOf(optionName);
  if (index === -1) {
    return undefined;
  }
  if (index === args.length - 1 || args[index + 1].startsWith("--")) {
    throw new Error(`missing value for option: ${optionName}`);
  }

  return args[index + 1];
}
