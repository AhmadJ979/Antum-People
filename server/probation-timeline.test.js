/**
 * server/probation-timeline.test.js — P3-1's own suite: the derivation, and its negative cases.
 *
 * The row's acceptance is that milestones are a FUNCTION OF THE START DATE and that nobody authors
 * them. A test that only asserts "three milestones appear" proves neither: it passes on a hardcoded
 * table. Every assertion below is therefore written to be false for a stored set —
 *
 *   * the same hire read twice gives the same dates (no clock in the dates),
 *   * moving `start_date` by one day moves every milestone by one day (the dates are derived),
 *   * moving the window's LENGTH re-frames the same three milestones (30/60/90 vs 60/120/180),
 *   * a hire with no window, an ended window, or an unusable window gets NO timeline at all,
 *   * the four states are produced by the clock and by a recorded completion, and
 *   * the files that COULD store a milestone contain none — no table in the schema, no insert in the
 *     seeder, and the seeder sets only the hire's own window.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  STATES,
  probationWindow,
  milestoneOffsets,
  milestonesFor,
  timelinesFor,
} = require('./probation-timeline.js');

/** A hire whose probation runs 2026-08-20 → 2026-11-18 (90 days), as the demo seed sets it. */
const HIRE = Object.freeze({
  id: 'emp-omar',
  name: 'Omar Alfarsi',
  start_date: '2026-08-20',
  probation_end_date: '2026-11-18',
});

const DATES = (timeline) => timeline.milestones.map((m) => m.due_date);
const STATES_OF = (timeline) => timeline.milestones.map((m) => m.state);

test('a 90-day probation puts the three milestones on 30/60/90, from the start date', () => {
  const timeline = milestonesFor(HIRE, { now: '2026-08-20' });
  assert.strictEqual(timeline.length_days, 90);
  assert.deepStrictEqual(DATES(timeline), ['2026-09-19', '2026-10-19', '2026-11-18']);
  assert.deepStrictEqual(timeline.milestones.map((m) => m.day), [30, 60, 90]);
});

test('the dates are DERIVED: the set is the formula, not a table — and it moves when the hire moves', () => {
  const before = DATES(milestonesFor(HIRE, { now: '2026-08-20' }));

  // (a) Move the whole window one day later: every milestone moves one day later. A stored set would
  //     not move at all, which is the assertion that makes this test about derivation.
  const shifted = { ...HIRE, start_date: '2026-08-21', probation_end_date: '2026-11-19' };
  const after = DATES(milestonesFor(shifted, { now: '2026-08-20' }));
  assert.deepStrictEqual(
    before.map((d, i) => Math.round((Date.parse(after[i]) - Date.parse(d)) / 86400000)),
    [1, 1, 1],
    'every milestone moved by exactly one day',
  );

  // (b) And the dates ARE the formula: recompute them here, independently of the module.
  const startMs = Date.parse('2026-08-20T00:00:00Z');
  assert.deepStrictEqual(
    before,
    [30, 60, 90].map((d) => new Date(startMs + d * 86400000).toISOString().slice(0, 10)),
  );

  // (c) The third does NOT move with the start date when the END is held: a 60-day contract
  //     re-frames the same three milestones onto 20/40/60. Both inputs are contract terms, and the
  //     milestones are a function of the two of them — never of a milestone someone typed.
  const shorter = { ...HIRE, probation_end_date: '2026-10-19' };
  const short = milestonesFor(shorter, { now: '2026-08-20' });
  assert.strictEqual(short.length_days, 60);
  assert.deepStrictEqual(short.milestones.map((m) => m.day), [20, 40, 60]);
  assert.deepStrictEqual(DATES(short), ['2026-09-09', '2026-09-29', '2026-10-19']);
});

