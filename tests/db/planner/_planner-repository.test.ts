import assert from "node:assert/strict";
import test from "node:test";
import { PlannerRepository, ScanWriter, openDatabase } from "../../../src/db/index.js";
import { importFileScan } from "../../helpers/index.js";

test("planner repository returns a delete-untagged plan for top-level untagged roots only", async () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  await importFileScan("tests/fixtures/sample-package.json", writer);

  const plan = repository.getDeleteUntaggedPlan("acme", "example");

  assert.deepEqual(plan.directTargetTags, []);
  assert.deepEqual(plan.directTargetRoots, [
    {
      versionId: 104,
      digest: "sha256:untagged-old",
      manifestKind: "image_manifest",
      reason: "delete-untagged",
      selectionMode: "delete-root"
    }
  ]);
  assert.deepEqual(plan.blockedRoots, []);
  assert.deepEqual(plan.fullyDeletableRoots, plan.directTargetRoots);
  assert.deepEqual(plan.collateralTags, []);
  assert.deepEqual(plan.closureManifests, [
    {
      sourceVersionId: 104,
      sourceDigest: "sha256:untagged-old",
      memberVersionId: 104,
      memberDigest: "sha256:untagged-old",
      memberManifestKind: "image_manifest",
      hopsFromRoot: 0,
      memberRole: "root"
    }
  ]);

  database.close();
});

test("planner repository logs raw SQL statements and params at trace level", async () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const traceMessages: string[] = [];
  const debugMessages: string[] = [];
  const repository = new PlannerRepository(database, {
    trace(message: string) {
      traceMessages.push(message);
    },
    debug(message: string) {
      debugMessages.push(message);
    }
  });

  await importFileScan("tests/fixtures/sample-package.json", writer);

  const plan = repository.getDeleteUntaggedPlan("acme", "example");

  assert.equal(plan.directTargetRoots.length, 1);
  assert.ok(
    traceMessages.some((message) => message.includes("SELECT scan_id, owner, package_name, scan_completed_at"))
  );
  assert.ok(traceMessages.some((message) => message.includes('PARAMS: ["acme","example"]')));
  assert.ok(debugMessages.some((message) => message.includes("SQL returned")));

  database.close();
});

test("planner repository carries delete-ghost-images planner metadata through tagged-root planning", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.resetScan("acme", "ghost-images", "2026-05-15T00:00:00.000Z");
  writer.insertPackageVersion({
    versionId: 201,
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 201,
    digest: "sha256:ghost-index",
    manifestKind: "image_index",
    mediaType: "application/vnd.oci.image.index.v1+json"
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

  const plan = repository.getDeleteTagsPlanWithCutoff("acme", "ghost-images", ["ghost"], [], {
    deleteGhostImages: true,
    deleteTagsRequested: true
  });

  assert.equal(plan.plannerInputs.deleteGhostImages, true);
  assert.deepEqual(plan.directTargetTags, ["ghost"]);
  assert.deepEqual(plan.directTargetRoots, [
    {
      versionId: 201,
      digest: "sha256:ghost-index",
      manifestKind: "image_index",
      reason: "delete-tags-all-tags-selected",
      selectionMode: "delete-root"
    }
  ]);
  assert.deepEqual(plan.fullyDeletableRoots, plan.directTargetRoots);

  database.close();
});

test("planner repository carries delete-partial-images planner metadata through tagged-root planning", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new PlannerRepository(database);

  writer.resetScan("acme", "partial-images", "2026-05-15T00:00:00.000Z");
  writer.insertPackageVersion({
    versionId: 201,
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 201,
    digest: "sha256:partial-index",
    manifestKind: "image_index",
    mediaType: "application/vnd.oci.image.index.v1+json"
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
    childDigest: "sha256:missing-arm64",
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
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.rebuildManifestReachability();
  writer.markScanCompleted("2026-05-15T00:00:00.000Z");

  const plan = repository.getDeleteTagsPlanWithCutoff("acme", "partial-images", ["partial"], [], {
    deletePartialImages: true,
    deleteTagsRequested: true
  });

  assert.equal(plan.plannerInputs.deletePartialImages, true);
  assert.deepEqual(plan.directTargetTags, ["partial"]);
  assert.deepEqual(plan.directTargetRoots, [
    {
      versionId: 201,
      digest: "sha256:partial-index",
      manifestKind: "image_index",
      reason: "delete-tags-all-tags-selected",
      selectionMode: "delete-root"
    }
  ]);
  assert.deepEqual(plan.fullyDeletableRoots, plan.directTargetRoots);

  database.close();
});
