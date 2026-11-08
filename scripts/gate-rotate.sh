#!/bin/bash
# gate-rotate.sh — ONE COMMAND: rotate the public gate's passcode AND its signing key, restart, and
# PROVE that the credential the old key minted is dead.
#
#   bash scripts/gate-rotate.sh            rotate, restart, prove, and report every row
#   bash scripts/gate-rotate.sh --help     this header
#
# WHY A ROTATION NEEDS BOTH FILES (measured 2026-11-08, the owner's ruling on the same day).
# `server/public-gate.js` reads two host files at boot: a bcrypt hash of the passcode and an HMAC key
# the cookie is signed with. The cookie is `antum_gate=v1.<issuedAtMs>.<hmac>` — it carries NO passcode
# and NO identity, and it lives 180 days. So DELETING ONLY THE PASSCODE FILE REVOKES NOBODY: every
# cookie already minted keeps verifying against the key that is still on disk, and the only thing that
# changed is the door code for whoever does not already hold a cookie. A real revocation rotates the
# SIGNING KEY, because that is the only thing a minted cookie is bound to.
#
# The documented manual procedure was: delete both files, then `deploy-main.sh --restart-only`, whose
# step 0 regenerates both. That procedure was never run and never tested, and it has a hole a reader
# would not see: it deletes the only copy of the old pair BEFORE anything has shown that the new one
# works, so a failure anywhere in the middle leaves the product with no way in and no way back.
# This script is that procedure with the order fixed:
#
#   1. REFUSE unless this is a deployment a rotation can act on — the tree is gated, both credential
#      files exist, no movement is in flight — and PRINT what it judged (the tree's revision).
#   2. MINT a cookie from the CURRENT signing key and CONFIRM IT WORKS (the product's own shell: 200,
#      #root, the entry asset the built dist names). Abort if it does not: a rotation that cannot show
#      the old credential working cannot show that it was revoked, and every row below would then be a
#      row about a broken rig.
#   3. ROTATE BOTH FILES, keeping the old pair aside for the duration of the run. Each file is
#      replaced by rename(2), so no reader ever sees a partial credential; the pair is read together
#      only at boot, so the interval between the two renames is not observable to a running server.
#      The new passcode is generated here and travels in the ENVIRONMENT, never in argv (argv is
#      world-readable in `ps`); its plaintext is written to $GATE_SHOWN_ONCE (mode 600) and this script
#      prints the PATH, never the value.
#   4. RESTART through `deploy-main.sh --restart-only` — no fetch, no build, no re-seed, no movement.
#   5. ASSERT, as separate rows, and print each with the values it compared:
#        a. the PRE-ROTATION cookie is now REFUSED (the gate page's own title, no #root, no entry
#           asset, and the asset URL does not serve the product's bytes).  <-- the row this exists for
#        b. a cookie minted from the NEW key gets the product: 200, #root, the built entry named, and
#           the served asset's md5 IS the file on disk.
#        c. the NEW passcode is the door code: POST /gate with it answers a redirect carrying a cookie,
#           and that cookie opens the product.
#        d. the OLD passcode no longer opens it (401, no cookie). UNJUDGEABLE — and said so — when the
#           old plaintext is not on this host to try.
#        e. the product still RENDERS after the restart (a real rendered screen, via
#           scripts/check-served-render.js), because a shell that answers 200 is not a mounted app.
#        f. the guard is ALIVE — by the holder of server/keep-alive.lock, never by the port.
#   6. On success, DESTROY the old pair. On any failure, PUT IT BACK and restart again, loudly: a
#      botched rotation must never leave the product unreachable. The product's reachability is
#      measured again after a restore, so "restored" is a measurement and not a claim.
#
# EXIT CODES: 0 proven · 1 a row failed (the OLD pair was put back) · 2 usage ·
#             3 proven, but at least one row was UNJUDGEABLE and is named as such — never a clean pass.
#
# WHO THIS EVICTS: everyone. The owner's ruling of 2026-11-08 is one shared passcode, so there is no
# per-prospect revocation while it is shared; this command rotates the one code and the one key, which
# signs out every browser that holds a cookie — the owner's included. The new passcode is in
# $GATE_SHOWN_ONCE, mode 600, for the owner to read and then delete.
#
# WHAT THIS SCRIPT NEVER DOES: print a credential (passcode, hash, key, cookie), put a passcode in
# argv, build the client (WORKFLOW 43), fetch, reset, re-seed or run a movement, or touch any file
# outside the two credential files and the shown-once file.
#
# EVERY HOST VALUE IS AN OVERRIDE (WORKFLOW rule 14), because the unit between the
# `>>> ANTUM GATE ROTATION` / `<<< ANTUM GATE ROTATION` markers is extracted and driven off-host by
# `scripts/gate-rotate-test.sh` against throwaway trees and real HTTP rigs in /tmp.
set -uo pipefail

DEPLOY_DIR="${ANTUM_DEPLOY_DIR:-/home/team/shared/probable-octo-sniffle}"
PUBLIC="${ANTUM_PUBLIC:-https://b974147c03228029e277d1cbe6646fe6.ctonew.app}"

# ===================================================================================================
# >>> ANTUM GATE ROTATION — ONE UNIT, extracted and exercised off-host by scripts/gate-rotate-test.sh
#
# Functions only: sourcing this unit runs nothing, changes nothing and prints nothing. Every path and
# every command it uses is an ANTUM_* override so the test can point all of them at /tmp; the host's
# real paths appear only as the `:-` defaults.
#
# ANTUM_GATE_RESTART_CMD  a command that restarts whatever serves $PUBLIC (default: the deploy's
#                         --restart-only path). The test points it at a body that restarts its own rig,
#                         and mutation (b) points it at a no-op.
# ANTUM_GATE_RENDER_CMD   a command that measures a RENDERED screen of $PUBLIC (default:
#                         scripts/check-served-render.js in the deployed tree).
# ===================================================================================================
GATE_PASSCODE_FILE="${ANTUM_GATE_PASSCODE_FILE:-/home/team/shared/.antum-gate-passcode}"
GATE_SECRET_FILE="${ANTUM_GATE_SECRET_FILE:-/home/team/shared/.antum-gate-secret}"
GATE_SHOWN_ONCE="${ANTUM_GATE_SHOWN_ONCE:-/home/team/shared/.antum-gate-passcode.shown-once}"
GATE_RESTART_CMD="${ANTUM_GATE_RESTART_CMD:-}"
GATE_RENDER_CMD="${ANTUM_GATE_RENDER_CMD:-}"

