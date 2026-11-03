#!/bin/bash
# Antum People — the deploy path: move the live product to current origin/main, or restart it only.
#
#   bash scripts/deploy-main.sh                  full movement: fetch/reset -> build -> re-seed -> restart
#                                                -> verify -> guard -> hook
#   bash scripts/deploy-main.sh --restart-only   steps 4, 6 and 6b only: restart, re-arm the guard,
#                                                install the login-shell hook. No fetch, no reset, no
#                                                build, no re-seed — it cannot change which commit is
#                                                served.
#   bash scripts/deploy-main.sh --preflight      the AUTHENTICATION PREFLIGHT alone: read the credential
#                                                file, log in, make one authenticated read, print the
#                                                counts, exit. No git, no build, no restart, no DB write
#                                                — which is what makes the preflight provable without a
#                                                cutover. ANTUM_PW_FILE points it at another credential.
#
# EXIT CODES: 0 the run's own verdict · 1 a judged red (build, seed, settlement, served bytes) ·
#             2 usage · 3 AUTHENTICATION: the harness could not prove it is entitled to judge, so it
#             judged nothing · 4 CANNOT-JUDGE: a response was not the shape the check needs.
#
# VERSIONED 2026-10-17 from /home/team/shared/deploy-main.sh (278 lines, md5 342b791f…), which had been
# host state: a path that moves the product, reviewable by nobody, with no history and no conflict
# detection. Same defect class as the hook and the recovery script, fixed the same way. Nothing in this
# file is a secret: the demo credential is read from $PW_FILE and the JWT/encryption keys come from the
# host env file, both named at the point of use.
#
# ORDER MATTERS: build and verify BEFORE the restart, so a broken build never replaces a working site.
#
# WHAT IT REFUSES, and why each refusal exists (all of them are things that failed here):
#   - no deployed tree, or a tree whose content check fails -> stop before touching the running product
#   - `--restart-only` with NO bundle in client/dist -> refuse and point at the full path: a restart
#     cannot restore the shipped bytes if there is nothing on disk to serve
#   - missing JWT_SECRET / ENCRYPTION_KEY -> refuse before starting a server that would answer 500s
#   - a listener on the port that is not ours -> evict and re-bind in the same window, never assume
#   - `--restart-only` never asserts a remembered bundle hash: it fetches the asset the public HTML
#     names and compares it with the file on disk, both measured at run time
#   - the credential file missing, empty or unreadable -> refuse BEFORE the product is touched: no
#     probe in step 5 can be judged without it, and taking the site down to discover that is backwards
#   - a login that yields no usable token, or a token that an authenticated read REJECTS -> abort as an
#     AUTHENTICATION failure (exit 3) before ANY verification runs. WHY (measured 2026-11-02): a stale
#     credential file (33 chars, the real one 20) made every step-5 probe run with an empty token; the
#     roster answered 401, three inline python blocks printed tracebacks on the 401 body, and the run's
#     own verdict line read "RED VERIFICATION (settlement check rc=2)" — naming the settlement check,
#     whose logic was correct and was being handed an error payload. A harness that names the wrong
#     subsystem is worse than no verification, so the entitlement to judge is now proved first.
#   - a response body that is not the shape a check needs -> "CANNOT-JUDGE: <what it was> (<status>)"
#     and exit 4, never a python traceback: a stack trace in the evidence file is the harness
#     confessing it did not understand its own input
#
# EVERY HOST VALUE IS AN OVERRIDE: the defaults below are this host's, and each can be replaced by an
# ANTUM_* variable so the script can be exercised off the live tree (WORKFLOW rule 14).
set -uo pipefail

DEPLOY_DIR="${ANTUM_DEPLOY_DIR:-/home/team/shared/probable-octo-sniffle}"
PUBLIC="${ANTUM_PUBLIC:-https://b974147c03228029e277d1cbe6646fe6.ctonew.app}"
PRODUCT_DB="${ANTUM_PRODUCT_DB:-/home/team/.data/antum-product.db}"
PW_FILE="${ANTUM_PW_FILE:-/home/team/shared/.demo-admin-password}"
PORT="${ANTUM_PORT:-3000}"
ENVFILE="${ANTUM_ENV_FILE:-/etc/profile.d/cto-env-vars.sh}"
HOOK_DST="${ANTUM_HOOK_DST:-/etc/profile.d/zz-antum-product-guard.sh}"

# --- the mode ----------------------------------------------------------------------
RESTART_ONLY=0
PREFLIGHT=0
case "${1:-}" in
  "")            : ;;
  --restart-only) RESTART_ONLY=1 ;;
  --preflight)   PREFLIGHT=1 ;;
  # The help prints the header block, ending at the first line of code. It used to be a fixed
  # `sed -n '2,32p'`, which two things broke: editing the header silently truncated the help, and
  # install-host-tools.sh inserts a provenance block after the shebang, so on the HOST copy the fixed
  # range printed the provenance and cut the last bullets off. Anchor it on the code, not on a number.
  -h|--help)     awk 'NR>1 && /^set -uo pipefail/{exit} NR>1' "$0"; exit 0 ;;
  *)             echo "unknown argument: $1 (use --preflight, --restart-only, or no argument for a full movement)"; exit 2 ;;
esac
# Run-stamped evidence paths. These were FIXED names until 2026-10-09, so every run silently
# destroyed the previous run's evidence: the 13:46 run overwrote the 10:46 run's three files,
# and the 10:46 record's /tmp citations then resolved to the LATER run's output — a false
# artifact filed under the earlier record's names. Never reuse a fixed evidence path across runs.
STAMP=$(date -u +%Y%m%d-%H%M%S)
if [ "$PREFLIGHT" -eq 1 ]; then
  OUT="/tmp/preflight-$STAMP-evidence.txt"
