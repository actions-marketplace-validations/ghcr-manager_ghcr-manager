import assert from "node:assert/strict";
import test from "node:test";
import { resolveOlderThan } from "../../src/cli/_older-than.js";

test("resolveOlderThan subtracts day-based intervals", () => {
  assert.deepEqual(resolveOlderThan("30 days", new Date("2026-05-14T12:00:00.000Z")), {
    olderThan: "30 days",
    cutoffTimestamp: "2026-04-14T12:00:00.000Z"
  });
});

test("resolveOlderThan accepts singular units and months", () => {
  assert.deepEqual(resolveOlderThan("1 month", new Date("2026-05-14T12:00:00.000Z")), {
    olderThan: "1 month",
    cutoffTimestamp: "2026-04-14T12:00:00.000Z"
  });
});

test("resolveOlderThan rejects unsupported syntax", () => {
  assert.throws(
    () => resolveOlderThan("1 year 2 months", new Date("2026-05-14T12:00:00.000Z")),
    /invalid older-than interval/
  );
  assert.throws(() => resolveOlderThan("30d", new Date("2026-05-14T12:00:00.000Z")), /invalid older-than interval/);
});
