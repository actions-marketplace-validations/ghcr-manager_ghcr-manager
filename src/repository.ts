import type Database from "better-sqlite3";
import type { ManifestEdgeRecord, ManifestRecord, PackageSnapshot, PlanSummary } from "./types.js";

interface _ScanRow {
  package_name: string;
  scanned_at: string;
}

interface _VersionRow {
  version_id: number;
  digest: string;
  created_at: string;
}

interface _TaggedCountRow {
  tagged_versions: number;
}

export class Repository {
  readonly #database: Database.Database;

  constructor(database: Database.Database) {
    this.#database = database;
  }

  replaceSnapshot(snapshot: PackageSnapshot): void {
    const insertSnapshot = this.#database.transaction((input: PackageSnapshot) => {
      this.#database.exec(`
        DELETE FROM package_scans;
        DELETE FROM tags;
        DELETE FROM manifest_edges;
        DELETE FROM manifests;
        DELETE FROM package_versions;
      `);

      this.#database
        .prepare("INSERT INTO package_scans(package_name, scanned_at) VALUES(?, ?)")
        .run(input.packageName, input.scannedAt);

      const insertVersion = this.#database.prepare(`
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

      const insertTag = this.#database.prepare(`
        INSERT INTO tags(tag, digest, version_id)
        VALUES(@tag, @digest, @versionId)
      `);
      for (const tag of input.tags) {
        insertTag.run(tag);
      }

      const insertManifest = this.#database.prepare(`
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
        this.#insertManifest(insertManifest, manifest);
      }

      const insertEdge = this.#database.prepare(`
        INSERT INTO manifest_edges(parent_digest, child_digest, edge_kind)
        VALUES(@parentDigest, @childDigest, @edgeKind)
      `);
      for (const edge of input.manifestEdges) {
        this.#insertEdge(insertEdge, edge);
      }
    });

    insertSnapshot(snapshot);
  }

  getPackageMetadata(): { packageName: string; scannedAt: string } {
    const row = this.#database.prepare("SELECT package_name, scanned_at FROM package_scans LIMIT 1").get() as
      | _ScanRow
      | undefined;
    if (!row) {
      throw new Error("database does not contain a package scan");
    }

    return {
      packageName: row.package_name,
      scannedAt: row.scanned_at,
    };
  }

  getTaggedDigests(): Set<string> {
    const rows = this.#database.prepare("SELECT DISTINCT digest FROM tags").all() as Array<{ digest: string }>;
    return new Set(rows.map((row) => row.digest));
  }

  getDigestsForTags(tags: string[]): Set<string> {
    if (tags.length === 0) {
      return new Set();
    }

    const placeholders = tags.map(() => "?").join(", ");
    const rows = this.#database
      .prepare(`SELECT DISTINCT digest FROM tags WHERE tag IN (${placeholders})`)
      .all(...tags) as Array<{ digest: string }>;
    return new Set(rows.map((row) => row.digest));
  }

  getChildDigests(parentDigests: Iterable<string>): string[] {
    const digestList = [...parentDigests];
    if (digestList.length === 0) {
      return [];
    }

    const placeholders = digestList.map(() => "?").join(", ");
    const rows = this.#database
      .prepare(`SELECT child_digest FROM manifest_edges WHERE parent_digest IN (${placeholders})`)
      .all(...digestList) as Array<{ child_digest: string }>;
    return rows.map((row) => row.child_digest);
  }

  getVersionsCreatedBefore(cutoffTimestamp: string): Array<{ versionId: number; digest: string }> {
    const rows = this.#database
      .prepare(
        `
        SELECT version_id, digest
        FROM package_versions
        WHERE created_at < ?
        ORDER BY version_id
      `,
      )
      .all(cutoffTimestamp) as _VersionRow[];

    return rows.map((row) => ({
      versionId: row.version_id,
      digest: row.digest,
    }));
  }

  getTaggedVersionIds(): number[] {
    const rows = this.#database.prepare("SELECT DISTINCT version_id FROM tags ORDER BY version_id").all() as Array<{
      version_id: number;
    }>;
    return rows.map((row) => row.version_id);
  }

  countPackageVersions(): number {
    const row = this.#database.prepare("SELECT COUNT(*) AS total FROM package_versions").get() as { total: number };
    return row.total;
  }

  countTaggedVersions(): number {
    const row = this.#database
      .prepare("SELECT COUNT(DISTINCT version_id) AS tagged_versions FROM tags")
      .get() as _TaggedCountRow;
    return row.tagged_versions;
  }

  buildPlanSummary(protectedVersionIds: number[], deletableVersionIds: number[]): PlanSummary {
    const metadata = this.getPackageMetadata();
    return {
      packageName: metadata.packageName,
      scannedAt: metadata.scannedAt,
      totalPackageVersions: this.countPackageVersions(),
      totalTaggedVersions: this.countTaggedVersions(),
      protectedVersionIds: [...protectedVersionIds].sort((left, right) => left - right),
      deletableVersionIds: [...deletableVersionIds].sort((left, right) => left - right),
    };
  }

  #insertManifest(statement: Database.Statement, manifest: ManifestRecord): void {
    statement.run({
      digest: manifest.digest,
      mediaType: manifest.mediaType,
      artifactType: manifest.artifactType ?? null,
      platformOs: manifest.platform?.os ?? null,
      platformArchitecture: manifest.platform?.architecture ?? null,
      platformVariant: manifest.platform?.variant ?? null,
    });
  }

  #insertEdge(statement: Database.Statement, edge: ManifestEdgeRecord): void {
    statement.run(edge);
  }
}
