'use strict';
/**
 * P3-2 (row `69dbf57d`) — the manager's structured evaluation, and the ONLY thing that makes a
 * probation milestone read `completed`.
 *
 * WHY A MODULE AND NOT A ROUTE. `server/preboarding.js` sets the pattern this follows: the rules live
 * in a function a second caller (P3-3 reading completion state, a future ATS adapter, a scheduled job)
 * can call, and the route is transport — it gates the actor and the row scope, then hands the body
 * here. Two callers of one function, not two implementations of one rule.
 *
 * WHAT MAKES A SUBMISSION REFUSABLE, and why each refusal is here rather than in the route:
 *   * no named actor      -> 400. The record's value is that it names the person who wrote it. The
 *                            route refuses this BEFORE any lookup (decision 22's shape); this module
 *                            refuses it again, so a second caller cannot write an unattributable row.
 *   * empty content       -> 400. An empty form recorded as a submitted evaluation would let a
 *                            milestone read `completed` on the strength of nothing.
 *   * no probation window -> 400. A hire who is not on probation has no milestones, so there is no
 *                            milestone to evaluate; `milestonesFor` is the one place that decides this
 *                            (server/probation-timeline.js), and it is asked rather than guessed at.
 *   * an index that is not one of THIS hire's milestones -> 400, carrying the valid set — the same
 *                            shape the users route uses when it answers an unknown role with
 *                            `known_roles`.
 *   * a second submission for the same milestone -> 409. The row is the record of who submitted what
 *                            and when; a silent overwrite would destroy exactly that. HOW a correction
 *                            is recorded was a decision this module did not take; it was TAKEN by the
 *                            owner on 2026-10-28 (option (A) — a separate dated row beside the original,
 *                            never a rewrite) and the shape is `correctEvaluation` below. The document is
 *                            `probation-correction-path-spec.md` (its §1, §3b's C1 and §4); the DDL is in
 *                            server/schema.sql. The 409 stays a 409 and now points at that path.
 *
 * A renewal or a second probation needs nothing added here: `probation_timeline` derives its milestones
 * from the window, and the UNIQUE key is (employee_id, milestone_index) — an employee whose window is
 * re-derived keeps the evaluations of the milestones that still exist.
 */
const { randomUUID } = require('node:crypto');
const db = require('./db');
const probationTimeline = require('./probation-timeline');

/** A refusal with the status the route will answer with. Same shape as preboarding's typed errors. */
class ProbationEvaluationError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = 'ProbationEvaluationError';
    this.status = status;
    Object.assign(this, extra);
  }
}

const requireActor = (actor, message = 'a named actor is required to submit a probation evaluation') => {
  if (!actor || !String(actor).trim()) {
    throw new ProbationEvaluationError(400, message);
  }
};

const textOf = (value) => (typeof value === 'string' ? value.trim() : '');

/** The employee row an evaluation is about, or a 404. Exported so the route can apply the row scope. */
async function loadSubject(employeeId) {
  const id = textOf(employeeId);
  if (!id) throw new ProbationEvaluationError(400, 'employee_id is required');
  const rows = await db.query(`SELECT * FROM employees WHERE id = ${db.escapeString(id)}`);
  if (rows.length === 0) throw new ProbationEvaluationError(404, 'Employee not found');
  return rows[0];
}

/**
 * Record one submitted evaluation. Returns `{ evaluation, milestone }`.
 *
 * @param {object} subject          an employee row (from `loadSubject`)
 * @param {object} submission       `{ milestone_index, content }` — the submitted form
 * @param {object} context          `{ actor }` — the signed-in username, required
 */
