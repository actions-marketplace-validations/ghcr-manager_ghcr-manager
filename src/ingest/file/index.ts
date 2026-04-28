import { readFile } from "node:fs/promises";
import type { ManifestEdgeRecord, ManifestRecord, PackageVersionRecord, TagRecord } from "../../core/index.js";
import { ScanWriter } from "../../db/index.js";

interface _FixtureScanDocument {
  packageName: string;
  scannedAt: string;
  packageVersions: PackageVersionRecord[];
  tags: TagRecord[];
  manifests: ManifestRecord[];
  manifestEdges: ManifestEdgeRecord[];
}

export async function importFileScan(snapshotPath: string, writer: ScanWriter): Promise<void> {
  const rawSnapshot = await readFile(snapshotPath, "utf8");
  const document = JSON.parse(rawSnapshot) as _FixtureScanDocument;

  writer.resetScan(document.packageName, document.scannedAt);
  for (const version of document.packageVersions) {
    writer.insertPackageVersion(version);
  }
  for (const tag of document.tags) {
    writer.insertTag(tag);
  }
  for (const manifest of document.manifests) {
    writer.insertManifest(manifest);
  }
  for (const edge of document.manifestEdges) {
    writer.insertManifestEdge(edge);
  }
}
