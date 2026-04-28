# ghcr-manager

Inspect, analyze, and manage GitHub Container Registry packages.

## Status

This repository is starting as a new public GitHub Action and companion CLI for safe GHCR cleanup and inspection, with a
focus on large packages and correct handling of multi-arch images, referrers, and attestations.

The initial design record and implementation path live in [docs/analysis-summary.md](docs/analysis-summary.md).

## Scope

Planned initial scope:

- Safe cleanup for GHCR container packages owned by GitHub organizations.
- Full package and manifest scan per run for correctness.
- Local transient database during a run to keep the implementation understandable and queryable.
- GitHub Action entrypoint for scheduled cleanup workflows.
- CLI support for local development, inspection, dry runs, and debugging.

Likely non-goals for the first version:

- Full feature parity with existing cleanup actions.
- Multi-package orchestration in one invocation.
- Complex UI or long-lived service components.

## Project Direction

The current plan is to build one project with several interfaces over the same core logic:

- Core ingest, indexing, and cleanup planning logic.
- Command-line interface for local development and debugging.
- GitHub Action wrapper for public reuse in workflows.

## References

- Base action for behavior and compatibility ideas: `dataaxiom/ghcr-cleanup-action`
- Similar action using a related manifest-aware approach: `jenskeiner/ghcr.io-container-repository-cleanup-action`
- Additional reference points with different tradeoffs:
  - `actions/delete-package-versions`
  - `snok/container-retention-policy`
