#!/usr/bin/env bash
# Antum People — bring the product guard back in ONE command, without a deploy.
#
# THE ONE COMMAND
#   bash /home/team/shared/probable-octo-sniffle/scripts/antum-arm-guard.sh
#
# WHERE AN OPERATOR FINDS IT
#   Right here, in the repository: scripts/antum-arm-guard.sh. It is named in the header of
#   scripts/antum-product-guard-hook.sh (the file an operator opens when the guard is down) and in the
#   header of scripts/ensure-login-hook.sh, and it prints its own invocation in --help.
#   WHY THE REPOSITORY AND NOT A COPY IN /usr/local/bin: a machine replacement wipes /etc and every
#   directory outside /home. /home survives, so the repository is the one place a command can be that
#   outlives the machine it was installed on. A host copy would be the same defect this script answers.
#
# WHY IT EXISTS
#   After a replacement, /etc/profile.d/zz-antum-product-guard.sh is GONE — a replacement rebuilds /etc
#   — so nothing arms the guard at boot, and the guard is what starts and restarts the product. The
#   reboot rehearsal of 2026-11-10 measured exactly this: boot 08:30:56Z, :3000 refusing at 08:31:08Z,
#   no guard, no hook, and 41 s of downtime every second of which was a person. This script is the
#   shortest honest version of what that person did: install the hook from the repository, start the
#   guard, prove it started.
#
# WHAT IT DOES — three steps, and nothing else
#   1. INSTALLS the login-shell hook through scripts/ensure-login-hook.sh — the same idempotent path the
#      deploy and the guard's own poll use. It writes nothing when the installed body already matches the
#      tree, so a second run of this script is a no-op there.
#   2. STARTS the guard by sourcing the INSTALLED hook, so arming goes through exactly the logic every
#      login shell runs (deploy-marker stand-down included). No second copy of "is a guard running".
#   3. VERIFIES the result with an independent read — the flock's holder or the lock's PID claim, either
#      way a live /proc/<pid> whose cmdline is keep-alive.sh — and exits 0 only when a guard is verified.
#   It never builds, never seeds, never touches the database, and never stops anything.
#
# IDEMPOTENT
#   Run twice: the second run reinstalls nothing (the hook matches) and starts nothing (a verified guard
#   is found). It says "already running (pid N)" and exits 0. It is safe to run at any time, including
#   while the guard is healthy.
#
# EXIT CODES
#   0  the hook is installed and a guard is verified running
#   1  a guard could not be verified (the reason is printed: no tree, no hook and no start, a deploy owns
#      the guard, or the start did not take — the hook's own log then names why)
#   2  usage error
#
# TESTING OFF THE LIVE PATH (WORKFLOW rule 14)
#   ANTUM_DEPLOY_DIR and ANTUM_HOOK_DST redirect it; only a test sets them, and the deployed tree uses
#   the defaults. Against a healthy guard the script is its own idempotency check: it installs nothing
#   new, starts nothing, reports the running PID and exits 0 — measured on this host, see the PR.
set -uo pipefail

DEPLOY_DIR="${ANTUM_DEPLOY_DIR:-/home/team/shared/probable-octo-sniffle}"
HOOK_DST="${ANTUM_HOOK_DST:-/etc/profile.d/zz-antum-product-guard.sh}"
export ANTUM_DEPLOY_DIR="$DEPLOY_DIR"
LOCK="$DEPLOY_DIR/server/keep-alive.lock"
MARKER="$DEPLOY_DIR/server/deploy-in-progress"

say() { printf '%s\n' "$*"; }

case "${1:-}" in
  -h | --help)
    say "usage: bash $0"
    say ""
    say "Installs the login-shell guard hook from $DEPLOY_DIR and starts the guard."
    say "Idempotent: a healthy guard is reported, not restarted. Never builds, seeds or stops anything."
    exit 0
    ;;
  '') ;;
  *)
    say "usage: bash $0   (no arguments; --help for what it does)"
    exit 2
    ;;
esac

