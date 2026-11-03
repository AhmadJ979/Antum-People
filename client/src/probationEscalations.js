/**
 * client/src/probationEscalations.js — P3-3's escalation record as a READING, never as a bare list.
 *
 * WHY A READING AND NOT A LIST. `GET /api/probation/escalations` refuses anything but company-wide
 * scope, and it refuses in the policy gate's own shape — `403` with an EMPTY body
 * (`server/index.js`, the `req.accessScope !== access.SCOPE.ALL` branch). `client/src/httpStatus.js`
 * classifies that as a refusal in place rather than a session end, and `client/src/panelResults.js`
 * turns it into a `refused` panel. A panel that then drew `[]` would be saying "no escalation has
 * ever fired" to a manager who is simply not allowed to see the record. Those are different facts
 * and this module is where they are kept apart:
 *
 *   refused -> `rows` is **null**. There is nothing to render as an empty list, by construction.
 *   granted -> `rows` is the array the server sent, possibly empty. An empty array here means the
 *              server looked and found nothing, and `sentence` says so in words.
 *   failed  -> `rows` is **null**. A payload we could not read is not an empty list either.
 *
 * The `rows: null` half is the load-bearing part: `rows.length` on a refusal throws instead of
 * quietly rendering nothing, so the two states cannot be made to look alike by accident.
 *
 * NOTHING HERE RECOMPUTES A DATE. The milestone, its due date, the detection instant and the
 * reporting line are all stored on the row (`server/probation-escalation.js`: "the row holds the
 * reporting line AS IT WAS AT FIRING TIME"). This module formats what arrived.
 *
 * DATES ONLY, NO CLOCK. `src/format.js`'s `formatTime` exists but has no call site, and its test
 * says so out loud (`format.test.js`: "formatTime() has no call site today"). A panel that started
 * calling it would be introducing a second time shape on the strength of this one panel, so this
 * surface prints the DAY it was recorded and leaves the sub-day precision to `late_by_hours`, which
 * the row already carries where it matters.
 *
 * NOTHING HERE IMPLIES A MESSAGE WAS SENT. The product has no mailer, no webhook and no SMS: every
 * row carries `channel: 'none'` and the route sends `NO_DELIVERY_NOTE` in the same payload. That note
 * is surfaced exactly as it arrived, and the watcher line states `delivery` as the loop reports it.
 *
 * Plain ES module JavaScript: no DOM, no React, no locale API of its own (dates come from
 * `src/format.js`, the ONE convention), so `node --test` can assert all of it without a browser.
 */

'use strict';

import { formatDate } from './format.js';

/** The three readings this module produces. `loading` exists only before the first answer. */
export const REFUSED = 'refused';
export const FAILED = 'failed';
export const GRANTED = 'granted';
export const LOADING = 'loading';

/** A refusal. Says what is not shown and that the session is fine — never "none found". */
export const REFUSED_SENTENCE =
  'Not shown for your account. An escalation record names the chain above a hire, so only a '
  + 'company-wide reader may see it. Nothing was changed, and you are still signed in.';

/** A failed read. Explicitly NOT a statement that nothing fired. */
export const FAILED_SENTENCE =
  'The escalation records could not be read, so this panel is not telling you that none exist.';

/** A granted read that found nothing. This is the ONLY empty-list sentence there is. */
export const EMPTY_SENTENCE =
  'No escalation has been recorded. Whether the watch described underneath has had a chance to '
  + 'look is a separate question, and it is answered there.';

/** Before the first answer. Not an empty list either. */
export const LOADING_SENTENCE = 'Reading the escalation records\u2026';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** A reporting line as one clause, naming every link it could NOT resolve rather than omitting it. */
function recipientClause(reportingLine, missing) {
  const personName = (person) => (person && typeof person.name === 'string' && person.name.trim()
    ? person.name.trim()
    : null);
  const links = [];
  const manager = reportingLine ? personName(reportingLine.manager) : null;
  const managersManager = reportingLine ? personName(reportingLine.managers_manager) : null;
  if (manager) links.push(`${manager} (manager)`);
  if (managersManager) links.push(`${managersManager} (manager\u2019s manager)`);
  const hr = reportingLine && Array.isArray(reportingLine.hr) ? reportingLine.hr : [];
  const hrNames = hr
    .map((person) => personName(person)
      || (person && typeof person.username === 'string' && person.username.trim() ? person.username.trim() : null))
    .filter(Boolean);
  if (hrNames.length) links.push(`HR (${hrNames.join(', ')})`);
  // A link that could not be resolved is NAMED, never quietly left out: a line listing only the
  // links it found reads as a chain that exists. Same rule as the server's own `reporting_line_missing`.
  const unresolved = (Array.isArray(missing) ? missing : []).filter((key) => typeof key === 'string');
  const named = unresolved.length
    ? ` Not resolved: ${unresolved.map((key) => key.replace(/_/g, ' ')).join(', ')}.`
    : '';
  if (!links.length) return `Addressed to nobody this record could resolve.${named}`;
  return `Addressed to ${links.join(', ')}.${named}`;
}

