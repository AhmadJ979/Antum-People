// Pinned ABOVE every require: server/live-db-guard.test.js fails any test file that could reach the
// live product database without pinning a throwaway path first, and a pin below the requires is too
// late in the general case. This suite never opens a database in-process (it spawns), so the pin costs
// nothing and keeps the guard's rule satisfied by construction rather than by argument.
process.env.PRODUCT_DB_PATH = `${require('node:os').tmpdir()}/antum-public-gate-guard-${process.pid}.db`;

/**
 * THE PUBLIC GATE — the invariant, asserted rather than described.
 *
 * The owner ruled that the product must not be reachable by a stranger, and the platform proxies
 * port 3000, so the gate lives in `server/public-gate.js` and this file is what makes its claims
 * checkable. Each test below is one clause of the brief:
 *
 *   no cookie -> the gate page, and nothing of the product: no `<script>`, no `#root`, no
 *                `assets/index-*`, and the body is NOT `client/dist/index.html`;
 *   no cookie -> `/api/employees` refused exactly as it is refused today (401 with the same body),
 *                never a 500 — the keep-alive guard judges the product healthy by those bytes;
 *   no cookie -> an asset under `client/dist` is not served, although the path exists;
 *   a forged, truncated, tampered, future-dated or expired cookie -> the gate page;
 *   a wrong passcode -> the SAME generic page whatever was sent, and no oracle about the file;
 *   25 failures in 60 s from one address -> 429 with that same page;
 *   the correct passcode -> a signed HttpOnly cookie, and then the shell BYTE-IDENTICAL to
 *                `client/dist/index.html`, the asset served from disk, and the admin login still
 *                there as the second layer;
 *   the passcode file missing -> 503 and no shell, with the missing file named in the log.
 *
 * HOW IT RUNS: three rigs of its own — each with its own port, its own throwaway database, its own
 * throwaway passcode and signing key — so it never touches the live deployment, the live database or
 * the host's own gate files. The passcode is generated at run time and never printed.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const gate = require('./public-gate');

const TREE = path.join(__dirname, '..');
const INDEX_JS = path.join(__dirname, 'index.js');
const DIST_INDEX = path.join(TREE, 'client/dist/index.html');
const JWT_SECRET = 'public-gate-test-secret-not-a-product-key';
const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

// The passcode this run uses. Random per run, never written to the repository and never printed.
const PASSCODE = crypto.randomBytes(18).toString('base64url');

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.unref();
  srv.once('error', reject);
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address();
    srv.close(() => resolve(port));
  });
});

let tmpRoot;
let passcodeHash;

/** One server of our own. `configured: false` points it at files that do not exist. */
async function startRig({ configured }) {
  const dir = fs.mkdtempSync(path.join(tmpRoot, configured ? 'on-' : 'off-'));
  const passcodeFile = path.join(dir, 'passcode');
  const secretFile = path.join(dir, 'secret');
  if (configured) {
    fs.writeFileSync(passcodeFile, passcodeHash, { mode: 0o600 });
    fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  const port = await freePort();
  const child = spawn(process.execPath, [INDEX_JS], {
    cwd: __dirname,
    env: {
      ...process.env,
      JWT_SECRET,
      ENCRYPTION_KEY,
      PORT: String(port),
      PRODUCT_DB_PATH: path.join(dir, 'product.db'),
      ANTUM_GATE_PASSCODE_FILE: passcodeFile,
      ANTUM_GATE_SECRET_FILE: secretFile,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const rig = { dir, port, child, log: '', base: `http://127.0.0.1:${port}` };
  child.stdout.on('data', (d) => { rig.log += d.toString(); });
  child.stderr.on('data', (d) => { rig.log += d.toString(); });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      await fetch(`${rig.base}/gate`, { signal: AbortSignal.timeout(1000) });
      return rig;
    } catch (err) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  child.kill('SIGKILL');
  throw new Error(`the gate rig did not come up on ${rig.base}\n--- its log ---\n${rig.log}`);
}

let rig;        // configured: the gate is on, the passcode is known
let unconfigured; // the passcode file does not exist
let limiter;    // its own rig, because failures accumulate per address

before(async () => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'antum-public-gate-'));
  passcodeHash = bcrypt.hashSync(PASSCODE, 12);
  [rig, unconfigured, limiter] = await Promise.all([
    startRig({ configured: true }),
    startRig({ configured: false }),
    startRig({ configured: true }),
  ]);
});

