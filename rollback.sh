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

echo -e "${YELLOW}Step 1: Checking out target commit...${NC}"
git checkout "$ROLLBACK_TARGET"

echo -e "${YELLOW}Step 2: Installing dependencies...${NC}"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PNPM_HOME="/root/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
pnpm install

echo -e "${YELLOW}Step 3: Building...${NC}"
pnpm build

echo -e "${YELLOW}Step 4: Restarting services...${NC}"
pm2 restart all --update-env

echo -e "${YELLOW}Step 5: Health check...${NC}"
sleep 8
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 http://localhost:3002/health || echo "000")
if [ "$HEALTH_STATUS" = "200" ]; then
  echo -e "${GREEN}Rollback successful! Health check passed.${NC}"
  echo -e "Rolled back from ${CURRENT_COMMIT} to $(git rev-parse HEAD)"
else
  echo -e "${RED}WARNING: Health check failed after rollback (HTTP ${HEALTH_STATUS}).${NC}"
  echo -e "${RED}Manual intervention required.${NC}"
  exit 1
fi
