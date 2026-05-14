import { PlannerRepository, openDatabase } from "../db/index.js";
import { collectRepeatedOption, hasFlag, requireOption } from "./_args.js";
import { resolveOlderThan } from "./_older-than.js";

export async function handlePlan(args: string[]): Promise<number> {
  const databasePath = requireOption(args, "--db");
  const owner = requireOption(args, "--owner");
  const packageName = requireOption(args, "--package");
  const deleteTags = collectRepeatedOption(args, "--delete-tag");
  const excludeTags = collectRepeatedOption(args, "--exclude-tag");
  const deleteUntagged = hasFlag(args, "--delete-untagged");
  const olderThanRaw = collectRepeatedOption(args, "--older-than");

  if (deleteUntagged && deleteTags.length > 0) {
    throw new Error("plan currently supports either --delete-untagged or --delete-tag, not both");
  }

  if (!deleteUntagged && deleteTags.length === 0) {
    throw new Error("missing required cleanup selector: --delete-untagged or --delete-tag");
  }

  if (deleteUntagged && excludeTags.length > 0) {
    throw new Error("--exclude-tag is only supported with --delete-tag");
  }
  if (olderThanRaw.length > 1) {
    throw new Error("--older-than may only be provided once");
  }

  const olderThan = olderThanRaw[0] ? resolveOlderThan(olderThanRaw[0], new Date()) : undefined;

  const database = openDatabase(databasePath);
  const repository = new PlannerRepository(database);
  const plan = deleteUntagged
    ? repository.getDeleteUntaggedPlanWithCutoff(owner, packageName, olderThan)
    : repository.getDeleteTagsPlanWithCutoff(owner, packageName, deleteTags, excludeTags, olderThan);
  console.log(JSON.stringify(plan, null, 2));
  database.close();
  return 0;
}
