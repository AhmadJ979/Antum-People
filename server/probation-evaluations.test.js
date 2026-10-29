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
const { spawn, execFileSync } = require('node:child_process');
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
// Two more people the correction path needs and the submission path cannot produce (P3-2 follow-up,
// row `0484e79e`, owner decision (A)): a hire whose probation window has ENDED — where the correction
// route deliberately succeeds while the submit route answers 400 — and a hire whose milestones went
// past their deadlines, so the escalation watcher fires on its first tick and a correction can be shown
// not to rewrite what fired.
const ENDED = 'pe-ended';
const LATE = 'pe-late';

const DAY = 86400000;
const day = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
// A 90-day probation that is still RUNNING (start 20 days ago, last day 70 days out), so its three
// milestones are the thirds and the end: days 30, 60 and 90 after the start date.
const START = day(-20);
const END = day(70);
// The two windows the correction tests need, named so the numbers in the prose above and the rows in
// the fixture cannot drift apart.
const ENDED_START = day(-120);
const ENDED_END = day(-30);
const LATE_START = day(-80);
const LATE_END = day(10);

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
  // A window that has ENDED (start 120 days ago, last day 30 days back) — the submit route refuses it,
  // the correction route must not. `ENDED_START` is exported to the correction tests below.
  insertEmployee.run(ENDED, 'Ended', `${ENDED}@example.invalid`, BOSS, ENDED_START, ENDED_END);
  // A window still RUNNING whose first two milestones are already past their deadlines (start 80 days
  // ago, last day 10 days out): the escalation watcher's catch-up tick records them, which is the fact
  // the correction path must leave alone.
  insertEmployee.run(LATE, 'Late', `${LATE}@example.invalid`, BOSS, LATE_START, LATE_END);
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

/**
 * P3-2 follow-up (row `0484e79e`) — the CORRECTION to a submitted probation evaluation.
 *
 * Owner decision, 2026-10-28: **option (A)** — a correction is a SEPARATE DATED ROW beside the original,
 * naming who changed it and why, with the original NEVER rewritten (`probation-correction-path-spec.md`
 * §1). The spec's §3b labels that shape **C1** and the phrases "A1" and "C" in §3 (and §3's "C") name
 * the two REJECTED shapes; nothing here builds them: the evaluation row gains no column, `content` is
 * not rewritten, and no update or delete route exists anywhere in the chain.
 *
 * WHAT THIS HOLDS — the spec's §7, and the reason each sharp one exists:
 *   * the original evaluation row is **byte-identical** after a correction: that is the whole shape;
 *   * empty `content` and empty `reason` are both 400, with **no row and no audit line** — "a correction
 *     with corrected words and no reason is an edit wearing a badge";
 *   * an unnamed token is refused 400 **before any lookup**, so an unknown employee does not become a
 *     404 for it;
 *   * an evaluation id that does not exist and one belonging to **another hire** are the SAME 404 body,
 *     so the route cannot be used to test whether a row id is real;
 *   * the subject and an out-of-scope manager are refused 403 with no body, **with a positive control in
 *     the same test** so the refusals are not vacuous;
 *   * a **second** correction is accepted, the newest is effective, and `correction_count` tells a record
 *     corrected twice from one corrected once;
 *   * the 409 still refuses a second submission, the first row is untouched, and the payload now carries
 *     the `evaluation_id` that lets a client address the correction — **a control asserting only the old
 *     three keys would pass on a tree that never gained the fourth**;
 *   * a reading pinned `?as_of` BEFORE a correction shows the ORIGINAL text and `correction_count: 0`;
 *   * a hire whose probation window has ENDED can be corrected while the submit route refuses the same
 *     hire at the same moment (that 400 is the control);
 *   * a milestone that has already ESCALATED can be corrected, and the escalation row is byte-identical
 *     afterwards — a correction does not rewrite what fired;
 *   * `completionsFor` is still ONE query for the roster plus one, whatever its size.
 *
 * The two facts this build deliberately does NOT decide: **who may read the corrected text (or the
 * original)**. No route serves `content`, and no read cell was added to `POLICY` — it is
 * docs/access-model.md §8 item 13, an open owner question, named in this change's PR body so it cannot
 * be mistaken for a decision.
 *
 * These tests run after the P3-2 block above; the evaluations it submits for `pe-report` are the rows
 * they correct, and `ensureReportEvaluation` re-creates one if this block is run on its own.
 */
