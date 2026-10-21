#!/bin/bash
# Antum People — PRE-CUTOVER PREFLIGHT.  READ-ONLY: it starts, stops, builds and moves nothing.
#
# VERSIONED 2026-10-15: this file was host state at /home/team/shared/cutover-preflight.sh until it was
# committed here, because host state dies with the machine (the 2026-10-15 host replacement kept /home but
# rebuilt /etc from the platform's own set — see the evidence record for that day). Its defaults were
# re-derived at the tip the 2026-10-14 cutover shipped (e19a98a / index-Bh1-0KrL.js / 274243 B /
# md5 91f05725…), its REPO default was moved off a personal clone onto the deployed tree (rule 7), and its
# hook comparison was made to refuse rather than assert a hash it had not measured.
#
# 2026-10-20 — THREE RULES ADDED (found running this before the 16:08:51Z movement; evidence
# /home/team/shared/movements/2026-10-20T1607Z/preflight-defect.txt):
#   1. THE AFTER-STATE RECORD IS ONE KNOB. The tip was overridable and the six fields beside it were not,
#      so overriding the tip alone re-pointed the gate while keeping ANOTHER tip's bundle: the run went
#      green stating assets/index-BG0peuOK.js 274242 B — a bundle that tree had never built. Supplying the
#      tip without the whole record is now a REFUSAL (exit 1), not a green.
#   2. WHAT THE HOST SERVES TODAY IS DERIVED, NOT HARDCODED. e19a98a / index-Bh1-0KrL.js were the
#      2026-10-14 cutover, so the preflight FAILED on every host state after any movement — a gate that can
#      never be green on the host it certifies. A derived value is a NOTE, never an assertion (asserting a
#      value against itself is a green that cannot redden); what replaces it is the byte check: the bytes
#      the public URL serves must BE the deployed tree's own dist file of that name. That is what tells our
#      product from the platform placeholder on 3000, without naming a bundle in advance.
#   3. THE RETIRED ROUTES ARE PROVEN IN THE SOURCE, NOT BY PROBING. This package stated they answer 404.
#      Measured: with a token they answer 403 with Content-Length 0, without one 401 — and a path that was
#      NEVER registered answers identically, because the deny-by-default /api gate fires before routing.
#      From outside the two are indistinguishable, so the audit reads the shipped router instead.
#
#   Run it immediately before the movement:   bash /home/team/shared/cutover-preflight.sh
#   Exit 0 means every precondition the movement depends on holds *right now*.
#   Exit 1 means at least one does not — do not start the movement.
#
# WHICH COMMIT SHIPS (the fix, 2026-10-14): the shipped commit is resolved from the REMOTE
# (`git ls-remote origin refs/heads/main`), never from a local remote-tracking ref. A local
# `origin/main` goes stale silently — on 2026-10-14 this clone's said 8e7e2c3 while the remote tip was
# 94166c3 (ten commits, three merges, on: the check printed PASS about a fact it had not verified), and
# the DEPLOYED tree's own `origin/main` said ee4722b. So: resolve the remote, compare, and FAIL loudly
# when the ref we resolved is not the remote's current main. (`deploy-main.sh` is unaffected: its step 1
# fetches explicitly into FETCH_HEAD and resets to that, which is why it never trusts the ref either.)
#
# THE AFTER-STATE IS DERIVED AT RUN TIME, not pinned to the commit this package happened to build:
#   tip == the measured commit                     -> the measured bundle is the expectation
#   tip moved, but client/ is UNCHANGED            -> same bundle (the build was proven deterministic on
#                                                     this host); WARN that the disk figures and the
#                                                     reset delta were taken on the measured commit
#   tip moved and client/ CHANGED                  -> FAIL: the bundle hash is unknown until it is built;
#                                                     re-measure, then update ANTUM_MEASURED_TIP
#                                                     (conscious override: ANTUM_ALLOW_MOVED_TIP=1)
#
# Every check below is one that has actually bitten this host (placeholder on 3000, silent guard death,
# hook versioned but not installed, a fetch that moved nothing, a stale ref passing as truth, missing env
# for the restart).
# Proof it can fail, without touching anything:
#   ANTUM_EXPECT_SERVED=deadbee bash /home/team/shared/cutover-preflight.sh        -> must exit 1
#   ANTUM_EXPECT_ASSET=index-WRONGNOPE.js bash /home/team/shared/cutover-preflight.sh -> must exit 1
#   ANTUM_DIST_DIR=/tmp/empty bash /home/team/shared/cutover-preflight.sh          -> must exit 1 (the URL
#                                                                                    serves bytes this tree
#                                                                                    does not hold)
#   ANTUM_MEASURED_TIP=9d2182a bash /home/team/shared/cutover-preflight.sh        -> must exit 1 (the record
#                                                                                    did not move with the tip)
#   ...plus all six ANTUM_MEASURED_* fields -> the whole record moved, so the tip override is accepted
#   ANTUM_ROUTE_REF=<a revision that still registered it> bash ...                 -> must exit 1 (audit)
set -uo pipefail

