/**
 * ONE FIGURE, ONE READING — kept as a path, no longer as an implementation.
 *
 * This module used to own the amount convention on its own (pinned to `en-AE`, grouping to
 * `1,234,567.50`). The owner's ruling on numerals is now one convention for figures AND dates, and
 * one place that holds it: `src/format.js`. Two modules each holding a convention is two modules
 * that can drift, so `money`/`formatAmount` are re-exported from there and nothing is implemented
 * here. `src/money.test.js` still drives THIS path, which is what keeps the re-export honest.
 *
 * The convention itself, and where each part of it was measured from, is documented in
 * `src/format.js`. Measured at `4c8779b`: the server writes amounts as `Number(v).toFixed(2)`
 * (`server/index.js:627`) — two decimals and NO group separator — so the screen does too, and a
 * figure on screen is now the same string as the figure in the served document beside it.
 */
export { AMOUNT_DECIMALS, formatAmount, money } from './format.js';
