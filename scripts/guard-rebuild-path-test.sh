#!/bin/bash
# guard-rebuild-path-test.sh - prove the guard can no longer build inside the deployed tree.
#
# WHAT THIS EXISTS FOR (WORKFLOW rule 43, measured 2026-11-08)
#   scripts/keep-alive.sh carried `rebuild_client()`, called from the recovery branch as
#   `[ -f "$DEPLOY_DIR/client/dist/index.html" ] || rebuild_client`, which ran
#       ( cd "$DEPLOY_DIR/client" && npm ci && npm run build )
#   INSIDE the deployed tree - the tree the server serves. `client/dist` is untracked, so a recovery
#   could replace the live bundle with bytes no PR, no merge and no movement had ever seen, and a
#   checkout would not have undone it. That is the #353 defect (served index-B3KFG1-j.js, 295,549 B,
#   from an unmerged branch). It was never rehearsed, and it was the last way the deployed tree
#   could change without a merge.
#
# WHAT IT ASSERTS
#   (i)   the unit that replaced it is extracted WHOLE from the script that runs, parses, and is the
#         only bundle decision in the file: `rebuild_client` is neither defined nor called;
#   (ii)  the FIXED path against a scratch deployed tree: a bundle present -> nothing to do, no npm;
#         a bundle missing -> a REFUSAL that names the tree, the command it would have run and the
#         sanctioned path, npm never invoked, and client/dist BYTE-IDENTICAL (md5 + mtime) after;
#   (iii) three mutations, each of which must make a row above redden:
#         (a) the OLD implementation, extracted from this repository's own history (the newest commit
#             whose blob still defines `rebuild_client`), restored -> the deployed tree CHANGES;
#         (b) a rebuild that builds in a scratch tree and then COPIES the result into the deployed
#             tree with no merge -> the deployed tree CHANGES;
#         (c) the control: the fixed path -> the tree is unchanged (that is row (ii));
#         (d) a refusal that is SILENT (returns the same code, logs nothing) -> the row that requires
#             a named refusal reddens. A silent skip is the failure mode this test is written against;
#   (iv)  END TO END: the real loop, armed against a real scratch tree with a real server on its own
#         port, restores a `kill -9`ed listener in under 60 s with client/dist untouched; then with
#         index.html removed it REFUSES in its own log, still restores the listener, still builds
#         nothing, and its npm stub is never called once in the whole run.
#
# WHAT IT NEVER TOUCHES: the live tree, port 3000, the live database, the live listener, the guard,
# the gate credential files and /etc. Every path is an ANTUM_* override pointed into this test's own
# scratch root, and the scratch tree is a `git worktree` of HEAD under /tmp, removed on the way out.
# The stub `npm` on PATH reproduces the MECHANISM (a build writes into its own cwd) without a build:
# what rule 43 is about is WHERE the bytes land, not what they contain.
#
# USAGE: bash scripts/guard-rebuild-path-test.sh      (exit 0 = every case passed)
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOOP="$REPO/scripts/keep-alive.sh"
ROOT="${ANTUM_TEST_ROOT:-$(mktemp -d /tmp/guard-rebuild-test.XXXXXX)}"
PORT="${ANTUM_TEST_PORT:-4871}"
PASS=0
FAIL=0
SCRATCH_TREE=""

