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
#   - THE PUBLIC URL DOES NOT SERVE THE BUILT BUNDLE -> exit 1 at the END of the run (so the guard is
#     already re-armed). Added 2026-11-08 after a movement recorded `200 <title>Antum People — access`
#     as its public row and passed: that title is the PUBLIC GATE's page, i.e. the run verified the wall
#     and called it the product. The row now asserts the product (step 5, verify_public_product), and a
#     gated tree with no minted cookie is a REFUSAL rather than a pass.
#
# THE GATE DECISION IS TAKEN AGAINST THE TREE THAT WILL BE SERVED (2026-11-08). It used to run in step 0,
# BEFORE the git pull: on the movement that deployed b8976b0 the deployed tree was still the ungated
# 8a4e1ac, so no cookie was minted, and the run then pulled a GATED tree, built it, restarted it and
# judged it with an empty cookie. Step 0 now runs the decision only in the modes that pull nothing
# (--restart-only, --preflight); a full movement takes it as step 1c, after the pull, and prints the
# revision it judged.
#
# THE AFTER-STATE IS NAMED (step 2b): the pulled revision plus the built entry/CSS with byte sizes and
# md5s, from this run's own client/dist. If the operator supplied the preflight's record
# (ANTUM_MEASURED_TIP / _ASSET / _ASSET_BYTES / _ASSET_MD5 / _CSS / _CSS_BYTES / _CSS_MD5) and it
# disagrees, the run prints a loud AFTER-STATE MOVED block naming both sides and CONTINUES: a tree that
# moved under the run is a fact to report, not a reason to abort a deploy that has already pulled.
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
# The public gate's host files, the cookie this script judges with, and the product assertion that says
# whether what the public URL serves is the PRODUCT: all of it is ONE unit further down, bounded by the
# `>>> ANTUM GATE DECISION` / `<<< ANTUM GATE DECISION` markers, because scripts/deploy-main-gate-test.sh
# extracts that unit and drives these functions against a throwaway tree in /tmp. Nothing in this
# script reads or prints a gate file's CONTENTS; see the unit's own header.

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
    -X POST -H 'Content-Type: application/json' -H "Cookie: $GATE_COOKIE_HEADER" \
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
    -H "Authorization: Bearer $TOK" -H "Cookie: $GATE_COOKIE_HEADER" "$PUBLIC/api/employees")
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

# ===================================================================================================
# >>> ANTUM GATE DECISION — ONE UNIT, extracted and exercised off-host by scripts/deploy-main-gate-test.sh
#
# THE PUBLIC GATE'S TWO HOST FILES, THE COOKIE THIS SCRIPT JUDGES WITH, AND THE ASSERTION THAT SAYS
# WHETHER WHAT THE PUBLIC URL SERVES IS THE PRODUCT.
#
# The owner ruled that the product must not be reachable by a stranger, and the platform proxies port
# 3000, so `server/public-gate.js` sits in front of the shell, the assets and the API. It reads two
# files at boot: a bcrypt hash (cost 12, the same shape as the admin credential) and an HMAC key.
# gate_decision() creates whichever is absent, mode 600, so a fresh host comes up gated rather than
# answering 503 — and it runs in --restart-only too, because a restart is exactly when a missing file
# would show up.
#
# NEITHER FILE'S CONTENTS IS EVER PRINTED. The passcode itself cannot be derived from the hash, so the
# generated one is written ONCE to $GATE_SHOWN_ONCE for the owner to record and delete; this script
# prints only paths. The cookie this script then judges with is minted from the SIGNING KEY, not from
# the passcode — anything that can read that key is already on this host, which is the right boundary.
#
# WHY THIS IS ONE BOUNDED UNIT: a unit can be extracted whole and driven against a throwaway tree in
# /tmp, which is the only way the two assertions below are provable without a movement. The test
# extracts the bytes between these two markers and calls THESE functions — it does not re-implement
# them, so a fix here reaches the test, and a regression here reddens it.
#
# EVERY HOST VALUE BELOW IS AN ANTUM_* OVERRIDE (WORKFLOW rule 14): that property is what makes the
# unit testable off-host, and nothing in it may name a real path except as a default.
# ===================================================================================================
GATE_PASSCODE_FILE="${ANTUM_GATE_PASSCODE_FILE:-/home/team/shared/.antum-gate-passcode}"
GATE_SECRET_FILE="${ANTUM_GATE_SECRET_FILE:-/home/team/shared/.antum-gate-secret}"
GATE_SHOWN_ONCE="${ANTUM_GATE_SHOWN_ONCE:-/home/team/shared/.antum-gate-passcode.shown-once}"
# Sent as `Cookie:` on every request this script makes to the public URL. `antum_gate=` is an invalid
# cookie, i.e. no cookie — which is the state a gated tree must never be judged in (see below).
GATE_COOKIE_HEADER="antum_gate="
# What the last gate_decision() decided. Recorded rather than inferred later, so the product assertion
# can refuse to judge a gated tree it holds no credential for instead of measuring the gate page.
GATE_DECISION_REV=""
GATE_DECISION_GATED=0
GATE_COOKIE_MINTED=0

