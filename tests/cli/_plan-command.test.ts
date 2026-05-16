import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { handlePlan } from "../../src/cli/_plan-command.js";
import { openDatabase, ScanWriter } from "../../src/db/index.js";
import { importFileScan } from "../helpers/index.js";

async function _withSampleDatabase(run: (databasePath: string) => Promise<void>): Promise<void> {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");
  const database = openDatabase(databasePath);
  const writer = new ScanWriter(database);
  await importFileScan("tests/fixtures/sample-package.json", writer);
  database.close();

  try {
    await run(databasePath);
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

test("handlePlan requires the delete-untagged selector", async () => {
  await assert.rejects(
    () => handlePlan(["--db", "scan.sqlite", "--owner", "acme", "--package", "example"]),
    /missing required cleanup selector: --delete-untagged, --delete-tag, --delete-ghost-images, --delete-partial-images, --delete-orphaned-images, --keep-n-tagged, or --keep-n-untagged/
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
    /exactly one selector family: --delete-untagged, --delete-tag, --delete-ghost-images, --delete-partial-images, --delete-orphaned-images, --keep-n-tagged, or --keep-n-untagged/
  );
});

test("handlePlan prints a delete-ghost-images plan for ghost image indexes", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");
  const database = openDatabase(databasePath);
  const writer = new ScanWriter(database);
  writer.resetScan("acme", "example", "2026-05-15T00:00:00.000Z");
  writer.insertPackageVersion({
    versionId: 201,
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 201,
    digest: "sha256:ghost-index",
    mediaType: "application/vnd.oci.image.index.v1+json",
    manifestKind: "image_index"
  });
  writer.insertTag({
    tag: "ghost",
    versionId: 201
  });
  writer.insertManifestDescriptor({
    parentDigest: "sha256:ghost-index",
    childDigest: "sha256:missing-amd64",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    platform: { os: "linux", architecture: "amd64" }
  });
  writer.insertManifestDescriptor({
    parentDigest: "sha256:ghost-index",
    childDigest: "sha256:missing-arm64",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    platform: { os: "linux", architecture: "arm64" }
  });
  writer.rebuildManifestReachability();
  writer.markScanCompleted("2026-05-15T00:00:00.000Z");
  database.close();

  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    assert.equal(
      await handlePlan(["--db", databasePath, "--owner", "acme", "--package", "example", "--delete-ghost-images"]),
      0
    );
  } finally {
    console.log = originalLog;
    rmSync(tempDirectory, { recursive: true, force: true });
  }

  const plan = JSON.parse(writes[0] as string) as {
    plannerInputs: { deleteGhostImages?: boolean; deleteTags: string[] };
    directTargetTags: string[];
    fullyDeletableRoots: Array<{ digest: string }>;
  };
  assert.equal(plan.plannerInputs.deleteGhostImages, true);
  assert.deepEqual(plan.plannerInputs.deleteTags, ["ghost"]);
  assert.deepEqual(plan.directTargetTags, ["ghost"]);
  assert.deepEqual(
    plan.fullyDeletableRoots.map((root) => root.digest),
    ["sha256:ghost-index"]
  );
});

test("handlePlan prints a delete-orphaned-images plan for orphaned sha256 tags", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");
  const database = openDatabase(databasePath);
  const writer = new ScanWriter(database);
  const orphanParentDigest = `sha256:${"a".repeat(64)}`;
  const orphanTag = `${orphanParentDigest.replace("sha256:", "sha256-")}.sig`;
  writer.resetScan("acme", "example", "2026-05-15T00:00:00.000Z");
  writer.insertPackageVersion({
    versionId: 201,
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 201,
    digest: "sha256:orphaned-signature",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    manifestKind: "signature_manifest"
  });
  writer.insertTag({
    tag: orphanTag,
    versionId: 201
  });
  writer.markScanCompleted("2026-05-15T00:00:00.000Z");
  database.close();

  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    assert.equal(
      await handlePlan(["--db", databasePath, "--owner", "acme", "--package", "example", "--delete-orphaned-images"]),
      0
    );
  } finally {
    console.log = originalLog;
    rmSync(tempDirectory, { recursive: true, force: true });
  }

  const plan = JSON.parse(writes[0] as string) as {
    plannerInputs: { deleteOrphanedImages?: boolean; deleteTags: string[] };
    directTargetTags: string[];
    fullyDeletableRoots: Array<{ digest: string }>;
  };
  assert.equal(plan.plannerInputs.deleteOrphanedImages, true);
  assert.deepEqual(plan.plannerInputs.deleteTags, [orphanTag]);
  assert.deepEqual(plan.directTargetTags, [orphanTag]);
  assert.deepEqual(
    plan.fullyDeletableRoots.map((root) => root.digest),
    ["sha256:orphaned-signature"]
  );
});

