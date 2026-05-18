import assert from "node:assert/strict";
import test from "node:test";
import { PlannerRepository, ScanWriter, openDatabase } from "../../src/db/index.js";

test("planner repository resolves untagged direct targets and overflow roots", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.resetScan("acme", "pkg", "2026-05-14T10:00:00.000Z");
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-05-03T10:00:00.000Z",
    updatedAt: "2026-05-03T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:newer",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertPackageVersion({
    versionId: 2,
    createdAt: "2026-05-02T10:00:00.000Z",
    updatedAt: "2026-05-02T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 2,
    digest: "sha256:older",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const deletePlan = repository.getDeleteUntaggedPlan("acme", "pkg");
  const keepPlan = repository.getKeepNUntaggedPlan("acme", "pkg", 1);

  assert.deepEqual(
    deletePlan.directTargetRoots.map((root) => root.digest),
    ["sha256:newer", "sha256:older"]
  );
  assert.deepEqual(
    keepPlan.directTargetRoots.map((root) => root.digest),
    ["sha256:older"]
  );

  database.close();
});
