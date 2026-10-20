#!/bin/bash
U=https://b974147c03228029e277d1cbe6646fe6.ctonew.app
PW=$(cat /home/team/shared/.demo-admin-password)
TOK=$(curl -s -X POST -H 'Content-Type: application/json' -d "{\"username\":\"admin\",\"password\":\"$PW\"}" "$U/api/login" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
H="Authorization: Bearer $TOK"
echo "=== pre-boarding overview (the served surface) ==="
curl -s -H "$H" "$U/api/preboarding/checklist/overview" > /tmp/ov.json
python3 - <<'PY'
import json
d = json.load(open('/tmp/ov.json'))
print('top-level keys:', sorted(d.keys())[:12])
def walk(o, depth=0):
    if isinstance(o, list):
        return f'list[{len(o)}]'
    if isinstance(o, dict):
        return {k: walk(v) for k, v in list(o.items())[:10]}
    return o
print('shape:', json.dumps(walk(d))[:600])
PY
echo
echo "=== flag states, all cases, from the flag watch ==="
curl -s -H "$H" "$U/api/preboarding/flag-watch" > /tmp/fw.json
python3 - <<'PY'
import json, collections
d = json.load(open('/tmp/fw.json'))
rows = d if isinstance(d, list) else (d.get('cases') or d.get('flags') or d.get('data') or [])
print('flag-watch rows:', len(rows))
c = collections.Counter()
items = 0
for r in rows:
    for k, v in r.items():
        if 'flag' in k.lower() or k.lower() == 'state':
            c[str(v)] += 1
    items += len(r.get('items') or [])
print('flag-state counts:', dict(c))
print('items carried:', items)
PY
echo
echo "=== per-case checklist: items and their flag states ==="
for cid in $(curl -s -H "$H" "$U/api/preboarding/cases" | python3 -c "
import sys,json;d=json.load(sys.stdin);rows=d if isinstance(d,list) else (d.get('cases') or d.get('data') or [])
print(' '.join(str(r.get('id')) for r in rows))"); do
  curl -s -H "$H" "$U/api/preboarding/cases/$cid/checklist" > /tmp/cl.json
  python3 - "$cid" <<'PY'
import json, sys, collections
d = json.load(open('/tmp/cl.json'))
its = d.get('items') if isinstance(d, dict) else d
its = its or []
c = collections.Counter(str(i.get('flag') if i.get('flag') is not None else i.get('status')) for i in its)
print(f'  case {sys.argv[1][:8]}: items={len(its)} states={dict(c)}')
PY
done
