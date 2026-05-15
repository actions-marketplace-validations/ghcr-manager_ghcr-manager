#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertValidationContract } from "./_test-registry-plan-contract.mjs";
import {
  assertCombinedTaggedKeepPlan,
  assertComplexAgeWindowPlan,
  assertDeleteUntaggedPlan
} from "./_test-registry-plan-scenarios.mjs";

const scenario = process.argv[2];
const fixture = process.argv[3];
const databasePath = process.argv[4];
const planPath = process.argv[5];

if (!scenario || !fixture || !databasePath || !planPath) {
  throw new Error("usage: node tools/assert-test-registry-plan.mjs <scenario> <single|complex> <db-path> <plan-path>");
}

const plan = JSON.parse(readFileSync(planPath, "utf8"));
assert.ok(
  typeof plan.packageName === "string" && plan.packageName.endsWith(`-test--${fixture}`),
  `packageName must end with -test--${fixture}`
);
assert.ok(plan.scanCompletedAt, "scanCompletedAt must be populated");
assert.deepEqual(plan.collateralTags, []);
assertValidationContract(plan);

switch (scenario) {
  case "delete-untagged":
    assertDeleteUntaggedPlan(fixture, plan);
    break;
  case "complex-tag-age-window":
    assertComplexAgeWindowPlan(plan, databasePath, []);
    break;
  case "complex-tag-age-window-exclude-beta":
    assertComplexAgeWindowPlan(plan, databasePath, ["beta"]);
    break;
  case "complex-tag-age-window-keep-1":
    assertCombinedTaggedKeepPlan(plan, databasePath, {
      deleteTags: ["alpha", "beta", "gamma"],
      excludeTags: [],
      keepNTagged: 1,
      requireOlderThan: true
    });
    break;
  case "complex-shared-platform-tags-keep-1":
    assertCombinedTaggedKeepPlan(plan, databasePath, {
      deleteTags: ["beta-amd64", "gamma-amd64", "beta-arm64", "gamma-arm64"],
      excludeTags: [],
      keepNTagged: 1,
      requireOlderThan: false
    });
    break;
  default:
    throw new Error(`unknown validation scenario: ${scenario}`);
}

console.error(`validated scenario '${scenario}' for fixture '${fixture}'`);
