#!/bin/bash

# Antum People Self-Healing Loop
#
# WHAT IT DOES
#   Every POLL_INTERVAL seconds (default 60) it asserts that the product server answers the
#   401 contract on PORT (default 3000). Nothing listening  -> start the server.
#   Something else holding the port                        -> evict it (port-claim convention)
#                                                            and start ours.
#   client/dist/index.html missing                         -> rebuild the bundle first.
#
# ARMING THE LOOP:
#   nohup bash scripts/keep-alive.sh &
#   (the file is committed 644, so arm it through bash; that is also how the deploy arms it)
#   The script re-execs itself under setsid on the way, so it does not die with the shell
#   that armed it: after arming, the armed shell shows no loop and the detached instance
#   carries on. (See "WHY IT DETACHES" below.)
#
# CHECKING STATUS:
#   tail -f /home/team/shared/probable-octo-sniffle/server/keep-alive.log
#   pgrep -af keep-alive.sh
#   ls -l /home/team/shared/probable-octo-sniffle/server/keep-alive.lock   (first line = loop PID)
#
# STOPPING / RECLAIMING:
#   kill "$(head -n 1 /home/team/shared/probable-octo-sniffle/server/keep-alive.lock)"
#   or: pkill -f keep-alive.sh
#   The lock is flock()ed on fd 9, which is released automatically when the loop dies.
#   On contention the loop says who really holds the lock (`lsof -t` on the lock file) and
#   whether the PID recorded in the file is alive, retries ANTUM_LOCK_ATTEMPTS times
#   (default 3, ANTUM_LOCK_RETRY_WAIT seconds apart, default 10), and only then either
#   refuses in favour of a live guard or takes over a stale lock.
#
# WHY IT STOPPED (every exit is loud):
#   grep 'EXIT:' /home/team/shared/probable-octo-sniffle/server/keep-alive.log
#   Every exit path writes one dated line naming the reason (lock held by PID X, killed by
#   signal N, missing secret, ...) to the log file AND to stderr, which the deploy sends to
#   server/keep-alive.out. An exit that is not one of the named paths is logged as
#   "loop ended unexpectedly (status N)" by the EXIT trap.
#
# WHY IT DETACHES:
#   The server this loop starts is already started with setsid; the loop itself used to be
#   left inside the arming shell's session. A session teardown then removed the loop while
#   the server it had started kept running - the observed "site up, watchdog gone, nothing
#   in the log" state. Detaching removes that class of death.
#
# KNOWN HARD LIMIT - do not invent a mechanism this host does not have:
#   there is no cron and no systemd here, so nothing re-arms the loop after a host restart.
#   The deploy script arms it; a boot does not. Re-arming after a restart stays manual.
#
# TESTING OFF THE LIVE TREE (WORKFLOW rule 14):
#   The paths and the two waits can be redirected for a scratch run without changing the
#   live defaults: ANTUM_DEPLOY_DIR, ANTUM_PORT, ANTUM_ENV_FILE, ANTUM_POLL_INTERVAL,
#   ANTUM_START_DELAY. Only set them in a test; the deployed tree uses the defaults.

DEPLOY_DIR="${ANTUM_DEPLOY_DIR:-/home/team/shared/probable-octo-sniffle}"
PORT="${ANTUM_PORT:-3000}"
ENV_FILE="${ANTUM_ENV_FILE:-/etc/profile.d/cto-env-vars.sh}"
POLL_INTERVAL="${ANTUM_POLL_INTERVAL:-60}"
START_DELAY="${ANTUM_START_DELAY:-10}"
LOCK_ATTEMPTS="${ANTUM_LOCK_ATTEMPTS:-3}"
LOCK_RETRY_WAIT="${ANTUM_LOCK_RETRY_WAIT:-10}"

