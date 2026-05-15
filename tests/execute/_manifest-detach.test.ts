import assert from "node:assert/strict";
import test from "node:test";
import { buildDetachedManifestClone } from "../../src/execute/_manifest-detach.js";

test("buildDetachedManifestClone adds a detach annotation for OCI manifests", () => {
  const manifest = JSON.stringify({
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    config: {
      mediaType: "application/vnd.oci.image.config.v1+json",
      digest: "sha256:config",
      size: 1
    },
    layers: []
  });

  const clone = buildDetachedManifestClone(manifest, "application/vnd.oci.image.manifest.v1+json", {
    detachedTag: "latest",
    sourceDigest: "sha256:source"
  });

  const parsed = JSON.parse(clone) as { annotations?: Record<string, string> };
  assert.equal(parsed.annotations?.["io.github.ghcr-manager.detached-tag"], "latest sha256:source");
  assert.match(clone, /\n$/);
});

test("buildDetachedManifestClone keeps docker manifests schema-equivalent", () => {
  const manifest = JSON.stringify({
    schemaVersion: 2,
    mediaType: "application/vnd.docker.distribution.manifest.v2+json",
    config: {
      mediaType: "application/vnd.docker.container.image.v1+json",
      digest: "sha256:config",
      size: 1
    },
    layers: []
  });

  const clone = buildDetachedManifestClone(manifest, "application/vnd.docker.distribution.manifest.v2+json", {
    detachedTag: "latest",
    sourceDigest: "sha256:source"
  });

  assert.equal(JSON.parse(clone).schemaVersion, 2);
  assert.equal("annotations" in JSON.parse(clone), false);
  assert.notEqual(clone, manifest);
});
