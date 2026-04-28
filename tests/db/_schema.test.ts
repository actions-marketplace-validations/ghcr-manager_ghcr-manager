import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { initializeSchema } from "../../src/db/_schema.js";

test("initializeSchema creates expected tables", () => {
  const database = new Database(":memory:");
  initializeSchema(database);

  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{
    name: string;
  }>;

  assert.deepEqual(
    tables.map((row) => row.name),
    ["manifest_edges", "manifests", "package_scans", "package_versions", "tags"],
  );

  database.close();
});