# IS THIS TREE GATED? Asked of the tree that will be SERVED, every time, and never of a remembered
# fact — the answer moved mid-run on 2026-11-08 and that is the whole of the defect this unit closes.
tree_is_gated() { [ -f "$DEPLOY_DIR/server/public-gate.js" ]; }

ensure_gate_credential() {
  if [ ! -s "$GATE_SECRET_FILE" ]; then
    ( umask 077; head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$GATE_SECRET_FILE" )
    chmod 600 "$GATE_SECRET_FILE" 2>/dev/null
    echo "  gate signing key: CREATED at $GATE_SECRET_FILE (mode 600; contents never printed)"
  else
    echo "  gate signing key: present at $GATE_SECRET_FILE"
  fi
  if [ ! -s "$GATE_PASSCODE_FILE" ]; then
    if [ ! -d "$DEPLOY_DIR/server/node_modules" ]; then
      echo "FAIL: $GATE_PASSCODE_FILE does not exist and $DEPLOY_DIR/server/node_modules is missing, so"
      echo "      the passcode cannot be hashed. Nothing was changed and the product was not touched."
      exit 1
    fi
    PLAIN="$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | cut -c1-20)"
    if [ -z "$PLAIN" ]; then
      echo "FAIL: could not generate a passcode (no entropy from /dev/urandom). Nothing was changed."
      exit 1
    fi
    # The value travels in the ENVIRONMENT, never in argv: argv is world-readable in `ps`.
    ( umask 077; PASS="$PLAIN" node -e "const b=require('$DEPLOY_DIR/server/node_modules/bcryptjs');process.stdout.write(b.hashSync(process.env.PASS,12))" > "$GATE_PASSCODE_FILE" )
    chmod 600 "$GATE_PASSCODE_FILE" 2>/dev/null
    ( umask 077; printf '%s\n' "$PLAIN" > "$GATE_SHOWN_ONCE" )
    chmod 600 "$GATE_SHOWN_ONCE" 2>/dev/null
    unset PLAIN
    echo "  gate passcode:    CREATED at $GATE_PASSCODE_FILE (mode 600, bcrypt cost 12; hash never printed)"
    echo "                    the passcode itself is in $GATE_SHOWN_ONCE — record it, then delete that file"
  else
    echo "  gate passcode:    present at $GATE_PASSCODE_FILE"
  fi
}

mint_gate_cookie() {
  if ! tree_is_gated; then
    echo "  gate cookie:      not minted — this tree predates the public gate, so nothing is gated"
    GATE_COOKIE_MINTED=0
    return 0
  fi
  local MINTED
  MINTED=$(node -e "process.stdout.write(require('$DEPLOY_DIR/server/public-gate').mintCookieHeader('$GATE_SECRET_FILE'))" 2>/dev/null)
  if [ -n "$MINTED" ]; then
    GATE_COOKIE_HEADER="$MINTED"
    GATE_COOKIE_MINTED=1
    unset MINTED
    echo "  gate cookie:      minted from $GATE_SECRET_FILE (the cookie itself is never printed)"
  else
    echo "  gate cookie:      COULD NOT BE MINTED from $GATE_SECRET_FILE — every public check below sees"
    echo "                    the gate page instead of the product. Fix the key before trusting this run."
    GATE_COOKIE_HEADER="antum_gate="
    GATE_COOKIE_MINTED=0
  fi
}

# THE DECISION, TAKEN AGAINST A NAMED TREE.
#
# $1 = one line saying WHY this is the tree that will be served (a full movement pulls a new one in
# step 1; --restart-only and --preflight pull nothing, so there the tree on disk IS the served tree).
#
# THE REVISION IS PRINTED because the defect was a decision whose subject was never named: the 14:05Z
# movement of 2026-11-08 took this decision against the PRE-pull 8a4e1ac (ungated, so "nothing is
# gated" was true of it), then pulled the GATED b8976b0, built it, restarted it and verified it with an
# empty cookie. Nothing in the run said which tree the "nothing is gated" answer had been about.
gate_decision() {
  GATE_DECISION_REV=$(git -C "$DEPLOY_DIR" rev-parse HEAD 2>/dev/null || echo '<not a git tree>')
  echo "  judged against:   $GATE_DECISION_REV"
  echo "                    ($1)"
  if tree_is_gated; then
    echo "  tree is gated:    YES — server/public-gate.js is in this tree"
  else
    echo "  tree is gated:    NO — no server/public-gate.js in this tree"
  fi
  ensure_gate_credential
  mint_gate_cookie
  GATE_DECISION_GATED=$(tree_is_gated && echo 1 || echo 0)
  echo "  decision:         gated=$GATE_DECISION_GATED cookie_minted=$GATE_COOKIE_MINTED"
}

# THE ASSET NAMES THE BUILT DIST NAMES, read from client/dist/index.html — never remembered. The served
# document must name the SAME one: that is the assertion that tells the product from a page that merely
# answers 200, because the gate page names no asset at all.
dist_named_asset() { # $1 = js|css -> the file name (without the `assets/` prefix), or empty
  local idx="$DEPLOY_DIR/client/dist/index.html" pat
  [ -f "$idx" ] || return 0
  case "$1" in
    css) pat='assets/index-[A-Za-z0-9_-]*\.css' ;;
    *)   pat='assets/index-[A-Za-z0-9_-]*\.js' ;;
  esac
  grep -o "$pat" "$idx" 2>/dev/null | head -1 | sed 's#^assets/##'
}

