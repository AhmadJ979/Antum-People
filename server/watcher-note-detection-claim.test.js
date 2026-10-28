/**
 * GUARD — no watcher's served note may state a DETECTION LATENCY this process cannot establish.
 *
 * ---------------------------------------------------------------------------
 * THE DEFECT THIS FILE EXISTS FOR, quoted rather than paraphrased
 * ---------------------------------------------------------------------------
 * Two modules close the note they serve to HR with a sentence about their own ticking. Both carried,
 * until 2026-10-28:
 *
 *   server/probation-escalation.js — stored into `probation_escalations.note`, returned by
 *   `GET /api/probation/escalations`:
 *
 *     "…The deadline fell after this escalation watcher started, so it was seen within 5 minute(s)
 *      of the next tick."
 *
 *   server/preboarding-flag-scheduler.js — the per-record `note`, served through
 *   `flagWatcher.status()` at `GET /api/preboarding/flag-watch`:
 *
 *     "This case reached the 48-hour mark after this watcher started, so it was seen within 5
 *      minute(s) of the next tick."
 *
 * The FIRST clause of each is honest: the boundary/deadline-versus-start comparison is something the
 * process observes (server/interval-watcher.js decides `late` against `startedAt`, and `lateByHours`
 * is arithmetic). The CLOSING clause is not. It asserts a DETECTION LATENCY — how soon after the
 * boundary this process noticed — which the process cannot establish, because it cannot see whether
 * its own ticks ran on schedule. On this host a suspended guest, a stall or a lost span is exactly
 * how a tick goes missing, and that is the failure mode this whole family of sentences exists for. A
 * reader takes "seen within 5 minute(s)" as a promise about how fast a person would have been told.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD PROVES, AND WHAT IT CANNOT
 * ---------------------------------------------------------------------------
 * Proves, by reading the notes the two modules ACTUALLY produce (never a copy retyped here):
 *   1. each note states the instants it recorded — the boundary/deadline it names and the instant
 *      this process first saw it;
 *   2. each note carries the SAME cadence clause, `cadenceClause()` from server/interval-watcher.js,
 *      computed at the interval that watcher is actually running at — one sentence, both modules, so
 *      correcting one cannot leave the other asserting the old thing;
 *   3. that clause states the interval as DESIGN INTENT and names the limit ("cannot see whether its
 *      own ticks ran on schedule"), asserted as text, so deleting the limitation reddens;
 *   4. neither note, in either polarity, carries a latency shape;
 *   5. no module under server/ (tests excluded) carries a latency shape outside its comments, so a
 *      sibling instance reddens here too.
 * The falsifications this guard must redden on are the two removed clauses put back, one at a time;
 * `docs/evidence/watcher-note-detection-claim-2026-10-28/` holds both runs.
 *
 * Cannot prove: that any SCREEN renders these notes. The escalation list and the flag-watch payload
 * are reachable from no click today (`server/reachability-register.js`: CALLERLESS, owner decision
 * 21), and an API reading is not a rendered claim. This file holds TEXT against the mechanism that
 * produces it, and claims nothing more.
 *
 * NOT BANNED, deliberately: the two CATCH_UP_RULE strings' "recorded on the next tick" / "escalated
 * on the next tick". Those say what the loop does with an item that comes due while it is up — a
 * statement about a code path, not a claim about when a person was told. Only a LATENCY, a promise
 * about how soon the process saw something, is banned here.
 *
 * HOW IT RUNS — the server suite, on its own throwaway database:
 *     cd server && node --test watcher-note-detection-claim.test.js
 * or the whole suite (`cd server && npm test`).
 *
 * Comments are stripped before the source sweep, deliberately: both modules' comments quote the
 * removed wording as history (and a test below asserts they still do), so a historical quote must
 * not be able to self-trip the check. The stripper is a small reader, not a parser: it does not
 * understand regex literals, which is why no check depends on how a regex is spelled.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const TEST_DB = path.join(os.tmpdir(), `antum-watcher-note-${randomUUID()}.db`);
process.env.PRODUCT_DB_PATH = TEST_DB;

require('./db'); // eslint-disable-line no-unused-vars -- opened for its side effect
const escalation = require('./probation-escalation');
const { createFlagWatcher } = require('./preboarding-flag-scheduler');
const { cadenceClause } = require('./interval-watcher');

const SERVER_DIR = __dirname;
const DAY = 86400000;
const todayMs = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
const day = (offset) => new Date(todayMs + offset * DAY).toISOString().slice(0, 10);

/** The hire whose milestone passed while a watcher was already up: the NOT-late polarity. */
const HIRE_DEADLINE_AFTER_START = 'wn-hire-deadline-after';
/** The hire whose whole window ended before the watcher started: the late (catch-up) polarity. */
const HIRE_DEADLINE_BEFORE_START = 'wn-hire-deadline-before';