LOG_FILE="$DEPLOY_DIR/server/keep-alive.log"
SERVER_LOG="$DEPLOY_DIR/server/server.log"
LOCK_FILE="$DEPLOY_DIR/server/keep-alive.lock"
OUT_FILE="$DEPLOY_DIR/server/keep-alive.out"
SCRIPT_PATH="$(readlink -f "$0" 2>/dev/null || echo "$0")"

mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null

# --- logging and loud exits ----------------------------------------------------------
# One dated line per event, to the log file and to stderr (nohup sends stderr to
# keep-alive.out), so the operator sees the same thing in either channel.
log() {
    local line
    line="$(date -Iseconds) $*"
    echo "$line" >> "$LOG_FILE" 2>/dev/null
    echo "$line" >&2
}

exit_reason=""
# exit_reason marks an exit we have already explained, so the EXIT trap does not add a
# second, vaguer line for it.
log_exit() { exit_reason="$1"; log "EXIT: $1"; }

on_exit() {
    local status=$?
    if [ -z "$exit_reason" ]; then
        log "EXIT: loop ended unexpectedly (status $status) - nothing re-arms this host, so the guard is now down"
    fi
}
trap on_exit EXIT

on_signal() { log_exit "killed by SIG$1 (loop pid $$)"; exit $((128 + $2)); }
trap 'on_signal TERM 15' TERM
trap 'on_signal INT 2' INT
trap 'on_signal QUIT 3' QUIT
# SIGHUP is not a reason to die: a closing arming session sends it, and outliving that
# session is the whole point of arming this loop.
trap 'log "SIGHUP received (arming session closing) - staying up"' HUP

# --- small helpers -------------------------------------------------------------------
with_timeout() {
    local seconds="$1"; shift
    if command -v timeout >/dev/null 2>&1; then timeout "$seconds" "$@"; else "$@"; fi
}

# Live keep-alive.sh loops other than this process. Matched on the interpreter + script
# pair, so an editor or a diff that merely mentions the filename is not mistaken for a loop.
# PIDs on this process's ancestor chain. The shell that armed us is itself a keep-alive.sh
# for the same target while the detach handoff runs, and must not be counted as another
# guard: without this an arm could refuse because of its own arming parent.
ancestor_pids() {
    local pid ppid
    pid="$(sed -n 's/^PPid:[[:space:]]*//p' /proc/self/status 2>/dev/null)"
    while [ -n "$pid" ] && [ "$pid" != "0" ]; do
        echo "$pid"
        ppid="$(sed -n 's/^PPid:[[:space:]]*//p' "/proc/$pid/status" 2>/dev/null)"
        if [ -z "$ppid" ] || [ "$ppid" = "$pid" ]; then break; fi
        pid="$ppid"
    done
}

live_loops() {
    local pid cmd first ancestors
    ancestors="$(ancestor_pids)"
    for pid in $(pgrep -f 'keep-alive\.sh' 2>/dev/null); do
        case " $ancestors " in *" $pid "*) continue ;; esac
        [ "$pid" = "$$" ] && continue
        cmd="$(tr '\0' ' ' 2>/dev/null < "/proc/$pid/cmdline")"
        [ -n "$cmd" ] || continue
        first="${cmd%% *}"
        case "${first##*/}" in
            bash|sh|dash|ash|setsid|nohup|env) printf '%s %s\n' "$pid" "$cmd" ;;
        esac
    done
}

# True when PID $1 is a keep-alive.sh loop guarding THIS deploy dir and port. A loop armed
# for another directory or port (another checkout, a scratch instance) is not our guard and
# must not block a re-arm of ours.
loop_guards_us() {
    local pid="$1" env_dir env_port
    env_dir="$(tr '\0' '\n' 2>/dev/null < "/proc/$pid/environ" | sed -n 's/^ANTUM_DEPLOY_DIR=//p')"
    env_port="$(tr '\0' '\n' 2>/dev/null < "/proc/$pid/environ" | sed -n 's/^ANTUM_PORT=//p')"
    [ "${env_dir:-/home/team/shared/probable-octo-sniffle}" = "$DEPLOY_DIR" ] || return 1
    [ "${env_port:-3000}" = "$PORT" ] || return 1
    return 0
}

