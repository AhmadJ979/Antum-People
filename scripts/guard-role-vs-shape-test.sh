#!/bin/bash
# Does the duplicate-guard check read a process's ROLE, or a string's SHAPE?
#
# The defect (keep-alive.log, 2026-10-20T15:13:46-15:13:56, six refusals in 27 s): the candidate
# test was "argv[0] is an interpreter AND the string keep-alive.sh appears later in the command
# line". It therefore counted the host's own session-bootstrap shell and transient probes as
# duplicate guards and refused to arm at all - the product was served by nothing for 27 seconds:
#
#   EXIT: acquired the lock but another keep-alive.sh also guards ... - refusing to run a
#   duplicate guard: 27193 sh -c bash -lc '...test -f ".../scripts/keep-alive.sh"...';
#                     27195 bash -lc cd "$HOME" 2>/dev/null; test -f ".../keep-alive.sh"...
#
# This test measures BOTH versions of the predicate against LIVE pids, and it is built so it cannot
# pass vacuously:
#
#   * OLD (the committed script, `--old <ref|file>`, default origin/main) MUST count the decoys.
#     If it does not, the test cannot reproduce the defect and FAILS - a green here would be a
#     statement about the harness, not about the fix.
#   * NEW (the working tree) must count NO decoy.
#   * BOTH must count the REAL loop that is armed on this host right now (the lock's PID). Losing
#     that true positive would be worse than the bug: the duplicate check exists to protect the
#     port. This is the anti-vacuous control.
#
# Usage: bash scripts/guard-role-vs-shape-test.sh [--old <ref|path>] [--keep]
#   --old ref|path  the version to call the DEFECT (default origin/main)
#   --keep          leave the decoy processes running for inspection (they exit on their own else)
#
# Read-only with respect to the guard: it never signals, starts or stops a loop.

set -u

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OLD="${OLD_SCRIPT:-origin/main}"
KEEP=0
DEPLOY_DIR="${ANTUM_DEPLOY_DIR:-/home/team/shared/probable-octo-sniffle}"
PORT="${ANTUM_PORT:-3000}"
STAGE="$(mktemp -d /tmp/guard-role-vs-shape-XXXXXX)"
DECOY_TTL="${DECOY_TTL:-90}"

while [ $# -gt 0 ]; do
    case "$1" in
        --old) OLD="$2"; shift 2 ;;
        --old=*) OLD="${1#*=}"; shift ;;
        --keep) KEEP=1; shift ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
done

cleanup() {
    [ "$KEEP" = 1 ] && { echo "decoys left running (they exit after ${DECOY_TTL}s): $(cat "$STAGE/decoy.pids" 2>/dev/null | tr '\n' ' ')"; return; }
    while read -r p; do [ -n "$p" ] && kill "$p" 2>/dev/null; done < "$STAGE/decoy.pids" 2>/dev/null
    rm -rf "$STAGE"
}
trap cleanup EXIT

# --- the two versions of the predicate, EXTRACTED from the artifacts (never retyped) -----------
# The block runs from proc_status_field() to the line before listener_pids(), which is exactly the
# process-identification machinery: proc_status_field, our_own_process, ancestor_pids, live_loops
# (+ is_loop_argv in the fixed version), loop_guards_us, handoff_loops, guarding_loops.
extract_functions() {  # $1 = a keep-alive.sh (file)  -> prints the block
    awk '/^proc_status_field\(\) \{/,/^listener_pids\(\) \{/' "$1" | sed '$d'
}

if [ -f "$OLD" ]; then
    cp "$OLD" "$STAGE/old.sh"
else
    git -C "$REPO_DIR" show "$OLD:scripts/keep-alive.sh" > "$STAGE/old.sh" 2>/dev/null \
        || { echo "cannot read $OLD:scripts/keep-alive.sh" >&2; exit 2; }
fi
cp "$REPO_DIR/scripts/keep-alive.sh" "$STAGE/new.sh"
grep -q "^live_loops() {" "$STAGE/old.sh" || { echo "extraction anchor missing in OLD" >&2; exit 2; }
grep -q "^live_loops() {" "$STAGE/new.sh" || { echo "extraction anchor missing in NEW" >&2; exit 2; }
echo "# old = $OLD  ($(md5sum < "$STAGE/old.sh" | cut -c1-12))"
echo "# new = $REPO_DIR/scripts/keep-alive.sh  ($(md5sum < "$STAGE/new.sh" | cut -c1-12))"
echo "# deploy dir = $DEPLOY_DIR  port = $PORT"
echo

