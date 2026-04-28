import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { initializeSchema } from "../../src/db/_schema.js";

test("initializeSchema is idempotent", () => {
  const database = new Database(":memory:");
  initializeSchema(database);
  assert.doesNotThrow(() => initializeSchema(database));

  database.close();
});