# The live loops that guard our own target.
guarding_loops() {
    local pid rest
    live_loops | while read -r pid rest; do
        [ -n "$pid" ] || continue
        loop_guards_us "$pid" && echo "$pid $rest"
    done
}

# PIDs LISTENING on our port (LISTEN only - a plain `lsof -i :PORT` also lists clients,
# which would let this loop kill an unrelated process that merely connected to us).
listener_pids() {
    with_timeout 5 lsof -t -i ":$PORT" -sTCP:LISTEN 2>/dev/null | sort -u
}

# Our own server processes: cmdline `node index.js` AND cwd inside this deploy dir.
# Cmdline alone is not enough - scratch instances and other checkouts run the same command.
server_pids() {
    local pid real
    real="$(readlink -f "$DEPLOY_DIR/server" 2>/dev/null)"
    for pid in $(pgrep -f 'node index\.js' 2>/dev/null); do
        [ "$pid" = "$$" ] && continue
        [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" = "$real" ] || continue
        echo "$pid"
    done | sort -u
}

describe_pids() {
    local p out=""
    for p in $1; do
        out="$out$p($(ps -p "$p" -o comm= 2>/dev/null | tr -d '[:space:]')) "
    done
    echo "$out"
}

# --- detach into our own session -----------------------------------------------------
if [ "${ANTUM_KEEPALIVE_DETACHED:-0}" != "1" ]; then
    my_sid="$(ps -o sid= -p $$ 2>/dev/null | tr -d '[:space:]')"
    if [ "$my_sid" = "$$" ]; then
        log "armed as its own session leader (pid $$) - no detach needed"
    elif command -v setsid >/dev/null 2>&1; then
        log "detaching: arming session ${my_sid:-unknown}, re-execing under setsid (handoff from pid $$)"
        ANTUM_KEEPALIVE_DETACHED=1 setsid nohup bash "$SCRIPT_PATH" "$@" >> "$OUT_FILE" 2>&1 &
        sleep 3
        live_after="$(guarding_loops)"
        if [ -n "$live_after" ]; then
            log_exit "deliberate handoff: detached instance is up (guards for port $PORT now: $(echo "$live_after" | tr '\n' ';'))"
            exit 0
        fi
        # Never leave the port unwatched on the way out: if the handoff produced no loop,
        # say so and fail loudly.
        log_exit "detach produced no live guard for port $PORT within 3s - nothing is watching it; re-arm this loop by hand"
        exit 1
    else
        log "WARN: setsid not found - running inside the arming session (${my_sid:-unknown}); a session teardown can kill this loop"
    fi
fi

# --- single instance lock ------------------------------------------------------------
# The lock is held on fd 9 of THIS process, and fd 9 is closed (9>&-) for every child that
# outlives a check: the server it starts, the npm runs, and the poll sleeps. It used to be
# inherited by those children, and a child then kept the flock alive after the loop was
# gone. Observed live on 2026-10-06: the running product server held fd 9 on
# server/keep-alive.lock, so any later re-arm was refused for good, in the name of the
# loop's dead PID, while the site ran with no guard at all. An orphaned poll `sleep`
# inherited the same fd and held the lock for up to one poll interval.
# Who actually holds the lock right now. The PID written in the file is a claim, not a fact:
# on the deployment the file named the loop's dead PID while a child held the lock.
lock_holder_pids() { with_timeout 5 lsof -t "$LOCK_FILE" 2>/dev/null | sort -u; }

holder_report() {
    local p out="" recorded
    recorded="$(head -n 1 "$LOCK_FILE" 2>/dev/null | tr -d '[:space:]')"
    for p in $(lock_holder_pids); do
        out="$out$p($(ps -p "$p" -o comm= 2>/dev/null | tr -d '[:space:]')) "
    done
    [ -n "$out" ] || out="none"
    if [ -z "$recorded" ]; then
        echo "holders: $out; the file names no PID"
    elif kill -0 "$recorded" 2>/dev/null; then
        echo "holders: $out; the file names PID $recorded (alive)"
    else
        echo "holders: $out; the file names PID $recorded (DEAD - the file is stale)"
    fi
}

touch "$LOCK_FILE" 2>/dev/null
chmod 664 "$LOCK_FILE" 2>/dev/null || true

# Probe writability in a subshell first: a redirection error on `exec` below would end the
# shell on the spot, with no line in any log.
if ! ( : >> "$LOCK_FILE" ) 2>/dev/null; then
    log_exit "cannot write $LOCK_FILE (owner/permissions) - refusing to start rather than leave the port unwatched once"
    exit 1
fi

exec 9<>"$LOCK_FILE"
locked=""
for attempt in $(seq 1 "$LOCK_ATTEMPTS"); do
    if flock -n 9; then
        locked=1
        break
    fi
    log "lock held (attempt $attempt of $LOCK_ATTEMPTS) - $(holder_report)"
    [ "$attempt" = "$LOCK_ATTEMPTS" ] || sleep "$LOCK_RETRY_WAIT" 9>&-
done

if [ -z "$locked" ]; then
    live="$(guarding_loops)"
    if [ -n "$live" ]; then
        log_exit "refusing to start: a live keep-alive.sh already guards $DEPLOY_DIR on port $PORT - $(echo "$live" | tr '\n' ';'); $(holder_report)"
        exit 1
    fi
    others="$(live_loops)"
    if [ -n "$others" ]; then
        log "note: other keep-alive.sh loops exist for different targets - they are not this port's guard: $(echo "$others" | tr '\n' ';')"
    fi
    # Still held after retrying, and no live guard for this target: a stale lock, e.g. a
    # process that inherited fd 9 from an earlier build of this loop. Take it over, loudly.
    log "stale lock after $LOCK_ATTEMPTS attempts - $(holder_report); reclaiming on a fresh lock file"
    mv -f "$LOCK_FILE" "$LOCK_FILE.stale" 2>/dev/null || rm -f "$LOCK_FILE" 2>/dev/null
    : > "$LOCK_FILE" 2>/dev/null
    exec 9<>"$LOCK_FILE"
    if flock -n 9; then
        locked=1
        log "stale lock reclaimed on a fresh lock file (the previous holder keeps its orphaned one)"
    else
        log_exit "reclaimed lock file is also held - refusing to run a duplicate guard on port $PORT ($(holder_report))"
        exit 1
    fi
fi

# Guard against a reclaimer having replaced the lock file between our lock and now: if the
# path no longer names the inode we locked, we are not the single instance we think we are.
if [ "$(stat -c %i /proc/self/fd/9 2>/dev/null)" != "$(stat -c %i "$LOCK_FILE" 2>/dev/null)" ]; then
    log_exit "lock file was replaced under us - refusing to run a second guard on port $PORT"
    exit 1
fi
echo $$ > "$LOCK_FILE" 2>/dev/null || log "WARN: could not record loop PID in $LOCK_FILE (lock still held)"

# --- secrets -------------------------------------------------------------------------
if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    log "environment sourced from $ENV_FILE"
else
    log "WARN: $ENV_FILE not found - relying on the environment this loop was armed with"
fi

if [ -z "${JWT_SECRET:-}" ] || [ -z "${ENCRYPTION_KEY:-}" ]; then
    log_exit "JWT_SECRET or ENCRYPTION_KEY is missing - refusing to start a server that cannot boot"
    exit 1
fi

# --- health --------------------------------------------------------------------------
check_health() {
    # Nothing listening.
    [ -n "$(listener_pids)" ] || return 1

    # Hardening: assert the login contract instead of just the page title.
    # /api/employees is a protected route and is NOT covered by the failure-only login
    # limiter; a healthy server answers 401 with a specific body. Byte-for-byte the same
    # contract the deploy asserts - do not weaken it.
    # Every external call is bounded by timeout/--max-time, so a hung probe cannot wedge
    # the loop; null bytes are stripped because they only produce shell warnings.
    local response
    response="$(with_timeout 8 curl -s -i --noproxy '*' --max-time 5 "http://127.0.0.1:$PORT/api/employees" 2>/dev/null | tr -d '\000')"

    if printf '%s' "$response" | grep -q 'HTTP/.* 401' && \
       printf '%s' "$response" | grep -q '{"error":"Authentication token required"}'; then
        return 0 # healthy
    fi
    return 2 # listening, but not our contract
}

start_server() {
    log "starting server: port $PORT, cwd $DEPLOY_DIR/server"
    cd "$DEPLOY_DIR/server" || { log "ERROR: cannot cd to $DEPLOY_DIR/server - not starting"; return 1; }
    if [ ! -d "node_modules" ]; then
        log "server/node_modules missing - installing"
        with_timeout 600 npm install 9>&- >> "$LOG_FILE" 2>&1 || log "WARN: npm install failed; still attempting to start"
    fi
    # 9>&- : the server must NOT inherit the lock fd (that leak is the stale-lock bug).
    PORT="$PORT" setsid nohup node index.js >> "$SERVER_LOG" 2>&1 9>&- &
    wait_for_health
}

wait_for_health() {
    local i
    for i in $(seq 1 20); do
        sleep 1 9>&-
        if check_health; then
            log "server answered the 401 contract on port $PORT after ${i}s"
            return 0
        fi
    done
    log "WARN: nothing answered the 401 contract on port $PORT within 20s of starting - the next poll retries"
    return 1
}

rebuild_client() {
    log "client/dist/index.html missing - rebuilding bundle"
    ( cd "$DEPLOY_DIR/client" && \
      with_timeout 900 npm ci --no-fund --no-audit 9>&- && \
      NODE_OPTIONS=--max-old-space-size=560 with_timeout 900 npm run build 9>&- ) >> "$LOG_FILE" 2>&1
    if [ -f "$DEPLOY_DIR/client/dist/index.html" ]; then
        log "client bundle rebuilt"
    else
        log "ERROR: rebuild finished without $DEPLOY_DIR/client/dist/index.html"
    fi
}

# --- the loop ------------------------------------------------------------------------
started_at="pid $$ since $(date -Iseconds)"
log "guard starting: port $PORT, deploy dir $DEPLOY_DIR, poll ${POLL_INTERVAL}s, lock $LOCK_FILE"

# Initial delay to let the system settle after boot.
sleep "$START_DELAY" 9>&-

while true; do
    check_health
    health=$?

    if [ "$health" -eq 0 ]; then
        : # healthy, do nothing
    elif [ "$health" -eq 2 ]; then
        pids="$(listener_pids)"
        if [ -n "$pids" ]; then
            log "port $PORT fails the 401 contract, held by $(describe_pids "$pids") - evicting (port-claim convention)"
            for p in $pids; do [ "$p" = "$$" ] || kill -9 "$p" 2>/dev/null; done
            sleep 2 9>&-
            start_server
        fi
    else
        log "port $PORT is empty - recovering"
        [ -f "$DEPLOY_DIR/client/dist/index.html" ] || rebuild_client

        pids="$(server_pids)"
        if [ -z "$pids" ]; then
            start_server
        else
            log "server process(es) $(echo "$pids" | tr '\n' ' ') exist in $DEPLOY_DIR/server but port $PORT does not answer - killing and restarting"
            for p in $pids; do [ "$p" = "$$" ] || kill -9 "$p" 2>/dev/null; done
            sleep 2 9>&-
            start_server
        fi
    fi

    sleep "$POLL_INTERVAL" 9>&-
done
