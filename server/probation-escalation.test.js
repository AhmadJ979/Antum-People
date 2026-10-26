/**
 * P3-3 (row `bb60c7a3`) — a probation milestone that passes its deadline with no submitted evaluation
 * escalates to the manager's manager AND to HR, once, attributable, and stored.
 *
 * WHAT THIS HOLDS, and why each case is here. The acceptance criteria are the row's own four, and
 * every one of them is a claim that could be satisfied by a green-looking instrument that measures
 * nothing, so each is measured against the thing that can disagree with it:
 *
 *   * **triggered by the deadline, not by someone noticing** — a milestone due TODAY escalates on no
 *     tick, and the SAME fixture escalates on the next day's tick. The control is in the same test:
 *     the day-0 tick is asserted to have written nothing, so the day-1 row is not a fixture artefact;
 *   * **names the overdue milestone and the reporting line** — the row carries the milestone index,
 *     its due date and its day, plus the chain resolved at firing time (`manager`, `managers_manager`,
 *     `hr`). The chain is resolved from `employees.manager_id`, so the test's fixture is a real
 *     3-level line, and the negative case — a hire with no `manager_id` — asserts the missing link is
 *     NAMED rather than filled with an invented recipient;
 *   * **idempotent: one escalation per missed milestone, not one per scheduler tick** — a second tick
 *     adds nothing, and a BRAND NEW watcher (the restart) adds nothing either. That second half is the
 *     point: an in-process "already seen" set is gone on restart, so the guarantee is asserted against
 *     a fresh process's memory with the database unchanged;
 *   * **stored so HR can see when it fired and to whom** — the row exists, `detected_at` is set, the
 *     chain is in it, and the read side returns it to HR over HTTP (200). The audience is measured in
 *     both directions: HR and finance reach it, a manager is refused with the gate's own empty 403,
 *     and a hire cannot read the company's escalation list.
 *
 * TWO MORE THINGS THIS FILE EXISTS FOR, both measured rather than asserted from the header:
 *
 *   * **the last milestone.** A 90-day window's third milestone falls ON the probation's end date —
 *     the deadline the row names in its own title. The timeline route deliberately reports no timeline
 *     for a window that has ended, so this suite pins BOTH halves: the ended hire is absent from
 *     `GET /api/probation/timelines` AND its three missed milestones are in the escalation table.
 *     Without `includeEnded` the escalation would be blind to the one deadline that matters most;
 *   * **no delivery.** Every row's `channel` is `none` and the route's payload carries the sentence
 *     that says so. A record is not a message, and this product has no mailer, webhook or SMS.
 *
 * It runs the rule in-process against a scratch database (clock injected, exact instants) and then a
 * REAL server on a scratch port against the same throwaway database, and it never touches the live
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

const SCRATCH_DB = path.join(os.tmpdir(), `antum-p33-${randomUUID()}.db`);
process.env.PRODUCT_DB_PATH = SCRATCH_DB;
process.env.JWT_SECRET = 'p33-test-secret-not-a-production-key';
process.env.ENCRYPTION_KEY = 'a'.repeat(32);

const access = require('./access');
const escalation = require('./probation-escalation');
const probationTimeline = require('./probation-timeline');

const DAY = 86400000;
const TODAY = new Date().toISOString().slice(0, 10);
const todayMs = Date.parse(`${TODAY}T00:00:00Z`);
const day = (offset) => new Date(todayMs + offset * DAY).toISOString().slice(0, 10);

// The fixture line: Big Boss ← Boss ← the hires. `pe3-manager` is the hire's DIRECT manager, and the
// escalation goes to the manager's manager (Big Boss) and to HR — never to the direct manager, which
// is the property the chain assertion exists for.
const BIG_BOSS = 'pe3-big-boss';
const BOSS = 'pe3-manager';
const OVERDUE = 'pe3-hire-overdue';      // 90-day window at day -70 → milestones at -40 and -10 are missed
const DONE = 'pe3-hire-done';            // same window, milestone 1 submitted → only milestone 2 fires
const DUE_TODAY = 'pe3-hire-due-today';  // milestone 1 falls due TODAY → nothing fires until tomorrow
const ENDED = 'pe3-hire-ended';          // window ended 10 days ago → the final milestone is missed
const NO_LINE = 'pe3-hire-no-line';      // no manager_id → the missing link must be named, not invented
const TERMINATED = 'pe3-hire-terminated'; // left the company → not on probation, nothing to escalate
const OTHERWISE_DONE = 'pe3-hire-done-later'; // escalated in the morning, submitted in the afternoon

const HR_ACCOUNT = 'pe3-hr';
const MANAGER_ACCOUNT = 'pe3-manager-user';
const EMPLOYEE_ACCOUNT = 'pe3-hire-user';
const FINANCE_ACCOUNT = 'pe3-finance';
const PASSWORD = 'scratch-instance-password-1';

const rawDb = (fn) => {
  const handle = new DatabaseSync(SCRATCH_DB);
  try { return fn(handle); } finally { handle.close(); }
};
const rows = (sql, ...params) => rawDb((h) => h.prepare(sql).all(...params));
const escalationsFor = (employeeId) =>
  rows('SELECT * FROM probation_escalations WHERE employee_id = ? ORDER BY milestone_index', employeeId);
const countWhere = (sql, ...params) => rawDb((h) => h.prepare(sql).get(...params)).n;
const auditRows = () => rows("SELECT * FROM audit_logs WHERE entity_type = 'probation_escalations' ORDER BY timestamp");

/** A fresh watcher, i.e. a fresh process for the restart cases below. */
const watcherStartingAt = (iso) => escalation.createEscalationWatcher({ clock: () => new Date(iso) });