DEPLOY_DIR="${ANTUM_DEPLOY_DIR:-/home/team/shared/probable-octo-sniffle}"
# REPO is the DEPLOYED TREE, never a personal clone (WORKFLOW rule 7: anything committed under
# scripts/ operates on the deployed tree). It is used only to resolve the remote tip and to read one
# blob out of the shipped commit; the deployed tree is a full clone with an origin remote, so it can do
# both. Committed 2026-10-15 with the previous default, /home/agent-senior-software-engineer/antum-people,
# which would have made a committed tool depend on one member's home directory.
REPO="${ANTUM_REPO:-$DEPLOY_DIR}"
# WHAT THE HOST SERVES TODAY — DERIVED AT RUN TIME, never hardcoded (2026-10-20, rule 2 in the header).
# Empty = derive: EXPECT_SERVED from the deployed tree's own HEAD, EXPECT_ASSET from the HTML the public
# URL actually serves. A DERIVED value is PRINTED AS A NOTE AND NOT ASSERTED — asserting a value against
# itself is a green that cannot redden. Set these to assert a specific pair deliberately; then they are
# asserted and they redden.
EXPECT_SERVED="${ANTUM_EXPECT_SERVED:-}"
EXPECT_ASSET="${ANTUM_EXPECT_ASSET:-}"
# The deployed tree's built client, as the host serves it. Override (rule 14) so the placeholder case can
# be exercised off-host: a URL serving an asset this dist does not hold is exactly what a foreign server on
# port 3000 looks like.
DIST="${ANTUM_DIST_DIR:-$DEPLOY_DIR/client/dist}"
# The ROLLBACK bundle holds the PRE-cutover bytes and has its own asset name. These were one variable
# until 2026-10-15, when the served asset changed: reading the bundle through EXPECT_ASSET made the
# bundle check look for a filename the bundle does not contain.
ROLLBACK_ASSET=index-Cc1GodRa.js
PUBLIC="${ANTUM_PUBLIC:-https://b974147c03228029e277d1cbe6646fe6.ctonew.app}"
BUNDLE=/home/team/shared/cutover-rollback-9d2182a
ASSET_MD5=9cdfbe5da81f6acf38fdb10de8a5e6fd
IDXJS_MD5=7467cec01c90cc3a1fb0156999c1997a
# The commit whose built bundle this package can state.
#   Re-measured 2026-10-17 at 8fb4390 (previously e19a98a): a FRESH build of that tree emitted
#   index-BG0peuOK.js, 274,242 B, md5 f65f15c1…, with the CSS byte-identical to the previous package
#   (index-pNSrK3wr.css, 35,365 B, eda54820…) — the bundle moved because one string moved, and it moved by
#   one byte. The identity of the new bundle is stated by the counts, not the delta: the new eyebrow
#   "Privacy Notice (PDPL)" appears once and "Privacy Consent (PDPL)" zero times in the emitted file,
#   measured twice independently (branch, then merged main).
#   RE-CUT 2026-10-17 to d0422f4 — the tip this movement will ship. The tip moved one merge past 8fb4390
#   (PR #209 merged), and the package followed it, because a measurement taken at a tip stops being a
#   measurement the moment the tip moves. What authorises carrying the SAME bytes forward is measured, not
#   assumed: the merge changed exactly one file (git diff --stat 8fb4390 d0422f4 -> scripts/seed-demo.js,
#   17 insertions / 8 deletions), `git diff --name-only 8fb4390 d0422f4 -- client/` is EMPTY so the build
#   input is byte-identical, the merge commit's tree hash equals the measured branch head's tree hash
#   (8a6c790d3fd57036f0d81ef81b2c60947dd05263), and nothing the server serves loads the changed script —
#   server/index.js's require closure does not contain seed-demo.js (it is a script the seeder runs).
#   Full suite at the merge result: 169 tests / 169 pass / 0 fail / 0 skipped (PRODUCT_DB_PATH pinned).
#   DISK: the build's own consumption was BELOW the 50 ms df sampling floor (peak_used 0 KB against the
#   ~3.8 MB the package reserves, net 0 KB with dist replaced in place), so no new peak figure is claimed;
#   MIN_FREE_KB stays the hard floor and the reservation stays the conservative number.
#   If the tip moves again with client/ unchanged, the gate warns and keeps this asset; if client/ moves,
#   it refuses until this block is re-measured. That refusal is the gate working, not an obstacle.
# THE RECORD IS ONE KNOB (2026-10-20, rule 1 in the header). The tip was overridable and these six fields
# were not: `ANTUM_MEASURED_TIP=2b14a94 preflight` therefore went GREEN stating assets/index-BG0peuOK.js
# 274242 B, a bundle that tip has never built (the real one is index-C9vf7pQB.js 277790 B, md5 e6ff5da3…,
# confirmed by the movement's own build and by the bytes the public URL serves). A half-overridable gate is
# defeated by its own override. Every field is overridable now, and the coherence gate below REFUSES
# (exit 1) unless the whole record moves together.
RECORD_TIP_DEFAULT=d0422f4
MEASURED_TIP="${ANTUM_MEASURED_TIP:-$RECORD_TIP_DEFAULT}"
MEASURED_ASSET="${ANTUM_MEASURED_ASSET:-index-BG0peuOK.js}"
MEASURED_ASSET_BYTES="${ANTUM_MEASURED_ASSET_BYTES:-274242}"
MEASURED_ASSET_MD5="${ANTUM_MEASURED_ASSET_MD5:-f65f15c109e76e86cd8b8abe7102f748}"
MEASURED_CSS="${ANTUM_MEASURED_CSS:-index-pNSrK3wr.css}"
MEASURED_CSS_BYTES="${ANTUM_MEASURED_CSS_BYTES:-35365}"
MEASURED_CSS_MD5="${ANTUM_MEASURED_CSS_MD5:-eda548202468a7e0293053981037a594}"
MIN_FREE_KB=200000
# WORKFLOW rule 14: every host value is an override. This one was NOT, and the cost was a check that
# could not be reddened: pointing it off-host is impossible while it names the live path, so "does this
# line go red when the hook's body differs?" had only one way to be answered — by moving the host's own
# hook aside, which is a worse idea than adding the override. scripts/install-host-tools-test.sh
# asserts this knob exists.
HOOK_DST="${ANTUM_HOOK_DST:-/etc/profile.d/zz-antum-product-guard.sh}"
# The deploy copy IN USE — its provenance names the revision it was installed from, and the hook must be
# that revision's: they are one mechanism. Override (rule 14) so both directions can be exercised off-host.
DEPLOY_COPY="${ANTUM_DEPLOY_COPY:-/home/team/shared/deploy-main.sh}"
FAIL=0
ok(){   printf '  PASS  %s\n' "$1"; }
no(){   printf '  FAIL  %s\n' "$1"; FAIL=$((FAIL+1)); }
note() { printf "  %s\n" "$*"; }
warn(){ printf '  WARN  %s\n' "$1"; }

