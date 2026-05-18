import assert from "node:assert/strict";
import test from "node:test";
import { PlannerRepository, ScanWriter, openDatabase } from "../../../src/db/index.js";

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

test("planner repository applies older-than before keep-n-untagged recency selection", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.resetScan("acme", "keep-untagged-age", "2026-05-14T10:00:00.000Z");
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-05-10T10:00:00.000Z",
    updatedAt: "2026-05-10T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:too-new",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertPackageVersion({
    versionId: 2,
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 2,
    digest: "sha256:older-kept",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertPackageVersion({
    versionId: 3,
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 3,
    digest: "sha256:older-deleted",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getKeepNUntaggedPlanWithCutoff("acme", "keep-untagged-age", 1, {
    olderThan: "30 days",
    cutoffTimestamp: "2026-04-14T10:00:00.000Z"
  });

  assert.equal(plan.plannerInputs.olderThan, "30 days");
  assert.equal(plan.plannerInputs.cutoffTimestamp, "2026-04-14T10:00:00.000Z");
  assert.equal(plan.plannerInputs.keepNUntagged, 1);
  assert.deepEqual(plan.directTargetRoots, [
    {
      versionId: 3,
      digest: "sha256:older-deleted",
      manifestKind: "image_manifest",
      reason: "keep-n-untagged-overflow",
      selectionMode: "delete-root"
    }
  ]);

  database.close();
});

test("planner repository applies older-than to delete-untagged root selection", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.resetScan("acme", "older-untagged", "2026-05-14T10:00:00.000Z");
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:young-untagged",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertPackageVersion({
    versionId: 2,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 2,
    digest: "sha256:old-untagged",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getDeleteUntaggedPlanWithCutoff("acme", "older-untagged", {
    olderThan: "30 days",
    cutoffTimestamp: "2026-04-14T10:00:00.000Z"
  });

  assert.equal(plan.plannerInputs.olderThan, "30 days");
  assert.equal(plan.plannerInputs.cutoffTimestamp, "2026-04-14T10:00:00.000Z");
  assert.deepEqual(plan.directTargetRoots, [
    {
      versionId: 2,
      digest: "sha256:old-untagged",
      manifestKind: "image_manifest",
      reason: "delete-untagged",
      selectionMode: "delete-root"
    }
  ]);

  database.close();
});
