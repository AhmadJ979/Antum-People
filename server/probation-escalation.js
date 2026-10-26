'use strict';
/**
 * server/probation-escalation.js — P3-3 (row `bb60c7a3`): a probation milestone that passes its
 * deadline with no submitted evaluation escalates to the manager's manager AND to HR.
 *
 * ============================ WHAT IS DERIVED, WHAT IS STORED ============================
 *
 * The chain this sits on has two halves, and this module adds a third only because it is a different
 * KIND of fact:
 *
 *   * the milestone DATES are derived on every read (P3-1, `server/probation-timeline.js`): a function
 *     of `start_date` and the window's length. Nothing is pre-materialised, so there is no stored
 *     milestone that can disagree with the start date it came from.
 *   * the COMPLETION state is a submitted evaluation (P3-2, `server/probation_evaluations`): a
 *     person's act, and the only thing in the chain worth storing, because it cannot be computed.
 *   * the ESCALATION is stored (`probation_escalations`) because "the system noticed, at this instant,
 *     and addressed it to these people" is also an act, not a function of a date. **Deadlines are
 *     derived on every tick and every read; only the FIRING is a row.** Delete the table and the
 *     product still knows which milestones are overdue — it just cannot say who was told, or when.
 *
 * WHO IT IS ADDRESSED TO, AND WHO IT IS NOT. The manager's manager and HR — deliberately NOT the
 * direct manager. The escalation exists because the direct report's milestone was not evaluated, and
 * the direct manager is the person whose submission was missing; the row's own words are "escalates
 * to the manager's manager AND to HR". The chain is resolved from `employees.manager_id` (the column
 * `server/access.js` already derives the `manager` role from) and from `users.access_role`, and it is
 * written INTO the row as resolved at firing time — see the schema comment: a later re-derivation
 * would rewrite history every time somebody changes job.
 *
 * A LINE THAT CANNOT BE RESOLVED IS NAMED, NEVER INVENTED. A hire with no `manager_id`, or a manager
 * who has no manager of their own, escalates anyway, with `reporting_line_missing` naming the missing
 * links (`manager`, `managers_manager`, `hr`). The alternative — inventing a recipient, or silently
 * escalating to nobody — is the failure this team keeps paying for: an instrument that reads as
 * satisfied while measuring nothing.
 *
 * ============================ NOTHING IS DELIVERED ============================
 *
 * The product has no mailer, no webhook and no SMS, so an escalation is an IN-PRODUCT RECORD that
 * HR (and the manager's manager, through HR's own read) can look up. `channel` is `'none'` on every
 * row and `NO_DELIVERY_NOTE` travels on the route's payload: "it escalated" must never be read as
 * "a message arrived somewhere". Same constraint, same wording, as P2-5's flag watcher.
 *
 * ============================ WHO FIRES IT, AND WHAT THE ACTOR IS ============================
 *
 * The escalation is triggered by the CLOCK, not by somebody noticing: the tick is
 * `server/interval-watcher.js` — the one in-process, restart-safe loop P2-5 built and P3-3's row
 * requires be reused rather than re-written. Every row it writes names its actor, exactly as every
 * human write path does (decision 22), and the actor is the watcher's own name
 * (`scheduler:probation-escalation`): a record that says so can never be mistaken for a person's act,
 * and it is a name, not a blank (`performed_by` is never null and never `'system'`).
 *
 * IDEMPOTENCE IS THE UNIQUE KEY, NOT THE CLOCK. One escalation per missed milestone, ever — across
 * ticks, across restarts and across a host that froze twice this morning. The in-process `seen` set
 * only avoids re-deriving an answer the same process already wrote; the database's
 * `UNIQUE (employee_id, milestone_index)` is what makes the guarantee durable.
 *
 * ============================ THE FINAL MILESTONE (measured, not assumed) ============================
 *
 * A milestone's deadline is `start_date + round(k · window / 3)` for k = 1, 2, 3, so the LAST
 * milestone falls on the probation's own end date — the very deadline this row names. The timeline
 * route deliberately reports no timeline once a window has ENDED (`milestonesFor` → `null`), which is
 * right for a screen and fatal for an escalation: the day after the end date the milestone would
 * vanish before anyone could see that it had been missed. This module therefore asks for the ended
 * window explicitly (`includeEnded: true`), and the P3-3 suite pins both halves — the route still
 * omits an ended window, and the escalation still fires for its missed final milestone.
 *
 * NOT IN THIS MODULE: the route. `server/index.js` is transport — it applies the access gate and the
 * row scope, then hands the read to `listEscalations` and the tick to the watcher.
 */

