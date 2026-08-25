#!/bin/bash
# Deployment script for Performance Optimizations
# Run this script on your server after upgrade is complete

set -e  # Exit on any error

echo "🚀 Starting deployment of performance optimizations..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
# Configuration
PROJECT_DIR="/root/retetionai"
# Source environment variables if .env exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
DB_URL="${DATABASE_URL}"

echo -e "${BLUE}Step 1/7: Pulling latest code from git${NC}"
cd "$PROJECT_DIR"
git pull origin main
echo -e "${GREEN}✓ Code updated${NC}"
echo ""

echo -e "${BLUE}Step 2/7: Installing dependencies${NC}"
pnpm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo -e "${BLUE}Step 3/7: Running database migration (performance indexes)${NC}"
if [ -z "$DB_URL" ]; then
    echo -e "${YELLOW}⚠ DATABASE_URL not set. Skipping migration.${NC}"
    echo -e "${YELLOW}  Run manually: psql \$DATABASE_URL -f supabase/migrations/010_performance_indexes.sql${NC}"
else
    psql "$DB_URL" -f supabase/migrations/010_performance_indexes.sql
    echo -e "${GREEN}✓ Database indexes created${NC}"
fi
echo ""

echo -e "${BLUE}Step 4/7: Building application${NC}"
NODE_ENV=production pnpm build
echo -e "${GREEN}✓ Build completed${NC}"
echo ""

echo -e "${BLUE}Step 5/7: Reloading PM2 from ecosystem.config.cjs${NC}"
# startOrRestart, not start: `start` on an already-running app errors instead of
# reloading it. Stdio detached so pm2 does not hold this script's channel.
pm2 startOrRestart ecosystem.config.cjs --update-env </dev/null >/dev/null 2>&1
# Deliberately NOT `pm2 save`. Saving snapshots the WHOLE process list, and this
# droplet's PM2 also runs unrelated projects (matchcountdown, eralp-*) — so a
# Recete deploy would freeze whatever transient state those happened to be in,
# including a worker someone had deliberately stopped. Nothing here adds or
# removes apps, so there is nothing new to persist. If you intentionally change
# the app list, run `pm2 save` yourself, once, knowing it covers everything.
echo -e "${GREEN}✓ Recete services reloaded from ecosystem config${NC}"
echo ""

echo -e "${BLUE}Step 6/7: Verifying services${NC}"
sleep 3
pm2 list
echo ""

# Check Recete's own services, by name. `pm2 list | grep -q online` was
# meaningless here: this droplet runs six processes belonging to other projects,
# so the grep matched one of those and reported success even with every Recete
# service down.
NOT_ONLINE=""
for app in api web workers shopify-shell; do
    if pm2 describe "$app" 2>/dev/null | grep "status" | grep -q "online"; then
        echo -e "  ${GREEN}✓${NC} $app"
    else
        echo -e "  ${RED}✗${NC} $app"
        NOT_ONLINE="$NOT_ONLINE $app"
    fi
done
if [ -z "$NOT_ONLINE" ]; then
    echo -e "${GREEN}✓ All four Recete services are online${NC}"
else
    echo -e "${RED}✗ Not online:${NOT_ONLINE}. Check logs with: pm2 logs${NC}"
    exit 1
fi
echo ""

echo -e "${BLUE}Step 7/7: Performance verification${NC}"

# Test API health (Port 3002)
echo "Testing API..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/health || echo "000")
if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "404" ]; then
    echo -e "${GREEN}✓ API is responding${NC}"
else
    echo -e "${YELLOW}⚠ API returned status: $API_STATUS${NC}"
fi

# Test Web server (Port 3001)
echo "Testing Web server..."
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ || echo "000")
if [ "$WEB_STATUS" = "200" ] || [ "$WEB_STATUS" = "307" ]; then
    echo -e "${GREEN}✓ Web server is responding${NC}"
else
    echo -e "${YELLOW}⚠ Web returned status: $WEB_STATUS${NC}"
fi

# Test Shopify shell (Port 3003)
echo "Testing Shopify shell..."
SHOP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/app/health || echo "000")
if [ "$SHOP_STATUS" = "200" ] || [ "$SHOP_STATUS" = "503" ]; then
    echo -e "${GREEN}✓ Shopify shell is responding${NC}"
else
    echo -e "${YELLOW}⚠ Shopify shell returned status: $SHOP_STATUS${NC}"
fi

# Test Redis
echo "Testing Redis connection..."
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is connected${NC}"
else
    echo -e "${RED}✗ Redis connection failed${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""

echo "📊 Expected Performance Improvements:"
echo "  • Analytics Dashboard: 5.3s → < 1s (80% faster)"
echo "  • Products Page: 2-3s → < 500ms (75% faster)"
echo "  • Product Chunks: 200-550ms → < 100ms (90% faster)"
echo "  • Redis Uptime: 95% → 99.9%"
echo ""

echo "📝 Monitoring commands:"
echo "  • Check logs: pm2 logs --lines 50"
echo "  • Check status: pm2 status"
echo "  • Check Redis: redis-cli ping"
echo "  • Test analytics: curl -H \"Authorization: Bearer TOKEN\" http://localhost:3002/api/analytics/dashboard"
echo ""

echo "🔍 Database index verification:"
echo "  psql \$DATABASE_URL -c \"SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;\""
echo ""

echo -e "${BLUE}Deployment complete! 🎉${NC}"