let reportEval1 = null;
let reportEval2 = null;

let readCopies = 0;
/**
 * Run a snippet against this test's database IN ITS OWN PROCESS.
 *
 * The correction READERS (`effectiveEvaluation`, `completionsFor`) live behind `server/db.js`, which
 * executes `schema.sql` and the column migrations when it opens — so this file must not `require` it in
 * process, where the runner would bind a database at all (server/live-db-guard.test.js, and db.js's own
 * refusal). The snippet runs against a `VACUUM INTO` snapshot, which folds the WAL in, so it reads what
 * the server has written and never opens the running server's own file for DDL from a second connection.
 */
function runModule(script) {
  readCopies += 1;
  const copy = path.join(os.tmpdir(), `antum-p32-read-${process.pid}-${readCopies}-${randomUUID()}.db`);
  rawDb((db) => db.exec(`VACUUM INTO '${copy}'`));
  try {
    const out = execFileSync(process.execPath, ['-e', script], {
      cwd: __dirname,
      encoding: 'utf8',
      env: { ...process.env, PRODUCT_DB_PATH: copy },
    });
    return JSON.parse(out.trim().split('\n').filter(Boolean).pop());
  } finally {
    fs.rmSync(copy, { force: true });
  }
}
const modulePath = (file) => JSON.stringify(path.join(__dirname, file));
const l = (value) => JSON.stringify(value);

const correctionsOf = (employeeId) => rows(
  'SELECT * FROM probation_evaluation_corrections WHERE employee_id = ? ORDER BY corrected_at, rowid',
  employeeId,
);
const countCorrections = () => rawDb((db) => db
  .prepare('SELECT COUNT(*) AS n FROM probation_evaluation_corrections').get()).n;