# The run's own state. ROT_ROTATED says the new pair has been written (so a failure from here on must
# put the old one back); ROT_SETTLED says the run has already decided, so the EXIT trap stays out of it.
ROT_ROTATED=0
ROT_SETTLED=0
ROT_OLD_DIR=""
ROT_OLD_PASSCODE=""
ROT_NEW_PASSCODE=""
ROT_PRE_COOKIE=""
ROT_NEW_COOKIE=""
ROT_PROBE_HELPER=""

tree_is_gated() { [ -f "$DEPLOY_DIR/server/public-gate.js" ]; }

tree_revision() { git -C "$DEPLOY_DIR" rev-parse HEAD 2>/dev/null || echo '<not a git tree>'; }

# The asset name the BUILT dist names — read from client/dist/index.html, never remembered. The gate
# page names no asset at all, which is what makes this the discriminator between the product and a page
# that merely answers 200.
dist_named_asset() { # $1 = js|css -> the file name (without the `assets/` prefix), or empty
  local idx="$DEPLOY_DIR/client/dist/index.html" pat
  [ -f "$idx" ] || return 0
  case "$1" in
    css) pat='assets/index-[A-Za-z0-9_-]*\.css' ;;
    *)   pat='assets/index-[A-Za-z0-9_-]*\.js' ;;
  esac
  grep -o "$pat" "$idx" 2>/dev/null | head -1 | sed 's#^assets/##'
}

# The two titles, each DERIVED from the thing that produces it: the product's from the built
# index.html, the gate's from the tree's own gate module. A title typed in here would drift the moment
# either page changed, and the assertion would then redden on a healthy deployment.
product_title() {
  grep -o '<title>[^<]*</title>' "$DEPLOY_DIR/client/dist/index.html" 2>/dev/null | head -1 \
    | sed -e 's#<title>##' -e 's#</title>##'
}
gate_title() {
  node -e "const g=require('$DEPLOY_DIR/server/public-gate');const m=g.gatePage('').match(/<title>([^<]*)<\/title>/);process.stdout.write(m?m[1]:'')" 2>/dev/null
}

# A cookie minted from a signing key. This is how the deploy and the instruments reach the shell: the
# passcode file is a HASH, so no script can derive the passcode, but anything that can read the key is
# already on this host — which is the right boundary.
mint_cookie_from() { # $1 = secret file -> `antum_gate=v1.…` on stdout, rc 1 if it cannot mint
  node -e "process.stdout.write(require('$DEPLOY_DIR/server/public-gate').mintCookieHeader('$1'))" 2>/dev/null
}