async function recordEvaluation(subject, submission = {}, context = {}) {
  const actor = context.actor;
  requireActor(actor);

  const content = textOf(submission.content);
  if (!content) {
    throw new ProbationEvaluationError(400, 'a submitted evaluation must carry the manager’s own words: content cannot be empty');
  }

  const timeline = probationTimeline.milestonesFor(subject, { now: context.now });
  if (!timeline) {
    throw new ProbationEvaluationError(400, 'this hire has no probation window that is still running, so there is no milestone to evaluate');
  }

  const wanted = Number(submission.milestone_index);
  const milestone = timeline.milestones.find((m) => m.index === wanted);
  if (!milestone) {
    throw new ProbationEvaluationError(
      400,
      `milestone_index must be one of this hire’s milestones (${timeline.milestones.map((m) => m.index).join(', ')})`,
      { known_milestones: timeline.milestones.map((m) => ({ index: m.index, day: m.day, due_date: m.due_date })) },
    );
  }

  const existing = await db.query(
    `SELECT id, submitted_by, submitted_at FROM probation_evaluations
     WHERE employee_id = ${db.escapeString(subject.id)} AND milestone_index = ${wanted}`
  );
  if (existing.length > 0) {
    // The payload gains the ROW ID and the milestone index (spec §4b, §4f): until the correction path
    // existed, the refusal named who and when and NOT which row, so a client that hit the 409 could not
    // act on it without re-reading the timeline. The row it names is the one a correction is addressed to.
    throw new ProbationEvaluationError(
      409,
      `milestone ${wanted} already has a submitted evaluation — recorded by ${existing[0].submitted_by} `
      + `at ${existing[0].submitted_at}. A correction is recorded against that evaluation instead of a `
      + `second submission.`,
      {
        recorded_by: existing[0].submitted_by,
        recorded_at: existing[0].submitted_at,
        evaluation_id: existing[0].id,
        milestone_index: wanted,
      },
    );
  }

  const id = randomUUID();
  const submittedAt = new Date().toISOString();
  await db.query(`INSERT INTO probation_evaluations
    (id, employee_id, milestone_index, milestone_due_date, milestone_day, content, submitted_by, submitted_at)
    VALUES (${db.escapeString(id)}, ${db.escapeString(subject.id)}, ${wanted},
    ${db.escapeString(milestone.due_date)}, ${milestone.day}, ${db.escapeString(content)},
    ${db.escapeString(actor)}, ${db.escapeString(submittedAt)})`);

  // The audit row names the ACTOR, like every other write path (decision 22), and records what was
  // submitted WITHOUT copying the manager's words a second time: the evaluation row is append-only and
  // IS the record of the content, so the log carries the metadata and points at it by id.
  await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, new_values, timestamp)
    VALUES (${db.escapeString(randomUUID())}, ${db.escapeString(actor)}, 'probation_evaluations', ${db.escapeString(id)}, 'CREATE',
    ${db.escapeString(JSON.stringify({
      employee_id: subject.id,
      milestone_index: wanted,
      milestone_due_date: milestone.due_date,
      milestone_day: milestone.day,
      submitted_by: actor,
      submitted_at: submittedAt,
    }))}, CURRENT_TIMESTAMP)`);

  return { evaluation: await getEvaluation(id), milestone };
}

/** One evaluation row, or `null`. */
async function getEvaluation(id) {
  const rows = await db.query(`SELECT * FROM probation_evaluations WHERE id = ${db.escapeString(id)}`);
  return rows[0] || null;
}

/** Every evaluation recorded against one employee, oldest first. P3-3 reads completion state from here. */
async function evaluationsFor(employeeId) {
  return await db.query(
    `SELECT * FROM probation_evaluations WHERE employee_id = ${db.escapeString(textOf(employeeId))}
     ORDER BY milestone_index`
  );
}

/**
 * P3-2 follow-up (row `0484e79e`) — record a CORRECTION to a submitted evaluation.
 *
 * The submitted row is NEVER rewritten (spec §1): it stays the record of who submitted what, and when,
 * which is the whole reason the 409 above exists. A correction is a separate dated row that names the
 * evaluation it corrects, carries the corrected words, a REQUIRED reason and the named actor.
 *
 * The refusals, and why each is here rather than only in the route — a second caller must not be able to
 * write an unattributable, unreasoned or mis-addressed correction:
 *   * no named actor -> 400, BEFORE any lookup (decision 22's shape).
 *   * empty content   -> 400. A correction with no corrected words changes nothing.
 *   * empty reason    -> 400. Spec §1.2: "a correction with corrected words and no reason is an edit
 *                        wearing a badge" — the reason is what makes this shape a correction.
 *   * an evaluation that does not exist, OR that belongs to ANOTHER hire -> 404, ONE body for both
 *                        causes, so another hire's row id cannot be used as a probe (spec §4c).
 *
 * Deliberately ALLOWED: the probation window has ended, the milestone has escalated, the employee is
 * terminated, and more than one correction. Correcting is not submitting — this function consults no
 * window and no milestone list, because the record it corrects already exists and already named its
 * milestone (spec §1.6), and those are exactly the cases a late discovery arrives in.
 *
 * @param {object} subject     an employee row (from `loadSubject`)
 * @param {object} correction  `{ evaluation_id, content, reason }` — `milestone_index` is NOT accepted:
 *                             the row being corrected already carries it, and a second source could
 *                             disagree with it (spec §4c)
 * @param {object} context     `{ actor }` — the signed-in username, required
 */
async function correctEvaluation(subject, correction = {}, context = {}) {
  const actor = context.actor;
  requireActor(actor, 'a named actor is required to correct a probation evaluation');

  const content = textOf(correction.content);
  if (!content) {
    throw new ProbationEvaluationError(400, 'a correction must carry the manager’s corrected words: content cannot be empty');
  }
  const reason = textOf(correction.reason);
  if (!reason) {
    throw new ProbationEvaluationError(400, 'a correction must say why the recorded evaluation is being changed: reason cannot be empty');
  }

  const evaluationId = textOf(correction.evaluation_id);
  const found = evaluationId
    ? await db.query(
      `SELECT * FROM probation_evaluations
       WHERE id = ${db.escapeString(evaluationId)} AND employee_id = ${db.escapeString(subject.id)}`
    )
    : [];
  if (found.length === 0) {
    // ONE body for both causes on purpose (spec §4c): an id that does not exist and an id that exists
    // for a different hire read identically, so the route cannot be used to test whether a row id is real.
    throw new ProbationEvaluationError(404, 'No submitted evaluation with that id for this employee');
  }
  const original = found[0];

  const id = randomUUID();
  const correctedAt = new Date().toISOString();
  await db.query(`INSERT INTO probation_evaluation_corrections
    (id, evaluation_id, employee_id, milestone_index, content, reason, corrected_by, corrected_at)
    VALUES (${db.escapeString(id)}, ${db.escapeString(original.id)}, ${db.escapeString(original.employee_id)},
    ${original.milestone_index}, ${db.escapeString(content)}, ${db.escapeString(reason)},
    ${db.escapeString(actor)}, ${db.escapeString(correctedAt)})`);

  // ONE audit row per correction, naming the ACTOR (decision 22). The corrected text stays in the
  // correction row and is NOT copied into the log — the same division the submission above uses, and the
  // reason (which is the correction's point) is carried here because it is what the log has to explain.
  await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, new_values, timestamp)
    VALUES (${db.escapeString(randomUUID())}, ${db.escapeString(actor)}, 'probation_evaluation_corrections',
    ${db.escapeString(id)}, 'CREATE',
    ${db.escapeString(JSON.stringify({
      evaluation_id: original.id,
      employee_id: original.employee_id,
      milestone_index: original.milestone_index,
      corrected_by: actor,
      corrected_at: correctedAt,
      reason,
    }))}, CURRENT_TIMESTAMP)`);

  return {
    correction: await getCorrection(id),
    evaluation: original,
    effective: await effectiveEvaluation(original.id),
  };
}

