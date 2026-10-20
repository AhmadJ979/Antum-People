#!/bin/bash
# LIVE acceptance of the guard fix (PR #272, shipped by the 16:08:51Z movement as 58acdac).
#
# The defect, 2026-10-20T15:13:46-15:13:56 (27 s): the duplicate check matched a STRING'S SHAPE.
# Shells and probes that merely NAMED scripts/keep-alive.sh in their argv were counted as duplicate
# guards, so six re-arms refused and the product was served by nothing while the site stayed up.
# The fix decides by ROLE (is_loop_argv: interpreter + script as its first, non-flag argument).
#
# This script does what the shipped unit test deliberately does not: it ARMS a guard while a naming
# probe is alive and requires the arm to succeed.
#
# RUN 1 OF THIS SCRIPT WAS VOID, and the mechanism is worth keeping: the decoy was
#   bash -lc 'test -f ".../keep-alive.sh" && echo exists; sleep 240'
# and bash EXECS the last command of -c, so the process became argv `sleep 240` - it no longer named
# the path and the arm proved nothing about the fix. This version ASSERTS the decoy's shape before
# arming and exits 2 without reporting a verdict if the shape is wrong (same discipline as
# scripts/guard-role-vs-shape-test.sh:104), and it appends the trailing `; :` that prevents the exec.
#
# Safety: the port is never left unguarded. Every path ends by asserting one role-loop holds the
# lock; the last resort arms without decoys and says so.
set -u
export HOME=/home/agent-lead

TREE=/home/team/shared/probable-octo-sniffle
LOCK="$TREE/server/keep-alive.lock"
KLOG="$TREE/server/keep-alive.log"
OUT=/home/team/shared/movements/2026-10-20T1607Z/guard-acceptance2.out
PUB=https://b974147c03228029e277d1cbe6646fe6.ctonew.app
DECOY_TTL=240

: > "$OUT"
say() { echo "$(date -u +%H:%M:%SZ) $*" | tee -a "$OUT"; }

# A loop is `bash <script>`: interpreter first, script as its first non-flag argument - the same
# positional rule the fix uses, applied here so this script counts GUARDS, not mentions.
role_loops() {
    local pid argv first interp="" seen=0 line
    for pid in $(pgrep -f 'keep-alive\.sh' 2>/dev/null); do
        argv="$(tr '\0' '\n' < "/proc/$pid/cmdline" 2>/dev/null)"; [ -n "$argv" ] || continue
        interp=""; seen=0
        while IFS= read -r line; do
            case "${line##*/}" in setsid|nohup|env|time|nice|stdbuf|exec) continue ;; esac
            if [ -z "$interp" ]; then
                case "$line" in *=*) continue ;; esac
                case "${line##*/}" in bash|sh|dash|ash|ksh|zsh) interp="$line"; continue ;; *) break ;; esac
            fi
            first="$line"; seen=1; break
        done <<< "$argv"
        [ "$seen" = 1 ] || continue
        case "$first" in -*) continue ;; esac
        case "${first##*/}" in keep-alive.sh) echo "$pid" ;; esac
    done
}
lock_pid() { head -n 1 "$LOCK" 2>/dev/null | tr -d '[:space:]'; }

say "=== BEFORE ==="
say "lock names pid $(lock_pid); role-loops: $(role_loops | tr '\n' ' '); pgrep mentions: $(pgrep -f 'keep-alive\.sh' | wc -l | tr -d ' ')"
say "public: $(curl -s -o /tmp/ga.html -w '%{http_code}' --noproxy '*' --max-time 10 "$PUB") $(grep -o '<title>[^<]*' /tmp/ga.html 2>/dev/null)"

# --- the decoys: the log's own shapes, held open (the shipped test's construction, verbatim) ----
STAGE="$(mktemp -d /tmp/ga-decoys-XXXXXX)"
: > "$STAGE/decoy.pids"
start_decoy() { setsid nohup "$@" >/dev/null 2>&1 & echo "$!" >> "$STAGE/decoy.pids"; }
# The trailing `; :` matters: bash EXECS the last command of -c (see the header).
start_decoy bash -lc "cd \"\$HOME\" 2>/dev/null; test -f \"$TREE/scripts/keep-alive.sh\" && echo exists; sleep $DECOY_TTL; :"
start_decoy sh -c "bash -lc 'HOME=/home/agent-lead bash -lc '\"'\"'cd \"\$HOME\" 2>/dev/null; test -f \"$TREE/scripts/keep-alive.sh\" && echo \"exists\"'\"'\"''; sleep $DECOY_TTL; :"
sleep 2

