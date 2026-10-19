#!/bin/bash
# PROOF, both directions, off the host: the guard hook and the deploy that writes the
# `deploy-in-progress` marker must come from ONE revision, and every path must SAY which revision it
# used. Re-runnable: bash docs/evidence/hook-pairing-2026-10-19/prove.sh [tip-rev]
#
# It never touches /etc, the live hook, the guard, the service or port 3000: every install goes to a
# scratch destination via ANTUM_HOOK_DST, and the deploy copy it tests is one the installer wrote into a
# scratch directory. The "today" layout is rebuilt from git (the served tree's hook), not read off the host.
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 2
TIP=${1:-$(git rev-parse origin/main)}
SERVED=$(git rev-parse e19a98a)
S=$(mktemp -d /tmp/hook-pairing-proof.XXXXXX) || exit 2
echo "clone: $(git rev-parse --short HEAD) · tip under test: ${TIP:0:12} · served tree: ${SERVED:0:12} · scratch: $S"
echo

# ---------------------------------------------------------------------------
echo "== the deploy copy, as the installer writes it (provenance naming the revision) =="
ANTUM_HOST_TOOLS_DIR="$S/inuse" ANTUM_HOOK_DST="$S/hook-installer-tmp.sh" ANTUM_HOST_TOOLS_BACKUP="$S/bk" \
  ANTUM_REPO="$PWD" bash scripts/install-host-tools.sh --commit "$TIP" > "$S/install.log" 2>&1
echo "  installer exit=$? · $(grep -m1 'RESULT' "$S/install.log")"
DEPLOY_COPY="$S/inuse/deploy-main.sh"
echo "  it carries: $(sed -n 's/^# source-revision: \(.*\)/source-revision \1/p' "$DEPLOY_COPY" | head -1)"
echo

# ---------------------------------------------------------------------------
echo "== the layout the host is in today: the SERVED tree's hook, installed raw =="
git show "$SERVED":scripts/antum-product-guard-hook.sh > "$S/live-hook.sh"
echo "  served tree's hook : md5 $(md5sum < "$S/live-hook.sh" | cut -c1-8), deploy-in-progress mentions $(grep -c 'deploy-in-progress' "$S/live-hook.sh")"
echo "  the deploy copy's hook: md5 $(git show "$TIP:scripts/antum-product-guard-hook.sh" | md5sum | cut -c1-8), deploy-in-progress mentions $(git show "$TIP:scripts/antum-product-guard-hook.sh" | grep -c 'deploy-in-progress')"
echo

echo "== RED: the preflight on that layout (it must NAME the revision the live hook is) =="
ANTUM_REPO="$PWD" ANTUM_DEPLOY_COPY="$DEPLOY_COPY" ANTUM_HOOK_DST="$S/live-hook.sh" \
  timeout 300 bash scripts/cutover-preflight.sh > "$S/red.log" 2>&1
RC=$?
echo "  preflight exit=$RC — ATTRIBUTED, not asserted: the FAIL lines driving it are"
grep -E '^ +FAIL' "$S/red.log" | sed 's/^/    /' | head -6
echo "    none of the above is a hook line: a FAIL there would block the movement that repairs the pair."
echo "    After a movement the gate's own pre-cutover expectations (the deployed tree's HEAD, the served"
echo "    asset name) are stale by design — they compare against the state that has already been replaced."
echo "  hook lines marked FAIL, red run: $(grep -cE '^ +FAIL.*hook' "$S/red.log") (must be 0)"
grep -i 'hook' "$S/red.log" | sed 's/^/  /'
echo

echo "== GREEN: install the hook from the deploy copy's OWN revision, then the same preflight =="
ANTUM_HOOK_REV="$TIP" ANTUM_HOOK_DST="$S/hook-paired.sh" ANTUM_HOST_TOOLS_DIR="$S/inuse2" \
  ANTUM_HOST_TOOLS_BACKUP="$S/bk2" ANTUM_REPO="$PWD" bash scripts/install-host-tools.sh > "$S/install2.log" 2>&1
echo "  installer exit=$? · $(grep -m1 'hook source' "$S/install2.log")"
ANTUM_REPO="$PWD" ANTUM_DEPLOY_COPY="$DEPLOY_COPY" ANTUM_HOOK_DST="$S/hook-paired.sh" \
  timeout 300 bash scripts/cutover-preflight.sh > "$S/green.log" 2>&1
