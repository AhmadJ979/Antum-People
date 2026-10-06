#!/bin/bash
# Regression test for keep-alive.sh that exercises BOTH arming paths.
#
# WHY THIS EXISTS: on 2026-10-06 the hardened loop from PR #54 passed a battery that armed it
# as `nohup bash scripts/keep-alive.sh &` - the path where the loop self-detaches and re-execs
# itself under setsid. deploy-main.sh arms it as
#   ( cd "$DEPLOY_DIR" && setsid nohup bash scripts/keep-alive.sh >> ... & )
# which already makes the loop a session leader, so it does NOT re-exec, and the only marker
# of "this is my own fork" that the loop used lived in the exec-time environment that a
# re-exec creates. On the deploy path that marker was absent, the loop counted its own forks as
# "another keep-alive.sh" and refused to arm at all - on the live host, three times in a row
# (keep-alive.log 10:07:31 / 10:07:37 / 10:07:43), which left the site unguarded. A test that
# only covers the self-detaching path cannot see that.
#
# USAGE:  bash scripts/keep-alive-deploypath-test.sh
# Exit 0 = every case passed; non-zero = do not deploy this loop.
#
# It runs entirely off the live tree: a detached worktree of HEAD in a scratch directory, its
# own ports, its own database, throwaway secrets. It aborts if its ports are in use.
set -u

REPO="$(readlink -f "$(dirname "${BASH_SOURCE[0]}")/..")"
ROOT="${ANTUM_TEST_ROOT:-/tmp/antum-keepalive-test}"
PORT_DEPLOY="${ANTUM_TEST_PORT_DEPLOY:-4821}"
PORT_DETACH="${ANTUM_TEST_PORT_DETACH:-4822}"
TREE="$ROOT/tree"
ENVF="$ROOT/env.sh"
LOGF="$ROOT/test.log"
PASS=0
FAIL=0

# The scratch root has to exist before anything is redirected into it.
rm -rf "$ROOT"
mkdir -p "$ROOT"
: > "$LOGF"
exec > >(tee -a "$LOGF") 2>&1

note() { printf '%s\n' "$*"; }
ok()   { PASS=$((PASS + 1)); note "  PASS: $*"; }
bad()  { FAIL=$((FAIL + 1)); note "  FAIL: $*"; }
check() { if "${@:2}"; then ok "$1"; else bad "$1"; fi; }
head_log()    { tail -3 "$L" | sed 's/^/    /'; }
log_says()    { grep -q "$1" "$L"; }
log_lacks()   { ! grep -q "$1" "$L"; }

if ! git -C "$REPO" worktree add --detach "$TREE" HEAD >/dev/null 2>&1; then
    note "ABORT: could not create a worktree of HEAD in $TREE"; exit 2
fi
ln -sfn "$REPO/server/node_modules" "$TREE/server/node_modules"
mkdir -p "$TREE/client/dist"
printf '<!doctype html><title>Antum People</title><h1>scratch</h1>' > "$TREE/client/dist/index.html"
{
    echo "export JWT_SECRET='$(head -c 32 /dev/urandom | base64 | tr -d '\n')'"
    echo "export ENCRYPTION_KEY='$(head -c 32 /dev/urandom | base64 | tr -d '\n' | cut -c1-32)'"
} > "$ENVF"
for p in "$PORT_DEPLOY" "$PORT_DETACH"; do
    holders="$(lsof -t -i ":$p" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')"
    if [ -n "$holders" ]; then
        note "ABORT: port $p is in use by $holders"
        git -C "$REPO" worktree remove --force "$TREE" >/dev/null 2>&1
        exit 2
    fi
done

# shellcheck disable=SC1090
. "$ENVF"
# Redirect every constant of the loop at the scratch tree, so nothing can reach the
# deployment. ANTUM_KEEPALIVE_TOKEN is deliberately NOT set: the deploy command does not set
# it either, and that difference is the whole point of this test.
export PRODUCT_DB_PATH="$ROOT/db.sqlite"
export ANTUM_DEPLOY_DIR="$TREE"
export ANTUM_ENV_FILE="$ENVF"
export ANTUM_START_DELAY=1
export ANTUM_POLL_INTERVAL=5
export ANTUM_LOCK_ATTEMPTS=2
export ANTUM_LOCK_RETRY_WAIT=2
KAS="$TREE/scripts/keep-alive.sh"
L="$TREE/server/keep-alive.log"
LOCK="$TREE/server/keep-alive.lock"
OUT="$TREE/server/keep-alive.out"

