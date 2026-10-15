#!/bin/bash
# Antum People — ROLLBACK to 9d2182a, the commit the host served before the 2026-10-14 cutover.
#
# VERSIONED 2026-10-15 (host state until then, like cutover-preflight.sh). The preserved bundle it reads,
# /home/team/shared/cutover-rollback-9d2182a/, is HOST state and is not in this repository: the script
# verifies those bytes (both md5s) before it moves anything, and refuses to run if they are not there.
#
#   READY TO RUN, NOT RUN. This is the rollback path for the 2026-10-14 cutover: the bytes it restores are
#   the PRE-cutover state — tree 9d2182a, asset index-Cc1GodRa.js (274,065 B, md5 9cdfbe5d…),
#   server/index.js md5 7467cec0… (measured byte-identical against a rebuild). Those are no longer "the
#   bytes the host serves today": since 2026-10-14 16:17Z the host serves e19a98a / index-Bh1-0KrL.js.
#   Rolling back is still the documented response to a defect found in the served tree.
#
#   bash /home/team/shared/rollback-to-9d2182a.sh
#
#   WHY IT IS NOT JUST `git reset --hard 9d2182a`: client/dist is GITIGNORED (client/.gitignore:11), so the
#   built asset the served HTML names does not come back from git. A rollback that only resets the tree
#   restores the SERVER code and leaves the NEW bundle being served by the OLD code — or none at all.
#   The served dist bytes are preserved in /home/team/shared/cutover-rollback-9d2182a/.
#
#   SAFETY: the file movement runs on $ANTUM_ROLLBACK_TREE (default: the deployed tree). The steps that
#   stop/start the service and touch the guard run ONLY when the target IS the deployed tree, so the whole
#   thing can be rehearsed against a scratch tree first (ANTUM_ROLLBACK_TREE=… bash this-script).
set -uo pipefail

TREE="${ANTUM_ROLLBACK_TREE:-/home/team/shared/probable-octo-sniffle}"
DEPLOY_TREE=/home/team/shared/probable-octo-sniffle
BUNDLE="${ANTUM_ROLLBACK_BUNDLE:-/home/team/shared/cutover-rollback-9d2182a}"
TARGET=9d2182a
PRODUCT_DB=/home/team/.data/antum-product.db
PUBLIC="${ANTUM_PUBLIC:-https://b974147c03228029e277d1cbe6646fe6.ctonew.app}"
ASSET_MD5=9cdfbe5da81f6acf38fdb10de8a5e6fd
CSS_MD5=e493ab996d7bb81b4568b2183e9204f9
IDXJS_MD5=7467cec01c90cc3a1fb0156999c1997a
STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="/home/team/shared/rollback-$STAMP.log"
: > "$OUT"
log(){ echo "$@" | tee -a "$OUT"; }
die(){ log "ROLLBACK FAILED: $*"; log "  the tree was NOT brought back cleanly — see $OUT"; exit 1; }

log "=== rollback to $TARGET  $(date -Iseconds) ==="
log "  target tree: $TREE"
log "  bundle:      $BUNDLE"

log "--- 1. preconditions ---"
[ -d "$TREE/.git" ] || [ -f "$TREE/.git" ] || die "$TREE is not a git worktree"
git -C "$TREE" cat-file -e "$TARGET^{commit}" 2>/dev/null || die "$TARGET is not in $TREE's object store — cannot roll back without it"
[ -d "$BUNDLE/dist/assets" ] || die "no preserved dist at $BUNDLE/dist"
A=$(md5sum "$BUNDLE/dist/assets/index-Cc1GodRa.js" 2>/dev/null | cut -d' ' -f1)
B=$(md5sum "$BUNDLE/server-index.js" 2>/dev/null | cut -d' ' -f1)
[ "$A" = "$ASSET_MD5" ] || die "preserved asset md5 ${A:-missing} != $ASSET_MD5"
[ "$B" = "$IDXJS_MD5" ] || die "preserved server/index.js md5 ${B:-missing} != $IDXJS_MD5"
log "  PASS bundle bytes: asset $A, server/index.js $B"
FROM=$(git -C "$TREE" rev-parse --short HEAD 2>/dev/null)
log "  tree is at $FROM, moving to $TARGET"

log "--- 2. move the tracked tree back ---"
git -C "$TREE" reset --hard "$TARGET" >/dev/null 2>&1 || die "git reset --hard $TARGET failed"
log "  tree now: $(git -C "$TREE" log --oneline -1)"
M=$(md5sum "$TREE/server/index.js" | cut -d' ' -f1)
[ "$M" = "$IDXJS_MD5" ] || die "server/index.js is $M after the reset, expected $IDXJS_MD5"
log "  PASS server/index.js $M"

log "--- 3. restore the gitignored built asset from the preserved bytes ---"
rm -rf "$TREE/client/dist"
cp -a "$BUNDLE/dist" "$TREE/client/dist" || die "could not restore client/dist"
for pair in "assets/index-Cc1GodRa.js:$ASSET_MD5" "assets/index-BLszozVg.css:$CSS_MD5"; do
  f="${pair%%:*}"; want="${pair##*:}"
  got=$(md5sum "$TREE/client/dist/$f" 2>/dev/null | cut -d' ' -f1)
  [ "$got" = "$want" ] || die "restored $f md5 $got != $want"
  log "  PASS $f $got"
