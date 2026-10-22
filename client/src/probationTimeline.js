/**
 * client/src/probationTimeline.js — PROBATION TIMELINE labels and formatting (P3-1).
 *
 * The dates are NOT computed here. `GET /api/probation/timelines` returns each milestone's `day`,
 * `due_date` and `state`, derived on the server from the hire's own `start_date` and probation
 * window; App.tsx already states the rule for the pre-boarding track and it holds here too —
 * "Nothing here recomputes the state from the start date."
 *
 * What this module owns is the surface's vocabulary: the four state labels, the chip styling, the
 * date format and the one-line summary. Plain ES module JavaScript with no DOM and no React, so
 * `client/src/probationTimeline.test.js` can assert all of it without a browser.
 *
 * `state` is one of the four the row names. A state that is not one of them is rendered as
 * `Unknown` and styled as a neutral chip rather than silently as the first label — a payload the
 * surface does not understand should look unfamiliar, not plausible.
 */

'use strict';

/** The four states, as the row names them. */
export const MILESTONE_LABELS = Object.freeze({
  upcoming: 'Upcoming',
  due: 'Due today',
  overdue: 'Overdue',
  completed: 'Completed',
});

/** The chip classes, in the vocabulary the roster's status chips already use. */
const CHIP_CLASSES = Object.freeze({
  upcoming: 'bg-slate-100 text-slate-700 border-slate-200',
  due: 'bg-blue-100 text-blue-800 border-blue-200',
  overdue: 'bg-rose-100 text-rose-700 border-rose-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
});

const UNKNOWN_CHIP = 'bg-slate-100 text-slate-600 border-slate-200';

/** The months, spelled out rather than taken from a locale: a demo must not read differently
 *  depending on the machine's locale, and a test must be able to pin the string. */
const MONTHS = Object.freeze(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);

export function milestoneLabel(state) {
  return MILESTONE_LABELS[state] || 'Unknown';
}

export function milestoneChipClass(state) {
  return CHIP_CLASSES[state] || UNKNOWN_CHIP;
}

/** `2026-09-19` → `19 Sep 2026`. Anything unparseable is returned as it came, never as a guess. */
export function formatDay(value) {
  const day = String(value === null || value === undefined ? '' : value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return String(value === null || value === undefined ? '' : value);
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return day;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

/** The milestone a reader is waiting on: the EARLIEST one not yet completed. A timeline is
 *  chronological and its milestones are cleared in order, so an overdue day-30 outranks a day-60
 *  that falls due today. `null` for a timeline with no milestones. */
export function nextMilestone(timeline) {
  const milestones = (timeline && timeline.milestones) || [];
  if (!milestones.length) return null;
  return milestones.find((m) => m.state !== 'completed') || milestones[milestones.length - 1];
}

/** One line per hire: how many milestones, where they fall, and what is next. Derived from the
 *  payload only — an empty timeline summarises as empty rather than as a zero. */
export function probationSummary(timeline) {
  const milestones = (timeline && timeline.milestones) || [];
  if (!milestones.length) return 'No milestones';
  const days = milestones.map((m) => `day ${m.day}`).join(' / ');
  const next = nextMilestone(timeline);
  return `${milestones.length} milestones · ${days} · next: ${milestoneLabel(next.state)} ${formatDay(next.due_date)}`;
}

/** The window itself, for the panel's second line. */
export function windowLine(timeline) {
  if (!timeline || !timeline.start_date || !timeline.end_date) return '';
  return `${formatDay(timeline.start_date)} → ${formatDay(timeline.end_date)} (${timeline.length_days} days)`;
}