# THE TWO TITLES, each DERIVED from the thing that produces it rather than typed here: the product's
# from the built index.html, the gate's from the tree's own gate module. A title typed into this script
# would drift the moment either page changed, and the assertion would then redden on a healthy
# deployment — a check that cries wolf gets switched off.
product_title() {
  grep -o '<title>[^<]*</title>' "$DEPLOY_DIR/client/dist/index.html" 2>/dev/null | head -1 \
    | sed -e 's#<title>##' -e 's#</title>##'
}
gate_title() {
  node -e "const g=require('$DEPLOY_DIR/server/public-gate');const m=g.gatePage('').match(/<title>([^<]*)<\/title>/);process.stdout.write(m?m[1]:'')" 2>/dev/null
}

# ===================================================================================================
# THE PRODUCT ASSERTION — what step 5 proves about the public URL.
#
# rc 0 = every assertion held, and the count is printed. rc 1 = it did not, each failure naming the two
# sides it compared.
#
# WHAT IT REFUSES, and why (measured 2026-11-08, on the live URL): a gated tree with NO minted cookie
# returns the GATE PAGE — 200, title `Antum People — access`, no `#root`, no asset — and the movement
# that ran that night recorded exactly that as its public row and passed. So on a gated tree with no
# cookie this function does not compare anything: it says it cannot prove the product and fails. A
# green here is a green about the SERVED DOCUMENT and the SERVED BYTES being the built client/dist,
# and nothing else.
# ===================================================================================================
verify_public_product() {
  local entry css disk_md5 doc_ck doc_no asset_ck asset_no
  local ck_code no_code ack_code ano_code
  local title_ck title_no entry_no served_entry root_ck root_no gt
  local held=0 failed=0 served_gated=0

  # ASKED AGAIN, OF THE TREE BEING SERVED — not read off gate_decision()'s record. The 2026-11-08
  # defect was precisely a recorded decision about a DIFFERENT tree: gated=0 was true of the pre-pull
  # 8a4e1ac, and the assertion then ran against the gated tree the run had just deployed. Trusting the
  # record here would reproduce that defect inside the fix.
  tree_is_gated && served_gated=1

  entry=$(dist_named_asset js)
  css=$(dist_named_asset css)
  echo "  built entry:      ${entry:-<none: client/dist/index.html names no assets/index-*.js>}${css:+   built css: $css}"
  if [ -z "$entry" ]; then
    echo "  FAIL: the built client/dist names no entry asset, so there is nothing to compare the served"
    echo "        document against — the product cannot be proven from here."
    return 1
  fi
  if [ ! -f "$DEPLOY_DIR/client/dist/assets/$entry" ]; then
    echo "  FAIL: client/dist/index.html names $entry but that file is NOT on disk — the shell and the"
    echo "        build disagree, so no byte comparison below could mean anything."
    return 1
  fi
  disk_md5=$(md5sum < "$DEPLOY_DIR/client/dist/assets/$entry" | cut -d' ' -f1)

  # THE REFUSAL, BEFORE ANY MEASUREMENT IS INTERPRETED. A gated tree judged with no cookie can only
  # produce the gate page, and the gate page is a 200 with a title — everything the old row looked for.
  if [ "$served_gated" -eq 1 ] && [ "$GATE_COOKIE_MINTED" -ne 1 ]; then
    echo "  FAIL: this tree is GATED ($DEPLOY_DIR/server/public-gate.js) but NO gate cookie was minted."
    echo "        Every fetch below would measure the GATE PAGE, and the gate page answers 200 with a"
    echo "        <title> — which is exactly how the 2026-11-08 movement recorded the wall as a pass:"
    echo "          public status/title: 200 <title>Antum People — access</title>"
    echo "        (the gate decision recorded gated=$GATE_DECISION_GATED against $GATE_DECISION_REV —"
    echo "         a DIFFERENT tree from the one being served, which is how it missed.)"
    echo "        THE PRODUCT IS NOT PROVEN. Nothing about the served shell, the served asset or its"
    echo "        bytes was judged here, and none of them is implicated."
    return 1
  fi

  doc_ck=$(mktemp /tmp/antum-public-doc-XXXXXX.html) || { echo "  FAIL: no scratch file"; return 1; }
  doc_no=$(mktemp /tmp/antum-public-nocookie-XXXXXX.html) || { echo "  FAIL: no scratch file"; return 1; }
  asset_ck=$(mktemp /tmp/antum-public-asset-XXXXXX.js) || { echo "  FAIL: no scratch file"; return 1; }
  asset_no=$(mktemp /tmp/antum-public-assetnocookie-XXXXXX.js) || { echo "  FAIL: no scratch file"; return 1; }

  ck_code=$(curl -s --noproxy '*' -H "Cookie: $GATE_COOKIE_HEADER" -o "$doc_ck" -w '%{http_code}' --max-time 25 "$PUBLIC/")
  title_ck=$(grep -o '<title>[^<]*</title>' "$doc_ck" | head -1)
  served_entry=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' "$doc_ck" | head -1 | sed 's#^assets/##')
  root_ck=$(grep -c 'id="root"' "$doc_ck")
  echo "  document WITH the gate cookie:    HTTP $ck_code  $(wc -c < "$doc_ck") B  ${title_ck:-<no title>}  names ${served_entry:-NO asset}  #root x$root_ck"

  asrt() { # $1 = 1 held / 0 failed, $2 = the sentence, already carrying both sides
    if [ "$1" -eq 1 ]; then held=$((held+1)); echo "  OK:   $2"
    else failed=$((failed+1)); echo "  FAIL: $2"; fi
  }
  asrt $([ "$ck_code" = "200" ] && echo 1 || echo 0) \
    "the document answers HTTP 200 with the cookie (got $ck_code)"
  asrt $([ "$served_entry" = "$entry" ] && echo 1 || echo 0) \
    "the served document names the entry the BUILT dist names: served ${served_entry:-<none>} / built $entry"
  asrt $([ "$root_ck" -ge 1 ] && echo 1 || echo 0) \
    "the served document carries #root — it is the product shell, not a page that merely answers 200"
  local want_title
  want_title=$(product_title)
  asrt $([ -n "$want_title" ] && [ "$title_ck" = "<title>$want_title</title>" ] && echo 1 || echo 0) \
    "the served document's title is the built shell's own: served ${title_ck:-<none>} / built '$want_title'"

  ack_code=$(curl -s --noproxy '*' -H "Cookie: $GATE_COOKIE_HEADER" -o "$asset_ck" -w '%{http_code}' --max-time 30 "$PUBLIC/assets/$entry")
  local asset_md5 ano_md5
  asset_md5=$(md5sum < "$asset_ck" | cut -d' ' -f1)
  echo "  asset WITH the gate cookie:       $entry  HTTP $ack_code  $(wc -c < "$asset_ck") B  md5 $asset_md5  (on disk $disk_md5)"
  asrt $([ "$asset_md5" = "$disk_md5" ] && echo 1 || echo 0) \
    "the bytes served for $entry ARE the file on disk: served md5 $asset_md5 / disk md5 $disk_md5"

  # AND THE SAME URL WITH NO COOKIE. On a gated tree this must be the GATE — that is the half of the
  # assertion that stops a gate page from ever being read as a product; on an ungated tree there is no
  # gate to pass, so the same document must come back.
  no_code=$(curl -s --noproxy '*' -H "Cookie: antum_gate=" -o "$doc_no" -w '%{http_code}' --max-time 25 "$PUBLIC/")
  title_no=$(grep -o '<title>[^<]*</title>' "$doc_no" | head -1)
  entry_no=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' "$doc_no" | head -1 | sed 's#^assets/##')
  root_no=$(grep -c 'id="root"' "$doc_no")
  echo "  document WITHOUT a cookie:        HTTP $no_code  $(wc -c < "$doc_no") B  ${title_no:-<no title>}  names ${entry_no:-NO asset}  #root x$root_no"
  if [ "$served_gated" -eq 1 ]; then
    gt=$(gate_title)
    asrt $([ -n "$gt" ] && [ "$title_no" = "<title>$gt</title>" ] && echo 1 || echo 0) \
      "cookieless, the URL is the GATE PAGE: served ${title_no:-<none>} / the gate's own title '$gt'"
    asrt $([ "$root_no" -eq 0 ] && echo 1 || echo 0) \
      "cookieless, there is no #root — the product shell is behind the wall"
    asrt $([ -z "$entry_no" ] && echo 1 || echo 0) \
      "cookieless, the document names no entry asset (got ${entry_no:-none})"
    ano_code=$(curl -s --noproxy '*' -H "Cookie: antum_gate=" -o "$asset_no" -w '%{http_code}' --max-time 30 "$PUBLIC/assets/$entry")
    ano_md5=$(md5sum < "$asset_no" | cut -d' ' -f1)
    asrt $([ "$ano_md5" != "$disk_md5" ] && echo 1 || echo 0) \
      "cookieless, the ASSET url does not serve the product's bytes: got md5 $ano_md5 (HTTP $ano_code), the product is $disk_md5"
  else
    asrt $([ "$title_no" = "$title_ck" ] && [ "$root_no" -ge 1 ] && echo 1 || echo 0) \
      "ungated, the same product document is served with and without a cookie (${title_no:-<none>}, #root x$root_no)"
  fi

  rm -f "$doc_ck" "$doc_no" "$asset_ck" "$asset_no" 2>/dev/null
  echo "  ASSERTIONS: $held held, $failed failed (of $((held + failed)))"
  if [ "$failed" -ne 0 ]; then
    echo "  VERDICT: THE PRODUCT IS NOT PROVEN — this movement fails on this row."
    return 1
  fi
  echo "  VERDICT: THE PRODUCT IS PROVEN — the served document and the served bytes are the built client/dist."
  return 0
}

