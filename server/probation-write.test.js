/**
 * The PROBATION WRITE PATH (2026-11-02) — a hire can be put on probation by a user, not only by the
 * demo seeder.
 *
 * WHAT WAS MEASURED BEFORE THIS FILE EXISTED. `probation_end_date` is the ONE column the whole
 * probation surface is derived from (`server/probation-timeline.js`: NULL means "this hire is not on
 * probation", so no timeline exists at all). The panel rendered — two seeded hires on the live demo,
 * `DAY 30 · OVERDUE` chips and all — and the only writer of that column in the entire tree was
 * `scripts/seed-demo.js`. `POST /api/employees` did not name it, `PUT /api/employees/:id` did not admit
 * it, and the New Strategic Hire modal had no field for it. So every hire "on probation" in the
 * product was a seeded one, and a buyer's first question — *"where do I set this?"* — had no answer.
 *
 * WHAT THIS FILE HOLDS, and why each case is here rather than assumed:
 *   * a hire created through the API with a **90-day** window comes back on `GET
 *     /api/probation/timelines` with milestones at `milestoneOffsets(90)` — the module's OWN offsets,
 *     not a second copy of the arithmetic written here — and the same for **180** days. That is the
 *     definition-of-done for the round: the write path and the panel agree because they share one
 *     arithmetic, and this asserts the agreement rather than restating the numbers;
 *   * the stored value is exactly `start_date + window` counted in **UTC**, which is the unit
 *     `probationWindow` reads it back with;
 *   * `None` is a real answer: a hire with no window gets no timeline (the row is NULL, not a default);
 *   * a window that is not a window (`end <= start`) is **refused 400, naming the field**, and nothing
 *     is written — a stored `end <= start` reads as "no probation" to every caller above, so the hire
 *     would look like they were never on probation while the record claimed a window;
 *   * `PUT` moves an existing hire ONTO probation and OFF it again, and the panel payload follows;
 *   * a `PUT` that moves `start_date` past the stored end date is refused rather than silently
 *     deleting the timeline;
 *   * the audit row records the STORED end date, not only the length that produced it — probation is a
 *     term of employment, and this repository already has one live row whose stored reason has no audit
 *     behind it;
 *   * and the INSERT's column list and value list stay PAIRED. That list is positional: an entry in one
 *     and not the other shifts every value after it, silently, and the row still inserts. The last test
 *     here parses both lists out of `server/index.js` and checks position by position, so it reddens on
 *     a shift and not only on an omission.
 *
 * HOW IT RUNS: a REAL server on a scratch port against a throwaway database under the temp dir, with a
 * minted token per role (WORKFLOW rules 5, 10, 14). It never touches the live service, the live
 * database or the live credential.
 *
 * `cd server && node --test probation-write.test.js`
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const jwt = require('jsonwebtoken');

const probationTimeline = require('./probation-timeline');

const SCRATCH_DB = path.join(os.tmpdir(), `antum-probation-write-${randomUUID()}.db`);
const JWT_SECRET = 'probation-write-test-secret-not-a-production-key';
const ENCRYPTION_KEY = 'b'.repeat(32); // 32 bytes, as server/auth.js reads it
const HR = 'pw-hr';

const DAY = 86400000;
const day = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
/** The same addition the module does, in the same unit — UTC midnight plus whole days. */
const plusDays = (isoDay, offset) =>
  new Date(Date.parse(`${isoDay}T00:00:00Z`) + offset * DAY).toISOString().slice(0, 10);

let server = null;
let base = '';
let serverLog = '';

function tokenFor(role, username = HR) {
  return jwt.sign({ id: `pw-${username}`, username, access_role: role }, JWT_SECRET, { expiresIn: '1h' });
}

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

async function api(method, route, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + route, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* a refusal with no body is a real shape here */ }
  return { status: res.status, text, json };
}

/** A hire body that the create route accepts, so each case varies only the probation field. */
function hire(overrides = {}) {
  const n = randomUUID().slice(0, 8);
  return {
    first_name: 'Probation',
    last_name: `Probe${n}`,
    email: `probation-${n}@example.invalid`,
    department: 'Operations',
    role: 'Analyst',
    data_residency_country: 'AE',
    basic_salary: '1000',
    salary: '2000',
    national_id_type: 'Emirates ID',
    national_id_value: '784-0000-0000000-0',
    start_date: day(-10),
    ...overrides,
  };
}

async function timelines(token = tokenFor('hr_admin')) {
  const r = await api('GET', '/api/probation/timelines', { token });
  assert.strictEqual(r.status, 200, `GET /api/probation/timelines answered ${r.status}: ${r.text}`);
  return r.json;
}

const timelineOf = (payload, employeeId) => (payload.timelines || []).find((t) => t.employee_id === employeeId) || null;

