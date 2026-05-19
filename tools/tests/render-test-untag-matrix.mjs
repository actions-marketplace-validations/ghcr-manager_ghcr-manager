#!/usr/bin/env node
/* global process */

import { untagScenarios } from "./untag-scenarios/_definitions.mjs";

process.stdout.write(
  JSON.stringify({
    include: Object.keys(untagScenarios).map((scenario) => ({ scenario }))
  })
);
