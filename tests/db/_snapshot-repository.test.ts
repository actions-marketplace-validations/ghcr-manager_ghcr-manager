import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SnapshotRepository, openDatabase } from "../../src/db/index.js";
import { loadSnapshotFromFile } from "../../src/ingest/file/index.js";

test("snapshot repository exposes counts and metadata after import", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");

  try {
    const database = openDatabase(databasePath);
    const repository = new SnapshotRepository(database);
    repository.replaceSnapshot(await loadSnapshotFromFile("tests/fixtures/sample-package.json"));

    assert.equal(repository.countPackageVersions(), 5);
    assert.equal(repository.countTaggedVersions(), 2);
    assert.equal(repository.getPackageMetadata().packageName, "acme/example");

    database.close();
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});
