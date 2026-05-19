# Cleanup Semantics

This note fixes the intended cleanup behavior for the current cleanup planner and executor.

It does not try to document every CLI or action input. It defines what the cleanup-related inputs mean.

## Scope

These semantics are for one selected GHCR package snapshot in one SQLite scan.

The database may contain many scans and many packages. Cleanup planning always chooses one exact completed scan as its
input.

They assume the current repo model:

- `package_versions` is the GitHub Packages view of deletable units
- `tags` tells us which package-version-backed digests are tagged
- `manifests` stores the fetched root manifest for each package version
- `manifest_edges` and `manifest_reachability` describe known in-package closure

This note is about `cleanup`.

Direct `untag` also exists as a separate public command, but it is outside this document because it does not use the
cleanup planner or a scan DB.

## Core Decision

Cleanup planning is rooted in package-version-backed manifests, not in free-floating tags and not in arbitrary internal
child manifests.

In practice that means:

- user-facing selectors mention tags or digests
- the planner resolves those selectors to root digests from `manifests`
- the planner reasons about deletion safety using the full manifest closure below each selected root digest
- execution deletes GitHub package versions and uses explicit untag operations for partial tag matches

## Deletion Units

There are two distinct units, and they must stay distinct in the planner output.

### 1. Tag intent

This is the user's requested scope, for example:

- delete tag `pr-123`
- exclude tag `latest`
- keep the newest 10 tagged roots

Tag intent is not itself a registry mutation. It is selection input.

### 2. Execution unit

Actual registry mutations operate on one of these:

- untag one specific tag from a multi-tagged root
- delete one GitHub package version whose root digest is no longer retained

The planner must therefore distinguish:

- direct target tags
- roots that become fully deletable
- roots that would only be partially affected by untagging

## Root And Closure Semantics

A root is a digest in `manifests` that came directly from one `package_versions` row.

A closure is the root plus every reachable descendant or attached referrer that is still inside the fetched package
manifest set.

Current planner rules are:

1. Selection happens on roots only.
2. Child manifests and referrers are never selected directly just because they are untagged.
3. If a root is deleted, its in-package closure is deleted with it.
4. A root is blocked from deletion if some manifest in its closure is still required by a retained root outside the
   candidate delete set.
5. Sibling wrapper indexes are not treated as part of each other's closure unless there is an actual
   manifest-reachability relation between them.

Rule 5 is intentional. It matches the current schema and the observed `single` / `single-amd64` / `single-arm64`
registry shape.

## Supported Cleanup Inputs

These are the core cleanup behaviors currently supported.

### `delete-tags`

- Select roots by tag match.
- Digest literals are accepted when they resolve to root digests.
- If every tag on a matched root is selected for removal, that root becomes a delete candidate.
- If only some tags on a matched root are selected, the planner must report an untag action rather than pretending the
  whole root can be deleted.

### `exclude-tags`

- Exclusions apply before all delete or keep logic.
- An excluded tag protects its root from both untag and delete actions in that plan.
- Exclusion wins over `delete-tags`, `older-than`, `keep-n-tagged`, `keep-n-untagged`, and `delete-untagged`.

### `older-than`

- This is an eligibility filter, not a deletion mode by itself.
- It applies to roots using the package version timestamp, not to child manifests independently.
- Roots newer than the cutoff are removed from the eligible planning set before keep/delete selection continues.

### `keep-n-tagged`

- Operates on tagged roots that remain eligible after exclusions and age filtering.
- Ordering is by package-version recency.
- When combined with `delete-tags`, it only applies within the matched tagged subset.
- The planner must make clear which roots were retained because of this keep rule.

### Combined `delete-tags` + `keep-n-tagged`

- This combination is accepted as one tagged-selector family, not as two unrelated cleanup requests.
- The planning scope is:
  - start from eligible tagged roots after applying `exclude-tags` and `older-than`
  - derive `direct_target_tags` from `delete-tags`
  - reduce the keep-count ranking scope to only roots touched by those matched tags
