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
# HOW IT DECIDES — the flock HOLDER first, then the lock's PID claim, both checked in /proc, and never
# `pgrep -f keep-alive.sh`
#   keep-alive.sh records its PID on the first line of server/keep-alive.lock AND holds a flock on that
#   file. THE CLAIM LAGS; THE HOLDER CANNOT (measured 2026-10-22): after a kill, the file named the dead
#   PID for ~19 s while a successor already held the flock, and this hook - reading only the claim - read
#   a live guard as down. So the holder is the first signal, the claim is the fallback (a loop can guard
#   the port while holding an orphaned lock inode after a stale reclaim), and BOTH must show a live PID
#   whose /proc/<pid>/cmdline is a keep-alive.sh process. A bare `pgrep -f 'keep-alive.sh'` also matches
#   any unrelated command line that merely *mentions* the file — an operator's
#   `kill $(cat .../keep-alive.lock)` shell, a `tail -f` of the log, a test harness — and a false
#   "already running" is the expensive direction: it leaves the product unguarded while reporting
#   that all is well. Being wrong the other way costs one loud line, because keep-alive.sh's own
#   flock refuses a second loop and names the process holding it.
#
# SAFETY / HONESTY
#   - never fails a shell: every failure goes to the log, none is propagated to the shell
#   - never leaves a second guard: a start is attempted only when no live guard can be verified
#   - stands down while a deploy owns the guard (server/deploy-in-progress), and logs that it did —
#     a stand-down nobody can see in the log would be indistinguishable from a hook that failed to run
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
  # TWO SIGNALS, THE HOLDER FIRST (2026-10-22). The file's first line is a CLAIM the guard writes; the
  # flock's HOLDER is the FACT. The claim LAGS: measured on this host, after `kill -TERM` took a guard
  # down at 09:10:18Z the file still named the dead PID for ~19 s while its successor already held the
  # flock - and this hook, reading only the claim, armed a candidate per login shell and logged
  # `FAILED to start the guard` three times while a guard was UP. The claim also names the PREVIOUS
  # machine's loop after a replacement, when nothing can run to correct it. The holder cannot lag: the
  # kernel releases the flock the instant the process dies.
  # THE UNION IS DELIBERATE - either alone is wrong:
  #   * holder only -> misses a loop that guards the port while holding an ORPHANED lock inode (the
  #                    stale-reclaim path renames the lock file, so an older holder keeps its own flock);
  #   * claim only  -> the ~19 s window above, which is the defect this fixes.
  # A false "already running" is the expensive direction, so BOTH paths require the PID to be alive AND
  # its /proc/<pid>/cmdline to be a keep-alive.sh process. Nothing here matches a bare process name.
  _antum_guard_pid() {
    local _antum_p _antum_cmd
    # 1) THE FACT: is the flock HELD? A non-blocking probe cannot steal it (it fails immediately when the
    #    lock is held) and it releases the lock the moment `true` exits, so this is safe to run in every
    #    login shell. `lsof` is NOT this test: it lists processes that merely have the file OPEN, and a
    #    candidate loop sitting in its retry loop is one of those while holding nothing at all - reading
    #    that as a guard is exactly the expensive false "already running".
    if [ -e "$_antum_lock" ]; then
      if ! /usr/bin/timeout 3 /usr/bin/flock -n "$_antum_lock" -c true 2>/dev/null; then
        # ...and WHO holds it: lsof names candidates, /proc confirms it is a loop
        for _antum_p in $(/usr/bin/timeout 3 /usr/bin/lsof -t "$_antum_lock" 2>/dev/null); do
          case "$_antum_p" in '' | *[!0-9]*) continue ;; esac
          [ -d "/proc/$_antum_p" ] || continue
          _antum_cmd=$(/usr/bin/tr '\0' ' ' <"/proc/$_antum_p/cmdline" 2>/dev/null) || continue
          case "$_antum_cmd" in *keep-alive.sh*) printf '%s' "$_antum_p"; return 0 ;; esac
        done
      fi
    fi
    # 2) the file's own claim, still verified against /proc
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
  # A DEPLOY OWNS THE GUARD WHILE ITS KILL WINDOW IS OPEN.
  #   Observed twice (2026-10-15, 2026-10-17): step 6 kills the old guard, a login shell in that window
  #   finds no verified guard, arms one through this hook, and step 6 then reaps it as a stale lock holder
  #   ("lock still held by: 5274 — reaping before arming"). One guard in the end, but the outcome is
  #   decided by timing. So the deploy writes server/deploy-in-progress (its PID) and this hook stands
  #   down while that claim is live.
  #   WHY A STALE MARKER CANNOT STRAND THE GUARD — the property that decides whether this marker is safe:
  #   the claim is believed only while BOTH hold — the PID in it is still alive AND the marker is younger
  #   than TTL. A deploy killed by SIGKILL or a host death leaves the file with a dead PID, so the very
  #   next shell logs it as stale and arms. A PID reused by an unrelated live process is bounded by the
  #   age test. Worst case with the marker stuck and its PID somehow alive: TTL seconds without a guard,
  #   which is smaller than the window this replaces, and every stand-down is logged.
  _antum_marker="$_antum_dir/server/deploy-in-progress"
  _antum_stand_down=""
  if [ -f "$_antum_marker" ]; then
    _antum_mpid=$(/usr/bin/head -1 "$_antum_marker" 2>/dev/null)
    _antum_mtime=$(/usr/bin/stat -c %Y "$_antum_marker" 2>/dev/null || echo 0)
    _antum_mage=$(( $(/usr/bin/date -u +%s) - ${_antum_mtime:-0} ))
    _antum_ttl="${ANTUM_DEPLOY_MARKER_TTL:-900}"
    case "$_antum_mpid" in '' | *[!0-9]*) _antum_mpid="" ;; esac
    if [ -n "$_antum_mpid" ] && [ -d "/proc/$_antum_mpid" ] && [ "$_antum_mage" -lt "$_antum_ttl" ]; then
      _antum_stand_down=1
      _antum_note "deploy in progress (pid $_antum_mpid, marker ${_antum_mage}s old, ttl ${_antum_ttl}s) — standing down, not arming a guard"
    else
      _antum_note "stale deploy marker (pid ${_antum_mpid:-unknown}, ${_antum_mage}s old, ttl ${_antum_ttl}s) — ignoring it and arming as usual"
    fi
    unset _antum_mpid _antum_mtime _antum_mage _antum_ttl
  fi
  if [ -n "$_antum_stand_down" ]; then
    : # the deploy is in its kill window; arming here is what caused the race
  elif [ ! -f "$_antum_dir/scripts/keep-alive.sh" ]; then
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
      _antum_note "FAILED to start the guard — after 5s neither a live flock holder nor a live PID claim at $_antum_lock; see server/keep-alive.out and server/keep-alive.log"
    fi
    unset _antum_new _antum_try
  fi

  unset _antum_now _antum_dir _antum_lock _antum_log _antum_marker _antum_stand_down
  unset -f _antum_guard_pid _antum_note 2>/dev/null
fi
