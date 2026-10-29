/**
 * ONE CONVENTION, ONE PLACE — and the guard that keeps it there.
 *
 * The owner's ruling is that numerals are Latin digits throughout; the defects this file answers to
 * are (a) seven display sites in `App.tsx` calling `toLocaleString(undefined, ...)`, i.e. taking
 * their convention from the machine the reader sits at, so one grid could show two digit
 * conventions at once, and (b) three date shapes on the same screen (`2026-09-19`, `19 Sep 2026`,
 * `29 October 2026`).
 *
 * Four things are asserted, and the ORDER matters — the last two are what keep the first two from
 * being decoration:
 *   1. the conventions themselves, on the returned STRINGS (not on the existence of a function);
 *   2. that each convention equals the server's own expression, read out of `server/` every run, so
 *      a figure on screen is the string that goes into the served document;
 *   3. that NO module under `client/src` outside `src/format.js` reaches for a locale-sensitive API
 *      — the tree is WALKED, so a file added tomorrow is covered, and a guard that cannot see its
 *      subject is a failure rather than a pass;
 *   4. that the call sites are actually routed (a count of the real calls), and that the guard
 *      REDDENS on a planted violation while staying green on a comment that merely mentions one.
 *
 * Run: `cd client && npm test`   (node --test, no browser, no DOM)
 */
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  AMOUNT_DECIMALS, DATE_LOCALE, DATE_OPTIONS, formatAmount, formatDate, formatTime, money,
} from './format.js';

const SRC = import.meta.dirname;
const REPO = path.resolve(SRC, '..', '..');
const SERVER = path.join(REPO, 'server', 'index.js');

/** The server's own two expressions, as measured at `4c8779b` — a citation, not a memory. */
const SERVER_MONEY = "Number(v).toFixed(2)";
const SERVER_DATE_OPTIONS = "{ day: 'numeric', month: 'long', year: 'numeric' }";

// ---------------------------------------------------------------- a comment-aware blanker
/**
 * Replace comments with spaces, KEEPING every newline and every string literal, so a violation's
 * `file:line` is still the line a reader would open. A naive `//`-to-end-of-line strip would also
 * eat the tail of a line carrying `https://…` inside a string, which can hide code from a guard.
 */
function blankComments(text) {
  let out = '';
  let mode = 'code';
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];
    if (mode === 'code') {
      if (c === '/' && next === '*') { out += '  '; i += 1; mode = 'block'; continue; }
      if (c === '/' && next === '/') { out += '  '; i += 1; mode = 'line'; continue; }
      if (c === '"' || c === "'" || c === '`') { mode = c; out += c; continue; }
      out += c; continue;
    }
    if (mode === 'block') {
      if (c === '*' && next === '/') { out += '  '; i += 1; mode = 'code'; continue; }
      out += c === '\n' ? '\n' : ' '; continue;
    }
    if (mode === 'line') {
      if (c === '\n') { out += '\n'; mode = 'code'; continue; }
      out += ' '; continue;
    }
    // inside a string literal: copied verbatim, escapes included
    if (c === '\\') { out += c + (next === undefined ? '' : next); i += 1; continue; }
    if (c === mode) { mode = 'code'; out += c; continue; }
    out += c;
  }
  return out;
}