/** The scratch database, read directly — the claim is about ROWS, not about a response body. */
function rowOf(employeeId) {
  const db = new DatabaseSync(SCRATCH_DB);
  try {
    return db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId) || null;
  } finally { db.close(); }
}

function auditRowsFor(employeeId) {
  const db = new DatabaseSync(SCRATCH_DB);
  try {
    return db.prepare('SELECT * FROM audit_logs WHERE entity_id = ? ORDER BY timestamp, rowid').all(employeeId);
  } finally { db.close(); }
}

before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    env: { ...process.env, PORT: String(port), PRODUCT_DB_PATH: SCRATCH_DB, JWT_SECRET, ENCRYPTION_KEY },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => { serverLog += d.toString(); });
  server.stderr.on('data', (d) => { serverLog += d.toString(); });
  const deadline = Date.now() + 30000;
  for (;;) {
    try { await fetch(`${base}/api/employees`); break; } catch {
      if (Date.now() > deadline) throw new Error(`the scratch server never answered\n--- log ---\n${serverLog}`);
      await new Promise((r) => setTimeout(r, 200));
    }
  }
});

after(() => {
  if (server) server.kill('SIGKILL');
  for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(SCRATCH_DB + suffix); } catch { /* not there */ } }
});

describe('a hire can be put on probation through the product', () => {
  test('90 days: the panel derives the milestones from the module\'s own offsets', async () => {
    const start = day(-10);
    const r = await api('POST', '/api/employees', { token: tokenFor('hr_admin'), body: hire({ start_date: start, probation_window_days: 90 }) });
    assert.strictEqual(r.status, 201, `create answered ${r.status}: ${r.text}`);
    const id = r.json.id;

    const stored = rowOf(id);
    assert.strictEqual(stored.probation_end_date, plusDays(start, 90),
      'the stored end date is start_date + the window, counted in UTC');

    const payload = await timelines();
    const t = timelineOf(payload, id);
    assert.ok(t, `the hire must appear on the probation panel; payload ids: ${(payload.timelines || []).map((x) => x.employee_id).join(', ')}`);
    assert.strictEqual(t.length_days, 90);
    assert.strictEqual(t.start_date, start);
    assert.strictEqual(t.end_date, plusDays(start, 90));

    const offsets = probationTimeline.milestoneOffsets(90);
    assert.deepStrictEqual(t.milestones.map((m) => m.day), offsets,
      'the milestones are the module\'s own thirds-and-end of this window, not a second arithmetic');
    assert.deepStrictEqual(t.milestones.map((m) => m.due_date), offsets.map((o) => plusDays(start, o)),
      'each milestone falls that many days after the start date, in UTC');
  });

  test('180 days: the same path, and the offsets are the thirds of THAT window', async () => {
    const start = day(-10);
    const r = await api('POST', '/api/employees', { token: tokenFor('hr_admin'), body: hire({ start_date: start, probation_window_days: 180 }) });
    assert.strictEqual(r.status, 201, `create answered ${r.status}: ${r.text}`);
    const id = r.json.id;

    assert.strictEqual(rowOf(id).probation_end_date, plusDays(start, 180));

    const t = timelineOf(await timelines(), id);
    assert.ok(t, 'a 180-day hire appears on the panel');
    assert.strictEqual(t.length_days, 180);
    const offsets = probationTimeline.milestoneOffsets(180);
    assert.deepStrictEqual(t.milestones.map((m) => m.day), offsets);
    assert.deepStrictEqual(t.milestones.map((m) => m.due_date), offsets.map((o) => plusDays(start, o)));
  });

  test('None is a real answer: no window, no timeline, and the column is NULL (not a default)', async () => {
    const r = await api('POST', '/api/employees', { token: tokenFor('hr_admin'), body: hire({ probation_window_days: '' }) });
    assert.strictEqual(r.status, 201, r.text);
    assert.strictEqual(rowOf(r.json.id).probation_end_date, null);
    assert.strictEqual(timelineOf(await timelines(), r.json.id), null, 'a hire with no probation gets no timeline');
  });

  test('a window that is not a window is refused 400, NAMING THE FIELD — and nothing is written', async () => {
    const before = (await api('GET', '/api/employees', { token: tokenFor('hr_admin') })).json.length;
    const start = day(-10);

    const same = await api('POST', '/api/employees', {
      token: tokenFor('hr_admin'),
      body: hire({ start_date: start, probation_end_date: start }),
    });
    assert.strictEqual(same.status, 400, `end == start must be refused, got ${same.status}: ${same.text}`);
    assert.match(same.json.error, /probation_end_date/);
    assert.strictEqual(same.json.field, 'probation_end_date');

    const earlier = await api('POST', '/api/employees', {
      token: tokenFor('hr_admin'),
      body: hire({ start_date: start, probation_end_date: day(-40) }),
    });
    assert.strictEqual(earlier.status, 400, 'an end BEFORE the start must be refused too');
    assert.match(earlier.json.error, /probation_end_date/);

    const nonsense = await api('POST', '/api/employees', {
      token: tokenFor('hr_admin'),
      body: hire({ probation_window_days: 'ninety' }),
    });
    assert.strictEqual(nonsense.status, 400, 'a length that is not a number is the caller\'s fault');
    assert.match(nonsense.json.error, /probation_window_days/);

    const now = (await api('GET', '/api/employees', { token: tokenFor('hr_admin') })).json.length;
    assert.strictEqual(now, before, 'a refused create writes no employee row');
  });

  test('the CREATE audit row carries the STORED end date and names the actor', async () => {
    const start = day(-10);
    const r = await api('POST', '/api/employees', { token: tokenFor('hr_admin'), body: hire({ start_date: start, probation_window_days: 90 }) });
    assert.strictEqual(r.status, 201, r.text);
    const rows = auditRowsFor(r.json.id);
    assert.strictEqual(rows.length, 1, 'one CREATE row');
    assert.strictEqual(rows[0].action, 'CREATE');
    assert.strictEqual(rows[0].performed_by, HR, 'the row names the signed-in actor');
    const values = JSON.parse(rows[0].new_values);
    assert.strictEqual(values.probation_end_date, plusDays(start, 90),
      'the audit row records the value that was STORED, not only the length that produced it');
  });
});

