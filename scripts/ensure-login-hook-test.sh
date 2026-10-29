#!/usr/bin/env bash
# Proof for scripts/ensure-login-hook.sh — the path that keeps the boot-time re-arm installed.
#
# Every branch is exercised against scratch destinations. NOTHING here writes to /etc: the first check
# refuses to run if ANTUM_HOOK_DST is not under the scratch root, because the one thing this suite
# could do that would be worse than a false green is replace the live hook while proving it repairs.
#
# What the branches are, and why each one matters:
#   1. hook absent            -> installed, exit 0. This is 2026-10-29: the file was gone at boot.
#   2. hook identical         -> NOT rewritten (mtime unchanged) and no repair line. A repair path that
#                               rewrites every poll is churn, and churn on /etc is how a real change
#                               gets hidden.
#   3. hook drifted           -> replaced with the tree's bytes.
#   4. source missing         -> exit 1, destination untouched, one FAILED line.
#   5. source unparsable      -> refused (a broken /etc/profile.d file breaks every login shell).
#   6. --only filter          -> installs exactly the one target and touches no other host copy.
#   7. the guard calls it     -> SHAPE check only: the poll invokes this script. The behaviour above is
#                               what proves the script; this proves the loop asks it. Say which is which.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENSURE="$REPO/scripts/ensure-login-hook.sh"
INSTALLER="$REPO/scripts/install-host-tools.sh"
SCRATCH="$(mktemp -d)" || { echo "FAIL: no scratch dir"; exit 1; }
trap 'rm -rf "$SCRATCH"' EXIT

HOOK_DST="$SCRATCH/etc/profile.d/zz-antum-product-guard.sh"
HOST_DST="$SCRATCH/host"
LOG="$SCRATCH/ensure.log"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf '  ok   %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$1"; }
check() { # $1 = description, $2 = actual, $3 = expected
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (got '$2', wanted '$3')"; fi
}

body_md5() { # md5 of a file with any provenance block stripped
  local f="$1"
  if grep -q '^# >>> ANTUM HOST-TOOL PROVENANCE' "$f" 2>/dev/null; then
    sed -e '/^# >>> ANTUM HOST-TOOL PROVENANCE/,/^# <<< ANTUM HOST-TOOL PROVENANCE/d' "$f" | md5sum | cut -d' ' -f1
  else
    md5sum < "$f" | cut -d' ' -f1
  fi
}
run_ensure() { # extra args passed as env by the caller
  ANTUM_DEPLOY_DIR="$REPO" ANTUM_HOOK_DST="$HOOK_DST" ANTUM_HOST_TOOLS_DIR="$HOST_DST" \
    ANTUM_LOGIN_HOOK_LOG="$LOG" "$@" bash "$ENSURE" >"$SCRATCH/out.txt" 2>&1
  echo $?
}

