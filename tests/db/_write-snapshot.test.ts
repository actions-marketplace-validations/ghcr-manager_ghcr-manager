import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "../../src/db/index.js";
import { writeSnapshot } from "../../src/db/_write-snapshot.js";
import { loadSnapshotFromFile } from "../../src/ingest/file/index.js";

test("writeSnapshot stores snapshot rows directly", async () => {
  const database = openDatabase(":memory:");

  writeSnapshot(database, await loadSnapshotFromFile("tests/fixtures/sample-package.json"));

  const versionCount = database.prepare("SELECT COUNT(*) AS total FROM package_versions").get() as { total: number };
  assert.equal(versionCount.total, 5);

  database.close();
});
