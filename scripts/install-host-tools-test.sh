#!/bin/bash
# install-host-tools-test.sh — proves the host-tooling installer does what it claims, off the host.
#
# WHY THIS EXISTS (2026-10-18): the operator-facing copies in /home/team/shared were installed by hand
# at different times from different commits, so the copy the runbook runs could be older than the tree
# it moves — and the login-shell hook the deploy must announce itself to was NEWER than the deploy that
# writes that announcement. The installer is the single path now; this test is what makes its promises
# checkable, and every check here can redden.
#
# WHAT IT ASSERTS
#   (a) install-from-the-tree puts every copy where the runbook expects it, and every installed BODY is
#       byte-identical to its source file — verified with an INDEPENDENT strip (awk on the marker lines),
#       never by asking the installer to grade itself;
#   (b) the provenance block is DERIVED at install time (revision + blob md5 + tree state) and the md5
#       it records equals the source's actual md5;
#   (c) IDEMPOTENCE: a second run changes no byte and no mtime, and says "nothing to do";
#   (d) --verify is GREEN when the copies match and RED (exit 1, naming the file) on a mutated body —
#       a check that cannot redden proves nothing;
#   (e) a source that does not parse as shell is REFUSED and the destination is left untouched;
#   (f) the marker text agrees between the installer and cutover-preflight.sh, so the preflight's body
#       comparison cannot drift away from the format the installer writes;
#   (g) the deploy routes BOTH host-touching steps through the installer, and the old raw hook install
#       survives only as the labelled fallback for a tree that predates it — the marker order
#       (write < reap < remove) that scripts/guard-deploy-marker-test.sh asserts is untouched;
#   (h) THE HOST IS UNTOUCHED: the live copies' md5s are identical before and after this test runs.
#
# USAGE: bash scripts/install-host-tools-test.sh      (exit 0 = every case passed)
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALLER="$REPO/scripts/install-host-tools.sh"
PREFLIGHT="$REPO/scripts/cutover-preflight.sh"
DEPLOY="$REPO/scripts/deploy-main.sh"
HOST_DIR=/home/team/shared
HOOK_DST_LIVE=/etc/profile.d/zz-antum-product-guard.sh
ROOT=$(mktemp -d /tmp/host-tools-test.XXXXXX) || { echo "ABORT: no scratch space"; exit 2; }
trap 'rm -rf "$ROOT"' EXIT
PASS=0; FAIL=0
ok()   { echo "  PASS  $*"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $*"; FAIL=$((FAIL+1)); }
check(){ if eval "$1"; then ok "$2"; else bad "$2"; fi; }

echo "=== install-host-tools-test $(date -Iseconds) ==="
echo "  repo    $REPO"
echo "  scratch $ROOT"
echo

DST="$ROOT/dest"; BK="$ROOT/backup"; mkdir -p "$DST"
# One place that points the installer at scratch, so no case can reach the host by omission.
run_installer() { # $@ = extra args
  ANTUM_HOST_TOOLS_DIR="$DST" ANTUM_HOOK_DST="$DST/zz-antum-product-guard.sh" \
  ANTUM_HOST_TOOLS_BACKUP="$BK" ANTUM_HOOK_SRC="" ANTUM_REPO="$REPO" \
  bash "$INSTALLER" "$@"
}
# An independent strip of the provenance block: the test must not use the code under test to verify it.
strip_indep() { awk '/^# >>> ANTUM HOST-TOOL PROVENANCE/{skip=1} !skip{print} /^# <<< ANTUM HOST-TOOL PROVENANCE/{skip=0}' "$1"; }
body_md5() { # $1 = installed file -> md5 of its body
  strip_indep "$1" | md5sum | cut -d' ' -f1
}
src_md5() { # $1 = repo path -> md5 of the file the installer was told to install
  md5sum < "$REPO/$1" | cut -d' ' -f1
}
src_sha() { git -C "$REPO" rev-parse HEAD; }

# --- (h) the host fingerprint, taken before anything runs --------------------------------
HOST_BEFORE=$(md5sum "$HOST_DIR"/*.sh 2>/dev/null | sort)
HOST_HOOK_BEFORE=$(md5sum < "$HOOK_DST_LIVE" 2>/dev/null || echo none)

echo "== (a) install from the tree; every installed body equals its source =="
run_installer > "$ROOT/install1.log" 2>&1; RC=$?
check "[ $RC -eq 0 ]" "(a) the installer exits 0 against a scratch destination"
for pair in "scripts/deploy-main.sh:deploy-main.sh" "scripts/cutover-preflight.sh:cutover-preflight.sh" \
            "scripts/restore-product.sh:restore-product.sh" "scripts/rollback-to-9d2182a.sh:rollback-to-9d2182a.sh" \
            "scripts/success-test.sh:success-test.sh" \
            "scripts/antum-product-guard-hook.sh:zz-antum-product-guard.sh"; do
  rpath="${pair%%:*}"; name="${pair##*:}"
  inst="$DST/$name"
  check "[ -f '$inst' ]" "(a) $name is installed"
  check "[ \"\$(body_md5 '$inst')\" = \"\$(src_md5 '$rpath')\" ]" "(a) $name's BODY equals $rpath (independent strip)"
done
check "[ \"\$(grep -c 'INSTALLED' '$ROOT/install1.log')\" -ge 6 ]" "(a) the log reports six installs"
check "[ -x '$DST/deploy-main.sh' ]" "(a) the operator copies are executable"
HOOK_MODE=$(stat -c %a "$DST/zz-antum-product-guard.sh")
check "[ '$HOOK_MODE' = '644' ]" "(a) the hook is 0644 — sourced, not executed (it reads $HOOK_MODE)"

echo
echo "== (b) the provenance block is derived, not remembered =="
check "grep -q '^# host-tool-of: scripts/deploy-main.sh' '$DST/deploy-main.sh'" "(b) the block names what it is a copy of"
SRC_SHA=$(src_sha)
check "grep -q '^# source-revision: $SRC_SHA' '$DST/deploy-main.sh'" "(b) and the revision it came from ($(echo "$SRC_SHA" | cut -c1-12))"
BLOB=$(src_md5 scripts/deploy-main.sh)
check "grep -q \"^# source-blob-md5: $BLOB\" '$DST/deploy-main.sh'" "(b) the recorded blob md5 is the source's real md5 ($BLOB)"
check "grep -q '^# tree-state: ' '$DST/deploy-main.sh'" "(b) it states whether the source tree was clean"
check "head -1 '$DST/deploy-main.sh' | grep -q '^#!'" "(b) a shebang stays on line 1, with the block after it"
check "head -1 '$DST/zz-antum-product-guard.sh' | grep -q '^# >>>'" "(b) a file with no shebang gets the block at line 1"

echo
echo "== (c) idempotence: a second run changes no byte and no mtime =="
( cd "$DST" && md5sum * | sort > "$ROOT/before.md5" && stat -c '%n %Y' * | sort > "$ROOT/before.mtime" )
run_installer > "$ROOT/install2.log" 2>&1; RC2=$?
( cd "$DST" && md5sum * | sort > "$ROOT/after.md5" && stat -c '%n %Y' * | sort > "$ROOT/after.mtime" )
check "[ $RC2 -eq 0 ]" "(c) the second run exits 0"
check "cmp -s '$ROOT/before.md5' '$ROOT/after.md5'" "(c) every copy is byte-identical after the second run"
check "cmp -s '$ROOT/before.mtime' '$ROOT/after.mtime'" "(c) no file was rewritten (mtimes unchanged)"
check "grep -q 'nothing to do' '$ROOT/install2.log'" "(c) and it says so instead of reporting a fresh install"
check "grep -q 'unchanged' '$ROOT/install2.log'" "(c) each copy is reported unchanged"

echo
echo "== (d) --verify is green when it matches and RED when a body is mutated =="
run_installer --verify > "$ROOT/verify-green.log" 2>&1; VG=$?
check "[ $VG -eq 0 ]" "(d) verify is green on the installed set"
check "grep -q 'RESULT: VERIFIED' '$ROOT/verify-green.log'" "(d) and prints VERIFIED"
check "grep -q '(body)' '$ROOT/verify-green.log'" "(d) it compared BODIES, and says so"
{ head -7 "$DST/zz-antum-product-guard.sh"; echo '# MUTANT IN THE BODY'; tail -n +8 "$DST/zz-antum-product-guard.sh"; } > "$ROOT/hook.mut"
cat "$ROOT/hook.mut" > "$DST/zz-antum-product-guard.sh"
run_installer --verify > "$ROOT/verify-red.log" 2>&1; VR=$?
check "[ $VR -ne 0 ]" "(d) verify is RED (non-zero) on a mutated body"
check "grep -q 'DRIFTED' '$ROOT/verify-red.log'" "(d) it reports DRIFTED, not a silent green"
check "grep -q 'zz-antum-product-guard.sh' '$ROOT/verify-red.log'" "(d) and names the file that drifted"
check "grep -q 'RESULT: FAILED' '$ROOT/verify-red.log'" "(d) the summary says FAILED"
run_installer > "$ROOT/install3.log" 2>&1
check "[ \"\$(body_md5 '$DST/zz-antum-product-guard.sh')\" = \"\$(src_md5 scripts/antum-product-guard-hook.sh)\" ]" "(d) a re-install repairs the mutant"

echo
echo "== (e) a source that does not parse is refused, and the destination is untouched =="
FAKE="$ROOT/fake-repo"; mkdir -p "$FAKE/scripts"
cp "$REPO"/scripts/*.sh "$FAKE/scripts/" 2>/dev/null
printf '#!/bin/bash\nif [ this is not shell\n' > "$FAKE/scripts/deploy-main.sh"
# It must be a git tree or the installer refuses EARLIER, for a different reason ("not a git tree") —
# which is what the first version of this case measured: it failed, but not via the parse guard.
git -C "$FAKE" init -q 2>/dev/null
git -C "$FAKE" add -A 2>/dev/null
git -C "$FAKE" -c user.email=t@example.com -c user.name=test commit -qm fixture 2>/dev/null
BEFORE_BAD=$(md5sum < "$DST/deploy-main.sh")
ANTUM_REPO="$FAKE" ANTUM_HOST_TOOLS_DIR="$DST" ANTUM_HOOK_DST="$DST/zz-antum-product-guard.sh" \
  ANTUM_HOST_TOOLS_BACKUP="$ROOT/bk2" ANTUM_HOOK_SRC="" bash "$INSTALLER" > "$ROOT/install-bad.log" 2>&1; RB=$?
check "[ $RB -ne 0 ]" "(e) the installer fails rather than installing it"
check "grep -q 'REFUSED' '$ROOT/install-bad.log'" "(e) and says REFUSED"
check "[ \"\$(md5sum < '$DST/deploy-main.sh')\" = '$BEFORE_BAD' ]" "(e) the installed copy is left exactly as it was"

echo
echo "== (f) the marker text agrees between the installer and the preflight =="
check "grep -q '# >>> ANTUM HOST-TOOL PROVENANCE' '$INSTALLER'" "(f) the installer writes the open marker"
check "grep -q '# >>> ANTUM HOST-TOOL PROVENANCE' '$PREFLIGHT'" "(f) the preflight looks for the same open marker"
check "grep -q '# <<< ANTUM HOST-TOOL PROVENANCE' '$INSTALLER'" "(f) and the same close marker"
check "grep -q '# <<< ANTUM HOST-TOOL PROVENANCE' '$PREFLIGHT'" "(f) in both files"
check "grep -q 'A_METHOD=body' '$PREFLIGHT'" "(f) the preflight labels which comparison it ran"
check "grep -q 'A_METHOD=whole-file' '$PREFLIGHT'" "(f) including the whole-file fallback"
check "grep -qF '^# >>> ANTUM HOST-TOOL PROVENANCE/,/^# <<< ANTUM HOST-TOOL PROVENANCE/d' '$PREFLIGHT'" \
  "(f) and strips the block with the same range the installer writes"
# Without this knob the preflight's hook line can only be reddened by moving the live hook aside —
# which is how the first red-proof attempt silently graded the LIVE file while pointing elsewhere.
check "grep -q 'HOOK_DST=\"\${ANTUM_HOOK_DST:-/etc/profile.d/zz-antum-product-guard.sh}\"' '$PREFLIGHT'" \
  "(f) the preflight's hook path is an override (rule 14), so the check can redden off-host"

echo
echo "== (g) the deploy routes both host-touching steps through the installer =="
check "[ \"\$(grep -c 'install-host-tools.sh' '$DEPLOY')\" -ge 2 ]" "(g) the deploy names the installer on both steps"
check "grep -q '1b\\. refresh the operator-facing host tooling' '$DEPLOY'" "(g) step 1b refreshes straight after the reset"
check "grep -q 'ONE install path' '$DEPLOY'" "(g) 6b documents a single install path"
check "grep -q 'FALLBACK, named so the next reader' '$DEPLOY'" "(g) the raw hook install is labelled a fallback"
RAW=$(grep -n 'install -m 0644' "$DEPLOY" | head -1 | cut -d: -f1)
FB=$(grep -n 'FALLBACK, named so the next reader' "$DEPLOY" | head -1 | cut -d: -f1)
check "[ -n '$RAW' ] && [ -n '$FB' ] && [ '$FB' -lt '$RAW' ]" "(g) and it appears only after that label, never as the primary path"
W=$(grep -n 'deploy marker written' "$DEPLOY" | head -1 | cut -d: -f1)
R=$(grep -n "WD_PAT='scripts/keep-alive" "$DEPLOY" | head -1 | cut -d: -f1)
M=$(grep -n 'deploy marker removed' "$DEPLOY" | head -1 | cut -d: -f1)
check "[ -n '$W' ] && [ -n '$R' ] && [ -n '$M' ] && [ '$W' -lt '$R' ] && [ '$R' -lt '$M' ]" \
  "(g) and the marker order (write < reap < remove) that guard-deploy-marker-test.sh asserts is untouched"

echo
echo "== (h) the live host copies are exactly as they were =="
HOST_AFTER=$(md5sum "$HOST_DIR"/*.sh 2>/dev/null | sort)
check "[ \"\$HOST_AFTER\" = \"\$HOST_BEFORE\" ]" "(h) /home/team/shared *.sh unchanged by this test"
check "[ \"\$(md5sum < '$HOOK_DST_LIVE' 2>/dev/null || echo none)\" = \"\$HOST_HOOK_BEFORE\" ]" "(h) the installed login-shell hook unchanged by this test"

echo
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