/** Two different intervals on purpose: the clause must state the interval it is running at. */
const ESCALATION_INTERVAL_MS = 5 * 60 * 1000;
const FLAG_INTERVAL_MS = 60 * 1000;

/**
 * The shapes the removed clauses had. Each names WHY it is banned, so a future reader can judge a
 * near miss instead of pattern-matching against a list.
 */
const LATENCY_SHAPES = [
  {
    re: /seen within/,
    why: 'states a DETECTION LATENCY — how soon after the boundary this process noticed. The process '
      + 'can see its interval; it cannot see whether its own ticks ran on schedule',
  },
  {
    re: /minute\(s\) of the next tick/,
    why: 'is the removed clause itself: it reads the intended cadence as a measured delay, which is '
      + 'exactly what a suspended guest or a lost span makes false',
  },
  {
    re: /within \d+ minute\(s\)/,
    why: 'promises a detection window in minutes. An interval is not a measurement of when anything '
      + 'was seen, and a reader takes it as how fast a person would have been told',
  },
];

/** Remove `//` and `/* *\/` comments, keeping every string literal's contents. */
function stripComments(src) {
  let out = '';
  let quote = null;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += n === undefined ? '' : n; i += 2; continue; }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i += 1; continue; }
    out += c;
    i += 1;
  }
  return out;
}

/**
 * Strip comments and flatten the plumbing a sentence is assembled with (`+`, quotes, backticks,
 * `${…}`), so a claim split across concatenated lines is still ONE phrase. Without this a sweep
 * would miss the very clause it is here to find: the flag module spells "it was seen" and "within N
 * minute(s)" on two different source lines.
 */
