import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase, ScanWriter } from "../../src/db/index.js";
import { resolveTagSelectors } from "../../src/cli/_tag-selector-resolver.js";
import { importFileScan } from "../helpers/index.js";

async function _withSampleDatabase(
  run: (database: ReturnType<typeof openDatabase>, databasePath: string) => Promise<void>
): Promise<void> {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");
  const database = openDatabase(databasePath);
  const writer = new ScanWriter(database);
  await importFileScan("tests/fixtures/sample-package.json", writer);

  try {
    await run(database, databasePath);
  } finally {
    database.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

test("resolveTagSelectors expands wildcard delete-tag selectors against latest scan tags", async () => {
  await _withSampleDatabase(async (database) => {
    const inputs = {
      databasePath: "scan.sqlite",
      owner: "acme",
      packageName: "example",
      deleteTags: ["*me"],
      excludeTags: [],
      deleteUntagged: false,
      useRegex: false
    };

    const resolved = resolveTagSelectors(database, inputs);
    assert.deepEqual(resolved.deleteTags, ["keep-me"]);
    assert.deepEqual(resolved.excludeTags, []);
  });
});

test("resolveTagSelectors expands regex delete-tag and exclude-tag selectors", async () => {
  await _withSampleDatabase(async (database) => {
    const inputs = {
      databasePath: "scan.sqlite",
      owner: "acme",
      packageName: "example",
      deleteTags: ["^l.*"],
      excludeTags: [".*me$"],
      deleteUntagged: false,
      useRegex: true
    };

    const resolved = resolveTagSelectors(database, inputs);
    assert.deepEqual(resolved.deleteTags, ["latest"]);
    assert.deepEqual(resolved.excludeTags, ["keep-me"]);
  });
});