test("handlePlan prints a delete-partial-images plan for partial image indexes", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");
  const database = openDatabase(databasePath);
  const writer = new ScanWriter(database);
  writer.resetScan("acme", "example", "2026-05-15T00:00:00.000Z");
  writer.insertPackageVersion({
    versionId: 201,
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 201,
    digest: "sha256:partial-index",
    mediaType: "application/vnd.oci.image.index.v1+json",
    manifestKind: "image_index"
  });
  writer.insertTag({
    tag: "partial",
    versionId: 201
  });
  writer.insertManifestDescriptor({
    parentDigest: "sha256:partial-index",
    childDigest: "sha256:present-child",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    platform: { os: "linux", architecture: "amd64" }
  });
  writer.insertManifestDescriptor({
    parentDigest: "sha256:partial-index",
    childDigest: "sha256:missing-child",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    platform: { os: "linux", architecture: "arm64" }
  });
  writer.insertPackageVersion({
    versionId: 202,
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 202,
    digest: "sha256:present-child",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    manifestKind: "image_manifest"
  });
  writer.rebuildManifestReachability();
  writer.markScanCompleted("2026-05-15T00:00:00.000Z");
  database.close();

  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    assert.equal(
      await handlePlan(["--db", databasePath, "--owner", "acme", "--package", "example", "--delete-partial-images"]),
      0
    );
  } finally {
    console.log = originalLog;
    rmSync(tempDirectory, { recursive: true, force: true });
  }

  const plan = JSON.parse(writes[0] as string) as {
    plannerInputs: { deletePartialImages?: boolean; deleteTags: string[] };
    directTargetTags: string[];
    fullyDeletableRoots: Array<{ digest: string }>;
  };
  assert.equal(plan.plannerInputs.deletePartialImages, true);
  assert.deepEqual(plan.plannerInputs.deleteTags, ["partial"]);
  assert.deepEqual(plan.directTargetTags, ["partial"]);
  assert.deepEqual(
    plan.fullyDeletableRoots.map((root) => root.digest),
    ["sha256:partial-index"]
  );
});

