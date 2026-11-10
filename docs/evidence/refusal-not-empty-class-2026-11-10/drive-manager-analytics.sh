#!/usr/bin/env bash
set -u
A=/home/agent-lead; OUT=$A/rigs-mgr; mkdir -p "$OUT"
COOKIE=$(cd "$A/wt-refusal2" && ANTUM_GATE_SECRET_FILE=/tmp/rig2-gate-secret node scripts/gate-cookie.js 2>/dev/null | tr -d '\n')
[ -n "$COOKIE" ] || { echo "NO COOKIE"; exit 1; }
for PAIR in "before:4821" "after:4822"; do
  RIG=${PAIR%%:*}; PORT=${PAIR#*:}
  TOK=$(node -e "console.log(require('/tmp/tokmgr-$PORT.json').token)")
  S="mgr-$RIG"
  agent-browser --session "$S" open "http://localhost:$PORT/" >/dev/null 2>&1
  agent-browser --session "$S" set viewport 1280 800 >/dev/null 2>&1
  agent-browser --session "$S" eval "(function(){document.cookie='$COOKIE; path=/';localStorage.setItem('antum_token','$TOK');localStorage.setItem('antum_user',JSON.stringify({id:'r',username:'mgr',role:'manager'}));return 'ok';})()" >/dev/null 2>&1
  agent-browser --session "$S" open "http://localhost:$PORT/" >/dev/null 2>&1
  sleep 5
  echo "$RIG nav=$(agent-browser --session "$S" eval "(function(){var n=[].slice.call(document.querySelectorAll('button,a')).filter(function(b){return (b.innerText||'').trim()==='Strategic Intelligence';})[0]; if(!n) return 'no-nav'; n.click(); return 'clicked';})()" 2>/dev/null | tail -1)" >> "$OUT/nav.log"
  sleep 4
  agent-browser --session "$S" eval "$(cat $A/probe-mgr-analytics.js)" > "$OUT/$RIG-mgr-analytics.json" 2>&1
  agent-browser --session "$S" close >/dev/null 2>&1
done
echo DONE > "$OUT/DRIVE-DONE"
