/**
 * The EOSB trend-claim guard (client side of the false-claim class fixed by PR #312 and #315).
 *
 * The shipped card on the Strategic Intelligence screen used to read, generated at render time:
 *   "EOSB liability forecast shows a {rise|steady} trend into 2027."
 * The trend word came from comparing point 2 of the series with point 0, and the year was hard-coded in
 * the client. The series behind it is four hard-coded calendar quarter-ends (`server/index.js:773`),
 * each point computed on one hard-coded basis for everybody (a resignation, until the 2026-10-29 ruling
 * made each row project on its own recorded reason) and with no departure ever modelled, so the first
 * point is in the past and the last is months ahead: a calendar series, not the next twelve months. Four points under those assumptions cannot establish a trend, and this card is the
 * sentence a buyer reads. See `eosb-liability-forecast-spec.md` sections 2.3 and 7.
 *
 * The card now carries that spec's own honest label (section 7, "What this number is not") and asserts
 * no movement at all. This file is what stops the trend word coming back unnoticed.
 *
 * Three assertions, each reddenable on purpose:
 *   1. the file read is really the analytics source (so a rename cannot make this pass vacuously);
 *   2. no rendered string in it claims a trend into a year, or that the forecast "shows" a movement -
 *      asserted on the source with comments STRIPPED, because a comment quoting the removed wording is
 *      historical by construction and must not itself trip the guard;
 *   3. the honest label is still what the card says, so deleting the sentence outright (which is also
 *      an acceptable answer, but a deliberate one) reddens here instead of passing silently.
 *
 * A regex cannot prove absence - it is a gate, not a proof, and it is honest about that. It catches the
 * reintroduction a person would actually make: pasting the old sentence back into this file.
 *
 * Run: `cd client && npm test`   (node --test, no browser, no build)
 */
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// The served card is generated in App.tsx, inside the `activeTab === 'analytics'` block and reachable
// from the "Strategic Intelligence" nav button. That is the file this guard judges.
const APP = path.join(import.meta.dirname, 'App.tsx');
const raw = fs.readFileSync(APP, 'utf8');

/**
 * Drop comments so a historical quote cannot read as a live claim: `{/* ... *\/}` JSX comments, plain
 * block comments, and whole-line `//` comments. `//` inside a line is left alone (a URL contains one).
 */
function stripComments(src) {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}
const code = stripComments(raw);

test('the guard reads the analytics source, not an empty or renamed file', () => {
  assert.ok(raw.length > 20000,
    `App.tsx read as ${raw.length} bytes: the file this guard judges is missing or truncated`);
  assert.match(raw, /liability forecast shows a/, // the historical quote in the comment must be there
    'the dated comment naming the removed wording is gone: this guard no longer documents what it removes');
  assert.match(code, /Strategic Workforce Intelligence/,
    'the analytics screen\'s own heading is absent from App.tsx: this guard is not judging the screen it '
    + 'claims to judge');
  assert.match(code, /eosbLiabilitySeries/,
    'the series this guard is about is absent from App.tsx');
});

test('no rendered string claims a trend in the EOSB forecast, and none names a forecast year', () => {
  assert.doesNotMatch(code, /trend into \d{4}/i,
    'a hard-coded forecast year with a "trend" claim is back in the client. The series is four calendar '
    + 'quarter-ends computed on one hard-coded basis for everybody, with no departures modelled, so a trend claim is not '
    + 'supported by it (eosb-liability-forecast-spec.md section 7). If a trend is now supportable, that '
    + 'is P4-3\'s series change and this guard must be updated with it, not deleted.');
  assert.doesNotMatch(code, /liability forecast shows a/i,
    'the removed sentence shape is back: the card asserts what the forecast "shows" although the client '
    + 'compares two points and can establish nothing about movement.');
});

test('the card still states what the number is, in the forecast spec\'s own words', () => {
  assert.match(code, /An undiscounted projection of accrued EOSB entitlement, engine-computed/,
    'the honest label from eosb-liability-forecast-spec.md section 7 is no longer on the card. Withholding '
    + 'the sentence is a legitimate answer, but it is a decision: if it was withheld on purpose, update '
    + 'this guard to assert the absence instead of deleting the guard.');
  assert.doesNotMatch(code, /finance-ready/i,
    'the phrase the spec drops ("finance-ready for CFO booking") is back on a rendered surface.');
});