# A tip is not a measurement, and half a record is not one either. Counted HERE, before anything is read,
# because a refusal must arrive before a green does.
REC_SUPPLIED=0; REC_SUPPLIED_N=0; REC_MISSING=""; REC_INCOHERENT=0
for _f in ANTUM_MEASURED_ASSET ANTUM_MEASURED_ASSET_BYTES ANTUM_MEASURED_ASSET_MD5 ANTUM_MEASURED_CSS ANTUM_MEASURED_CSS_BYTES ANTUM_MEASURED_CSS_MD5; do
  if [ -n "${!_f:-}" ]; then REC_SUPPLIED_N=$((REC_SUPPLIED_N+1)); else REC_MISSING="$REC_MISSING ${_f#ANTUM_MEASURED_}"; fi
done
TIP_OVERRIDDEN=0
if [ -n "${ANTUM_MEASURED_TIP:-}" ] && [ "$ANTUM_MEASURED_TIP" != "$RECORD_TIP_DEFAULT" ]; then TIP_OVERRIDDEN=1; fi
[ "$REC_SUPPLIED_N" -eq 6 ] && REC_SUPPLIED=1

echo "=== pre-cutover preflight $(date -Iseconds) ==="
# WHICH BYTES PRODUCED THIS OUTPUT. A review of this script once reported the fix as missing while the
# fixed file was on disk (the reviewer's `ls` had the pre-fix mtime/size): the tool now states its own
# identity in every transcript it produces, so "you are looking at a different file" is answerable from
# the transcript alone. Compare this line, not a remembered size.
echo "  script: $0 | $(stat -c %s "$0" 2>/dev/null) B | mtime $(stat -c %y "$0" 2>/dev/null | cut -d. -f1) | sha256 $(sha256sum "$0" 2>/dev/null | cut -c1-16)"
echo "  deployed tree: $DEPLOY_DIR"
# NB: an APOSTROPHE inside a ${VAR:-word} default breaks this parser (the quote inside the expansion is
# never closed), so these default words are apostrophe-free on purpose.
echo "  serving today: ${EXPECT_SERVED:-DERIVED (the deployed tree HEAD)}  asset ${EXPECT_ASSET:-DERIVED (from the served HTML)}"

echo "--- the after-state record: the tip and its bundle move together, or the run refuses ---"
if [ "$REC_SUPPLIED_N" -eq 0 ] && [ "$TIP_OVERRIDDEN" -eq 0 ]; then
  ok "record: the tip (${MEASURED_TIP}) and its bundle are the RECORDED measurement, unmodified — $MEASURED_ASSET $MEASURED_ASSET_BYTES B (last measured 2026-10-17)"
elif [ "$REC_SUPPLIED_N" -ne 6 ]; then
  REC_INCOHERENT=1
  no "HALF-OVERRIDDEN RECORD: ${REC_SUPPLIED_N}/6 bundle field(s) supplied, missing:${REC_MISSING:- none} — a tip is not a measurement, and an override that re-points the tip while keeping another tip's bundle makes this run state an after-state nobody measured. Supply the WHOLE record (ANTUM_MEASURED_TIP + ANTUM_MEASURED_ASSET + _ASSET_BYTES + _ASSET_MD5 + _CSS + _CSS_BYTES + _CSS_MD5) or clear it, then re-run"
else
  ok "record: the WHOLE record was supplied by this run — tip $MEASURED_TIP, $MEASURED_ASSET $MEASURED_ASSET_BYTES B, $MEASURED_CSS $MEASURED_CSS_BYTES B (it stands or falls with that measurement, not with this gate)"
fi
# Shape, so a typo cannot pass as a measurement.
case "$MEASURED_ASSET_BYTES" in ''|*[!0-9]*) no "record: ANTUM_MEASURED_ASSET_BYTES='$MEASURED_ASSET_BYTES' is not a byte count";; esac
case "$MEASURED_CSS_BYTES" in ''|*[!0-9]*) no "record: ANTUM_MEASURED_CSS_BYTES='$MEASURED_CSS_BYTES' is not a byte count";; esac
case "$MEASURED_ASSET_MD5" in ????????*????????*????????*????????) : ;; *) no "record: ANTUM_MEASURED_ASSET_MD5='$MEASURED_ASSET_MD5' is not a 32-hex md5";; esac
case "$MEASURED_CSS_MD5" in ????????*????????*????????*????????) : ;; *) no "record: ANTUM_MEASURED_CSS_MD5='$MEASURED_CSS_MD5' is not a 32-hex md5";; esac