else
  OUT="/tmp/cutover-$STAMP-evidence.txt"
fi
BUILD_LOG="/tmp/cutover-$STAMP-build.log"
SEED_LOG="/tmp/cutover-$STAMP-seed.log"

exec > >(tee "$OUT") 2>&1
if [ "$PREFLIGHT" -eq 1 ]; then
  MODE_NAME="authentication preflight"
elif [ "$RESTART_ONLY" -eq 1 ]; then
  MODE_NAME="restart-only recovery"
else
  MODE_NAME="cutover"
fi
echo "=== $MODE_NAME $(date -Iseconds) ==="
echo "  script: $0 | $(stat -c %s "$0" 2>/dev/null) B | sha256 $(sha256sum "$0" 2>/dev/null | cut -c1-16)"
if [ "$PREFLIGHT" -eq 1 ]; then
  # The tree is deliberately NOT used by --preflight, and saying so beats printing a path a reader
  # would take to be the thing being measured: this mode measures the credential and the running
  # product, nothing on disk.
  echo "  tree:   (not used by --preflight — no git, no build, no dist)   port: $PORT   mode: $MODE_NAME"
else
  echo "  tree:   $DEPLOY_DIR   port: $PORT   mode: $MODE_NAME"
fi

# ===================================================================================================
# THE AUTHENTICATION PREFLIGHT — the entitlement to judge, established before any judgment
# ===================================================================================================
# WHY THIS EXISTS (measured 2026-11-02, not imagined). A --restart-only movement ran with
# /home/team/shared/.demo-admin-password holding a stale 33-character password while the real one was
# 20 characters. The login answered 401, so TOK was empty; every step-5 probe ran unauthenticated; the
# roster answered 401; three inline python blocks hit json.load on the 401 body and printed tracebacks;
# the settlement check was handed an error payload, correctly returned rc=2 (CANNOT-JUDGE), and the
# run's own verdict line read "RED VERIFICATION (settlement check rc=2)". The settlement logic was
# fine. The harness blamed a subsystem that was never at fault, and the tracebacks were it confessing
# it did not understand its own input.
#
# So: nothing in step 5 may run until this has passed. Three things are asserted, in order, and each
# failure names AUTHENTICATION as the cause, prints a character COUNT (never the value) and the file
# it came from, and exits 3:
#   1. the credential file exists, is readable and is not empty;
#   2. the login yields a token of the expected shape (>100 characters);
#   3. an authenticated read accepts that token — because a token of the right length is not proof
#      that it works. A 401 on that read is an authentication failure and NOTHING else.
PW_CHARS=0
PW_VALUE=""
AUTH_STAGE="preflight"

auth_fail() { # $1 = the cause, in one line. Never prints the credential, never prints its value.
  echo ""
  echo "FAIL (AUTHENTICATION): $1"
  echo "  credential file: $PW_FILE"
  echo "  characters read: $PW_CHARS   (the value is never printed, here or in the evidence log)"
  echo "  what this means: the harness could not prove it is entitled to judge, so it judged NOTHING."
  echo "                   No settlement, roster, pre-boarding, offboarding or consent check ran, and"
  echo "                   none of them is implicated: this is a credential problem, not a data one."
  case "$AUTH_STAGE" in
    preflight)    echo "  what was done:   nothing — --preflight does no git, build, restart or DB write." ;;
    early)        echo "  what was done:   nothing — the run stopped before touching the product: no fetch, no build, no restart, no re-seed." ;;
    post-restart) echo "  what was done:   step 4 restarted the product; step 6 (re-arm) and 6b (hook) were NOT reached, so the guard already running is still in charge." ;;
  esac
  echo "  fix:             relay the current demo password into that file by hand, then re-run."
  echo "                   Check it without touching the product: bash $0 --preflight"
  echo "  log:             $OUT"
  exit 3
}

cannot_judge() { # $1 = what could not be judged. Exit 4: a run that judged nothing is not a pass.
  echo ""
  echo "CANNOT-JUDGE: $1"
  echo "  the harness could not read what this check needs, so it judged nothing here — and it says"
  echo "  so instead of reporting the shape of its own confusion as a verdict about the product."
  echo "  log: $OUT"
  exit 4
}