/** The locale-sensitive calls a display path must not make on its own. */
const FORBIDDEN = [
  [/\.toLocale[A-Za-z]*\s*\(/, 'toLocale* — formats with the ambient locale'],
  [/\bIntl\s*\./, 'Intl.* — formats with the ambient locale'],
  [/\.toFixed\s*\(/, 'toFixed — a rival money format outside the one module'],
  [/\.to(?:Date|Time)String\s*\(/, 'toDateString/toTimeString — an environment-shaped rendering'],
];

/** Every forbidden call in `text`, as `line: what`. Comments are not code and are blanked first. */
function localeSites(text) {
  const lines = blankComments(text).split('\n');
  const found = [];
  lines.forEach((line, index) => {
    FORBIDDEN.forEach(([re, why]) => {
      if (re.test(line)) found.push(`${index + 1}: ${why}`);
    });
  });
  return found;
}

/** Every source file under `client/src`, recursively — never a list of names. */
function walkSource(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walkSource(full, acc); continue; }
    if (!/\.(js|jsx|ts|tsx)$/.test(entry.name)) continue;
    acc.push(full);
  }
  return acc;
}

// ------------------------------------------------------------------------ 1. the conventions
test('a figure is two decimals, Latin digits, and no group separator — everywhere', () => {
  assert.equal(AMOUNT_DECIMALS, 2);
  assert.equal(formatAmount(1234567.5), '1234567.50');
  assert.equal(formatAmount(0), '0.00');
  assert.equal(formatAmount(12), '12.00');
  assert.match(formatAmount(1234567.5), /^\d+\.\d{2}$/);
  assert.equal(/[\u0660-\u0669\u06f0-\u06f9]/.test(formatAmount(1234567.5)), false,
    'a figure must never carry Arabic-Indic or Extended Arabic-Indic digits');
});

test('money() puts the currency in front and never invents one', () => {
  assert.equal(money('AED', 1234.5), 'AED 1234.50');
  assert.equal(money('SAR', 0), 'SAR 0.00');
  assert.equal(money(null, 12), '\u2014 12.00');
  assert.equal(money('', 12), '\u2014 12.00');
});

test('a date has ONE shape, and the unreadable come back as they came', () => {
  assert.equal(DATE_LOCALE, 'en-GB');
  assert.equal(formatDate('2026-09-19'), '19 September 2026');
  assert.equal(formatDate(new Date(2026, 9, 29)), '29 October 2026');
  assert.equal(formatDate('2026-11-18T12:00:00Z'), '18 November 2026');
  // A bare `YYYY-MM-DD` is a CALENDAR DAY: parsed as UTC midnight it would read as 31 December
  // west of Greenwich, which is a wrong date rather than a differently shaped one.
  assert.equal(formatDate('2026-01-01'), '1 January 2026');
  assert.equal(formatDate('not-a-date'), 'not-a-date');
  assert.equal(formatDate(null), '');
  assert.equal(formatDate(undefined), '');
  assert.equal(formatDate(''), '');
  assert.equal(/[\u0660-\u0669]/.test(formatDate('2026-09-19')), false);
  assert.match(formatDate('2026-09-19'), /^\d{1,2} [A-Z][a-z]+ \d{4}$/);
});

test('a time has one shape too — and nothing on screen uses it yet, said out loud', () => {
  assert.equal(formatTime(new Date(2026, 8, 19, 14, 5)), '14:05');
  assert.equal(formatTime(new Date(2026, 8, 19, 0, 5)), '00:05');
  assert.equal(formatTime('not-a-time'), 'not-a-time');
  assert.equal(formatTime(null), '');
  assert.match(formatTime(new Date(2026, 8, 19, 14, 5)), /^\d{2}:\d{2}$/);
  // Measured, not assumed: no file outside src/format.js calls this helper. If a screen ever needs
  // a clock, it calls this and this line moves with it.
  const callers = walkSource(SRC)
    .filter((f) => !f.endsWith('format.js') && !f.endsWith('format.test.js'))
    .filter((f) => blankComments(fs.readFileSync(f, 'utf8')).includes('formatTime('));
  assert.deepEqual(callers, [], `formatTime() has no call site today, but ${callers.join(', ')} now calls it`);
});

// ------------------------------------------------------- 2. the conventions ARE the server's
test('the client figure is the string the server writes, read out of server/ every run', () => {
  assert.ok(fs.existsSync(SERVER),
    `CANNOT-JUDGE: ${SERVER} is absent, so agreement with the server cannot be checked — and a check `
    + 'that cannot see its subject must not pass');
  const server = fs.readFileSync(SERVER, 'utf8');
  // The server's settlement-statement money expression, and its date expression. If EITHER moves,
  // the client's convention has to be re-derived — so this reddens rather than drifting silently.
  assert.ok(server.includes(SERVER_MONEY),
    `the server no longer writes amounts as ${SERVER_MONEY} — re-derive src/format.js against it`);
  assert.ok(server.includes(SERVER_DATE_OPTIONS),
    `the server no longer renders dates with ${SERVER_DATE_OPTIONS} — re-derive src/format.js`);
  // And then the agreement itself, on returned strings, over a table of amounts.
  for (const v of [0, 12, 1234.5, 1234567.5, 0.005, 1e6 + 0.01]) {
    assert.equal(formatAmount(v), Number(v).toFixed(2), `figure ${v} disagrees with the server's expression`);
  }
  const day = new Date(2026, 9, 29);
  assert.equal(formatDate(day), day.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
});

// --------------------------------------------- 3. no module outside format.js formats on its own
test('no file under client/src takes a digit, separator or month from the machine (WALKED)', () => {
  const files = walkSource(SRC);
  // A walk that found nothing would pass vacuously: state what it must have seen.
  const names = files.map((f) => path.relative(SRC, f));
  assert.ok(files.length >= 5, `the walk found only ${files.length} source file(s) — it is not seeing client/src`);
  assert.ok(names.includes('App.tsx'), 'the walk did not reach App.tsx');
  const offenders = [];
  for (const file of files) {
    const rel = path.relative(SRC, file);
    if (rel === 'format.js') continue;               // the one place allowed to name a locale
    if (rel.endsWith('.test.js')) continue;          // a test may call the raw API as its own control
    for (const site of localeSites(fs.readFileSync(file, 'utf8'))) offenders.push(`${rel}:${site}`);
  }
  assert.deepEqual(offenders, [],
    'a display path still takes its convention from the ambient locale, or formats on its own:\n  '
    + offenders.join('\n  '));
});

test('format.js does pin its locale — the one place that may call a locale API', () => {
  const code = blankComments(fs.readFileSync(path.join(SRC, 'format.js'), 'utf8'));
  assert.ok(/toLocaleDateString\(\s*DATE_LOCALE\s*,/.test(code), 'the date call must pass the constant, not nothing');
  assert.ok(/toLocaleTimeString\(\s*DATE_LOCALE\s*,/.test(code), 'the time call must pass the constant, not nothing');
  assert.equal(/toLocale[A-Za-z]*\s*\(\s*(undefined|\))/.test(code), false,
    'an undefined/absent locale is the ambient locale — the defect this module exists to remove');
});

// ---------------------------------- 4. the call sites are routed, and the guard can redden
test('every figure and date site in App.tsx goes through the module', () => {
  const app = blankComments(fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8'));
  assert.equal((app.match(/toLocale/g) || []).length, 0, 'a raw locale call is back in App.tsx');
  assert.equal((app.match(/toFixed/g) || []).length, 0, 'App.tsx formats a figure itself');
  // The counts, published before → after: 7 figures (all raw `toLocaleString` before) and 8 dates
  // (raw `YYYY-MM-DD` before, beside `19 Sep 2026` from probationTimeline). `>=` so a new site does
  // not have to argue with this line, but a site that stops routing does.
  assert.ok((app.match(/formatAmount\(/g) || []).length >= 7, 'fewer than the seven figure sites route');
  assert.ok((app.match(/formatDate\(/g) || []).length >= 8, 'fewer than the eight date sites route');
  assert.match(app, /import \{[^}]*\bformatAmount\b[^}]*\bformatDate\b[^}]*\} from '\.\/format\.js';/,
    'App.tsx must import the conventions from the one module');
});

test('the guard itself reddens on a planted violation, and not on a comment about one (control)', () => {
  const planted = [
    "      <span>{analytics.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>",
    '      cost = value.toFixed(2);',
    "      const d = new Intl.DateTimeFormat('en-GB');",
  ];
  assert.equal(localeSites(planted.join('\n')).length, 3, 'a planted violation must be found, one per line');
  // The false-positive control: prose that names the defect is not the defect.
  const prose = [
    '// `value.toLocaleString(undefined, ...)` here was the defect: the figure followed the machine.',
    '/* Intl.NumberFormat() and .toFixed(2) were the two ways it used to drift. */',
  ];
  assert.deepEqual(localeSites(prose.join('\n')), [], 'a comment is not a call site');
});

/**
 * The control. A test that only asserted `formatDate('2026-09-19') === '19 September 2026'` would
 * pass on a host whose locale is already en-GB, i.e. it could not show the pin is load-bearing. So
 * the real module is imported in a CHILD PROCESS with `LC_ALL=ar_EG.UTF-8` and the pinned and
 * unpinned calls are compared THERE.
 */
test('in an ar_EG environment both readings stay Latin (control)', () => {
  const probe = [
    "import { formatAmount, formatDate } from " + JSON.stringify(path.join(SRC, 'format.js')) + ";",
    "const d = new Date(2026, 8, 19);",
    "console.log(JSON.stringify({",
    "  pinnedMoney: formatAmount(1234567.5),",
    "  unpinnedMoney: (1234567.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),",
    "  pinnedDate: formatDate(d),",
    "  unpinnedDate: d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),",
    "  locale: Intl.DateTimeFormat().resolvedOptions().locale,",
    "  arabicDigits: /[\\u0660-\\u0669]/.test(new Intl.NumberFormat('ar-EG').format(1234)),",
    "}));",
  ].join('\n');
  const raw = execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { LC_ALL: 'ar_EG.UTF-8', LANG: 'ar_EG.UTF-8' }),
  });
  const reading = JSON.parse(raw.trim());
  console.log(`control (${reading.locale}): pinnedMoney=${reading.pinnedMoney} pinnedDate=${reading.pinnedDate}`
    + ` unpinnedMoney=${reading.unpinnedMoney} unpinnedDate=${reading.unpinnedDate}`
    + ` arabicDigits=${reading.arabicDigits}`);
  assert.equal(reading.pinnedMoney, '1234567.50', `the pinned figure moved in locale ${reading.locale}`);
  assert.equal(reading.pinnedDate, '19 September 2026', `the pinned date moved in locale ${reading.locale}`);
  // Where the host can represent Arabic at all, the UNPINNED calls must differ here — otherwise
  // this control is not exercising the defect it exists for.
  if (reading.arabicDigits) {
    assert.notEqual(reading.unpinnedMoney, reading.pinnedMoney,
      'the unpinned figure should read differently here — this control proves nothing otherwise');
    assert.notEqual(reading.unpinnedDate, reading.pinnedDate,
      'the unpinned date should read differently here — this control proves nothing otherwise');
  }
});
