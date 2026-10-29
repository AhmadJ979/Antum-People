/**
 * ONE FIGURE, ONE READING — the amount a reader sees must not depend on the reader's machine.
 *
 * `money()` used to call `value.toLocaleString(undefined, ...)`. The locale was whatever the reader's
 * environment said, so the same figure could read two ways, and the product's figures are quoted into
 * statutory artefacts. `src/money.test.js` holds the property (`en-AE`, Latin digits, two decimals)
 * and the CONTROL: it runs the real formatter in a child process whose locale is `ar_EG`, where the
 * unpinned call does not render `1,234,567.50` at all.
 *
 * Run: `cd client && npm test`   (node --test, no browser, no DOM)
 */
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { AMOUNT_LOCALE, formatAmount, money } from './money.js';

const SRC = import.meta.dirname;

test('the locale is pinned, and a figure reads the same in every environment', () => {
  assert.equal(AMOUNT_LOCALE, 'en-AE');
  assert.equal(formatAmount(1234567.5), '1,234,567.50');
  assert.equal(formatAmount(0), '0.00');
  assert.equal(formatAmount(12), '12.00');
});

test('money() puts the currency in front and never invents one', () => {
  assert.equal(money('AED', 1234.5), 'AED 1,234.50');
  assert.equal(money('SAR', 0), 'SAR 0.00');
  assert.equal(money(null, 12), '\u2014 12.00');
  assert.equal(money('', 12), '\u2014 12.00');
});

test('no amount is formatted with the DEFAULT locale', () => {
  // Code only: the module's docstring quotes the offending call while explaining why it went.
  const source = fs.readFileSync(path.join(SRC, 'money.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.ok(!source.includes('toLocaleString(undefined'), 'money.js formats with the machine locale');
  assert.ok(!/toLocaleString\(\s*\)/.test(source), 'money.js formats with the machine locale');
});

/**
 * The control. A test that only asserted `formatAmount(...) === '1,234,567.50'` would pass on a host
 * whose default locale is already en-US, i.e. it could not show the fix is load-bearing. So the real
 * module is imported in a CHILD PROCESS with `LC_ALL=ar_EG.UTF-8`, and both calls are compared there.
 */
test('in an ar_EG environment the pinned figure still reads 1,234,567.50 (control)', () => {
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
  // The figure the product prints does not move with the reader's machine.
  assert.equal(reading.pinned, '1,234,567.50', `pinned figure moved in locale ${reading.locale}`);
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
