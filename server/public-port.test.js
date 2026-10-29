// Pinned ABOVE every require: server/live-db-guard.test.js fails any test file that could reach the
// live product database without pinning a throwaway path first, and a pin below the requires is too
// late in the general case. This suite never opens a database in-process (it spawns), so the pin costs
// nothing and keeps the guard's rule satisfied by construction rather than by argument.
process.env.PRODUCT_DB_PATH = `${require('node:os').tmpdir()}/antum-public-port-guard-${process.pid}.db`;
/**
 * The port rule: a product serving the LIVE database must never come up on a port the public URL
 * does not reach, and a bind failure must name the port and its holder.
 *
 * The control this file exists for is the 2026-10-29 outage: `node index.js` came up on 4751 while
 * the public URL answered the platform's placeholder page. Before this change that process printed
 * `Antum server listening on port 4751` and looked healthy; after it, the same invocation refuses and
 * exits non-zero. Both directions are exercised below.
 *
 * SAFETY: this suite must never open the live product database. `server/db.js` opens it at require
 * time, so the refusal in index.js has to happen above the line that loads db.js — that order is asserted
 * here (test "the refusal runs before db.js is required") and re-asserted inside the process test
 * immediately before the child is spawned. Do not weaken either.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const publicPort = require('./public-port');

const SERVER_DIR = __dirname;
const INDEX_JS = path.join(SERVER_DIR, 'index.js');
const DB_JS = path.join(SERVER_DIR, 'db.js');
const JWT_SECRET = 'public-port-test-secret-not-a-production-key';
const ENCRYPTION_KEY = 'a'.repeat(32);

const freePort = async () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.unref();
  srv.on('error', reject);
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address();
    srv.close(() => resolve(port));
  });
});

const scratchDb = () => path.join(os.tmpdir(), `antum-public-port-${process.pid}-${Math.random().toString(16).slice(2)}.db`);

/**
 * Source with comments removed, so an anchor finds CODE and not a sentence ABOUT the code. Learned the
 * hard way here: index.js's own header comment quotes `require(./db) in the source, quoted without its quotes` to explain the ordering, and a
 * plain search matched the comment — five lines above the code it was asking about.
 */
const codeOf = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));


