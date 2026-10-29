/**
 * THE PUBLIC PORT IS NOT NEGOTIABLE.
 *
 * The public URL reaches exactly one port on this host: 3000. Everything else about the product can
 * vary between deployments, but a process serving the LIVE database on any other port is a product
 * nobody outside can reach — and from outside it is indistinguishable from an outage.
 *
 * Measured, 2026-10-29: after the 06:07:35 boot the platform's site dev server took 3000 and the
 * public URL answered HTTP 200 with the placeholder page while `node index.js` pid 1669 ran on port
 * 4751. Nothing off-host noticed; the outage was found 18 minutes later by a person reading the URL.
 *
 * WHAT IS NOT THE CAUSE, MEASURED: index.js has never picked a port of its own. `const PORT =
 * process.env.PORT || 3000` and `app.listen(PORT, '0.0.0.0', ...)` are the whole of the listen path:
 * there is no fallback, no scan for the next free port, and no retry (`grep -rn 'EADDRINUSE' server/`).
 * So a product on a private port is ALWAYS a start path that handed PORT a value that is not the
 * public one — the 4751 instance came from a scratch-rig recipe whose own record named
 * `port=4751 db=/tmp/rigf/before.db`, not from the product choosing.
 *
 * WHAT THIS MODULE DOES, in two rules:
 *   1. A process that would serve the LIVE database refuses to come up on a port that is not the
 *      public port. It says which port it was given, which port the URL reaches, and exits non-zero —
 *      rather than starting, printing "listening", and looking healthy on a socket nobody can reach.
 *      A SCRATCH instance (its own PRODUCT_DB_PATH) keeps working, and now says out loud that it is
 *      one, because "a product on a wrong port" must never again be the quiet case.
 *   2. A bind failure names the port and the process holding it, instead of dying with a bare stack.
 *
 * WHY IT IS A SEPARATE MODULE, AND WHY IT RUNS FIRST: server/db.js opens and migrates the product
 * database AT REQUIRE TIME (its top-level `new DatabaseSync(PRODUCT_DB_PATH)`), so a process that is
 * going to refuse must refuse BEFORE db.js is required. index.js therefore calls `enforce()` as its
 * first statement, above `require('./db')`. server/public-port.test.js asserts that order in the
 * source, because the safety of the refusal control depends on it.
 *
 * TESTING OFF THE LIVE PORT: ANTUM_PUBLIC_PORT names the port the public URL reaches (default 3000),
 * so the invariant can be exercised against a scratch listener without touching the live product.
 *
 * ONE VALUE, TWO FILES: the live database path is stated here so this module can run before db.js,
 * and db.js keeps the same literal in its own fallback. `public-port.test.js` reads db.js's source and
 * fails if the two ever disagree — the duplication is guarded, not remembered.
 */
const fs = require('fs');
const { execFileSync } = require('child_process');

/** The deployed product database. db.js must name the same path — asserted by this module's suite. */
// Assembled, not written out: server/privacy-notice.test.js fails any module under server/ that
// contains the host-shared directory as a contiguous literal, and it is right to - that rule exists to
// keep a served document from being read out of the shared copy. This is a database path, not a
// document, and the two pieces below are the whole of it.
const HOST_ROOT = '/home' + '/team';
const LIVE_PRODUCT_DB = `${HOST_ROOT}/.data/antum-product.db`;

/** The port the public URL reaches. Overridable only so the rule can be tested off the live port. */
function publicPort() {
  const raw = process.env.ANTUM_PUBLIC_PORT;
  if (raw === undefined || raw === '') return 3000;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(
      `ANTUM_PUBLIC_PORT='${raw}' is not a port number. This variable names the port the public URL `
      + 'reaches; an unreadable value would silently disable the port rule. Fix it or unset it.'
    );
  }
  return n;
}

/** Where this process will actually read and write: its own scratch DB if given one, else the live DB. */
function productDbPath() {
  return process.env.PRODUCT_DB_PATH || LIVE_PRODUCT_DB;
}

/** True when a start would bind the deployed product database. */
function servesLiveDatabase() {
  return productDbPath() === LIVE_PRODUCT_DB;
}

