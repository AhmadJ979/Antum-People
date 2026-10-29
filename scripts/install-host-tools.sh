#!/bin/bash
# install-host-tools.sh — the single documented means of putting Antum's operator-facing host tooling
# on this machine, FROM A REVISION, with each copy's provenance block DERIVED at install time.
#
# WHY THIS EXISTS (measured 2026-10-18): the copies the runbook and DEPLOY.md tell an operator to run
# live outside the repository and were installed by hand at different times from different commits.
# deploy-main.sh was installed from 662e881 (the merge of PR #201) and carried NO `deploy-in-progress`
# marker write, while the installed login-shell hook was #203's and WAITS for exactly that marker — so
# the movement the runbook describes could not stand its own hook down. Three copies carried the line
# "Regenerate with: scripts/install-host-tools.sh in the repository" and that script did not exist.
# This is that script, and it is now the only install path: the deploy calls it too.
#
# USAGE
#   bash scripts/install-host-tools.sh                      install from THIS tree's working copy
#   bash scripts/install-host-tools.sh --commit <rev>       install the files as of <rev> (git show)
#   bash scripts/install-host-tools.sh --verify [--commit]  compare, change nothing; exit 1 on drift
#   bash scripts/install-host-tools.sh --body-md5 <file>    the md5 of <file> WITHOUT its provenance
#                                                           block (the comparison primitive)
#   bash scripts/install-host-tools.sh --help
#
# OVERRIDES (WORKFLOW rule 14 — every host value is an override so this can be exercised off-host):
#   ANTUM_REPO               repository to read from (default: this script's parent directory)
#   ANTUM_HOST_TOOLS_DIR     where the operator-facing copies go (default /home/team/shared)
#   ANTUM_HOOK_DST           the login-shell hook's path (default /etc/profile.d/zz-antum-product-guard.sh)
#   ANTUM_HOOK_REV           install the hook from THIS revision instead of the tree. The deploy sets it
#                            to the revision its own provenance names, because the hook and the deploy
#                            that writes the `deploy-in-progress` marker are ONE mechanism: a `--restart-only`
#                            run takes its hook from the SERVED tree (older) while the deploy copy it is
#                            executing comes from a newer revision, and the host then runs a deploy that
#                            announces a kill window against a hook that cannot read the announcement
#                            (measured on this host 2026-10-19). Unresolvable -> the tree, with the reason.
#   ANTUM_HOST_TOOLS_BACKUP  where a file that is about to CHANGE is copied first
#                            (default <dest>/host-tools-backup-<UTC stamp>; created only if needed)
#
# WHAT IT GUARANTEES, and how each is proved (scripts/install-host-tools-test.sh):
#   * ONE code path for every copy — the deploy calls this script instead of installing the hook itself;
#   * the provenance block is DERIVED from the source at install time: the revision and the md5 of the
#     exact bytes installed (never a remembered value, which is how one header came to record a blob
#     md5 that no copy on the host matched);
#   * IDEMPOTENT — a second run with the same source writes nothing, so the copies' mtimes stay put;
#   * and it installs the OBSERVER (scripts/observe-serve-pair.sh, decision 5 (a)) as an OPERATOR copy, so
#     the movement's post-movement step and an armed loop run the same assertion from outside;
#   * ATOMIC — each file is written to a temporary name in the destination directory and renamed over
#     the target, so replacing a script that is EXECUTING cannot corrupt the running process (the
#     running shell keeps reading the inode it opened);
#   * a file that does not parse as shell (`bash -n`) is REFUSED rather than installed into every
#     login shell;
#   * the hook is installed 0644 (it is sourced, not executed, and carries no shebang) and the
#     operator copies 0755.
#
# The provenance block is delimited by two fixed marker lines so that a reader — or the preflight —
# can strip it mechanically and compare the BODY with the repository blob. cutover-preflight.sh uses
# the same marker text, and install-host-tools-test.sh asserts the two agree, so the pattern cannot
# drift apart in two files.
set -uo pipefail

MARK_OPEN='# >>> ANTUM HOST-TOOL PROVENANCE'
MARK_CLOSE='# <<< ANTUM HOST-TOOL PROVENANCE'

REPO="${ANTUM_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DST="${ANTUM_HOST_TOOLS_DIR:-/home/team/shared}"
HOOK_DST="${ANTUM_HOOK_DST:-/etc/profile.d/zz-antum-product-guard.sh}"
BACKUP_ROOT="${ANTUM_HOST_TOOLS_BACKUP:-}"
# When set, only the named repo paths are installed (space-separated). This exists so
# scripts/ensure-login-hook.sh can re-install the ONE host copy whose absence leaves the boot-time
# re-arm missing, without re-running an install of every other copy from its 60-second poll. The
# bytes, the provenance header and the `cmp -s` idempotence stay in this file — the thing that writes
# the hook is one implementation, not two.
ONLY="${ANTUM_HOST_TOOLS_ONLY:-}"

