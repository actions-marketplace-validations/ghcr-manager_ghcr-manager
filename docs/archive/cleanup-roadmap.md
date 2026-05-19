# GHCR Cleanup Roadmap

This document turns the broad "re-implement `dataaxiom/ghcr-cleanup-action` behavior" goal into a sequence of small,
reviewable subtasks.

## Goal

Build a DB-first cleanup planner and executor for large GHCR packages that:

- stays safe for multi-arch images and referrers
- scales to very large package-version sets
- exposes queryable, debuggable intermediate state
- can be driven from both the CLI and a thin GitHub Action wrapper

## Working Assumptions

- The current ingest pipeline and SQLite model remain the base; this is not a rewrite from scratch.
- Behavioral parity should be approached selectively: match the important cleanup semantics, not the original internal
  structure or every historical input shape.
- Planning comes before deletion execution. A stable dry-run model is the gate for any destructive step.

## Proposed Subtasks

### 1. Define cleanup semantics

Deliverable:

- one short design note that states what "delete" means in this project
- one explicit mapping of supported inputs and behaviors borrowed from `dataaxiom/ghcr-cleanup-action`
- one list of intentionally deferred or rejected behaviors

Acceptance focus:

- the deletion unit is explicit: package version IDs, tags, manifest closures, or a mix
- edge cases such as sibling wrapper indexes, referrers, and untagged roots have written expected behavior

### 2. Lock the planner data model

Deliverable:

- planner-facing terminology for:
  - direct target tags
  - retained tags
  - closure manifests
  - blocked manifests
  - collateral tags
- SQL/query strategy for deriving those sets from the existing schema

Acceptance focus:

- planner outputs are based on manifest closures and tag overlap, not only tag-name heuristics
- every planner output set can be inspected in SQLite for debugging

### 3. Add read-only planner outputs

Deliverable:

- CLI output for a deletion plan without executing it
- machine-readable result shape that separates:
  - requested deletions
  - protected items
  - blocked items
  - collateral impact

Acceptance focus:

- a user can explain "why was this kept?" and "why would this be touched?" from the plan output alone
- output stays compact enough for action logs

### 4. Cover registry edge cases with tests

Deliverable:

- fixture or test-registry coverage for:
  - multi-arch wrapper indexes
  - sibling wrapper indexes
  - referrers and attestations
  - explicit tag exclusions
  - untagged versions

Acceptance focus:

- tests encode cleanup semantics before registry mutation is implemented
- current open questions around wrapper-index behavior are resolved by tests, not by comments or memory

### 5. Prototype execution against the test registry

Deliverable:

- a narrow execution path that applies an already computed plan to the test registry only
- clear failure reporting and post-delete verification reads

Acceptance focus:

- execution does not invent new planner logic
- destructive behavior is gated behind the already tested dry-run plan

### 6. Package the action interface

Deliverable:

- thin action inputs mapped onto the planner/executor
- action summaries for dry-run and execution modes

Acceptance focus:

- CLI remains the source of truth
- action-specific code stays minimal

## Suggested Session Structure

Each future session should aim to complete one subtask or one tightly related slice of a subtask.

Recommended order:

1. semantics note
2. planner data model
3. read-only plan output
4. edge-case tests
5. execution prototype
6. action packaging

## Documentation Across Sessions

Use three layers:

1. `docs/implementation-notes.md`
   - canonical handoff document
   - keep the active checklist and next plan current
   - record decisions that change architecture or workflow shape
2. `docs/cleanup-roadmap.md`
   - stable roadmap for this cleanup track
   - update only when scope, ordering, or acceptance criteria change
3. `docs/ai/tasks/`
   - one task brief per concrete session-sized increment
   - each task should reference the roadmap section it advances

## Definition Of Done For The Cleanup Track

The cleanup track is ready for real use when all the following are true:

- dry-run planning is stable and explains retention/deletion decisions
- edge-case coverage exists for multi-arch and referrer-heavy layouts
- execution has been proven against the test registry
- the action wrapper is only orchestration around the shared CLI behavior
