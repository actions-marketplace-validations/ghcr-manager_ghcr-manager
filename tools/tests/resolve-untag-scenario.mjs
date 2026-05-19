#!/usr/bin/env node
/* global process */

import { untagScenarios } from "./untag-scenarios/_definitions.mjs";

const scenarioId = process.argv[2];
const repositoryName = process.argv[3];

if (!scenarioId || !repositoryName) {
  throw new Error("usage: node tools/tests/resolve-untag-scenario.mjs <scenario> <repository-name>");
}

const scenario = untagScenarios[scenarioId];
if (!scenario) {
  throw new Error(`unknown untag scenario: ${scenarioId}`);
}

const tagNames = Object.fromEntries(
  Object.entries(scenario.tagNames ?? {}).map(([key, value]) => [key, `${scenario.id}--${value}`])
);

process.stdout.write(
  JSON.stringify({
    scenarioId: scenario.id,
    packageName: `${repositoryName}-${scenario.packageSuffix}`,
    seedStrategy: scenario.seedStrategy,
    tagNames,
    deleteTags: tagNames.deleteTag ? [tagNames.deleteTag] : [],
    scanAssertions: scenario.scanAssertions ?? []
  })
);
