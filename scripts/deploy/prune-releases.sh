#!/usr/bin/env bash
# After a healthy deploy: delete old per-commit build folders (see
# build-release.sh). Keeps the current one and the two newest before it, so a
# rollback to them needs no rebuild, and removes the pre-versioning in-place
# folders (.next, build) once nothing runs from them.
set -euo pipefail

prune() { # <app dir> <folder prefix> <pointer file> <legacy folder>
  local dir=$1 prefix=$2 current
  current=$(cat "$dir/$3" 2>/dev/null || true)
  [ -n "$current" ] || return 0
  # Newest first; skip the current folder and the two after it.
  # Trailing slash: folders only (the pointer file .next-current matches too).
  ls -1dt "$dir/$prefix"*/ 2>/dev/null | while read -r path; do
    path=${path%/}
    [ "$(basename "$path")" = "$current" ] && continue
    echo "$path"
  done | tail -n +3 | while read -r old; do
    echo "   removing $old"
    rm -rf "$old"
  done
  if [ "$current" != "$4" ] && [ -d "$dir/$4" ]; then
    echo "   removing $dir/$4 (pre-versioning build)"
    rm -rf "${dir:?}/$4"
  fi
}

prune packages/web .next- .next-current .next
prune packages/shopify-app build- .build-current build