test('probation length is the framework\'s dial: 180 days gives 60/120/180, not 30/60/90', () => {
  const sixMonths = { ...HIRE, probation_end_date: '2027-02-16' };
  const timeline = milestonesFor(sixMonths, { now: '2026-08-20' });
  assert.strictEqual(timeline.length_days, 180);
  assert.deepStrictEqual(timeline.milestones.map((m) => m.day), [60, 120, 180]);
  assert.deepStrictEqual(DATES(timeline), ['2026-10-19', '2026-12-18', '2027-02-16']);
});

test('reading the same hire twice gives the same dates: the dates carry no clock of their own', () => {
  const morning = milestonesFor(HIRE, { now: '2026-09-19' });
  const evening = milestonesFor(HIRE, { now: '2026-09-19' });
  assert.deepStrictEqual(morning, evening);
});

test('the four states exist and are exactly the row\'s four', () => {
  assert.deepStrictEqual([...STATES], ['upcoming', 'due', 'overdue', 'completed']);
});

test('the clock decides upcoming / due / overdue, per milestone', () => {
  // The first milestone falls on 2026-09-19.
  assert.deepStrictEqual(STATES_OF(milestonesFor(HIRE, { now: '2026-09-18' })), ['upcoming', 'upcoming', 'upcoming']);
  assert.deepStrictEqual(STATES_OF(milestonesFor(HIRE, { now: '2026-09-19' })), ['due', 'upcoming', 'upcoming']);
  assert.deepStrictEqual(STATES_OF(milestonesFor(HIRE, { now: '2026-09-20' })), ['overdue', 'upcoming', 'upcoming']);
  assert.deepStrictEqual(STATES_OF(milestonesFor(HIRE, { now: '2026-10-20' })), ['overdue', 'overdue', 'upcoming']);
});

test('`completed` comes from a RECORDED evaluation, and from nothing else (P3-2\'s shape)', () => {
  const recorded = { 1: { completed_at: '2026-09-19T09:00:00Z', completed_by: 'hr-1' } };
  const timeline = milestonesFor(HIRE, { now: '2026-10-22', completions: recorded });
  assert.deepStrictEqual(STATES_OF(timeline), ['completed', 'overdue', 'upcoming']);
  assert.strictEqual(timeline.milestones[0].completion.completed_by, 'hr-1');
  // The negative control: with no submission stored, no milestone may read `completed` — the state
  // the product cannot yet see must not be invented for it.
  const unrecorded = milestonesFor(HIRE, { now: '2026-10-22' });
  assert.ok(!STATES_OF(unrecorded).includes('completed'));
});

test('NEGATIVE: a hire with no probation window gets no timeline', () => {
  assert.strictEqual(milestonesFor({ ...HIRE, probation_end_date: null }, { now: '2026-10-22' }), null);
  assert.strictEqual(milestonesFor({ ...HIRE, probation_end_date: '' }, { now: '2026-10-22' }), null);
  assert.strictEqual(milestonesFor({ id: 'x', start_date: '2026-08-20' }, { now: '2026-10-22' }), null);
});

test('NEGATIVE: a hire whose probation has ENDED gets no timeline', () => {
  const ended = { ...HIRE, start_date: '2024-01-15', probation_end_date: '2024-04-14' };
  assert.strictEqual(milestonesFor(ended, { now: '2026-10-22' }), null);
  // The window itself is still readable as the contract term it is — it takes no clock.
  assert.deepStrictEqual(probationWindow(ended), {
    start_date: '2024-01-15', end_date: '2024-04-14', length_days: 90,
  });
  // The last day of the window is its LAST day on probation, not the first day off it.
  assert.strictEqual(milestonesFor(ended, { now: '2024-04-14' }).milestones[2].state, 'due');
  assert.strictEqual(milestonesFor(ended, { now: '2024-04-15' }), null);
});