# --- decoys: the exact shapes from the log, held open ------------------------------------------
# The log's probes were transient, and a transient shape cannot be measured twice; `sleep` keeps the
# same argv shape alive. The discriminator under test is positional (argv[1] is a FLAG), and the
# string keep-alive.sh sits in the command exactly as it did in the log.
: > "$STAGE/decoy.pids"
start_decoy() {
    setsid nohup "$@" >/dev/null 2>&1 &
    echo "$!" >> "$STAGE/decoy.pids"
}
# The trailing `; :` matters: bash EXECS the last command of `-c`, so a decoy ending in `sleep 90`
# becomes argv `sleep 90` and stops being the shape under test. (The first draft did exactly that;
# the test then refused to redden instead of passing vacuously - which is how it was caught.)
start_decoy bash -lc "cd \"\$HOME\" 2>/dev/null; test -f \"$DEPLOY_DIR/scripts/keep-alive.sh\" && echo exists; sleep $DECOY_TTL; :"
start_decoy sh -c "bash -lc 'HOME=/home/agent-lead bash -lc '\"'\"'cd \"\$HOME\" 2>/dev/null; test -f \"$DEPLOY_DIR/scripts/keep-alive.sh\" && echo \"exists\"'\"'\"''; sleep $DECOY_TTL; :"
sleep 1
echo "=== the decoys, as the kernel holds them (argv of each) ==="
decoy_shape_bad=0
for p in $(cat "$STAGE/decoy.pids"); do
    printf '  pid %s argv: ' "$p"; tr '\0' ' ' < "/proc/$p/cmdline" 2>/dev/null; echo
    # Assert the SHAPE the log shows: argv[0] an interpreter, argv[1] a FLAG, the script name later.
    # If a decoy is not that shape this test is measuring something else - fail, do not report.
    argv1="$(tr '\0' '\n' < "/proc/$p/cmdline" 2>/dev/null | sed -n 2p)"
    case "$argv1" in -*) : ;; *) echo "    FAIL: decoy argv[1] is '$argv1', not a flag - wrong shape"; decoy_shape_bad=1 ;; esac
    tr '\0' ' ' < "/proc/$p/cmdline" 2>/dev/null | grep -q 'keep-alive\.sh' \
        || { echo "    FAIL: decoy does not mention the script name - wrong shape"; decoy_shape_bad=1; }
done
[ "$decoy_shape_bad" = 0 ] || { echo "  the decoys are not the log's shape; refusing to report a verdict"; exit 2; }
echo

# --- the real loop, from the lock --------------------------------------------------------------
REAL=""
[ -f "$DEPLOY_DIR/server/keep-alive.lock" ] && REAL="$(head -n 1 "$DEPLOY_DIR/server/keep-alive.lock" 2>/dev/null)"
if [ -n "$REAL" ] && [ -d "/proc/$REAL" ]; then
    printf '=== the real loop (lock pid %s): argv: ' "$REAL"; tr '\0' ' ' < "/proc/$REAL/cmdline" 2>/dev/null; echo
else
    echo "=== WARNING: no live loop found via $DEPLOY_DIR/server/keep-alive.lock - the true-positive half cannot be asserted"
    REAL=""
fi
echo

# --- measure ------------------------------------------------------------------------------------
measure() {  # $1 = label, $2 = version file ; prints the counts and the pids it calls guards
    local label="$1" ver="$2" hits decoy_hits=0 real_hit=0
    { extract_functions "$ver"; echo 'guarding_loops'; } > "$STAGE/$label.run.sh"
    DEPLOY_DIR="$DEPLOY_DIR" PORT="$PORT" KEEPALIVE_TOKEN="harness" \
        bash "$STAGE/$label.run.sh" > "$STAGE/$label.out" 2>"$STAGE/$label.err"
    hits="$(cat "$STAGE/$label.out")"
    echo "=== $label ==="
    if [ -z "$hits" ]; then
        echo "  calls NOTHING a duplicate guard"
    else
        echo "$hits" | while read -r pid rest; do
            printf '  calls pid %s a guard: %s\n' "$pid" "$rest"
        done
    fi
    while read -r p; do
        [ -n "$p" ] || continue
        echo "$hits" | awk '{print $1}' | grep -qx "$p" && decoy_hits=$((decoy_hits + 1))
    done < "$STAGE/decoy.pids"
    if [ -n "$REAL" ] && echo "$hits" | awk '{print $1}' | grep -qx "$REAL"; then real_hit=1; fi
    printf '  -> decoys called guards: %s   real loop called guard: %s\n' "$decoy_hits" "$real_hit"
    echo "$decoy_hits $real_hit" > "$STAGE/$label.verdict"
    [ -s "$STAGE/$label.err" ] && { echo "  (stderr:) $(head -2 "$STAGE/$label.err")"; }
    echo
}

measure OLD "$STAGE/old.sh"
measure NEW "$STAGE/new.sh"

read -r old_decoys old_real < "$STAGE/OLD.verdict"
read -r new_decoys new_real < "$STAGE/NEW.verdict"

echo "=== verdict ==="
rc=0
if [ "${old_decoys:-0}" -lt 1 ]; then
    echo "  FAIL  the OLD check did not count a decoy - this test is not reproducing the defect," \
         "so it cannot say anything about the fix"; rc=1
else
    echo "  ok    OLD counts ${old_decoys} decoy(s) as duplicate guards - the defect reproduces (the red)"
fi
if [ "${new_decoys:-0}" -ne 0 ]; then
    echo "  FAIL  NEW still counts ${new_decoys} decoy(s) - the shape test is still in the path"; rc=1
else
    echo "  ok    NEW counts 0 decoys - a shell running a command that mentions the name is not a loop"
fi
if [ -n "$REAL" ]; then
    if [ "${new_real:-0}" = 1 ] && [ "${old_real:-0}" = 1 ]; then
        echo "  ok    BOTH count the real loop (pid $REAL) - the true positive survives (anti-vacuous)"
    else
        echo "  FAIL  the real loop is not counted by both (OLD=${old_real:-0} NEW=${new_real:-0})" \
             "- the check no longer protects the port"; rc=1
    fi
else
    echo "  SKIP  no live loop on this host: the true-positive half was not asserted"
fi
[ "$KEEP" = 1 ] || true
exit "$rc"
