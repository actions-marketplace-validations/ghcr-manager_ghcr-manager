import assert from "node:assert/strict";
import test from "node:test";
import { PlannerRepository, ScanWriter, openDatabase } from "../../../src/db/index.js";

test("planner repository resolves keep-tagged root targets through the dedicated keep-tagged helper", () => {
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
    digest: "sha256:newer-root",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "latest", versionId: 1 });
  writer.insertPackageVersion({
    versionId: 2,
    createdAt: "2026-05-02T10:00:00.000Z",
    updatedAt: "2026-05-02T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 2,
    digest: "sha256:older-root",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "old", versionId: 2 });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getKeepNTaggedPlan("acme", "pkg", 1);

  assert.deepEqual(plan.directTargetRoots, [
    {
      versionId: 2,
      digest: "sha256:older-root",
      manifestKind: "image_manifest",
      reason: "keep-n-tagged-overflow",
      selectionMode: "delete-root"
    }
  ]);

  database.close();
});

test("planner repository keeps the newest eligible tagged roots and selects only overflow roots", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.resetScan("acme", "keep-tagged", "2026-05-14T10:00:00.000Z");
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-05-03T10:00:00.000Z",
    updatedAt: "2026-05-03T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:newest-tagged",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "latest", versionId: 1 });
  writer.insertPackageVersion({
    versionId: 2,
    createdAt: "2026-05-02T10:00:00.000Z",
    updatedAt: "2026-05-02T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 2,
    digest: "sha256:middle-tagged",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "beta-new", versionId: 2 });
  writer.insertPackageVersion({
    versionId: 3,
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 3,
    digest: "sha256:oldest-tagged",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "stable", versionId: 3 });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getKeepNTaggedPlan("acme", "keep-tagged", 2);

  assert.deepEqual(plan.directTargetTags, []);
  assert.equal(plan.plannerInputs.keepNTagged, 2);
  assert.deepEqual(plan.directTargetRoots, [
    {
      versionId: 3,
      digest: "sha256:oldest-tagged",
      manifestKind: "image_manifest",
      reason: "keep-n-tagged-overflow",
      selectionMode: "delete-root"
    }
  ]);
  assert.deepEqual(plan.blockedRoots, []);
  assert.deepEqual(plan.fullyDeletableRoots, plan.directTargetRoots);

  database.close();
});

test("planner repository applies older-than before keep-n-tagged recency selection", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.resetScan("acme", "keep-tagged-age", "2026-05-14T10:00:00.000Z");
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-05-10T10:00:00.000Z",
    updatedAt: "2026-05-10T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:too-new-tagged",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "latest", versionId: 1 });
  writer.insertPackageVersion({
    versionId: 2,
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 2,
    digest: "sha256:older-tagged-kept",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "beta-new", versionId: 2 });
  writer.insertPackageVersion({
    versionId: 3,
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 3,
    digest: "sha256:older-tagged-deleted",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "stable", versionId: 3 });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getKeepNTaggedPlanWithCutoff("acme", "keep-tagged-age", 1, [], {
    olderThan: "30 days",
    cutoffTimestamp: "2026-04-14T10:00:00.000Z"
  });

  assert.equal(plan.plannerInputs.olderThan, "30 days");
  assert.equal(plan.plannerInputs.cutoffTimestamp, "2026-04-14T10:00:00.000Z");
  assert.equal(plan.plannerInputs.keepNTagged, 1);
  assert.deepEqual(plan.directTargetRoots, [
    {
      versionId: 3,
      digest: "sha256:older-tagged-deleted",
      manifestKind: "image_manifest",
      reason: "keep-n-tagged-overflow",
      selectionMode: "delete-root"
    }
  ]);

  database.close();
});
