#!/usr/bin/env bash
set -euo pipefail

readonly _GITHUB_API_VERSION="2022-11-28"

: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
: "${ARTIFACT_NAME_GLOB:?ARTIFACT_NAME_GLOB is required}"

exclude_artifact_id="${EXCLUDE_ARTIFACT_ID:-}"

artifact_list="$(
  gh api \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: $_GITHUB_API_VERSION" \
    "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID/artifacts?per_page=100" \
    | jq -r '.artifacts[] | [.id, .name] | @tsv'
)"

if [[ -z "$artifact_list" ]]; then
  exit 0
fi

while IFS=$'\t' read -r artifact_id artifact_name; do
  case "$artifact_name" in
    $ARTIFACT_NAME_GLOB) ;;
    *) continue ;;
  esac
  if [[ -n "$exclude_artifact_id" && "$artifact_id" == "$exclude_artifact_id" ]]; then
    continue
  fi
  gh api \
    -X DELETE \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: $_GITHUB_API_VERSION" \
    "repos/$GITHUB_REPOSITORY/actions/artifacts/$artifact_id" \
    > /dev/null
  echo "Deleted intermediate artifact: $artifact_name" >&2
done <<< "$artifact_list"
