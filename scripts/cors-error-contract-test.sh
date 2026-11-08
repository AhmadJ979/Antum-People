#!/usr/bin/env bash
# CORS + error-handling contract regression for server/index.js.
#
# Boots this checkout's server on its own port with a throwaway database and checks the
# contract that keeps a foreign Origin from leaking this deployment's internals:
#
#   * a non-allowlisted Origin is refused deliberately: 403, the API's own JSON error
#     shape, no stack trace and no absolute filesystem paths. Before the fix this was
#     HTTP 500 with express's default HTML error page, which carried both.
#   * the app's assets load on any host. The built index.html requests its bundle with
#     `crossorigin`, i.e. as a CORS-mode request, so the page's own origin arrives as an
#     Origin header: that used to answer 500 for /assets/*.js and render a blank page.
#   * legitimate paths are untouched: no Origin header still answers 401 (the uptime probe
#     and the /api 401 contract send none), an allowlisted Origin still answers 401 without
#     a token, and a thrown error answers JSON instead of express's default HTML page.
#
# Own port (ANTUM_TEST_PORT, default 4831), own temp dir, aborts if the port is busy.
# Nothing here touches the live deployment.
#
# `ss` is not installed on this host, so the busy-port check uses lsof, the same way
# scripts/keep-alive-deploypath-test.sh does. (A check that quietly never fires is worse
# than no check: it reads as protection in review.)
set -u
PORT=${ANTUM_TEST_PORT:-4831}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DEV_ORIGIN=https://b974147c03228029e277d1cbe6646fe6-dev.ctonew.app

holders="$(lsof -t -i ":$PORT" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')"
if [ -n "$holders" ]; then
  echo "ABORT: port $PORT is already in use by $holders (set ANTUM_TEST_PORT to another port)"
  exit 1
fi

TMP=$(mktemp -d)
SRV_PID=
cleanup() {
  [ -n "$SRV_PID" ] && kill "$SRV_PID" 2>/dev/null
  [ -n "$SRV_PID" ] && wait "$SRV_PID" 2>/dev/null
  rm -rf "$TMP"
}
trap cleanup EXIT

# ── THE GATE IS IN FRONT OF THIS RIG, SO THIS RIG CONFIGURES ONE OF ITS OWN ──────────────────────
# server/public-gate.js now answers every page path and every file under client/dist, so a rig that
# leaves it unconfigured measures 503s instead of assets, and a rig that leaves it configured but
# sends no cookie measures the GATE PAGE — a 200 that names no bundle and serves no bytes. Both read
# as "the asset check" while judging something else. So: a throwaway passcode hash and signing key of
# this run's own (never the host's, never printed), and one cookie minted by scripts/gate-cookie.js —
# the single authority on the cookie's shape. Nothing here re-implements the signature.
#
# WHERE THE COOKIE GOES, AND WHERE IT DELIBERATELY DOES NOT: every ASSET fetch below sends it, because
# an asset is what the gate guards. Every `/api` fetch sends NO cookie, because `/api` is passed
# straight through to the app and this file's job is to assert the app's own CORS behaviour — test 1
# (a foreign Origin must be refused with the app's 403) is exactly the assertion that caught the
# gate's first cut answering `/api` itself with a 401 before the CORS middleware could run.
GATE_PASSCODE="$TMP/gate-passcode"
GATE_SECRET="$TMP/gate-secret"
node -e 'require(process.argv[1]).hash(require("crypto").randomBytes(18).toString("base64url"), 10).then(h=>process.stdout.write(h))' \
  "$ROOT/server/node_modules/bcryptjs" > "$GATE_PASSCODE" 2>/dev/null \
  || node -e 'process.stdout.write(require(process.argv[1]).hashSync(require("crypto").randomBytes(18).toString("base64url"), 10))' \
       "$ROOT/server/node_modules/bcryptjs" > "$GATE_PASSCODE"
head -c 48 /dev/urandom | base64 | tr -d '\n' > "$GATE_SECRET"
chmod 600 "$GATE_PASSCODE" "$GATE_SECRET"

