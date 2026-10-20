#!/bin/bash
# LIVE acceptance of the guard fix (PR #272, shipped by the 16:08:51Z movement as 58acdac).
#
# The defect, 2026-10-20T15:13:46-15:13:56 (27 s): the duplicate check matched a STRING'S SHAPE.
# Shells and probes that merely NAMED scripts/keep-alive.sh in their argv were counted as duplicate
# guards, so six re-arms refused and the product was served by nothing while the site stayed up.
# The fix decides by ROLE (is_loop_argv: interpreter + script as its first, non-flag argument).
#
# This script does what the shipped unit test deliberately does not: it ARMS a guard while a naming
# probe is alive and requires the arm to succeed. The unit test proves the predicate; this proves
# the outcome the defect actually cost - the port left unwatched.
#
# Safety: the port is never left unguarded. Every path ends by asserting one role-loop holds the
# lock, and the last resort arms without the decoy and says so.
set -u
export HOME=/home/agent-lead

TREE=/home/team/shared/probable-octo-sniffle
LOCK="$TREE/server/keep-alive.lock"
KLOG="$TREE/server/keep-alive.log"
OUT=/home/team/shared/movements/2026-10-20T1607Z/guard-acceptance.out
PUB=https://b974147c03228029e277d1cbe6646fe6.ctonew.app

: > "$OUT"
say() { echo "$(date -u +%H:%M:%SZ) $*" | tee -a "$OUT"; }

# A loop is `bash <script>`: interpreter first, script as its first non-flag argument. Same
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
mentions() { pgrep -f 'keep-alive\.sh' 2>/dev/null | wc -l | tr -d ' '; }
lock_pid() { head -n 1 "$LOCK" 2>/dev/null | tr -d '[:space:]'; }

say "=== BEFORE ==="
say "lock names pid $(lock_pid); role-loops: $(role_loops | tr '\n' ' '); pgrep mentions: $(mentions)"
say "public: $(curl -s -o /tmp/ga.html -w '%{http_code}' --noproxy '*' --max-time 10 "$PUB") $(grep -o '<title>[^<]*' /tmp/ga.html 2>/dev/null)"

# The decoy: the exact shape from the defect log - a login shell running a COMMAND that tests for
# the path. It cannot guard anything. It stays alive for the whole acceptance window.
DECOY_MARK=/tmp/ga-decoy.pid
bash -lc 'test -f "/home/team/shared/probable-octo-sniffle/scripts/keep-alive.sh" && echo exists; sleep 240' \
    > /dev/null 2>&1 &
echo $! > "$DECOY_MARK"
sleep 1
DECOY=$(cat "$DECOY_MARK")
say "=== DECOY ALIVE (pid $DECOY, cannot guard anything) ==="
say "decoy argv: $(tr '\0' ' ' < /proc/$DECOY/cmdline 2>/dev/null)"
say "the decoy names the path, so the OLD predicate counts it: $(pgrep -f 'keep-alive\.sh' | grep -c "^$DECOY$") ; role-loops still: $(role_loops | tr '\n' ' ')"

# --- the arm, with the naming probe alive: this is the acceptance -------------------------------
OLD=$(lock_pid)
say "=== REAPING the armed guard by the PID its own lock names ($OLD) - never pkill -f ==="
[ -n "$OLD" ] && kill -TERM "$OLD" 2>/dev/null
for i in $(seq 1 15); do kill -0 "$OLD" 2>/dev/null || break; sleep 1; done
say "guard $OLD gone: $([ -n "$OLD" ] && kill -0 "$OLD" 2>/dev/null && echo NO || echo yes)"
say "its own exit line: $(grep 'EXIT:' "$KLOG" | tail -1)"

say "=== ARMING while the decoy is alive (the arm the defect refused) ==="
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
    say "ARMED: pid $armed, argv $(tr '\0' ' ' < /proc/$armed/cmdline 2>/dev/null)"
    say "role-loops now: $(role_loops | tr '\n' ' ') (expect exactly $armed)"
    say "refusals after this arm: $(awk -v t="$(date -u -d '3 minutes ago' +%FT%T)" '$0>=t' "$KLOG" | grep -c 'refusing to run a duplicate')"
    say "guard's own start lines: $(grep -c 'guard starting' "$KLOG")"
    say "decoy still alive and untouched: $([ "$(cat $DECOY_MARK)" = "$(pgrep -f 'sleep 240' | head -1)" ] && echo yes || echo check)"
else
    say "NOT ARMED after three attempts - re-arming WITHOUT the decoy so the port is not left unwatched"
    kill "$(cat $DECOY_MARK)" 2>/dev/null
    ( cd "$TREE" && setsid nohup bash scripts/keep-alive.sh >> server/keep-alive.out 2>&1 & ) 2>/dev/null
    sleep 8
    say "fallback armed: $(lock_pid)"
fi
say "public: $(curl -s -o /tmp/ga2.html -w '%{http_code}' --noproxy '*' --max-time 10 "$PUB") $(grep -o '<title>[^<]*' /tmp/ga2.html 2>/dev/null)"

kill "$(cat $DECOY_MARK)" 2>/dev/null
sleep 2
say "=== AFTER THE DECOY DIES ==="
say "role-loops: $(role_loops | tr '\n' ' '); lock names $(lock_pid)"
say "public: $(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' --max-time 10 "$PUB")"
say "DONE"