read_credential() {
  PW_CHARS=0
  PW_VALUE=""
  [ -f "$PW_FILE" ] || auth_fail "the credential file does not exist"
  [ -r "$PW_FILE" ] || auth_fail "the credential file is not readable"
  PW_VALUE="$(cat "$PW_FILE" 2>/dev/null)" || auth_fail "the credential file could not be read"
  PW_CHARS=${#PW_VALUE}
  [ "$PW_CHARS" -gt 0 ] || auth_fail "the credential file is empty (0 characters read)"
}

authenticate() { # $1 = the stage auth_fail reports
  AUTH_STAGE="${1:-preflight}"
  echo "--- authentication preflight ($AUTH_STAGE) ---"
  read_credential
  echo "  credential: $PW_CHARS character(s) read from $PW_FILE (the value is never printed)"

  LOGIN_BODY=$(mktemp /tmp/antum-login-XXXXXX.json) || cannot_judge "a scratch file for the login response"
  LOGIN_CODE=$(curl -s --noproxy '*' --max-time 25 -o "$LOGIN_BODY" -w '%{http_code}' \
    -X POST -H 'Content-Type: application/json' \
    --data-binary "{\"username\":\"admin\",\"password\":\"$PW_VALUE\"}" "$PUBLIC/api/login")
  case "$LOGIN_CODE" in
    200)     : ;;
    000|"")  auth_fail "the login endpoint could not be reached (no HTTP status from $PUBLIC/api/login)" ;;
    *)       auth_fail "the login endpoint refused the credential (HTTP $LOGIN_CODE from $PUBLIC/api/login)" ;;
  esac
  # Tolerant of whitespace around the colon on purpose: the product's `res.json` emits compact JSON,
  # but a token extractor that silently yields "" when it is handed `"token": "..."` would turn a
  # perfectly good login into the very failure this preflight is meant to distinguish. It fails LOUD
  # (the length assertion below) rather than quietly proceeding with an empty token.
  TOK=$(sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$LOGIN_BODY" | head -1)
  TOK_CHARS=${#TOK}
  echo "  login:      HTTP 200, token $TOK_CHARS character(s) (expect >100)"
  [ "$TOK_CHARS" -gt 100 ] || auth_fail "the login answered HTTP 200 but yielded no usable token ($TOK_CHARS characters, expected >100): the credential did not become a session"

  # PROVE the token works. This is the read step 5 reports on, so the proof and the reported count are
  # the same measurement — there is no second, unproven read to disagree with it.
  ROSTER_BODY=$(mktemp /tmp/antum-roster-XXXXXX.json) || cannot_judge "a scratch file for the roster response"
  ROSTER_CODE=$(curl -s --noproxy '*' --max-time 25 -o "$ROSTER_BODY" -w '%{http_code}' \
    -H "Authorization: Bearer $TOK" "$PUBLIC/api/employees")
  case "$ROSTER_CODE" in
    200) : ;;
    401) auth_fail "the token was REJECTED by an authenticated read (GET /api/employees -> HTTP 401): the credential file and the product's own user table disagree" ;;
    403) cannot_judge "the authenticated read (GET /api/employees -> HTTP 403): the credential is accepted but this account may not read the roster, so the token cannot be proved by it" ;;
    *)   cannot_judge "the authenticated read (GET /api/employees -> HTTP $ROSTER_CODE)" ;;
  esac
  ROSTER_SUM=$(python3 -c '
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(4)
if not isinstance(d, list):
    sys.exit(4)
print(len(d), (d[0].get("id") if d else "-"))
' "$ROSTER_BODY" 2>/dev/null)
  [ -n "$ROSTER_SUM" ] || cannot_judge "the roster body (HTTP $ROSTER_CODE): it is not the JSON list this check reads"
  ROSTER_N=${ROSTER_SUM%% *}
  ROSTER_FIRST=${ROSTER_SUM#* }
  echo "  roster:     HTTP $ROSTER_CODE, $ROSTER_N record(s) — the token is PROVEN by an authenticated read"
}

# ---------------------------------------------------------------------------------------------
# --preflight: the entitlement to judge, and nothing else. This mode is why the fix is provable
# without a cutover — read the credential file, log in, make one authenticated read, print the
# counts, exit. No git, no build, no restart, no database write.
# ---------------------------------------------------------------------------------------------
if [ "$PREFLIGHT" -eq 1 ]; then
  echo "  target: $PUBLIC   (the same public URL step 5 judges)"
  authenticate preflight
  echo ""
  echo "PREFLIGHT PASSED: the credential authenticates and an authenticated read accepts the token."
  echo "  what this proves:      step 5 is entitled to judge."
  echo "  what it does NOT prove: that anything else is correct. Nothing was restarted, built or written."
  echo "  evidence: $OUT"
  exit 0
fi

# The credential every check below depends on. Refused HERE, before the fetch, the build and the
# restart: discovering it at step 5 means taking the product down for nothing.
AUTH_STAGE="early"
read_credential
echo "  credential file: $PW_FILE ($PW_CHARS character(s) read; the value is never printed)"

if [ ! -d "$DEPLOY_DIR/server" ]; then
  echo "FAIL: no deployed tree at $DEPLOY_DIR — nothing to restart and nothing to move."
  echo "      A full movement needs the tree present too; this script never clones from scratch."
  exit 1
fi
if [ "$RESTART_ONLY" -eq 1 ]; then
  # A restart restores the bytes that are ON DISK. If nothing is on disk, that is not a restart
  # problem — it is a build problem, and only the full path can fix it.
  BUNDLES=$(ls "$DEPLOY_DIR"/client/dist/assets/index-*.js 2>/dev/null | wc -l)
  if [ "$BUNDLES" -eq 0 ]; then
    echo "FAIL: --restart-only, but client/dist holds NO bundle — a restart cannot restore the shipped bytes."
    echo "      Run the full path (bash $0) to build, or the rollback script if the served code is at fault."
    exit 1
  fi
  echo "  bundles on disk: $BUNDLES"
fi

cd "$DEPLOY_DIR" || { echo "FAIL: deployed tree missing"; exit 1; }

if [ "$RESTART_ONLY" -eq 1 ]; then
  echo "--- 1-3. SKIPPED (--restart-only): no fetch, no reset, no build, no re-seed ---"
  echo "         the tree stays at $(git -C "$DEPLOY_DIR" rev-parse --short HEAD 2>/dev/null || echo '<not a git tree>') and keeps the bundle already on disk"
else

echo "--- 1. fetch and move the tree to origin/main ---"
# Fetch the ref explicitly into FETCH_HEAD: a bare `git fetch --prune` has been observed
# leaving this repo with no origin/main ref at all, which makes the reset a silent no-op
# and deploys the OLD code while reporting success. Never trust the wildcard refspec here.
git fetch origin main || { echo "FAIL: fetch"; exit 1; }
git reset --hard FETCH_HEAD || { echo "FAIL: reset"; exit 1; }
echo "tree now: $(git log --oneline -1)"
# Hard gate: the tree must actually contain the deployed change, not silently still be the old one.
if ! grep -q "Final Settlement Payment" server/compliance_engine.js; then
  echo "FAIL: tree does not contain the expected code (reset did not move it). Refusing to continue."
  exit 1
fi
echo "tree content check OK"

echo "--- 1b. refresh the operator-facing host tooling from the tree we just moved to ---"
# WHY HERE, and not only in step 6b. The runbook's step 3 and DEPLOY.md both run
# /home/team/shared/deploy-main.sh, so the copy an operator INVOKES is the one the PREVIOUS movement
# installed. Measured 2026-10-18: that copy had been installed from #201 and carried no
# `deploy-in-progress` marker write, while the installed hook was #203's and WAITS for exactly that
# marker — so the movement the runbook describes could not stand its own hook down, and the race #203
# fixed was still live on the documented path.
# Installing from the tree we have just reset to means the NEXT movement always starts from a copy as
# new as the tip, even if this run fails later at the build or the seed. 6b calls the same script again
# on purpose: --restart-only skips step 1, and a second call is a no-op by construction (proved: two
# runs change no byte).
HOST_TOOLS="$DEPLOY_DIR/scripts/install-host-tools.sh"
if [ -f "$HOST_TOOLS" ]; then
  ANTUM_HOOK_DST="${ANTUM_HOOK_DST:-$HOOK_DST}" \
    ANTUM_HOST_TOOLS_DIR="${ANTUM_HOST_TOOLS_DIR:-/home/team/shared}" \
    bash "$HOST_TOOLS" || echo "WARNING: host tooling NOT refreshed (see above) — the next movement may run a stale copy"
else
  echo "WARNING: $HOST_TOOLS is missing — the host tooling was NOT refreshed (this tree predates it)"
fi

echo "--- 2. build the client (must succeed before anything is restarted) ---"
( cd client && NODE_OPTIONS=--max-old-space-size=700 npm run build ) > "$BUILD_LOG" 2>&1
BUILD_RC=$?
tail -6 "$BUILD_LOG"
if [ $BUILD_RC -ne 0 ]; then
  echo "FAIL: client build failed (rc=$BUILD_RC). Live site left as it was. Full log: $BUILD_LOG"
  exit 1
fi
echo "client build OK"

echo "--- 3. re-seed the demo dataset against the product database ---"
# --force-clear is required or the seed only upserts: orphaned rows from an older
# hand-written checklist survive and the demo shows duplicates (seen 2026-09-28: 14
# offboarding rows instead of 10). Safe here because PRODUCT_DB is the demo database
# and the seed's bulk deletes are scoped to demo-* ids and demo emails only.
[ -f "$PW_FILE" ] || { echo "FAIL: demo credential file missing"; exit 1; }
HASH=$(PW="$(cat "$PW_FILE")" node -e "const b=require('$DEPLOY_DIR/server/node_modules/bcryptjs');process.stdout.write(b.hashSync(process.env.PW,12))")
PRODUCT_DB_PATH="$PRODUCT_DB" DEMO_SEED=true DEMO_ADMIN_PASSWORD_HASH="$HASH" node scripts/seed-demo.js --force-clear > "$SEED_LOG" 2>&1
SEED_RC=$?
tail -3 "$SEED_LOG"
[ $SEED_RC -eq 0 ] || { echo "FAIL: seed failed (rc=$SEED_RC)"; exit 1; }
echo "seed OK"

fi

echo "--- 4. restart the server on port $PORT (pinned; the host exports PORT=80) ---"
OLD=$(lsof -t -i :$PORT -sTCP:LISTEN 2>/dev/null | head -1)
[ -n "$OLD" ] && echo "stopping pid $OLD" && kill "$OLD" && sleep 3
set -a; . "$ENVFILE" >/dev/null 2>&1; set +a
if [ -z "${JWT_SECRET:-}" ] || [ -z "${ENCRYPTION_KEY:-}" ]; then
  echo "FAIL: $ENVFILE did not provide JWT_SECRET/ENCRYPTION_KEY — refusing to start a server that could not sign or decrypt"
  exit 1
fi
cd "$DEPLOY_DIR/server" || exit 1
( setsid env PORT="$PORT" PRODUCT_DB_PATH="$PRODUCT_DB" JWT_SECRET="$JWT_SECRET" ENCRYPTION_KEY="$ENCRYPTION_KEY" \
    nohup node index.js >> server.log 2>&1 & )
sleep 5
# The platform's own starter site on this host is supervised: it respawns within seconds of
# being killed and will take port 3000 if we are slower to bind, which silently serves the
# PLACEHOLDER at the public URL while everything below still reports 200. So do not trust
# "something is listening" — assert that the listener is OUR server, and evict anything else.
claim_port() {
  for attempt in 1 2 3 4 5 6 7 8; do
    LPID=$(lsof -t -i :$PORT -sTCP:LISTEN 2>/dev/null | head -1)
    LARGS=$(ps -p "$LPID" -o args= 2>/dev/null)
    case "$LARGS" in
      *"node index.js"*) echo "port 3000 held by the product server (pid $LPID)"; return 0 ;;
    esac
    # A foreign (placeholder) process holds the port. Kill it AND immediately (re)start ours
    # in the same window: node does not retry after EADDRINUSE, and the supervised placeholder
    # respawns within seconds, so waiting for an empty port never happens — we have to win the
    # bind race by starting straight after the eviction.
    if [ -n "$LPID" ]; then
      echo "port 3000 held by a foreign process (pid $LPID: ${LARGS:0:60}) — evicting and re-claiming"
      kill "$LPID" 2>/dev/null
      sleep 1
    fi
    ( cd "$DEPLOY_DIR/server" && setsid env PORT="$PORT" PRODUCT_DB_PATH="$PRODUCT_DB" \
        JWT_SECRET="$JWT_SECRET" ENCRYPTION_KEY="$ENCRYPTION_KEY" \
        nohup node index.js >> server.log 2>&1 & )
    sleep 3
  done
  echo "FAIL: could not claim port 3000 for the product server; public URL is not ours"
  return 1
}
claim_port || exit 1
tail -1 server.log

