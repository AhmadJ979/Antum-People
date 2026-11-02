'use strict';

/**
 * THE CALLER-ERROR CONTRACT — 400 for the caller's mistake, 500 only for ours.
 *
 * WHY THIS EXISTS (measured 2026-11-02): `POST /api/login` with `{}` answered **HTTP 500**. Nothing
 * about that request is the server's fault: the body is well-formed JSON, it simply does not carry
 * the two fields the route needs. The route destructured `username`/`password` out of it, passed
 * `undefined` to `bcrypt.compare`, and the throw landed in the route's own `catch`, which answers
 * `500 Internal Server Error` — the same status as a broken database. A caller told 500 has no way
 * to know the request was theirs to fix, and a dashboard counting 5xx counts a malformed probe as
 * an outage.
 *
 * The instance is one line to fix. The CLASS is the reason this file exists: every route in
 * `server/index.js` is enumerated from its own source and probed with input a caller gets wrong —
 * an empty body, a `null` body, an array body, malformed JSON, every body field with the wrong type,
 * an id that does not exist, an id segment that is absent, a nonsense query parameter. **No probe
 * may answer 5xx.** A future route that forgets to validate reddens here instead of shipping a 500.
 *
 * WHAT IS DELIBERATELY NOT ASSERTED, so this guard cannot be satisfied by widening a `catch`:
 *   * a probe MAY answer 2xx. A route that genuinely has nothing to validate (a GET with no
 *     parameters) is not a defect. The contract is about 5xx, not about refusing everything.
 *   * 401 and 403 keep their own meanings and are not touched here: a wrong password is 401, a
 *     refused origin and a policy refusal are 403 **with no body at all**. Those are asserted by
 *     `scripts/cors-error-contract-test.sh` and `server/access.test.js`; this file only requires that
 *     a caller-error probe never reaches 5xx and that a 400 SAYS WHAT WAS WRONG.
 *
 * HOW IT RUNS: it spawns THIS checkout's `server/index.js` on a free port with a throwaway database
 * (`PRODUCT_DB_PATH` under a temp dir), a throwaway JWT secret, and one signed token per role, so it
 * never touches the live deployment or the live database. The process is killed on exit.
 *
 * REPRODUCE THE CONTROL (a guard that cannot redden proves nothing): see
 * `docs/evidence/client-error-contract-2026-11-02/README.md` — it reintroduces the login 500 in a
 * scratch copy and shows this file failing there and passing on the fixed tree.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const access = require('./access');

const INDEX_JS = path.join(__dirname, 'index.js');
const JWT_SECRET = 'client-error-contract-secret-not-a-product-key';
const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

// -------------------------------------------------------------
// The rig: a server of our own, on a port of its own, on a database of its own.
// -------------------------------------------------------------

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

let child = null;
let base = '';
let tmpDir = '';
let serverLog = '';
/** A real employees row, created through the API, so a `:id` route is probed at its handler and not
 *  short-circuited by its 404. Without one, every body on `PUT /api/employees/:id` is unreachable
 *  and the guard would be reading a 404 for a probe it never delivered. */
let sampleEmployeeId = null;

function tokenFor(role) {
  return jwt.sign(
    { id: `probe-${role}`, username: `probe-${role}`, access_role: role },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

async function waitUntilUp(url, deadlineMs) {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(1500) });
      return true;
    } catch (err) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return false;
}

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'client-error-contract-'));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['index.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      JWT_SECRET,
      ENCRYPTION_KEY,
      PORT: String(port),
      PRODUCT_DB_PATH: path.join(tmpDir, 'probe.db'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { serverLog += d.toString(); });
  child.stderr.on('data', (d) => { serverLog += d.toString(); });
  const up = await waitUntilUp(`${base}/api/employees`, 30000);
  assert.ok(up, `the probe server did not come up on ${base}\n--- its log ---\n${serverLog}`);

  // One real row, so the `:id` routes are probed where they actually read a body.
  const created = await send('POST', `${base}/api/employees`, tokenFor('hr_admin'), {
    json: {
      first_name: 'Probe',
      last_name: 'Row',
      email: 'probe.row@example.test',
      department: 'Operations',
      role: 'Analyst',
      start_date: '2025-01-01',
      data_residency_country: 'AE',
      basic_salary: 10000,
      salary: 15000,
      national_id_type: 'emirates_id',
      national_id_value: '784-1990-1234567-1',
      visa_status: 'active',
    },
  });
  if (created.status === 201 && created.parsed && created.parsed.id) {
    sampleEmployeeId = created.parsed.id;
  } else {
    serverLog += `\n[rig] could not create a sample employee: ${created.status} ${created.text}`;
  }
});

