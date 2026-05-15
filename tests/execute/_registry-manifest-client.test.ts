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
