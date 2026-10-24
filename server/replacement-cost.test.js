/**
 * P4-1 — the replacement cost engine's tests.
 *
 * The load-bearing half of these tests is not "the number is right". It is that the number CAN be
 * wrong: every amount is re-derived here from the inputs the payload itself publishes, so a total
 * that was pinned to a constant would fail, and a component that defaulted to 0 for a missing
 * record would fail the same way. Both directions have a control:
 *
 *   - a REAL zero (a replacement who started the day the seat emptied) is `calculated` with value 0
 *   - a MISSING record is `not_calculated` with a reason and value null — never 0
 */

const { test } = require('node:test');
const assert = require('node:assert');

const {
  computeReplacementCost, triggerOf, MODEL_ID, ASSUMPTIONS, DAYS_PER_MONTH, daysBetween,
} = require('./replacement-cost');

const leaver = (over = {}) => ({
  id: 'emp-1',
  first_name: 'Sarah',
  last_name: 'Al-Qasimi',
  department: 'Marketing',
  role: 'Recruitment Specialist',
  start_date: '2023-09-12',
  end_date: '2026-09-30',
  status: 'offboarding',
  salary: 13000,
  basic_salary: 9000,
  total_salary: 13000,
  recruitment_cost: 4000,
  data_residency_country: 'AE',
  fully_productive_date: '2023-09-30',
  termination_type: null,
  ...over,
});

const successor = (over = {}) => ({
  id: 'emp-2', department: 'Marketing', role: 'Recruitment Specialist', start_date: '2026-10-12', ...over,
});

const byKey = (payload) => Object.fromEntries(payload.components.map((c) => [c.key, c]));

test('a complete seat: four calculated components, and the total is their sum re-derived from the inputs', () => {
  const p = computeReplacementCost({ employee: leaver(), successor: successor(), asOf: '2026-10-22' });

  assert.strictEqual(p.model, MODEL_ID);
  assert.strictEqual(p.total.state, 'calculated');
  assert.deepStrictEqual(p.total.not_calculated, []);
  assert.deepStrictEqual(p.components.map((c) => c.key),
    ['recruitment', 'vacancy_cover', 'onboarding_ramp', 'lost_productivity']);

  const c = byKey(p);
  const daily = 13000 / DAYS_PER_MONTH;
  // Re-derived here, not copied from the module: a pinned constant fails this.
  assert.strictEqual(c.recruitment.value, 4000);
  assert.strictEqual(c.vacancy_cover.inputs.vacancy_days, 12, '2026-09-30 -> 2026-10-12 is 12 days');
  assert.strictEqual(c.vacancy_cover.value, Math.round(12 * daily * 1 * 100) / 100);
  assert.strictEqual(c.onboarding_ramp.inputs.ramp_days, 18, '2023-09-12 -> 2023-09-30 is 18 days');
  assert.strictEqual(c.onboarding_ramp.value, Math.round(18 * daily * 0.5 * 100) / 100);
  assert.strictEqual(c.lost_productivity.value, Math.round(12 * daily * 0.35 * 100) / 100);

  const sum = [c.recruitment, c.vacancy_cover, c.onboarding_ramp, c.lost_productivity]
    .reduce((a, x) => a + x.value, 0);
  assert.strictEqual(p.total.value, Math.round(sum * 100) / 100);
});

test('CONTROL — the figure is computed from records: move the salary and the total moves', () => {
  const a = computeReplacementCost({ employee: leaver(), successor: successor() });
  const b = computeReplacementCost({ employee: leaver({ salary: 26000, total_salary: 26000 }), successor: successor() });
  assert.notStrictEqual(a.total.value, b.total.value, 'doubling the salary must move the total');
  assert.strictEqual(b.total.value, Math.round(b.total.value * 100) / 100);
  // and the ratio is exactly the salary ratio, because every priced component scales with it
  const priced = (p) => p.total.value - byKey(p).recruitment.value;
  assert.strictEqual(Math.round((priced(b) / priced(a)) * 1000) / 1000, 2);
});

test('CONTROL — move the ramp window and the figure moves with it', () => {
  const a = computeReplacementCost({ employee: leaver(), successor: successor() });
  const b = computeReplacementCost({ employee: leaver({ fully_productive_date: '2023-10-12' }), successor: successor() });
  assert.notStrictEqual(byKey(a).onboarding_ramp.value, byKey(b).onboarding_ramp.value);
  assert.strictEqual(byKey(b).onboarding_ramp.inputs.ramp_days, 30);
});

test('no replacement recorded: the two vacancy components SAY SO and are null, never 0', () => {
  const p = computeReplacementCost({ employee: leaver(), successor: null });
  const c = byKey(p);

  for (const key of ['vacancy_cover', 'lost_productivity']) {
    assert.strictEqual(c[key].state, 'not_calculated', `${key} must not be calculated`);
    assert.strictEqual(c[key].value, null, `${key} must be null, NOT 0 — a silent zero is the defect`);
    assert.match(c[key].reason, /no replacement is recorded/, `${key}'s reason must name the missing record`);
  }
  assert.strictEqual(p.total.state, 'partial');
  assert.deepStrictEqual(p.total.not_calculated.sort(), ['lost_productivity', 'vacancy_cover']);
  assert.match(p.total.note, /PARTIAL/);
  assert.match(p.total.note, /NOT the whole cost/);
});

