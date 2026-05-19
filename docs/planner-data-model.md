# Planner Data Model

This note defines the cleanup planner result sets in human terms.

It is the bridge between [docs/cleanup-semantics.md](cleanup-semantics.md) and the persisted cleanup audit data.

It does not define final SQL text, but it does define the canonical planner terms, their intended row shape, and how
they map to the current schema.

## Scope

These result sets are for one selected `scan_id`.

They assume planner inputs have already been resolved to one scan plus one explicit cleanup intent, such as:

- `delete-tags`
- `exclude-tags`
- `older-than`
- `keep-n-tagged`
- `delete-untagged`
- `keep-n-untagged`

This is a real planner-facing model reflected in the persisted cleanup audit data:

- `cleanup_runs`
- `cleanup_root_decisions`
- `cleanup_protected_root_blocks`
- `v_cleanup_root_closure_members`
- `v_cleanup_blocking_overlaps`

now persist or derive much of this shape already.

## Why This Model Exists

The cleanup planner has to be request-scoped and explanation-first.

It is not enough to say "delete these versions". The useful output is:

- which tags were directly selected
- which roots became candidates
- which roots are only untaggable
- which roots are blocked
- what overlap caused that block

## Planner Layers

The planner is best read as six layers, each feeding the next.

### 1. Eligible roots

The base unit is one root manifest backed by one `package_versions` row.

Row shape:

- `scan_id`
- `version_id`
- `root_digest`
- `root_manifest_kind`
- `created_at`
- `updated_at`
- `tag_count`
- `is_tagged`
- `is_excluded`
- `is_older_than_cutoff`
- `is_eligible`

Schema sources:

- `manifests`
- `package_versions`
- `tags`

Notes:

- one row per root digest
- this is where `exclude-tags` and `older-than` first become visible as booleans
- this layer does not include closure expansion

### 2. Direct target tags

These rows represent user intent at tag granularity.

Row shape:

- `scan_id`
- `target_tag`
- `version_id`
- `root_digest`
- `target_reason`

`target_reason` examples:

- `delete-tags-match`
- `exclude-tags-match`

Schema sources:

- `tags`
- eligible-roots layer

Notes:

- one row per selected tag
- this layer stays explicit even when later planning deletes a whole root
- digest-literal selectors bypass tags and go directly to the next layer
- when `delete-tags` is combined with `keep-n-tagged`, this layer still records the matched tag intent before keep-rule
  retention removes some roots from actionable selection

### 3. Direct target roots

These rows represent roots directly selected for possible cleanup after applying keep/exclude/age logic.

Row shape:

- `scan_id`
- `version_id`
- `root_digest`
- `root_manifest_kind`
- `direct_target_reason`
- `selection_mode`

`direct_target_reason` examples:

- `delete-tags-all-tags-selected`
- `delete-untagged`
- `keep-n-tagged-overflow`
- `keep-n-untagged-overflow`
- `digest-selector`

`selection_mode` examples:

- `delete-root`
- `untag-only`

Notes:

- this is the first canonical "candidate root" set
- roots protected by exclusions or retained by keep rules must not appear here as `delete-root`
- a multi-tagged root with only some tags selected appears here as `untag-only`, not `delete-root`
- in combined `delete-tags` + `keep-n-tagged` mode, the keep count is applied once per matched root, not once per
  matched tag

### 4. Closure manifests

These rows expand each direct delete-root candidate into the in-package closure that would be removed with it.

Row shape:

- `scan_id`
- `source_version_id`
- `source_digest`
- `member_digest`
- `member_version_id`
- `member_manifest_kind`
- `hops_from_source`
- `member_role`

`member_role` examples:

- `root`
- `descendant`
- `referrer`

Schema sources:

- `manifests`
- `manifest_reachability`
- `manifest_edges`

Notes:

- include the root itself with `hops_from_source = 0`
- include only in-package manifests already present in `manifests`

### 5. Blocked roots

These rows explain why a direct delete-root candidate cannot be fully deleted.

Row shape:

- `scan_id`
- `blocked_version_id`
- `blocked_digest`
- `blocking_version_id`
- `blocking_digest`
- `overlap_digest`
- `overlap_manifest_kind`
- `block_reason`

`block_reason` examples:

- `overlap-with-retained-root`
- `overlap-with-excluded-root`
- `overlap-with-younger-root`

Notes:

- one row per candidate-root / blocking-root / overlap-manifest explanation
- this is the key set that turns the planner into an explanation tool instead of only a selection tool
- a root is fully deletable only if it has no blocked-root rows

### 6. Collateral tags

These rows expose tags that would disappear because they live on a fully deletable root, even though the user did not
directly select them.

Row shape:

- `scan_id`
- `source_version_id`
- `source_digest`
- `collateral_tag`
- `collateral_version_id`
- `collateral_digest`
- `collateral_reason`

`collateral_reason` examples:

- `same-root-additional-tag`
- `same-closure-root-tag`

Notes:

- the first expected case is additional tags on the same root as a direct delete candidate
- this set must exclude direct target tags because those are already user intent, not collateral

## Final Planner Outputs

The planner emits these canonical result sets:

1. `direct_target_tags`
2. `direct_target_roots`
3. `closure_manifests`
4. `blocked_roots`
5. `fully_deletable_roots`
6. `collateral_tags`

`fully_deletable_roots` is a derived summary set:

- all `direct_target_roots` with `selection_mode = 'delete-root'`
- minus any root present in `blocked_roots`

Row shape:

- `scan_id`
- `version_id`
- `root_digest`
- `root_manifest_kind`
- `direct_target_reason`

## SQL Shape Direction

The SQL is built in two tiers.

### Tier 1: stable reusable base views

These can be scan-scoped but input-agnostic:

- `v_scan_root_manifests`
- `v_scan_root_tags`

Purpose:

- provide normalized root reads
- avoid rebuilding the same joins in every planner path

### Tier 2: planner-request CTEs or temporary views

These incorporate the actual cleanup request:

- selected tags
- excluded tags
- age cutoff
- keep counts

Purpose:

- produce request-specific planner outputs
- keep policy out of the generic schema layer

This split matters because policy stays request-scoped instead of being baked into globally named views.

## Mapping To Current Prototypes

The current runtime and debugging surfaces stay request-scoped where possible. Avoid reintroducing globally named views
that bake one cleanup-policy shape into the schema layer.

## Current Implementation Shape

The current implementation follows this shape:

1. scan-scoped base views such as `v_scan_root_manifests`
2. request-scoped planner queries and temporary tables
3. persisted explanation-first cleanup audit rows
4. derived read views for closure members and blocking overlaps

## Test Implications

Planner-output tests verify:

- partial tag selection produces `untag-only` direct targets, not false delete-root candidates
- sibling wrapper indexes do not block or delete each other unless they truly overlap through reachability
- referrers appear in `closure_manifests` for a deleted root
- overlapping retained roots create `blocked_roots` rows with a concrete `overlap_digest`
