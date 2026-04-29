#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

image_registry=""
target_db=""
log_level="info"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image)
      image_registry="${2:-}"
      shift 2
      ;;
    --db)
      target_db="${2:-}"
      shift 2
      ;;
    --log-level)
      log_level="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: scripts/debug/scan-ghcr-gh-auth.sh --image <owner/package> --db <target-db> [--log-level <level>]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$image_registry" || -z "$target_db" ]]; then
  echo "Usage: scripts/debug/scan-ghcr-gh-auth.sh --image <owner/package> --db <target-db> [--log-level <level>]" >&2
  exit 1
fi

if [[ "$image_registry" != */* || "$image_registry" == */*/* ]]; then
  echo "Expected image registry in <owner/package> form, got: $image_registry" >&2
  exit 1
fi

owner="${image_registry%%/*}"
package_name="${image_registry#*/}"

GITHUB_TOKEN="$(gh auth token)" node dist/cli/index.js scan \
  --db "$target_db" \
  --log-level "$log_level" \
  --source github \
  --owner "$owner" \
  --package "$package_name"
