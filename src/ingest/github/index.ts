import { ScanWriter, SnapshotRepository } from "../../db/index.js";
import type { ManifestEdgeRecord } from "../../core/index.js";
import { loadManifestGraph } from "./_manifest-client.js";
import { ingestPackageVersions } from "./_packages-client.js";
import { defaultFetch, type GitHubScanOptions } from "./_shared.js";

export { type GitHubScanOptions } from "./_shared.js";

export async function importGitHubScan(
  options: GitHubScanOptions,
  writer: ScanWriter,
  repository: SnapshotRepository,
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? defaultFetch;
  const githubApiBaseUrl = options.githubApiBaseUrl ?? "https://api.github.com";
  const registryBaseUrl = options.registryBaseUrl ?? "https://ghcr.io";
  const scannedAt = new Date().toISOString();
  const packageName = `${options.owner}/${options.packageName}`;
  const logger = options.logger;

  writer.resetScan(packageName, scannedAt);
  logger?.info(`Starting GitHub package scan for ${packageName}`);

  const counts = await ingestPackageVersions(fetchImpl, githubApiBaseUrl, options, writer);
  logger?.info(`Loaded ${counts.packageVersions} package versions and ${counts.tags} tags`);

  const digests = repository.listPackageVersionDigests();
  logger?.info(`Fetching manifests for ${digests.length} package versions`);
  let completed = 0;
  const edgeRecords: ManifestEdgeRecord[] = [];
  for (const digest of digests) {
    logger?.debug(`Fetching manifest ${completed + 1}/${digests.length}: ${digest}`);
    const manifest = await loadManifestGraph(fetchImpl, registryBaseUrl, digest, options);
    writer.insertManifest(manifest.record);
    for (const child of manifest.childRecords) {
      writer.insertManifest(child);
    }
    edgeRecords.push(...manifest.edgeRecords);
    completed += 1;
    if (completed === digests.length || completed % 25 === 0) {
      logger?.info(`Fetched manifests ${completed}/${digests.length}`);
    }
  }
  for (const edge of edgeRecords) {
    writer.insertManifestEdge(edge);
  }
  logger?.info(`Completed GitHub package scan for ${packageName}`);
}
