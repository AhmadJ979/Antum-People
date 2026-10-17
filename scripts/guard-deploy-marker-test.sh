#!/bin/bash
# Proves the deploy marker does what it claims, on a scratch tree with a STUB guard — never the live one.
#
# Branches, per the task:
#   (a) marker present (live pid, fresh)  -> the hook stands down AND logs it, arming nothing
#   (b) marker absent                     -> the hook arms exactly as before
#   (c) marker left by a crashed deploy    -> recognised as stale and the guard is armed anyway
#       (c1) pid dead — the SIGKILL/host-death case, (c2) pid alive but older than the TTL
# Plus (d) the deploy's own ordering, asserted on line numbers: write < reap < remove, with a trap.
#
# (a) and (b) share one scratch dir on purpose: the task asks for the stand-down and the arming in the
# same log, with timestamps — two separate logs would not show the transition.
set -uo pipefail

HOOK="$(cd "$(dirname "$0")" && pwd)/antum-product-guard-hook.sh"
DEPLOY="$(cd "$(dirname "$0")" && pwd)/deploy-main.sh"
TMP=$(mktemp -d /tmp/guard-marker-test.XXXXXX)
PASS=0; FAIL=0
ok()   { echo "  PASS  $*"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $*"; FAIL=$((FAIL+1)); }
check(){ if eval "$1"; then ok "$2"; else bad "$2"; fi; }

mkcase() { # $1 = name -> scratch tree with a stub guard that reports itself the way the real one does
  local d="$TMP/$1"; mkdir -p "$d/scripts" "$d/server"
  cat >"$d/scripts/keep-alive.sh" <<'STUB'
#!/bin/bash
# STUB: writes the lock the way keep-alive.sh does, and keeps "keep-alive.sh" in its cmdline so the
# hook's own verification (pid alive + cmdline match) can see it. Guards nothing, touches no port.
printf '%s\n' "$$" > "$(cd "$(dirname "$0")/.." && pwd)/server/keep-alive.lock"
sleep 40 & wait
STUB
  chmod +x "$d/scripts/keep-alive.sh"
  printf '%s' "$d"
}
run_hook() { # $1 = dir
  ANTUM_DEPLOY_DIR="$1" ANTUM_GUARD_HOOK_RAN="" bash "$HOOK" >/dev/null 2>&1
  return 0   # the hook must never fail a shell; that property is tested elsewhere
}
killstub() { local p; p=$(head -1 "$1/server/keep-alive.lock" 2>/dev/null); [ -n "$p" ] && kill -9 "$p" 2>/dev/null; rm -f "$1/server/keep-alive.lock"; }
log()      { cat "$1/server/guard-hook.log" 2>/dev/null; }

echo "== (a)+(b) marker present -> stand down, then marker absent -> arm, one log =="
A=$(mkcase a)
printf '%s\n' "$$" > "$A/server/deploy-in-progress"   # a live pid: this test's own shell
run_hook "$A"
check "[ -f '$A/server/guard-hook.log' ]"                                   "(a) hook ran at all (it wrote its log)"
check "grep -q 'deploy in progress (pid $$' '$A/server/guard-hook.log'"     "(a) log names the stand-down and the owning pid"
check "grep -q 'standing down' '$A/server/guard-hook.log'"                  "(a) log says it stood down"
check "[ ! -f '$A/server/keep-alive.lock' ]"                                "(a) nothing was armed"
check "! grep -q 'guard not running, started it' '$A/server/guard-hook.log'" "(a) no start was attempted"

rm -f "$A/server/deploy-in-progress"
run_hook "$A"
check "grep -q 'guard not running, started it' '$A/server/guard-hook.log'"  "(b) arms once the marker is gone"
check "[ -f '$A/server/keep-alive.lock' ]"                                  "(b) a guard holds the lock"
check "grep -q keep-alive.sh /proc/\$(head -1 '$A/server/keep-alive.lock')/cmdline 2>/dev/null" "(b) the guard it armed is the stub, verified by cmdline"
echo "  --- the same log, stand-down then arming, in order: ---"
log "$A" | sed 's/^/      /'
FIRST_STANDDOWN=$(grep -n 'standing down' "$A/server/guard-hook.log" | head -1 | cut -d: -f1)
FIRST_ARM=$(grep -n 'guard not running, started it' "$A/server/guard-hook.log" | head -1 | cut -d: -f1)
check "[ -n '$FIRST_STANDDOWN' ] && [ -n '$FIRST_ARM' ] && [ '$FIRST_STANDDOWN' -lt '$FIRST_ARM' ]" "(a<b) the stand-down precedes the arming in one log"
killstub "$A"

echo "== (c1) marker left by a crash: pid dead -> stale, arms anyway =="
C1=$(mkcase c1)
printf '999999\n' > "$C1/server/deploy-in-progress"    # a pid that cannot be alive
run_hook "$C1"
check "grep -q 'stale deploy marker' '$C1/server/guard-hook.log'"          "(c1) the marker is named stale"
check "grep -q 'ignoring it and arming as usual' '$C1/server/guard-hook.log'" "(c1) says plainly it ignored it"
check "[ -f '$C1/server/keep-alive.lock' ]"                                "(c1) the guard is armed — a crashed deploy does not strand the product"
check "! grep -q 'standing down' '$C1/server/guard-hook.log'"              "(c1) it did not stand down"
killstub "$C1"

echo "== (c2) marker with a live pid but older than the TTL -> stale, arms anyway =="
C2=$(mkcase c2)
printf '%s\n' "$$" > "$C2/server/deploy-in-progress"
touch -d '2 hours ago' "$C2/server/deploy-in-progress"
run_hook "$C2"
check "grep -q 'stale deploy marker (pid $$' '$C2/server/guard-hook.log'"   "(c2) a live-but-old marker is still stale"
check "[ -f '$C2/server/keep-alive.lock' ]"                                 "(c2) the guard is armed"
killstub "$C2"

echo "== (c3) the TTL is a knob, and it is honoured =="
C3=$(mkcase c3)
printf '%s\n' "$$" > "$C3/server/deploy-in-progress"
touch -d '70 seconds ago' "$C3/server/deploy-in-progress"
ANTUM_DEPLOY_MARKER_TTL=30 ANTUM_DEPLOY_DIR="$C3" bash "$HOOK" >/dev/null 2>&1
check "grep -q 'stale deploy marker' '$C3/server/guard-hook.log'"           "(c3) ttl=30 makes a 70s marker stale"
killstub "$C3"

echo "== (d) the deploy's ordering, on measured line numbers =="
W=$(grep -n 'deploy marker written' "$DEPLOY" | head -1 | cut -d: -f1)
R=$(grep -n "WD_PAT='scripts/keep-alive" "$DEPLOY" | head -1 | cut -d: -f1)
M=$(grep -n 'deploy marker removed' "$DEPLOY" | head -1 | cut -d: -f1)
T=$(grep -n "trap 'rm -f \"\$MARKER\"" "$DEPLOY" | head -1 | cut -d: -f1)
echo "  lines: write=$W reap=$R remove=$M trap=$T"
check "[ -n '$W' ] && [ -n '$R' ] && [ -n '$M' ]"                          "(d) all three steps exist"
check "[ -n '$W' ] && [ -n '$R' ] && [ '$W' -lt '$R' ]"                    "(d) the marker is written BEFORE the kill window"
check "[ -n '$R' ] && [ -n '$M' ] && [ '$R' -lt '$M' ]"                    "(d) it is removed after the reap, i.e. once a guard is verified"
check "[ -n '$T' ]"                                                        "(d) a trap removes it on any exit path"
check "grep -q 'lock still held by' '$DEPLOY'"                             "(d) the genuine stale-holder reap is untouched"
# NOT "no pkill -f": the deploy kills by a pattern pinned to the guard's own path, and its comment
# explains why the kill is asynchronous (the old loop holds the flock until it exits). The property
# worth asserting is that the pattern cannot match anything but our guard — a bare name could.
check "grep -q \"WD_PAT='scripts/keep-alive\\[\\.\\]sh'\" '$DEPLOY'"       "(d) the kill pattern is pinned to the guard's path, not a bare process name"

rm -rf "$TMP"
echo
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
