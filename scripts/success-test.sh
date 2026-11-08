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
#
# GATE-AWARE 2026-11-08. server/public-gate.js answers every page path and every asset under
# client/dist, so a cookieless GET of $B returns the GATE PAGE - status 200, title
# `Antum People - access`, no `assets/index-*.js`. TEST 1's whole subject is the served page and the
# asset it names, so without a credential this run would either fail a product that is serving
# perfectly well or, worse, hash the gate page and report it as our build. The credential comes from
# scripts/gate-cookie.js - the ONE minter, never a signature re-implemented here - and is sent to
# $B's PAGE and ASSET requests only. Every /api probe stays COOKIELESS: /api is passed straight
# through to the app, and the guard's health contract (401 plus its exact body) is only observable
# with no credential in the way. A credential that cannot be minted is NOT a verdict until a page
# proves to be the gate's (see TEST 1): where the gate is off - as on this host today - the page IS
# the product and TEST 1 is judged normally.
set -u
FAILED=0
SKIP_GATE=0
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
# THE GATE CREDENTIAL. Minter: this script's own tree (the repository instrument that ships beside
# it). Gate module: the tree that is SERVING - $D - because that is the module whose title and cookie
# format the URL answers with; if $D predates the gate, this tree's own module is the only one there is.
# The cookie is NEVER printed: it is a 180-day credential. Only the minter's one-line refusal, which
# names the file it looked for, reaches the transcript.
SELF_TREE=$(cd "$(dirname "$0")/.." && pwd)
GATE_TREE="$D"
[ -f "$D/server/public-gate.js" ] || GATE_TREE="$SELF_TREE"
GATE_MINER="$SELF_TREE/scripts/gate-cookie.js"
[ -f "$GATE_MINER" ] || GATE_MINER="$GATE_TREE/scripts/gate-cookie.js"
GATE_COOKIE=""
GATE_MINT_NOTE=""
GATE_ERR=$(mktemp /tmp/st-gate-XXXXXX)
if GATE_COOKIE=$(node "$GATE_MINER" --tree "$GATE_TREE" 2>"$GATE_ERR"); then
  [ -n "$GATE_COOKIE" ] || { GATE_MINT_NOTE="the minter printed nothing"; GATE_COOKIE=""; }
else
  GATE_MINT_NOTE=$(tr '\n' ' ' < "$GATE_ERR" 2>/dev/null | sed 's/  */ /g; s/ $//')
  GATE_COOKIE=""
fi
rm -f "$GATE_ERR"
# The gate page's own title, read from the gate module so the sentence is not duplicated here.
GATE_TITLE=$(node -e 'try{const g=require(process.argv[1]);const m=g.gatePage("").match(/<title>([^<]*)<\/title>/);process.stdout.write(m?m[1]:"")}catch(e){}' \
  "$GATE_TREE/server/public-gate.js" 2>/dev/null)
AUTH=()
[ -n "$GATE_COOKIE" ] && AUTH=(-H "Cookie: $GATE_COOKIE")
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
  if [ -n "$GATE_COOKIE" ]; then
    echo "  gate credential: MINTED by $GATE_MINER --tree $GATE_TREE"
    echo "                   sent to $B's page and asset requests ONLY; every /api probe below is cookieless"
  else
    echo "  gate credential: NONE - ${GATE_MINT_NOTE:-scripts/gate-cookie.js exited non-zero}"
  fi
  code=$(g -o /tmp/st-page -w '%{http_code}' --max-time 25 "${AUTH[@]}" "$B/")
  TITLE=$(sed -n 's/.*<title>\(.*\)<\/title>.*/\1/p' /tmp/st-page 2>/dev/null | head -1)
  echo "  GET / -> $code  ($(wc -c < /tmp/st-page) B)  title: ${TITLE:-<none>}"
  # IS THIS THE GATE PAGE? Without a credential it means nothing about the product was observable from
  # here: SKIP-FLAGGED, naming the file the minter looked for - never a FAIL, and never an OK. With a
  # credential in hand a gate page means the credential was refused, and that IS a failure.
  asset=""
  if [ -n "$GATE_TITLE" ] && [ "$TITLE" = "$GATE_TITLE" ]; then
    if [ -z "$GATE_COOKIE" ]; then
      SKIP_GATE=1
      echo "  SKIP-FLAGGED  the URL answered the PUBLIC GATE's page (title: $TITLE), not the product"
      echo "                no gate credential: ${GATE_MINT_NOTE:-scripts/gate-cookie.js exited non-zero}"
      echo "                NOT JUDGED: the served page, the asset it names, and the served==deployed bytes."
      echo "                This is NOT a product failure - the gate answering is not the product failing."
    else
      FAILED=1
      echo "  *** WITH a credential in hand the GATE's page still answered (title: $TITLE). The minted"
      echo "      credential was refused: the gate secret read here is not the one the gate verifies."
    fi
  fi
  [ "$SKIP_GATE" = "0" ] && asset=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' /tmp/st-page | head -1)
  echo "  HTML names: ${asset:-NONE FOUND}"
  if [ "$SKIP_GATE" = "0" ] && [ -z "$asset" ]; then
    # A 200 document that names no bundle is not our product: it is a placeholder, an SPA shell
    # served in place of a missing asset, or somebody else's page. Until 2026-11-08 this branch
    # printed NONE FOUND and carried on with FAILED=0 - TEST 1 could be green having judged nothing.
    FAILED=1
    echo "  *** the served document names NO assets/index-*.js. TEST 1's subject is absent: this is"
    echo "      not a built product answering (a placeholder or a shell answers 200 too)."
  fi
  if [ -n "$asset" ]; then
    g -o /tmp/st-asset -w '  asset fetched: %{http_code}, %{size_download} B\n' --max-time 30 "${AUTH[@]}" "$B/$asset"
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
  if [ "$FAILED" != "0" ]; then
    echo "RESULT: FAILED — see the CONTROL line above. The gated readings in this file are not readings."
  elif [ "$SKIP_GATE" != "0" ]; then
    echo "RESULT: SKIP-FLAGGED — TEST 1 was NOT judged: the URL answered the gate's page and no gate"
    echo "        credential could be minted (${GATE_MINT_NOTE:-scripts/gate-cookie.js exited non-zero})."
    echo "        TESTs 2-4 and SURVIVAL were measured; the served page, the asset it names and the"
    echo "        served==deployed bytes were not. Not OK, and not a product failure."
  else
    echo "RESULT: OK — the control read 200; TEST 3's gate pair read as the gate runs."
  fi
} > "$OUT" 2>&1
unset TOK_TOK TOK 2>/dev/null
if [ "$FAILED" != "0" ]; then
  echo "wrote $OUT  — RESULT: FAILED (exit 1)"
  exit 1
fi
if [ "$SKIP_GATE" != "0" ]; then
  # exit 3, the team's third code: nothing behind the gate was measured. check-all's --live row
  # declares absent_exit=3 for this, so it prints SKIP-FLAGGED and never OK.
  echo "wrote $OUT  — RESULT: SKIP-FLAGGED (exit 3: TEST 1 not judged, no gate credential)"
  exit 3
fi
echo "wrote $OUT"

