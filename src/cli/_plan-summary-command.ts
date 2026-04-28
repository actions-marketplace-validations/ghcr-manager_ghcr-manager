import { buildPlanSummary } from "../core/planner/index.js";
import type { PlanOptions } from "../core/index.js";
import { SnapshotRepository, openDatabase } from "../db/index.js";
import { collectRepeatedOption, requireOption } from "./_args.js";

export async function handlePlanSummary(args: string[]): Promise<number> {
  const databasePath = requireOption(args, "--db");
  const olderThanDays = Number(requireOption(args, "--older-than-days"));
  if (!Number.isInteger(olderThanDays) || olderThanDays < 0) {
    throw new Error("--older-than-days must be a non-negative integer");
  }

  const options: PlanOptions = {
    olderThanDays,
    deleteUntagged: args.includes("--delete-untagged"),
    excludeTags: collectRepeatedOption(args, "--exclude-tag"),
  };

  const database = openDatabase(databasePath);
  const repository = new SnapshotRepository(database);
  const summary = buildPlanSummary(repository, options);
  console.log(JSON.stringify(summary, null, 2));
  database.close();
  return 0;
}
