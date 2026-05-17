import type Database from "better-sqlite3";
import type { DeletePlan } from "./_planner-repository.js";

export class CleanupRunWriter {
  readonly #database: Database.Database;

  constructor(database: Database.Database) {
    this.#database = database;
  }

  persistCleanupRun(scanId: number, plan: DeletePlan, options: { dryRun: boolean; cleanupStartedAt: string }): number {
    return this.#database.transaction(() => {
      const cleanupRunId = this.#insertCleanupRun(scanId, plan, options);
      for (const rootDecision of plan.rootDecisions) {
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
              VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
          )
          .run(
            cleanupRunId,
            scanId,
            rootDecision.digest,
            rootDecision.selectionMode,
            rootDecision.selectionReason,
            rootDecision.validationStatus,
            rootDecision.validationReasonCode,
            rootDecision.validationReason,
            rootDecision.blockingDigest ?? null,
            rootDecision.overlapDigest ?? null
          );
      }

      for (const protectedRoot of plan.protectedRoots) {
        for (const block of protectedRoot.blocks) {
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
                VALUES(?, ?, ?, ?, ?, ?)
              `
            )
            .run(
              cleanupRunId,
              scanId,
              protectedRoot.digest,
              block.blockedDigest,
              block.blockReasonCode,
              block.overlapDigest
            );
        }
      }

      return cleanupRunId;
    })();
  }

  #insertCleanupRun(scanId: number, plan: DeletePlan, options: { dryRun: boolean; cleanupStartedAt: string }): number {
    const result = this.#database
      .prepare(
        `
          INSERT INTO cleanup_runs(
            scan_id,
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
          VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        scanId,
        options.cleanupStartedAt,
        options.dryRun ? 1 : 0,
        JSON.stringify(plan.plannerInputs),
        plan.validationSummary.directTargetTagCount,
        plan.validationSummary.directTargetRootCount,
        plan.validationSummary.deleteRootCandidateCount,
        plan.validationSummary.untagOnlyRootCount,
        plan.validationSummary.fullyDeletableRootCount,
        plan.validationSummary.blockedDeleteRootCount,
        plan.validationSummary.protectedRootCount
      );

    return Number(result.lastInsertRowid);
  }
}
