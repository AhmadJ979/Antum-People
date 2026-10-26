/**
 * P3-2 (row `69dbf57d`) — a probation milestone cannot be marked complete without a SUBMITTED manager
 * evaluation, time-stamped and attributable, and an empty submission is refused.
 *
 * WHAT THIS HOLDS, and why each case is here:
 *   * the route answers **200** and says `completions_recorded: true`. That assertion is the reason
 *     this file exists in the shape it does: before it, nothing in the suite ever read the timeline
 *     route's body, so `GET /api/probation/timelines` could answer 500 — and did, from the day P3-1
 *     shipped until P3-2, because `probationTimeline` was never bound in `server/index.js`. A check
 *     that cannot redden proves nothing; this one reddens if that binding disappears again;
 *   * **no submission, no completion**: the states are date-derived until an evaluation is stored, and
 *     a hire with an evaluation has exactly ONE milestone completed — not the whole timeline;
 *   * the submission is **attributable** (`submitted_by` is the signed-in manager, not `'system'` and
 *     not a shared account) and **time-stamped**, and it writes the audit row decision 22 requires;
 *   * the refusals, each with the reason it is a refusal rather than a default: an empty form (400), an
 *     index this hire does not have (400, carrying the valid set), a hire with no probation window
 *     (400), an unknown employee (404), a second submission for the same milestone (409, with the first
 *     row proven untouched);
 *   * **the actor gate comes first**: an unnamed token gets 400 for an employee that does not exist too,
 *     so it cannot use the status code to learn whether the row is there;
 *   * the row scope: a manager submits for their own line and **cannot write into another manager's**
 *     (403, empty body — the gate's own shape, which the client reads as a refusal in place), and a
 *     hire cannot submit an evaluation about themselves. The positive control is in the same test: the
 *     manager's own report submission is a 201, so the 403s are not vacuous.
 *
 * It runs a REAL server on a scratch port against a throwaway database, and it never touches the live
 * service, the live database or the live credential (WORKFLOW rules 5, 10, 14).
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

const SCRATCH_DB = path.join(os.tmpdir(), `antum-p32-${randomUUID()}.db`);
const PORT = 31000 + Math.floor(Math.random() * 20000);
const BASE = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = 'p32-test-secret-not-a-production-key';
const ENCRYPTION_KEY = 'a'.repeat(32); // 32 bytes, as server/auth.js reads it
const PASSWORD = 'scratch-instance-password-1';

const HR = 'p32-hr';
const MANAGER = 'p32-manager';
const EMPLOYEE = 'p32-employee';

// The fixture's people. `pe-report` is the manager's own line, `pe-elsewhere` belongs to someone else,
// and `pe-nowindow` is on nobody's probation — three different reasons to be refused.
const BOSS = 'pe-boss';
const REPORT = 'pe-report';
const ELSEWHERE = 'pe-elsewhere';
const NOWINDOW = 'pe-nowindow';

const DAY = 86400000;
const day = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
// A 90-day probation that is still RUNNING (start 20 days ago, last day 70 days out), so its three
// milestones are the thirds and the end: days 30, 60 and 90 after the start date.
const START = day(-20);
const END = day(70);

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
const rows = (sql, ...params) => rawDb((db) => db.prepare(sql).all(...params));
const countEvaluations = () => rawDb((db) => db.prepare('SELECT COUNT(*) AS n FROM probation_evaluations').get()).n;
const countAudit = () => rawDb((db) => db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type = 'probation_evaluations'").get()).n;

const TOKENS = new Map();
async function tokenFor(username) {
  if (!TOKENS.has(username)) {
    const r = await api('POST', '/api/login', { body: { username, password: PASSWORD } });
    assert.strictEqual(r.status, 200, `the fixture account ${username} must be able to log in`);
    TOKENS.set(username, r.json.token);
  }
  return TOKENS.get(username);
}
// A token that names a ROLE and no person — the shape decision 22 refuses on a write.
const namelessToken = () => jwt.sign({ id: 'scratch', access_role: access.ROLES.HR_ADMIN }, JWT_SECRET, { expiresIn: '5m' });

const submit = (token, employeeId, body) => api('POST', `/api/employees/${employeeId}/probation-evaluations`, { token, body });

/** The timeline route, with its 200 asserted: a 500 here is the defect this file was written after. */
async function timelines(token, query = '') {
  const r = await api('GET', `/api/probation/timelines${query}`, { token });
  assert.strictEqual(r.status, 200, `GET /api/probation/timelines must answer 200 (got ${r.status}: ${r.text})`);
  return r.json;
}
const timelineOf = (payload, employeeId) => {
  const found = (payload.timelines || []).find((t) => t.employee_id === employeeId);
  assert.ok(found, `${employeeId} must be in the probation list`);
  return found;
};

