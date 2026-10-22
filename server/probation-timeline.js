/**
 * server/probation-timeline.js — the probation timeline, DERIVED on every read (P3-1).
 *
 * THE ROW (`d73f8760`): "every new hire on probation has a probation timeline with three evaluation
 * milestones (30/60/90) derived from the start date, with no manual setup", configurable by
 * probation length (90- and 180-day both give a sane set), each milestone showing whether it is
 * `upcoming`, `due`, `completed` or `overdue`.
 *
 * ============================ THE DATA DECISION, NAMED ============================
 *
 * **Derived on read. No schema change, no migration, no stored milestone row.** The brief for this
 * row asked for the decision to be named rather than taken silently, so here it is with its reason:
 *
 *   * A milestone DATE is a pure function of the hire's own record — `employees.start_date` and the
 *     probation window's length. Storing it would create a row that can disagree with the start date
 *     it was computed from, and the row would then be the thing to keep true. The repo already made
 *     this choice once and wrote down why: `server/preboarding-flag-scheduler.js` "does NOT store the
 *     flag (the flag is derived on every read; nothing here is a source of truth)".
 *   * The one thing that genuinely CANNOT be derived is a **submitted evaluation** — a person's act,
 *     not a function of a date. That is P3-2, and this module is written so P3-2 arrives without
 *     rewriting it: `milestonesFor` already accepts a `completions` map and already produces
 *     `completed` from it. What does not exist yet is a table to read that map from; the ROUTE passes
 *     none, and says so in its payload (`completions_recorded: false`) instead of showing a state the
 *     product cannot see.
 *
 * So the state a reader sees today is three of the four (upcoming/due/overdue), all four are
 * expressible and tested, and the missing fourth has exactly one named cause: no submission is
 * stored until P3-2. The row itself declares that dependency ("Unblocks P3-2 and P3-3") — this is the
 * framework P3-2 fills, not a shortcut around it.
 *
 * ============================ WHAT IS DERIVED FROM WHAT ============================
 *
 * `start_date` is the anchor and the ONLY input that moves the dates. The window's LENGTH comes from
 * `probation_end_date` (the hire's own record of how long the probation is — 90 days by convention, a
 * 180-day probation when the contract says so), never from a per-milestone entry:
 *
 *     length = probation_end_date - start_date            (the "configurable by probation length" half)
 *     milestone k ∈ {1,2,3} at  start_date + round(k · length / 3)
 *
 * For a 90-day probation that is exactly 30/60/90; for 180 days, 60/120/180. No employee authors a
 * milestone, and no route writes one: moving the start date moves all three, which is the proof the
 * row asks for (see server/probation-timeline.test.js).
 *
 * `probation_end_date` IS the "this hire is on probation" marker, and it is the only one that exists:
 *   * NULL           → no probation window → NO timeline (a hire never put on probation gets none);
 *   * end in the past → the probation has ENDED → NO timeline (see `milestonesFor`);
 *   * NULL start     → no anchor → NO timeline;
 *   * end <= start   → an unusable window → NO timeline rather than an invented one.
 *
 * The first two negatives are the row's own acceptance criteria and they are different questions, so
 * they are answered in different places, deliberately: "is there a window at all" is structural and
 * has no clock in it (`probationWindow`), while "is it still running" is a question about today and
 * lives with the clock (`milestonesFor`). A caller that wants the hire's contract terms gets them
 * without a `now`; a caller that wants the timeline passes one.
 *
 * MEASURED 2026-10-22, and recorded because the premise is easy to overstate: **nothing in the tree
 * writes `probation_end_date`** — `grep -rn probation_end_date server/*.js scripts/*.js` matched the
 * schema and nothing else. The column is the right instrument and it is INERT until a hire record
 * carries it; `scripts/seed-demo.js` now sets it for two seeded hires (window only — see the note
 * there), and the row's demo surface is otherwise empty. That is a property of the data, not of this
 * derivation: with no window there is nothing to derive FROM, and inventing one would be the pinned
 * figure WORKFLOW rule 3 forbids.
 *
 * NOT IN THIS MODULE, deliberately: any read of the database. It takes plain rows and returns plain
 * objects, so the derivation is testable without a server and the route cannot smuggle in a field.
 */

'use strict';

const DAY_MS = 86400000;

/** The four states the row names. A milestone is in exactly one of them. */
const STATES = Object.freeze(['upcoming', 'due', 'overdue', 'completed']);

/** Parse a stored date (`YYYY-MM-DD`, or a timestamp) to UTC midnight, or null when unusable. */
function toUtcDay(value) {
  if (value === null || value === undefined) return null;
  const day = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const ms = Date.parse(`${day}T00:00:00Z`);
  return Number.isNaN(ms) ? null : new Date(ms);
}

