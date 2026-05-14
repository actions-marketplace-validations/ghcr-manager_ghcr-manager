#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

const scenario = process.argv[2];
const fixture = process.argv[3];
const databasePath = process.argv[4];
const planPath = process.argv[5];

if (!scenario || !fixture || !databasePath || !planPath) {
  throw new Error("usage: node tools/assert-test-registry-plan.mjs <scenario> <single|complex> <db-path> <plan-path>");
}

const plan = JSON.parse(readFileSync(planPath, "utf8"));
assert.match(plan.packageName, new RegExp(`-test--${fixture}$`));
assert.ok(plan.scanCompletedAt, "scanCompletedAt must be populated");
assert.deepEqual(plan.collateralTags, []);
_assertValidationContract(plan);

switch (scenario) {
  case "delete-untagged":
    _assertDeleteUntaggedPlan(fixture, plan);
    break;
  case "complex-tag-age-window":
    _assertComplexAgeWindowPlan(plan, databasePath, []);
    break;
  case "complex-tag-age-window-exclude-beta":
    _assertComplexAgeWindowPlan(plan, databasePath, ["beta"]);
    break;
  case "complex-tag-age-window-keep-1":
    _assertCombinedTaggedKeepPlan(plan, databasePath, {
      deleteTags: ["alpha", "beta", "gamma"],
      excludeTags: [],
      keepNTagged: 1,
      requireOlderThan: true
    });
    break;
  case "complex-shared-platform-tags-keep-1":
    _assertCombinedTaggedKeepPlan(plan, databasePath, {
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

function _assertDeleteUntaggedPlan(fixture, plan) {
  assert.equal(plan.plannerInputs?.deleteUntagged, true);
  assert.deepEqual(plan.directTargetTags, []);

  if (fixture === "single") {
    assert.deepEqual(plan.directTargetRoots, []);
    assert.deepEqual(plan.closureManifests, []);
    assert.deepEqual(plan.blockedRoots, []);
    assert.deepEqual(plan.fullyDeletableRoots, []);
    assert.deepEqual(plan.rootDecisions, []);
    assert.deepEqual(plan.protectedRoots, []);
    return;
  }

  if (fixture === "complex") {
    assert.ok(plan.directTargetRoots.length > 0, "complex fixture must have direct target roots");
    assert.equal(plan.fullyDeletableRoots.length, 0, "complex fixture must have zero fully deletable roots");
    assert.ok(plan.blockedRoots.length > 0, "complex fixture must have blocked roots");
    assert.ok(plan.closureManifests.length >= plan.directTargetRoots.length, "complex fixture must have closure rows");

    for (const root of plan.directTargetRoots) {
      assert.equal(root.reason, "delete-untagged");
      assert.equal(root.selectionMode, "delete-root");
    }

    const directTargetDigests = new Set(plan.directTargetRoots.map((root) => root.digest));
    const closureSourceDigests = new Set(plan.closureManifests.map((manifest) => manifest.sourceDigest));
    const blockedDigests = new Set(plan.blockedRoots.map((root) => root.blockedDigest));

    assert.deepEqual(
      [...closureSourceDigests].sort(),
      [...directTargetDigests].sort(),
      "complex closure rows must cover every direct target root"
    );
    assert.deepEqual(
      [...blockedDigests].sort(),
      [...directTargetDigests].sort(),
      "complex direct target roots must all be blocked"
    );
    assert.equal(plan.validationSummary.blockedDeleteRootCount, plan.directTargetRoots.length);
    assert.ok(plan.protectedRoots.length > 0, "complex fixture must report protected roots");

    for (const blockedRoot of plan.blockedRoots) {
      assert.equal(blockedRoot.reason, "overlap-with-retained-root");
      assert.ok(
        directTargetDigests.has(blockedRoot.blockedDigest),
        "blocked root digest must come from the direct target set"
      );
    }
  }
}

function _assertComplexAgeWindowPlan(plan, databasePath, excludedTags) {
  assert.equal(plan.plannerInputs?.deleteUntagged, false);
  assert.deepEqual(plan.plannerInputs?.deleteTags, ["alpha", "beta", "gamma"]);
  assert.deepEqual(plan.plannerInputs?.excludeTags, excludedTags);
  assert.equal(typeof plan.plannerInputs?.olderThan, "string");
  assert.equal(typeof plan.plannerInputs?.cutoffTimestamp, "string");

  const database = new Database(databasePath, { readonly: true });
  const selectedRows = database
    .prepare(
      `
        SELECT t.tag, m.digest
        FROM tags t
        JOIN manifests m
          ON m.scan_id = t.scan_id
         AND m.version_id = t.version_id
        JOIN package_versions pv
          ON pv.scan_id = t.scan_id
         AND pv.version_id = t.version_id
        WHERE t.tag IN ('alpha', 'beta', 'gamma')
          AND pv.created_at < ?
        ORDER BY t.tag
      `
    )
    .all(plan.plannerInputs.cutoffTimestamp)
    .filter((row) => !excludedTags.includes(row.tag));
  database.close();

  const expectedTags = selectedRows.map((row) => row.tag);
  const expectedDigests = [...new Set(selectedRows.map((row) => row.digest))].sort();
  assert.deepEqual(plan.directTargetTags, expectedTags);
  assert.deepEqual(
    plan.directTargetRoots.map((root) => root.digest),
    expectedDigests
  );
  for (const root of plan.directTargetRoots) {
    assert.equal(root.reason, "delete-tags-all-tags-selected");
    assert.equal(root.selectionMode, "delete-root");
  }

  const directTargetDigests = new Set(plan.directTargetRoots.map((root) => root.digest));
  const closureSourceDigests = new Set(plan.closureManifests.map((manifest) => manifest.sourceDigest));
  const blockedDigests = new Set(plan.blockedRoots.map((root) => root.blockedDigest));

  assert.deepEqual(
    [...closureSourceDigests].sort(),
    [...directTargetDigests].sort(),
    "age-window closure rows must cover every direct target root"
  );
  assert.deepEqual(
    [...blockedDigests].sort(),
    [...directTargetDigests].sort(),
    "age-window direct target roots must all be blocked by retained roots"
  );
  assert.ok(plan.protectedRoots.length > 0, "age-window scenario must expose protected roots");
  assert.deepEqual(plan.fullyDeletableRoots, []);
}

function _assertCombinedTaggedKeepPlan(plan, databasePath, options) {
  assert.equal(plan.plannerInputs?.deleteUntagged, false);
  assert.deepEqual(plan.plannerInputs?.deleteTags, options.deleteTags);
  assert.deepEqual(plan.plannerInputs?.excludeTags, options.excludeTags);
  assert.equal(plan.plannerInputs?.keepNTagged, options.keepNTagged);
  if (options.requireOlderThan) {
    assert.equal(typeof plan.plannerInputs?.olderThan, "string");
    assert.equal(typeof plan.plannerInputs?.cutoffTimestamp, "string");
  } else {
    assert.equal(plan.plannerInputs?.olderThan, undefined);
    assert.equal(plan.plannerInputs?.cutoffTimestamp, undefined);
  }

  const database = new Database(databasePath, { readonly: true });
  const rows = database
    .prepare(
      `
        SELECT t.tag, m.version_id, m.digest, m.manifest_kind, pv.created_at
        FROM tags t
        JOIN manifests m
          ON m.scan_id = t.scan_id
         AND m.version_id = t.version_id
        JOIN package_versions pv
          ON pv.scan_id = t.scan_id
         AND pv.version_id = t.version_id
        WHERE (
          ? IS NULL
          OR pv.created_at < ?
        )
        ORDER BY pv.created_at DESC, m.version_id DESC, m.digest DESC, t.tag
      `
    )
    .all(plan.plannerInputs?.cutoffTimestamp ?? null, plan.plannerInputs?.cutoffTimestamp ?? null);
  database.close();

  const rootsByVersionId = new Map();
  for (const row of rows) {
    let root = rootsByVersionId.get(row.version_id);
    if (!root) {
      root = {
        versionId: row.version_id,
        digest: row.digest,
        manifestKind: row.manifest_kind,
        createdAt: row.created_at,
        tags: []
      };
      rootsByVersionId.set(row.version_id, root);
    }
    root.tags.push(row.tag);
  }

  const eligibleRoots = [...rootsByVersionId.values()]
    .filter((root) => root.tags.some((tag) => options.deleteTags.includes(tag)))
    .filter((root) => !root.tags.some((tag) => options.excludeTags.includes(tag)));

  const expectedDirectTargetTags = eligibleRoots.flatMap((root) =>
    root.tags.filter((tag) => options.deleteTags.includes(tag))
  );
  expectedDirectTargetTags.sort();
  assert.deepEqual([...plan.directTargetTags].sort(), expectedDirectTargetTags);

  const rankedRoots = [...eligibleRoots].sort((left, right) => {
    const createdAtCompare = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (createdAtCompare !== 0) {
      return createdAtCompare;
    }
    const versionIdCompare = right.versionId - left.versionId;
    if (versionIdCompare !== 0) {
      return versionIdCompare;
    }
    return right.digest.localeCompare(left.digest);
  });
  const selectedRoots = rankedRoots
    .slice(options.keepNTagged)
    .sort((left, right) => left.digest.localeCompare(right.digest));
  const expectedDirectTargetRoots = selectedRoots.map((root) => {
    const matchedTagCount = root.tags.filter((tag) => options.deleteTags.includes(tag)).length;
    const isFullMatch = matchedTagCount === root.tags.length;
    return {
      digest: root.digest,
      reason: isFullMatch ? "keep-n-tagged-overflow" : "delete-tags-partial-tag-match",
      selectionMode: isFullMatch ? "delete-root" : "untag-only"
    };
  });
  assert.deepEqual(
    plan.directTargetRoots.map((root) => ({
      digest: root.digest,
      reason: root.reason,
      selectionMode: root.selectionMode
    })),
    expectedDirectTargetRoots
  );

  const deleteRootDigests = new Set(
    expectedDirectTargetRoots.filter((root) => root.selectionMode === "delete-root").map((root) => root.digest)
  );
  if (deleteRootDigests.size === 0) {
    assert.deepEqual(plan.closureManifests, []);
    assert.deepEqual(plan.blockedRoots, []);
    assert.deepEqual(plan.fullyDeletableRoots, []);
    return;
  }

  const closureSourceDigests = new Set(plan.closureManifests.map((manifest) => manifest.sourceDigest));
  for (const digest of closureSourceDigests) {
    assert.ok(deleteRootDigests.has(digest), "closure source digest must come from the delete-root set");
  }
  const blockedDigests = new Set(plan.blockedRoots.map((root) => root.blockedDigest));
  for (const digest of blockedDigests) {
    assert.ok(deleteRootDigests.has(digest), "blocked digest must come from the delete-root set");
  }
  for (const root of plan.fullyDeletableRoots) {
    assert.ok(deleteRootDigests.has(root.digest), "fully deletable root must come from the delete-root set");
  }
  assert.equal(plan.validationSummary.fullyDeletableRootCount, plan.fullyDeletableRoots.length);
}

function _assertValidationContract(plan) {
  assert.ok(plan.validationSummary, "validationSummary must be present");
  assert.ok(Array.isArray(plan.rootDecisions), "rootDecisions must be present");
  assert.ok(Array.isArray(plan.protectedRoots), "protectedRoots must be present");

  assert.equal(plan.validationSummary.directTargetTagCount, plan.directTargetTags.length);
  assert.equal(plan.validationSummary.directTargetRootCount, plan.directTargetRoots.length);
  assert.equal(plan.validationSummary.fullyDeletableRootCount, plan.fullyDeletableRoots.length);
  assert.equal(plan.validationSummary.protectedRootCount, plan.protectedRoots.length);

  const deleteRootCandidateCount = plan.directTargetRoots.filter((root) => root.selectionMode === "delete-root").length;
  const untagOnlyRootCount = plan.directTargetRoots.filter((root) => root.selectionMode === "untag-only").length;
  assert.equal(plan.validationSummary.deleteRootCandidateCount, deleteRootCandidateCount);
  assert.equal(plan.validationSummary.untagOnlyRootCount, untagOnlyRootCount);

  assert.equal(plan.rootDecisions.length, plan.directTargetRoots.length);
  const directTargetDigestSet = new Set(plan.directTargetRoots.map((root) => root.digest));
  const fullyDeletableDigestSet = new Set(plan.fullyDeletableRoots.map((root) => root.digest));
  const blockedDigestSet = new Set(plan.blockedRoots.map((root) => root.blockedDigest));

  let blockedDecisionCount = 0;
  for (const decision of plan.rootDecisions) {
    assert.ok(directTargetDigestSet.has(decision.digest), "rootDecisions must only reference direct target roots");
    if (decision.validationStatus === "fully-deletable") {
      assert.ok(
        fullyDeletableDigestSet.has(decision.digest),
        "fully-deletable root decisions must correspond to fully deletable roots"
      );
    }
    if (decision.validationStatus === "blocked") {
      blockedDecisionCount += 1;
      assert.ok(blockedDigestSet.has(decision.digest), "blocked root decisions must correspond to blocked roots");
    }
    if (decision.validationStatus === "untag-only") {
      assert.equal(decision.selectionMode, "untag-only");
    }
  }
  assert.equal(plan.validationSummary.blockedDeleteRootCount, blockedDecisionCount);

  for (const protectedRoot of plan.protectedRoots) {
    assert.ok(Array.isArray(protectedRoot.blocks));
    assert.ok(protectedRoot.blocks.length > 0, "protected roots must explain at least one blocked root");
    for (const block of protectedRoot.blocks) {
      assert.ok(
        blockedDigestSet.has(block.blockedDigest),
        "protected root block entries must correspond to blocked root digests"
      );
    }
  }
}
