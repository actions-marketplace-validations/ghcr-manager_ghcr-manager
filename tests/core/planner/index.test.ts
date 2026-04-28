import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildPlanSummary } from "../../../src/core/planner/index.js";
import { openDatabase, ScanWriter, SnapshotRepository } from "../../../src/db/index.js";
import { importFileScan } from "../../../src/ingest/file/index.js";

test("planner keeps tagged graph while exposing old untagged versions", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");

  try {
    const database = openDatabase(databasePath);
    const repository = new SnapshotRepository(database);
    await importFileScan("tests/fixtures/sample-package.json", new ScanWriter(database));

    const summary = buildPlanSummary(repository, {
      olderThanDays: 30,
      deleteUntagged: true,
      excludeTags: ["keep-me"],
    });

    assert.equal(summary.packageName, "acme/example");
    assert.deepEqual(summary.protectedVersionIds, [101, 102, 103, 105]);
    assert.deepEqual(summary.deletableVersionIds, [104]);

    database.close();
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});
