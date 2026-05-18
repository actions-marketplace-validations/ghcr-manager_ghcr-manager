import assert from "node:assert/strict";
import test from "node:test";
import { resolveCleanupHistoryRelation } from "../../src/db/_db-merge-history.js";

test("db merge history detects source-ahead, target-ahead, and diverged cleanup sequences", () => {
  assert.equal(resolveCleanupHistoryRelation(["a", "b"], ["a"]), "source-ahead");
  assert.equal(resolveCleanupHistoryRelation(["a"], ["a", "b"]), "target-ahead");
  assert.equal(resolveCleanupHistoryRelation(["a", "c"], ["a", "b"]), "diverged");
});
