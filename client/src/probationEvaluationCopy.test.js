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
  // screen 2
  CORRECT_BUTTON,
  CORRECTION_TITLE,
  CORRECTED_LABEL,
  WHY_LABEL,
  CORRECTION_SUBMIT,
  REASON_HELPER,
  ORIGINAL_NOT_SHOWN,
  CORRECTION_NOT_PERMITTED,
  CORRECTION_EMPTY_CONTENT,
  CORRECTION_EMPTY_REASON,
  CORRECTION_NOT_FOUND,
  CORRECTION_COULD_NOT_RECORD,
  CORRECTION_CONNECTION_FAILED,
  completedMilestones,
  completionLine,
  correctionClause,
  milestoneContextLine,
  recordedLine,
  correctionsSoFarLine,
  correctionPayload,
  effectiveText,
  effectiveCorrectionCount,
  correctionRecordedLine,
  correctionOutcome,
  canSubmitCorrection,
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
    const outcome = submissionOutcome({ status: 400, payload: { error: 'this hire has no probation window that is still running, so there is no milestone to evaluate' }, sentText: 'Shipped the migration.' });
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
      sentText: 'Shipped the migration.',
    });
    assert.strictEqual(outcome.kind, OUTCOME.STALE_MILESTONE);
    assert.strictEqual(outcome.sentence, STALE_MILESTONE);
  });

  test('#8 empty content — decided on what the form SENT, never on the server\'s prose', () => {
    const outcome = submissionOutcome({ status: 400, payload: { error: 'a submitted evaluation must carry the manager’s own words: content cannot be empty' }, sentText: '   ' });
    assert.strictEqual(outcome.kind, OUTCOME.EMPTY_CONTENT);
    assert.strictEqual(outcome.sentence, EMPTY_CONTENT);
    // The SAME body with real content is the missing-window refusal: the prose was not consulted.
    const other = submissionOutcome({ status: 400, payload: { error: 'a submitted evaluation must carry the manager’s own words: content cannot be empty' }, sentText: 'Shipped the migration.' });
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
    submissionOutcome({ status: 400, sentText: '' }).kind,
    submissionOutcome({ status: 400, sentText: 'x' }).kind,
    submissionOutcome({ status: 500 }).kind,
    submissionOutcome({ error: new Error('socket hang up') }).kind,
    // Screen 2's, on the same rule: a kind the correction form can return with no case above is a
    // sentence nobody has read.
    correctionOutcome({ status: 201, payload: { effective: { content: 'x', correction_count: 1 } } }).kind,
    correctionOutcome({ status: 401 }).kind,
    correctionOutcome({ error: new RefusalError('u', 403) }).kind,
    correctionOutcome({ status: 403 }).kind,
    correctionOutcome({ status: 404 }).kind,
    correctionOutcome({ status: 400, sentText: '' }).kind,
    correctionOutcome({ status: 400, sentText: 'x', sentWhy: '' }).kind,
    correctionOutcome({ status: 400, sentText: 'x', sentWhy: 'y' }).kind,
    correctionOutcome({ status: 500 }).kind,
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
    assert.strictEqual(canSubmit({ text: 'Shipped the migration.', submitting: true }), false);
  });

  test('is disabled on empty or whitespace-only content', () => {
    assert.strictEqual(canSubmit({ text: '', submitting: false }), false);
    assert.strictEqual(canSubmit({ text: '   \n\t ', submitting: false }), false);
    assert.strictEqual(canSubmit({}), false);
  });

  test('is enabled with real content and nothing in flight', () => {
    assert.strictEqual(canSubmit({ text: 'Shipped the migration.', submitting: false }), true);
    assert.strictEqual(canSubmit({ text: ' a ', submitting: false }), true);
  });
});


