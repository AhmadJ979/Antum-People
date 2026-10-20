#!/bin/bash
# Post-movement live verification, measured from the public URL and the host.
U=https://b974147c03228029e277d1cbe6646fe6.ctonew.app
PW=$(cat /home/team/shared/.demo-admin-password)
echo "verified $(date -u +%Y-%m-%dT%H:%M:%SZ) from $U"
echo
echo "--- 1. page ---"
curl -s -o /tmp/live.html -w 'root http=%{http_code} bytes=%{size_download}\n' "$U/"
grep -o '<title>[^<]*</title>' /tmp/live.html
echo
echo "--- 2. assets as the browser gets them ---"
for a in $(grep -oE 'assets/[A-Za-z0-9_.-]+\.(js|css)' /tmp/live.html | sort -u); do
  curl -s -o /tmp/a.bin -w "$a http=%{http_code} bytes=%{size_download} md5=" "$U/$a"
  md5sum /tmp/a.bin | cut -d' ' -f1
done
echo
echo "--- 3. auth surface ---"
curl -s -o /dev/null -w 'bad password  -> %{http_code}\n' -X POST -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"wrong-horse"}' "$U/api/login"
TOK=$(curl -s -X POST -H 'Content-Type: application/json' -d "{\"username\":\"admin\",\"password\":\"$PW\"}" "$U/api/login" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
echo "good password -> token: ${TOK:0:12}… (${#TOK} chars)"
echo "no token, roster -> $(curl -s -o /dev/null -w '%{http_code}' "$U/api/employees")"
echo
echo "--- 4. the served figures ---"
curl -s -H "Authorization: Bearer $TOK" "$U/api/employees" > /tmp/emp.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/emp.json'))
rows=d if isinstance(d,list) else d.get('employees',d.get('data',[]))
print('roster rows:', len(rows))
print('firstName sample:', ', '.join(str(r.get('firstName') or r.get('first_name')) for r in rows[:4]))
PY
curl -s -H "Authorization: Bearer $TOK" "$U/api/preboarding/cases" > /tmp/pb.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/pb.json'))
rows=d if isinstance(d,list) else d.get('cases',d.get('data',[]))
print('pre-boarding cases:', len(rows))
states={}
items=0
for c in rows:
    s=c.get('flag') or c.get('flagState') or c.get('status')
    states[s]=states.get(s,0)+1
    its=c.get('items') or []
    items+=len(its)
print('flag states:', states, '| items:', items)
PY
echo
echo "--- 5. port 3000 and the guard ---"
echo "listeners on 3000: $(ss -ltn 2>/dev/null | grep -c ':3000 ')"
ss -ltnp 2>/dev/null | grep ':3000 ' | sed 's/.*users:/owner=/' | cut -c1-80
pgrep -af 'keep-alive.sh' | cut -c1-110
echo "guard script on host: $(md5sum /home/team/shared/keep-alive.sh 2>/dev/null | cut -c1-32) / tree: $(md5sum /home/team/shared/probable-octo-sniffle/scripts/keep-alive.sh | cut -c1-32)"
echo
echo "--- 6. deployed tree ---"
cd /home/team/shared/probable-octo-sniffle
echo "HEAD: $(git rev-parse --short HEAD)  (=origin/main? $(git rev-parse --short origin/main))  dirty files: $(git status --porcelain | wc -l)"
echo
echo "--- 7. test suites at the deployed tree ---"
(cd server && PRODUCT_DB_PATH=/tmp/verify-suite.db node --test 2>&1 | grep -E '^# (tests|suites|pass|fail)')
(cd client && node --test src/*.test.js 2>&1 | grep -E '^# (tests|suites|pass|fail)')