REV=""
HOOK_REV="${ANTUM_HOOK_REV:-}"
HOOK_RPATH=scripts/antum-product-guard-hook.sh
MODE=install
BODY_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --verify) MODE=verify ;;
    --commit) [ -n "${2:-}" ] || { echo "FAIL: --commit needs a revision"; exit 2; }; REV="$2"; shift ;;
    --hook-rev) [ -n "${2:-}" ] || { echo "FAIL: --hook-rev needs a revision"; exit 2; }; HOOK_REV="$2"; shift ;;
    --body-md5) [ -n "${2:-}" ] || { echo "FAIL: --body-md5 needs a file"; exit 2; }; BODY_FILE="$2"; MODE=body ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1 (use --commit <rev>, --verify, --body-md5 <file>, or --help)"; exit 2 ;;
  esac
  shift
done

# The comparison primitive, exposed so nothing else has to re-implement the marker text.
prov_strip() { sed -e "/^$MARK_OPEN/,/^$MARK_CLOSE/d" "$1"; }
prov_body_md5() { prov_strip "$1" | md5sum | cut -d' ' -f1; }
# The marker LINE carries a suffix in the file ("... PROVENANCE (regenerate: ...)"), so this is a
# prefix match, not an exact-line match (-x here reported every installed copy as having no block, and
# --verify then compared whole files and called all six DRIFTED — caught by the test's red direction).
has_prov() { grep -q "^$MARK_OPEN" "$1" 2>/dev/null; }

if [ "$MODE" = body ]; then
  [ -f "$BODY_FILE" ] || { echo "FAIL: no such file: $BODY_FILE"; exit 1; }
  if has_prov "$BODY_FILE"; then
    echo "$(prov_body_md5 "$BODY_FILE") provenance-block-present"
  else
    # Say what was done: a file with no block is compared WHOLE, and the caller must know that.
    echo "$(md5sum < "$BODY_FILE" | cut -d' ' -f1) no-provenance-block"
  fi
  exit 0
fi

echo "=== install-host-tools $(date -Iseconds) ==="
echo "  script: $0 | $(stat -c %s "$0" 2>/dev/null) B | sha256 $(sha256sum "$0" 2>/dev/null | cut -c1-16)"
echo "  repo:   $REPO"
echo "  dest:   $DST   hook: $HOOK_DST   mode: $MODE"
echo "  source: ${REV:-the working tree}"
[ -n "$ONLY" ] && echo "  ONLY:   $ONLY   (every other target is left untouched)"

if [ -n "$REV" ]; then
  SRC_SHA=$(git -C "$REPO" rev-parse --verify "$REV^{commit}" 2>/dev/null) || {
    echo "FAIL: '$REV' is not a commit in $REPO"; exit 1; }
  SRC_KIND=commit
else
  SRC_SHA=$(git -C "$REPO" rev-parse --verify HEAD 2>/dev/null) || {
    echo "FAIL: $REPO is not a git tree and no --commit was given"; exit 1; }
  SRC_KIND=working-tree
fi
# Say what the bytes ARE. A dirty tree installed against a clean-looking revision would let the
# provenance block claim a commit the files are not — the same class of lie the hand-installed header
# told when it recorded a blob md5 that matched no copy.
TREE_STATE=clean
if [ "$SRC_KIND" = working-tree ]; then
  if ! git -C "$REPO" diff --quiet 2>/dev/null || ! git -C "$REPO" diff --cached --quiet 2>/dev/null; then
    TREE_STATE="UNCOMMITTED CHANGES PRESENT — the bytes installed are the working tree, NOT exactly $SRC_SHA"
  fi
fi
echo "  revision: $SRC_SHA ($SRC_KIND)"
[ "$TREE_STATE" = clean ] || echo "  WARNING: $TREE_STATE"
[ -n "$HOOK_REV" ] && echo "  hook:   from the deploy's revision $HOOK_REV"
echo

# name in the repository | destination | mode
TARGETS="scripts/deploy-main.sh|$DST/deploy-main.sh|0755
scripts/cutover-preflight.sh|$DST/cutover-preflight.sh|0755
scripts/restore-product.sh|$DST/restore-product.sh|0755
scripts/rollback-to-9d2182a.sh|$DST/rollback-to-9d2182a.sh|0755
scripts/success-test.sh|$DST/success-test.sh|0755
scripts/observe-serve-pair.sh|$DST/observe-serve-pair.sh|0755
scripts/ensure-login-hook.sh|$DST/ensure-login-hook.sh|0755
scripts/antum-product-guard-hook.sh|$HOOK_DST|0644"

