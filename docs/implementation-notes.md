# Implementation Notes

This document tracks the current implementation plan, decisions, and completed increments for
`ghcr-manager`.

## Current Direction

- Runtime and implementation language: TypeScript on Node.js.
- Repository shape: one project containing shared core logic, a local CLI, and a thin GitHub
  Action wrapper.
- Storage model: local SQLite database per run.
- Scope for the first usable increment: read-only package import and planning summary.

## Why TypeScript

- Keeps the future GitHub Action, CLI, and any later UI in one language.
- Avoids a likely split where the action is Node-based while the core is Python.
- Fits the product direction better than optimizing only for the fastest prototype.

## Narrow V1 Plan

1. Add a TypeScript project skeleton with build, lint, and test commands.
2. Add a SQLite schema plus a small repository layer for package versions, tags, manifests, and
   manifest edges.
3. Add a CLI with these initial commands:
   - `init-db`
   - `scan` using a local JSON snapshot file as the initial input source
   - `plan-summary`
4. Add a thin composite GitHub Action wrapper that invokes the same CLI.
5. Add focused tests for schema creation, import, and planning behavior.

## Non-Goals For This Increment

- Live GitHub API or GHCR ingestion.
- Deletion execution.
- Multi-package orchestration.
- Any UI beyond CLI and action wiring.
- Feature parity with existing cleanup actions.

## Progress Log

### 2026-04-28

- Decided to use TypeScript instead of Python after reviewing long-term product shape.
- Chosen first increment: real SQLite-backed core plus fixture-backed import flow.
- Added the initial TypeScript package, build scripts, and test setup.
- Added SQLite schema and repository modules for package scans.
- Added the first CLI commands: `init-db`, `scan`, and `plan-summary`.
- Added a composite GitHub Action wrapper that invokes the shared CLI code.
- Added one representative package snapshot fixture and a planner test.

## Next Increment

1. Replace or complement the snapshot-file scan path with a real GitHub Packages and GHCR ingest
   adapter.
2. Improve planner output so it explains why versions are protected or deletable.
3. Add more planner tests for multi-arch images, referrers, and explicit tag exclusion cases.
4. Revisit action packaging after the live ingest path exists.