test("handlePlan allows delete-tag combined with keep-n-tagged", async () => {
  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    await _withSampleDatabase(async (databasePath) => {
      assert.equal(
        await handlePlan([
          "--db",
          databasePath,
          "--owner",
          "acme",
          "--package",
          "example",
          "--delete-tag",
          "latest",
          "--keep-n-tagged",
          "0"
        ]),
        0
      );
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(writes.length, 1);
  const plan = JSON.parse(writes[0] as string) as {
    plannerInputs: { deleteTags: string[]; keepNTagged?: number };
    directTargetRoots: Array<{
      versionId: number;
      digest: string;
      manifestKind?: string;
      reason: string;
      selectionMode: string;
    }>;
  };
  assert.deepEqual(plan.plannerInputs.deleteTags, ["latest"]);
  assert.equal(plan.plannerInputs.keepNTagged, 0);
  assert.deepEqual(
    plan.directTargetRoots.map((root) => ({
      digest: root.digest,
      reason: root.reason,
      selectionMode: root.selectionMode
    })),
    [
      {
        digest: "sha256:index-current",
        reason: "keep-n-tagged-overflow",
        selectionMode: "delete-root"
      }
    ]
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

test("handlePlan rejects repeated keep-n-untagged options", async () => {
  await assert.rejects(
    () =>
      handlePlan([
        "--db",
        "scan.sqlite",
        "--owner",
        "acme",
        "--package",
        "example",
        "--keep-n-untagged",
        "1",
        "--keep-n-untagged",
        "2"
      ]),
    /--keep-n-untagged may only be provided once/
  );
});

test("handlePlan rejects repeated keep-n-tagged options", async () => {
  await assert.rejects(
    () =>
      handlePlan([
        "--db",
        "scan.sqlite",
        "--owner",
        "acme",
        "--package",
        "example",
        "--keep-n-tagged",
        "1",
        "--keep-n-tagged",
        "2"
      ]),
    /--keep-n-tagged may only be provided once/
  );
});

test("handlePlan rejects invalid keep-n-tagged values", async () => {
  await assert.rejects(
    () => handlePlan(["--db", "scan.sqlite", "--owner", "acme", "--package", "example", "--keep-n-tagged", "-1"]),
    /--keep-n-tagged must be a non-negative integer/
  );
});

test("handlePlan rejects invalid keep-n-untagged values", async () => {
  await assert.rejects(
    () => handlePlan(["--db", "scan.sqlite", "--owner", "acme", "--package", "example", "--keep-n-untagged", "-1"]),
    /--keep-n-untagged must be a non-negative integer/
  );
});

test("handlePlan prints a delete-untagged plan for the selected package", async () => {
  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    await _withSampleDatabase(async (databasePath) => {
      assert.equal(
        await handlePlan(["--db", databasePath, "--owner", "acme", "--package", "example", "--delete-untagged"]),
        0
      );
    });
  } finally {
    console.log = originalLog;
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
  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    await _withSampleDatabase(async (databasePath) => {
      assert.equal(
        await handlePlan(["--db", databasePath, "--owner", "acme", "--package", "example", "--delete-tag", "latest"]),
        0
      );
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(writes.length, 1);
  const plan = JSON.parse(writes[0] as string) as {
    validationSummary: {
      directTargetTagCount: number;
      directTargetRootCount: number;
      deleteRootCandidateCount: number;
      fullyDeletableRootCount: number;
      blockedDeleteRootCount: number;
    };
    plannerInputs: { deleteUntagged: boolean; deleteTags: string[]; excludeTags: string[] };
    directTargetTags: string[];
    directTargetRoots: Array<{ digest: string; selectionMode: string }>;
    rootDecisions: Array<{
      digest: string;
      selectionMode: string;
      selectionReason: string;
      validationStatus: string;
    }>;
    protectedRoots: Array<{ digest: string }>;
    fullyDeletableRoots: Array<{ digest: string }>;
  };
  assert.equal(plan.plannerInputs.deleteUntagged, false);
  assert.deepEqual(plan.plannerInputs.deleteTags, ["latest"]);
  assert.deepEqual(plan.plannerInputs.excludeTags, []);
  assert.deepEqual(plan.directTargetTags, ["latest"]);
  assert.equal(plan.validationSummary.directTargetTagCount, 1);
  assert.equal(plan.validationSummary.directTargetRootCount, 1);
  assert.equal(plan.validationSummary.deleteRootCandidateCount, 1);
  assert.equal(plan.validationSummary.fullyDeletableRootCount, 1);
  assert.equal(plan.validationSummary.blockedDeleteRootCount, 0);
  assert.deepEqual(
    plan.directTargetRoots.map((root) => ({ digest: root.digest, selectionMode: root.selectionMode })),
    [
      {
        digest: "sha256:index-current",
        selectionMode: "delete-root"
      }
    ]
  );
  assert.deepEqual(
    plan.rootDecisions.map((decision) => ({
      digest: decision.digest,
      selectionMode: decision.selectionMode,
      selectionReason: decision.selectionReason,
      validationStatus: decision.validationStatus
    })),
    [
      {
        digest: "sha256:index-current",
        selectionMode: "delete-root",
        selectionReason: "delete-tags-all-tags-selected",
        validationStatus: "fully-deletable"
      }
    ]
  );
  assert.deepEqual(plan.protectedRoots, []);
  assert.equal(plan.fullyDeletableRoots.length, 1);
  assert.equal(plan.fullyDeletableRoots[0]?.digest, "sha256:index-current");
});

test("handlePlan expands wildcard delete-tag selectors before planning", async () => {
  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    await _withSampleDatabase(async (databasePath) => {
      assert.equal(
        await handlePlan(["--db", databasePath, "--owner", "acme", "--package", "example", "--delete-tag", "lat*"]),
        0
      );
    });
  } finally {
    console.log = originalLog;
  }

  const plan = JSON.parse(writes[0] as string) as {
    plannerInputs: { deleteTags: string[] };
    directTargetTags: string[];
  };
  assert.deepEqual(plan.plannerInputs.deleteTags, ["latest"]);
  assert.deepEqual(plan.directTargetTags, ["latest"]);
});

test("handlePlan expands wildcard selectors before planning", async () => {
  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    await _withSampleDatabase(async (databasePath) => {
      assert.equal(
        await handlePlan([
          "--db",
          databasePath,
          "--owner",
          "acme",
          "--package",
          "example",
          "--delete-tag",
          "latest",
          "--exclude-tag",
          "keep*"
        ]),
        0
      );
    });
  } finally {
    console.log = originalLog;
  }

  const plan = JSON.parse(writes[0] as string) as {
    plannerInputs: { deleteTags: string[]; excludeTags: string[] };
  };
  assert.deepEqual(plan.plannerInputs.deleteTags, ["latest"]);
  assert.deepEqual(plan.plannerInputs.excludeTags, ["keep-me"]);
});

test("handlePlan expands regex selectors before planning when use-regex is set", async () => {
  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    await _withSampleDatabase(async (databasePath) => {
      assert.equal(
        await handlePlan([
          "--db",
          databasePath,
          "--owner",
          "acme",
          "--package",
          "example",
          "--delete-tag",
          "^latest$",
          "--exclude-tag",
          "^keep",
          "--use-regex"
        ]),
        0
      );
    });
  } finally {
    console.log = originalLog;
  }

  const plan = JSON.parse(writes[0] as string) as {
    plannerInputs: { deleteTags: string[]; excludeTags: string[] };
  };
  assert.deepEqual(plan.plannerInputs.deleteTags, ["latest"]);
  assert.deepEqual(plan.plannerInputs.excludeTags, ["keep-me"]);
});

test("handlePlan treats unmatched wildcard delete-tag selectors as a no-op", async () => {
  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    await _withSampleDatabase(async (databasePath) => {
      assert.equal(
        await handlePlan([
          "--db",
          databasePath,
          "--owner",
          "acme",
          "--package",
          "example",
          "--delete-tag",
          "does-not-match"
        ]),
        0
      );
    });
  } finally {
    console.log = originalLog;
  }

  const plan = JSON.parse(writes[0] as string) as {
    plannerInputs: { deleteTags: string[] };
    directTargetTags: string[];
    directTargetRoots: Array<unknown>;
    fullyDeletableRoots: Array<unknown>;
  };
  assert.deepEqual(plan.plannerInputs.deleteTags, []);
  assert.deepEqual(plan.directTargetTags, []);
  assert.deepEqual(plan.directTargetRoots, []);
  assert.deepEqual(plan.fullyDeletableRoots, []);
});

test("handlePlan prints a keep-n-untagged plan for the selected package", async () => {
  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    await _withSampleDatabase(async (databasePath) => {
      assert.equal(
        await handlePlan(["--db", databasePath, "--owner", "acme", "--package", "example", "--keep-n-untagged", "0"]),
        0
      );
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(writes.length, 1);
  const plan = JSON.parse(writes[0] as string) as {
    plannerInputs: {
      deleteUntagged: boolean;
      deleteTags: string[];
      excludeTags: string[];
      keepNUntagged?: number;
    };
    directTargetTags: string[];
    fullyDeletableRoots: Array<{ digest: string; reason: string }>;
  };
  assert.equal(plan.plannerInputs.deleteUntagged, false);
  assert.deepEqual(plan.plannerInputs.deleteTags, []);
  assert.deepEqual(plan.plannerInputs.excludeTags, []);
  assert.equal(plan.plannerInputs.keepNUntagged, 0);
  assert.deepEqual(plan.directTargetTags, []);
  assert.deepEqual(
    plan.fullyDeletableRoots.map((root) => ({ digest: root.digest, reason: root.reason })),
    [
      {
        digest: "sha256:untagged-old",
        reason: "keep-n-untagged-overflow"
      }
    ]
  );
});

test("handlePlan prints a keep-n-tagged plan for the selected package", async () => {
  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    await _withSampleDatabase(async (databasePath) => {
      assert.equal(
        await handlePlan(["--db", databasePath, "--owner", "acme", "--package", "example", "--keep-n-tagged", "1"]),
        0
      );
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(writes.length, 1);
  const plan = JSON.parse(writes[0] as string) as {
    plannerInputs: {
      deleteUntagged: boolean;
      deleteTags: string[];
      excludeTags: string[];
      keepNTagged?: number;
    };
    directTargetTags: string[];
    fullyDeletableRoots: Array<{ digest: string; reason: string }>;
  };
  assert.equal(plan.plannerInputs.deleteUntagged, false);
  assert.deepEqual(plan.plannerInputs.deleteTags, []);
  assert.deepEqual(plan.plannerInputs.excludeTags, []);
  assert.equal(plan.plannerInputs.keepNTagged, 1);
  assert.deepEqual(plan.directTargetTags, []);
  assert.deepEqual(
    plan.fullyDeletableRoots.map((root) => ({ digest: root.digest, reason: root.reason })),
    [
      {
        digest: "sha256:index-old",
        reason: "keep-n-tagged-overflow"
      }
    ]
  );
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
