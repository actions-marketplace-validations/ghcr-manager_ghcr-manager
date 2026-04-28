import type { Repository } from "./repository.js";
import type { PlanOptions, PlanSummary } from "./types.js";

export function buildPlanSummary(repository: Repository, options: PlanOptions): PlanSummary {
  const protectedDigests = _collectProtectedDigests(repository, options.excludeTags);
  const protectedVersionIds = new Set<number>();
  const deletableVersionIds = new Set<number>();
  const cutoffTimestamp = _buildCutoffTimestamp(options.olderThanDays);
  const taggedVersionIds = new Set(repository.getTaggedVersionIds());

  for (const version of repository.getVersionsCreatedBefore(cutoffTimestamp)) {
    const isTagged = taggedVersionIds.has(version.versionId);
    const isProtected = protectedDigests.has(version.digest);

    if (isProtected || (!options.deleteUntagged && isTagged)) {
      protectedVersionIds.add(version.versionId);
      continue;
    }

    if (options.deleteUntagged && isTagged) {
      protectedVersionIds.add(version.versionId);
      continue;
    }

    deletableVersionIds.add(version.versionId);
  }

  for (const versionId of taggedVersionIds) {
    protectedVersionIds.add(versionId);
    deletableVersionIds.delete(versionId);
  }

  return repository.buildPlanSummary([...protectedVersionIds], [...deletableVersionIds]);
}

function _collectProtectedDigests(repository: Repository, excludeTags: string[]): Set<string> {
  const protectedDigests = repository.getTaggedDigests();
  for (const digest of repository.getDigestsForTags(excludeTags)) {
    protectedDigests.add(digest);
  }

  const queue = [...protectedDigests];
  while (queue.length > 0) {
    const currentDigest = queue.shift();
    if (!currentDigest) {
      continue;
    }

    for (const childDigest of repository.getChildDigests([currentDigest])) {
      if (protectedDigests.has(childDigest)) {
        continue;
      }

      protectedDigests.add(childDigest);
      queue.push(childDigest);
    }
  }

  return protectedDigests;
}

function _buildCutoffTimestamp(olderThanDays: number): string {
  const currentTimestamp = Date.now();
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return new Date(currentTimestamp - olderThanDays * millisecondsPerDay).toISOString();
}