echo "--- disk: the movement's measured need is ~3.8 MB; a full disk fails a movement silently ---"
FREE_KB=$(df --output=avail -k /home | tail -1 | tr -d ' ')
if [ "${FREE_KB:-0}" -ge "$MIN_FREE_KB" ]; then ok "/home free ${FREE_KB} KB (>= ${MIN_FREE_KB} KB)"; else no "/home free ${FREE_KB:-?} KB < ${MIN_FREE_KB} KB — free space before moving"; fi
IFREE=$(df -i /home | tail -1 | awk '{print $4}')
[ "${IFREE:-0}" -gt 100000 ] && ok "/home inodes free ${IFREE}" || no "/home inodes free ${IFREE:-?} — too few"

echo "--- the shipped commit, resolved against the REMOTE (never a local remote-tracking ref) ---"
REMOTE_TIP=$(GIT_TERMINAL_PROMPT=0 timeout 30 git -C "$REPO" ls-remote origin refs/heads/main 2>/dev/null | awk 'NR==1{print $1}')
SHIPPED=""
if [ -z "$REMOTE_TIP" ]; then
  no "could not resolve refs/heads/main from the remote — the shipped commit is unverified (network/credentials?)"
else
  SHIPPED="$REMOTE_TIP"
  ok "remote tip origin/main = ${REMOTE_TIP:0:12} — $(git -C "$REPO" log --oneline -1 "$REMOTE_TIP" 2>/dev/null || echo 'object NOT local')"
fi
LOCAL_REF=$(git -C "$REPO" rev-parse origin/main 2>/dev/null)
if [ -n "$REMOTE_TIP" ] && [ "$LOCAL_REF" = "$REMOTE_TIP" ]; then
  ok "clone's origin/main ref matches the remote ($LOCAL_REF)"
else
  no "STALE REF: clone's origin/main = '${LOCAL_REF:-none}' but the remote tip is '${REMOTE_TIP:-unresolved}' — run: git -C $REPO fetch origin   (then re-run)"
fi
DEPLOY_REF=$(git -C "$DEPLOY_DIR" rev-parse origin/main 2>/dev/null)
[ "$DEPLOY_REF" = "$REMOTE_TIP" ] && ok "deployed tree's origin/main ref is current" || warn "deployed tree's origin/main ref is '${DEPLOY_REF:-none}' (step 1 fetches into FETCH_HEAD, so this does not affect the movement — it is exactly why the movement does not use this ref)"

echo "--- the tree is where we think it is, and has not already moved ---"
HEAD=$(git -C "$DEPLOY_DIR" rev-parse --short HEAD 2>/dev/null)
# DERIVE-OR-ASSERT (rule 2). With no pinned value there is nothing to compare the tree against — it IS the
# tree — so the line is a note. Pinning ANTUM_EXPECT_SERVED makes it an assertion again, and it reddens.
if [ -n "$EXPECT_SERVED" ]; then
  [ "$HEAD" = "$EXPECT_SERVED" ] && ok "deployed tree HEAD = $HEAD — the commit you pinned as served today" || no "deployed tree HEAD = ${HEAD:-?}, but ANTUM_EXPECT_SERVED names $EXPECT_SERVED"
else
  EXPECT_SERVED="$HEAD"
  note "deployed tree HEAD = ${HEAD:-?} (DERIVED: the tree IS what the host serves — nothing asserted against itself; pin ANTUM_EXPECT_SERVED to assert a specific commit)"
fi
git -C "$DEPLOY_DIR" remote get-url origin >/dev/null 2>&1 && ok "deployed tree has an origin remote" || no "deployed tree has no origin remote — the fetch in step 1 cannot run"

echo "--- the product is the thing answering, not the platform placeholder ---"
# Private temp dir: /tmp/preflight-public.html was a FIXED name, and on a shared /tmp two runs (this tool
# and the movement's own scripts) can tread on each other's file mid-read.
TMPD=$(mktemp -d /tmp/preflight-XXXXXX); trap 'rm -rf "$TMPD"' EXIT
# `Accept-Encoding: identity` so the bytes hashed below are the file's bytes, not a compressed variant.
PUB_CODE=$(curl -s --noproxy '*' -H 'Accept-Encoding: identity' --max-time 25 -o "$TMPD/public.html" -w '%{http_code}' "$PUBLIC" 2>/dev/null)
PUB_ASSETS=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$TMPD/public.html" 2>/dev/null | sort -u | head -1)
LIVE_ASSET="${PUB_ASSETS#assets/}"
[ "$PUB_CODE" = "200" ] && ok "public GET / -> 200" || no "public GET / -> ${PUB_CODE:-none}"
if [ -z "$LIVE_ASSET" ]; then
  no "the public HTML names no assets/index-*.js at all — the URL is not serving a built product"
