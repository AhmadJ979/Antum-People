#!/usr/bin/env bash
# Second rendered pass: only the workspace board's own text, so the IT -> All gesture can be
# compared by content rather than by which chip is dark. Same rig, same session.
set -u
export HOME=/home/agent-product-designer
B="agent-browser --session pcut"
BASE=http://localhost:4741
OUT=/home/agent-product-designer/rig-cutover-out
P=$OUT/pass
D=/home/agent-product-designer
LOG=$P/pass-board.txt
: > "$LOG"

echo "== board pass start $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"
setm () { $B eval "(function(){window.__mode='$1';window.__want='$2';window.__caseName='$3';window.__chip='$4';return 'set';})()" >> "$LOG" 2>&1; }
clicknow () { $B eval "$(cat $D/pass-click.js)" | tee -a "$LOG"; sleep 2; }
bprobe () { $B eval "$(cat $D/pass-board2.js)" > "$P/$1.json" 2>&1; echo "   $1: $(head -c 220 "$P/$1.json")" | tee -a "$LOG"; }

setm nav "Pre-boarding" "" ""
clicknow
setm row "" "Omar Al-Farsi" ""
clicknow
bprobe boardA-all
setm chip "" "" "IT"
clicknow
bprobe boardB-it
setm chip "" "" "All"
clicknow
bprobe boardC-all-again
# the same gesture on the second case, so a one-case accident can be told from a rule
setm nav "Pre-boarding" "" ""
clicknow
setm row "" "Mariam Al-Kaabi" ""
clicknow
bprobe boardD-case2-all
echo "== board pass end $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"
curl -s -o /dev/null -w "   live :3000 after board pass: %{http_code}\n" http://localhost:3000/ | tee -a "$LOG"
