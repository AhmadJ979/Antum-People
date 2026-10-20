/**
 * What a screen keeps when one of its panels is refused — row bd008d23.
 *
 * The test that matters here is the PAIR: a refused panel beside a granted one must leave the granted
 * panel's data on the screen, AND the refusal must be visible. A test that only proved "the refusal is
 * shown" would be green while a valid roster was being thrown away — which is the defect, not the fix.
 *
 * THE CONTROL, run for real below: the same outcomes put through the OLD shape (one `Promise.all`, so a
 * single rejection decides the whole screen) blank the granted panel. If `settlePanels` ever regressed to
 * that shape, `test 1`'s assertion on `data.employees` reddens — the check is capable of failing.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';

import {
  GRANTED, REFUSED, FAILED,
  callPanel, recordPanel, settlePanels, panelLabelOf, refusalNoticeFor,
} from './panelResults.js';
import { RefusalError, SessionExpiredError } from './httpStatus.js';

const EMPLOYEES_URL = '/api/employees?jurisdiction=AE';
const ANALYTICS_URL = '/api/analytics/dashboard?jurisdiction=AE';

/** A response whose body is `value`, as the fetch would hand it over. */
const okBody = (value) => ({ json: async () => value });

/** The roster as the screen expects it — the granted value that must survive. */
const ROSTER = [{ id: 'e-1', first_name: 'Layla' }, { id: 'e-2', first_name: 'Omar' }];

/** The outcomes of one screen load: the roster granted, the dashboard figures refused. */
const outcomes = () => [
  callPanel('employees', EMPLOYEES_URL, Promise.resolve(okBody(ROSTER))),
  callPanel('analytics', ANALYTICS_URL, Promise.reject(new RefusalError(ANALYTICS_URL, 403))),
];

/** The OLD shape, kept in the test on purpose: one rejection decides the whole screen. */
function settleLikeOnePromiseAll(records) {
  return records.some((r) => r.status !== GRANTED) ? { data: {}, refusals: [], failures: [] } : { data: records.reduce((a, r) => (a[r.name] = r.value, a), {}), refusals: [], failures: [] };
}

describe('one screen, several panels: a refused sibling does not blank a granted one', () => {
  test('the granted roster stays AND the refusal is recorded against its own url', async () => {
    const { data, refusals, failures } = settlePanels(await Promise.all(outcomes()));

    assert.deepStrictEqual(data.employees, ROSTER,
      'the roster is granted, so it is on the screen — a refused sibling must not take it down');
    assert.strictEqual(data.analytics, undefined, 'and the refused panel contributes no data');
    assert.deepStrictEqual(refusals, [{ name: 'analytics', url: ANALYTICS_URL }],
      'the refusal is carried with the url, which is what lets the notice name the panel');
    assert.deepStrictEqual(failures, []);
  });

  test('CONTROL — under the old one-Promise.all shape the granted roster IS blanked', async () => {
    const records = await Promise.all(outcomes());
    const old = settleLikeOnePromiseAll(records);
    const now = settlePanels(records);

    assert.strictEqual(old.data.employees, undefined,
      'this is the defect: one refused panel and the granted roster is gone from the screen');
    assert.notDeepStrictEqual(now.data, old.data,
      'and the module must NOT behave that way — if it ever does, the assertion above reddens');
    assert.deepStrictEqual(now.data.employees, ROSTER);
  });

  test('a panel that never completed is a failure, not a refusal, and blanks only itself', async () => {
    const records = await Promise.all([
      callPanel('employees', EMPLOYEES_URL, Promise.resolve(okBody(ROSTER))),
      callPanel('analytics', ANALYTICS_URL, Promise.reject(new Error('offline'))),
      // and a response that was not JSON at all — the third failure the design document measures
      callPanel('onboarding', '/api/employees/e-1/onboarding', Promise.resolve({ json: async () => { throw new SyntaxError('not json'); } })),
    ]);
    const settled = settlePanels(records);

    assert.deepStrictEqual(settled.data.employees, ROSTER, 'the granted panel is untouched by either');
    assert.deepStrictEqual(settled.refusals, [], 'neither of these is a refusal: nobody refused anything');
    assert.deepStrictEqual(settled.failures.map((f) => f.name), ['analytics', 'onboarding'],
      'both are recorded as failures, by name and url');
    assert.strictEqual(records[2].status, FAILED);
  });

  test('a dead session is re-thrown, never recorded as a panel outcome', async () => {
    // The session decision belongs to the shipped classifier. If this module swallowed it, a dead
    // session would render as "one panel failed" and the user would never be told to sign in.
    await assert.rejects(
      () => callPanel('employees', EMPLOYEES_URL, Promise.reject(new SessionExpiredError(403))),
      (err) => err instanceof SessionExpiredError,
      'a session error must leave the screen, not be filed as a panel result'
    );
    // and the same for the shipped 401 contract: the factory RETURNS the response (it does not throw),
    // so the module is the thing that must refuse to file it as a loaded panel.
    await assert.rejects(
      () => callPanel('employees', EMPLOYEES_URL, Promise.resolve({ status: 401, json: async () => ({ error: 'Authentication token required' }) })),
      (err) => err instanceof SessionExpiredError,
      'a 401 must not be recorded as a granted panel just because the factory handed the response back'
    );
  });

  test('the refusal names the panel it belongs to, from the url onRefusal already receives', () => {
    const notice = refusalNoticeFor(ANALYTICS_URL);
    assert.ok(/the dashboard figures/.test(notice), notice);
    assert.ok(/still signed in/.test(notice), 'the reassuring half of the shipped sentence is kept');
    assert.ok(!/\/api\//.test(notice), 'and a person is never shown a url');

    assert.strictEqual(panelLabelOf(EMPLOYEES_URL), 'the roster');
    assert.strictEqual(panelLabelOf('/api/employees/e-1/onboarding'), 'the onboarding tasks');
    assert.strictEqual(panelLabelOf('/api/employees/e-1/offboarding'), 'the offboarding tasks');
    assert.strictEqual(refusalNoticeFor('/api/unknown'), "You don't have access to that. Nothing was changed, and you are still signed in.",
      'an unknown url falls back to the shipped sentence word for word');
  });

  test('recordPanel tags by the error class, never by reading the body', () => {
    assert.strictEqual(recordPanel('x', '/u', { value: 1 }).status, GRANTED);
    assert.strictEqual(recordPanel('x', '/u', { error: new RefusalError('/u', 403) }).status, REFUSED);
    // an error that merely LOOKS like the refusal (same message, different class) is not one:
    const impostor = new Error('refused: /u (HTTP 403)');
    assert.strictEqual(recordPanel('x', '/u', { error: impostor }).status, FAILED);
  });
});