else
  if [ -n "$EXPECT_ASSET" ]; then
    [ "$LIVE_ASSET" = "$EXPECT_ASSET" ] && ok "public HTML names assets/$EXPECT_ASSET — the asset you pinned" || no "public HTML names 'assets/$LIVE_ASSET', but ANTUM_EXPECT_ASSET names $EXPECT_ASSET"
  else
    note "public HTML names assets/$LIVE_ASSET (DERIVED from that same HTML — not asserted; the check that can redden is next)"
  fi
  # THE NON-VACUOUS FORM (rule 2): the bytes the URL serves must BE this tree's own build of that asset.
  # A foreign server on 3000 answers 200 with a bundle this tree does not hold, and that is a FAIL here.
  curl -s --noproxy '*' -H 'Accept-Encoding: identity' --max-time 40 -o "$TMPD/live.js" "$PUBLIC/assets/$LIVE_ASSET" 2>/dev/null
  LIVE_MD5=$(md5sum "$TMPD/live.js" 2>/dev/null | cut -d' ' -f1)
  DIST_MD5=$(md5sum "$DIST/assets/$LIVE_ASSET" 2>/dev/null | cut -d' ' -f1)
  if [ -z "${DIST_MD5:-}" ]; then
    no "the URL serves assets/$LIVE_ASSET (${LIVE_MD5:-?}) but $DIST holds no such file — the product answering is NOT this tree's build (the platform placeholder on port 3000 looks exactly like this)"
  elif [ "$LIVE_MD5" = "$DIST_MD5" ]; then
    ok "the bytes the URL serves ARE $DIST/assets/$LIVE_ASSET (md5 $LIVE_MD5) — the product answering is this tree's own build"
  else
    no "the URL serves assets/$LIVE_ASSET md5 ${LIVE_MD5:-?} but this tree's dist file is $DIST_MD5 — what is served and what this tree built disagree"
  fi
fi
LPID=$(lsof -t -i :3000 -sTCP:LISTEN 2>/dev/null | head -1)
LARGS=$(ps -p "${LPID:-0}" -o args= 2>/dev/null)
case "$LARGS" in
  *"node index.js"*) ok "port 3000 held by pid $LPID: $LARGS" ;;
  *) no "port 3000 held by '${LARGS:-nothing}' (pid ${LPID:-none}) — not the product" ;;
esac
[ "$(readlink /proc/${LPID:-0}/cwd 2>/dev/null)" = "$DEPLOY_DIR/server" ] && ok "listener cwd is the deployed tree's server/" || no "listener cwd is $(readlink /proc/${LPID:-0}/cwd 2>/dev/null) — not the deployed tree"
echo "  no-token contract: GET /api/employees -> $(curl -s --max-time 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/employees) (want 401)"

echo "--- the guard is alive, judged by its own lock and /proc (never by matching a process name) ---"
GPID=$(head -1 "$DEPLOY_DIR/server/keep-alive.lock" 2>/dev/null)
GCMD=$(tr '\0' ' ' < "/proc/${GPID:-0}/cmdline" 2>/dev/null)
case "$GCMD" in
  *keep-alive.sh*) ok "guard alive: pid $GPID ($GCMD)" ;;
  *) no "no verified guard: lock names '${GPID:-nothing}', /proc cmdline '${GCMD:-none}'" ;;
esac
HOLDERS=$(lsof -t "$DEPLOY_DIR/server/keep-alive.lock" 2>/dev/null | wc -l)
[ "${HOLDERS:-0}" -le 1 ] && ok "lock holders: $HOLDERS (only the guard)" || warn "lock held by $HOLDERS processes — step 6 reaps extra holders, expect a longer window"

