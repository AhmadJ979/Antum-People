#!/usr/bin/env node
"use strict";
/*
  gate-cookie.js - ONE mechanism for an instrument to reach the shell behind the public gate.

  WHY THIS FILE EXISTS (2026-11-08). `server/public-gate.js` now sits in front of every page and every
  asset under `client/dist`. An instrument that fetches our own HTTP surface WITHOUT a gate credential
  no longer measures the product: it measures the gate page - 200, title `Antum People - access`, no
  `assets/index-*.js`, no `#root`. Every assertion built on such a fetch ("the document is 200", "the
  asset is 200", "the page names our bundle") would be either FALSE (the asset is not served) or
  VACUOUS (the gate page is a 200 too). A green from an instrument in that state proves nothing, and a
  red from one sends the reader after a defect that is not there.

  So each instrument that needs the shell mints a cookie here, and each one treats the ABSENCE of a
  gate credential as a REFUSAL TO JUDGE - never as a pass. `mintCookieHeader` in the gate module is the
  only authority on the cookie's shape and signature; nothing here re-implements it, so the two cannot
  drift.

  THE TWO FILES (never in the repository, never printed):
    ANTUM_GATE_SECRET_FILE    default /home/team/shared/.antum-gate-secret - the HMAC key. Reading it
                              already means you are on this host, which is the boundary the gate
                              draws: the passcode file is a bcrypt HASH, so no script can derive the
                              passcode, but a process that can read the key can mint the credential.
                              That is exactly what `scripts/deploy-main.sh` does, and this is the same
                              mechanism factored out so the instruments share it instead of each
                              inventing one.

  USAGE
    node scripts/gate-cookie.js                 -> prints `antum_gate=v1.<stamp>.<mac>` on stdout
    node scripts/gate-cookie.js --tree <dir>    -> mint using <dir>/server/public-gate.js
    node scripts/gate-cookie.js --where         -> print the two paths it reads, and whether each
                                                   exists, without minting anything

  EXIT CODES (the team's convention, #266)
    0  a cookie was minted and printed
    3  ABSENT - no gate credential in this context (a worktree, a scratch tree, CI, a fresh clone).
       One line on stderr names the file it looked for. The caller must report this as a SKIP-FLAGGED
       row, never as OK: nothing about the product was measured.
    2  a usage error, or the gate module could not be loaded (missing dependencies, a broken tree).
       Never conflated with 3: "I could not look" and "the thing I look for is not here" are
       different facts and an operator's next move differs.

  THE COOKIE IS NEVER PRINTED TO A LOG. It is a 180-day credential for this deployment; a caller
  captures it into a variable, uses it, and does not echo it. `--where` is the form that is safe to
  paste into a report.
*/
const fs = require("node:fs");
const path = require("node:path");

const HERE = __dirname;
const ROOT = path.dirname(HERE);

function parseArgs(argv) {
  const opts = { tree: ROOT, where: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tree") {
      const v = argv[++i];
      if (v === undefined) usage("--tree needs a directory");
      opts.tree = path.resolve(v);
    } else if (a === "--where") {
      opts.where = true;
    } else if (a === "-h" || a === "--help") {
      usage(null, 0);
    } else {
      usage(`unknown argument '${a}'`);
    }
  }
  return opts;
}

function usage(message, code = 2) {
  if (message) console.error(`gate-cookie: ${message}`);
  console.error("usage: node scripts/gate-cookie.js [--tree <dir>] [--where]");
  process.exit(code);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  const gatePath = path.join(opts.tree, "server", "public-gate.js");
  let gate;
  try {
    gate = require(gatePath);
  } catch (e) {
    console.error(
      `gate-cookie: cannot load the gate module at ${gatePath} (${(e && e.code) || "error"}: ` +
        `${String((e && e.message) || e).split("\n")[0]}) - nothing was measured`
    );
    return 2;
  }

  const paths = gate.filePaths(process.env);
  const secretFile = paths.secretFile;
  const passcodeFile = paths.passcodeFile;

  const exists = (f) => {
    try {
      return fs.statSync(f).isFile() && fs.readFileSync(f, "utf8").trim().length > 0;
    } catch (_) {
      return false;
    }
  };

  if (opts.where) {
    console.log(`gate-cookie: gate module   ${gatePath}`);
    console.log(`gate-cookie: signing key   ${secretFile}  ${exists(secretFile) ? "PRESENT" : "ABSENT"}`);
    console.log(`gate-cookie: passcode hash ${passcodeFile}  ${exists(passcodeFile) ? "PRESENT" : "ABSENT"}`);
    console.log(`gate-cookie: env overrides ANTUM_GATE_SECRET_FILE / ANTUM_GATE_PASSCODE_FILE`);
    return exists(secretFile) ? 0 : 3;
  }

  if (!exists(secretFile)) {
    // THE ONE LINE AN OPERATOR GETS. It names the file, because "no cookie" alone would send them
    // looking at the product instead of at the credential.
    console.error(
      `gate-cookie: no gate signing key at ${secretFile} - the gate credential is not configured in ` +
        `this context, so nothing behind the gate can be measured from here`
    );
    return 3;
  }

  let header;
  try {
    header = gate.mintCookieHeader(secretFile);
  } catch (e) {
    console.error(`gate-cookie: could not mint from ${secretFile}: ${String((e && e.message) || e).split("\n")[0]}`);
    return 2;
  }
  if (!/^antum_gate=v1\.\d+\.[A-Za-z0-9_-]+$/.test(header)) {
    // A mint that does not have the gate's own shape is not usable by a browser or curl, and a
    // silently wrong header would read as "the product refused me" rather than "the minter broke".
    console.error(`gate-cookie: minted a value that is not the gate's cookie shape - refusing to print it`);
    return 2;
  }
  process.stdout.write(header);
  return 0;
}

process.exit(main());