GATE_COOKIE=$(ANTUM_GATE_PASSCODE_FILE="$GATE_PASSCODE" ANTUM_GATE_SECRET_FILE="$GATE_SECRET" \
  node "$ROOT/scripts/gate-cookie.js" --tree "$ROOT")
mint_rc=$?
if [ "$mint_rc" -ne 0 ]; then
  # The team's code 3 (#266): the credential is ABSENT in this context, so nothing behind the gate
  # can be measured from here. It must never read as a pass, and it must never read as a failure of
  # the CORS contract either — no assertion below was run.
  if [ "$mint_rc" -eq 3 ]; then
    echo "SKIP-FLAGGED: scripts/gate-cookie.js could not mint a gate credential here (exit 3) - NOTHING was measured."
    echo "  it names the file it looked for above; the CORS contract is unjudged, not green."
    exit 3
  fi
  echo "ABORT: scripts/gate-cookie.js failed (exit $mint_rc) - the minter is broken, not the contract"
  exit 1
fi

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); printf '  ok    %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  FAIL  %s\n' "$1"; }
check() { # check <label> <actual> <expected>
  if [ "$2" = "$3" ]; then ok "$1: $2"; else bad "$1: expected '$3', got '$2'"; fi
}

echo "booting this checkout on port $PORT with a throwaway database"
cd "$ROOT/server"
JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n') \
ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64 | tr -d '\n' | cut -c1-32) \
PORT=$PORT PRODUCT_DB_PATH="$TMP/db.sqlite" \
ANTUM_GATE_PASSCODE_FILE="$GATE_PASSCODE" ANTUM_GATE_SECRET_FILE="$GATE_SECRET" \
  node index.js > "$TMP/server.log" 2>&1 &
SRV_PID=$!

BASE="http://127.0.0.1:$PORT"
UP=no
for _ in $(seq 1 60); do
  if curl -s -o /dev/null "$BASE/api/employees"; then UP=yes; break; fi
  kill -0 "$SRV_PID" 2>/dev/null || break
  sleep 0.25
done
if [ "$UP" != yes ]; then
  echo "ABORT: the server did not come up; log follows"
  cat "$TMP/server.log"
  exit 1
fi

# probe <curl args...> -> "<status>\t<content-type>\t<body file>"
probe() {
  local body="$TMP/body" hdr
  hdr=$(curl -s -D - -o "$body" "$@")
  printf '%s\t%s\t%s\n' \
    "$(printf '%s' "$hdr" | head -1 | awk '{print $2}')" \
    "$(printf '%s' "$hdr" | grep -i '^content-type:' | tr -d '\r' | sed 's/^[Cc]ontent-[Tt]ype: //')" \
    "$body"
}
field() { printf '%s' "$1" | cut -f"$2"; }

echo "1. a non-allowlisted Origin is refused deliberately"
out=$(probe -H 'Origin: http://evil.example' "$BASE/api/employees")
check "status" "$(field "$out" 1)" "403"
case "$(field "$out" 2)" in
  application/json*) ok "content-type is JSON: $(field "$out" 2)" ;;
  *) bad "content-type is JSON: $(field "$out" 2)" ;;
esac
body=$(field "$out" 3)
check "body" "$(cat "$body")" '{"error":"Forbidden"}'
if grep -qE '(/[A-Za-z0-9._-]+)+/(server|node_modules|client)/' "$body"; then
  bad "body leaks absolute filesystem paths: $(grep -oE '(/[A-Za-z0-9._-]+)+/(server|node_modules|client)/[A-Za-z0-9._/-]+' "$body" | head -1)"
else
  ok "body leaks no filesystem path"
fi
if grep -q 'at .*(/.*:[0-9]*:[0-9]*)' "$body" || grep -qi '<!DOCTYPE' "$body"; then
  bad "body contains a stack trace or express's HTML error page"
else
  ok "body contains no stack trace and no HTML error page"
fi
if curl -s -D - -o /dev/null -H 'Origin: http://evil.example' "$BASE/api/employees" | grep -qi '^access-control-allow-origin:'; then
  bad "a refused Origin was granted CORS headers"
