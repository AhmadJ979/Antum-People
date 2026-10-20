/**
 * Layer 3, slice 1 (decision 11) — the role is ENFORCED, the account path exists, and the tick
 * names the person who ticked it.
 *
 * WHAT THIS HOLDS, and why each case is here:
 *   * an unauthenticated caller is still 401 (authenticateToken, unchanged);
 *   * an authenticated caller whose role allows nothing is refused **403 with no body** — on a
 *     resource, on a different resource, and on a path that declares no resource at all (deny is
 *     the DEFAULT: an unknown route is refused, not left open and not a 404 that reveals the table);
 *   * a wrong password is still 401, and the login rate limit still answers 429;
 *   * accounts exist as plural rows created through an admin-authenticated path — and that path
 *     refuses a short password, a duplicate username, and a role the product does not know (a user
 *     whose role matches no policy cell could log in and do nothing);
 *   * the tick records the named actor and REFUSES an unnamed one with 400, which is what the
 *     pre-boarding side already does — so the two sides agree;
 *   * the policy table has no hole: every declared route maps to a cell, every cell names a known
 *     role, and every cell today allows `admin` only (today's behaviour written down, not widened).
 *
 * It runs a REAL server on a scratch port against a throwaway database, and it never touches the
 * live service, the live database or the live credential (WORKFLOW rules 5, 10, 14).
 *
 * `cd server && npm test`
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const access = require('./access');

const SCRATCH_DB = path.join(os.tmpdir(), `antum-access-${randomUUID()}.db`);
const PORT = 31000 + Math.floor(Math.random() * 20000);
const BASE = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = 'access-test-secret-not-a-production-key';
const ENCRYPTION_KEY = 'a'.repeat(32); // 32 bytes, as server/auth.js expects (it reads the string as utf8)
const ADMIN_NAME = 'slice1-admin';
const NO_ROLE_NAME = 'slice1-nobody';
const PASSWORD = 'scratch-instance-password-1';

let server;
const api = async (method, urlPath, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + urlPath, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let text = '';
  try { text = await res.text(); } catch { /* an empty body is a valid answer here */ }
  return { status: res.status, text, json: text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null };
};

before(async () => {
  // The database is built the way the product builds one — server/schema.sql — so a fresh database
  // and a migrated one are the same shape (server/column-migration.test.js holds that property).
  const db = new DatabaseSync(SCRATCH_DB);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const insertUser = db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)');
  insertUser.run(randomUUID(), ADMIN_NAME, bcrypt.hashSync(PASSWORD, 4), 'admin');
  // A person whose role matches NO policy cell. It cannot be created through the API (see the 400
  // case below), so it is inserted here for exactly one purpose: to be refused.
  insertUser.run(randomUUID(), NO_ROLE_NAME, bcrypt.hashSync(PASSWORD, 4), 'hr');
  db.prepare("INSERT INTO employees (id, first_name, last_name, email, start_date) VALUES ('scratch-emp', 'Scratch', 'Person', 'scratch@example.invalid', '2026-01-05')").run();
  db.prepare("INSERT INTO onboarding_tasks (id, employee_id, title, status) VALUES ('scratch-task-1', 'scratch-emp', 'The first day', 'pending')").run();
  db.prepare("INSERT INTO onboarding_tasks (id, employee_id, title, status) VALUES ('scratch-task-2', 'scratch-emp', 'The paperwork', 'pending')").run();
  db.close();

  server = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    env: { ...process.env, PORT: String(PORT), PRODUCT_DB_PATH: SCRATCH_DB, JWT_SECRET, ENCRYPTION_KEY },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});
  const deadline = Date.now() + 30000;
  for (;;) {
    try { await fetch(BASE + '/api/employees'); break; }
    catch { if (Date.now() > deadline) throw new Error('the scratch server never answered'); await new Promise((r) => setTimeout(r, 250)); }
  }
});

after(() => {
  if (server) server.kill('SIGKILL');
  for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(SCRATCH_DB + suffix); } catch { /* not there */ } }
});

describe('authentication: unchanged answers', () => {
  test('no token is 401 on a resource', async () => {
    const r = await api('GET', '/api/employees');
    assert.strictEqual(r.status, 401);
  });

  test('a wrong password is 401', async () => {
    const r = await api('POST', '/api/login', { body: { username: ADMIN_NAME, password: 'not-the-password-1' } });
    assert.strictEqual(r.status, 401);
  });

  test('a good login through the API still works — the token names the role', async () => {
    const r = await api('POST', '/api/login', { body: { username: ADMIN_NAME, password: PASSWORD } });
    assert.strictEqual(r.status, 200);
    assert.ok(r.json && r.json.token, 'a token comes back');
    assert.strictEqual(r.json.user.role, 'admin');
  });
});