# ===================================================================================================
# THE AFTER-STATE OF THIS RUN — the revision and the bundle that actually shipped, named from this
# run's own pull and build, and compared with the preflight's record when one was supplied.
#
# WHY (2026-11-08): #387 merged at 14:03:09Z, between the preflight (14:02:36Z) and the movement's pull,
# so what shipped was a tree nobody had measured — and nothing in the run said so. The after-state is
# printed unconditionally (a run that cannot be compared with a record is a run whose figures are
# unquotable), and a disagreement prints AFTER-STATE MOVED and CONTINUES: the pull has already
# happened, and a deploy that aborted here would leave the product on the new tree with no guard.
#
# $1 = one line saying which kind of run this is (a full movement, or a restart-only recovery).
# ===================================================================================================
print_after_state() {
  local rev entry css a bytes md5 supplied=0 moved="" entry_bytes="" entry_md5="" css_bytes="" css_md5=""
  rev=$(git -C "$DEPLOY_DIR" rev-parse HEAD 2>/dev/null || echo '<not a git tree>')
  echo "--- THE AFTER-STATE OF THIS RUN ($1) ---"
  echo "  revision shipped: $rev"
  echo "  $(git -C "$DEPLOY_DIR" log --oneline -1 2>/dev/null || echo '<no git history>')"
  entry=$(dist_named_asset js)
  css=$(dist_named_asset css)
  for a in "$entry" "$css"; do
    [ -n "$a" ] || continue
    if [ -f "$DEPLOY_DIR/client/dist/assets/$a" ]; then
      bytes=$(stat -c %s "$DEPLOY_DIR/client/dist/assets/$a")
      md5=$(md5sum < "$DEPLOY_DIR/client/dist/assets/$a" | cut -d' ' -f1)
      printf '  built: %s  %s B  md5 %s\n' "$a" "$bytes" "$md5"
      if [ "$a" = "$entry" ]; then entry_bytes="$bytes"; entry_md5="$md5"; fi
      if [ "$a" = "$css" ];   then css_bytes="$bytes";   css_md5="$md5";   fi
    else
      printf '  built: %s  MISSING from client/dist/assets — the shell names a file that is not on disk\n' "$a"
    fi
  done

  # Only fields the operator SUPPLIED are compared: this script remembers no bundle, so an absent
  # record is silence, never a match. cutover-preflight.sh is where a record is validated; here it is
  # checked against what this run actually pulled and built.
  same_rev() { case "$rev" in "$1"*) return 0 ;; esac; case "$1" in "$rev"*) return 0 ;; esac; return 1; }
  note_moved() { moved="$moved
    $1: the record says '$2'; this run measured '$3'"; }
  if [ -n "${ANTUM_MEASURED_TIP:-}" ]; then
    supplied=$((supplied + 1))
    same_rev "$ANTUM_MEASURED_TIP" || note_moved "revision" "$ANTUM_MEASURED_TIP" "$rev"
  fi
  if [ -n "${ANTUM_MEASURED_ASSET:-}" ]; then
    supplied=$((supplied + 1))
    [ "$ANTUM_MEASURED_ASSET" = "$entry" ] || note_moved "entry asset" "$ANTUM_MEASURED_ASSET" "$entry"
  fi
  if [ -n "${ANTUM_MEASURED_ASSET_BYTES:-}" ]; then
    supplied=$((supplied + 1))
    [ "$ANTUM_MEASURED_ASSET_BYTES" = "$entry_bytes" ] || note_moved "entry bytes" "$ANTUM_MEASURED_ASSET_BYTES" "$entry_bytes"
  fi
  if [ -n "${ANTUM_MEASURED_ASSET_MD5:-}" ]; then
    supplied=$((supplied + 1))
    [ "$ANTUM_MEASURED_ASSET_MD5" = "$entry_md5" ] || note_moved "entry md5" "$ANTUM_MEASURED_ASSET_MD5" "$entry_md5"
  fi
  if [ -n "${ANTUM_MEASURED_CSS:-}" ]; then
    supplied=$((supplied + 1))
    [ "$ANTUM_MEASURED_CSS" = "$css" ] || note_moved "css asset" "$ANTUM_MEASURED_CSS" "$css"
  fi
  if [ -n "${ANTUM_MEASURED_CSS_BYTES:-}" ]; then
    supplied=$((supplied + 1))
    [ "$ANTUM_MEASURED_CSS_BYTES" = "$css_bytes" ] || note_moved "css bytes" "$ANTUM_MEASURED_CSS_BYTES" "$css_bytes"
  fi
  if [ -n "${ANTUM_MEASURED_CSS_MD5:-}" ]; then
    supplied=$((supplied + 1))
    [ "$ANTUM_MEASURED_CSS_MD5" = "$css_md5" ] || note_moved "css md5" "$ANTUM_MEASURED_CSS_MD5" "$css_md5"
  fi

  if [ -n "$moved" ]; then
    echo ""
    echo "  !!!!!!!!!!!!!!!!!!!!!!!!  AFTER-STATE MOVED  !!!!!!!!!!!!!!!!!!!!!!!!"
    echo "  THE TREE/BUNDLE THAT SHIPPED IS NOT THE ONE THE RECORD NAMES."
    echo "  The pull has already happened, so this run CONTINUES rather than aborting a deploy of a"
    echo "  tree that is now on disk. But every figure in that record belongs to the OTHER revision:"
    echo "  re-measure before quoting either side, and say which one a number came from."
    printf '%s\n' "$moved"
    echo "  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  else
    echo "  after-state record: $supplied field(s) supplied, 0 moved (nothing supplied = nothing compared)"
  fi
}
# <<< ANTUM GATE DECISION

