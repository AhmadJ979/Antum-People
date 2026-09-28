#!/bin/bash

# Antum People - Watchdog Script
# Ensures the application stays up and running.
# Usage: ./keep-alive.sh [port]

PORT=${1:-3000}
PROJECT_ROOT="/home/team/shared/site"
LOCK_FILE="/home/team/shared/keep-alive.lock"

# Single instance lock using flock
exec 200>$LOCK_FILE
if ! flock -n 200; then
    echo "Another watchdog is already running."
    exit 1
fi

echo "Armed watchdog for port $PORT (PID $$)"

check_health() {
    # Check if anything is listening on the port
    if ! lsof -i :$PORT >/dev/null 2>&1; then
        return 1 # Nothing listening
    fi

    # Hardening: Assert the login contract instead of just the page title.
    # We probe /api/employees (authenticated route) which is NOT rate-limited by failure-only logic.
    # A healthy server returns 401 with "Authentication token required".
    # This proves the server is running our code and responding to authenticated routes.
    HEALTH_RESPONSE=$(curl -s -i --noproxy '*' --max-time 5 http://127.0.0.1:$PORT/api/employees 2>/dev/null)

    if echo "$HEALTH_RESPONSE" | grep -q "HTTP/.* 401" && \
       echo "$HEALTH_RESPONSE" | grep -q '{"error":"Authentication token required"}'; then
        return 0 # Healthy
    else
        return 2 # Foreign or broken process
    fi
}

start_server() {
    echo "Starting server on port $PORT..."
    cd $PROJECT_ROOT
    # Ensure dependencies are installed
    npm install >/dev/null 2>&1
    # Start the server in the background
    PORT=$PORT npm start > /home/team/shared/server.log 2>&1 &
    # Give it a few seconds to boot
    sleep 5
}

while true; do
    check_health
    HEALTH=$?
    if [ $HEALTH -ne 0 ]; then
        if [ $HEALTH -eq 1 ]; then
            echo "Server down. Restarting..."
        else
            echo "Port $PORT occupied by foreign process or server unresponsive. Killing and restarting..."
            # Kill process using the port
            fuser -k $PORT/tcp >/dev/null 2>&1
            sleep 2
        fi
        start_server
    fi
    sleep 30
done