const countCorrectionAudit = () => rawDb((db) => db
  .prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type = 'probation_evaluation_corrections'").get()).n;
const evaluationRow = (id) => rows('SELECT * FROM probation_evaluations WHERE id = ?', id)[0];
const correction = (token, employeeId, evaluationId, body) => api(
  'POST',
  `/api/employees/${employeeId}/probation-evaluations/${evaluationId}/corrections`,
  { token, body },
);

/** The evaluation row for one milestone, created through the product's own route if it is not there. */
async function ensureReportEvaluation(milestoneIndex, content) {
  const found = rows(
    'SELECT id FROM probation_evaluations WHERE employee_id = ? AND milestone_index = ?',
    REPORT, milestoneIndex,
  );
  if (found.length) return found[0].id;
  const r = await submit(await tokenFor(MANAGER), REPORT, { milestone_index: milestoneIndex, content });
  assert.strictEqual(r.status, 201, `the fixture evaluation must be creatable (${r.text})`);
  return r.json.evaluation.id;
}

/** The escalation watcher's first tick IS its catch-up, but it is asynchronous: wait for the record. */
async function escalationRow(employeeId, milestoneIndex, ms = 20000) {
  const deadline = Date.now() + ms;
  for (;;) {
    const found = rows(
      'SELECT * FROM probation_escalations WHERE employee_id = ? AND milestone_index = ?',
      employeeId, milestoneIndex,
    );
    if (found.length) return found[0];
    if (Date.now() > deadline) {
      throw new Error(`the escalation watcher never recorded ${employeeId} milestone ${milestoneIndex}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * The hire whose window has ENDED. The row is inserted directly because the SUBMIT route is exactly
 * what cannot produce it any more — the evaluation was filed while the window was still running, and a
 * correction is the late discovery this path exists for (spec §1.6, §7.8).
 */
const ENDED_EVAL_ID = 'pe-ended-eval-1';
function ensureEndedEvaluation() {
  rawDb((db) => db.prepare(`INSERT OR IGNORE INTO probation_evaluations
    (id, employee_id, milestone_index, milestone_due_date, milestone_day, content, submitted_by, submitted_at)
    VALUES (?, ?, 1, ?, 30, ?, 'pe-hr', ?)`).run(
    ENDED_EVAL_ID, ENDED, day(-100), 'Filed while the window was running: first month on track.',
    `${day(-95)}T09:00:00.000Z`,
  ));
  return ENDED_EVAL_ID;
}

describe('P3-2 follow-up — a correction is a separate row beside the original (owner decision A)', () => {
  before(async () => {
    reportEval1 = await ensureReportEvaluation(1, 'Fixture: milestone 1.');
    reportEval2 = await ensureReportEvaluation(2, 'Fixture: milestone 2.');
  });

  test('a correction lands: named actor, timestamp, ONE audit row — and the original row is byte-identical', async () => {
    const original1 = evaluationRow(reportEval1);
    const text = 'Corrected: the handover slipped on two workstreams and the first note overstated it.';
    const why = 'I re-read the deliverables before the review and the first note was too generous.';
    const r = await correction(await tokenFor(MANAGER), REPORT, reportEval1, { content: text, reason: why });
    assert.strictEqual(r.status, 201, r.text);

    assert.strictEqual(r.json.correction.corrected_by, MANAGER, 'the correction names the person who made it');
    assert.strictEqual(r.json.correction.reason, why, 'and carries the reason: it is the point of the shape');
    assert.strictEqual(r.json.correction.content, text);
    assert.strictEqual(r.json.correction.evaluation_id, reportEval1);
    assert.strictEqual(r.json.correction.employee_id, REPORT);
    assert.strictEqual(r.json.correction.milestone_index, original1.milestone_index, 'copied from the row it corrects');
    assert.ok(!Number.isNaN(Date.parse(r.json.correction.corrected_at)), 'and a parseable timestamp');

    // THE SHAPE ITSELF: the submitted row is not touched, not even its timestamp.
    assert.deepStrictEqual(evaluationRow(reportEval1), original1,
      'the evaluation row must be byte-identical after a correction — the original is never rewritten');
    assert.strictEqual(evaluationRow(reportEval1).content, original1.content);
    assert.strictEqual(evaluationRow(reportEval1).submitted_by, MANAGER, 'the submitter is still the submitter');
    assert.strictEqual(countCorrections(), 1, 'and the correction lives in its own table');
    assert.strictEqual(correctionsOf(REPORT).length, 1);

    const audit = rows("SELECT * FROM audit_logs WHERE entity_type = 'probation_evaluation_corrections'");
    assert.strictEqual(audit.length, 1, 'exactly ONE audit row per correction');
    assert.strictEqual(audit[0].performed_by, MANAGER, 'naming the actor (decision 22)');
    assert.strictEqual(audit[0].action, 'CREATE');
    assert.strictEqual(audit[0].entity_id, r.json.correction.id);
    const carried = JSON.parse(audit[0].new_values);
    assert.strictEqual(carried.evaluation_id, reportEval1);
    assert.strictEqual(carried.reason, why, 'the log carries the reason — it is what the log has to explain');
    assert.ok(!JSON.stringify(carried).includes(text),
      'and NOT the corrected words: they stay in the correction row, as the submission’s stay in theirs');

    // The response’s `effective` is the reader’s view: newest correction applied, submitter unchanged.
    assert.strictEqual(r.json.effective.content, text);
    assert.strictEqual(r.json.effective.submitted_by, MANAGER);
    assert.strictEqual(r.json.effective.submitted_at, original1.submitted_at);
    assert.strictEqual(r.json.effective.correction_count, 1);
    assert.strictEqual(r.json.effective.last_corrected_by, MANAGER);
  });

  test('empty content and empty reason are refused 400 — and neither writes a row or an audit line', async () => {
    const rowsBefore = countCorrections();
    const auditBefore = countCorrectionAudit();
    const token = await tokenFor(MANAGER);
    for (const body of [
      { content: '', reason: 'a real reason' },
      { content: '   ', reason: 'a real reason' },
      { content: 'corrected words', reason: '' },
      { content: 'corrected words', reason: '   ' },
      { content: 'corrected words' },
    ]) {
      const r = await correction(token, REPORT, reportEval1, body);
      assert.strictEqual(r.status, 400, `${JSON.stringify(body)} must be refused (got ${r.status}: ${r.text})`);
      assert.match(r.json.error, /cannot be empty/, 'and the refusal says which half is missing');
    }
    const contentMiss = await correction(token, REPORT, reportEval1, { content: '', reason: 'why' });
    assert.match(contentMiss.json.error, /content cannot be empty/);
    const reasonMiss = await correction(token, REPORT, reportEval1, { content: 'words', reason: '' });
    assert.match(reasonMiss.json.error, /reason cannot be empty/,
      'the reason is REFUSED on its own — a correction with corrected words and no reason is an edit wearing a badge');
    assert.strictEqual(countCorrections(), rowsBefore, 'nothing was written');
    assert.strictEqual(countCorrectionAudit(), auditBefore, 'and no audit line either');
  });

  test('an UNNAMED token is refused 400 BEFORE any lookup — an unknown employee does not become a 404', async () => {
    const before = countCorrections();
    const r = await correction(namelessToken(), 'no-such-employee', 'no-such-evaluation', {
      content: 'x', reason: 'y',
    });
    assert.strictEqual(r.status, 400, 'the actor gate precedes the lookup (decision 22)');
    assert.match(r.json.error, /a named actor is required to correct a probation evaluation/);
    assert.strictEqual(countCorrections(), before);
  });

  test('an unknown evaluation id and ANOTHER hire’s evaluation id are the same 404, byte for byte', async () => {
    const before = countCorrections();
    const hr = await tokenFor(HR);
    const missing = await correction(hr, ELSEWHERE, 'no-such-evaluation-id', { content: 'x', reason: 'y' });
    const otherHires = await correction(hr, ELSEWHERE, reportEval1, { content: 'x', reason: 'y' });
    assert.strictEqual(missing.status, 404);
    assert.strictEqual(otherHires.status, 404);
    assert.strictEqual(missing.text, otherHires.text,
      'ONE body for both causes: another hire’s row id must not be a probe');
    assert.strictEqual(missing.json.error, 'No submitted evaluation with that id for this employee');
    assert.strictEqual(countCorrections(), before);
  });

  test('the subject is refused 403 with no body, a manager outside the line too — and the line’s manager succeeds', async () => {
    const text = { content: 'Corrected on the second reading.', reason: 'The first note was written from memory.' };
    const subject = await correction(await tokenFor(EMPLOYEE), REPORT, reportEval1, text);
    assert.strictEqual(subject.status, 403, 'a hire cannot correct the assessment of themselves');
    assert.strictEqual(subject.text, '', 'the gate’s own shape: a refusal with no body');
    const outsider = await correction(await tokenFor(MANAGER), ELSEWHERE, reportEval1, text);
    assert.strictEqual(outsider.status, 403, 'and a manager cannot correct another manager’s line');
    assert.strictEqual(outsider.text, '');
    // The positive control in the same test: the hire’s OWN manager and HR_ADMIN both succeed, so the
    // 403s above are refusals rather than a route that refuses everyone.
    const inLine = await correction(await tokenFor(MANAGER), REPORT, reportEval2, text);
    assert.strictEqual(inLine.status, 201, `the manager’s own line: ${inLine.text}`);
    const byHr = await correction(await tokenFor(HR), REPORT, reportEval2, {
      content: 'Corrected again by HR.', reason: 'Payroll queried the milestone.',
    });
    assert.strictEqual(byHr.status, 201, `company-wide, HR_ADMIN: ${byHr.text}`);
    assert.strictEqual(correctionsOf(REPORT).filter((c) => c.evaluation_id === reportEval2).length, 2);
  });

  test('a SECOND correction is accepted, the NEWEST is effective, and correction_count tells them apart', async () => {
    const beforeCount = correctionsOf(REPORT).filter((c) => c.evaluation_id === reportEval1).length;
    const second = await correction(await tokenFor(HR), REPORT, reportEval1, {
      content: 'Corrected once more: the rating stands, the wording does not.',
      reason: 'The rating was right; the sentence around it read as a warning.',
    });
    assert.strictEqual(second.status, 201, second.text);
    assert.strictEqual(second.json.effective.content, 'Corrected once more: the rating stands, the wording does not.',
      'the newest correction is the effective record');
    assert.strictEqual(second.json.effective.correction_count, beforeCount + 1,
      'more than one is allowed, and the count says so rather than looking like a single correction');
    assert.strictEqual(second.json.effective.last_corrected_by, HR);

    const mine = correctionsOf(REPORT).filter((c) => c.evaluation_id === reportEval1);
    assert.strictEqual(mine.length, beforeCount + 1, 'both corrections are kept — none is destroyed');
    for (let i = 1; i < mine.length; i += 1) {
      assert.ok(mine[i].corrected_at >= mine[i - 1].corrected_at, 'oldest first, so the last one is the newest');
    }
    // The screen that already exists learns that the record was corrected, and who did it, WITHOUT
    // publishing the manager’s words to finance or to the hire (spec §4e — that read is the owner’s).
    const completion = timelineOf(await timelines(await tokenFor(HR)), REPORT)
      .milestones.find((m) => m.index === 1).completion;
    assert.strictEqual(completion.correction_count, beforeCount + 1);
    assert.strictEqual(completion.last_corrected_by, HR);
    assert.strictEqual(completion.last_corrected_at, mine[mine.length - 1].corrected_at);
    assert.ok(!('content' in completion), 'the completion publishes the correction, never the words');
  });

  test('the pair that makes the shape mean something: the 409 names the row to correct, and the row is untouched', async () => {
    const before = evaluationRow(reportEval1);
    const evaluationsBefore = rows('SELECT COUNT(*) AS n FROM probation_evaluations WHERE employee_id = ?', REPORT)[0].n;
    const r = await submit(await tokenFor(MANAGER), REPORT, { milestone_index: 1, content: 'Second thoughts.' });
    assert.strictEqual(r.status, 409, 'a second submission is still refused: the correction is a different route');
    assert.strictEqual(r.json.recorded_by, MANAGER);
    assert.strictEqual(r.json.recorded_at, before.submitted_at);
    // The FOURTH key. A control run that asserted only the old three (`error`, `recorded_by`,
    // `recorded_at`) would pass on a tree that never gained this one — and a client that hit the 409
    // could not act on it without re-reading the timeline, which is the defect this closes.
    assert.strictEqual(r.json.evaluation_id, reportEval1, 'the refusal names the row a correction is addressed to');
    assert.strictEqual(r.json.milestone_index, 1);
    assert.deepStrictEqual(
      Object.keys(r.json).sort(),
      ['error', 'evaluation_id', 'milestone_index', 'recorded_at', 'recorded_by'],
      'the payload is the old three keys PLUS the two that make it actionable',
    );
    assert.deepStrictEqual(evaluationRow(reportEval1), before, 'and the first row is still byte-identical');
    assert.strictEqual(
      rows('SELECT COUNT(*) AS n FROM probation_evaluations WHERE employee_id = ?', REPORT)[0].n,
      evaluationsBefore,
      'and the 409 wrote no evaluation row of its own',
    );
  });

  test('a reading pinned BEFORE the corrections shows the original text and correction_count 0', async () => {
    // `?as_of=` has DAY granularity and this whole file runs on one day, so the pair it must tell apart
    // cannot be built from two same-day writes: the submission is filed with an older `submitted_at`
    // (it was filed last week) and corrected TODAY. Then `as_of` yesterday is a day on which the
    // submission exists and the correction does not — which is exactly the defect P3-2 closed for
    // submissions and this change has to close for corrections (spec §1.5, §7.10).
    const PINNED_MILESTONE = 3;
    const PINNED_EVAL_ID = 'pe-report-eval-3-pinned';
    const ORIGINAL_TEXT = 'Filed last week: the third milestone was met on the numbers, not on the narrative.';
    rawDb((db) => db.prepare(`INSERT OR IGNORE INTO probation_evaluations
      (id, employee_id, milestone_index, milestone_due_date, milestone_day, content, submitted_by, submitted_at)
      VALUES (?, ?, ?, ?, 90, ?, 'pe-manager-last-week', ?)`).run(
      PINNED_EVAL_ID, REPORT, PINNED_MILESTONE, day(70), ORIGINAL_TEXT, `${day(-5)}T09:00:00.000Z`,
    ));
    const corrected = await correction(await tokenFor(MANAGER), REPORT, PINNED_EVAL_ID, {
      content: 'Corrected today: the narrative was met too, on a second reading.',
      reason: 'The first note undersold the milestone.',
    });
    assert.strictEqual(corrected.status, 201, corrected.text);

    const pinned = await timelines(await tokenFor(HR), `?as_of=${day(-1)}`);
    const first = timelineOf(pinned, REPORT).milestones.find((m) => m.index === PINNED_MILESTONE);
    assert.strictEqual(first.state, 'completed', 'the ORIGINAL submission stands as of that day');
    assert.strictEqual(first.completion.completed_by, 'pe-manager-last-week');
    assert.strictEqual(first.completion.completed_at, `${day(-5)}T09:00:00.000Z`);
    assert.strictEqual(first.completion.correction_count, 0, 'nothing had been corrected as of yesterday');
    assert.strictEqual(first.completion.last_corrected_by, null);
    assert.strictEqual(first.completion.last_corrected_at, null);

    // The same pinning through the module a reader must use, against a snapshot of this database.
    const at = runModule(`
      const pe = require(${modulePath('probation-evaluations.js')});
      pe.effectiveEvaluation(${l(PINNED_EVAL_ID)}, { asOf: ${l(day(-1))} }).then((e) => console.log(JSON.stringify(e)));
    `);
    assert.strictEqual(at.content, ORIGINAL_TEXT, 'the ORIGINAL text is what that day shows');
    assert.strictEqual(at.correction_count, 0);
    assert.strictEqual(at.last_corrected_by, null);

    const now = runModule(`
      const pe = require(${modulePath('probation-evaluations.js')});
      pe.effectiveEvaluation(${l(PINNED_EVAL_ID)}).then((e) => console.log(JSON.stringify(e)));
    `);
    assert.strictEqual(now.content, 'Corrected today: the narrative was met too, on a second reading.',
      'and today the newest correction is effective');
    assert.strictEqual(now.correction_count, 1);
    assert.strictEqual(now.last_corrected_by, MANAGER);
    assert.notStrictEqual(now.content, ORIGINAL_TEXT, 'so the two readings really differ');
    // `effectiveEvaluation` returns the newest correction applied to the ORIGINAL row, not a corrected
    // copy of it: the submitter and the submission moment come back untouched.
    assert.strictEqual(now.submitted_by, 'pe-manager-last-week');
    assert.strictEqual(now.submitted_at, `${day(-5)}T09:00:00.000Z`);
    // And the unpinned screen reading says the same thing as the module: one correction, the newest actor.
    const unpinned = timelineOf(await timelines(await tokenFor(HR)), REPORT)
      .milestones.find((m) => m.index === PINNED_MILESTONE).completion;
    assert.strictEqual(unpinned.correction_count, 1);
    assert.strictEqual(unpinned.last_corrected_by, MANAGER);
  });

  test('a hire whose window has ENDED can be corrected, while the submit route refuses the same hire', async () => {
    const id = ensureEndedEvaluation();
    // The control, at this same moment: the submission path answers 400 because the window has ended.
    const refused = await submit(await tokenFor(MANAGER), ENDED, { milestone_index: 1, content: 'Too late to submit.' });
    assert.strictEqual(refused.status, 400);
    assert.match(refused.json.error, /no probation window/);
    const before = evaluationRow(id);
    const r = await correction(await tokenFor(MANAGER), ENDED, id, {
      content: 'Corrected after the window closed: the first month was fine, the second was not.',
      reason: 'The late discovery is exactly what this path is for.',
    });
    assert.strictEqual(r.status, 201, 'correcting is not submitting: no window is consulted');
    assert.deepStrictEqual(evaluationRow(id), before, 'and the submitted row is still untouched');
  });

  test('a milestone that has ALREADY ESCALATED can be corrected, and the escalation row is byte-identical', async () => {
    const fired = await escalationRow(LATE, 1);
    const submitted = await submit(await tokenFor(MANAGER), LATE, { milestone_index: 1, content: 'Recorded late.' });
    assert.strictEqual(submitted.status, 201, `a submission after the escalation is accepted: ${submitted.text}`);
    const r = await correction(await tokenFor(MANAGER), LATE, submitted.json.evaluation.id, {
      content: 'Corrected after the escalation.', reason: 'The note was written against the wrong milestone.',
    });
    assert.strictEqual(r.status, 201, r.text);
    const after = rows(
      'SELECT * FROM probation_escalations WHERE employee_id = ? AND milestone_index = 1', LATE,
    )[0];
    assert.deepStrictEqual(after, fired, 'a correction does not rewrite what fired, down to the byte');
    assert.strictEqual(after.id, fired.id);
    assert.strictEqual(after.detected_at, fired.detected_at);
    assert.strictEqual(after.fired_by, fired.fired_by);
    // `resolved` is DERIVED on read (Boolean(completed_at)), never rewritten into the row: the
    // submission resolves it, and the correction — which came after — does not change that reading.
    const listing = await api('GET', `/api/probation/escalations?employee_id=${LATE}`, { token: await tokenFor(HR) });
    assert.strictEqual(listing.status, 200, listing.text);
    const mine = listing.json.escalations.filter((e) => e.milestone_index === 1);
    assert.strictEqual(mine.length, 1, 'the milestone that fired has exactly one escalation record');
    assert.strictEqual(mine[0].resolved, true, 'and the submission resolves it — the correction does not change that');
  });

  test('completionsFor is still ONE query for the roster plus one, whatever the roster size', async () => {
    const out = runModule(`
      const db = require(${modulePath('db.js')});
      let calls = 0;
      const orig = db.query;
      db.query = (sql) => { calls += 1; return orig(sql); };
      const pe = require(${modulePath('probation-evaluations.js')});
      (async () => {
        const three = await pe.completionsFor([${l(REPORT)}, ${l(ELSEWHERE)}, ${l(NOWINDOW)}]);
        const forThree = calls;
        calls = 0;
        const one = await pe.completionsFor([${l(REPORT)}]);
        const forOne = calls;
        console.log(JSON.stringify({
          forThree, forOne,
          completion: three[${l(REPORT)}][1],
          oneCompletion: one[${l(REPORT)}][1],
        }));
      })().catch((e) => { console.error(e); process.exit(1); });
    `);
    // A per-hire query would turn one screen into N round trips, and the count would grow with the
    // roster; equal counts for one id and three is what says it does not.
    assert.strictEqual(out.forThree, 2, 'two queries for a three-hire roster: the submissions and the corrections');
    assert.strictEqual(out.forOne, 2, 'and two for a one-hire roster — the count does not follow the roster');
    const mine = correctionsOf(REPORT).filter((c) => c.evaluation_id === reportEval1);
    assert.strictEqual(out.oneCompletion.correction_count, mine.length);
    assert.strictEqual(out.oneCompletion.last_corrected_by, mine[mine.length - 1].corrected_by);
    assert.strictEqual(out.oneCompletion.last_corrected_at, mine[mine.length - 1].corrected_at);
    assert.ok(!('content' in out.oneCompletion), 'a completion never carries the manager’s words');
    assert.strictEqual(out.completion.correction_count, mine.length);
  });

  test('the rejected status-flag shape is not in the schema: the evaluation row gained no column', () => {
    const evaluationColumns = rawDb((db) => db.prepare('PRAGMA table_info(probation_evaluations)').all())
      .map((c) => c.name);
    for (const forbidden of ['corrected', 'corrected_by', 'corrected_reason']) {
      assert.ok(!evaluationColumns.includes(forbidden),
        `probation_evaluations must NOT carry \`${forbidden}\` — that is spec §3’s rejected status-flag shape`);
    }
    const correctionColumns = rawDb((db) => db.prepare('PRAGMA table_info(probation_evaluation_corrections)').all())
      .map((c) => c.name);
    assert.deepStrictEqual(correctionColumns, [
      'id', 'evaluation_id', 'employee_id', 'milestone_index', 'content', 'reason',
      'corrected_by', 'corrected_at', 'created_at',
    ], 'and the correction row is where they live, with the reason NOT NULL');
    const notNull = rawDb((db) => db.prepare('PRAGMA table_info(probation_evaluation_corrections)').all())
      .filter((c) => c.notnull).map((c) => c.name);
    for (const required of ['content', 'reason', 'corrected_by', 'corrected_at', 'evaluation_id']) {
      assert.ok(notNull.includes(required), `${required} must be NOT NULL`);
    }
    // No unique key: more than one correction is allowed (spec §4a). `id TEXT PRIMARY KEY` makes SQLite
    // build its own autoindex, so the check is on the indexes SCHEMA.SQL creates (origin 'c').
    const indexes = rawDb((db) => db.prepare('PRAGMA index_list(probation_evaluation_corrections)').all());
    const created = indexes.filter((i) => i.origin === 'c');
    assert.deepStrictEqual(created.map((i) => i.name).sort(), [
      'idx_probation_evaluation_corrections_employee', 'idx_probation_evaluation_corrections_evaluation',
    ], 'the two declared indexes, and nothing else');
    assert.deepStrictEqual(created.filter((i) => i.unique).map((i) => i.name), [],
      'none of them is UNIQUE: a second correction is an act, not a duplicate');
  });
});