echo "--- 5. verify the live demo end to end ---"
# NO JUDGMENT BEFORE THE ENTITLEMENT TO JUDGE. authenticate() proves three things — the credential
# file is a credential, the login turns it into a token of the expected shape, and an authenticated
# read ACCEPTS that token — and exits 3 naming AUTHENTICATION if any of them fails, so not one line
# below runs on an empty token. The roster reported here is that same proven read, not a second,
# unchecked one: the proof and the reported count are one measurement.
authenticate post-restart
echo "public status/title: $(curl -s --noproxy '*' -o /tmp/cutover-page -w '%{http_code}' --max-time 25 "$PUBLIC") $(grep -o '<title>[^<]*</title>' /tmp/cutover-page | head -1)"
echo "bad-password path: $(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 20 -X POST -H 'Content-Type: application/json' --data-binary '{"username":"admin","password":"nope"}' "$PUBLIC/api/login") (expect 401)"
echo "roster: $ROSTER_CODE"
echo "  employees: $ROSTER_N | first id: $ROSTER_FIRST"
# The re-seed exists to leave the demo in three distinct flag states, so the RUN must prove it
# rather than the operator checking by hand afterwards. This is also the reading that goes stale
# fastest: the flags are derived from the seed day's offsets, so an early re-seed gives a
# different configuration from a late one. Run-stamped, per the rule that a fixed evidence path
# lets the next run overwrite this one's bytes.
echo "pre-boarding demo state as the live API serves it (expect three distinct flag states):"
PB_JSON="/tmp/cutover-$STAMP-pb-overview.json"
PB_CODE=$(curl -s --noproxy '*' --max-time 25 -o "$PB_JSON" -w '%{http_code}' -H "Authorization: Bearer $TOK" \
  "$PUBLIC/api/preboarding/checklist/overview?jurisdiction=AE")
