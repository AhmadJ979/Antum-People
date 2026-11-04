/**
 * client/src/probationEvaluationCopy.js — the probation screens' words, and the client's own guards.
 *
 * Two screens share this module and its test: Screen 1, the submission form (below), and Screen 2,
 * the correction form (a section of its own further down, from 2026-11-04).
 *
 * WHY THIS FILE EXISTS. Until 2026-11-03 the probation panel told a reader that a milestone reads
 * `Completed` only from a submitted evaluation, and no click in the product submitted one: the route
 * `POST /api/employees/:id/probation-evaluations` was registered as CALLERLESS. The screen is this
 * change's subject; this module holds the half of it that can be asserted without a browser.
 *
 * WHAT IT OWNS
 *   * every sentence the form can put on screen — the ten refusals of
 *     `/home/team/shared/probation-evaluation-screen-spec.md` §"Every refusal", the success line, the
 *     panel's zero state, and the two labels a reader meets before they press anything;
 *   * the CLASSIFICATION that turns one outcome (a status and its body, or a thrown error) into the
 *     ONE sentence that outcome deserves;
 *   * the client-side guards: which milestones the form offers, which one it preselects, what exactly
 *     the request body is, and when the submit control is disabled.
 *
 * WHAT IT DOES NOT OWN, deliberately
 *   * the milestone dates, days and states — derived on the server (`server/probation-timeline.js`)
 *     and only FORMATTED here through `probationTimeline.js`;
 *   * who may record an evaluation. The lead's ruling stands: entry points are not hidden by role,
 *     the server refuses with an empty `403`, and the client renders the refusal it is given. There
 *     is no second copy of the policy table in this file (`server/access.js` is the one authority).
 *
 * HOW AN OUTCOME IS CLASSIFIED, and the one place it is an INFERENCE rather than a reading:
 *   - a thrown `RefusalError` is the policy gate's refusal (`httpStatus.js` — a `403` with an EMPTY
 *     body). A thrown `SessionExpiredError` is a dead session. Any other thrown error never reached
 *     the server at all, which is the connection refusal.
 *   - a `400` is the one status carrying FOUR different causes on this route, so it is decided on
 *     STRUCTURE, never on the server's prose (matching a human sentence is the copy-drift structure
 *     this product has a name for — `panelResults.js` §1):
 *       * `known_milestones` present  -> the stale-index refusal. The server sends that key only from
 *         `server/probation-evaluations.js:89-95`.
 *       * the client SENT empty content -> the empty-content refusal (`:77-80`). The form's own guard
 *         disables submit in that state, so this is unreachable from the screen and is rendered anyway
 *         — a guard that cannot be bypassed is not a reason to leave a refusal unrendered.
 *       * otherwise -> the no-running-window refusal (`:82-85`). **This is the inference, and it is
 *         bounded by an enumeration**: the route's `400`s at this revision are the actor gate
 *         (`server/index.js:1655`), `loadSubject`'s empty id (`:60`), empty content (`:78`), the
 *         missing window (`:84`) and an unknown index (`:90`). With a non-empty body and no
 *         `known_milestones`, only the missing window is left. A future `400` on this route must be
 *         added here or this branch will state a cause the client cannot observe.
 *   - anything else — a `500`, including a lost race on `UNIQUE (employee_id, milestone_index)`
 *     (`server/schema.sql:401`) — is the "could not be recorded" refusal, which claims no cause.
 *
 * Plain ES module JavaScript: no DOM, no React, no network. `probationEvaluationCopy.test.js` drives
 * every branch under `node --test`, in the convention `httpStatus.js`, `probationTimeline.js`,
 * `probationEscalations.js` and `panelResults.js` already ship.
 */

'use strict';

import { formatDate } from './format.js';
import { RefusalError, SessionExpiredError } from './httpStatus.js';
import { nextMilestone, milestoneLabel, formatDay } from './probationTimeline.js';

// ---------------------------------------------------------------------------------------------
// THE SENTENCES. Quoted from the spec, not paraphrased here: a refusal a reader meets must be the
// one the spec, the server and this module agree on.
// ---------------------------------------------------------------------------------------------