echo "--- 0. the public gate's host credential ---"
if [ "$RESTART_ONLY" -eq 1 ] || [ "$PREFLIGHT" -eq 1 ]; then
  # THESE TWO MODES PULL NOTHING, so the tree on disk IS the tree that will be served and the decision
  # taken here is taken against the right tree. --restart-only keeps it for a second reason: a restart
  # is exactly when a missing host file surfaces as a 503, and it has to be repaired BEFORE the product
  # comes back, not after.
  gate_decision "no pull happens in this mode, so the tree on disk IS the tree being served"
else
  echo "  DEFERRED to step 1c: a full movement pulls a NEW tree in step 1, and the gate decision must be"
  echo "  taken against the tree that will actually be served. Taken HERE it judged the PRE-pull tree on"
  echo "  2026-11-08, minted no cookie, and then verified the gate page as though it were the product."
fi

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
  # The after-state is still NAMED here — the tree did not move, and saying so is the point: a
  # restart-only recovery ships whatever is on disk, and the record it is compared with must not be
  # assumed to describe it. Nothing is rebuilt, so the bundle is the one the last movement built.
  print_after_state "a restart-only recovery: the tree on disk, whose client/dist this run did NOT rebuild"
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

echo "--- 1c. the public gate's credential, judged against the tree that will be SERVED ---"
# THE FIX FOR 2026-11-08. This decision used to be taken in step 0, BEFORE the pull: on the movement
# that deployed b8976b0 the deployed tree was still the ungated 8a4e1ac, so mint_gate_cookie answered
# "not minted — this tree predates the public gate" (which was TRUE of 8a4e1ac), and the run then
# pulled a GATED tree, built it, restarted it and judged it with an EMPTY cookie. The decision is taken
# HERE — after the pull, before the build and the restart — so the presence of server/public-gate.js in
# the tree being deployed is what decides whether a credential is minted, and the revision it judged is
# printed beside the answer.
gate_decision "after the pull, before the build: this is the tree this run will serve"