ok()   { echo "  PASS  $*"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $*"; FAIL=$((FAIL+1)); }
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

# md5 + mtime + size of every file under client/dist, read from the tree itself.
snapshot() {  # $1 = tree, $2 = prefix
    ( cd "$1" && find client/dist -type f -printf '%p\t%T@\t%s\n' 2>/dev/null | sort ) > "$2.meta"
    ( cd "$1" && find client/dist -type f -print0 2>/dev/null | sort -z | xargs -0 -r md5sum ) > "$2.md5"
}
tree_unchanged() {  # $1, $2 = snapshot prefixes
    diff -q "$1.meta" "$2.meta" >/dev/null 2>&1 && diff -q "$1.md5" "$2.md5" >/dev/null 2>&1
}
health()     { curl -s -o /dev/null -w '%{http_code}' --noproxy '*' --max-time 5 "http://127.0.0.1:$PORT/api/employees"; }
wait_health(){ local i; for i in $(seq 1 "${1:-30}"); do [ "$(health)" = "401" ] && return 0; sleep 1; done; return 1; }
listener()   { lsof -t -i ":$PORT" -sTCP:LISTEN 2>/dev/null | head -1; }

echo "=== guard-rebuild-path-test $(date -Iseconds) ==="
echo "  repo    $REPO"
echo "  loop    $LOOP ($(stat -c %s "$LOOP" 2>/dev/null) B)"
echo "  scratch $ROOT   port $PORT"
echo

# --- the two names the extracted unit borrows from the loop ----------------------------------
# The unit calls `log`; the OLD implementation also calls `with_timeout` and writes to $LOG_FILE.
cat > "$ROOT/harness.sh" <<'EOS'
log() { printf '%s\n' "$*" >> "${GUARD_LOG:-/dev/null}"; }
with_timeout() { local t="$1"; shift; "$@"; }
EOS

# --- a stand-in npm that reproduces THE MECHANISM, not the build ------------------------------
# `npm run build` writes a bundle into ITS CURRENT DIRECTORY. That is what the real build does
# inside client/, and where the bytes land is the whole subject of rule 43.
mkdir -p "$ROOT/bin"
cat > "$ROOT/bin/npm" <<'EOS'
#!/bin/bash
printf 'npm %s (cwd %s)\n' "$*" "$PWD" >> "${NPM_CALLS:-/dev/null}"
case "${1:-}" in
    ci) exit 0 ;;
    run)
        if [ "${2:-}" = "build" ]; then
            mkdir -p dist/assets
            printf 'console.log("bytes nobody merged %s");\n' "$(date +%s%N)" > dist/assets/index-LEAKED.js
            printf '<!doctype html><title>leaked</title><script src="/assets/index-LEAKED.js"></script>\n' > dist/index.html
        fi
        exit 0 ;;
esac
exit 0
EOS
chmod +x "$ROOT/bin/npm"

# --- a scratch "deployed tree": the four things the decision reads ---------------------------
mk_fixture() {  # $1 = dir
    rm -rf "$1"
    mkdir -p "$1/client/dist/assets" "$1/client" "$1/server" "$1/scripts"
    printf '<!doctype html>\n<html><head><title>Antum People</title>\n<script type="module" crossorigin src="/assets/index-REAL1.js"></script>\n</head><body><div id="root"></div></body></html>\n' > "$1/client/dist/index.html"
    printf 'console.log("the bundle that was reviewed and merged");\n' > "$1/client/dist/assets/index-REAL1.js"
    printf '/* the stylesheet that was reviewed and merged */\n' > "$1/client/dist/assets/index-REAL1.css"
    printf '{"name":"antum-client","version":"0.0.0","scripts":{"build":"vite build"}}\n' > "$1/client/package.json"
}

