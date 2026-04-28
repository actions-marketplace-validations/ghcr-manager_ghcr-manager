import assert from "node:assert/strict";
import test from "node:test";
import { main } from "../../src/cli/index.js";

test("main returns 1 when no command is provided", async () => {
  assert.equal(await main([]), 1);
});

test("main throws for an unknown command", async () => {
  await assert.rejects(() => main(["unknown"]), /unknown command: unknown/);
});
