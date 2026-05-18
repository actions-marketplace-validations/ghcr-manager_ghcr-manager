import assert from "node:assert/strict";
import test from "node:test";
import { PlannerRepository, ScanWriter, openDatabase } from "../../src/db/index.js";

test("planner repository resolves tagged direct targets and keep overflow roots", () => {
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
    digest: "sha256:latest-root",
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
    digest: "sha256:release-root",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "release-1", versionId: 2 });
  writer.insertTag({ tag: "stable", versionId: 2 });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const deletePlan = repository.getDeleteTagsPlan("acme", "pkg", ["release-*"], []);
  const keepPlan = repository.getKeepNTaggedPlan("acme", "pkg", 1);

  assert.equal(deletePlan.directTargetRoots[0]?.selectionMode, "untag-only");
  assert.deepEqual(
    keepPlan.directTargetRoots.map((root) => root.digest),
    ["sha256:release-root"]
  );

  database.close();
});
