import assert from "node:assert/strict";
import test from "node:test";
import { buildHttpErrorMessage, type HttpErrorResponse } from "../../src/core/index.js";

test("buildHttpErrorMessage formats json error details", async () => {
  const message = await buildHttpErrorMessage(
    {
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      async json() {
        return {
          message: "Not Found",
          documentation_url: "https://docs.example.test"
        };
      }
    } satisfies HttpErrorResponse,
    "fallback"
  );

  assert.equal(message, "fallback - status 404 - Not Found - https://docs.example.test");
});

test("buildHttpErrorMessage includes auth challenge and ignores non-json bodies", async () => {
  const message = await buildHttpErrorMessage(
    {
      status: 401,
      headers: new Headers({
        "content-type": "text/plain; charset=utf-8",
        "www-authenticate": 'Bearer realm="ghcr.io"'
      }),
      async json() {
        throw new Error("should not parse");
      }
    } satisfies HttpErrorResponse,
    "fallback"
  );

  assert.equal(message, 'fallback - status 401 - www-authenticate: Bearer realm="ghcr.io"');
});