# A verified live guard's PID, or nothing. THE SAME UNION THE HOOK USES — the flock's holder first, then
# the lock's own PID claim, both confirmed against /proc — repeated here deliberately: this is a SECOND,
# independent read of the result of the start, and a verification that reuses the code it is verifying
# proves nothing. (The hook cannot export its check: it is one self-contained file sourced into every
# login shell and may not depend on another file.) If the two ever disagree, the hook's log line is the
# authority and this file's copy is the thing to fix.
guard_pid() {
  local p cmd
  if [ -e "$LOCK" ]; then
    if ! /usr/bin/timeout 3 /usr/bin/flock -n "$LOCK" -c true 2>/dev/null; then
      for p in $(/usr/bin/timeout 3 /usr/bin/lsof -t "$LOCK" 2>/dev/null); do
        case "$p" in '' | *[!0-9]*) continue ;; esac
        [ -d "/proc/$p" ] || continue
        cmd=$(/usr/bin/tr '\0' ' ' <"/proc/$p/cmdline" 2>/dev/null) || continue
        case "$cmd" in *keep-alive.sh*) printf '%s' "$p"; return 0 ;; esac
      done
    fi
  fi
  [ -r "$LOCK" ] || return 0
  IFS= read -r p <"$LOCK" 2>/dev/null || return 0
  case "$p" in '' | *[!0-9]*) return 0 ;; esac
  [ -d "/proc/$p" ] || return 0
  cmd=$(/usr/bin/tr '\0' ' ' <"/proc/$p/cmdline" 2>/dev/null) || return 0
  case "$cmd" in *keep-alive.sh*) printf '%s' "$p" ;; esac
  return 0
}

if [ ! -d "$DEPLOY_DIR" ]; then
  say "FAILED: there is no tree at $DEPLOY_DIR — nothing to install or start."
  exit 1
fi

hook_rc=0

# ---------------------------------------------------------------- 1. the hook
say "== 1. login-shell hook -> $HOOK_DST"
if [ ! -f "$DEPLOY_DIR/scripts/ensure-login-hook.sh" ]; then
  hook_rc=1
  say "   FAILED: no installer at $DEPLOY_DIR/scripts/ensure-login-hook.sh"
elif out="$(ANTUM_DEPLOY_DIR="$DEPLOY_DIR" ANTUM_HOOK_DST="$HOOK_DST" \
             bash "$DEPLOY_DIR/scripts/ensure-login-hook.sh" 2>&1)"; then
  say "   installed or already current (ensure-login-hook rc=0)"
else
  hook_rc=1
  say "   FAILED to install the hook — the boot-time re-arm stays missing:"
  printf '%s\n' "$out" | sed 's/^/   /'
fi
say "   why it matters: without it, nothing arms the guard at boot after a replacement, and the guard is"
say "   what starts the product. It is not the guard itself — step 2 is."

# ---------------------------------------------------------------- 2. the guard
say "== 2. the guard"
now="$(guard_pid)"
if [ -n "$now" ]; then
  say "   already running (pid $now) — nothing to start"
else
  if [ -r "$HOOK_DST" ]; then
    say "   starting it through the installed hook ($HOOK_DST), which waits up to 5 s and logs the outcome"
    ( unset ANTUM_GUARD_HOOK_RAN; . "$HOOK_DST" ) || :
  elif [ -f "$DEPLOY_DIR/scripts/keep-alive.sh" ]; then
    say "   no installed hook to run — starting $DEPLOY_DIR/scripts/keep-alive.sh directly"
    ( cd "$DEPLOY_DIR" && /usr/bin/setsid /usr/bin/nohup /usr/bin/bash scripts/keep-alive.sh \
        >>"$DEPLOY_DIR/server/keep-alive.out" 2>&1 & )
  else
    say "   FAILED: neither an installed hook nor scripts/keep-alive.sh at $DEPLOY_DIR"
  fi
  for _try in 1 2 3 4 5 6 7 8 9 10; do
    now="$(guard_pid)"
    [ -n "$now" ] && break
    /usr/bin/sleep 1
  done
  unset _try
fi

# ---------------------------------------------------------------- 3. the verdict
say "== 3. verified"
if [ -n "$now" ]; then
  say "   guard RUNNING (pid $now) — lock $LOCK, /proc/$now/cmdline names keep-alive.sh"
  say "   the product is started and restarted by that loop from here; the hook keeps it armed at every login"
  [ "$hook_rc" -eq 0 ] && exit 0
  say "   NOTE: the guard is up but the hook did NOT install (step 1) — a replacement or a reboot would"
  say "   still leave nothing to arm it at boot. Fix step 1 before walking away."
  exit 1
fi

if [ -f "$MARKER" ]; then
  say "   no guard, and a deploy owns it: $MARKER names pid $(/usr/bin/head -1 "$MARKER" 2>/dev/null)."
  say "   A deploy is in its kill window; re-run this command when it finishes."
else
  say "   FAILED: no verified guard after 10 s. Neither the flock holder nor the lock's PID claim at"
  say "   $LOCK is a live keep-alive.sh process. The hook logged its own reason — read the last lines of"
  say "   $DEPLOY_DIR/server/guard-hook.log, and $DEPLOY_DIR/server/keep-alive.out."
fi
exit 1
