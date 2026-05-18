#!/usr/bin/env node
/* global process */

import { scenarios } from "./test-scenarios/_definitions.mjs";

const scenarioId = process.argv[2];
const executor = process.argv[3];
const repositoryName = process.argv[4];

if (!scenarioId || !executor || !repositoryName) {
  throw new Error("usage: node tools/resolve-test-scenario.mjs <scenario> <executor> <repository-name>");
}

const scenario = scenarios[scenarioId];
if (!scenario) {
  throw new Error(`unknown scenario: ${scenarioId}`);
}

if (!scenario.supportedExecutors.includes(executor)) {
  throw new Error(`scenario '${scenarioId}' does not support executor '${executor}'`);
}

const namespacedTags = Object.fromEntries(
  Object.entries(scenario.tagNames ?? {}).map(([key, value]) => [key, `${scenario.id}--${value}`])
);

process.stdout.write(
  JSON.stringify({
    scenarioId: scenario.id,
    executor,
    packageName: `${repositoryName}-${scenario.packageSuffix}`,
    seedStrategy: scenario.seedStrategy,
    tagNames: namespacedTags,
    ghcrManagerArgs: scenario.ghcrManagerArgs.map((value) => _replaceTagTokens(value, namespacedTags)),
    dataaxiomInputs: Object.fromEntries(
      Object.entries(scenario.dataaxiomInputs).map(([key, value]) => [key, _replaceTagTokens(value, namespacedTags)])
    )
  })
);

function _replaceTagTokens(value, tagNames) {
  return value.replaceAll(/\{([a-zA-Z0-9]+)\}/g, (_match, key) => {
    if (!(key in tagNames)) {
      throw new Error(`unknown tag token '${key}' in scenario '${scenarioId}'`);
    }
    return tagNames[key];
  });
}
