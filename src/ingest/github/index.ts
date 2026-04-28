import type { ManifestEdgeRecord, ManifestRecord, PackageSnapshot } from "../../core/index.js";
import { buildTags, loadPackageVersions } from "./_packages-client.js";
import { loadManifestGraph } from "./_manifest-client.js";
import { defaultFetch, type GitHubScanOptions } from "./_shared.js";

export { type GitHubScanOptions } from "./_shared.js";

export async function loadSnapshotFromGitHub(options: GitHubScanOptions): Promise<PackageSnapshot> {
  const fetchImpl = options.fetchImpl ?? defaultFetch;
  const githubApiBaseUrl = options.githubApiBaseUrl ?? "https://api.github.com";
  const registryBaseUrl = options.registryBaseUrl ?? "https://ghcr.io";
  const scannedAt = new Date().toISOString();
  const packageVersions = await loadPackageVersions(fetchImpl, githubApiBaseUrl, options);
  const tags = buildTags(packageVersions);

  const manifestsByDigest = new Map<string, ManifestRecord>();
  const edges: ManifestEdgeRecord[] = [];
  for (const version of packageVersions) {
    const manifest = await loadManifestGraph(fetchImpl, registryBaseUrl, version.digest, options);
    manifestsByDigest.set(version.digest, manifest.record);
    for (const child of manifest.childRecords) {
      manifestsByDigest.set(child.digest, child);
    }
    edges.push(...manifest.edgeRecords);
  }

  return {
    packageName: `${options.owner}/${options.packageName}`,
    scannedAt,
    packageVersions,
    tags,
    manifests: [...manifestsByDigest.values()].sort((left, right) => left.digest.localeCompare(right.digest)),
    manifestEdges: _deduplicateEdges(edges),
  };
}

function _deduplicateEdges(edges: ManifestEdgeRecord[]): ManifestEdgeRecord[] {
  const keyedEdges = new Map<string, ManifestEdgeRecord>();
  for (const edge of edges) {
    const key = `${edge.parentDigest} ${edge.childDigest} ${edge.edgeKind}`;
    keyedEdges.set(key, edge);
  }

  return [...keyedEdges.values()].sort((left, right) => {
    const leftKey = `${left.parentDigest} ${left.childDigest} ${left.edgeKind}`;
    const rightKey = `${right.parentDigest} ${right.childDigest} ${right.edgeKind}`;
    return leftKey.localeCompare(rightKey);
  });
}