echo "--- the login-shell hook: which revision is it, and does it pair with its deploy ---"
if [ -f "$HOOK_DST" ]; then
  # THE BODY, NOT THE WHOLE FILE (2026-10-18), AND THE REVISION, NOT ONE CANDIDATE (2026-10-19).
  #
  # The installed copy carries a provenance block whose only effect is to add comment lines, so comparing
  # whole files reported drift on every run against a hook whose body was byte-identical — a WARN that
  # could never go green, which trains the reader to ignore the line.
  #
  # Attributing the bytes to ONE candidate (the served tree) was the next defect: on 2026-10-19 this host
  # printed green while the live hook was the SERVED tree's (`ca4f9583…`, 0 occurrences of
  # `deploy-in-progress`) and the deploy copy writing that marker came from a revision 40 commits ahead.
  # The hook is what reads `server/deploy-in-progress`; the deploy is what writes it. They are one
  # mechanism, so the check now says WHICH revision the live hook is and whether it is the deploy's.
  # The marker text is the installer's; scripts/install-host-tools-test.sh asserts the two agree.
  A_FILE=$(md5sum < "$HOOK_DST" | cut -d' ' -f1)
  A_METHOD=whole-file
  A="$A_FILE"
  if grep -q '^# >>> ANTUM HOST-TOOL PROVENANCE' "$HOOK_DST" 2>/dev/null; then
    A_METHOD=body
    A=$(sed -e '/^# >>> ANTUM HOST-TOOL PROVENANCE/,/^# <<< ANTUM HOST-TOOL PROVENANCE/d' "$HOOK_DST" | md5sum | cut -d' ' -f1)
  fi
  SERVED_REV="${SHIPPED:-$EXPECT_SERVED}"
  DREV=$(sed -n 's/^# source-revision: \([0-9a-f]\{7,\}\).*/\1/p' "$DEPLOY_COPY" 2>/dev/null | head -1)
  # DERIVE-OR-REFUSE: read the bytes into a file and hash only what arrived. Piping `git show` into
  # md5sum hashes EMPTY input when the show fails, and d41d8cd98f00b204e9800998ecf8427e then reads as a
  # measured "shipped" hash — it was printed as one on 2026-10-15, against a commit that predated the
  # hook's versioning.
  blob_hook_md5() { # $1 = revision -> md5 of its hook, EMPTY when unreadable (never the empty hash)
    local t; t=$(mktemp) || return 1
    git -C "$REPO" show "$1:scripts/antum-product-guard-hook.sh" > "$t" 2>/dev/null
    if [ -s "$t" ]; then md5sum < "$t" | cut -d' ' -f1; fi
    rm -f "$t"
  }
  B_SERVED=$(blob_hook_md5 "$SERVED_REV")
  B_MAIN=$(blob_hook_md5 origin/main)
  B_DEPLOY=""
  [ -n "$DREV" ] && B_DEPLOY=$(blob_hook_md5 "$DREV")
  M_LIVE=$(grep -c 'deploy-in-progress' "$HOOK_DST" 2>/dev/null | head -1)
  M_DEPLOY="?"
  [ -n "$DREV" ] && M_DEPLOY=$(git -C "$REPO" show "$DREV:scripts/antum-product-guard-hook.sh" 2>/dev/null | grep -c 'deploy-in-progress' | head -1)

  if [ "$A_METHOD" = whole-file ]; then
    warn "hook installed at $HOOK_DST carries NO provenance block (whole-file md5 $A_FILE) — attributed by its bytes alone"
  fi
  if [ -z "$DREV" ]; then
    warn "the deploy copy $DEPLOY_COPY carries NO provenance block — the hook cannot be paired with a revision; reinstall the copies (bash scripts/install-host-tools.sh)"
  fi

  # WHICH REVISION THE LIVE HOOK IS — SEARCHED, not inferred from a short candidate list. A candidate-set
  # comparison answers "is it the served tip's hook? main's? the deploy's?" and nothing else; on
  # 2026-10-19 the live hook was a THIRD version (the one the served revision ships), which that test
  # called "no revision at all". The honest answer is the revision whose bytes these are, and it must hold
  # at ANY distance — the same words whether the gap is 3 commits or 300, because a check that is blind at
  # 40 is blind at 400.
  HOOK_REV_AT=""
  for _c in $(git -C "$REPO" log --all --format=%H -- scripts/antum-product-guard-hook.sh 2>/dev/null | head -60); do
    if [ "$(blob_hook_md5 "$_c")" = "$A" ]; then HOOK_REV_AT="$_c"; break; fi
  done
  # A FAIL here would block the very movement that repairs the pairing (a full movement installs the hook
  # from the tip at step 1b/6b), so every pair verdict below is a WARN that names both halves.
  if [ -n "$B_DEPLOY" ] && [ "$A" = "$B_DEPLOY" ]; then
    ok "hook installed at $HOOK_DST: $A_METHOD md5 $A == the deploy copy's revision ${DREV:0:12} — PAIRED with the deploy that writes the marker"
  elif [ -n "$B_SERVED" ] && [ "$A" = "$B_SERVED" ] && [ -n "$B_DEPLOY" ] && [ "$B_DEPLOY" != "$B_SERVED" ]; then
    warn "hook installed at $HOOK_DST IS THE SERVED TREE'S (${SERVED_REV:0:12}, $A_METHOD md5 $A) while the deploy copy $DEPLOY_COPY came from ${DREV:0:12} — UNPAIRED: that deploy writes server/deploy-in-progress and this hook does not read it. Fix: the next step 6b, or now: bash scripts/install-host-tools.sh --hook-rev $DREV"
  elif [ -n "$B_MAIN" ] && [ "$A" = "$B_MAIN" ]; then
    warn "hook installed at $HOOK_DST: $A_METHOD md5 $A == origin/main's hook, but the deploy copy's revision is ${DREV:-<none: no provenance>} — check the pairing (they must be one revision)"
  elif [ -n "$HOOK_REV_AT" ]; then
    warn "hook installed at $HOOK_DST: $A_METHOD md5 $A IS the hook at $(git -C "$REPO" rev-parse --short "$HOOK_REV_AT") ($(git -C "$REPO" log -1 --format=%cs "$HOOK_REV_AT")) — which is not the deploy copy's revision ${DREV:-<none: no provenance>}: UNPAIRED, so the marker that deploy writes has no reader. Fix: step 6b, or bash scripts/install-host-tools.sh --hook-rev ${DREV:-<deploy revision unknown>}"
  elif [ -n "$B_SERVED" ] || [ -n "$B_MAIN" ] || [ -n "$B_DEPLOY" ]; then
    warn "hook installed at $HOOK_DST matches NO revision in this clone's history of that file ($A_METHOD md5 $A) — it cannot be attributed, so no pair can be checked"
  else
    warn "hook installed (whole-file $A_FILE) but no candidate revision's hook could be read from $REPO — REFUSING to attribute it (step 6b installs from the deploy's revision)"
  fi
  if [ "${M_LIVE:-0}" -gt 0 ]; then
    note "the marker this deploy writes has a reader here: the live hook mentions deploy-in-progress ${M_LIVE} time(s), the deploy copy's hook ${M_DEPLOY} time(s)"
  else
    warn "the marker this deploy writes has NO READER here: the live hook mentions deploy-in-progress ${M_LIVE:-0} time(s), the deploy copy's hook ${M_DEPLOY} time(s) (deploy copy revision ${DREV:-<none>}) — a restart during a deploy window would arm a guard the deploy then reaps"
  fi
  # Both candidates are compared with origin/main, always, because a raw install from a revision whose
  # hook is behind main's is exactly how this host lost the #203 stand-down.
  for _rev in "${SERVED_REV:-}" "${DREV:-}"; do
    [ -n "$_rev" ] || continue
    if [ -n "${_seen:-}" ] && [ "$_rev" = "$_seen" ]; then continue; fi
    _seen="$_rev"
    _m=$(blob_hook_md5 "$_rev")
    [ -n "$_m" ] || continue
    if [ "$_m" = "$B_MAIN" ]; then
      note "  the hook at ${_rev:0:12} (=$([ "$_rev" = "$SERVED_REV" ] && echo 'served tree' || echo 'deploy copy')) IS origin/main's"
    else
      warn "the hook at ${_rev:0:12} (=$([ "$_rev" = "$SERVED_REV" ] && echo 'served tree' || echo 'deploy copy')) is NOT origin/main's — $(git -C "$REPO" rev-list --count "$_rev..origin/main" 2>/dev/null) commit(s) behind; the difference is the stand-down block that reads the deploy marker, so installing the hook raw from it leaves the marker without a reader"
    fi
  done
