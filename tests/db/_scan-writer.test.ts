import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase, ScanWriter, SnapshotRepository } from "../../src/db/index.js";

test("scan writer stores scan metadata and rows incrementally", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new SnapshotRepository(database);

  writer.resetScan("acme/example", "2026-04-20T12:00:00.000Z");
  writer.insertPackageVersion({
    versionId: 1,
    digest: "sha256:index",
    createdAt: "2026-04-20T10:00:00.000Z",
    updatedAt: "2026-04-20T10:00:00.000Z",
  });
  writer.insertTag({
    tag: "latest",
    digest: "sha256:index",
    versionId: 1,
  });
  writer.insertManifest({
    digest: "sha256:index",
    mediaType: "application/vnd.oci.image.index.v1+json",
  });
  writer.insertManifestEdge({
    parentDigest: "sha256:index",
    childDigest: "sha256:child",
    edgeKind: "image-child",
  });

  assert.equal(repository.getPackageMetadata().packageName, "acme/example");
  assert.equal(repository.countPackageVersions(), 1);
  assert.equal(repository.countTags(), 1);
  assert.equal(repository.countManifests(), 1);
  assert.equal(repository.countManifestEdges(), 1);

  database.close();
});