say "=== THE DECOYS, AS THE KERNEL HOLDS THEM - the precondition, asserted ==="
shape_bad=0
for p in $(cat "$STAGE/decoy.pids"); do
    say "  pid $p argv: $(tr '\0' ' ' < /proc/$p/cmdline 2>/dev/null)"
    argv1="$(tr '\0' '\n' < "/proc/$p/cmdline" 2>/dev/null | sed -n 2p)"
    case "$argv1" in -*) : ;; *) say "  FAIL: decoy argv[1] is '$argv1', not a flag - wrong shape"; shape_bad=1 ;; esac
    tr '\0' ' ' < "/proc/$p/cmdline" 2>/dev/null | grep -q 'keep-alive\.sh' \
        || { say "  FAIL: decoy does not name the script - wrong shape"; shape_bad=1; }
done
if [ "$shape_bad" != 0 ]; then
    say "PRECONDITION NOT ESTABLISHED - the decoys are not the log's shape; refusing to report a verdict about the fix"
    while read -r p; do [ -n "$p" ] && kill "$p" 2>/dev/null; done < "$STAGE/decoy.pids"; rm -rf "$STAGE"
    say "host untouched: lock names $(lock_pid), role-loops $(role_loops | tr '\n' ' ')"
    exit 2
fi
say "precondition established: both decoys name the path with a FLAG in argv[1]; role-loops still $(role_loops | tr '\n' ' ')"

# --- the arm, with the naming probes alive: this is the acceptance ------------------------------
OLD=$(lock_pid)
say "=== REAPING the armed guard by the PID its own lock names ($OLD) - never pkill -f ==="
[ -n "$OLD" ] && kill -TERM "$OLD" 2>/dev/null
for i in $(seq 1 15); do kill -0 "$OLD" 2>/dev/null || break; sleep 1; done
say "guard $OLD gone: $([ -n "$OLD" ] && kill -0 "$OLD" 2>/dev/null && echo NO || echo yes)"
say "its own exit line: $(grep 'EXIT:' "$KLOG" | tail -1)"
WINDOW_START="$(date -u +%FT%T)"

say "=== ARMING while both decoys are alive (the arm the defect refused, six times in 27 s) ==="
armed=""
for attempt in 1 2 3; do
    ( cd "$TREE" && setsid nohup bash scripts/keep-alive.sh >> server/keep-alive.out 2>&1 & ) 2>/dev/null
    for i in $(seq 1 20); do
        p=$(lock_pid)
        if [ -n "$p" ] && kill -0 "$p" 2>/dev/null && [ -n "$(role_loops | grep -x "$p")" ]; then armed="$p"; break; fi
        sleep 1
    done
    [ -n "$armed" ] && break
    say "attempt $attempt did not arm yet"
done

say "=== RESULT ==="
if [ -n "$armed" ]; then
    say "ARMED FIRST/SUCCESSFUL ATTEMPT: pid $armed, argv $(tr '\0' ' ' < /proc/$armed/cmdline 2>/dev/null)"
    say "role-loops now: $(role_loops | tr '\n' ' ') (expect exactly $armed)"
    refusals=$(awk -v t="$WINDOW_START" '$0>=t' "$KLOG" | grep -c 'refusing to run a duplicate')
    say "refusals logged in this window: $refusals (expect 0)"
    say "decoys still alive: $(wc -l < "$STAGE/decoy.pids") of 2; none killed"
else
    say "NOT ARMED after three attempts - re-arming WITHOUT the decoys so the port is not left unwatched"
    while read -r p; do [ -n "$p" ] && kill "$p" 2>/dev/null; done < "$STAGE/decoy.pids"
    ( cd "$TREE" && setsid nohup bash scripts/keep-alive.sh >> server/keep-alive.out 2>&1 & ) 2>/dev/null
    sleep 8; say "fallback armed: $(lock_pid)"
fi
say "public: $(curl -s -o /tmp/ga2.html -w '%{http_code}' --noproxy '*' --max-time 10 "$PUB") $(grep -o '<title>[^<]*' /tmp/ga2.html 2>/dev/null)"

while read -r p; do [ -n "$p" ] && kill "$p" 2>/dev/null; done < "$STAGE/decoy.pids"
rm -rf "$STAGE"
sleep 2
say "=== AFTER THE DECOYS DIE ==="
say "role-loops: $(role_loops | tr '\n' ' '); lock names $(lock_pid)"
say "public: $(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' --max-time 10 "$PUB")"
say "DONE"
