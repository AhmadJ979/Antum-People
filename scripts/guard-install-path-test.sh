#!/bin/bash
# guard-install-path-test.sh - prove the guard can no longer INSTALL inside the deployed tree.
#
# WHAT THIS EXISTS FOR (WORKFLOW rule 43's sibling, measured 2026-11-08 at 8f74177)
#   #391 removed `rebuild_client()` from scripts/keep-alive.sh, so the guard can no longer BUILD in the
#   tree it serves. The same script still ran, at the top of `start_server()`:
#       if [ ! -d "node_modules" ]; then
#           log "server/node_modules missing - installing"
#           with_timeout 600 npm install 9>&- >> "$LOG_FILE" 2>&1 || log "WARN: npm install failed; ..."
#       fi
#   `start_server` is reached from THREE places in the poll (health==2 eviction, empty port, and
#   "server processes exist but the port does not answer"), so a missing node_modules was installed by
#   the guard, unattended, under a running server, with no PR, no merge and no movement - and
#   `server/package-lock.json` is TRACKED, so the start path could leave the deployed tree dirty too.
#   It also blocked: a 600 s foreground `with_timeout` on the path whose job is a sub-minute restore.
#
# WHAT IT ASSERTS
#   (0)   every path this test writes is inside its own scratch root;
#   (i)   the unit that replaced the install is extracted WHOLE from the script that runs, parses, is the
#         only dependency decision in the file, and `start_server` - which still starts the product -
#         calls it;
#   (ii)  THE STRUCTURAL ROW: a scanner that strips comments and quoted strings finds ZERO executable
#         npm invocations in scripts/keep-alive.sh - with anti-vacuity controls proving the scanner still
#         finds one when it is there (a planted line, and the pre-fix script from git history), and that
#         the file's npm text it deliberately does NOT flag (the refusal message) is still present;
#   (iii) the FIXED path against a scratch deployed tree, driving the REAL `start_server`: dependencies
#         present -> the product STARTS (the fixture server answers), npm never invoked, node_modules
#         byte-identical; dependencies missing -> a REFUSAL that names the tree, the exact install it
#         would have run, rule 43 and the sanctioned path - npm never invoked, node_modules still absent;
#   (iv)  four mutations, each of which must make a row above redden:
#         (a) the OLD implementation, extracted from this repository's own history -> npm RUNS in the
#             deployed tree and node_modules APPEARS there;
#         (b) an install in a scratch dir COPIED into the deployed tree with no merge -> the tree changes;
#         (c) a SILENT refusal (same return code, nothing logged) -> the named-refusal row reddens;
#         (d) the scanner itself, against the pre-fix script -> it finds the install (control for (ii));
#   (v)   END TO END: the real loop, armed against a real scratch worktree with a real server on its own
#         port: a `kill -9`ed listener is restored in under 60 s with client/dist untouched, node_modules
#         untouched and npm never invoked; with node_modules moved aside the loop REFUSES in its own log
#         (naming the tree and the install it will not run), still starts nothing that installs, still
#         holds its guard - and restores the listener as soon as the dependencies are put back, without
#         having installed anything.
#
# WHAT IT NEVER TOUCHES: the live tree, port 3000, the live database, the live listener, the guard, the
# gate credential files and /etc. Every path is an ANTUM_* override pointed into this test's own scratch
# root, and the scratch tree is a `git worktree` of HEAD under /tmp, removed on the way out. The stub
# `npm` on PATH reproduces the MECHANISM (an install writes node_modules into its own cwd) without an
# install: what rule 43 is about is WHERE the bytes land, not what they contain.
#
# WHAT IT CANNOT PROVE: that the live host behaves the same way. The off-host rig proves the functions
# and the loop's own start path; the live row is a movement's, not this test's.
#
# USAGE: bash scripts/guard-install-path-test.sh      (exit 0 = every case passed)
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOOP="$REPO/scripts/keep-alive.sh"
ROOT="${ANTUM_TEST_ROOT:-$(mktemp -d /tmp/guard-install-test.XXXXXX)}"
PORT="${ANTUM_TEST_PORT:-4872}"
PASS=0
FAIL=0
SKIP=0
SCRATCH_TREE=""
LOOP_PID=""

