import assert from "node:assert/strict";
import test from "node:test";
import { PlannerRepository, ScanWriter, openDatabase } from "../../../src/db/index.js";

test("planner repository enumerates direct target tags through the dedicated direct-tag helper", () => {
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

  assert.deepEqual(plan.directTargetTags, ["release-1"]);
  assert.equal(plan.directTargetRoots[0]?.selectionMode, "untag-only");

  database.close();
});

test("planner repository matches regex delete and exclude selectors in SQL", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.startScan("acme", "regex-tags", "2026-05-14T10:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:protected-root",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "latest", versionId: 1 });
  writer.insertTag({ tag: "keep-me", versionId: 1 });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getDeleteTagsPlanWithCutoff("acme", "regex-tags", ["^l.*"], [".*me$"], {
    useRegex: true
  });

  assert.deepEqual(plan.directTargetTags, []);
  assert.deepEqual(plan.directTargetRoots, []);

  database.close();
});

test("planner repository lets exclude-tags protect a matched root", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.startScan("acme", "exclude-tags", "2026-05-14T10:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:protected-root",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "latest", versionId: 1 });
  writer.insertTag({ tag: "keep-me", versionId: 1 });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getDeleteTagsPlan("acme", "exclude-tags", ["latest"], ["keep-me"]);

  assert.deepEqual(plan.directTargetTags, []);
  assert.deepEqual(plan.directTargetRoots, []);

  database.close();
});
