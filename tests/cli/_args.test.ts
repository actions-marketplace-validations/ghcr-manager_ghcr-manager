import assert from "node:assert/strict";
import test from "node:test";
import {
  collectRepeatedOption,
  findOption,
  requireOption,
  resolveGitHubToken,
  resolveLogLevel
} from "../../src/cli/_args.js";

test("findOption and requireOption read single-value options", () => {
  const args = ["--db", "scan.sqlite", "--package", "example"];
  assert.equal(findOption(args, "--db"), "scan.sqlite");
  assert.equal(requireOption(args, "--package"), "example");
});

test("collectRepeatedOption reads repeated options in order", () => {
  const args = ["--exclude-tag", "one", "--exclude-tag", "two"];
  assert.deepEqual(collectRepeatedOption(args, "--exclude-tag"), ["one", "two"]);
});

test("resolveGitHubToken prefers CLI input over the environment", () => {
  assert.equal(resolveGitHubToken(["--token", "cli-token"]), "cli-token");
});

test("resolveGitHubToken requires a CLI token", () => {
  assert.throws(() => resolveGitHubToken([]), /missing required option: --token/);
});

test("requireOption throws for a missing value", () => {
  assert.throws(() => requireOption([], "--db"), /missing required option: --db/);
});

test("resolveLogLevel defaults to info and rejects unknown values", () => {
  assert.equal(resolveLogLevel([]), "info");
  assert.equal(resolveLogLevel(["--log-level", "trace"]), "trace");
  assert.equal(resolveLogLevel(["--log-level", "debug"]), "debug");
  assert.throws(() => resolveLogLevel(["--log-level", "verbose"]), /invalid log level: verbose/);
});
