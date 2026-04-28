#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

npm run lint

yamllint .
pymarkdown \
  --config .pymarkdown.json scan \
  --recurse \
  --exclude '**/.venv*/**' \
  --exclude 'node_modules/**' \
  .
