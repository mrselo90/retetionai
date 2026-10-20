#!/bin/bash
# Print recent PM2 logs of the Shopify app on the server.
# Usage: scripts/remote-shopify-app-logs.sh [lines]   (default 80)
# Uses SSH key auth only (set it up once with scripts/ssh-setup-server.sh).

set -e
HOST="${RECETE_SSH_HOST:-root@167.172.60.234}"
LINES="${1:-80}"

ssh -o BatchMode=yes "$HOST" "pm2 logs shopify-shell --lines $LINES --nostream"