// =============================================================================================
// SCREEN 2 — THE CORRECTION PATH
//
// The same rule as Screen 1's suite: every sentence the correction form can put on screen is
// asserted here, by cause, and the classifier's kinds are asserted to be TOTAL (above). The refusals
// are the spec's (`probation-correction-screen-spec.md` §"Refusals (sentence to render)").
//
// Two assertions carry the weight of the whole screen, and they are the two a reviewer should read
// first: `effectiveText` reads the 201's `effective` and NEVER its `evaluation` (which is the
// ORIGINAL row, unmodified — `server/probation-evaluations.js:237`), and the `404` sentence is one
// sentence for two deliberately indistinguishable causes.
// =============================================================================================

/** A timeline as the route returns it, with two milestones: one completed (carrying the id the
 *  form posts to) and one still due. The shape is `server/probation-timeline.js#milestonesFor`'s:
 *  `state: 'completed'` exists because `completion` does. */
const CORRECTABLE = {
  employee_id: 'emp-1',
  employee_name: 'Nour Haddad',
  start_date: '2026-09-19',
  end_date: '2026-12-18',
  length_days: 90,
  milestones: [
    {
      index: 1,
      day: 30,
      due_date: '2026-10-19',
      state: 'completed',
      completion: {
        evaluation_id: 'eval-aaa',
        completed_by: 'admin',
        completed_at: '2026-10-20T09:15:00Z',
        correction_count: 0,
        last_corrected_by: null,
        last_corrected_at: null,
      },
    },
    { index: 2, day: 60, due_date: '2026-11-18', state: 'overdue', completion: null },
  ],
};

/** The same timeline after two corrections: the count and the last actor are on the completion. */
const CORRECTED_TWICE = {
  ...CORRECTABLE,
  milestones: [
    {
      ...CORRECTABLE.milestones[0],
      completion: {
        ...CORRECTABLE.milestones[0].completion,
        correction_count: 2,
        last_corrected_by: 'hr.lead',
        last_corrected_at: '2026-11-02T11:00:00Z',
      },
    },
    CORRECTABLE.milestones[1],
  ],
};

describe('screen 2 — the entry line', () => {
  test('one line per milestone that already carries a recorded evaluation', () => {
    assert.deepStrictEqual(completedMilestones(CORRECTABLE).map((m) => m.index), [1]);
    assert.deepStrictEqual(completedMilestones(CORRECTED_TWICE).map((m) => m.index), [1]);
  });

  test('a milestone with no completion is not offered — there is no id to correct', () => {
    // A hire with no evaluations has no `Correct` control anywhere: absence is an absent affordance.
    assert.deepStrictEqual(completedMilestones({ milestones: [{ index: 1, state: 'overdue', completion: null }] }), []);
    assert.deepStrictEqual(completedMilestones({}), []);
    assert.deepStrictEqual(completedMilestones(null), []);
    // A completion without an `evaluation_id` cannot address the route either, so it is not offered.
    assert.deepStrictEqual(
      completedMilestones({ milestones: [{ index: 1, state: 'completed', completion: { completed_by: 'admin' } }] }),
      [],
    );
  });

  test('the line names who recorded it and when, in the one date shape', () => {
    assert.strictEqual(
      completionLine(CORRECTABLE.milestones[0]),
      'day 30 · recorded by admin on 20 October 2026',
    );
  });

  test('the corrected clause appears only when the count is above zero', () => {
    assert.strictEqual(correctionClause(CORRECTABLE.milestones[0].completion), '');
    assert.strictEqual(
      correctionClause(CORRECTED_TWICE.milestones[0].completion),
      'corrected 2×, last by hr.lead on 2 November 2026',
    );
    assert.strictEqual(correctionClause(null), '');
    assert.strictEqual(correctionClause({ correction_count: 'x' }), '');
  });
});

