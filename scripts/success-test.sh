#!/bin/bash
# success-test.sh LABEL — the cutover's four success tests, re-run against whatever is serving now.
#
# VERSIONED 2026-10-17 from the host copy, which was NOT in the repository while being the proof every
# restore cited. It filed its transcript into /home/team/shared/cutover-2026-10-14 whatever the date:
# a proof of a later event sitting in the 15th's folder under a false label. The evidence directory is
# now DERIVED from the run — /home/team/shared/cutover-<today UTC> — and ANTUM_EVIDENCE_DIR overrides
# it, so a run can be told where to file but is never told a lie about when it ran.
#
# PROVENANCE GOES UNDER THE SHEBANG, NOT ABOVE IT: the host copy had three note lines above #!/bin/bash,
# so a direct ./success-test.sh fell back to /bin/sh and died on "set -u"'s neighbours. bash x.sh hid it.
## success-test.sh LABEL — the cutover's four success tests, re-run after the 2026-10-15 restore.
#
# Same tests as 2026-10-14 16:18, with one deliberate change: measured on the PUBLIC URL (what a
# client reaches) rather than on 127.0.0.1:3000, plus the listener-identity and served-asset checks
# the cutover record used. A minted short-lived token is used for the 404 half (rule 10 keeps the
# demo password lead-managed; rule 26 keeps a credentialed sign-in off the live product). The token
# is minted in a subshell from the host env file, never echoed, never written to an artifact.
# Bodies are never dumped whole; codes and byte counts only.
set -u
L="${1:-unlabelled}"
E="${ANTUM_EVIDENCE_DIR:-/home/team/shared/cutover-$(date -u +%Y-%m-%d)}"
D="${ANTUM_DEPLOY_DIR:-/home/team/shared/probable-octo-sniffle}"
S=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$E/success-test-$L-$S.txt"
B="${ANTUM_PUBLIC:-https://b974147c03228029e277d1cbe6646fe6.ctonew.app}"
# A function, not a string: `CURL="curl -s --noproxy *"` expands the * as a glob when the variable
# is used unquoted, and curl then receives the directory listing as arguments (run 08:11 produced a
# page of zeros and a proxy's 301). One bad run, discarded, not filed.
g() { curl -s --noproxy '*' "$@"; }
mkdir -p "$E"
{
  echo "=== success test: $L ==="
  echo "taken: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "TEST 1 — the served HTML names OUR asset, with its measured size and md5"
  code=$(g -o /tmp/st-page -w '%{http_code}' --max-time 25 "$B/")
  echo "  GET / -> $code  ($(wc -c < /tmp/st-page) B)  $(grep -o '<title>[^<]*</title>' /tmp/st-page | head -1)"
  asset=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' /tmp/st-page | head -1)
  echo "  HTML names: ${asset:-NONE FOUND}"
  if [ -n "$asset" ]; then
    g -o /tmp/st-asset -w '  asset fetched: %{http_code}, %{size_download} B\n' --max-time 30 "$B/$asset"
    echo "  asset md5: $(md5sum < /tmp/st-asset | cut -d' ' -f1)"
    echo "  on-disk bundle: $(wc -c < "$D/client/dist/$asset" 2>/dev/null) B  md5 $(md5sum < "$D/client/dist/$asset" 2>/dev/null | cut -d' ' -f1)"
    echo "  SAME BYTES AS THE CUTOVER: $([ "$(md5sum < /tmp/st-asset | cut -d' ' -f1)" = "91f05725a25c2b7b1f4328f1a5a110d5" ] && echo YES || echo 'NO — THIS IS NOT THE CUTOVER ASSET')"
  fi
  echo
  echo "TEST 2 — the listener on port 3000 is OURS (not the platform's placeholder)"
  # Both tables: the placeholder dev server bound IPv6-only (*:3000 in /proc/net/tcp6) while our
  # node server binds IPv4 — reading one table answered "inode: none" for a port that was listening.
  INODE=$(awk 'NR>1{split($2,a,":"); if (a[2]=="0BB8" && $4=="0A") {print $10; exit}}' /proc/net/tcp6)
  FAM=v6
  [ -z "$INODE" ] && { INODE=$(awk 'NR>1{split($2,a,":"); if (a[2]=="0BB8" && $4=="0A") {print $10; exit}}' /proc/net/tcp); FAM=v4; }
  echo "  listening inode: ${INODE:-none} (from /proc/net/tcp$FAM)"
  LPID=""
  for p in /proc/[0-9]*; do
    for fd in "$p"/fd/*; do
      if [ "$(readlink "$fd" 2>/dev/null)" = "socket:[$INODE]" ]; then LPID=$(basename "$p"); break 2; fi
    done
  done
  echo "  holder pid: ${LPID:-none}"
  if [ -n "$LPID" ]; then
    echo "  cmdline: $(tr '\0' ' ' < /proc/$LPID/cmdline)"
    echo "  cwd: $(readlink /proc/$LPID/cwd)"
    echo "  started: $(ps -o lstart= -p $LPID)"
  fi
  echo
  echo "TEST 3 — the two retired routes answer 404 WITH a token (401 without one proves nothing)"
  TOK=$( ( set -a; . /etc/profile.d/cto-env-vars.sh >/dev/null 2>&1; set +a; \
     node -e 'const jwt=require("/home/team/shared/probable-octo-sniffle/server/node_modules/jsonwebtoken");process.stdout.write(jwt.sign({id:"restore-probe",username:"restore-probe",role:"admin"},process.env.JWT_SECRET,{expiresIn:"10m"}))' ) 2>/dev/null )
  echo "  token minted: $([ -n "${TOK:-}" ] && echo "yes (${#TOK} chars, value not recorded)" || echo NO)"
  echo "  positive control (must be 200 or the 404s mean nothing):"
  echo "    with token GET /api/employees -> $(g -o /tmp/st-tk -w '%{http_code}' --max-time 20 -H "Authorization: Bearer ${TOK:-x}" "$B/api/employees")  ($(wc -c < /tmp/st-tk) B)"
  echo "    with token GET /api/analytics/dashboard -> $(g -o /tmp/st-tk2 -w '%{http_code}' --max-time 20 -H "Authorization: Bearer ${TOK:-x}" "$B/api/analytics/dashboard")  ($(wc -c < /tmp/st-tk2) B)"
  echo "  the retired routes:"
  echo "    with token GET /api/compliance/report -> $(g -o /tmp/st-r -w '%{http_code}' --max-time 20 -H "Authorization: Bearer ${TOK:-x}" "$B/api/compliance/report")  ($(wc -c < /tmp/st-r) B)"
  echo "    with token GET /api/employees/demo-emp-sarah -> $(g -o /tmp/st-e -w '%{http_code}' --max-time 20 -H "Authorization: Bearer ${TOK:-x}" "$B/api/employees/demo-emp-sarah")  ($(wc -c < /tmp/st-e) B)"
  echo "  beside them, with NO token (the auth gate runs ahead of routing):"
  echo "    no token GET /api/compliance/report -> $(g -o /dev/null -w '%{http_code}' --max-time 15 "$B/api/compliance/report")"
  echo "    no token GET /api/employees/demo-emp-sarah -> $(g -o /dev/null -w '%{http_code}' --max-time 15 "$B/api/employees/demo-emp-sarah")"
  echo
  echo "TEST 4 — the notice still serves, and a gated route still refuses without a token"
  c=$(g -o /tmp/st-notice -w '%{http_code}' --max-time 20 -H "Authorization: Bearer ${TOK:-x}" "$B/api/compliance/notice")
  echo "  with token GET /api/compliance/notice -> $c ($(wc -c < /tmp/st-notice) B)"
  echo "    version: $(python3 -c "import json;print(json.load(open('/tmp/st-notice')).get('version'))" 2>/dev/null)"
  echo "    content md5: $(python3 -c "import json;print(__import__('hashlib').md5((json.load(open('/tmp/st-notice')).get('content') or '').encode()).hexdigest())" 2>/dev/null)"
  echo "  no token GET /api/employees -> $(g -o /dev/null -w '%{http_code}' --max-time 15 "$B/api/employees")  (expect 401)"
  echo "  no token GET /api/compliance/notice -> $(g -o /dev/null -w '%{http_code}' --max-time 15 "$B/api/compliance/notice")  (expect 401)"
  echo
  echo "SURVIVAL — the guard and the hook, read from their own evidence"
  echo "  guard pids (scripts/keep-alive.sh): $(pgrep -f 'scripts/keep-alive[.]sh' | tr '\n' ' ')"
  echo "  lock file holds: $(cat "$D/server/keep-alive.lock" 2>/dev/null | head -1) (pid named by the guard itself)"
  echo "  /proc check: $(for p in $(pgrep -f 'scripts/keep-alive[.]sh'); do echo "pid $p -> $(tr '\0' ' ' < /proc/$p/cmdline)"; done)"
  echo "  hook installed: $([ -f /etc/profile.d/zz-antum-product-guard.sh ] && echo "YES md5 $(md5sum < /etc/profile.d/zz-antum-product-guard.sh | cut -d' ' -f1)" || echo NO)"
  echo "  hook source in tree: $(md5sum < "$D/scripts/antum-product-guard-hook.sh" | cut -d' ' -f1)"
} > "$OUT" 2>&1
unset TOK_TOK TOK 2>/dev/null
echo "wrote $OUT"