[ "$PB_CODE" = "200" ] || cannot_judge "the pre-boarding checklist overview (HTTP $PB_CODE): there is no checklist to read the flag states out of"
python3 - "$PB_JSON" <<'PY' 2>/dev/null || cannot_judge "the pre-boarding overview body (HTTP $PB_CODE): it is not the JSON this check reads"
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    raise SystemExit(4)
cases = d.get('cases', d) if isinstance(d, dict) else d
if not isinstance(cases, list):
    raise SystemExit(4)
if isinstance(d, dict): print("  totals:", json.dumps(d.get('totals', {}), sort_keys=True))
for c in cases:
    f = c.get('flag') or {}; bt = c.get('by_track') or {}
    print("   start", c.get('start_date'), "|", f.get('state'), "| tone", f.get('tone'),
          "| open", f.get('open_count'), "| lines emp/ws",
          (bt.get('employee') or {}).get('lines'), (bt.get('workspace') or {}).get('lines'))
states = sorted({(c.get('flag') or {}).get('state') for c in cases} - {None})
print("  distinct flag states:", states, "(expect 3: clear, inside_48_hours, started)")
PY
echo "KSA offboarding checklist as the live API serves it:"
OFF_JSON="/tmp/cutover-$STAMP-offboarding.json"
OFF_CODE=$(curl -s --noproxy '*' --max-time 25 -o "$OFF_JSON" -w '%{http_code}' -H "Authorization: Bearer $TOK" \
  "$PUBLIC/api/employees/demo-emp-sarah/offboarding")
[ "$OFF_CODE" = "200" ] || cannot_judge "the KSA offboarding checklist for demo-emp-sarah (HTTP $OFF_CODE)"
python3 - "$OFF_JSON" <<'PY' 2>/dev/null || cannot_judge "the offboarding checklist body (HTTP $OFF_CODE): it is not the JSON list this check reads"
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    raise SystemExit(4)
if not isinstance(d, list):
    raise SystemExit(4)
print("  tasks:", len(d))
for i, t in enumerate(d):
    print("   ", i + 1, t.get('title'))
PY
echo "consent-date field for the departing employee:"
python3 - "$PRODUCT_DB" <<'PY' 2>/dev/null || cannot_judge "the consent record for demo-emp-sarah (the product database could not be read, or the row is absent)"
import sqlite3, sys
try:
    c = sqlite3.connect(sys.argv[1])
    row = c.execute("select id, consent_granted, consent_date from employees where id='demo-emp-sarah'").fetchone()
except Exception:
    raise SystemExit(4)
if row is None:
    raise SystemExit(4)
print("  ", row)
PY
echo "settlement statement: the served document vs the employee record (an ISSUED statement must match the record; an UNISSUED one must be a figureless refusal):"
# RE-GROUNDED 2026-10-29 (#325's truthful refusal). The old block searched the body for a rendered
# EOSB and printed `match: False` on EVERY movement, because the product now correctly refuses to
# render: the settlement statement is an instrument, the employer-side facts it names are held
# nowhere, so it is not issued and carries no figure by design. A check that is red on the product's
# truthful behaviour is not a check - it hides the real red and trains the operator to ignore it.
# The assertion now lives in this tree's scripts/check-settlement-statement.py, which step 1's reset
# guarantees is the version this movement deploys; it branches on `issued` and names each failed
# assertion. rc=2 (CANNOT-JUDGE: the payload or the record could not be read) fails the run too: a
# run that judged nothing is not a pass. The payload path is run-stamped, like the other evidence.
SETTLE="/tmp/cutover-$STAMP-settlement.json"
SETTLE_CODE=$(curl -s --noproxy '*' --max-time 25 -o "$SETTLE" -w '%{http_code}' -H "Authorization: Bearer $TOK" \
  "$PUBLIC/api/compliance/templates/final-settlement-statement/demo-emp-sarah")