test('no fully-productive date: the ramp component says so, and the total is partial', () => {
  const p = computeReplacementCost({ employee: leaver({ fully_productive_date: null }), successor: successor() });
  const c = byKey(p);
  assert.strictEqual(c.onboarding_ramp.state, 'not_calculated');
  assert.strictEqual(c.onboarding_ramp.value, null);
  assert.match(c.onboarding_ramp.reason, /no fully-productive date/);
  assert.strictEqual(p.total.state, 'partial');
});

test('no departure date: there is no vacancy to measure, and the reason says that', () => {
  const p = computeReplacementCost({ employee: leaver({ end_date: null }), successor: successor() });
  const c = byKey(p);
  assert.strictEqual(c.vacancy_cover.state, 'not_calculated');
  assert.match(c.vacancy_cover.reason, /no departure date/);
  // the ramp needs no vacancy window, so it is still computed
  assert.strictEqual(c.onboarding_ramp.state, 'calculated');
});

test('a recruitment cost of 0 is the column default, so it is NOT calculated — and says why', () => {
  const p = computeReplacementCost({ employee: leaver({ recruitment_cost: 0 }), successor: successor() });
  const c = byKey(p);
  assert.strictEqual(c.recruitment.state, 'not_calculated');
  assert.strictEqual(c.recruitment.value, null);
  assert.match(c.recruitment.reason, /0/, 'the reason must name the value it found');
  assert.match(c.recruitment.reason, /default|unknown/);
});

test('CONTROL — a REAL zero is calculated, not missing: a replacement starting the day the seat emptied', () => {
  const p = computeReplacementCost({ employee: leaver({ end_date: '2026-10-12' }), successor: successor() });
  const c = byKey(p);
  assert.strictEqual(c.vacancy_cover.state, 'calculated');
  assert.strictEqual(c.vacancy_cover.inputs.vacancy_days, 0);
  assert.strictEqual(c.vacancy_cover.value, 0, 'a zero-day vacancy is a reading, and it reads 0');
  assert.strictEqual(p.total.state, 'calculated', 'no component is missing, so the total is complete');
});

test('a replacement whose start precedes the departure is not read as a negative window', () => {
  const p = computeReplacementCost({ employee: leaver(), successor: successor({ start_date: '2026-09-01' }) });
  const c = byKey(p);
  assert.strictEqual(c.vacancy_cover.state, 'not_calculated');
  assert.match(c.vacancy_cover.reason, /not after/);
});

test('no salary recorded: the priced components say the day cannot be priced', () => {
  const p = computeReplacementCost({
    employee: leaver({ salary: 0, total_salary: 0 }), successor: successor(),
  });
  const c = byKey(p);
  assert.strictEqual(c.vacancy_cover.state, 'not_calculated');
  assert.match(c.vacancy_cover.reason, /no total salary/);
  assert.strictEqual(c.onboarding_ramp.state, 'not_calculated');
});

test('every rate a component uses is published in the assumptions — nothing is hidden in the arithmetic', () => {
  const p = computeReplacementCost({ employee: leaver(), successor: successor() });
  const published = new Set(p.assumptions.map((a) => a.key));
  for (const comp of p.components) {
    if (comp.state !== 'calculated') continue;
    if (comp.inputs.rate_key) {
      assert.ok(published.has(comp.inputs.rate_key), `${comp.key} uses an unpublished rate ${comp.inputs.rate_key}`);
    }
  }
  assert.strictEqual(p.assumptions.length, ASSUMPTIONS.length);
  for (const a of p.assumptions) {
    assert.match(a.basis, /ASSUMPTION, not a measurement/, `${a.key} must say on the surface that it is an assumption`);
  }
});

test('the currency comes from the record, and an unknown jurisdiction leaves it unknown rather than guessing', () => {
  assert.strictEqual(computeReplacementCost({ employee: leaver(), successor: successor() }).currency, 'AED');
  assert.strictEqual(computeReplacementCost({ employee: leaver({ data_residency_country: 'SA' }), successor: successor() }).currency, 'SAR');
  assert.strictEqual(computeReplacementCost({ employee: leaver({ data_residency_country: null }), successor: successor() }).currency, null);
});

test('the replacement is named in the payload, with the derivation a reader can disagree with', () => {
  const p = computeReplacementCost({ employee: leaver(), successor: successor(), asOf: '2026-10-22' });
  assert.strictEqual(p.window.replacement.employee_id, 'emp-2');
  assert.strictEqual(p.window.replacement.start_date, '2026-10-12');
  assert.match(p.window.replacement.basis, /same department and role/);
  assert.strictEqual(p.as_of, '2026-10-22');
});

test('the trigger is read from the record: a termination flag, and nothing invented when there is none', () => {
  assert.strictEqual(triggerOf(leaver()).key, 'termination_flag');
  assert.match(triggerOf(leaver()).detail, /offboarding/);
  assert.strictEqual(triggerOf(leaver({ status: 'terminated' })).key, 'termination_flag');
  assert.strictEqual(triggerOf(leaver({ status: 'active', end_date: null, termination_type: 'resignation' })).key, 'termination_flag');
  assert.strictEqual(triggerOf(leaver({ status: 'active', end_date: null })), null, 'an active employee has no flag');
  assert.strictEqual(computeReplacementCost({ employee: leaver({ status: 'active', end_date: null }), successor: successor() }).trigger, null);
});

test('daysBetween reads date parts only: a time of day cannot move a day count', () => {
  assert.strictEqual(daysBetween('2026-09-30', '2026-10-12'), 12);
  assert.strictEqual(daysBetween('2026-09-30T23:59:00Z', '2026-10-12T00:01:00Z'), 12);
  assert.strictEqual(daysBetween('not-a-date', '2026-10-12'), null);
});
