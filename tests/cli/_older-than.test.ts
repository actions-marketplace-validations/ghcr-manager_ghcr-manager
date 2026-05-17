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

test("resolveOlderThan trims input, lowercases units, and supports minute or hour intervals", () => {
  assert.deepEqual(resolveOlderThan(" 15 MINUTES ", new Date("2026-05-14T12:00:00.000Z")), {
    olderThan: "15 minutes",
    cutoffTimestamp: "2026-05-14T11:45:00.000Z"
  });
  assert.deepEqual(resolveOlderThan("2 hours", new Date("2026-05-14T12:00:00.000Z")), {
    olderThan: "2 hours",
    cutoffTimestamp: "2026-05-14T10:00:00.000Z"
  });
});

test("resolveOlderThan supports week and year intervals", () => {
  assert.deepEqual(resolveOlderThan("3 weeks", new Date("2026-05-14T12:00:00.000Z")), {
    olderThan: "3 weeks",
    cutoffTimestamp: "2026-04-23T12:00:00.000Z"
  });
  assert.deepEqual(resolveOlderThan("1 year", new Date("2026-05-14T12:00:00.000Z")), {
    olderThan: "1 year",
    cutoffTimestamp: "2025-05-14T12:00:00.000Z"
  });
});

test("resolveOlderThan rejects unsupported syntax", () => {
  assert.throws(
    () => resolveOlderThan("1 year 2 months", new Date("2026-05-14T12:00:00.000Z")),
    /invalid older-than interval/
  );
  assert.throws(() => resolveOlderThan("30d", new Date("2026-05-14T12:00:00.000Z")), /invalid older-than interval/);
});
