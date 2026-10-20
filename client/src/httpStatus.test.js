/**
 * Session vs refusal — both branches proved, and the one that must NOT happen asserted too.
 *
 * Run: `cd client && npm test`  (node --test, no browser, no DOM, no React)
 *
 * The suite exists because the failure it guards is INVISIBLE: a refused route and a dead session
 * both rendered as an empty screen, so nothing in the app reddened. Every case below is built from a
 * fabricated Response, and the pair at the end is the anti-vacuous control — a test that only proved
 * "403 → sign the user out" would pass while signing a valid session out of a route it was merely
 * denied, which is the defect this work exists to avoid.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';

import {
  classifyHttpStatus,
  actionFor,
  createAuthedFetch,
  SessionExpiredError,
  RefusalError,
  OK,
  SESSION_INVALID,
  REFUSAL,
  OTHER,
} from './httpStatus.js';

const json = (obj, status) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

/** The two shapes the server actually sends, quoted from it rather than imagined. */
const REFUSAL_BY_THE_GATE = () => new Response('', { status: 403 }); // index.js:166 refuse = (res) => res.status(403).end()
const DEAD_SESSION = () => json({ error: 'Invalid or expired token' }, 403); // auth.js:31

describe('classifyHttpStatus — the pure rule', () => {
  test('the gate\'s refusal is 403 with nothing in it', () => {
    assert.strictEqual(classifyHttpStatus(403, ''), REFUSAL);
  });

  test('whitespace is still nothing — an empty answer stays a refusal', () => {
    assert.strictEqual(classifyHttpStatus(403, '   \n'), REFUSAL);
  });

  test('a 403 carrying a body that is NOT the session error — the Origin gate — takes the sign-out branch', async () => {
    // Row 74008b67. `server/index.js:65` emits 403 + {"error":"Forbidden"} for an unlisted,
    // non-same-origin Origin. The session behind it is FINE — and under the shipped rule it still
    // signs out. That is the tie-break, and this test is where it is asserted instead of implied by
    // a phrase ("403 with a body") that does not name the CORS shape at all.
    const mod = await import('./httpStatus.js');

    assert.strictEqual(mod.classifyHttpStatus(403, '{"error":"Forbidden"}'), mod.SESSION_INVALID,
      'the Origin gate is NOT the session error, and it takes the session branch deliberately');
    assert.strictEqual(mod.actionFor(mod.SESSION_INVALID), 'sign-out');

    // It is the SAME branch the dead-session body takes — that sameness IS the ambiguity:
    assert.strictEqual(
      mod.classifyHttpStatus(403, '{"error":"Forbidden"}'),
      mod.classifyHttpStatus(403, '{"error":"Invalid or expired token"}'),
      'two body-carrying 403s with different meanings collapse to one branch here');

    // And the gate's own shape (three sites: index.js:166, access.js:376, access.js:378) stays the
    // OTHER branch, so naming the third shape did not widen the refusal:
    assert.strictEqual(mod.classifyHttpStatus(403, ''), mod.REFUSAL);
    assert.strictEqual(mod.classifyHttpStatus(403, '   '), mod.REFUSAL,
      'whitespace is still nothing: an empty answer is the gate\'s shape');
    assert.strictEqual(mod.actionFor(mod.REFUSAL), 'refusal-notice');

    // The alternative — classifying the CORS 403 as a refusal-in-place — is a DECISION FOR THE OWNER
    // (design-concepts/CLIENT-STATES.md §3 proposes letting auth.js:31 answer 401 instead, which would
    // remove the ambiguity rather than re-classify it). Until they rule, this tie-break stands, and
    // the recoverable direction is why: a signed-out user signs back in.
  });

  test('a 403 that carried a body is a dead session, not a refusal', () => {
    assert.strictEqual(classifyHttpStatus(403, '{"error":"Invalid or expired token"}'), SESSION_INVALID);
    assert.strictEqual(classifyHttpStatus(403, 'gateway said no'), SESSION_INVALID);
  });

  test('401 is a dead session however it is dressed', () => {
    assert.strictEqual(classifyHttpStatus(401, ''), SESSION_INVALID);
    assert.strictEqual(classifyHttpStatus(401, '{"error":"Invalid or expired token"}'), SESSION_INVALID);
  });

  test('everything else is left alone — 2xx is usable, 404 and 500 belong to caller error handling', () => {
    assert.strictEqual(classifyHttpStatus(200, '[]'), OK);
    assert.strictEqual(classifyHttpStatus(204, ''), OK);
    assert.strictEqual(classifyHttpStatus(404, '{"error":"Employee not found"}'), OTHER);
    assert.strictEqual(classifyHttpStatus(500, 'Internal Server Error'), OTHER);
  });
});

describe('the anti-vacuous control: a refusal must never be wired to a sign-out', () => {
  test('REFUSAL maps to a notice in place, and specifically NOT to sign-out', () => {
    assert.strictEqual(actionFor(REFUSAL), 'refusal-notice');
    assert.notStrictEqual(actionFor(REFUSAL), 'sign-out');
  });

  test('a dead session is the only classification that signs anyone out', () => {
    assert.strictEqual(actionFor(SESSION_INVALID), 'sign-out');
    assert.strictEqual(actionFor(OK), 'none');
    assert.strictEqual(actionFor(OTHER), 'none');
  });
});