else
  ok "a refused Origin is granted no CORS headers"
fi

echo "2. the legit paths are untouched"
out=$(probe -H 'X-Probe: none' "$BASE/api/employees")
check "no Origin header -> status" "$(field "$out" 1)" "401"
check "no Origin header -> body" "$(cat "$(field "$out" 3)")" '{"error":"Authentication token required"}'
out=$(probe -H "Origin: $DEV_ORIGIN" "$BASE/api/employees")
check "allowlisted Origin -> status" "$(field "$out" 1)" "401"
if curl -s -D - -o /dev/null -H "Origin: $DEV_ORIGIN" "$BASE/api/employees" | grep -qi "^access-control-allow-origin: $DEV_ORIGIN"; then
  ok "allowlisted Origin still gets its CORS header"
else
  bad "allowlisted Origin lost its CORS header"
fi

echo "3. a same-origin request is served (the app's own bundle)"
out=$(probe -H "Origin: $BASE" "$BASE/api/employees")
check "Origin host == Host -> status" "$(field "$out" 1)" "401"
if [ -f "$ROOT/client/dist/index.html" ]; then
  bundle=$(sed -n 's/.*src="\([^"]*\.js\)".*/\1/p' "$ROOT/client/dist/index.html" | head -1)
  # FIRST, THE GATE IS PROVED TO BE ON IN THIS RIG: the same asset WITHOUT the cookie answers 200
  # with the gate page. Without this line the asset assertions below could pass against a rig whose
  # gate silently fell open, and the cookie's necessity would never be measured.
  nogate="$TMP/nogate.html"
  nogate_status=$(curl -s -o "$nogate" -w '%{http_code}' -H "Origin: $BASE" "$BASE$bundle")
  check "the bundle WITHOUT the gate cookie -> status" "$nogate_status" "200"
  if grep -q 'Enter the passcode' "$nogate"; then
    ok "the bundle WITHOUT the gate cookie is the gate page, not the bundle ($(wc -c < "$nogate") B)"
  else
    bad "the gate did not answer the cookieless asset request - this rig is not gated, so the asset checks below judge nothing"
  fi
  check "bundle $bundle with a same-origin Origin" \
    "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: $GATE_COOKIE" -H "Origin: $BASE" "$BASE$bundle")" "200"
  # …and it is the REAL asset, not a 200 of something else: the gate page is 200 too.
  check "the bundle's bytes with the gate cookie" \
    "$(curl -s -H "Cookie: $GATE_COOKIE" -H "Origin: $BASE" "$BASE$bundle" | wc -c | tr -d ' ')" \
    "$(wc -c < "$ROOT/client/dist$bundle" | tr -d ' ')"
else
  echo "  skip  client/dist is not built in this checkout"
fi

echo "3b. same-origin behind a proxy that REWRITES Host (the 2026-11-02 blank-page regression)"
# The edge in front of the live deployment rewrites Host to its own internal name and puts the
# name it was addressed as in X-Forwarded-Host. Measured 2026-11-02 by reading the bytes the
# live process read from its socket, for a request to
# https://b974147c03228029e277d1cbe6646fe6.cto.site:
#     Host:             ip-10-110-75-104.us-west-2.prod.aws.beamlit.net
#     X-Forwarded-Host: c92e15e4f97c516d8c977075708bb720.preview.bl.run
#     X-Forwarded-Proto: https
#     Origin:           https://b974147c03228029e277d1cbe6646fe6.cto.site
# Comparing the Origin host against Host alone refused every Origin-bearing request on that
# hostname, so the bundle and the stylesheet 403'd and #root stayed empty. Both shapes below
# answered 403 before this fix; the first is the regression, the second is the same rule with
# the entry that matters arriving not-first in a proxy chain's list.
XFH_ORIGIN=https://antum.example.ae
out=$(probe -H "Origin: $XFH_ORIGIN" -H 'X-Forwarded-Host: antum.example.ae' "$BASE/api/employees")
check "Origin host == X-Forwarded-Host while Host differs -> status" "$(field "$out" 1)" "401"
check "Origin host == X-Forwarded-Host while Host differs -> body" \
  "$(cat "$(field "$out" 3)")" '{"error":"Authentication token required"}'
