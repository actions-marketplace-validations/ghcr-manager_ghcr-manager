import assert from "node:assert/strict";
import test from "node:test";
import { handleUntag } from "../../src/cli/_untag-command.js";

test("handleUntag requires at least one tag", async () => {
  await assert.rejects(
    () => handleUntag(["--owner", "acme", "--package", "example", "--token", "token"]),
    /missing required option: --tag/
  );
});

test("handleUntag dry-run resolves matching tags without mutating GHCR", async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const writes: string[] = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "https://api.github.com/users/acme") {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        async json() {
          return { type: "Organization" };
        }
      } as Response;
    }
    if (url === "https://api.github.com/orgs/acme/packages/container/example/versions?per_page=100&page=1") {
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
                  tags: ["keep-me", "latest"]
                }
              }
            }
          ];
        }
      } as Response;
    }

    throw new Error(`unexpected fetch during dry-run: ${url} ${init?.method ?? "GET"}`);
  };
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    assert.equal(
      await handleUntag([
        "--owner",
        "acme",
        "--package",
        "example",
        "--token",
        "token",
        "--dry-run",
        "--tag",
        "latest"
      ]),
      0
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }

  const summary = JSON.parse(writes[0] as string) as {
    dryRun: boolean;
    roots: Array<{ versionId: number; digest: string; tags: string[] }>;
    untaggedTags: unknown[];
  };
  assert.equal(summary.dryRun, true);
  assert.deepEqual(summary.roots, [
    {
      versionId: 101,
      digest: "sha256:root-a",
      tags: ["latest"]
    }
  ]);
  assert.deepEqual(summary.untaggedTags, []);
});

test("handleUntag removes tags and verifies they disappear", async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const writes: string[] = [];
  let latestVisible = true;
  let detachedManifestJson = "";

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "https://api.github.com/users/acme") {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        async json() {
          return { type: "Organization" };
        }
      } as Response;
    }
    if (url.startsWith("https://ghcr.io/token")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        async json() {
          return { token: "registry-token" };
        }
      } as Response;
    }
    if (url === "https://ghcr.io/v2/acme/example/manifests/sha256:root-a") {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/vnd.oci.image.manifest.v1+json" }),
        async json() {
          return {
            schemaVersion: 2,
            mediaType: "application/vnd.oci.image.manifest.v1+json",
            config: { mediaType: "application/vnd.oci.image.config.v1+json", digest: "sha256:config", size: 1 },
            layers: []
          };
        }
      } as Response;
    }
    if (url === "https://ghcr.io/v2/acme/example/manifests/latest") {
      detachedManifestJson = typeof init?.body === "string" ? init.body : "";
      return {
        ok: true,
        status: 201,
        headers: new Headers(),
        async json() {
          return {};
        }
      } as Response;
    }
    if (url === "https://api.github.com/orgs/acme/packages/container/example/versions?per_page=100&page=1") {
      if (latestVisible) {
        const detachedDigest = detachedManifestJson ? `sha256:${await _sha256(detachedManifestJson)}` : "sha256:root-a";
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          async json() {
            return [
              {
                id: 101,
                name: "sha256:root-a",
                metadata: { container: { tags: ["latest"] } }
              },
              {
                id: 202,
                name: detachedDigest,
                metadata: { container: { tags: ["latest"] } }
              }
            ];
          }
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        async json() {
          return [];
        }
      } as Response;
    }
    if (url === "https://api.github.com/orgs/acme/packages/container/example/versions/202") {
      latestVisible = false;
      return {
        ok: true,
        status: 204,
        headers: new Headers(),
        async json() {
          return {};
        }
      } as Response;
    }

    throw new Error(`unexpected fetch: ${url} ${init?.method ?? "GET"}`);
  };
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    assert.equal(
      await handleUntag(["--owner", "acme", "--package", "example", "--token", "token", "--tag", "latest"]),
      0
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }

  const summary = JSON.parse(writes[0] as string) as {
    dryRun: boolean;
    untaggedTags: Array<{ tag: string }>;
  };
  assert.equal(summary.dryRun, false);
  assert.deepEqual(
    summary.untaggedTags.map((operation) => operation.tag),
    ["latest"]
  );
});

async function _sha256(value: string): Promise<string> {
  const crypto = await import("node:crypto");
  return crypto.createHash("sha256").update(value).digest("hex");
}