FAIL=0
CHANGED=0
mkdir -p "$DST" 2>/dev/null

fetch_src() { # $1 = repo path, $2 = where to put the bytes; 1 = could not read
  if [ "$SRC_KIND" = commit ]; then
    git -C "$REPO" show "$SRC_SHA:$1" > "$2" 2>/dev/null
  else
    cat "$REPO/$1" > "$2" 2>/dev/null
  fi
  [ -s "$2" ]
}

backup_one() { # $1 = existing file that is about to change
  [ -n "$BACKUP_ROOT" ] || BACKUP_ROOT="$DST/host-tools-backup-$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$BACKUP_ROOT" 2>/dev/null || return 0
  cp -p "$1" "$BACKUP_ROOT/$(basename "$1").before" 2>/dev/null && echo "  backed up: $1 -> $BACKUP_ROOT/$(basename "$1").before"
}

write_target() { # $1 = dest, $2 = source file, $3 = repo path, $4 = mode; 1 = refused
  local dest="$1" src="$2" rpath="$3" mode="$4"
  local tmp="$dest.new.$$" blob_md5
  blob_md5=$(md5sum < "$src" | cut -d' ' -f1)
  # The destination's own directory, not just DST: the hook's destination is /etc/profile.d, which is
  # NOT the durable volume and can be gone. Without this the repair path failed with "could not write
  # (permissions?)" — a message that names the wrong cause and leaves the boot path unarmed.
  mkdir -p "$(dirname "$dest")" 2>/dev/null
  if ! bash -n "$src" 2>/dev/null; then
    echo "  REFUSED   $dest — the source ($rpath) does not parse as shell (bash -n)"; return 1
  fi
  if head -1 "$src" | grep -q '^#!'; then
    # The shebang must stay line 1 to be a shebang; the provenance block goes immediately after it.
    head -1 "$src" > "$tmp" || return 1
    { printf '%s (regenerate: scripts/install-host-tools.sh — do not hand-edit)\n' "$MARK_OPEN"
      printf '# host-tool-of: %s\n' "$rpath"
      printf '# source-revision: %s (%s)\n' "$SRC_SHA" "$SRC_KIND"
      printf '# source-blob-md5: %s\n' "$blob_md5"
      printf '# tree-state: %s\n' "$TREE_STATE"
      printf '# the body below is that blob, byte for byte\n'
      printf '%s\n' "$MARK_CLOSE"; } >> "$tmp"
    tail -n +2 "$src" >> "$tmp"
  else
    { printf '%s (regenerate: scripts/install-host-tools.sh — do not hand-edit)\n' "$MARK_OPEN"
      printf '# host-tool-of: %s\n' "$rpath"
      printf '# source-revision: %s (%s)\n' "$SRC_SHA" "$SRC_KIND"
      printf '# source-blob-md5: %s\n' "$blob_md5"
      printf '# tree-state: %s\n' "$TREE_STATE"
      printf '# the body below is that blob, byte for byte\n'
      printf '%s\n' "$MARK_CLOSE"; } > "$tmp"
    cat "$src" >> "$tmp"
  fi
  chmod "$mode" "$tmp" 2>/dev/null
  if [ -f "$dest" ] && cmp -s "$tmp" "$dest"; then
    rm -f "$tmp"
    echo "  unchanged $dest   body md5 $blob_md5"
    return 0
  fi
  [ -f "$dest" ] && backup_one "$dest"
  if mv -f "$tmp" "$dest" 2>/dev/null; then
    echo "  INSTALLED $dest   body md5 $blob_md5"
    CHANGED=$((CHANGED+1))
    return 0
  fi
  rm -f "$tmp"
  echo "  FAILED    $dest — could not write (permissions?)"; return 1
}

verify_target() { # $1 = dest, $2 = source file, $3 = repo path
  local dest="$1" src="$2" rpath="$3" blob_md5 body_md5 method
  blob_md5=$(md5sum < "$src" | cut -d' ' -f1)
  if [ ! -f "$dest" ]; then
    echo "  MISSING   $dest ($rpath)"; return 1
  fi
  if has_prov "$dest"; then method=body; body_md5=$(prov_body_md5 "$dest")
  else                    method=whole-file; body_md5=$(md5sum < "$dest" | cut -d' ' -f1); fi
  if [ "$body_md5" = "$blob_md5" ]; then
    echo "  OK        $dest   ($method) md5 $body_md5 == $rpath at ${SRC_SHA:0:12}"
    return 0
  fi
  echo "  DRIFTED   $dest   ($method) md5 $body_md5 != $blob_md5 ($rpath at ${SRC_SHA:0:12})"
  return 1
}

