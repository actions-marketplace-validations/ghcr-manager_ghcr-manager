#!/usr/bin/env node
/* global process */

import Database from "better-sqlite3";

const args = process.argv.slice(2);
const databasePath = _readOption(args, "--db");
const cleanupRunIdRaw = _readOption(args, "--cleanup-run-id");
const owner = _readOption(args, "--owner");
const packageName = _readOption(args, "--package");

if (!databasePath) {
  throw new Error("missing required option: --db");
}

if (!cleanupRunIdRaw && (!owner || !packageName)) {
  throw new Error("provide either --cleanup-run-id <id> or both --owner <org> and --package <name>");
}

const database = new Database(databasePath, { readonly: true });

try {
  const cleanupRun = cleanupRunIdRaw
    ? _loadCleanupRunById(database, Number.parseInt(cleanupRunIdRaw, 10))
    : _loadLatestCleanupRunForPackage(database, owner, packageName);

  if (!cleanupRun) {
    throw new Error("cleanup run not found");
  }

  const rootDecisions = database
    .prepare(
      `
        SELECT
          manifest.version_id,
          decision.digest,
          selection_mode,
          selection_reason,
          validation_status,
          validation_reason_code,
          validation_reason,
          blocking_manifest.version_id AS blocking_version_id,
          decision.blocking_digest,
          overlap_digest
        FROM cleanup_root_decisions decision
        JOIN manifests manifest
          ON manifest.scan_id = decision.scan_id
         AND manifest.digest = decision.digest
        LEFT JOIN manifests blocking_manifest
          ON blocking_manifest.scan_id = decision.scan_id
         AND blocking_manifest.digest = decision.blocking_digest
        WHERE decision.cleanup_run_id = ?
        ORDER BY manifest.version_id
      `
    )
    .all(cleanupRun.cleanup_run_id);

  const protectedRootRows = database
    .prepare(
      `
        SELECT DISTINCT manifest.version_id, block.protected_digest AS digest
        FROM cleanup_protected_root_blocks block
        JOIN manifests manifest
          ON manifest.scan_id = block.scan_id
         AND manifest.digest = block.protected_digest
        WHERE block.cleanup_run_id = ?
        ORDER BY manifest.version_id
      `
    )
    .all(cleanupRun.cleanup_run_id);

  const protectedRootBlocks = database
    .prepare(
      `
        SELECT
          block.protected_digest,
          protected_manifest.version_id AS protected_version_id,
          blocked_manifest.version_id AS blocked_version_id,
          block.blocked_digest,
          block.block_reason_code,
          block.overlap_digest
        FROM cleanup_protected_root_blocks block
        JOIN manifests protected_manifest
          ON protected_manifest.scan_id = block.scan_id
         AND protected_manifest.digest = block.protected_digest
        JOIN manifests blocked_manifest
          ON blocked_manifest.scan_id = block.scan_id
         AND blocked_manifest.digest = block.blocked_digest
        WHERE block.cleanup_run_id = ?
        ORDER BY protected_manifest.version_id, blocked_manifest.version_id, block.overlap_digest
      `
    )
    .all(cleanupRun.cleanup_run_id);

  const protectedRoots = protectedRootRows.map((row) => ({
    versionId: row.version_id,
    digest: row.digest,
    blocks: protectedRootBlocks
      .filter((block) => block.protected_digest === row.digest)
      .map((block) => ({
        blockedVersionId: block.blocked_version_id,
        blockedDigest: block.blocked_digest,
        blockReasonCode: block.block_reason_code,
        overlapDigest: block.overlap_digest
      }))
  }));

  process.stdout.write(
    `${JSON.stringify({
      cleanupRunId: cleanupRun.cleanup_run_id,
      owner: cleanupRun.owner,
      packageName: cleanupRun.package_name,
      scanId: cleanupRun.scan_id,
      scanCompletedAt: cleanupRun.scan_completed_at,
      cleanupStartedAt: cleanupRun.cleanup_started_at,
      dryRun: cleanupRun.dry_run === 1,
      plannerInputs: JSON.parse(cleanupRun.planner_inputs_json),
      validationSummary: {
        directTargetTagCount: cleanupRun.direct_target_tag_count,
        directTargetRootCount: cleanupRun.direct_target_root_count,
        deleteRootCandidateCount: cleanupRun.delete_root_candidate_count,
        untagOnlyRootCount: cleanupRun.untag_only_root_count,
        fullyDeletableRootCount: cleanupRun.fully_deletable_root_count,
        blockedDeleteRootCount: cleanupRun.blocked_delete_root_count,
        protectedRootCount: cleanupRun.protected_root_count
      },
      rootDecisions: rootDecisions.map((row) => ({
        versionId: row.version_id,
        digest: row.digest,
        selectionMode: row.selection_mode,
        selectionReason: row.selection_reason,
        validationStatus: row.validation_status,
        validationReasonCode: row.validation_reason_code,
        validationReason: row.validation_reason,
        blockingVersionId: row.blocking_version_id ?? undefined,
        blockingDigest: row.blocking_digest ?? undefined,
        overlapDigest: row.overlap_digest ?? undefined
      })),
      protectedRoots
    })}\n`
  );
} finally {
  database.close();
}

function _loadCleanupRunById(database, cleanupRunId) {
  if (!Number.isInteger(cleanupRunId) || cleanupRunId <= 0) {
    throw new Error("--cleanup-run-id must be a positive integer");
  }

  return database
    .prepare(
      `
        SELECT
          cr.cleanup_run_id,
          cr.scan_id,
          cr.cleanup_started_at,
          cr.dry_run,
          cr.planner_inputs_json,
          cr.direct_target_tag_count,
          cr.direct_target_root_count,
          cr.delete_root_candidate_count,
          cr.untag_only_root_count,
          cr.fully_deletable_root_count,
          cr.blocked_delete_root_count,
          cr.protected_root_count,
          ps.owner,
          ps.package_name,
          ps.scan_completed_at
        FROM cleanup_runs cr
        JOIN package_scans ps
          ON ps.scan_id = cr.scan_id
        WHERE cr.cleanup_run_id = ?
      `
    )
    .get(cleanupRunId);
}

function _loadLatestCleanupRunForPackage(database, owner, packageName) {
  return database
    .prepare(
      `
        SELECT
          cr.cleanup_run_id,
          cr.scan_id,
          cr.cleanup_started_at,
          cr.dry_run,
          cr.planner_inputs_json,
          cr.direct_target_tag_count,
          cr.direct_target_root_count,
          cr.delete_root_candidate_count,
          cr.untag_only_root_count,
          cr.fully_deletable_root_count,
          cr.blocked_delete_root_count,
          cr.protected_root_count,
          ps.owner,
          ps.package_name,
          ps.scan_completed_at
        FROM cleanup_runs cr
        JOIN package_scans ps
          ON ps.scan_id = cr.scan_id
        WHERE ps.owner = ?
          AND ps.package_name = ?
        ORDER BY cr.cleanup_started_at DESC, cr.cleanup_run_id DESC
        LIMIT 1
      `
    )
    .get(owner, packageName);
}

function _readOption(args, optionName) {
  const index = args.indexOf(optionName);
  if (index === -1) {
    return undefined;
  }
  if (index === args.length - 1 || args[index + 1].startsWith("--")) {
    throw new Error(`missing value for option: ${optionName}`);
  }

  return args[index + 1];
}