echo "=== ensure-login-hook-test $(date -Iseconds)"
echo "    scratch: $SCRATCH"
# The self-guard: nothing below may aim at the installed hook.
case "$HOOK_DST" in
  "$SCRATCH"/*) : ;;
  *) echo "FAIL: refusing to run — ANTUM_HOOK_DST ($HOOK_DST) is not under the scratch root"; exit 1 ;;
esac

WANT="$(md5sum < "$REPO/scripts/antum-product-guard-hook.sh" | cut -d' ' -f1)"

echo "--- 1. the hook is absent: it is installed"
rc=$(run_ensure)
check "exit code" "$rc" "0"
if [ -f "$HOOK_DST" ]; then ok "installed at $HOOK_DST"; else bad "nothing installed at $HOOK_DST"; fi
check "installed body is the tree's hook" "$(body_md5 "$HOOK_DST")" "$WANT"
grep -q 'REPAIRED' "$LOG" && ok "the repair is logged" || bad "no REPAIRED line in $LOG"
grep -q 'MISSING' "$LOG" && ok "the log says what was wrong" || bad "the log does not name the defect"

echo "--- 2. the hook already matches: nothing is rewritten"
before="$(stat -c %Y.%N "$HOOK_DST")"
sleep 1.1   # so a rewrite would move the mtime even at 1-second granularity
repairs_before="$(grep -c 'REPAIRED' "$LOG" 2>/dev/null || echo 0)"
rc=$(run_ensure)
check "exit code" "$rc" "0"
check "mtime unchanged (not rewritten)" "$(stat -c %Y.%N "$HOOK_DST")" "$before"
check "no new repair line" "$(grep -c 'REPAIRED' "$LOG" 2>/dev/null || echo 0)" "$repairs_before"

echo "--- 3. the hook drifts: it is replaced with the tree's bytes"
printf '\n# drift introduced by the test\n' >> "$HOOK_DST"
rc=$(run_ensure)
check "exit code" "$rc" "0"
check "body is the tree's hook again" "$(body_md5 "$HOOK_DST")" "$WANT"
grep -q 'DRIFTED' "$LOG" && ok "the log names drift, not just absence" || bad "the drift line is missing"

echo "--- 4. the source is missing: it fails loudly and touches nothing"
cp "$HOOK_DST" "$SCRATCH/hook.before"
rc=$(ANTUM_HOOK_SRC="$SCRATCH/not-there.sh" bash -c '
  ANTUM_DEPLOY_DIR="'"$REPO"'" ANTUM_HOOK_DST="'"$HOOK_DST"'" ANTUM_LOGIN_HOOK_LOG="'"$LOG"'" \
  ANTUM_HOOK_SRC="'"$SCRATCH"'/not-there.sh" bash "'"$ENSURE"'"; echo $?')
check "exit code" "$rc" "1"
check "destination untouched" "$(md5sum < "$HOOK_DST")" "$(md5sum < "$SCRATCH/hook.before")"
grep -q 'FAILED: no hook to install' "$LOG" && ok "the failure is named in the log" || bad "no FAILED line for a missing source"

echo "--- 5. the source does not parse: it is refused, and a broken hook is never installed"
printf 'if [ -z "${x}" ; then\n  echo unterminated\n' > "$SCRATCH/broken.sh"
ANTUM_DEPLOY_DIR="$REPO" ANTUM_HOOK_DST="$HOOK_DST" ANTUM_HOOK_SRC="$SCRATCH/broken.sh" \
  ANTUM_LOGIN_HOOK_LOG="$LOG" bash "$ENSURE" >/dev/null 2>&1
check "exit code" "$?" "1"
check "the good hook is still installed (the broken one was not written)" "$(body_md5 "$HOOK_DST")" "$WANT"
grep -q 'does not parse as shell' "$LOG" && ok "the refusal names bash -n" || bad "the refusal is not explained"

echo "--- 6. --only: the repair touches the hook and no other host copy"
ANTUM_HOST_TOOLS_DIR="$HOST_DST" ANTUM_HOOK_DST="$HOOK_DST" \
  ANTUM_HOST_TOOLS_ONLY="scripts/antum-product-guard-hook.sh" bash "$INSTALLER" >"$SCRATCH/only.out" 2>&1
check "installer exit code" "$?" "0"
grep -q 'ONLY:' "$SCRATCH/only.out" && ok "the installer says it was narrowed" || bad "the ONLY line is missing from the installer output"
resline="$(grep -E '=== RESULT' "$SCRATCH/only.out" | head -1)"
case "$resline" in
  *"1 targets seen"*|*"all 1 copies"*|*"1 of 1 copies"*) ok "the narrowed run reports exactly the one target: $resline" ;;
  *) bad "the narrowed run did not report one target: '$resline'" ;;
esac
if [ -e "$HOST_DST/deploy-main.sh" ]; then bad "the filter installed another host copy too"; else ok "no other host copy was written"; fi
if [ -e "$HOOK_DST" ]; then ok "the named target was written"; else bad "the named target was not written"; fi

echo "--- 7. SHAPE (not behaviour): the guard asks this script on every poll"
if grep -q 'ensure-login-hook.sh' "$REPO/scripts/keep-alive.sh"; then
  ok "keep-alive.sh references ensure-login-hook.sh"
else
  bad "keep-alive.sh never calls ensure-login-hook.sh — the repair would never run"
fi
if grep -qE 'bash "\$DEPLOY_DIR/scripts/ensure-login-hook\.sh"' "$REPO/scripts/keep-alive.sh"; then
  ok "the reference is an invocation of the deployed copy, not a mention"
else
  bad "the reference is not an invocation of \$DEPLOY_DIR/scripts/ensure-login-hook.sh"
fi
grep -q 'HOOK_DST=' "$REPO/scripts/keep-alive.sh" || bad "keep-alive.sh does not resolve ANTUM_HOOK_DST"

echo
echo "=== ensure-login-hook-test: $PASS passed / $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
