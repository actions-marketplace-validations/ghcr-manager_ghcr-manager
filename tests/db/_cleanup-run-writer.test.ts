import assert from "node:assert/strict";
import test from "node:test";
import { ManifestKinds } from "../../src/core/index.js";
import {
  CleanupRunWriter,
  DeletePlanValidationReasonCodes,
  DeletePlanValidationStatuses,
  ScanWriter,
  openDatabase
} from "../../src/db/index.js";
import type { DeletePlan } from "../../src/db/index.js";

test("cleanup run writer stores planner decisions and protected roots", () => {
  const database = openDatabase(":memory:");
  const scanWriter = new ScanWriter(database);
  const cleanupRunWriter = new CleanupRunWriter(database);
  const previousServerUrl = process.env.GITHUB_SERVER_URL;
  const previousRepository = process.env.GITHUB_REPOSITORY;
  const previousRunId = process.env.GITHUB_RUN_ID;
  process.env.GITHUB_SERVER_URL = "https://github.com";
  process.env.GITHUB_REPOSITORY = "acme/example-repo";
  process.env.GITHUB_RUN_ID = "987654";

  scanWriter.startScan("acme", "example", "2026-05-17T09:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  scanWriter.insertPackageVersion({
    versionId: 101,
    createdAt: "2026-05-17T08:00:00.000Z",
    updatedAt: "2026-05-17T08:00:00.000Z"
  });
  scanWriter.insertManifest({
    versionId: 101,
    digest: "sha256:delete-root",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    manifestKind: ManifestKinds.imageManifest
  });
  scanWriter.insertTag({ versionId: 101, tag: "delete-me" });
  scanWriter.insertPackageVersion({
    versionId: 102,
    createdAt: "2026-05-17T08:05:00.000Z",
    updatedAt: "2026-05-17T08:05:00.000Z"
  });
  scanWriter.insertManifest({
    versionId: 102,
    digest: "sha256:keep-root",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    manifestKind: ManifestKinds.imageManifest
  });
  scanWriter.insertPackageVersion({
    versionId: 103,
    createdAt: "2026-05-17T08:10:00.000Z",
    updatedAt: "2026-05-17T08:10:00.000Z"
  });
  scanWriter.insertManifest({
    versionId: 103,
    digest: "sha256:shared",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    manifestKind: ManifestKinds.imageManifest
  });
  database
    .prepare(
      `
        INSERT INTO manifest_reachability(scan_id, ancestor_digest, descendant_digest, min_distance)
        VALUES(?, ?, ?, ?), (?, ?, ?, ?)
      `
    )
    .run(
      scanWriter.getActiveScanId(),
      "sha256:delete-root",
      "sha256:shared",
      1,
      scanWriter.getActiveScanId(),
      "sha256:keep-root",
      "sha256:shared",
      1
    );
  scanWriter.markScanCompleted("2026-05-17T09:00:00.000Z");
  const scanId = scanWriter.getActiveScanId();

  const plan: DeletePlan = {
    owner: "acme",
    packageName: "example",
    scanCompletedAt: "2026-05-17T09:00:00.000Z",
    plannerInputs: {
      deleteUntagged: false,
      deleteTags: ["delete-me"],
      excludeTags: ["keep-me"]
    },
    directTargetTags: ["delete-me"],
    directTargetRoots: [
      {
        versionId: 101,
        digest: "sha256:delete-root",
        reason: "delete-tags-all-tags-selected",
        selectionMode: "delete-root"
      }
    ],
    rootDecisions: [
      {
        versionId: 101,
        digest: "sha256:delete-root",
        selectionMode: "delete-root",
        selectionReason: "delete-tags-all-tags-selected",
        validationStatus: DeletePlanValidationStatuses.blocked,
        validationReasonCode: DeletePlanValidationReasonCodes.blockedOverlapWithRetainedRoot,
        validationReason: "blocked because retained root sha256:keep-root still requires shared manifest sha256:shared",
        blockingVersionId: 102,
        blockingDigest: "sha256:keep-root",
        overlapDigest: "sha256:shared"
      }
    ],
    protectedRoots: [
      {
        versionId: 102,
        digest: "sha256:keep-root",
        blocks: [
          {
            blockedVersionId: 101,
            blockedDigest: "sha256:delete-root",
            blockReasonCode: "overlap-with-retained-root",
            overlapDigest: "sha256:shared"
          }
        ]
      }
    ],
    closureManifests: [],
    blockedRoots: [],
    fullyDeletableRoots: [],
    collateralTags: []
  };

  const cleanupRunId = cleanupRunWriter.persistCleanupRun(scanId, plan, {
    dryRun: true,
    cleanupStartedAt: "2026-05-17T09:01:00.000Z"
  });

  const cleanupRun = database
    .prepare(
      `
        SELECT
          scan_id,
          cleanup_uuid,
          cleanup_started_at,
          github_actions_run_url,
          dry_run,
          planner_inputs_json,
          protected_root_count
        FROM cleanup_runs
        WHERE cleanup_run_id = ?
      `
    )
    .get(cleanupRunId) as {
    scan_id: number;
    cleanup_uuid: string;
    cleanup_started_at: string;
    github_actions_run_url: string | null;
    dry_run: number;
    planner_inputs_json: string;
    protected_root_count: number;
  };

  assert.equal(cleanupRun.scan_id, scanId);
  assert.match(cleanupRun.cleanup_uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(cleanupRun.cleanup_started_at, "2026-05-17T09:01:00.000Z");
  assert.equal(cleanupRun.github_actions_run_url, "https://github.com/acme/example-repo/actions/runs/987654");
  assert.equal(cleanupRun.dry_run, 1);
  assert.deepEqual(JSON.parse(cleanupRun.planner_inputs_json), plan.plannerInputs);
  assert.equal(cleanupRun.protected_root_count, 1);

  const rootDecision = database
    .prepare(
      `
        SELECT digest, validation_status, validation_reason_code, blocking_digest, overlap_digest
        FROM cleanup_root_decisions
        WHERE cleanup_run_id = ?
          AND digest = 'sha256:delete-root'
      `
    )
    .get(cleanupRunId) as {
    digest: string;
    validation_status: string;
    validation_reason_code: string;
    blocking_digest: string;
    overlap_digest: string;
  };
  assert.equal(rootDecision.digest, "sha256:delete-root");
  assert.equal(rootDecision.validation_status, DeletePlanValidationStatuses.blocked);
  assert.equal(rootDecision.validation_reason_code, DeletePlanValidationReasonCodes.blockedOverlapWithRetainedRoot);
  assert.equal(rootDecision.blocking_digest, "sha256:keep-root");
  assert.equal(rootDecision.overlap_digest, "sha256:shared");

  const selectedTags = database
    .prepare(
      `
        SELECT scan_id, tag, is_deleted
        FROM cleanup_selected_tags
        WHERE cleanup_run_id = ?
        ORDER BY tag
      `
    )
    .all(cleanupRunId) as Array<{
    scan_id: number;
    tag: string;
    is_deleted: number | null;
  }>;
  assert.deepEqual(selectedTags, [{ scan_id: scanId, tag: "delete-me", is_deleted: 0 }]);

  const protectedRootBlocks = database
    .prepare(
      `
        SELECT scan_id, protected_digest, blocked_digest, block_reason_code, overlap_digest
        FROM cleanup_protected_root_blocks
        WHERE cleanup_run_id = ?
          AND protected_digest = 'sha256:keep-root'
      `
    )
    .all(cleanupRunId) as Array<{
    scan_id: number;
    protected_digest: string;
    blocked_digest: string;
    block_reason_code: string;
    overlap_digest: string;
  }>;
  assert.deepEqual(protectedRootBlocks, [
    {
      scan_id: scanId,
      protected_digest: "sha256:keep-root",
      blocked_digest: "sha256:delete-root",
      block_reason_code: "overlap-with-retained-root",
      overlap_digest: "sha256:shared"
    }
  ]);

  const protectedRoots = database
    .prepare(
      `
        SELECT DISTINCT protected_digest AS digest
        FROM cleanup_protected_root_blocks
        WHERE cleanup_run_id = ?
      `
    )
    .all(cleanupRunId) as Array<{ digest: string }>;
  assert.deepEqual(protectedRoots, [{ digest: "sha256:keep-root" }]);

  const closureMembers = database
    .prepare(
      `
        SELECT root_digest, member_digest, hops_from_root, member_role, validation_reason_code
        FROM v_cleanup_root_closure_members
        WHERE cleanup_run_id = ?
        ORDER BY hops_from_root, member_digest
      `
    )
    .all(cleanupRunId) as Array<{
    root_digest: string;
    member_digest: string;
    hops_from_root: number;
    member_role: string;
    validation_reason_code: string;
  }>;
  assert.deepEqual(closureMembers, [
    {
      root_digest: "sha256:delete-root",
      member_digest: "sha256:delete-root",
      hops_from_root: 0,
      member_role: "root",
      validation_reason_code: DeletePlanValidationReasonCodes.blockedOverlapWithRetainedRoot
    },
    {
      root_digest: "sha256:delete-root",
      member_digest: "sha256:shared",
      hops_from_root: 1,
      member_role: "descendant",
      validation_reason_code: DeletePlanValidationReasonCodes.blockedOverlapWithRetainedRoot
    }
  ]);

  const blockingOverlaps = database
    .prepare(
      `
        SELECT
          protected_digest,
          blocked_digest,
          blocked_validation_reason_code,
          block_reason_code,
          overlap_digest
        FROM v_cleanup_blocking_overlaps
        WHERE cleanup_run_id = ?
      `
    )
    .all(cleanupRunId) as Array<{
    protected_digest: string;
    blocked_digest: string;
    blocked_validation_reason_code: string;
    block_reason_code: string;
    overlap_digest: string;
  }>;
  assert.deepEqual(blockingOverlaps, [
    {
      protected_digest: "sha256:keep-root",
      blocked_digest: "sha256:delete-root",
      blocked_validation_reason_code: DeletePlanValidationReasonCodes.blockedOverlapWithRetainedRoot,
      block_reason_code: "overlap-with-retained-root",
      overlap_digest: "sha256:shared"
    }
  ]);

  const readableDecisions = database
    .prepare(
      `
        SELECT
          root_digest,
          selection_mode_label,
          selection_reason_label,
          validation_status_label,
          validation_reason_code_label,
          selected_tag_count,
          selected_tags
        FROM v_cleanup_root_decision_readable
        WHERE cleanup_run_id = ?
      `
    )
    .all(cleanupRunId) as Array<{
    root_digest: string;
    selection_mode_label: string;
    selection_reason_label: string;
    validation_status_label: string;
    validation_reason_code_label: string;
    selected_tag_count: number;
    selected_tags: string;
  }>;
  assert.deepEqual(readableDecisions, [
    {
      root_digest: "sha256:delete-root",
      selection_mode_label: "delete root",
      selection_reason_label: "all tags on this root were selected",
      validation_status_label: "root deletion is blocked",
      validation_reason_code_label: "a retained root still requires an overlapping manifest",
      selected_tag_count: 1,
      selected_tags: "delete-me"
    }
  ]);

  _restoreEnv("GITHUB_SERVER_URL", previousServerUrl);
  _restoreEnv("GITHUB_REPOSITORY", previousRepository);
  _restoreEnv("GITHUB_RUN_ID", previousRunId);
  database.close();
});

