import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { handlePlan } from "../../src/cli/_plan-command.js";
import { openDatabase, ScanWriter } from "../../src/db/index.js";
import { importFileScan } from "../helpers/index.js";

test("handlePlan requires the delete-untagged selector", async () => {
  await assert.rejects(
    () => handlePlan(["--db", "scan.sqlite", "--owner", "acme", "--package", "example"]),
    /missing required cleanup selector: --delete-untagged or --delete-tag/
  );
});

test("handlePlan rejects mixed selector families", async () => {
  await assert.rejects(
    () =>
      handlePlan([
        "--db",
        "scan.sqlite",
        "--owner",
        "acme",
        "--package",
        "example",
        "--delete-untagged",
        "--delete-tag",
        "latest"
      ]),
    /either --delete-untagged or --delete-tag, not both/
  );
});

test("handlePlan rejects repeated older-than options", async () => {
  await assert.rejects(
    () =>
      handlePlan([
        "--db",
        "scan.sqlite",
        "--owner",
        "acme",
        "--package",
        "example",
        "--delete-untagged",
        "--older-than",
        "30 days",
        "--older-than",
        "1 day"
      ]),
    /--older-than may only be provided once/
  );
});

test("handlePlan prints a delete-untagged plan for the selected package", async () => {
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
      await handlePlan(["--db", databasePath, "--owner", "acme", "--package", "example", "--delete-untagged"]),
      0
    );
  } finally {
    console.log = originalLog;
    rmSync(tempDirectory, { recursive: true, force: true });
  }

  assert.equal(writes.length, 1);
  const plan = JSON.parse(writes[0] as string) as {
    plannerInputs: { deleteUntagged: boolean };
    fullyDeletableRoots: Array<{ digest: string }>;
  };
  assert.equal(plan.plannerInputs.deleteUntagged, true);
  assert.equal(plan.fullyDeletableRoots.length, 1);
  assert.equal(plan.fullyDeletableRoots[0]?.digest, "sha256:untagged-old");
});

test("handlePlan prints a delete-tags plan for the selected package", async () => {
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
      await handlePlan(["--db", databasePath, "--owner", "acme", "--package", "example", "--delete-tag", "latest"]),
      0
    );
  } finally {
    console.log = originalLog;
    rmSync(tempDirectory, { recursive: true, force: true });
  }

  assert.equal(writes.length, 1);
  const plan = JSON.parse(writes[0] as string) as {
    plannerInputs: { deleteUntagged: boolean; deleteTags: string[]; excludeTags: string[] };
    directTargetTags: string[];
    directTargetRoots: Array<{ digest: string; selectionMode: string }>;
    fullyDeletableRoots: Array<{ digest: string }>;
  };
  assert.equal(plan.plannerInputs.deleteUntagged, false);
  assert.deepEqual(plan.plannerInputs.deleteTags, ["latest"]);
  assert.deepEqual(plan.plannerInputs.excludeTags, []);
  assert.deepEqual(plan.directTargetTags, ["latest"]);
  assert.deepEqual(
    plan.directTargetRoots.map((root) => ({ digest: root.digest, selectionMode: root.selectionMode })),
    [
      {
        digest: "sha256:index-current",
        selectionMode: "delete-root"
      }
    ]
  );
  assert.equal(plan.fullyDeletableRoots.length, 1);
  assert.equal(plan.fullyDeletableRoots[0]?.digest, "sha256:index-current");
});

test("handlePlan resolves older-than into planner inputs", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");
  const database = openDatabase(databasePath);
  const writer = new ScanWriter(database);
  await importFileScan("tests/fixtures/sample-package.json", writer);
  database.close();

  const realDate = globalThis.Date;
  class FakeDate extends realDate {
    constructor(value?: ConstructorParameters<typeof Date>[0]) {
      super(value ?? "2026-05-14T12:00:00.000Z");
    }

    static override now(): number {
      return new realDate("2026-05-14T12:00:00.000Z").getTime();
    }
  }

  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };
  globalThis.Date = FakeDate as DateConstructor;

  try {
    assert.equal(
      await handlePlan([
        "--db",
        databasePath,
        "--owner",
        "acme",
        "--package",
        "example",
        "--delete-untagged",
        "--older-than",
        "30 days"
      ]),
      0
    );
  } finally {
    globalThis.Date = realDate;
    console.log = originalLog;
    rmSync(tempDirectory, { recursive: true, force: true });
  }

  assert.equal(writes.length, 1);
  const plan = JSON.parse(writes[0] as string) as {
    plannerInputs: { olderThan?: string; cutoffTimestamp?: string };
  };
  assert.equal(plan.plannerInputs.olderThan, "30 days");
  assert.equal(plan.plannerInputs.cutoffTimestamp, "2026-04-14T12:00:00.000Z");
});