describe('screen 2 — the form', () => {
  test('the read-only block is built from values already on the row', () => {
    assert.strictEqual(milestoneContextLine(CORRECTABLE.milestones[0]), 'Milestone day 30 · due 19 October 2026');
    assert.strictEqual(recordedLine(CORRECTABLE.milestones[0].completion), 'Recorded by admin on 20 October 2026');
    assert.strictEqual(correctionsSoFarLine(CORRECTABLE.milestones[0].completion), 'Corrections so far: 0');
    assert.strictEqual(correctionsSoFarLine(CORRECTED_TWICE.milestones[0].completion), 'Corrections so far: 2');
    assert.strictEqual(correctionsSoFarLine(null), 'Corrections so far: 0');
    assert.strictEqual(milestoneContextLine(null), '');
  });

  test('the labels and the helper are the spec\'s words', () => {
    assert.strictEqual(CORRECT_BUTTON, 'Correct');
    assert.strictEqual(CORRECTION_TITLE, 'Correct a recorded evaluation');
    assert.strictEqual(CORRECTED_LABEL, 'Corrected evaluation');
    assert.strictEqual(WHY_LABEL, 'Why this is being changed');
    assert.strictEqual(CORRECTION_SUBMIT, 'Record a correction');
    assert.strictEqual(
      REASON_HELPER,
      'Required. It is stored with the correction and is what distinguishes a correction from a quiet edit.',
    );
    assert.strictEqual(CANCEL, 'Cancel', 'the footer reuses screen 1\'s secondary control, not a second word for it');
  });

  test('the form SAYS the original wording is not shown — it never leaves a blank', () => {
    // No route serves the recorded wording (`server/probation-evaluations.js:270-281`). A form that
    // rendered an empty box would be telling the reader the original is empty.
    assert.ok(ORIGINAL_NOT_SHOWN.includes('not shown'), 'the sentence must say the wording is not shown');
    assert.ok(ORIGINAL_NOT_SHOWN.includes('no route serves it yet'), 'and must not imply a read that does not exist');
    assert.ok(ORIGINAL_NOT_SHOWN.includes('the original is not changed'), 'and must state that the original stands');
  });

  test('the request body is exactly `{ content, reason }` — no milestone_index', () => {
    const body = correctionPayload('  Shipped the migration.  ', 'The date was wrong.');
    assert.deepStrictEqual(Object.keys(body), ['content', 'reason']);
    // Sent as typed: the server trims, and it stores what it trimmed.
    assert.strictEqual(body.content, '  Shipped the migration.  ');
    assert.strictEqual(body.reason, 'The date was wrong.');
    for (const forbidden of ['milestone_index', 'evaluation_id', 'employee_id', 'corrected_by', 'corrected_at']) {
      assert.ok(!(forbidden in body),
        `the body must not carry ${forbidden} — the id is a PATH parameter and the actor and clock are stamped server-side`);
    }
  });

  test('the submit control needs BOTH fields, and nothing in flight', () => {
    assert.strictEqual(canSubmitCorrection({ text: 'Corrected.', why: 'Typo.', submitting: false }), true);
    assert.strictEqual(canSubmitCorrection({ text: 'Corrected.', why: 'Typo.', submitting: true }), false);
    assert.strictEqual(canSubmitCorrection({ text: '', why: 'Typo.', submitting: false }), false);
    assert.strictEqual(canSubmitCorrection({ text: 'Corrected.', why: '', submitting: false }), false);
    assert.strictEqual(canSubmitCorrection({ text: '   \n\t ', why: 'Typo.', submitting: false }), false);
    assert.strictEqual(canSubmitCorrection({ text: 'Corrected.', why: '  \n ', submitting: false }), false);
    assert.strictEqual(canSubmitCorrection({}), false);
  });
});

