#!/bin/bash
set -e

# Define color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Updating Nginx configuration for API port 3002...${NC}"

NGINX_CONF="/etc/nginx/sites-available/recete"

if [ ! -f "$NGINX_CONF" ]; then
    echo -e "${RED}Error: Nginx config file not found at $NGINX_CONF${NC}"
    exit 1
fi

# Backup the current configuration.
# The path is computed ONCE. It used to be spelled `$(date +%F_%T)` at each use,
# which re-evaluated seconds apart — so the echo reported a different filename
# than the one written, and the restore below looked for a file that never
# existed.
BACKUP="${NGINX_CONF}.bak.$(date +%F_%T)"
cp "$NGINX_CONF" "$BACKUP"
echo -e "${GREEN}Backed up Nginx config to ${BACKUP}${NC}"

# Update the proxy_pass port for /api/ location
# Replaces 'proxy_pass http://localhost:3000;' with 'proxy_pass http://localhost:3002;'
if grep -q "proxy_pass http://localhost:3000;" "$NGINX_CONF"; then
    sed -i 's|proxy_pass http://localhost:3000;|proxy_pass http://localhost:3002;|g' "$NGINX_CONF"
    echo -e "${GREEN}Updated API proxy port to 3002.${NC}"
else
    echo -e "${YELLOW}Warning: 'proxy_pass http://localhost:3000;' not found. Checking if it's already 3002...${NC}"
    if grep -q "proxy_pass http://localhost:3002;" "$NGINX_CONF"; then
        echo -e "${GREEN}Config already points to port 3002. No changes needed.${NC}"
    else
        echo -e "${RED}Could not find the proxy_pass directive to update. Please check manually.${NC}"
        grep "proxy_pass" "$NGINX_CONF"
    fi
fi

# Test Nginx configuration.
# `nginx -t` inside the `if`, not on its own line: with `set -e` a failing test
# aborted the script right there, so the restore branch below was dead code and
# a bad edit was left on disk while the script claimed to have restored it.
# Note this validates the WHOLE nginx config, other projects' sites included —
# so a reload never goes ahead on a config that would break them.
echo -e "${YELLOW}Testing Nginx configuration...${NC}"
if nginx -t; then
    echo -e "${GREEN}Configuration test passed. Reloading Nginx...${NC}"
    systemctl reload nginx
    echo -e "${GREEN}Nginx reloaded successfully!${NC}"
else
    echo -e "${RED}Configuration test failed! Restoring backup...${NC}"
    cp "$BACKUP" "$NGINX_CONF"
    echo -e "${YELLOW}Backup restored from ${BACKUP}. Nginx was NOT reloaded, so"
    echo -e "the running config is untouched. Please check errors manually.${NC}"
    exit 1
fi