# ── the HTTP probe: ONE helper, written once, used for every row ────────────────────────────────────
# The cookie and the passcode reach it in the ENVIRONMENT, never in argv: a 180-day cookie on a command
# line is a credential in `ps`, and the same goes for the passcode. Its output is machine-readable
# KEY=value rows so no row of this script is decided by a regex over prose.
ensure_probe_helper() {
  if [ -n "$ROT_PROBE_HELPER" ] && [ -s "$ROT_PROBE_HELPER" ]; then return 0; fi
  ROT_PROBE_HELPER=$(mktemp /tmp/antum-gate-probe-XXXXXX.js) || {
    echo "  FAIL: no scratch file for the probe helper"; return 1; }
  cat > "$ROT_PROBE_HELPER" <<'ANTUM_PROBE_JS'
"use strict";
const http = require("http");
const https = require("https");
const crypto = require("crypto");

function request(target, opts) {
  const options = opts || {};
  return new Promise((resolve) => {
    let url;
    try { url = new URL(target); } catch (e) { return resolve({ error: "bad-url" }); }
    const lib = url.protocol === "https:" ? https : http;
    const headers = {};
    if (options.cookie) headers.Cookie = options.cookie;
    if (options.body !== undefined && options.body !== null) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      headers["Content-Length"] = Buffer.byteLength(options.body);
    }
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: headers,
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        const raw = res.headers["set-cookie"];
        let cookie = "none";
        if (raw && raw.length) {
          const m = String(raw[0]).match(/antum_gate=[^;]+/);
          if (m) cookie = m[0];
        }
        resolve({ status: res.statusCode, buf: buf, setCookie: cookie });
      });
    });
    req.on("error", () => resolve({ error: "unreachable" }));
    req.setTimeout(25000, () => { req.destroy(); resolve({ error: "timeout" }); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

function fields(tag, r) {
  if (!r || r.error) return [tag + " error=" + ((r && r.error) || "unknown")];
  const text = r.buf.toString("utf8");
  const title = (text.match(/<title>([^<]*)<\/title>/) || [])[1];
  const root = (text.match(/id="root"/g) || []).length;
  // The BARE file name, the same shape `dist_named_asset` returns — a row that compared
  // "assets/index-X.js" with "index-X.js" would fail on a healthy deployment.
  const named = text.match(/assets\/(index-[A-Za-z0-9_-]*\.js)/);
  const entry = named ? named[1] : undefined;
  return [
    tag + " status=" + r.status,
    tag + " bytes=" + r.buf.length,
    tag + " root=" + root,
    tag + " entry=" + (entry || "none"),
    tag + " title=" + (title === undefined ? "none" : title),
  ];
}

async function main() {
  const mode = process.argv[2];
  const base = process.env.GATE_BASE || "";
  const cookie = process.env.GATE_COOKIE || "";
  if (mode === "doc") {
    const r = await request(base + "/", { cookie: cookie });
    console.log(fields("DOC", r).join("\n"));
    return;
  }
  if (mode === "asset") {
    const r = await request(base + (process.env.GATE_PATH || "/"), { cookie: cookie });
    if (!r || r.error) { console.log("ASSET error=" + ((r && r.error) || "unknown")); return; }
    console.log("ASSET status=" + r.status);
    console.log("ASSET bytes=" + r.buf.length);
    console.log("ASSET md5=" + crypto.createHash("md5").update(r.buf).digest("hex"));
    return;
  }
  if (mode === "login") {
    const body = "passcode=" + encodeURIComponent(process.env.GATE_PASSCODE || "");
    const r = await request(base + "/gate", { method: "POST", body: body });
    if (!r || r.error) { console.log("LOGIN error=" + ((r && r.error) || "unknown")); return; }
    console.log("LOGIN status=" + r.status);
    console.log("LOGIN setcookie=" + (r.setCookie === "none" ? "no" : "yes"));
    if (r.setCookie !== "none") {
      const d = await request(base + "/", { cookie: r.setCookie });
      const f = fields("SHELL", d);
      console.log(f.filter((l) => / (status|root|entry|title)=/.test(l)).join("\n"));
    }
    return;
  }
  console.log("PROBE error=unknown-mode");
}
main();
ANTUM_PROBE_JS
  chmod 600 "$ROT_PROBE_HELPER" 2>/dev/null
  return 0
}

probe_doc() { # $1 = Cookie header (empty = no cookie) -> DOC rows
  ensure_probe_helper || return 1
  GATE_BASE="$PUBLIC" GATE_COOKIE="$1" node "$ROT_PROBE_HELPER" doc 2>/dev/null
}
probe_asset() { # $1 = cookie, $2 = path -> ASSET rows
  ensure_probe_helper || return 1
  GATE_BASE="$PUBLIC" GATE_COOKIE="$1" GATE_PATH="$2" node "$ROT_PROBE_HELPER" asset 2>/dev/null
}
probe_login() { # $1 = passcode VALUE (environment, never argv) -> LOGIN + SHELL rows
  ensure_probe_helper || return 1
  GATE_BASE="$PUBLIC" GATE_PASSCODE="$1" node "$ROT_PROBE_HELPER" login 2>/dev/null
}

# One field out of a probe's rows. The tag and key are matched at the start of a line, so `title=` can
# carry spaces and an `entry=` cannot be confused with it.
row_field() { # $1 = tag, $2 = key, $3 = rows -> the value (may be empty)
  printf '%s\n' "$3" | sed -n "s/^$1 $2=//p" | head -1
}

# ── writing a credential file: rename(2), mode 600, never a partial file ────────────────────────────
atomic_write() { # $1 = destination; content on stdin
  local dst="$1" tmp
  tmp=$(mktemp "$(dirname "$dst")/.$(basename "$dst").new.XXXXXX") || return 1
  cat > "$tmp" || { rm -f "$tmp"; return 1; }
  chmod 600 "$tmp" 2>/dev/null || { rm -f "$tmp"; return 1; }
  mv -f "$tmp" "$dst" || { rm -f "$tmp"; return 1; }
  return 0
}

# ── step 1: is this a deployment a rotation can act on? ─────────────────────────────────────────────
refuse_unless_rotatable() {
  local bad=0 rev label path size mode entry pid
  rev=$(tree_revision)
  echo "  judged against:   $rev"
  echo "                    ($DEPLOY_DIR — the tree this host serves. A rotation acts on the FILES the"
  echo "                     running server read at boot, not on a checkout: no git, no build, no pull.)"
  if tree_is_gated; then
    echo "  tree is gated:    YES — server/public-gate.js is in this tree"
  else
    echo "  tree is gated:    NO — there is no server/public-gate.js in this tree, so there is no wall"
    echo "                    and no credential to rotate. Nothing was changed."
    bad=1
  fi
  for pair in "passcode hash:$GATE_PASSCODE_FILE" "signing key:$GATE_SECRET_FILE"; do
    label="${pair%%:*}"; path="${pair#*:}"
    if [ -s "$path" ]; then
      size=$(stat -c %s "$path" 2>/dev/null); mode=$(stat -c %a "$path" 2>/dev/null)
      printf '  %-17s present at %s (%s B, mode %s) — contents never printed\n' "$label:" "$path" "$size" "$mode"
    else
      printf '  %-17s MISSING or empty at %s\n' "$label:" "$path"
      echo "                    A rotation needs a pair to rotate: with one half absent there is no old"
      echo "                    credential to prove dead, and 'rotated' would be a claim about a state"
      echo "                    that never existed."
      bad=1
    fi
  done
  if [ ! -d "$DEPLOY_DIR/server/node_modules" ]; then
    echo "  bcryptjs:         MISSING — $DEPLOY_DIR/server/node_modules is absent, so no passcode can be"
    echo "                    hashed here and nothing may be rotated."
    bad=1
  else
    echo "  bcryptjs:         present in $DEPLOY_DIR/server/node_modules"
  fi
  entry=$(dist_named_asset js)
  if [ -n "$entry" ]; then
    echo "  built entry:      $entry (named by client/dist/index.html) — the asset the rows compare"
  else
    echo "  built entry:      NONE — client/dist/index.html names no assets/index-*.js, so there is"
    echo "                    nothing to tell the product from a page that merely answers 200."
    bad=1
  fi
  if [ -f "$DEPLOY_DIR/server/deploy-in-progress" ]; then
    pid=$(head -1 "$DEPLOY_DIR/server/deploy-in-progress" 2>/dev/null)
    if [ -n "$pid" ] && [ -d "/proc/$pid" ]; then
      echo "  a movement is IN PROGRESS: $DEPLOY_DIR/server/deploy-in-progress (pid $pid, alive)."
      echo "                    Refusing: a movement restarts the product and re-arms the guard, so a"
      echo "                    rotation that raced it would be judged against a state it did not set."
      bad=1
    else
      echo "  deploy marker:    present but STALE (pid ${pid:-<empty>} is gone) — continuing"
    fi
  else
    echo "  deploy marker:    absent — no movement is in progress"
  fi
  [ "$bad" -eq 0 ] || return 1
  return 0
}

# ── step 2: the credential that is about to be revoked must work first ──────────────────────────────
confirm_pre_rotation_credential() {
  local entry pre_doc no_doc pre_status pre_root pre_entry pre_title gt
  entry=$(dist_named_asset js)
  gt=$(gate_title)
  if [ -z "$gt" ]; then
    echo "  FAIL: the tree's own gate module did not yield a gate page title — the wall cannot be"
    echo "        identified, so nothing below could tell the wall from the product."
    return 1
  fi
  echo "  gate page title (from $DEPLOY_DIR/server/public-gate.js): \"$gt\""

  # (i) cookieless, the URL must be the GATE PAGE. If it is not, the wall is not the thing in front of
  # the product — and then "the old cookie is refused" below could be true for a reason that has
  # nothing to do with this run.
  no_doc=$(probe_doc "")
  local no_status no_root no_entry no_title
  no_status=$(row_field DOC status "$no_doc"); no_root=$(row_field DOC root "$no_doc")
  no_entry=$(row_field DOC entry "$no_doc");   no_title=$(row_field DOC title "$no_doc")
  echo "  cookieless, the product URL:  HTTP $no_status  title \"$no_title\"  #root x$no_root  names ${no_entry:-NO asset}"
  if [ "$no_status" = "200" ] && [ "$no_title" = "$gt" ] && [ "$no_root" = "0" ] && [ "$no_entry" = "none" ]; then
    echo "  OK:   the wall is UP — a stranger gets the gate page, not the shell."
  else
    echo "  ABORT: the wall is NOT what the public URL serves. Expected the gate page (200, \"$gt\", no"
    echo "         #root, no entry asset) and got HTTP $no_status, title \"$no_title\", #root x$no_root,"
    echo "         entry ${no_entry:-none}. A rotation cannot be proven against a wall that is not up."
    return 1
  fi

  # (ii) the cookie minted from the CURRENT key must open the product.
  ROT_PRE_COOKIE=$(mint_cookie_from "$GATE_SECRET_FILE")
  case "$ROT_PRE_COOKIE" in
    antum_gate=v1.*.*) : ;;
    *) echo "  ABORT: could not mint a cookie from $GATE_SECRET_FILE — nothing was rotated."
       return 1 ;;
  esac
  pre_doc=$(probe_doc "$ROT_PRE_COOKIE")
  pre_status=$(row_field DOC status "$pre_doc"); pre_root=$(row_field DOC root "$pre_doc")
  pre_entry=$(row_field DOC entry "$pre_doc");   pre_title=$(row_field DOC title "$pre_doc")
  echo "  with the PRE-ROTATION cookie:  HTTP $pre_status  title \"$pre_title\"  #root x$pre_root  names ${pre_entry:-NO asset}"
  if [ "$pre_status" = "200" ] && [ "$pre_root" = "1" ] && [ "$pre_entry" = "$entry" ]; then
    echo "  OK:   the old credential WORKS — this run has something real to revoke."
    return 0
  fi
  echo "  ABORT: the pre-rotation cookie does NOT open the product (expected 200, #root, $entry)."
  echo "         A rotation from this state would revoke a credential that was already not working, and"
  echo "         every row below would be a row about a broken rig rather than about a rotation."
  echo "         NOTHING WAS CHANGED."
  return 1
}