describe('an existing hire can be moved onto probation and off it', () => {
  test('PUT with a length puts the hire on probation, and the panel payload follows', async () => {
    const created = await api('POST', '/api/employees', { token: tokenFor('hr_admin'), body: hire({ start_date: day(-10) }) });
    assert.strictEqual(created.status, 201, created.text);
    const id = created.json.id;
    assert.strictEqual(rowOf(id).probation_end_date, null, 'the fixture starts with no window');

    const put = await api('PUT', `/api/employees/${id}`, { token: tokenFor('hr_admin'), body: { probation_window_days: 180 } });
    assert.strictEqual(put.status, 200, `PUT answered ${put.status}: ${put.text}`);

    const start = rowOf(id).start_date;
    assert.strictEqual(rowOf(id).probation_end_date, plusDays(start, 180));

    const t = timelineOf(await timelines(), id);
    assert.ok(t, 'the hire now appears on the panel payload');
    assert.strictEqual(t.length_days, 180);
    assert.deepStrictEqual(t.milestones.map((m) => m.day), probationTimeline.milestoneOffsets(180));

    const update = auditRowsFor(id).filter((x) => x.action === 'UPDATE').pop();
    assert.ok(update, 'the change is audited');
    assert.strictEqual(JSON.parse(update.new_values).probation_end_date, plusDays(start, 180));
  });

  test('PUT with an explicit end date works too — the whitelist admits the column itself', async () => {
    const start = day(-10);
    const created = await api('POST', '/api/employees', { token: tokenFor('hr_admin'), body: hire({ start_date: start }) });
    const id = created.json.id;
    const end = plusDays(start, 60);
    const put = await api('PUT', `/api/employees/${id}`, { token: tokenFor('hr_admin'), body: { probation_end_date: end } });
    assert.strictEqual(put.status, 200, put.text);
    assert.strictEqual(rowOf(id).probation_end_date, end);
    assert.strictEqual(timelineOf(await timelines(), id).length_days, 60);
  });

  test('PUT clears the window: NULL, gone from the panel — not an empty string', async () => {
    const created = await api('POST', '/api/employees', { token: tokenFor('hr_admin'), body: hire({ start_date: day(-10), probation_window_days: 90 }) });
    const id = created.json.id;
    assert.ok(timelineOf(await timelines(), id), 'fixture is on probation');

    const put = await api('PUT', `/api/employees/${id}`, { token: tokenFor('hr_admin'), body: { probation_end_date: null } });
    assert.strictEqual(put.status, 200, put.text);
    assert.strictEqual(rowOf(id).probation_end_date, null, 'a clear stores NULL, never a blank string');
    assert.strictEqual(timelineOf(await timelines(), id), null, 'and the hire leaves the panel');
  });

  test('a PUT that moves start_date past the stored end date is refused, and the row is untouched', async () => {
    const start = day(-10);
    const created = await api('POST', '/api/employees', { token: tokenFor('hr_admin'), body: hire({ start_date: start, probation_window_days: 90 }) });
    const id = created.json.id;
    const end = plusDays(start, 90);

    const put = await api('PUT', `/api/employees/${id}`, { token: tokenFor('hr_admin'), body: { start_date: plusDays(end, 5) } });
    assert.strictEqual(put.status, 400, `moving the anchor past the end must be refused, got ${put.status}: ${put.text}`);
    assert.match(put.json.error, /probation_end_date/);
    assert.strictEqual(put.json.field, 'probation_end_date');

    const row = rowOf(id);
    assert.strictEqual(row.start_date, start, 'the refused request changed nothing');
    assert.strictEqual(row.probation_end_date, end);
  });
});

