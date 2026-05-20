import assert from "node:assert/strict";
import test from "node:test";
import { PlannerRepository, ScanWriter, openDatabase } from "../../../src/db/index.js";

test("planner repository traces SQL through the shared planner sql helper", () => {
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
    digest: "sha256:root",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.markScanCompleted("2026-05-14T10:00:00.000Z");

  const plan = repository.getDeleteUntaggedPlan("acme", "pkg");

  assert.equal(plan.directTargetRoots.length, 1);
  assert.ok(
    traceMessages.some((message) => message.includes("SELECT scan_id, owner, package_name, scan_completed_at"))
  );
  assert.ok(debugMessages.some((message) => message.includes("SQL returned 1 row(s)")));

  database.close();
});