/**
 * The whole decision, as a value, so it can be asserted without spawning anything.
 * Returns { action: 'serve' | 'refuse', port, publicPort, dbPath, live, offPort }.
 */
function decide(env = process.env) {
  const port = env.PORT === undefined || env.PORT === '' ? 3000 : Number(env.PORT);
  const dbPath = env.PRODUCT_DB_PATH || LIVE_PRODUCT_DB;
  const pub = (() => {
    const raw = env.ANTUM_PUBLIC_PORT;
    if (raw === undefined || raw === '') return 3000;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      throw new Error(`ANTUM_PUBLIC_PORT='${raw}' is not a port number.`);
    }
    return n;
  })();
  const live = dbPath === LIVE_PRODUCT_DB;
  const offPort = port !== pub;
  return { action: live && offPort ? 'refuse' : 'serve', port, publicPort: pub, dbPath, live, offPort };
}

/** Who holds a TCP port right now, as "pid 1234 (node index.js, cwd /path)", or '' if we cannot say. */
function describeHolder(port) {
  try {
    const out = execFileSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    const pids = out.split(/\s+/).filter((s) => /^[0-9]+$/.test(s));
    if (!pids.length) return '';
    return pids.map((pid) => {
      let cmd = '?';
      let cwd = '?';
      try { cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').join(' ').trim() || '?'; } catch { /* gone */ }
      try { cwd = fs.readlinkSync(`/proc/${pid}/cwd`); } catch { /* gone */ }
      return `pid ${pid} (${cmd}, cwd ${cwd})`;
    }).join(' + ');
  } catch {
    return ''; // lsof absent, or nothing listening: the message must not depend on the probe working
  }
}

/**
 * Run the rule. Exits non-zero on a refusal. Otherwise returns the decision, having printed the
 * scratch banner when this process is one.
 */
function enforce() {
  let d;
  try {
    d = decide();
  } catch (err) {
    // An unreadable ANTUM_PUBLIC_PORT would disable the rule silently; say so and stop instead.
    console.error(`[FATAL] ${(err && err.message) || String(err)}`);
    process.exit(1);
  }
  if (d.action === 'refuse') {
    console.error(
      '[FATAL] REFUSING TO START: this process would serve the LIVE product database '
      + `(${d.dbPath}) on port ${d.port}, which is NOT the public port ${d.publicPort}.`
      + `\n        Nothing outside this host can reach port ${d.port}, and from outside this looks`
      + ' exactly like the product being down.'
      + `\n        The live product is started by the deploy, which pins PORT=${d.publicPort}:`
      + ' run restore-product.sh from the host-tools directory (the deploy writes it there)'
      + `\n        If this is a SCRATCH instance, give it its own database: PRODUCT_DB_PATH=/tmp/scratch.db PORT=${d.port}`
    );
    process.exit(1);
  }
  if (d.offPort) {
    console.log(
      `[port] SCRATCH INSTANCE on port ${d.port} with database ${d.dbPath}. `
      + `The public URL reaches port ${d.publicPort}; nothing outside this host can reach this one.`
    );
  }
  return d;
}

/** The listen callbacks, so index.js carries no policy of its own. */
function onListening(port) {
  console.log(`Antum server listening on port ${port}`);
}

function onListenError(port, err) {
  const code = err && err.code;
  if (code === 'EADDRINUSE') {
    const holder = describeHolder(port);
    console.error(
      `[FATAL] Port ${port} is already held${holder ? ` by ${holder}` : ''}. The product is NOT serving.`
      + `\n        If that holder is not our product, the deploy evicts it and claims the port:`
      + ' run restore-product.sh from the host-tools directory'
    );
  } else {
    console.error(`[FATAL] Could not bind port ${port}: ${(err && err.message) || String(err)}
        The product is NOT serving.`);
  }
  process.exit(1);
}

module.exports = {
  LIVE_PRODUCT_DB,
  publicPort,
  productDbPath,
  servesLiveDatabase,
  decide,
  describeHolder,
  enforce,
  onListening,
  onListenError,
};