after(() => {
  for (const r of [rig, unconfigured, limiter]) if (r && r.child) r.child.kill('SIGKILL');
  if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// -------------------------------------------------------------
// helpers
// -------------------------------------------------------------

async function get(base, pathname, headers = {}) {
  const res = await fetch(`${base}${pathname}`, { headers, redirect: 'manual', signal: AbortSignal.timeout(10000) });
  const body = await res.text();
  return { status: res.status, body, headers: res.headers };
}

async function postPasscode(base, value, headers = {}) {
  const res = await fetch(`${base}/gate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams({ passcode: value }).toString(),
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  return { status: res.status, body: await res.text(), headers: res.headers };
}

/** The asset `client/dist/index.html` itself names — derived, never a hand-kept filename. */
function builtAssetPath() {
  if (!fs.existsSync(DIST_INDEX)) return null;
  const html = fs.readFileSync(DIST_INDEX, 'utf8');
  const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  return m ? m[1] : null;
}

const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

/** Everything the gate page must never carry. */
function assertNothingOfTheProduct(body, where) {
  assert.ok(!/<script/i.test(body), `${where}: the body carries a <script> tag`);
  assert.ok(!/id="root"/.test(body), `${where}: the body carries the app's #root`);
  assert.ok(!/assets\/index-/.test(body), `${where}: the body names the bundle`);
  assert.ok(!/\/api\//.test(body), `${where}: the body hints at an API route`);
  assert.ok(!/antum_gate/i.test(body), `${where}: the body names the cookie`);
}

// -------------------------------------------------------------
// 1. no cookie: the gate page, and nothing of the product
// -------------------------------------------------------------

test('a request with no cookie gets the gate page and no shell', async () => {
  const res = await get(rig.base, '/');
  assert.strictEqual(res.status, 200, 'the gate page is a page a visitor is meant to see');
  assert.match(res.body, /<title>Antum People — access<\/title>/);
  assert.strictEqual((res.body.match(/<input/gi) || []).length, 1, 'exactly one input');
  assert.strictEqual((res.body.match(/<button/gi) || []).length, 1, 'exactly one submit');
  assert.match(res.body, /method="post"/i);
  assertNothingOfTheProduct(res.body, 'GET / without a cookie');
  assert.strictEqual(res.headers.get('cache-control'), 'no-store');
  if (fs.existsSync(DIST_INDEX)) {
    assert.notStrictEqual(res.body, fs.readFileSync(DIST_INDEX, 'utf8'),
      'the gate page must not be the built shell');
  }
});

test('a deep link with no cookie gets the gate page, not the SPA catch-all', async () => {
  const res = await get(rig.base, '/dashboard/anything');
  assert.strictEqual(res.status, 200);
  assertNothingOfTheProduct(res.body, 'GET /dashboard/anything without a cookie');
  assert.match(res.body, /Enter the passcode/);
});

test('an asset under client/dist is not served without a cookie', async (t) => {
  const assetPath = builtAssetPath();
  if (!assetPath) return t.skip('client/dist/index.html is not built in this tree — there is no asset to ask for');
  const onDisk = fs.readFileSync(path.join(TREE, 'client/dist', assetPath.replace(/^\//, '')));
  const res = await get(rig.base, assetPath);
  assert.strictEqual(res.status, 200, 'the SPA catch-all answers 200 for a missing asset — this is not a 404 test');
  assert.notStrictEqual(Buffer.from(res.body).length, onDisk.length, 'the bundle was served without a cookie');
  assert.ok(!res.body.includes(onDisk.toString('utf8').slice(0, 200)), 'the bundle bytes were served without a cookie');
  assertNothingOfTheProduct(res.body, `GET ${assetPath} without a cookie`);
});

// -------------------------------------------------------------
// 2. no cookie: the API is refused exactly as it is refused today
// -------------------------------------------------------------

test('without a cookie /api/employees is refused exactly as it is refused today — a 401, never a 500', async () => {
  const res = await get(rig.base, '/api/employees');
  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body, JSON.stringify(gate.API_REFUSAL));
  assert.strictEqual(res.body, '{"error":"Authentication token required"}',
    'the keep-alive guard greps for these exact bytes (scripts/keep-alive.sh check_health)');
  // The same refusal the token middleware itself gives, so the two cannot drift apart.
  assert.strictEqual(res.body, JSON.stringify({ error: 'Authentication token required' }));
});

test('without a cookie the login endpoint is refused too — the gate is the first layer, not a bypass', async () => {
  const res = await fetch(`${rig.base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'anything' }),
    signal: AbortSignal.timeout(10000),
  });
  assert.strictEqual(res.status, 401);
  assert.strictEqual(await res.text(), JSON.stringify(gate.API_REFUSAL));
});

// -------------------------------------------------------------
// 3. forged / garbage cookies
// -------------------------------------------------------------

test('a forged, truncated, tampered, future-dated or expired cookie gets the gate page', async () => {
  const secret = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const good = gate.makeCookieValue(secret, now);
  const [version, stamp, mac] = good.split('.');
  const forged = [
    'garbage',
    'v1.1.deadbeef',
    `${version}.${stamp}`,
    `${version}.${stamp}.${mac.slice(0, -2)}`,                       // truncated mac
    `${version}.${stamp}.${mac.slice(0, -1)}${mac.endsWith('A') ? 'B' : 'A'}`, // one character changed
    `${version}.${Number(stamp) + 1}.${mac}`,                       // stamp moved under the mac
    gate.makeCookieValue(crypto.randomBytes(32).toString('hex'), now), // right shape, wrong key
    gate.makeCookieValue(secret, now + 10 * 60 * 1000),             // issued in the future
    gate.makeCookieValue(secret, now - gate.COOKIE_MAX_AGE_MS - 1000), // past its window
  ];
  for (const value of forged) {
    const res = await get(rig.base, '/', { Cookie: `${gate.COOKIE_NAME}=${value}` });
    assert.strictEqual(res.status, 200, `${value} was not refused`);
    assertNothingOfTheProduct(res.body, `forged cookie ${value}`);
    assert.match(res.body, /Enter the passcode/, `${value} did not get the gate page`);
  }
});

test('a cookie signed with THIS server’s own key is what the gate accepts — the check is not vacuous', async () => {
  // The control for the test above: the same construction, with the secret this rig actually holds,
  // must open the gate. Without this, "every forged cookie is refused" could be satisfied by a gate
  // that refuses every cookie.
  const secretFile = path.join(rig.dir, 'secret');
  const header = gate.mintCookieHeader(secretFile);
  const res = await get(rig.base, '/', { Cookie: header });
  assert.strictEqual(res.status, 200);
  assert.doesNotMatch(res.body, /Enter the passcode/, 'a validly minted cookie was refused');
  if (fs.existsSync(DIST_INDEX)) {
    assert.strictEqual(res.body, fs.readFileSync(DIST_INDEX, 'utf8'), 'a valid cookie must get the shell itself');
  }
});

// -------------------------------------------------------------
// 4. the passcode
// -------------------------------------------------------------

test('a wrong passcode gets the same generic gate page every time, and says nothing about the file', async () => {
  const first = await postPasscode(rig.base, 'definitely-not-the-passcode');
  const second = await postPasscode(rig.base, 'another-wrong-one');
  const empty = await postPasscode(rig.base, '');
  assert.strictEqual(first.status, 401);
  assert.strictEqual(first.body, second.body, 'two different wrong passcodes answered differently');
  assert.strictEqual(first.body, empty.body, 'an empty passcode answered differently from a wrong one');
  assert.strictEqual(first.headers.get('set-cookie'), null, 'a failed attempt must not set a cookie');
  assert.match(first.body, new RegExp(gate.NOTICE_REJECTED.replace(/[.]/g, '\\.')));
  assertNothingOfTheProduct(first.body, 'a wrong passcode');
  // Nothing about the file it compared against can appear in the answer.
  assert.ok(!first.body.includes(rig.dir), 'the response named a path on the host');
  assert.ok(!/\$2[aby]\$/.test(first.body), 'the response leaked a hash');
});

test('25 failures in 60 s from one address answer 429 with that same page', async () => {
  // One real wrong passcode (a bcrypt compare), then empty submissions: both are failures, and the
  // point of this test is the limiter, not the hash.
  let last;
  const seen = [];
  for (let i = 0; i < gate.FAILURE_LIMIT + 1; i += 1) {
    last = await postPasscode(limiter.base, i === 0 ? 'not-the-passcode' : '');
    seen.push(last.status);
  }
  assert.deepStrictEqual(seen.slice(0, gate.FAILURE_LIMIT), Array(gate.FAILURE_LIMIT).fill(401),
    'the first 25 failures must each be a 401');
  assert.strictEqual(last.status, 429, `the ${gate.FAILURE_LIMIT + 1}th failure must be refused by the limiter`);
  assert.strictEqual(last.headers.get('set-cookie'), null);
  assertNothingOfTheProduct(last.body, 'a rate-limited attempt');
  const wrong = await postPasscode(rig.base, 'still-not-the-passcode');
  assert.strictEqual(last.body, wrong.body, 'the 429 body must be the same page as a wrong-passcode body');
});

test('the correct passcode sets a signed HttpOnly cookie and then the product behaves exactly as before', async () => {
  const res = await postPasscode(rig.base, PASSCODE);
  assert.strictEqual(res.status, 303, 'a correct passcode redirects to the product');
  assert.strictEqual(res.headers.get('location'), '/');
  const setCookie = res.headers.get('set-cookie') || '';
  assert.match(setCookie, new RegExp(`^${gate.COOKIE_NAME}=v1\\.`));
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, new RegExp(`Max-Age=${gate.COOKIE_MAX_AGE_SECONDS}`));
  assert.ok(gate.COOKIE_MAX_AGE_SECONDS >= 30 * 24 * 60 * 60, 'the owner should not be re-prompted every visit');

  const cookie = cookieOf(res);

  // The shell, byte for byte.
  const shell = await get(rig.base, '/', { Cookie: cookie });
  assert.strictEqual(shell.status, 200);
  if (!fs.existsSync(DIST_INDEX)) {
    assert.ok(shell.body.length > 0);
  } else {
    const onDisk = fs.readFileSync(DIST_INDEX, 'utf8');
    assert.strictEqual(shell.body, onDisk,
      'the served shell must be client/dist/index.html itself — the provenance guard asks exactly this');
  }

  // The asset, from disk.
  const assetPath = builtAssetPath();
  if (assetPath) {
    const asset = await get(rig.base, assetPath, { Cookie: cookie });
    assert.strictEqual(asset.status, 200);
    assert.strictEqual(Buffer.from(asset.body).length,
      fs.statSync(path.join(TREE, 'client/dist', assetPath.replace(/^\//, ''))).size);
  }

  // The second layer is untouched: an authenticated-for-the-gate caller without a JWT is still
  // refused by the token middleware with the API's own words.
  const api = await get(rig.base, '/api/employees', { Cookie: cookie });
  assert.strictEqual(api.status, 401);
  assert.strictEqual(api.body, JSON.stringify(gate.API_REFUSAL));

  // And the admin login is still a login: a wrong password is answered by the LOGIN route
  // ("Invalid username or password"), not by the gate — which is how we know the gate opened.
  const login = await fetch(`${rig.base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ username: 'admin', password: 'definitely-not-the-admin-password' }),
    signal: AbortSignal.timeout(20000),
  });
  assert.strictEqual(login.status, 401);
  assert.strictEqual(await login.text(), '{"error":"Invalid username or password"}',
    'the login route must be reached once the gate is open');
});

test('logout clears the cookie and the product is closed again', async () => {
  const opened = await postPasscode(rig.base, PASSCODE);
  const cookie = cookieOf(opened);
  const out = await get(rig.base, '/gate/logout', { Cookie: cookie });
  assert.strictEqual(out.status, 303);
  const cleared = out.headers.get('set-cookie') || '';
  assert.match(cleared, new RegExp(`^${gate.COOKIE_NAME}=;`));
  assert.match(cleared, /Max-Age=0/);
  // The old cookie is a valid signature but the browser no longer sends it; the gate page is what a
  // caller without it gets, and this asserts the page rather than trusting the Set-Cookie alone.
  const after = await get(rig.base, '/');
  assert.match(after.body, /Enter the passcode/);
});

// -------------------------------------------------------------
// 5. fail closed
// -------------------------------------------------------------

test('with the passcode file missing the server answers 503, serves no shell, and names the file in its log', async () => {
  const res = await get(unconfigured.base, '/');
  assert.strictEqual(res.status, 503, 'a gate that cannot be passed must not serve the product');
  assertNothingOfTheProduct(res.body, 'GET / with the passcode file missing');
  assert.match(res.body, new RegExp(gate.NOTICE_UNAVAILABLE.replace(/[.]/g, '\\.')));
  if (fs.existsSync(DIST_INDEX)) {
    assert.notStrictEqual(res.body, fs.readFileSync(DIST_INDEX, 'utf8'));
  }

  const assetPath = builtAssetPath();
  if (assetPath) {
    const asset = await get(unconfigured.base, assetPath);
    assert.strictEqual(asset.status, 503);
    assertNothingOfTheProduct(asset.body, 'an asset with the passcode file missing');
  }

  // The API falls back to the refusal it has always given — the token middleware's own 401, byte for
  // byte the same as the gated answer, because a refusal carries no data and because the keep-alive
  // guard judges the product healthy by exactly these bytes (a 503 here would put the guard into a
  // kill/restart loop against a state no restart can repair). Asserted as BYTES, so "unchanged" is
  // measured rather than asserted by description.
  const api = await get(unconfigured.base, '/api/employees');
  assert.strictEqual(api.status, 401);
  assert.strictEqual(api.body, JSON.stringify(gate.API_REFUSAL));
  // And a route that has an answer of its own still gives it, which is what "unchanged" means.
  const login = await fetch(`${unconfigured.base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'definitely-not-the-admin-password' }),
    signal: AbortSignal.timeout(20000),
  });
  assert.strictEqual(login.status, 401);
  assert.strictEqual(await login.text(), '{"error":"Invalid username or password"}');

  // The log names the missing file — the operator's first move, and the only place the state is said.
  assert.match(unconfigured.log, /\[gate\] NOT CONFIGURED/);
  assert.ok(unconfigured.log.includes(path.join(unconfigured.dir, 'passcode')),
    `the log did not name the missing file\n--- the log ---\n${unconfigured.log}`);
  assert.match(unconfigured.log, /is missing/);
  // And it never names a credential.
  assert.ok(!/\$2[aby]\$/.test(unconfigured.log), 'the log carried a hash');
});

test('a passcode file that is present but empty is also refused, not fallen through', async () => {
  const dir = fs.mkdtempSync(path.join(tmpRoot, 'empty-'));
  const passcodeFile = path.join(dir, 'passcode');
  const secretFile = path.join(dir, 'secret');
  fs.writeFileSync(passcodeFile, '', { mode: 0o600 });
  fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  const config = gate.readConfig({ passcodeFile, secretFile, log: () => {} });
  assert.strictEqual(config.configured, false);
  assert.strictEqual(config.file, passcodeFile);
  assert.match(config.problem, /is empty/);
});

// -------------------------------------------------------------
// 6. the cookie primitives, without a server
// -------------------------------------------------------------

test('the cookie signature is the only thing that opens the gate', () => {
  const secret = crypto.randomBytes(32).toString('hex');
  const other = crypto.randomBytes(32).toString('hex');
  const value = gate.makeCookieValue(secret, 1_700_000_000_000);
  assert.strictEqual(gate.verifyCookieValue(secret, value, 1_700_000_000_500), true);
  assert.strictEqual(gate.verifyCookieValue(other, value, 1_700_000_000_500), false);
  assert.strictEqual(gate.verifyCookieValue(secret, '', 1_700_000_000_500), false);
  assert.strictEqual(gate.verifyCookieValue(secret, undefined, 1_700_000_000_500), false);
  assert.strictEqual(gate.verifyCookieValue(secret, 'v2.1.x', 1_700_000_000_500), false);
  // Exactly at the window's edge, still inside; one millisecond past it, out.
  assert.strictEqual(gate.verifyCookieValue(secret, value, 1_700_000_000_000 + gate.COOKIE_MAX_AGE_MS), true);
  assert.strictEqual(gate.verifyCookieValue(secret, value, 1_700_000_000_000 + gate.COOKIE_MAX_AGE_MS + 1), false);
});
