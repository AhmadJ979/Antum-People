#!/bin/bash
# control.sh — proves the authentication preflight is the LOAD-BEARING thing.
#
# THE CLAIM: with the preflight in place a wrong credential aborts the run as an AUTHENTICATION
# failure and nothing is judged. With it bypassed, the same wrong credential proceeds to judgment and
# the harness blames the settlement check — the 2026-11-02 incident.
#
# HOW, without a cutover and without touching the product: the PRE-FIX step 5 and the PRE-FIX verdict
# block are extracted BYTE FOR BYTE from a named revision (`git show <rev>:scripts/deploy-main.sh`)
# and run as that revision's own shell code, with ANTUM_PW_FILE pointing at a deliberately wrong
# password. Nothing is restarted, built or written to the database: the fragment logs in (which
# fails), reads (which 401s), and reads the product database.
#
#   bash docs/evidence/deploy-harness-auth-preflight-2026-11-02/control.sh [REV]   (default fff847b)
#
# Exit 0 = the control held. Exit 1 = it did NOT hold — say so, do not weaken it to fit.
set -uo pipefail

REV="${1:-fff847b}"
# BOTH the revision the old path is read from and the script under test come from THIS repo — the one
# the control file lives in. Pointing at the deployed tree instead is how the first run of this control
# compared the fix against itself: the host copy predates --preflight and answered "unknown argument".
HERE_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="${ANTUM_REPO:-$(cd "$HERE_DIR/../../.." && pwd)}"
NEW_SCRIPT="$REPO/scripts/deploy-main.sh"
PUBLIC="${ANTUM_PUBLIC:-https://b974147c03228029e277d1cbe6646fe6.ctonew.app}"
PRODUCT_DB="${ANTUM_PRODUCT_DB:-/home/team/.data/antum-product.db}"
WRONG_PW="${ANTUM_WRONG_PW:-/tmp/control-wrong-pw}"
STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="/tmp/control-$STAMP.out"

# range <start-pattern> <end-pattern-exclusive>: the old file's own lines between two anchors.
range() {
  awk -v s="$1" -v e="$2" '
    !on && index($0, s) { on = 1 }
    on && e != "" && index($0, e) { exit }
    on { print }
  '
}

exec > >(tee "$OUT") 2>&1
printf '%s' 'stale-password-from-the-incident' > "$WRONG_PW"

echo "=== control: the preflight is load-bearing ($(date -Iseconds)) ==="
echo "  the OLD path is taken from revision: $REV of $REPO"
echo "  the NEW path is the script under test:  $NEW_SCRIPT"
echo "  wrong credential: $WRONG_PW ($(wc -c < "$WRONG_PW") characters — deliberately not the real one)"
echo "  the live product is NOT restarted, built or written by this script."

echo ""
echo "--- A. the PRE-FIX step 5, extracted byte for byte from $REV, run as that revision's own code ---"
git -C "$REPO" show "$REV:scripts/deploy-main.sh" \
  | range 'echo "--- 5. verify the live demo end to end ---"' 'echo "--- 6. re-arm the watchdog' \
  > "/tmp/control-$STAMP-step5.sh"
# The verdict block runs to the end of that file; everything after its last echo is comment-only,
# so sourcing the tail is a no-op and the block stays syntactically whole (if ... exit 1 ... fi).
git -C "$REPO" show "$REV:scripts/deploy-main.sh" \
  | range 'echo "deployed commit: ' '' > "/tmp/control-$STAMP-verdict.sh"
echo "  step-5 fragment:  $(wc -l < "/tmp/control-$STAMP-step5.sh") lines -> /tmp/control-$STAMP-step5.sh"
echo "  verdict fragment: $(wc -l < "/tmp/control-$STAMP-verdict.sh") lines -> /tmp/control-$STAMP-verdict.sh"
echo "  extraction is mechanical: git show <rev>:scripts/deploy-main.sh | awk between two anchors"

# The old verdict block echoes these; unset, `set -u` would abort it with an unbound-variable error
# and hand the control a failure that came from the harness rather than from the old script.
PW_FILE="$WRONG_PW"
DEPLOY_DIR="$REPO"
BUILD_LOG="/tmp/control-$STAMP-build.log"
SEED_LOG="/tmp/control-$STAMP-seed.log"
(
  . "/tmp/control-$STAMP-step5.sh"
  . "/tmp/control-$STAMP-verdict.sh"
)
OLD_RC=$?
echo "  OLD PATH EXIT CODE: $OLD_RC"

echo ""
echo "--- B. the NEW preflight, the same wrong credential, the same product ---"
ANTUM_PW_FILE="$WRONG_PW" ANTUM_PUBLIC="$PUBLIC" \
  bash "$NEW_SCRIPT" --preflight > "/tmp/control-$STAMP-new.out" 2>&1
NEW_RC=$?
sed 's/^/  | /' "/tmp/control-$STAMP-new.out"
echo "  NEW PATH EXIT CODE: $NEW_RC"

echo ""
echo "--- C. what each path said ---"
TB=0;          grep -q 'Traceback (most recent call last)' "$OUT" && TB=1
SETTLE_BLAME=0; grep -q 'settlement check rc=' "$OUT" && SETTLE_BLAME=1
NEW_AUTH=0;    grep -q 'FAIL (AUTHENTICATION)' "/tmp/control-$STAMP-new.out" && NEW_AUTH=1
NEW_JUDGED=0;  grep -q 'check-settlement-statement\|settlement check rc=\|RED VERIFICATION' "/tmp/control-$STAMP-new.out" && NEW_JUDGED=1
echo "  old path: a python traceback in the evidence ....... $([ $TB -eq 1 ] && echo YES || echo NO)"
echo "  old path: verdict named 'settlement check rc=' ..... $([ $SETTLE_BLAME -eq 1 ] && echo YES || echo NO)"
echo "  new path: names AUTHENTICATION as the cause ........ $([ $NEW_AUTH -eq 1 ] && echo YES || echo NO)"
echo "  new path: reached a settlement verdict ............. $([ $NEW_JUDGED -eq 1 ] && echo YES || echo NO)"

HOLD=1
[ "$OLD_RC" -ne 0 ] || HOLD=0          # the old path fails — but by the wrong name
[ "$TB" -eq 1 ] || HOLD=0              # ...having printed a traceback on an error payload
[ "$SETTLE_BLAME" -eq 1 ] || HOLD=0    # ...and blamed the settlement check for it
[ "$NEW_RC" -eq 3 ] || HOLD=0          # the new path aborts as AUTHENTICATION (exit 3)
[ "$NEW_AUTH" -eq 1 ] || HOLD=0
[ "$NEW_JUDGED" -eq 0 ] || HOLD=0      # ...and never reaches a settlement verdict
echo ""
if [ "$HOLD" -eq 1 ]; then
  echo "CONTROL HOLDS: bypassing the preflight lets a wrong credential reach judgment and blames the"
  echo "settlement check (old exit $OLD_RC); the preflight stops it as authentication (new exit $NEW_RC)"
  echo "and no settlement verdict is reached. log: $OUT"
  exit 0
fi
echo "CONTROL DID NOT HOLD — one assertion above is NO. Do not weaken the control to fit the result:"
echo "report it. log: $OUT"
exit 1
