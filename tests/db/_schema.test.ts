import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { initializeSchema } from "../../src/db/_schema.js";

test("initializeSchema runs without crashing", () => {
  const database = new Database(":memory:");
  assert.doesNotThrow(() => initializeSchema(database));

  database.close();
});
