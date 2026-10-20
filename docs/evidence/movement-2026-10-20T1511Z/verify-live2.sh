#!/bin/bash
U=https://b974147c03228029e277d1cbe6646fe6.ctonew.app
PW=$(cat /home/team/shared/.demo-admin-password)
TOK=$(curl -s -X POST -H 'Content-Type: application/json' -d "{\"username\":\"admin\",\"password\":\"$PW\"}" "$U/api/login" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')

echo "--- A. is 3000 ours? ---"
echo "localhost:3000 -> $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)  $(curl -s http://127.0.0.1:3000/ | grep -o '<title>[^<]*</title>')"
echo "listeners (ss -ltnp):"; (ss -ltnp 2>&1 | grep ':3000' || echo "  ss sees none")
echo "process holding it:"; (fuser -n tcp 3000 2>&1 || true) | head -3
echo

echo "--- B. pre-boarding surface: cases, flag states, items ---"
curl -s -H "Authorization: Bearer $TOK" "$U/api/preboarding/cases" > /tmp/pb.json
python3 - <<'PY'
import json
d = json.load(open('/tmp/pb.json'))
rows = d if isinstance(d, list) else (d.get('cases') or d.get('data') or [])
print('cases:', len(rows))
if rows:
    print('keys on a case:', sorted(rows[0].keys()))
    for c in rows:
        print(' case', c.get('id'), '| state/flag fields:', {k: v for k, v in c.items() if 'flag' in k.lower() or 'state' in k.lower() or 'status' in k.lower()})
PY
for cid in $(python3 -c "
import json;d=json.load(open('/tmp/pb.json'));rows=d if isinstance(d,list) else (d.get('cases') or d.get('data') or [])
print(' '.join(str(r.get('id')) for r in rows))"); do
  curl -s -H "Authorization: Bearer $TOK" "$U/api/preboarding/cases/$cid" > /tmp/pb1.json
  python3 - "$cid" <<'PY'
import json, sys
cid = sys.argv[1]
d = json.load(open('/tmp/pb1.json'))
c = d.get('case', d)
its = c.get('items') or []
marks = {}
for i in its:
    k = i.get('flag') or i.get('flagState') or i.get('state') or i.get('status')
    marks[k] = marks.get(k, 0) + 1
print(f' case {cid}: items={len(its)} flag-states={marks}')
PY
done
echo

echo "--- C. the guard's own exit line (acceptance of the code now armed) ---"
GUARD=$(pgrep -f 'bash scripts/keep-alive.sh' | head -1)
echo "guard pid: $GUARD"
ls -l /home/team/shared/keep-alive.log /home/team/shared/probable-octo-sniffle/keep-alive.log 2>/dev/null | head -3
LOGC=$(find /home/team/shared /home/team/.data /tmp -maxdepth 2 -name '*keep-alive*' -newermt '-1 day' 2>/dev/null | head -5)
echo "guard-related files: $LOGC"
T0=$(date +%s.%N)
kill -TERM "$GUARD"
for i in $(seq 1 60); do
  if ! kill -0 "$GUARD" 2>/dev/null; then break; fi
  sleep 0.5
done
T1=$(date +%s.%N)
if kill -0 "$GUARD" 2>/dev/null; then
  echo "STILL RUNNING after $(echo "$T1 - $T0" | bc) s — the old failure mode"
else
  echo "exited in $(echo "$T1 - $T0" | bc) s"
fi
for f in $LOGC; do echo "--- $f (last 6)"; tail -6 "$f"; done
echo "guard processes now: $(pgrep -c -f 'bash scripts/keep-alive.sh')"
