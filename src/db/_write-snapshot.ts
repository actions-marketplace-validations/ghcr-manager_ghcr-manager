import type Database from "better-sqlite3";
import type { ManifestEdgeRecord, ManifestRecord, PackageSnapshot } from "../core/index.js";

export function writeSnapshot(database: Database.Database, snapshot: PackageSnapshot): void {
  const insertSnapshot = database.transaction((input: PackageSnapshot) => {
    database.exec(`
      DELETE FROM package_scans;
      DELETE FROM tags;
      DELETE FROM manifest_edges;
      DELETE FROM manifests;
      DELETE FROM package_versions;
    `);

    database
      .prepare("INSERT INTO package_scans(package_name, scanned_at) VALUES(?, ?)")
      .run(input.packageName, input.scannedAt);

    const insertVersion = database.prepare(`
      INSERT INTO package_versions(version_id, digest, created_at, updated_at, metadata_json)
      VALUES(@versionId, @digest, @createdAt, @updatedAt, @metadataJson)
    `);
    for (const version of input.packageVersions) {
      insertVersion.run({
        versionId: version.versionId,
        digest: version.digest,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        metadataJson: JSON.stringify(version.metadata ?? {}),
      });
    }

    const insertTag = database.prepare(`
      INSERT INTO tags(tag, digest, version_id)
      VALUES(@tag, @digest, @versionId)
    `);
    for (const tag of input.tags) {
      insertTag.run(tag);
    }

    const insertManifest = database.prepare(`
      INSERT INTO manifests(
        digest,
        media_type,
        artifact_type,
        platform_os,
        platform_architecture,
        platform_variant
      )
      VALUES(
        @digest,
        @mediaType,
        @artifactType,
        @platformOs,
        @platformArchitecture,
        @platformVariant
      )
    `);
    for (const manifest of input.manifests) {
      _insertManifest(insertManifest, manifest);
    }

    const insertEdge = database.prepare(`
      INSERT INTO manifest_edges(parent_digest, child_digest, edge_kind)
      VALUES(@parentDigest, @childDigest, @edgeKind)
    `);
    for (const edge of input.manifestEdges) {
      _insertEdge(insertEdge, edge);
    }
  });

  insertSnapshot(snapshot);
}

function _insertManifest(statement: Database.Statement, manifest: ManifestRecord): void {
  statement.run({
    digest: manifest.digest,
    mediaType: manifest.mediaType,
    artifactType: manifest.artifactType ?? null,
    platformOs: manifest.platform?.os ?? null,
    platformArchitecture: manifest.platform?.architecture ?? null,
    platformVariant: manifest.platform?.variant ?? null,
  });
}

function _insertEdge(statement: Database.Statement, edge: ManifestEdgeRecord): void {
  statement.run(edge);
}