function flatten(src) {
  return stripComments(src)
    .replace(/[`'"]/g, '')
    .replace(/\$\{/g, ' ')
    .replace(/\+/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ');
}

const ESCALATION_PATH = path.join(SERVER_DIR, 'probation-escalation.js');
const FLAG_PATH = path.join(SERVER_DIR, 'preboarding-flag-scheduler.js');
const ESCALATION_SOURCE = fs.readFileSync(ESCALATION_PATH, 'utf8');
const FLAG_SOURCE = fs.readFileSync(FLAG_PATH, 'utf8');

/** The two notes, produced through the real code paths, plus the payload each is served in. */
let escalationNote = null;
let flagNote = null;
let flagServedNote = null;

const caseRow = (startDate) => ({
  case_id: `case-${startDate}`,
  offer_reference: `OFR-${startDate}`,
  start_date: startDate,
  items: [{ item_key: 'passport', label: 'Passport copy', status: 'pending', required: true }],
});

before(() => {
  const handle = new DatabaseSync(TEST_DB);
  handle.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const insertEmployee = handle.prepare(`INSERT INTO employees
    (id, first_name, last_name, email, department, role, manager_id, start_date, probation_end_date, status, salary, basic_salary)
    VALUES (?, ?, 'Person', ?, 'Operations', 'Analyst', NULL, ?, ?, 'onboarding', 1000, 500)`);
  // milestone 1 falls due TODAY: overdue tomorrow, and it fell AFTER the watcher below started
  insertEmployee.run(HIRE_DEADLINE_AFTER_START, 'Amina', `${HIRE_DEADLINE_AFTER_START}@example.invalid`, day(-30), day(60));
  // the whole window is behind us: every milestone fell BEFORE the watcher below started
  insertEmployee.run(HIRE_DEADLINE_BEFORE_START, 'Badr', `${HIRE_DEADLINE_BEFORE_START}@example.invalid`, day(-100), day(-10));
  handle.close();
});

after(() => {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    try { fs.unlinkSync(TEST_DB + suffix); } catch { /* not created */ }
  }
});

describe('the watcher notes: a cadence by design, never a detection latency', () => {
  test('the escalation note (served by GET /api/probation/escalations) states instants and the limit', async () => {
    const watcher = escalation.createEscalationWatcher({
      clock: () => new Date(`${day(-5)}T00:00:00Z`),
      intervalMs: ESCALATION_INTERVAL_MS,
    });
    const tick = await watcher.tick(new Date(`${day(1)}T12:00:00Z`));
    watcher.stop();
    const fired = tick.added.filter((record) => record.employee_id === HIRE_DEADLINE_AFTER_START);
    assert.strictEqual(fired.length, 1,
      'the fixture must produce exactly one not-late escalation, or this guard judges nothing');
    assert.strictEqual(fired[0].late, false, 'this is the polarity whose old clause asserted the latency');
    escalationNote = fired[0].note;

    // Anti-vacuity: a real sentence, and the SAME sentence the served read returns.
    assert.ok(typeof escalationNote === 'string' && escalationNote.length > 150,
      `the escalation carries no usable note (${typeof escalationNote}): there is nothing to hold `
      + 'against the mechanism that wrote it');
    const served = await escalation.listEscalations({ employee_id: HIRE_DEADLINE_AFTER_START });
    assert.strictEqual(served[0].note, escalationNote,
      'the row the route serves and the note this guard judged disagree, so the guard is holding a '
      + 'string the product may not be serving');

    // What it recorded: the deadline it names, and the instant this process first saw it.
    assert.match(escalationNote, new RegExp(`deadline of ${fired[0].milestone_due_date}`),
      'the note no longer names the deadline it is about, which is the one fact the escalation exists for');
    assert.ok(escalationNote.indexOf(fired[0].detected_at) !== -1,
      `the note does not state ${fired[0].detected_at}, the instant this process actually recorded as `
      + 'first seen. The instants it may state are the ones it has');

    // What it cannot see, named — and the interval stated as intent, at the interval it runs at.
    assert.ok(escalationNote.indexOf(cadenceClause(ESCALATION_INTERVAL_MS)) !== -1,
      `the note does not carry the shared cadence clause at its own interval (${ESCALATION_INTERVAL_MS} ms): `
      + 'the closing sentence must be cadenceClause() from server/interval-watcher.js, not a local copy');
    assert.match(escalationNote, /cannot see whether its own ticks ran on schedule/,
      'the note no longer names what the clock comparison cannot see. That limitation is the whole '
      + 'point of the sentence: a cadence stated without it is the detection latency again, in softer words');
    assert.match(escalationNote, /intended cadence, not a measured detection time/,
      'the note no longer distinguishes the intended cadence from a measured detection time');

    for (const { re, why } of LATENCY_SHAPES) {
      assert.doesNotMatch(escalationNote, re,
        `the served escalation note carries /${re.source}/: it ${why}. Correct the sentence in `
        + 'server/probation-escalation.js instead of relaxing this check.');
    }
  });

  test('the pre-boarding flag note (served by flagWatcher.status()) states instants and the limit', async () => {
    const clockNow = new Date('2026-10-30T12:00:00Z');
    const watcher = createFlagWatcher({
      clock: () => clockNow,
      intervalMs: FLAG_INTERVAL_MS,
      snapshot: async () => [caseRow('2026-11-02')],
    });
    let tick = await watcher.tick();
    assert.strictEqual(tick.added.length, 0, 'nothing is recorded before the boundary arrives');
    tick = await watcher.tick(new Date('2026-10-31T00:00:01Z')); // the mark fell while this watcher was up
    watcher.stop();
    assert.strictEqual(tick.added.length, 1,
      'the fixture must produce exactly one not-late record, or this guard judges nothing');
    assert.strictEqual(tick.added[0].late, false, 'this is the polarity whose old clause asserted the latency');
    flagNote = tick.added[0].note;

    // Anti-vacuity: the note is the one the served payload carries, not a sibling of it.
    const status = watcher.status();
    flagServedNote = status.records[status.records.length - 1].note;
    assert.strictEqual(flagServedNote, flagNote,
      'the record and the served payload disagree, so this guard is judging a string the route may not serve');
    assert.ok(typeof flagNote === 'string' && flagNote.length > 100,
      `the flag record carries no usable note (${typeof flagNote})`);

    assert.ok(flagNote.indexOf(tick.added[0].boundary_at) !== -1 || /48-hour mark/.test(flagNote),
      'the note no longer names the boundary it is about');
    assert.ok(flagNote.indexOf(tick.added[0].detected_at) !== -1,
      `the note does not state ${tick.added[0].detected_at}, the instant this process recorded as first seen`);

    assert.ok(flagNote.indexOf(cadenceClause(FLAG_INTERVAL_MS)) !== -1,
      `the note does not carry the shared cadence clause at its own interval (${FLAG_INTERVAL_MS} ms)`);
    assert.match(flagNote, /cannot see whether its own ticks ran on schedule/,
      'the note no longer names what the clock comparison cannot see');
    assert.match(flagNote, /intended cadence, not a measured detection time/,
      'the note no longer distinguishes the intended cadence from a measured detection time');

    for (const { re, why } of LATENCY_SHAPES) {
      assert.doesNotMatch(flagNote, re,
        `the served flag note carries /${re.source}/: it ${why}. Correct the sentence in `
        + 'server/preboarding-flag-scheduler.js instead of relaxing this check.');
    }
  });

  test('the two modules carry the SAME clause, and it is parameterised by the interval', async () => {
    // The clause is one sentence in one module. If the two interval values produced the same string,
    // "contains cadenceClause(n)" would pass for a hardcoded sentence — this is that control.
    assert.notStrictEqual(cadenceClause(ESCALATION_INTERVAL_MS), cadenceClause(FLAG_INTERVAL_MS),
      'cadenceClause ignores its interval argument, so the assertions above prove nothing about what '
      + 'the two watchers state');
    assert.strictEqual(cadenceClause(ESCALATION_INTERVAL_MS), cadenceClause(ESCALATION_INTERVAL_MS),
      'cadenceClause is not a pure function of its argument');
    assert.match(cadenceClause(ESCALATION_INTERVAL_MS), /every 5 minute\(s\) by design/);
    assert.match(cadenceClause(FLAG_INTERVAL_MS), /every 1 minute\(s\) by design/);
    // Different intervals, one shared sentence: neither note may carry the other's.
    assert.strictEqual(escalationNote.indexOf(cadenceClause(FLAG_INTERVAL_MS)), -1,
      'the escalation note carries the flag watcher\'s clause, so its interval is not its own');
    assert.strictEqual(flagNote.indexOf(cadenceClause(ESCALATION_INTERVAL_MS)), -1,
      'the flag note carries the escalation watcher\'s clause, so its interval is not its own');
  });

  test('the sweep catches the removed clause it is written for — a control on the control', () => {
    const removed = 'so it was seen within 5 minute(s) of the next tick.';
    for (const { re } of LATENCY_SHAPES.slice(0, 2)) {
      assert.match(removed, re,
        `the pattern /${re.source}/ does not match the clause this guard was built for, so a green `
        + 'sweep below would prove nothing');
    }
    assert.ok(
      flatten("const a = `one, so it was seen` + ` within ${n} minute(s) of the next tick.`;")
        .indexOf('seen within') !== -1,
      'the flattener does not rejoin a sentence split across concatenated lines, so a source sweep '
      + 'would miss the very clause it exists to find');
  });

  test('no module under server/ carries the removed clause again outside its comments', () => {
    const files = fs.readdirSync(SERVER_DIR)
      .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'));
    assert.ok(files.length > 10,
      `only ${files.length} server modules were scanned: this sweep is not looking at the tree it `
      + 'claims to sweep');
    assert.ok(files.includes('preboarding-flag-scheduler.js') && files.includes('probation-escalation.js'),
      'the two modules that serve these notes are not in the swept set');
    for (const name of files) {
      const flat = flatten(fs.readFileSync(path.join(SERVER_DIR, name), 'utf8'));
      for (const { re, why } of LATENCY_SHAPES) {
        assert.doesNotMatch(flat, re,
          `${name} carries /${re.source}/ outside its comments: ${why}. The same claim was served from `
          + 'two modules because nothing swept their siblings.');
      }
    }
  });

  test('the corrected comments still quote the removed clause, so this guard has a history', () => {
    // Not a served string: this is the record that the claim was removed rather than never held. Both
    // halves of the removed clause are asserted, and each must sit on a COMMENT line — a quote in the
    // code would be the defect back, which the sweep above already reddens on.
    for (const [name, source] of [
      ['server/probation-escalation.js', ESCALATION_SOURCE],
      ['server/preboarding-flag-scheduler.js', FLAG_SOURCE],
    ]) {
      for (const phrase of ['seen within', 'minute(s) of the next tick']) {
        const at = source.indexOf(phrase);
        assert.ok(at !== -1,
          `${name} no longer quotes "${phrase}", so the record of what it stopped serving is gone. A `
          + 'guard whose history is edited away cannot be reviewed: keep the quote, correct beside it.');
        const line = source.slice(source.lastIndexOf('\n', at) + 1, source.indexOf('\n', at));
        assert.match(line, /^\s*(\/\/|\*)/,
          `in ${name} "${phrase}" now appears outside a comment line ("${line.trim()}"). If that is the `
          + 'served sentence, the claim is back; if it is a text literal, quote it in the comment instead.');
      }
    }
  });
});
