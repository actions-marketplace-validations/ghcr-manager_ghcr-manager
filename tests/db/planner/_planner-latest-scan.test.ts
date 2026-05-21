import assert from "node:assert/strict";
import test from "node:test";
import { PlannerLatestScan } from "../../../src/db/planner/_planner-latest-scan.js";
import { ScanWriter, openDatabase } from "../../../src/db/index.js";

test("planner latest scan returns the latest completed scan row", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);
  const latestScan = new PlannerLatestScan({
    get<T>(sql: string, params: Array<number | string>) {
      return database.prepare(sql).get(...params) as T | undefined;
    }
  });

  writer.startScan("acme", "pkg", "2026-05-10T10:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  writer.markScanCompleted("2026-05-10T10:00:00.000Z");

  writer.startScan("acme", "pkg", "2026-05-11T10:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  writer.markScanCompleted("2026-05-11T10:00:00.000Z");

  const scan = latestScan.get("acme", "pkg");

  assert.equal(scan.owner, "acme");
  assert.equal(scan.package_name, "pkg");
  assert.equal(scan.scan_id, 2);
  assert.equal(scan.scan_completed_at, "2026-05-11T10:00:00.000Z");

  database.close();
});

test("planner latest scan rejects missing completed scans", () => {
  const database = openDatabase(":memory:");
  const latestScan = new PlannerLatestScan({
    get<T>(sql: string, params: Array<number | string>) {
      return database.prepare(sql).get(...params) as T | undefined;
    }
  });

  assert.throws(
    () => latestScan.get("acme", "missing"),
    /database does not contain completed package scan for acme\/missing/
  );

  database.close();
});
