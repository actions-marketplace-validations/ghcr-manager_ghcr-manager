import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase, ScanWriter, SnapshotRepository } from "../../../src/db/index.js";
import { importFileScan } from "../../../src/ingest/file/index.js";

test("file ingest writes fixture data directly into SQLite", async () => {
  const database = openDatabase(":memory:");
  const repository = new SnapshotRepository(database);

  await importFileScan("tests/fixtures/sample-package.json", new ScanWriter(database));

  assert.equal(repository.getPackageMetadata().packageName, "acme/example");
  assert.equal(repository.countPackageVersions(), 5);
  assert.equal(repository.countManifestEdges(), 2);

  database.close();
});