if [ -f "$ROOT/client/dist/index.html" ]; then
  check "bundle with Origin host == X-Forwarded-Host" \
    "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: $GATE_COOKIE" -H "Origin: $XFH_ORIGIN" \
        -H 'X-Forwarded-Host: antum.example.ae' "$BASE$bundle")" "200"
fi
out=$(probe -H "Origin: $XFH_ORIGIN" -H 'X-Forwarded-Host: edge-internal.example, antum.example.ae' \
  "$BASE/api/employees")
check "X-Forwarded-Host list, matching entry not first -> status" "$(field "$out" 1)" "401"
# A default port spelled out is the same host on both sides (`antum.ae:443` == `antum.ae`).
out=$(probe -H "Origin: $XFH_ORIGIN" -H 'X-Forwarded-Host: antum.example.ae:443' "$BASE/api/employees")
check "explicit :443 on the forwarded host -> status" "$(field "$out" 1)" "401"
# The refusal still holds for a host we do not serve, in the same shape.
out=$(probe -H 'Origin: https://evil.example' -H 'X-Forwarded-Host: antum.example.ae' "$BASE/api/employees")
check "foreign Origin, unrelated X-Forwarded-Host -> status" "$(field "$out" 1)" "403"
check "foreign Origin, unrelated X-Forwarded-Host -> body" "$(cat "$(field "$out" 3)")" '{"error":"Forbidden"}'
# PINNED, and stated rather than hidden: a caller who sets BOTH Origin and X-Forwarded-Host to
# the same foreign host is served by the forwarded-host rule. That is the cost of trusting a
# proxy header, and it is bounded here by three measured facts — the live edge OVERWRITES a
# caller-supplied X-Forwarded-Host (measured 2026-11-02, so the rule is unreachable from
# outside it), a browser cannot set the header at all, and this API carries no ambient
# credential (a token lives in localStorage, so a request without one answers 401 whatever its
# Origin). Asserted so that any future change to that boundary is visible in this run.
out=$(probe -H 'Origin: https://evil.example' -H 'X-Forwarded-Host: evil.example' "$BASE/api/employees")
check "DOCUMENTED proxy-trust boundary: both headers forged -> served, not refused" \
  "$(field "$out" 1)" "401"

echo "4. a thrown error answers JSON, not express's HTML page"
out=$(probe -X POST -H 'Content-Type: application/json' -H "Origin: $DEV_ORIGIN" -d '{"username": ' "$BASE/api/login")
check "malformed JSON body -> status" "$(field "$out" 1)" "400"
body=$(field "$out" 3)
# The app's own sentence, re-grounded 2026-11-08: this assertion still said '{"error":"Bad Request"}'
# from before commit 9489650 ("400 where the caller was wrong") replaced it, so this file was RED on
# main for a reason unrelated to the gate. main at 8a4e1ac carries the sentence below
# (server/index.js:1843) and this run measures it. The assertion keeps its point - a thrown parse
# error answers JSON with a named cause, never express's HTML page - and it reddens again if the
# sentence or the shape moves.
check "malformed JSON body -> body" "$(cat "$body")" '{"error":"request body could not be parsed as a JSON object"}'
if grep -qi '<!DOCTYPE' "$body"; then
  bad "malformed JSON body answered express's HTML error page"
else
  ok "malformed JSON body answered no HTML"
fi

echo "5. the refusal is recorded server-side"
if grep -q '\[cors\] refused Origin http://evil.example' "$TMP/server.log"; then
  ok "the refused Origin appears in the log"
else
  bad "the refused Origin was not logged"
fi

