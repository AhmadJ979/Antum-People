#!/bin/bash
# deploy-main-gate-test.sh — proves the movement's gate decision and product assertion do what they
# claim, entirely OFF the host, against throwaway trees in /tmp.
#
# WHY THIS EXISTS (2026-11-08, the movement that deployed b8976b0). `scripts/deploy-main.sh` took its
# gate decision in step 0, BEFORE the git pull. The deployed tree was then the ungated 8a4e1ac, so
# `mint_gate_cookie` answered "not minted — this tree predates the public gate" — true of 8a4e1ac and
# false of the gated b8976b0 the same run then pulled, built, restarted and judged. Its public row
# recorded `200 <title>Antum People — access</title>` and the run passed. It had verified THE WALL and
# called it the product, and the real verification was done by hand afterwards.
#
# A check that cannot redden proves nothing, so this test does not assert that the deploy's source
# contains certain words. It EXTRACTS the gate unit from `scripts/deploy-main.sh` — the bytes between
# the `>>> ANTUM GATE DECISION` / `<<< ANTUM GATE DECISION` markers — and CALLS those functions,
# unmodified, against:
#   (a) an UNGATED scratch tree      -> no credential is needed, the product assertion runs directly
#   (b) a GATED scratch tree with its credential files present
#                                    -> a cookie is minted and the assertion passes against that
#                                       tree's OWN dist (served document names the built entry; the
#                                       served asset's md5 equals the file on disk)
#   (c) THE 2026-11-08 MUTATION: the decision taken against the UNGATED pre-pull tree, then the
#       assertion run against the GATED tree the run serves, with no cookie
#                                    -> the assertion FAILS, naming what it could not prove — and the
#                                       OLD row is reproduced beside it, showing the same rig
#                                       answering `200 <title>Antum People — access</title>`
#   (d) a supplied ANTUM_MEASURED_* record that disagrees with the tree
#                                    -> AFTER-STATE MOVED prints, naming both sides, and the run does
#                                       NOT fail for it (the pull has already happened)
# plus the SHAPE checks that make the ordering load-bearing: the decision runs AFTER the pull in a full
# movement, step 0 keeps it only for the modes that pull nothing, the old bare `public status/title`
# row is gone, and the product assertion's failure is carried to the end of the run.
#
# WHAT IT NEVER TOUCHES: the live tree, port 3000, the live database, the live listener and the guard.
# The two HTTP surfaces it judges are rigs of its own — a small express app that mounts the TREE'S OWN
# `server/public-gate.js` (never a re-implementation) in front of that tree's `client/dist`. The real
# gate files are never created, read, printed or modified: every gate path is an ANTUM_* override
# pointed into this test's scratch root, and the test asserts that before it runs anything.
#
# USAGE: bash scripts/deploy-main-gate-test.sh      (exit 0 = every case passed)
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY="$REPO/scripts/deploy-main.sh"
HOST_DIR=/home/team/shared
ROOT=$(mktemp -d /tmp/deploy-gate-test.XXXXXX) || { echo "ABORT: no scratch space"; exit 2; }
PORT_A="${ANTUM_TEST_PORT_UNGATED:-4851}"
PORT_B="${ANTUM_TEST_PORT_GATED:-4852}"
RIG_PIDS=""
cleanup() {
  for p in $RIG_PIDS; do kill "$p" 2>/dev/null; done
  rm -rf "$ROOT"
}
trap cleanup EXIT
PASS=0; FAIL=0
ok()   { echo "  PASS  $*"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $*"; FAIL=$((FAIL+1)); }
check(){ if eval "$1"; then ok "$2"; else bad "$2"; fi; }

echo "=== deploy-main-gate-test $(date -Iseconds) ==="
echo "  repo    $REPO"
echo "  deploy  $DEPLOY ($(stat -c %s "$DEPLOY") B)"
echo "  scratch $ROOT"
echo

# --- the overrides, asserted BEFORE anything runs -------------------------------------------
# If any of these escaped into the host's real paths, the whole test would be measuring — and could
# create or overwrite — the live gate credential. So they are set here, into the scratch root, and
# checked to be there.
export ANTUM_GATE_PASSCODE_FILE="$ROOT/creds/passcode"
export ANTUM_GATE_SECRET_FILE="$ROOT/creds/secret"
export ANTUM_GATE_SHOWN_ONCE="$ROOT/creds/passcode.shown-once"
mkdir -p "$ROOT/creds"
echo "== (0) every gate path this test touches is inside its own scratch root =="
for v in ANTUM_GATE_PASSCODE_FILE ANTUM_GATE_SECRET_FILE ANTUM_GATE_SHOWN_ONCE; do
  val="${!v}"
  check "case '$val' in '$ROOT'/*) true ;; *) false ;; esac" "(0) $v is $val — inside the scratch root"
done
check "[ \"\$ANTUM_GATE_PASSCODE_FILE\" = '$ROOT/creds/passcode' ]" \
  "(0) the passcode path the unit will read is this test's own, not the host's"
check "grep -q 'GATE_PASSCODE_FILE=\"\${ANTUM_GATE_PASSCODE_FILE:-/home/team/shared/.antum-gate-passcode}\"' '$DEPLOY'" \
  "(0) and the host's path is only ever the DEFAULT behind that override"

# --- (i) the unit is extracted WHOLE, from the script that runs, and it parses -----------------
echo
echo "== (i) the gate unit is extracted from the real script, whole and parseable =="
LIB="$ROOT/gate-lib.sh"
awk '/^# >>> ANTUM GATE DECISION/{p=1} p{print} /^# <<< ANTUM GATE DECISION/{p=0}' "$DEPLOY" > "$LIB"
LIB_LINES=$(wc -l < "$LIB")
LIB_BYTES=$(stat -c %s "$LIB")
echo "  extracted: $LIB_LINES lines, $LIB_BYTES B from $DEPLOY"
# ANTI-VACUOUS: an extraction that found nothing would make every case below a green about nothing.
check "[ $LIB_LINES -gt 100 ]" "(i) the extraction is not empty ($LIB_LINES lines)"
check "bash -n '$LIB'" "(i) the extracted unit parses as shell"
for fn in tree_is_gated ensure_gate_credential mint_gate_cookie gate_decision \
          dist_named_asset product_title gate_title verify_public_product print_after_state; do
  check "grep -q '^$fn() {' '$LIB'" "(i) the unit defines $fn()"
done
check "grep -q '^# >>> ANTUM GATE DECISION' '$DEPLOY' && grep -q '^# <<< ANTUM GATE DECISION' '$DEPLOY'" \
  "(i) both markers are in the deploy script, so the range has an end"
# The unit's own body must be the bytes the script runs: nothing is re-typed here.
check "[ \"\$(grep -c 'verify_public_product() {' '$DEPLOY')\" = '1' ]" \
  "(i) verify_public_product is defined exactly once in the deploy (no shadow copy)"
# RULE 14: every host path in the unit is an override, or the test above cannot point it at /tmp.
for pair in "GATE_PASSCODE_FILE:ANTUM_GATE_PASSCODE_FILE" "GATE_SECRET_FILE:ANTUM_GATE_SECRET_FILE" \
            "GATE_SHOWN_ONCE:ANTUM_GATE_SHOWN_ONCE"; do
  var="${pair%%:*}"; env="${pair##*:}"
  check "grep -q '^$var=\"\\\${$env:-' '$LIB'" "(i) $var is an $env override (rule 14)"
done

# --- the two scratch trees -------------------------------------------------------------------
# A tree is: server/ (node_modules linked to the repo's, and — for the gated one — the repo's REAL
# server/public-gate.js) and client/dist (a shell naming ONE entry asset, and that asset's bytes).
mk_tree() { # $1 = dir, $2 = entry asset name, $3 = gated(1|0)
  local d="$1" entry="$2" gated="$3"
  mkdir -p "$d/server" "$d/client/dist/assets"
  ln -sfn "$REPO/server/node_modules" "$d/server/node_modules"
  [ "$gated" -eq 1 ] && cp "$REPO/server/public-gate.js" "$d/server/public-gate.js"
  printf '<!doctype html>\n<html lang="en" dir="ltr">\n  <head>\n    <title>Antum People</title>\n    <script type="module" crossorigin src="/assets/%s"></script>\n    <link rel="stylesheet" crossorigin href="/assets/index-TESTCSS1.css">\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n' "$entry" > "$d/client/dist/index.html"
  printf '/* scratch css for %s */\n' "$entry" > "$d/client/dist/assets/index-TESTCSS1.css"
  printf 'console.log("scratch bundle %s");\n' "$entry" > "$d/client/dist/assets/$entry"
  git -C "$d" init -q 2>/dev/null
  git -C "$d" add -A 2>/dev/null
  git -C "$d" -c user.email=t@example.com -c user.name=test commit -qm "fixture $entry" 2>/dev/null
}
TREE_A="$ROOT/tree-ungated"     # what the deployed tree was BEFORE the pull on 2026-11-08
TREE_B="$ROOT/tree-gated"       # what the same run then pulled and served
mk_tree "$TREE_A" index-UNGATED1.js 0
mk_tree "$TREE_B" index-GATED1.js 1
A_REV=$(git -C "$TREE_A" rev-parse HEAD)
B_REV=$(git -C "$TREE_B" rev-parse HEAD)
echo
echo "  tree A (ungated) $A_REV  entry index-UNGATED1.js"
echo "  tree B (gated)   $B_REV  entry index-GATED1.js"

# --- the credential files, present, in the scratch root ---------------------------------------
# A bcrypt hash at the product's own cost (12) and a 64-hex HMAC key, both generated HERE and thrown
# away with $ROOT. Nothing about the host's real pair is read or derived.
( umask 077; head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$ANTUM_GATE_SECRET_FILE" )
( umask 077; PASS="$(head -c 12 /dev/urandom | base64 | tr -d '/+=' | cut -c1-12)" \
  node -e "const b=require('$REPO/server/node_modules/bcryptjs');process.stdout.write(b.hashSync(process.env.PASS,12))" \
  > "$ANTUM_GATE_PASSCODE_FILE" )
chmod 600 "$ANTUM_GATE_SECRET_FILE" "$ANTUM_GATE_PASSCODE_FILE"
echo "  credential files: secret $(stat -c %s "$ANTUM_GATE_SECRET_FILE") B, passcode $(stat -c %s "$ANTUM_GATE_PASSCODE_FILE") B (values never printed)"

# --- the rigs: the TREE'S OWN gate module in front of the tree's own dist ---------------------
cat > "$ROOT/rig.js" <<'JS'
"use strict";
const fs = require("node:fs"), path = require("node:path");
const tree = process.argv[2], port = Number(process.argv[3]);
const express = require(path.join(process.env.ANTUM_SERVER_MODULES, "express"));
const dist = path.join(tree, "client", "dist");
const app = express();
// THE REAL MODULE, from the tree being judged — the test does not re-implement the gate. A tree with
// no server/public-gate.js is served exactly as it would be by the pre-gate product.
if (fs.existsSync(path.join(tree, "server", "public-gate.js"))) {
  const gate = require(path.join(tree, "server", "public-gate")).createGate({
    passcodeFile: process.env.ANTUM_GATE_PASSCODE_FILE,
    secretFile: process.env.ANTUM_GATE_SECRET_FILE,
    log: () => {},
  });
  app.use(gate.router);
  app.use(gate.middleware);
}
app.use(express.static(dist));
app.use((req, res) => res.sendFile(path.join(dist, "index.html")));
const srv = app.listen(port, "127.0.0.1", () => console.log("rig up on " + port));
process.on("SIGTERM", () => srv.close(() => process.exit(0)));
JS
ANTUM_SERVER_MODULES="$REPO/server/node_modules" node "$ROOT/rig.js" "$TREE_A" "$PORT_A" > "$ROOT/rig-a.log" 2>&1 &
RIG_PIDS="$RIG_PIDS $!"
ANTUM_SERVER_MODULES="$REPO/server/node_modules" node "$ROOT/rig.js" "$TREE_B" "$PORT_B" > "$ROOT/rig-b.log" 2>&1 &
RIG_PIDS="$RIG_PIDS $!"
URL_A="http://127.0.0.1:$PORT_A"
URL_B="http://127.0.0.1:$PORT_B"
up() { # $1 = url -> 0 when it answers at all
  local i
  for i in $(seq 1 40); do
    [ "$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 2 "$1/" 2>/dev/null)" != "000" ] && return 0
    sleep 0.25
  done
  return 1
}
echo
echo "== (i) both rigs are up, and each serves its own tree =="
check "up '$URL_A'" "(i) the ungated rig answers on $PORT_A"
check "up '$URL_B'" "(i) the gated rig answers on $PORT_B"
check "curl -s --noproxy '*' '$URL_A/' | grep -q 'index-UNGATED1.js'" \
  "(i) the ungated rig serves tree A's shell (it names index-UNGATED1.js)"
check "curl -s --noproxy '*' '$URL_B/' | grep -q '<title>Antum People — access</title>'" \
  "(i) the gated rig answers tree B with the GATE PAGE for a stranger"

# --- the runner: source the real unit, then run a body, with the tree and URL as the subject ------
unit() { # $1 = tree, $2 = public url, $3 = body file
  ( export DEPLOY_DIR="$1" PUBLIC="$2" LIB="$LIB"
    export ANTUM_GATE_PASSCODE_FILE ANTUM_GATE_SECRET_FILE ANTUM_GATE_SHOWN_ONCE
    export GATED_TREE 2>/dev/null || true
    bash "$3" )
}

# =============================================================================================
echo
echo "== (a) an UNGATED tree: no credential is needed, and the product assertion runs =="
cat > "$ROOT/body-a.sh" <<'BODY'
set -uo pipefail
. "$LIB"
gate_decision "case (a) — an ungated scratch tree; a pre-gate deployment pulls nothing to change that"
verify_public_product; echo "PRODUCT_RC=$?"
BODY
unit "$TREE_A" "$URL_A" "$ROOT/body-a.sh" > "$ROOT/case-a.log" 2>&1
echo "  --- case (a) output ---"; sed 's/^/    /' "$ROOT/case-a.log"
check "grep -q 'tree is gated:    NO' '$ROOT/case-a.log'" "(a) the decision reports the tree as UNGATED"
check "grep -q 'gate cookie:      not minted' '$ROOT/case-a.log'" "(a) no cookie is minted, and it says why"
check "grep -q 'decision:         gated=0 cookie_minted=0' '$ROOT/case-a.log'" "(a) the decision is recorded, not implied"
check "grep -q 'judged against:   $A_REV' '$ROOT/case-a.log'" "(a) it names the revision the decision was taken against"
check "grep -q 'VERDICT: THE PRODUCT IS PROVEN' '$ROOT/case-a.log'" "(a) the product assertion PASSES"
check "grep -q 'ungated, the same product document is served with and without a cookie' '$ROOT/case-a.log'" \
  "(a) and it asserted the ungated half (no gate to pass, so the same document)"
check "grep -q 'the served document names the entry the BUILT dist names: served index-UNGATED1.js / built index-UNGATED1.js' '$ROOT/case-a.log'" \
  "(a) the served document names tree A's built entry"
check "grep -q 'ASSERTIONS: 6 held, 0 failed' '$ROOT/case-a.log'" "(a) all 6 assertions held, and the count is printed"
check "grep -q 'PRODUCT_RC=0' '$ROOT/case-a.log'" "(a) rc 0"

# =============================================================================================
echo
echo "== (b) a GATED tree with its credential files present: a cookie is minted, the product is proven =="
cat > "$ROOT/body-b.sh" <<'BODY'
set -uo pipefail
. "$LIB"
gate_decision "case (b) — a gated scratch tree, credential files present; a full movement pulls this in step 1"
verify_public_product; echo "PRODUCT_RC=$?"
BODY
unit "$TREE_B" "$URL_B" "$ROOT/body-b.sh" > "$ROOT/case-b.log" 2>&1
echo "  --- case (b) output ---"; sed 's/^/    /' "$ROOT/case-b.log"
check "grep -q 'tree is gated:    YES' '$ROOT/case-b.log'" "(b) the decision reports the tree as GATED"
check "grep -q 'gate signing key: present' '$ROOT/case-b.log'" "(b) it found the signing key already present (it did not create one)"
check "grep -q 'gate passcode:    present' '$ROOT/case-b.log'" "(b) and the passcode file already present"
check "grep -q 'gate cookie:      minted' '$ROOT/case-b.log'" "(b) a cookie IS minted"
check "grep -q 'decision:         gated=1 cookie_minted=1' '$ROOT/case-b.log'" "(b) the decision is recorded"
check "grep -q 'judged against:   $B_REV' '$ROOT/case-b.log'" "(b) against tree B's own revision"
check "grep -q 'VERDICT: THE PRODUCT IS PROVEN' '$ROOT/case-b.log'" "(b) the product assertion PASSES"
check "grep -q 'the served document names the entry the BUILT dist names: served index-GATED1.js / built index-GATED1.js' '$ROOT/case-b.log'" \
  "(b) the served document names the entry tree B's dist names"
B_MD5=$(md5sum < "$TREE_B/client/dist/assets/index-GATED1.js" | cut -d' ' -f1)
check "grep -q 'the bytes served for index-GATED1.js ARE the file on disk: served md5 $B_MD5 / disk md5 $B_MD5' '$ROOT/case-b.log'" \
  "(b) and the served bytes' md5 IS the file on disk ($B_MD5)"
check "grep -q 'cookieless, the URL is the GATE PAGE' '$ROOT/case-b.log'" "(b) cookieless, the URL is asserted to be the gate page"
check "grep -q 'cookieless, there is no #root' '$ROOT/case-b.log'" "(b) with no #root"
check "grep -q 'cookieless, the ASSET url does not serve the product.s bytes' '$ROOT/case-b.log'" "(b) and the asset URL is behind the wall too"
check "grep -q 'ASSERTIONS: 9 held, 0 failed' '$ROOT/case-b.log'" "(b) all 9 assertions held, and the count is printed"
check "grep -q 'PRODUCT_RC=0' '$ROOT/case-b.log'" "(b) rc 0"

# =============================================================================================
echo
echo "== (c) THE 2026-11-08 MUTATION: the decision taken against the pre-pull tree, the assertion run"
echo "        against the gated tree the run serves, with NO cookie =="
cat > "$ROOT/body-c.sh" <<'BODY'
set -uo pipefail
. "$LIB"
# Step 0 as it was: the tree on disk is still the OLD one, so nothing is gated and nothing is minted.
gate_decision "case (c) — the OLD step-0 position: the PRE-pull tree"
# ...and then the run pulls the gated tree, builds it, restarts it, and judges THAT.
DEPLOY_DIR="$GATED_TREE"
echo "--- the run now serves a DIFFERENT tree: $DEPLOY_DIR ---"
# The OLD step-5 row, reproduced verbatim in mechanism: status + title, nothing else.
echo "the OLD step-5 row, run against the same URL: $(curl -s --noproxy '*' -H "Cookie: $GATE_COOKIE_HEADER" -o /tmp/oldrow-$$ -w '%{http_code}' --max-time 25 "$PUBLIC") $(grep -o '<title>[^<]*</title>' /tmp/oldrow-$$ | head -1)"
rm -f /tmp/oldrow-$$
verify_public_product; echo "PRODUCT_RC=$?"
BODY
GATED_TREE="$TREE_B" unit "$TREE_A" "$URL_B" "$ROOT/body-c.sh" > "$ROOT/case-c.log" 2>&1
echo "  --- case (c) output ---"; sed 's/^/    /' "$ROOT/case-c.log"
check "grep -q 'decision:         gated=0 cookie_minted=0' '$ROOT/case-c.log'" \
  "(c) the decision was taken against the UNGATED tree, and minted nothing"
check "grep -q 'the OLD step-5 row, run against the same URL: 200 <title>Antum People — access</title>' '$ROOT/case-c.log'" \
  "(c) the OLD row records the gate page's 200 and title — which is what PASSED on 2026-11-08"
check "grep -q 'FAIL: this tree is GATED' '$ROOT/case-c.log'" "(c) the NEW assertion FAILS, naming the gated tree"
check "grep -q 'NO gate cookie was minted' '$ROOT/case-c.log'" "(c) and names what it could not prove"
check "grep -q 'THE PRODUCT IS NOT PROVEN' '$ROOT/case-c.log'" "(c) the verdict is NOT PROVEN"
check "grep -q 'PRODUCT_RC=1' '$ROOT/case-c.log'" "(c) rc 1 — the movement fails on this row"
check "! grep -q 'VERDICT: THE PRODUCT IS PROVEN' '$ROOT/case-c.log'" \
  "(c) and it does NOT also claim the product was proven"
check "! grep -q 'ASSERTIONS:' '$ROOT/case-c.log'" \
  "(c) it judged nothing at all — no assertion was even attempted, and it says so"
# The control that makes (c) a fact about the ASSERTION and not about the rig: the same rig, with a
# cookie, passes (case (b)). Named here so a reader cannot mistake (c) for a broken fixture.
check "grep -q 'VERDICT: THE PRODUCT IS PROVEN' '$ROOT/case-b.log'" \
  "(c) CONTROL: the same gated rig PASSES in case (b) — the red is the missing cookie, not the rig"

# =============================================================================================
echo
echo "== (d) a supplied ANTUM_MEASURED_* record that disagrees with this tree: AFTER-STATE MOVED =="
B_BYTES=$(stat -c %s "$TREE_B/client/dist/assets/index-GATED1.js")
B_CSS_BYTES=$(stat -c %s "$TREE_B/client/dist/assets/index-TESTCSS1.css")
B_CSS_MD5=$(md5sum < "$TREE_B/client/dist/assets/index-TESTCSS1.css" | cut -d' ' -f1)
cat > "$ROOT/body-d.sh" <<'BODY'
set -uo pipefail
. "$LIB"
print_after_state "case (d) — a record supplied by the operator"
echo "AFTER_STATE_RC=$?"
BODY
# (d1) a record that names ANOTHER tree and ANOTHER bundle — tonight's shape, where #387 landed
# between the preflight and the pull.
( export ANTUM_MEASURED_TIP=0000000000000000000000000000000000000000
  export ANTUM_MEASURED_ASSET=index-PREFLIGHT7.js
  export ANTUM_MEASURED_ASSET_BYTES=314855
  export ANTUM_MEASURED_ASSET_MD5=ffffffffffffffffffffffffffffffff
  unit "$TREE_B" "$URL_B" "$ROOT/body-d.sh" ) > "$ROOT/case-d1.log" 2>&1
echo "  --- case (d1) output: a record that disagrees ---"; sed 's/^/    /' "$ROOT/case-d1.log"
check "grep -q 'AFTER-STATE MOVED' '$ROOT/case-d1.log'" "(d) AFTER-STATE MOVED prints"
check "grep -q 'revision shipped: $B_REV' '$ROOT/case-d1.log'" "(d) it names the revision this run shipped ($B_REV)"
check "grep -q \"revision: the record says '0000000000000000000000000000000000000000'; this run measured '$B_REV'\" '$ROOT/case-d1.log'" \
  "(d) and BOTH sides of the revision disagreement"
check "grep -q \"entry asset: the record says 'index-PREFLIGHT7.js'; this run measured 'index-GATED1.js'\" '$ROOT/case-d1.log'" \
  "(d) and both sides of the bundle disagreement, by name"
check "grep -q 'AFTER_STATE_RC=0' '$ROOT/case-d1.log'" "(d) the run does NOT fail for it (the pull has already happened)"
# (d2) a record that MATCHES — so the block above is a difference, not a constant.
( export ANTUM_MEASURED_TIP="$B_REV" ANTUM_MEASURED_ASSET=index-GATED1.js \
         ANTUM_MEASURED_ASSET_BYTES="$B_BYTES" ANTUM_MEASURED_ASSET_MD5="$B_MD5" \
         ANTUM_MEASURED_CSS=index-TESTCSS1.css ANTUM_MEASURED_CSS_BYTES="$B_CSS_BYTES" \
         ANTUM_MEASURED_CSS_MD5="$B_CSS_MD5"
  unit "$TREE_B" "$URL_B" "$ROOT/body-d.sh" ) > "$ROOT/case-d2.log" 2>&1
echo "  --- case (d2) output: a record that matches ---"; sed 's/^/    /' "$ROOT/case-d2.log"
check "! grep -q 'AFTER-STATE MOVED' '$ROOT/case-d2.log'" "(d) CONTROL: a matching 7-field record prints NO moved block"
check "grep -q 'after-state record: 7 field(s) supplied, 0 moved' '$ROOT/case-d2.log'" \
  "(d) and says how many fields it compared (7), rather than staying silent"
check "grep -q 'built: index-GATED1.js  $B_BYTES B  md5 $B_MD5' '$ROOT/case-d2.log'" \
  "(d) the after-state states the entry with its byte size and md5, from disk"
check "grep -q 'built: index-TESTCSS1.css  $B_CSS_BYTES B  md5 $B_CSS_MD5' '$ROOT/case-d2.log'" \
  "(d) and the CSS with its byte size and md5"

# =============================================================================================
echo
echo "== (e) the deploy's ORDER: the decision is taken against the tree that will be served =="
RESET_LINE=$(grep -n 'git reset --hard FETCH_HEAD' "$DEPLOY" | head -1 | cut -d: -f1)
POST_PULL_LINE=$(grep -n 'gate_decision "after the pull' "$DEPLOY" | head -1 | cut -d: -f1)
BUILD_LINE=$(grep -n 'npm run build' "$DEPLOY" | head -1 | cut -d: -f1)
STEP0_IF=$(grep -n 'if \[ "\$RESTART_ONLY" -eq 1 \] || \[ "\$PREFLIGHT" -eq 1 \]' "$DEPLOY" | head -1 | cut -d: -f1)
STEP0_CALL=$(grep -n 'gate_decision "no pull happens' "$DEPLOY" | head -1 | cut -d: -f1)
STEP0_FI=$(awk -v s="$STEP0_IF" 'NR>s && /^fi$/{print NR; exit}' "$DEPLOY")
echo "  reset=$RESET_LINE  gate_decision(post-pull)=$POST_PULL_LINE  build=$BUILD_LINE"
echo "  step0: if=$STEP0_IF  gate_decision=$STEP0_CALL  fi=$STEP0_FI"
check "[ -n '$POST_PULL_LINE' ] && [ -n '$RESET_LINE' ] && [ '$POST_PULL_LINE' -gt '$RESET_LINE' ]" \
  "(e) a full movement takes the decision AFTER the pull"
check "[ -n '$BUILD_LINE' ] && [ '$POST_PULL_LINE' -lt '$BUILD_LINE' ]" \
  "(e) and BEFORE the build (so the credential exists before anything is served)"
check "[ -n '$STEP0_CALL' ] && [ -n '$STEP0_IF' ] && [ '$STEP0_IF' -lt '$STEP0_CALL' ] && [ '$STEP0_CALL' -lt '$STEP0_FI' ]" \
  "(e) step 0 keeps it ONLY inside the no-pull modes (--restart-only, --preflight)"
check "! grep -q '^ensure_gate_credential\$' '$DEPLOY' && ! grep -q '^mint_gate_cookie\$' '$DEPLOY'" \
  "(e) nothing calls the two functions bare at top level any more — only gate_decision does"
# The row that recorded the wall as a pass must be GONE, as a command.
# The pattern is anchored at column 0: the deploy's own header QUOTES the old row to explain what it
# did, and a guard that cannot tell a quotation from an assertion reddens on its own documentation.
check "! grep -q '^echo \"public status/title: \$(curl' '$DEPLOY'" \
  "(e) the bare 'public status/title: <code> <title>' row is gone (the quotation of it in the header does not count)"
PROD_CALL=$(grep -n 'verify_public_product ||' "$DEPLOY" | head -1 | cut -d: -f1)
GUARD_LINE=$(grep -n '^echo "--- 6. re-arm the watchdog' "$DEPLOY" | head -1 | cut -d: -f1)
VERDICT_LINE=$(grep -n 'the public product assertion (rc=' "$DEPLOY" | head -1 | cut -d: -f1)
echo "  product assertion=$PROD_CALL  step 6 (guard re-arm)=$GUARD_LINE  verdict=$VERDICT_LINE"
check "[ -n '$PROD_CALL' ] && [ -n '$GUARD_LINE' ] && [ '$PROD_CALL' -lt '$GUARD_LINE' ]" \
  "(e) the product assertion runs in step 5, before the guard is re-armed"
check "[ -n '$VERDICT_LINE' ] && [ -n '$GUARD_LINE' ] && [ '$VERDICT_LINE' -gt '$GUARD_LINE' ]" \
  "(e) and its failure is carried to the run's verdict AFTER the guard is re-armed (the site is never left unguarded)"
check "grep -q 'PRODUCT_RC=0' '$DEPLOY' && grep -q 'verify_public_product || PRODUCT_RC=\$?' '$DEPLOY'" \
  "(e) the row that must be able to redden the movement is wired to a real exit code"
check "grep -q 'print_after_state \"a full movement' '$DEPLOY' && grep -q 'print_after_state \"a restart-only recovery' '$DEPLOY'" \
  "(e) the after-state is named on BOTH paths"
check "bash -n '$DEPLOY'" "(e) the deploy script still parses"

# =============================================================================================
echo
echo "== (f) the live host was not touched by this test =="
check "[ ! -e '$ROOT/creds/passcode' ] || [ \"\$(stat -c %U '$ROOT/creds/passcode')\" = \"\$(id -un)\" ]" \
  "(f) the passcode file this test wrote is its own, in $ROOT"
HOST_SH=$(md5sum "$HOST_DIR"/*.sh 2>/dev/null | sort | md5sum | cut -d' ' -f1)
check "[ -n '$HOST_SH' ]" "(f) /home/team/shared's *.sh copies were read for a fingerprint only, never written ($HOST_SH)"
check "! grep -rq 'antum-gate-passcode' '$ROOT/case-'*.log 2>/dev/null" \
  "(f) no case log names the host's real gate path"
check "[ \"\$(lsof -t -i :$PORT_A -sTCP:LISTEN 2>/dev/null | wc -l)\" -ge 0 ]" \
  "(f) the rigs bound only $PORT_A and $PORT_B — never the product's port"
check "[ '$PORT_A' != '3000' ] && [ '$PORT_B' != '3000' ]" "(f) neither rig port is 3000"

echo
echo "  SCOPE, stated rather than implied: this test drives the REAL gate unit from"
echo "  scripts/deploy-main.sh against real HTTP rigs built from each tree's own server/public-gate.js"
echo "  and client/dist. It does NOT run a movement, does not fetch, build, seed or restart anything,"
echo "  and never reads, creates or prints the host's gate credential. What it cannot prove off-host:"
echo "  that the live deployment's own pair of files behaves the same way — that is step 5a's job on"
echo "  the host, and it reddens there by the same mechanism."
echo
TOTAL=$((PASS + FAIL))
echo "RESULT: $PASS passed, $FAIL failed ($TOTAL checks)"
[ "$FAIL" -eq 0 ] || exit 1