let server;
let PORT;
const BASE = () => `http://127.0.0.1:${PORT}`;
const api = async (method, urlPath, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE() + urlPath, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let text = '';
  try { text = await res.text(); } catch { /* an empty body is a valid answer here */ }
  return { status: res.status, text, json: text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null };
};
const TOKENS = new Map();
async function tokenFor(username) {
  if (!TOKENS.has(username)) {
    const r = await api('POST', '/api/login', { body: { username, password: PASSWORD } });
    assert.strictEqual(r.status, 200, `the fixture account ${username} must be able to log in (${r.text})`);
    TOKENS.set(username, r.json.token);
  }
  return TOKENS.get(username);
}

before(() => {
  const handle = new DatabaseSync(SCRATCH_DB);
  handle.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const insertUser = handle.prepare('INSERT INTO users (id, username, password_hash, access_role, employee_id) VALUES (?, ?, ?, ?, ?)');
  insertUser.run(randomUUID(), HR_ACCOUNT, bcrypt.hashSync(PASSWORD, 4), access.ROLES.HR_ADMIN, null);
  insertUser.run(randomUUID(), MANAGER_ACCOUNT, bcrypt.hashSync(PASSWORD, 4), access.ROLES.MANAGER, BOSS);
  insertUser.run(randomUUID(), EMPLOYEE_ACCOUNT, bcrypt.hashSync(PASSWORD, 4), access.ROLES.EMPLOYEE, OVERDUE);
  insertUser.run(randomUUID(), FINANCE_ACCOUNT, bcrypt.hashSync(PASSWORD, 4), access.ROLES.FINANCE, null);

  const insertEmployee = handle.prepare(`INSERT INTO employees
    (id, first_name, last_name, email, department, role, manager_id, start_date, probation_end_date, status, salary, basic_salary)
    VALUES (?, ?, 'Person', ?, 'Operations', 'Analyst', ?, ?, ?, ?, 1000, 500)`);
  insertEmployee.run(BIG_BOSS, 'Big', `${BIG_BOSS}@example.invalid`, null, day(-400), null, 'active');
  insertEmployee.run(BOSS, 'Line', `${BOSS}@example.invalid`, BIG_BOSS, day(-300), null, 'active');
  insertEmployee.run(OVERDUE, 'Ola', `${OVERDUE}@example.invalid`, BOSS, day(-70), day(20), 'onboarding');
  insertEmployee.run(DONE, 'Dana', `${DONE}@example.invalid`, BOSS, day(-70), day(20), 'onboarding');
  insertEmployee.run(DUE_TODAY, 'Tarek', `${DUE_TODAY}@example.invalid`, BOSS, day(-30), day(60), 'onboarding');
  insertEmployee.run(ENDED, 'Eman', `${ENDED}@example.invalid`, BOSS, day(-100), day(-10), 'onboarding');
  insertEmployee.run(NO_LINE, 'Nour', `${NO_LINE}@example.invalid`, null, day(-70), day(20), 'onboarding');
  insertEmployee.run(TERMINATED, 'Tariq', `${TERMINATED}@example.invalid`, BOSS, day(-70), day(20), 'terminated');
  insertEmployee.run(OTHERWISE_DONE, 'Omar', `${OTHERWISE_DONE}@example.invalid`, BOSS, day(-70), day(20), 'onboarding');

  // P3-2's completion state, written the way the product writes it (the submission IS the completion).
  handle.prepare(`INSERT INTO probation_evaluations
    (id, employee_id, milestone_index, milestone_due_date, milestone_day, content, submitted_by, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(randomUUID(), DONE, 1, day(-40), 30, 'Probation review held; on track.', MANAGER_ACCOUNT, `${day(-38)}T09:00:00.000Z`);
  handle.close();
});

after(() => {
  if (server) server.kill('SIGKILL');
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(SCRATCH_DB + suffix); } catch { /* not there */ }
  }
});

describe('P3-3 · the rule — a deadline strictly behind the reading day, and no submission', () => {
  test('the milestone dates are derived, and a milestone due today is not yet overdue', () => {
    const hire = { id: DUE_TODAY, start_date: day(-30), probation_end_date: day(60) };
    const { timeline, overdue } = escalation.overdueMilestones(hire, { now: TODAY });
    assert.deepStrictEqual(timeline.milestones.map((m) => m.due_date), [day(0), day(30), day(60)],
      'a 90-day window derives its thirds and its end from the start date');
    assert.deepStrictEqual(overdue, [], 'the milestone that falls due TODAY is `due`, not overdue');

    const tomorrow = escalation.overdueMilestones(hire, { now: day(1) });
    assert.deepStrictEqual(tomorrow.overdue.map((m) => m.index), [1],
      'one day later the same milestone IS overdue — the state is the clock\'s, not a flag\'s');

    const hireNoWindow = { id: 'x', start_date: day(-10), probation_end_date: null };
    assert.deepStrictEqual(escalation.overdueMilestones(hireNoWindow, { now: TODAY }).overdue, [],
      'a hire with no probation window has no milestones and nothing to escalate');
  });

  test('the deadline, not somebody noticing: the tick before the deadline writes nothing, the one after writes it', async () => {
    // The process was already up when this deadline passed, so this is the not-late polarity — the
    // control for the catch-up case further down.
    const watcher = watcherStartingAt(`${day(-5)}T00:00:00Z`);
    const before = await watcher.tick(new Date(`${TODAY}T12:00:00Z`));
    assert.strictEqual(before.added.filter((r) => r.employee_id === DUE_TODAY).length, 0,
      'nothing is written on a tick that falls on the deadline day itself');
    assert.strictEqual(escalationsFor(DUE_TODAY).length, 0, 'and nothing reached the table');

    const after = await watcher.tick(new Date(`${day(1)}T12:00:00Z`));
    const fired = after.added.filter((r) => r.employee_id === DUE_TODAY);
    assert.strictEqual(fired.length, 1, 'the day after the deadline, the missed milestone escalates');
    assert.strictEqual(fired[0].milestone_index, 1);
    assert.strictEqual(fired[0].milestone_due_date, TODAY, 'the row names the deadline it passed');
    assert.strictEqual(fired[0].late, false, 'it fell due while this process was up');
    assert.match(fired[0].note, /The deadline fell after this escalation watcher started/);
    assert.match(fired[0].note, /with no submitted evaluation/,
      'the note still states the fact the escalation is about');
    assert.doesNotMatch(fired[0].note, /while the app|app was (not )?running|was open/,
      'and it makes no claim about whether the app was up: this clock comparison can only see its own start');
  });

  test('one escalation per missed milestone, naming the milestone and the reporting line', async () => {
    const watcher = watcherStartingAt(`${TODAY}T06:00:00Z`);
    await watcher.tick(new Date(`${TODAY}T06:00:00Z`));

    const fired = escalationsFor(OVERDUE);
    assert.strictEqual(fired.length, 2, 'a 90-day window 70 days in has exactly two missed milestones (30 and 60)');
    assert.deepStrictEqual(fired.map((r) => r.milestone_index), [1, 2]);
    assert.deepStrictEqual(fired.map((r) => r.milestone_due_date), [day(-40), day(-10)]);

    const line = JSON.parse(fired[0].reporting_line);
    assert.deepStrictEqual(line.manager, { employee_id: BOSS, name: 'Line Person' }, 'the direct manager is named in the record');
    assert.deepStrictEqual(line.managers_manager, { employee_id: BIG_BOSS, name: 'Big Person' },
      'the escalation is addressed to the manager\u2019s manager — the row\u2019s own words');
    assert.deepStrictEqual(line.hr, [{ username: HR_ACCOUNT, employee_id: null, name: null }],
      'and to HR, named as the accounts that hold the HR role');
    assert.strictEqual(line.resolved, true);
    assert.deepStrictEqual(JSON.parse(fired[0].reporting_line_missing), []);
    assert.strictEqual(fired[0].channel, 'none', 'nothing is delivered: the row says so itself');
    assert.strictEqual(fired[0].fired_by, escalation.FIRED_BY);
    assert.ok(fired[0].detected_at, 'when it fired is stored');
    assert.strictEqual(fired[0].employee_name, 'Ola Person');
  });

  test('a milestone already completed by a submission does not escalate, and its neighbour still does', async () => {
    const watcher = watcherStartingAt(`${TODAY}T06:00:00Z`);
    await watcher.tick(new Date(`${TODAY}T06:00:00Z`));
    const fired = escalationsFor(DONE);
    assert.deepStrictEqual(fired.map((r) => r.milestone_index), [2],
      'P3-2\u2019s submission is what makes milestone 1 complete, so only milestone 2 is missed');
    assert.strictEqual(fired.length, 1, 'exactly one row: the submission did not suppress the whole timeline');
  });

  test('the final milestone escalates after the window has ENDED — the deadline the row is named for', async () => {
    const watcher = watcherStartingAt(`${TODAY}T06:00:00Z`);
    await watcher.tick(new Date(`${TODAY}T06:00:00Z`));
    const fired = escalationsFor(ENDED);
    assert.deepStrictEqual(fired.map((r) => r.milestone_index), [1, 2, 3],
      'all three of an ended window\u2019s milestones are missed, including the one on the end date');
    assert.strictEqual(fired[2].milestone_due_date, day(-10), 'and the third one IS the probation deadline');

    // The other half, measured here so a later re-ground cannot quietly satisfy one side only: the
    // screen-facing derivation still reports NO timeline for an ended window.
    const ended = probationTimeline.milestonesFor({ id: ENDED, start_date: day(-100), probation_end_date: day(-10) }, { now: TODAY });
    assert.strictEqual(ended, null, 'the timeline route\u2019s derivation still omits an ended window');
  });

  test('idempotent: a second tick, and a restarted process, write nothing twice', async () => {
    const before = escalationsFor(OVERDUE).length;
    const sameProcess = watcherStartingAt(`${TODAY}T06:00:00Z`);
    await sameProcess.tick(new Date(`${TODAY}T06:00:00Z`));
    assert.strictEqual(escalationsFor(OVERDUE).length, before, 'a second tick adds no row');

    // A NEW watcher is a new process: its `seen` set is empty, and the table is what has to refuse.
    const restarted = watcherStartingAt(`${TODAY}T09:30:00Z`);
    const result = await restarted.tick(new Date(`${TODAY}T09:30:00Z`));
    assert.strictEqual(result.added.filter((r) => r.employee_id === OVERDUE).length, 0,
      'the restart re-derives the same missed milestones and writes none of them again');
    assert.strictEqual(escalationsFor(OVERDUE).length, before, 'the table is what makes that true');
    assert.strictEqual(countWhere('SELECT COUNT(*) AS n FROM probation_escalations WHERE employee_id = ? AND milestone_index = 1', OVERDUE), 1,
      'one escalation per missed milestone, for good');
  });

  test('a reporting line that cannot be resolved is named, never invented', async () => {
    const watcher = watcherStartingAt(`${day(-2)}T00:00:00Z`);
    await watcher.tick(new Date(`${TODAY}T06:00:00Z`));
    const fired = escalationsFor(NO_LINE);
    assert.strictEqual(fired.length, 2, 'a hire with no manager still escalates — to HR');
    const line = JSON.parse(fired[0].reporting_line);
    assert.strictEqual(line.manager, null, 'no manager is recorded as no manager');
    assert.strictEqual(line.managers_manager, null);
    assert.deepStrictEqual(line.missing, ['manager', 'managers_manager'], 'the missing links are NAMED');
    assert.deepStrictEqual(JSON.parse(fired[0].reporting_line_missing), ['manager', 'managers_manager']);
    assert.strictEqual(line.resolved, false);
    assert.strictEqual(line.hr.length, 1, 'HR is still addressed, which is the half that exists');
    // A stored row carries SQLite's 1/0; the read side (and every payload built from it) is a boolean.
    assert.strictEqual(fired[0].late, 1, 'this deadline fell before the process that recorded it started');
    assert.match(fired[0].note, /The deadline fell before this escalation watcher started/);
    assert.match(fired[0].note, /first seen \d{4}-\d{2}-\d{2}T[0-9:.]+Z/,
      'the note states when it was first seen — the one fact a late catch-up actually establishes');
    assert.match(fired[0].note, new RegExp(`\\(${fired[0].late_by_hours}h after the deadline\\)`),
      'and how long after the deadline that was, matching the row\u2019s own late_by_hours: the arithmetic stays, only the invented cause went');
    assert.doesNotMatch(fired[0].note, /while the app|app was (not )?running|was open/,
      'and it does not tell HR the product was down when it was serving');
  });

  test('a hire who has left is not on probation and never escalates', async () => {
    const watcher = watcherStartingAt(`${TODAY}T06:00:00Z`);
    await watcher.tick(new Date(`${TODAY}T06:00:00Z`));
    assert.strictEqual(escalationsFor(TERMINATED).length, 0,
      'a terminated hire\u2019s probation is not running: no row, and no invented one');
  });

  test('every escalation names its actor and writes an audit row', async () => {
    const audit = auditRows();
    const total = countWhere('SELECT COUNT(*) AS n FROM probation_escalations');
    assert.strictEqual(audit.length, total, 'one audit row per escalation, no more and no fewer');
    for (const row of audit) {
      assert.strictEqual(row.performed_by, escalation.FIRED_BY,
        'the actor is the watcher\u2019s own name — never blank, and never a person');
      assert.notStrictEqual(row.performed_by, 'system');
      assert.ok(row.performed_by.trim().length > 0);
      assert.strictEqual(row.action, 'CREATE');
    }
    const targeted = audit.filter((row) => JSON.parse(row.new_values).employee_id === OVERDUE);
    assert.strictEqual(targeted.length, 2);
    const addressed = JSON.parse(targeted[0].new_values).addressed_to;
    assert.strictEqual(addressed.managers_manager.name, 'Big Person');
    assert.deepStrictEqual(addressed.hr, [HR_ACCOUNT]);
    assert.strictEqual(JSON.parse(targeted[0].new_values).channel, 'none');
  });

  test('the read side returns the record AS IT FIRED, and resolves it with a later submission', async () => {
    // The milestone that escalated in the morning is submitted in the afternoon. The escalation must
    // not be rewritten by that: it happened. What changes is a different question — "was it done?".
    const fired = escalationsFor(OTHERWISE_DONE).filter((r) => r.milestone_index === 1);
    if (fired.length === 0) {
      const watcher = watcherStartingAt(`${TODAY}T06:00:00Z`);
      await watcher.tick(new Date(`${TODAY}T06:00:00Z`));
    }
    rawDb((h) => h.prepare(`INSERT INTO probation_evaluations
      (id, employee_id, milestone_index, milestone_due_date, milestone_day, content, submitted_by, submitted_at)
      VALUES (?, ?, 1, ?, 30, 'Late review, completed.', ?, ?)`)
      .run(randomUUID(), OTHERWISE_DONE, day(-40), MANAGER_ACCOUNT, `${TODAY}T15:00:00.000Z`));

    const listed = await escalation.listEscalations({ employee_id: OTHERWISE_DONE });
    const first = listed.find((r) => r.milestone_index === 1);
    assert.ok(first, 'the escalation is still listed after the milestone was completed');
    assert.strictEqual(first.resolved, true);
    assert.strictEqual(first.completed_at, `${TODAY}T15:00:00.000Z`, 'the completion is DERIVED on read');
    assert.strictEqual(first.detected_at.startsWith(TODAY), true, 'and the firing time is unchanged');
    assert.deepStrictEqual(first.reporting_line.managers_manager, { employee_id: BIG_BOSS, name: 'Big Person' });
    const second = listed.find((r) => r.milestone_index === 2);
    assert.ok(second, 'the milestone beside it is listed too — its deadline passed and nothing was submitted');
    assert.strictEqual(second.resolved, false, 'and it is not resolved: an escalation is only resolved by a submission');
    assert.strictEqual(second.completed_at, null);
    assert.strictEqual(first.resolved, true, 'the two rows differ only in the answer to "was it done anyway?"');
  });

  test('a Date is read as the day it names, not as today', () => {
    // The trap this pins, measured 2026-10-26: `milestonesFor` documents `now` as `Date|string`, and a
    // Date used to fail the shape test and fall silently through to TODAY — so a clock-injected caller
    // read the wrong day while every assertion in its own suite passed. The two readings must be equal.
    const hire = { id: DUE_TODAY, start_date: day(-30), probation_end_date: day(60) };
    const asString = probationTimeline.milestonesFor(hire, { now: day(1) });
    const asDate = probationTimeline.milestonesFor(hire, { now: new Date(`${day(1)}T00:00:00Z`) });
    const asTimestamp = probationTimeline.milestonesFor(hire, { now: new Date(`${day(1)}T23:59:00Z`) });
    assert.deepStrictEqual(asDate.milestones, asString.milestones);
    assert.deepStrictEqual(asTimestamp.milestones, asString.milestones,
      'a timestamp is read as the UTC day it falls in, whatever the hour');
    assert.strictEqual(asDate.milestones[0].state, 'overdue',
      'and that day is the one asked for: the milestone due yesterday is overdue');
    assert.notDeepStrictEqual(asDate.milestones, probationTimeline.milestonesFor(hire, { now: TODAY }).milestones,
      'the two days read differently, which is what makes the equality above worth asserting');
  });
});

describe('P3-3 · the route — HR reads when it fired and to whom', () => {
  before(async () => {
    PORT = 31000 + Math.floor(Math.random() * 20000);
    server = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
      env: { ...process.env, PORT: String(PORT), PRODUCT_DB_PATH: SCRATCH_DB },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', () => {});
    server.stderr.on('data', () => {});
    const deadline = Date.now() + 30000;
    for (;;) {
      try { await fetch(`${BASE()}/api/employees`); break; }
      catch { if (Date.now() > deadline) throw new Error('the scratch server never answered'); await new Promise((r) => setTimeout(r, 250)); }
    }
  });

  test('HR reads the escalations: 200, with the count, the no-delivery note and the watch\u2019s own state', async () => {
    const r = await api('GET', '/api/probation/escalations', { token: await tokenFor(HR_ACCOUNT) });
    assert.strictEqual(r.status, 200, `the route must answer 200 (got ${r.status}: ${r.text})`);
    assert.ok(r.json.count > 0, 'the fixture has escalations already recorded, so the list is not empty');
    assert.strictEqual(r.json.count, r.json.escalations.length);
    assert.match(r.json.note, /no mailer, no webhook and no SMS/);
    assert.strictEqual(r.json.watcher.delivery, 'none');
    assert.ok(r.json.watcher.last_scan_at, 'the first tick IS the catch-up, so the watch has already run');
    assert.strictEqual(r.json.watcher.last_error, null);
    const overdueRow = r.json.escalations.find((e) => e.employee_id === OVERDUE);
    assert.strictEqual(overdueRow.milestone_index, 1);
    assert.strictEqual(overdueRow.reporting_line.managers_manager.name, 'Big Person');
    assert.ok(overdueRow.detected_at);
  });

  test('the list can be read for one employee', async () => {
    const r = await api('GET', `/api/probation/escalations?employee_id=${OVERDUE}`, { token: await tokenFor(HR_ACCOUNT) });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual([...new Set(r.json.escalations.map((e) => e.employee_id))], [OVERDUE]);
    assert.strictEqual(r.json.count, 2);
  });

  test('finance reaches it too — its `employees:read` scope is the company-wide one', async () => {
    const r = await api('GET', '/api/probation/escalations', { token: await tokenFor(FINANCE_ACCOUNT) });
    assert.strictEqual(r.status, 200, 'the §3.1 row says finance reads it: measured, not asserted in the doc alone');
  });

  test('a manager is refused with the gate\u2019s own shape — and reads the same fact from the timeline route', async () => {
    const refused = await api('GET', '/api/probation/escalations', { token: await tokenFor(MANAGER_ACCOUNT) });
    assert.strictEqual(refused.status, 403, 'the record names the chain ABOVE the report, so `reports` is not enough');
    assert.strictEqual(refused.text, '', 'an empty body is the refusal-in-place the client classifies');

    // The positive control for that refusal: the manager can still see the report's overdue milestones
    // — the same fact without the roll-up of who was told. Without this, the 403 could be a broken route.
    const timelines = await api('GET', '/api/probation/timelines', { token: await tokenFor(MANAGER_ACCOUNT) });
    assert.strictEqual(timelines.status, 200);
    const mine = timelines.json.timelines.find((t) => t.employee_id === OVERDUE);
    assert.deepStrictEqual(mine.milestones.filter((m) => m.state === 'overdue').map((m) => m.index), [1, 2]);
  });

  test('an employee is refused, and a token is required at all', async () => {
    const asEmployee = await api('GET', '/api/probation/escalations', { token: await tokenFor(EMPLOYEE_ACCOUNT) });
    assert.strictEqual(asEmployee.status, 403, 'a hire does not read the company\u2019s escalation list');
    assert.strictEqual(asEmployee.text, '');

    const anonymous = await api('GET', '/api/probation/escalations');
    assert.strictEqual(anonymous.status, 401);

    const nameless = await api('GET', '/api/probation/escalations', {
      token: jwt.sign({ id: 'scratch', access_role: access.ROLES.HR_ADMIN }, process.env.JWT_SECRET, { expiresIn: '5m' }),
    });
    assert.strictEqual(nameless.status, 200, 'an HR token with no person is still HR: the read names nobody new');
  });

  test('the ended window is absent from the timeline route and present in the escalations', async () => {
    const timelines = await api('GET', '/api/probation/timelines', { token: await tokenFor(HR_ACCOUNT) });
    assert.strictEqual(timelines.status, 200);
    assert.strictEqual(timelines.json.timelines.find((t) => t.employee_id === ENDED), undefined,
      'the screen-facing route omits a probation that has ended — which is why the escalation needs its own read');

    const list = await api('GET', `/api/probation/escalations?employee_id=${ENDED}`, { token: await tokenFor(HR_ACCOUNT) });
    assert.strictEqual(list.status, 200);
    assert.deepStrictEqual(list.json.escalations.map((e) => e.milestone_index).sort(), [1, 2, 3],
      'and the missed final milestone is what the escalation exists to catch');
  });
});
