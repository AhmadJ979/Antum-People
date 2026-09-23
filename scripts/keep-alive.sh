#!/bin/bash
# Keep-alive loop for Antum People server
# Restarts the server if port 3000 is not held by Antum People server
#
# ARMING PROCEDURE:
# 1. Run this script from any team member's shell.
# 2. Check logs: tail -f /home/team/shared/probable-octo-sniffle/server/keep-alive.log
# 3. Verification: flock -n /home/team/shared/probable-octo-sniffle/server/keep-alive.lock -c "echo available"
#    If it says "available", the loop is NOT running.
#
# RECLAIMING STALE LOCK:
# The script uses 'flock' which is automatically released by the kernel when the 
# process terminates. If a lock file exists but no process is holding the lock, 
# a new instance will automatically take over.

# Use absolute path to the deployed tree
DEPLOY_DIR="/home/team/shared/probable-octo-sniffle"
LOG_FILE="$DEPLOY_DIR/server/keep-alive.log"
SERVER_LOG="$DEPLOY_DIR/server/server.log"
LOCK_FILE="$DEPLOY_DIR/server/keep-alive.lock"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Ensure lock file exists and is group-writable so any team user can acquire the lock
touch "$LOCK_FILE" 2>/dev/null
chmod 664 "$LOCK_FILE" 2>/dev/null || true

# Single instance lock
# Using a file descriptor for flock to ensure the lock is released if the script is killed.
# Open for read/write to allow PID updates.
exec 9<>"$LOCK_FILE"

if ! flock -n 9; then
    # Lock is held by another active process.
    LOCK_PID=$(cat "$LOCK_FILE" | tr -d '[:space:]')
    echo "$(date -Iseconds) Another instance (PID: ${LOCK_PID:-unknown}) is already running. Exiting." >> "$LOG_FILE"
    exit 1
fi

# We have the lock. Write our PID to the file for visibility.
echo $$ > "$LOCK_FILE"

# Source environment variables for secrets (JWT_SECRET, ENCRYPTION_KEY)
if [ -f "/etc/profile.d/cto-env-vars.sh" ]; then
    source /etc/profile.d/cto-env-vars.sh
    echo "$(date -Iseconds) Environment variables sourced from /etc/profile.d/cto-env-vars.sh" >> "$LOG_FILE"
else
    echo "$(date -Iseconds) WARNING: /etc/profile.d/cto-env-vars.sh not found. Server may fail to start." >> "$LOG_FILE"
fi

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
    # Environment variables from /etc/profile.d/cto-env-vars.sh are already in the shell
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
        FOREIGN_PID=$(sudo lsof -t -i :3000)
        if [ -n "$FOREIGN_PID" ]; then
            FOREIGN_CMD=$(ps -p "$FOREIGN_PID" -o command=)
            echo "$(date -Iseconds) port 3000 held by foreign process (PID: $FOREIGN_PID, CMD: $FOREIGN_CMD) - killing it" >> "$LOG_FILE"
            sudo kill -9 "$FOREIGN_PID"
            sleep 2
            start_server
        fi
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
            # Process exists but not responding on 3000
            SERVER_PID=$(pgrep -f "node index.js" | head -n 1)
            echo "$(date -Iseconds) server process ($SERVER_PID) exists but port 3000 is not responding - killing and restarting" >> "$LOG_FILE"
            kill -9 "$SERVER_PID"
            sleep 2
            start_server
        fi
    fi
    
    sleep 60
done
