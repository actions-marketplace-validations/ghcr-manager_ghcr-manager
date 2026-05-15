import assert from "node:assert/strict";
import test from "node:test";
import { findPackageVersionByDigestAndTag } from "../../src/execute/_package-version-page-client.js";

test("findPackageVersionByDigestAndTag finds a temporary version by digest and tag", async () => {
  const calls: string[] = [];
  const versionId = await findPackageVersionByDigestAndTag(
    "acme",
    "example",
    "sha256:detached",
    "latest",
    "token",
    {
      debug() {},
      info() {},
      warn() {},
      error() {}
    },
    {
      githubApiBaseUrl: "https://api.github.test",
      fetchImpl: async (input) => {
        calls.push(String(input));
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          async json() {
            return [
              {
                id: 42,
                name: "sha256:detached",
                metadata: {
                  container: {
                    tags: ["latest"]
                  }
                }
              }
            ];
          }
        };
      }
    }
  );

  assert.equal(versionId, 42);
  assert.deepEqual(calls, [
    "https://api.github.test/orgs/acme/packages/container/example/versions?per_page=100&page=1"
  ]);
});
