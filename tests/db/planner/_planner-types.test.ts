import assert from "node:assert/strict";
import test from "node:test";
import { PlannerRepository, ScanWriter, openDatabase } from "../../../src/db/index.js";

test("planner repository returns normalized typed planner rows", () => {
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
    digest: "sha256:root-a",
    manifestKind: "image_index",
    mediaType: "application/vnd.oci.image.index.v1+json"
  });
  writer.insertPackageVersion({
    versionId: 2,
    createdAt: "2026-05-02T10:00:00.000Z",
    updatedAt: "2026-05-02T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 2,
    digest: "sha256:root-b",
    manifestKind: "image_index",
    mediaType: "application/vnd.oci.image.index.v1+json"
  });
  writer.insertPackageVersion({
    versionId: 3,
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 3,
    digest: "sha256:shared-child",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertManifestEdge({
    parentDigest: "sha256:root-a",
    childDigest: "sha256:shared-child",
    edgeKind: "image-child"
  });
  writer.insertManifestEdge({
    parentDigest: "sha256:root-b",
    childDigest: "sha256:shared-child",
    edgeKind: "image-child"
  });
  writer.rebuildManifestReachability();
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getKeepNUntaggedPlan("acme", "pkg", 1);

  assert.equal(plan.directTargetRoots[0]?.manifestKind, "image_index");
  assert.equal(plan.closureManifests[1]?.memberManifestKind, "image_manifest");
  assert.equal(plan.blockedRoots[0]?.overlapManifestKind, "image_manifest");

  database.close();
});