/** One correction row, or `null`. */
async function getCorrection(id) {
  const rows = await db.query(`SELECT * FROM probation_evaluation_corrections WHERE id = ${db.escapeString(id)}`);
  return rows[0] || null;
}

/**
 * Every correction recorded against one hire, OLDEST FIRST (spec §4b), so the newest is the last entry.
 *
 * `?as_of` filters corrections by `corrected_at` exactly as `completionsFor` filters submissions by
 * `submitted_at` — a reading pinned to a past day must not show today's correction under yesterday's
 * date (spec §1.5, the defect P3-2 already closed for submissions).
 *
 * `ORDER BY corrected_at, rowid`: two corrections made inside the same millisecond would otherwise sort
 * arbitrarily, and "the newest is effective" has to be a fact rather than a coin toss. `rowid` is SQLite's
 * insertion order for this table.
 */
async function correctionsFor(employeeId, options = {}) {
  const dayClause = options.asOf ? ` AND substr(corrected_at, 1, 10) <= ${db.escapeString(options.asOf)}` : '';
  return await db.query(
    `SELECT * FROM probation_evaluation_corrections
     WHERE employee_id = ${db.escapeString(textOf(employeeId))}${dayClause}
     ORDER BY corrected_at, rowid`
  );
}

/**
 * The assessment a reader should show: the original submitted row with the NEWEST correction applied
 * (spec §4b). **This is the only function a reader may use to show an assessment** — P3-4 reads through
 * it, `completionsFor` publishes the count, and a reader that queries `probation_evaluations` directly
 * will show a corrected record as the original.
 *
 * `content` is the effective text; `last_corrected_by`/`last_corrected_at`/`correction_count` say how it
 * got there. The submitter's own `submitted_by`/`submitted_at` are returned UNCHANGED — who submitted it
 * and who corrected it are two facts and are never conflated (spec §3b).
 *
 * WHO MAY READ `content` IS NOT DECIDED HERE (spec §4e): no route serves this yet. The corrected text and
 * the original text stay unread in this build because `content` would reach FINANCE and the hire's
 * manager, and that is a cell decision — docs/access-model.md §8 item 13, the owner's.
 */
