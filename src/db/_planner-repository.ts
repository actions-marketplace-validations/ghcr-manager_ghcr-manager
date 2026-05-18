import type Database from "better-sqlite3";
import { buildPlanOutputs } from "./_planner-output.js";
import { PlannerPlanArtifacts } from "./_planner-plan-artifacts.js";
import { PlannerSql } from "./_planner-sql.js";
import { PlannerTaggedTargets } from "./_planner-tagged-targets.js";
import type { DeletePlan, PlannerLogger } from "./_planner-types.js";
import { PlannerUntaggedTargets } from "./_planner-untagged-targets.js";

export type {
  DeletePlan,
  DeletePlanBlockedRoot,
  DeletePlanClosureManifest,
  DeletePlanProtectedRoot,
  DeletePlanRoot,
  DeletePlanRootDecision
} from "./_planner-types.js";

export class PlannerRepository {
  readonly #untaggedTargets: PlannerUntaggedTargets;
  readonly #taggedTargets: PlannerTaggedTargets;
  readonly #planArtifacts: PlannerPlanArtifacts;

  constructor(database: Database.Database, logger?: PlannerLogger) {
    const sql = new PlannerSql(database, logger);
    this.#untaggedTargets = new PlannerUntaggedTargets(sql);
    this.#taggedTargets = new PlannerTaggedTargets(sql);
    this.#planArtifacts = new PlannerPlanArtifacts(sql);
  }

  getDeleteUntaggedPlan(owner: string, packageName: string): DeletePlan {
    return this.getDeleteUntaggedPlanWithCutoff(owner, packageName);
  }

  getLatestCompletedScanId(owner: string, packageName: string): number {
    return this.#untaggedTargets.getLatestCompletedScan(owner, packageName).scan_id;
  }

  getKeepNUntaggedPlan(owner: string, packageName: string, keepCount: number): DeletePlan {
    return this.getKeepNUntaggedPlanWithCutoff(owner, packageName, keepCount);
  }

  getKeepNTaggedPlan(owner: string, packageName: string, keepCount: number): DeletePlan {
    return this.getKeepNTaggedPlanWithCutoff(owner, packageName, keepCount, []);
  }

  getDeleteUntaggedPlanWithCutoff(
    owner: string,
    packageName: string,
    options?: {
      olderThan?: string;
      cutoffTimestamp?: string;
    }
  ): DeletePlan {
    const scan = this.#untaggedTargets.getLatestCompletedScan(owner, packageName);
    const directTargetRoots = this.#untaggedTargets.listDeleteUntaggedDirectTargetRoots(
      scan.scan_id,
      options?.cutoffTimestamp
    );
    const planArtifacts = this.#planArtifacts.build(scan.scan_id, directTargetRoots);

