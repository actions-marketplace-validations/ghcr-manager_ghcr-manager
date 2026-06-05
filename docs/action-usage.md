# Action Usage

## Commands

- `cleanup`
- `scan`

If the main question is "what would happen?", use `cleanup` with `dry-run` first.

### `cleanup`

Use `cleanup` for registry cleanup. Add `dry-run` for a preview.

Behavior:

- always performs a pre-cleanup scan
- exposes `summary-json-path` as an action output
- optionally uploads the DB and the cleanup summary JSON as artifacts
- supports `scan-after-cleanup`

Model:

- cleanup is graph-aware and uses retained tags as the main protection boundary
- in complex shared graphs, one selected deletion can remove additional unprotected manifests to leave the remaining
  package in a correct working state
- see [Cleanup Behavior](cleanup-behavior.md)

Note: `scan-after-cleanup` only runs a second scan when cleanup actually makes changes.

Permissions:

- `dry-run` needs `packages: read`
- live cleanup needs `packages: write`
- artifact upload needs `actions: write`

### `scan`

Use `scan` to get an SQLite snapshot of one GHCR package.

Behavior:

- performs one package scan and uploads the DB as an artifact

Permissions:

- `packages: read`
- `actions: write` for the uploaded DB artifact
