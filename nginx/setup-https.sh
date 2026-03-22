#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Recete HTTPS Setup Script
# Run on production server (DigitalOcean) as root.
#
# Prerequisites:
#   1. DNS A records must point to the Reserved IP (143.198.242.196):
#      - recete.co.uk       → 143.198.242.196  ✓
#      - api.recete.co.uk   → 143.198.242.196  ✓
#      - shop.recete.co.uk  → 143.198.242.196  ✓
#      - www.recete.co.uk   → CNAME recete.co.uk ✓
#   2. Ports 80 and 443 open in the firewall
#   3. Nginx installed
#
# Usage:
#   ssh root@167.172.60.234
#   cd /root/retetionai
#   bash nginx/setup-https.sh
# ──────────────────────────────────────────────────────────────
set -euo pipefail

DOMAINS=(recete.co.uk www.recete.co.uk api.recete.co.uk shop.recete.co.uk)
EMAIL="admin@recete.co.uk"
WEBROOT="/var/www/certbot"
NGINX_CONF_SRC="$(cd "$(dirname "$0")" && pwd)/recete-https.conf"
NGINX_CONF_DST="/etc/nginx/sites-available/recete"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[HTTPS]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ──────────────────────────────────────────────
# Step 0: Pre-flight checks
# ──────────────────────────────────────────────
log "Running pre-flight checks..."

[[ $EUID -eq 0 ]] || fail "This script must be run as root."
command -v nginx &>/dev/null || fail "Nginx is not installed. Run: apt install nginx"

# Verify DNS resolution
for domain in "${DOMAINS[@]}"; do
    resolved=$(dig +short "$domain" A 2>/dev/null | head -1)
    if [[ -z "$resolved" ]]; then
        warn "DNS for $domain did not resolve. Make sure the A record is set."
    else
        log "  $domain → $resolved"
    fi
done

# Open firewall ports if ufw is active
if command -v ufw &>/dev/null && ufw status | grep -q "active"; then
    log "Opening ports 80 and 443 in ufw..."
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw reload
fi

# ──────────────────────────────────────────────
# Step 1: Install Certbot
# ──────────────────────────────────────────────
if ! command -v certbot &>/dev/null; then
    log "Installing Certbot..."
    apt-get update -qq
    apt-get install -y -qq certbot python3-certbot-nginx
else
    log "Certbot already installed: $(certbot --version 2>&1)"
fi

# ──────────────────────────────────────────────
# Step 2: Create ACME webroot directory
# ──────────────────────────────────────────────
mkdir -p "$WEBROOT"

# ──────────────────────────────────────────────
# Step 3: Install temporary HTTP-only Nginx config for ACME challenge
# ──────────────────────────────────────────────
log "Installing temporary Nginx config for certificate issuance..."

cat > "$NGINX_CONF_DST" <<'TMPCONF'
# Temporary config — HTTP only, serves ACME challenges
server {
    listen 80;
    listen [::]:80;
    server_name recete.co.uk www.recete.co.uk api.recete.co.uk shop.recete.co.uk;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Recete — waiting for HTTPS certificates...';
        add_header Content-Type text/plain;
    }
}
TMPCONF

ln -sf "$NGINX_CONF_DST" /etc/nginx/sites-enabled/recete
rm -f /etc/nginx/sites-enabled/default

nginx -t || fail "Nginx config test failed"
systemctl reload nginx
log "Temporary Nginx config active."

# ──────────────────────────────────────────────
# Step 4: Obtain Let's Encrypt certificates
# ──────────────────────────────────────────────
log "Requesting certificates from Let's Encrypt..."

# Each group of domains gets its own certificate
certbot certonly --webroot -w "$WEBROOT" \
    -d recete.co.uk -d www.recete.co.uk \
    --email "$EMAIL" --agree-tos --non-interactive \
    --keep-until-expiring

certbot certonly --webroot -w "$WEBROOT" \
    -d api.recete.co.uk \
    --email "$EMAIL" --agree-tos --non-interactive \
    --keep-until-expiring

certbot certonly --webroot -w "$WEBROOT" \
    -d shop.recete.co.uk \
    --email "$EMAIL" --agree-tos --non-interactive \
    --keep-until-expiring

log "Certificates obtained successfully."

# ──────────────────────────────────────────────
# Step 5: Generate DH parameters (if not already present)
# ──────────────────────────────────────────────
if [[ ! -f /etc/letsencrypt/ssl-dhparams.pem ]]; then
    log "Generating Diffie-Hellman parameters (this takes ~30 seconds)..."
    openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048
fi

# Certbot's recommended SSL options file
if [[ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]]; then
    log "Downloading recommended SSL options..."
    curl -sS https://raw.githubusercontent.com/certbot/certbot/main/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
        -o /etc/letsencrypt/options-ssl-nginx.conf
fi

# ──────────────────────────────────────────────
# Step 6: Install final HTTPS Nginx config
# ──────────────────────────────────────────────
log "Installing production HTTPS Nginx config..."

if [[ -f "$NGINX_CONF_SRC" ]]; then
    cp "$NGINX_CONF_SRC" "$NGINX_CONF_DST"
else
    fail "Cannot find $NGINX_CONF_SRC — make sure you run this from the repo root."
fi

nginx -t || fail "Nginx config test failed after installing HTTPS config."
systemctl reload nginx
log "Production HTTPS Nginx config is active."

# ──────────────────────────────────────────────
# Step 7: Set up auto-renewal cron
# ──────────────────────────────────────────────
log "Configuring auto-renewal..."

CRON_CMD="0 3,15 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'"

# Add to root crontab if not already present
if ! crontab -l 2>/dev/null | grep -qF "certbot renew"; then
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    log "Auto-renewal cron job added (runs at 03:00 and 15:00 daily)."
else
    log "Auto-renewal cron job already exists."
fi

# ──────────────────────────────────────────────
# Step 8: Test renewal
# ──────────────────────────────────────────────
log "Running renewal dry-run..."
certbot renew --dry-run || warn "Dry-run failed — check certbot logs."

# ──────────────────────────────────────────────
# Step 9: Verify
# ──────────────────────────────────────────────
echo ""
log "===== HTTPS Setup Complete ====="
echo ""
for domain in recete.co.uk api.recete.co.uk shop.recete.co.uk; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$domain" 2>/dev/null || echo "ERR")
    if [[ "$STATUS" == "200" || "$STATUS" == "301" || "$STATUS" == "302" ]]; then
        echo -e "  ${GREEN}✅ https://$domain${NC}  (HTTP $STATUS)"
    else
        echo -e "  ${YELLOW}⚠️  https://$domain${NC}  (HTTP $STATUS — check service)"
    fi
done

echo ""
log "Next steps:"
log "  1. Verify in browser: https://recete.co.uk"
log "  2. SSL Labs test:     https://www.ssllabs.com/ssltest/analyze.html?d=recete.co.uk"
log "  3. Update .env files: NEXT_PUBLIC_API_URL=https://recete.co.uk"
log "  4. Update Shopify Partner Dashboard app URLs to HTTPS"
echo ""