describe('screen 2 — what the 201 is read for', () => {
  // The 201 is `{ correction, evaluation, effective }`. `evaluation` is the ORIGINAL row, UNMODIFIED
  // (`server/probation-evaluations.js:237`) — the words being corrected. `effective` is what a reader
  // should show (`:282-302`). This is the assertion that keeps the screen from showing the old text
  // back to the person who just replaced it.
  const CREATED = {
    correction: { id: 'corr-1', evaluation_id: 'eval-aaa', content: 'Corrected text.', reason: 'The date was wrong.' },
    evaluation: { id: 'eval-aaa', content: 'ORIGINAL TEXT', submitted_by: 'admin' },
    effective: {
      evaluation_id: 'eval-aaa',
      content: 'Corrected text.',
      submitted_by: 'admin',
      correction_count: 1,
      last_corrected_by: 'admin',
      last_corrected_at: '2026-11-04T10:00:00Z',
    },
  };

  test('the rendered wording comes from `effective`, never from `evaluation`', () => {
    assert.strictEqual(effectiveText(CREATED.effective), 'Corrected text.');
    assert.notStrictEqual(effectiveText(CREATED.effective), CREATED.evaluation.content);
  });

  test('the count comes from `effective` too', () => {
    assert.strictEqual(effectiveCorrectionCount(CREATED.effective), 1);
    assert.strictEqual(effectiveCorrectionCount({ correction_count: 4 }), 4);
    // Nothing to show is zero, never NaN and never a guess.
    assert.strictEqual(effectiveCorrectionCount({}), 0);
    assert.strictEqual(effectiveCorrectionCount(null), 0);
    assert.strictEqual(effectiveCorrectionCount({ correction_count: 'x' }), 0);
    assert.strictEqual(effectiveText(null), '');
    assert.strictEqual(effectiveText({}), '');
    assert.strictEqual(effectiveText({ content: null }), '');
  });

  test('the success line quotes the wording back and names the count', () => {
    assert.strictEqual(
      correctionRecordedLine('Corrected text.', 1),
      'Correction recorded. The record now reads: “Corrected text.” — 1 correction on this milestone.',
    );
    assert.strictEqual(
      correctionRecordedLine('Corrected text.', 2),
      'Correction recorded. The record now reads: “Corrected text.” — 2 corrections on this milestone.',
    );
  });
});

