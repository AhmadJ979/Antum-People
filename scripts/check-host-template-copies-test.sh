#!/bin/bash
# check-host-template-copies-test.sh — proves scripts/check-host-template-copies.py REDDENS on a document
# copy reappearing in the retired host folder, and stays GREEN on the quarantine that is already there.
#
# WHY THIS EXISTS. The ruling (owner, 2026-10-29) is that the REPOSITORY is the sole authority for served
# documents and /home/team/shared/templates/ is retired - 11 duplicates deleted, the drifted one
# quarantined. The guard written for that ruling is worth exactly as much as its ability to redden, and a
# guard that names files passes vacuously. So this suite drives the real check against a SCRATCH COPY of
# the folder (never the host one) and requires, one case at a time:
#
#   (A) the fixture that IS today's host state (0 top-level files; the quarantine's 3) -> exit 0, and the
#       COUNTS are asserted: 2 directories walked, 3 entries examined, 0 top-level, 3 quarantined,
#       0 violations. A green with a zero count is the defect class this asserts against.
#   (B) a document copy at the TOP LEVEL (`privacy-notice.md` - a name that belongs only to the
#       repository) -> exit 1, the path is NAMED, no "OK:" line is printed
#   (C) removing it restores green: the redden in (B) was the plant, not the run
#   (D) a copy in a NESTED directory (`notes/ksa-employment-contract.md`) -> exit 1, naming that path
#   (E) a name NO LIST NAMES, inside the quarantine (`privacy-addendum-2027.txt` - no list of forbidden
#       filenames contains it, which is the point: the check judges WHERE and WHAT, not a name) -> exit 1
#   (F) a second authoritative copy wearing a different name
#       (`privacy-notice.retired-9d2182a.md` - the suffix in the middle instead of the end) -> exit 1
#   (G) a nested directory INSIDE the quarantine (`retired/deep/privacy-notice.md`) -> exit 1
#   (H) a SYMLINK quarantined in place of the file (`<name>.retired-9d2182a` -> the repository's copy):
#       a path into the retired folder with no bytes of its own -> exit 1, named NOT-A-PLAIN-FILE
#   (I) THE QUARANTINE'S THREE FILES STAY GREEN IN EVERY RED RUN - asserted in each case, not once
#   (J) a missing folder -> exit 2 (CANNOT-JUDGE), not 0 and not 1, and it must not print a green
#   (K) a folder path that is a FILE, not a directory -> exit 2
#   (L) READ-ONLY: the fixture's own md5s are unchanged by the whole suite, and the LIVE host folder is
#       byte-identical afterwards (it is judged by this suite, never written to)
#   (M) the LIVE host folder is judged once and its counts and verdict are printed - host state, reported
#       rather than scored here (check-all.py runs the same check as a default check).
#
# USAGE: bash scripts/check-host-template-copies-test.sh          (exit 0 = every case passed)
#        ANTUM_HOST_TEMPLATES_DIR=DIR bash scripts/check-host-template-copies-test.sh   (judge another folder in (M))
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECK="$REPO/scripts/check-host-template-copies.py"
LIVE_DIR="${ANTUM_HOST_TEMPLATES_DIR:-/home/team/shared/templates}"
ROOT=$(mktemp -d /tmp/check-host-template-copies-test.XXXXXX) || { echo "ABORT: no scratch space"; exit 2; }
FIX="$ROOT/fixture"
OUT="$ROOT/out.txt"
cleanup() { rm -rf "$ROOT"; }
trap cleanup EXIT
PASS=0; FAIL=0
ok()  { echo "  PASS  $*"; PASS=$((PASS+1)); }
bad() { echo "  FAIL  $*"; FAIL=$((FAIL+1)); }

# The quarantine's three files, as they are on the host today (bytes copied from the repository's own
# templates, which is where the authoritative copies live).
Q1="privacy-notice.md.retired-9d2182a"
Q2="ksa-employment-contract.md.retired-9d2182a"
Q3="uae-employment-contract.md.retired-4c8779b"

mkfixture() {
  rm -rf "$FIX"
  mkdir -p "$FIX/retired"
  cp "$REPO/templates/privacy-notice.md"           "$FIX/retired/$Q1"
  cp "$REPO/templates/ksa-employment-contract.md"  "$FIX/retired/$Q2"
  cp "$REPO/templates/uae-employment-contract.md"  "$FIX/retired/$Q3"
}

run() { python3 "$CHECK" --root "$FIX" >"$OUT" 2>&1; echo $?; }

