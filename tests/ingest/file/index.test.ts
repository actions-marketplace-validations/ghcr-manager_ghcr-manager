import assert from "node:assert/strict";
import test from "node:test";
import { loadSnapshotFromFile } from "../../../src/ingest/file/index.js";

test("file ingest loads a snapshot fixture", async () => {
  const snapshot = await loadSnapshotFromFile("tests/fixtures/sample-package.json");
  assert.equal(snapshot.packageName, "acme/example");
});