# THE STATUS IS CHECKED BEFORE THE CHECK IS ASKED TO JUDGE. This is the incident's exact seam: on
# 2026-11-02 the 401 body was written to this file, the settlement script correctly answered rc=2
# (CANNOT-JUDGE), and the harness reported that as "the settlement check is RED". A check handed an
# error payload has not judged anything, and must never be the line that gets blamed for it.
case "$SETTLE_CODE" in
  200) : ;;
  401) auth_fail "the token was rejected when reading the settlement statement (HTTP 401) — the session the preflight proved is not holding" ;;
  *)   cannot_judge "the settlement statement document (HTTP $SETTLE_CODE): the check was given no document to judge" ;;
esac
SETTLE_RC=0
SETTLE_KIND=""
python3 "$DEPLOY_DIR/scripts/check-settlement-statement.py" "$SETTLE" "$PRODUCT_DB" demo-emp-sarah || SETTLE_RC=$?
if [ "$SETTLE_RC" -ne 0 ]; then
  if [ "$SETTLE_RC" -eq 2 ]; then
    SETTLE_KIND="CANNOT-JUDGE: the check could not read its input — NOT a verdict about the settlement document"
  else
    SETTLE_KIND="RED: the served document contradicts the employee record"
  fi
  echo "FAIL: the settlement check did not pass (rc=$SETTLE_RC) — $SETTLE_KIND. See its own lines above."
  echo "      The movement still completes (step 6 re-arms the guard from a running product) and"
  echo "      exits 1 at the end, so a red here is visible without leaving the site unguarded."
fi

echo "--- 6. re-arm the watchdog from the tree we just deployed ---"
# pkill is asynchronous. The old loop holds the flock until it actually exits, so
# starting the new one after a flat sleep races it: the new instance sees the lock
# still held, writes "Another instance ... is already running" and exits 1 — and the
# cutover then finishes with NO watchdog armed. That happened twice on 2026-10-02
# (keep-alive.log 11:42:31 and 11:48:25). So: kill, WAIT for the old process to be
# gone, start, then verify it is actually alive and retry once if it is not.
# Announce the movement: from here until a guard is verified, the login-shell hook must not arm one.
# Without this, a shell opened during the kill window below arms a guard that the reap then kills
# ("lock still held by: 5274 — reaping before arming", observed twice). The marker carries our PID so a
# crashed deploy's marker is recognised as stale by the hook rather than trusted forever.
MARKER="$DEPLOY_DIR/server/deploy-in-progress"
printf '%s\n' "$$" > "$MARKER" 2>/dev/null && echo "deploy marker written: $MARKER (pid $$)" || echo "WARNING: could not write $MARKER — the hook may race this step"
trap 'rm -f "$MARKER" 2>/dev/null' EXIT INT TERM

WD_PAT='scripts/keep-alive[.]sh'
# Also match the pinned pre-merge guard by name. It is armed from /home/team/shared (not from
# the tree), so 'scripts/keep-alive.sh' does NOT match its cmdline — and a guard the stop step
# cannot see keeps the flock, so every new arm is refused and the cutover silently finishes
# with the old guard still in charge (observed 2026-10-06).
WD_PAT_PINNED='keep-alive-80c3fff'
pkill -f "$WD_PAT" 2>/dev/null
pkill -f "$WD_PAT_PINNED" 2>/dev/null
for _i in $(seq 1 30); do
  pgrep -f "$WD_PAT" >/dev/null || pgrep -f "$WD_PAT_PINNED" >/dev/null || break
  sleep 1
done
if pgrep -f "$WD_PAT" >/dev/null || pgrep -f "$WD_PAT_PINNED" >/dev/null; then
  echo "WARNING: old watchdog still alive after 30s — forcing it down"
  pkill -9 -f "$WD_PAT" 2>/dev/null; pkill -9 -f "$WD_PAT_PINNED" 2>/dev/null; sleep 3
fi
# A guard's inherited fd 9 keeps the flock after the loop dies (the fd-9 leak, fixed for new
# children by PR #59 but still true of any guard armed before it). Wait for the lock to fall
# to zero holders, then reap whatever is left holding it before arming.
for _i in $(seq 1 20); do
  [ -z "$(lsof -t "$DEPLOY_DIR/server/keep-alive.lock" 2>/dev/null)" ] && break
  sleep 1
done
STALE=$(lsof -t "$DEPLOY_DIR/server/keep-alive.lock" 2>/dev/null | tr '\n' ' ')
if [ -n "$STALE" ]; then
  echo "lock still held by: $STALE — reaping before arming"
  kill -9 $STALE 2>/dev/null; sleep 2
fi
for _attempt in 1 2 3; do
  cd "$DEPLOY_DIR" && ( setsid nohup bash scripts/keep-alive.sh >> server/keep-alive.out 2>&1 & )
  sleep 6
  if pgrep -f "$WD_PAT" >/dev/null; then break; fi
  echo "watchdog did not survive attempt $_attempt; retrying"
done
echo "watchdog pid: $(pgrep -f "$WD_PAT" | head -1)"
if ! pgrep -f "$WD_PAT" >/dev/null; then
  # FALLBACK GUARD — last resort only.
  #   History: the keep-alive.sh merged in PR #54 could NOT ARM on this host (it counted its
  #   own command-substitution forks as duplicate guards and exited: keep-alive.log 10:07:31/
  #   10:07:37/10:07:43, PIDs 2381-2383, its own forks). The cutover then finished with the
  #   site serving but UNGUARDED — the one outcome the guard exists to prevent.
  #   PR #59 (merged 2026-10-06) fixes it: the guard now recognises its own processes from the
  #   process tree, not the environment, and ships scripts/keep-alive-deploypath-test.sh for
  #   the deploy path specifically. Verified on the branch head before merge: 15 passed,
  #   0 failed, both arming paths, kill -> immediate re-arm, no child holding fd 9.
  #   So if this block runs at all, the tree guard is broken again — that is itself a finding,
  #   not a routine event. The pinned pre-merge guard keeps the site alive in the meantime.
  FALLBACK_GUARD=/home/team/shared/keep-alive-80c3fff.sh
  if [ -f "$FALLBACK_GUARD" ]; then
    echo "tree keep-alive.sh refused to arm — falling back to the pinned pre-merge guard"
    cd "$DEPLOY_DIR" && ( setsid nohup bash "$FALLBACK_GUARD" >> server/keep-alive.out 2>&1 & )
    sleep 8
    echo "fallback watchdog pid: $(pgrep -f 'keep-alive-80c3fff' | head -1)"
  fi