- The keep count is applied at root granularity, not at individual-tag granularity.
- If multiple matched tags resolve to the same root, that root is ranked once.
- Roots retained by the keep rule must not appear in `direct_target_roots`.
- Roots outside the matched `delete-tags` subset are unaffected by this combined mode.

Shared-root consequences:

- If a root carries both matched and unmatched tags and survives the keep rule, it remains untouched.
- If a root carries both matched and unmatched tags and falls outside the keep window, it becomes
  `selection_mode = "untag-only"`, not `delete-root`.
- A root only becomes `delete-root` when:
  - it is in the matched `delete-tags` subset
  - it is not retained by `keep-n-tagged`
  - every tag on that root is within the matched delete scope
- `exclude-tags` still protects the whole root before any keep/delete ranking happens.

Examples using the current `complex` fixture shape:

- Example: `--delete-tag gamma --keep-n-tagged 0`
  - the matched subset consists only of roots carrying `gamma`
  - roots carrying `gamma` plus additional non-matched tags become `untag-only`
  - a `gamma`-only root becomes `delete-root`
- Example: `--delete-tag gamma --keep-n-tagged 1`
  - among roots touched by `gamma`, the newest root is retained
  - older matched roots are selected
  - a selected root with additional non-`gamma` tags remains `untag-only`
- Example: `--delete-tag beta --delete-tag gamma --keep-n-tagged 1`
  - the keep ranking is computed over the union of roots touched by `beta` or `gamma`
  - a shared root tagged with both `beta-amd64` and `gamma-amd64` counts once in that ranking
  - if retained, neither of those matched tags is acted on in that plan
  - if not retained, the root is still only `untag-only` when unmatched tags remain on it
- Example: `--delete-tag beta --delete-tag gamma --exclude-tag beta-arm64 --keep-n-tagged 1`
  - any root carrying `beta-arm64` is removed before ranking
  - the keep ranking and delete selection continue only on the remaining matched subset

Planner output implications:

- `direct_target_tags` continue to represent matched delete intent, even when some of those matched tags later disappear
  from actionable roots because a whole root was retained by `keep-n-tagged`.
- `direct_target_roots` are the actionable result after combining delete-match, exclusion, age filtering, and keep
  ranking.
- This project keeps the combined policy explanation-first and set-based; it does not depend on iterative mutation order
  to be understandable.

### `delete-untagged`

- Selects untagged roots from the eligible planning set.
- "Untagged" means no tags on the root digest, not "missing from GitHub UI entirely."
- Child manifests are not independently selected by this option.

### `keep-n-untagged`

- Operates on untagged roots from the eligible planning set.
- Ordering is by package-version recency.
- A value of `0` is equivalent to `delete-untagged`.

## Explicit Non-Goals

The following behaviors are out of scope for the current product:

- multi-package expansion or package-name pattern selection
- validate-mode parity with the upstream action

### Not accepted as implicit behavior

- No destructive default equivalent to "if no options are set, delete all untagged images."

This project requires explicit cleanup intent before planning destructive actions.

## Planning Order

The planner follows this order conceptually:

1. Start from all root digests for the chosen scan.
2. Remove roots protected by `exclude-tags`.
3. Remove roots filtered out by `older-than`.
4. Build direct target tags and direct target roots from `delete-tags`, `delete-untagged`, `keep-n-tagged`, and
   `keep-n-untagged`.
5. Expand candidate root deletions into manifest closures.
6. Block any candidate closure that overlaps manifests still required by retained roots.
7. Emit separate result sets for:
   - direct target tags
   - direct target roots
   - fully deletable roots
   - blocked roots
   - collateral tags on fully deletable roots
   - manifest closure members

## Why This Differs From The Upstream Action

The upstream action mixes selector expansion, safety decisions, untagging, and package deletion while mutating live
registry state.

This project keeps those stages separate:

- SQLite is the source of truth for the dry-run plan
- planner outputs must explain why a root is deletable or blocked
- execution consumes an already-decided plan instead of re-deciding policy during deletion

## Ongoing Maintenance

Keep this note aligned with:

1. the persisted cleanup audit model
2. the live behavior locked by tests
