#!/bin/bash
# observe-serve-pair-test.sh — proves the observer (scripts/observe-serve-pair.sh) does what it claims,
# entirely off-host and without touching the product or the live tree.
#
# WHY THIS EXISTS. Decision 5 (a) buys an OBSERVER, and the standard for a check on this host is that it
# can REDDEN: seven replacements went unnoticed by checks and were caught by people. So this suite drives
# the real observer against fixtures — a static server on a scratch port, never the live site:
#
#   (a) a fixture that IS the pair → exit 0, and the expected values are DERIVED from the fixture tree's
#       own artifact (the run names the same md5 the file has);
#   (b) a fixture that answers 200 with a placeholder body (the "My site" case) → exit 1;
#   (c) a fixture whose page names our asset but serves DIFFERENT bytes → exit 1, naming both md5s;
#   (d) an unreachable URL and a 404 → exit 1, naming the status;
#   (e) DERIVE-OR-REFUSE: a tree with no built bundle exits 3 and compares nothing; and a PINNED literal
#       that disagrees with the artifact reddens, naming both — the exact drift a typed number causes;
#   (f) the record: one dated line per run, the retention keeps what it says it keeps, the liveness line
#       reports the previous run (the observer's own death made visible), and a broken→restored window is
#       written as a dated record;
#   (g) READ-ONLY: the observed tree's files are byte-identical with unchanged mtimes afterwards, and the
#       live host copies and the installed login-shell hook are untouched by the whole suite;
#   (h) one loop per host: a live pid in the lock makes a second loop refuse, a stale lock is named and
#       does not block, and killing the loop by the PID IN ITS LOCK (never a pattern match) ends it and
#       clears the lock;
#   (i) --status answers "is the observer alive?" from the record alone, and says NO RECORD YET rather
#       than implying the product is fine;
#   (j) OPT-IN, and NAMED WHEN NOT RUN: with ANTUM_OBSERVE_LIVE=1 the suite also observes the real public
#       URL and states the md5 it measured off it; without it the suite prints that it did not.
#
# USAGE: bash scripts/observe-serve-pair-test.sh        (exit 0 = every case passed)
#        ANTUM_OBSERVE_LIVE=1 bash scripts/observe-serve-pair-test.sh   (+ the live-URL case)
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OBS="$REPO/scripts/observe-serve-pair.sh"
HOST_DIR=/home/team/shared
HOOK_DST_LIVE=/etc/profile.d/zz-antum-product-guard.sh
LIVE_URL="${ANTUM_OBSERVE_URL_LIVE:-https://b974147c03228029e277d1cbe6646fe6.ctonew.app}"
LIVE_TREE="${ANTUM_OBSERVE_TREE_LIVE:-/home/team/shared/probable-octo-sniffle}"
ROOT=$(mktemp -d /tmp/observe-serve-pair-test.XXXXXX) || { echo "ABORT: no scratch space"; exit 2; }
PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null; done; rm -rf "$ROOT"; }
trap cleanup EXIT
PASS=0; FAIL=0
ok()   { echo "  PASS  $*"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $*"; FAIL=$((FAIL+1)); }
check(){ if eval "$1"; then ok "$2"; else bad "$2"; fi; }

echo "=== observe-serve-pair-test $(date -Iseconds) ==="
echo "  repo    $REPO"
echo "  observer $OBS ($(stat -c %s "$OBS" 2>/dev/null) B)"
echo "  scratch $ROOT"
echo

# --- fixtures --------------------------------------------------------------------------------
mk_tree() { # $1 = root; a minimal "served tree" whose build names one js and one css bundle
  mkdir -p "$1/client/dist/assets"
  { printf '<!doctype html><html lang="en"><head><meta charset="utf-8">\n'
    printf '<title>Antum People</title>\n'
    printf '<script type="module" crossorigin src="/assets/index-FIXTURE01.js"></script>\n'
    printf '<link rel="stylesheet" crossorigin href="/assets/index-FIXTURE01.css">\n'
    printf '</head><body><div id="root"></div></body></html>\n'; } > "$1/client/dist/index.html"
  printf 'console.log("the fixture bundle — the bytes the URL must serve");\n' > "$1/client/dist/assets/index-FIXTURE01.js"
  printf 'body{color:#111;font-family:sans-serif}\n' > "$1/client/dist/assets/index-FIXTURE01.css"
}
GOOD="$ROOT/good"; mk_tree "$GOOD"
PLACEHOLDER="$ROOT/placeholder"; mkdir -p "$PLACEHOLDER"
printf '<!doctype html><html><head><title>My site</title></head><body><h1>My site</h1></body></html>\n' > "$PLACEHOLDER/index.html"
FOREIGN="$ROOT/foreign"; mkdir -p "$FOREIGN/assets"
cp "$GOOD/client/dist/index.html" "$FOREIGN/index.html"
printf 'console.log("SOMEBODY ELSE BUNDLE");\n' > "$FOREIGN/assets/index-FIXTURE01.js"
cp "$GOOD/client/dist/assets/index-FIXTURE01.css" "$FOREIGN/assets/index-FIXTURE01.css"
EMPTY="$ROOT/empty"; mkdir -p "$EMPTY"

freeport() { python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()'; }
start_server() { # $1 dir $2 port -> 0 only when the server ANSWERS (a stub transcript is worse than none)
  ( cd "$1" && exec python3 -m http.server "$2" --bind 127.0.0.1 > "$ROOT/server-$2.log" 2>&1 ) &
  local sp=$!; PIDS+=("$sp")
  local i; for i in $(seq 1 40); do
    sleep 0.25
    if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$2/" 2>/dev/null; then echo "$sp" > "$ROOT/server-$2.pid"; return 0; fi
  done
  return 1
}
GOOD_PORT=$(freeport); PH_PORT=$(freeport); FOR_PORT=$(freeport); EMPTY_PORT=$(freeport)
SRV_GOOD=$(start_server "$GOOD/client/dist" "$GOOD_PORT" && echo up || echo down)
SRV_PH=$(start_server "$PLACEHOLDER" "$PH_PORT" && echo up || echo down)
SRV_FOR=$(start_server "$FOREIGN" "$FOR_PORT" && echo up || echo down)
SRV_EMPTY=$(start_server "$EMPTY" "$EMPTY_PORT" && echo up || echo down)
echo "  fixtures: good=$GOOD_PORT($SRV_GOOD) placeholder=$PH_PORT($SRV_PH) foreign=$FOR_PORT($SRV_FOR) empty=$EMPTY_PORT($SRV_EMPTY)"
for s in "$SRV_GOOD" "$SRV_PH" "$SRV_FOR" "$SRV_EMPTY"; do
  [ "$s" = up ] || { echo "ABORT: a fixture server did not answer — an unanswerable fixture proves nothing"; exit 2; }
done
echo

FIX_JS_MD5=$(md5sum < "$GOOD/client/dist/assets/index-FIXTURE01.js" | cut -d' ' -f1)
FIX_JS_BYTES=$(stat -c %s "$GOOD/client/dist/assets/index-FIXTURE01.js")

run_obs() { # $1 tree $2 dir $3 url ; writes stdout to $4
  local tree="$1" dir="$2" url="$3" out="$4"
  ANTUM_OBSERVE_URL="$url" ANTUM_OBSERVE_TREE="$tree" ANTUM_OBSERVE_DIR="$dir" \
  ANTUM_OBSERVE_TIMEOUT=5 bash "$OBS" > "$out" 2>&1
  echo $?
}
json_ok() { python3 -c 'import json,sys
for l in open(sys.argv[1]):
    l=l.strip()
    if l: json.loads(l)' "$1"; }
rec_field() { # $1 file $2 line-index $3 field
  python3 -c 'import json,sys
ls=[l for l in open(sys.argv[1]) if l.strip()]
i=int(sys.argv[2]); print(json.loads(ls[i]).get(sys.argv[3],""))' "$1" "$2" "$3"
}

echo "== (a) a fixture that IS the pair: exit 0, with the expectation DERIVED from the fixture tree =="
AD="$ROOT/a"; RC=$(run_obs "$GOOD" "$AD" "http://127.0.0.1:$GOOD_PORT" "$ROOT/a.log")
check "[ $RC -eq 0 ]" "(a) the observer exits 0 against a fixture that is the pair (it exited $RC)"
check "grep -q 'PAIR HOLDS' '$ROOT/a.log'" "(a) and says PAIR HOLDS"
check "grep -q 'derived: 2 asset' '$ROOT/a.log'" "(a) it derived BOTH bundles the tree's build emitted"
check "grep -q 'index-FIXTURE01.js' '$ROOT/a.log'" "(a) naming the asset it derived"
check "grep -q '$FIX_JS_MD5' '$ROOT/a.log'" "(a) with the md5 the FIXTURE TREE's artifact actually has ($FIX_JS_MD5)"
check "grep -q 'measured off the URL: assets/index-FIXTURE01.js $FIX_JS_BYTES B md5 $FIX_JS_MD5' '$ROOT/a.log'" \
  "(a) and it prints what it measured off the URL, byte count included"
check "grep -q 'title: Antum People' '$ROOT/a.log'" "(a) the served page's title is in the output"
check "json_ok '$AD/runs.jsonl'" "(a) the run's record line parses as JSON"
check "[ \"\$(rec_field '$AD/runs.jsonl' 0 verdict)\" = 'PASS' ]" "(a) the record says PASS"
check "[ \"\$(rec_field '$AD/runs.jsonl' 0 fetched_md5)\" = '$FIX_JS_MD5' ]" "(a) and records the md5 it computed off the URL"
check "[ \"\$(rec_field '$AD/runs.jsonl' 0 expected_md5)\" = '$FIX_JS_MD5' ]" "(a) beside the md5 it derived from the tree"
check "[ ! -f '$AD/PAIR-BROKEN.txt' ]" "(a) no alert file is left when the pair holds"

echo
echo "== (b) 200 with a placeholder body — the exact failure that has happened — must REDDEN =="
BD="$ROOT/b"; RC=$(run_obs "$GOOD" "$BD" "http://127.0.0.1:$PH_PORT" "$ROOT/b.log")
check "[ $RC -eq 1 ]" "(b) exit 1, not 0 (a 200 alone is not health; it exited $RC)"
check "grep -q 'PAIR BROKEN' '$ROOT/b.log'" "(b) it says PAIR BROKEN"
check "grep -qE 'does not name:.*assets/index-FIXTURE01\\.(js|css)' '$ROOT/b.log'" "(b) and names the assets the page failed to name"
check "grep -q 'title: My site' '$ROOT/b.log'" "(b) printing the placeholder's own title, which a status check would have called healthy"
check "grep -q 'a placeholder answers 200 too' '$ROOT/b.log'" "(b) and says why 200 was not enough"
check "[ \"\$(rec_field '$BD/runs.jsonl' 0 verdict)\" = 'BROKEN' ]" "(b) the record says BROKEN"
check "[ -f '$BD/PAIR-BROKEN.txt' ]" "(b) the alert file exists where a person looks"
check "grep -q 'first broken' '$BD/PAIR-BROKEN.txt'" "(b) and keeps the FIRST failure time, so a window can be measured"
check "grep -q 'My site' '$BD/PAIR-BROKEN.txt'" "(b) the alert carries the evidence (the placeholder's title), not just a verdict"

echo
echo "== (c) the page names our asset but the BYTES differ: a stale or foreign bundle must REDDEN =="
CD="$ROOT/c"; RC=$(run_obs "$GOOD" "$CD" "http://127.0.0.1:$FOR_PORT" "$ROOT/c.log")
FOR_MD5=$(md5sum < "$FOREIGN/assets/index-FIXTURE01.js" | cut -d' ' -f1)
check "[ $RC -eq 1 ]" "(c) exit 1 (it exited $RC)"
check "grep -q 'does not match the served tree' '$ROOT/c.log'" "(c) it says the served bytes are not the tree's artifact"
check "grep -q \"md5 $FIX_JS_MD5\" '$ROOT/c.log'" "(c) naming the EXPECTED md5"
check "grep -q \"md5 $FOR_MD5\" '$ROOT/c.log'" "(c) and the FOREIGN md5 it actually computed"
check "[ \"\$(rec_field '$CD/runs.jsonl' 0 verdict)\" = 'BROKEN' ]" "(c) recorded as BROKEN"

echo
echo "== (d) unreachable and 404 are named, not guessed =="
DD="$ROOT/d"; DEAD=$(freeport)
RC=$(run_obs "$GOOD" "$DD" "http://127.0.0.1:$DEAD" "$ROOT/d-dead.log")
check "[ $RC -eq 1 ]" "(d) a URL nothing answers exits 1 (it exited $RC)"
check "grep -q 'could not be reached' '$ROOT/d-dead.log'" "(d) and says it could not be reached"
DD2="$ROOT/d2"
RC=$(run_obs "$GOOD" "$DD2" "http://127.0.0.1:$EMPTY_PORT" "$ROOT/d-404.log")
check "[ $RC -eq 1 ]" "(d) a 404 exits 1 (it exited $RC)"
check "grep -qE 'returned 404|does not name' '$ROOT/d-404.log'" "(d) and names the status or the missing name"

echo
echo "== (e) derive-or-refuse, and a pinned literal that disagrees must redden =="
ED="$ROOT/e"; BARE="$ROOT/bare-tree"; mkdir -p "$BARE"
RC=$(run_obs "$BARE" "$ED" "http://127.0.0.1:$GOOD_PORT" "$ROOT/e.log")
check "[ $RC -eq 3 ]" "(e) a tree with no built bundle REFUSES (exit 3; it exited $RC)"
check "grep -q 'REFUSED' '$ROOT/e.log'" "(e) and says REFUSED"
check "grep -q 'will not compare against a remembered number' '$ROOT/e.log'" "(e) saying why: derive-or-refuse"
check "! grep -qE 'PAIR (HOLDS|BROKEN)' '$ROOT/e.log'" "(e) and it prints NO verdict — nothing was compared"
check "[ \"\$(rec_field '$ED/runs.jsonl' 0 verdict)\" = 'REFUSED' ]" "(e) the record says REFUSED, so a refusal is visible in the record too"
ED2="$ROOT/e2"
ANTUM_OBSERVE_URL="http://127.0.0.1:$GOOD_PORT" ANTUM_OBSERVE_TREE="$GOOD" ANTUM_OBSERVE_DIR="$ED2" \
  ANTUM_OBSERVE_TIMEOUT=5 ANTUM_OBSERVE_EXPECT_MD5=deadbeefdeadbeefdeadbeefdeadbeef bash "$OBS" > "$ROOT/e-pin.log" 2>&1
PINC=$?
check "[ $PINC -eq 1 ]" "(e) a PINNED md5 that disagrees with the artifact exits 1 (it exited $PINC)"
check "grep -q 'deadbeefdeadbeefdeadbeefdeadbeef' '$ROOT/e-pin.log'" "(e) naming the pinned literal"
check "grep -q \"artifact md5 ($FIX_JS_MD5)\" '$ROOT/e-pin.log'" "(e) beside the artifact's real md5 — the literal cannot drift unnoticed"
check "grep -q 'date' '$ROOT/e-pin.log'" "(e) and saying a pinned literal is a dated measurement"

echo
echo "== (f) the record: one line per run, retention, liveness, and a broken→restored window =="
FD="$ROOT/f"
RC1=$(run_obs "$GOOD" "$FD" "http://127.0.0.1:$GOOD_PORT" "$ROOT/f1.log")
RC2=$(run_obs "$GOOD" "$FD" "http://127.0.0.1:$GOOD_PORT" "$ROOT/f2.log")
check "[ \"\$(wc -l < '$FD/runs.jsonl')\" = '2' ]" "(f) two runs leave exactly two record lines"
check "grep -q 'LIVENESS:' '$ROOT/f2.log'" "(f) every run prints the age of the previous run"
check "grep -q 'no earlier run in this record' '$ROOT/f1.log'" "(f) the FIRST run says there was none, rather than implying coverage"
check "json_ok '$FD/runs.jsonl'" "(f) every record line parses as JSON"
# retention
FDK="$ROOT/fk"; KEEPED=1
for i in 1 2 3 4 5; do
  ANTUM_OBSERVE_URL="http://127.0.0.1:$GOOD_PORT" ANTUM_OBSERVE_TREE="$GOOD" ANTUM_OBSERVE_DIR="$FDK" \
    ANTUM_OBSERVE_KEEP=3 ANTUM_OBSERVE_TIMEOUT=5 bash "$OBS" > /dev/null 2>&1 || KEEPED=0
done
check "[ $KEEPED -eq 1 ]" "(f) five runs with ANTUM_OBSERVE_KEEP=3 all exit 0"
check "[ \"\$(wc -l < '$FDK/runs.jsonl')\" = '3' ]" "(f) and the record keeps exactly 3 runs, as it says it does"
# a window: broken, then restored
WD="$ROOT/w"
RCB=$(run_obs "$GOOD" "$WD" "http://127.0.0.1:$PH_PORT" "$ROOT/w-broken.log")
ALERT_FIRST=$(sed -n 's/^first broken \([^ ]*\).*/\1/p' "$WD/PAIR-BROKEN.txt" 2>/dev/null)
sleep 1
RCW=$(run_obs "$GOOD" "$WD" "http://127.0.0.1:$GOOD_PORT" "$ROOT/w-restored.log")
check "[ $RCB -eq 1 ] && [ $RCW -eq 0 ]" "(f) a broken run then a restored run (exits $RCB then $RCW)"
check "[ ! -f '$WD/PAIR-BROKEN.txt' ]" "(f) the alert is cleared when the pair holds again"
check "ls '$WD'/PAIR-BROKEN-resolved-*.txt >/dev/null 2>&1" "(f) and moved aside as a dated record of the window, not deleted"
check "grep -q '$ALERT_FIRST' '$WD/restored.log'" "(f) the window records when it broke ($ALERT_FIRST)"
check "grep -q 'bounded by the recorded runs, not exact' '$WD/restored.log'" "(f) and says the window's granularity honestly"
check "[ \"\$(rec_field '$WD/runs.jsonl' 1 verdict)\" = 'PASS' ]" "(f) while the record keeps both runs"

echo
echo "== (g) read-only against the tree, and the live host untouched by this suite =="
TREE_BEFORE=$(cd "$GOOD" && find client -type f -exec md5sum {} \; -exec stat -c '%n %Y' {} \; | sort)
HOST_BEFORE=$(md5sum "$HOST_DIR"/*.sh 2>/dev/null | sort); HOOK_BEFORE=$(md5sum < "$HOOK_DST_LIVE" 2>/dev/null || echo none)
GD="$ROOT/g"; run_obs "$GOOD" "$GD" "http://127.0.0.1:$GOOD_PORT" "$ROOT/g.log" > /dev/null
TREE_AFTER=$(cd "$GOOD" && find client -type f -exec md5sum {} \; -exec stat -c '%n %Y' {} \; | sort)
check "[ \"\$TREE_BEFORE\" = \"\$TREE_AFTER\" ]" "(g) the observed tree's files are byte-identical, mtimes included, after a run"
HOST_AFTER=$(md5sum "$HOST_DIR"/*.sh 2>/dev/null | sort); HOOK_AFTER=$(md5sum < "$HOOK_DST_LIVE" 2>/dev/null || echo none)
check "[ \"\$HOST_AFTER\" = \"\$HOST_BEFORE\" ]" "(g) /home/team/shared *.sh unchanged by this whole suite"
check "[ \"\$HOOK_AFTER\" = \"\$HOOK_BEFORE\" ]" "(g) the installed login-shell hook unchanged by this whole suite"
check "grep -qi 'no restart' '$OBS'" "(g) the observer states the read-only promise in its own header"
check "! grep -qF 'keep-alive.lock' '$OBS'" "(g) it never touches the guard's lock"
check "! grep -qF 'deploy-in-progress' '$OBS'" "(g) nor the deploy marker it must not interfere with"

echo
echo "== (h) one loop per host, killed by the pid in its lock =="
# A one-shot run must work WHILE a loop is armed (a person checking now, and the movement's step, are both
# legitimate) — it is a second LOOP that must refuse. Both halves are exercised here.
HD="$ROOT/h"; mkdir -p "$HD"
# A REAL live pid for the busy-lock case (see the note in the suite header): start a process and use
# its pid. Writing the suite shell's own pid as a literal got mangled to a bare $$ character, the lock
# then read as stale, and this case passed while testing nothing.
sleep 120 & BUSY_PID=$!
PIDS+=("$BUSY_PID")
printf '%s\n' "$BUSY_PID" > "$HD/observer-loop.lock"
ANTUM_OBSERVE_URL="http://127.0.0.1:$GOOD_PORT" ANTUM_OBSERVE_TREE="$GOOD" ANTUM_OBSERVE_DIR="$HD" \
  ANTUM_OBSERVE_TIMEOUT=5 timeout 30 bash "$OBS" --loop 1 > "$ROOT/h-busy.log" 2>&1
RC=$?
check "[ $RC -eq 2 ]" "(h) a second LOOP refuses to start while the lock names a live pid (it exited $RC)"
check "grep -q 'pid $BUSY_PID holds' '$ROOT/h-busy.log'" "(h) and names the pid that holds it ($BUSY_PID)"
check "grep -q 'never pkill -f' '$ROOT/h-busy.log'" "(h) telling the operator how to kill it instead"
RCB=$(run_obs "$GOOD" "$HD" "http://127.0.0.1:$GOOD_PORT" "$ROOT/h-oneshot.log")
check "[ $RCB -eq 0 ]" "(h) a ONE-SHOT run still works while that lock is held (it exited $RCB)"
check "grep -q 'PAIR HOLDS' '$ROOT/h-oneshot.log'" "(h) and measures the pair, as a person or a movement step needs"
printf '%s\n' "999999" > "$HD/observer-loop.lock"
HD2="$ROOT/h2"; mkdir -p "$HD2"; printf '%s\n' "999999" > "$HD2/observer-loop.lock"
ANTUM_OBSERVE_URL="http://127.0.0.1:$GOOD_PORT" ANTUM_OBSERVE_TREE="$GOOD" ANTUM_OBSERVE_DIR="$HD2" \
  ANTUM_OBSERVE_TIMEOUT=5 bash "$OBS" --loop 1 > "$ROOT/h-loop.log" 2>&1 &
LOOP_SH=$!
sleep 4
LOOP_PID=$(head -1 "$HD2/observer-loop.lock" 2>/dev/null)
check "grep -q 'stale lock' '$ROOT/h-loop.log'" "(h) a STALE lock (a dead pid) is named, and does not block arming"
check "[ -n '$LOOP_PID' ] && [ '$LOOP_PID' != '999999' ] && kill -0 '$LOOP_PID' 2>/dev/null" \
  "(h) the loop records its OWN pid in the lock (pid ${LOOP_PID:-none})"
check "[ \"\$(wc -l < '$HD2/runs.jsonl' 2>/dev/null || echo 0)\" -ge 2 ]" "(h) and records a run each interval (at least 2 in 4s)"
kill "$LOOP_PID" 2>/dev/null; wait "$LOOP_SH" 2>/dev/null
sleep 1
check "[ ! -f '$HD2/observer-loop.lock' ]" "(h) killing it by that pid ends the loop and clears its lock"

echo
echo "== (i) --status answers 'is the observer alive?' from the record alone =="
SD="$ROOT/s"
ANTUM_OBSERVE_DIR="$SD" bash "$OBS" --status > "$ROOT/s-none.log" 2>&1
check "[ $? -eq 0 ]" "(i) --status exits 0 with no record at all"
check "grep -q 'NO RECORD YET' '$ROOT/s-none.log'" "(i) and says NO RECORD YET rather than implying the product is fine"
check "grep -q 'not the same as the product being fine' '$ROOT/s-none.log'" "(i) saying exactly that, in those words"
run_obs "$GOOD" "$SD" "http://127.0.0.1:$GOOD_PORT" "$ROOT/s-run.log" > /dev/null
ANTUM_OBSERVE_DIR="$SD" bash "$OBS" --status > "$ROOT/s-there.log" 2>&1
check "grep -q 'runs recorded: 1' '$ROOT/s-there.log'" "(i) with a record it reports how many runs are recorded"
check "grep -q 'last run:' '$ROOT/s-there.log'" "(i) the last run and its verdict"
check "grep -q 'age:' '$ROOT/s-there.log'" "(i) its age — the number that makes a dead observer visible"
check "grep -q 'no loop is armed\\|not running' '$ROOT/s-there.log'" "(i) and whether a loop is actually armed"

echo
echo "== (j) the live public URL (opt-in; named when not run) =="
if [ "${ANTUM_OBSERVE_LIVE:-0}" = "1" ]; then
  LD="$ROOT/live"
  ANTUM_OBSERVE_URL="$LIVE_URL" ANTUM_OBSERVE_TREE="$LIVE_TREE" ANTUM_OBSERVE_DIR="$LD" \
    ANTUM_OBSERVE_TIMEOUT=25 bash "$OBS" > "$ROOT/live.log" 2>&1
  LC=$?
  check "[ $LC -eq 0 ]" "(j) the REAL public URL holds the pair (it exited $LC)"
  check "grep -q 'measured off the URL' '$ROOT/live.log'" "(j) and the run states what it measured there"
  echo "      the live URL it measured: $LIVE_URL"
  sed -n 's/^  measured off the URL: /      /p' "$ROOT/live.log"
else
  echo "  NOT RUN: the live-URL case. Set ANTUM_OBSERVE_LIVE=1 to include it (this suite never touches the"
  echo "  live site by default, and it says so rather than quietly counting one fewer check)."
fi

echo
TOTAL=$((PASS + FAIL))
echo "RESULT: $PASS passed, $FAIL failed (of $TOTAL checks; the live-URL case is separate and opt-in)"
[ "$FAIL" -eq 0 ] || exit 1
