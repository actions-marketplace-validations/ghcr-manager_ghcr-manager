import assert from "node:assert/strict";
import test from "node:test";
import { loadManifestGraph } from "../../../src/ingest/github/_manifest-client.js";

test("manifest client maps child and referrer edges", async () => {
  const manifest = await loadManifestGraph(
    async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/vnd.oci.image.index.v1+json" }),
      async json() {
        return {
          mediaType: "application/vnd.oci.image.index.v1+json",
          manifests: [
            {
              digest: "sha256:child",
              mediaType: "application/vnd.oci.image.manifest.v1+json",
            },
          ],
          subject: {
            digest: "sha256:subject",
          },
        };
      },
    }),
    "https://ghcr.test",
    "sha256:index",
    { owner: "acme", packageName: "example", token: "token" },
  );

  assert.equal(manifest.record.digest, "sha256:index");
  assert.deepEqual(manifest.edgeRecords, [
    { parentDigest: "sha256:index", childDigest: "sha256:child", edgeKind: "image-child" },
    { parentDigest: "sha256:subject", childDigest: "sha256:index", edgeKind: "referrer" },
  ]);
});
