const { test, describe } = require('node:test');
const assert = require('node:assert');
const { calculateEOSB } = require('./eosb.js');

describe('EOSB Calculation - Option B (KSA Art. 84)', () => {
  // Saudi Arabia - Option B
  test('KSA: 18 months resignation should be full pro-rata (NON-ZERO)', () => {
    const start = '2024-01-01';
    const end = new Date(new Date(start).getTime() + 547.875 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = calculateEOSB(start, end, 5000, 10000, 'SA', 'resignation');
    // (10000 / 2) * 1.5 = 7500
    // actual tenureYears = 547 / 365.25 = 1.4976...
    // 5000 * 1.4976 = 7488
    assert.strictEqual(result, 7488.02);
  });

  test('KSA: 3y resignation should be full, NOT reduced by a third', () => {
    const start = '2024-01-01';
    const end = new Date(new Date(start).getTime() + 3 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = calculateEOSB(start, end, 5000, 10000, 'SA', 'resignation');
    assert.strictEqual(result, 14989.73);
  });

  test('KSA: 6y resignation should be full, no 2/3 reduction', () => {
    const start = '2024-01-01';
    const end = new Date(new Date(start).getTime() + 6 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = calculateEOSB(start, end, 5000, 10000, 'SA', 'resignation');
    assert.strictEqual(result, 34986.31);
  });

  test('KSA: 9y resignation should be full, no 2/3 reduction', () => {
    const start = '2024-01-01';
    const end = new Date(new Date(start).getTime() + 9 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = calculateEOSB(start, end, 5000, 10000, 'SA', 'resignation');
    assert.strictEqual(result, 64993.16);
  });

  test('KSA: summary dismissal should be 0', () => {
    const result = calculateEOSB('2024-01-01', '2027-01-01', 5000, 10000, 'SA', 'summary_dismissal');
    assert.strictEqual(result, 0);
  });

  test('KSA: exactly 2-year boundary', () => {
    const start = '2024-01-01';
    const end = new Date(new Date(start).getTime() + 2 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = calculateEOSB(start, end, 5000, 10000, 'SA', 'resignation');
    assert.strictEqual(result, 9993.16);
  });

  // UAE - Regression Tests
  test('UAE: 2y resignation should be 1/3 (FDL 33/2021)', () => {
    const start = '2024-01-01';
    const end = new Date(new Date(start).getTime() + 2 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = calculateEOSB(start, end, 6000, 10000, 'AE', 'resignation');
    assert.strictEqual(result, 2798.08);
  });

  test('UAE: 4y resignation should be 2/3', () => {
    const start = '2024-01-01';
    const end = new Date(new Date(start).getTime() + 4 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = calculateEOSB(start, end, 6000, 10000, 'AE', 'resignation');
    assert.strictEqual(result, 11200);
  });

  test('UAE: 6y resignation should be full', () => {
    const start = '2024-01-01';
    const end = new Date(new Date(start).getTime() + 6 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = calculateEOSB(start, end, 6000, 10000, 'AE', 'resignation');
    assert.strictEqual(result, 26991.79);
  });

  test('UAE: 24 months basic salary cap', () => {
    const start = '2000-01-01';
    const end = '2040-01-01';
    const result = calculateEOSB(start, end, 10000, 20000, 'AE', 'termination');
    assert.strictEqual(result, 240000);
  });

  test('UAE: under 1 year should be 0', () => {
    const result = calculateEOSB('2024-01-01', '2024-06-01', 5000, 10000, 'AE', 'resignation');
    assert.strictEqual(result, 0);
  });

  test('Unpaid leave handling', () => {
    const start = '2024-01-01';
    const end = new Date(new Date(start).getTime() + 2 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const ksaResult = calculateEOSB(start, end, 5000, 10000, 'SA', 'resignation', 100);
    assert.strictEqual(ksaResult, 8624.23);

    const uaeResult = calculateEOSB(start, end, 6000, 10000, 'AE', 'termination', 100);
    assert.strictEqual(uaeResult, 8394.25);
  });
});

describe('the termination reason is never defaulted (owner ruling 2026-10-29)', () => {
  const { calculateEOSB: calc, calculateEOSBDetailed, basisForRow, storedReason, TERMINATION_REASONS } = require('./eosb.js');
  const start = '2024-01-01';
  const at = (years) => new Date(new Date(start).getTime() + years * 365.25 * 864e5).toISOString().split('T')[0];
  const TWO = at(2);
  const FOUR = at(4);

  test('the reason parameter has NO default: a caller that passes nothing gets the UNREDUCED figure', () => {
    // The defect this closes: `terminationType = 'resignation'` meant this exact call — six arguments,
    // no reason — silently computed on a resignation. 2 UAE years on a 6,000 basic: the row accrues
    // 2 * 21 * (6000/30) = 8,394.25, and the resignation tier takes a THIRD of it.
    const unreduced = calc(start, TWO, 6000, 10000, 'AE');
    assert.strictEqual(unreduced, 8394.25, 'a missing reason must compute the whole entitlement');
    assert.strictEqual(calc(start, TWO, 6000, 10000, 'AE', 'resignation'), 2798.08,
      'a RECORDED resignation keeps exactly the tier it had (counsel item 2 freezes the thresholds)');
    assert.ok(Math.abs(unreduced - 2798.08 * 3) <= 0.02, 'the reduction removed is one third, and it is back');
    assert.strictEqual(unreduced, calc(start, TWO, 6000, 10000, 'AE', 'termination'));
  });
  test('blank is a STATE: null, undefined and the empty string all agree, and all are unreduced', () => {
    const byDefault = calc(start, FOUR, 6000, 10000, 'AE');
    assert.strictEqual(calc(start, FOUR, 6000, 10000, 'AE', null), byDefault);
    assert.strictEqual(calc(start, FOUR, 6000, 10000, 'AE', ''), byDefault);
    assert.strictEqual(calc(start, FOUR, 6000, 10000, 'AE', '   '), byDefault);
    // 4 UAE years: 4 * 21 * 200 = 16,800 whole; a recorded resignation keeps two thirds of it (11,200).
    assert.strictEqual(byDefault, 16800);
    assert.strictEqual(calc(start, FOUR, 6000, 10000, 'AE', 'resignation'), 11200);
  });
  test('an UNKNOWN reason is refused by name, never coerced to a resignation', () => {
    for (const bad of ['quit', 'Resigned', 'RESIGNATION', 'terminated', 'resign']) {
      assert.throws(() => calc(start, TWO, 6000, 10000, 'AE', bad),
        /unknown termination reason/, `"${bad}" must be flagged, not coerced`);
    }
    assert.deepStrictEqual([...TERMINATION_REASONS], ['resignation', 'termination', 'summary_dismissal']);
    // A trailing space on a KNOWN word is trimmed and accepted — trimming is not coercion.
    assert.strictEqual(calc(start, TWO, 6000, 10000, 'AE', ' resignation '), 2798.08);
  });
  test('the engine returns the BASIS it used, so no caller has to infer one', () => {
    assert.deepStrictEqual(
      { ...calculateEOSBDetailed(start, TWO, 6000, 10000, 'AE', null), factor: undefined },
      { amount: 8394.25, reason: null, basis: 'no_reason_recorded', factor: undefined });
    assert.strictEqual(calculateEOSBDetailed(start, TWO, 6000, 10000, 'AE', 'resignation').basis, 'recorded_reduced');
    assert.strictEqual(calculateEOSBDetailed(start, TWO, 6000, 10000, 'AE', 'resignation').factor, 1 / 3);
    assert.strictEqual(calculateEOSBDetailed(start, FOUR, 6000, 10000, 'AE', 'resignation').factor, 2 / 3);
    assert.strictEqual(calculateEOSBDetailed(start, at(6), 6000, 10000, 'AE', 'resignation').basis, 'recorded_no_reduction');
    assert.strictEqual(calculateEOSBDetailed(start, TWO, 6000, 10000, 'AE', 'termination').basis, 'recorded_no_reduction');
    assert.strictEqual(calculateEOSBDetailed('2024-01-01', '2027-01-01', 5000, 10000, 'SA', 'summary_dismissal').basis, 'forfeited');
    assert.strictEqual(calculateEOSBDetailed('2024-01-01', '2024-06-01', 5000, 10000, 'AE', null).basis, 'below_minimum_service');
    assert.strictEqual(calculateEOSBDetailed('not-a-date', null, 1, 1, 'AE', null).basis, 'not_computable');
  });
  test('KSA is untouched: no reduction exists there, for any reason or for none', () => {
    assert.strictEqual(calc(start, at(3), 5000, 10000, 'SA'), 14989.73);
    assert.strictEqual(calc(start, at(3), 5000, 10000, 'SA', 'resignation'), 14989.73);
  });
  test('a STORED reason this engine does not recognise is flagged, not coerced', () => {
    assert.deepStrictEqual(storedReason('mutual_agreement'), { reason: 'mutual_agreement', state: 'unrecognised', recognised: false });
    assert.deepStrictEqual(storedReason(null), { reason: null, state: 'not_recorded', recognised: true });
    assert.deepStrictEqual(storedReason(' resignation '), { reason: 'resignation', state: 'recorded', recognised: true });
    assert.deepStrictEqual(basisForRow({ termination_type: 'mutual_agreement' }),
      { reason: 'mutual_agreement', basis: 'unrecognised_reason', factor: null, recognised: false });
    assert.strictEqual(basisForRow({ termination_type: null, start_date: start, end_date: TWO, basic_salary: 6000, salary: 10000, data_residency_country: 'AE' }).basis,
      'no_reason_recorded');
  });
});
