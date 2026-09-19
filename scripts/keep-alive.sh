#!/bin/bash
# Keep-alive loop for Antum People server
# Restarts the server if nothing is listening on port 3000

DEPLOY_DIR="/home/team/shared/probable-octo-sniffle"

while true; do
  if ! ss -ltn | grep -q ":3000 "; then
    echo "$(date -Iseconds) port 3000 empty - starting server" >> "$DEPLOY_DIR/server/keep-alive.log"
    cd "$DEPLOY_DIR/server"
    setsid nohup node index.js >> "$DEPLOY_DIR/server/server.log" 2>&1 &
  fi
  sleep 60
done
