#!/usr/bin/env bash
# P2-4 smoke: the workspace route over real HTTP, against a throwaway database.
set -u
export HOME=/home/agent-senior-software-engineer
REPO=$HOME/antum-people
export PRODUCT_DB_PATH=/tmp/p24smoke.db
export JWT_SECRET=smoke-secret-not-a-real-one
export ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
export PORT=4789
export ADMIN_INITIAL_PASSWORD=smoke-pass-12345
rm -f /tmp/p24smoke.db /tmp/p24smoke.db-wal /tmp/p24smoke.db-shm /tmp/p24smoke.db-journal
cd "$REPO/server" || exit 1

node migrate.js > /tmp/p24smoke-migrate.log 2>&1
echo "migrate exit: $?"

node -e "require('./preboarding').recordOfferAcceptance({offer_reference:'OFR-2026-SMOKE-1',candidate_name:'Smoke Hire',candidate_email:'smoke@example.com',role:'Marketing Manager',department:'Marketing',reporting_line:'CMO',jurisdiction:'AE',start_date:'2026-12-07'},{actor:'smoke',source:'intake_form'}).then(r=>console.log('CASE '+r.case.id+' workspace_lines='+r.workspace_lines))" > /tmp/p24smoke-case.txt 2>&1
cat /tmp/p24smoke-case.txt
CASE=$(sed -n 's/^CASE \([^ ]*\).*/\1/p' /tmp/p24smoke-case.txt)

nohup node index.js > /tmp/p24smoke-server.log 2>&1 &
SRV=$!
sleep 4

TOKEN=$(curl -s -X POST -H 'Content-Type: application/json' -d '{"username":"admin","password":"smoke-pass-12345"}' http://127.0.0.1:4789/api/login | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))')
echo "case: $CASE | token: ${#TOKEN} chars"

echo "--- the board (unfiltered):"
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:4789/api/preboarding/cases/$CASE/workspace" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('view       :', d['view']['label'], '| mode', d['view']['mode'], '| is_access_control', d['view']['is_access_control'])
print('derived    :', d['derived_from'])
print('counts     :', [(f['function'], f['open'], 'of', f['lines']) for f in d['available_functions']])
print('totals     :', d['totals'])
for g in d['groups']:
    print(' ', g['function'], [(l['item_key'], l['owner'], l['due_date'], l['due_rule']) for l in g['lines']])
"

echo "--- the same board filtered to IT:"
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:4789/api/preboarding/cases/$CASE/workspace?function=IT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('mode  :', d['view']['mode'], '| function:', d['view']['function'], '| groups:', [g['function'] for g in d['groups']])
print('lines :', [l['item_key'] for l in d['groups'][0]['lines']])
print('counts still carried:', [f['function'] for f in d['available_functions']])
"

echo "--- refusal: a function that does not exist"
curl -s -o /tmp/p24-refuse1.json -w "http %{http_code} " -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:4789/api/preboarding/cases/$CASE/workspace?function=Finance"
cat /tmp/p24-refuse1.json; echo

echo "--- refusal: a case that does not exist"
curl -s -o /tmp/p24-refuse2.json -w "http %{http_code} " -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:4789/api/preboarding/cases/does-not-exist/workspace"
cat /tmp/p24-refuse2.json; echo

echo "--- the employee-track read, to show the two are not merged"
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:4789/api/preboarding/cases/$CASE/checklist" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('employee items :', [i['item_key'] for i in d['items']])
print('by_track       :', d['summary']['by_track'])
print('flag open_count:', d['summary']['flag']['open_count'], '| employee outstanding:', d['summary']['outstanding_count'])
"

echo "--- no-delivery words anywhere in the board payload"
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:4789/api/preboarding/cases/$CASE/workspace" | grep -ciE '"sent"|"emailed"|"notified"|"delivered":true' || echo "0 (none)"

kill $SRV 2>/dev/null
echo "server stopped"