before(async () => {
  const db = new DatabaseSync(SCRATCH_DB);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const insertUser = db.prepare('INSERT INTO users (id, username, password_hash, access_role) VALUES (?, ?, ?, ?)');
  insertUser.run(randomUUID(), HR, bcrypt.hashSync(PASSWORD, 4), access.ROLES.HR_ADMIN);

  const insertEmployee = db.prepare(`INSERT INTO employees
    (id, first_name, last_name, email, department, role, manager_id, start_date, probation_end_date, salary, basic_salary, data_residency_country)
    VALUES (?, ?, 'Person', ?, 'Operations', 'Analyst', ?, ?, ?, 1000, 500, 'AE')`);
  insertEmployee.run(BOSS, 'Boss', `${BOSS}@example.invalid`, null, START, null);
  insertEmployee.run(REPORT, 'Report', `${REPORT}@example.invalid`, BOSS, START, END);
  insertEmployee.run(ELSEWHERE, 'Elsewhere', `${ELSEWHERE}@example.invalid`, 'pe-other-boss', START, END);
  insertEmployee.run(NOWINDOW, 'NoWindow', `${NOWINDOW}@example.invalid`, BOSS, START, null);
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

  // The scoped accounts, created the way the product creates them: HTTP, by HR, with the account →
  // person link. A MANAGER's scope then resolves against the link, which is what the row-scope cases
  // below measure.
  const admin = await tokenFor(HR);
  for (const [username, access_role, employee_id] of [
    [MANAGER, access.ROLES.MANAGER, BOSS],
    [EMPLOYEE, access.ROLES.EMPLOYEE, REPORT],
  ]) {
    const r = await api('POST', '/api/users', { token: admin, body: { username, password: PASSWORD, access_role, employee_id } });
    assert.strictEqual(r.status, 201, `the fixture account ${username} must be creatable (${r.text})`);
  }
});

after(() => {
  if (server) server.kill('SIGKILL');
  for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(SCRATCH_DB + suffix); } catch { /* not there */ } }
});

