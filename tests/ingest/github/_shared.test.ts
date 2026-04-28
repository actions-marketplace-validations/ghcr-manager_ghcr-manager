import assert from "node:assert/strict";
import test from "node:test";
import { acceptedManifestMediaTypes } from "../../../src/ingest/github/_shared.js";

test("shared GitHub ingest constants include OCI artifact manifests", () => {
  assert.match(acceptedManifestMediaTypes, /application\/vnd\.oci\.artifact\.manifest\.v1\+json/);
});
