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
