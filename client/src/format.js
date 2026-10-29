/**
 * ONE CONVENTION FOR EVERY FIGURE AND EVERY DATE THE SCREEN SHOWS.
 *
 * The owner's rulings, written down here and nowhere else:
 *   - **Latin digits (0-9) throughout.** Nothing in the client may take a digit, a decimal
 *     separator, a group separator, a month name or a clock convention from the machine the reader
 *     happens to sit at — `src/format.test.js` walks `client/src` and reddens if any file outside
 *     this one reaches for a locale-sensitive API.
 *   - **Amounts carry thousands separators on screen** (owner, 2026-10-29, reversing that one
 *     detail of #334): `1,234,567.50`. Readability of a workforce-cost figure beats matching the
 *     server's own string character for character. The consequence is accepted, not hidden: the
 *     screen and the served document beside it now differ by the separators alone, and
 *     `src/format.test.js` asserts exactly that — strip the separators from the screen's figure and
 *     it must be BYTE-IDENTICAL to the server's expression, with exactly two decimals. So a
 *     rounding or precision regression still reddens; only the grouping is ours.
 *
 * WHERE EACH CONVENTION COMES FROM, and why the server is still the reference for the digits: the
 * figures on screen are quoted into statutory artefacts — a settlement statement, a replacement-cost
 * figure, a council letter — and those documents are rendered by `server/`. A screen whose DIGITS
 * disagreed with the document would read as a different figure. So:
 *
 *   money  server/index.js:627  `Number(v).toFixed(2)`   -> `1234567.50`  (the digits, and the two
 *                                                         decimals, exactly as the server writes
 *                                                         them)
 *          this module                                  -> `1,234,567.50` (the same digits, grouped
 *                                                         for the screen — the ONE difference)
 *   date   server/index.js:665  `new Date().toLocaleDateString('en-GB',
 *                                 { day: 'numeric', month: 'long', year: 'numeric' })`
 *                                                        -> `29 October 2026`
 *   time   no server counterpart (the server renders no clock time). Fixed here as en-GB 24-hour
 *                                                        `14:05`, so there is one shape if a screen
 *                                                        ever needs one; no call site uses it today
 *                                                        and `format.test.js` says so out loud.
 *
 * HOW THE GROUPING IS DONE, and why not `Intl`: hand-rolled over the `toFixed(2)` string. Not
 * `toLocaleString`, not `Intl.NumberFormat('en-GB', …)`, for two measured reasons:
 *   - the shipped bundle carries **exactly one** locale call (`formatDate`'s explicit `en-GB`
 *     one); a formatting API here would make it two, and the guard in `format.test.js` forbids it;
 *   - `Intl` output depends on the host's ICU build and version, and on nothing we control. A
 *     `toFixed(2)` string split on `.` and grouped in threes cannot vary with a machine, a locale,
 *     an ICU version or a browser release: it is arithmetic on a string of Latin digits.
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
/** The one group separator: an ASCII comma, never a locale's narrow no-break space. */
export const GROUP_SEPARATOR = ',';
/** The one locale every date and time is rendered in. Explicit, never `undefined`. */
export const DATE_LOCALE = 'en-GB';
/** The one date shape, option for option as `server/index.js:665` passes them. */
export const DATE_OPTIONS = Object.freeze({ day: 'numeric', month: 'long', year: 'numeric' });
/** The one clock shape: 24-hour, zero-padded, no seconds. */
export const TIME_OPTIONS = Object.freeze({ hour: '2-digit', minute: '2-digit', hour12: false });
/**
 * `toFixed`'s own output for a number it can write positionally: an optional minus, a run of Latin
 * digits, and exactly two decimals. Anything else (`NaN`, `Infinity`, and `1e21` and above, which
 * `toFixed` writes as an exponent) is returned untouched — see `formatAmount`.
 */
const POSITIONAL_AMOUNT = /^(-?)(\d+)(\.\d{2})$/;
/** `1234567` -> `1,234,567`. Pure string arithmetic: no locale, no ICU, nothing to vary. */
function groupIntegerDigits(digits) {
  let grouped = '';
  for (let i = 0; i < digits.length; i += 1) {
    const remaining = digits.length - i;
    if (i > 0 && remaining % 3 === 0) grouped += GROUP_SEPARATOR;
    grouped += digits[i];
  }
  return grouped;
}
/**
 * A money figure — two decimals, Latin digits, thousands grouped, in EVERY environment.
 * `1234567.5` -> `1,234,567.50`. The digits are the server's `Number(value).toFixed(2)` untouched;
 * the separators are the screen's, and `format.test.js` asserts they are the ONLY difference.
 *
 * A value `toFixed` cannot write positionally (`NaN` from `undefined`, `Infinity`, `1e21`+) comes
 * back exactly as `toFixed` wrote it — never mangled into a half-grouped string. That is the same
 * string this module returned before grouping, so nothing about those inputs moved.
 */
export function formatAmount(value) {
  const fixed = Number(value).toFixed(AMOUNT_DECIMALS);
  const parts = POSITIONAL_AMOUNT.exec(fixed);
  if (parts === null) return fixed;
  return `${parts[1]}${groupIntegerDigits(parts[2])}${parts[3]}`;
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