describe('P3-2 — a milestone is completed only by a submitted evaluation', () => {
  test('the route answers 200 with completions_recorded true, and no milestone is completed yet', async () => {
    const payload = await timelines(await tokenFor(HR));
    assert.strictEqual(payload.completions_recorded, true, 'submissions are stored, so the flag is true');
    const mine = timelineOf(payload, REPORT);
    assert.strictEqual(mine.milestones.length, 3, 'a 90-day window has three milestones');
    for (const m of mine.milestones) {
      assert.notStrictEqual(m.state, 'completed', 'nothing is completed before anything is submitted');
      assert.strictEqual(m.completion, null);
    }
  });

  test('an empty submission is refused 400 — in all three shapes — and records nothing at all', async () => {
    const token = await tokenFor(MANAGER);
    assert.strictEqual(countEvaluations(), 0);
    for (const body of [{ milestone_index: 1, content: '' }, { milestone_index: 1, content: '   ' }, { milestone_index: 1 }]) {
      const r = await submit(token, REPORT, body);
      assert.strictEqual(r.status, 400, `${JSON.stringify(body)} must be refused (got ${r.status}: ${r.text})`);
      assert.match(r.json.error, /content cannot be empty/);
    }
    assert.strictEqual(countEvaluations(), 0, 'nothing stored');
    assert.strictEqual(countAudit(), 0, 'and no audit row for a refused submission');
  });

  test('an UNNAMED token is refused 400, BEFORE any lookup — an unknown employee does not become a 404', async () => {
    const r = await submit(namelessToken(), 'no-such-employee', { milestone_index: 1, content: 'x' });
    assert.strictEqual(r.status, 400, 'the actor gate precedes the lookup (decision 22)');
    assert.strictEqual(countEvaluations(), 0);
  });

  test('an employee who does not exist is 404 once the caller IS named', async () => {
    const r = await submit(await tokenFor(MANAGER), 'no-such-employee', { milestone_index: 1, content: 'x' });
    assert.strictEqual(r.status, 404);
  });

  test('a milestone index this hire does not have is 400, and the valid set comes back', async () => {
    const r = await submit(await tokenFor(MANAGER), REPORT, { milestone_index: 4, content: 'x' });
    assert.strictEqual(r.status, 400);
    assert.deepStrictEqual(r.json.known_milestones.map((m) => m.index), [1, 2, 3]);
  });

  test('a hire with no probation window has no milestone to evaluate: 400', async () => {
    const r = await submit(await tokenFor(MANAGER), NOWINDOW, { milestone_index: 1, content: 'x' });
    assert.strictEqual(r.status, 400);
    assert.match(r.json.error, /no probation window/);
  });

  test('the submission lands: named manager, time-stamped, one audit row — and it completes THAT milestone', async () => {
    const r = await submit(await tokenFor(MANAGER), REPORT, { milestone_index: 1, content: 'Met the 30-day targets; the handover is on track.' });
    assert.strictEqual(r.status, 201, r.text);
    assert.strictEqual(r.json.evaluation.submitted_by, MANAGER, 'the record names the manager who wrote it');
    assert.strictEqual(r.json.evaluation.employee_id, REPORT);
    assert.strictEqual(r.json.evaluation.milestone_index, 1);
    assert.ok(!Number.isNaN(Date.parse(r.json.evaluation.submitted_at)), 'and carries a parseable timestamp');
    const stored = rows('SELECT * FROM probation_evaluations WHERE employee_id = ?', REPORT);
    assert.strictEqual(stored.length, 1);
    assert.strictEqual(stored[0].submitted_at, r.json.evaluation.submitted_at);

    const audit = rows("SELECT * FROM audit_logs WHERE entity_type = 'probation_evaluations'");
    assert.strictEqual(audit.length, 1, 'exactly one audit row');
    assert.strictEqual(audit[0].performed_by, MANAGER, 'the audit row names the actor (decision 22)');
    assert.strictEqual(audit[0].action, 'CREATE');
    assert.strictEqual(JSON.parse(audit[0].new_values).submitted_by, MANAGER);

    const payload = await timelines(await tokenFor(HR));
    const mine = timelineOf(payload, REPORT);
    const first = mine.milestones.find((m) => m.index === 1);
    assert.strictEqual(first.state, 'completed');
    assert.strictEqual(first.completion.completed_by, MANAGER);
    assert.strictEqual(first.completion.completed_at, r.json.evaluation.submitted_at);
    for (const m of mine.milestones.filter((x) => x.index !== 1)) {
      assert.notStrictEqual(m.state, 'completed', `milestone ${m.index} was not submitted`);
      assert.strictEqual(m.completion, null);
    }
    for (const m of timelineOf(payload, ELSEWHERE).milestones) {
      assert.notStrictEqual(m.state, 'completed', 'and no other hire is completed by this submission');
    }
  });

  test('a second submission for the same milestone is refused 409, and the first record is untouched', async () => {
    const before = rows('SELECT * FROM probation_evaluations WHERE employee_id = ?', REPORT);
    const r = await submit(await tokenFor(MANAGER), REPORT, { milestone_index: 1, content: 'Second thoughts.' });
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.json.recorded_by, MANAGER);
    const after = rows('SELECT * FROM probation_evaluations WHERE employee_id = ?', REPORT);
    assert.strictEqual(JSON.stringify(after), JSON.stringify(before), 'the first record is what stands');
    assert.strictEqual(countEvaluations(), 1, 'and no second row');
  });

  test('a reading pinned BEFORE the submission does not show it as completed', async () => {
    const payload = await timelines(await tokenFor(HR), `?as_of=${day(-1)}`);
    const first = timelineOf(payload, REPORT).milestones.find((m) => m.index === 1);
    assert.notStrictEqual(first.state, 'completed', 'as of yesterday, nothing had been submitted');
    assert.strictEqual(first.completion, null);
  });

  test('a manager may submit for their own line — and cannot write into another manager’s', async () => {
    const token = await tokenFor(MANAGER);
    const mine = await submit(token, REPORT, { milestone_index: 2, content: 'Second milestone met.' });
    assert.strictEqual(mine.status, 201, `the positive control: ${mine.text}`);
    const theirs = await submit(token, ELSEWHERE, { milestone_index: 1, content: 'Not my report.' });
    assert.strictEqual(theirs.status, 403);
    assert.strictEqual(theirs.text, '', 'the gate’s own shape: a refusal with no body');
    assert.strictEqual(rows('SELECT COUNT(*) AS n FROM probation_evaluations WHERE employee_id = ?', ELSEWHERE)[0].n, 0);
  });

  test('a hire cannot submit an evaluation about themselves: 403, nothing recorded', async () => {
    // Refused by the policy gate (no EMPLOYEE cell on `onboarding:write`) AND, if a cell ever grants
    // one, by the route's own SELF refusal — the record's premise is that a MANAGER wrote it. Both
    // answer with the gate's shape, so the observable is the same 403 with no body.
    const r = await submit(await tokenFor(EMPLOYEE), REPORT, { milestone_index: 3, content: 'I was excellent.' });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.text, '');
    assert.strictEqual(rows('SELECT COUNT(*) AS n FROM probation_evaluations WHERE employee_id = ? AND milestone_index = 3', REPORT)[0].n, 0);
  });
});