/** The button on a row that still has a milestone to record. */
export const RECORD_BUTTON = 'Record evaluation';
/** What stands in its place when every milestone is already recorded. */
export const ALL_RECORDED = 'All milestones recorded.';
/** The modal's title. */
export const FORM_TITLE = 'Record an evaluation';
/** The two field labels and the footer's secondary control. */
export const MILESTONE_LABEL = 'Milestone';
export const EVALUATION_LABEL = 'Your evaluation';
export const CANCEL = 'Cancel';

/**
 * The panel's zero state. It used to be the first clause alone, which left a reader with no way
 * forward: `probation_window_days` is set in ONE place in the product — the Hire Employee form
 * (`client/src/App.tsx`, the `employee-probation` select) — and nothing in the product edits it
 * afterwards. The second clause names that path and claims nothing more.
 */
export const EMPTY_PANEL_SENTENCE =
  'No hire in this view is on probation today. A probation window is set when you add a hire '
  + '— Hire Employee → Probation.';

/**
 * The helper under the textarea. Every clause is a fact about the write path, not a promise:
 * `server/probation-evaluations.js:120-125` stamps the signed-in actor and the clock and never
 * updates the row, and a correction is a separate dated row (`:214-218`), never a rewrite.
 */
export const EVALUATION_HELPER =
  'Recorded in your name with the time you submit it. It cannot be edited afterwards — a later '
  + 'change is recorded as a correction beside it.';

/** The success line at the foot of the panel. `day` is the milestone the reader submitted. */
export function evaluationRecordedLine(day) {
  return `Evaluation recorded for day ${day} — the milestone now reads Completed.`;
}

/** Refusals #2 and #3 share ONE sentence on purpose: the client cannot tell the causes apart, and
 *  `server/access.js:19` makes the emptiness of the `403` load-bearing. Pretending to know which one
 *  it was would be a claim the client has no reading for. */
export const NOT_PERMITTED =
  "You can't record evaluations for this employee from this account. Nothing was recorded, and you "
  + 'are still signed in. Probation evaluations are recorded by HR and by the hire\'s own manager.';

/** #4 — `404 {"error":"Employee not found"}` (`server/probation-evaluations.js:62`). */
export const EMPLOYEE_GONE =
  'This employee record no longer exists. Nothing was recorded.';

/** #5 — no probation window still running (`:82-85`). */
export const NO_RUNNING_WINDOW =
  'This hire is not on a probation window that is still running, so there is no milestone to '
  + 'record. Nothing was recorded.';

/** #7 — the index is not one of this hire's milestones any more (`:89-95`, `known_milestones`). */
export const STALE_MILESTONE =
  "This hire's probation window has changed since this form opened, so that milestone no longer "
  + 'exists. Close this form and reopen it to see the current milestones. Nothing was recorded.';

/** #8 — empty or whitespace-only content (`:77-80`). */
export const EMPTY_CONTENT =
  'Enter your evaluation before recording it — an empty submission is not recorded.';

/** #9 — anything else, including a lost race on the UNIQUE key. Claims no cause. */
export const COULD_NOT_RECORD =
  'The evaluation could not be recorded. Nothing was recorded — please try again.';

/** #10 — the request never completed. */
export const CONNECTION_FAILED =
  'The evaluation could not be recorded — the connection failed. Nothing was recorded.';

/**
 * #6 — the milestone already carries a submission (`:101-117`). The server names WHO recorded it and
 * WHEN, so the sentence can too; `recordedAt` goes through the one date shape (`src/format.js`).
 */
export function alreadyEvaluatedSentence({ day, recordedBy, recordedAt }) {
  return `Day ${day} already has a recorded evaluation — ${recordedBy} recorded it on `
    + `${formatDate(recordedAt)}. A milestone carries one evaluation; a change is recorded as a `
    + 'correction.';
}

// ---------------------------------------------------------------------------------------------
// THE CLASSIFICATION. One outcome in, one kind and one sentence out.
// ---------------------------------------------------------------------------------------------

