'use strict';
/**
 * THE EOSB FORECAST WINDOW — the next N calendar quarter-ends strictly after a given instant.
 *
 * WHY THIS MODULE EXISTS
 * `server/index.js` built the forecast window as a four-entry literal ending at `Q2 2027`. On
 * 2026-11-02 its first entry (`Q3 2026`, `2026-09-30`) was 33 days in the past and was still served
 * under a heading that says "Forecast": a buyer read four forward points and one of them was history.
 * Nothing in the code could notice the passage of time — the literal cannot redden, and it drifts by
 * one point per quarter with nobody to say so. The window is now derived from a clock, and the clock
 * is an ARGUMENT so the rule can be tested against a fixed instant instead of only against today.
 *
 * WHAT IT DOES NOT DO
 * It changes DATES ONLY. The projection reasoning around it is untouched: each row is projected on
 * its own stored termination reason, a row with none is projected UNREDUCED, and a stored reason the
 * engine does not recognise leaves the row out and is counted (owner ruling 2026-10-29).
 *
 * THE CONVENTIONS, STATED SO A LATER READER CANNOT RE-DERIVE THEM DIFFERENTLY
 *  - **UTC throughout.** The quarter-end is a calendar date; reading it through the host's local zone
 *    would move the boundary by a day for some hosts and make the window depend on `TZ`.
 *  - **Strictly after.** A quarter-end is included only if its own UTC date is later than the UTC
 *    date of `now`. On the quarter-end day itself the quarter has not finished, but its end is not a
 *    future point either, so it is NOT included: the series is a forward projection, and a point that
 *    is today is not forward. This is what makes `2026-09-30` → `Q4 2026` and `2026-09-29` →
 *    `Q3 2026` a clean boundary rather than an argument.
 *  - **The label format is unchanged** (`Q3 2026`) because the client renders `{s.quarter}` verbatim
 *    and `eosbTrendClaim.test.js` guards the words around it.
 *  - **Four points.** The series length is the shape of the chart on the analytics screen; changing it
 *    would be a separate, unexplained change to a chart. Callers may pass a different `count`, and
 *    nothing in the product does.
 */

// The number of quarter-ends the chart plots. Kept here rather than at the call site so the length is
// one fact, named once.
const QUARTERS_AHEAD = 4;

// A calendar quarter ends on the last day of months 3, 6, 9 and 12 (1-based) — i.e. index 2, 5, 8, 11
// (0-based) — and those days are 31, 30, 30, 31. Written out rather than computed from the following
// month, because `new Date(Date.UTC(y, m + 1, 0))` is a second date algorithm with its own edge cases
// and this list has none.
const QUARTER_END_MONTH_INDEX = [2, 5, 8, 11];
const QUARTER_END_DAY = [31, 30, 30, 31];

/** Midnight UTC of the calendar day `d` falls on — the granularity every comparison here uses. */
function utcDayStart(d) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** `YYYY-MM-DD`, the shape the EOSB engine already parses (it reads a bare date as UTC midnight). */
function isoDate(year, monthIndex, day) {
  return `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The next `count` calendar quarter-ends strictly after `now`, as `{ quarter, date }` objects:
 * `{ quarter: 'Q4 2026', date: '2026-12-31' }`.
 *
 * @param {Date}   [now=new Date()] the instant the window is measured from (injectable so it is testable)
 * @param {number} [count=QUARTERS_AHEAD]
 * @returns {{ quarter: string, date: string }[]}
 */
function forecastQuarterEnds(now = new Date(), count = QUARTERS_AHEAD) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('forecastQuarterEnds(now): now must be a valid Date');
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new TypeError('forecastQuarterEnds(now, count): count must be a positive integer');
  }

  const todayUtc = utcDayStart(now);
  // An absolute quarter index: year * 4 + (0..3), so Q1 2026 is 2026 * 4 + 0. Incrementing it walks
  // the calendar one quarter at a time across year boundaries without a special case.
  let quarterIndex = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);

  const window = [];
  // Terminates: each step advances the quarter by one, and a quarter-end is always later than the
  // previous one, so the first quarter-end that is strictly after today is at most one step away and
  // `count` points are collected in at most `count + 1` steps.
  while (window.length < count) {
    const year = Math.floor(quarterIndex / 4);
    const quarterOfYear = quarterIndex % 4; // 0 = Q1 … 3 = Q4
    const monthIndex = QUARTER_END_MONTH_INDEX[quarterOfYear];
    const day = QUARTER_END_DAY[quarterOfYear];
    if (Date.UTC(year, monthIndex, day) > todayUtc) {
      window.push({
        quarter: `Q${quarterOfYear + 1} ${year}`,
        date: isoDate(year, monthIndex, day)
      });
    }
    quarterIndex += 1;
  }
  return window;
}

module.exports = { forecastQuarterEnds, QUARTERS_AHEAD };
