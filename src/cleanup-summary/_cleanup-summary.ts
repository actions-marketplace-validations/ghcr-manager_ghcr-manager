import type { ManifestKind } from "../core/index.js";
import type { DeletePlan, DeletePlanSelectionMode, DeletePlanSelectionReason } from "../db/index.js";
import type { DeleteExecutionSummary } from "../execute/index.js";

export interface CleanupSummaryRoot {
  versionId: number;
  digest: string;
  manifestKind?: string;
  rootTags: string[];
  matchedTags: string[];
  selectionMode: DeletePlanSelectionMode;
  selectionReason: DeletePlanSelectionReason;
  validationStatus: "fully-deletable" | "blocked" | "untag-only";
  validationReasonCode:
    | "untag-only-partial-tag-match"
    | "fully-deletable-no-retained-overlap"
    | "blocked-overlap-with-retained-root";
  validationReason: string;
  blockingVersionId?: number;
  blockingDigest?: string;
  overlapDigest?: string;
  overlapManifestKind?: string;
}

export interface CleanupSummaryAffectedManifest {
  digest: string;
  manifestKind?: ManifestKind;
}

export interface CleanupSummaryPlannedChanges {
  tagRemovals: number;
  imageDeletes: number;
  crossArchDeletes: number;
  artifactDeletes: number;
  attestationDeletes: number;
  signatureDeletes: number;
  totalManifestDeletes: number;
}

export interface CleanupSummary {
  command: "cleanup";
  owner: string;
  packageName: string;
  scanCompletedAt: string;
  dryRun: boolean;
  plannerInputs: DeletePlan["plannerInputs"];
  directTargetTags: string[];
  collateralTags: string[];
  fullyDeletableRoots: CleanupSummaryRoot[];
  untagOnlyRoots: CleanupSummaryRoot[];
  blockedRoots: CleanupSummaryRoot[];
  affectedManifests: CleanupSummaryAffectedManifest[];
  plannedChanges: CleanupSummaryPlannedChanges;
  deletedPackageVersions: DeleteExecutionSummary["deletedPackageVersions"];
  untaggedTags: DeleteExecutionSummary["untaggedTags"];
  unsupportedUntagRoots: DeleteExecutionSummary["unsupportedUntagRoots"];
}

export function buildCleanupSummary(
  plan: DeletePlan,
  options: {
    dryRun: boolean;
    listRootTags: (versionId: number) => string[];
    plannedChanges: CleanupSummaryPlannedChanges;
    executionSummary?: DeleteExecutionSummary;
  }
): CleanupSummary {
  const directTargetTagSet = new Set(plan.directTargetTags);
  const roots = plan.rootDecisions.map((decision) =>
    _mapRootDecision(decision, directTargetTagSet, options.listRootTags)
  );
  const fullyDeletableRoots = roots.filter((root) => root.validationStatus === "fully-deletable");
  const blockedRoots = roots.filter((root) => root.validationStatus === "blocked");
  const untagOnlyRoots = roots.filter((root) => root.validationStatus === "untag-only");
  const affectedManifests = _listAffectedManifests(
    plan,
    fullyDeletableRoots.map((root) => root.digest)
  );

  return {
    command: "cleanup",
    owner: plan.owner,
    packageName: plan.packageName,
    scanCompletedAt: plan.scanCompletedAt,
    dryRun: options.dryRun,
    plannerInputs: plan.plannerInputs,
    directTargetTags: plan.directTargetTags,
    collateralTags: plan.collateralTags,
    fullyDeletableRoots,
    untagOnlyRoots,
    blockedRoots,
    affectedManifests,
    plannedChanges: options.plannedChanges,
    deletedPackageVersions: options.executionSummary?.deletedPackageVersions ?? [],
    untaggedTags: options.executionSummary?.untaggedTags ?? [],
    unsupportedUntagRoots: options.executionSummary?.unsupportedUntagRoots ?? []
  };
}

function _mapRootDecision(
  decision: DeletePlan["rootDecisions"][number],
  directTargetTagSet: Set<string>,
  listRootTags: (versionId: number) => string[]
): CleanupSummaryRoot {
  const rootTags = listRootTags(decision.versionId);

  return {
    versionId: decision.versionId,
    digest: decision.digest,
    manifestKind: decision.manifestKind,
    rootTags,
    matchedTags: rootTags.filter((tag) => directTargetTagSet.has(tag)),
    selectionMode: decision.selectionMode,
    selectionReason: decision.selectionReason,
    validationStatus: decision.validationStatus,
    validationReasonCode: decision.validationReasonCode,
    validationReason: decision.validationReason,
    blockingVersionId: decision.blockingVersionId,
    blockingDigest: decision.blockingDigest,
    overlapDigest: decision.overlapDigest,
    overlapManifestKind: decision.overlapManifestKind
  };
}

function _listAffectedManifests(
  plan: DeletePlan,
  fullyDeletableRootDigests: string[]
): CleanupSummaryAffectedManifest[] {
  const fullyDeletableRootDigestSet = new Set(fullyDeletableRootDigests);
  const manifestsByDigest = new Map<string, CleanupSummaryAffectedManifest>();

  for (const manifest of plan.closureManifests) {
    if (!fullyDeletableRootDigestSet.has(manifest.sourceDigest)) {
      continue;
    }

    manifestsByDigest.set(manifest.memberDigest, {
      digest: manifest.memberDigest,
      manifestKind: manifest.memberManifestKind as ManifestKind | undefined
    });
  }

  return [...manifestsByDigest.values()].sort((left, right) => left.digest.localeCompare(right.digest));
}
