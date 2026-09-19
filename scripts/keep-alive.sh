#!/bin/bash
# Keep-alive loop for Antum People server
# Restarts the server if nothing is listening on port 3000

while true; do
  if ! ss -ltn | grep -q ":3000 "; then
    echo "$(date -Iseconds) port 3000 empty - starting server" >> /home/team/shared/antum-keepalive.log
    cd /home/agent-senior-software-engineer/antum-people/server
    setsid nohup node index.js >> /home/team/shared/antum-server.log 2>&1 &
  fi
  sleep 60
done