else
  no "hook NOT installed at $HOOK_DST — a restart would not re-arm the guard"
fi

echo "--- the rollback target exists and is the bytes we think ---"
if [ -d "$BUNDLE" ]; then
  M=$(md5sum "$BUNDLE/dist/assets/$ROLLBACK_ASSET" 2>/dev/null | cut -d' ' -f1)
  [ "$M" = "$ASSET_MD5" ] && ok "rollback bundle asset $ROLLBACK_ASSET md5 $M" || no "rollback bundle asset $ROLLBACK_ASSET md5 ${M:-missing} != $ASSET_MD5"
  M2=$(md5sum "$BUNDLE/server-index.js" 2>/dev/null | cut -d' ' -f1)
  [ "$M2" = "$IDXJS_MD5" ] && ok "rollback bundle server/index.js md5 $M2" || no "rollback bundle server/index.js md5 ${M2:-missing} != $IDXJS_MD5"
else
  no "rollback bundle missing at $BUNDLE"
fi
M3=$(md5sum "$DEPLOY_DIR/server/index.js" 2>/dev/null | cut -d' ' -f1)
# This compares the DEPLOYED tree's server/index.js against the ROLLBACK bundle's copy. They are equal
# only BEFORE a movement; once the cutover has landed they differ by design. The old wording ("the tree is
# not the served commit's file") was written when the tree lagged what was served — after 2026-10-14 the
# tree IS what is served, so the sentence asserted the opposite of the truth.
[ "$M3" = "$IDXJS_MD5" ] && ok "deployed tree's server/index.js md5 $M3 (still the pre-cutover blob — nothing has moved)" || warn "deployed tree's server/index.js md5 ${M3:-?} != the rollback bundle's $IDXJS_MD5 — expected after a cutover: the tree carries the newer code"

echo "--- the shipped tree's own content and the after-state expectation, derived at run time ---"
AFTER_ASSET="<unknown>"
if [ -z "$SHIPPED" ]; then
  no "no shipped commit resolved — the after-state cannot be stated"
elif ! git -C "$REPO" cat-file -e "$SHIPPED^{commit}" 2>/dev/null; then
  no "the remote tip ${SHIPPED:0:12} is not in $REPO — fetch, then re-run (its content gate cannot be checked either)"
  AFTER_ASSET="<unknown — fetch and re-run>"
