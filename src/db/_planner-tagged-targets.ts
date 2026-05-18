import { PlannerDirectTargetTags } from "./_planner-direct-target-tags.js";
import { PlannerTaggedRootTargets, type TaggedRootTargetOptions } from "./_planner-tagged-root-targets.js";
import { PlannerSql } from "./_planner-sql.js";

export class PlannerTaggedTargets {
  readonly #directTargetTags: PlannerDirectTargetTags;
  readonly #rootTargets: PlannerTaggedRootTargets;

  constructor(sql: PlannerSql) {
    this.#directTargetTags = new PlannerDirectTargetTags(sql);
    this.#rootTargets = new PlannerTaggedRootTargets(sql);
  }

  listDeleteTagDirectTargetTags(
    scanId: number,
    deleteTags: string[],
    excludeTags: string[],
    useRegex: boolean,
    cutoffTimestamp?: string
  ): string[] {
    return this.#directTargetTags.listDeleteTagDirectTargetTags(
      scanId,
      deleteTags,
      excludeTags,
      useRegex,
      cutoffTimestamp
    );
  }

  listTaggedDirectTargetRoots(scanId: number, options: TaggedRootTargetOptions) {
    return this.#rootTargets.listTaggedDirectTargetRoots(scanId, options);
  }
}