describe('authorization: the role is enforced, deny-by-default', () => {
  let adminToken;
  let noRoleToken;
  before(async () => {
    adminToken = (await api('POST', '/api/login', { body: { username: ADMIN_NAME, password: PASSWORD } })).json.token;
    noRoleToken = (await api('POST', '/api/login', { body: { username: NO_ROLE_NAME, password: PASSWORD } })).json.token;
  });

  test('the seeded admin still reaches the roster (nothing was narrowed by this slice)', async () => {
    const r = await api('GET', '/api/employees', { token: adminToken });
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.json));
  });

  test('an authenticated caller whose role allows nothing is 403 on the roster', async () => {
    const r = await api('GET', '/api/employees', { token: noRoleToken });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.text, '', 'the refusal carries NO body — it tells the caller nothing');
  });

  test('and 403 on a different resource — the refusal is not one route', async () => {
    assert.strictEqual((await api('GET', '/api/analytics/dashboard', { token: noRoleToken })).status, 403);
    assert.strictEqual((await api('GET', '/api/users', { token: noRoleToken })).status, 403);
  });

  test('a path that declares NO resource is refused, not left open and not a 404', async () => {
    const r = await api('GET', '/api/nothing-declares-this', { token: adminToken });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.text, '');
  });

  test('a token with no username is still authorised by role, but cannot tick a task (below)', async () => {
    // The role check is the role check; the actor requirement is separate and is asserted in the
    // tick section. This case exists so the two are visibly different mechanisms.
    const nameless = jwt.sign({ id: 'scratch', role: 'admin' }, JWT_SECRET, { expiresIn: '5m' });
    assert.strictEqual((await api('GET', '/api/employees', { token: nameless })).status, 200);
  });
});

describe('accounts: plural rows through an admin-authenticated path', () => {
  let adminToken;
  let noRoleToken;
  before(async () => {
    adminToken = (await api('POST', '/api/login', { body: { username: ADMIN_NAME, password: PASSWORD } })).json.token;
    noRoleToken = (await api('POST', '/api/login', { body: { username: NO_ROLE_NAME, password: PASSWORD } })).json.token;
  });

  test('an admin creates a second account, and that account can log in', async () => {
    const created = await api('POST', '/api/users', { token: adminToken, body: { username: 'slice1-second', password: 'second-account-password', role: 'admin' } });
    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.json.username, 'slice1-second');
    const login = await api('POST', '/api/login', { body: { username: 'slice1-second', password: 'second-account-password' } });
    assert.strictEqual(login.status, 200);
    assert.ok(login.json.token);
  });

  test('the roster of accounts is a list, and it does not leak a password hash', async () => {
    const r = await api('GET', '/api/users', { token: adminToken });
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.json) && r.json.length >= 3);
    assert.ok(!('password_hash' in r.json[0]), 'the account list carries no password material');
  });

  // Slice 2, prerequisite 3: before this the route wrote no audit row, so creating an account was
  // unattributable. These two cases are a pair on purpose — the second is the anti-vacuous control
  // for the first: if a REFUSED creation also wrote a row, the first case would prove nothing.
  const userAuditRows = () => {
    const db = new DatabaseSync(SCRATCH_DB);
    const rows = db.prepare("SELECT * FROM audit_logs WHERE entity_type = 'user'").all();
    db.close();
    return rows;
  };

  test('creating an account writes an audit row naming the REAL actor, never a placeholder', async () => {
    const created = await api('POST', '/api/users', { token: adminToken, body: { username: 'slice2-audited', password: 'audited-account-password', role: 'admin' } });
    assert.strictEqual(created.status, 201);
    const rows = userAuditRows().filter((row) => row.entity_id === created.json.id);
    assert.strictEqual(rows.length, 1, 'exactly one audit row for the account that was created');
    assert.strictEqual(rows[0].action, 'CREATE');
    assert.strictEqual(rows[0].performed_by, ADMIN_NAME, 'the row names the authenticated signer');
    assert.notStrictEqual(rows[0].performed_by, 'system',
      'and never the literal the two employee write paths put in this column');
    // The row says what was created — and carries no credential material.
    assert.deepStrictEqual(JSON.parse(rows[0].new_values), { username: 'slice2-audited', role: 'admin' });
    assert.ok(!JSON.stringify(rows[0]).includes('audited-account-password'), 'the password is not in the row');
    assert.ok(!JSON.stringify(rows[0]).includes('$2'), 'and neither is the hash');
  });

  test('a REFUSED creation writes no audit row — so the case above is not a vacuous green', async () => {
    const before = userAuditRows().length;
    const refused = await api('POST', '/api/users', { token: adminToken, body: { username: ADMIN_NAME, password: 'another-password-here', role: 'admin' } });
    assert.strictEqual(refused.status, 409);
    const forbidden = await api('POST', '/api/users', { token: noRoleToken, body: { username: 'slice2-refused', password: 'long-enough-password', role: 'admin' } });
    assert.strictEqual(forbidden.status, 403);
    assert.strictEqual(userAuditRows().length, before, 'a 409 and a 403 leave the log exactly as it was');
  });

  test('a duplicate username is refused 409 rather than shadowing the first account', async () => {
    const r = await api('POST', '/api/users', { token: adminToken, body: { username: ADMIN_NAME, password: 'another-password-here', role: 'admin' } });
    assert.strictEqual(r.status, 409);
  });

  test('a short password is refused 400', async () => {
    const r = await api('POST', '/api/users', { token: adminToken, body: { username: 'slice1-short', password: 'short', role: 'admin' } });
    assert.strictEqual(r.status, 400);
  });

  test('a role this product does not know is refused 400 — a user who matches no cell can do nothing', async () => {
    const r = await api('POST', '/api/users', { token: adminToken, body: { username: 'slice1-unknown-role', password: 'long-enough-password', role: 'wizard' } });
    assert.strictEqual(r.status, 400);
    assert.deepStrictEqual(r.json.known_roles, access.ROLE_LIST);
  });

  test('a caller whose role allows nothing cannot create an account (403)', async () => {
    const r = await api('POST', '/api/users', { token: noRoleToken, body: { username: 'slice1-not-allowed', password: 'long-enough-password', role: 'admin' } });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.text, '');
  });
});