else
  N=$(git -C "$REPO" grep -c 'Final Settlement Payment' "$SHIPPED" -- server/compliance_engine.js 2>/dev/null | sed 's/.*://')
  [ "${N:-0}" -ge 1 ] && ok "step 1's gate string present in the shipped tree ($N hits)" || no "step 1's gate string 'Final Settlement Payment' NOT in server/compliance_engine.js at ${SHIPPED:0:12} — the cutover would refuse at step 1"
  # THE RETIRED ROUTES, AUDITED IN THE SOURCE (2026-10-20, rule 3). This package used to state they answer
  # 404. Measured on the host (movements/2026-10-20T1607Z/retired-routes.out): with a token, 403 and
  # Content-Length 0; without one, 401; and /api/nonexistent-route-xyz — never registered at all —
  # answers IDENTICALLY, because the deny-by-default /api gate fires before routing. A probe therefore
  # cannot tell a retired route from one that never existed. The router's own bytes can.
  ROUTE_REF="${ANTUM_ROUTE_REF:-$SHIPPED}"
  ROUTER=$(git -C "$REPO" show "$ROUTE_REF:server/index.js" 2>/dev/null)
  POS=$(printf '%s\n' "$ROUTER" | grep -c "app.get('/api/employees',")
  R1=$(printf '%s\n' "$ROUTER" | grep -c "app.get('/api/employees/:id',")
  R2=$(printf '%s\n' "$ROUTER" | grep -c "app.get('/api/compliance/report',")
  if [ "${POS:-0}" -lt 1 ]; then
    no "the retired-route audit read no router out of ${ROUTE_REF:0:12} (no registered GET /api/employees found) — leave it unjudged: an 'absent' verdict from a file that is not a router is vacuous"
  else
    [ "${R1:-0}" -eq 0 ] && ok "retired route absent from ${ROUTE_REF:0:12}'s router: GET /api/employees/:id (0 registrations; the live GET /api/employees is present, so the audit can tell the two apart)" || no "GET /api/employees/:id IS still registered in server/index.js at ${ROUTE_REF:0:12} — the retirement did not hold"
    [ "${R2:-0}" -eq 0 ] && ok "retired route absent from ${ROUTE_REF:0:12}'s router: GET /api/compliance/report (0 registrations)" || no "GET /api/compliance/report IS still registered in server/index.js at ${ROUTE_REF:0:12} — the retirement did not hold"
  fi
  if [ "$SHIPPED" = "$(git -C "$REPO" rev-parse "$MEASURED_TIP" 2>/dev/null)" ]; then
    AFTER_ASSET="$MEASURED_ASSET"
    if [ "$REC_SUPPLIED" -eq 1 ]; then
      ok "the shipped commit IS the tip the record names (${MEASURED_TIP}) — and this record was SUPPLIED BY THIS RUN, not the recorded default: the numbers below are only as good as that measurement"
    else
      ok "the shipped commit IS the commit this package measured (${MEASURED_TIP}) — the measured build stands"
    fi
  elif [ "$REC_INCOHERENT" = 1 ]; then
    # The refusal above has already failed this run. Do NOT also STATE a bundle: the record's tip and its
    # numbers disagree, so any asset named here is one nobody measured at this tip. Found while writing
    # this pack - the tip-alone run REFUSED and then still printed the default record's
    # assets/index-BG0peuOK.js for the overridden tip 2b14a94, whose real bundle is index-C9vf7pQB.js
    # (the one the host actually served at that tip). A refusal that still names an unmeasured number is
    # half a refusal.
    AFTER_ASSET="<undetermined - the record is half-overridden, so nothing is stated here>"
  else
    AHEAD=$(git -C "$REPO" rev-list --count "$MEASURED_TIP..$SHIPPED" 2>/dev/null)
    CLIENT_DIFF=$(git -C "$REPO" diff --name-only "$MEASURED_TIP" "$SHIPPED" -- client/ 2>/dev/null)
    if [ -z "$CLIENT_DIFF" ]; then
      AFTER_ASSET="$MEASURED_ASSET"
      warn "the shipped commit is ${AHEAD:-?} commit(s) past the measured ${MEASURED_TIP}, but client/ is UNCHANGED (measured) — the built bundle is still $MEASURED_ASSET. The DISK figures and the reset delta were taken on ${MEASURED_TIP}; re-take them if that delta grew."
    elif [ "${ANTUM_ALLOW_MOVED_TIP:-0}" = "1" ]; then
      AFTER_ASSET="<unknown — client/ changed and nothing has been built>"
      warn "OVERRIDDEN: the shipped commit is ${AHEAD:-?} commit(s) past ${MEASURED_TIP} and client/ CHANGED — the built asset hash is unknown; verify the asset after the movement, or re-measure the build and set ANTUM_MEASURED_TIP"
    else
      no "the shipped commit ${SHIPPED:0:12} is ${AHEAD:-?} commit(s) past the measured ${MEASURED_TIP} and client/ CHANGED ($(echo $CLIENT_DIFF | tr '\n' ' ')) — the expected bundle hash is unknown, so this package cannot state the after-state. Re-measure the build (scratch worktree + df sampling) and update ANTUM_MEASURED_TIP; conscious override: ANTUM_ALLOW_MOVED_TIP=1"
    fi
  fi
fi

echo "--- step 3/4's inputs ---"
[ -f /home/team/shared/.demo-admin-password ] && ok "demo credential file present" || no "/home/team/shared/.demo-admin-password missing — step 3 refuses"
[ -d "$DEPLOY_DIR/server/node_modules/bcryptjs" ] && ok "bcryptjs present in the deployed tree (step 3 hashes the credential)" || no "bcryptjs missing in the deployed tree"
ENV=$(bash -c 'set -a; . /etc/profile.d/cto-env-vars.sh >/dev/null 2>&1; set +a; for v in JWT_SECRET ENCRYPTION_KEY; do [ -n "${!v:-}" ] && echo "$v=present" || echo "$v=MISSING"; done' 2>/dev/null | tr '\n' ' ')
case "$ENV" in *MISSING*) no "restart env: $ENV" ;; *) ok "restart env: $ENV" ;; esac

echo
echo "--- after the movement, expect (derived from this run) ---"
echo "    commit  ${SHIPPED:-<unresolved>}"
if [ "$AFTER_ASSET" = "$MEASURED_ASSET" ]; then
  echo "    assets/$MEASURED_ASSET   $MEASURED_ASSET_BYTES B   md5 $MEASURED_ASSET_MD5"
  echo "    assets/$MEASURED_CSS   $MEASURED_CSS_BYTES B   md5 $MEASURED_CSS_MD5"
else
  echo "    assets/ $AFTER_ASSET"
fi
echo "    public GET / -> 200 naming an asset whose bytes ARE this tree's dist file, the listener on 3000 ours, the guard verified from its lock"
echo "    the two retired routes (GET /api/employees/:id, GET /api/compliance/report) ABSENT from the shipped router."
echo "    They are not probed: from outside they answer 401 without a token and an empty 403 with one — exactly"
echo "    like a path that was never registered, because the /api gate fires before routing (measured 2026-10-20)."
echo
if [ "$FAIL" -eq 0 ]; then echo "=== PREFLIGHT PASS — the movement's preconditions hold ($(date -Iseconds)) ==="; exit 0
else echo "=== PREFLIGHT FAIL — $FAIL precondition(s) do not hold; do not start the movement ==="; exit 1; fi
