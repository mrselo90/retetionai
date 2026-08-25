#!/bin/bash
# Rollback script for Recete Retention Agent
# Usage: ./rollback.sh [commit_hash]
# If no commit hash is provided, rolls back to HEAD~1.

set -e

PROJECT_DIR="/root/retetionai"
ROLLBACK_TARGET="${1:-HEAD~1}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting rollback to ${ROLLBACK_TARGET}...${NC}"

cd "$PROJECT_DIR"

CURRENT_COMMIT=$(git rev-parse HEAD)
echo -e "Current commit: ${CURRENT_COMMIT}"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

echo -e "${YELLOW}Step 1: Moving the branch to the target commit...${NC}"
# reset --hard, not `git checkout`: checkout leaves the server on a detached
# HEAD, and then every later `git pull origin main` fails with "not currently on
# any branch" — a rollback would quietly wedge every future deploy until someone
# noticed. reset keeps us on the branch, so the next deploy fast-forwards back.
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "HEAD" ]; then
  echo -e "${RED}Already on a detached HEAD. Run 'git checkout main' first.${NC}"
  exit 1
fi
git reset --hard "$ROLLBACK_TARGET"

echo -e "${YELLOW}Step 2: Installing dependencies...${NC}"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PNPM_HOME="/root/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
pnpm install

echo -e "${YELLOW}Step 3: Building...${NC}"
# `set -e` would abort here on a failed build, leaving the services on whatever
# broken build prompted the rollback. Say so loudly instead.
if ! pnpm build; then
  echo -e "${RED}Build FAILED at ${ROLLBACK_TARGET}. Tree is moved but .next is not"
  echo -e "rebuilt, so the services still serve the previous build.${NC}"
  exit 1
fi

echo -e "${YELLOW}Step 4: Restarting services...${NC}"
# ecosystem.config.cjs, not `restart all`: this PM2 instance also runs unrelated
# projects, and a plain restart reuses stale saved process definitions.
pm2 startOrRestart ecosystem.config.cjs --update-env

echo -e "${YELLOW}Step 5: Health check...${NC}"
sleep 8
# Check web too, not just the API. A broken web build presents as a healthy API:
# SSR answers 200 while the client chunks 404.
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 http://localhost:3002/health || echo "000")
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 http://localhost:3001/ || echo "000")
echo -e "api=${HEALTH_STATUS} web=${WEB_STATUS}"
if [ "$HEALTH_STATUS" = "200" ] && [ "$WEB_STATUS" = "200" ]; then
  echo -e "${GREEN}Rollback successful! Health check passed.${NC}"
  echo -e "Rolled back from ${CURRENT_COMMIT} to $(git rev-parse HEAD)"
else
  echo -e "${RED}WARNING: Health check failed after rollback (api=${HEALTH_STATUS} web=${WEB_STATUS}).${NC}"
  echo -e "${RED}Manual intervention required.${NC}"
  exit 1
fi
