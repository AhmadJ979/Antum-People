/**
 * ONE FIGURE, ONE READING — asserted through the path the SCREEN uses.
 *
 * `money()` used to call `value.toLocaleString(undefined, ...)`. The locale was whatever the
 * reader's environment said, so the same figure could read two ways, and the product's figures are
 * quoted into statutory artefacts. Since the owner's numeral ruling the convention lives in
 * `src/format.js` and this module re-exports it; this file drives THIS path, which is what keeps
 * the re-export honest. The full sweep (dates, times, and the tree-wide guard) is
 * `src/format.test.js`.
 *
 * The owner's ruling of 2026-10-29 reverses one detail of #334: amounts carry thousands separators
 * on screen again (`1,234,567.50`), because readability of a workforce-cost figure beats matching
 * the server's own string character for character. The digits are still the server's
 * (`Number(v).toFixed(2)`, `server/index.js:627`), two decimals are still two decimals, and the
 * grouping is hand-rolled over that string — never `toLocaleString`, never `Intl`, so it cannot
 * vary with a browser's ICU build. `src/format.test.js` asserts the digits agree with the server's
 * expression once the separators are stripped.
 *
 * Run: `cd client && npm test`   (node --test, no browser, no DOM)
 */
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { AMOUNT_DECIMALS, formatAmount, money } from './money.js';
import * as format from './format.js';
const SRC = import.meta.dirname;
const GROUP_SEPARATOR = format.GROUP_SEPARATOR;
test('the amount convention: two decimals, Latin digits, grouped in threes', () => {
  assert.equal(AMOUNT_DECIMALS, 2);
  assert.equal(GROUP_SEPARATOR, ',');
  // The digits `server/index.js:627` writes as `Number(v).toFixed(2)`; the separators are the
  // screen's. Strip them and the string in the served document beside the screen's figure is the
  // same string — asserted against the server's own expression in `src/format.test.js`.
  assert.equal(formatAmount(1234567.5), '1,234,567.50');
  assert.equal(formatAmount(0), '0.00');
  assert.equal(formatAmount(12), '12.00');
  assert.equal(formatAmount(999), '999.00');
  assert.equal(formatAmount(1000), '1,000.00');
  assert.equal(formatAmount(-1234.5), '-1,234.50');
  assert.equal(/[\u0660-\u0669\u06f0-\u06f9]/.test(formatAmount(1234567.5)), false);
});
test('money() puts the currency in front and never invents one', () => {
  assert.equal(money('AED', 1234.5), 'AED 1,234.50');
  assert.equal(money('SAR', 0), 'SAR 0.00');
  assert.equal(money(null, 12), '\u2014 12.00');
  assert.equal(money('', 12), '\u2014 12.00');
});
test('this path and the module are ONE implementation, not two that can drift', () => {
  assert.equal(money, format.money, 'money.js re-exports the one function; it must not wrap a second');
  assert.equal(formatAmount, format.formatAmount, 'formatAmount is the same binding through both paths');
});
test('no amount is formatted with the DEFAULT locale', () => {
  // Code only: the module's docstring quotes the offending call while explaining why it went.
  const source = fs.readFileSync(path.join(SRC, 'money.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.ok(!source.includes('toLocaleString(undefined'), 'money.js formats with the machine locale');
  assert.ok(!/toLocaleString\(\s*\)/.test(source), 'money.js formats with the machine locale');
  // And the whole shipped client: exactly ONE locale call may exist, the explicit `en-GB` date one
  // in `src/format.js`. A grouping done with `Intl`/`toLocaleString` would make it two — and its
  // output would then depend on the host's ICU build rather than on arithmetic.
  assert.equal(/\bIntl\b\s*\./.test(source), false, 'money.js reaches for Intl');
});
/**
 * The control, run through the path the screen imports. A test that only asserted
 * `formatAmount(...) === '1,234,567.50'` would pass on a host whose locale is already en-US, i.e. it
 * could not show the fix is load-bearing. So the real module is imported in a CHILD PROCESS with
 * `LC_ALL=ar_EG.UTF-8`, and both calls are compared there.
 */
test('in an ar_EG environment the figure still reads 1,234,567.50 (control)', () => {
  const probe = [
    "import { formatAmount } from " + JSON.stringify(path.join(SRC, 'money.js')) + ";",
    "const w = { minimumFractionDigits: 2, maximumFractionDigits: 2 };",
    "console.log(JSON.stringify({",
    "  pinned: formatAmount(1234567.5),",
    "  unpinned: (1234567.5).toLocaleString(undefined, w),",
    "  locale: Intl.DateTimeFormat().resolvedOptions().locale,",
    "  arabicDigits: /[\\u0660-\\u0669]/.test(new Intl.NumberFormat('ar-EG').format(1234)),",
    "}));",
  ].join('\n');
  const raw = execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { LC_ALL: 'ar_EG.UTF-8', LANG: 'ar_EG.UTF-8' }),
  });
  const reading = JSON.parse(raw.trim());
  // The figure the product prints does not move with the reader's machine — neither its digits nor
  // its separators: the grouping is string arithmetic on a `toFixed(2)` string, not a locale read.
  assert.equal(reading.pinned, '1,234,567.50', `pinned figure moved in locale ${reading.locale}`);
  assert.equal(reading.pinned.split(GROUP_SEPARATOR).join(''), '1234567.50', 'the pinned digits moved');
  // And where the host can represent Arabic digits at all, the UNPINNED call must differ here —
  // otherwise this control is not exercising the defect it exists for.
  if (reading.arabicDigits) {
    assert.notEqual(
      reading.unpinned,
      reading.pinned,
      'with Arabic ICU data present the unpinned call should read differently — this control proves nothing otherwise',
    );
  }
  console.log(`control (${reading.locale}): pinned=${reading.pinned} unpinned=${reading.unpinned}`
    + ` arabicDigits=${reading.arabicDigits}`);
});
