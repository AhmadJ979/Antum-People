#!/bin/bash
# Antum People — the deploy path: move the live product to current origin/main, or restart it only.
#
#   bash scripts/deploy-main.sh                  full movement: fetch/reset -> build -> re-seed -> restart
#                                                -> verify -> guard -> hook
#   bash scripts/deploy-main.sh --restart-only   steps 4, 6 and 6b only: restart, re-arm the guard,
#                                                install the login-shell hook. No fetch, no reset, no
#                                                build, no re-seed — it cannot change which commit is
#                                                served.
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
case "${1:-}" in
  "")            : ;;
  --restart-only) RESTART_ONLY=1 ;;
  -h|--help)     sed -n '2,32p' "$0"; exit 0 ;;
  *)             echo "unknown argument: $1 (use --restart-only, or no argument for a full movement)"; exit 2 ;;
esac
# Run-stamped evidence paths. These were FIXED names until 2026-10-09, so every run silently
# destroyed the previous run's evidence: the 13:46 run overwrote the 10:46 run's three files,
# and the 10:46 record's /tmp citations then resolved to the LATER run's output — a false
# artifact filed under the earlier record's names. Never reuse a fixed evidence path across runs.
STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="/tmp/cutover-$STAMP-evidence.txt"
BUILD_LOG="/tmp/cutover-$STAMP-build.log"
SEED_LOG="/tmp/cutover-$STAMP-seed.log"

exec > >(tee "$OUT") 2>&1
echo "=== $( [ "$RESTART_ONLY" -eq 1 ] && echo 'restart-only recovery' || echo 'cutover' ) $(date -Iseconds) ==="
echo "  script: $0 | $(stat -c %s "$0" 2>/dev/null) B | sha256 $(sha256sum "$0" 2>/dev/null | cut -c1-16)"
echo "  tree:   $DEPLOY_DIR   port: $PORT   mode: $( [ "$RESTART_ONLY" -eq 1 ] && echo restart-only || echo full-movement )"

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
echo "public status/title: $(curl -s --noproxy '*' -o /tmp/cutover-page -w '%{http_code}' --max-time 25 "$PUBLIC") $(grep -o '<title>[^<]*</title>' /tmp/cutover-page | head -1)"
TOK=$(curl -s --noproxy '*' --max-time 25 -X POST -H 'Content-Type: application/json' \
  --data-binary "{\"username\":\"admin\",\"password\":\"$(cat "$PW_FILE")\"}" "$PUBLIC/api/login" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "demo login token chars: ${#TOK} (expect >100)"
echo "bad-password path: $(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 20 -X POST -H 'Content-Type: application/json' --data-binary '{"username":"admin","password":"nope"}' "$PUBLIC/api/login") (expect 401)"
echo "roster: $(curl -s --noproxy '*' -o /tmp/cutover-emp -w '%{http_code}' --max-time 25 -H "Authorization: Bearer $TOK" "$PUBLIC/api/employees")"
python3 - <<'PY'
import json
d=json.load(open('/tmp/cutover-emp'))
print("  employees:",len(d),"| first id:",d[0]['id'] if d else None)
PY
# The re-seed exists to leave the demo in three distinct flag states, so the RUN must prove it
# rather than the operator checking by hand afterwards. This is also the reading that goes stale
# fastest: the flags are derived from the seed day's offsets, so an early re-seed gives a
# different configuration from a late one. Run-stamped, per the rule that a fixed evidence path
# lets the next run overwrite this one's bytes.
echo "pre-boarding demo state as the live API serves it (expect three distinct flag states):"
curl -s --noproxy '*' --max-time 25 -H "Authorization: Bearer $TOK" \
  "$PUBLIC/api/preboarding/checklist/overview?jurisdiction=AE" > "/tmp/cutover-$STAMP-pb-overview.json"
python3 - <<PY
import json
d=json.load(open("/tmp/cutover-$STAMP-pb-overview.json"))
cases=d.get('cases',d) if isinstance(d,dict) else d
if isinstance(d,dict): print("  totals:", json.dumps(d.get('totals',{}), sort_keys=True))
for c in cases:
    f=c.get('flag') or {}; bt=c.get('by_track') or {}
    print("   start", c.get('start_date'), "|", f.get('state'), "| tone", f.get('tone'),
          "| open", f.get('open_count'), "| lines emp/ws",
          (bt.get('employee') or {}).get('lines'), (bt.get('workspace') or {}).get('lines'))
states=sorted({(c.get('flag') or {}).get('state') for c in cases} - {None})
print("  distinct flag states:", states, "(expect 3: clear, inside_48_hours, started)")
PY
echo "KSA offboarding checklist as the live API serves it:"
curl -s --noproxy '*' --max-time 25 -H "Authorization: Bearer $TOK" "$PUBLIC/api/employees/demo-emp-sarah/offboarding" \
 | python3 -c "import json,sys; d=json.load(sys.stdin); print('  tasks:',len(d)); [print('   ',i+1,t['title']) for i,t in enumerate(d)]"
echo "consent-date field for the departing employee:"
python3 - <<PY
import sqlite3
c=sqlite3.connect("$PRODUCT_DB")
print("  ", c.execute("select id, consent_granted, consent_date from employees where id='demo-emp-sarah'").fetchone())
PY
echo "settlement statement: rendered EOSB vs the employee record (must match):"
curl -s --noproxy '*' --max-time 25 -H "Authorization: Bearer $TOK" \
  "$PUBLIC/api/compliance/templates/final-settlement-statement/demo-emp-sarah" > /tmp/cutover-settlement.json
python3 - <<PY
import json, re, sqlite3
body = json.load(open('/tmp/cutover-settlement.json'))['content']
rec = sqlite3.connect("$PRODUCT_DB").execute(
    "select eosb_accrued from employees where id='demo-emp-sarah'").fetchone()[0]
rendered = re.search(r'EOSB[^|]*\|\s*\*\*?([0-9,]+\.[0-9]{2})', body.replace('\n', ' '))
rendered = rendered.group(1) if rendered else 'NOT FOUND'
brackets = re.findall(r'\[[A-Za-z_]+\]', body)
print("  record eosb_accrued:", rec, "| rendered:", rendered,
      "| match:", abs(float(rendered.replace(',','')) - float(rec)) < 0.01 if rendered != 'NOT FOUND' else False)
print("  unfilled [brackets]:", brackets if brackets else "NONE")
net = re.search(r'NET PAYABLE AMOUNT:\s*\*?\*?([0-9,]+\.[0-9]{2})', body.replace('*',' '))
print("  net payable:", net.group(1) if net else 'NOT FOUND')
PY

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