test('NEGATIVE: no start date, an unparseable date, or a zero/negative window gets no timeline', () => {
  assert.strictEqual(probationWindow({ id: 'x', probation_end_date: '2026-11-18' }), null);
  assert.strictEqual(probationWindow({ ...HIRE, start_date: 'not-a-date' }), null);
  assert.strictEqual(probationWindow({ ...HIRE, probation_end_date: '2026-08-20' }), null, 'a window of zero days');
  assert.strictEqual(probationWindow({ ...HIRE, probation_end_date: '2026-08-01' }), null, 'an end before the start');
});

test('a one- or two-day window gives distinct milestones, never two on one day', () => {
  assert.deepStrictEqual(milestoneOffsets(2), [1, 2]);
  assert.deepStrictEqual(milestoneOffsets(1), [1]);
  assert.deepStrictEqual(milestoneOffsets(90), [30, 60, 90]);
});

test('the list read contains only hires that ARE on probation', () => {
  const roster = [
    HIRE,
    { id: 'emp-old', name: 'Long Serving', start_date: '2022-03-01', probation_end_date: '2022-05-30' },
    { id: 'emp-none', name: 'Never On Probation', start_date: '2024-06-01', probation_end_date: null },
  ];
  const timelines = timelinesFor(roster, { now: '2026-10-22' });
  assert.deepStrictEqual(timelines.map((t) => t.employee_id), ['emp-omar']);
  assert.strictEqual(timelines[0].employee_name, 'Omar Alfarsi');
});

test('P3-1 stores NO milestone: no table in the schema, no insert in the seeder', () => {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const seeder = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'seed-demo.js'), 'utf8');

  // Structural, not a word scan — and this check has now been wrong in two different ways, both
  // measured 2026-10-22, both kept here because the next reader deserves to know what the shape has
  // to survive:
  //   1. `CREATE TABLE[^;]*milestone` matched the PRE-EXISTING `ttv_milestone` column (time-to-value),
  //      an unrelated instrument, so the check reddened on a column that has nothing to do with
  //      probation. Hence: table NAMES, and `\b` (which does not break on `_`, so `ttv_milestone` is
  //      not a standalone word).
  //   2. a plain word scan then reddened on THIS seeder's own comments — the four occurrences of the
  //      word are prose explaining that no milestone is stored. Hence `codeOnly` below: the check is
  //      about what the seeder DOES, and a check must not be tripped by the sentence that documents it.
  const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  assert.ok(/\bmilestone\b/i.test(seeder),
    'control: the raw file DOES discuss milestones in prose — codeOnly is what makes this check mean anything');

  const tables = [...codeOnly(schema).matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)/gi)].map((m) => m[1]);
  assert.ok(tables.length > 5, 'the table list parsed — an empty parse must not pass this check');
  assert.deepStrictEqual(tables.filter((t) => /milestone|probation/i.test(t)), [], 'no stored milestone table');
  assert.strictEqual((codeOnly(schema).match(/\bmilestone\b/gi) || []).length, 0, 'no standalone milestone in the schema');
  assert.ok(/ttv_milestone/.test(schema), 'the scan really read the file (the pre-existing ttv column is there)');

  const seederCode = codeOnly(seeder);
  const inserts = [...seederCode.matchAll(/INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+(\w+)/gi)].map((m) => m[1]);
  assert.ok(inserts.length > 5, 'the insert list parsed');
  assert.deepStrictEqual(inserts.filter((t) => /milestone|probation/i.test(t)), [], 'the seeder authors no milestone row');
  assert.strictEqual((seederCode.match(/\bmilestone\b/gi) || []).length, 0, 'the seeder\'s CODE never names a milestone');
  // Anti-vacuous: the seeder DOES set the hire's own window, so the line above cannot pass because
  // probation was never seeded at all.
  assert.ok(/probation_end_date/.test(seederCode), 'the seeder sets the probation window for the demo hires');
  // And what the stripper is for: with the comments kept, this same scan finds four of them.
  assert.strictEqual((seeder.match(/\bmilestone\b/gi) || []).length, 4, 'the comments are still there to be ignored');
});