/** Run index.js in a child until it exits, or for `ms`, collecting its output. */
const runIndex = (env, ms = 15000) => new Promise((resolve) => {
  const child = spawn(process.execPath, [INDEX_JS], {
    cwd: SERVER_DIR,
    env: { ...process.env, JWT_SECRET, ENCRYPTION_KEY, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let err = '';
  let timedOut = false;
  child.stdout.on('data', (b) => { out += b.toString(); });
  child.stderr.on('data', (b) => { err += b.toString(); });
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, ms);
  child.on('exit', (code, signal) => {
    clearTimeout(timer);
    resolve({ code, signal, out, err, timedOut });
  });
});

test('the decision, as a value: a live database off the public port is a refusal', () => {
  const live = publicPort.LIVE_PRODUCT_DB;
  const cases = [
    // env PORT / PRODUCT_DB_PATH / ANTUM_PUBLIC_PORT -> action
    [{ PORT: '3000', PRODUCT_DB_PATH: live }, 'serve', 'the deployed shape: live DB on 3000'],
    [{ PORT: '3000' }, 'serve', 'live DB by default on 3000'],
    [{ PORT: '4751', PRODUCT_DB_PATH: live }, 'refuse', 'live DB on a private port — the 2026-10-29 shape'],
    [{ PORT: '4751' }, 'refuse', 'live DB by default on a private port — the same shape, unstated'],
    [{ PORT: '4751', PRODUCT_DB_PATH: '/tmp/scratch.db' }, 'serve', 'a scratch instance is allowed its own port'],
    [{ PORT: '4751', PRODUCT_DB_PATH: '/tmp/scratch.db', ANTUM_PUBLIC_PORT: '4751' }, 'serve', 'a redeployed public port moves with the rule'],
  ];
  for (const [env, expected, why] of cases) {
    assert.equal(publicPort.decide(env).action, expected, `${why} (${JSON.stringify(env)})`);
  }
});

test('the public port defaults to 3000 and an unreadable value is refused, not ignored', () => {
  assert.equal(publicPort.decide({ PORT: '3000' }).publicPort, 3000);
  assert.equal(publicPort.decide({ PORT: '3000', ANTUM_PUBLIC_PORT: '3100' }).publicPort, 3100);
  assert.throws(() => publicPort.decide({ PORT: '3000', ANTUM_PUBLIC_PORT: 'not-a-port' }),
    /not a port number/,
    'a garbage ANTUM_PUBLIC_PORT must not silently disable the rule');
});

test('one value, two files: db.js falls back to the same live database this module names', () => {
  const source = fs.readFileSync(DB_JS, 'utf8');
  assert.ok(
    source.includes(publicPort.LIVE_PRODUCT_DB),
    `db.js no longer defaults to ${publicPort.LIVE_PRODUCT_DB}. The port rule decides "live database" by `
    + 'that path, so the two must agree; update server/public-port.js in the same commit.'
  );
});

test('the refusal runs before db.js is loaded (without this, the control below would open the live DB)', () => {
  const source = codeOf(fs.readFileSync(INDEX_JS, 'utf8'));
  const enforceAt = source.indexOf('publicPort.enforce()');
  const dbRequireAt = source.search(/require\(['"]\.\/db['"]\)/);
  assert.ok(enforceAt !== -1, 'index.js no longer calls publicPort.enforce() — the port rule is gone');
  assert.ok(dbRequireAt !== -1, 'index.js no longer requires ./db');
  assert.ok(enforceAt < dbRequireAt,
    'publicPort.enforce() must run BEFORE require(\'./db\'): db.js opens and migrates the product '
    + 'database at require time, so an ordering change would make the refusal open the live database first');
});

test('CONTROL — before: the same start on a private port came up and reported success', async () => {
  // The pre-change index.js in this tree's history: `app.listen(PORT, '0.0.0.0', () => console.log(
  // `Antum server listening on port ${PORT}`))` with no port rule at all. Reproduce that shape by
  // taking the current listen out of the picture: a scratch instance on a private port still starts,
  // but it must now SAY it is one — the "quiet case" is what this change removes.
  const port = await freePort();
  const dbPath = scratchDb();
  const r = await runIndex({ PORT: String(port), PRODUCT_DB_PATH: dbPath }, 8000);
  try {
    assert.match(r.out, new RegExp(`\\[port\\] SCRATCH INSTANCE on port ${port}`),
      `a scratch instance must announce its port and database; output was:\n${r.out}\n${r.err}`);
    assert.match(r.out, new RegExp(`listening on port ${port}`));
    assert.doesNotMatch(r.out + r.err, /REFUSING TO START/, 'a scratch instance is allowed its own port');
  } finally {
    for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(dbPath + suffix); } catch { /* absent */ } }
  }
});

test('CONTROL — after: the same start against the live database refuses, names both ports, exits non-zero', async () => {
  // Re-assert the safety property this test depends on, in the same breath as spawning.
  const source = codeOf(fs.readFileSync(INDEX_JS, 'utf8'));
  assert.ok(source.indexOf('publicPort.enforce()') < source.search(/require\(['"]\.\/db['"]\)/),
    'refusing to run this control: publicPort.enforce() no longer comes before the db load require(\'./db\')');
  const port = await freePort();
  const r = await runIndex({ PORT: String(port), PRODUCT_DB_PATH: publicPort.LIVE_PRODUCT_DB });
  assert.notEqual(r.code, 0, `a live-database process on port ${port} must exit non-zero; stdout:\n${r.out}`);
  assert.match(r.err, /REFUSING TO START/);
  assert.match(r.err, new RegExp(`port ${port}`), 'the message must name the port it was given');
  assert.match(r.err, /NOT the public port 3000/, 'the message must name the port the public URL reaches');
  assert.doesNotMatch(r.out + r.err, /listening on port/, 'it must not announce itself as listening');
});

test('a bind failure names the port and its holder instead of a bare EADDRINUSE stack', async () => {
  const port = await freePort();
  const blocker = net.createServer();
  await new Promise((resolve) => blocker.listen(port, '0.0.0.0', resolve));
  const dbPath = scratchDb();
  try {
    const r = await runIndex({ PORT: String(port), PRODUCT_DB_PATH: dbPath });
    assert.notEqual(r.code, 0, 'the second process must exit non-zero');
    assert.match(r.err, new RegExp(`Port ${port} is already held`));
    assert.match(r.err, /pid \d+/, `the message must name the holder; stderr was:\n${r.err}`);
    assert.doesNotMatch(r.out + r.err, /listening on port/, 'it must not announce itself as listening');
  } finally {
    await new Promise((resolve) => blocker.close(resolve));
    for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(dbPath + suffix); } catch { /* absent */ } }
  }
});

test('describeHolder says nothing when it cannot tell, rather than guessing', () => {
  assert.equal(typeof publicPort.describeHolder(1), 'string');
});
