import assert from "node:assert/strict";
import test from "node:test";
import { PlannerRepository, ScanWriter, openDatabase } from "../../../src/db/index.js";

test("planner repository resolves delete-tag root targets through the dedicated delete-tag helper", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.startScan("acme", "pkg", "2026-05-14T10:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-05-03T10:00:00.000Z",
    updatedAt: "2026-05-03T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:release-root",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "release-1", versionId: 1 });
  writer.insertTag({ tag: "stable", versionId: 1 });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getDeleteTagsPlan("acme", "pkg", ["release-*"], []);

  assert.deepEqual(plan.directTargetRoots, [
    {
      versionId: 1,
      digest: "sha256:release-root",
      manifestKind: "image_manifest",
      reason: "delete-tags-partial-tag-match",
      selectionMode: "untag-only"
    }
  ]);

  database.close();
});

test("planner repository selects a fully matched tagged root for deletion", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.startScan("acme", "delete-tags", "2026-05-14T10:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:latest-root",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "latest", versionId: 1 });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getDeleteTagsPlan("acme", "delete-tags", ["latest"], []);

  assert.deepEqual(plan.directTargetTags, ["latest"]);
  assert.deepEqual(plan.directTargetRoots, [
    {
      versionId: 1,
      digest: "sha256:latest-root",
      manifestKind: "image_manifest",
      reason: "delete-tags-all-tags-selected",
      selectionMode: "delete-root"
    }
  ]);

  database.close();
});

test("planner repository applies keep-n-tagged within the matched delete-tag subset", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.startScan("acme", "tagged-combined", "2026-05-14T10:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-05-03T10:00:00.000Z",
    updatedAt: "2026-05-03T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:retained-unrelated",
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
    digest: "sha256:matched-kept",
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
    digest: "sha256:matched-deleted",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "beta-old", versionId: 3 });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getDeleteTagsPlanWithCutoff("acme", "tagged-combined", ["beta-new", "beta-old"], [], {
    keepNTagged: 1
  });

  assert.deepEqual(plan.directTargetTags, ["beta-new", "beta-old"]);
  assert.equal(plan.plannerInputs.keepNTagged, 1);
  assert.deepEqual(plan.directTargetRoots, [
    {
      versionId: 3,
      digest: "sha256:matched-deleted",
      manifestKind: "image_manifest",
      reason: "keep-n-tagged-overflow",
      selectionMode: "delete-root"
    }
  ]);

  database.close();
});

test("planner repository keeps non-matched tags on shared matched roots as untag-only after keep overflow", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.startScan("acme", "tagged-combined-partial", "2026-05-14T10:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-05-03T10:00:00.000Z",
    updatedAt: "2026-05-03T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:matched-kept",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "beta-new", versionId: 1 });
  writer.insertPackageVersion({
    versionId: 2,
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 2,
    digest: "sha256:matched-shared",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "beta-old", versionId: 2 });
  writer.insertTag({ tag: "alpha", versionId: 2 });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getDeleteTagsPlanWithCutoff("acme", "tagged-combined-partial", ["beta-new", "beta-old"], [], {
    keepNTagged: 1
  });

  assert.deepEqual(plan.directTargetTags, ["beta-new", "beta-old"]);
  assert.equal(plan.plannerInputs.keepNTagged, 1);
  assert.deepEqual(plan.directTargetRoots, [
    {
      versionId: 2,
      digest: "sha256:matched-shared",
      manifestKind: "image_manifest",
      reason: "delete-tags-partial-tag-match",
      selectionMode: "untag-only"
    }
  ]);
  assert.deepEqual(plan.fullyDeletableRoots, []);

  database.close();
});

test("planner repository applies older-than to exact tag matches", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.startScan("acme", "older-tags", "2026-05-14T10:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:young-tagged",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "latest", versionId: 1 });
  writer.insertPackageVersion({
    versionId: 2,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 2,
    digest: "sha256:old-tagged",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "latest", versionId: 2 });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getDeleteTagsPlanWithCutoff("acme", "older-tags", ["latest"], [], {
    olderThan: "30 days",
    cutoffTimestamp: "2026-04-14T10:00:00.000Z"
  });

  assert.deepEqual(plan.directTargetTags, ["latest"]);
  assert.deepEqual(plan.directTargetRoots, [
    {
      versionId: 2,
      digest: "sha256:old-tagged",
      manifestKind: "image_manifest",
      reason: "delete-tags-all-tags-selected",
      selectionMode: "delete-root"
    }
  ]);

  database.close();
});

test("planner repository keeps older-than partial tag matches as untag-only", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.startScan("acme", "older-partial", "2026-05-14T10:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:old-multi-tag",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "latest", versionId: 1 });
  writer.insertTag({ tag: "stable", versionId: 1 });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getDeleteTagsPlanWithCutoff("acme", "older-partial", ["latest"], [], {
    olderThan: "30 days",
    cutoffTimestamp: "2026-04-14T10:00:00.000Z"
  });

  assert.deepEqual(plan.directTargetRoots, [
    {
      versionId: 1,
      digest: "sha256:old-multi-tag",
      manifestKind: "image_manifest",
      reason: "delete-tags-partial-tag-match",
      selectionMode: "untag-only"
    }
  ]);
  assert.deepEqual(plan.fullyDeletableRoots, []);

  database.close();
});