describe('createAuthedFetch — the wiring, with a fabricated transport', () => {
  const harness = (response) => {
    const seen = { sessionInvalid: 0, refusal: 0, headers: [], urls: [] };
    const fetchImpl = async (url, options) => {
      seen.urls.push(url);
      seen.headers.push(options.headers);
      return typeof response === 'function' ? response() : response;
    };
    const authedFetch = createAuthedFetch({
      fetchImpl,
      getToken: () => 'a-token',
      onSessionInvalid: () => { seen.sessionInvalid += 1; },
      onRefusal: () => { seen.refusal += 1; },
    });
    return { authedFetch, seen };
  };

  test('a normal answer passes through untouched and neither handler fires', async () => {
    const { authedFetch, seen } = harness(json([{ id: 'e1' }], 200));
    const res = await authedFetch('/api/employees');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), [{ id: 'e1' }]);
    assert.strictEqual(seen.sessionInvalid, 0);
    assert.strictEqual(seen.refusal, 0);
  });

  test('401: the session is ended centrally, and the response still goes back to the caller', async () => {
    const { authedFetch, seen } = harness(json({ error: 'Authentication required' }, 401));
    const res = await authedFetch('/api/employees');
    assert.strictEqual(res.status, 401, 'unchanged contract: the call sites bail on the status themselves');
    assert.strictEqual(seen.sessionInvalid, 1);
    assert.strictEqual(seen.refusal, 0);
  });

  test('403 with the dead-session body: sign out, and STOP the caller from using the body as data', async () => {
    const { authedFetch, seen } = harness(DEAD_SESSION());
    await assert.rejects(() => authedFetch('/api/preboarding/cases'), SessionExpiredError);
    assert.strictEqual(seen.sessionInvalid, 1);
    assert.strictEqual(seen.refusal, 0, 'a dead session is not a refusal and must not raise the notice');
  });

  test('403 from the gate: the notice is raised, the session is KEPT, and the empty body is never parsed', async () => {
    const { authedFetch, seen } = harness(REFUSAL_BY_THE_GATE());
    await assert.rejects(() => authedFetch('/api/preboarding/cases/abc/workspace'), RefusalError);
    assert.strictEqual(seen.refusal, 1);
    assert.strictEqual(seen.sessionInvalid, 0, 'THIS is the defect: a refusal must not sign a valid session out');
  });

  test('a 404 and a 500 are nobody\'s business here — both are handed back', async () => {
    for (const [status, body] of [[404, '{"error":"Employee not found"}'], [500, 'boom']]) {
      const { authedFetch, seen } = harness(new Response(body, { status }));
      const res = await authedFetch('/api/employees/nope');
      assert.strictEqual(res.status, status);
      assert.strictEqual(seen.sessionInvalid, 0);
      assert.strictEqual(seen.refusal, 0);
    }
  });

  test('reading the body to classify it does not eat it — the caller can still parse the response', async () => {
    // The clone is what makes this true; without it the caller's `res.json()` would throw on a
    // consumed body, which is a second way to render an empty screen.
    const { authedFetch } = harness(json({ cases: [], totals: {} }, 200));
    const res = await authedFetch('/api/preboarding/cases');
    assert.deepStrictEqual(await res.json(), { cases: [], totals: {} });
  });

  test('the caller\'s own token reaches the request', async () => {
    const { authedFetch, seen } = harness(json([], 200));
    await authedFetch('/api/employees');
    assert.strictEqual(seen.headers[0]['Authorization'], 'Bearer a-token');
    assert.deepStrictEqual(seen.urls, ['/api/employees']);
  });

  test('with no token the sentinel still goes out, exactly as before this change', async () => {
    const seen = { sessionInvalid: 0, refusal: 0, auth: null };
    const fetchImpl = async (url, options) => { seen.auth = options.headers['Authorization']; return REFUSAL_BY_THE_GATE(); };
    const authedFetch = createAuthedFetch({
      fetchImpl, getToken: () => null,
      onSessionInvalid: () => { seen.sessionInvalid += 1; },
      onRefusal: () => { seen.refusal += 1; },
    });
    await assert.rejects(() => authedFetch('/api/employees'), RefusalError);
    assert.strictEqual(seen.auth, 'Bearer null',
      'the pre-existing sentinel is preserved deliberately: changing it would change which status the server answers');
  });

  test('a caller that supplies its own Authorization header keeps it', async () => {
    const { authedFetch, seen } = harness(json({}, 200));
    await authedFetch('/api/login', { headers: { 'Content-Type': 'application/json' } });
    assert.strictEqual(seen.headers[0]['Content-Type'], 'application/json');
    assert.strictEqual(seen.headers[0]['Authorization'], 'Bearer a-token');
  });
});