describe('the tick names the person who ticked it (decision 22)', () => {
  let adminToken;
  const read = (id, column) => {
    const db = new DatabaseSync(SCRATCH_DB);
    const row = db.prepare(`SELECT ${column} FROM onboarding_tasks WHERE id = ?`).get(id);
    db.close();
    return row ? row[column] : undefined;
  };

  before(async () => {
    adminToken = (await api('POST', '/api/login', { body: { username: ADMIN_NAME, password: PASSWORD } })).json.token;
  });

  test('completing a task records the named actor beside the date', async () => {
    const r = await api('PUT', '/api/onboarding-tasks/scratch-task-1', { token: adminToken, body: { status: 'completed' } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.completed_by, ADMIN_NAME, 'the response names the actor');
    assert.strictEqual(read('scratch-task-1', 'completed_by'), ADMIN_NAME, 'and the ROW records it');
    assert.ok(read('scratch-task-1', 'completed_at'), 'with the date it already recorded');
  });

  test('an UNNAMED actor is refused 400, and the row is left untouched', async () => {
    const nameless = jwt.sign({ id: 'scratch', role: 'admin' }, JWT_SECRET, { expiresIn: '5m' });
    const r = await api('PUT', '/api/onboarding-tasks/scratch-task-2', { token: nameless, body: { status: 'completed' } });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(read('scratch-task-2', 'completed_by'), null, 'nothing was recorded for nobody');
    assert.strictEqual(read('scratch-task-2', 'completed_at'), null);
    assert.strictEqual(read('scratch-task-2', 'status'), 'pending');
  });

  test('an unnamed actor may still mark a task pending — the refusal is about claiming work was done', async () => {
    const nameless = jwt.sign({ id: 'scratch', role: 'admin' }, JWT_SECRET, { expiresIn: '5m' });
    const r = await api('PUT', '/api/onboarding-tasks/scratch-task-2', { token: nameless, body: { status: 'pending' } });
    assert.strictEqual(r.status, 200);
  });
});

describe('the policy table itself', () => {
  test('no declared route lacks a policy cell', () => {
    assert.deepStrictEqual(access.unpoliciedRoutes(), []);
  });

  test('no policy cell names a role this product does not know', () => {
    assert.deepStrictEqual(access.unknownRolesInPolicy(), []);
  });

  test("today's policy allows admin only, explicitly — nothing silently widened", () => {
    for (const [resource, roles] of Object.entries(access.POLICY)) {
      assert.deepStrictEqual(roles, ['admin'], `${resource} must encode today's behaviour`);
    }
  });

  test('the resource for a route is looked up by method and path, not by a guess', () => {
    assert.strictEqual(access.resourceFor('GET', '/api/employees'), 'employees:read');
    assert.strictEqual(access.resourceFor('PUT', '/api/onboarding-tasks/abc'), 'onboarding:write');
    assert.strictEqual(access.resourceFor('GET', '/api/preboarding/cases/abc/workspace'), 'preboarding:read:own');
    assert.strictEqual(access.resourceFor('GET', '/api/nothing-declares-this'), null);
  });
});

describe('the pre-boarding read split (slice 2, prerequisite 2)', () => {
  // WHY: `preboarding:read` was ONE cell over SEVEN routes, so a grant for a person's own case would
  // have carried the company-wide list, the roll-up and the flag watch. The access ruling gives a
  // person their own record and denies those three for ever (docs/access-model.md §1.1, §3.2), so the
  // resource is split. The cells stay [admin]: this makes the ruling WRITABLE, it widens nobody.
  const routesFor = (resource) =>
    access.ROUTES.filter(([, , r]) => r === resource).map(([method, pattern]) => `${method} ${pattern}`);

  test('the company-wide reads and the own-case reads are different resources', () => {
    // The three that span the company — the ruling denies these to the own-record reader.
    assert.strictEqual(access.resourceFor('GET', '/api/preboarding/cases'), 'preboarding:read');
    assert.strictEqual(access.resourceFor('GET', '/api/preboarding/checklist/overview'), 'preboarding:read');
    assert.strictEqual(access.resourceFor('GET', '/api/preboarding/flag-watch'), 'preboarding:read');
    // The own-case shape: the case, its checklist, its workspace, its package.
    for (const path of ['/api/preboarding/cases/abc', '/api/preboarding/cases/abc/checklist',
      '/api/preboarding/cases/abc/workspace', '/api/preboarding/cases/abc/package']) {
      assert.strictEqual(access.resourceFor('GET', path), 'preboarding:read:own', path);
    }
  });

  test('the two cells cover disjoint route sets — an own grant cannot carry the company-wide reads', () => {
    // Enumerated from ROUTES, not retyped, so a route moved back into the coarse cell reddens this.
    const companyWide = routesFor('preboarding:read').sort();
    const own = routesFor('preboarding:read:own');
    assert.deepStrictEqual(companyWide,
      ['GET /preboarding/cases', 'GET /preboarding/checklist/overview', 'GET /preboarding/flag-watch'],
      'the company-wide cell is the list, the roll-up and the flag watch — and nothing else');
    assert.deepStrictEqual(own.sort(),
      ['GET /preboarding/cases/:id', 'GET /preboarding/cases/:id/checklist',
        'GET /preboarding/cases/:id/package', 'GET /preboarding/cases/:id/workspace'],
      'the own cell is the four single-case reads');
    for (const route of own) {
      assert.ok(companyWide.indexOf(route) === -1, `${route} must not also be a company-wide read`);
    }
  });

  test('both cells still allow admin only, so the split widened nobody', () => {
    assert.deepStrictEqual(access.POLICY['preboarding:read'], ['admin']);
    assert.deepStrictEqual(access.POLICY['preboarding:read:own'], ['admin']);
    // And the split is a split, not a rename: the company-wide cell still exists under its old name.
    assert.ok(Object.prototype.hasOwnProperty.call(access.POLICY, 'preboarding:read'));
  });

  test('the write side is untouched by this change — preboarding:write still covers five routes', () => {
    // Stated as a check because the row scoped it out: the read split must not have moved a write.
    assert.strictEqual(routesFor('preboarding:write').length, 5);
  });
});

describe('the login rate limit still answers 429', () => {
  // The limiter is 25 failed attempts per IP per 60 seconds (index.js:25 failures per minute,
  // success resets the bucket) — so the burst has to EXCEED that number or the case proves nothing:
  // the first version sent 15 and passed the 401 branch forever, which is a check that could not
  // redden. It sends the limit + 5 and asserts the limiter's own answer.
  test('a burst past the limiter (25 per minute) is answered 429', async () => {
    const LIMIT = 25;
    let sawTooMany = false;
    let lastStatus = 0;
    for (let i = 0; i < LIMIT + 5 && !sawTooMany; i++) {
      const r = await api('POST', '/api/login', { body: { username: ADMIN_NAME, password: `wrong-${i}-password` } });
      lastStatus = r.status;
      if (r.status === 429) sawTooMany = true;
      else assert.strictEqual(r.status, 401, 'before the limit the answer is still 401');
    }
    assert.ok(sawTooMany, `the limiter must answer 429 within ${LIMIT + 5} attempts (last status ${lastStatus})`);
  });
});
