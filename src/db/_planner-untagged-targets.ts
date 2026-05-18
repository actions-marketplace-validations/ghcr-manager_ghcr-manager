import { PlannerSql } from "./_planner-sql.js";
import { mapPlanRootRow, type DeletePlanRoot, type ScanRow } from "./_planner-types.js";

export class PlannerUntaggedTargets {
  readonly #sql: PlannerSql;

  constructor(sql: PlannerSql) {
    this.#sql = sql;
  }

  getLatestCompletedScan(owner: string, packageName: string): ScanRow {
    const sql = `
      SELECT scan_id, owner, package_name, scan_completed_at
      FROM v_latest_scan_per_package
      WHERE owner = ?
        AND package_name = ?
      LIMIT 1
    `;
    const row = this.#sql.get<ScanRow>(sql, [owner, packageName]);
    if (!row) {
      throw new Error(`database does not contain completed package scan for ${owner}/${packageName}`);
    }

    return row;
  }

  listDeleteUntaggedDirectTargetRoots(scanId: number, cutoffTimestamp?: string): DeletePlanRoot[] {
    const cutoffSql = cutoffTimestamp ? "AND created_at < ?" : "";
    const sql = `
      SELECT
        root_version_id AS version_id,
        root_digest,
        root_manifest_kind,
        'delete-untagged' AS direct_target_reason,
        'delete-root' AS selection_mode
      FROM v_scan_root_manifests
      WHERE scan_id = ?
        AND is_tagged = 0
        AND has_ancestor = 0
        ${cutoffSql}
      ORDER BY root_digest
    `;
    const rows = this.#sql.all<Parameters<typeof mapPlanRootRow>[0]>(sql, [
      scanId,
      ...(cutoffTimestamp ? [cutoffTimestamp] : [])
    ]);
    return rows.map(mapPlanRootRow);
  }

  listKeepNUntaggedDirectTargetRoots(scanId: number, keepCount: number, cutoffTimestamp?: string): DeletePlanRoot[] {
    const cutoffSql = cutoffTimestamp ? "AND pv.created_at < ?" : "";
    const sql = `
      WITH eligible_untagged_roots AS (
        SELECT
          pv.version_id AS version_id,
          m.digest AS root_digest,
          m.manifest_kind AS root_manifest_kind,
          ROW_NUMBER() OVER (
            ORDER BY pv.created_at DESC, pv.version_id DESC, m.digest DESC
          ) AS recency_rank
        FROM package_versions pv
        JOIN manifests m
          ON m.scan_id = pv.scan_id
         AND m.version_id = pv.version_id
        WHERE pv.scan_id = ?
          AND NOT EXISTS (
            SELECT 1
            FROM tags t
            WHERE t.scan_id = pv.scan_id
              AND t.version_id = pv.version_id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM manifest_reachability mr
            WHERE mr.scan_id = pv.scan_id
              AND mr.descendant_digest = m.digest
              AND mr.min_distance > 0
          )
          ${cutoffSql}
      )
      SELECT
        version_id,
        root_digest,
        root_manifest_kind,
        'keep-n-untagged-overflow' AS direct_target_reason,
        'delete-root' AS selection_mode
      FROM eligible_untagged_roots
      WHERE recency_rank > ?
      ORDER BY root_digest
    `;
    const rows = this.#sql.all<Parameters<typeof mapPlanRootRow>[0]>(sql, [
      scanId,
      ...(cutoffTimestamp ? [cutoffTimestamp] : []),
      keepCount
    ]);
    return rows.map(mapPlanRootRow);
  }
}