const { randomUUID } = require('node:crypto');
const db = require('./db');
const access = require('./access');
const probationTimeline = require('./probation-timeline');
const probationEvaluations = require('./probation-evaluations');
const { createIntervalWatcher, DEFAULT_INTERVAL_MS } = require('./interval-watcher');

/** The actor every system-fired row carries. A name, never blank, never `'system'`. */
const FIRED_BY = 'scheduler:probation-escalation';

/** Carried on every read, in the shape `server/preboarding-flag.js` uses for `SCOPE_NOTE`. */
const NO_DELIVERY_NOTE =
  'An escalation is an in-product record addressed to the manager\u2019s manager and to HR. The product '
  + 'has no mailer, no webhook and no SMS, so `channel` is `none` on every row and nothing here is '
  + 'proof that a message reached a person.';

const CATCH_UP_RULE = [
  'A milestone is overdue when its derived deadline is strictly behind the reading day and no evaluation has been submitted for it.',
  'A deadline that falls while the process is up is escalated on the next tick ("while the app was open").',
  'A deadline that fell before this process started is escalated on the first tick, marked late, with how late it was noticed ("while the app was not running").',
  'A milestone is never silently skipped: it is either escalated on a tick or caught up late and says so.',
  'One escalation per missed milestone, for good: the guarantee is the database\u2019s UNIQUE key, not this process\u2019s memory.',
  'Nothing is delivered anywhere.',
].join(' ');