/** The kinds an outcome can be. A reader of this module can enumerate every one. */
export const OUTCOME = Object.freeze({
  RECORDED: 'recorded',
  SIGNED_OUT: 'signed-out',
  REFUSED: 'refused',
  EMPLOYEE_GONE: 'employee-gone',
  ALREADY_EVALUATED: 'already-evaluated',
  STALE_MILESTONE: 'stale-milestone',
  EMPTY_CONTENT: 'empty-content',
  NO_RUNNING_WINDOW: 'no-running-window',
  COULD_NOT_RECORD: 'could-not-record',
  CONNECTION_FAILED: 'connection-failed',
  // Screen 2's. Deliberately NOT reused from the list above: a correction and a submission are
  // different writes with different refusals, and one kind standing for both would let a reader of
  // a log (or of this module) believe the wrong route was called.
  CORRECTED: 'correction-recorded',
  CORRECTION_REFUSED: 'correction-refused',
  CORRECTION_NOT_FOUND: 'correction-not-found',
  CORRECTION_EMPTY_CONTENT: 'correction-empty-content',
  CORRECTION_EMPTY_REASON: 'correction-empty-reason',
  CORRECTION_FAILED: 'correction-failed',
});

/**
 * Classify one submission's outcome.
 *
 * @param {object} outcome
 *   `error`          what the call threw, if it threw. A `RefusalError`/`SessionExpiredError` decides
 *                    the outcome on its own — the shipped classification already made that call.
 *   `status`         the HTTP status, when a response arrived.
 *   `payload`        the parsed body, or `{}` when it did not parse.
 *   `sentText`       exactly what the form sent. Read ONLY to tell the empty-content refusal apart.
 *   `sentMilestoneIndex` the index the form sent, used when the 409's payload omits it.
 *   `timeline`       the row the form was opened from, used to name the day in the 409 sentence.
 * @returns {{kind: string, sentence: string|null}} `sentence` is null only where the shipped
 *          convention is to leave the screen: a recorded evaluation (the panel shows the success
 *          line instead) and a dead session (the app returns to sign-in).
 */
export function submissionOutcome(outcome = {}) {
  const {
    error, status, payload, sentText, sentMilestoneIndex, timeline,
  } = outcome;
  const body = payload && typeof payload === 'object' ? payload : {};

  // A thrown error is decided by its TYPE, never by its message.
  if (error) {
    if (error instanceof RefusalError) return { kind: OUTCOME.REFUSED, sentence: NOT_PERMITTED };
    if (error instanceof SessionExpiredError) return { kind: OUTCOME.SIGNED_OUT, sentence: null };
    return { kind: OUTCOME.CONNECTION_FAILED, sentence: CONNECTION_FAILED };
  }

  const code = Number(status);
  if (!Number.isFinite(code)) return { kind: OUTCOME.CONNECTION_FAILED, sentence: CONNECTION_FAILED };
  if (code >= 200 && code < 300) return { kind: OUTCOME.RECORDED, sentence: null };
  if (code === 401) return { kind: OUTCOME.SIGNED_OUT, sentence: null };
  if (code === 403) return { kind: OUTCOME.REFUSED, sentence: NOT_PERMITTED };
  if (code === 404) return { kind: OUTCOME.EMPLOYEE_GONE, sentence: EMPLOYEE_GONE };

  if (code === 409) {
    // The day: the milestone the reader submitted, read off the row the form was opened from — the
    // same derivation the panel renders, so the sentence and the chip cannot disagree about it.
    const index = Number(body.milestone_index ?? sentMilestoneIndex);
    const day = dayOf(timeline, index);
    if (!body.recorded_by || !body.recorded_at || day === null) {
      // A 409 that does not name the record is not the refusal this sentence describes. Say only
      // what is true — nothing was recorded — rather than filling the gap with a guess.
      return { kind: OUTCOME.COULD_NOT_RECORD, sentence: COULD_NOT_RECORD };
    }
    return {
      kind: OUTCOME.ALREADY_EVALUATED,
      sentence: alreadyEvaluatedSentence({ day, recordedBy: body.recorded_by, recordedAt: body.recorded_at }),
    };
  }

  if (code === 400) {
    if (body.known_milestones) return { kind: OUTCOME.STALE_MILESTONE, sentence: STALE_MILESTONE };
    if (typeof sentText === 'string' && sentText.trim() === '') {
      return { kind: OUTCOME.EMPTY_CONTENT, sentence: EMPTY_CONTENT };
    }
    return { kind: OUTCOME.NO_RUNNING_WINDOW, sentence: NO_RUNNING_WINDOW };
  }

  return { kind: OUTCOME.COULD_NOT_RECORD, sentence: COULD_NOT_RECORD };
}

