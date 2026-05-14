# 00 Task: Kickoff

## Background

I originally started this project because the GitHub action `dataaxiom/ghcr-cleanup-action` failed to process my image
registry `ghcr.io/aicage/aicage` which has >90k package-versions.

The workflow `../../aicage/aicage-image/.github/workflows/ghcr-cleanup.yml` uses the action and for this large registry
the runs time out after 6h. The end of the log looks like:

```text
2026-05-13T08:53:18.9012727Z sha256:f5e32c4a89ab89acd578beb0bba74e6f27aad336f4416f17992114939dc7b584
2026-05-13T08:53:18.9012897Z sha256:5fcde876b3750e3f99309618f31ed4ecf0afcc62c01422d082fc27a15c89a0cd
2026-05-13T08:53:18.9013521Z ##[endgroup]
2026-05-13T08:53:27.9869431Z ##[group][aicage] Untagging images: gemini-0.37.1-ubuntu-1.0.11-arm64, ...
```

I think this happens because the action processes JSON in memory and thought I could improve this for large loads with a
database.

## Status of project

So far the project loads my 90k manifests into a DB in about 10-15 minutes including processing into helper tables:

- manifest_edges
- manifest_reachability

These views seem useful:

- v_latest_scan_per_package
- v_missing_digests
- v_missing_digests_related_manifests

While I am not sure about the other ones - especially the later additions:

- v_tags_delete_affected_tags
- v_tags_delete_manifests

## Goal

I've been thinking for a while now about features of this project.

Besides providing a downloadable DB about registries (which is mostly for debugging and just because we already have the
DB), some delete/cleanup feature is certainly wanted.

And since I still am not sure how, I am by now willing to plain re-implement the features of
`dataaxiom/ghcr-cleanup-action`. You can find its source in `../../`dataaxiom/ghcr-cleanup-action`.

As this is a large task - rather a goal for several tasks together, this certainly requires planning.  
And also your context window comes into play - we should be able to stop a session with you and start next subtask in a
new session.

So please as first step: suggest a plan with potential subtasks and how to document this across sessions/subtasks.
