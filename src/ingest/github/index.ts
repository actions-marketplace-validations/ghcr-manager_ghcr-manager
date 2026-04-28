import { ScanWriter, SnapshotRepository } from "../../db/index.js";
import { loadManifestGraph } from "./_manifest-client.js";
import { buildTags, loadPackageVersions } from "./_packages-client.js";
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

  writer.resetScan(packageName, scannedAt);

  const packageVersions = await loadPackageVersions(fetchImpl, githubApiBaseUrl, options);
  for (const version of packageVersions) {
    writer.insertPackageVersion(version);
  }
  for (const tag of buildTags(packageVersions)) {
    writer.insertTag(tag);
  }

  for (const digest of repository.listPackageVersionDigests()) {
    const manifest = await loadManifestGraph(fetchImpl, registryBaseUrl, digest, options);
    writer.insertManifest(manifest.record);
    for (const child of manifest.childRecords) {
      writer.insertManifest(child);
    }
    for (const edge of manifest.edgeRecords) {
      writer.insertManifestEdge(edge);
    }
  }
}
