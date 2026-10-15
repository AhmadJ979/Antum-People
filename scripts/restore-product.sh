#!/bin/bash
# Antum People — restart-only recovery: bring the product back WITHOUT rebuilding it.
#
# WHY THIS FILE EXISTS
#   2026-10-15: the host was replaced. /home survived; /etc was rebuilt from the platform's own set; the
#   product, its guard and the /etc/profile.d hook were all gone, and the public URL served the placeholder
#   while port 3000 answered 200 from the platform's dev server. The recovery that worked was steps 4, 6 and
#   6b of deploy-main.sh — restart, re-arm the watchdog, install the login-shell hook — with NO fetch/reset,
#   NO build and NO re-seed: the deployed tree was already at the shipped commit and client/dist still held
#   the shipped bundle. A rebuild would have silently changed what we shipped while reporting success; a
#   re-seed would have re-dated the demo for nothing.
#   That path existed only as an ad-hoc script inside an evidence directory: the documented recovery for the
#   one failure this product has actually suffered lived outside the repository. This is it, in the repository.
#
# WHAT IT IS NOT
#   Not a movement. It never touches git (no fetch, no reset), never builds, never seeds — so it can never
#   change which commit is served. To ship a NEW commit use the lead-owned host tool
#   /home/team/shared/deploy-main.sh, which does fetch/reset → build → re-seed → restart → guard → hook in that
#   order, and which the preflight (scripts/cutover-preflight.sh) gates.
#
# WHY IT DUPLICATES deploy-main.sh's STEPS INSTEAD OF CALLING THEM
#   deploy-main.sh is HOST STATE under /home/team/shared and is not in this repository, so a committed script
#   has nothing to shell out to and nothing to check drift against. The copied block is bounded to three steps
#   and names the exact line ranges it came from (62-99, 162-225, 226-251). The drift-free end state is a
#   --restart-only flag on deploy-main.sh, which is the lead's file to change; until then this duplication is
#   deliberate, labelled, and verified by running it.
#
# WHAT IT PROVES, AND HOW (derive-or-refuse: nothing is asserted here that was not measured)
#   - the served bytes are the SHIPPED BUNDLE and not a fresh build: the asset the public HTML names is fetched
#     and its md5 compared against the on-disk client/dist bundle's md5. No bundle hash is hardcoded — both
#     sides are measured at run time, and a mismatch is reported as NOT THE SHIPPED BUNDLE, not as success.
#   - if client/dist has NO bundle at all, a restart cannot restore the shipped bytes: this REFUSES and points
#     at deploy-main.sh (which builds) instead of starting a server that would serve nothing.
#   - the listener on port 3000 is OURS (cmdline + cwd), not the platform's dev server, which
#     respawns within seconds and silently serves the placeholder.
#   - the guard is alive, judged by its own lock and /proc — never by matching a process name.
#   - the hook is installed and byte-identical to the versioned source in the tree.
#
# RUN IT
#   bash scripts/restore-product.sh
#   Every host path has an ANTUM_* override so this can be exercised off the live tree (WORKFLOW rule 14);
#   only a test sets them.
#
# Exit 0 = the product is serving the shipped bytes with a verified guard. Non-zero = it is not, and the last
# lines name the checks that failed. It never claims a repair it did not verify.
set -uo pipefail
TREE="${ANTUM_RESTORE_TREE:-/home/team/shared/probable-octo-sniffle}"
PUBLIC="${ANTUM_PUBLIC:-https://b974147c03228029e277d1cbe6646fe6.ctonew.app}"
PRODUCT_DB="${ANTUM_PRODUCT_DB:-/home/team/.data/antum-product.db}"
HOOK_DST="${ANTUM_HOOK_DST:-/etc/profile.d/zz-antum-product-guard.sh}"
ENVFILE="${ANTUM_ENV_FILE:-/etc/profile.d/cto-env-vars.sh}"
PORT="${ANTUM_PORT:-3000}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="${ANTUM_RESTORE_LOG:-/tmp/restore-product-$STAMP.txt}"
FAIL=0
ok(){   printf '  PASS  %s\n' "$1"; }
no(){   printf '  FAIL  %s\n' "$1"; FAIL=$((FAIL+1)); }
info(){ printf '  ..    %s\n' "$1"; }
exec > >(tee "$OUT") 2>&1
echo "=== restart-only recovery $(date -Iseconds) ==="
echo "  script: $0 | $(stat -c %s "$0" 2>/dev/null) B | sha256 $(sha256sum "$0" 2>/dev/null | cut -c1-16)"
echo "  tree:   $TREE"