fi
if ! pgrep -f 'keep-alive.*\.sh' >/dev/null; then
  echo "WARNING: NO WATCHDOG ARMED — the site will not self-heal until one is started by hand"
fi
# ---------------------------------------------------------------------------
# The guard is verified by now, so the movement no longer owns it: release the claim before the hook
# step, or a shell between here and the end would correctly stand down for nothing.
rm -f "$MARKER" 2>/dev/null && echo "deploy marker removed: $MARKER"
trap - EXIT INT TERM

# 6b. install the login-shell hook that re-arms the watchdog after a host restart
# ---------------------------------------------------------------------------
# There is no cron and no systemd here, so a host restart leaves the product unguarded until a
# human re-arms it — and on 2026-10-13 that happened for the third time, the public URL answering
# 200 with the platform's placeholder in the meantime. The hook is the stopgap: a
# login/interactive shell (what the platform opens whenever it wakes an agent) arms the loop when
# no live guard can be verified, and logs every attempt and outcome to server/guard-hook.log.
# It lives in the repository as scripts/antum-product-guard-hook.sh and is installed HERE so a
# fresh host gets it from the deploy rather than from someone's memory: before 2026-10-13 the only
# copy was host state in /etc/profile.d, one lost machine away from gone.
# ANTUM_HOOK_SRC / ANTUM_HOOK_DST exist so this install can be exercised without touching the live
# /etc/profile.d (WORKFLOW rule 14) — only a test sets them.
HOOK_SRC="${ANTUM_HOOK_SRC:-$DEPLOY_DIR/scripts/antum-product-guard-hook.sh}"
HOOK_DST="${ANTUM_HOOK_DST:-/etc/profile.d/zz-antum-product-guard.sh}"
# ONE install path. Until 2026-10-18 this block installed the hook itself, writing the raw blob: that
# stripped the provenance block the installer had just added, and left the preflight's file comparison
# permanently unable to go green on a hook whose body was byte-identical. The installer writes every
# copy — this hook included — and derives the provenance from the tree.
  # WHICH REVISION'S HOOK — read from $0, not from the tree, and that is the whole point.
  # The hook and the deploy that writes the `deploy-in-progress` marker are ONE mechanism. This copy
  # carries the revision it was installed from in its provenance block. On --restart-only the tree is the
  # SERVED revision, which may be far older than this copy: on 2026-10-19 the host was running a
  # marker-writing deploy against a hook that contained 0 occurrences of `deploy-in-progress` — the race
  # #203 fixed, live again, with the preflight green because it compared against the served tree. After a
  # full movement's step 1b rewrites this file, $0 names the tip instead, so the same line installs the
  # tip's hook. Either way the hook follows the deploy that is running.
  # >>> ANTUM DEPLOY REVISION FROM $0 — extracted and exercised by
  # docs/evidence/hook-pairing-2026-10-19/prove.sh, so this derivation is proven, not asserted.
  SELF_REV=$(sed -n 's/^# source-revision: \([0-9a-f]\{7,\}\).*/\1/p' "$0" 2>/dev/null | head -1)
  if [ -n "$SELF_REV" ]; then
    echo "  deploy copy revision: $SELF_REV (read from $0)"
  else
    echo "  deploy copy revision: UNKNOWN ($0 carries no provenance block) — the hook will come from the tree"
  fi
  # <<< ANTUM DEPLOY REVISION FROM $0
  HOST_TOOLS="$DEPLOY_DIR/scripts/install-host-tools.sh"
  if [ -f "$HOST_TOOLS" ]; then
    ANTUM_HOOK_REV="$SELF_REV" ANTUM_HOOK_DST="$HOOK_DST" \
      ANTUM_HOST_TOOLS_DIR="${ANTUM_HOST_TOOLS_DIR:-/home/team/shared}" \
      bash "$HOST_TOOLS" || echo "WARNING: host tooling NOT refreshed (see above) — the next movement may run a stale copy"
  else
    # THE FALLBACK INSTALLS FROM THE DEPLOY'S REVISION TOO, not from the tree. This is the path a
    # replacement recovery takes (--restart-only against a tree older than the installed copies), and it
    # is the path that produced the unpaired hook on 2026-10-19. The tree's hook is the last resort, and
    # whichever one is used is named in the log — never guessed silently.
    # >>> ANTUM FALLBACK HOOK SOURCE — one unit on purpose: a harness has to be able to test what this
    # path installs, and WHICH revision it took it from, without running a deploy.
    if [ -n "$SELF_REV" ] && git -C "$DEPLOY_DIR" cat-file -e "$SELF_REV:scripts/antum-product-guard-hook.sh" 2>/dev/null; then
      HOOK_FROM_REV=$(mktemp /tmp/antum-hook-XXXXXX.sh)
      if git -C "$DEPLOY_DIR" show "$SELF_REV:scripts/antum-product-guard-hook.sh" > "$HOOK_FROM_REV" 2>/dev/null; then
        HOOK_SRC="$HOOK_FROM_REV"
        echo "NOTE: $HOST_TOOLS is missing (this tree predates it) — installing the hook from the deploy copy's revision $(git -C "$DEPLOY_DIR" rev-parse --short "$SELF_REV"), which is the revision that writes the marker"
      fi
    elif [ -n "$SELF_REV" ]; then
      echo "WARNING: the deploy copy names $SELF_REV but its hook is not in this tree — installing the TREE's hook, which may not read the marker this deploy writes"
    else
      echo "NOTE: $HOST_TOOLS is missing and the deploy copy carries no revision — installing the TREE's hook"
    fi
    if [ ! -f "$HOOK_SRC" ]; then
      echo "WARNING: $HOOK_SRC is missing — the host hook is NOT installed (a restart will not re-arm the watchdog)"
    elif ! bash -n "$HOOK_SRC" 2>/dev/null; then
      echo "WARNING: $HOOK_SRC does not parse as shell (bash -n failed) — refusing to install it into every login shell"
    elif cmp -s "$HOOK_SRC" "$HOOK_DST"; then
      echo "guard hook: already installed and identical ($HOOK_DST)"
    elif install -m 0644 "$HOOK_SRC" "$HOOK_DST" 2>/dev/null && cmp -s "$HOOK_SRC" "$HOOK_DST"; then
      echo "guard hook: installed $HOOK_DST (bytes match) from ${HOOK_SRC}"
    else
      echo "WARNING: could not install the guard hook at $HOOK_DST — a restart will not re-arm the watchdog"
    fi
    # <<< ANTUM FALLBACK HOOK SOURCE
  fi
    # <<< ANTUM FALLBACK HOOK SOURCE