echo "6. this business's OWN platform names are served by PATTERN, not by a list"
# The first fix for the blank page added one allowlist entry per hostname and was one name
# behind on the very next one: `-dev` — the platform's WORKING-SITE name, the one the owner's
# SITE tab opens — was still refused, and its bundle 403'd, so #root never mounted. The four
# names below are the shape this business is served under; all four must be served with no
# entry anywhere. Measured before this change on the live host: the `-dev` asset answered
# 403 with the 21-byte body, i.e. the same blank page.
BIZ=b974147c03228029e277d1cbe6646fe6
for own in "https://$BIZ-dev.cto.site" "https://$BIZ.cto.site" \
           "https://$BIZ.ctonew.app" "https://$BIZ-dev.ctonew.app"; do
  out=$(probe -H "Origin: $own" "$BASE/api/employees")
  check "own platform name $own -> status" "$(field "$out" 1)" "401"
done
# The one that was blank, spelled out on its own so a failure names it.
DEV_SITE_ORIGIN="https://$BIZ-dev.cto.site"
out=$(probe -H "Origin: $DEV_SITE_ORIGIN" "$BASE/api/employees")
check "the -dev .cto.site name -> body" \
  "$(cat "$(field "$out" 3)")" '{"error":"Authentication token required"}'
if curl -s -D - -o /dev/null -H "Origin: $DEV_SITE_ORIGIN" "$BASE/api/employees" \
     | grep -qi "^access-control-allow-origin: $DEV_SITE_ORIGIN"; then
  ok "the -dev .cto.site name gets its CORS header (gate and cors middleware agree)"
else
  bad "the -dev .cto.site name was served but the cors middleware withheld its header"
fi
if [ -f "$ROOT/client/dist/index.html" ]; then
  check "the -dev bundle (the blank page's cause) loads" \
    "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: $GATE_COOKIE" -H "Origin: $DEV_SITE_ORIGIN" "$BASE$bundle")" "200"
  check "the -dev stylesheet loads" \
    "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: $GATE_COOKIE" -H "Origin: $DEV_SITE_ORIGIN" \
        "$BASE$(sed -n 's/.*href="\([^"]*\.css\)".*/\1/p' "$ROOT/client/dist/index.html" | head -1)")" "200"
fi

echo "7. ...and the pattern admits NOTHING ELSE (the refusals, quoted)"
# Each of these is refused deliberately: 403, the short generic body, no CORS header. The
# lookalikes are the reason the match is on LABELS: a suffix test against the whole host string
# admits `<biz>.cto.site.evil.example`, and `endsWith` admits a name padded at the front.
refuse() { # refuse <label> <origin>
  local out
  out=$(probe -H "Origin: $2" "$BASE/api/employees")
  check "$1 -> status" "$(field "$out" 1)" "403"
  check "$1 -> body" "$(cat "$(field "$out" 3)")" '{"error":"Forbidden"}'
  if curl -s -D - -o /dev/null -H "Origin: $2" "$BASE/api/employees" \
       | grep -qi '^access-control-allow-origin:'; then
    bad "$1 was refused but granted a CORS header"
  fi
}
refuse "foreign Origin"                 'https://evil.example'
refuse "another team's hash on .cto.site" 'https://0123456789abcdef0123456789abcdef.cto.site'
refuse "lookalike: our name, then a foreign parent" "https://$BIZ.cto.site.evil.example"
refuse "lookalike: our name padded at the front"    "https://x$BIZ.cto.site"
refuse "lookalike: our name with a -dev lookalike"  "https://$BIZ-devx.cto.site"
refuse "bare platform domain"           'https://cto.site'
refuse "bare app domain"                'https://ctonew.app'
refuse "our id, a suffix we do not serve" "https://$BIZ.example.com"
refuse "our id as a SUBdomain of the suffix" "https://$BIZ.foo.cto.site"
refuse "plaintext Origin on our own name" "http://$BIZ.cto.site"
# The asset the owner's page asks for, from a name we do not own: refused, short body. The gate
# cookie is SENT here on purpose — the question this line asks is what the CORS middleware does to a
# foreign Origin, and a cookieless request would be answered by the gate before CORS ever ran.
if [ -f "$ROOT/client/dist/index.html" ]; then
  check "foreign Origin on the bundle -> status" \
    "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: $GATE_COOKIE" -H 'Origin: https://evil.example' "$BASE$bundle")" "403"
fi

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
