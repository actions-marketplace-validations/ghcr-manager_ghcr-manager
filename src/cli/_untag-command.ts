import { listPackageVersionTagSources, untagRootTags, type UntagTagOperation } from "../execute/index.js";
import { collectRepeatedOption, hasFlag, requireOption, resolveGitHubToken, resolveLogLevel } from "./_args.js";
import { createLogger } from "./_logger.js";

interface _UntagRootSelection {
  versionId: number;
  digest: string;
  tags: string[];
}

interface _UntagSummary {
  owner: string;
  packageName: string;
  requestedTags: string[];
  dryRun: boolean;
  roots: _UntagRootSelection[];
  untaggedTags: UntagTagOperation[];
}

export async function handleUntag(args: string[]): Promise<number> {
  const owner = requireOption(args, "--owner");
  const packageName = requireOption(args, "--package");
  const requestedTags = [...new Set(collectRepeatedOption(args, "--tag"))];
  if (requestedTags.length === 0) {
    throw new Error("missing required option: --tag");
  }

  const token = resolveGitHubToken(args);
  const dryRun = hasFlag(args, "--dry-run");
  const logger = createLogger(resolveLogLevel(args));
  const tagSources = await listPackageVersionTagSources(owner, packageName, requestedTags, token, logger);
  const matchedTags = new Set(tagSources.map((tagSource) => tagSource.tag));
  const missingTags = requestedTags.filter((tag) => !matchedTags.has(tag));
  if (missingTags.length > 0) {
    throw new Error(`could not resolve tag(s): ${missingTags.join(", ")}`);
  }

  const roots = _groupTagSources(tagSources);
  const untaggedTags: UntagTagOperation[] = [];
  if (!dryRun) {
    for (const root of roots) {
      untaggedTags.push(
        ...(await untagRootTags(owner, packageName, root.versionId, root.digest, root.tags, {
          token,
          logger
        }))
      );
    }
  }

  const summary: _UntagSummary = {
    owner,
    packageName,
    requestedTags,
    dryRun,
    roots,
    untaggedTags
  };
  console.log(JSON.stringify(summary, null, 2));
  return 0;
}

function _groupTagSources(
  tagSources: Array<{ tag: string; sourceVersionId: number; sourceDigest: string }>
): _UntagRootSelection[] {
  const groups = new Map<string, _UntagRootSelection>();
  for (const tagSource of tagSources) {
    const key = `${tagSource.sourceVersionId}:${tagSource.sourceDigest}`;
    const existing = groups.get(key);
    if (existing) {
      existing.tags.push(tagSource.tag);
      continue;
    }

    groups.set(key, {
      versionId: tagSource.sourceVersionId,
      digest: tagSource.sourceDigest,
      tags: [tagSource.tag]
    });
  }

  return [...groups.values()];
}
