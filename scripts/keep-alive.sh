#!/bin/bash
# Keep-alive loop for Antum People server
# Restarts the server if port 3000 is not held by Antum People server

# Use absolute path to the deployed tree
DEPLOY_DIR="/home/team/shared/probable-octo-sniffle"
LOG_FILE="$DEPLOY_DIR/server/keep-alive.log"
SERVER_LOG="$DEPLOY_DIR/server/server.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

check_health() {
    # Check if port 3000 is listening
    if ! ss -ltn | grep -q ":3000 "; then
        return 1 # Nothing listening
    fi
    
    # Check if it's our server
    # Use a timeout to avoid hanging if the process is stuck
    TITLE=$(curl -s --max-time 5 http://localhost:3000 | grep -o "<title>Antum People</title>")
    if [ "$TITLE" == "<title>Antum People</title>" ]; then
        return 0 # Healthy
    else
        return 2 # Foreign process
    fi
}

rebuild_client() {
    echo "$(date -Iseconds) rebuilding client bundle..." >> "$LOG_FILE"
    cd "$DEPLOY_DIR/client"
    # Rebuild as instructed: npm ci then npm run build with memory limit
    npm ci --no-fund --no-audit
    NODE_OPTIONS=--max-old-space-size=560 npm run build
}

start_server() {
    echo "$(date -Iseconds) starting server" >> "$LOG_FILE"
    cd "$DEPLOY_DIR/server"
    # Ensure npm dependencies are there
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    # Start detached
    setsid nohup node index.js >> "$SERVER_LOG" 2>&1 &
}

# Initial delay to let the system settle after boot
sleep 10

while true; do
    check_health
    HEALTH=$?
    
    if [ $HEALTH -eq 0 ]; then
        # Healthy, do nothing
        :
    elif [ $HEALTH -eq 2 ]; then
        # Foreign process
        echo "$(date -Iseconds) port 3000 held by foreign process - logging and waiting" >> "$LOG_FILE"
    else
        # HEALTH=1 (Nothing listening)
        echo "$(date -Iseconds) port 3000 empty - starting recovery" >> "$LOG_FILE"
        
        # Check if client bundle exists
        if [ ! -f "$DEPLOY_DIR/client/dist/index.html" ]; then
            rebuild_client
        fi
        
        # Idempotency check: is a node index.js already running?
        if ! pgrep -f "node index.js" | grep -v "$$" > /dev/null; then
            start_server
        else
            echo "$(date -Iseconds) server process already exists but port 3000 is not responding - check server logs" >> "$LOG_FILE"
        fi
    fi
    
    sleep 60
done
