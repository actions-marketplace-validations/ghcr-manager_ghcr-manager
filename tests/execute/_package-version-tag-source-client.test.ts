import assert from "node:assert/strict";
import test from "node:test";
import { listPackageVersionTagSources, listPresentPackageVersionIds } from "../../src/execute/index.js";

test("listPackageVersionTagSources resolves requested tags to source versions and digests", async () => {
  const matches = await listPackageVersionTagSources(
    "acme",
    "example",
    ["keep-me", "latest", "missing"],
    "token",
    {
      debug() {},
      info() {},
      warn() {},
      error() {}
    },
    {
      fetchImpl: async (input) => {
        if (input === "https://api.github.com/users/acme") {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            async json() {
              return { type: "Organization" };
            }
          };
        }

        const url = String(input);
        if (url.endsWith("page=1")) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            async json() {
              return [
                {
                  id: 101,
                  name: "sha256:root-a",
                  metadata: {
                    container: {
                      tags: ["keep-me"]
                    }
                  }
                },
                {
                  id: 102,
                  name: "sha256:root-b",
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

        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          async json() {
            return [];
          }
        };
      }
    }
  );

  assert.deepEqual(matches, [
    {
      tag: "keep-me",
      sourceVersionId: 101,
      sourceDigest: "sha256:root-a"
    },
    {
      tag: "latest",
      sourceVersionId: 102,
      sourceDigest: "sha256:root-b"
    }
  ]);
});

test("listPresentPackageVersionIds returns the subset of requested version ids still visible", async () => {
  const visibleVersionIds = await listPresentPackageVersionIds(
    "acme",
    "example",
    [101, 202, 303],
    "token",
    {
      debug() {},
      info() {},
      warn() {},
      error() {}
    },
    {
      fetchImpl: async (input) => {
        if (input === "https://api.github.com/users/acme") {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            async json() {
              return { type: "Organization" };
            }
          };
        }

        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          async json() {
            return [
              { id: 101, name: "sha256:root-a", metadata: { container: { tags: ["keep-me"] } } },
              { id: 303, name: "sha256:root-c", metadata: { container: { tags: [] } } }
            ];
          }
        };
      }
    }
  );

  assert.deepEqual(visibleVersionIds, [101, 303]);
});
