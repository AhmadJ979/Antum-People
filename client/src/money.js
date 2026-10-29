/**
 * ONE FIGURE, ONE READING.
 *
 * `money()` used to format with `value.toLocaleString(undefined, ...)`, i.e. with the DEFAULT locale
 * of whatever machine the reader is on. The same figure therefore read two ways, and the product's
 * figures are quoted into statutory artefacts — a settlement statement, a replacement-cost figure, a
 * council letter. Measured on this host: with `LC_ALL=ar_EG.UTF-8` the unpinned call renders
 * `1234567.50` as `\u0661\u066c\u0662\u0663\u0664\u066c\u0665\u0666\u0667\u066b\u0665\u0660`
 * (Arabic-Indic digits, Arabic separators); pinned to `en-AE` it renders `1,234,567.50` everywhere.
 * `src/money.test.js` holds both halves of that measurement.
 *
 * WHY `en-AE`, and not the reader's language: the served documents carry Latin digits in their Arabic
 * cells (see `templates/uae-employment-contract.md` and `templates/final-settlement-statement.md`),
 * so a Latin-digit figure is the one that agrees with the document it sits beside. Making the figure
 * follow an Arabic UI is a decision nobody has taken yet; when it is taken it changes THIS constant
 * and `src/money.test.js`, and nothing else.
 */

/** The single locale every rendered amount is formatted in. */
export const AMOUNT_LOCALE = 'en-AE';

const AMOUNT_OPTIONS = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/** A bare figure — two decimals, grouped, Latin digits, in every environment. */
export function formatAmount(value) {
  return Number(value).toLocaleString(AMOUNT_LOCALE, AMOUNT_OPTIONS);
}

/** A figure with its currency in front; an unknown currency is a dash, never a guess. */
export function money(currency, value) {
  return `${currency || '\u2014'} ${formatAmount(value)}`;
}