# --- 0. what is here, and what holds the port ---------------------------------------
if [ ! -d "$TREE/server" ]; then
  no "no deployed tree at $TREE — nothing to restart (this script never clones or builds; run deploy-main.sh)"
  echo "=== RECOVERY FAILED — 1 check failed ($(date -Iseconds)) ==="; exit 1
fi
echo "--- 0. the state we are recovering from ---"
echo "  deployed HEAD: $(git -C "$TREE" log --oneline -1 2>/dev/null || echo '<not a git tree>')"
BUNDLE_COUNT=0
for f in "$TREE"/client/dist/assets/index-*.js; do
  [ -f "$f" ] || continue
  BUNDLE_COUNT=$((BUNDLE_COUNT+1))
  BUNDLE_NAME=$(basename "$f")
  BUNDLE_BYTES=$(wc -c < "$f")
  BUNDLE_MD5=$(md5sum < "$f" | cut -d' ' -f1)
  echo "  on-disk bundle: $BUNDLE_NAME $BUNDLE_BYTES B md5 $BUNDLE_MD5"
done
[ "$BUNDLE_COUNT" -eq 1 ] && info "one bundle on disk — the name the public HTML must name" || info "$BUNDLE_COUNT bundles on disk (stale ones may remain; the served name decides)"
if [ "$BUNDLE_COUNT" -eq 0 ]; then
  no "client/dist holds NO bundle — a restart cannot restore the shipped bytes; run /home/team/shared/deploy-main.sh (it builds) or the rollback script"
  echo "=== RECOVERY FAILED — 1 check failed ($(date -Iseconds)) ==="; exit 1
fi
echo "  hook installed: $([ -f "$HOOK_DST" ] && echo YES || echo NO)"
echo "  guard running:  $(pgrep -f 'scripts/keep-alive[.]sh' | tr '\n' ' ' || true)"