const addDays = (day, n) => new Date(day.getTime() + n * DAY_MS);
const isoDay = (day) => day.toISOString().slice(0, 10);
const wholeDays = (from, to) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

/**
 * The hire's probation window as a contract term, or `null` when there is none. STRUCTURAL: it takes
 * no `now`, so a window that has already run out still reports its dates here — asking "how long is
 * this person's probation" is not asking "are they still on it". `milestonesFor` is where the clock
 * enters and where an ended window becomes no timeline. See the header for why every other no is a NO
 * rather than a default: a default length would give every employee a timeline, which is the exact
 * opposite of the row's "a hire with no probation gets none".
 */
function probationWindow(employee) {
  if (!employee) return null;
  const start = toUtcDay(employee.start_date);
  const end = toUtcDay(employee.probation_end_date);
  if (!start || !end) return null;
  const lengthDays = wholeDays(start, end);
  if (lengthDays <= 0) return null;
  return { start_date: isoDay(start), end_date: isoDay(end), length_days: lengthDays };
}

/**
 * The three milestone offsets, as whole days after the start date: the thirds of the window, and the
 * window's own end. Rounding can collide only on a window of one or two days, and a duplicated date
 * is collapsed rather than shown twice — two milestones on one day would be a claim about the
 * contract, not about arithmetic.
 */
function milestoneOffsets(lengthDays) {
  const offsets = [Math.round(lengthDays / 3), Math.round((2 * lengthDays) / 3), lengthDays];
  return offsets.filter((offset, index) => offset > 0 && offsets.indexOf(offset) === index);
}

/**
 * The milestone list for one hire, or `null` when the hire has no probation window.
 *
 * @param {object} employee   a row carrying `start_date` and `probation_end_date`
 * @param {object} [options]
 * @param {Date|string} [options.now]  the day the states are read against (default: today)
 * @param {object} [options.completions]  `{ [milestoneIndex]: { completed_at, completed_by } }` —
 *        a RECORDED evaluation, P3-2's shape. Empty today, and the reason `completed` is expressible
 *        but unreachable from the route until P3-2 stores one.
 * @returns {null | {start_date, end_date, length_days, milestones: Array}}
 */
function milestonesFor(employee, options = {}) {
  const window = probationWindow(employee);
  if (!window) return null;

  const today = toUtcDay(options.now) || toUtcDay(isoDay(new Date()));
  const completions = options.completions || {};
  const start = toUtcDay(window.start_date);

  // A probation whose last day is behind us is over, and the row's acceptance says it produces no
  // timeline. Checked HERE, against the same `today` the states are read with, so "is it over" and
  // "what state is each milestone in" can never be answered against two different days.
  if (wholeDays(today, toUtcDay(window.end_date)) < 0) return null;

  const milestones = milestoneOffsets(window.length_days).map((offset, index) => {
    const due = addDays(start, offset);
    const milestoneIndex = index + 1;
    const completion = completions[milestoneIndex] || null;
    return {
      index: milestoneIndex,
      day: offset,
      due_date: isoDay(due),
      state: completion ? 'completed' : stateFor(due, today),
      completion,
    };
  });

  return { ...window, milestones };
}

/** `completed` is decided by a recorded evaluation before this is consulted; see `milestonesFor`. */
function stateFor(due, today) {
  const delta = wholeDays(today, due);
  if (delta === 0) return 'due';
  return delta > 0 ? 'upcoming' : 'overdue';
}

/**
 * The timelines for a list of hires — only the ones that have a window. The filter is the point: a
 * caller asking for "every probation" is asking about the hires on probation, and the answer for
 * everyone else is that they are not in it.
 */
function timelinesFor(employees, options = {}) {
  return (employees || [])
    .map((employee) => {
      const timeline = milestonesFor(employee, options);
      return timeline && { employee_id: employee.id, employee_name: employee.name, ...timeline };
    })
    .filter(Boolean);
}

/**
 * Why a milestone cannot read `completed` yet — ONE string, identical on every response, in the shape
 * `server/preboarding-flag.js` uses for `SCOPE_NOTE`. The route carries it so a reader of the payload
 * (and the screen built on it) is told which state is missing and why, instead of being left to
 * conclude the framework has only three states.
 */
const COMPLETION_NOTE =
  'A milestone reads `completed` only from a recorded evaluation (P3-2): no submission is stored yet, '
  + 'so every milestone today is upcoming, due or overdue.';

module.exports = { STATES, COMPLETION_NOTE, probationWindow, milestoneOffsets, milestonesFor, timelinesFor };
