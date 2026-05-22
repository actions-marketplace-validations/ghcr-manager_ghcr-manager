import assert from "node:assert/strict";
import test from "node:test";
import { buildCleanupSummary } from "../../src/cleanup-summary/index.js";

test("buildCleanupSummary groups root decisions and carries live execution effects", () => {
  const summary = buildCleanupSummary(
    {
      owner: "acme",
      packageName: "example",
      scanCompletedAt: "2026-05-20T10:00:00.000Z",
      plannerInputs: { deleteTags: ["delete-me"], useRegex: true },
      directTargetTags: ["delete-me"],
      directTargetRoots: [],
      rootDecisions: [
        {
          versionId: 101,
          digest: "sha256:fully",
          selectionMode: "delete-root",
          selectionReason: "delete-tags-all-tags-selected",
          validationStatus: "fully-deletable",
          validationReasonCode: "fully-deletable-no-retained-overlap",
          validationReason: "No retained overlap"
        },
        {
          versionId: 102,
          digest: "sha256:untag",
          selectionMode: "delete-root",
          selectionReason: "delete-tags-partial-tag-match",
          validationStatus: "untag-only",
          validationReasonCode: "untag-only-partial-tag-match",
          validationReason: "Only selected tags can be detached"
        },
        {
          versionId: 103,
          digest: "sha256:blocked",
          selectionMode: "delete-root",
          selectionReason: "delete-tags-all-tags-selected",
          validationStatus: "blocked",
          validationReasonCode: "blocked-overlap-with-retained-root",
          validationReason: "Retained overlap exists",
          blockingVersionId: 104,
          blockingDigest: "sha256:blocker",
          overlapDigest: "sha256:overlap"
        }
      ],
      protectedRoots: [],
      closureManifests: [
        {
          sourceVersionId: 101,
          sourceDigest: "sha256:fully",
          memberVersionId: 101,
          memberDigest: "sha256:fully",
          memberManifestKind: "image_index",
          hopsFromRoot: 0,
          memberRole: "root"
        },
        {
          sourceVersionId: 101,
          sourceDigest: "sha256:fully",
          memberVersionId: 201,
          memberDigest: "sha256:child",
          memberManifestKind: "image_manifest",
          hopsFromRoot: 1,
          memberRole: "child"
        }
      ],
      blockedRoots: [],
      fullyDeletableRoots: [],
      collateralTags: ["keep-me"]
    },
    {
      dryRun: false,
      listRootTags: (versionId) => {
        switch (versionId) {
          case 101:
            return ["delete-me"];
          case 102:
            return ["delete-me", "keep-me"];
          case 103:
            return ["delete-me"];
          default:
            return [];
        }
      },
      plannedChanges: {
        tagRemovals: 1,
        imageDeletes: 1,
        crossArchDeletes: 1,
        artifactDeletes: 0,
        attestationDeletes: 0,
        signatureDeletes: 0,
        totalManifestDeletes: 2
      },
      executionSummary: {
        owner: "acme",
        packageName: "example",
        scanCompletedAt: "2026-05-20T10:00:00.000Z",
        plannerInputs: { deleteTags: ["delete-me"] },
        deletedPackageVersions: [{ versionId: 101, digest: "sha256:fully" }],
        untaggedTags: [
          {
            tag: "delete-me",
            sourceVersionId: 102,
            sourceDigest: "sha256:untag",
            detachedVersionId: 202,
            detachedDigest: "sha256:detached"
          }
        ],
        blockedRoots: [],
        unsupportedUntagRoots: []
      }
    }
  );

  assert.equal(summary.command, "cleanup");
  assert.equal(summary.dryRun, false);
  assert.deepEqual(summary.directTargetTags, ["delete-me"]);
  assert.deepEqual(summary.collateralTags, ["keep-me"]);
  assert.equal(summary.fullyDeletableRoots.length, 1);
  assert.equal(summary.untagOnlyRoots.length, 1);
  assert.equal(summary.blockedRoots.length, 1);
  assert.deepEqual(summary.affectedManifests, [
    { digest: "sha256:child", manifestKind: "image_manifest" },
    { digest: "sha256:fully", manifestKind: "image_index" }
  ]);
  assert.deepEqual(summary.plannedChanges, {
    tagRemovals: 1,
    imageDeletes: 1,
    crossArchDeletes: 1,
    artifactDeletes: 0,
    attestationDeletes: 0,
    signatureDeletes: 0,
    totalManifestDeletes: 2
  });
  assert.deepEqual(summary.untagOnlyRoots[0]?.matchedTags, ["delete-me"]);
  assert.deepEqual(summary.deletedPackageVersions, [{ versionId: 101, digest: "sha256:fully" }]);
  assert.equal(summary.untaggedTags[0]?.tag, "delete-me");
  assert.equal(summary.blockedRoots[0]?.blockingVersionId, 104);
});

test("buildCleanupSummary trusts planner-facing direct target tags as already filtered for user output", () => {
  const summary = buildCleanupSummary(
    {
      owner: "acme",
      packageName: "example",
      scanCompletedAt: "2026-05-20T10:00:00.000Z",
      plannerInputs: { deleteTags: [".*"], useRegex: true },
      directTargetTags: ["release-1"],
      directTargetRoots: [],
      rootDecisions: [
        {
          versionId: 101,
          digest: "sha256:fully",
          selectionMode: "delete-root",
          selectionReason: "delete-tags-all-tags-selected",
          validationStatus: "fully-deletable",
          validationReasonCode: "fully-deletable-no-retained-overlap",
          validationReason: "No retained overlap"
        }
      ],
      protectedRoots: [],
      closureManifests: [
        {
          sourceVersionId: 101,
          sourceDigest: "sha256:fully",
          memberVersionId: 101,
          memberDigest: "sha256:fully",
          memberManifestKind: "image_manifest",
          hopsFromRoot: 0,
          memberRole: "root"
        }
      ],
      blockedRoots: [],
      fullyDeletableRoots: [],
      collateralTags: []
    },
    {
      dryRun: true,
      listRootTags: () => ["release-1"],
      plannedChanges: {
        tagRemovals: 1,
        imageDeletes: 1,
        crossArchDeletes: 0,
        artifactDeletes: 0,
        attestationDeletes: 0,
        signatureDeletes: 0,
        totalManifestDeletes: 1
      }
    }
  );

  assert.deepEqual(summary.directTargetTags, ["release-1"]);
  assert.deepEqual(summary.affectedManifests, [{ digest: "sha256:fully", manifestKind: "image_manifest" }]);
});
