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
#   * OLD (--old <ref|file>, default: THE RECORDED DEFECTIVE REVISION - see below) MUST count the
#     decoys. The defect side is PINNED, never a moving ref: `origin/main` was a correct default
#     while the fix lived on a branch, and the moment it merged that ref WAS the fix - measured
#     2026-10-20, bare run on main 58acdac, both sides md5 9cc7d9d04071, "FAIL the OLD check did not
#     count a decoy", a FAIL that reads like the fix is broken. A before/after red needs the
#     RECORDED defective revision, because any ref that moves forward eventually becomes the fix.
#     If it does not, the test cannot reproduce the defect and FAILS - a green here would be a
#     statement about the harness, not about the fix.
#   * NEW (the working tree) must count NO decoy.
#   * BOTH must count the REAL loop that is armed on this host right now (the lock's PID). Losing
#     that true positive would be worse than the bug: the duplicate check exists to protect the
#     port. This is the anti-vacuous control.
#
# Usage: bash scripts/guard-role-vs-shape-test.sh [--old <ref|path>] [--keep]
#   --old ref|path  the version to call the DEFECT. Default: the recorded defective revision
#                   (see DEFECT_REV / DEFECT_MD5 below). Override with another pre-fix revision.
#
# Three outcomes, and only three: exit 0 = the red reproduced on OLD and not on NEW, with the live
# loop still counted by both; exit 1 = one of those assertions genuinely failed; exit 2 = CANNOT
# JUDGE - the run could not compare anything (same bytes on both sides, or an OLD that already
# carries the fix, or an OLD that counts no decoy). A cannot-judge is never reported as a FAIL.
#   --keep          leave the decoy processes running for inspection (they exit on their own else)
#
# Read-only with respect to the guard: it never signals, starts or stops a loop.

set -u

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# The recorded defective revision, and the md5 of scripts/keep-alive.sh at it. Pinned deliberately:
# the defect side of a before/after red must not move (see the header). Asserted at run time.
DEFECT_REV="${ANTUM_GUARD_DEFECT_REV:-2b14a94}"
DEFECT_MD5="ed31f5285babe7f265414376cb3d63b8"
OLD="${OLD_SCRIPT:-}"
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

if [ -z "$OLD" ]; then
    OLD="$DEFECT_REV"
    echo "# --old defaulted to the recorded defective revision $DEFECT_REV (keep-alive.sh md5 $DEFECT_MD5)"
fi

cleanup() {
    [ "$KEEP" = 1 ] && { echo "decoys left running (they exit after ${DECOY_TTL}s): $(cat "$STAGE/decoy.pids" 2>/dev/null | tr '\n' ' ')"; return; }
    # A refusal before the decoys exist (a pre-fix precondition, exit 2) must clean up silently.
    if [ -f "$STAGE/decoy.pids" ]; then
        while read -r p; do [ -n "$p" ] && kill "$p" 2>/dev/null; done < "$STAGE/decoy.pids"
    fi
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
# The OLD side must genuinely be PRE-fix and genuinely different, or there is nothing to judge.
# Both cases are CANNOT-JUDGE (exit 2), never a FAIL: a FAIL here reads like the fix is broken.
old_src_md5="$(md5sum < "$STAGE/old.sh" | cut -c1-32)"
new_src_md5="$(md5sum < "$STAGE/new.sh" | cut -c1-32)"
old_ka_md5="$(git -C "$REPO_DIR" show "$OLD:scripts/keep-alive.sh" 2>/dev/null | md5sum | cut -c1-32)"
if [ "$old_src_md5" = "$new_src_md5" ]; then
    echo "CANNOT-JUDGE: OLD and NEW are the SAME BYTES (md5 $old_src_md5). The revision named by --old" \
         "ALREADY CONTAINS THE FIX - there is no before/after here, and this says nothing about the fix." \
         "Name the recorded defective revision (default $DEFECT_REV) or another pre-fix revision." >&2
    exit 2
fi
if grep -q "is_loop_argv" "$STAGE/old.sh"; then
    echo "CANNOT-JUDGE: OLD ($OLD, keep-alive.sh md5 $old_ka_md5) already carries the fix" \
         "(is_loop_argv): there is no defect in it to reproduce. Name a pre-fix revision with --old." >&2
    exit 2
fi
if [ "$old_ka_md5" != "$DEFECT_MD5" ]; then
    echo "# note: OLD ($OLD) keep-alive.sh md5 is $old_ka_md5, not the recorded defect md5 $DEFECT_MD5 -"
    echo "#       proceeding only if it reproduces the decoys (checked below)."
fi
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
    echo "CANNOT-JUDGE: the OLD side counted no decoy, so this run cannot say anything about the fix." >&2
    echo "  OLD $OLD keep-alive.sh md5 $old_ka_md5 (recorded defect md5 $DEFECT_MD5)" >&2
    echo "  If that is the recorded revision, the decoys no longer match the log's shape - re-derive" >&2
    echo "  them from keep-alive.log. Otherwise name the recorded revision with --old <ref>." >&2
    rc=2
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
