import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { handleCleanup } from "../../src/cli/_cleanup-command.js";
import { openDatabase, ScanWriter } from "../../src/db/index.js";
import { importFileScan } from "../helpers/index.js";

test("handleCleanup dry-run does not require a token", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");
  const database = openDatabase(databasePath);
  const writer = new ScanWriter(database);
  await importFileScan("tests/fixtures/sample-package.json", writer);
  database.close();

  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    assert.equal(
      await handleCleanup([
        "--db",
        databasePath,
        "--owner",
        "acme",
        "--package",
        "example",
        "--dry-run",
        "--delete-untagged"
      ]),
      0
    );
  } finally {
    console.log = originalLog;
    rmSync(tempDirectory, { recursive: true, force: true });
  }

  const plan = JSON.parse(writes[0] as string) as { plannerInputs: { deleteUntagged: boolean } };
  assert.equal(plan.plannerInputs.deleteUntagged, true);
});

test("handleCleanup live mode requires a token", async () => {
  await assert.rejects(
    () => handleCleanup(["--db", "scan.sqlite", "--owner", "acme", "--package", "example", "--delete-untagged"]),
    /missing required option: --token/
  );
});
