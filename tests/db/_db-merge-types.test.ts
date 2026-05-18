import assert from "node:assert/strict";
import test from "node:test";
import type {
  CleanupRunRow,
  DbMergeSourceSummary,
  SourceScanRow,
  TargetScanRow
} from "../../src/db/_db-merge-types.js";

test("db merge types describe the expected row and summary shapes", () => {
  const sourceScan: SourceScanRow = {
    scan_id: 1,
    scan_uuid: "scan-uuid",
    owner: "acme",
    package_name: "example",
    is_public: 1,
    package_metadata_json: '{"visibility":"public"}',
    github_actions_run_url: null,
    scan_started_at: "2026-05-17T09:00:00.000Z",
    scan_completed_at: "2026-05-17T09:01:00.000Z",
    status: "completed"
  };
  const targetScan: TargetScanRow = { ...sourceScan };
  const cleanupRun: CleanupRunRow = {
    cleanup_run_id: 1,
    cleanup_uuid: "cleanup-uuid",
    cleanup_started_at: "2026-05-17T09:02:00.000Z",
    github_actions_run_url: null,
    dry_run: 1,
    planner_inputs_json: "{}",
    direct_target_tag_count: 0,
    direct_target_root_count: 0,
    delete_root_candidate_count: 0,
    untag_only_root_count: 0,
    fully_deletable_root_count: 0,
    blocked_delete_root_count: 0,
    protected_root_count: 0
  };
  const summary: DbMergeSourceSummary = {
    sourceDatabasePath: "/tmp/source.sqlite",
    importedScanCount: 1,
    skippedScanCount: 0,
    importedCleanupRunCount: 1,
    skippedCleanupRunCount: 0
  };

  assert.equal(sourceScan.scan_uuid, targetScan.scan_uuid);
  assert.equal(cleanupRun.cleanup_uuid, "cleanup-uuid");
  assert.equal(summary.importedScanCount, 1);
});