    return {
      owner: scan.owner,
      packageName: scan.package_name,
      scanCompletedAt: scan.scan_completed_at,
      plannerInputs: {
        deleteUntagged: true,
        deleteGhostImages: undefined,
        deletePartialImages: undefined,
        deleteOrphanedImages: undefined,
        deleteTags: [],
        excludeTags: [],
        keepNTagged: undefined,
        keepNUntagged: undefined,
        olderThan: options?.olderThan,
        cutoffTimestamp: options?.cutoffTimestamp
      },
      ...buildPlanOutputs([], directTargetRoots, planArtifacts)
    };
  }

  getKeepNUntaggedPlanWithCutoff(
    owner: string,
    packageName: string,
    keepCount: number,
    options?: {
      olderThan?: string;
      cutoffTimestamp?: string;
    }
  ): DeletePlan {
    const scan = this.#untaggedTargets.getLatestCompletedScan(owner, packageName);
    const directTargetRoots = this.#untaggedTargets.listKeepNUntaggedDirectTargetRoots(
      scan.scan_id,
      keepCount,
      options?.cutoffTimestamp
    );
    const planArtifacts = this.#planArtifacts.build(scan.scan_id, directTargetRoots);

    return {
      owner: scan.owner,
      packageName: scan.package_name,
      scanCompletedAt: scan.scan_completed_at,
      plannerInputs: {
        deleteUntagged: false,
        deleteGhostImages: undefined,
        deletePartialImages: undefined,
        deleteOrphanedImages: undefined,
        deleteTags: [],
        excludeTags: [],
        keepNTagged: undefined,
        keepNUntagged: keepCount,
        olderThan: options?.olderThan,
        cutoffTimestamp: options?.cutoffTimestamp
      },
      ...buildPlanOutputs([], directTargetRoots, planArtifacts)
    };
  }

  getKeepNTaggedPlanWithCutoff(
    owner: string,
    packageName: string,
    keepCount: number,
    excludeTags: string[],
    options?: {
      olderThan?: string;
      cutoffTimestamp?: string;
    }
  ): DeletePlan {
    const scan = this.#untaggedTargets.getLatestCompletedScan(owner, packageName);
    const directTargetRoots = this.#taggedTargets.listTaggedDirectTargetRoots(scan.scan_id, {
      deleteTags: [],
      excludeTags,
      keepCount,
      cutoffTimestamp: options?.cutoffTimestamp
    });
    const planArtifacts = this.#planArtifacts.build(scan.scan_id, directTargetRoots);

    return {
      owner: scan.owner,
      packageName: scan.package_name,
      scanCompletedAt: scan.scan_completed_at,
      plannerInputs: {
        deleteUntagged: false,
        deleteGhostImages: undefined,
        deletePartialImages: undefined,
        deleteOrphanedImages: undefined,
        deleteTags: [],
        excludeTags,
        keepNTagged: keepCount,
        keepNUntagged: undefined,
        olderThan: options?.olderThan,
        cutoffTimestamp: options?.cutoffTimestamp
      },
      ...buildPlanOutputs([], directTargetRoots, planArtifacts)
    };
  }

  getDeleteTagsPlan(owner: string, packageName: string, deleteTags: string[], excludeTags: string[]): DeletePlan {
    return this.getDeleteTagsPlanWithCutoff(owner, packageName, deleteTags, excludeTags);
  }

  getDeleteTagsPlanWithCutoff(
    owner: string,
    packageName: string,
    deleteTags: string[],
    excludeTags: string[],
    options?: {
      deleteTagsRequested?: boolean;
      deleteGhostImages?: boolean;
      deletePartialImages?: boolean;
      deleteOrphanedImages?: boolean;
      keepNTagged?: number;
      useRegex?: boolean;
      olderThan?: string;
      cutoffTimestamp?: string;
    }
  ): DeletePlan {
    const scan = this.#untaggedTargets.getLatestCompletedScan(owner, packageName);
    const directTargetTags = this.#taggedTargets.listDeleteTagDirectTargetTags(
      scan.scan_id,
      deleteTags,
      excludeTags,
      options?.useRegex ?? false,
      options?.cutoffTimestamp
    );
    const directTargetRoots = this.#taggedTargets.listTaggedDirectTargetRoots(scan.scan_id, {
      deleteTags,
      deleteTagsRequested: options?.deleteTagsRequested ?? true,
      excludeTags,
      keepCount: options?.keepNTagged,
      useRegex: options?.useRegex ?? false,
      cutoffTimestamp: options?.cutoffTimestamp
    });
    const planArtifacts = this.#planArtifacts.build(scan.scan_id, directTargetRoots);

    return {
      owner: scan.owner,
      packageName: scan.package_name,
      scanCompletedAt: scan.scan_completed_at,
      plannerInputs: {
        deleteUntagged: false,
        deleteGhostImages: options?.deleteGhostImages || undefined,
        deletePartialImages: options?.deletePartialImages || undefined,
        deleteOrphanedImages: options?.deleteOrphanedImages || undefined,
        deleteTags,
        excludeTags,
        keepNTagged: options?.keepNTagged,
        keepNUntagged: undefined,
        olderThan: options?.olderThan,
        cutoffTimestamp: options?.cutoffTimestamp
      },
      ...buildPlanOutputs(directTargetTags, directTargetRoots, planArtifacts)
    };
  }
}
