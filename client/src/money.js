/**
 * ONE FIGURE, ONE READING — kept as a path, no longer as an implementation.
 *
 * This module used to own the amount convention on its own (pinned to `en-AE`, grouping to
 * `1,234,567.50`, via `toLocaleString`). The owner's ruling on numerals is now one convention for
 * figures AND dates, and one place that holds it: `src/format.js`. Two modules each holding a
 * convention is two modules that can drift, so `money`/`formatAmount` are re-exported from there and
 * nothing is implemented here. `src/money.test.js` still drives THIS path, which is what keeps the
 * re-export honest.
 *
 * The convention itself, and where each part of it was measured from, is documented in
 * `src/format.js`. Measured at `4c8779b`: the server writes amounts as `Number(v).toFixed(2)`
 * (`server/index.js:627`) — two decimals, Latin digits, no separators of its own. The screen now
 * groups those digits for readability (`1,234,567.50`, owner's ruling of 2026-10-29), so the screen
 * and the served document differ by the separators alone; the digits are still the server's, and
 * `src/format.test.js` asserts that by stripping the separators and comparing byte for byte.
 * The grouping is hand-rolled over the `toFixed` string, never `toLocaleString` — see `src/format.js`.
 */
export { AMOUNT_DECIMALS, formatAmount, money } from './format.js';