TMPDIR_HERE=$(mktemp -d) || { echo "FAIL: no scratch directory"; exit 1; }
trap 'rm -rf "$TMPDIR_HERE"' EXIT
N=0
while IFS='|' read -r rpath dest mode; do
  [ -n "$rpath" ] || continue
  if [ -n "$ONLY" ]; then
    case " $ONLY " in
      *" $rpath "*) : ;;                  # named by the caller
      *) continue ;;                      # not asked for: leave the installed copy alone
    esac
  fi
  N=$((N+1))
  src="$TMPDIR_HERE/$(basename "$rpath")"
  SRC_FROM="the tree ($SRC_SHA)"
  # THE HOOK PAIRS WITH ITS DEPLOY. This is the one target whose source is not the tree when a deploy
  # revision was named: the marker-writer and the marker-reader are one mechanism, and a `--restart-only`
  # run (every replacement recovery, and the path that installed the unpaired hook measured on
  # 2026-10-19) executes a deploy copy from a NEWER revision than the tree it serves.
  if [ "$rpath" = "$HOOK_RPATH" ] && [ -n "$HOOK_REV" ]; then
    if git -C "$REPO" cat-file -e "$HOOK_REV:$rpath" 2>/dev/null; then
      git -C "$REPO" show "$HOOK_REV:$rpath" > "$src" 2>/dev/null
      SRC_FROM="the deploy's revision $(git -C "$REPO" rev-parse --short "$HOOK_REV" 2>/dev/null)"
    else
      SRC_FROM="the TREE — the deploy's revision $HOOK_REV could not be resolved in $REPO"
      echo "  WARNING: the deploy names $HOOK_REV but $rpath is not in it — installing the TREE's hook."
      echo "           An unpaired hook cannot read the marker its deploy writes; resolve the revision."
    fi
  fi
  if [ ! -s "$src" ] && ! fetch_src "$rpath" "$src"; then
    echo "  FAILED    $rpath — could not read it from $SRC_SHA ($SRC_KIND)"; FAIL=1; continue
  fi
  if [ "$rpath" = "$HOOK_RPATH" ]; then echo "  hook source: $SRC_FROM"; fi
  if [ "$MODE" = verify ]; then
    verify_target "$dest" "$src" "$rpath" || FAIL=1
  else
    write_target "$dest" "$src" "$rpath" "$mode" || FAIL=1
  fi
done <<< "$TARGETS"

echo
# THE BOOT-TIME RE-ARM IS CHECKED, NOT ASSUMED. The hook target above is a host copy in /etc, and /etc
# is not the durable volume: on 2026-10-29 it had been removed, nothing armed the guard at the boot's
# login shell, and the public URL served the placeholder for 18 minutes. So every install ends by
# reading the hook back through the SAME code the guard runs each poll - one implementation, and an
# install that leaves the boot path broken says so here instead of looking green. Idempotent: it
# rewrites nothing when the hook already matches, which is the case this step usually sees.
if [ "$MODE" = install ] && [ -z "$ONLY" ] && [ -f "$REPO/scripts/ensure-login-hook.sh" ]; then
  echo "--- boot-time re-arm check (scripts/ensure-login-hook.sh)"
  if ANTUM_DEPLOY_DIR="$REPO" ANTUM_HOOK_DST="$HOOK_DST" bash "$REPO/scripts/ensure-login-hook.sh"; then
    echo "  the login-shell hook is installed at $HOOK_DST and matches this tree"
  else
    echo "  WARNING: the boot-time re-arm is NOT in place at $HOOK_DST - this host would come back"
    echo "           from a boot with nothing arming the product guard"
    FAIL=1
  fi
fi
echo
if [ "$FAIL" -ne 0 ]; then
  echo "=== RESULT: FAILED — $N targets seen, some refused, missing or unwritable ==="
  exit 1
fi
if [ "$MODE" = verify ]; then
  echo "=== RESULT: VERIFIED — every copy's body equals its repository blob at ${SRC_SHA:0:12} ==="
else
  if [ "$CHANGED" -eq 0 ]; then
    echo "=== RESULT: nothing to do — all $N copies already match this source (a second run changes no byte) ==="
  else
    echo "=== RESULT: $CHANGED of $N copies installed or refreshed from ${SRC_SHA:0:12}; backups: ${BACKUP_ROOT:-none}"
  fi
fi