after(() => {
  if (child) child.kill('SIGKILL');
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

// -------------------------------------------------------------
// Route enumeration — from the server's own source, so a route added tomorrow is probed today.
// -------------------------------------------------------------

function routesFromSource(source) {
  const routes = [];
  const re = /app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const method = m[1].toUpperCase();
    const routePath = m[2];
    // `app.get('*')` is the SPA fallback / unknown-API-route answer, not an API route of ours.
    if (routePath.includes('*')) continue;
    if (!routePath.startsWith('/api')) continue;
    routes.push({ method, path: routePath });
  }
  return routes;
}

/** Every field name the source reads out of a request body — derived, never a hand-kept list. */
function bodyFieldsFromSource(source) {
  const names = new Set();
  for (const m of source.matchAll(/req\.body\.([A-Za-z_][A-Za-z0-9_]*)/g)) names.add(m[1]);
  for (const m of source.matchAll(/req\.body\[\s*'([A-Za-z_][A-Za-z0-9_]*)'\s*\]/g)) names.add(m[1]);
  for (const m of source.matchAll(/const\s*\{([^}]*)\}\s*=\s*req\.body/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(':')[0].split('=')[0].trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) names.add(name);
    }
  }
  // `const data = req.body;` followed by `data.<field>` is this codebase's dominant shape.
  for (const m of source.matchAll(/\bdata\.([A-Za-z_][A-Za-z0-9_]*)/g)) names.add(m[1]);
  return [...names].sort();
}

/** The role a route's own policy cell admits first — so the probe reaches the handler, not the gate. */
function probeRoleFor(method, routePath) {
  const resource = access.resourceFor(method, routePath);
  if (!resource) return { role: null, resource: null };
  const allowed = access.POLICY[resource] || [];
  for (const role of allowed) {
    if (access.scopeFor(resource, role) !== null) return { role, resource };
  }
  return { role: null, resource };
}

// -------------------------------------------------------------
// Probes — input a caller gets wrong.
// -------------------------------------------------------------

function substitute(routePath, idValue) {
  return routePath.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, idValue);
}

function bodyProbes(fields) {
  const wrongArray = {};
  const wrongNumber = {};
  for (const f of fields) {
    wrongArray[f] = [];
    wrongNumber[f] = 12345;
  }
  return [
    { label: 'empty object body {}', json: {} },
    { label: 'JSON null body', json: null },
    { label: 'array body []', json: [] },
    { label: 'malformed JSON', raw: '{"first_name": ' },
    { label: `every body field an array (${fields.length} fields)`, json: wrongArray },
    { label: `every body field a number (${fields.length} fields)`, json: wrongNumber },
  ];
}

const ID_VALUES = ['no-such-id-0000', '1'];
const QUERY_PROBE = '?as_of=not-a-date&jurisdiction=%25%25&employee_id=no-such-id-0000&status=bogus&function=bogus';

async function send(method, url, token, probe) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (probe.raw !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = probe.raw;
  } else if (probe.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(probe.json);
  }
  const res = await fetch(url, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (err) { parsed = null; }
  return { status: res.status, text, parsed };
}

// -------------------------------------------------------------
// THE GUARD
// -------------------------------------------------------------

test('no caller-error probe against any API route answers 5xx, and every 400 says what was wrong', async (t) => {
  const source = fs.readFileSync(INDEX_JS, 'utf8');
  const routes = routesFromSource(source);
  const fields = bodyFieldsFromSource(source);

  // A guard that cannot see its subject is a false green, not a pass: if the enumeration or the
  // field derivation silently came back empty, this is RED.
  assert.ok(routes.length >= 20, `route enumeration found only ${routes.length} API routes — it is not reading index.js`);
  assert.ok(routes.some((r) => r.method === 'POST' && r.path === '/api/login'), 'route enumeration did not find POST /api/login');
  assert.ok(fields.length >= 10, `body-field derivation found only ${fields.length} fields — it is not reading index.js`);

  const rows = [];
  const fiveHundreds = [];
  const vagueFourHundreds = [];
  const unprobed = [];

  for (const route of routes) {
    const { role, resource } = probeRoleFor(route.method, route.path);
    const isPublic = route.path === '/api/login';
    const token = isPublic ? null : (role ? tokenFor(role) : null);
    if (!isPublic && !token) {
      unprobed.push(`${route.method} ${route.path} — no role in the policy may use ${resource}`);
      continue;
    }

    const probes = [];
    if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
      probes.push(...bodyProbes(fields));
    } else {
      probes.push({ label: 'no query parameters' });
      probes.push({ label: 'nonsense query parameters', query: QUERY_PROBE });
    }
    // Path/query probes: an id that does not exist, a numeric-looking id where an id is expected,
    // a REAL id (so the handler is reached and its body validation is exercised), and the id
    // segment removed altogether.
    const ids = ID_VALUES.map((v) => ({ label: `path id = ${JSON.stringify(v)}`, idValue: v }));
    if (sampleEmployeeId) ids.push({ label: 'path id = a real row', idValue: sampleEmployeeId });
    const idProbes = route.path.includes(':')
      ? ids.concat([{ label: 'id segment absent', dropId: true }])
      : [{ label: 'no path parameters' }];

    for (const idProbe of idProbes) {
      const routePath = idProbe.dropId
        ? route.path.replace(/\/:[A-Za-z_][A-Za-z0-9_]*/, '')
        : substitute(route.path, idProbe.idValue || 'no-such-id-0000');
      for (const probe of probes) {
        const url = `${base}${routePath}${probe.query || ''}`;
        let result;
        try {
          result = await send(route.method, url, token, probe);
        } catch (err) {
          // A dropped connection or a timeout is the server's failure, and it is a 5xx in spirit.
          result = { status: 599, text: `request failed: ${err.message}`, parsed: null };
        }
        const label = `${idProbe.label}; ${probe.label}`;
        rows.push({
          route: `${route.method} ${routePath}`,
          probe: label,
          status: result.status,
          body: result.text.slice(0, 160).replace(/\s+/g, ' '),
        });
        if (result.status >= 500) {
          fiveHundreds.push(`${route.method} ${routePath} | ${label} -> ${result.status} ${result.text.slice(0, 120)}`);
        }
        if (result.status === 400) {
          const message = result.parsed && typeof result.parsed.error === 'string' ? result.parsed.error : '';
          const vague = ['', 'Bad Request', 'Bad request', 'Internal Server Error'].includes(message);
          if (vague || message.length < 8) {
            vagueFourHundreds.push(`${route.method} ${routePath} | ${label} -> 400 with error=${JSON.stringify(message)}`);
          }
        }
      }
    }
  }

  // The before/after table. Printed on every run so a reviewer reads statuses, not a verdict.
  for (const row of rows) {
    t.diagnostic(`PROBE ${row.status}  ${row.route}  |  ${row.probe}  |  ${row.body}`);
  }
  t.diagnostic(`PROBED ${rows.length} requests across ${routes.length} enumerated routes; ${unprobed.length} route(s) unprobeable by any role`);
  for (const line of unprobed) t.diagnostic(`UNPROBED ${line}`);
  if (!sampleEmployeeId) t.diagnostic('UNPROBED the rig could not create a sample employees row, so :id routes were only probed at their 404');

  assert.deepStrictEqual(fiveHundreds, [],
    `${fiveHundreds.length} caller-error probe(s) answered 5xx — the caller's mistake is being reported as ours:\n${fiveHundreds.join('\n')}`);
  assert.deepStrictEqual(vagueFourHundreds, [],
    `${vagueFourHundreds.length} probe(s) answered 400 without saying what was wrong:\n${vagueFourHundreds.join('\n')}`);
});

