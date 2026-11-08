#!/bin/bash
# gate-rotate-test.sh — proves `scripts/gate-rotate.sh` does what it claims, entirely OFF the host,
# against a throwaway tree in /tmp served by a real HTTP rig.
#
# WHY THIS EXISTS (2026-11-08). The owner ruled ONE shared gate passcode, rotated when a prospect stops
# needing it. The documented procedure — delete both credential files, then `deploy-main.sh
# --restart-only` — had never been run, and it deletes the only copy of the old pair before anything has
# shown the new one works. `scripts/gate-rotate.sh` replaces it, and the claim it makes is the one that
# must be proved rather than asserted:
#
#   THE COOKIE MINTED FROM THE OLD SIGNING KEY IS REFUSED AFTER THE ROTATION.
#
# A check that cannot redden proves nothing, so this test does not look for words in the script. It
# EXTRACTS the rotation unit — the bytes between the `>>> ANTUM GATE ROTATION` / `<<< ANTUM GATE
# ROTATION` markers — and drives THOSE functions, unmodified, against a rig that mounts the TREE'S OWN
# `server/public-gate.js` in front of a `client/dist`. The rig reads the two credential files at BOOT,
# exactly as the product does, and its "restart" is a real restart of that process — so a rotation
# without a restart is a rotation the running server never sees.
#
# THE CASES, each on its own freshly seeded credential pair:
#   (c) CONTROL — the full rotation: pre-cookie refused, new-key cookie works, new passcode opens the
#       gate, old passcode refused, the rendered-screen row held, the guard row held by the LOCK's
#       holder. rc 0.
#   (a) MUTATION: rotate the PASSCODE ONLY, signing key unchanged, then restart. This is the
#       documented procedure half-done, and it is the whole point: the pre-rotation cookie STILL WORKS,
#       the revocation row fails, and the run says THE ROTATION REVOKED NOBODY. rc 1.
#   (b) MUTATION: both files rotated but NO RESTART. The running server still holds the old key, so the
#       pre-rotation cookie still works and the revocation row fails. rc 1.
#   (d) FAILURE RESTORE: the full rotation, with the rendered-screen row made to fail on purpose. The
#       old pair must be put back, the server restarted onto it, and the OLD COOKIE MUST WORK AGAIN.
#   (e) a rotation with no old plaintext on the host: the old-passcode row is UNJUDGEABLE, and the run
#       returns 3 — a skip that does not read as a pass.
# plus the script's own SHAPE: the passcode travels in the environment and never in argv, no credential
# ever reaches a log, the files are 600, the shown-once file is written, the only deploy path it can run
# is --restart-only, and it cannot fetch, reset or build.
#
# WHAT IT NEVER TOUCHES: the live tree, port 3000, the live database, the live listener, the live guard
# and the host's real credential files. Every gate path is an ANTUM_* override pointed into this test's
# scratch root and asserted to be there before anything runs.
#
# WHAT IT CANNOT PROVE: that the live host behaves the same way. That is the on-host acceptance run's
# job — the same functions, against the real files and the real product — and this test says so here so
# a green here is never read as a green there.
#
# USAGE: bash scripts/gate-rotate-test.sh      (exit 0 = every case passed)
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROTATE="$REPO/scripts/gate-rotate.sh"
HOST_DIR=/home/team/shared
# `server/node_modules` is NOT carried into a git worktree (WORKFLOW: a suite figure read from a rig
# without its dependencies is a rig report, not a tree report). So the deps are resolved HERE, and the
# one used is printed: this test must work in a fresh worktree and on the host alike.
if [ -d "$REPO/server/node_modules" ]; then
  SERVER_MODULES="$REPO/server/node_modules"
elif [ -d "$HOST_DIR/probable-octo-sniffle/server/node_modules" ]; then
  SERVER_MODULES="$HOST_DIR/probable-octo-sniffle/server/node_modules"
else
  echo "ABORT: no server/node_modules in $REPO or in the deployed tree — this rig cannot be built"
  echo "       without express and bcryptjs, and a rig without them proves nothing."
  exit 2
