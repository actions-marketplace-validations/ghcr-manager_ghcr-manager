import assert from "node:assert/strict";
import test from "node:test";
import { DbMergeCleanupCopy } from "../../src/db/_db-merge-cleanup-copy.js";
import { openDatabase } from "../../src/db/index.js";

test("db merge cleanup copy lists cleanup UUIDs in local cleanup-run order", () => {
  const database = openDatabase(":memory:");
  database
    .prepare(
      `
        INSERT INTO package_scans(
          scan_uuid,
          owner,
          package_name,
          package_metadata_json,
          github_actions_run_url,
          scan_started_at,
          scan_completed_at,
          status
        )
        VALUES(
          'scan-uuid',
          'acme',
          'example',
          '{"visibility":"public"}',
          NULL,
          '2026-05-17T09:00:00.000Z',
          '2026-05-17T09:00:00.000Z',
          'completed'
        )
      `
    )
    .run();
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
        VALUES(1, ?, '2026-05-17T09:02:00.000Z', NULL, 1, '{}', 0, 0, 0, 0, 0, 0, 0),
              (1, ?, '2026-05-17T09:01:00.000Z', NULL, 1, '{}', 0, 0, 0, 0, 0, 0, 0)
      `
    )
    .run("cleanup-b", "cleanup-a");
  const helper = new DbMergeCleanupCopy(database);

  assert.deepEqual(helper.listCleanupUuids("cleanup_runs", 1), ["cleanup-b", "cleanup-a"]);

  database.close();
});