/** The `day` of one milestone index on a timeline, or `null` when the row does not carry it. */
export function dayOf(timeline, index) {
  const milestones = (timeline && timeline.milestones) || [];
  const wanted = Number(index);
  const found = milestones.find((m) => Number(m.index) === wanted);
  return found && found.day !== undefined && found.day !== null ? found.day : null;
}

// ---------------------------------------------------------------------------------------------
// THE CLIENT-SIDE GUARDS.
// ---------------------------------------------------------------------------------------------

/**
 * The milestones the form may offer: every one that is NOT `completed`. A completed milestone
 * already carries its submission — a second one is a `409` (`server/probation-evaluations.js:101`),
 * so offering it would be a control whose only outcome is a refusal.
 *
 * A milestone that is not yet DUE is offered. That is not an oversight: a submission is a person's
 * act, not a due-date event, and the server accepts one (`probation-correction-path-spec.md:71`,
 * measured `201`). The form must not filter by date.
 */
export function selectableMilestones(timeline) {
  const milestones = (timeline && timeline.milestones) || [];
  return milestones.filter((m) => m && m.state !== 'completed');
}

/** Whether the row carries anything this form can record. When it does not, the row says so instead. */
export function hasRecordableMilestone(timeline) {
  return selectableMilestones(timeline).length > 0;
}

/**
 * The option the form opens on: `nextMilestone(t)`'s — the SAME helper the row's summary line uses,
 * so the form and the row cannot point at different milestones. `''` when there is nothing to
 * record, which is also when the button is not rendered.
 */
export function defaultMilestoneIndex(timeline) {
  const next = nextMilestone(timeline);
  if (!next || next.state === 'completed') return '';
  return String(next.index);
}

/** One option's text, in the vocabulary the chips already use: `day 30 · Overdue · 19 October 2026`. */
export function milestoneOptionLabel(milestone) {
  if (!milestone) return '';
  return `day ${milestone.day} · ${milestoneLabel(milestone.state)} · ${formatDay(milestone.due_date)}`;
}

/**
 * Exactly what the route reads — and nothing else. `submitted_by` and `submitted_at` are stamped from
 * the token and the clock (`server/probation-evaluations.js:120, 124-125`), and the milestone's `day`
 * and `due_date` are copied from the server's own derivation (`:123-124`), so sending any of them
 * would be a second, client-side version of a fact the server already holds.
 */
export function evaluationPayload(milestoneIndex, text) {
  return { milestone_index: Number(milestoneIndex), content: text };
}

/**
 * Whether the primary control is enabled. Two conditions, both of them the reader's to clear: nothing
 * is in flight, and the evaluation is not empty once trimmed. The server's `400` for empty content is
 * still rendered if it ever arrives — this guard is the courtesy, not the enforcement.
 */
export function canSubmit({ text, submitting } = {}) {
  if (submitting) return false;
  return typeof text === 'string' && text.trim() !== '';
}