const DAY_MS = 86400000;
const nameOf = (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.id;
const personOf = (row) => (row ? { employee_id: row.id, name: nameOf(row) } : null);
const midnightOf = (day) => new Date(`${String(day).slice(0, 10)}T00:00:00Z`);

/** The day a reading is taken from, as UTC midnight: a `Date`, a `YYYY-MM-DD` day, or now. */
function readingDay(now) {
  if (now instanceof Date) return new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  if (typeof now === 'string' && /^\d{4}-\d{2}-\d{2}/.test(now)) return midnightOf(now);
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
}

/** Every account that is HR, oldest first — the recipients an escalation is addressed to. */
async function hrRecipients() {
  const rows = await db.query(
    `SELECT u.username, u.employee_id, e.first_name, e.last_name
       FROM users u LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.access_role = ${db.escapeString(access.ROLES.HR_ADMIN)}
      ORDER BY u.username`
  );
  return rows.map((row) => ({
    username: row.username,
    employee_id: row.employee_id || null,
    name: row.first_name ? `${row.first_name} ${row.last_name}`.trim() : null,
  }));
}

/**
 * The employee's reporting line: the manager, that manager's own manager, and HR. Resolved from the
 * roster the caller already read, so one tick does not re-query per hire.
 *
 * @param {string} employeeId
 * @param {Map<string, object>} roster  `id -> { id, first_name, last_name, manager_id }`
 */
async function reportingLineFor(employeeId, roster = new Map()) {
  const me = roster.get(employeeId) || null;
  const manager = me && me.manager_id ? roster.get(me.manager_id) || null : null;
  // Two kinds of degenerate entry are treated as "no manager of the manager": a `manager_id` that
  // points at the hire themselves, and one that points at the manager themselves. Neither names a
  // second person, and naming the same person twice would read as a chain that exists.
  let managersManager = null;
  if (manager && manager.manager_id && manager.manager_id !== employeeId && manager.manager_id !== manager.id) {
    managersManager = roster.get(manager.manager_id) || null;
  }
  const hr = await hrRecipients();

  const missing = [];
  if (!manager) missing.push('manager');
  // `managers_manager` is named as missing whenever it could not be resolved — including when the
  // reason is that there is no manager at all. Reporting only `manager` would leave a reader to
  // assume the second link was found, which is the same "looks satisfied, measured nothing" failure
  // this file refuses elsewhere: the list names every link the record could NOT resolve.
  if (!managersManager) missing.push('managers_manager');
  if (hr.length === 0) missing.push('hr');

  return {
    manager: personOf(manager),
    managers_manager: personOf(managersManager),
    hr,
    missing,
    resolved: missing.length === 0,
  };
}

/**
 * The milestones of one hire whose deadline is strictly behind the reading day and which carry no
 * submitted evaluation. Derived on every call — nothing here is remembered between calls.
 *
 * `includeEnded` is passed on purpose; see the header's "final milestone" section.
 */
function overdueMilestones(employee, options = {}) {
  const timeline = probationTimeline.milestonesFor(employee, {
    now: readingDay(options.now),
    completions: options.completions || {},
    includeEnded: true,
  });
  if (!timeline) return { timeline: null, overdue: [] };
  return { timeline, overdue: timeline.milestones.filter((milestone) => milestone.state === 'overdue') };
}

/**
 * Every escalation that has come due and is not in the table yet — the watcher's `due()`.
 * Shape: `{ key, due_at, employee, milestone }`, where `due_at` is the milestone's deadline as an
 * instant (UTC midnight of its due date) so the loop can decide `late` against its own start.
 */
async function pendingEscalations(at = new Date()) {
  const day = readingDay(at);
  const rows = await db.query(
    `SELECT id, first_name, last_name, manager_id, start_date, probation_end_date
       FROM employees WHERE status != 'terminated'`
  );
  if (rows.length === 0) return [];

  const rosterRows = await db.query('SELECT id, first_name, last_name, manager_id FROM employees');
  const roster = new Map(rosterRows.map((row) => [row.id, row]));
  const completionsByEmployee = await probationEvaluations.completionsFor(rows.map((row) => row.id));
  const already = new Set(
    (await db.query('SELECT employee_id, milestone_index FROM probation_escalations'))
      .map((row) => `${row.employee_id}@${row.milestone_index}`)
  );

  const items = [];
  for (const row of rows) {
    const { overdue } = overdueMilestones(row, { now: day, completions: completionsByEmployee[row.id] || {} });
    for (const milestone of overdue) {
      const key = `${row.id}@${milestone.index}`;
      if (already.has(key)) continue; // erupted in an earlier process: the row IS the record
      items.push({ key, due_at: midnightOf(milestone.due_date).getTime(), employee: row, milestone, roster });
    }
  }
  return items;
}

/**
 * Write one escalation. Returns the record to append, or `null` when the row already existed (the
 * race the unique key closes) — a `null` leaves the loop's key unmarked, so the next tick re-reads
 * rather than swallowing it.
 */
async function recordEscalation(item, ctx = {}) {
  const { employee, milestone } = item;
  const at = ctx.at instanceof Date ? ctx.at : new Date();
  const reportingLine = await reportingLineFor(employee.id, item.roster || new Map());
  const late = Boolean(ctx.late);
  const lateByHours = typeof ctx.lateByHours === 'number' ? ctx.lateByHours : null;

  const note = late
    ? `Milestone ${milestone.index} of ${employee.id}\u2019s probation passed its deadline of `
      + `${milestone.due_date} with no submitted evaluation, while the app was not running `
      + `(noticed ${lateByHours}h late).`
    : `Milestone ${milestone.index} of ${employee.id}\u2019s probation passed its deadline of `
      + `${milestone.due_date} with no submitted evaluation, while the app was open (noticed within `
      + `${Math.round((ctx.intervalMs || DEFAULT_INTERVAL_MS) / 60000)} minute(s) of the next tick).`;

  const id = randomUUID();
  await db.query(`INSERT OR IGNORE INTO probation_escalations
    (id, employee_id, employee_name, milestone_index, milestone_day, milestone_due_date, deadline_at,
     detected_at, late, late_by_hours, reporting_line, reporting_line_missing, channel, fired_by, note)
    VALUES (
     ${db.escapeString(id)}, ${db.escapeString(employee.id)}, ${db.escapeString(nameOf(employee))},
     ${milestone.index}, ${milestone.day}, ${db.escapeString(milestone.due_date)},
     ${db.escapeString(`${milestone.due_date}T00:00:00.000Z`)}, ${db.escapeString(at.toISOString())},
     ${late ? 1 : 0}, ${lateByHours === null ? 'NULL' : lateByHours},
     ${db.escapeString(JSON.stringify(reportingLine))},
     ${db.escapeString(JSON.stringify(reportingLine.missing))},
     'none', ${db.escapeString(FIRED_BY)}, ${db.escapeString(note)})`);

  const stored = await db.query(
    `SELECT * FROM probation_escalations
      WHERE employee_id = ${db.escapeString(employee.id)} AND milestone_index = ${milestone.index}`
  );
  // Not ours: an earlier process (or an earlier tick of this one) wrote it first. One row per missed
  // milestone, and this one is already the record — so nothing is written and nothing is claimed.
  if (stored.length === 0 || stored[0].id !== id) return null;

  // The audit row names the actor and points at the escalation by id, exactly as P3-2's submission
  // does: the escalation row IS the record of what fired and to whom, so the log carries the
  // metadata rather than a second copy of it.
  await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, new_values, timestamp)
    VALUES (${db.escapeString(randomUUID())}, ${db.escapeString(FIRED_BY)}, 'probation_escalations',
    ${db.escapeString(id)}, 'CREATE', ${db.escapeString(JSON.stringify({
      employee_id: employee.id,
      milestone_index: milestone.index,
      milestone_due_date: milestone.due_date,
      detected_at: at.toISOString(),
      late,
      addressed_to: {
        manager: reportingLine.manager,
        managers_manager: reportingLine.managers_manager,
        hr: reportingLine.hr.map((recipient) => recipient.username),
      },
      reporting_line_missing: reportingLine.missing,
      channel: 'none',
    }))}, CURRENT_TIMESTAMP)`);

  return {
    record: shape(stored[0]),
    log: `${employee.id} milestone ${milestone.index} (due ${milestone.due_date}) escalated to `
      + `${reportingLine.managers_manager ? reportingLine.managers_manager.name : 'no manager\u2019s manager'}`
      + ` and ${reportingLine.hr.length} HR account(s)${late ? ' [late]' : ''}`,
  };
}

const parseJson = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

/** One stored row, as the read side returns it: JSON fields parsed, `late` a boolean. */
function shape(row) {
  return {
    id: row.id,
    employee_id: row.employee_id,
    employee_name: row.employee_name,
    milestone_index: row.milestone_index,
    milestone_day: row.milestone_day,
    milestone_due_date: row.milestone_due_date,
    deadline_at: row.deadline_at,
    detected_at: row.detected_at,
    late: Boolean(row.late),
    late_by_hours: row.late_by_hours === null || row.late_by_hours === undefined ? null : Number(row.late_by_hours),
    reporting_line: parseJson(row.reporting_line, null),
    reporting_line_missing: parseJson(row.reporting_line_missing, []),
    channel: row.channel,
    fired_by: row.fired_by,
    note: row.note,
  };
}

/**
 * Every escalation HR can look up, newest first. The escalation is read AS IT WAS FIRED (who it was
 * addressed to then), and the evaluation table is joined only to answer a different question: whether
 * the milestone was later completed anyway. That figure is DERIVED on read, so a later submission
 * cannot rewrite the record of what fired — it can only resolve it.
 */
async function listEscalations(options = {}) {
  const employeeId = options.employee_id ? String(options.employee_id) : null;
  const clause = employeeId ? ` WHERE e.employee_id = ${db.escapeString(employeeId)}` : '';
  const rows = await db.query(
    `SELECT e.*, p.submitted_at AS completed_at, p.submitted_by AS completed_by
       FROM probation_escalations e
       LEFT JOIN probation_evaluations p
         ON p.employee_id = e.employee_id AND p.milestone_index = e.milestone_index
       ${clause}
      ORDER BY e.detected_at DESC, e.employee_id, e.milestone_index`
  );
  return rows.map((row) => ({
    ...shape(row),
    completed_at: row.completed_at || null,
    completed_by: row.completed_by || null,
    resolved: Boolean(row.completed_at),
  }));
}

/** The watcher: the shared loop (server/interval-watcher.js), wired to this module's rule. */
function createEscalationWatcher(options = {}) {
  return createIntervalWatcher({
    name: 'probation-escalation',
    intervalMs: options.intervalMs,
    clock: options.clock,
    log: options.log,
    catchUpRule: CATCH_UP_RULE,
    due: (at) => pendingEscalations(at),
    onDue: (item, ctx) => recordEscalation(item, ctx),
  });
}

/**
 * One pass, for a tool or a test that does not want a timer: build a watcher whose clock is this
 * instant and tick it once. `late` is therefore decided against the instant of the scan, which is the
 * honest reading of an ad-hoc pass — the process asking IS the process that noticed.
 */
async function scan(options = {}) {
  const at = options.now instanceof Date ? options.now : readingDay(options.now);
  const watcher = createEscalationWatcher({ clock: () => at, intervalMs: options.intervalMs });
  const result = await watcher.tick(at);
  watcher.stop();
  return { at: result.at, created: result.added };
}

module.exports = {
  FIRED_BY,
  NO_DELIVERY_NOTE,
  CATCH_UP_RULE,
  DAY_MS,
  readingDay,
  hrRecipients,
  reportingLineFor,
  overdueMilestones,
  pendingEscalations,
  recordEscalation,
  listEscalations,
  createEscalationWatcher,
  scan,
};
