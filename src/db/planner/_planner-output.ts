import type {
  DeletePlan,
  DeletePlanBlockedRoot,
  DeletePlanProtectedRoot,
  DeletePlanRoot,
  DeletePlanRootDecision,
  PlanArtifacts
} from "./_planner-types.js";
import { DeletePlanValidationReasonCodes, DeletePlanValidationStatuses } from "./_planner-types.js";

export function buildPlanOutputs(
  directTargetTags: string[],
  directTargetRoots: DeletePlanRoot[],
  planArtifacts: PlanArtifacts
): Pick<
  DeletePlan,
  | "directTargetTags"
  | "directTargetRoots"
  | "rootDecisions"
  | "protectedRoots"
  | "closureManifests"
  | "blockedRoots"
  | "fullyDeletableRoots"
  | "collateralTags"
> {
  const rootDecisions = buildRootDecisions(directTargetRoots, planArtifacts);
  const protectedRoots = buildProtectedRoots(planArtifacts.blockedRoots);

  return {
    directTargetTags,
    directTargetRoots,
    rootDecisions,
    protectedRoots,
    closureManifests: planArtifacts.closureManifests,
    blockedRoots: planArtifacts.blockedRoots,
    fullyDeletableRoots: planArtifacts.fullyDeletableRoots,
    collateralTags: []
  };
}

export function buildRootDecisions(
  directTargetRoots: DeletePlanRoot[],
  planArtifacts: PlanArtifacts
): DeletePlanRootDecision[] {
  const fullyDeletableDigests = new Set(planArtifacts.fullyDeletableRoots.map((root) => root.digest));
  const blockedRootByDigest = new Map<string, DeletePlanBlockedRoot>();
  for (const blockedRoot of planArtifacts.blockedRoots) {
    if (!blockedRootByDigest.has(blockedRoot.blockedDigest)) {
      blockedRootByDigest.set(blockedRoot.blockedDigest, blockedRoot);
    }
  }

  return directTargetRoots.map((root) => {
    if (root.selectionMode === "untag-only") {
      return {
        versionId: root.versionId,
        digest: root.digest,
        manifestKind: root.manifestKind,
        selectionMode: root.selectionMode,
        selectionReason: root.reason,
        validationStatus: DeletePlanValidationStatuses.untagOnly,
        validationReasonCode: DeletePlanValidationReasonCodes.untagOnlyPartialTagMatch,
        validationReason:
          "matched tags cover only part of this root's tag set, so the version is retained and only those tags can be detached"
      };
    }

    if (fullyDeletableDigests.has(root.digest)) {
      return {
        versionId: root.versionId,
        digest: root.digest,
        manifestKind: root.manifestKind,
        selectionMode: root.selectionMode,
        selectionReason: root.reason,
        validationStatus: DeletePlanValidationStatuses.fullyDeletable,
        validationReasonCode: DeletePlanValidationReasonCodes.fullyDeletableNoRetainedOverlap,
        validationReason:
          "selected tags cover the whole root and its manifest closure does not overlap any retained root"
      };
    }

    const blockedRoot = blockedRootByDigest.get(root.digest);
    return {
      versionId: root.versionId,
      digest: root.digest,
      manifestKind: root.manifestKind,
      selectionMode: root.selectionMode,
      selectionReason: root.reason,
      validationStatus: DeletePlanValidationStatuses.blocked,
      validationReasonCode: DeletePlanValidationReasonCodes.blockedOverlapWithRetainedRoot,
      validationReason: buildBlockedValidationReason(blockedRoot),
      blockingVersionId: blockedRoot?.blockingVersionId,
      blockingDigest: blockedRoot?.blockingDigest,
      overlapDigest: blockedRoot?.overlapDigest,
      overlapManifestKind: blockedRoot?.overlapManifestKind
    };
  });
}

export function buildProtectedRoots(blockedRoots: DeletePlanBlockedRoot[]): DeletePlanProtectedRoot[] {
  const protectedRoots = new Map<string, DeletePlanProtectedRoot>();
  for (const blockedRoot of blockedRoots) {
    const key = `${blockedRoot.blockingVersionId}:${blockedRoot.blockingDigest}`;
    const current = protectedRoots.get(key) ?? {
      versionId: blockedRoot.blockingVersionId,
      digest: blockedRoot.blockingDigest,
      blocks: []
    };
    current.blocks.push({
      blockedVersionId: blockedRoot.blockedVersionId,
      blockedDigest: blockedRoot.blockedDigest,
      blockReasonCode: blockedRoot.reason,
      overlapDigest: blockedRoot.overlapDigest,
      overlapManifestKind: blockedRoot.overlapManifestKind
    });
    protectedRoots.set(key, current);
  }

  return [...protectedRoots.values()].sort((left, right) => left.digest.localeCompare(right.digest));
}

export function buildBlockedValidationReason(blockedRoot?: DeletePlanBlockedRoot): string {
  if (!blockedRoot) {
    return "root closure overlaps manifest members still required by a retained root";
  }

  return `blocked because retained root ${blockedRoot.blockingDigest} still requires shared manifest ${blockedRoot.overlapDigest}`;
}
