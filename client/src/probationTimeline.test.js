/**
 * client/src/probationTimeline.test.js — the surface vocabulary, asserted without a browser.
 *
 * The dates are the server's; what can be got wrong HERE is everything else: a state with no label,
 * a chip that renders an unknown state as if it were known, a date printed in a locale-dependent
 * shape, a summary that invents a milestone when the payload has none.
 */
import test from 'node:test';
import assert from 'node:assert';

import {
  MILESTONE_LABELS,
  milestoneLabel,
  milestoneChipClass,
  formatDay,
  nextMilestone,
  probationSummary,
  windowLine,
} from './probationTimeline.js';

const TIMELINE = {
  employee_id: 'demo-emp-omar',
  employee_name: 'Omar Al-Farsi',
  start_date: '2026-08-20',
  end_date: '2026-11-18',
  length_days: 90,
  milestones: [
    { index: 1, day: 30, due_date: '2026-09-19', state: 'overdue' },
    { index: 2, day: 60, due_date: '2026-10-19', state: 'due' },
    { index: 3, day: 90, due_date: '2026-11-18', state: 'upcoming' },
  ],
};

test('every state the row names has its own label', () => {
  assert.deepStrictEqual(Object.keys(MILESTONE_LABELS).sort(), ['completed', 'due', 'overdue', 'upcoming']);
  assert.strictEqual(milestoneLabel('due'), 'Due today');
  assert.strictEqual(milestoneLabel('completed'), 'Completed');
});

test('an unknown state is labelled Unknown and wears no state colour', () => {
  assert.strictEqual(milestoneLabel('paused'), 'Unknown');
  assert.strictEqual(milestoneLabel(undefined), 'Unknown');
  assert.strictEqual(milestoneChipClass('paused'), milestoneChipClass(undefined));
  assert.notStrictEqual(milestoneChipClass('paused'), milestoneChipClass('completed'));
});

test('each of the four states has its own chip styling', () => {
  const classes = ['upcoming', 'due', 'overdue', 'completed'].map(milestoneChipClass);
  assert.strictEqual(new Set(classes).size, 4);
});

test('a date is formatted the same way on every machine', () => {
  assert.strictEqual(formatDay('2026-09-19'), '19 September 2026');
  // Midday, not midnight: a full timestamp is read in the reader's zone, and the assertion must not
  // turn on which zone that is. `src/format.test.js` pins the zone-independent properties.
  assert.strictEqual(formatDay('2026-11-18T12:00:00Z'), '18 November 2026');
  assert.strictEqual(formatDay('not-a-date'), 'not-a-date');
  assert.strictEqual(formatDay(null), '');
});

test('the next milestone is the earliest one not yet completed, cleared in order', () => {
  // Day 30 is overdue and day 60 falls due today: the overdue one is what has been waiting longest,
  // and the timeline's own order is the order the milestones are cleared in.
  assert.strictEqual(nextMilestone(TIMELINE).index, 1);
  assert.strictEqual(nextMilestone(TIMELINE).state, 'overdue');
  // With the first one done, the reader moves to the second.
  const firstDone = {
    milestones: TIMELINE.milestones.map((m, i) => ({ ...m, state: i === 0 ? 'completed' : m.state })),
  };
  assert.strictEqual(nextMilestone(firstDone).index, 2);
  const allDone = { milestones: TIMELINE.milestones.map((m) => ({ ...m, state: 'completed' })) };
  assert.strictEqual(nextMilestone(allDone).index, 3);
  assert.strictEqual(nextMilestone({ milestones: [] }), null);
  assert.strictEqual(nextMilestone(null), null);
});

test('the summary names the count, the offsets and what is next — and says nothing for an empty one', () => {
  assert.strictEqual(
    probationSummary(TIMELINE),
    '3 milestones · day 30 / day 60 / day 90 · next: Overdue 19 September 2026',
  );
  assert.strictEqual(probationSummary({ milestones: [] }), 'No milestones');
});

test('the window line prints both ends and the length it implies', () => {
  assert.strictEqual(windowLine(TIMELINE), '20 August 2026 → 18 November 2026 (90 days)');
  assert.strictEqual(windowLine({ start_date: '2026-08-20' }), '');
});
