import { openDatabase, PlannerRepository } from "../db/index.js";
import { executeDeletePlan } from "../execute/index.js";
import { resolveGitHubToken, resolveLogLevel } from "./_args.js";
import { createLogger } from "./_logger.js";
import { loadDeletePlan, resolvePlanCommandInputs } from "./_planner-options.js";
import { resolveTagSelectors } from "./_tag-selector-resolver.js";

export async function handleExecute(args: string[]): Promise<number> {
  const inputs = resolvePlanCommandInputs(args);
  const token = resolveGitHubToken(args);
  const logger = createLogger(resolveLogLevel(args));
  const database = openDatabase(inputs.databasePath);
  try {
    const repository = new PlannerRepository(database, logger);
    logger.debug(`Starting execute for ${inputs.owner}/${inputs.packageName}`);
    const plan = loadDeletePlan(repository, resolveTagSelectors(database, inputs));
    const summary = await executeDeletePlan(plan, {
      token,
      logger,
      listRootTags: (root) => _listRootTags(database, root.owner, root.packageName, root.versionId)
    });
    logger.debug(`Completed execute for ${inputs.owner}/${inputs.packageName}`);
    console.log(JSON.stringify(summary, null, 2));
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
        ORDER BY tags.tag
      `
    )
    .all(owner, packageName, versionId) as Array<{ tag: string }>;

  return rows.map((row) => row.tag);
}
