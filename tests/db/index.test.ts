import assert from "node:assert/strict";
import test from "node:test";
import {
  CleanupRunWriter,
  DbMergeRepository,
  PlannerRepository,
  SnapshotRepository,
  openDatabase
} from "../../src/db/index.js";

test("db index opens a database and re-exports repositories", () => {
  const database = openDatabase(":memory:");
  const cleanupRunWriter = new CleanupRunWriter(database);
  const dbMergeRepository = new DbMergeRepository(database);
  const plannerRepository = new PlannerRepository(database);
  const repository = new SnapshotRepository(database);

  assert.ok(cleanupRunWriter);
  assert.ok(dbMergeRepository);
  assert.ok(plannerRepository);
  assert.ok(repository);
  database.close();
});
