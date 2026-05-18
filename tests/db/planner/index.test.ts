import assert from "node:assert/strict";
import test from "node:test";
import { PlannerRepository } from "../../../src/db/index.js";
import { openDatabase } from "../../../src/db/index.js";

test("planner index re-exports the planner repository", () => {
  const database = openDatabase(":memory:");
  const repository = new PlannerRepository(database);

  assert.ok(repository);

  database.close();
});