ok()   { echo "  PASS  $*"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $*"; FAIL=$((FAIL+1)); }
# A case that CANNOT RUN must never read as a pass: it is counted and printed SKIP-FLAGGED, and the
# run exits 3 (the code check-all.py declares via absent_exit=3), never 0.
skip() { echo "  SKIP  $*"; SKIP=$((SKIP+1)); }
check(){ if eval "$1"; then ok "$2"; else bad "$2"; fi; }

stop_loop() {
    local p
    [ -n "$SCRATCH_TREE" ] || return 0
    for p in $(lsof -t "$SCRATCH_TREE/server/keep-alive.lock" 2>/dev/null | sort -u); do
        kill -9 "$p" 2>/dev/null
    done
}
stop_listener() {
    local p
    for p in $(lsof -t -i ":$PORT" -sTCP:LISTEN 2>/dev/null); do kill -9 "$p" 2>/dev/null; done
}
cleanup() {
    stop_loop
    stop_listener
    if [ -n "$SCRATCH_TREE" ]; then
        git -C "$REPO" worktree remove --force "$SCRATCH_TREE" >/dev/null 2>&1
        rm -rf "$SCRATCH_TREE" 2>/dev/null
    fi
    rm -rf "$ROOT"
}
trap cleanup EXIT

mkdir -p "$ROOT" || { echo "ABORT: no scratch space under $ROOT"; exit 2; }

# md5 + mtime + size of every file under a directory, read from the tree itself.
snapshot() {  # $1 = tree, $2 = prefix, $3 = relative dir
    ( cd "$1" && find "${3:-client/dist}" -type f -printf '%p\t%T@\t%s\n' 2>/dev/null | sort ) > "$2.meta"
    ( cd "$1" && find "${3:-client/dist}" -type f -print0 2>/dev/null | sort -z | xargs -0 -r md5sum ) > "$2.md5"
}
tree_unchanged() {  # $1, $2 = snapshot prefixes
    diff -q "$1.meta" "$2.meta" >/dev/null 2>&1 && diff -q "$1.md5" "$2.md5" >/dev/null 2>&1
}
health()     { curl -s -o /dev/null -w '%{http_code}' --noproxy '*' --max-time 5 "http://127.0.0.1:$PORT/api/employees"; }
wait_health(){ local i; for i in $(seq 1 "${1:-30}"); do [ "$(health)" = "401" ] && return 0; sleep 1; done; return 1; }
listener()   { lsof -t -i ":$PORT" -sTCP:LISTEN 2>/dev/null | head -1; }

# --- THE STRUCTURAL SCANNER ------------------------------------------------------------------
# Report every EXECUTABLE npm invocation in a shell script: comments and the contents of quoted
# strings are stripped first, so a refusal MESSAGE that names the install it will not run is not
# mistaken for the install. Command position is "preceded by anything that is not a word character",
# which catches `npm install`, `command npm ci`, `timeout 600 npm install` and `$ROOT/bin/npm install`.
npm_writes() {  # $1 = file; prints "LINE: stripped text" for each finding
    awk '
    {
        line = $0; out = ""; q = ""; n = length(line)
        for (i = 1; i <= n; i++) {
            c = substr(line, i, 1)
            if (q != "") { if (c == q) { q = "" }; continue }
            if (c == "\"" || c == "\047") { q = c; continue }
            if (c == "#") { break }
            out = out c
        }
        if (out ~ /(^|[^A-Za-z0-9_.-])(npm|npx)[ \t]+(install|ci|run|i|exec)([ \t]|$)/) print NR": "out
    }' "$1"
}

echo "=== guard-install-path-test $(date -Iseconds) ==="
echo "  repo    $REPO"
echo "  loop    $LOOP ($(stat -c %s "$LOOP" 2>/dev/null) B)"
echo "  scratch $ROOT   port $PORT"
echo

# --- the names the extracted unit borrows from the loop --------------------------------------
# `log` is the loop's; `wait_for_health` is the loop's too and is replaced here by a real HTTP poll so
# that "the product starts" is measured against a listener, not against a stub's return value.
cat > "$ROOT/harness.sh" <<'EOS'
log() { printf '%s\n' "$*" >> "${GUARD_LOG:-/dev/null}"; }
# The loop's own helper, as it defines it: the pre-fix implementation (mutation (a)) calls it.
with_timeout() { local seconds="$1"; shift; if command -v timeout >/dev/null 2>&1; then timeout "$seconds" "$@"; else "$@"; fi; }
wait_for_health() {
    local i
    for i in $(seq 1 15); do
        if curl -s -o /dev/null -w '%{http_code}' --noproxy '*' --max-time 2 \
             "http://127.0.0.1:${PORT}/api/employees" 2>/dev/null | grep -q 401; then
            log "harness: the fixture server answered the 401 contract after ${i}s"
            return 0
        fi
        sleep 1
    done
    log "harness: nothing answered the 401 contract within 15s"
    return 1
}
EOS

# --- a stand-in npm that reproduces THE MECHANISM, not an install ----------------------------
# `npm install` writes node_modules into ITS CURRENT DIRECTORY. That is what the real install does,
# and where those bytes land is the whole subject of rule 43's sibling.
mkdir -p "$ROOT/bin"
cat > "$ROOT/bin/npm" <<'EOS'
#!/bin/bash
printf 'npm %s (cwd %s)\n' "$*" "$PWD" >> "${NPM_CALLS:-/dev/null}"
mkdir -p node_modules
printf 'installed by a stub nobody reviewed (%s)\n' "$(date +%s%N)" > node_modules/.installed-by-stub
exit 0
EOS
chmod +x "$ROOT/bin/npm"

# --- a scratch "deployed tree": the things the start path reads ------------------------------
# server/index.js REQUIRES a module that lives in server/node_modules, exactly as the real server
# requires express: with the dependencies absent, node cannot start the product - which is why the
# refusal has to be loud rather than a silent skip.
mk_fixture() {  # $1 = dir, $2 = with-deps (yes|no)
    rm -rf "$1"
    mkdir -p "$1/client/dist/assets" "$1/client" "$1/server" "$1/scripts"
    printf '<!doctype html>\n<html><head><title>Antum People</title>\n<script type="module" crossorigin src="/assets/index-REAL1.js"></script>\n</head><body><div id="root"></div></body></html>\n' > "$1/client/dist/index.html"
    printf 'console.log("the bundle that was reviewed and merged");\n' > "$1/client/dist/assets/index-REAL1.js"
    printf '/* the stylesheet that was reviewed and merged */\n' > "$1/client/dist/assets/index-REAL1.css"
    printf '{"name":"antum-client","version":"0.0.0","scripts":{"build":"vite build"}}\n' > "$1/client/package.json"
    printf '{"name":"antum-server","version":"0.0.0","dependencies":{"fixturedep":"1.0.0"}}\n' > "$1/server/package.json"
    printf '{"name":"antum-server","lockfileVersion":3,"packages":{}}\n' > "$1/server/package-lock.json"
    cat > "$1/server/index.js" <<'EOS'
// The fixture server: it REQUIRES a module from server/node_modules, exactly as the real one requires
// express, and answers the 401 contract the guard's health check asserts.
const dep = require("fixturedep");
const http = require("http");
const port = Number(process.env.PORT || 0);
http.createServer((req, res) => {
    if (req.url === "/api/employees") {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Authentication token required" }));
        return;
    }
    res.writeHead(404); res.end(dep.name);
}).listen(port, "127.0.0.1");
EOS
    if [ "${2:-yes}" = "yes" ]; then
        mkdir -p "$1/server/node_modules/fixturedep"
        printf 'module.exports = { name: "fixturedep-1.0.0" };\n' > "$1/server/node_modules/fixturedep/index.js"
        printf '{"name":"fixturedep","version":"1.0.0","main":"index.js"}\n' > "$1/server/node_modules/fixturedep/package.json"
    fi
}

run_case() {  # $1 = lib file, $2 = entry function, $3 = tree ; sets CASE_RC
    : > "$ROOT/case.log"
    : > "$ROOT/npm-calls"
    ( export DEPLOY_DIR="$3" GUARD_LOG="$ROOT/case.log" LOG_FILE="$ROOT/case.log"
      export SERVER_LOG="$ROOT/case-server.log" PORT="$PORT"
      export NPM_CALLS="$ROOT/npm-calls" ROOT="$ROOT"
      export PATH="$ROOT/bin:$PATH"
      set +u
      # shellcheck disable=SC1090
      source "$ROOT/harness.sh"
      # shellcheck disable=SC1090
      source "$1"
      "$2" )
    CASE_RC=$?
}

# --- (0) nothing this test touches may be outside its own scratch root -----------------------
echo "== (0) every path this test writes is inside its own scratch root =="
check "case '$ROOT' in /tmp/*) true ;; *) false ;; esac" "(0) the scratch root is under /tmp ($ROOT)"
check "[ \"\$(readlink -f '$LOOP')\" = '$REPO/scripts/keep-alive.sh' ]" "(0) the script under test is this tree's own"
check "grep -q 'DEPLOY_DIR=\"\\\${ANTUM_DEPLOY_DIR:-/home/team/shared/probable-octo-sniffle}\"' '$LOOP'" \
      "(0) the loop's deployed tree is the host path only as the DEFAULT behind ANTUM_DEPLOY_DIR"
check "grep -q 'HOOK_DST=\"\\\${ANTUM_HOOK_DST:-/etc/profile.d/zz-antum-product-guard.sh}\"' '$LOOP'" \
      "(0) the login hook is an override too, so this test never writes to /etc"

# --- (i) the unit is extracted WHOLE from the script that runs, and it parses -----------------
echo
echo "== (i) the install decision is one marked unit, extracted from the real script =="
UNIT="$ROOT/unit.sh"
awk '/^# >>> ANTUM GUARD INSTALL DECISION/{p=1} p{print} /^# <<< ANTUM GUARD INSTALL DECISION/{p=0}' "$LOOP" > "$UNIT"
UNIT_LINES=$(wc -l < "$UNIT")
echo "  extracted: $UNIT_LINES lines from $LOOP"
# ANTI-VACUOUS: an extraction that found nothing would make every case below a green about nothing.
check "[ $UNIT_LINES -gt 30 ]" "(i) the extraction is not empty ($UNIT_LINES lines)"
check "bash -n '$UNIT'" "(i) the extracted unit parses as shell"
for fn in guard_deps_state refuse_install_in_deployed_tree guard_ensure_deps start_server; do
    check "grep -q '^$fn() {' '$UNIT'" "(i) the unit defines $fn()"
done
check "grep -q '^# >>> ANTUM GUARD INSTALL DECISION' '$LOOP' && grep -q '^# <<< ANTUM GUARD INSTALL DECISION' '$LOOP'" \
      "(i) both markers are in the loop, so the range has an end"
for fn in guard_deps_state refuse_install_in_deployed_tree guard_ensure_deps start_server; do
    check "[ \"\$(grep -c '^$fn() {' '$LOOP')\" = '1' ]" "(i) $fn is defined exactly once in the loop (no shadow copy)"
done
check "grep -q 'guard_ensure_deps || true' '$UNIT'" "(i) start_server asks the refusal and carries on to the start"
check "[ \"\$(grep -c 'guard_ensure_deps || true' '$LOOP')\" = '1' ]" "(i) and it is the only call site in the loop"
check "[ \"\$(grep -c '^[[:space:]]*start_server$' '$LOOP')\" -ge 3 ]" \
      "(i) start_server is still reached from the poll ($(grep -c '^[[:space:]]*start_server$' "$LOOP") call sites), so this unit is on a live path"
check "! grep -qE '^[[:space:]]*with_timeout 600 npm' '$LOOP'" "(i) the 600 s foreground install is GONE from the loop"

# --- (ii) THE STRUCTURAL ROW: no executable npm write anywhere in the loop --------------------
echo
echo "== (ii) the structural row: keep-alive.sh contains no executable npm invocation =="
NPM_FOUND="$(npm_writes "$LOOP")"
NPM_COUNT=$(printf '%s' "$NPM_FOUND" | grep -c . )
check "[ '$NPM_COUNT' = '0' ]" "(ii) executable npm invocations in scripts/keep-alive.sh: $NPM_COUNT (want 0)"
[ "$NPM_COUNT" = "0" ] || printf '%s\n' "$NPM_FOUND" | sed 's/^/      /'
# ANTI-VACUITY 1: the scanner is not blind. Plant the historical line and it must be found.
PLANT="$ROOT/planted.sh"
{ printf '#!/bin/bash\nstart_server() {\n    with_timeout 600 npm install 9>&- >> "$LOG_FILE" 2>&1 || true\n}\n'; } > "$PLANT"
check "[ \"\$(npm_writes '$PLANT' | grep -c .)\" = '1' ]" \
      "(ii) control: the scanner FINDS a planted 'npm install' (1 finding on a 4-line file)"
# ANTI-VACUITY 2: the file still carries npm TEXT (the refusal message) - so the zero above is
# "npm appears only where it is spoken about", not "the word npm is absent from the file".
check "[ \"\$(grep -c 'npm' '$LOOP')\" -ge 5 ]" \
      "(ii) the loop still mentions npm $(grep -c 'npm' "$LOOP") times - all in comments and refusal messages"
check "grep -q 'the install it would have run, and will not: ( cd \$DEPLOY_DIR/server && npm install )' '$LOOP'" \
      "(ii) the refusal names the exact install, in a message the scanner correctly does not flag"
check "[ \"\$(npm_writes '$LOOP' | grep -c 'npm ci')\" = '0' ]" \
      "(ii) the refusal's 'npm ci' line is not counted as an invocation either"
# The build path's own markers must survive: this unit did not swallow the rebuild decision.
check "grep -q '^# >>> ANTUM GUARD REBUILD DECISION' '$LOOP'" "(ii) the rebuild decision unit (#391) is still in the loop"
check "[ \"\$(npm_writes '$LOOP' | grep -c 'npm run build')\" = '0' ]" \
      "(ii) and it still publishes no 'npm run build' invocation either"

# --- (iii) the FIXED path, on a scratch deployed tree, driving the REAL start_server ----------
echo
echo "== (iii) the fixed path: dependencies present (the product starts), and missing (a refusal) =="
FIX="$ROOT/fix-tree"
mk_fixture "$FIX" yes
snapshot "$FIX" "$ROOT/snap-a-before" server/node_modules
run_case "$UNIT" start_server "$FIX"
check "[ $CASE_RC -eq 0 ]" "(iii) deps present: start_server brings the product UP (rc=$CASE_RC, 401 contract answered)"
check "[ -n \"\$(lsof -t -i ':$PORT' -sTCP:LISTEN 2>/dev/null)\" ]" "(iii) deps present: the fixture server is listening on $PORT"
check "! grep -q 'REFUSAL' '$ROOT/case.log'" "(iii) deps present: no refusal is logged"
check "[ ! -s '$ROOT/npm-calls' ]" "(iii) deps present: npm is never invoked"
snapshot "$FIX" "$ROOT/snap-a-after" server/node_modules
check "tree_unchanged '$ROOT/snap-a-before' '$ROOT/snap-a-after'" \
      "(iii) deps present: server/node_modules is byte-identical (md5) and mtime-identical afterwards"
stop_listener

rm -rf "$FIX/server/node_modules"
snapshot "$FIX" "$ROOT/snap-b-before" server/node_modules
run_case "$UNIT" start_server "$FIX"
check "[ $CASE_RC -eq 1 ]" "(iii) deps missing: start_server reports failure, it does not pretend to start (rc=$CASE_RC)"
check "grep -q 'REFUSAL: $FIX/server/node_modules is missing' '$ROOT/case.log'" \
      "(iii) deps missing: the refusal NAMES the tree and the directory it wanted"
check "grep -q 'will NOT install in the deployed tree' '$ROOT/case.log'" \
      "(iii) deps missing: the refusal says what it will not do"
check "grep -q \"cd $FIX/server && npm install\" '$ROOT/case.log'" \
      "(iii) deps missing: the refusal names the exact install it would have run"
check "grep -q 'WORKFLOW rule 43' '$ROOT/case.log'" \
      "(iii) deps missing: the refusal cites the rule it is the sibling of"
check "grep -q 'deploy-main.sh' '$ROOT/case.log'" \
      "(iii) deps missing: the refusal names the sanctioned path instead"
check "grep -q 'npm ci' '$ROOT/case.log'" \
      "(iii) deps missing: and names the one-off install a fresh host needs, by hand"
check "[ ! -s '$ROOT/npm-calls' ]" "(iii) deps missing: npm is never invoked (a refusal, not an install)"
check "[ ! -d '$FIX/server/node_modules' ]" "(iii) deps missing: no node_modules was produced in the deployed tree"
snapshot "$FIX" "$ROOT/snap-b-after" server/node_modules
check "tree_unchanged '$ROOT/snap-b-before' '$ROOT/snap-b-after'" \
      "(iii) deps missing: server/node_modules is still absent - the tree is untouched"

# --- (iii-c) THE RESIDUAL, measured: a PARTIAL node_modules is not detected ------------------
echo
echo "== (iii-c) residual: node_modules present, but a required module missing =="
FIX_PART="$ROOT/partial-tree"
mk_fixture "$FIX_PART" yes
rm -rf "$FIX_PART/server/node_modules/fixturedep"
snapshot "$FIX_PART" "$ROOT/snap-g-before" server/node_modules
run_case "$UNIT" start_server "$FIX_PART"
check "[ $CASE_RC -eq 1 ]" "(iii-c) partial deps: the product does NOT start (rc=$CASE_RC) - node cannot load a dependency"
check "! grep -q 'REFUSAL' '$ROOT/case.log'" \
      "(iii-c) NAMED OPEN ITEM: no reason is logged - guard_deps_state tests '-d node_modules', which a PARTIAL tree passes"
check "[ ! -s '$ROOT/npm-calls' ]" "(iii-c) partial deps: still no install - the guard writes nothing, by design"
snapshot "$FIX_PART" "$ROOT/snap-g-after" server/node_modules
check "tree_unchanged '$ROOT/snap-g-before' '$ROOT/snap-g-after'" "(iii-c) partial deps: the tree is untouched"
stop_listener

# --- (iv-a) MUTATION: the old implementation, from this repository's own history -------------
echo
echo "== (iv-a) MUTATION: the old start_server restored (extracted from git history) =="
# The newest commit whose blob still carries the install line. After this fix merges that is the
# commit the fix removed it from, so the mutation never rots into "could not run" and silently pass.
PRE_FIX=""
for c in $(git -C "$REPO" log --format=%H -S'with_timeout 600 npm install' -- scripts/keep-alive.sh 2>/dev/null); do
    if git -C "$REPO" show "$c:scripts/keep-alive.sh" 2>/dev/null | grep -q 'with_timeout 600 npm install'; then
        PRE_FIX="$c"
        break
    fi
done
check "[ -n '$PRE_FIX' ]" "(iv-a) the pre-fix script is found in history (${PRE_FIX:0:12}), so the mutation can run"
if [ -n "$PRE_FIX" ]; then
    git -C "$REPO" show "$PRE_FIX:scripts/keep-alive.sh" > "$ROOT/pre-fix.sh"
    # (iv-d) the scanner's control on the PAST: the historical script IS an executable install.
    HIST_FOUND="$(npm_writes "$ROOT/pre-fix.sh" | grep -c .)"
    check "[ '$HIST_FOUND' -ge 1 ]" \
          "MUTATION (d) CAUGHT: the scanner finds $HIST_FOUND executable npm invocation(s) in the pre-fix script"
    npm_writes "$ROOT/pre-fix.sh" | sed 's/^/      /'
    awk '/^start_server\(\) \{/{p=1} p{print} p&&/^\}$/{exit}' "$ROOT/pre-fix.sh" > "$ROOT/old-lib.sh"
    check "grep -q 'npm install' '$ROOT/old-lib.sh'" "(iv-a) the extracted old implementation is the one that installs"
    FIX_OLD="$ROOT/old-tree"
    mk_fixture "$FIX_OLD" no
    snapshot "$FIX_OLD" "$ROOT/snap-c-before" server/node_modules
    run_case "$ROOT/old-lib.sh" start_server "$FIX_OLD"
    snapshot "$FIX_OLD" "$ROOT/snap-c-after" server/node_modules
    check "! tree_unchanged '$ROOT/snap-c-before' '$ROOT/snap-c-after'" \
          "MUTATION (a) CAUGHT: the old behaviour WRITES node_modules into the deployed tree"
    check "[ -d '$FIX_OLD/server/node_modules' ]" \
          "MUTATION (a) CAUGHT: node_modules now exists in the deployed tree, put there by the guard"
    check "[ -s '$ROOT/npm-calls' ]" \
          "MUTATION (a) CAUGHT: npm ran inside the deployed tree ($(wc -l < "$ROOT/npm-calls" | tr -d ' ') invocation(s))"
    echo "  --- what the mutant wrote into the deployed tree (the defect, reproduced):"
    diff "$ROOT/snap-c-before.md5" "$ROOT/snap-c-after.md5" 2>/dev/null | sed 's/^/      /'
    diff "$ROOT/snap-c-before.meta" "$ROOT/snap-c-after.meta" 2>/dev/null | sed 's/^/      /'
    stop_listener
else
    bad "(iv-a) the mutation could not run - a mutation that cannot run is not a pass"
fi

# --- (iv-b) MUTATION: install in a scratch dir, then copy node_modules in --------------------
echo
echo "== (iv-b) MUTATION: a scratch install copied into the deployed tree, with no merge =="
cat > "$ROOT/copy-mutant.sh" <<'EOS'
start_server() {
    local scratch="${ROOT}/scratch-install"
    mkdir -p "$scratch/server"
    ( cd "$scratch/server" && npm install --no-fund --no-audit ) >/dev/null 2>&1
    mkdir -p "$DEPLOY_DIR/server"
    cp -a "$scratch/server/node_modules" "$DEPLOY_DIR/server/"
    log "node_modules installed in $scratch and copied into $DEPLOY_DIR/server"
    return 0
}
EOS
FIX_COPY="$ROOT/copy-tree"
mk_fixture "$FIX_COPY" no
snapshot "$FIX_COPY" "$ROOT/snap-d-before" server/node_modules
run_case "$ROOT/copy-mutant.sh" start_server "$FIX_COPY"
snapshot "$FIX_COPY" "$ROOT/snap-d-after" server/node_modules
check "! tree_unchanged '$ROOT/snap-d-before' '$ROOT/snap-d-after'" \
      "MUTATION (b) CAUGHT: node_modules copied into the deployed tree CHANGES the tree"

# --- (iv-c) MUTATION: a silent refusal -------------------------------------------------------
echo
echo "== (iv-c) MUTATION: a refusal that says nothing (the silent skip) =="
cat > "$ROOT/silent-mutant.sh" <<'EOS'
guard_deps_state() { [ -d "$DEPLOY_DIR/server/node_modules" ]; }
guard_ensure_deps() { guard_deps_state || return 1; return 0; }
start_server() {
    cd "$DEPLOY_DIR/server" || return 1
    guard_ensure_deps || true
    PORT="$PORT" setsid nohup node index.js >> "$SERVER_LOG" 2>&1 9>&- &
    wait_for_health
}
EOS
FIX_SILENT="$ROOT/silent-tree"
mk_fixture "$FIX_SILENT" no
run_case "$ROOT/silent-mutant.sh" start_server "$FIX_SILENT"
check "[ $CASE_RC -eq 1 ]" "(iv-c) the silent mutant returns the same code as the fix - rc alone cannot tell them apart"
check "! grep -q 'REFUSAL: ' '$ROOT/case.log'" \
      "MUTATION (c) CAUGHT: the row that requires a NAMED refusal reddens on a silent skip"

# --- (v) END TO END: the real loop, a real server, a killed listener -------------------------
echo
echo "== (v) end to end: the real loop against a real scratch tree =="
if [ -n "$(listener)" ]; then
    skip "(v) port $PORT is already in use - the end-to-end half CANNOT RUN against a stranger's listener"
else
    SCRATCH_TREE="$ROOT/tree"
    if ! git -C "$REPO" worktree add --detach "$SCRATCH_TREE" HEAD >/dev/null 2>&1; then
        skip "(v) could not create the scratch worktree under $ROOT - the end-to-end half CANNOT RUN"
    else
        ln -sfn "$REPO/server/node_modules" "$SCRATCH_TREE/server/node_modules"
        mkdir -p "$SCRATCH_TREE/client/dist/assets" "$ROOT/creds"
        printf '<!doctype html>\n<html><head><title>Antum People</title>\n<script type="module" crossorigin src="/assets/index-SCRATCH1.js"></script>\n</head><body><div id="root"></div></body></html>\n' > "$SCRATCH_TREE/client/dist/index.html"
        printf 'console.log("the scratch bundle the rig serves");\n' > "$SCRATCH_TREE/client/dist/assets/index-SCRATCH1.js"
        printf '/* scratch css */\n' > "$SCRATCH_TREE/client/dist/assets/index-SCRATCH1.css"
        node -e "console.log(require('$REPO/server/node_modules/bcryptjs').hashSync('scratch-'+Date.now(),12))" > "$ROOT/creds/passcode" 2>/dev/null \
            || echo '$2a$12$scratchscratchscratchscratchscratchscratchscratchscratchscra' > "$ROOT/creds/passcode"
        head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$ROOT/creds/secret"
        cat > "$ROOT/env.sh" <<EOS
export JWT_SECRET='scratch-$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')'
export ENCRYPTION_KEY='scratch-$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')'
EOS
        export PRODUCT_DB_PATH="$ROOT/db.sqlite"
        export ANTUM_DEPLOY_DIR="$SCRATCH_TREE"
        export ANTUM_ENV_FILE="$ROOT/env.sh"
        export ANTUM_HOOK_DST="$ROOT/hook.sh"
        export ANTUM_PORT="$PORT"
        export ANTUM_START_DELAY=1
        export ANTUM_POLL_INTERVAL=5
        export ANTUM_LOCK_ATTEMPTS=2
        export ANTUM_LOCK_RETRY_WAIT=2
        export ANTUM_GATE_PASSCODE_FILE="$ROOT/creds/passcode"
        export ANTUM_GATE_SECRET_FILE="$ROOT/creds/secret"
        export ANTUM_GATE_SHOWN_ONCE="$ROOT/creds/passcode.shown-once"
        export NPM_CALLS="$ROOT/npm-calls"
        : > "$NPM_CALLS"

        L="$SCRATCH_TREE/server/keep-alive.log"
        ( cd "$SCRATCH_TREE" && PATH="$ROOT/bin:$PATH" setsid nohup bash scripts/keep-alive.sh >> "$ROOT/loop.out" 2>&1 < /dev/null & )
        if wait_health 40; then
            ok "(v) the loop armed and the scratch server answers the 401 contract on $PORT"
        else
            bad "(v) the loop did not bring the scratch server up - nothing below can be read as a pass"
        fi
        echo "  loop log: $L"
        check "[ -L '$SCRATCH_TREE/server/node_modules' ]" "(v) precondition: the scratch tree's node_modules is a symlink to the repo's (nothing is installed here)"
        NM_STAT_BEFORE="$(stat -c '%i %Y %s' "$SCRATCH_TREE/server/node_modules")"

        # --- the listener is killed with the dependencies present: it must come back, nothing written
        snapshot "$SCRATCH_TREE" "$ROOT/snap-e-before"
        KILLED="$(listener)"
        kill -9 "$KILLED" 2>/dev/null
        T0=$(date +%s)
        if wait_health 60; then
            RESTORED=$(( $(date +%s) - T0 ))
            check "[ $RESTORED -lt 60 ]" "(v) a kill -9 of the listener (pid $KILLED) was restored in ${RESTORED}s (< 60s)"
        else
            bad "(v) the killed listener was NOT restored within 60s"
        fi
        snapshot "$SCRATCH_TREE" "$ROOT/snap-e-after"
        check "tree_unchanged '$ROOT/snap-e-before' '$ROOT/snap-e-after'" \
              "(v) the recovery left client/dist byte-identical (md5) and mtime-identical"
        check "[ \"\$(stat -c '%i %Y %s' '$SCRATCH_TREE/server/node_modules')\" = '$NM_STAT_BEFORE' ]" \
              "(v) the recovery left server/node_modules itself untouched (same inode, mtime, size)"
        check "[ ! -s '$NPM_CALLS' ]" "(v) the recovery invoked npm ZERO times"

        # --- now the dependencies are gone: the loop must REFUSE, not install, and stay up
        mv "$SCRATCH_TREE/server/node_modules" "$SCRATCH_TREE/server/node_modules.away"
        KILLED2="$(listener)"
        kill -9 "$KILLED2" 2>/dev/null
        REFUSED=""
        for _ in $(seq 1 60); do
            if grep -q 'REFUSAL: ' "$L" 2>/dev/null; then REFUSED=1; break; fi
            sleep 1
        done
        check "[ -n '$REFUSED' ]" "(v) with NO node_modules the loop wrote a REFUSAL into its own log within 60s"
        check "grep -q 'REFUSAL: $SCRATCH_TREE/server/node_modules is missing' '$L'" \
              "(v) the refusal NAMES the tree and the directory, in the loop's own log"
        check "grep -q 'will NOT install in the deployed tree' '$L'" "(v) the refusal says what it will not do"
        check "grep -q 'deploy-main.sh' '$L'" "(v) the refusal names the sanctioned path in the loop's own log"
        check "[ ! -d '$SCRATCH_TREE/server/node_modules' ]" \
              "(v) nothing was installed into the deployed tree: node_modules is still absent"
        check "[ ! -s '$NPM_CALLS' ]" \
              "(v) the loop has invoked npm ZERO times across the whole run ($(wc -l < "$NPM_CALLS" | tr -d ' ') call(s))"
        check "[ -n \"\$(lsof -t '$SCRATCH_TREE/server/keep-alive.lock' 2>/dev/null)\" ]" \
              "(v) the loop is still holding its lock - a refusal is not an exit"

        # --- put the dependencies back: the guard must restore the listener, still installing nothing
        mv "$SCRATCH_TREE/server/node_modules.away" "$SCRATCH_TREE/server/node_modules"
        T2=$(date +%s)
        if wait_health 60; then
            RESTORED2=$(( $(date +%s) - T2 ))
            check "[ $RESTORED2 -lt 60 ]" "(v) with the dependencies back, the listener was restored in ${RESTORED2}s, installing nothing"
        else
            bad "(v) the listener was NOT restored after the dependencies came back"
        fi
        check "[ ! -s '$NPM_CALLS' ]" \
              "(v) npm was never invoked, once, in the whole end-to-end run ($(wc -l < "$NPM_CALLS" | tr -d ' ') call(s))"
        check "[ \"\$(git -C '$SCRATCH_TREE' status --porcelain -- server/package-lock.json server/node_modules | grep -c .)\" = '0' ]" \
              "(v) the deployed tree is still clean: no tracked file (package-lock.json) was rewritten"
        echo "  --- the refusal, as the loop wrote it:"
        grep 'REFUSAL: ' "$L" | tail -5 | sed 's/^/      /'

        stop_loop
        stop_listener
    fi
fi

echo
echo "=== result: $PASS passed, $FAIL failed, $SKIP skip-flagged ==="
[ "$FAIL" -eq 0 ] || exit 1
[ "$SKIP" -eq 0 ] || { echo "  a case that could not run is NOT a pass: exit 3 (SKIP-FLAGGED)"; exit 3; }
exit 0
