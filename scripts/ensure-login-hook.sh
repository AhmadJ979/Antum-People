#!/usr/bin/env bash
# Antum People — keep the boot-time re-arm installed.
#
# WHAT THIS IS
#   /etc/profile.d/zz-antum-product-guard.sh is the ONLY thing that arms the product guard without a
#   person. It is sourced by every LOGIN shell — including the platform's own boot-time login shell,
#   which is how this host starts what it starts (measured 2026-10-29: pid 339 was
#   `bash -lc '<the site dev server loop>'`, a login shell, started 4 s after pid 1).
#
#   That file lives in /etc. The only durable volume on this host is /home. So the hook is a host copy
#   that something outside our tree can delete, and on 2026-10-29 it had been: the installed file's
#   mtime was 06:27:07 (the recovery deploy that reinstalled it) while the boot's login shell ran at
#   06:07:39 and armed nothing, and the public URL served the platform's placeholder for 18 minutes
#   until a person noticed. `install-host-tools.sh` is idempotent by `cmp -s` (line 187), so a file
#   that was already there would NOT have been rewritten — the mtime is proof of absence, not of a
#   rewrite.
#
# WHAT THIS DOES
#   Compares the installed hook's BODY (the file minus its provenance block) with the deployed tree's
#   blob and, when they differ or the file is gone, re-installs it from the tree through the same
#   installer the deploy uses — so the bytes on the boot path are always the bytes of the code the
#   deploy installed. It is idempotent, it writes nothing when the hook already matches, and it logs
#   ONE LINE PER ACTION (plus one line when the state changes), not one line per run: this is called
#   from the guard's 60-second poll, and a log that grows 1440 identical lines a day is a log nobody
#   reads.
#
#   It does NOT decide anything about the product, the port or the guard. Arming is the hook's job and
#   the guard's job; this script's only subject is whether the hook is on disk and correct.
#
# EXIT CODES
#   0  the hook is installed and its body matches the tree
#   1  it is not, and this run could not make it so (no source, unparsable source, unwritable /etc)
#      — never abort a caller on this: every failure is logged and nothing is left half-written.
#
# TESTING OFF THE LIVE PATH (WORKFLOW rule 14)
#   ANTUM_DEPLOY_DIR, ANTUM_HOOK_SRC, ANTUM_HOOK_DST, ANTUM_LOGIN_HOOK_LOG. Only a test sets them; the
#   deployed tree uses the defaults. scripts/ensure-login-hook-test.sh exercises every branch.
set -uo pipefail

DEPLOY_DIR="${ANTUM_DEPLOY_DIR:-/home/team/shared/probable-octo-sniffle}"
HOOK_SRC="${ANTUM_HOOK_SRC:-$DEPLOY_DIR/scripts/antum-product-guard-hook.sh}"
HOOK_DST="${ANTUM_HOOK_DST:-/etc/profile.d/zz-antum-product-guard.sh}"
LOG="${ANTUM_LOGIN_HOOK_LOG:-$DEPLOY_DIR/server/login-hook-ensure.log}"
STATE="${LOG}.status"
INSTALLER="$DEPLOY_DIR/scripts/install-host-tools.sh"
HOOK_RPATH=scripts/antum-product-guard-hook.sh
MARK_OPEN='# >>> ANTUM HOST-TOOL PROVENANCE'
MARK_CLOSE='# <<< ANTUM HOST-TOOL PROVENANCE'

log() { printf '%s ensure-login-hook: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%S+00:00)" "$1" >> "$LOG" 2>/dev/null; }

# One line per ACTION, and one line when a steady state CHANGES. $1 = status, $2 = the line to write.
note() {
  local status="$1" line="$2" last=""
  [ -r "$STATE" ] && last="$(head -1 "$STATE" 2>/dev/null)"
  if [ "$status" != "$last" ] || [ "$status" != ok ]; then
    log "$line"
  fi
  printf '%s\n' "$status" > "$STATE" 2>/dev/null
}

body_md5() { # $1 = a file; prints the md5 of its BODY (provenance block stripped, when present)
  local f="$1" tmp
  if grep -q "^$MARK_OPEN" "$f" 2>/dev/null; then
    tmp="$(mktemp)" || return 1
    sed -e "/^$MARK_OPEN/,/^$MARK_CLOSE/d" "$f" > "$tmp" 2>/dev/null || { rm -f "$tmp"; return 1; }
    md5sum < "$tmp" | cut -d' ' -f1
    rm -f "$tmp"
  else
    md5sum < "$f" | cut -d' ' -f1
  fi
}

if [ ! -r "$HOOK_SRC" ]; then
  note failed "FAILED: no hook to install at $HOOK_SRC — nothing re-arms the guard on a login shell"
  exit 1
fi
if ! bash -n "$HOOK_SRC" 2>/dev/null; then
  note failed "FAILED: $HOOK_SRC does not parse as shell (bash -n) — refusing to install it; a broken /etc/profile.d file breaks every login shell"
  exit 1
fi

want="$(md5sum < "$HOOK_SRC" | cut -d' ' -f1)"
have=""
if [ -f "$HOOK_DST" ]; then have="$(body_md5 "$HOOK_DST")"; fi

if [ -n "$have" ] && [ "$have" = "$want" ]; then
  note ok "ok: $HOOK_DST matches the tree ($want)"
  exit 0
fi

if [ -z "$have" ]; then
  action="MISSING — the boot-time re-arm is not installed at all"
else
  action="DRIFTED — installed body $have does not match the tree's $want"
fi

if [ ! -f "$INSTALLER" ]; then
  note failed "FAILED: $action, and the installer is not there either ($INSTALLER)"
  exit 1
fi

# The installer owns the provenance header and the byte assertion; this script only decides WHEN to
# call it. ANTUM_HOST_TOOLS_ONLY keeps it to the one target whose absence is the bug.
out="$(ANTUM_DEPLOY_DIR="$DEPLOY_DIR" ANTUM_HOOK_DST="$HOOK_DST" \
        ANTUM_HOST_TOOLS_ONLY="scripts/antum-product-guard-hook.sh" \
        bash "$INSTALLER" 2>&1)"
rc=$?

after=""
[ -f "$HOOK_DST" ] && after="$(body_md5 "$HOOK_DST")"
if [ "$after" = "$want" ]; then
  line="REPAIRED: $HOOK_DST was $action — reinstalled from $HOOK_RPATH at $(git -C "$DEPLOY_DIR" rev-parse --short HEAD 2>/dev/null || echo 'an unnamed revision'); body md5 $want"
  log "$line"
  printf '%s\n' ok > "$STATE" 2>/dev/null
  exit 0
fi

note failed "FAILED: $HOOK_DST is still not the tree's hook (installer rc=$rc, installed body '${after:-none}') — installer said: $(printf '%s' "$out" | tr '\n' '|' | tail -c 400)"
exit 1
