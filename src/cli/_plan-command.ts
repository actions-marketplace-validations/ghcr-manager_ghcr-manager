import { PlannerRepository, openDatabase } from "../db/index.js";
import { resolveLogLevel } from "./_args.js";
import { createLogger } from "./_logger.js";
import { loadDeletePlan, resolvePlanCommandInputs } from "./_planner-options.js";
import { resolveTagSelectors } from "./_tag-selector-resolver.js";

export async function handlePlan(args: string[]): Promise<number> {
  const inputs = resolvePlanCommandInputs(args);
  const logger = createLogger(resolveLogLevel(args));
  const database = openDatabase(inputs.databasePath);
  const repository = new PlannerRepository(database, logger);
  logger.debug(`Starting plan for ${inputs.owner}/${inputs.packageName}`);
  const plan = loadDeletePlan(repository, resolveTagSelectors(database, inputs));
  logger.debug(`Completed plan for ${inputs.owner}/${inputs.packageName}`);
  console.log(JSON.stringify(plan, null, 2));
  database.close();
  return 0;
}
