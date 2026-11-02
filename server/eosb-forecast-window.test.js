'use strict';
/**
 * THE GUARD FOR THE EOSB FORECAST WINDOW — it reddens when the window drifts behind the clock.
 *
 * The defect it answers: `server/index.js` built the forecast window as a four-entry literal ending at
 * `Q2 2027`. On 2026-11-02 that literal's first entry (`Q3 2026`, `2026-09-30`) was 33 days in the
 * PAST and was served under a heading that says "Forecast" — a buyer read four forward points, one of
 * which was history — and nothing in the code could notice, because a literal cannot look at a clock.
 * It would have drifted one point per quarter, forever, silently.
 *
 * WHAT MAKES THIS GUARD LOAD-BEARING RATHER THAN DECORATIVE
 * The predicate `assertForwardWindow` below is applied to TWO subjects:
 *   1. the window `forecastQuarterEnds()` returns, for a series of fixed instants; and
 *   2. **the old literal itself** (`THE_OLD_LITERAL`), for `2026-11-02` — the date the defect was
 *      measured on. That case asserts the predicate THROWS. If the predicate ever stops reddening on
 *      the code that was actually wrong, the suite goes red and this file stops being evidence.
 * A separate test asserts `server/index.js` carries no quarter literal again, so a future edit that
 * re-hardcodes the list (the obvious way to "fix" a failing chart) is caught at the source.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { forecastQuarterEnds, QUARTERS_AHEAD } = require('./eosb-forecast-window.js');

const INDEX_JS = path.join(__dirname, 'index.js');

/** `YYYY-MM-DD` → the UTC millisecond of that calendar day. */
function utcDay(iso) {
  assert.match(iso, /^\d{4}-\d{2}-\d{2}$/, `not a YYYY-MM-DD date: ${iso}`);
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

/** Midnight UTC of the calendar day `d` falls on — the same granularity the module compares at. */
function utcToday(d) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * THE PREDICATE. Every clause is one the brief named, and each fails with the offending point in the
 * message so a red run says which quarter drifted rather than only that something did.
 */
function assertForwardWindow(window, now, label, expectedLength = 4) {
  const today = utcToday(now);
  assert.ok(Array.isArray(window), `${label}: the window is not an array`);

  // Shape: four points by default, because four is the shape of the chart on the analytics screen. An
  // unexplained change in the number of bars is its own defect, so the length is asserted, not assumed.
  assert.strictEqual(window.length, expectedLength,
    `${label}: the window must hold ${expectedLength} quarter-ends, got ${window.length}`);

  window.forEach((point, i) => {
    assert.ok(point && typeof point.quarter === 'string' && typeof point.date === 'string',
      `${label}: point ${i} is not { quarter, date } — got ${JSON.stringify(point)}`);
    // The label format the client renders verbatim.
    assert.match(point.quarter, /^Q[1-4] \d{4}$/, `${label}: point ${i} label "${point.quarter}" is not "Qn YYYY"`);
    // A real calendar quarter-end, not an arbitrary date.
    assert.match(point.date, /^\d{4}-(03-31|06-30|09-30|12-31)$/,
      `${label}: point ${i} date "${point.date}" is not a calendar quarter-end`);
    // The label agrees with its own date — a window that says Q3 2026 over 2026-12-31 is worse than
    // one that is simply late.
    const quarterOfYear = Math.ceil(Number(point.date.slice(5, 7)) / 3);
    assert.strictEqual(point.quarter, `Q${quarterOfYear} ${point.date.slice(0, 4)}`,
      `${label}: point ${i} is labelled "${point.quarter}" but its date ${point.date} is Q${quarterOfYear}`);

    // CLAUSE 1 — NO RETURNED QUARTER-END IS IN THE PAST.
    assert.ok(utcDay(point.date) >= today,
      `${label}: ${point.quarter} (${point.date}) is IN THE PAST for now=${now.toISOString()} — `
      + 'a served "forecast" point that has already happened');
  });

  // CLAUSE 2 — THE FIRST ONE IS STRICTLY AFTER IT. Strict, not "not before": a quarter-end that is
  // today is not a forward projection.
  assert.ok(utcDay(window[0].date) > today,
    `${label}: the first point ${window[0].quarter} (${window[0].date}) is not strictly after `
    + `now=${now.toISOString()} — the series would start at or behind the clock`);

  // Strictly increasing, so the chart's bars are a forward ladder and not a shuffled set.
  for (let i = 1; i < window.length; i++) {
    assert.ok(utcDay(window[i].date) > utcDay(window[i - 1].date),
      `${label}: point ${i} (${window[i].quarter}) does not come after point ${i - 1} (${window[i - 1].quarter})`);
  }
}

/** The literal this module replaced, kept here ONLY as the control subject. */
const THE_OLD_LITERAL = [
  { quarter: 'Q3 2026', date: '2026-09-30' },
  { quarter: 'Q4 2026', date: '2026-12-31' },
  { quarter: 'Q1 2027', date: '2027-03-31' },
  { quarter: 'Q2 2027', date: '2027-06-30' }
];

describe('the control: the predicate reddens on the code that was actually wrong', () => {
  test('the OLD literal fails the same predicate on the date the defect was measured (2026-11-02)', () => {
    const now = new Date('2026-11-02T12:00:00.000Z');
    // The old first point, 2026-09-30, is 33 days before this instant.
    assert.throws(
      () => assertForwardWindow(THE_OLD_LITERAL, now, 'THE OLD LITERAL'),
      /IN THE PAST/,
      'the guard did not redden on the old literal — it is not measuring the defect it claims to'
    );
  });

  test('the OLD literal passed the same predicate before its first point fell behind — so the guard is about time, not shape', () => {
    // On 2026-08-01 all four literal points were still ahead: the literal was CORRECT then. The
    // defect is that it could not stay correct, which is why the predicate must be re-run against a
    // clock rather than trusted once.
    assertForwardWindow(THE_OLD_LITERAL, new Date('2026-08-01T00:00:00.000Z'), 'THE OLD LITERAL (2026-08-01)');
  });
});

describe('the derived window, at the boundary instants', () => {
  const cases = [
    // [label, now, expected first point]
    ['the defect date — the old window opened on Q3 2026 here', '2026-11-02T00:00:00.000Z', { quarter: 'Q4 2026', date: '2026-12-31' }],
    // The boundary the brief named: the quarter-end day ITSELF. Q3 2026 ends today, so its end is
    // not a forward point and the window starts at the next one.
    ['the quarter-end day itself (2026-09-30)', '2026-09-30T00:00:00.000Z', { quarter: 'Q4 2026', date: '2026-12-31' }],
    ['the last instant before it is still "today"', '2026-09-30T23:59:59.000Z', { quarter: 'Q4 2026', date: '2026-12-31' }],
    // One day earlier the quarter-end is still ahead, and IS a legitimate forecast point.
    ['the day before the quarter-end', '2026-09-29T00:00:00.000Z', { quarter: 'Q3 2026', date: '2026-09-30' }],
    ['the day after the quarter-end (2026-10-01)', '2026-10-01T00:00:00.000Z', { quarter: 'Q4 2026', date: '2026-12-31' }],
    ['the new year (2027-01-01)', '2027-01-01T00:00:00.000Z', { quarter: 'Q1 2027', date: '2027-03-31' }],
    ['the year-end day itself (2026-12-31)', '2026-12-31T23:59:59.000Z', { quarter: 'Q1 2027', date: '2027-03-31' }],
    ['a Q1 end day itself (2027-03-31)', '2027-03-31T00:00:00.000Z', { quarter: 'Q2 2027', date: '2027-06-30' }],
    // Leap-year February: the 29th exists, and the next quarter-end is 2028-03-31 either way. A
    // window computed by "add 90 days" or by a 365-day year breaks here; this one does not.
    ['a leap-year February 29 (2028-02-29)', '2028-02-29T12:00:00.000Z', { quarter: 'Q1 2028', date: '2028-03-31' }],
    ['a leap-year February 28 (2028-02-28)', '2028-02-28T00:00:00.000Z', { quarter: 'Q1 2028', date: '2028-03-31' }],
    ['a non-leap February 28 (2027-02-28)', '2027-02-28T23:59:59.000Z', { quarter: 'Q1 2027', date: '2027-03-31' }],
    // A quarter-end on a leap year's own Q1 boundary.
    ['a leap-year Q1 end day (2028-03-31)', '2028-03-31T08:00:00.000Z', { quarter: 'Q2 2028', date: '2028-06-30' }]
  ];

  for (const [label, iso, expectedFirst] of cases) {
    test(`${label} → first point ${expectedFirst.quarter} (${expectedFirst.date})`, () => {
      const now = new Date(iso);
      assert.ok(!Number.isNaN(now.getTime()), `bad fixture: ${iso}`);
      const window = forecastQuarterEnds(now);
      assertForwardWindow(window, now, label);
      assert.deepStrictEqual(window[0], expectedFirst,
        `${label}: the window opened at ${JSON.stringify(window[0])}, expected ${JSON.stringify(expectedFirst)}`);
    });
  }

  test('2026-11-02 — the exact defect — no longer returns the quarter that had already ended', () => {
    const window = forecastQuarterEnds(new Date('2026-11-02T00:00:00.000Z'));
    assert.ok(!window.some(p => p.quarter === 'Q3 2026'),
      'Q3 2026 is back in the window: that quarter ended 2026-09-30 and was served as a forecast');
    assert.deepStrictEqual(window.map(p => p.quarter), ['Q4 2026', 'Q1 2027', 'Q2 2027', 'Q3 2027'],
      'the rolling window on 2026-11-02 is not the four quarters ahead of it');
  });

  test('a full four-quarter window crosses the year boundary without repeating or skipping a quarter', () => {
    const window = forecastQuarterEnds(new Date('2026-11-02T00:00:00.000Z'));
    assert.deepStrictEqual(window.map(p => p.date),
      ['2026-12-31', '2027-03-31', '2027-06-30', '2027-09-30']);
    // One quarter apart, always: the four labels are consecutive quarters, which is what makes the
    // chart's spacing meaningful.
    const indexes = window.map(p => Number(p.date.slice(0, 4)) * 4 + Math.ceil(Number(p.date.slice(5, 7)) / 3));
    assert.deepStrictEqual(indexes, [indexes[0], indexes[0] + 1, indexes[0] + 2, indexes[0] + 3]);
  });
});

describe('the series length and the injected clock', () => {
  test('the default length is four, unchanged from the literal it replaced', () => {
    assert.strictEqual(QUARTERS_AHEAD, 4);
    assert.strictEqual(forecastQuarterEnds(new Date('2026-11-02T00:00:00.000Z')).length, 4);
  });

  test('count is honoured — the caller can ask for a different length without the rule changing', () => {
    const now = new Date('2026-11-02T00:00:00.000Z');
    assert.deepStrictEqual(forecastQuarterEnds(now, 1), [{ quarter: 'Q4 2026', date: '2026-12-31' }]);
    assert.strictEqual(forecastQuarterEnds(now, 8).length, 8);
    assertForwardWindow(forecastQuarterEnds(now, 8), now, 'count=8', 8);
  });

  test('the clock is an ARGUMENT — the same call answers differently for different instants', () => {
    // If the function read `Date.now()` inline, these two would be identical and this test would fail.
    const a = forecastQuarterEnds(new Date('2026-11-02T00:00:00.000Z'));
    const b = forecastQuarterEnds(new Date('2027-05-15T00:00:00.000Z'));
    assert.notDeepStrictEqual(a.map(p => p.quarter), b.map(p => p.quarter),
      'the window did not move with the injected clock — it is reading a fixed or inline clock');
    assert.strictEqual(b[0].quarter, 'Q2 2027', 'the window for 2027-05-15 does not open at 2027-06-30');
  });

  test('a bad clock or a bad count is refused, not silently coerced', () => {
    assert.throws(() => forecastQuarterEnds(new Date('not a date')), TypeError);
    assert.throws(() => forecastQuarterEnds('2026-11-02'), TypeError);
    assert.throws(() => forecastQuarterEnds(undefined, 0), TypeError);
    assert.throws(() => forecastQuarterEnds(undefined, 2.5), TypeError);
  });

  test('the REAL clock, now: the window that is served today holds no past quarter-end', () => {
    // This cannot catch drift (a rolling window does not drift) but it asserts the invariant at the
    // instant this suite runs, so a bad default — e.g. a caller passing a stale `now` — reddens here.
    const now = new Date();
    assertForwardWindow(forecastQuarterEnds(now), now, 'the real clock');
  });
});

describe('the source guard: server/index.js cannot go back to a hard-coded window', () => {
  test('index.js exists and is readable — an unreadable source is a RED, never a skip', () => {
    assert.ok(fs.existsSync(INDEX_JS), `${INDEX_JS} is missing: this guard would otherwise pass on nothing`);
    assert.ok(fs.readFileSync(INDEX_JS, 'utf8').length > 10000, 'index.js is implausibly small — refusing to judge it');
  });

  test('index.js calls the derived window and carries no quarter literal', () => {
    const src = fs.readFileSync(INDEX_JS, 'utf8');
    assert.match(src, /require\('\.\/eosb-forecast-window'\)/,
      'index.js no longer requires the forecast-window module');
    assert.match(src, /eosbForecastWindow\.forecastQuarterEnds\(/,
      'index.js no longer builds the window from the derived function');
    // The shape the defect had: a point written into the source with a hard-coded quarter label.
    const literal = src.match(/quarter:\s*'Q[1-4] \d{4}'/g) || [];
    assert.deepStrictEqual(literal, [],
      `index.js hard-codes a quarter again (${literal.join(', ')}): the window must come from the clock`);
    // And the dates themselves — a list of quarter-end dates pasted back in would evade the label scan.
    const hardCodedDates = src.match(/date:\s*'\d{4}-(03-31|06-30|09-30|12-31)'/g) || [];
    assert.deepStrictEqual(hardCodedDates, [],
      `index.js hard-codes a quarter-end date again (${hardCodedDates.join(', ')})`);
  });
});
