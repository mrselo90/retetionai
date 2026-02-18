#!/bin/bash
# Copy your SSH key to the server so you can log in without a password.
# Run this once; you will be prompted for the server password.

set -e
KEY="${HOME}/.ssh/id_ed25519.pub"
HOST="root@209.97.134.215"

if [ ! -f "$KEY" ]; then
  echo "No key at $KEY. Run: ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N \"\" -C \"recete\""
  exit 1
fi

echo "Copying SSH key to $HOST (you will be asked for the server password once)..."
ssh-copy-id -i "$KEY" "$HOST"
echo "Done. Try: ssh $HOST"
ssh "$HOST" "echo 'SSH key login works.'"