quarantine_green() {   # every red case must leave the three quarantined files reported as ok
  local label="$1" q
  for q in "$Q1" "$Q2" "$Q3"; do
    grep -qF "ok    retired/$q" "$OUT" || bad "$label: the quarantined file retired/$q stopped being reported ok"
  done
}

red_case() {           # label, the path that must be named, the reason token the verdict must print
  local label="$1" path="$2" why="$3" rc
  rc=$(run)
  if [ "$rc" != "1" ]; then bad "$label: expected exit 1 (RED), got $rc"; sed -n '1,12p' "$OUT" | sed 's/^/        /'; return; fi
  if ! grep -qF "RED   $path" "$OUT"; then bad "$label: the RED did not name the path $path"; sed -n '1,12p' "$OUT" | sed 's/^/        /'; return; fi
  if ! grep -qF "$why" "$OUT"; then bad "$label: the RED did not say '$why'"; return; fi
  if grep -q "^OK:" "$OUT"; then bad "$label: a RED run also printed an OK line"; return; fi
  quarantine_green "$label"
  ok "$label  (exit 1, named $path: $why)"
}

echo "== check-host-template-copies proof =="
echo "check : $CHECK"
echo "fixture: $FIX  (a scratch copy - the host folder is never written to)"
echo

# ---------------------------------------------------------------- (A) the clean fixture + its counts
mkfixture
BEFORE_MD5=$(cd "$FIX" && find . -type f -exec md5sum {} \; | sort | md5sum)
rc=$(run)
if [ "$rc" != "0" ]; then
  bad "(A) the fixture mirroring today's host state did not pass: exit $rc"; sed -n '1,20p' "$OUT" | sed 's/^/        /'
else
  ok "(A) the fixture mirroring today's host state is GREEN (exit 0)"
fi
grep -qE "directories walked    : 2" "$OUT" && ok "(A) counts: 2 directories walked" \
  || bad "(A) the run did not report walking 2 directories"
grep -qE "entries examined      : 3" "$OUT" && ok "(A) counts: 3 entries examined" \
  || bad "(A) the run did not report examining 3 entries"
grep -qE "files at TOP LEVEL    : 0" "$OUT" && ok "(A) counts: 0 files at the top level" \
  || bad "(A) the run did not report the top-level file count"
grep -qE "quarantined \(matching\): 3" "$OUT" && ok "(A) counts: 3 quarantined, matching the rule" \
  || bad "(A) the run did not report 3 matching quarantined files"
grep -qE "violations            : 0" "$OUT" && ok "(A) counts: 0 violations" \
  || bad "(A) the run did not report the violation count"
quarantine_green "(A)"

# ---------------------------------------------------------------- (B) top level, (C) removal restores
cp "$REPO/templates/privacy-notice.md" "$FIX/privacy-notice.md"
red_case "(B) a document copy at the TOP LEVEL of the retired folder" "privacy-notice.md" "TOP-LEVEL"
rm -f "$FIX/privacy-notice.md"
rc=$(run)
[ "$rc" = "0" ] && ok "(C) removing the plant restored green - the redden in (B) was the plant, not the run" \
  || bad "(C) the fixture is still red after the plant was removed (exit $rc)"

# ---------------------------------------------------------------- (D) a nested directory
mkdir -p "$FIX/notes"
cp "$REPO/templates/ksa-employment-contract.md" "$FIX/notes/ksa-employment-contract.md"
red_case "(D) a document copy in a NESTED directory" "notes/ksa-employment-contract.md" "FOREIGN-DIR"
rm -rf "$FIX/notes"

# ---------------------------------------------------------------- (E) a name no list names
cp "$REPO/templates/privacy-notice.md" "$FIX/retired/privacy-addendum-2027.txt"
red_case "(E) a name NO LIST NAMES, quarantined" "retired/privacy-addendum-2027.txt" "BAD-QUARANTINE-NAME"
rm -f "$FIX/retired/privacy-addendum-2027.txt"

# ---------------------------------------------------------------- (F) a second copy wearing another name
cp "$REPO/templates/privacy-notice.md" "$FIX/retired/privacy-notice.retired-9d2182a.md"
red_case "(F) a second authoritative copy wearing a different name (suffix not at the end)" \
         "retired/privacy-notice.retired-9d2182a.md" "BAD-QUARANTINE-NAME"
rm -f "$FIX/retired/privacy-notice.retired-9d2182a.md"