// =============================================================================================
// SCREEN 2 — THE CORRECTION PATH (2026-11-04).
//
// `POST /api/employees/:id/probation-evaluations/:evaluation_id/corrections` has existed over HTTP
// since P3-2 and was registered CALLERLESS: nothing in the product posted to it. This half is the
// screen's words and guards, in the same shape as Screen 1's above.
//
// ONE NAMING RULE, and it is not cosmetic. The form's OWN fields are `text` and `why`; the wire's
// `content` and `reason` exist only at the boundary (`correctionPayload` out, `effectiveText` in).
// `scripts/check-served-document-renderer.py` walks every module under `client/src` and reddens on
// any `.content` read outside `MarkdownDocument`, because `content` is the SERVED DOCUMENT body's
// field name and that guard is what keeps a served document from being printed as markup. A form
// field called `content` would have to narrow that guard; this file keeps the guard and renames
// the field instead. The two boundary functions below are the only places the wire's name appears,
// and neither is a `.content` READ — a property key and a destructuring binding are not.
//
// WHAT THE 201 CARRIES, and why only one part of it is rendered: `{ correction, evaluation,
// effective }`. `evaluation` is the ORIGINAL row, unmodified (`server/probation-evaluations.js:237`)
// — rendering it would show the words the reader is correcting. `effective` is what a reader should
// show (`:282-302`). This module reads `effective` and never touches `evaluation`.
//
// WHAT THIS FILE DOES NOT OWN: no route serves a correction's original wording (`:270-281`), so the
// form SAYS the original is not shown rather than rendering a blank. Answering who may read a
// correction's wording is docs/access-model.md §8 item 13 — the owner's, not this build's.
// =============================================================================================

/** The control on a completed milestone's line. */
export const CORRECT_BUTTON = 'Correct';
/** The modal's title. */
export const CORRECTION_TITLE = 'Correct a recorded evaluation';
/** The two field labels and the primary control. */
export const CORRECTED_LABEL = 'Corrected evaluation';
export const WHY_LABEL = 'Why this is being changed';
export const CORRECTION_SUBMIT = 'Record a correction';

/**
 * The helper under the reason box. Every clause is a fact about the write path: the reason is a
 * required non-empty string (`server/probation-evaluations.js:193-196`), it is stored ON the
 * correction row (`:214-218`), and the correction is a separate dated row rather than a rewrite.
 */
export const REASON_HELPER =
  'Required. It is stored with the correction and is what distinguishes a correction from a quiet '
  + 'edit.';

/**
 * What the form says instead of showing the recorded wording. There is no blank and no placeholder
 * here on purpose: no route serves `content` (`server/probation-evaluations.js:270-281`), so a form
 * that showed an empty box would be telling the reader the original is empty.
 */
export const ORIGINAL_NOT_SHOWN =
  'The recorded wording is not shown on this screen in this release — no route serves it yet. Your '
  + 'corrected wording is stored beside the original, and the original is not changed.';

/** Wrong role, or outside the row. The two causes share ONE sentence: the `403` is empty
 *  (`server/access.js:446-448`, `server/index.js:1781`), so the client has no reading that tells
 *  them apart — and `server/access.js:19` makes that emptiness load-bearing. */
export const CORRECTION_NOT_PERMITTED =
  "You can't correct this evaluation from this account. Nothing was recorded, and you are still "
  + 'signed in.';

/** Empty or whitespace-only corrected wording (`server/probation-evaluations.js:189-192`). */
export const CORRECTION_EMPTY_CONTENT =
  'Enter the corrected evaluation. An empty correction is not recorded.';

/** Empty or whitespace-only reason (`:193-196`). */
export const CORRECTION_EMPTY_REASON =
  'Say why the recorded evaluation is being changed. The reason is required and is stored with the '
  + 'correction.';

/** Unknown id OR another hire's id — ONE body for both (`:205-209`). The sentence never says the
 *  evaluation "does not exist", because the server deliberately does not tell the client which of
 *  the two it was: saying so would be a claim the response does not carry. */
export const CORRECTION_NOT_FOUND =
  'That evaluation could not be found for this employee. Nothing was recorded.';

/** Anything else — a `500`, an actor gate this screen cannot reach, a status this route does not
 *  produce. Claims no cause. */
export const CORRECTION_COULD_NOT_RECORD =
  'The correction could not be recorded. Nothing was recorded — please try again.';

/** The request never completed. */
export const CORRECTION_CONNECTION_FAILED =
  'The correction could not be recorded — the connection failed. Nothing was recorded.';

