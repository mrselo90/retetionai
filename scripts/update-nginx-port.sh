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

# Backup the current configuration
cp "$NGINX_CONF" "${NGINX_CONF}.bak.$(date +%F_%T)"
echo -e "${GREEN}Backed up Nginx config to ${NGINX_CONF}.bak.$(date +%F_%T)${NC}"

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

# Test Nginx configuration
echo -e "${YELLOW}Testing Nginx configuration...${NC}"
nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Configuration test passed. Reloading Nginx...${NC}"
    systemctl reload nginx
    echo -e "${GREEN}Nginx reloaded successfully!${NC}"
else
    echo -e "${RED}Configuration test failed! Restoring backup...${NC}"
    cp "${NGINX_CONF}.bak.$(date +%F_%T)" "$NGINX_CONF"
    echo -e "${YELLOW}Backup restored. Please check errors manually.${NC}"
    exit 1
fi
