import assert from "node:assert/strict";
import test from "node:test";
import { buildHttpErrorMessage, isRetryableStatus } from "../../src/execute/_http.js";

test("execute http helper identifies retryable statuses", () => {
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(404), false);
});

test("execute http helper formats json error details", async () => {
  const message = await buildHttpErrorMessage(
    {
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      async json() {
        return {
          message: "Not Found",
          documentation_url: "https://docs.example.test"
        };
      }
    },
    "fallback"
  );

  assert.equal(message, "fallback - status 404 - Not Found - https://docs.example.test");
});