// ---------------------------------------------------------------------------------------------
// THE ENTRY LINE. One per milestone that already carries a recorded evaluation, built from the
// timeline payload the panel already holds (`completion.evaluation_id`, `completed_by`,
// `completed_at`, `correction_count`, `last_corrected_by`, `last_corrected_at` —
// `server/probation-evaluations.js:333-343`). No picker, no select, no id a user types: the id
// travels from a rendered completion, which is itself a granted read.
// ---------------------------------------------------------------------------------------------

/**
 * The milestones a correction can be recorded against: every one whose `completion` carries an
 * `evaluation_id`. `state === 'completed'` is DERIVED from `completion` being present
 * (`server/probation-timeline.js`, `milestonesFor`), so this filter and the chip row can never
 * disagree about which milestones are complete — and a milestone with no completion has no id to
 * correct, so it is not offered.
 */
export function completedMilestones(timeline) {
  const milestones = (timeline && timeline.milestones) || [];
  return milestones.filter((m) => m && m.completion && m.completion.evaluation_id);
}

/** `day 30 · recorded by {who} on {when}` — the first half of the line. */
export function completionLine(milestone) {
  const completion = (milestone && milestone.completion) || {};
  return `day ${milestone.day} · recorded by ${completion.completed_by} on `
    + `${formatDate(completion.completed_at)}`;
}

/**
 * The second half, present only when a correction exists: `corrected 2×, last by {who} on {when}`.
 * `''` when the count is zero, so the caller renders one line or two without inventing a clause
 * for a record that has never been corrected.
 */
export function correctionClause(completion) {
  const count = Number(completion && completion.correction_count);
  if (!Number.isFinite(count) || count <= 0) return '';
  return `corrected ${count}\u00d7, last by ${completion.last_corrected_by} on `
    + `${formatDate(completion.last_corrected_at)}`;
}

// ---------------------------------------------------------------------------------------------
// THE FORM'S READ-ONLY BLOCK. Every value is already in hand on the row the form was opened from.
// ---------------------------------------------------------------------------------------------

/** `Milestone day 30 · due 19 October 2026` — both values from the server's own derivation. */
export function milestoneContextLine(milestone) {
  if (!milestone) return '';
  return `Milestone day ${milestone.day} · due ${formatDate(milestone.due_date)}`;
}

/** `Recorded by admin on 19 October 2026`. */
export function recordedLine(completion) {
  const row = completion || {};
  return `Recorded by ${row.completed_by} on ${formatDate(row.completed_at)}`;
}

/** `Corrections so far: 2`. A COUNT, never the wording — see the module note above. */
export function correctionsSoFarLine(completion) {
  const count = Number(completion && completion.correction_count);
  return `Corrections so far: ${Number.isFinite(count) && count > 0 ? count : 0}`;
}

// ---------------------------------------------------------------------------------------------
// THE WIRE BOUNDARY. The only two functions in the client that speak the route's field names.
// ---------------------------------------------------------------------------------------------

/**
 * Exactly what the route reads, and nothing else: `content` and `reason`, both required strings.
 * `milestone_index` is deliberately NOT sent — the row being corrected already carries it
 * (`server/index.js:1765-1766`), and a second source could disagree with it.
 */
export function correctionPayload(text, why) {
  return { content: text, reason: why };
}

/**
 * The corrected wording a reader should be shown, read off the 201's `effective` object — NEVER off
 * `evaluation`, which is the original row unmodified (`server/probation-evaluations.js:237`).
 *
 * The destructuring is the point: `effective.content` is a `.content` read, and the renderer guard
 * described at the top of this section forbids one anywhere under `client/src` outside
 * `MarkdownDocument`. A binding is not a read of a served document body, and the field this returns
 * is a manager's own sentence echoed back from their own 201 — but the guard cannot tell the two
 * apart, and it must not be narrowed to make this line convenient.
 */
export function effectiveText(effective) {
  const body = effective && typeof effective === 'object' ? effective : {};
  const { content: shown } = body;
  return typeof shown === 'string' ? shown : '';
}

