import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase, ScanWriter, SnapshotRepository } from "../../../src/db/index.js";
import { importFileScan } from "../../helpers/index.js";

test("file ingest writes fixture data directly into SQLite", async () => {
  const database = openDatabase(":memory:");
  const repository = new SnapshotRepository(database);

  await importFileScan("tests/fixtures/sample-package.json", new ScanWriter(database));

  assert.equal(repository.getPackageMetadata().packageName, "acme/example");
  assert.equal(repository.countPackageVersions(), 5);
  assert.equal(repository.countManifestEdges(), 2);
  assert.equal(
    (database.prepare("SELECT COUNT(*) AS total FROM manifest_reachability").get() as { total: number }).total,
    7,
  );

  database.close();
});
