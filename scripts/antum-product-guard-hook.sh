# Antum People — the login-shell hook that re-arms the product guard.
#
# INSTALLED AS: /etc/profile.d/zz-antum-product-guard.sh  (the zz- prefix loads it LAST)
# INSTALLED BY: /home/team/shared/deploy-main.sh, which copies this file and asserts the installed
#               bytes equal this blob. Before 2026-10-13 the only copy was host state in
#               /etc/profile.d — one lost machine away from gone.
# COMMITTED MODE: 644 — /etc/profile.d files are *sourced*, not executed.
#
# WHY THIS EXISTS
#   This host has no cron daemon and no systemd, so nothing re-arms
#   /home/team/shared/probable-octo-sniffle/scripts/keep-alive.sh after a restart. Three reboots
#   killed the product AND its guard, and each time the public URL answered **200 with the
#   platform's placeholder** — a silent failure that looks like a healthy site — until someone
#   re-armed the guard by hand (2026-10-13 was the third).
#
# WHAT IT IS — AND IS NOT
#   A stopgap, not the answer to owner decision 5 (an off-host check, or a scheduled task on a paid
#   plan). It re-arms the guard when a login/interactive shell starts, which is what the platform
#   does when it wakes an agent: after a restart the product returns on the next session rather
#   than on the next human. It cannot re-arm anything before such a session exists.
#
# HOW IT DECIDES — the lock and /proc, never `pgrep -f keep-alive.sh`
#   keep-alive.sh records the loop's PID on the first line of server/keep-alive.lock (its own
#   documented status check). This hook believes a guard is running only when that PID is alive AND
#   its /proc/<pid>/cmdline is a keep-alive.sh process. A bare `pgrep -f 'keep-alive.sh'` also
#   matches any unrelated command line that merely *mentions* the file — an operator's
#   `kill $(cat .../keep-alive.lock)` shell, a `tail -f` of the log, a test harness — and a false
#   "already running" is the expensive direction: it leaves the product unguarded while reporting
#   that all is well. Being wrong the other way costs one loud line, because keep-alive.sh's own
#   flock refuses a second loop and names the process holding it.
#
# SAFETY / HONESTY
#   - never fails a shell: every failure goes to the log, none is propagated to the shell
#   - never leaves a second guard: a start is attempted only when no live guard can be verified
#   - never swallows its own failure: every attempt and every outcome is appended to
#     server/guard-hook.log, and "started it" is written only after the start is *verified* by that
#     same lock + /proc check — a start that is not confirmed is not a repair
#   - the log grows one line per shell; *.log is gitignored and the file can be truncated freely
#   - testable off the live tree (WORKFLOW rule 14): ANTUM_DEPLOY_DIR redirects the tree, so a
#     scratch run never touches the deployed guard. Only a test sets it.

if [ -z "${ANTUM_GUARD_HOOK_RAN:-}" ]; then
  ANTUM_GUARD_HOOK_RAN=1

  _antum_dir="${ANTUM_DEPLOY_DIR:-/home/team/shared/probable-octo-sniffle}"
  _antum_lock="$_antum_dir/server/keep-alive.lock"
  _antum_log="$_antum_dir/server/guard-hook.log"

  # The PID of a *verified* live guard, or nothing at all.
  _antum_guard_pid() {
    local _antum_p _antum_cmd
    [ -r "$_antum_lock" ] || return 0
    IFS= read -r _antum_p <"$_antum_lock" 2>/dev/null || return 0
    case "$_antum_p" in '' | *[!0-9]*) return 0 ;; esac
    [ -d "/proc/$_antum_p" ] || return 0
    _antum_cmd=$(/usr/bin/tr '\0' ' ' <"/proc/$_antum_p/cmdline" 2>/dev/null) || return 0
    case "$_antum_cmd" in *keep-alive.sh*) printf '%s' "$_antum_p" ;; esac
    return 0
  }

  _antum_note() {
    printf '%s hook: %s\n' "$(/usr/bin/date -u +%Y-%m-%dT%H:%M:%S+00:00)" "$1" >>"$_antum_log" 2>/dev/null
  }

  _antum_now=$(_antum_guard_pid)

  if [ ! -f "$_antum_dir/scripts/keep-alive.sh" ]; then
    _antum_note "FAILED: no guard to arm at $_antum_dir/scripts/keep-alive.sh"
  elif [ -n "$_antum_now" ]; then
    _antum_note "guard already running (pid $_antum_now), nothing to do"
  else
    ( cd "$_antum_dir" && /usr/bin/setsid /usr/bin/nohup /usr/bin/bash scripts/keep-alive.sh >>"$_antum_dir/server/keep-alive.out" 2>&1 & )
    _antum_new=""
    for _antum_try in 1 2 3 4 5 6 7 8 9 10; do
      /usr/bin/sleep 0.5
      _antum_new=$(_antum_guard_pid)
      [ -n "$_antum_new" ] && break
    done
    if [ -n "$_antum_new" ]; then
      _antum_note "guard not running, started it (pid $_antum_new)"
    else
      _antum_note "FAILED to start the guard — see server/keep-alive.out and server/keep-alive.log"
    fi
    unset _antum_new _antum_try
  fi

  unset _antum_now _antum_dir _antum_lock _antum_log
  unset -f _antum_guard_pid _antum_note 2>/dev/null
fi
