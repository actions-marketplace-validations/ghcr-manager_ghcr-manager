import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase, ScanWriter, SnapshotRepository } from "../../src/db/index.js";

test("scan writer stores scan metadata and rows incrementally", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const repository = new SnapshotRepository(database);
  const previousServerUrl = process.env.GITHUB_SERVER_URL;
  const previousRepository = process.env.GITHUB_REPOSITORY;
  const previousRunId = process.env.GITHUB_RUN_ID;
  process.env.GITHUB_SERVER_URL = "https://github.com";
  process.env.GITHUB_REPOSITORY = "acme/example-repo";
  process.env.GITHUB_RUN_ID = "123456";

  try {
    writer.startScan("acme", "example", "2026-04-20T12:00:00.000Z", {
      rawJson: JSON.stringify({ visibility: "private" })
    });
    writer.insertPackageVersion({
      versionId: 1,
      createdAt: "2026-04-20T10:00:00.000Z",
      updatedAt: "2026-04-20T10:00:00.000Z"
    });
    writer.insertTag({
      tag: "latest",
      versionId: 1
    });
    writer.insertManifest({
      versionId: 1,
      digest: "sha256:index",
      manifestKind: "image_index",
      mediaType: "application/vnd.oci.image.index.v1+json"
    });
    writer.insertPackageVersion({
      versionId: 2,
      createdAt: "2026-04-20T10:00:00.000Z",
      updatedAt: "2026-04-20T10:00:00.000Z"
    });
    writer.insertManifest({
      versionId: 2,
      digest: "sha256:child",
      manifestKind: "image_manifest",
      mediaType: "application/vnd.oci.image.manifest.v1+json"
    });
    writer.insertManifestEdge({
      parentDigest: "sha256:index",
      childDigest: "sha256:child",
      edgeKind: "image-child"
    });
    writer.rebuildManifestReachability();
    writer.markScanCompleted("2026-04-20T12:00:01.000Z");
    const scanId = writer.getActiveScanId();

    const metadata = repository.getPackageMetadata(scanId);
    const scanRow = database
      .prepare(
        `
          SELECT package_metadata_json, github_actions_run_url
          FROM package_scans
          WHERE scan_id = ?
        `
      )
      .get(scanId) as {
      package_metadata_json: string | null;
      github_actions_run_url: string | null;
    };
    assert.equal(metadata.owner, "acme");
    assert.equal(metadata.packageName, "example");
    assert.deepEqual(JSON.parse(scanRow.package_metadata_json ?? ""), { visibility: "private" });
    assert.equal(scanRow.github_actions_run_url, "https://github.com/acme/example-repo/actions/runs/123456");
    assert.equal(repository.countPackageVersions(scanId), 2);
    assert.equal(repository.countTags(scanId), 1);
    assert.equal(repository.countManifests(scanId), 2);
    assert.equal(repository.countManifestEdges(scanId), 1);
    assert.equal(
      (database.prepare("SELECT COUNT(*) AS total FROM manifest_reachability").get() as { total: number }).total,
      3
    );
  } finally {
    _restoreEnv("GITHUB_SERVER_URL", previousServerUrl);
    _restoreEnv("GITHUB_REPOSITORY", previousRepository);
    _restoreEnv("GITHUB_RUN_ID", previousRunId);
    database.close();
  }
});

test("markScanFailed records failed status and completion timestamp", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);

  writer.startScan("acme", "example", "2026-04-20T12:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  writer.markScanFailed("2026-04-20T12:00:42.000Z");
  const scanId = writer.getActiveScanId();

  const scanRow = database
    .prepare(
      `
        SELECT owner, package_name, scan_uuid, status, scan_completed_at
        FROM package_scans
        WHERE scan_id = ?
      `
    )
    .get(scanId) as {
    owner: string;
    package_name: string;
    scan_uuid: string;
    status: string;
    scan_completed_at: string | null;
  };

  assert.equal(scanRow.owner, "acme");
  assert.equal(scanRow.package_name, "example");
  assert.match(scanRow.scan_uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(scanRow.status, "failed");
  assert.equal(scanRow.scan_completed_at, "2026-04-20T12:00:42.000Z");

  database.close();
});

function _restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
