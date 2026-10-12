#!/usr/bin/env bash
# Second rendered pass: expand by clicking the row button itself, then capture the gate panel,
# the no-basis item rows, the notice modal, and the live record action.
set -u
export HOME=/home/agent-product-designer
PORT=4744
OUT=$HOME/rig-final3-out
SHOTS=$OUT/shots
mkdir -p "$SHOTS" "$OUT/dom2"
JS=$HOME/notice-pass2.js
AB=agent-browser

bash "$HOME/rig-refresh.sh" > "$OUT/refresh-browser2.log" 2>&1
tail -2 "$OUT/refresh-browser2.log"
SCRATCH_PASS=$(cat "$OUT/pass.txt") node "$HOME/gettok.cjs" > "$OUT/dom2/00-token.txt" 2>&1
TOKEN=$(node -e 'process.stdout.write(require("'$OUT'/token.json").token)')
USER=$(node -e 'process.stdout.write(JSON.stringify(require("'$OUT'/token.json").user))')

$AB open "http://localhost:$PORT/" > /dev/null 2>&1
$AB eval "localStorage.setItem('antum_token','$TOKEN');localStorage.setItem('antum_user',JSON.stringify($USER));location.reload()" > /dev/null 2>&1
sleep 4
$AB eval "window.__p={mode:'nav',want:'Pre-boarding'}" > /dev/null 2>&1; $AB eval "$(cat $HOME/notice-pass.js)" > "$OUT/dom2/01-nav.txt" 2>&1
sleep 2
$AB screenshot "$SHOTS/11-rollup-served.png" > /dev/null 2>&1

# up to 3 case rows: collapsed text first, then expanded
$AB eval "window.__p={mode:'page',anchor:'CASES OPEN',len:1200}" > /dev/null 2>&1
$AB eval "$(cat $JS)" > "$OUT/dom2/02-page-collapsed.txt" 2>&1

$AB eval "window.__p={mode:'expand2',caseName:'Omar Al-Farsi'}" > /dev/null 2>&1
$AB eval "$(cat $JS)" > "$OUT/dom2/03-expand-clear.txt" 2>&1
sleep 2
$AB eval "window.__p={mode:'page',anchor:'Omar Al-Farsi',len:2600}" > /dev/null 2>&1
$AB eval "$(cat $JS)" > "$OUT/dom2/04-page-clear-expanded.txt" 2>&1
$AB screenshot "$SHOTS/12-clear-case-gate-panel.png" > /dev/null 2>&1

$AB eval "window.__p={mode:'itemrow',itemLabel:'Education certificate'}" > /dev/null 2>&1
$AB eval "$(cat $JS)" > "$OUT/dom2/05-item-edu.txt" 2>&1
$AB eval "window.__p={mode:'itemrow',itemLabel:'Emergency contact'}" > /dev/null 2>&1
$AB eval "$(cat $JS)" > "$OUT/dom2/06-item-emergency.txt" 2>&1
$AB eval "window.__p={mode:'itemrow',itemLabel:'Passport copy'}" > /dev/null 2>&1
$AB eval "$(cat $JS)" > "$OUT/dom2/07-item-passport.txt" 2>&1

$AB eval "window.__p={mode:'itemreq',itemLabel:'Education certificate',button:'Request'}" > /dev/null 2>&1
$AB eval "$(cat $JS)" > "$OUT/dom2/08-request-edu.txt" 2>&1
sleep 2
$AB eval "window.__p={mode:'itemrow',itemLabel:'Education certificate'}" > /dev/null 2>&1
$AB eval "$(cat $JS)" > "$OUT/dom2/09-item-edu-after-request.txt" 2>&1
$AB screenshot "$SHOTS/13-no-basis-requested.png" > /dev/null 2>&1

$AB eval "window.__p={mode:'page',anchor:'Workspace and documents',len:1800}" > /dev/null 2>&1
$AB eval "$(cat $JS)" > "$OUT/dom2/10-gate-buttons.txt" 2>&1
$AB eval "window.__p={mode:'click',re:'^Open the notice'}" > /dev/null 2>&1
$AB eval "$(cat $JS)" > "$OUT/dom2/11-open-notice.txt" 2>&1
sleep 2
$AB screenshot "$SHOTS/14-notice-modal.png" > /dev/null 2>&1
$AB eval "window.__p={mode:'modal'}" > /dev/null 2>&1
$AB eval "$(cat $JS)" > "$OUT/dom2/12-modal-text.txt" 2>&1
$AB eval "window.__p={mode:'page',anchor:'Record that the notice',len:600}" > /dev/null 2>&1
$AB eval "$(cat $JS)" > "$OUT/dom2/13-record-button-before.txt" 2>&1
$AB eval "window.__p={mode:'click',re:'Record that the notice was shown'}" > /dev/null 2>&1
$AB eval "$(cat $JS)" > "$OUT/dom2/14-record-click.txt" 2>&1
sleep 3
$AB screenshot "$SHOTS/15-after-record.png" > /dev/null 2>&1
$AB eval "window.__p={mode:'page',anchor:'CASES OPEN',len:1600}" > /dev/null 2>&1
$AB eval "$(cat $JS)" > "$OUT/dom2/15-page-after-record.txt" 2>&1
echo "done $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUT/dom2/00-token.txt"
ls -la "$SHOTS" | tail -8
