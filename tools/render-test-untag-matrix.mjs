#!/usr/bin/env node
/* global process */

const scenarioIds = [
  "tagged-fully-deletable",
  "untag-only-single-shared-root",
  "docker-manifest-list-untag-only-shared-root"
];

process.stdout.write(
  JSON.stringify({
    include: scenarioIds.map((scenario) => ({ scenario }))
  })
);