# The operational definition of "a guard is up": exactly one process holds the lock.
holders()      { lsof -t "$LOCK" 2>/dev/null | sort -u; }
holder_count() { holders | wc -l | tr -d ' '; }
guard_pid()    { holders | head -1; }
health()       { curl -s -o /dev/null -w '%{http_code}' --noproxy '*' --max-time 5 "http://127.0.0.1:$1/api/employees"; }
wait_health()  { for _i in $(seq 1 20); do [ "$(health "$1")" = "401" ] && return 0; sleep 1; done; return 1; }
arm_deploy_style() { ( cd "$TREE" && setsid nohup bash scripts/keep-alive.sh >> "$OUT" 2>&1 & ) ; }
one_holder()   { [ "$(holder_count)" = "1" ]; }
# The fd-9 leak: a child of the guard (the server it started) must not hold the lock.
no_child_holds_lock() {
    local p
    for p in $(pgrep -f 'node index\.js' 2>/dev/null); do
        [ "$(readlink -f "/proc/$p/cwd" 2>/dev/null)" = "$TREE/server" ] || continue
        ls -l "/proc/$p/fd" 2>/dev/null | grep -q 'keep-alive.lock' && return 1
    done
    return 0
}
stop_all() {
    for p in $(holders); do kill -9 "$p" 2>/dev/null; done
    for port in "$PORT_DEPLOY" "$PORT_DETACH"; do
        for p in $(lsof -t -i ":$port" -sTCP:LISTEN 2>/dev/null); do kill -9 "$p" 2>/dev/null; done
    done
    sleep 2
}

note "=== keep-alive: deploy-path test $(date -Iseconds) ==="
note "artifact: $(git -C "$REPO" log --oneline -1)"
note "sha256:   $(sha256sum "$KAS" | cut -d' ' -f1)"
note "tree: $TREE   ports: $PORT_DEPLOY (deploy path), $PORT_DETACH (self-detach path)"
bash -n "$KAS" && note "  bash -n: clean" || note "  bash -n: SYNTAX ERROR"

# --- case 1: exactly what deploy-main.sh does -----------------------------------------
note "--- case 1: arm as deploy-main.sh does (setsid: the loop must NOT need to re-exec) ---"
export ANTUM_PORT="$PORT_DEPLOY"
: > "$L"
arm_deploy_style
sleep 12
head_log
check "deploy path: exactly one guard holds the lock" one_holder
check "deploy path: the guard serves the 401 contract on $PORT_DEPLOY" wait_health "$PORT_DEPLOY"
check "deploy path: we really took the no-re-exec branch" log_says 'armed as its own session leader'
check "deploy path: nothing was logged as a duplicate guard" log_lacks 'another keep-alive.sh also guards'

# --- case 2: a second arm must refuse and leave the live guard alone -------------------
note "--- case 2: arm again while a guard is live (must refuse, must not disturb it) ---"
FIRST="$(guard_pid)"
timeout 60 bash "$KAS" >/dev/null 2>&1
sleep 2
head_log
check "second arm did not become a second guard" one_holder
check "the live guard was not disturbed (still pid $FIRST)" test "$(guard_pid)" = "$FIRST"
check "the second arm said why it stood down" log_says 'already guards\|refusing\|no live guard'
check "the site stayed up through the second arm" wait_health "$PORT_DEPLOY"

# --- case 3: kill the guard; the lock must die with it and a re-arm must land ----------
note "--- case 3: SIGKILL the guard; no lock holder may survive, a re-arm must land ---"
for p in $(holders); do kill -9 "$p" 2>/dev/null; done
sleep 3
check "no process holds the lock after the kill" test "$(holder_count)" = "0"
arm_deploy_style
sleep 12
head_log
check "the re-arm landed" one_holder
check "the recovered guard serves the 401 contract" wait_health "$PORT_DEPLOY"
check "no child of the guard holds the lock fd (the old fd-9 leak)" no_child_holds_lock

# --- case 4: the self-detach path (no setsid at arm time) -----------------------------
note "--- case 4: arm with nohup only, so the loop self-detaches and re-execs ---"
for p in $(holders); do kill -9 "$p" 2>/dev/null; done
sleep 2
export ANTUM_PORT="$PORT_DETACH"
: > "$L"
nohup bash "$KAS" > "$ROOT/detach-arm.out" 2>&1 &
sleep 14
head_log
check "self-detach path: exactly one guard holds the lock" one_holder
check "self-detach path: the guard serves the 401 contract on $PORT_DETACH" wait_health "$PORT_DETACH"
check "self-detach path: the handoff was logged as a handoff" log_says 'deliberate handoff'

stop_all
git -C "$REPO" worktree remove --force "$TREE" >/dev/null 2>&1
note
note "=== result: $PASS passed, $FAIL failed (full log: $LOGF) ==="
[ "$FAIL" -eq 0 ] || exit 1
