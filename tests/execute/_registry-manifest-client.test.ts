import assert from "node:assert/strict";
import test from "node:test";
import {
  loadRegistryManifestByDigest,
  putRegistryManifestForTag
} from "../../src/execute/_registry-manifest-client.js";

test("loadRegistryManifestByDigest loads a manifest document", async () => {
  const manifest = await loadRegistryManifestByDigest(
    "acme",
    "example",
    "sha256:source",
    "registry-token",
    {
      debug() {},
      info() {},
      warn() {},
      error() {}
    },
    {
      registryBaseUrl: "https://ghcr.example.test",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/vnd.oci.image.manifest.v1+json" }),
        async json() {
          return {
            schemaVersion: 2,
            mediaType: "application/vnd.oci.image.manifest.v1+json",
            config: { mediaType: "application/vnd.oci.image.config.v1+json" },
            layers: []
          };
        }
      })
    }
  );

  assert.equal(manifest.digest, "sha256:source");
  assert.equal(manifest.mediaType, "application/vnd.oci.image.manifest.v1+json");
});

test("putRegistryManifestForTag returns the local content digest", async () => {
  const digest = await putRegistryManifestForTag(
    "acme",
    "example",
    "latest",
    "application/vnd.oci.image.manifest.v1+json",
    '{"schemaVersion":2}\n',
    "registry-token",
    {
      debug() {},
      info() {},
      warn() {},
      error() {}
    },
    {
      registryBaseUrl: "https://ghcr.example.test",
      fetchImpl: async () => ({
        ok: true,
        status: 201,
        headers: new Headers(),
        async json() {
          return {};
        }
      })
    }
  );

  assert.match(digest, /^sha256:[a-f0-9]{64}$/);
});

test("loadRegistryManifestByDigest falls back to response content type for media type", async () => {
  const manifest = await loadRegistryManifestByDigest(
    "acme",
    "example",
    "sha256:source",
    "registry-token",
    {
      debug() {},
      info() {},
      warn() {},
      error() {}
    },
    {
      registryBaseUrl: "https://ghcr.example.test",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/vnd.oci.artifact.manifest.v1+json" }),
        async json() {
          return { schemaVersion: 2 };
        }
      })
    }
  );

  assert.equal(manifest.mediaType, "application/vnd.oci.artifact.manifest.v1+json");
});

test("loadRegistryManifestByDigest rejects responses without any media type", async () => {
  await assert.rejects(
    () =>
      loadRegistryManifestByDigest(
        "acme",
        "example",
        "sha256:source",
        "registry-token",
        {
          debug() {},
          info() {},
          warn() {},
          error() {}
        },
        {
          registryBaseUrl: "https://ghcr.example.test",
          fetchImpl: async () => ({
            ok: true,
            status: 200,
            headers: new Headers(),
            async json() {
              return { schemaVersion: 2 };
            }
          })
        }
      ),
    /manifest response for sha256:source did not include a media type/
  );
});

test("loadRegistryManifestByDigest surfaces non-retryable HTTP failures", async () => {
  await assert.rejects(
    () =>
      loadRegistryManifestByDigest(
        "acme",
        "example",
        "sha256:source",
        "registry-token",
        {
          debug() {},
          info() {},
          warn() {},
          error() {}
        },
        {
          registryBaseUrl: "https://ghcr.example.test",
          fetchImpl: async () => ({
            ok: false,
            status: 404,
            headers: new Headers({ "content-type": "application/json" }),
            async json() {
              return { message: "manifest unknown" };
            }
          })
        }
      ),
    /GHCR manifest request for sha256:source failed - status 404 - manifest unknown/
  );
});

test("putRegistryManifestForTag surfaces transport failures", async () => {
  await assert.rejects(
    () =>
      putRegistryManifestForTag(
        "acme",
        "example",
        "latest",
        "application/vnd.oci.image.manifest.v1+json",
        '{"schemaVersion":2}\n',
        "registry-token",
        {
          debug() {},
          info() {},
          warn() {},
          error() {}
        },
        {
          registryBaseUrl: "https://ghcr.example.test",
          fetchImpl: async () => {
            throw new TypeError("fetch failed", {
              cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" })
            });
          }
        }
      ),
    /GHCR manifest put request for tag latest failed - fetch failed/
  );
});