# ---------------------------------------------------------------- (G) a directory inside the quarantine
mkdir -p "$FIX/retired/deep"
cp "$REPO/templates/privacy-notice.md" "$FIX/retired/deep/privacy-notice.md"
red_case "(G) a nested directory INSIDE the quarantine (the quarantine is flat)" \
         "retired/deep/privacy-notice.md" "NESTED-IN-QUARANTINE"
rm -rf "$FIX/retired/deep"

# ---------------------------------------------------------------- (H) a symlink instead of the file
# A fresh quarantine-shaped name, so the three real files stay green in this red run too (case I's
# invariant is asserted inside red_case for every case).
SYM="retired/ksa-employment-contract.md.retired-abc1234"
ln -s "$REPO/templates/privacy-notice.md" "$FIX/$SYM"
red_case "(H) a symlink where a quarantined file should be" "$SYM" "NOT-A-PLAIN-FILE"
rm -f "$FIX/$SYM"
mkfixture

# ---------------------------------------------------------------- (I) the quarantine, green again
rc=$(run)
if [ "$rc" = "0" ] && grep -qF "ok    retired/$Q1" "$OUT" && grep -qF "ok    retired/$Q2" "$OUT" \
   && grep -qF "ok    retired/$Q3" "$OUT"; then
  ok "(I) after every plant was removed, the quarantine's 3 files are green and reported by name"
else
  bad "(I) the restored fixture is not green with all 3 quarantined files named (exit $rc)"
fi

# ---------------------------------------------------------------- (J) a missing folder is CANNOT-JUDGE
python3 "$CHECK" --root "$ROOT/not-here" >"$OUT" 2>&1; rc=$?
if [ "$rc" = "2" ]; then ok "(J) a MISSING folder exits 2 (CANNOT-JUDGE) - not 0 and not 1";
else bad "(J) a missing folder exited $rc; a folder it cannot open must not read as a pass"; fi
grep -q "^CANNOT-JUDGE" "$OUT" && ok "(J) and it says so on its own line" \
  || bad "(J) the missing-folder run did not print CANNOT-JUDGE"
grep -q "^OK:" "$OUT" && bad "(J) the missing-folder run printed a green line" \
  || ok "(J) and it prints no OK line"

# ---------------------------------------------------------------- (K) a path that is a file
: > "$ROOT/not-a-dir"
python3 "$CHECK" --root "$ROOT/not-a-dir" >"$OUT" 2>&1; rc=$?
if [ "$rc" = "2" ]; then ok "(K) a path that is a FILE exits 2 (CANNOT-JUDGE)";
else bad "(K) a path that is a file exited $rc"; fi

# ---------------------------------------------------------------- (L) read-only, fixture and host
AFTER_MD5=$(cd "$FIX" && find . -type f -exec md5sum {} \; | sort | md5sum)
[ "$BEFORE_MD5" = "$AFTER_MD5" ] && ok "(L) the fixture's bytes and file list are unchanged by the whole suite" \
  || bad "(L) the suite modified its own fixture"

if [ -d "$LIVE_DIR" ]; then
  HOST_BEFORE=$(cd "$LIVE_DIR" && find . -printf '%p %s %T@\n' | sort | md5sum)
  HOST_AFTER=$(cd "$LIVE_DIR" && find . -printf '%p %s %T@\n' | sort | md5sum)
  [ "$HOST_BEFORE" = "$HOST_AFTER" ] && ok "(L) the live host folder is untouched by the suite (paths, sizes, mtimes)" \
    || bad "(L) the live host folder changed while the suite ran"
else
  bad "(L) the live host folder $LIVE_DIR does not exist - it must on this host"
fi

# ---------------------------------------------------------------- (M) the live folder, reported
echo
echo "== the live host folder, judged once (host state - reported here, scored by check-all.py) =="
python3 "$CHECK" --root "$LIVE_DIR" >"$OUT" 2>&1; rc=$?
sed -n '6,40p' "$OUT" | sed 's/^/  LIVE: /'
echo "  LIVE: exit $rc   (0 = retired state; 1 = a copy is back; 2 = the folder could not be judged)"
case "$rc" in
  0) echo "  LIVE: the host folder is in its retired state right now";;
  1) echo "  LIVE: A COPY IS IN THE RETIRED FOLDER - see the paths above. check-all.py runs this as a"
     echo "  LIVE: default check, so a green check-all and this line cannot both be right";;
  2) echo "  LIVE: the folder could not be judged - that is a red for the operator, not a pass";;
  *) echo "  LIVE: the check exited $rc, which is not one of its three codes";;
esac

echo
echo "== $PASS passed, $FAIL failed =="
[ "$FAIL" = "0" ] || exit 1
exit 0
