#!/usr/bin/env bash
# Antum People — the guard hook's log cap, proved.
#
# WHAT THIS JUDGES
#   scripts/antum-product-guard-hook.sh writes server/guard-hook.log one or two lines per shell command.
#   Before 2026-11-10 nothing bounded it: the file stood at 11.6 MB on a /home that was 75% full. The
#   hook now rotates it once at a fixed size (guard-hook.log -> guard-hook.log.1, one previous kept,
#   both bounded). This script drives the REAL hook, sourced exactly as /etc/profile.d sources it, into a
#   scratch tree — never the deployed one (WORKFLOW rule 14) — and requires:
#
#     1. BELOW THE CAP NOTHING HAPPENS   a log under the cap is appended to and not rotated.
#     2. THE CAP HOLDS                   once crossed, the log rotates: .1 appears and BOTH files stay
#                                        within the cap (plus one line of slack for the note that
#                                        crossed it).
#     3. A LEGACY OVERSIZED LOG SHRINKS  an 11.6 MB-shaped log becomes one bounded .1 on the first note,
#                                        so the cap costs one turn, not the file's history.
#     4. IT CANNOT SPIN                  the structural half: the rotation function's own body contains no
#                                        `while`, `until`, `for` or recursion, so one call is a fixed
#                                        amount of work. AND the behavioural half: with the cap set to
#                                        1 byte — permanently over it — 12 notes each finish inside a
#                                        timeout and the log still ends bounded.
#     5. THE CAP IS LOAD-BEARING         the mutant: a copy of the hook with the rotation call removed
#                                        exceeds the cap under the same 12 notes. Without this, check 2
#                                        would pass for a hook that never wrote anything at all.
#
# EXIT CODES
#   0  every check holds      1  at least one failed (named, with the numbers)      2  cannot judge
#   Cannot-judge is a REFUSAL, never a green: a missing hook, a hook that does not parse, or a run that
#   wrote no log at all means this instrument has no subject.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="${ANTUM_HOOK_SRC:-$HERE/antum-product-guard-hook.sh}"
CAP=512

[ -r "$HOOK" ] || { echo "CANNOT JUDGE: no hook at $HOOK"; exit 2; }
bash -n "$HOOK" 2>/dev/null || { echo "CANNOT JUDGE: $HOOK does not parse as shell"; exit 2; }

work="$(mktemp -d)" || { echo "CANNOT JUDGE: no scratch directory"; exit 2; }
trap 'rm -rf "$work"' EXIT

pass=0
fail=0
ok() { pass=$((pass + 1)); printf '  ok   %s\n' "$1"; }
no() { fail=$((fail + 1)); printf '  FAIL %s\n' "$1"; }
size() { /usr/bin/stat -c %s "$1" 2>/dev/null || echo 0; }

# One note through the real hook, sourced the way a login shell sources it: a fresh process per run,
# because the hook runs once per shell (ANTUM_GUARD_HOOK_RAN). The scratch tree has server/ and no
# scripts/keep-alive.sh, so the hook takes its "no guard to arm" branch: exactly one note, no process.
note() { # $1 = scratch tree, $2 = cap, rest = extra env
  local tree="$1" cap="$2"; shift 2
  env -u ANTUM_GUARD_HOOK_RAN ANTUM_DEPLOY_DIR="$tree" ANTUM_GUARD_HOOK_LOG_MAX="$cap" "$@" \
    bash -c '. "$1"' _ "$HOOK"
}

fresh() { # $1 = name -> a scratch tree with an empty server/
  local t="$work/$1"
  mkdir -p "$t/server" || return 1
  printf '%s' "$t"
}

# ------------------------------------------------------------------ 1. below the cap, nothing rotates
echo "1. below the cap nothing happens"
t="$(fresh below)" || { echo "CANNOT JUDGE: cannot make a scratch tree"; exit 2; }
note "$t" 262144
s1="$(size "$t/server/guard-hook.log")"
[ "$s1" -gt 0 ] && ok "a note is written (log ${s1} B)" || no "no note was written at all (log ${s1} B)"
[ ! -e "$t/server/guard-hook.log.1" ] && ok "no rotation below the cap" || no "rotated below the cap"
note "$t" 262144
s2="$(size "$t/server/guard-hook.log")"
[ "$s2" -gt "$s1" ] && ok "the log grows by appending (${s1} B -> ${s2} B)" || no "the log did not grow (${s1} B -> ${s2} B)"

# ------------------------------------------------------------------ 2. the cap holds
echo "2. the cap holds"
t="$(fresh capped)" || exit 2
for _i in 1 2 3 4 5 6 7 8 9 10 11 12; do note "$t" "$CAP"; done
live="$(size "$t/server/guard-hook.log")"
prev="$(size "$t/server/guard-hook.log.1")"
[ -e "$t/server/guard-hook.log.1" ] && ok "the cap was reached and one previous copy exists" || no "no previous copy after 12 notes at a ${CAP} B cap"
[ "$live" -le $((CAP + 200)) ] && ok "the live log is bounded (${live} B at a ${CAP} B cap)" || no "the live log ran past the cap (${live} B at a ${CAP} B cap)"
[ "$prev" -le "$CAP" ] && ok "the kept copy is bounded (${prev} B)" || no "the kept copy ran past the cap (${prev} B)"
[ -s "$t/server/guard-hook.log" ] && ok "the log is still being written after a rotation (${live} B)" || no "the log is empty after a rotation — the cap ate the notes"

