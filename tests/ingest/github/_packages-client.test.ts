import assert from "node:assert/strict";
import test from "node:test";
import { buildTags, loadPackageVersions } from "../../../src/ingest/github/_packages-client.js";

test("package client loads versions and derives tags", async () => {
  const versions = await loadPackageVersions(
    async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      async json() {
        return [
          {
            id: 2,
            name: "sha256:b",
            created_at: "2026-04-01T00:00:00.000Z",
            updated_at: "2026-04-01T00:00:00.000Z",
            metadata: { container: { tags: ["latest"] } },
          },
        ];
      },
    }),
    "https://api.github.test",
    { owner: "acme", packageName: "example", token: "token" },
  );

  assert.deepEqual(
    versions.map((version) => version.versionId),
    [2],
  );
  assert.deepEqual(buildTags(versions), [{ tag: "latest", digest: "sha256:b", versionId: 2 }]);
});