run_case() {  # $1 = lib file, $2 = entry function, $3 = tree ; sets CASE_RC
    : > "$ROOT/case.log"
    : > "$ROOT/npm-calls"
    ( export DEPLOY_DIR="$3" GUARD_LOG="$ROOT/case.log" LOG_FILE="$ROOT/case.log"
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
echo "== (i) the rebuild decision is one marked unit, extracted from the real script =="
UNIT="$ROOT/unit.sh"
awk '/^# >>> ANTUM GUARD REBUILD DECISION/{p=1} p{print} /^# <<< ANTUM GUARD REBUILD DECISION/{p=0}' "$LOOP" > "$UNIT"
UNIT_LINES=$(wc -l < "$UNIT")
echo "  extracted: $UNIT_LINES lines from $LOOP"
# ANTI-VACUOUS: an extraction that found nothing would make every case below a green about nothing.
check "[ $UNIT_LINES -gt 20 ]" "(i) the extraction is not empty ($UNIT_LINES lines)"
check "bash -n '$UNIT'" "(i) the extracted unit parses as shell"
for fn in guard_bundle_state refuse_rebuild_in_deployed_tree guard_ensure_bundle; do
    check "grep -q '^$fn() {' '$UNIT'" "(i) the unit defines $fn()"
done
check "grep -q '^# >>> ANTUM GUARD REBUILD DECISION' '$LOOP' && grep -q '^# <<< ANTUM GUARD REBUILD DECISION' '$LOOP'" \
      "(i) both markers are in the loop, so the range has an end"
for fn in guard_bundle_state refuse_rebuild_in_deployed_tree guard_ensure_bundle; do
    check "[ \"\$(grep -c '^$fn() {' '$LOOP')\" = '1' ]" "(i) $fn is defined exactly once in the loop (no shadow copy)"
done
check "! grep -qE '^rebuild_client\(\)' '$LOOP'" "(i) the build path is GONE: rebuild_client is not defined in the loop"
check "! grep -qE '(^|[|;&[:space:]])rebuild_client([[:space:]]|\$)' '$LOOP'" "(i) and it is not called anywhere either"
check "grep -q 'guard_ensure_bundle || true' '$LOOP'" "(i) the recovery branch calls the refusal and carries on to the restart"

# --- (ii) the FIXED path, on a scratch deployed tree -----------------------------------------
echo
echo "== (ii) the fixed path: bundle present, and bundle missing =="
FIX="$ROOT/fix-tree"
mk_fixture "$FIX"
snapshot "$FIX" "$ROOT/snap-a-before"
run_case "$UNIT" guard_ensure_bundle "$FIX"
check "[ $CASE_RC -eq 0 ]" "(ii) bundle present: guard_ensure_bundle reports nothing to do (rc=$CASE_RC)"
check "! grep -q 'REFUSAL' '$ROOT/case.log'" "(ii) bundle present: no refusal is logged"
check "[ ! -s '$ROOT/npm-calls' ]" "(ii) bundle present: npm is never invoked"
snapshot "$FIX" "$ROOT/snap-a-after"
check "tree_unchanged '$ROOT/snap-a-before' '$ROOT/snap-a-after'" \
      "(ii) bundle present: client/dist is byte-identical (md5) and mtime-identical afterwards"

rm -f "$FIX/client/dist/index.html"
snapshot "$FIX" "$ROOT/snap-b-before"
run_case "$UNIT" guard_ensure_bundle "$FIX"
check "[ $CASE_RC -eq 1 ]" "(ii) bundle missing: guard_ensure_bundle refuses (rc=$CASE_RC)"
check "grep -q 'REFUSAL: $FIX/client/dist/index.html is missing' '$ROOT/case.log'" \
      "(ii) bundle missing: the refusal NAMES the tree and the file it wanted"
check "grep -q 'will NOT build in the deployed tree' '$ROOT/case.log'" \
      "(ii) bundle missing: the refusal says what it will not do"
check "grep -q 'npm ci --no-fund --no-audit && npm run build' '$ROOT/case.log'" \
      "(ii) bundle missing: the refusal names the exact command it would have run"
check "grep -q 'deploy-main.sh' '$ROOT/case.log'" \
      "(ii) bundle missing: the refusal names the sanctioned path instead"
check "[ ! -s '$ROOT/npm-calls' ]" "(ii) bundle missing: npm is never invoked (a refusal, not a build)"
check "[ ! -f '$FIX/client/dist/index.html' ]" "(ii) bundle missing: no bundle was produced in the deployed tree"
snapshot "$FIX" "$ROOT/snap-b-after"
check "tree_unchanged '$ROOT/snap-b-before' '$ROOT/snap-b-after'" \
      "(ii) bundle missing: client/dist is byte-identical (md5) and mtime-identical afterwards"

# --- (iii-a) MUTATION: the old implementation, from this repository's own history ------------
echo
echo "== (iii-a) MUTATION: the old implementation restored (extracted from git history) =="
# The newest commit whose blob still DEFINES rebuild_client. After this fix merges that is the
# commit the fix removed it from, so the mutation never rots into "could not run" and silently pass.
PRE_FIX=""
for c in $(git -C "$REPO" log --format=%H -S'rebuild_client() {' -- scripts/keep-alive.sh 2>/dev/null); do
    if git -C "$REPO" show "$c:scripts/keep-alive.sh" 2>/dev/null | grep -q '^rebuild_client() {'; then
        PRE_FIX="$c"
        break
    fi
done
check "[ -n '$PRE_FIX' ]" "(iii-a) the pre-fix script is found in history (${PRE_FIX:0:12}), so the mutation can run"
if [ -n "$PRE_FIX" ]; then
    git -C "$REPO" show "$PRE_FIX:scripts/keep-alive.sh" \
        | awk '/^rebuild_client\(\) \{/{p=1} p{print} p&&/^\}$/{exit}' > "$ROOT/old-lib.sh"
    check "grep -q 'npm run build' '$ROOT/old-lib.sh'" "(iii-a) the extracted old implementation is the one that builds"
    FIX_OLD="$ROOT/old-tree"
    mk_fixture "$FIX_OLD"
    rm -f "$FIX_OLD/client/dist/index.html"
    snapshot "$FIX_OLD" "$ROOT/snap-c-before"
    run_case "$ROOT/old-lib.sh" rebuild_client "$FIX_OLD"
    snapshot "$FIX_OLD" "$ROOT/snap-c-after"
    check "! tree_unchanged '$ROOT/snap-c-before' '$ROOT/snap-c-after'" \
          "MUTATION (a) CAUGHT: the old behaviour CHANGES the deployed tree's client/dist"
    check "[ -s '$ROOT/npm-calls' ]" \
          "MUTATION (a) CAUGHT: npm ran inside the deployed tree ($(wc -l < "$ROOT/npm-calls" | tr -d ' ') invocation(s))"
    echo "  --- what the mutant wrote into the deployed tree (the defect, reproduced):"
    diff "$ROOT/snap-c-before.md5" "$ROOT/snap-c-after.md5" | sed 's/^/      /'
else
    bad "(iii-a) the mutation could not run - a mutation that cannot run is not a pass"
fi

# --- (iii-b) MUTATION: build in a scratch tree, then copy the result in ----------------------
echo
echo "== (iii-b) MUTATION: a scratch build copied into the deployed tree, with no merge =="
cat > "$ROOT/copy-mutant.sh" <<'EOS'
guard_ensure_bundle() {
    local scratch="${ROOT}/scratch-build"
    mkdir -p "$scratch/client"
    ( cd "$scratch/client" && npm ci --no-fund --no-audit && npm run build ) >/dev/null 2>&1
    mkdir -p "$DEPLOY_DIR/client/dist"
    cp -a "$scratch/client/dist/." "$DEPLOY_DIR/client/dist/"
    log "bundle built in $scratch and copied into $DEPLOY_DIR/client/dist"
    return 0
}
EOS
FIX_COPY="$ROOT/copy-tree"
mk_fixture "$FIX_COPY"
rm -f "$FIX_COPY/client/dist/index.html"
snapshot "$FIX_COPY" "$ROOT/snap-d-before"
run_case "$ROOT/copy-mutant.sh" guard_ensure_bundle "$FIX_COPY"
snapshot "$FIX_COPY" "$ROOT/snap-d-after"
check "! tree_unchanged '$ROOT/snap-d-before' '$ROOT/snap-d-after'" \
      "MUTATION (b) CAUGHT: a bundle copied into the deployed tree CHANGES its client/dist"

# --- (iii-d) MUTATION: a silent refusal ------------------------------------------------------
echo
echo "== (iii-d) MUTATION: a refusal that says nothing (the silent skip) =="
cat > "$ROOT/silent-mutant.sh" <<'EOS'
guard_ensure_bundle() { return 1; }
EOS
FIX_SILENT="$ROOT/silent-tree"
mk_fixture "$FIX_SILENT"
rm -f "$FIX_SILENT/client/dist/index.html"
run_case "$ROOT/silent-mutant.sh" guard_ensure_bundle "$FIX_SILENT"
check "[ $CASE_RC -eq 1 ]" "(iii-d) the silent mutant returns the same code as the fix - rc alone cannot tell them apart"
check "! grep -q 'REFUSAL: ' '$ROOT/case.log'" \
      "MUTATION (d) CAUGHT: the row that requires a NAMED refusal reddens on a silent skip"

# --- (iv) END TO END: the real loop, a real server, a killed listener ------------------------
echo
echo "== (iv) end to end: the real loop against a real scratch tree =="
if [ -n "$(listener)" ]; then
    bad "(iv) port $PORT is already in use - refusing to run the end-to-end half against a stranger"
else
    SCRATCH_TREE="$ROOT/tree"
    if ! git -C "$REPO" worktree add --detach "$SCRATCH_TREE" HEAD >/dev/null 2>&1; then
        bad "(iv) could not create the scratch worktree"
    else
        ln -sfn "$REPO/server/node_modules" "$SCRATCH_TREE/server/node_modules"
        mkdir -p "$SCRATCH_TREE/client/dist/assets" "$ROOT/creds"
        printf '<!doctype html>\n<html><head><title>Antum People</title>\n<script type="module" crossorigin src="/assets/index-SCRATCH1.js"></script>\n</head><body><div id="root"></div></body></html>\n' > "$SCRATCH_TREE/client/dist/index.html"
        printf 'console.log("the scratch bundle the rig serves");\n' > "$SCRATCH_TREE/client/dist/assets/index-SCRATCH1.js"
        printf '/* scratch css */\n' > "$SCRATCH_TREE/client/dist/assets/index-SCRATCH1.css"
        # throwaway credentials, in the scratch root: the real gate files are never read or written
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
            ok "(iv) the loop armed and the scratch server answers the 401 contract on $PORT"
        else
            bad "(iv) the loop did not bring the scratch server up - nothing below can be read as a pass"
        fi
        echo "  loop log: $L"

        # --- the listener is killed with the bundle present: it must come back, tree untouched
        snapshot "$SCRATCH_TREE" "$ROOT/snap-e-before"
        KILLED="$(listener)"
        kill -9 "$KILLED" 2>/dev/null
        T0=$(date +%s)
        if wait_health 60; then
            RESTORED=$(( $(date +%s) - T0 ))
            check "[ $RESTORED -lt 60 ]" "(iv) a kill -9 of the listener (pid $KILLED) was restored in ${RESTORED}s (< 60s)"
        else
            bad "(iv) the killed listener was NOT restored within 60s"
        fi
        snapshot "$SCRATCH_TREE" "$ROOT/snap-e-after"
        check "tree_unchanged '$ROOT/snap-e-before' '$ROOT/snap-e-after'" \
              "(iv) the recovery left client/dist byte-identical (md5) and mtime-identical"

        # --- now the bundle is gone: the loop must REFUSE, still restore, still build nothing
        rm -f "$SCRATCH_TREE/client/dist/index.html"
        snapshot "$SCRATCH_TREE" "$ROOT/snap-f-before"
        KILLED2="$(listener)"
        kill -9 "$KILLED2" 2>/dev/null
        T1=$(date +%s)
        if wait_health 60; then
            RESTORED2=$(( $(date +%s) - T1 ))
            check "[ $RESTORED2 -lt 60 ]" "(iv) with NO bundle on disk the listener (pid $KILLED2) was still restored in ${RESTORED2}s"
        else
            bad "(iv) with no bundle on disk the listener was NOT restored - the refusal must not block the restart"
        fi
        check "grep -q 'REFUSAL: $SCRATCH_TREE/client/dist/index.html is missing' '$L'" \
              "(iv) the loop's own log carries the refusal, naming the tree it refused to build in"
        check "grep -q 'deploy-main.sh' '$L'" "(iv) the refusal names the sanctioned path in the loop's own log"
        check "[ ! -f '$SCRATCH_TREE/client/dist/index.html' ]" \
              "(iv) nothing was built into the deployed tree: index.html is still absent"
        snapshot "$SCRATCH_TREE" "$ROOT/snap-f-after"
        check "tree_unchanged '$ROOT/snap-f-before' '$ROOT/snap-f-after'" \
              "(iv) client/dist is byte-identical (md5) and mtime-identical after the refusal"
        check "[ ! -s '$NPM_CALLS' ]" \
              "(iv) the loop invoked npm ZERO times across the whole run ($(wc -l < "$NPM_CALLS" | tr -d ' ') call(s))"
        echo "  --- the refusal, as the loop wrote it:"
        grep 'REFUSAL: ' "$L" | tail -5 | sed 's/^/      /'

        stop_loop
        stop_listener
    fi
fi

echo
echo "=== result: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] || exit 1
exit 0