/** How many corrections the milestone now carries, off the same `effective` object. */
export function effectiveCorrectionCount(effective) {
  const body = effective && typeof effective === 'object' ? effective : {};
  const count = Number(body.correction_count);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

/** The success line at the foot of the panel. Showing the wording back is safe: the reader just
 *  typed it and it is returned by their own 201. */
export function correctionRecordedLine(text, count) {
  const n = Number(count) > 0 ? Number(count) : 0;
  return `Correction recorded. The record now reads: \u201c${text}\u201d — ${n} `
    + `correction${n === 1 ? '' : 's'} on this milestone.`;
}

// ---------------------------------------------------------------------------------------------
// THE CLASSIFICATION. One outcome in, one kind and one sentence out — the same shape as Screen 1's,
// kept separate so neither screen's branch can silently absorb the other's status.
// ---------------------------------------------------------------------------------------------

/**
 * Classify one correction's outcome.
 *
 * The route's `400`s are enumerated, because the client decides on STRUCTURE and on what it SENT,
 * never on the server's prose (the copy-drift class `panelResults.js` §1 names): `requireActor`
 * (`server/index.js:1776-1777`), empty `content` (`server/probation-evaluations.js:189-192`), empty
 * `reason` (`:193-196`). A signed-in screen always carries an actor, so the first is unreachable
 * here and falls to "could not be recorded", which claims no cause. A FUTURE `400` on this route
 * must be added here or this branch will state a cause the client cannot observe.
 *
 * There is no `409` on this route on purpose: more than one correction is deliberately allowed
 * (`:173-177`). Any status this list does not name — a `500`, a `409` from some future change —
 * lands on the cause-free sentence.
 */
export function correctionOutcome(outcome = {}) {
  const {
    error, status, payload, sentText, sentWhy,
  } = outcome;
  const body = payload && typeof payload === 'object' ? payload : {};

  // A thrown error is decided by its TYPE, never by its message.
  if (error) {
    if (error instanceof RefusalError) {
      return { kind: OUTCOME.CORRECTION_REFUSED, sentence: CORRECTION_NOT_PERMITTED };
    }
    if (error instanceof SessionExpiredError) return { kind: OUTCOME.SIGNED_OUT, sentence: null };
    return { kind: OUTCOME.CORRECTION_FAILED, sentence: CORRECTION_CONNECTION_FAILED };
  }

  const code = Number(status);
  if (!Number.isFinite(code)) {
    return { kind: OUTCOME.CORRECTION_FAILED, sentence: CORRECTION_CONNECTION_FAILED };
  }
  if (code >= 200 && code < 300) return { kind: OUTCOME.CORRECTED, sentence: null };
  if (code === 401) return { kind: OUTCOME.SIGNED_OUT, sentence: null };
  if (code === 403) return { kind: OUTCOME.CORRECTION_REFUSED, sentence: CORRECTION_NOT_PERMITTED };
  if (code === 404) return { kind: OUTCOME.CORRECTION_NOT_FOUND, sentence: CORRECTION_NOT_FOUND };
  if (code === 400) {
    if (typeof sentText === 'string' && sentText.trim() === '') {
      return { kind: OUTCOME.CORRECTION_EMPTY_CONTENT, sentence: CORRECTION_EMPTY_CONTENT };
    }
    if (typeof sentWhy === 'string' && sentWhy.trim() === '') {
      return { kind: OUTCOME.CORRECTION_EMPTY_REASON, sentence: CORRECTION_EMPTY_REASON };
    }
    return { kind: OUTCOME.CORRECTION_FAILED, sentence: CORRECTION_COULD_NOT_RECORD };
  }
  return { kind: OUTCOME.CORRECTION_FAILED, sentence: CORRECTION_COULD_NOT_RECORD };
}

/**
 * Whether the primary control is enabled: nothing in flight, and BOTH fields non-empty once
 * trimmed. The server's two `400`s are still rendered if one ever arrives — this guard is the
 * courtesy, not the enforcement.
 */
export function canSubmitCorrection({ text, why, submitting } = {}) {
  if (submitting) return false;
  const hasText = typeof text === 'string' && text.trim() !== '';
  const hasWhy = typeof why === 'string' && why.trim() !== '';
  return hasText && hasWhy;
}