describe('screen 2 — the refusals', () => {
  const kindOf = (o) => correctionOutcome(o).kind;
  const sentenceOf = (o) => correctionOutcome(o).sentence;

  test('a recorded correction renders no refusal — the panel shows the success line instead', () => {
    assert.strictEqual(kindOf({ status: 201, payload: { effective: {} } }), OUTCOME.CORRECTED);
    assert.strictEqual(sentenceOf({ status: 201, payload: { effective: {} } }), null);
  });

  test('a dead session leaves the screen (401, and a thrown SessionExpiredError)', () => {
    assert.strictEqual(kindOf({ status: 401 }), OUTCOME.SIGNED_OUT);
    assert.strictEqual(sentenceOf({ status: 401 }), null);
    assert.strictEqual(kindOf({ error: new SessionExpiredError('gone') }), OUTCOME.SIGNED_OUT);
  });

  test('403 is ONE sentence for both causes — the client cannot tell them apart', () => {
    // The gate answers an EMPTY 403 (`server/access.js:446-448`, `server/index.js:1781`), so "wrong
    // role" and "outside the row" are the same reading on the client. `authedFetch` throws it.
    assert.strictEqual(sentenceOf({ error: new RefusalError('u', 403) }), CORRECTION_NOT_PERMITTED);
    assert.strictEqual(sentenceOf({ status: 403 }), CORRECTION_NOT_PERMITTED);
    assert.strictEqual(
      CORRECTION_NOT_PERMITTED,
      "You can't correct this evaluation from this account. Nothing was recorded, and you are still signed in.",
    );
  });

  test('404 is ONE sentence for an unknown id and for another hire\'s id', () => {
    // The server sends one body for both causes on purpose (`server/probation-evaluations.js:205-209`).
    // The sentence therefore never says the evaluation "does not exist": that would be a cause the
    // response deliberately does not carry.
    assert.strictEqual(kindOf({ status: 404, payload: { error: 'No submitted evaluation with that id for this employee' } }), OUTCOME.CORRECTION_NOT_FOUND);
    assert.strictEqual(
      CORRECTION_NOT_FOUND,
      'That evaluation could not be found for this employee. Nothing was recorded.',
    );
    assert.ok(!CORRECTION_NOT_FOUND.toLowerCase().includes('does not exist'),
      'the two causes are deliberately indistinguishable — the sentence must not name one of them');
  });

  test('400 — empty corrected wording', () => {
    assert.strictEqual(kindOf({ status: 400, sentText: '', sentWhy: 'Because.' }), OUTCOME.CORRECTION_EMPTY_CONTENT);
    assert.strictEqual(
      CORRECTION_EMPTY_CONTENT,
      'Enter the corrected evaluation. An empty correction is not recorded.',
    );
  });

  test('400 — empty reason', () => {
    assert.strictEqual(kindOf({ status: 400, sentText: 'Corrected.', sentWhy: '  ' }), OUTCOME.CORRECTION_EMPTY_REASON);
    assert.strictEqual(
      CORRECTION_EMPTY_REASON,
      'Say why the recorded evaluation is being changed. The reason is required and is stored with the correction.',
    );
  });

  test('400 with both fields present is the actor gate — claims no cause', () => {
    // `requireActor` (`server/index.js:1776-1777`) is unreachable from a signed-in screen, and the
    // branch that would name it does not exist. What is left says only that nothing was recorded.
    assert.strictEqual(kindOf({ status: 400, sentText: 'Corrected.', sentWhy: 'Because.' }), OUTCOME.CORRECTION_FAILED);
    assert.strictEqual(
      correctionOutcome({ status: 400, sentText: 'Corrected.', sentWhy: 'Because.' }).sentence,
      CORRECTION_COULD_NOT_RECORD,
    );
  });

  test('anything else claims no cause — a 500, and a 409 this route does not produce', () => {
    // There is NO 409 on this route: more than one correction is deliberately allowed
    // (`server/probation-evaluations.js:173-177`). A 409 from some future change lands here.
    assert.strictEqual(sentenceOf({ status: 500 }), CORRECTION_COULD_NOT_RECORD);
    assert.strictEqual(sentenceOf({ status: 409 }), CORRECTION_COULD_NOT_RECORD);
    assert.strictEqual(sentenceOf({ status: 418 }), CORRECTION_COULD_NOT_RECORD);
    assert.strictEqual(
      CORRECTION_COULD_NOT_RECORD,
      'The correction could not be recorded. Nothing was recorded — please try again.',
    );
  });

  test('the request never reached the server', () => {
    assert.strictEqual(kindOf({ error: new Error('socket hang up') }), OUTCOME.CORRECTION_FAILED);
    assert.strictEqual(sentenceOf({ error: new TypeError('Failed to fetch') }), CORRECTION_CONNECTION_FAILED);
    assert.strictEqual(sentenceOf({ status: 'nonsense' }), CORRECTION_CONNECTION_FAILED);
    assert.strictEqual(sentenceOf({}), CORRECTION_CONNECTION_FAILED);
    assert.strictEqual(
      CORRECTION_CONNECTION_FAILED,
      'The correction could not be recorded — the connection failed. Nothing was recorded.',
    );
  });

  test('every refusal says what happened to the record, in its own words', () => {
    // A TABLE, one row per refusal, each with the clause that makes it say the record did not
    // change. Five say `Nothing was recorded`; the empty-content refusal says `is not recorded`; the
    // empty-reason refusal carries the REQUIREMENT the reader has to meet instead (the spec's own
    // wording). A sixth refusal added to the module without a row here is a sentence nobody has
    // checked for this property.
    const table = [
      [CORRECTION_NOT_PERMITTED, 'Nothing was recorded'],
      [CORRECTION_EMPTY_CONTENT, 'is not recorded'],
      [CORRECTION_EMPTY_REASON, 'required'],
      [CORRECTION_NOT_FOUND, 'Nothing was recorded'],
      [CORRECTION_COULD_NOT_RECORD, 'Nothing was recorded'],
      [CORRECTION_CONNECTION_FAILED, 'Nothing was recorded'],
    ];
    assert.strictEqual(table.length, 6, 'the six refusals of the spec, one row each');
    for (const [sentence, clause] of table) {
      assert.ok(sentence.includes(clause), `this refusal must carry ${JSON.stringify(clause)}: ${sentence}`);
      assert.ok(!/was (?:recorded|saved|stored) successfully/i.test(sentence),
        `a refusal must never read as a success: ${sentence}`);
    }
  });
});