async function effectiveEvaluation(evaluationId, options = {}) {
  const rows = await db.query(
    `SELECT * FROM probation_evaluations WHERE id = ${db.escapeString(textOf(evaluationId))}`
  );
  const original = rows[0] || null;
  if (!original) return null;
  const corrections = (await correctionsFor(original.employee_id, { asOf: options.asOf }))
    .filter((c) => c.evaluation_id === original.id);
  const newest = corrections.length ? corrections[corrections.length - 1] : null;
  return {
    evaluation_id: original.id,
    employee_id: original.employee_id,
    milestone_index: original.milestone_index,
    content: newest ? newest.content : original.content,
    submitted_by: original.submitted_by,
    submitted_at: original.submitted_at,
    correction_count: corrections.length,
    last_corrected_by: newest ? newest.corrected_by : null,
    last_corrected_at: newest ? newest.corrected_at : null,
    correction: newest,
  };
}

/**
 * The `completions` map `probationTimeline.milestonesFor` reads, keyed by employee id and then by
 * milestone index: `{ [employee_id]: { [milestone_index]: { complete_at, completed_by, ... } } }`.
 *
 * TWO QUERIES for the whole roster rather than one per hire — one over the submissions and one over the
 * corrections, whatever the roster's size. A per-hire query would turn one screen into N round trips,
 * which is the property P3-2 wrote down and this change keeps (spec §7.11).
 *
 * A completion carries `correction_count`, `last_corrected_by` and `last_corrected_at`, and **NOT
 * `content`**: the screen that already exists learns that a record was corrected, and who corrected it,
 * without publishing a manager's words to FINANCE or to the hire (spec §4e — that read is the owner's
 * cell decision, docs/access-model.md §8 item 13).
 *
 * @param {string[]} employeeIds
 * @param {object} [options]  `{ asOf }` — a `YYYY-MM-DD` day to read the submissions as of
 */
async function completionsFor(employeeIds = [], options = {}) {
  const ids = employeeIds.filter(Boolean);
  if (ids.length === 0) return {};
  const inClause = ids.map((id) => db.escapeString(id)).join(', ');
  // `asOf` is the timeline route's `?as_of=`: it pins the reading to a DAY, so a submission recorded
  // after that day is not a completion as of that day. Without this the instrument that shows the same
  // figures twice would be serving today's state under yesterday's date.
  const dayClause = options.asOf ? ` AND substr(submitted_at, 1, 10) <= ${db.escapeString(options.asOf)}` : '';
  const rows = await db.query(
    `SELECT * FROM probation_evaluations WHERE employee_id IN (${inClause})${dayClause} ORDER BY submitted_at`
  );
  const byEmployee = {};
  for (const row of rows) {
    byEmployee[row.employee_id] = byEmployee[row.employee_id] || {};
    byEmployee[row.employee_id][row.milestone_index] = {
      evaluation_id: row.id,
      completed_at: row.submitted_at,
      completed_by: row.submitted_by,
      milestone_due_date: row.milestone_due_date,
      correction_count: 0,
      last_corrected_by: null,
      last_corrected_at: null,
    };
  }
  // The second query, and the ONLY other one: the corrections, filtered by `corrected_at` under the same
  // `asOf`, oldest first so the last one merged is the newest (spec §1.5).
  const corrDayClause = options.asOf ? ` AND substr(corrected_at, 1, 10) <= ${db.escapeString(options.asOf)}` : '';
  const corrections = await db.query(
    `SELECT evaluation_id, employee_id, milestone_index, corrected_by, corrected_at
     FROM probation_evaluation_corrections WHERE employee_id IN (${inClause})${corrDayClause}
     ORDER BY corrected_at, rowid`
  );
  for (const c of corrections) {
    const completion = byEmployee[c.employee_id] && byEmployee[c.employee_id][c.milestone_index];
    // A correction whose own submission is filtered out by `asOf` has no completion to annotate: the
    // pinned reading says the submission was not there yet, and it must not be resurrected by a row
    // written later than the record it corrects.
    if (!completion) continue;
    completion.correction_count += 1;
    completion.last_corrected_by = c.corrected_by;
    completion.last_corrected_at = c.corrected_at;
  }
  return byEmployee;
}

module.exports = {
  ProbationEvaluationError,
  loadSubject,
  recordEvaluation,
  getEvaluation,
  evaluationsFor,
  correctEvaluation,
  getCorrection,
  correctionsFor,
  effectiveEvaluation,
  completionsFor,
};
