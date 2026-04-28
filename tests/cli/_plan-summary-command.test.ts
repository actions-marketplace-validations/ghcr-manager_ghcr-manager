import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { handlePlanSummary } from "../../src/cli/_plan-summary-command.js";
import { openDatabase, ScanWriter } from "../../src/db/index.js";
import { importFileScan } from "../../src/ingest/file/index.js";

test("handlePlanSummary prints a JSON summary for a prepared database", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");
  const database = openDatabase(databasePath);
  await importFileScan("tests/fixtures/sample-package.json", new ScanWriter(database));
  database.close();

  const originalLog = console.log;
  const output: string[] = [];
  console.log = (value: string) => {
    output.push(value);
  };

  try {
    const exitCode = await handlePlanSummary(["--db", databasePath, "--older-than-days", "30", "--delete-untagged"]);
    assert.equal(exitCode, 0);
    assert.match(output[0] ?? "", /"deletableVersionIds"/);
  } finally {
    console.log = originalLog;
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});
