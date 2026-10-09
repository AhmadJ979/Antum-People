#!/usr/bin/env bash
# Rendered pass on the pre-cutover rig (port 4741). Read-only against the product:
# nav clicks, chip moves and one jurisdiction switch are UI state and GETs only.
set -u
export HOME=/home/agent-product-designer
B="agent-browser --session pcut"
BASE=http://localhost:4741
OUT=/home/agent-product-designer/rig-cutover-out
P=$OUT/pass
D=/home/agent-product-designer
mkdir -p "$P/shots"
LOG=$P/pass.txt
: > "$LOG"

echo "== pass start $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"
TOKEN=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"username\":\"scratch-admin\",\"password\":\"$(cat $OUT/scratch-pass.txt)\"}" \
  "$BASE/api/login" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
echo "== token acquired, length ${#TOKEN}" | tee -a "$LOG"

$B open "$BASE/" >> "$LOG" 2>&1
sleep 2
$B eval "(function(){var t='$TOKEN';localStorage.setItem('antum_token',t);localStorage.setItem('antum_user','{\"id\":\"scratch-admin\",\"username\":\"scratch-admin\",\"role\":\"admin\"}');location.reload();return 'session injected';})()" >> "$LOG" 2>&1
sleep 3
$B errors --clear >> "$LOG" 2>&1

say () { echo "-- $1" | tee -a "$LOG"; }
setmode () { $B eval "(function(){window.__mode='$1';window.__want='$2';window.__caseName='$3';window.__chip='$4';window.__jur='$5';return 'set';})()" >> "$LOG" 2>&1; }
clicknow () { $B eval "$(cat $D/pass-click.js)" | tee -a "$LOG"; sleep 2; }
probe () { $B eval "$(cat $D/pass-probe.js)" > "$P/$1.json" 2>&1; echo "   probe $1: $(head -c 260 "$P/$1.json")" | tee -a "$LOG"; }
board () { $B eval "$(cat $D/pass-board.js)" > "$P/$1.json" 2>&1; echo "   board $1: $(head -c 260 "$P/$1.json")" | tee -a "$LOG"; }
shot () { $B screenshot "$P/shots/$1.png" >> "$LOG" 2>&1; }

probe surface-00-shell

for pair in "Executive Dashboard:dashboard" "Employee Directory:employees" "Transitions Hub:transitions" "Pre-boarding:preboarding" "Strategic Intelligence:analytics"; do
  label="${pair%%:*}"; slug="${pair##*:}"
  say "surface $slug <- nav '$label'"
  setmode nav "$label" "" "" ""
  clicknow
  probe "surface-$slug"
  shot "$slug"
done

say "back to Pre-boarding for the detail pass"
setmode nav "Pre-boarding" "" "" ""
clicknow
probe pb-surface
$B eval "$(cat $D/pass-flag.js)" > "$P/pb-rows.json" 2>&1
echo "   pb-rows: $(head -c 700 "$P/pb-rows.json")" | tee -a "$LOG"
shot pb-rows

say "expand case 1 row"
setmode row "" "Omar Al-Farsi" "" ""
clicknow
board board-1-initial
shot pb-row1-all

say "chip -> IT"
setmode chip "" "" "IT" ""
clicknow
board board-2-it
shot pb-row1-it

say "chip -> All again (the #119 gesture)"
setmode chip "" "" "All" ""
clicknow
board board-3-all-again
shot pb-row1-all-again

say "jurisdiction chip -> KSA"
setmode jur "" "" "" "KSA"
clicknow
probe jur-ksa
shot pb-jur-ksa

say "jurisdiction chip -> UAE"
setmode jur "" "" "" "UAE"
clicknow
probe jur-uae
shot pb-jur-uae

say "network and errors"
$B network requests > "$P/network-requests.txt" 2>&1
$B errors > "$P/page-errors.txt" 2>&1
$B console > "$P/console.txt" 2>&1
head -25 "$P/network-requests.txt" | tee -a "$LOG"
echo "   page errors: $(head -c 300 "$P/page-errors.txt")" | tee -a "$LOG"
curl -s -o /dev/null -w "   live :3000 after pass: %{http_code}\n" http://localhost:3000/ | tee -a "$LOG"
echo "== pass end $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"
