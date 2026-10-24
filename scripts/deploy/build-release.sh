#!/usr/bin/env bash
# Production build for a deploy (.github/workflows/deploy.yml), from the repo root.
#
# The browser-facing apps build into a new folder per commit instead of over
# the live one. `pnpm build` used to rewrite packages/web/.next and
# packages/shopify-app/build in place while the old processes kept serving
# from them: for the minutes the build ran, pages could reference JS files
# that were already gone. Now:
#   web    -> packages/web/.next-<sha>         (Next distDir via NEXT_DIST_DIR)
#   shell  -> packages/shopify-app/build-<sha> (React Router buildDirectory via SHELL_BUILD_DIR)
# Each finished build gets a .complete marker and also keeps the previous
# build's hashed JS/CSS, so a tab opened before the deploy can still load its
# chunks afterwards. Only when everything built do the pointer files
# (.next-current, .build-current) name the new folders; ecosystem.config.cjs
# reads them, so `pm2 startOrReload` starts new processes on the new build
# while the old ones finish on theirs. A folder that is already complete for
# this commit (a rollback to it) is reused as is.
set -euo pipefail

SHA=$(git rev-parse --short=12 HEAD)
WEB=packages/web
SHELL_APP=packages/shopify-app
WEB_DIR=".next-$SHA"
SHELL_DIR="build-$SHA"

current() { cat "$1" 2>/dev/null || echo "$2"; }
# Adds the previous build's files the new one lacks; never overwrites. (cp -n
# exits 1 when it skips a file on macOS and recent GNU coreutils.)
keep_previous() { rsync -a --ignore-existing "$1/" "$2/"; }

echo "🔨 Building shared, api and workers..."
pnpm --filter @recete/shared build
pnpm -r --filter '!@recete/shared' --filter '!@recete/web' --filter '!@recete/shopify-app' build

if [ -f "$WEB/$WEB_DIR/.complete" ]; then
  echo "   web: $WEB_DIR already built"
else
  echo "🔨 Building web into $WEB_DIR..."
  PREV_WEB=$(current "$WEB/.next-current" .next)
  rm -rf "${WEB:?}/$WEB_DIR"
  mkdir -p "$WEB/$WEB_DIR"
  # Keep the webpack cache: a fresh folder would make every build a cold one.
  # Only the build uses it; the running server recreates its image cache.
  if [ -d "$WEB/$PREV_WEB/cache" ]; then mv "$WEB/$PREV_WEB/cache" "$WEB/$WEB_DIR/cache"; fi
  NEXT_DIST_DIR="$WEB_DIR" pnpm --filter @recete/web build
  # Next adds "<distDir>/types/**/*.ts" to tsconfig.json and points
  # next-env.d.ts at the new folder; a dirty tree would break the next git pull.
  git checkout -- "$WEB/tsconfig.json" "$WEB/next-env.d.ts"
  if [ -d "$WEB/$PREV_WEB/static" ]; then keep_previous "$WEB/$PREV_WEB/static" "$WEB/$WEB_DIR/static"; fi
  touch "$WEB/$WEB_DIR/.complete"
fi

if [ -f "$SHELL_APP/$SHELL_DIR/.complete" ]; then
  echo "   shell: $SHELL_DIR already built"
else
  echo "🔨 Building shell into $SHELL_DIR..."
  PREV_SHELL=$(current "$SHELL_APP/.build-current" build)
  rm -rf "${SHELL_APP:?}/$SHELL_DIR"
  SHELL_BUILD_DIR="$SHELL_DIR" pnpm --filter @recete/shopify-app build
  if [ -d "$SHELL_APP/$PREV_SHELL/client/assets" ]; then
    keep_previous "$SHELL_APP/$PREV_SHELL/client/assets" "$SHELL_APP/$SHELL_DIR/client/assets"
  fi
  touch "$SHELL_APP/$SHELL_DIR/.complete"
fi

echo "$WEB_DIR" > "$WEB/.next-current"
echo "$SHELL_DIR" > "$SHELL_APP/.build-current"
echo "✔ build ready: web=$WEB_DIR shell=$SHELL_DIR"
