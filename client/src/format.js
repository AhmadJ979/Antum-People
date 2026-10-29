/**
 * ONE CONVENTION FOR EVERY FIGURE AND EVERY DATE THE SCREEN SHOWS.
 *
 * The owner's ruling (numeral convention): **Latin digits (0-9) throughout**. It is made, and this
 * module is where it is written down. Nothing in the client may take a digit, a decimal separator,
 * a group separator, a month name or a clock convention from the machine the reader happens to sit
 * at — `src/format.test.js` walks `client/src` and reddens if any file outside this one reaches for
 * a locale-sensitive API.
 *
 * WHY THE SERVER IS THE REFERENCE, not a taste of ours: the figures on screen are quoted into
 * statutory artefacts — a settlement statement, a replacement-cost figure, a council letter — and
 * those documents are rendered by `server/`. A screen that formats a figure its own way reads as a
 * different figure beside the document that carries it. So each convention below is copied from the
 * server's own output, and the test asserts the client's string EQUALS the server's expression:
 *
 *   money  server/index.js:627  `Number(v).toFixed(2)`   -> `1234567.50`  (two decimals, NO group
 *                                                         separator: the server emits none)
 *   date   server/index.js:665  `new Date().toLocaleDateString('en-GB',
 *                                 { day: 'numeric', month: 'long', year: 'numeric' })`
 *                                                        -> `29 October 2026`
 *   time   no server counterpart (the server renders no clock time). Fixed here as en-GB 24-hour
 *                                                        `14:05`, so there is one shape if a screen
 *                                                        ever needs one; no call site uses it today
 *                                                        and `format.test.js` says so out loud.
 *
 * `toFixed` is locale-independent by specification: it cannot render Arabic-Indic digits, a comma
 * decimal separator or a non-breaking group space, on any host, in any locale. The date and time
 * helpers DO call a locale-sensitive API — deliberately: the locale is an explicit constant, never
 * the ambient one, which is the whole difference between this module and the defect it replaces.
 *
 * Plain ES module JavaScript: no DOM, no React, no build step — `node --test` imports it directly.
 */

/** Decimals on every amount, as the server writes them (`toFixed(2)`). */
export const AMOUNT_DECIMALS = 2;

/** The one locale every date and time is rendered in. Explicit, never `undefined`. */
export const DATE_LOCALE = 'en-GB';

/** The one date shape, option for option as `server/index.js:665` passes them. */
export const DATE_OPTIONS = Object.freeze({ day: 'numeric', month: 'long', year: 'numeric' });

/** The one clock shape: 24-hour, zero-padded, no seconds. */
export const TIME_OPTIONS = Object.freeze({ hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * A bare figure — two decimals, Latin digits, no group separator, in EVERY environment.
 * The server's expression exactly: `Number(value).toFixed(2)`.
 */
export function formatAmount(value) {
  return Number(value).toFixed(AMOUNT_DECIMALS);
}

/** A figure with its currency in front; an unknown currency is a dash, never a guess. */
export function money(currency, value) {
  return `${currency || '\u2014'} ${formatAmount(value)}`;
}

/**
 * Anything date-ish to a `Date`, or `null` when it is nothing we can place in time.
 * A bare `YYYY-MM-DD` is a CALENDAR DAY, so it is built in local time: `new Date('2026-09-19')`
 * would parse as UTC midnight and read as the 18th west of Greenwich, which is a wrong date, not a
 * differently formatted one.
 */
function parseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined || value === '') return null;
  const text = String(value);
  const calendarDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (calendarDay) {
    return new Date(Number(calendarDay[1]), Number(calendarDay[2]) - 1, Number(calendarDay[3]));
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * `2026-09-19` -> `19 September 2026`. The shape the served documents carry.
 * A value we cannot read is returned AS IT CAME, never as a guess; nothing (`null`, `undefined`,
 * `''`) renders as nothing.
 */
export function formatDate(value) {
  if (value === null || value === undefined || value === '') return '';
  const date = parseDate(value);
  if (date === null) return String(value);
  return date.toLocaleDateString(DATE_LOCALE, DATE_OPTIONS);
}

/** `2026-09-19T14:05:00Z` -> `14:05`, in the one clock shape. Unreadable input as it came. */
export function formatTime(value) {
  if (value === null || value === undefined || value === '') return '';
  const date = parseDate(value);
  if (date === null) return String(value);
  return date.toLocaleTimeString(DATE_LOCALE, TIME_OPTIONS);
}
