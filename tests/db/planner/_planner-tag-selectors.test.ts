import assert from "node:assert/strict";
import test from "node:test";
import { PlannerRepository, ScanWriter, openDatabase } from "../../../src/db/index.js";

test("planner repository handles wildcard and regex tag selectors", () => {
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
  writer.insertPackageVersion({
    versionId: 2,
    createdAt: "2026-05-02T10:00:00.000Z",
    updatedAt: "2026-05-02T10:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 2,
    digest: "sha256:regex-root",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({ tag: "v12", versionId: 2 });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const wildcardPlan = repository.getDeleteTagsPlan("acme", "pkg", ["release-*"], []);
  const regexPlan = repository.getDeleteTagsPlanWithCutoff("acme", "pkg", ["^v[0-9]+$"], [], {
    useRegex: true
  });

  assert.deepEqual(wildcardPlan.directTargetTags, ["release-1"]);
  assert.deepEqual(regexPlan.directTargetTags, ["v12"]);

  database.close();
});