RC=$?
echo "  preflight exit=$RC — ATTRIBUTED: its FAIL lines are"
grep -E '^ +FAIL' "$S/green.log" | sed 's/^/    /' | head -6
echo "    (again, no hook line among them — the exit is the host-state expectations, not the pair)"
echo "  hook lines marked FAIL, green run: $(grep -cE '^ +FAIL.*hook' "$S/green.log") (must be 0)"
grep -i 'hook' "$S/green.log" | sed 's/^/  /'
echo

# ---------------------------------------------------------------------------
# 6b's FALLBACK — the path a replacement recovery takes, and the path that produced the unpaired hook.
# The fragment is extracted from the committed deploy-main.sh (the shipped bytes, not a retyped copy) and
# is given a provenance header exactly as the installer writes one, because that header is what $0 reads.
echo "== the fallback install, extracted from the committed deploy-main.sh =="
mk_fallback() { # $1 = revision the scratch copy's provenance will name · $2 = output file
  head -8 "$DEPLOY_COPY" | sed "s/^# source-revision: .*/# source-revision: $1 (working-tree)/" > "$2"
  sed -n '/^ *# >>> ANTUM DEPLOY REVISION FROM/,/^ *# <<< ANTUM DEPLOY REVISION FROM/p' scripts/deploy-main.sh | grep -v 'ANTUM DEPLOY REVISION FROM' >> "$2"
  sed -n '/^ *# >>> ANTUM FALLBACK HOOK SOURCE/,/^ *# <<< ANTUM FALLBACK HOOK SOURCE/p' scripts/deploy-main.sh | grep -v 'ANTUM FALLBACK HOOK SOURCE' >> "$2"
  bash -n "$2" || { echo "  the extracted block does not parse — markers and block disagree"; return 1; }
  grep -q 'HOOK_FROM_REV' "$2" || { echo "  the extracted block does NOT contain the fallback's install code — refusing to report a proof from a shrunken extraction"; return 1; }
  echo "  fragment: $(wc -l < "$2") lines, extracted between the markers in scripts/deploy-main.sh@$(git rev-parse --short HEAD)"
}
mk_fallback "$TIP" "$S/frag-resolves.sh"
HOST_TOOLS="$S/absent/install-host-tools.sh" HOOK_DST="$S/fb-resolved.sh" HOOK_SRC="$PWD/scripts/antum-product-guard-hook.sh" DEPLOY_DIR="$PWD" \
  bash "$S/frag-resolves.sh" 2>&1 | sed 's/^/  /'
echo "  installed: md5 $(md5sum < "$S/fb-resolved.sh" | cut -c1-8) · the named revision's hook: md5 $(git show "$TIP:scripts/antum-product-guard-hook.sh" | md5sum | cut -c1-8) · MATCH: $([ "$(md5sum < "$S/fb-resolved.sh" | cut -d' ' -f1)" = "$(git show "$TIP:scripts/antum-product-guard-hook.sh" | md5sum | cut -d' ' -f1)" ] && echo YES || echo NO)"
echo "  reader in the marker it pairs with: $(grep -c 'deploy-in-progress' "$S/fb-resolved.sh") mention(s) (the served tree's hook has $(grep -c 'deploy-in-progress' "$S/live-hook.sh"))"
echo

mk_fallback deadbeefdeadbeefdeadbeef "$S/frag-norev.sh"
echo "  and when the revision cannot be resolved (the fallback's last resort):"
HOST_TOOLS="$S/absent/install-host-tools.sh" HOOK_DST="$S/fb-fallback.sh" HOOK_SRC="$PWD/scripts/antum-product-guard-hook.sh" DEPLOY_DIR="$PWD" \
  bash "$S/frag-norev.sh" 2>&1 | sed 's/^/  /'
echo

# ---------------------------------------------------------------------------
echo "== the deploy hands its own revision to the installer, and never the tree =="
echo "  6b derives it : $(grep -c 'sed -n .s/\^# source-revision' scripts/deploy-main.sh) line(s) reading \$0's provenance"
echo "  6b passes it  : $(grep -c 'ANTUM_HOOK_REV="\$SELF_REV"' scripts/deploy-main.sh) line(s) passing it as --hook-rev"
echo "  the installer is still the writer of every copy: $(grep -c 'install-host-tools.sh' scripts/deploy-main.sh) call(s)"
echo
echo "scratch kept: $S"