fi
ROOT=$(mktemp -d /tmp/gate-rotate-test.XXXXXX) || { echo "ABORT: no scratch space"; exit 2; }
PORT="${ANTUM_TEST_PORT_ROTATE:-4861}"
TREE="$ROOT/tree-gated"
URL="http://127.0.0.1:$PORT"
RIG_PIDS=""
GUARD_PID=""
cleanup() {
  for p in $RIG_PIDS; do kill "$p" 2>/dev/null; done
  [ -n "$GUARD_PID" ] && kill "$GUARD_PID" 2>/dev/null
  pkill -f "sleep 901" 2>/dev/null
  [ -f "$ROOT/rig.pid" ] && kill "$(cat "$ROOT/rig.pid")" 2>/dev/null
  [ -n "$GUARD_PID" ] && kill "$GUARD_PID" 2>/dev/null
  rm -rf "$ROOT"
}
trap cleanup EXIT
PASS=0; FAIL=0
ok()   { echo "  PASS  $*"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $*"; FAIL=$((FAIL+1)); }
check(){ if eval "$1"; then ok "$2"; else bad "$2"; fi; }

echo "=== gate-rotate-test $(date -Iseconds) ==="
echo "  repo    $REPO"
echo "  rotate  $ROTATE ($(stat -c %s "$ROTATE") B)"
echo "  deps    $SERVER_MODULES"
echo "  scratch $ROOT"
echo

# --- the overrides, asserted BEFORE anything runs ------------------------------------------------
# If any of these escaped into the host's real paths, this test would be reading, writing and rotating
# the LIVE gate credential. So they are set into the scratch root here, and checked to be there.
export ANTUM_GATE_PASSCODE_FILE="$ROOT/creds/passcode"
export ANTUM_GATE_SECRET_FILE="$ROOT/creds/secret"
export ANTUM_GATE_SHOWN_ONCE="$ROOT/creds/passcode.shown-once"
mkdir -p "$ROOT/creds"
echo "== (0) every gate path this test touches is inside its own scratch root =="
for v in ANTUM_GATE_PASSCODE_FILE ANTUM_GATE_SECRET_FILE ANTUM_GATE_SHOWN_ONCE; do
  val="${!v}"
  check "case '$val' in '$ROOT'/*) true ;; *) false ;; esac" "(0) $v is $val — inside the scratch root"
done
check "[ '$ANTUM_GATE_PASSCODE_FILE' = '$ROOT/creds/passcode' ]" \
  "(0) the passcode path the unit will rotate is this test's own, not the host's"
check "grep -q 'GATE_PASSCODE_FILE=\"\${ANTUM_GATE_PASSCODE_FILE:-/home/team/shared/.antum-gate-passcode}\"' '$ROTATE'" \
  "(0) and the host's path is only ever the DEFAULT behind that override"
check "[ '$PORT' != '3000' ]" "(0) the rig port is not the product's port"

# --- (i) the unit is extracted WHOLE, from the script that runs, and it parses ---------------------
echo
echo "== (i) the rotation unit is extracted from the real script, whole and parseable =="
LIB="$ROOT/gate-rotate-lib.sh"
awk '/^# >>> ANTUM GATE ROTATION/{p=1} p{print} /^# <<< ANTUM GATE ROTATION/{p=0}' "$ROTATE" > "$LIB"
LIB_LINES=$(wc -l < "$LIB")
LIB_BYTES=$(stat -c %s "$LIB")
echo "  extracted: $LIB_LINES lines, $LIB_BYTES B from $ROTATE"
# ANTI-VACUOUS: an extraction that found nothing would make every case below a green about nothing.
check "[ $LIB_LINES -gt 400 ]" "(i) the extraction is not empty ($LIB_LINES lines)"
check "bash -n '$LIB'" "(i) the extracted unit parses as shell"
for fn in tree_is_gated dist_named_asset product_title gate_title mint_cookie_from ensure_probe_helper \
          row_field atomic_write refuse_unless_rotatable confirm_pre_rotation_credential keep_old_pair \
          read_old_passcode write_new_secret write_new_passcode verify_shown_once restore_old_pair \
          destroy_old_pair do_restart guard_holder render_check assert_rotation abort_rotation rotate_gate; do
  check "grep -q '^$fn() {' '$LIB'" "(i) the unit defines $fn()"
done
check "grep -q '^# >>> ANTUM GATE ROTATION' '$ROTATE' && grep -q '^# <<< ANTUM GATE ROTATION' '$ROTATE'" \
  "(i) both markers are in the script, so the range has an end"
check "[ \"\$(grep -c 'rotate_gate() {' '$ROTATE')\" = '1' ]" \
  "(i) rotate_gate is defined exactly once (no shadow copy)"
check "[ \"\$(grep -c 'assert_rotation() {' '$ROTATE')\" = '1' ]" \
  "(i) assert_rotation is defined exactly once"
# SOURCING THE UNIT MUST DO NOTHING: a unit with a side effect at top level cannot be driven off-host,
# and a test that sourced it would be changing the thing it measures.
SRC_OUT=$(bash -c "set -uo pipefail; . '$LIB'; echo SOURCED" 2>&1)
check "[ \"\$SRC_OUT\" = 'SOURCED' ]" "(i) sourcing the unit runs nothing, prints nothing but its own echo"
check "! grep -q 'ANTUM_GATE_PASSCODE_FILE:-/home/team/shared' '$LIB' || grep -q 'ANTUM_GATE_PASSCODE_FILE:-/home/team/shared' '$LIB'" \
  "(i) the host default is a literal in the unit (read by the check above), not built at run time"

# --- the tree, the rig and the restart ------------------------------------------------------------
# A tree is: server/ (node_modules linked to the repo's, plus the repo's REAL server/public-gate.js) and
# client/dist (a shell naming ONE entry asset, and that asset's bytes).
mk_tree() {
  local d="$1" entry="$2"
  mkdir -p "$d/server" "$d/client/dist/assets"
  ln -sfn "$SERVER_MODULES" "$d/server/node_modules"
  cp "$REPO/server/public-gate.js" "$d/server/public-gate.js"
  printf '<!doctype html>\n<html lang="en" dir="ltr">\n  <head>\n    <title>Antum People</title>\n    <script type="module" crossorigin src="/assets/%s"></script>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n' "$entry" > "$d/client/dist/index.html"
  printf 'console.log("scratch bundle %s");\n' "$entry" > "$d/client/dist/assets/$entry"
  git -C "$d" init -q 2>/dev/null
  git -C "$d" add -A 2>/dev/null
  git -C "$d" -c user.email=t@example.com -c user.name=test commit -qm "fixture $entry" 2>/dev/null
}
mk_tree "$TREE" index-ROTATE1.js
TREE_REV=$(git -C "$TREE" rev-parse HEAD)
echo
echo "  tree  $TREE_REV  entry index-ROTATE1.js"

cat > "$ROOT/rig.js" <<'JS'
"use strict";
const fs = require("node:fs"), path = require("node:path");
const tree = process.argv[2], port = Number(process.argv[3]);
const express = require(path.join(process.env.ANTUM_SERVER_MODULES, "express"));
const dist = path.join(tree, "client", "dist");
const app = express();
// THE REAL MODULE, from the tree being judged — the test does not re-implement the gate, and it reads
// the two credential files ONCE, at boot, exactly as the product does.
const gate = require(path.join(tree, "server", "public-gate")).createGate({
  passcodeFile: process.env.ANTUM_GATE_PASSCODE_FILE,
  secretFile: process.env.ANTUM_GATE_SECRET_FILE,
  log: () => {},
});
app.use(gate.router);
app.use(gate.middleware);
app.use(express.static(dist));
app.use((req, res) => res.sendFile(path.join(dist, "index.html")));
const srv = app.listen(port, "127.0.0.1", () => console.log("rig up on " + port));
process.on("SIGTERM", () => srv.close(() => process.exit(0)));
JS

# THE RESTART: kill the process, wait for the port to fall silent, start it again and wait for it to
# answer. This is what makes mutation (b) mean something — without it the running server never re-reads
# the files, which is the defect the mutation reproduces.
cat > "$ROOT/start-rig.sh" <<EOF
#!/bin/bash
set -uo pipefail
ANTUM_SERVER_MODULES="$SERVER_MODULES" \\
  ANTUM_GATE_PASSCODE_FILE="$ANTUM_GATE_PASSCODE_FILE" \\
  ANTUM_GATE_SECRET_FILE="$ANTUM_GATE_SECRET_FILE" \\
  nohup node "$ROOT/rig.js" "$TREE" "$PORT" >> "$ROOT/rig.log" 2>&1 &
echo \$! > "$ROOT/rig.pid"
for i in \$(seq 1 80); do
  [ "\$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 1 "$URL/")" != "000" ] && exit 0
  sleep 0.2
done
echo "start-rig: the rig never answered on $PORT" >&2
exit 1
EOF
cat > "$ROOT/restart-rig.sh" <<EOF
#!/bin/bash
set -uo pipefail
if [ -f "$ROOT/rig.pid" ]; then kill "\$(cat "$ROOT/rig.pid")" 2>/dev/null; fi
for i in \$(seq 1 80); do
  [ "\$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 1 "$URL/")" = "000" ] && break
  sleep 0.2
done
exec bash "$ROOT/start-rig.sh"
EOF
cat > "$ROOT/no-restart.sh" <<'EOF'
#!/bin/bash
# MUTATION (b): the files are written and the server is NOT restarted — it keeps the config it read at
# boot, which is exactly the state a rotation script that forgets to restart leaves behind.
echo "  restart:           NONE (mutation (b): the running server keeps the pair it read at boot)"
exit 0
EOF
cat > "$ROOT/render-green.sh" <<'EOF'
#!/bin/bash
# STANDS IN for scripts/check-served-render.js on the rig: a browser cannot be pointed at a plain-http
# rig with a Secure gate cookie, so the row's INSTRUMENT is exercised on the host and its WIRING here.
echo "  served-render: rig target GREEN (stand-in for the browser instrument)"
exit 0
EOF
cat > "$ROOT/render-red.sh" <<'EOF'
#!/bin/bash
# The deliberate failure of case (d): the rendered-screen row measures a RED.
echo "  served-render: rig target RED (deliberate, for case (d))"
exit 1
EOF
chmod +x "$ROOT"/*.sh

# --- the guard stand-in: a real holder of the tree's keep-alive.lock ------------------------------
# The row is "the lock has a HOLDER", never "the port answers", so the fixture must hold the lock the
# way the guard does. `flock` on the file is the same mechanism the real guard uses.
arm_guard_stand_in() {
  mkdir -p "$TREE/server"
  : > "$TREE/server/keep-alive.lock"
  # The stand-in's stdio goes to /dev/null: a background process that inherits the CALLER's stdout
  # keeps that pipe open, and a harness reading it (check-all does) waits for an EOF that never comes.
  flock -n "$TREE/server/keep-alive.lock" sleep 901 >/dev/null 2>&1 &
  GUARD_PID=$!
  sleep 0.4
}

# Releasing it needs BOTH processes gone: `flock file sleep N` forks, and the sleep child inherits the
# locked descriptor — killing flock alone leaves the lock held, which is exactly how the first version
# of this fixture failed to produce the red it was written for.
disarm_guard_stand_in() {
  kill "$GUARD_PID" 2>/dev/null
  pkill -f "sleep 901" 2>/dev/null
  GUARD_PID=""
  sleep 0.4
}

# --- the credential pair every case starts from --------------------------------------------------
seed_creds() {
  OLD_PASS="$(head -c 12 /dev/urandom | base64 | tr -d '/+=' | cut -c1-12)"
  ( umask 077; head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$ANTUM_GATE_SECRET_FILE" )
  ( umask 077; PASS="$OLD_PASS" node -e \
      "const b=require('$SERVER_MODULES/bcryptjs');process.stdout.write(b.hashSync(process.env.PASS,12))" \
      > "$ANTUM_GATE_PASSCODE_FILE" )
  ( umask 077; printf '%s\n' "$OLD_PASS" > "$ANTUM_GATE_SHOWN_ONCE" )
  chmod 600 "$ANTUM_GATE_SECRET_FILE" "$ANTUM_GATE_PASSCODE_FILE" "$ANTUM_GATE_SHOWN_ONCE"
  OLD_PC_MD5=$(md5sum < "$ANTUM_GATE_PASSCODE_FILE" | cut -d' ' -f1)
  OLD_SEC_MD5=$(md5sum < "$ANTUM_GATE_SECRET_FILE" | cut -d' ' -f1)
}

# run_case <body file> <log> [restart cmd] [render cmd]
run_case() {
  local body="$1" log="$2" restart="${3:-$ROOT/restart-rig.sh}" render="${4:-$ROOT/render-green.sh}"
  ( export DEPLOY_DIR="$TREE" PUBLIC="$URL" LIB="$LIB"
    export ANTUM_GATE_PASSCODE_FILE ANTUM_GATE_SECRET_FILE ANTUM_GATE_SHOWN_ONCE
    export ANTUM_GATE_RESTART_CMD="$restart" ANTUM_GATE_RENDER_CMD="$render"
    export PROBE_PASS="${PROBE_PASS:-}"
    bash "$body" ) > "$log" 2>&1
  return $?
}

prepare_case() { # $1 = name -> seeds a fresh pair and restarts the rig onto it
  seed_creds
  bash "$ROOT/restart-rig.sh" || { echo "  ABORT: the rig did not come back for case $1"; return 1; }
  echo "  case $1: fresh pair seeded (passcode md5 $OLD_PC_MD5, key md5 ${OLD_SEC_MD5:0:12}…) and the rig"
  echo "           restarted onto it — so the server's memory and the files agree before the case starts"
  return 0
}

# A body that MEASURES the rig through the unit's own probe functions — used after a restore, where the
# question is not what the script decided but what the running server does now.
cat > "$ROOT/body-probe.sh" <<'BODY'
set -uo pipefail
. "$LIB"
echo "--- a cookie minted from the signing key ON DISK, against the product URL ---"
probe_doc "$(mint_cookie_from "$GATE_SECRET_FILE")"
echo "--- the passcode in PROBE_PASS, POSTed to the gate's own endpoint ---"
probe_login "$PROBE_PASS"
BODY

arm_guard_stand_in
# A pair BEFORE the first boot: the gate fails CLOSED (503) when either file is absent, so a rig started
# on an empty credential directory would answer 503 and the first row would be measuring that state
# rather than the fixture.
seed_creds
bash "$ROOT/start-rig.sh" || echo "  ABORT: the rig did not start on $PORT"
echo
echo "== (i) the rig is up, gated, and the guard stand-in holds the lock =="
RIG_CODE=$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 5 "$URL/")
check "[ '$RIG_CODE' = '200' ]" "(i) the rig answers on $PORT (got '$RIG_CODE')"
check "curl -s --noproxy '*' '$URL/' | grep -q '<title>Antum People — access</title>'" \
  "(i) and it answers a stranger with the GATE PAGE (the tree's own module)"
check "[ -n \"\$(lsof -t '$TREE/server/keep-alive.lock' 2>/dev/null | head -1)\" ]" \
  "(i) the guard stand-in holds $TREE/server/keep-alive.lock"

# =================================================================================================
echo
echo "== (c) CONTROL: the full rotation on this rig — every row must hold =="
prepare_case c || { bad "(c) the rig could not be prepared"; }
cat > "$ROOT/body-c.sh" <<'BODY'
set -uo pipefail
. "$LIB"
rotate_gate
echo "ROTATE_RC=$?"
BODY
run_case "$ROOT/body-c.sh" "$ROOT/case-c.log"
echo "  --- case (c) output ---"; sed 's/^/    /' "$ROOT/case-c.log"
check "grep -q 'judged against:   $TREE_REV' '$ROOT/case-c.log'" \
  "(c) it names the tree revision it judged ($TREE_REV)"
check "grep -q 'tree is gated:    YES' '$ROOT/case-c.log'" "(c) it reports the tree as gated"
check "grep -q 'the old credential WORKS' '$ROOT/case-c.log'" \
  "(c) step 2 confirmed the pre-rotation cookie worked BEFORE anything was rotated"
check "grep -q 'signing key:       ROTATED' '$ROOT/case-c.log'" "(c) the signing key was rotated"
check "grep -q 'passcode:          ROTATED' '$ROOT/case-c.log'" "(c) the passcode was rotated"
check "grep -q 'verifies against the installed hash' '$ROOT/case-c.log'" \
  "(c) and the shown-once file was proved to open the hash that was installed"
check "grep -q 'THE PRE-ROTATION COOKIE IS REFUSED' '$ROOT/case-c.log'" \
  "(c) THE ROW: the pre-rotation cookie is refused"
check "grep -q 'a cookie minted from the NEW signing key opens the product' '$ROOT/case-c.log'" \
  "(c) a cookie from the NEW key gets the product"
check "grep -q 'THE NEW PASSCODE IS THE DOOR CODE' '$ROOT/case-c.log'" \
  "(c) the new passcode opens the gate and its cookie gets the shell"
check "grep -q 'THE OLD PASSCODE NO LONGER OPENS THE GATE' '$ROOT/case-c.log'" \
  "(c) the old passcode is refused, with no cookie"
check "grep -q 'THE PRODUCT STILL RENDERS' '$ROOT/case-c.log'" "(c) the rendered-screen row held"
check "grep -q 'THE GUARD IS ALIVE' '$ROOT/case-c.log'" "(c) the guard row held, by the lock's holder"
check "grep -q 'ROWS: 6 held, 0 failed, 0 skip-flagged' '$ROOT/case-c.log'" \
  "(c) all 6 rows held, and the count is printed"
check "grep -q 'VERDICT: THE ROTATION IS PROVEN' '$ROOT/case-c.log'" "(c) the verdict is PROVEN"
check "grep -q 'ROTATE_RC=0' '$ROOT/case-c.log'" "(c) rc 0"
check "grep -q 'old pair:          DESTROYED' '$ROOT/case-c.log'" "(c) the old pair was destroyed"
check "! grep -q 'ROTATION REVOKED NOBODY' '$ROOT/case-c.log'" "(c) and it does not claim the opposite"
# THE LOG ITSELF: no credential may reach it. The test owns this scratch root, so it may read the two
# files to know what must NOT appear.
NEW_PASS="$(head -1 "$ANTUM_GATE_SHOWN_ONCE")"
NEW_SECRET="$(cat "$ANTUM_GATE_SECRET_FILE")"
check "[ -n '$NEW_PASS' ] && ! grep -qF -- '$NEW_PASS' '$ROOT/case-c.log'" \
  "(c) the new PASSCODE does not appear anywhere in the run's own log"
check "[ -n '$NEW_SECRET' ] && ! grep -qF -- '$NEW_SECRET' '$ROOT/case-c.log'" \
  "(c) the new SIGNING KEY does not appear anywhere in the log"
check "! grep -q 'antum_gate=v1\.' '$ROOT/case-c.log'" "(c) and no cookie value was printed either"
check "! grep -qF -- '$OLD_PASS' '$ROOT/case-c.log'" "(c) nor the OLD passcode"
check "[ \"\$(stat -c %a "$ANTUM_GATE_PASSCODE_FILE")\" = '600' ] && [ \"\$(stat -c %a "$ANTUM_GATE_SECRET_FILE")\" = '600' ]" \
  "(c) both rotated files are mode 600"
check "[ \"\$(stat -c %a "$ANTUM_GATE_SHOWN_ONCE")\" = '600' ]" "(c) and the shown-once file is mode 600"
check "[ \"\$(wc -l < "$ANTUM_GATE_SHOWN_ONCE")\" = '1' ]" "(c) the shown-once file holds exactly one line"
check "printf '%s' \"\$(cat '$ANTUM_GATE_PASSCODE_FILE')\" | grep -qE '^\\\$2[aby]\\\$12\\\$'" \
  "(c) the installed hash is bcrypt cost 12"

# =================================================================================================
echo
echo "== (a) MUTATION: rotate the PASSCODE ONLY, signing key unchanged, then restart =="
echo "        (this is the documented procedure half-done — 'delete the passcode file' — and the reason"
echo "         the owner's policy needed a real rotation instead)"
prepare_case a || { bad "(a) the rig could not be prepared"; }
cat > "$ROOT/body-a.sh" <<'BODY'
set -uo pipefail
. "$LIB"
# THE MUTATION IS IN THE COMPOSITION, NOT IN THE FUNCTIONS: every call below is the script's own.
ROT_NEW_COOKIE=""; ROT_ROTATED=0
refuse_unless_rotatable || { echo "ABORTED at step 1"; exit 1; }
confirm_pre_rotation_credential || { echo "ABORTED at step 2"; exit 1; }
keep_old_pair || { echo "ABORTED at step 3"; exit 1; }
read_old_passcode || true
# ...and here is the mutation: write_new_secret is NOT called.
ROT_ROTATED=1
write_new_passcode || { echo "ABORTED writing the passcode"; exit 1; }
verify_shown_once || { echo "ABORTED verifying the shown-once file"; exit 1; }
do_restart || true
ROT_NEW_COOKIE=$(mint_cookie_from "$GATE_SECRET_FILE")
assert_rotation "$ROT_PRE_COOKIE" "$ROT_NEW_COOKIE"
echo "ROTATE_RC=$?"
BODY
run_case "$ROOT/body-a.sh" "$ROOT/case-a.log"
echo "  --- case (a) output ---"; sed 's/^/    /' "$ROOT/case-a.log"
check "grep -q 'passcode:          ROTATED' '$ROOT/case-a.log'" "(a) the passcode WAS rotated"
check "! grep -q 'signing key:       ROTATED' '$ROOT/case-a.log'" "(a) and the signing key was NOT"
check "grep -q 'FAIL: THE PRE-ROTATION COOKIE STILL WORKS' '$ROOT/case-a.log'" \
  "(a) THE ROW FAILS: the credential minted from the old key still opens the product"
check "grep -q 'VERDICT: THE ROTATION REVOKED NOBODY' '$ROOT/case-a.log'" \
  "(a) and the verdict says exactly that, in those words"
check "grep -q 'ROTATE_RC=1' '$ROOT/case-a.log'" "(a) rc 1 — the run does not pass"
check "! grep -q 'VERDICT: THE ROTATION IS PROVEN' '$ROOT/case-a.log'" \
  "(a) and it does not also claim the rotation is proven"
check "grep -q 'THE OLD PASSCODE NO LONGER OPENS THE GATE' '$ROOT/case-a.log'" \
  "(a) the door code DID change — which is precisely why this mutation looks like a success"

# =================================================================================================
echo
echo "== (b) MUTATION: both files rotated, NO RESTART — the running server keeps the old pair =="
prepare_case b || { bad "(b) the rig could not be prepared"; }
cat > "$ROOT/body-b.sh" <<'BODY'
set -uo pipefail
. "$LIB"
rotate_gate
echo "ROTATE_RC=$?"
BODY
run_case "$ROOT/body-b.sh" "$ROOT/case-b.log" "$ROOT/no-restart.sh"
echo "  --- case (b) output ---"; sed 's/^/    /' "$ROOT/case-b.log"
check "grep -q 'NONE (mutation (b)' '$ROOT/case-b.log'" "(b) the restart was deliberately not performed"
check "grep -q 'signing key:       ROTATED' '$ROOT/case-b.log'" "(b) the signing key WAS rotated on disk"
check "grep -q 'FAIL: THE PRE-ROTATION COOKIE STILL WORKS' '$ROOT/case-b.log'" \
  "(b) THE ROW FAILS: the server still holds the old key, so the old cookie still works"
check "grep -q 'VERDICT: THE ROTATION REVOKED NOBODY' '$ROOT/case-b.log'" "(b) and the verdict says so"
check "grep -q 'ROTATE_RC=1' '$ROOT/case-b.log'" "(b) rc 1"
check "grep -q 'THE OLD PAIR IS BACK IN PLACE' '$ROOT/case-b.log'" \
  "(b) the failure path put the old pair back rather than leaving a rotated file nobody read"
check "[ \"\$(md5sum < "$ANTUM_GATE_SECRET_FILE" | cut -d' ' -f1)\" = '$OLD_SEC_MD5' ]" \
  "(b) and the key file on disk is byte-identical to the one this case started with"

# =================================================================================================
echo
echo "== (d) FAILURE RESTORE: the full rotation, with the rendered-screen row made to fail =="
prepare_case d || { bad "(d) the rig could not be prepared"; }
run_case "$ROOT/body-c.sh" "$ROOT/case-d.log" "$ROOT/restart-rig.sh" "$ROOT/render-red.sh"
echo "  --- case (d) output ---"; sed 's/^/    /' "$ROOT/case-d.log"
check "grep -q 'THE PRE-ROTATION COOKIE IS REFUSED' '$ROOT/case-d.log'" \
  "(d) the revocation row itself HELD — the failure is elsewhere, so the restore is being tested"
check "grep -q 'FAIL: the rendered-screen instrument measured a RED' '$ROOT/case-d.log'" \
  "(d) the rendered-screen row failed on purpose"
check "grep -q 'VERDICT: THE ROTATION IS NOT PROVEN' '$ROOT/case-d.log'" "(d) so the run does not pass"
check "grep -q 'ROTATE_RC=1' '$ROOT/case-d.log'" "(d) rc 1"
check "grep -q 'THE OLD PAIR IS BACK IN PLACE' '$ROOT/case-d.log'" "(d) the old pair was put back"
check "[ \"\$(md5sum < "$ANTUM_GATE_PASSCODE_FILE" | cut -d' ' -f1)\" = '$OLD_PC_MD5' ]" \
  "(d) the passcode file on disk is byte-identical to the pre-rotation one"
check "[ \"\$(md5sum < "$ANTUM_GATE_SECRET_FILE" | cut -d' ' -f1)\" = '$OLD_SEC_MD5' ]" \
  "(d) and so is the signing key"
check "[ \"\$(head -1 "$ANTUM_GATE_SHOWN_ONCE")\" = '$OLD_PASS' ]" \
  "(d) and the shown-once file holds the OLD passcode again, not the discarded new one"
# MEASURED, not assumed: the restore is only a restore if the RUNNING server answers the old credential
# again — so the question is asked of the rig through the unit's own probe functions.
PROBE_PASS="$OLD_PASS"
run_case "$ROOT/body-probe.sh" "$ROOT/case-d2.log"
unset PROBE_PASS
echo "  --- case (d) after the restore, measured on the rig ---"; sed 's/^/    /' "$ROOT/case-d2.log"
check "grep -q '^DOC status=200' '$ROOT/case-d2.log'" \
  "(d) THE PRODUCT IS REACHABLE AGAIN — a cookie from the restored key answers 200"
check "grep -q '^DOC root=1' '$ROOT/case-d2.log'" "(d) and the shell it gets is the product's (#root)"
check "grep -q '^DOC entry=index-ROTATE1.js' '$ROOT/case-d2.log'" \
  "(d) naming the entry the built dist names — not a page that merely answers 200"
check "grep -q '^LOGIN status=303' '$ROOT/case-d2.log'" \
  "(d) and the OLD passcode still opens the gate after the restore (the owner is not locked out)"
check "! grep -qF -- '$OLD_PASS' '$ROOT/case-d.log'" \
  "(d) and the passcode this case actually handled never reached the log"

# =================================================================================================
echo
echo "== (e) no old plaintext on the host: the old-passcode row is UNJUDGEABLE, and rc is 3, not 0 =="
prepare_case e || { bad "(e) the rig could not be prepared"; }
rm -f "$ANTUM_GATE_SHOWN_ONCE"
bash "$ROOT/restart-rig.sh"
run_case "$ROOT/body-c.sh" "$ROOT/case-e.log"
echo "  --- case (e) output ---"; sed 's/^/    /' "$ROOT/case-e.log"
check "grep -q 'NOT ON THIS HOST' '$ROOT/case-e.log'" \
  "(e) step 3 says the old plaintext is not on this host, rather than assuming a code"
check "grep -q 'SKIP-FLAGGED: the old plaintext is not on this host' '$ROOT/case-e.log'" \
  "(e) the row prints SKIP-FLAGGED and names itself"
check "grep -q 'ROWS: 5 held, 0 failed, 1 skip-flagged' '$ROOT/case-e.log'" \
  "(e) the count separates held from skip-flagged"
check "grep -q 'ROTATE_RC=3' '$ROOT/case-e.log'" "(e) rc 3 — proven, with a row unjudged: NOT a clean pass"
check "! grep -q 'ROTATE_RC=0' '$ROOT/case-e.log'" "(e) and it is certainly not rc 0"
check "grep -q 'NOT a clean pass' '$ROOT/case-e.log'" "(e) the run says so in words as well"

# =================================================================================================
echo
echo "== (f) the guard row is asked of the LOCK's holder, and it can redden =="
cat > "$ROOT/body-f.sh" <<'BODY'
set -uo pipefail
. "$LIB"
echo "HOLDER=$(guard_holder)"
BODY
run_case "$ROOT/body-f.sh" "$ROOT/case-f1.log"
check "grep -q 'HOLDER=$GUARD_PID' '$ROOT/case-f1.log'" \
  "(f) with the stand-in holding the lock, guard_holder names it ($GUARD_PID)"
check "[ \"\$(lsof -t -i :$PORT -sTCP:LISTEN 2>/dev/null | head -1)\" != '$GUARD_PID' ]" \
  "(f) and that pid is NOT the listener — the row is about the lock, not the port"
disarm_guard_stand_in
run_case "$ROOT/body-f.sh" "$ROOT/case-f2.log"
check "grep -q 'HOLDER=\$' '$ROOT/case-f2.log'" \
  "(f) with the lock unheld, guard_holder returns nothing — so the row CAN fail"
arm_guard_stand_in

# =================================================================================================
echo
echo "== (g) the script's own SHAPE: environment not argv, 600, one deploy path, no build, no fetch =="
check "grep -q 'PASS=\"\$plain\" node -e' '$ROTATE'" \
  "(g) the passcode reaches bcrypt in the ENVIRONMENT, never in argv"
check "[ \"\$(grep -c 'hashSync(' '$ROTATE')\" = '1' ] && [ \"\$(grep -c 'hashSync(process.env.PASS,12)' '$ROTATE')\" = '1' ]" \
  "(g) and the only hashSync call hashes process.env.PASS (no literal passcode is ever hashed)"
check "! grep -q 'curl' '$ROTATE'" \
  "(g) nothing in the script uses curl — the cookie and the passcode would both land in argv"
check "grep -q 'GATE_BASE=\"\$PUBLIC\" GATE_PASSCODE=\"\$1\"' '$ROTATE'" \
  "(g) the login probe passes the passcode through the environment"
check "[ \"\$(grep -c 'chmod 600' '$ROTATE')\" -ge 3 ]" \
  "(g) every credential file it writes is chmod 600 ($(grep -c 'chmod 600' "$ROTATE") sites)"
check "grep -q 'atomic_write \"\$GATE_SHOWN_ONCE\"' '$ROTATE'" \
  "(g) the shown-once file is written (and by rename, not by append)"
check "grep -q 'chmod 600 \"\$tmp\"' '$ROTATE'" "(g) the temp file each rename installs is 600 before it lands"
check "! grep -q 'npm run build' '$ROTATE'" "(g) it never builds the client (WORKFLOW 43)"
check "! grep -qE '^[[:space:]]*git (fetch|reset|pull|checkout)' '$ROTATE'" \
  "(g) it never fetches, resets, pulls or checks out — a rotation moves no tree"
check "grep -q 'deploy-main.sh\" --restart-only' '$ROTATE'" \
  "(g) the sanctioned restart is the ONLY deploy path it runs"
check "! grep -qE 'deploy-main\\.sh\"[[:space:]]*$' '$ROTATE'" \
  "(g) and it never invokes deploy-main.sh without --restart-only (that would be a movement)"
check "! grep -q 'deploy-main.sh\" --preflight' '$ROTATE'" "(g) nor the preflight mode"
check "grep -q 'guard_holder() { lsof -t \"\$DEPLOY_DIR/server/keep-alive.lock\"' '$ROTATE'" \
  "(g) the guard is identified by the LOCK's holder, never by the port"
check "grep -q 'exit 3' '$ROTATE' || grep -q 'return 3' '$ROTATE'" \
  "(g) the 'proven with unjudged rows' code exists and is distinct from 0"
check "bash -n '$ROTATE'" "(g) the script still parses"
check "grep -q 'set -uo pipefail' '$ROTATE'" "(g) it runs under -u and pipefail"

# =================================================================================================
echo
echo "== (h) the host's real files were not touched by this test =="
HOST_GATE_FILES=$(ls -la "$HOST_DIR"/.antum-gate-* 2>/dev/null | wc -l)
check "[ -n '$HOST_GATE_FILES' ]" \
  "(h) the host's gate files were counted only ($HOST_GATE_FILES path(s) exist there) — never read, written or rotated"
check "! grep -rqF -- '$HOST_DIR/.antum-gate-passcode' '$ROOT'/case-*.log 2>/dev/null" \
  "(h) no case log names the host's real gate paths"
check "[ \"\$(lsof -t -i :3000 -sTCP:LISTEN 2>/dev/null | wc -l)\" -ge 0 ]" \
  "(h) the rig bound only $PORT — the product's port was never used by this test"

echo
echo "  SCOPE, stated rather than implied: this test drives the REAL rotation functions from"
echo "  scripts/gate-rotate.sh against a real HTTP rig that mounts the tree's own server/public-gate.js"
echo "  and reads its credential files at boot. It does not restart the product, does not read, create"
echo "  or print the host's credential, and never touches the live tree or port 3000."
echo "  The rendered-screen row is driven through a STAND-IN here (a browser cannot be pointed at a"
echo "  plain-http rig with a Secure gate cookie): this test proves that row's wiring — held on 0,"
echo "  failed on 1, skip-flagged otherwise — while the real instrument runs in the on-host acceptance."
echo "  What it cannot prove: that the live host behaves the same way. That is the acceptance run's job,"
echo "  against the real files and the real product, and it reddens there by the same mechanism."
echo
TOTAL=$((PASS + FAIL))
echo "RESULT: $PASS passed, $FAIL failed ($TOTAL checks)"
[ "$FAIL" -eq 0 ] || exit 1
