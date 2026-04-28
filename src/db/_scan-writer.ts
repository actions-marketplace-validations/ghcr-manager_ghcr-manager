import type Database from "better-sqlite3";
import type { ManifestEdgeRecord, ManifestRecord, PackageVersionRecord, TagRecord } from "../core/index.js";

export class ScanWriter {
  readonly #database: Database.Database;

  constructor(database: Database.Database) {
    this.#database = database;
  }

  resetScan(packageName: string, scannedAt: string): void {
    this.#database.exec(`
      DELETE FROM package_scans;
      DELETE FROM tags;
      DELETE FROM manifest_edges;
      DELETE FROM manifests;
      DELETE FROM package_versions;
    `);

    this.#database
      .prepare("INSERT INTO package_scans(package_name, scanned_at) VALUES(?, ?)")
      .run(packageName, scannedAt);
  }

  insertPackageVersion(version: PackageVersionRecord): void {
    this.#database
      .prepare(
        `
        INSERT OR REPLACE INTO package_versions(version_id, digest, created_at, updated_at, metadata_json)
        VALUES(@versionId, @digest, @createdAt, @updatedAt, @metadataJson)
      `,
      )
      .run({
        versionId: version.versionId,
        digest: version.digest,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        metadataJson: JSON.stringify(version.metadata ?? {}),
      });
  }

  insertTag(tag: TagRecord): void {
    this.#database
      .prepare(
        `
        INSERT OR REPLACE INTO tags(tag, digest, version_id)
        VALUES(@tag, @digest, @versionId)
      `,
      )
      .run(tag);
  }

  insertManifest(manifest: ManifestRecord): void {
    this.#database
      .prepare(
        `
        INSERT OR REPLACE INTO manifests(
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
      `,
      )
      .run({
        digest: manifest.digest,
        mediaType: manifest.mediaType,
        artifactType: manifest.artifactType ?? null,
        platformOs: manifest.platform?.os ?? null,
        platformArchitecture: manifest.platform?.architecture ?? null,
        platformVariant: manifest.platform?.variant ?? null,
      });
  }

  insertManifestEdge(edge: ManifestEdgeRecord): void {
    this.#database
      .prepare(
        `
        INSERT OR IGNORE INTO manifest_edges(parent_digest, child_digest, edge_kind)
        VALUES(@parentDigest, @childDigest, @edgeKind)
      `,
      )
      .run(edge);
  }
}
