/**
 * client/src/probationEvaluationCopy.test.js — every sentence and every guard of Screen 1, asserted
 * without a browser.
 *
 * WHAT THIS SUITE IS FOR. The screen's failure mode is a refusal rendered as nothing, or as the wrong
 * thing: a reader told the wrong cause, a form that offers a milestone the server will refuse, a body
 * that carries a field the server never reads, a submit control that stays live while the request is
 * in flight. None of that reddens a build, and none of it is visible in a status code — so each one is
 * asserted here, by cause, and the module's `OUTCOME` table is asserted to be TOTAL: every kind it can
 * return has a case below, so a new kind cannot be added without a test meeting it.
 *
 * The ten refusals are the spec's (`probation-evaluation-screen-spec.md` §"Every refusal"), numbered
 * the same way here so a reviewer can check the set off against the table.
 *
 * Run: `cd client && npm test`   (node --test, no DOM, no React, no network)
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';

import {
  OUTCOME,
  RECORD_BUTTON,
  ALL_RECORDED,
  FORM_TITLE,
  CANCEL,
  EMPTY_PANEL_SENTENCE,
  EVALUATION_HELPER,
  NOT_PERMITTED,
  EMPLOYEE_GONE,
  NO_RUNNING_WINDOW,
  STALE_MILESTONE,
  EMPTY_CONTENT,
  COULD_NOT_RECORD,
  CONNECTION_FAILED,
  evaluationRecordedLine,
  alreadyEvaluatedSentence,
  submissionOutcome,
  dayOf,
  selectableMilestones,
  hasRecordableMilestone,
  defaultMilestoneIndex,
  milestoneOptionLabel,
  evaluationPayload,
  canSubmit,
} from './probationEvaluationCopy.js';
import { RefusalError, SessionExpiredError } from './httpStatus.js';

/** The row the form is opened from — the same shape `GET /api/probation/timelines` returns. */
const TIMELINE = {
  employee_id: 'emp-omar',
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

/** The same row with its first milestone already recorded. */
const PART_DONE = {
  ...TIMELINE,
  milestones: [
    { index: 1, day: 30, due_date: '2026-09-19', state: 'completed' },
    { index: 2, day: 60, due_date: '2026-10-19', state: 'due' },
    { index: 3, day: 90, due_date: '2026-11-18', state: 'upcoming' },
  ],
};

const ALL_DONE = {
  ...TIMELINE,
  milestones: TIMELINE.milestones.map((m) => ({ ...m, state: 'completed' })),
};

// ---------------------------------------------------------------------------------------------
// THE TEN REFUSALS — one case each, numbered as the spec numbers them.
// ---------------------------------------------------------------------------------------------

describe('the ten refusals', () => {
  test('#1 a dead session renders NO sentence — the shipped convention returns to sign-in', () => {
    const outcome = submissionOutcome({ status: 401 });
    assert.strictEqual(outcome.kind, OUTCOME.SIGNED_OUT);
    assert.strictEqual(outcome.sentence, null);
    // A 403 WITH a body is the other dead-session shape (`httpStatus.js`), and it arrives thrown.
    const thrown = submissionOutcome({ error: new SessionExpiredError(403) });
    assert.strictEqual(thrown.kind, OUTCOME.SIGNED_OUT);
    assert.strictEqual(thrown.sentence, null);
  });

  test('#2 wrong role — the empty 403, thrown by authedFetch, renders its sentence', () => {
    const outcome = submissionOutcome({ error: new RefusalError('/api/employees/x/probation-evaluations', 403) });
    assert.strictEqual(outcome.kind, OUTCOME.REFUSED);
    assert.strictEqual(outcome.sentence, NOT_PERMITTED);
    assert.match(outcome.sentence, /Nothing was recorded, and you are still signed in\./);
  });

  test('#3 right role, outside the row — the SAME sentence, because the client cannot tell them apart', () => {
    const thrown = submissionOutcome({ error: new RefusalError('/api/employees/x/probation-evaluations', 403) });
    const plain = submissionOutcome({ status: 403, payload: {} });
    assert.deepStrictEqual(thrown, plain);
    assert.strictEqual(plain.sentence, NOT_PERMITTED);
    // The sentence must not name a cause the client has no reading for.
    assert.doesNotMatch(NOT_PERMITTED, /manager of|not the manager|not your line|yourself/i);
  });

  test('#4 employee not found', () => {
    const outcome = submissionOutcome({ status: 404, payload: { error: 'Employee not found' } });
    assert.strictEqual(outcome.kind, OUTCOME.EMPLOYEE_GONE);
    assert.strictEqual(outcome.sentence, EMPLOYEE_GONE);
  });

  test('#5 no probation window still running', () => {
    const outcome = submissionOutcome({ status: 400, payload: { error: 'this hire has no probation window that is still running, so there is no milestone to evaluate' }, sentContent: 'Shipped the migration.' });
    assert.strictEqual(outcome.kind, OUTCOME.NO_RUNNING_WINDOW);
    assert.strictEqual(outcome.sentence, NO_RUNNING_WINDOW);
  });

  test('#6 the milestone already carries a submission — the sentence names who and when', () => {
    const outcome = submissionOutcome({
      status: 409,
      payload: {
        error: 'milestone 2 already has a submitted evaluation',
        recorded_by: 'hr_admin',
        recorded_at: '2026-10-19T09:14:00.000Z',
        evaluation_id: 'eval-1',
        milestone_index: 2,
      },
      sentMilestoneIndex: 2,
      timeline: TIMELINE,
    });
    assert.strictEqual(outcome.kind, OUTCOME.ALREADY_EVALUATED);
    assert.match(outcome.sentence, /^Day 60 already has a recorded evaluation — hr_admin recorded it on /);
    assert.match(outcome.sentence, /A milestone carries one evaluation; a change is recorded as a correction\.$/);
    // The date is the one shape (`src/format.js`), never a raw ISO string.
    assert.doesNotMatch(outcome.sentence, /2026-10-19T/);
  });

  test('#6b a 409 that does not name the record says only what is true', () => {
    const outcome = submissionOutcome({ status: 409, payload: {}, sentMilestoneIndex: 2, timeline: TIMELINE });
    assert.strictEqual(outcome.kind, OUTCOME.COULD_NOT_RECORD);
    assert.strictEqual(outcome.sentence, COULD_NOT_RECORD);
  });

  test('#6c the day is read off the timeline, and an index the row does not carry falls back', () => {
    assert.strictEqual(dayOf(TIMELINE, 3), 90);
    assert.strictEqual(dayOf(TIMELINE, 9), null);
    assert.strictEqual(dayOf(null, 1), null);
    const outcome = submissionOutcome({
      status: 409,
      payload: { recorded_by: 'hr_admin', recorded_at: '2026-10-19T09:14:00.000Z', milestone_index: 9 },
      timeline: TIMELINE,
    });
    assert.strictEqual(outcome.kind, OUTCOME.COULD_NOT_RECORD);
  });

  test('#7 a stale milestone index — decided on `known_milestones`, never on the prose', () => {
    const outcome = submissionOutcome({
      status: 400,
      payload: { error: "milestone_index must be one of this hire's milestones (1, 2)", known_milestones: [{ index: 1, day: 45, due_date: '2026-10-04' }] },
      sentContent: 'Shipped the migration.',
    });
    assert.strictEqual(outcome.kind, OUTCOME.STALE_MILESTONE);
    assert.strictEqual(outcome.sentence, STALE_MILESTONE);
  });

  test('#8 empty content — decided on what the form SENT, never on the server\'s prose', () => {
    const outcome = submissionOutcome({ status: 400, payload: { error: 'a submitted evaluation must carry the manager’s own words: content cannot be empty' }, sentContent: '   ' });
    assert.strictEqual(outcome.kind, OUTCOME.EMPTY_CONTENT);
    assert.strictEqual(outcome.sentence, EMPTY_CONTENT);
    // The SAME body with real content is the missing-window refusal: the prose was not consulted.
    const other = submissionOutcome({ status: 400, payload: { error: 'a submitted evaluation must carry the manager’s own words: content cannot be empty' }, sentContent: 'Shipped the migration.' });
    assert.strictEqual(other.kind, OUTCOME.NO_RUNNING_WINDOW);
  });

  test('#9 anything else — a 500, and the lost race on the UNIQUE key — claims no cause', () => {
    const outcome = submissionOutcome({ status: 500, payload: { error: 'Internal Server Error' } });
    assert.strictEqual(outcome.kind, OUTCOME.COULD_NOT_RECORD);
    assert.strictEqual(outcome.sentence, COULD_NOT_RECORD);
    assert.doesNotMatch(outcome.sentence, /already|window|permission|access/i);
  });

  test('#10 the request never completed', () => {
    const outcome = submissionOutcome({ error: new TypeError('Failed to fetch') });
    assert.strictEqual(outcome.kind, OUTCOME.CONNECTION_FAILED);
    assert.strictEqual(outcome.sentence, CONNECTION_FAILED);
    // A response with no usable status is the same fact.
    assert.strictEqual(submissionOutcome({}).kind, OUTCOME.CONNECTION_FAILED);
  });
});

// ---------------------------------------------------------------------------------------------
// THE CLASSIFICATION IS TOTAL — the anti-vacuous control.
// ---------------------------------------------------------------------------------------------

test('every kind the classifier can return has a case above, and none is left unreachable', () => {
  const produced = new Set([
    submissionOutcome({ status: 201, payload: { evaluation: {}, milestone: {} } }).kind,
    submissionOutcome({ status: 401 }).kind,
    submissionOutcome({ error: new RefusalError('u', 403) }).kind,
    submissionOutcome({ status: 404 }).kind,
    submissionOutcome({ status: 409, payload: { recorded_by: 'a', recorded_at: '2026-10-19', milestone_index: 2 }, timeline: TIMELINE }).kind,
    submissionOutcome({ status: 400, payload: { known_milestones: [] } }).kind,
    submissionOutcome({ status: 400, sentContent: '' }).kind,
    submissionOutcome({ status: 400, sentContent: 'x' }).kind,
    submissionOutcome({ status: 500 }).kind,
    submissionOutcome({ error: new Error('socket hang up') }).kind,
  ]);
  const declared = new Set(Object.values(OUTCOME));
  assert.deepStrictEqual([...declared].filter((k) => !produced.has(k)), [],
    'an OUTCOME kind no test reaches is a sentence nobody has read');
});

test('a recorded evaluation renders no refusal — the panel shows the success line instead', () => {
  const outcome = submissionOutcome({ status: 201, payload: { evaluation: { id: 'e1' }, milestone: { index: 1, state: 'overdue' } } });
  assert.strictEqual(outcome.kind, OUTCOME.RECORDED);
  assert.strictEqual(outcome.sentence, null);
});

// ---------------------------------------------------------------------------------------------
// THE SUCCESS LINE AND THE PANEL'S ZERO STATE
// ---------------------------------------------------------------------------------------------

test('the success line names the day and the state the re-read will show', () => {
  assert.strictEqual(
    evaluationRecordedLine(30),
    'Evaluation recorded for day 30 — the milestone now reads Completed.',
  );
});

test('the zero state names the one place a probation window is set', () => {
  assert.match(EMPTY_PANEL_SENTENCE, /^No hire in this view is on probation today\./);
  assert.match(EMPTY_PANEL_SENTENCE, /Hire Employee → Probation\.$/);
  // It must not promise an edit path the product does not have.
  assert.doesNotMatch(EMPTY_PANEL_SENTENCE, /edit|change the window|extend/i);
});

test('the helper claims only what the write path does', () => {
  assert.match(EVALUATION_HELPER, /Recorded in your name with the time you submit it\./);
  assert.match(EVALUATION_HELPER, /cannot be edited afterwards/);
  assert.match(EVALUATION_HELPER, /a correction beside it/);
});

test('the labels are the ones a reader meets', () => {
  assert.strictEqual(RECORD_BUTTON, 'Record evaluation');
  assert.strictEqual(ALL_RECORDED, 'All milestones recorded.');
  assert.strictEqual(FORM_TITLE, 'Record an evaluation');
  assert.strictEqual(CANCEL, 'Cancel');
});

// ---------------------------------------------------------------------------------------------
// THE FORM'S OWN GUARDS
// ---------------------------------------------------------------------------------------------

describe('the milestone select', () => {
  test('offers every milestone that is not completed, and never one that is', () => {
    assert.deepStrictEqual(selectableMilestones(TIMELINE).map((m) => m.index), [1, 2, 3]);
    assert.deepStrictEqual(selectableMilestones(PART_DONE).map((m) => m.index), [2, 3]);
    assert.deepStrictEqual(selectableMilestones(ALL_DONE), []);
    assert.deepStrictEqual(selectableMilestones(null), []);
  });

  test('a milestone that is not yet due is still offered — a submission is not a due-date event', () => {
    const upcomingOnly = { ...TIMELINE, milestones: [{ index: 3, day: 90, due_date: '2026-11-18', state: 'upcoming' }] };
    assert.deepStrictEqual(selectableMilestones(upcomingOnly).map((m) => m.index), [3]);
    assert.strictEqual(defaultMilestoneIndex(upcomingOnly), '3');
  });

  test('the default is nextMilestone(t) — the same helper the row\'s summary line uses', () => {
    assert.strictEqual(defaultMilestoneIndex(TIMELINE), '1');
    assert.strictEqual(defaultMilestoneIndex(PART_DONE), '2');
    // Nothing to record: no default, and the button is not rendered either.
    assert.strictEqual(defaultMilestoneIndex(ALL_DONE), '');
    assert.strictEqual(hasRecordableMilestone(ALL_DONE), false);
    assert.strictEqual(hasRecordableMilestone(PART_DONE), true);
  });

  test('an option reads in the chips\' own vocabulary', () => {
    assert.strictEqual(milestoneOptionLabel(TIMELINE.milestones[0]), 'day 30 · Overdue · 19 September 2026');
    assert.strictEqual(milestoneOptionLabel(PART_DONE.milestones[0]), 'day 30 · Completed · 19 September 2026');
    assert.strictEqual(milestoneOptionLabel(null), '');
  });
});

describe('the request body', () => {
  test('carries exactly two fields — nothing the server stamps itself', () => {
    const body = evaluationPayload('2', '  Shipped the migration.  ');
    assert.deepStrictEqual(Object.keys(body), ['milestone_index', 'content']);
    assert.strictEqual(body.milestone_index, 2);
    assert.strictEqual(typeof body.milestone_index, 'number');
    // The content is sent as typed: the server trims, and it stores what it trimmed.
    assert.strictEqual(body.content, '  Shipped the migration.  ');
    for (const forbidden of ['day', 'due_date', 'submitted_by', 'submitted_at', 'employee_id', 'milestone_due_date', 'milestone_day']) {
      assert.ok(!(forbidden in body), `the body must not carry ${forbidden} — the server derives it`);
    }
  });

  test('the index is a Number, never the select\'s string', () => {
    assert.strictEqual(typeof evaluationPayload('3', 'x').milestone_index, 'number');
    assert.strictEqual(evaluationPayload('3', 'x').milestone_index, 3);
  });
});

describe('the submit control', () => {
  test('is disabled while in flight', () => {
    assert.strictEqual(canSubmit({ content: 'Shipped the migration.', submitting: true }), false);
  });

  test('is disabled on empty or whitespace-only content', () => {
    assert.strictEqual(canSubmit({ content: '', submitting: false }), false);
    assert.strictEqual(canSubmit({ content: '   \n\t ', submitting: false }), false);
    assert.strictEqual(canSubmit({}), false);
  });

  test('is enabled with real content and nothing in flight', () => {
    assert.strictEqual(canSubmit({ content: 'Shipped the migration.', submitting: false }), true);
    assert.strictEqual(canSubmit({ content: ' a ', submitting: false }), true);
  });
});