echo "--- 2. build the client (must succeed before anything is restarted) ---"
( cd client && NODE_OPTIONS=--max-old-space-size=700 npm run build ) > "$BUILD_LOG" 2>&1
BUILD_RC=$?
tail -6 "$BUILD_LOG"
if [ $BUILD_RC -ne 0 ]; then
  echo "FAIL: client build failed (rc=$BUILD_RC). Live site left as it was. Full log: $BUILD_LOG"
  exit 1
fi
echo "client build OK"

echo "--- 2b. THE AFTER-STATE OF THIS RUN ---"
# Name the revision and the bytes that ACTUALLY shipped, from this run's own pull and build — and
# compare them with the preflight's record when the operator supplied one. A movement that reports only
# "client build OK" cannot be compared with anything, and on 2026-11-08 #387 merged between the
# preflight (14:02:36Z) and the pull (14:03:09Z): the tree moved under the run and nothing said so.
print_after_state "a full movement: the pulled revision and the bundle this run built"

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
# ===================================================================================================
# THE PUBLIC URL, PROVEN TO BE THE PRODUCT — NOT MERELY TO ANSWER 200.
#
# This was ONE LINE until 2026-11-08:
#   echo "public status/title: $(curl ... -w '%{http_code}' "$PUBLIC") $(grep -o '<title>...' ...)"
# and on the movement that deployed b8976b0 it recorded
#   public status/title: 200 <title>Antum People — access</title>
# — the PUBLIC GATE's own title, read as if it were the product, because step 0 had minted no cookie
# against the pre-pull tree. The row was green and the product had not been looked at once.
#
# verify_public_product() asserts the served document names the entry the BUILT client/dist names and
# that the served bytes are the file on disk; on a gated tree it also asserts the cookieless URL is
# the gate page and the cookieless asset is not the product's bytes; and on a gated tree with NO minted
# cookie it refuses outright instead of comparing anything.
#
# The failure is CARRIED to the end of the run (PRODUCT_RC) rather than exiting here: step 6 re-arms
# the guard from a running product, and a verification that leaves the site unguarded has done more
# harm than the defect it found. Same shape as the settlement check below.
# ===================================================================================================
echo "--- 5a. is what the public URL serves THE PRODUCT? ---"
PRODUCT_RC=0
verify_public_product || PRODUCT_RC=$?
echo "bad-password path: $(curl -s --noproxy '*' -H "Cookie: $GATE_COOKIE_HEADER" -o /dev/null -w '%{http_code}' --max-time 20 -X POST -H 'Content-Type: application/json' --data-binary '{"username":"admin","password":"nope"}' "$PUBLIC/api/login") (expect 401)"
echo "roster: $ROSTER_CODE"
echo "  employees: $ROSTER_N | first id: $ROSTER_FIRST"
# The re-seed exists to leave the demo in three distinct flag states, so the RUN must prove it
# rather than the operator checking by hand afterwards. This is also the reading that goes stale
# fastest: the flags are derived from the seed day's offsets, so an early re-seed gives a
# different configuration from a late one. Run-stamped, per the rule that a fixed evidence path
# lets the next run overwrite this one's bytes.
echo "pre-boarding demo state as the live API serves it (expect three distinct flag states):"
PB_JSON="/tmp/cutover-$STAMP-pb-overview.json"
PB_CODE=$(curl -s --noproxy '*' --max-time 25 -o "$PB_JSON" -w '%{http_code}' -H "Authorization: Bearer $TOK" -H "Cookie: $GATE_COOKIE_HEADER" \
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
OFF_CODE=$(curl -s --noproxy '*' --max-time 25 -o "$OFF_JSON" -w '%{http_code}' -H "Authorization: Bearer $TOK" -H "Cookie: $GATE_COOKIE_HEADER" \
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
SETTLE_CODE=$(curl -s --noproxy '*' --max-time 25 -o "$SETTLE" -w '%{http_code}' -H "Authorization: Bearer $TOK" -H "Cookie: $GATE_COOKIE_HEADER" \
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
# MOVED (2026-11-08) — this used to be a --restart-only-only block HERE, deriving the asset name from
# the public HTML and comparing it with the file of that name on disk. It could not tell the gate page
# from the product (the gate page names no asset, so it reported "the placeholder is being served"),
# and it only ran on one of the two paths. It is now ONE mechanism for BOTH paths —
# verify_public_product() in step 5a, which names the entry from the BUILT dist instead of from the
# served document and is gate-aware. Its failure is carried to the end of the run (PRODUCT_RC), which
# is what this block's position after step 6b was there to buy.

echo "deployed commit: $(git log --oneline -1)"
FAILED_WHY=""
if [ "${SETTLE_RC:-0}" -ne 0 ]; then
  FAILED_WHY="the settlement check (rc=$SETTLE_RC — $SETTLE_KIND)"
fi
if [ "${PRODUCT_RC:-0}" -ne 0 ]; then
  FAILED_WHY="${FAILED_WHY:+$FAILED_WHY; }the public product assertion (rc=$PRODUCT_RC — the product was NOT proven; see step 5a)"
fi
if [ -n "$FAILED_WHY" ]; then
  # Deliberately the LAST thing, after step 6 and 6b: the guard is armed and the hook installed by
  # now, so a red verification can fail the run without leaving the product unguarded.
  echo "=== cutover finished $(date -Iseconds) WITH A FAILED VERIFICATION ($FAILED_WHY) — run-stamped evidence: $OUT | build: $BUILD_LOG | seed: $SEED_LOG ==="
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
