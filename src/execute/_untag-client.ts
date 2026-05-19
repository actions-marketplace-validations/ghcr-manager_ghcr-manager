import { buildDetachedManifestClone } from "./_manifest-detach.js";
import { findPackageVersionByDigestAndTag } from "./_package-version-page-client.js";
import { listPackageVersionTagSources, listPresentPackageVersionIds } from "./_package-version-tag-source-client.js";
import { deletePackageVersion } from "./_package-version-delete-client.js";
import { loadRegistryManifestByDigest, putRegistryManifestForTag } from "./_registry-manifest-client.js";
import { loadRegistryPushToken } from "./_registry-token-client.js";
import type { DeleteExecutionOptions, UntagTagOperation } from "./_types.js";

export async function untagRootTags(
  owner: string,
  packageName: string,
  sourceVersionId: number,
  sourceDigest: string,
  tags: string[],
  options: DeleteExecutionOptions
): Promise<UntagTagOperation[]> {
  const registryToken = await loadRegistryPushToken(owner, packageName, options.token, options.logger, {
    fetchImpl: options.fetchImpl
  });
  const sourceManifest = await loadRegistryManifestByDigest(
    owner,
    packageName,
    sourceDigest,
    registryToken,
    options.logger,
    {
      fetchImpl: options.fetchImpl
    }
  );

  const operations: UntagTagOperation[] = [];
  for (const tag of tags) {
    options.logger.info(`Detaching tag ${owner}/${packageName}:${tag} from ${sourceDigest}`);
    const detachedManifestJson = buildDetachedManifestClone(sourceManifest.rawJson, sourceManifest.mediaType, {
      detachedTag: tag,
      sourceDigest
    });
    const detachedDigest = await putRegistryManifestForTag(
      owner,
      packageName,
      tag,
      sourceManifest.mediaType,
      detachedManifestJson,
      registryToken,
      options.logger,
      {
        fetchImpl: options.fetchImpl
      }
    );
    const detachedVersionId = await findPackageVersionByDigestAndTag(
      owner,
      packageName,
      detachedDigest,
      tag,
      options.token,
      options.logger,
      {
        fetchImpl: options.fetchImpl
      }
    );
    await deletePackageVersion(owner, packageName, detachedVersionId, options.token, options.logger, {
      fetchImpl: options.fetchImpl
    });
    await _assertTagRemoved(owner, packageName, tag, options);
    await _assertVersionRemoved(owner, packageName, detachedVersionId, options);
    operations.push({
      tag,
      sourceVersionId,
      sourceDigest,
      detachedVersionId,
      detachedDigest
    });
  }

  return operations;
}

async function _assertTagRemoved(
  owner: string,
  packageName: string,
  tag: string,
  options: DeleteExecutionOptions
): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const remaining = await listPackageVersionTagSources(owner, packageName, [tag], options.token, options.logger, {
      fetchImpl: options.fetchImpl
    });
    if (remaining.length === 0) {
      return;
    }

    if (attempt < 5) {
      options.logger.warn(
        `Tag ${owner}/${packageName}:${tag} is still visible after untag; retrying check ${attempt}/5`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`tag ${owner}/${packageName}:${tag} is still visible after untag`);
}

async function _assertVersionRemoved(
  owner: string,
  packageName: string,
  versionId: number,
  options: DeleteExecutionOptions
): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const presentVersionIds = await listPresentPackageVersionIds(
      owner,
      packageName,
      [versionId],
      options.token,
      options.logger,
      {
        fetchImpl: options.fetchImpl
      }
    );
    if (presentVersionIds.length === 0) {
      return;
    }

    if (attempt < 5) {
      options.logger.warn(
        `Temporary package version ${owner}/${packageName}#${versionId} is still visible after untag; retrying check ${attempt}/5`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`temporary package version ${owner}/${packageName}#${versionId} is still visible after untag`);
}
