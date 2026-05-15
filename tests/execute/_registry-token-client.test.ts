import assert from "node:assert/strict";
import test from "node:test";
import { loadRegistryPushToken } from "../../src/execute/_registry-token-client.js";

test("loadRegistryPushToken requests a push-capable token", async () => {
  const calls: string[] = [];
  const token = await loadRegistryPushToken(
    "acme",
    "example",
    "github-token",
    {
      debug() {},
      info() {},
      warn() {},
      error() {}
    },
    {
      registryBaseUrl: "https://ghcr.example.test",
      fetchImpl: async (input) => {
        calls.push(String(input));
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          async json() {
            return { token: "registry-token" };
          }
        };
      }
    }
  );

  assert.equal(token, "registry-token");
  assert.deepEqual(calls, [
    "https://ghcr.example.test/token?service=ghcr.example.test&scope=repository%3Aacme%2Fexample%3Apull%2Cpush"
  ]);
});
