#!/usr/bin/env bash
# counsel-strings-test.sh - the sibling test for scripts/check-counsel-strings.py.
#
# WHAT IT PROVES, AND WHY EACH PART IS LOAD-BEARING
#   1. THE GUARD IS GREEN ON THIS TREE against its own manifest - and it says HOW MANY units it
#      judged. A guard that judged nothing is not a pass: the count is asserted against the
#      manifest's own length, so a manifest emptied to `units: []` fails here (every served unit
#      would then read as NEW, which is the same defect the guard refuses).
#   2. THE TWO CONTROLS, from the guard's own --selftest on scratch copies of this tree:
#        arm 0  the clean copy                       -> green
#        arm A  a CHROME string edited (an item label the screen shows, no legal content)
#                                                    -> the served label demonstrably changed AND
#                                                       the guard stays GREEN  (scope control)
#        arm B  one served LEGAL sentence edited      -> RED, naming the unit whose hash moved
#        arm C  the same edit, manifest updated with a note
#                                                    -> GREEN, the unit printed as MARKED, review
#                                                       still `unreviewed`
#        arm D  a manifest claiming a REVIEW          -> RED (no counsel recipient exists: a
#                                                       review marker cannot be earned today)
#      A and B together are the point: without A a whole-file hash would look like a working
#      guard, and without B the guard would look like one while reddening on nothing.
#   3. AN INVOCATION IT DOES NOT UNDERSTAND IS REFUSED with exit 2. A plausible-looking typo must
#      not buy a green run: exit 2 is the team's CANNOT-JUDGE, and check-all.py FAILS on it.
#
# It runs off the live host's port range, on its own scratch copies and its own throwaway
# databases, and it never touches the deployment, `client/dist`, or the repository's manifest.
# Registered in scripts/check-all.py under --full, like every other `*-test.sh` proof here.
set -u
ROOT=$(cd "$(dirname "$0")/.." && pwd)
PY=python3
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); printf '  ok    %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  FAIL  %s\n' "$1"; }

echo "counsel-strings sibling test  (tree: $ROOT)"
echo "  1. the guard is green on this tree, and judges a non-empty set"

MANIFEST_UNITS=$($PY -c "import json;print(len(json.load(open('$ROOT/scripts/counsel-strings-manifest.json'))['units']))")
OUT=$(mktemp)
( cd "$ROOT" && $PY scripts/check-counsel-strings.py ) > "$OUT" 2>&1
RC=$?
SERVED=$(sed -n 's/^  units served     : \([0-9]*\).*/\1/p' "$OUT" | head -1)
tail -6 "$OUT" | sed 's/^/        /'
echo "        manifest units=$MANIFEST_UNITS  served units=${SERVED:-none}  exit=$RC"
if [ "$RC" = 0 ]; then ok "the guard is green on this tree (exit 0)"; else bad "the guard is not green on this tree (exit $RC)"; fi
if [ -n "${SERVED:-}" ] && [ "${SERVED:-0}" -ge 40 ]; then
  ok "it judged $SERVED served legal units (a run that judges nothing cannot pass)"
else
  bad "it judged ${SERVED:-0} units: too few for the count to mean anything"
fi
if [ "${SERVED:-0}" = "$MANIFEST_UNITS" ]; then
  ok "the served set and the manifest set are equal ($SERVED = $MANIFEST_UNITS)"
else
  bad "served ${SERVED:-0} vs manifest $MANIFEST_UNITS - a new or vanished unit must be accounted for"
fi
rm -f "$OUT"

echo "  2. the two controls, and the two honesty arms (scratch copies; the repository is untouched)"
OUT=$(mktemp)
( cd "$ROOT" && $PY scripts/check-counsel-strings.py --selftest ) > "$OUT" 2>&1
RC=$?
grep -E 'ARM|arm .* exit=|chrome string as served|red names|marked units|selftest:' "$OUT" | sed 's/^/        /'
if [ "$RC" = 0 ]; then ok "every selftest arm behaved as required (exit 0)"; else bad "a selftest arm failed (exit $RC)"; fi
if grep -q 'after .Passport copy (scope control).' "$OUT" && grep -q 'arm A exit=0' "$OUT"; then
  ok "SCOPE control: the served chrome string moved and the guard stayed green"
else
  bad "SCOPE control: the chrome string did not demonstrably move with the guard still green"
fi
if grep -q 'arm B exit=1' "$OUT" && grep -q 'the red names: .*doc:' "$OUT"; then
  ok "CHANGE control: the legal edit reddened and the red names the document unit"
else
  bad "CHANGE control: the legal edit did not redden by name"
fi
if grep -q 'arm C exit=0' "$OUT" && grep -q 'arm D (extra): a manifest claiming a review -> exit=1' "$OUT"; then
  ok "a marked change is green-and-unreviewed; a claimed review is refused"
else
  bad "the marked-vs-review arms did not behave"
fi
rm -f "$OUT"

echo "  3. an invocation this script does not understand is refused, never a silent green"
OUT=$(mktemp)
( cd "$ROOT" && $PY scripts/check-counsel-strings.py --from-tree ) > "$OUT" 2>&1
RC=$?
sed -n '1,2p' "$OUT" | sed 's/^/        /'
if [ "$RC" = 2 ]; then ok "an unknown flag exits 2 (CANNOT-JUDGE), not 0"; else bad "an unknown flag exited $RC - a run that tested nothing must not pass"; fi
rm -f "$OUT"

echo
echo "counsel-strings-test: $PASS ok, $FAIL FAIL"
[ "$FAIL" = 0 ] || exit 1
exit 0