// -------------------------------------------------------------
// The INSERT's two lists are POSITIONAL. This is the check that has to redden on a shift, not only on
// an omission: a column named in one list and not the other inserts a row whose every later value is
// one position off — the row still inserts, and nothing else in the suite notices.
// -------------------------------------------------------------

/** Split a comma-separated SQL fragment at TOP level, ignoring commas inside parens or quotes. */
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const ch of body) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; current += ch; continue; }
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim() !== '') parts.push(current.trim());
  return parts;
}

/** The `INSERT INTO <table> (…) VALUES (…)` statement for `table`, parsed into two lists. */
function parseInsert(src, table) {
  const start = src.indexOf(`INSERT INTO ${table} (`);
  assert.ok(start !== -1, `no INSERT INTO ${table} in server/index.js`);
  const afterTable = start + `INSERT INTO ${table} `.length;
  const readGroup = (from) => {
    assert.strictEqual(src[from], '(', `expected a column list at ${from}`);
    let depth = 0;
    for (let i = from; i < src.length; i += 1) {
      if (src[i] === '(') depth += 1;
      else if (src[i] === ')') { depth -= 1; if (depth === 0) return { body: src.slice(from + 1, i), end: i }; }
    }
    throw new Error('unbalanced parens');
  };
  const columns = readGroup(afterTable);
  const valuesKeyword = src.indexOf('VALUES', columns.end);
  assert.ok(valuesKeyword !== -1, 'the INSERT has no VALUES clause');
  const values = readGroup(src.indexOf('(', valuesKeyword));
  return { columns: splitTopLevel(columns.body), values: splitTopLevel(values.body) };
}

describe('the employee INSERT keeps its column list and value list paired', () => {
  const src = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  const insert = parseInsert(src, 'employees');

  test('both lists have the same length — one entry in one and not the other shifts every value after it', () => {
    // A vacuity guard first: a parser that read nothing would make the equality below true of nothing.
    assert.ok(insert.columns.length > 20,
      `parsed only ${insert.columns.length} columns — the parser is not reading the statement it judges`);
    assert.ok(insert.values.length > 20, `parsed only ${insert.values.length} values`);
    assert.strictEqual(insert.values.length, insert.columns.length,
      `the INSERT names ${insert.columns.length} columns and supplies ${insert.values.length} values — `
      + 'every value after the missing one is now in the wrong column');
  });

  test('probation_end_date is in the column list AND its value sits in the matching position', () => {
    const index = insert.columns.indexOf('probation_end_date');
    assert.notStrictEqual(index, -1, 'probation_end_date must be in the INSERT column list — without it a hire cannot be created on probation');
    assert.match(insert.values[index], /probation\.end_date/,
      `position ${index + 1} holds ${JSON.stringify(insert.values[index])}, which is not this column's value: `
      + 'the lists have shifted');
  });

  test('the columns around it are paired too — a shift of ANY value is a red, not just ours', () => {
    // The columns whose value is a caller field or a computed figure: each one must read THAT field at
    // its own position. A literal ('onboarding', 0) is not listed — there is nothing to pair it with.
    const expected = {
      id: /escapeString\(id\)/,
      first_name: /data\.first_name/,
      last_name: /data\.last_name/,
      email: /data\.email/,
      department: /data\.department/,
      role: /data\.role/,
      manager_id: /data\.manager_id/,
      start_date: /data\.start_date/,
      salary: /tSalary/,
      basic_salary: /bSalary/,
      national_id_value: /encryptedNationalId/,
      national_id_iqama: /encryptedIqama/,
      data_residency_country: /country/,
      jurisdiction: /country/,
      total_salary: /tSalary/,
      eosb_accrued: /eosbAccrued/,
      unpaid_leave_days: /data\.unpaid_leave_days/,
      probation_end_date: /probation\.end_date/,
    };
    const wrong = [];
    for (const [column, pattern] of Object.entries(expected)) {
      const index = insert.columns.indexOf(column);
      if (index === -1) { wrong.push(`${column}: not in the column list`); continue; }
      if (!pattern.test(insert.values[index])) wrong.push(`${column}: position ${index + 1} holds ${insert.values[index]}`);
    }
    assert.deepStrictEqual(wrong, [], `these columns do not hold their own value: ${wrong.join('; ')}`);
  });
});
