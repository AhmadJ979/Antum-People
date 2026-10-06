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
  check "bundle $bundle with a same-origin Origin" \
    "$(curl -s -o /dev/null -w '%{http_code}' -H "Origin: $BASE" "$BASE$bundle")" "200"
else
  echo "  skip  client/dist is not built in this checkout"
fi

echo "4. a thrown error answers JSON, not express's HTML page"
out=$(probe -X POST -H 'Content-Type: application/json' -H "Origin: $DEV_ORIGIN" -d '{"username": ' "$BASE/api/login")
check "malformed JSON body -> status" "$(field "$out" 1)" "400"
body=$(field "$out" 3)
check "malformed JSON body -> body" "$(cat "$body")" '{"error":"Bad Request"}'
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

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
