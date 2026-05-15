# Test Org Setup

This document records the intended external setup for GHCR live test execution in a dedicated organization namespace.

## Purpose

Use a separate organization for destructive and scenario-based GHCR tests so test packages do not appear under the main
repository's package list.

Current intended organization:

- `gh-workflow-test`

## Configuration Names

Use these repository-level configuration names:

- variable: `GHCR_TEST_OWNER`
- secret: `GHCR_TEST_PAT`

Recommended value mapping:

- `GHCR_TEST_OWNER=gh-workflow-test`
- `GHCR_TEST_PAT=<classic PAT for a user that can administer packages in gh-workflow-test>`

## Token Type

Use a classic personal access token for now.

Required package scopes:

- `read:packages`
- `write:packages`
- `delete:packages`

Notes:

- Prefer a dedicated machine user over a personal human account.
- The token owner should have permission to create, update, and delete GHCR packages in `gh-workflow-test`.
- Keep this token scoped to test-package workflows only.

## Ownership Model

When test-org configuration is enabled, live scenario workflows should publish and mutate packages under the configured
test owner rather than the repository owner.

Intended behavior:

- publish scenario packages to `ghcr.io/<GHCR_TEST_OWNER>/...`
- delete scenario packages via the org-scoped GitHub Packages API for `GHCR_TEST_OWNER`
- scan and execute against packages owned by `GHCR_TEST_OWNER`

## Fallback Model

If test-org configuration is absent, workflows may fall back to the repository owner namespace and `github.token`.

That fallback exists for contributor convenience only. The preferred steady-state setup for live registry tests is:

- owner from `GHCR_TEST_OWNER`
- token from `GHCR_TEST_PAT`

## Scope Boundaries

This document defines only the external configuration contract:

- dedicated org name
- variable name
- secret name
- token type
- required package scopes

It intentionally does not document GitHub UI click paths.
