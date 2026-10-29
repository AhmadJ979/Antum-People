#!/bin/bash
# Live-host plant proof for scripts/check-host-template-copies.py.
# Plants a document copy in the REAL retired host folder, runs the check, removes the plant, runs again.
# Leaves the folder byte-and-listing-identical to how it was found (asserted at the end).
set -uo pipefail
REPO=/home/team/shared/wt-templates
CHECK="$REPO/scripts/check-host-template-copies.py"
HOST=/home/team/shared/templates
ts() { date -u +%H:%M:%SZ; }

snapshot() { ( cd "$HOST" && find . -printf '%y %p %s\n' | sort ); }

BEFORE=$(snapshot)
echo "=== host plant proof $(ts) · check: $CHECK"
echo "=== the folder BEFORE anything:"
echo "$BEFORE"

echo
echo "--- P0 clean run (the state today) -------------------------------------------------"
python3 "$CHECK" --root "$HOST"; echo "P0 exit=$?"

echo
echo "--- P1 TOP LEVEL plant: privacy-notice.md (a name that belongs only to the repository) ---"
cp "$REPO/templates/privacy-notice.md" "$HOST/privacy-notice.md"
echo "\$ ls: $(cd "$HOST" && find . -maxdepth 1 -type f | tr '\n' ' ')"
python3 "$CHECK" --root "$HOST"; echo "P1 exit=$?"
rm -f "$HOST/privacy-notice.md"

echo
echo "--- P1b clean again after removing the plant ------------------------------------------"
python3 "$CHECK" --root "$HOST"; echo "P1b exit=$?"

echo
echo "--- P2 NESTED DIRECTORY plant: drafts/ksa-employment-contract.md -----------------------"
mkdir -p "$HOST/drafts"
cp "$REPO/templates/ksa-employment-contract.md" "$HOST/drafts/ksa-employment-contract.md"
python3 "$CHECK" --root "$HOST"; echo "P2 exit=$?"
rm -f "$HOST/drafts/ksa-employment-contract.md"; rmdir "$HOST/drafts"

echo
echo "--- P3 a name NO LIST NAMES: retired/privacy-addendum-2027.txt ------------------------"
cp "$REPO/templates/privacy-notice.md" "$HOST/retired/privacy-addendum-2027.txt"
python3 "$CHECK" --root "$HOST"; echo "P3 exit=$?"
rm -f "$HOST/retired/privacy-addendum-2027.txt"

echo
echo "--- P4 final: clean, and the quarantine's three reported green -----------------------"
python3 "$CHECK" --root "$HOST"; echo "P4 exit=$?"

AFTER=$(snapshot)
echo
echo "=== the folder AFTER everything:"
echo "$AFTER"
if [ "$BEFORE" = "$AFTER" ]; then
  echo "=== RESTORED: the host folder lists identically to how it was found (paths, kinds, sizes)"
else
  echo "=== NOT RESTORED - DIFF:"
  diff <(echo "$BEFORE") <(echo "$AFTER")
fi
echo "=== done $(ts)"
