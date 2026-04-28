import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("action main exits with an error when INPUT_COMMAND is missing", async () => {
  await assert.rejects(
    () =>
      execFileAsync("node", ["--import", "tsx", "src/action/_main.ts"], {
        cwd: process.cwd(),
        env: { ...process.env, INPUT_COMMAND: "" },
      }),
    /missing action input: command/,
  );
});