# The listener, named by the port — and if lsof sees nothing, by the socket inode in BOTH protocol tables.
# (Measured 2026-10-15: the platform's dev server binds IPv6-only, so reading one table answers "none".)
listener_pid() {
  local p ino fam hex
  p=$(lsof -t -i :"$PORT" -sTCP:LISTEN 2>/dev/null | head -1)
  if [ -n "$p" ]; then printf '%s' "$p"; return 0; fi
  hex=$(printf '%04X' "$PORT")
  for fam in tcp tcp6; do
    ino=$(awk -v port="$hex" 'NR>1{split($2,a,":"); if (a[2]==port && $4=="0A") {print $10; exit}}' "/proc/net/$fam" 2>/dev/null)
    [ -n "$ino" ] || continue
    for d in /proc/[0-9]*; do
      for fd in "$d"/fd/*; do
        if [ "$(readlink "$fd" 2>/dev/null)" = "socket:[$ino]" ]; then basename "$d"; return 0; fi
      done
    done
  done
  return 0
}
start_server() {
  ( cd "$TREE/server" && setsid env PORT="$PORT" PRODUCT_DB_PATH="$PRODUCT_DB" \
      JWT_SECRET="$JWT_SECRET" ENCRYPTION_KEY="$ENCRYPTION_KEY" \
      nohup node index.js >> server.log 2>&1 & )
}

# --- 4. restart the server on port 3000 (deploy-main.sh:62-99) ----------------------
echo "--- 4. restart the server on port $PORT ---"
OLD=$(listener_pid)
[ -n "$OLD" ] && echo "stopping pid $OLD" && kill "$OLD" && sleep 3
set -a; . "$ENVFILE" >/dev/null 2>&1; set +a
if [ -z "${JWT_SECRET:-}" ] || [ -z "${ENCRYPTION_KEY:-}" ]; then
  no "$ENVFILE did not provide JWT_SECRET/ENCRYPTION_KEY — refusing to start a server without them"
  echo "=== RECOVERY FAILED — 1 check failed ($(date -Iseconds)) ==="; exit 1
fi
start_server
sleep 5
# The platform's dev server is supervised: kill it and it respawns within seconds and takes the port, silently
# serving the PLACEHOLDER while everything downstream still answers 200. So never trust "something is
# listening" — assert the listener is OUR cmdline, and evict anything else in the same window (node does not
# retry after EADDRINUSE, so waiting for an empty port never happens).
claim_port() {
  local attempt LPID LARGS
  for attempt in 1 2 3 4 5 6 7 8; do
    LPID=$(listener_pid)
    LARGS=$(ps -p "${LPID:-0}" -o args= 2>/dev/null)
    case "$LARGS" in
      *"node index.js"*) echo "port $PORT held by the product server (pid $LPID)"; return 0 ;;
    esac
    if [ -n "$LPID" ]; then
      echo "port $PORT held by a foreign process (pid $LPID: ${LARGS:0:60}) — evicting and re-claiming"
      kill "$LPID" 2>/dev/null
      sleep 1
    fi
    start_server
    sleep 3
  done
  echo "FAIL: could not claim port $PORT for the product server; the public URL is not ours"
  return 1
}
claim_port || { echo "=== RECOVERY FAILED — 1 check failed ($(date -Iseconds)) ==="; exit 1; }
tail -1 "$TREE/server/server.log" 2>/dev/null

# --- 6. re-arm the watchdog (deploy-main.sh:162-225) --------------------------------
# pkill is asynchronous and the old loop holds the flock until it actually exits, so wait for the process to
# go, then for the lock to fall to zero holders, reap anything left holding it, and VERIFY the new guard is
# alive — a start that is not confirmed is not a repair.
echo "--- 6. re-arm the watchdog ---"
WD_PAT='scripts/keep-alive[.]sh'
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
for _i in $(seq 1 20); do
  [ -z "$(lsof -t "$TREE/server/keep-alive.lock" 2>/dev/null)" ] && break
  sleep 1
done
STALE=$(lsof -t "$TREE/server/keep-alive.lock" 2>/dev/null | tr '\n' ' ')
if [ -n "$STALE" ]; then
  echo "lock still held by: $STALE — reaping before arming"
  kill -9 $STALE 2>/dev/null; sleep 2
fi
for _attempt in 1 2 3; do
  ( cd "$TREE" && setsid nohup bash scripts/keep-alive.sh >> server/keep-alive.out 2>&1 & )
  sleep 6
  pgrep -f "$WD_PAT" >/dev/null && break
  echo "watchdog did not survive attempt $_attempt; retrying"
done
GPID=$(head -1 "$TREE/server/keep-alive.lock" 2>/dev/null)
GCMD=$(tr '\0' ' ' < "/proc/${GPID:-0}/cmdline" 2>/dev/null)
case "$GCMD" in
  *keep-alive.sh*) ok "guard armed and verified from its own lock: pid $GPID ($GCMD)" ;;
  *) no "no verified guard: lock names '${GPID:-nothing}', /proc cmdline '${GCMD:-none}'" ;;
esac

# --- 6b. install the login-shell hook (deploy-main.sh:226-251) ----------------------
echo "--- 6b. install the login-shell hook ---"
HOOK_SRC="$TREE/scripts/antum-product-guard-hook.sh"
if [ ! -f "$HOOK_SRC" ]; then
  no "$HOOK_SRC is missing — a restart would not re-arm the guard"
elif ! bash -n "$HOOK_SRC" 2>/dev/null; then
  no "$HOOK_SRC does not parse as shell — refusing to install it into every login shell"
elif cmp -s "$HOOK_SRC" "$HOOK_DST"; then
  ok "hook already installed and byte-identical to the versioned source ($HOOK_DST)"
elif install -m 0644 "$HOOK_SRC" "$HOOK_DST" 2>/dev/null && cmp -s "$HOOK_SRC" "$HOOK_DST"; then
  ok "hook installed from the deployed tree, bytes match ($HOOK_DST)"
else
  no "could not install the hook at $HOOK_DST — a restart would not re-arm the guard"
fi

# --- 7. the shipped bytes, not a fresh build ----------------------------------------
echo "--- 7. is what is SERVED the bundle on disk? ---"
curl -s --noproxy '*' --max-time 25 -o /tmp/restore-recovery-page -w '  public GET / -> %{http_code}\n' "$PUBLIC"
SERVED_NAME=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' /tmp/restore-recovery-page 2>/dev/null | head -1)
echo "  public HTML names: ${SERVED_NAME:-<nothing>}"
LPID=$(listener_pid); LARGS=$(ps -p "${LPID:-0}" -o args= 2>/dev/null)
case "$LARGS" in
  *"node index.js"*) ok "port $PORT held by pid $LPID ($LARGS)" ;;
  *) no "port $PORT held by '${LARGS:-nothing}' (pid ${LPID:-none}) — not the product" ;;
esac
[ "$(readlink "/proc/${LPID:-0}/cwd" 2>/dev/null)" = "$TREE/server" ] && ok "listener cwd is the deployed tree's server/" || no "listener cwd is $(readlink "/proc/${LPID:-0}/cwd" 2>/dev/null) — not the deployed tree"
if [ -z "$SERVED_NAME" ]; then
  no "the public HTML names no asset — the placeholder is being served, not the product"
elif [ ! -f "$TREE/client/dist/$SERVED_NAME" ]; then
  no "the served asset $SERVED_NAME is not in $TREE/client/dist — cannot prove it is the shipped bundle"
else
  curl -s --noproxy '*' --max-time 30 -o /tmp/restore-served-asset "$PUBLIC/$SERVED_NAME"
  SERVED_MD5=$(md5sum < /tmp/restore-served-asset | cut -d' ' -f1)
  DISK_MD5=$(md5sum < "$TREE/client/dist/$SERVED_NAME" | cut -d' ' -f1)
  echo "  served md5: $SERVED_MD5 / on-disk md5: $DISK_MD5 (both measured now)"
  if [ "$SERVED_MD5" = "$DISK_MD5" ]; then
    ok "the served bytes ARE the on-disk shipped bundle ($SERVED_NAME) — nothing was rebuilt"
  else
    no "the served bytes are NOT the on-disk bundle — a rebuild or a stale dist; run deploy-main.sh deliberately"
  fi
fi
echo "  no-token contract: GET /api/employees -> $(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/employees") (want 401)"
echo
if [ "$FAIL" -eq 0 ]; then
  echo "=== RECOVERY OK — the product serves the shipped bundle with a verified guard ($(date -Iseconds)) ==="
  echo "    evidence: $OUT"
  exit 0
fi
echo "=== RECOVERY FAILED — $FAIL check(s) failed; the product is NOT verified." 
echo "    Next: read $TREE/server/server.log and $TREE/server/keep-alive.log, or run the rollback"
echo "    (/home/team/shared/rollback-to-9d2182a.sh) if the failure is the served code itself."
echo "    evidence: $OUT"
exit 1
