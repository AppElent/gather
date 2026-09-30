#!/usr/bin/env bash
# Copies local env files from the main worktree into this worktree.
set -euo pipefail

src="${1:-$(git worktree list --porcelain | awk '/^worktree /{print substr($0,10); exit}')}"
dest="$(git rev-parse --show-toplevel)"

if [ "$src" = "$dest" ]; then
  echo "copy-env: source and destination are the same, nothing to do"
  exit 0
fi

for f in .env.local .dev.vars apps/mobile/.env.local; do
  if [ -f "$src/$f" ]; then
    mkdir -p "$(dirname "$dest/$f")"
    cp "$src/$f" "$dest/$f"
    echo "copied $f"
  else
    echo "skipped $f (not in $src)"
  fi
done