// -------------------------------------------------------------
// THE ANCHORS — the semantics this change must NOT disturb.
// -------------------------------------------------------------

test('a wrong credential is still 401, and a missing one is still 401', async () => {
  const wrong = await send('POST', `${base}/api/login`, null, {
    json: { username: 'admin', password: 'definitely-not-the-password' },
  });
  assert.strictEqual(wrong.status, 401, `a wrong password must stay 401, got ${wrong.status}: ${wrong.text}`);
  assert.strictEqual(wrong.parsed && wrong.parsed.error, 'Invalid username or password');

  const noToken = await send('GET', `${base}/api/employees`, null, {});
  assert.strictEqual(noToken.status, 401, `a missing token must stay 401, got ${noToken.status}: ${noToken.text}`);
});

test('a policy refusal is still 403 with no body at all', async () => {
  // `employee` holds no cell for the roster: docs/access-model.md §6.1, and the refusal must carry
  // nothing a scoped caller could learn from.
  const res = await fetch(`${base}/api/employees`, {
    headers: { Authorization: `Bearer ${tokenFor('employee')}` },
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  assert.strictEqual(res.status, 403, `expected 403, got ${res.status}: ${text}`);
  assert.strictEqual(text, '', `a policy refusal must carry no body, got: ${text}`);
});

test('a valid request is untouched', async () => {
  const res = await fetch(`${base}/api/users`, {
    headers: { Authorization: `Bearer ${tokenFor('hr_admin')}` },
    signal: AbortSignal.timeout(10000),
  });
  assert.strictEqual(res.status, 200, `a valid GET /api/users must still be 200, got ${res.status}`);
  assert.ok(Array.isArray(JSON.parse(await res.text())), 'GET /api/users must still answer an array');
});

test('the instance that started this: an empty login body is refused 400 and names what is missing', async () => {
  const res = await send('POST', `${base}/api/login`, null, { json: {} });
  assert.strictEqual(res.status, 400, `POST /api/login with {} must be 400, got ${res.status}: ${res.text}`);
  assert.ok(res.parsed && typeof res.parsed.error === 'string', `the refusal must be JSON with an error message, got: ${res.text}`);
  assert.match(res.parsed.error, /username/, `the refusal must name the field, got: ${res.parsed.error}`);
  assert.match(res.parsed.error, /password/, `the refusal must name the field, got: ${res.parsed.error}`);
  assert.doesNotMatch(res.text, /at\s+\/|node_modules|\.js:\d+/, 'the refusal must not carry a stack trace');
});

test('malformed JSON is refused by the body parser, not by a route', async () => {
  const res = await send('POST', `${base}/api/login`, null, { raw: '{"username": ' });
  assert.strictEqual(res.status, 400, `malformed JSON must be 400, got ${res.status}: ${res.text}`);
  assert.ok(res.parsed && typeof res.parsed.error === 'string' && res.parsed.error.length >= 8,
    `malformed JSON must be refused with a message that says so, got: ${res.text}`);
});
