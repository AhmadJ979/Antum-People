#!/usr/bin/env bash
export HOME=/home/agent-senior-software-engineer
B=$HOME/pass/b; A="agent-browser --session live1"
rm -f $B/owed-*.json $B/drive.log
log(){ echo "[$(date -u +%H:%M:%S)] $*" >> $B/drive.log; }
nav(){ local r=$(agent-browser --session live1 snapshot -i 2>/dev/null | awk '/button "Pre-boarding"/{match($0,/ref=e[0-9]+/); print substr($0,RSTART+4,RLENGTH-4); exit}'); log "nav ref=[$r]"; [ -n "$r" ] && agent-browser --session live1 click @$r >> $B/drive.log 2>&1; }
$A eval "location.reload()" >/dev/null 2>&1; sleep 6
nav; sleep 4
agent-browser --session live1 eval "$(cat $B/diag.js)" > $B/drive-diag.json 2>&1
log "diag rows=$(python3 -c "import json;print(json.load(open('$B/drive-diag.json')).get('rows'))" 2>/dev/null)"
$A eval "$(cat $B/open02.js)" >> $B/drive.log 2>&1; sleep 4
$A eval "$(cat $B/read_board.js)" > $B/owed-02-clean.json 2>&1; log "captured 02 clean"
$A eval "window.__chip='IT'" >/dev/null 2>&1; $A eval "$(cat $B/chip.js)" >> $B/drive.log 2>&1; sleep 4
$A eval "$(cat $B/read_board.js)" > $B/owed-02-it.json 2>&1; log "captured 02 narrowed"
$A eval "$(cat $B/open01.js)" >> $B/drive.log 2>&1; sleep 5
$A eval "$(cat $B/read_board.js)" > $B/owed-01-after-02-filter.json 2>&1; log "OWED READ captured"
$A eval "$(cat $B/scroll_board.js)" >/dev/null 2>&1; sleep 1; $A screenshot --screenshot-dir $HOME/pass/shots > $B/drive-shot3.txt 2>&1
$A eval "window.__chip='IT'" >/dev/null 2>&1; $A eval "$(cat $B/chip.js)" >> $B/drive.log 2>&1; sleep 4
$A eval "$(cat $B/read_board.js)" > $B/owed-01-it.json 2>&1; log "captured 01 narrowed"
$A eval "$(cat $B/open02.js)" >> $B/drive.log 2>&1; sleep 5
$A eval "$(cat $B/read_board.js)" > $B/owed-02-after-01-filter.json 2>&1; log "captured 02 after 01 filter"
$A eval "$(cat $B/racepatch.js)" >> $B/drive.log 2>&1
$A eval "window.__chip='IT'" >/dev/null 2>&1; $A eval "$(cat $B/chip.js)" >> $B/drive.log 2>&1; sleep 4
$A eval "window.__chip='All'" >/dev/null 2>&1; $A eval "$(cat $B/chip.js)" >> $B/drive.log 2>&1
for d in 0 0.2 0.4 0.8 1.5 2.2 3.0; do sleep $d; $A eval "$(cat $B/sample.js)" >> $B/drive.log 2>&1; done
sleep 2; $A eval "$(cat $B/race.js)" > $B/race-samples.json 2>&1
log "DONE"
