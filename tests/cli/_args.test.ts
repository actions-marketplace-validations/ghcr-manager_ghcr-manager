import assert from "node:assert/strict";
import test from "node:test";
import { collectRepeatedOption, findOption, requireOption, resolveGitHubToken } from "../../src/cli/_args.js";

test("findOption and requireOption read single-value options", () => {
  const args = ["--db", "scan.sqlite", "--source", "file"];
  assert.equal(findOption(args, "--db"), "scan.sqlite");
  assert.equal(requireOption(args, "--source"), "file");
});

test("collectRepeatedOption reads repeated options in order", () => {
  const args = ["--exclude-tag", "one", "--exclude-tag", "two"];
  assert.deepEqual(collectRepeatedOption(args, "--exclude-tag"), ["one", "two"]);
});

test("resolveGitHubToken prefers CLI input over the environment", () => {
  process.env.GITHUB_TOKEN = "env-token";
  assert.equal(resolveGitHubToken(["--token", "cli-token"]), "cli-token");
});

test("resolveGitHubToken falls back to the environment", () => {
  process.env.GITHUB_TOKEN = "env-token";
  assert.equal(resolveGitHubToken([]), "env-token");
});

test("requireOption throws for a missing value", () => {
  assert.throws(() => requireOption([], "--db"), /missing required option: --db/);
});
