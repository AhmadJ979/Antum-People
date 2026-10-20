#!/bin/bash
# Independent live verification of the 16:08:51Z movement (58acdac). Read-only: no kill, no arm,
# no restart. Everything here is measured from outside the deploy script's own step 5.
set -u
export HOME=/home/agent-lead
TREE=/home/team/shared/probable-octo-sniffle
D=/home/team/shared/movements/2026-10-20T1607Z
OUT="$D/verify-live.out"
PUB=https://b974147c03228029e277d1cbe6646fe6.ctonew.app
# The stated after-state, carried from the tip whose build is measured (2b14a94, client/ identical).
WANT_JS=index-C9vf7pQB.js;   WANT_JS_MD5=e6ff5da3fd614ddcfe2c0beaa68164f4; WANT_JS_B=277790
WANT_CSS=index-BK_EwcpZ.css; WANT_CSS_MD5=cb54e6164a8e741ed807bac94577efcd; WANT_CSS_B=35306
: > "$OUT"
say() { echo "$*" | tee -a "$OUT"; }
p() { printf '  %-58s %s\n' "$1" "$2" | tee -a "$OUT"; }

say "=== 1. what the public URL serves (the PAIR: our bundle AND our listener) ==="
code=$(curl -s -o /tmp/vl.html -w '%{http_code}' --noproxy '*' --max-time 15 "$PUB")
say "  status $code | $(grep -o '<title>[^<]*</title>' /tmp/vl.html 2>/dev/null)"
JS=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' /tmp/vl.html | head -1)
CSS=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.css' /tmp/vl.html | head -1)
p "HTML names" "$JS / $CSS"
curl -s --noproxy '*' --max-time 20 "$PUB/$JS" -o /tmp/vl.js 2>/dev/null
curl -s --noproxy '*' --max-time 20 "$PUB/$CSS" -o /tmp/vl.css 2>/dev/null
JSMD5=$(md5sum /tmp/vl.js 2>/dev/null | cut -d' ' -f1); JSB=$(stat -c%s /tmp/vl.js 2>/dev/null)
CSSMD5=$(md5sum /tmp/vl.css 2>/dev/null | cut -d' ' -f1); CSSB=$(stat -c%s /tmp/vl.css 2>/dev/null)
p "served js  md5/size" "$JSMD5 $JSB B   [stated $WANT_JS_MD5 $WANT_JS_B B]"
p "served css md5/size" "$CSSMD5 $CSSB B   [stated $WANT_CSS_MD5 $WANT_CSS_B B]"
[ "$JSMD5" = "$WANT_JS_MD5" ] && say "  MATCH: the served bundle is the stated after-state" || say "  MISMATCH: served js differs from the stated after-state"
[ "$CSSMD5" = "$WANT_CSS_MD5" ] && say "  MATCH: the served stylesheet is the stated after-state" || say "  MISMATCH: served css differs"
p "deployed dist js md5 (built this movement)" "$(md5sum $TREE/client/dist/assets/$JS 2>/dev/null | cut -d' ' -f1)"
p "deployed dist css md5" "$(md5sum $TREE/client/dist/assets/$CSS 2>/dev/null | cut -d' ' -f1)"

say "=== 2. the listener on 3000 is OURS (a 200 alone is what the placeholder returns) ==="
LP=$(lsof -t -i :3000 -sTCP:LISTEN 2>/dev/null | sort -u | head -1)
p "listener pid" "${LP:-none}"
p "cmdline" "$(tr '\0' ' ' < /proc/${LP:-0}/cmdline 2>/dev/null)"
p "cwd" "$(readlink -f /proc/${LP:-0}/cwd 2>/dev/null)"

say "=== 3. the auth contract ==="
p "GET /api/employees, no token" "$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' --max-time 10 http://127.0.0.1:3000/api/employees) (expect 401)"
PW=$(cat /home/team/shared/.demo-admin-password 2>/dev/null)
p "POST /api/login bad password" "$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' -X POST -H 'Content-Type: application/json' --data-binary '{"username":"admin","password":"definitely-wrong"}' --max-time 10 http://127.0.0.1:3000/api/login) (expect 401)"
TOK=$(curl -s --noproxy '*' --max-time 10 -X POST -H 'Content-Type: application/json' --data-binary "{\"username\":\"admin\",\"password\":\"$PW\"}" http://127.0.0.1:3000/api/login | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
p "good login, token chars" "${#TOK} (expect >100)"
p "roster with token" "$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' -H "Authorization: Bearer $TOK" --max-time 10 http://127.0.0.1:3000/api/employees) (expect 200)"

say "=== 4. the guard (role, not string) ==="
GP=$(head -n1 "$TREE/server/keep-alive.lock" 2>/dev/null | tr -d '[:space:]')
p "lock names" "$GP"
p "its argv" "$(tr '\0' ' ' < /proc/${GP:-0}/cmdline 2>/dev/null)"
p "lock holders (lsof)" "$(lsof -t "$TREE/server/keep-alive.lock" 2>/dev/null | sort -u | tr '\n' ' ')"

say "=== 5. the tree we serve ==="
p "HEAD" "$(git -C $TREE rev-parse --short HEAD) $(git -C $TREE log -1 --format=%s)"
p "remote main" "$(GIT_TERMINAL_PROMPT=0 git -C $TREE ls-remote origin refs/heads/main 2>/dev/null | cut -c1-12)"
p "working tree" "$(git -C $TREE status --porcelain | wc -l | tr -d ' ') modified paths (expect 0)"

say "=== 6. the two retired routes still answer 404 ==="
for r in "/api/employees/demo-emp-omar" "/api/compliance/report"; do
    p "GET $r" "$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' -H "Authorization: Bearer $TOK" --max-time 10 "http://127.0.0.1:3000$r")"
done
say "DONE"
