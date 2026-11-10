/**
 * THE SETTLEMENT STATEMENT MAY NOT DEDUCT FROM THE GRATUITY, AND MAY NOT CLAIM A TRAFFIC FINE.
 * -------------------------------------------------------------------------------------------
 * Two owner rulings of 2026-11-10, and the two tests here exist to REDDEN if either is undone:
 *
 *   1. THE EOSB SET-OFF ENDS. The end-of-service benefit is its own entitlement line and is never
 *      reduced by a deduction. Deductions may only come out of the wage-derived dues and may not
 *      exceed them, so `net = EOSB + (wage-derived dues − deductions)`.
 *   2. THE TRAFFIC-FINE ROW IS GONE. A fine is owed to the police, not to the employer, so it is not
 *      the employer's to deduct and the statement may not name it as one.
 *
 * Both are asserted against what a reader receives — the module the route calls and the template
 * bytes the route renders — not against a description of them.
 *
 * The withholding is asserted too, because these tests must not be able to pass by making the
 * statement ISSUE: a settlement with no deduction recorded and no leave/notice/ticket amounts held
 * has no net, and the route refuses it. An arithmetic that produced a net from absent inputs would
 * turn a refusal into a document.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const compliance = require('./compliance_engine');

const TEMPLATE = path.join(__dirname, '..', 'templates', 'final-settlement-statement.md');
const templateText = () => fs.readFileSync(TEMPLATE, 'utf8');

/** Every entitlement line held, so the wage-derived subtotal exists and the split can be judged. */
const HELD = Object.freeze({
  eosb_amount: '10000.00',
  final_pro_rated_salary: '3000.00',
  unused_leave_amount: '500.00',
  notice_pay: '0.00',
  ticket_allowance: '0.00',
  other_payments: '0.00'
});
// 3000 + 500 + 0 + 0 + 0
const WAGE_DUES = 3500;
const EOSB = 10000;

test('a deduction never touches the EOSB line, whatever it comes to', () => {
  // The whole range: nothing deducted, a partial deduction, one cent under the dues, exactly the
  // dues, one cent over, and far over. The last two are the ones a set-off would show on: with a
  // single-pool net (`gross − deductions`) the net falls below the EOSB and the gratuity pays the
  // excess. It may not.
  for (const total_deductions of ['0.00', '1000.00', '3499.99', '3500.00', '3500.01', '90000.00']) {
    const r = compliance.settlementArithmetic({ ...HELD, total_deductions });
    const label = `deductions ${total_deductions}`;

    assert.strictEqual(r.eosb_amount, EOSB.toFixed(2), `${label}: the EOSB line is not reduced`);
    assert.strictEqual(r.wage_derived_dues, WAGE_DUES.toFixed(2), `${label}: the dues are their own line`);

    const applied = Number(r.total_deductions);
    assert.ok(Number.isFinite(applied), `${label}: a deduction total was produced`);
    assert.ok(applied <= WAGE_DUES,
      `${label}: a deduction may not exceed the wage-derived dues (applied ${r.total_deductions})`);

    assert.strictEqual(r.net_settlement, (EOSB + (WAGE_DUES - applied)).toFixed(2),
      `${label}: net = EOSB + (wage-derived dues − deductions)`);
    assert.ok(Number(r.net_settlement) >= EOSB,
      `${label}: the net may never fall below the EOSB (got ${r.net_settlement})`);
  }

  // At the cap the deduction has taken everything it may and the gratuity is still whole.
  const atCap = compliance.settlementArithmetic({ ...HELD, total_deductions: WAGE_DUES.toFixed(2) });
  assert.strictEqual(atCap.net_settlement, EOSB.toFixed(2),
    'deductions equal to the dues leave exactly the EOSB payable');

  // Over the cap, the excess is NAMED rather than absorbed — neither taken from the EOSB nor
  // quietly dropped, which would understate what is owed.
  const over = compliance.settlementArithmetic({ ...HELD, total_deductions: '90000.00' });
  assert.strictEqual(over.deductions_not_applied, (90000 - WAGE_DUES).toFixed(2),
    'the part of a deduction that exceeds the dues is reported, never recovered from the EOSB');

  // AND IT CANNOT MAKE THE STATEMENT ISSUE. With the dues or the deduction unheld there is no net:
  // the renderer then reports the fact as missing and the route withholds the document. A net made
  // out of absent inputs is how a refusal would become a document.
  const noDeduction = compliance.settlementArithmetic({ ...HELD, total_deductions: undefined });
  assert.strictEqual(noDeduction.net_settlement, undefined,
    'no deduction recorded means no net — not a net equal to the gross');
  const noDues = compliance.settlementArithmetic({
    eosb_amount: HELD.eosb_amount, total_deductions: '100.00'
  });
  assert.strictEqual(noDues.net_settlement, undefined,
    'a wage-derived subtotal that is not held cannot produce a net');
  assert.strictEqual(noDues.total_deductions, undefined,
    'and no deduction can be applied against dues that are not held');
});

test('the traffic-fine row cannot reappear on the statement', () => {
  const template = templateText();

  assert.strictEqual(template.indexOf('[fine_deduction]'), -1,
    'the statement carries no [fine_deduction] placeholder');
  assert.strictEqual(/traffic\s*fines?/i.test(template), false,
    'the statement names no traffic fine in English');
  assert.strictEqual(template.indexOf('مخالفات مرورية'), -1,
    'the statement names no traffic fine in Arabic');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(compliance.REQUIRED_FACTS, 'fine_deduction'), false,
    'a traffic-fine deduction is not a fact the engine asks a record for');

  // The renderer is the second door: a caller that still passes the fact must not get it onto the
  // document. (A placeholder left in the template would put the value there, so this is the same
  // assertion as the first one seen from the serving side.)
  const rendered = compliance.renderTemplate(template, { fine_deduction: '250.00' });
  assert.strictEqual(rendered.content.indexOf('250.00'), -1,
    'a passed traffic-fine amount reaches no cell of the document');
  assert.strictEqual(rendered.missing.indexOf('traffic fine deduction'), -1,
    'and the refusal does not ask a reader to record one');

  // The deduction table is still a deduction table: the rows that ARE the employer's to take stay,
  // so this cannot pass by deleting the section.
  assert.ok(template.indexOf('[loan_deduction]') !== -1, 'outstanding loans remain a deduction line');
  assert.ok(template.indexOf('[assets_deduction]') !== -1, 'unreturned assets remain a deduction line');
  assert.ok(template.indexOf('[total_deductions]') !== -1, 'and the deductions still total');
});