# --- the served bytes are the on-disk bytes -----------------------------------------
# DERIVE-OR-REFUSE: no bundle hash is remembered here. The asset the public HTML names is fetched and
# compared with the file of that name on disk — both measured now. A mismatch is a failure, not a note,
# because "the public URL answers 200" is exactly what the platform's placeholder also does.
if [ "$RESTART_ONLY" -eq 1 ]; then
  echo "--- the served bytes vs the on-disk bundle ---"
  SERVED_NAME=$(curl -s --noproxy '*' --max-time 25 "$PUBLIC/" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)
  if [ -z "$SERVED_NAME" ]; then
    echo "FAIL: the public HTML names no asset — the placeholder is being served, not the product"
    exit 1
  elif [ ! -f "$DEPLOY_DIR/client/dist/$SERVED_NAME" ]; then
    echo "FAIL: the served asset $SERVED_NAME is not in $DEPLOY_DIR/client/dist — it cannot be the shipped bundle"
    exit 1
  else
    SERVED_MD5=$(curl -s --noproxy '*' --max-time 30 "$PUBLIC/$SERVED_NAME" | md5sum | cut -d' ' -f1)
    DISK_MD5=$(md5sum < "$DEPLOY_DIR/client/dist/$SERVED_NAME" | cut -d' ' -f1)
    echo "  $SERVED_NAME  served md5 $SERVED_MD5 / on-disk md5 $DISK_MD5 (both measured now)"
    if [ "$SERVED_MD5" != "$DISK_MD5" ]; then
      echo "FAIL: the served bytes are NOT the on-disk bundle — something rebuilt or the dist is stale"
      exit 1
    fi
    echo "  OK: the served bytes ARE the on-disk shipped bundle — nothing was rebuilt"
  fi
fi

echo "deployed commit: $(git log --oneline -1)"
if [ "${SETTLE_RC:-0}" -ne 0 ]; then
  # Deliberately the LAST thing, after step 6 and 6b: the guard is armed and the hook installed by
  # now, so a red verification can fail the run without leaving the product unguarded.
  echo "=== cutover finished $(date -Iseconds) WITH A FAILED VERIFICATION (settlement check rc=$SETTLE_RC — $SETTLE_KIND) — run-stamped evidence: $OUT | build: $BUILD_LOG | seed: $SEED_LOG ==="
  exit 1
fi
echo "=== cutover finished $(date -Iseconds) — run-stamped evidence: $OUT | build: $BUILD_LOG | seed: $SEED_LOG ==="

# =====================================================================
# MANUAL RECOVERY — "Another instance (PID: N) is already running" from a dead loop
# =====================================================================
# Diagnosed 2026-10-06. keep-alive.sh takes its flock on fd 9 and does NOT close that
# descriptor for the processes it starts, so they inherit the lock. Verified on the
# deployed host: `lsof server/keep-alive.lock` shows THREE holders at once — the loop
# (bash keep-alive.sh), the product server (node index.js) and a poll sleep. Kill the
# loop and two holders survive it, so the lock stays held by a process that is not a
# loop, and every later re-arm is refused naming the loop's dead PID. With no lock
# holder left to reap, the service runs UNGUARDED: fine while the server lives, and
# nothing restarts it when it dies. The permanent fix (fd 9 closed for every child)
# is the engineer's watchdog PR; this cutover already recovers the state on every run.
#
# To recover by hand, in order:
#   1) lsof /home/team/shared/probable-octo-sniffle/server/keep-alive.lock
#      -> note every PID whose COMMAND is NOT keep-alive.sh (the server, the sleeps)
#   2) kill those holders (the server too — it is the one that will not exit on its own)
#   3) confirm the lock is free: lsof again should print nothing
#   4) arm once from the tree: cd $DEPLOY_DIR && setsid nohup bash scripts/keep-alive.sh \
#        >> server/keep-alive.out 2>&1 &
#   5) verify: pgrep -f 'scripts/keep-alive[.]sh' | head -1   and   curl -s -o /dev/null \
#        -w '%{http_code}' http://127.0.0.1:$PORT/  -> 200, and /api/employees -> 401
# Do NOT re-arm while the old server still holds fd 9 — it will refuse and you will
# have made no progress. Step 2 is the step that matters.
