import type Database from "better-sqlite3";

const _schemaStatements = [
  `
    CREATE TABLE IF NOT EXISTS package_scans (
      package_name TEXT NOT NULL,
      scanned_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS package_versions (
      version_id INTEGER PRIMARY KEY,
      digest TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      metadata_json TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS tags (
      tag TEXT PRIMARY KEY,
      digest TEXT NOT NULL,
      version_id INTEGER NOT NULL,
      FOREIGN KEY(version_id) REFERENCES package_versions(version_id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS manifests (
      digest TEXT PRIMARY KEY,
      media_type TEXT NOT NULL,
      artifact_type TEXT,
      platform_os TEXT,
      platform_architecture TEXT,
      platform_variant TEXT
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS manifest_edges (
      parent_digest TEXT NOT NULL,
      child_digest TEXT NOT NULL,
      edge_kind TEXT NOT NULL,
      PRIMARY KEY(parent_digest, child_digest, edge_kind)
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_package_versions_created_at ON package_versions(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_tags_digest ON tags(digest)`,
  `CREATE INDEX IF NOT EXISTS idx_manifest_edges_parent ON manifest_edges(parent_digest)`,
  `CREATE INDEX IF NOT EXISTS idx_manifest_edges_child ON manifest_edges(child_digest)`
];

export function initializeSchema(database: Database.Database): void {
  for (const statement of _schemaStatements) {
    database.exec(statement);
  }
}
