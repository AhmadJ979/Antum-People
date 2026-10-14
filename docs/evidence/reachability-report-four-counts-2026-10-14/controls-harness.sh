#!/bin/bash
# Negative controls for scripts/reachability-report.js — does the new summary redden when the register
# changes, and does the OLD report stay silent about it? Run in a scratch worktree; never the clone.
set -u
CLONE=/home/agent-senior-software-engineer/antum-people
W=/home/agent-senior-software-engineer/rc-scratch
S=$(date -u +%Y%m%dT%H%M%SZ)
OUT=/home/agent-senior-software-engineer/rc-controls-$S
STUBS=0
mkdir -p "$OUT"
echo "control run stamp: $S" > "$OUT/HEADER.txt"
echo "worktree: $W (detached at $(git -C $CLONE rev-parse --short HEAD))" >> "$OUT/HEADER.txt"
echo "old report: origin/main:scripts/reachability-report.js  ($(git -C $CLONE show origin/main:scripts/reachability-report.js | wc -c) B)" >> "$OUT/HEADER.txt"
echo "new report: working tree scripts/reachability-report.js ($(wc -c < $CLONE/scripts/reachability-report.js) B)" >> "$OUT/HEADER.txt"

# A control run on a tree that does not exist prints "Cannot find module" and exits 1 — which reads
# exactly like a reddening check. Refuse to run at all unless the tree is really there.
for f in "$W/server/reachability-register.js" "$W/server/preboarding-items.js" "$W/scripts/reachability-report.js"; do
  if [ ! -f "$f" ]; then echo "ABORT: scratch worktree incomplete — $f missing"; exit 1; fi
done
# and refuse a run whose output is not a report at all
looks_like_a_report() { ! grep -qE "Cannot find module|SyntaxError|ReferenceError" "$1"; }

git -C "$CLONE" show origin/main:scripts/reachability-report.js > /home/agent-senior-software-engineer/old-report.js
cp "$CLONE/scripts/reachability-report.js" /home/agent-senior-software-engineer/new-report.js
NEW=/home/agent-senior-software-engineer/new-report.js
OLD=/home/agent-senior-software-engineer/old-report.js

reset_tree() {
  git -C "$W" checkout -- server scripts
  cp "$NEW" "$W/scripts/reachability-report.js"
  cp "$OLD" "$OUT/.old-report.js"
  local dirty
  dirty=$(git -C "$W" status --porcelain | grep -v 'reachability-report.js' | wc -l)
  echo "  [reset] status entries other than the report script: $dirty"
}

# run_pair LABEL: old report first (the state before this PR), then the new one. Same tree both times.
run_pair() {
  local label="$1"
  cp "$OLD" "$W/scripts/reachability-report.js"
  ( cd "$W" && node scripts/reachability-report.js ) > "$OUT/$label-OLD.txt" 2>&1
  local oldrc=$?
  echo "exit=$oldrc" >> "$OUT/$label-OLD.txt"
  cp "$NEW" "$W/scripts/reachability-report.js"
  ( cd "$W" && node scripts/reachability-report.js ) > "$OUT/$label-NEW.txt" 2>&1
  local newrc=$?
  echo "exit=$newrc" >> "$OUT/$label-NEW.txt"
  # a run that is not a report is not a control result — say so and fail the script loudly
  for f in "$OUT/$label-OLD.txt" "$OUT/$label-NEW.txt"; do
    if ! looks_like_a_report "$f"; then echo "  !! STUB RUN — $f is not a report:"; head -3 "$f" | sed 's/^/     /'; STUBS=$((STUBS+1)); fi
  done
  local oldlines newlines
  oldlines=$(wc -l < "$OUT/$label-OLD.txt")
  newlines=$(wc -l < "$OUT/$label-NEW.txt")
  echo "  [old report]  exit $oldrc, $oldlines lines ; mentions a dead end at all: $(grep -ci 'dead.end\|DEAD_END' "$OUT/$label-OLD.txt")"
  echo "  [new report]  exit $newrc, $newlines lines"
  echo "  [new report]  first verdict: $(grep -m1 -E 'REFUSED|Nothing new|NEW finding' "$OUT/$label-NEW.txt")"
  echo "  [new report]  counts line : $(grep -m1 'raw:' "$OUT/$label-NEW.txt")"
  echo "  [new report]  summary    : $(grep -m1 -E 'DEAD_END_ITEMS' "$OUT/$label-NEW.txt")"
  echo "  [new report]  measured   : $(grep -m1 -A1 -E '^  DEAD_END_ITEMS' "$OUT/$label-NEW.txt" | tail -1)"
  echo "  [new report]  refusal    : $(grep -m1 -E 'MISSING|UNDECLARED' "$OUT/$label-NEW.txt")"
  echo "  [new report]  disagree   : $(grep -m1 -E 'DISAGREES|registered but not measured|measured but not registered' "$OUT/$label-NEW.txt")"
}

