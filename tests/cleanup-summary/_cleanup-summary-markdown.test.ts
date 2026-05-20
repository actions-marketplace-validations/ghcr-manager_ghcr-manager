import assert from "node:assert/strict";
import test from "node:test";
import { renderCleanupSummaryMarkdown } from "../../src/cleanup-summary/index.js";

test("renderCleanupSummaryMarkdown renders sections and truncates long lists", () => {
  const markdown = renderCleanupSummaryMarkdown(
    {
      command: "cleanup",
      owner: "acme",
      packageName: "example",
      scanCompletedAt: "2026-05-20T10:00:00.000Z",
      dryRun: true,
      plannerInputs: { deleteTags: ["a", "b"], useRegex: true },
      validationSummary: {
        directTargetTagCount: 3,
        directTargetRootCount: 2,
        deleteRootCandidateCount: 2,
        untagOnlyRootCount: 1,
        fullyDeletableRootCount: 1,
        blockedDeleteRootCount: 0,
        protectedRootCount: 0
      },
      directTargetTags: ["a", "b", "c"],
      collateralTags: [],
      fullyDeletableRoots: [
        {
          versionId: 101,
          digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          rootTags: ["a", "b", "c"],
          matchedTags: ["a"],
          selectionMode: "delete-root",
          selectionReason: "matched delete tag",
          validationStatus: "fully-deletable",
          validationReasonCode: "fully-deletable-no-retained-overlap",
          validationReason: "No retained overlap"
        }
      ],
      untagOnlyRoots: [],
      blockedRoots: [],
      deletedPackageVersions: [],
      untaggedTags: [],
      unsupportedUntagRoots: []
    },
    {
      maxDirectTargetTags: 2,
      maxRootsPerSection: 10,
      maxTagsPerRoot: 2
    }
  );

  assert.match(markdown, /## Cleanup Summary/);
  assert.match(markdown, /\| 📦 Package \| `acme\/example` \|/);
  assert.match(markdown, /<summary>⚙️ Cleanup filter<\/summary>/);
  assert.match(markdown, /<summary>🏷️ Matched tags<\/summary>/);
  assert.match(markdown, /<summary>🗑️ Fully deletable roots<\/summary>/);
  assert.match(markdown, /Showing first 2 of 3 matched tags/);
  assert.match(markdown, /sha256:aaaaaaaa\.\.\.aaaaaaaa/);
  assert.match(markdown, /a, b, \+1 more/);
  assert.doesNotMatch(markdown, /<summary>🔗 Untag-only roots<\/summary>/);
  assert.doesNotMatch(markdown, /<summary>🛡️ Blocked roots<\/summary>/);
});
