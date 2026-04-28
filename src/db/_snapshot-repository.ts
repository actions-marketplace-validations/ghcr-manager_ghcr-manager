import type Database from "better-sqlite3";
import type { PackageSnapshot, PlanSummary } from "../core/index.js";
import { writeSnapshot } from "./_write-snapshot.js";

interface _ScanRow {
  package_name: string;
  scanned_at: string;
}

interface _VersionRow {
  version_id: number;
  digest: string;
  created_at: string;
}

export class SnapshotRepository {
  readonly #database: Database.Database;

  constructor(database: Database.Database) {
    this.#database = database;
  }

  replaceSnapshot(snapshot: PackageSnapshot): void {
    writeSnapshot(this.#database, snapshot);
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
    return _getDigestSet(
      this.#database.prepare("SELECT DISTINCT digest FROM tags").all() as Array<{ digest: string }>,
      "digest",
    );
  }

  getDigestsForTags(tags: string[]): Set<string> {
    if (tags.length === 0) {
      return new Set();
    }

    const placeholders = tags.map(() => "?").join(", ");
    const rows = this.#database
      .prepare(`SELECT DISTINCT digest FROM tags WHERE tag IN (${placeholders})`)
      .all(...tags) as Array<{ digest: string }>;
    return _getDigestSet(rows, "digest");
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
    return _count(this.#database, "SELECT COUNT(*) AS total FROM package_versions", "total");
  }

  countTaggedVersions(): number {
    return _count(this.#database, "SELECT COUNT(DISTINCT version_id) AS total FROM tags", "total");
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
}

function _getDigestSet(rows: Array<Record<string, string>>, key: string): Set<string> {
  return new Set(rows.map((row) => row[key] as string));
}

function _count(database: Database.Database, sql: string, field: string): number {
  const row = database.prepare(sql).get() as Record<string, number>;
  return row[field] as number;
}
