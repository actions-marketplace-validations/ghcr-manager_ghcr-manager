import assert from "node:assert/strict";
import test from "node:test";
import { resolvePlanCommandInputs } from "../../src/cli/_planner-options.js";

test("resolvePlanCommandInputs parses delete-untagged inputs", () => {
  const inputs = resolvePlanCommandInputs([
    "--db",
    "scan.sqlite",
    "--owner",
    "acme",
    "--package",
    "example",
    "--delete-untagged"
  ]);

  assert.equal(inputs.databasePath, "scan.sqlite");
  assert.equal(inputs.owner, "acme");
  assert.equal(inputs.packageName, "example");
  assert.equal(inputs.deleteUntagged, true);
  assert.equal(inputs.deleteGhostImages, false);
  assert.equal(inputs.deletePartialImages, false);
  assert.equal(inputs.deleteOrphanedImages, false);
  assert.equal(inputs.deleteTagsRequested, false);
});

test("resolvePlanCommandInputs rejects exclude-tag for keep-n-untagged", () => {
  assert.throws(
    () =>
      resolvePlanCommandInputs([
        "--db",
        "scan.sqlite",
        "--owner",
        "acme",
        "--package",
        "example",
        "--keep-n-untagged",
        "1",
        "--exclude-tag",
        "latest"
      ]),
    /--exclude-tag is only supported with tagged selector families/
  );
});

test("resolvePlanCommandInputs treats delete-tag selectors as wildcard patterns by default", () => {
  const inputs = resolvePlanCommandInputs([
    "--db",
    "scan.sqlite",
    "--owner",
    "acme",
    "--package",
    "example",
    "--delete-tag",
    "*latest*"
  ]);

  assert.equal(inputs.deleteTagsRequested, true);
  assert.deepEqual(inputs.deleteTags, ["*latest*"]);
  assert.equal(inputs.useRegex, false);
});

test("resolvePlanCommandInputs parses use-regex for tagged selectors", () => {
  const inputs = resolvePlanCommandInputs([
    "--db",
    "scan.sqlite",
    "--owner",
    "acme",
    "--package",
    "example",
    "--delete-tag",
    "^latest$",
    "--use-regex"
  ]);

  assert.equal(inputs.useRegex, true);
  assert.equal(inputs.deleteTagsRequested, true);
  assert.deepEqual(inputs.deleteTags, ["^latest$"]);
});

test("resolvePlanCommandInputs parses delete-ghost-images as a tagged selector family", () => {
  const inputs = resolvePlanCommandInputs([
    "--db",
    "scan.sqlite",
    "--owner",
    "acme",
    "--package",
    "example",
    "--delete-ghost-images",
    "--keep-n-tagged",
    "0"
  ]);

  assert.equal(inputs.deleteGhostImages, true);
  assert.equal(inputs.deleteTagsRequested, true);
  assert.equal(inputs.keepNTagged, 0);
  assert.deepEqual(inputs.deleteTags, []);
});

test("resolvePlanCommandInputs parses delete-partial-images as a tagged selector family", () => {
  const inputs = resolvePlanCommandInputs([
    "--db",
    "scan.sqlite",
    "--owner",
    "acme",
    "--package",
    "example",
    "--delete-partial-images",
    "--keep-n-tagged",
    "0"
  ]);

  assert.equal(inputs.deletePartialImages, true);
  assert.equal(inputs.deleteTagsRequested, true);
  assert.equal(inputs.keepNTagged, 0);
  assert.deepEqual(inputs.deleteTags, []);
});

test("resolvePlanCommandInputs parses delete-orphaned-images as a tagged selector family", () => {
  const inputs = resolvePlanCommandInputs([
    "--db",
    "scan.sqlite",
    "--owner",
    "acme",
    "--package",
    "example",
    "--delete-orphaned-images",
    "--keep-n-tagged",
    "0"
  ]);

  assert.equal(inputs.deleteOrphanedImages, true);
  assert.equal(inputs.deleteTagsRequested, true);
  assert.equal(inputs.keepNTagged, 0);
  assert.deepEqual(inputs.deleteTags, []);
});
