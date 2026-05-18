import type Database from "better-sqlite3";
import type { CleanupRunRow } from "./_db-merge-types.js";

export class DbMergeCleanupCopy {
  readonly #database: Database.Database;

  constructor(database: Database.Database) {
    this.#database = database;
  }

  copyCleanupRuns(
    attachName: string,
    sourceScanId: number,
    targetScanId: number,
    existingCleanupUuids: string[]
  ): number {
    const rows = this.#database
      .prepare(
        `
          SELECT
            cleanup_run_id,
            cleanup_uuid,
            cleanup_started_at,
            dry_run,
            planner_inputs_json,
            direct_target_tag_count,
            direct_target_root_count,
            delete_root_candidate_count,
            untag_only_root_count,
            fully_deletable_root_count,
            blocked_delete_root_count,
            protected_root_count
          FROM ${attachName}.cleanup_runs
          WHERE scan_id = ?
          ORDER BY cleanup_run_id
        `
      )
      .all(sourceScanId) as CleanupRunRow[];
    const knownCleanupUuids = new Set(existingCleanupUuids);
    let importedCleanupRunCount = 0;

    for (const row of rows) {
      if (knownCleanupUuids.has(row.cleanup_uuid)) {
        continue;
      }

      const cleanupRunId = Number(
        this.#database
          .prepare(
            `
              INSERT INTO cleanup_runs(
                scan_id,
                cleanup_uuid,
                cleanup_started_at,
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
              VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
          )
          .run(
            targetScanId,
            row.cleanup_uuid,
            row.cleanup_started_at,
            row.dry_run,
            row.planner_inputs_json,
            row.direct_target_tag_count,
            row.direct_target_root_count,
            row.delete_root_candidate_count,
            row.untag_only_root_count,
            row.fully_deletable_root_count,
            row.blocked_delete_root_count,
            row.protected_root_count
          ).lastInsertRowid
      );

      this.#database
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
              validation_reason,
              blocking_digest,
              overlap_digest
            )
            SELECT
              ?,
              ?,
              digest,
              selection_mode,
              selection_reason,
              validation_status,
              validation_reason_code,
              validation_reason,
              blocking_digest,
              overlap_digest
            FROM ${attachName}.cleanup_root_decisions
            WHERE cleanup_run_id = ?
              AND scan_id = ?
          `
        )
        .run(cleanupRunId, targetScanId, row.cleanup_run_id, sourceScanId);
      this.#database
        .prepare(
          `
            INSERT INTO cleanup_protected_root_blocks(
              cleanup_run_id,
              scan_id,
              protected_digest,
              blocked_digest,
              block_reason_code,
              overlap_digest
            )
            SELECT
              ?,
              ?,
              protected_digest,
              blocked_digest,
              block_reason_code,
              overlap_digest
            FROM ${attachName}.cleanup_protected_root_blocks
            WHERE cleanup_run_id = ?
              AND scan_id = ?
          `
        )
        .run(cleanupRunId, targetScanId, row.cleanup_run_id, sourceScanId);
      knownCleanupUuids.add(row.cleanup_uuid);
      importedCleanupRunCount += 1;
    }

    return importedCleanupRunCount;
  }

  listCleanupUuids(tableName: string, scanId: number): string[] {
    const rows = this.#database
      .prepare(
        `
          SELECT cleanup_uuid
          FROM ${tableName}
          WHERE scan_id = ?
          ORDER BY cleanup_run_id
        `
      )
      .all(scanId) as Array<{ cleanup_uuid: string }>;

    return rows.map((row) => row.cleanup_uuid);
  }
}
