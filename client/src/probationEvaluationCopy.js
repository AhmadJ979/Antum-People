/**
 * client/src/probationEvaluationCopy.js — Screen 1's words, and the client's own guards.
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
});

/**
 * Classify one submission's outcome.
 *
 * @param {object} outcome
 *   `error`          what the call threw, if it threw. A `RefusalError`/`SessionExpiredError` decides
 *                    the outcome on its own — the shipped classification already made that call.
 *   `status`         the HTTP status, when a response arrived.
 *   `payload`        the parsed body, or `{}` when it did not parse.
 *   `sentContent`    exactly what the form sent. Read ONLY to tell the empty-content refusal apart.
 *   `sentMilestoneIndex` the index the form sent, used when the 409's payload omits it.
 *   `timeline`       the row the form was opened from, used to name the day in the 409 sentence.
 * @returns {{kind: string, sentence: string|null}} `sentence` is null only where the shipped
 *          convention is to leave the screen: a recorded evaluation (the panel shows the success
 *          line instead) and a dead session (the app returns to sign-in).
 */
export function submissionOutcome(outcome = {}) {
  const {
    error, status, payload, sentContent, sentMilestoneIndex, timeline,
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
    if (typeof sentContent === 'string' && sentContent.trim() === '') {
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
export function evaluationPayload(milestoneIndex, content) {
  return { milestone_index: Number(milestoneIndex), content };
}

/**
 * Whether the primary control is enabled. Two conditions, both of them the reader's to clear: nothing
 * is in flight, and the evaluation is not empty once trimmed. The server's `400` for empty content is
 * still rendered if it ever arrives — this guard is the courtesy, not the enforcement.
 */
export function canSubmit({ content, submitting } = {}) {
  if (submitting) return false;
  return typeof content === 'string' && content.trim() !== '';
}
