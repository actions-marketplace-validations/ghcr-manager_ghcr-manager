import assert from "node:assert/strict";
import test from "node:test";
import { loadDeletePlan, resolvePlanCommandInputs } from "../../src/cli/_planner-options.js";

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

test("resolvePlanCommandInputs rejects missing selectors and conflicting selector families", () => {
  assert.throws(
    () => resolvePlanCommandInputs(["--db", "scan.sqlite", "--owner", "acme", "--package", "example"]),
    /missing required cleanup selector/
  );
  assert.throws(
    () =>
      resolvePlanCommandInputs([
        "--db",
        "scan.sqlite",
        "--owner",
        "acme",
        "--package",
        "example",
        "--delete-untagged",
        "--keep-n-tagged",
        "1"
      ]),
    /plan currently supports exactly one selector family/
  );
});

test("resolvePlanCommandInputs rejects repeated keep and older-than options", () => {
  assert.throws(
    () =>
      resolvePlanCommandInputs([
        "--db",
        "scan.sqlite",
        "--owner",
        "acme",
        "--package",
        "example",
        "--keep-n-tagged",
        "1",
        "--keep-n-tagged",
        "2"
      ]),
    /--keep-n-tagged may only be provided once/
  );
  assert.throws(
    () =>
      resolvePlanCommandInputs([
        "--db",
        "scan.sqlite",
        "--owner",
        "acme",
        "--package",
        "example",
        "--delete-untagged",
        "--older-than",
        "1 day",
        "--older-than",
        "2 days"
      ]),
    /--older-than may only be provided once/
  );
});

test("resolvePlanCommandInputs rejects invalid keep counts and parses older-than", () => {
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
        "nope"
      ]),
    /--keep-n-untagged must be a non-negative integer/
  );

  const inputs = resolvePlanCommandInputs([
    "--db",
    "scan.sqlite",
    "--owner",
    "acme",
    "--package",
    "example",
    "--keep-n-tagged",
    "0",
    "--older-than",
    "2 days"
  ]);
  assert.equal(inputs.keepNTagged, 0);
  assert.equal(inputs.olderThan, "2 days");
  assert.match(inputs.cutoffTimestamp ?? "", /^\d{4}-\d{2}-\d{2}T/);
});

test("loadDeletePlan dispatches the expected repository method for each selector family", () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const repository = {
    getKeepNUntaggedPlanWithCutoff(...args: unknown[]) {
      calls.push({ method: "keep-untagged", args });
      return { source: "keep-untagged" };
    },
    getDeleteUntaggedPlanWithCutoff(...args: unknown[]) {
      calls.push({ method: "delete-untagged", args });
      return { source: "delete-untagged" };
    },
    getKeepNTaggedPlanWithCutoff(...args: unknown[]) {
      calls.push({ method: "keep-tagged", args });
      return { source: "keep-tagged" };
    },
    getDeleteTagsPlanWithCutoff(...args: unknown[]) {
      calls.push({ method: "delete-tags", args });
      return { source: "delete-tags" };
    }
  } as unknown as Parameters<typeof loadDeletePlan>[0];

  assert.deepEqual(
    loadDeletePlan(repository, {
      databasePath: "scan.sqlite",
      owner: "acme",
      packageName: "example",
      deleteTags: [],
      deleteTagsRequested: false,
      deleteGhostImages: false,
      deletePartialImages: false,
      deleteOrphanedImages: false,
      excludeTags: [],
      deleteUntagged: false,
      useRegex: false,
      keepNUntagged: 2,
      olderThan: "1 day",
      cutoffTimestamp: "2026-05-16T00:00:00.000Z"
    }),
    { source: "keep-untagged" }
  );
  assert.deepEqual(
    loadDeletePlan(repository, {
      databasePath: "scan.sqlite",
      owner: "acme",
      packageName: "example",
      deleteTags: [],
      deleteTagsRequested: false,
      deleteGhostImages: false,
      deletePartialImages: false,
      deleteOrphanedImages: false,
      excludeTags: [],
      deleteUntagged: true,
      useRegex: false
    }),
    { source: "delete-untagged" }
  );
  assert.deepEqual(
    loadDeletePlan(repository, {
      databasePath: "scan.sqlite",
      owner: "acme",
      packageName: "example",
      deleteTags: [],
      deleteTagsRequested: false,
      deleteGhostImages: false,
      deletePartialImages: false,
      deleteOrphanedImages: false,
      excludeTags: [],
      deleteUntagged: false,
      useRegex: false,
      keepNTagged: 1
    }),
    { source: "keep-tagged" }
  );
  assert.deepEqual(
    loadDeletePlan(repository, {
      databasePath: "scan.sqlite",
      owner: "acme",
      packageName: "example",
      deleteTags: ["latest"],
      deleteTagsRequested: true,
      deleteGhostImages: false,
      deletePartialImages: false,
      deleteOrphanedImages: false,
      excludeTags: ["keep-*"],
      deleteUntagged: false,
      useRegex: false,
      keepNTagged: 1
    }),
    { source: "delete-tags" }
  );

  assert.deepEqual(
    calls.map((call) => call.method),
    ["keep-untagged", "delete-untagged", "keep-tagged", "delete-tags"]
  );
});