# ── step 3: the rotation itself ─────────────────────────────────────────────────────────────────────
keep_old_pair() {
  ROT_OLD_DIR=$(mktemp -d /tmp/antum-gate-rotate-XXXXXX) || return 1
  chmod 700 "$ROT_OLD_DIR" 2>/dev/null
  cp -p "$GATE_PASSCODE_FILE" "$ROT_OLD_DIR/passcode" || return 1
  cp -p "$GATE_SECRET_FILE" "$ROT_OLD_DIR/secret" || return 1
  if [ -f "$GATE_SHOWN_ONCE" ]; then
    cp -p "$GATE_SHOWN_ONCE" "$ROT_OLD_DIR/shown-once" 2>/dev/null
  fi
  chmod 600 "$ROT_OLD_DIR"/* 2>/dev/null
  echo "  old pair:          kept aside in $ROT_OLD_DIR (mode 700) for the duration of this run only"
  echo "                     — it is destroyed on success and put back on any failure."
  return 0
}

# The old passcode, for the row that proves it no longer opens the gate. It is read from the shown-once
# file the PREVIOUS run wrote, and it is only trusted if it VERIFIES against the hash that is actually
# installed — a stale copy would make the row a row about a code nobody ever had.
read_old_passcode() {
  ROT_OLD_PASSCODE=""
  if [ ! -s "$ROT_OLD_DIR/shown-once" ]; then
    echo "  old passcode:      NOT ON THIS HOST — $GATE_SHOWN_ONCE was absent before the rotation, so the"
    echo "                     'old passcode no longer opens the gate' row will be UNJUDGEABLE, not"
    echo "                     assumed. (The revocation row does not depend on it: it uses a COOKIE.)"
    return 1
  fi
  local plain
  plain=$(head -1 "$ROT_OLD_DIR/shown-once")
  if [ -z "$plain" ]; then
    echo "  old passcode:      $GATE_SHOWN_ONCE is empty — the old-passcode row will be UNJUDGEABLE."
    return 1
  fi
  if PASS="$plain" HASH="$(cat "$GATE_PASSCODE_FILE")" node -e \
      "const b=require('$DEPLOY_DIR/server/node_modules/bcryptjs');process.exit(b.compareSync(process.env.PASS,process.env.HASH)?0:1)" 2>/dev/null; then
    ROT_OLD_PASSCODE="$plain"
    echo "  old passcode:      read from $GATE_SHOWN_ONCE and VERIFIED against the installed hash"
    echo "                     (the value is never printed, here or in any log)"
    return 0
  fi
  echo "  old passcode:      $GATE_SHOWN_ONCE does NOT verify against the installed hash — it is a stale"
  echo "                     copy, so the old-passcode row will be UNJUDGEABLE rather than guessed."
  return 1
}

write_new_secret() {
  local tmp len
  tmp=$(mktemp "$(dirname "$GATE_SECRET_FILE")/.antum-gate-secret.new.XXXXXX") || return 1
  ( umask 077; head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$tmp" ) || { rm -f "$tmp"; return 1; }
  len=$(stat -c %s "$tmp" 2>/dev/null)
  if [ -z "$len" ] || [ "$len" -lt 32 ]; then
    rm -f "$tmp"; echo "  FAIL: the new signing key is ${len:-0} B — the gate refuses a key under 32 characters."
    return 1
  fi
  if [ -s "$GATE_SECRET_FILE" ] && cmp -s "$tmp" "$GATE_SECRET_FILE"; then
    rm -f "$tmp"; echo "  FAIL: the new signing key is byte-identical to the old one — that is not a rotation."
    return 1
  fi
  chmod 600 "$tmp" 2>/dev/null
  mv -f "$tmp" "$GATE_SECRET_FILE" || { rm -f "$tmp"; return 1; }
  echo "  signing key:       ROTATED at $GATE_SECRET_FILE ($len B, mode $(stat -c %a "$GATE_SECRET_FILE" 2>/dev/null)) — contents never printed"
  return 0
}

write_new_passcode() {
  local plain tmp hash
  plain="$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | cut -c1-20)"
  if [ -z "$plain" ]; then
    echo "  FAIL: no entropy from /dev/urandom — nothing was rotated."
    return 1
  fi
  tmp=$(mktemp "$(dirname "$GATE_PASSCODE_FILE")/.antum-gate-passcode.new.XXXXXX") || return 1
  # THE VALUE TRAVELS IN THE ENVIRONMENT, NEVER IN ARGV: argv is world-readable in `ps`.
  ( umask 077; PASS="$plain" node -e \
      "const b=require('$DEPLOY_DIR/server/node_modules/bcryptjs');process.stdout.write(b.hashSync(process.env.PASS,12))" \
      > "$tmp" ) || { rm -f "$tmp"; echo "  FAIL: bcrypt could not hash the new passcode."; return 1; }
  hash="$(cat "$tmp")"
  # A hash that is not cost 12 is not the shape the host's file is required to be, and a hash that does
  # not verify against the passcode it was made from is a door nobody can open. Both are refused here,
  # BEFORE the file is installed.
  if ! printf '%s' "$hash" | grep -qE '^\$2[aby]\$12\$'; then
    rm -f "$tmp"; echo "  FAIL: the new passcode hash is not a bcrypt cost-12 hash — refusing to install it."
    return 1
  fi
  if ! PASS="$plain" HASH="$hash" node -e \
      "const b=require('$DEPLOY_DIR/server/node_modules/bcryptjs');process.exit(b.compareSync(process.env.PASS,process.env.HASH)?0:1)" 2>/dev/null; then
    rm -f "$tmp"; echo "  FAIL: the new hash does not verify against the passcode it was made from."
    return 1
  fi
  chmod 600 "$tmp" 2>/dev/null
  mv -f "$tmp" "$GATE_PASSCODE_FILE" || { rm -f "$tmp"; return 1; }
  # The plaintext, in ONE place, for the owner. The path is printed; the value never is.
  if ! printf '%s\n' "$plain" | atomic_write "$GATE_SHOWN_ONCE"; then
    echo "  FAIL: could not write $GATE_SHOWN_ONCE — a passcode nobody can read is a passcode lost."
    return 1
  fi
  ROT_NEW_PASSCODE="$plain"
  echo "  passcode:          ROTATED at $GATE_PASSCODE_FILE (bcrypt cost 12, mode $(stat -c %a "$GATE_PASSCODE_FILE" 2>/dev/null)) — hash never printed"
  echo "                     the passcode itself is in $GATE_SHOWN_ONCE (mode $(stat -c %a "$GATE_SHOWN_ONCE" 2>/dev/null))"
  return 0
}

# The file the owner will read must open the door the server will read. Anything else — a rename that
# landed on one file and not the other, a stale shown-once — is caught here, before the restart.
verify_shown_once() {
  local plain hash
  plain=$(head -1 "$GATE_SHOWN_ONCE" 2>/dev/null)
  hash=$(cat "$GATE_PASSCODE_FILE" 2>/dev/null)
  if [ -z "$plain" ] || [ -z "$hash" ]; then
    echo "  FAIL: $GATE_SHOWN_ONCE or $GATE_PASSCODE_FILE is empty after the rotation."
    return 1
  fi
  if [ "$plain" != "$ROT_NEW_PASSCODE" ]; then
    echo "  FAIL: the value in $GATE_SHOWN_ONCE is not the passcode this run generated."
    return 1
  fi
  if ! PASS="$plain" HASH="$hash" node -e \
      "const b=require('$DEPLOY_DIR/server/node_modules/bcryptjs');process.exit(b.compareSync(process.env.PASS,process.env.HASH)?0:1)" 2>/dev/null; then
    echo "  FAIL: the passcode in $GATE_SHOWN_ONCE does not verify against the installed hash."
    return 1
  fi
  echo "  shown-once file:   $GATE_SHOWN_ONCE verifies against the installed hash — the code the owner"
  echo "                     will read is the code the server will accept."
  return 0
}

restore_old_pair() {
  if [ -z "$ROT_OLD_DIR" ] || [ ! -f "$ROT_OLD_DIR/passcode" ] || [ ! -f "$ROT_OLD_DIR/secret" ]; then
    echo "  !!! CANNOT RESTORE: the aside copy is gone (${ROT_OLD_DIR:-<never made>})."
    echo "  !!! The product's credential is whatever is on disk now: $GATE_PASSCODE_FILE + $GATE_SECRET_FILE."
    return 1
  fi
  cat "$ROT_OLD_DIR/passcode" | atomic_write "$GATE_PASSCODE_FILE" || return 1
  cat "$ROT_OLD_DIR/secret"   | atomic_write "$GATE_SECRET_FILE"   || return 1
  if [ -f "$ROT_OLD_DIR/shown-once" ]; then
    cat "$ROT_OLD_DIR/shown-once" | atomic_write "$GATE_SHOWN_ONCE"
  else
    rm -f "$GATE_SHOWN_ONCE"
  fi
  echo "  !!! THE OLD PAIR IS BACK IN PLACE: $GATE_PASSCODE_FILE + $GATE_SECRET_FILE (mode 600)."
  return 0
}

destroy_old_pair() {
  [ -n "$ROT_OLD_DIR" ] || return 0
  rm -rf "$ROT_OLD_DIR" 2>/dev/null
  echo "  old pair:          DESTROYED (the aside copy at $ROT_OLD_DIR is gone)"
  ROT_OLD_DIR=""
  return 0
}

# ── step 4: the restart ─────────────────────────────────────────────────────────────────────────────
do_restart() {
  local rc=0
  if [ -n "$GATE_RESTART_CMD" ]; then
    echo "  restart:           ANTUM_GATE_RESTART_CMD ($GATE_RESTART_CMD) — a rig's own restart, not this host's"
    bash "$GATE_RESTART_CMD" || rc=$?
  else
    echo "  restart:           bash $DEPLOY_DIR/scripts/deploy-main.sh --restart-only"
    echo "                     (no fetch, no reset, no build, no re-seed — a restart reads the two files"
    echo "                      again, which is the only way the new pair reaches the running server)"
    bash "$DEPLOY_DIR/scripts/deploy-main.sh" --restart-only || rc=$?
  fi
  echo "  restart exit:      $rc (a non-zero exit here is NOT by itself a rotation failure — the rows"
  echo "                     below measure the product itself, and they are what decide)"
  return "$rc"
}

# ── step 5: the rows ────────────────────────────────────────────────────────────────────────────────
guard_holder() { lsof -t "$DEPLOY_DIR/server/keep-alive.lock" 2>/dev/null | head -1; }

render_check() { # rc 0 = a rendered screen was measured GREEN · 1 = measured RED · 2 = could not run
  local out rc
  if [ -n "$GATE_RENDER_CMD" ]; then
    echo "  rendered-screen instrument: ANTUM_GATE_RENDER_CMD ($GATE_RENDER_CMD)"
    out=$(bash "$GATE_RENDER_CMD" 2>&1); rc=$?
  else
    echo "  rendered-screen instrument: node $DEPLOY_DIR/scripts/check-served-render.js --replace --target $PUBLIC"
    out=$( cd "$DEPLOY_DIR" && node scripts/check-served-render.js --replace --target "$PUBLIC" 2>&1 ); rc=$?
  fi
  printf '%s\n' "$out" | tail -12 | sed 's/^/    | /'
  return "$rc"
}

assert_rotation() { # $1 = pre-rotation cookie, $2 = new-key cookie
  local entry disk_md5 pt gt
  local held=0 failed=0 skipped=0 revoked=1

  entry=$(dist_named_asset js)
  pt=$(product_title)
  gt=$(gate_title)
  disk_md5=$(md5sum < "$DEPLOY_DIR/client/dist/assets/$entry" 2>/dev/null | cut -d' ' -f1)
  echo "  gate page title (from the tree's own module): \"$gt\""
  echo "  product title (from the built dist):          \"$pt\""
  echo "  built entry:                                  ${entry:-<none>}${disk_md5:+  md5 $disk_md5}"
  echo ""

  # ── ROW a: THE PRE-ROTATION COOKIE IS REFUSED. This is the row the whole command exists for.
  local p_doc p_asset p_status p_root p_entry p_title p_a_status p_a_md5
  p_doc=$(probe_doc "$1")
  p_status=$(row_field DOC status "$p_doc"); p_root=$(row_field DOC root "$p_doc")
  p_entry=$(row_field DOC entry "$p_doc");   p_title=$(row_field DOC title "$p_doc")
  p_asset=$(probe_asset "$1" "/assets/$entry")
  p_a_status=$(row_field ASSET status "$p_asset"); p_a_md5=$(row_field ASSET md5 "$p_asset")
  echo "  (a) PRE-ROTATION cookie, the product URL:  HTTP ${p_status:-none}  title \"${p_title:-none}\"  #root x${p_root:-?}  names ${p_entry:-?}"
  echo "      PRE-ROTATION cookie, the asset URL:    /assets/$entry  HTTP ${p_a_status:-none}  md5 ${p_a_md5:-none}"
  echo "      (the product's own bytes are ${disk_md5:-none}; the gate's title is \"$gt\")"
  if [ "$p_title" = "$gt" ] && [ "$p_root" = "0" ] && [ "$p_entry" = "none" ] && [ "$p_a_md5" != "$disk_md5" ]; then
    echo "  OK:   THE PRE-ROTATION COOKIE IS REFUSED — the URL answers the gate page (its own title, no"
    echo "        #root, no entry asset) and the asset URL does not serve the product's bytes."
    held=$((held + 1))
  else
    revoked=0
    echo "  FAIL: THE PRE-ROTATION COOKIE STILL WORKS. The credential this run set out to revoke is still"
    echo "        a way in: title \"${p_title:-none}\" (the gate's is \"$gt\"), #root x${p_root:-?}, entry"
    echo "        ${p_entry:-?}, asset md5 ${p_a_md5:-none} against the product's ${disk_md5:-none}."
    failed=$((failed + 1))
  fi
  echo ""

  # ── ROW b: a cookie minted from the NEW key gets the product, byte for byte.
  local n_doc n_asset n_status n_root n_entry n_title n_a_md5 n_a_status
  n_doc=$(probe_doc "$2")
  n_status=$(row_field DOC status "$n_doc"); n_root=$(row_field DOC root "$n_doc")
  n_entry=$(row_field DOC entry "$n_doc");   n_title=$(row_field DOC title "$n_doc")
  n_asset=$(probe_asset "$2" "/assets/$entry")
  n_a_status=$(row_field ASSET status "$n_asset"); n_a_md5=$(row_field ASSET md5 "$n_asset")
  echo "  (b) NEW-KEY cookie, the product URL:       HTTP ${n_status:-none}  title \"${n_title:-none}\"  #root x${n_root:-?}  names ${n_entry:-?}"
  echo "      NEW-KEY cookie, the asset URL:         /assets/$entry  HTTP ${n_a_status:-none}  md5 ${n_a_md5:-none}"
  if [ "$n_status" = "200" ] && [ "${n_root:-0}" = "1" ] && [ "$n_entry" = "$entry" ] \
     && [ "$n_title" = "$pt" ] && [ -n "$disk_md5" ] && [ "$n_a_md5" = "$disk_md5" ]; then
    echo "  OK:   a cookie minted from the NEW signing key opens the product, and the served bytes ARE"
    echo "        the file on disk."
    held=$((held + 1))
  else
    echo "  FAIL: the NEW key's cookie did not get the product: expected 200, #root, \"$pt\", entry $entry"
    echo "        and md5 $disk_md5; got HTTP ${n_status:-none}, #root x${n_root:-?}, \"${n_title:-none}\","
    echo "        entry ${n_entry:-?}, md5 ${n_a_md5:-none}."
    failed=$((failed + 1))
  fi
  echo ""

  # ── ROW c: the NEW passcode is the door code — driven through the gate's own login endpoint.
  local l_rows l_status l_ck s_status s_root s_entry s_title
  l_rows=$(probe_login "$ROT_NEW_PASSCODE")
  l_status=$(row_field LOGIN status "$l_rows"); l_ck=$(row_field LOGIN setcookie "$l_rows")
  s_status=$(row_field SHELL status "$l_rows"); s_root=$(row_field SHELL root "$l_rows")
  s_entry=$(row_field SHELL entry "$l_rows");   s_title=$(row_field SHELL title "$l_rows")
  echo "  (c) NEW passcode, POST /gate:              HTTP ${l_status:-none}  Set-Cookie ${l_ck:-none}"
  echo "      ...the cookie it returned, GET /:      HTTP ${s_status:-none}  title \"${s_title:-none}\"  #root x${s_root:-?}  names ${s_entry:-?}"
  case "$l_status" in
    302|303)
      if [ "$l_ck" = "yes" ] && [ "$s_status" = "200" ] && [ "${s_root:-0}" = "1" ]; then
        echo "  OK:   THE NEW PASSCODE IS THE DOOR CODE — it answers a redirect carrying a cookie, and"
        echo "        that cookie opens the product shell."
        held=$((held + 1))
      else
        echo "  FAIL: the new passcode was accepted but its cookie does not open the product (Set-Cookie"
        echo "        ${l_ck:-none}, shell HTTP ${s_status:-none}, #root x${s_root:-?})."
        failed=$((failed + 1))
      fi ;;
    *)
      echo "  FAIL: the new passcode did not open the gate: POST /gate answered HTTP ${l_status:-none}"
      echo "        (a 401 is a refusal; a 429 is the limiter; anything but 302/303 is not a login)."
      failed=$((failed + 1)) ;;
  esac
  echo ""

  # ── ROW d: the OLD passcode is no longer a way in.
  if [ -n "$ROT_OLD_PASSCODE" ]; then
    local o_rows o_status o_ck
    o_rows=$(probe_login "$ROT_OLD_PASSCODE")
    o_status=$(row_field LOGIN status "$o_rows"); o_ck=$(row_field LOGIN setcookie "$o_rows")
    echo "  (d) OLD passcode, POST /gate:              HTTP ${o_status:-none}  Set-Cookie ${o_ck:-none}"
    if [ "$o_status" = "401" ] && [ "$o_ck" = "no" ]; then
      echo "  OK:   THE OLD PASSCODE NO LONGER OPENS THE GATE — refused, and it hands out no cookie."
      held=$((held + 1))
    else
      echo "  FAIL: the old passcode still does something: expected 401 with no Set-Cookie, got HTTP"
      echo "        ${o_status:-none} with Set-Cookie ${o_ck:-none}."
      failed=$((failed + 1))
    fi
  else
    echo "  (d) OLD passcode, POST /gate:              NOT JUDGED"
    echo "  SKIP-FLAGGED: the old plaintext is not on this host to try (see step 3), so this row judged"
    echo "        NOTHING. It is not counted as held, and it is not a pass."
    skipped=$((skipped + 1))
  fi
  echo ""

  # ── ROW e: the product still RENDERS after the restart. A shell that answers 200 is not a mounted app.
  local rrc=0
  render_check || rrc=$?
  case "$rrc" in
    0) echo "  OK:   THE PRODUCT STILL RENDERS — a browser loaded it after the restart and the app mounted."
       held=$((held + 1)) ;;
    1) echo "  FAIL: the rendered-screen instrument measured a RED after the restart (see its rows above)."
       failed=$((failed + 1)) ;;
    *) echo "  SKIP-FLAGGED: the rendered-screen instrument could not run (exit $rrc), so NOTHING was"
       echo "        judged about a rendered screen. Not counted as held; the shell/asset rows above stand"
       echo "        on their own and say only that the bytes are the built dist."
       skipped=$((skipped + 1)) ;;
  esac
  echo ""

  # ── ROW f: the guard is alive — by the LOCK'S HOLDER, never by the port.
  local holder hargs
  holder=$(guard_holder)
  if [ -n "$holder" ] && [ -d "/proc/$holder" ]; then
    hargs=$(ps -p "$holder" -o args= 2>/dev/null)
    echo "  (f) guard:                                 pid $holder holds $DEPLOY_DIR/server/keep-alive.lock"
    echo "      its command line:                      ${hargs:-<unreadable>}"
    echo "  OK:   THE GUARD IS ALIVE — the lock has a holder, and that holder is a live process."
    held=$((held + 1))
  else
    echo "  (f) guard:                                 NOBODY holds $DEPLOY_DIR/server/keep-alive.lock (got '${holder:-<none>}')"
    echo "  FAIL: the product is serving but UNGUARDED — nothing will restore it if it dies."
    failed=$((failed + 1))
  fi
  echo ""

  echo "  ROWS: $held held, $failed failed, $skipped skip-flagged (of $((held + failed + skipped)))"
  if [ "$revoked" -eq 0 ]; then
    echo "  VERDICT: THE ROTATION REVOKED NOBODY — the credential minted from the OLD signing key still"
    echo "           opens the product. That is the one thing this command exists to do, and it did not"
    echo "           happen; every other row above is beside the point."
    return 1
  fi
  if [ "$failed" -ne 0 ]; then
    echo "  VERDICT: THE ROTATION IS NOT PROVEN — $failed row(s) failed above. The old pair goes back."
    return 1
  fi
  if [ "$skipped" -ne 0 ]; then
    echo "  VERDICT: THE ROTATION IS PROVEN, WITH $skipped ROW(S) UNJUDGED (named above). The revocation,"
    echo "           the new key, the new passcode and the guard all held; what did not run is named, and"
    echo "           is not counted as a pass."
    return 3
  fi
  echo "  VERDICT: THE ROTATION IS PROVEN — the old cookie is dead, a cookie from the new key works, the"
  echo "           new passcode opens the gate, the old one does not, the product renders, the guard lives."
  return 0
}

# ── the whole run ───────────────────────────────────────────────────────────────────────────────────
abort_rotation() { # $1 = why
  echo ""
  echo "  !!!!!!!!!!!!!!!!!!!!!!!!!!! ROTATION ABORTED !!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "  $1"
  if [ "$ROT_ROTATED" -eq 1 ]; then
    echo "  Putting the OLD pair back, so a botched rotation never leaves the product unreachable:"
    restore_old_pair || echo "  WARNING: the restore did not complete — the files are in the state printed above."
    echo "  Restarting so the running server reads the OLD pair again:"
    do_restart || echo "  WARNING: that restart reported a non-zero exit — measure the product by hand."
    echo "  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  else
    echo "  Nothing had been rotated, so there is nothing to put back: the two credential files are"
    echo "  exactly as this run found them."
    echo "  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  fi
  ROT_SETTLED=1
  return 1
}

rotate_gate() {
  local rc=0
  ROT_ROTATED=0; ROT_SETTLED=0; ROT_OLD_DIR=""; ROT_OLD_PASSCODE=""; ROT_NEW_PASSCODE=""
  ROT_PRE_COOKIE=""; ROT_NEW_COOKIE=""
  trap 'if [ "$ROT_ROTATED" -eq 1 ] && [ "$ROT_SETTLED" -ne 1 ]; then
          echo ""; echo "  !!! this run ended without deciding — putting the OLD pair back"
          restore_old_pair; do_restart >/dev/null 2>&1
        fi
        [ -n "$ROT_OLD_DIR" ] && rm -rf "$ROT_OLD_DIR" 2>/dev/null
        [ -n "$ROT_PROBE_HELPER" ] && rm -f "$ROT_PROBE_HELPER" 2>/dev/null' EXIT INT TERM

  echo "=== gate rotation $(date -Iseconds) ==="
  echo "  tree:              $DEPLOY_DIR"
  echo "  public:            $PUBLIC"
  echo "  passcode file:     $GATE_PASSCODE_FILE"
  echo "  signing key file:  $GATE_SECRET_FILE"
  echo "  shown-once file:   $GATE_SHOWN_ONCE"
  echo "  (paths only — this script never prints a credential's contents, here or in any log)"
  echo ""

  echo "--- 1. can a rotation act on this deployment? ---"
  if ! refuse_unless_rotatable; then
    echo ""
    echo "VERDICT: REFUSED — nothing was read, changed, restarted or revoked."
    ROT_SETTLED=1
    return 1
  fi
  echo ""

  echo "--- 2. the credential about to be revoked must work first ---"
  if ! confirm_pre_rotation_credential; then
    echo ""
    echo "VERDICT: ABORTED before anything was changed — no file was written and nothing was restarted."
    ROT_SETTLED=1
    return 1
  fi
  echo ""

  echo "--- 3. rotate BOTH credentials (the passcode AND the signing key) ---"
  if ! keep_old_pair; then
    abort_rotation "could not keep the old pair aside, so there would be no way back."
    return 1
  fi
  read_old_passcode || true
  if ! write_new_secret; then
    abort_rotation "the new signing key could not be written."
    return 1
  fi
  ROT_ROTATED=1
  if ! write_new_passcode; then
    abort_rotation "the new passcode could not be written."
    return 1
  fi
  if ! verify_shown_once; then
    abort_rotation "the shown-once file does not match the installed hash."
    return 1
  fi
  echo ""

  echo "--- 4. restart so the running server reads the NEW pair ---"
  do_restart || echo "  (continuing: the rows below measure the product, not the restart's exit code)"
  echo ""

  echo "--- 5. THE ROWS — what this rotation has to prove ---"
  ROT_NEW_COOKIE=$(mint_cookie_from "$GATE_SECRET_FILE")
  case "$ROT_NEW_COOKIE" in
    antum_gate=v1.*.*) : ;;
    *) ROT_NEW_COOKIE="antum_gate="
       echo "  NOTE: no cookie could be minted from the NEW key — row (b) will fail on its own terms." ;;
  esac
  assert_rotation "$ROT_PRE_COOKIE" "$ROT_NEW_COOKIE"
  rc=$?
  echo ""

  echo "--- 6. settle: destroy the old pair, or put it back ---"
  if [ "$rc" -eq 0 ] || [ "$rc" -eq 3 ]; then
    destroy_old_pair
    ROT_SETTLED=1
    echo ""
    echo "ROTATION DONE (rc=$rc)."
    echo "  the new passcode is in: $GATE_SHOWN_ONCE   (mode $(stat -c %a "$GATE_SHOWN_ONCE" 2>/dev/null))"
    echo "  read it there, hand it to the owner, then DELETE that file — it is the only copy."
    echo "  every cookie minted under the old signing key is now refused, the owner's included: enter the"
    echo "  new passcode in the browser to get back in."
    [ "$rc" -eq 3 ] && echo "  one or more rows were UNJUDGEABLE and are named above — this is NOT a clean pass."
    return "$rc"
  fi
  echo "  the rows above did not all hold, so the OLD pair is put back:"
  if restore_old_pair; then
    echo "  restarting so the running server reads the OLD pair again:"
    do_restart || echo "  WARNING: that restart reported a non-zero exit — measure the product by hand."
    ROT_SETTLED=1
    echo ""
    echo "ROTATION FAILED (rc=$rc) — THE OLD CREDENTIAL IS STILL IN FORCE. The product was not left on a"
    echo "  half-rotated credential: the pair on disk is the pair this run found."
    return 1
  fi
  ROT_SETTLED=1
  echo ""
  echo "ROTATION FAILED (rc=$rc) AND THE RESTORE DID NOT COMPLETE — the credential files are in the state"
  echo "  printed above. Fix them by hand before the next restart reads them."
  return 1
}

usage() {
  awk 'NR>1 && /^set -uo pipefail/{exit} NR>1' "$0"
}
# <<< ANTUM GATE ROTATION

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  "")        rotate_gate; exit $? ;;
  *)         echo "unknown argument: $1 (this command takes no argument, or --help)"; exit 2 ;;
esac
