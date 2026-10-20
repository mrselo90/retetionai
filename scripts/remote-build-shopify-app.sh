#!/bin/bash
# Build the Shopify app on the server. Uses SSH key auth only (set it up once
# with scripts/ssh-setup-server.sh); BatchMode fails instead of asking for a password.

set -e
HOST="${RECETE_SSH_HOST:-root@167.172.60.234}"

ssh -o BatchMode=yes "$HOST" "cd /root/retetionai/packages/shopify-app && pnpm build"
