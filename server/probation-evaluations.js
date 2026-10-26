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
 *                            and when; a silent overwrite would destroy exactly that. How a CORRECTION
 *                            should be recorded is a product decision this module does not take: it
 *                            stores one evaluation per milestone and refuses the second.
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

const requireActor = (actor) => {
  if (!actor || !String(actor).trim()) {
    throw new ProbationEvaluationError(400, 'a named actor is required to submit a probation evaluation');
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
    `SELECT submitted_by, submitted_at FROM probation_evaluations
     WHERE employee_id = ${db.escapeString(subject.id)} AND milestone_index = ${wanted}`
  );
  if (existing.length > 0) {
    throw new ProbationEvaluationError(
      409,
      `milestone ${wanted} already has a submitted evaluation — recorded by ${existing[0].submitted_by} at ${existing[0].submitted_at}`,
      { recorded_by: existing[0].submitted_by, recorded_at: existing[0].submitted_at },
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
 * The `completions` map `probationTimeline.milestonesFor` reads, keyed by employee id and then by
 * milestone index: `{ [employee_id]: { [milestone_index]: { complete_at, completed_by, ... } } }`.
 *
 * ONE QUERY for the whole roster rather than one per hire — the timeline route reads the company at
 * once, and a per-hire query would turn one screen into N round trips.
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
    };
  }
  return byEmployee;
}

module.exports = {
  ProbationEvaluationError,
  loadSubject,
  recordEvaluation,
  getEvaluation,
  evaluationsFor,
  completionsFor,
};
