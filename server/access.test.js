/**
 * Layer 3, slices 1–2 (decision 11) — the role is ENFORCED, the cells are the access model's matrix,
 * the scope checks hold the per-row half, and every write names a person.
 *
 * WHAT THIS HOLDS, and why each case is here:
 *   * an unauthenticated caller is still 401, and an authenticated caller whose role allows nothing is
 *     refused **403 with no body** — on a resource, on another, and on a path that declares none
 *     (deny is the DEFAULT: an unknown route is refused, not left open and not a 404 that reveals it);
 *   * every cell of `POLICY` is the matrix `docs/access-model.md` §3 declares — asserted as ROLES,
 *     resource by resource, and asserted to be exactly the set of resources that exist, so a cell
 *     added without a decision reddens as well as one that was widened;
 *   * the five named refusal cases of §6 are reachable as refusals, not as prose;
 *   * the per-row half: a manager reads their own reporting line and not the company, an employee
 *     reads their own record and nobody else's — and the positive controls are here too, because a
 *     "removed" or "refused" assertion on its own can be vacuous;
 *   * the field half: the roster serves a manager no pay and no national ID, finance no national ID,
 *     and HR the row as it has always been served (the positive control that the columns exist);
 *   * `⊘` is not flattened into `✖`: the cells this product still cannot express are recorded with the
 *     missing link named, and asserted to be neither granted nor denied-by-policy;
 *   * the rename (§2.4): `users.role` no longer exists, the old value is not a role, and the login
 *     payload carries `access_role`;
 *   * the account → person link: refused when it names no employee, refused when that employee already
 *     has an account, and held by the database (the partial unique index), not by the route alone;
 *   * every write path names the signed-in actor: the two employee paths used to write the literal
 *     'system' into a column that holds a person's name, and an unnamed token is now refused (400);
 *     the exit-interview path — which terminates a row, and so moves the Layer 4 replacement-cost flag —
 *     wrote no audit row at all until row f2e68a04, so a row could be ended with nobody's name on it.
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

// The fixture's people. The reporting line is what the manager's scope resolves against:
//   scope-boss  ← the account `scope-manager` is tied to
//     └ scope-report ('scope-boss' is its manager) ← the account `scope-employee` is tied to
//   scope-elsewhere (someone else's report) — the row NEITHER of them may see.
const BOSS = 'scope-boss';
const REPORT = 'scope-report';
const ELSEWHERE = 'scope-elsewhere';

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

const rawDb = (fn) => {
  const db = new DatabaseSync(SCRATCH_DB);
  try { return fn(db); } finally { db.close(); }
};

// One login per account, cached: the rate limiter counts failures per IP, so a test file that logs in
// repeatedly for the same token would eventually be measuring the limiter instead of the policy.
const TOKENS = new Map();
async function tokenFor(username) {
  if (!TOKENS.has(username)) {
    const r = await api('POST', '/api/login', { body: { username, password: PASSWORD } });
    assert.strictEqual(r.status, 200, `the fixture account ${username} must be able to log in`);
    TOKENS.set(username, r.json.token);
  }
  return TOKENS.get(username);
}

before(async () => {
  // The database is built the way the product builds one — server/schema.sql — so a fresh database
  // and a migrated one are the same shape (server/column-migration.test.js holds that property).
  const db = new DatabaseSync(SCRATCH_DB);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const insertUser = db.prepare('INSERT INTO users (id, username, password_hash, access_role) VALUES (?, ?, ?, ?)');
  insertUser.run(randomUUID(), ADMIN_NAME, bcrypt.hashSync(PASSWORD, 4), 'hr_admin');
  // A person whose role matches NO policy cell. It cannot be created through the API (see the 400
  // case below), so it is inserted here for exactly one purpose: to be refused.
  insertUser.run(randomUUID(), NO_ROLE_NAME, bcrypt.hashSync(PASSWORD, 4), 'hr');
  for (const [id, first, manager] of [[BOSS, 'Boss', null], [REPORT, 'Report', BOSS], [ELSEWHERE, 'Elsewhere', null]]) {
    db.prepare(`INSERT INTO employees (id, first_name, last_name, email, department, role, manager_id, start_date, salary, basic_salary, eosb_accrued, national_id_value, data_residency_country)
      VALUES (?, ?, 'Person', ?, 'Finance', 'Analyst', ?, '2026-01-05', 1000, 500, 30, ?, 'AE')`)
      .run(id, first, `${id}@example.invalid`, manager, `enc-not-set-${id}`);
  }
  db.prepare("INSERT INTO employees (id, first_name, last_name, email, start_date) VALUES ('scratch-emp', 'Scratch', 'Person', 'scratch@example.invalid', '2026-01-05')").run();
  db.prepare("INSERT INTO onboarding_tasks (id, employee_id, title, status) VALUES ('scratch-task-1', 'scratch-emp', 'The first day', 'pending')").run();
  db.prepare("INSERT INTO onboarding_tasks (id, employee_id, title, status) VALUES ('scratch-task-2', 'scratch-emp', 'The paperwork', 'pending')").run();
  db.prepare("INSERT INTO onboarding_tasks (id, employee_id, title, status) VALUES ('scope-task', 'scope-report', 'The first day', 'pending')").run();
  db.prepare("INSERT INTO offboarding_tasks (id, employee_id, title, status) VALUES ('scope-off-task', 'scope-report', 'Hand back the laptop', 'pending')").run();
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

  // The four scoped accounts, created the way the product creates them: HTTP, by HR, with the account
  // → person link. Doing it here rather than by INSERT means the link's own refusals are exercised
  // before any scope check depends on it.
  const admin = await tokenFor(ADMIN_NAME);
  const accounts = [
    ['scope-manager', access.ROLES.MANAGER, BOSS],
    ['scope-employee', access.ROLES.EMPLOYEE, REPORT],
    ['scope-finance', access.ROLES.FINANCE, undefined],
    ['scope-viewer', access.ROLES.COMPLIANCE_VIEWER, undefined],
  ];
  for (const [username, access_role, employee_id] of accounts) {
    const body = { username, password: PASSWORD, access_role };
    if (employee_id) body.employee_id = employee_id;
    const r = await api('POST', '/api/users', { token: admin, body });
    assert.strictEqual(r.status, 201, `the fixture account ${username} must be creatable (${r.text})`);
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
    assert.strictEqual(r.json.user.access_role, access.ROLES.HR_ADMIN, 'the permission, under its own name');
  });
});

describe('authorization: deny-by-default, and the role is read from `access_role`', () => {
  test('the seeded admin still reaches the roster (nothing was narrowed by this slice)', async () => {
    const r = await api('GET', '/api/employees', { token: await tokenFor(ADMIN_NAME) });
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.json));
  });

  test('an authenticated caller whose role allows nothing is 403 on the roster', async () => {
    const r = await api('GET', '/api/employees', { token: await tokenFor(NO_ROLE_NAME) });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.text, '', 'the refusal carries NO body — it tells the caller nothing');
  });

  test('and 403 on a different resource — the refusal is not one route', async () => {
    const token = await tokenFor(NO_ROLE_NAME);
    assert.strictEqual((await api('GET', '/api/analytics/dashboard', { token })).status, 403);
    assert.strictEqual((await api('GET', '/api/users', { token })).status, 403);
  });

  test('a path that declares NO resource is refused, not left open and not a 404', async () => {
    const r = await api('GET', '/api/nothing-declares-this', { token: await tokenFor(ADMIN_NAME) });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.text, '');
  });

  test('a token carrying the OLD claim is refused: the rename is not read under two names', async () => {
    // A token minted before this slice carries `role`. The gate reads `access_role`, so it resolves to
    // no role — a session ending, stated as one, rather than an alias kept alive for ever.
    const oldClaim = jwt.sign({ id: 'scratch', username: ADMIN_NAME, role: 'hr_admin' }, JWT_SECRET, { expiresIn: '5m' });
    assert.strictEqual((await api('GET', '/api/employees', { token: oldClaim })).status, 403);
  });

  test('a token with no username is still authorised by role, but cannot write (below)', async () => {
    // The role check is the role check; the actor requirement is separate and is asserted in the
    // write-actor section. This case exists so the two are visibly different mechanisms.
    const nameless = jwt.sign({ id: 'scratch', access_role: access.ROLES.HR_ADMIN }, JWT_SECRET, { expiresIn: '5m' });
    assert.strictEqual((await api('GET', '/api/employees', { token: nameless })).status, 200);
  });
});

describe('the policy table IS the matrix (docs/access-model.md §3)', () => {
  // Every cell, written as the model writes it. Compared as SETS of roles, and the resource sets are
  // compared both ways: a cell widened, narrowed, renamed or added without a decision reddens here.
  const MATRIX = {
    'employees:read': [access.ROLES.HR_ADMIN, access.ROLES.MANAGER, access.ROLES.FINANCE],
    'employees:write': [access.ROLES.HR_ADMIN],
    'onboarding:read': [access.ROLES.HR_ADMIN, access.ROLES.MANAGER, access.ROLES.EMPLOYEE],
    'onboarding:write': [access.ROLES.HR_ADMIN, access.ROLES.MANAGER],
    'offboarding:read': [access.ROLES.HR_ADMIN, access.ROLES.EMPLOYEE],
    'offboarding:write': [access.ROLES.HR_ADMIN],
    'compliance:calculate': [access.ROLES.HR_ADMIN, access.ROLES.FINANCE],
    'compliance:notice': [access.ROLES.HR_ADMIN, access.ROLES.MANAGER, access.ROLES.FINANCE, access.ROLES.EMPLOYEE, access.ROLES.COMPLIANCE_VIEWER],
    'compliance:templates': [access.ROLES.HR_ADMIN, access.ROLES.FINANCE],
    'analytics:read': [access.ROLES.HR_ADMIN, access.ROLES.FINANCE, access.ROLES.COMPLIANCE_VIEWER],
    'exit:write': [access.ROLES.HR_ADMIN],
    'preboarding:read': [access.ROLES.HR_ADMIN],
    'preboarding:read:own': [access.ROLES.HR_ADMIN],
    'preboarding:read:aggregate': [access.ROLES.HR_ADMIN, access.ROLES.COMPLIANCE_VIEWER],
    'preboarding:write': [access.ROLES.HR_ADMIN],
    'users:read': [access.ROLES.HR_ADMIN, access.ROLES.COMPLIANCE_VIEWER],
    'users:write': [access.ROLES.HR_ADMIN],
  };

  test('no declared route lacks a policy cell', () => {
    assert.deepStrictEqual(access.unpoliciedRoutes(), []);
  });

  test('no policy cell names a role this product does not know', () => {
    assert.deepStrictEqual(access.unknownRolesInPolicy(), []);
  });

  test('the five roles are exactly the ones the model names', () => {
    assert.deepStrictEqual([...access.ROLE_LIST].sort(),
      ['compliance_viewer', 'employee', 'finance', 'hr_admin', 'manager'].sort());
  });

  test('every cell is the matrix, role by role — and the cell set is exactly this table', () => {
    assert.deepStrictEqual(Object.keys(access.POLICY).sort(), Object.keys(MATRIX).sort(),
      'a resource exists that this table does not name — so it was added without a decision');
    for (const [resource, roles] of Object.entries(MATRIX)) {
      assert.deepStrictEqual([...access.POLICY[resource]].sort(), [...roles].sort(), resource);
    }
  });

  test('the five cases §6 names are refused by the ABSENCE of a role, and the absence is asserted', () => {
    // §6.1, §6.2, §6.3, §6.4, §6.5 — written as the refusals they are, so a later widening has to
    // delete a line here that says in words what it is deleting.
    assert.ok(!access.POLICY['employees:read'].includes(access.ROLES.EMPLOYEE), '§6.1 no employee reads the roster');
    assert.ok(!access.POLICY['employees:read'].includes(access.ROLES.COMPLIANCE_VIEWER), '§6.1 nor the viewer');
    assert.ok(!access.POLICY['compliance:templates'].includes(access.ROLES.EMPLOYEE), '§6.2 no employee reads a settlement document');
    assert.ok(!access.POLICY['compliance:templates'].includes(access.ROLES.MANAGER), '§6.2 nor a manager');
    assert.ok(!access.POLICY['analytics:read'].includes(access.ROLES.MANAGER), '§6.3 no manager reads company-wide pay');
    assert.ok(!access.POLICY['onboarding:write'].includes(access.ROLES.EMPLOYEE), '§6.4 an employee never ticks a step');
    assert.ok(!access.POLICY['exit:write'].includes(access.ROLES.FINANCE), '§6.5 finance does not end an employment');
  });

  test('the resource for a route is looked up by method and path, not by a guess', () => {
    assert.strictEqual(access.resourceFor('GET', '/api/employees'), 'employees:read');
    assert.strictEqual(access.resourceFor('PUT', '/api/onboarding-tasks/abc'), 'onboarding:write');
    assert.strictEqual(access.resourceFor('GET', '/api/preboarding/cases/abc/workspace'), 'preboarding:read:own');
    assert.strictEqual(access.resourceFor('GET', '/api/nothing-declares-this'), null);
  });
});

describe('the pre-boarding split — three cells, because the matrix gives these routes three cells', () => {
  const routesFor = (resource) =>
    access.ROUTES.filter(([, , r]) => r === resource).map(([method, pattern]) => `${method} ${pattern}`);

  test('the collection, the derived company-wide reads and the own-case reads are different resources', () => {
    assert.strictEqual(access.resourceFor('GET', '/api/preboarding/cases'), 'preboarding:read',
      'the list itself — the one shape a per-row scope cannot make safe');
    for (const p of ['/api/preboarding/checklist/overview', '/api/preboarding/flag-watch']) {
      assert.strictEqual(access.resourceFor('GET', p), 'preboarding:read:aggregate', p);
    }
    for (const p of ['/api/preboarding/cases/abc', '/api/preboarding/cases/abc/checklist',
      '/api/preboarding/cases/abc/workspace', '/api/preboarding/cases/abc/package']) {
      assert.strictEqual(access.resourceFor('GET', p), 'preboarding:read:own', p);
    }
  });

  test('a third cell is required, not stylistic: the three routes have different cells', () => {
    // The list is a cell the viewer may NOT have; the roll-up and the flag watch are one it MAY. A
    // single `preboarding:read` over all three would grant the viewer the company-wide list — the
    // exact over-grant §1.1 required the first split to prevent, one level down.
    assert.ok(!access.POLICY['preboarding:read'].includes(access.ROLES.COMPLIANCE_VIEWER));
    assert.ok(access.POLICY['preboarding:read:aggregate'].includes(access.ROLES.COMPLIANCE_VIEWER));
    assert.deepStrictEqual(routesFor('preboarding:read'), ['GET /preboarding/cases']);
    assert.deepStrictEqual(routesFor('preboarding:read:aggregate').sort(),
      ['GET /preboarding/checklist/overview', 'GET /preboarding/flag-watch']);
  });

  test('the three cells cover disjoint route sets, enumerated from ROUTES', () => {
    const all = ['preboarding:read', 'preboarding:read:aggregate', 'preboarding:read:own'].map(routesFor);
    const flat = [].concat(...all);
    assert.strictEqual(flat.length, new Set(flat).size, 'no route is in two cells');
    assert.ok(flat.length >= 7, 'the split covers the reads it split');
  });

  test('the write side is untouched by the split — preboarding:write still covers five routes', () => {
    assert.strictEqual(routesFor('preboarding:write').length, 5);
  });
});

describe('⊘ is not ✖: the cells this product cannot express yet are recorded, not flattened', () => {
  test('the pending cells are non-empty and name the missing link', () => {
    const entries = Object.entries(access.PENDING_CELLS);
    assert.ok(entries.length >= 2, 'the marks exist rather than being quietly denied');
    for (const [resource, roles] of entries) {
      assert.ok(Object.prototype.hasOwnProperty.call(access.POLICY, resource), `${resource} must be a real resource`);
      for (const [role, why] of Object.entries(roles)) {
        assert.ok(access.ROLE_LIST.includes(role), `${role} must be a real role`);
        assert.ok(typeof why === 'string' && why.length > 20, `${resource}/${role} must say what is missing`);
      }
    }
    const named = JSON.stringify(access.PENDING_CELLS);
    assert.ok(named.includes('pre-boarding case'), 'the missing link is named: no column joins a case to a person');
  });

  test('a ⊘ cell is NOT also granted — the mark must be deleted when the grant lands', () => {
    for (const [resource, roles] of Object.entries(access.PENDING_CELLS)) {
      for (const role of Object.keys(roles)) {
        assert.ok(!access.POLICY[resource].includes(role),
          `${resource} grants ${role}, so its ⊘ mark is stale and must be removed in the same change`);
      }
    }
  });

  test('counsel-pending cells are recorded separately, and are denied today', () => {
    const entries = Object.entries(access.COUNSEL_PENDING);
    assert.ok(entries.length >= 3);
    for (const [resource, roles] of entries) {
      for (const [role, why] of Object.entries(roles)) {
        assert.ok(!access.POLICY[resource].includes(role), `${resource}/${role} is denied while counsel owns it`);
        assert.ok(why.includes('§8'), `${resource}/${role} must cite the model's open question`);
      }
    }
    // And the two marks are genuinely different: the same resource can carry both, with different
    // reasons — no missing column makes a counsel question answerable.
    assert.ok(access.PENDING_CELLS['preboarding:read'].manager && access.COUNSEL_PENDING['preboarding:read'].manager);
    assert.notStrictEqual(access.PENDING_CELLS['preboarding:read'].manager, access.COUNSEL_PENDING['preboarding:read'].manager);
  });
});

describe('the scope tables are complete — "how far" is never assumed', () => {
  test('every role a scope-bearing cell allows has a stated scope, and no other role has one', () => {
    for (const [resource, table] of Object.entries(access.SCOPES)) {
      assert.ok(Object.prototype.hasOwnProperty.call(access.POLICY, resource), `${resource} must be a real resource`);
      for (const role of access.POLICY[resource]) {
        assert.ok(table[role] !== undefined, `${resource} allows ${role} without saying how far it reaches`);
        assert.ok(Object.values(access.SCOPE).includes(table[role]), `${resource}/${role}: ${table[role]} is not a scope`);
      }
      for (const role of Object.keys(table)) {
        assert.ok(access.POLICY[resource].includes(role), `${resource} scopes ${role}, which the cell does not allow`);
      }
    }
  });

  test('an unstated scope resolves to null, and null allows nothing', () => {
    assert.strictEqual(access.scopeFor('employees:read', access.ROLES.COMPLIANCE_VIEWER), null);
    assert.strictEqual(access.scopedAllows(null, access.RELATION.SELF), false);
    assert.strictEqual(access.scopedAllows(access.SCOPE.REPORTS, access.RELATION.SELF),
      false, 'a manager reading their own tasks is NOT covered by "own reports" — see the PR body');
    assert.strictEqual(access.scopedAllows(access.SCOPE.OWN, access.RELATION.REPORT), false);
    assert.strictEqual(access.scopedAllows(access.SCOPE.OWN, access.RELATION.UNKNOWN), false);
    assert.strictEqual(access.scopedAllows(access.SCOPE.OWN, access.RELATION.SELF), true);
    assert.strictEqual(access.scopedAllows(access.SCOPE.ALL, access.RELATION.OTHER), true);
  });

  test('every role a field-bearing cell allows has a stated field rule', () => {
    for (const [resource, table] of Object.entries(access.FIELD_RULES)) {
      for (const role of access.POLICY[resource]) {
        assert.ok(table[role] !== undefined, `${resource} allows ${role} without saying which fields it may see`);
      }
      for (const role of Object.keys(table)) {
        assert.ok(access.POLICY[resource].includes(role), `${resource} has a field rule for ${role}, which the cell denies`);
      }
    }
  });

  test('the field lists name columns the employees table actually has — the check is load-bearing', () => {
    const columns = rawDb((db) => db.prepare('PRAGMA table_info(employees)').all().map((c) => c.name));
    const named = [].concat(...Object.values(access.EMPLOYEE_FIELD_GROUPS));
    assert.ok(named.length > 0);
    for (const column of named) {
      assert.ok(columns.includes(column),
        `${column} is named as a sensitive column and does not exist — a renamed column would silently un-strip`);
    }
  });
});

describe('the per-row scope, against real accounts', () => {
  test('a manager reads their own reporting line, and not the company', async () => {
    const r = await api('GET', '/api/employees', { token: await tokenFor('scope-manager') });
    assert.strictEqual(r.status, 200);
    const names = r.json.map((e) => e.first_name);
    assert.deepStrictEqual(names, ['Report'], 'exactly the report — not the boss, not the outsider, not everyone');
  });

  test('the positive control: HR reads MORE than the manager does', async () => {
    // Without this, "the manager saw one row" would pass on a database that holds one row.
    const r = await api('GET', '/api/employees', { token: await tokenFor(ADMIN_NAME) });
    assert.ok(r.json.length > 1, 'HR sees the whole roster — so the manager’s single row is a scope, not a fixture');
  });

  test('a manager reads a report\'s tasks, and is refused an outsider\'s and their own', async () => {
    const token = await tokenFor('scope-manager');
    assert.strictEqual((await api('GET', `/api/employees/${REPORT}/onboarding`, { token })).status, 200);
    assert.strictEqual((await api('GET', `/api/employees/${ELSEWHERE}/onboarding`, { token })).status, 403);
    // The matrix gives the manager column `scoped (own reports)` and the employee column `scoped (own)`,
    // and an account holds one role — so a manager account cannot read its OWN tasks. Asserted so the
    // gap is recorded rather than discovered, and named in the PR body for the owner.
    assert.strictEqual((await api('GET', `/api/employees/${BOSS}/onboarding`, { token })).status, 403);
  });

  test('a manager ticks a report\'s step and is refused an outsider\'s', async () => {
    const token = await tokenFor('scope-manager');
    assert.strictEqual((await api('PUT', '/api/onboarding-tasks/scope-task', { token, body: { status: 'completed' } })).status, 200);
    const refused = await api('PUT', '/api/onboarding-tasks/no-such-task', { token, body: { status: 'completed' } });
    assert.strictEqual(refused.status, 403, 'a task that resolves to nothing is refused, not reported as updated');
    assert.strictEqual(refused.text, '');
  });

  test('an employee reads their OWN record and nobody else\'s — the ruling, enforced', async () => {
    const token = await tokenFor('scope-employee');
    const own = await api('GET', `/api/employees/${REPORT}/onboarding`, { token });
    assert.strictEqual(own.status, 200);
    assert.ok(Array.isArray(own.json));
    assert.strictEqual((await api('GET', `/api/employees/${ELSEWHERE}/onboarding`, { token })).status, 403);
    assert.strictEqual((await api('GET', `/api/employees/${BOSS}/offboarding`, { token })).status, 403);
    const ownOff = await api('GET', `/api/employees/${REPORT}/offboarding`, { token });
    assert.strictEqual(ownOff.status, 200);
    assert.ok(ownOff.json.some((t) => t.id === 'scope-off-task'), 'their own exit steps, and only those');
  });

  test('an account with no person is nobody — the honest empty answer, not the company', async () => {
    // `scope-finance` has no `employee_id`. Its cell is the whole company (finance is a company-wide
    // reader), so this asserts the OTHER case: an account with no link resolves to no relation at all.
    const token = await tokenFor('scope-finance');
    assert.strictEqual((await api('GET', `/api/employees/${REPORT}/onboarding`, { token })).status, 403,
      'finance is not in the onboarding cell at all');
  });
});

describe('the field half: the roster serves each role only what its cell says', () => {
  const rowFor = (body, id) => body.find((e) => e.id === id);

  test('HR is served the row with the national ID decrypted — unchanged, and the positive control', async () => {
    const r = await api('GET', '/api/employees', { token: await tokenFor(ADMIN_NAME) });
    const row = rowFor(r.json, REPORT);
    assert.ok('national_id_value' in row, 'the column is present for HR, so "absent for the manager" means something');
    assert.ok('salary' in row && 'eosb_accrued' in row, 'and so do the pay columns');
  });

  test('a manager\'s rows carry NO national ID and NO pay', async () => {
    const r = await api('GET', '/api/employees', { token: await tokenFor('scope-manager') });
    assert.strictEqual(r.json.length, 1, 'the scope first: one report');
    const row = r.json[0];
    for (const column of [...access.EMPLOYEE_FIELD_GROUPS.national_id, ...access.EMPLOYEE_FIELD_GROUPS.pay]) {
      assert.ok(!(column in row), `a manager's roster row must not carry ${column}`);
    }
    assert.strictEqual(row.first_name, 'Report', 'and it is still a usable row, not an empty object');
    assert.strictEqual(row.email, `${REPORT}@example.invalid`);
  });

  test('finance keeps the pay columns and never the identifiers', async () => {
    const r = await api('GET', '/api/employees', { token: await tokenFor('scope-finance') });
    const row = rowFor(r.json, REPORT);
    assert.ok('salary' in row && 'basic_salary' in row && 'eosb_accrued' in row, 'the settlement needs the pay');
    for (const column of access.EMPLOYEE_FIELD_GROUPS.national_id) {
      assert.ok(!(column in row), `finance's roster row must not carry ${column}`);
    }
    assert.ok(r.json.length > 1, 'finance reads the company, not one line');
  });

  test('a manager cannot ask for the identifiers back by naming them in the query', async () => {
    const r = await api('GET', '/api/employees?jurisdiction=AE&columns=national_id_value', { token: await tokenFor('scope-manager') });
    assert.strictEqual(r.status, 200);
    for (const row of r.json) {
      assert.ok(!('national_id_value' in row) && !('salary' in row), 'the projection is the route’s, not the caller’s');
    }
  });
});

describe('the settlement templates: finance gets the settlement, not the contracts (§6.2)', () => {
  test('finance renders the settlement statement', async () => {
    const r = await api('GET', `/api/compliance/templates/final-settlement-statement/${REPORT}`, { token: await tokenFor('scope-finance') });
    assert.strictEqual(r.status, 200);
    assert.ok(r.json.content && r.json.content.length > 0, 'a document comes back');
  });

  test('finance is refused an employment contract', async () => {
    const r = await api('GET', `/api/compliance/templates/uae-employment-contract/${REPORT}`, { token: await tokenFor('scope-finance') });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.text, '');
  });

  test('HR renders both — the positive control for the two refusals above', async () => {
    const token = await tokenFor(ADMIN_NAME);
    assert.strictEqual((await api('GET', `/api/compliance/templates/final-settlement-statement/${REPORT}`, { token })).status, 200);
    assert.strictEqual((await api('GET', `/api/compliance/templates/uae-employment-contract/${REPORT}`, { token })).status, 200);
  });
});

describe('the five §6 refusals, end to end', () => {
  const cases = [
    ['§6.1 an employee reading the roster', 'scope-employee', 'GET', '/api/employees'],
    ['§6.1 a compliance viewer reading the roster', 'scope-viewer', 'GET', '/api/employees'],
    ['§6.2 an employee reading a settlement document', 'scope-employee', 'GET', `/api/compliance/templates/final-settlement-statement/${REPORT}`],
    ['§6.2 a manager reading a settlement document', 'scope-manager', 'GET', `/api/compliance/templates/final-settlement-statement/${REPORT}`],
    ['§6.3 a manager reading company-wide pay through the dashboard', 'scope-manager', 'GET', '/api/analytics/dashboard'],
    ['§6.4 an employee ticking a step on their own record', 'scope-employee', 'PUT', '/api/onboarding-tasks/scope-task'],
    ['§6.5 finance ending someone’s employment', 'scope-finance', 'POST', '/api/exit-interviews'],
    ['an employee creating an account', 'scope-employee', 'POST', '/api/users'],
    ['a viewer creating an account', 'scope-viewer', 'POST', '/api/users'],
    ['an employee reading the company-wide case list', 'scope-employee', 'GET', '/api/preboarding/cases'],
    ['a viewer reading the company-wide case list', 'scope-viewer', 'GET', '/api/preboarding/cases'],
    ['a manager reading the roll-up (§3.2 refuses it to them)', 'scope-manager', 'GET', '/api/preboarding/checklist/overview'],
    ['an employee reading the flag watch', 'scope-employee', 'GET', '/api/preboarding/flag-watch'],
    ['finance reading an employee’s pre-boarding case', 'scope-finance', 'GET', `/api/preboarding/cases/${REPORT}`],
  ];

  for (const [name, account, method, path] of cases) {
    test(`${name} → 403 with no body`, async () => {
      const r = await api(method, path, { token: await tokenFor(account), body: method === 'GET' ? undefined : {} });
      assert.strictEqual(r.status, 403, `${name} (${r.text})`);
      assert.strictEqual(r.text, '', 'the refusal says nothing about what exists');
    });
  }
});

describe('the granted reads, end to end — the other half of the same check', () => {
  test('a viewer reads the roll-up and the flag watch, and not the list', async () => {
    const token = await tokenFor('scope-viewer');
    assert.strictEqual((await api('GET', '/api/preboarding/checklist/overview', { token })).status, 200);
    assert.strictEqual((await api('GET', '/api/preboarding/flag-watch', { token })).status, 200);
    assert.strictEqual((await api('GET', '/api/preboarding/cases', { token })).status, 403);
  });

  test('a viewer reads the account list and the dashboard (read-only), and can write neither', async () => {
    const token = await tokenFor('scope-viewer');
    assert.strictEqual((await api('GET', '/api/users', { token })).status, 200);
    assert.strictEqual((await api('GET', '/api/analytics/dashboard', { token })).status, 200);
    assert.strictEqual((await api('POST', '/api/preboarding/cases', { token, body: {} })).status, 403);
    assert.strictEqual((await api('PUT', `/api/onboarding-tasks/scope-task`, { token, body: { status: 'completed' } })).status, 403);
  });

  test('every role may read the notice — the document a data subject is shown', async () => {
    for (const account of [ADMIN_NAME, 'scope-manager', 'scope-employee', 'scope-finance', 'scope-viewer']) {
      const r = await api('GET', '/api/compliance/notice', { token: await tokenFor(account) });
      assert.strictEqual(r.status, 200, account);
      assert.ok(r.json.version, account);
    }
  });

  test('finance computes an EOSB; an employee does not', async () => {
    const body = { start_date: '2024-01-01', end_date: '2026-01-01', basic_salary: 1000, total_salary: 2000, country: 'AE', termination_type: 'resignation' };
    assert.strictEqual((await api('POST', '/api/compliance/calculate-eosb', { token: await tokenFor('scope-finance'), body })).status, 200);
    assert.strictEqual((await api('POST', '/api/compliance/calculate-eosb', { token: await tokenFor('scope-employee'), body })).status, 403);
  });
});

describe('accounts: plural rows through an HR path, and the person link', () => {
  test('an account is created with the renamed role field, and logs in', async () => {
    const admin = await tokenFor(ADMIN_NAME);
    const created = await api('POST', '/api/users', { token: admin, body: { username: 'slice1-second', password: 'second-account-password', access_role: access.ROLES.HR_ADMIN } });
    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.json.username, 'slice1-second');
    assert.strictEqual(created.json.access_role, access.ROLES.HR_ADMIN);
    const login = await api('POST', '/api/login', { body: { username: 'slice1-second', password: 'second-account-password' } });
    assert.strictEqual(login.status, 200);
    assert.strictEqual(login.json.user.access_role, access.ROLES.HR_ADMIN);
  });

  test('the OLD body field `role` is not silently accepted', async () => {
    const raw = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await tokenFor(ADMIN_NAME)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'slice2-old-field', password: 'long-enough-password', role: 'hr_admin' }),
    });
    assert.strictEqual(raw.status, 400, 'the old name is not a second spelling of the permission');
    assert.deepStrictEqual((await raw.json()).known_roles, access.ROLE_LIST);
  });

  test('the OLD role VALUE is not a role any more', async () => {
    const r = await api('POST', '/api/users', { token: await tokenFor(ADMIN_NAME), body: { username: 'slice2-old-value', password: 'long-enough-password', access_role: 'admin' } });
    assert.strictEqual(r.status, 400, '`admin` became `hr_admin`; it is not both');
  });

  test('the account list is a list, and it does not leak a password hash', async () => {
    const r = await api('GET', '/api/users', { token: await tokenFor(ADMIN_NAME) });
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.json) && r.json.length >= 3);
    assert.ok(!('password_hash' in r.json[0]), 'the account list carries no password material');
    assert.ok('access_role' in r.json[0] && !('role' in r.json[0]), 'and it names the permission, not the job title');
  });

  test('a link that names no employee is refused 400', async () => {
    const r = await api('POST', '/api/users', { token: await tokenFor(ADMIN_NAME), body: { username: 'slice2-ghost', password: 'long-enough-password', access_role: access.ROLES.EMPLOYEE, employee_id: 'no-such-employee' } });
    assert.strictEqual(r.status, 400);
  });

  test('an employee who already has an account cannot silently get a second one', async () => {
    const r = await api('POST', '/api/users', { token: await tokenFor(ADMIN_NAME), body: { username: 'slice2-second-link', password: 'long-enough-password', access_role: access.ROLES.EMPLOYEE, employee_id: REPORT } });
    assert.strictEqual(r.status, 409);
  });

  test('the database holds the link unique when set — not the route alone', () => {
    // The route refuses a second account for one person; this asserts the CONSTRAINT, so a future
    // writer that is not this route (a migration, a script) cannot create the state the scope checks
    // cannot resolve. An empty employees table would make this vacuous, so the column is checked too.
    assert.ok(rawDb((db) => db.prepare('PRAGMA table_info(users)').all().map((c) => c.name)).includes('employee_id'));
    const index = rawDb((db) => db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_users_employee_id_unique'").get());
    assert.ok(index && index.sql.includes('employee_id'), 'the partial unique index exists');
    assert.throws(() => rawDb((db) => db.prepare("INSERT INTO users (id, username, password_hash, access_role, employee_id) VALUES ('dup-1', 'dup-1', 'x', 'employee', ?)").run(REPORT)),
      'a second account for one person is rejected by the database');
    // The control: the SAME insert without the link is fine, so the throw above was the uniqueness.
    assert.doesNotThrow(() => rawDb((db) => db.prepare("INSERT INTO users (id, username, password_hash, access_role, employee_id) VALUES (?1, ?1, 'x', 'employee', NULL)").run(`unlinked-${randomUUID()}`)));
  });

  // Slice 2, prerequisite 3: before this the route wrote no audit row, so creating an account was
  // unattributable. These two cases are a pair on purpose — the second is the anti-vacuous control
  // for the first: if a REFUSED creation also wrote a row, the first case would prove nothing.
  const userAuditRows = () => rawDb((db) => db.prepare("SELECT * FROM audit_logs WHERE entity_type = 'user'").all());

  test('creating an account writes an audit row naming the REAL actor, never a placeholder', async () => {
    const created = await api('POST', '/api/users', { token: await tokenFor(ADMIN_NAME), body: { username: 'slice2-audited', password: 'audited-account-password', access_role: access.ROLES.HR_ADMIN } });
    assert.strictEqual(created.status, 201);
    const rows = userAuditRows().filter((row) => row.entity_id === created.json.id);
    assert.strictEqual(rows.length, 1, 'exactly one audit row for the account that was created');
    assert.strictEqual(rows[0].action, 'CREATE');
    assert.strictEqual(rows[0].performed_by, ADMIN_NAME, 'the row names the authenticated signer');
    assert.notStrictEqual(rows[0].performed_by, 'system', 'and never a placeholder');
    // The row says what was created — and carries no credential material.
    assert.deepStrictEqual(JSON.parse(rows[0].new_values), { username: 'slice2-audited', access_role: access.ROLES.HR_ADMIN, employee_id: null });
    assert.ok(!JSON.stringify(rows[0]).includes('audited-account-password'), 'the password is not in the row');
    assert.ok(!JSON.stringify(rows[0]).includes('$2'), 'and neither is the hash');
  });

  test('a REFUSED creation writes no audit row — so the case above is not a vacuous green', async () => {
    const before = userAuditRows().length;
    assert.strictEqual((await api('POST', '/api/users', { token: await tokenFor(ADMIN_NAME), body: { username: ADMIN_NAME, password: 'another-password-here', access_role: access.ROLES.HR_ADMIN } })).status, 409);
    assert.strictEqual((await api('POST', '/api/users', { token: await tokenFor(NO_ROLE_NAME), body: { username: 'slice2-refused', password: 'long-enough-password', access_role: access.ROLES.HR_ADMIN } })).status, 403);
    assert.strictEqual(userAuditRows().length, before, 'a 409 and a 403 leave the log exactly as it was');
  });

  test('a duplicate username is refused 409 rather than shadowing the first account', async () => {
    const r = await api('POST', '/api/users', { token: await tokenFor(ADMIN_NAME), body: { username: ADMIN_NAME, password: 'another-password-here', access_role: access.ROLES.HR_ADMIN } });
    assert.strictEqual(r.status, 409);
  });

  test('a short password is refused 400', async () => {
    const r = await api('POST', '/api/users', { token: await tokenFor(ADMIN_NAME), body: { username: 'slice1-short', password: 'short', access_role: access.ROLES.HR_ADMIN } });
    assert.strictEqual(r.status, 400);
  });

  test('a role this product does not know is refused 400 — a user who matches no cell can do nothing', async () => {
    const r = await api('POST', '/api/users', { token: await tokenFor(ADMIN_NAME), body: { username: 'slice1-unknown-role', password: 'long-enough-password', access_role: 'wizard' } });
    assert.strictEqual(r.status, 400);
    assert.deepStrictEqual(r.json.known_roles, access.ROLE_LIST);
  });
});

describe('every write names a person (§5.2 rules 1 and 3)', () => {
  const namelessToken = () => jwt.sign({ id: 'scratch', access_role: access.ROLES.HR_ADMIN }, JWT_SECRET, { expiresIn: '5m' });

  test('the employee CREATE path records the signed-in actor, not the literal \'system\'', async () => {
    const r = await api('POST', '/api/employees', {
      token: await tokenFor(ADMIN_NAME),
      body: { first_name: 'Actor', last_name: 'Check', email: `actor-${randomUUID()}@example.invalid`, start_date: '2026-02-01', data_residency_country: 'AE' },
    });
    assert.strictEqual(r.status, 201);
    const row = rawDb((db) => db.prepare("SELECT performed_by FROM audit_logs WHERE entity_id = ? AND entity_type = 'employee'").get(r.json.id));
    assert.strictEqual(row.performed_by, ADMIN_NAME, 'the column that holds a person’s name holds theirs');
  });

  test('the employee UPDATE path does too', async () => {
    const token = await tokenFor(ADMIN_NAME);
    const created = await api('POST', '/api/employees', {
      token, body: { first_name: 'Actor', last_name: 'Update', email: `actor-upd-${randomUUID()}@example.invalid`, start_date: '2026-02-01', data_residency_country: 'AE' },
    });
    assert.strictEqual(created.status, 201);
    assert.strictEqual((await api('PUT', `/api/employees/${created.json.id}`, { token, body: { department: 'Finance' } })).status, 200);
    const row = rawDb((db) => db.prepare("SELECT performed_by FROM audit_logs WHERE entity_id = ? AND action = 'UPDATE'").get(created.json.id));
    assert.strictEqual(row.performed_by, ADMIN_NAME);
  });

  test('an UNNAMED token is refused 400 on every write path, and writes nothing', async () => {
    const token = namelessToken();
    const employeeCountBefore = rawDb((db) => db.prepare('SELECT COUNT(*) AS n FROM employees').get().n);
    const auditBefore = rawDb((db) => db.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n);

    assert.strictEqual((await api('POST', '/api/employees', { token, body: { first_name: 'No', last_name: 'Body', email: 'x@example.invalid', start_date: '2026-02-01', data_residency_country: 'AE' } })).status, 400);
    assert.strictEqual((await api('PUT', `/api/employees/${REPORT}`, { token, body: { department: 'Nowhere' } })).status, 400);
    assert.strictEqual((await api('POST', '/api/preboarding/cases', { token, body: {} })).status, 400);
    assert.strictEqual((await api('POST', '/api/preboarding/cases/anything/items/passport/status', { token, body: { status: 'requested' } })).status, 400);
    assert.strictEqual((await api('POST', '/api/preboarding/cases/anything/reminders', { token, body: {} })).status, 400);
    // The third path that ends an employment (row f2e68a04). The employee id is deliberately one that
    // does not exist, so on a tree WITHOUT the actor gate this call's damage is an orphan interview row
    // rather than a real person's record terminated by a token that names nobody. The body is otherwise
    // COMPLETE on purpose: a body that also provoked the old crash would take the server down here and
    // every later case in this file would read `fetch failed` — the failure would be real but its reason
    // would be unreadable. The crash has its own case, last, where its signature is the point.
    assert.strictEqual((await api('POST', '/api/exit-interviews', { token, body: { employee_id: 'unnamed-actor-writes-nothing', interview_date: '2026-10-20', departure_reason: 'resignation', satisfaction_score: 3 } })).status, 400);

    assert.strictEqual(rawDb((db) => db.prepare('SELECT COUNT(*) AS n FROM employees').get().n), employeeCountBefore, 'no employee row was written');
    assert.strictEqual(rawDb((db) => db.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n), auditBefore, 'and no audit row either');
    const unchanged = rawDb((db) => db.prepare('SELECT department FROM employees WHERE id = ?').get(REPORT));
    assert.notStrictEqual(unchanged.department, 'Nowhere', 'the update did not land');
  });

  test('a termination REASON is refused from a token that names nobody (owner ruling 2026-10-29)', async () => {
    // The ruling makes the reason the SOURCE of the arithmetic: a row with none computes the whole
    // entitlement, and only a reason a person recorded reduces it. So recording one is recording an
    // event, and an event has a named actor - the gate on this path runs before the reason is parsed,
    // which is why the answer is 400 rather than a write with a blank attribution. The two cases below
    // are the pair: the refusal, and the same call with a named actor, so neither can pass vacuously.
    const token = await tokenFor(ADMIN_NAME);
    const created = await api('POST', '/api/employees', {
      token,
      body: { first_name: 'Reason', last_name: 'Gate', email: `reason-gate-${randomUUID()}@example.invalid`,
        start_date: '2024-01-01', data_residency_country: 'AE' },
    });
    assert.strictEqual(created.status, 201);
    const id = created.json.id;
    const read = () => rawDb((db) => db.prepare('SELECT termination_type FROM employees WHERE id = ?').get(id)).termination_type;
    assert.strictEqual(read(), null, 'a created row records NO reason - nothing is defaulted for it');

    const refused = await api('PUT', `/api/employees/${id}`, { token: namelessToken(), body: { termination_type: 'resignation' } });
    assert.strictEqual(refused.status, 400, `an unnamed actor recorded a termination reason (${refused.status})`);
    assert.strictEqual(read(), null, 'the refused call left the column exactly as it was');

    const accepted = await api('PUT', `/api/employees/${id}`, { token, body: { termination_type: 'resignation' } });
    assert.strictEqual(accepted.status, 200, 'a NAMED actor recording the same reason is the control');
    assert.strictEqual(read(), 'resignation', 'and only then does the column hold it');
  });

  test('the tick still names its actor and refuses an unnamed one (decision 22)', async () => {
    const token = await tokenFor(ADMIN_NAME);
    assert.strictEqual((await api('PUT', '/api/onboarding-tasks/scratch-task-1', { token, body: { status: 'completed' } })).status, 200);
    const row = rawDb((db) => db.prepare("SELECT completed_by, completed_at FROM onboarding_tasks WHERE id = 'scratch-task-1'").get());
    assert.strictEqual(row.completed_by, ADMIN_NAME);
    assert.ok(row.completed_at);

    const r = await api('PUT', '/api/onboarding-tasks/scratch-task-2', { token: namelessToken(), body: { status: 'completed' } });
    assert.strictEqual(r.status, 400);
    const untouched = rawDb((db) => db.prepare("SELECT completed_by, status FROM onboarding_tasks WHERE id = 'scratch-task-2'").get());
    assert.strictEqual(untouched.completed_by, null, 'nothing was recorded for nobody');
    assert.strictEqual(untouched.status, 'pending');
  });

  // Row f2e68a04. `POST /api/exit-interviews` inserts the interview and sets status = 'terminated' — the
  // same effect the PUT path reaches, and one of the records replacement-cost.js reads to raise the
  // Layer 4 flag. It had no actor gate and wrote no audit row: measured on a scratch rig at 505ddd3, a
  // token carrying NO username was answered 201, the row went to terminated, and the employee's
  // audit_logs still held only its CREATE row. The three cases below are a pair plus two consequences
  // of the same statement, so a future silent removal of any of them fails here.
  const exitSubject = async () => {
    const created = await api('POST', '/api/employees', {
      token: await tokenFor(ADMIN_NAME),
      body: { first_name: 'Exit', last_name: 'Subject', email: `exit-${randomUUID()}@example.invalid`, start_date: '2026-01-05', data_residency_country: 'AE' },
    });
    assert.strictEqual(created.status, 201, `the fixture employee must be creatable (${created.text})`);
    return created.json.id;
  };
  const employeeAudit = (id) => rawDb((db) => db.prepare("SELECT * FROM audit_logs WHERE entity_type = 'employee' AND entity_id = ?").all(id));
  const interviewsFor = (id) => rawDb((db) => db.prepare('SELECT * FROM exit_interviews WHERE employee_id = ?').all(id));

  test('the exit-interview path terminates the row WITH the actor named, and writes the audit row', async () => {
    const id = await exitSubject();
    assert.strictEqual(employeeAudit(id).length, 1, 'the create wrote its own audit row — this is the baseline');

    const r = await api('POST', '/api/exit-interviews', {
      token: await tokenFor(ADMIN_NAME),
      body: { employee_id: id, interview_date: '2026-10-20', departure_reason: 'resignation', detailed_feedback: 'the gate', satisfaction_score: 4 },
    });
    assert.strictEqual(r.status, 201, r.text);

    const row = rawDb((db) => db.prepare('SELECT status, end_date FROM employees WHERE id = ?').get(id));
    assert.strictEqual(row.status, 'terminated', 'the interview still ends the employment — the effect is unchanged');
    assert.strictEqual(row.end_date, '2026-10-20');

    const rows = employeeAudit(id);
    assert.strictEqual(rows.length, 2, 'the termination writes its own audit row, beside the create');
    const termination = rows.find((a) => a.action === 'UPDATE');
    assert.ok(termination, 'an UPDATE row for the employee');
    assert.strictEqual(termination.performed_by, ADMIN_NAME, 'the column that holds a person’s name holds theirs');
    assert.notStrictEqual(termination.performed_by, 'system');
    const before = JSON.parse(termination.old_values);
    assert.notStrictEqual(before.status, 'terminated', 'the row records what the employee was before the call');
    const after = JSON.parse(termination.new_values);
    assert.strictEqual(after.status, 'terminated');
    assert.strictEqual(after.end_date, '2026-10-20');
    const interview = interviewsFor(id);
    assert.strictEqual(interview.length, 1, 'exactly one interview for this employee');
    assert.strictEqual(after.exit_interview_id, interview[0].id, 'the audit row names the interview this call wrote');
    assert.strictEqual(interview[0].satisfaction_score, 4, 'and the score is stored as the number it was given');
  });

  test('a REFUSED exit interview changes nothing — the control for the case above', async () => {
    const id = await exitSubject();
    const auditsBefore = employeeAudit(id).length;
    const r = await api('POST', '/api/exit-interviews', {
      token: namelessToken(),
      body: { employee_id: id, interview_date: '2026-10-20', departure_reason: 'resignation', detailed_feedback: 'nobody', satisfaction_score: 4 },
    });
    assert.strictEqual(r.status, 400, 'a named actor is required before any lookup');
    const row = rawDb((db) => db.prepare('SELECT status FROM employees WHERE id = ?').get(id));
    assert.notStrictEqual(row.status, 'terminated', 'the employment did not end');
    assert.strictEqual(interviewsFor(id).length, 0, 'no interview row for a call that was refused');
    assert.strictEqual(employeeAudit(id).length, auditsBefore, 'and the log is exactly as it was');
  });

  test('an exit interview naming an employee who is not on the roster is refused 404, and writes nothing', async () => {
    const ghost = `ghost-${randomUUID()}`;
    const before = rawDb((db) => db.prepare('SELECT COUNT(*) AS n FROM exit_interviews').get().n);
    const r = await api('POST', '/api/exit-interviews', {
      token: await tokenFor(ADMIN_NAME),
      body: { employee_id: ghost, interview_date: '2026-10-20', departure_reason: 'resignation' },
    });
    assert.strictEqual(r.status, 404, 'the attributed path refuses an unknown employee the same way');
    assert.strictEqual(rawDb((db) => db.prepare('SELECT COUNT(*) AS n FROM exit_interviews').get().n), before,
      'no interview row for a person who is not in the roster — the orphan write is closed');
  });

  test('a score that is not a number is stored as NULL, and a SQL-shaped one is data — the server stands', async () => {
    // The shape the UI sends when the field is left empty: `parseInt('')` is NaN. This value used to be
    // interpolated RAW into the statement, so the request was a SQL logic error and — the route having
    // no try/catch — the rejected handler ended the process. Both halves are asserted here.
    const id = await exitSubject();
    const r = await api('POST', '/api/exit-interviews', {
      token: await tokenFor(ADMIN_NAME),
      body: { employee_id: id, interview_date: '2026-10-20', departure_reason: 'resignation', satisfaction_score: '' },
    });
    assert.strictEqual(r.status, 201, r.text);
    const empty = interviewsFor(id)[0];
    assert.strictEqual(empty.satisfaction_score, null, 'stored as NULL — not the word the string produced, and not the text');
    assert.strictEqual((await api('GET', '/api/employees', { token: await tokenFor(ADMIN_NAME) })).status, 200, 'and the server survived it');

    const id2 = await exitSubject();
    const inj = await api('POST', '/api/exit-interviews', {
      token: await tokenFor(ADMIN_NAME),
      body: { employee_id: id2, interview_date: '2026-10-20', departure_reason: 'resignation', satisfaction_score: '(SELECT COUNT(*) FROM users)' },
    });
    assert.strictEqual(inj.status, 201, inj.text);
    const shaped = interviewsFor(id2)[0];
    assert.strictEqual(shaped.satisfaction_score, null, 'an expression is stored as NULL, never evaluated against the database');
  });

  test('no audit row anywhere in this database says \'system\'', () => {
    // The literal is gone from every write path. The count of rows is asserted too, so this cannot
    // pass on an empty table.
    const rows = rawDb((db) => db.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n);
    assert.ok(rows > 0, 'there are audit rows to check');
    const systems = rawDb((db) => db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE performed_by = 'system'").get().n);
    assert.strictEqual(systems, 0, 'a write attributed to a mechanism that no mechanism performed');
  });
});

describe('the users table itself: the rename, at the schema level', () => {
  test('the column is `access_role` and no column called `role` exists', () => {
    const columns = rawDb((db) => db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
    assert.ok(columns.includes('access_role'));
    assert.ok(!columns.includes('role'), 'one name for the permission — the collision is gone, not duplicated');
  });

  // The migration itself (that a boot renames this column and moves `admin` to `hr_admin`) is held
  // in server/column-migration.test.js, where db.js can be required against a pinned throwaway path.
  test('the role VALUE in the live-shaped fixture is the new one, not the old', () => {
    const roles = rawDb((db) => db.prepare('SELECT DISTINCT access_role FROM users').all().map((r) => r.access_role));
    assert.ok(roles.includes('hr_admin'), 'the role the rename produced');
    assert.ok(!roles.includes('admin'), 'and the old value is not also in the data');
  });
});

describe('the login rate limit still answers 429', () => {
  // The limiter is 25 failed attempts per IP per 60 seconds (index.js:25 failures per minute,
  // success resets the bucket) — so the burst has to EXCEED that number or the case proves nothing:
  // the first version sent 15 and passed the 401 branch forever, which is a check that could not
  // redden. It sends the limit + 5 and asserts the limiter's own answer.
  // LAST in the file on purpose: it burns this IP's login budget for the minute.
  test('a burst past the limiter (25 per minute) is answered 429', async () => {
    const LIMIT = 25;
    let sawTooMany = false;
    let lastStatus = 0;
    for (let i = 0; i < LIMIT + 5 && !sawTooMany; i++) {
      const r = await api('POST', '/api/login', { body: { username: ADMIN_NAME, password: 'wrong-' + i + '-password' } });
      lastStatus = r.status;
      if (r.status === 429) sawTooMany = true;
      else assert.strictEqual(r.status, 401, 'before the limit the answer is still 401');
    }
    assert.ok(sawTooMany, `the limiter must answer 429 within ${LIMIT + 5} attempts (last status ${lastStatus})`);
  });
});