test("cleanup audit rows must use the same scan as their cleanup run", () => {
  const database = openDatabase(":memory:");
  const scanWriter = new ScanWriter(database);

  scanWriter.startScan("acme", "example", "2026-05-17T09:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  scanWriter.insertPackageVersion({
    versionId: 101,
    createdAt: "2026-05-17T08:00:00.000Z",
    updatedAt: "2026-05-17T08:00:00.000Z"
  });
  scanWriter.insertManifest({
    versionId: 101,
    digest: "sha256:first",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  scanWriter.markScanCompleted("2026-05-17T09:00:00.000Z");
  const firstScanId = scanWriter.getActiveScanId();

  scanWriter.startScan("acme", "example", "2026-05-17T10:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  scanWriter.insertPackageVersion({
    versionId: 201,
    createdAt: "2026-05-17T09:30:00.000Z",
    updatedAt: "2026-05-17T09:30:00.000Z"
  });
  scanWriter.insertManifest({
    versionId: 201,
    digest: "sha256:second",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  scanWriter.markScanCompleted("2026-05-17T10:00:00.000Z");
  const secondScanId = scanWriter.getActiveScanId();

  const cleanupRunId = Number(
    database
      .prepare(
        `
          INSERT INTO cleanup_runs(
            scan_id,
            cleanup_uuid,
            cleanup_started_at,
            github_actions_run_url,
            dry_run,
            planner_inputs_json,
            direct_target_tag_count,
            direct_target_root_count,
            delete_root_candidate_count,
            untag_only_root_count,
            fully_deletable_root_count,
            blocked_delete_root_count,
            protected_root_count
          )
          VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        firstScanId,
        "0196db62-c240-7000-8000-000000000001",
        "2026-05-17T10:01:00.000Z",
        null,
        1,
        "{}",
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ).lastInsertRowid
  );

  assert.throws(
    () =>
      database
        .prepare(
          `
            INSERT INTO cleanup_root_decisions(
              cleanup_run_id,
              scan_id,
              digest,
              selection_mode,
              selection_reason,
              validation_status,
              validation_reason_code,
              validation_reason
            )
            VALUES(?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          cleanupRunId,
          secondScanId,
          "sha256:second",
          "delete-root",
          "delete-untagged",
          DeletePlanValidationStatuses.fullyDeletable,
          "fully-deletable-no-retained-overlap",
          "test"
        ),
    /FOREIGN KEY constraint failed/
  );

  database.close();
});

test("cleanup run writer keeps selected tags that survive keep-n-tagged as not deleted", () => {
  const database = openDatabase(":memory:");
  const scanWriter = new ScanWriter(database);
  const cleanupRunWriter = new CleanupRunWriter(database);

  scanWriter.startScan("acme", "example", "2026-05-17T09:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  scanWriter.insertPackageVersion({
    versionId: 101,
    createdAt: "2026-05-17T08:00:00.000Z",
    updatedAt: "2026-05-17T08:00:00.000Z"
  });
  scanWriter.insertManifest({
    versionId: 101,
    digest: "sha256:older",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    manifestKind: ManifestKinds.imageManifest
  });
  scanWriter.insertTag({ versionId: 101, tag: "delete-old" });
  scanWriter.insertPackageVersion({
    versionId: 102,
    createdAt: "2026-05-17T08:05:00.000Z",
    updatedAt: "2026-05-17T08:05:00.000Z"
  });
  scanWriter.insertManifest({
    versionId: 102,
    digest: "sha256:newer",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    manifestKind: ManifestKinds.imageManifest
  });
  scanWriter.insertTag({ versionId: 102, tag: "delete-new" });
  scanWriter.markScanCompleted("2026-05-17T09:00:00.000Z");
  const scanId = scanWriter.getActiveScanId();

  const plan: DeletePlan = {
    owner: "acme",
    packageName: "example",
    scanCompletedAt: "2026-05-17T09:00:00.000Z",
    plannerInputs: {
      deleteUntagged: false,
      deleteTags: ["delete-old", "delete-new"],
      keepNTagged: 1
    },
    directTargetTags: ["delete-old", "delete-new"],
    directTargetRoots: [
      {
        versionId: 101,
        digest: "sha256:older",
        reason: "delete-tags-all-tags-selected",
        selectionMode: "delete-root"
      }
    ],
    rootDecisions: [
      {
        versionId: 101,
        digest: "sha256:older",
        selectionMode: "delete-root",
        selectionReason: "delete-tags-all-tags-selected",
        validationStatus: DeletePlanValidationStatuses.fullyDeletable,
        validationReasonCode: DeletePlanValidationReasonCodes.fullyDeletableNoRetainedOverlap,
        validationReason: "selected tags cover the whole root"
      }
    ],
    protectedRoots: [],
    closureManifests: [],
    blockedRoots: [],
    fullyDeletableRoots: [
      {
        versionId: 101,
        digest: "sha256:older",
        reason: "delete-tags-all-tags-selected",
        selectionMode: "delete-root"
      }
    ],
    collateralTags: []
  };

  const cleanupRunId = cleanupRunWriter.persistCleanupRun(scanId, plan, {
    dryRun: true,
    cleanupStartedAt: "2026-05-17T09:01:00.000Z"
  });

  const selectedTags = database
    .prepare(
      `
        SELECT tag, is_deleted
        FROM cleanup_selected_tags
        WHERE cleanup_run_id = ?
        ORDER BY tag
      `
    )
    .all(cleanupRunId) as Array<{ tag: string; is_deleted: number }>;

  assert.deepEqual(selectedTags, [
    { tag: "delete-new", is_deleted: 0 },
    { tag: "delete-old", is_deleted: 1 }
  ]);

  database.close();
});

test("cleanup selected tags must exist in the same scan as their cleanup run", () => {
  const database = openDatabase(":memory:");
  const scanWriter = new ScanWriter(database);

  scanWriter.startScan("acme", "example", "2026-05-17T09:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  scanWriter.insertPackageVersion({
    versionId: 101,
    createdAt: "2026-05-17T08:00:00.000Z",
    updatedAt: "2026-05-17T08:00:00.000Z"
  });
  scanWriter.insertManifest({
    versionId: 101,
    digest: "sha256:first",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  scanWriter.insertTag({ versionId: 101, tag: "first-tag" });
  scanWriter.markScanCompleted("2026-05-17T09:00:00.000Z");
  const firstScanId = scanWriter.getActiveScanId();

  scanWriter.startScan("acme", "example", "2026-05-17T10:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  scanWriter.insertPackageVersion({
    versionId: 201,
    createdAt: "2026-05-17T09:30:00.000Z",
    updatedAt: "2026-05-17T09:30:00.000Z"
  });
  scanWriter.insertManifest({
    versionId: 201,
    digest: "sha256:second",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  scanWriter.insertTag({ versionId: 201, tag: "second-tag" });
  scanWriter.markScanCompleted("2026-05-17T10:00:00.000Z");
  const secondScanId = scanWriter.getActiveScanId();

  const cleanupRunId = Number(
    database
      .prepare(
        `
          INSERT INTO cleanup_runs(
            scan_id,
            cleanup_uuid,
            cleanup_started_at,
            github_actions_run_url,
            dry_run,
            planner_inputs_json,
            direct_target_tag_count,
            direct_target_root_count,
            delete_root_candidate_count,
            untag_only_root_count,
            fully_deletable_root_count,
            blocked_delete_root_count,
            protected_root_count
          )
          VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        firstScanId,
        "0196db62-c240-7000-8000-000000000002",
        "2026-05-17T10:01:00.000Z",
        null,
        1,
        "{}",
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ).lastInsertRowid
  );

  assert.throws(
    () =>
      database
        .prepare(
          `
            INSERT INTO cleanup_selected_tags(
              cleanup_run_id,
              scan_id,
              tag,
              is_deleted
            )
            VALUES(?, ?, ?, 0)
          `
        )
        .run(cleanupRunId, secondScanId, "second-tag"),
    /FOREIGN KEY constraint failed/
  );

  database.close();
});

function _restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
