import { buildCleanupSummary } from "../cleanup-summary/index.js";
import { CleanupRunWriter, openDatabase, PlannerRepository } from "../db/index.js";
import { executeDeletePlan } from "../execute/index.js";
import { hasFlag, resolveLogLevel, resolveToken } from "./_args.js";
import { createLogger } from "./_logger.js";
import { loadDeletePlan, resolvePlanCommandInputs } from "./_planner-options.js";
import { resolveTagSelectors } from "./_tag-selector-resolver.js";

export async function handleCleanup(args: string[]): Promise<number> {
  const inputs = resolvePlanCommandInputs(args);
  const dryRun = hasFlag(args, "--dry-run");
  const token = dryRun ? undefined : resolveToken(args);
  const logger = createLogger(resolveLogLevel(args));
  const database = openDatabase(inputs.databasePath);
  try {
    const repository = new PlannerRepository(database, logger);
    const cleanupRunWriter = new CleanupRunWriter(database);
    const scanId = repository.getLatestCompletedScanId(inputs.owner, inputs.packageName);
    logger.debug(`Starting cleanup for ${inputs.owner}/${inputs.packageName}`);
    const plan = loadDeletePlan(repository, resolveTagSelectors(database, inputs));
    const cleanupRunId = cleanupRunWriter.persistCleanupRun(scanId, plan, {
      dryRun,
      cleanupStartedAt: new Date().toISOString()
    });
    if (dryRun) {
      const summary = buildCleanupSummary(plan, {
        dryRun: true,
        listRootTags: (versionId) => _listRootTags(database, inputs.owner, inputs.packageName, versionId),
        plannedChanges: _loadPlannedChanges(database, cleanupRunId)
      });
      logger.debug(`Completed dry-run cleanup for ${inputs.owner}/${inputs.packageName}`);
      console.log(JSON.stringify(summary));
      return 0;
    }

    const executionSummary = await executeDeletePlan(plan, {
      token: token as string,
      logger,
      listRootTags: (root) => _listRootTags(database, root.owner, root.packageName, root.versionId)
    });
    const summary = buildCleanupSummary(plan, {
      dryRun: false,
      listRootTags: (versionId) => _listRootTags(database, inputs.owner, inputs.packageName, versionId),
      plannedChanges: _loadPlannedChanges(database, cleanupRunId),
      executionSummary
    });
    logger.debug(`Completed cleanup for ${inputs.owner}/${inputs.packageName}`);
    console.log(JSON.stringify(summary));
    return 0;
  } finally {
    database.close();
  }
}

function _listRootTags(
  database: ReturnType<typeof openDatabase>,
  owner: string,
  packageName: string,
  versionId: number
): string[] {
  const rows = database
    .prepare(
      `
        SELECT tags.tag
        FROM tags
        INNER JOIN v_latest_scan_per_package latest_scan ON latest_scan.scan_id = tags.scan_id
        WHERE latest_scan.owner = ?
          AND latest_scan.package_name = ?
          AND tags.version_id = ?
          AND tags.is_digest_tag = 0
        ORDER BY tags.tag
      `
    )
    .all(owner, packageName, versionId) as Array<{ tag: string }>;

  return rows.map((row) => row.tag);
}

function _loadPlannedChanges(
  database: ReturnType<typeof openDatabase>,
  cleanupRunId: number
): {
  tagRemovals: number;
  imageDeletes: number;
  crossArchDeletes: number;
  artifactDeletes: number;
  attestationDeletes: number;
  signatureDeletes: number;
  totalManifestDeletes: number;
} {
  const tagRemovals = (
    database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM cleanup_selected_tags
          WHERE cleanup_run_id = ?
            AND is_deleted = 1
        `
      )
      .get(cleanupRunId) as { count: number }
  ).count;

  const manifestCounts = database
    .prepare(
      `
        WITH fully_deletable_manifests AS (
          SELECT DISTINCT
            reachable.descendant_digest AS digest,
            manifest.manifest_kind
          FROM cleanup_root_decisions decision
          JOIN manifest_reachability reachable
            ON reachable.scan_id = decision.scan_id
           AND reachable.ancestor_digest = decision.digest
          JOIN manifests manifest
            ON manifest.scan_id = reachable.scan_id
           AND manifest.digest = reachable.descendant_digest
          WHERE decision.cleanup_run_id = ?
            AND decision.validation_status = 'fully-deletable'
        )
        SELECT
          manifest_kind,
          COUNT(*) AS count
        FROM fully_deletable_manifests
        GROUP BY manifest_kind
      `
    )
    .all(cleanupRunId) as Array<{ manifest_kind: string | null; count: number }>;

  const countsByKind = new Map(manifestCounts.map((row) => [row.manifest_kind ?? "", row.count]));

  return {
    tagRemovals,
    imageDeletes: countsByKind.get("image_manifest") ?? 0,
    crossArchDeletes: countsByKind.get("image_index") ?? 0,
    artifactDeletes: countsByKind.get("artifact_manifest") ?? 0,
    attestationDeletes: countsByKind.get("attestation_manifest") ?? 0,
    signatureDeletes: countsByKind.get("signature_manifest") ?? 0,
    totalManifestDeletes: manifestCounts.reduce((total, row) => total + row.count, 0)
  };
}
