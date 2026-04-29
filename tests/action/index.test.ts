import assert from "node:assert/strict";
import test from "node:test";
import { runAction } from "../../src/action/index.js";

test("runAction rejects when INPUT_COMMAND is missing", async () => {
  await assert.rejects(() => runAction({}), /missing action input: command/);
});

test("runAction forwards action inputs to the CLI", async () => {
  let receivedArgv: string[] | undefined;

  await runAction(
    {
      INPUT_COMMAND: "scan",
      RUNNER_TEMP: "/tmp/runner",
      INPUT_OWNER: "acme",
      INPUT_PACKAGE: "example",
      INPUT_TOKEN: "token",
      INPUT_EXCLUDE_TAGS: "keep-me, latest ",
    },
    async (argv) => {
      receivedArgv = argv;
      return 0;
    },
  );

  assert.deepEqual(receivedArgv, [
    "scan",
    "--db",
    "/tmp/runner/ghcr-manager/acme__example.sqlite",
    "--owner",
    "acme",
    "--package",
    "example",
    "--token",
    "token",
    "--exclude-tag",
    "keep-me",
    "--exclude-tag",
    "latest",
  ]);
});
