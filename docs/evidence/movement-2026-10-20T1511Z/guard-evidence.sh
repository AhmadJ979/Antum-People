#!/bin/bash
D=/home/team/shared/probable-octo-sniffle
echo "=== the lock's own PID, checked against /proc (the hook's method) ==="
P=$(head -1 "$D/server/keep-alive.lock" 2>/dev/null)
echo "lock PID: ${P:-<none>}"
[ -n "$P" ] && echo "/proc/$P/cmdline: $(tr '\0' ' ' < /proc/$P/cmdline 2>/dev/null)"
echo "exact-count of guard loops (args must match that command): $(ps -eo args | grep -c '^/usr/bin/bash scripts/keep-alive.sh$')"
echo
echo "=== every EXIT line in keep-alive.log (the loud exits) ==="
grep -n 'EXIT:' "$D/server/keep-alive.log" | tail -8
echo
echo "=== the last 12 log lines, with times ==="
tail -12 "$D/server/keep-alive.log"
echo
echo "=== the hook's own record of arming a guard after my signal ==="
tail -10 "$D/server/guard-hook.log" 2>/dev/null
echo
echo "=== is 3000 still served, after the guard was reaped and re-armed? ==="
curl -s -o /dev/null -w 'public %{http_code}  ' https://b974147c03228029e277d1cbe6646fe6.ctonew.app/
curl -s -o /dev/null -w 'localhost:3000 %{http_code}\n' http://127.0.0.1:3000/
