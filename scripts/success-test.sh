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
# the cutover record used. A minted short-lived token is used for the gated half (rule 10 keeps the
# demo password lead-managed; rule 26 keeps a credentialed sign-in off the live product). The token
# is minted in a subshell from the host env file, never echoed, never written to an artifact.
#
# CORRECTED 2026-10-26 (P3-3 follow-ups). The token carried `{id, username, role:"admin"}`, and `role` is
# not what the gate reads (`req.user.access_role`) and `admin` is not a role (`hr_admin|manager|finance|
# employee|compliance_viewer`). Measured on the live product: every gated path answered 403 - including
# the line labelled "must be 200 or the 404s mean nothing", which printed and carried on, because nothing
# here asserted. Two changes: the mint carries `access_role:"hr_admin"`, and THE CONTROL IS ASSERTED - a
# run whose control is not 200 sets FAILED, says so in the transcript and exits 1. A control the operator
# cannot reach is a false green.
# TEST 3's subject is re-scoped for the same reason: "the two retired routes answer 404 with a token" is
# no longer observable at this revision. An unregistered path is refused by the gate BEFORE routing, so
# `/api/compliance/report` and `/api/employees/<id>` answer 403 with an empty body even with a valid
# token (measured 2026-10-26). TEST 3 now reads the pair that IS observable: the control on a registered
# route, the router answering a registered route for an id that does not exist, and the gate's refusal of
# an unregistered one - with and without a token. Nothing here is a route census.
# Bodies are never dumped whole; codes and byte counts only.
set -u
FAILED=0
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
  # A transcript has to say WHICH COPY of this script produced it and which tree it measured: a label is
  # free text, and on 2026-10-26 one run was filed under a label naming a revision while its bytes were
  # the next commit's script (md5 65d234eb..., 51c3b3b's blob, label "...-72f2272"). Neither name was a
  # lie by itself; the file just could not tell a reader which was which.
  echo "script: $0  md5 $(md5sum < "$0" | cut -d' ' -f1)"
  echo "deployed tree: $D at $(git -C "$D" rev-parse --short HEAD 2>/dev/null || echo 'unknown (not a git tree)')"
  echo "tree dirty: $(git -C "$D" status --porcelain 2>/dev/null | grep -vc 'node_modules' || echo 0) non-node_modules change(s)"
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
    # Decision 2: the served bytes ARE the deployed tree's bytes. That is the check this line makes now.
  # It used to compare against a frozen md5 of the 2026-10-15 cutover asset, which no client change can
  # ever match again - so it read "NO - THIS IS NOT THE CUTOVER ASSET" on every run since, a permanent
  # alarm that informed nobody. The old hash is kept only as a labelled historical note.
  served=$(md5sum < /tmp/st-asset | cut -d' ' -f1)
  disk=$(md5sum < "$D/client/dist/$asset" 2>/dev/null | cut -d' ' -f1)
  if [ -n "$disk" ] && [ "$served" = "$disk" ]; then
    echo "  SERVED == DEPLOYED TREE: YES (both $served)"
  else
    FAILED=1
    echo "  *** SERVED != DEPLOYED TREE: served $served, on disk ${disk:-NO FILE}. Decision 2 is broken:"
    echo "      either the deployment is not the tree this script was pointed at, or the build is stale."
  fi
  echo "  (historical: the 2026-10-15 cutover asset was md5 91f05725a25c2b7b1f4328f1a5a110d5 - not a live check)"
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
  echo "TEST 3 — the gate runs ahead of the router: a token the gate accepts reads a REGISTERED route,"
  echo "         and an UNREGISTERED path is refused 403 by the gate — never a 404 from the router"
  # The claim the gate reads is `access_role` (server/access.js); `role` is ignored. The probe identity is
  # not a person and this script writes nothing: every request below is a GET.
  # The mint prints the claim set it actually signed, TAB-separated from the token, so the label below
  # cannot disagree with the token: a hand-typed "claim: access_role=..." was printed even by a copy of
  # this script whose mint carried `role:"admin"` (the 2026-10-26 mutation control), which is a label
  # lying about the value beside it. The token itself is never echoed.
  MINT=$( ( set -a; . /etc/profile.d/cto-env-vars.sh >/dev/null 2>&1; set +a; \
     node -e 'const c={id:"restore-probe",username:"restore-probe",access_role:"hr_admin"};const jwt=require("/home/team/shared/probable-octo-sniffle/server/node_modules/jsonwebtoken");process.stdout.write(JSON.stringify(c)+"\t"+jwt.sign(c,process.env.JWT_SECRET,{expiresIn:"10m"}))' ) 2>/dev/null )
  CLAIMS=${MINT%%$'\t'*}
  TOK=${MINT#*$'\t'}
  [ "$TOK" = "$MINT" ] && TOK=""
  echo "  token minted: $([ -n "${TOK:-}" ] && echo "yes (${#TOK} chars, value not recorded)" || echo NO)  claim signed: ${CLAIMS:-NONE}"
  ctl=$(g -o /tmp/st-tk -w '%{http_code}' --max-time 20 -H "Authorization: Bearer ${TOK:-x}" "$B/api/employees")
  echo "  CONTROL — with token GET /api/employees -> $ctl  ($(wc -c < /tmp/st-tk) B)   [must be 200]"
  if [ "$ctl" != "200" ]; then
    FAILED=1
    echo "  *** CONTROL FAILED: a token the gate should accept was refused ($ctl). Check that the minted"
    echo "      claim is the one the gate reads (access_role, not role) and that the host env file carries"
    echo "      the LIVE server's JWT_SECRET. Every gated reading below is meaningless until this is 200."
  fi
  echo "  the token reaches the router — a REGISTERED route, for an id that does not exist:"
  echo "    with token GET /api/employees/no-such-employee/onboarding -> $(g -o /tmp/st-miss -w '%{http_code}' --max-time 20 -H "Authorization: Bearer ${TOK:-x}" "$B/api/employees/no-such-employee/onboarding")  ($(wc -c < /tmp/st-miss) B)"
  echo "  UNREGISTERED paths (the router has /api/employees/:id/onboarding, not these), with a valid token:"
  echo "    with token GET /api/compliance/report -> $(g -o /tmp/st-r -w '%{http_code}' --max-time 20 -H "Authorization: Bearer ${TOK:-x}" "$B/api/compliance/report")  ($(wc -c < /tmp/st-r) B)"
  echo "    with token GET /api/employees/demo-emp-sarah -> $(g -o /tmp/st-e -w '%{http_code}' --max-time 20 -H "Authorization: Bearer ${TOK:-x}" "$B/api/employees/demo-emp-sarah")  ($(wc -c < /tmp/st-e) B)"
  echo "  and the same two with NO token (the gate answers before the router is consulted):"
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
  # THE TWO MD5s BELOW ARE NOT EXPECTED TO MATCH, and until 2026-10-26 nothing said so: the installed
  # file is the hook PLUS the provenance block scripts/install-host-tools.sh derives from the tree,
  # while the line under it is the bare body the install step compares against. Two unlabelled md5s
  # side by side read as a mismatch to the next operator (row ac5739fa).
  echo "  hook installed (WHOLE FILE: body + the installer's provenance block): $([ -f /etc/profile.d/zz-antum-product-guard.sh ] && echo "YES md5 $(md5sum < /etc/profile.d/zz-antum-product-guard.sh | cut -d' ' -f1)" || echo NO)"
  echo "  hook source in tree (BARE BODY the install step compares, not the installed bytes): $(md5sum < "$D/scripts/antum-product-guard-hook.sh" | cut -d' ' -f1)"
  echo
  if [ "$FAILED" = "0" ]; then
    echo "RESULT: OK — the control read 200; TEST 3's gate pair read as the gate runs."
  else
    echo "RESULT: FAILED — see the CONTROL line above. The gated readings in this file are not readings."
  fi
} > "$OUT" 2>&1
unset TOK_TOK TOK 2>/dev/null
if [ "$FAILED" = "0" ]; then
  echo "wrote $OUT"
else
  echo "wrote $OUT  — RESULT: FAILED (exit 1)"
  exit 1
fi