echo "=== CONTROL A — rename the category in the register (DEAD_END_ITEMS -> DEAD_END_PENDING) ==="
reset_tree
python3 - <<'PY'
p='/home/agent-senior-software-engineer/rc-scratch/server/reachability-register.js'
s=open(p).read()
assert s.count('DEAD_END_ITEMS')==2, s.count('DEAD_END_ITEMS')
s=s.replace('DEAD_END_ITEMS','DEAD_END_PENDING')
open(p,'w').write(s)
print('  injected: both occurrences renamed; count now', open(p).read().count('DEAD_END_PENDING'))
PY
run_pair control-A-renamed-category

echo "=== CONTROL B — a fifth category exported by the register and declared nowhere ==="
reset_tree
python3 - <<'PY'
p='/home/agent-senior-software-engineer/rc-scratch/server/reachability-register.js'
s=open(p).read()
s=s.replace("const RETIRED = {",
  "const ORPHANED_JOBS = {\n  nightly_rollup: { why: 'a job no scheduler names', owner: 'decision 99 test' },\n};\n\nconst RETIRED = {",1)
s=s.replace("DEAD_END_ITEMS, RETIRED,","DEAD_END_ITEMS, RETIRED, ORPHANED_JOBS,",1)
open(p,'w').write(s)
print('  injected: ORPHANED_JOBS defined and exported')
PY
run_pair control-B-fifth-category

echo "=== CONTROL C — an entry added to DEAD_END_ITEMS that the measurement does not support ==="
reset_tree
python3 - <<'PY'
p='/home/agent-senior-software-engineer/rc-scratch/server/reachability-register.js'
s=open(p).read()
s=s.replace("const DEAD_END_ITEMS = {",
  "const DEAD_END_ITEMS = {\n  work_permit_transfer: {\n    why: 'injected by a negative control: registered as a dead end that the measurement cannot see',\n    owner: 'counsel (15(a)) — injected, not a real register entry',\n  },",1)
open(p,'w').write(s)
print('  injected: one extra registered dead-end entry (measured set unchanged)')
PY
run_pair control-C-extra-register-entry

echo "=== CONTROL D — a fourth no-basis item in the product that the register does not carry ==="
reset_tree
python3 - <<'PY'
p='/home/agent-senior-software-engineer/rc-scratch/server/preboarding-items.js'
s=open(p).read()
s=s.replace("  bank_details: {",
  "  insurance_card: {\n    basis: null,\n    notice_line: null,\n    collectible: false,\n    pending_counsel: 'Q9',\n    reason: 'injected by a negative control: a no-basis item nobody registered',\n  },\n  bank_details: {",1)
open(p,'w').write(s)
print('  injected: a fourth no-basis item into NOTICE_BASES (the register still lists three)')
PY
run_pair control-D-fourth-no-basis-item

echo "=== back to a clean tree ==="
reset_tree
git -C "$W" status --porcelain | grep -v reachability-report.js | wc -l
echo "=== the unmodified tree, both reports (the pre-PR comparison) ==="
run_pair control-E-unmodified-tree
echo "=== CONTROL F — one new callerless route: is it counted once, in both reports? ==="
reset_tree
python3 - <<'PY'
p='/home/agent-senior-software-engineer/rc-scratch/server/index.js'
s=open(p).read()
anchor="app.get('/api/analytics/dashboard'"
assert anchor in s, 'anchor route not found'
s=s.replace(anchor,
  "app.get('/api/control-orphan-route', (_req, res) => res.json({ control: true }));\n" + anchor, 1)
open(p,'w').write(s)
print('  injected: GET /api/control-orphan-route, called by nothing (before the SPA catch-all)')
PY
run_pair control-F-one-orphan-route

echo
echo "stub runs detected (a run that is not a report, counted as no result): $STUBS"
echo "evidence written to $OUT"
ls -la "$OUT"
