import assert from "node:assert/strict";
import test from "node:test";
import { SnapshotRepository, openDatabase } from "../../src/db/index.js";

test("db index opens a database and re-exports SnapshotRepository", () => {
  const database = openDatabase(":memory:");
  const repository = new SnapshotRepository(database);

  assert.ok(repository);
  database.close();
});