done
if diff -r "$TREE/client/dist" "$BUNDLE/dist" >/dev/null 2>&1; then log "  PASS restored dist is byte-identical to the preserved bundle"; else die "restored dist differs from the preserved bundle"; fi

if [ "$TREE" != "$DEPLOY_TREE" ]; then
  log "--- 4. scratch target: service steps skipped by design (nothing was restarted) ---"
  log "=== rehearsal finished $(date -Iseconds) — tree and asset restored, service untouched ==="
  log "  log: $OUT"
  exit 0
fi

log "--- 4. restart the product on port 3000 (the tree just moved under it) ---"
OLD=$(lsof -t -i :3000 -sTCP:LISTEN 2>/dev/null | head -1)
[ -n "${OLD:-}" ] && log "  stopping pid $OLD" && kill "$OLD" && sleep 3
set -a; . /etc/profile.d/cto-env-vars.sh >/dev/null 2>&1; set +a
claim_port() {
  for attempt in 1 2 3 4 5 6 7 8; do
    LPID=$(lsof -t -i :3000 -sTCP:LISTEN 2>/dev/null | head -1)
    LARGS=$(ps -p "${LPID:-0}" -o args= 2>/dev/null)
    case "$LARGS" in
      *"node index.js"*) log "  port 3000 held by the product server (pid $LPID)"; return 0 ;;
    esac
    if [ -n "${LPID:-}" ]; then
      log "  port 3000 held by '${LARGS:0:60}' (pid $LPID) — evicting and re-claiming"
      kill "$LPID" 2>/dev/null; sleep 1
    fi
    ( cd "$TREE/server" && setsid env PORT=3000 PRODUCT_DB_PATH="$PRODUCT_DB" \
        JWT_SECRET="$JWT_SECRET" ENCRYPTION_KEY="$ENCRYPTION_KEY" \
        nohup node index.js >> server.log 2>&1 & )
    sleep 3
  done
  return 1
}
claim_port || die "could not claim port 3000 — the public URL is not ours"
tail -1 "$TREE/server/server.log" | sed 's/^/  /'

log "--- 5. re-arm the guard, killed by the PID ITS OWN LOCK NAMES (never by matching a process name) ---"
GPID=$(head -1 "$TREE/server/keep-alive.lock" 2>/dev/null)
case "$(tr '\0' ' ' < "/proc/${GPID:-0}/cmdline" 2>/dev/null)" in
  *keep-alive.sh*) log "  killing guard pid $GPID"; kill "$GPID" 2>/dev/null ;;
  *) log "  no verified guard to stop (lock names '${GPID:-nothing}')" ;;
esac
for _i in $(seq 1 30); do
  P=$(head -1 "$TREE/server/keep-alive.lock" 2>/dev/null)
  case "$(tr '\0' ' ' < "/proc/${P:-0}/cmdline" 2>/dev/null)" in *keep-alive.sh*) sleep 1 ;; *) break ;; esac
done
STALE=$(lsof -t "$TREE/server/keep-alive.lock" 2>/dev/null | tr '\n' ' ')
[ -n "$STALE" ] && log "  lock still held by $STALE — reaping before arming" && kill -9 $STALE 2>/dev/null && sleep 2
for _a in 1 2 3; do
  ( cd "$TREE" && setsid nohup bash scripts/keep-alive.sh >> server/keep-alive.out 2>&1 & )
  sleep 6
  NP=$(head -1 "$TREE/server/keep-alive.lock" 2>/dev/null)
  case "$(tr '\0' ' ' < "/proc/${NP:-0}/cmdline" 2>/dev/null)" in *keep-alive.sh*) log "  guard armed (pid $NP)"; break ;; esac
  log "  guard did not arm on attempt $_a; retrying"
done
NP=$(head -1 "$TREE/server/keep-alive.lock" 2>/dev/null)
case "$(tr '\0' ' ' < "/proc/${NP:-0}/cmdline" 2>/dev/null)" in
  *keep-alive.sh*) log "  PASS guard verified from its own lock and /proc (pid $NP)" ;;
  *) die "NO GUARD ARM: the product would run unguarded" ;;
esac

log "--- 6. prove the rolled-back state is being served ---"
log "  public GET / -> $(curl -s --noproxy '*' --max-time 25 -o /tmp/rollback-public.html -w '%{http_code}' "$PUBLIC")"
SERVED=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' /tmp/rollback-public.html | sort -u | head -1)
[ "$SERVED" = "assets/index-Cc1GodRa.js" ] || die "public HTML serves '${SERVED:-nothing}', expected assets/index-Cc1GodRa.js"
log "  PASS public HTML names assets/index-Cc1GodRa.js (our rolled-back bundle, not the placeholder)"
log "  no-token contract: GET /api/employees -> $(curl -s --max-time 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/employees) (want 401)"
log "  served server/index.js md5 $(md5sum "$TREE/server/index.js" | cut -d' ' -f1) (want $IDXJS_MD5)"
log "=== rollback COMPLETE $(date -Iseconds) — tree $TARGET, asset index-Cc1GodRa.js, guard armed ==="
log "  log: $OUT"
