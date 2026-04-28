import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { handleScan } from "../../src/cli/_scan-command.js";

test("handleScan loads a file snapshot and prints counts", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");
  const originalLog = console.log;
  const output: string[] = [];
  console.log = (value: string) => {
    output.push(value);
  };

  try {
    const exitCode = await handleScan([
      "--db",
      databasePath,
      "--source",
      "file",
      "--snapshot",
      "tests/fixtures/sample-package.json",
    ]);
    assert.equal(exitCode, 0);
    assert.match(output[0] ?? "", /"packageVersions": 5/);
  } finally {
    console.log = originalLog;
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});