# ------------------------------------------------------------------ 3. a legacy oversized log shrinks
echo "3. a legacy oversized log shrinks"
t="$(fresh legacy)" || exit 2
/usr/bin/head -c 200000 /dev/zero | /usr/bin/tr '\0' 'x' > "$t/server/guard-hook.log"
before="$(size "$t/server/guard-hook.log")"
note "$t" "$CAP"
live="$(size "$t/server/guard-hook.log")"
prev="$(size "$t/server/guard-hook.log.1")"
[ "$live" -le $((CAP + 200)) ] && ok "a ${before} B log became a ${live} B live log on one note" || no "a ${before} B log is still ${live} B"
[ "$prev" -le "$CAP" ] && ok "the kept copy was trimmed to the cap (${prev} B)" || no "the kept copy kept the whole history (${prev} B)"

# ------------------------------------------------------------------ 4a. structurally: no loop to spin
echo "4a. the rotation function has no loop in it"
body="$work/rotate.txt"
# the DEFINITION line is dropped (`tail -n +2`), so the only place the function's own name can appear in
# the extracted text is a call to itself — which is what the recursion check below looks for
/usr/bin/sed -n '/^  _antum_rotate_log() {/,/^  }$/p' "$HOOK" | /usr/bin/tail -n +2 > "$body"
lines="$(/usr/bin/grep -c . "$body" 2>/dev/null)"; [ -n "$lines" ] || lines=0
[ "$lines" -gt 5 ] && ok "the function was extracted from the hook (${lines} lines)" || no "could not extract _antum_rotate_log (${lines} lines) — a structural check with no subject"
loops="$(/usr/bin/grep -nE '(^|[^[:alnum:]_])(while|until|for)([^[:alnum:]_]|$)' "$body" 2>/dev/null | /usr/bin/wc -l)"
[ "$loops" -eq 0 ] && ok "0 loop keywords in the rotation body (while/until/for)" || no "${loops} loop keyword(s) in the rotation body — the work per call is unbounded"
recur="$(/usr/bin/grep -c '_antum_rotate_log' "$body" 2>/dev/null)"; [ -n "$recur" ] || recur=0
[ "$recur" -eq 0 ] && ok "no recursion into itself" || no "${recur} self-reference(s) — a rotation that calls itself can spin"

# ------------------------------------------------------------------ 4b. behaviourally: over the cap forever
echo "4b. permanently over the cap: 12 notes, each inside a timeout"
t="$(fresh overcap)" || exit 2
slow=0
for _i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  /usr/bin/timeout 10 env -u ANTUM_GUARD_HOOK_RAN ANTUM_DEPLOY_DIR="$t" ANTUM_GUARD_HOOK_LOG_MAX=1 \
    bash -c '. "$1"' _ "$HOOK"
  rc=$?
  [ "$rc" -eq 124 ] && slow=$((slow + 1))
  [ "$rc" -ne 0 ] && [ "$rc" -ne 124 ] && no "a note exited ${rc} at a 1 B cap (the hook must never fail a shell)"
done
[ "$slow" -eq 0 ] && ok "0 of 12 notes hit the 10 s timeout at a 1 B cap" || no "${slow} of 12 notes hit the timeout — the cap is doing unbounded work"
live="$(size "$t/server/guard-hook.log")"
prev="$(size "$t/server/guard-hook.log.1")"
[ "$live" -le 400 ] && ok "the live log is still bounded (${live} B) with the cap permanently exceeded" || no "the live log grew to ${live} B at a 1 B cap"
[ "$prev" -le 400 ] && ok "the kept copy is still bounded (${prev} B)" || no "the kept copy grew to ${prev} B at a 1 B cap"

# ------------------------------------------------------------------ 5. the mutant: the cap is load-bearing
echo "5. the cap is load-bearing (rotation removed -> the cap is exceeded)"
mutant="$work/hook-no-rotation.sh"
/usr/bin/sed 's/^    _antum_rotate_log$/    : # rotation removed by the mutant/' "$HOOK" > "$mutant"
if /usr/bin/cmp -s "$HOOK" "$mutant"; then
  no "the mutant is byte-identical to the hook — the plant did not land, so this proves nothing"
else
  ok "the plant landed (the mutant differs from the hook)"
fi
t="$(fresh mutant)" || exit 2
for _i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  env -u ANTUM_GUARD_HOOK_RAN ANTUM_DEPLOY_DIR="$t" ANTUM_GUARD_HOOK_LOG_MAX="$CAP" bash -c '. "$1"' _ "$mutant"
done
live="$(size "$t/server/guard-hook.log")"
[ "$live" -gt $((CAP + 200)) ] && ok "without the rotation the same 12 notes reach ${live} B — check 2 is not a green on an empty file" \
  || no "the mutant also stayed under the cap (${live} B) — check 2 cannot be trusted"

echo
total=$((pass + fail))
echo "${pass}/${total} checks hold against $(/usr/bin/git -C "$HERE/.." rev-parse --short HEAD 2>/dev/null || echo 'an unnamed revision') (hook $(/usr/bin/md5sum < "$HOOK" | /usr/bin/cut -d' ' -f1), cap ${CAP} B in this run)"
[ "$fail" -eq 0 ] || { echo "FAIL: ${fail} of ${total} did not hold"; exit 1; }
exit 0