/**
 * One escalation row as the line a person reads, under the hire's name. Every field it names is one
 * the row carries; the milestone's `day` is printed as the server stored it.
 */
export function escalationRowLine(row) {
  if (!isObject(row)) return 'An escalation record this screen could not read.';
  const parts = [];
  parts.push(`Milestone ${row.milestone_index} (day ${row.milestone_day}), due ${formatDate(row.milestone_due_date)}.`);
  // "Recorded" is the instant the process wrote the row. It is NOT a claim about when a person was
  // told — nothing was sent — and the note in the panel footer says so in the server's own words.
  const recorded = formatDate(row.detected_at);
  parts.push(recorded ? `Recorded ${recorded}.` : 'The day this was recorded was not sent.');
  if (row.late) {
    const hours = Number(row.late_by_hours);
    parts.push(Number.isFinite(hours)
      ? `The deadline fell before this watcher started; first seen ${hours}h after it.`
      : 'The deadline fell before this watcher started.');
  }
  parts.push(recipientClause(row.reporting_line, row.reporting_line_missing));
  // `resolved` is a submitted evaluation for the same milestone, joined on read — never a rewrite of
  // the row. `correction_count` rides that join so "closed" is not read as "the assessment standing
  // behind it is still the one that was submitted".
  if (row.resolved) {
    const corrections = Number(row.correction_count);
    parts.push(Number.isFinite(corrections) && corrections > 0
      ? `Closed by an evaluation that has since been corrected ${corrections} time${corrections === 1 ? '' : 's'}.`
      : 'Closed by a submitted evaluation.');
  } else {
    parts.push('Still open: no evaluation has been submitted for this milestone.');
  }
  return parts.join(' ');
}

/**
 * The watch's own state, in one line. This is what tells "nothing has been missed" apart from "the
 * watch has never looked": an empty list under a watcher that has not ticked is not the same reading
 * as an empty list under one that has, and the route sends this state precisely so a reader can tell.
 */
export function escalationWatcherLine(watcher) {
  if (!isObject(watcher)) {
    return 'The watch\u2019s own state was not sent with this list, so nothing here says whether it has run.';
  }
  const parts = [];
  const scanned = formatDate(watcher.last_scan_at);
  parts.push(scanned
    ? `Last scan ${scanned}`
    : 'This process has not scanned yet, so an empty list here means nothing has been recorded YET');
  const interval = Number(watcher.interval_ms);
  if (Number.isFinite(interval) && interval > 0) {
    parts.push(`every ${Math.round(interval / 1000)}s while the product is running`);
  }
  const recorded = Number(watcher.escalations_recorded_in_this_process);
  parts.push(`${Number.isFinite(recorded) ? recorded : 0} recorded in this process`);
  // `delivery` is `'none'` on every watcher (`server/interval-watcher.js`): the loop delivers
  // nothing. Read from the payload rather than assumed, so a future delivery channel shows up here
  // instead of being contradicted by a sentence nobody re-read.
  parts.push(watcher.delivery === 'none' || watcher.delivery === undefined
    ? 'delivery: none'
    : `delivery: ${String(watcher.delivery)}`);
  if (watcher.last_error) parts.push(`last error: ${String(watcher.last_error)}`);
  return parts.join(' \u00b7 ');
}

/** The reading before any answer has arrived. `rows` is null here too, so nothing renders a list. */
export function loadingReading() {
  return { kind: LOADING, rows: null, sentence: LOADING_SENTENCE, note: null, watcher: null, watcherLine: null };
}

/**
 * Turn ONE settled panel record (`client/src/panelResults.js`: `{ name, url, status, value, error }`)
 * into the reading the panel renders. `status` is `granted`, `refused` or `failed`.
 *
 * A REFUSAL WINS over any value that rode along with it: `record.value` is deliberately not read on
 * that branch, so a payload arriving beside a 403 can never turn a refusal into an empty list. That
 * is the control this module exists for.
 */
export function escalationReading(record) {
  const status = isObject(record) ? record.status : null;

  if (status === REFUSED) {
    return { kind: REFUSED, rows: null, sentence: REFUSED_SENTENCE, note: null, watcher: null, watcherLine: null };
  }

  const payload = status === GRANTED && isObject(record.value) ? record.value : null;
  // An answer we cannot read is a FAILED read, never an empty list: `escalations` absent, or not an
  // array, is a shape this surface does not understand, and an unfamiliar payload must look
  // unfamiliar rather than plausible.
  if (payload === null || !Array.isArray(payload.escalations)) {
    return { kind: FAILED, rows: null, sentence: FAILED_SENTENCE, note: null, watcher: null, watcherLine: null };
  }

  const rows = payload.escalations;
  return {
    kind: GRANTED,
    rows,
    sentence: rows.length === 0 ? EMPTY_SENTENCE : null,
    note: typeof payload.note === 'string' && payload.note.trim() ? payload.note : null,
    watcher: isObject(payload.watcher) ? payload.watcher : null,
    watcherLine: escalationWatcherLine(payload.watcher),
  };
}
