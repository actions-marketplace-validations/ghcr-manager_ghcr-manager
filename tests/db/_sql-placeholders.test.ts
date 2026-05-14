import assert from "node:assert/strict";
import test from "node:test";
import { buildInClausePlaceholders, buildTuplePlaceholders } from "../../src/db/_sql-placeholders.js";

test("buildInClausePlaceholders returns one placeholder per value", () => {
  assert.equal(buildInClausePlaceholders(1), "?");
  assert.equal(buildInClausePlaceholders(3), "?, ?, ?");
});

test("buildInClausePlaceholders rejects empty counts", () => {
  assert.throws(() => buildInClausePlaceholders(0), /valueCount must be greater than 0/);
});

test("buildTuplePlaceholders returns one tuple per row", () => {
  assert.equal(buildTuplePlaceholders(1, 2), "(?, ?)");
  assert.equal(buildTuplePlaceholders(2, 3), "(?, ?, ?), (?, ?, ?)");
});

test("buildTuplePlaceholders rejects empty dimensions", () => {
  assert.throws(() => buildTuplePlaceholders(0, 2), /rowCount must be greater than 0/);
  assert.throws(() => buildTuplePlaceholders(2, 0), /columnCount must be greater than 0/);
});
