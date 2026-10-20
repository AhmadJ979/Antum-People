/**
 * Session vs refusal — one classification, for every authenticated call in the app.
 *
 * WHY THIS EXISTS (row d2328d67, re-grounded by row 74008b67). After Layer 3 slice 2 shipped,
 * answers with DIFFERENT meanings arrive on the same status code, and the client treated only 401.
 *
 * EVERY 403 THE SERVER CAN EMIT, by emission site — five sites, three shapes. Measured at 8ec9f69 by
 * `grep -rn "403" server/*.js` minus comments (an independent count reported five producers, two of
 * them body-carrying; that count and this one are THE SAME SET, counted by site rather than by shape):
 *
 *   1. `server/auth.js:31` — `403` + `{"error":"Invalid or expired token"}`. A session existed and is
 *      over. This is what every browser holding a pre-cutover token receives, because the claim moved
 *      from `role` to `access_role`.
 *   2. `server/index.js:65` — the Origin gate: `403` + `{"error":"Forbidden"}`. **A refusal, and the
 *      session is fine** — reachable when a browser presents an unlisted, non-same-origin `Origin`
 *      (the decision order is at `index.js:35-41`).
 *   3. `server/index.js:166` — `refuse = (res) => res.status(403).end()`.
 *   4. `server/access.js:376` — `res.status(403).end()`.
 *   5. `server/access.js:378` — `res.status(403).end()`.
 *      Sites 3-5 are ONE shape: the policy gate's refusal, its emptiness deliberate so a scoped
 *      caller learns nothing about what exists. A VALID session produced them.
 *
 * Five producers therefore carry TWO meanings across two body-carrying answers, and any rule phrased
 * "403 with a body means the session expired" is FALSE as stated. The rule below is stated over the
 * shapes this module actually decides, and each shape names where it comes from:
 *
 *   * `401` — dead session. Unchanged by this row, and the `Bearer null` sentinel is unchanged too.
 *   * `403` + ANY body → SESSION_INVALID → sign out. BOTH body-carrying sites take this branch
 *     (`auth.js:31` and the Origin gate). For the Origin gate that signs out a user whose session was
 *     fine, and that is a DELIBERATE tie-break, not an oversight: signing out is the recoverable
 *     mistake (a signed-out user signs back in), while a user stuck behind a refusal they cannot
 *     clear cannot recover from the UI at all. It is also the case least likely to reach a person —
 *     a page refused by the Origin gate usually could not load its own bundle either, so there is no
 *     working screen to blank (`index.js:31-33`).
 *   * `403` + EMPTY body → REFUSAL → notice in place, session kept. Sites 3-5.
 *
 * WHAT THIS MODULE DOES NOT DECIDE (it is the owner's, and it is stated rather than implemented):
 * `design-concepts/CLIENT-STATES.md` §3 argues the honest fix is one line on the server — let
 * `auth.js:31` answer `401`, so that every remaining 403 means exactly one thing ("refused") and no
 * inference is needed at all. That is a change to what the server puts on the wire, so it belongs to
 * the owner. Until they rule, the tie-break above stands here and is asserted by its own test
 * (`a 403 carrying a body that is NOT the session error — the Origin gate — takes the sign-out branch`),
 * so it is a decision on the record instead of a default nobody looked at.
 *
 * RECONCILED AGAIN against `design-concepts/CLIENT-STATES.md` §4, which measures the same five sites and
 * finds the empty ones, like this module, indistinguishable TO THE CLIENT: sites 3-5 are one client-visible
 * shape but THREE different server-side meanings — `access.js:376` (the resource is unnamed, or nobody may
 * use it), `access.js:378` (the caller's `access_role` is not in the resource's list) and `index.js:166`
 * (the per-row scope refusal). The client must not try to tell them apart, and their emptiness is
 * load-bearing (`access.js:19`: "a refusal is `403` with no body — the caller is told nothing about what
 * exists"). So the two counts never disagreed about the SET — five producers, three client-visible shapes —
 * and the useful part is that neither count alone is the whole truth: the site count hides that two of the
 * five carry different meanings, and the shape count hides that three sites have three meanings the client
 * must collapse.
 *
 * THE CORS 403'S REACH, stated so the tie-break is not over-sold: for the served product the Origin gate's
 * same-host branch (`index.js:60`) lets the app's own pages through, so that path is dead there; it is LIVE
 * for a foreign origin — exactly the scratch topology with the client on `:5173` and the API on `:3000`
 * (`App.tsx:11`). That is where the sign-out can repeat instead of happening once, and it is the strongest
 * argument for the server-side option rather than for a fourth branch in this file.
 *
 * IF `auth.js:31` IS MOVED TO `401` (the designer's option A, the owner's to rule on), that is a change to
 * what the server PUTS ON THE WIRE — a served behaviour change owing a movement, not a docs fix — and these
 * two branches would then need no inference at all: every remaining 403 would mean "refused".
 *
 * The body is read from a CLONE, so the caller's own `res.json()` still works.
 *
 * This module is plain ES module JavaScript with no DOM and no React: `client/src/httpStatus.test.js`
 * drives it under `node --test` with fabricated responses, so both branches — and the fact that a
 * refusal does NOT sign anyone out — are asserted rather than assumed.
 */

/** A response that may be used. */
export const OK = 'ok';
/** The session is dead (a 401, or a 403 that carried a body). The user must sign in again. */
export const SESSION_INVALID = 'session-invalid';
/** The policy gate refused this resource. The session is VALID; the caller keeps it. */
export const REFUSAL = 'refusal';
/** Anything else — a 404, a 500. Not this module's business: caller error handling owns it. */
export const OTHER = 'other';

/** What has to HAPPEN for a classification. A table, so the pairing is assertable. */
export function actionFor(kind) {
  switch (kind) {
    case SESSION_INVALID:
      return 'sign-out';
    case REFUSAL:
      return 'refusal-notice';
    default:
      return 'none';
  }
}

/**
 * Classify a status and its raw body text. Pure: no fetch, no state, no DOM.
 *
 * `bodyText` is the body as text ('' when there is none). A body of only whitespace counts as no
 * body — an empty answer is the gate's shape, and this keeps that true if a proxy ever pads it.
 */
export function classifyHttpStatus(status, bodyText) {
  const hasBody = typeof bodyText === 'string' && bodyText.trim() !== '';
  if (status === 401) return SESSION_INVALID;
  if (status === 403) return hasBody ? SESSION_INVALID : REFUSAL;
  if (status >= 200 && status < 300) return OK;
  return OTHER;
}

/** Thrown when the session is dead, so a caller stops parsing rather than using the error body as data. */
export class SessionExpiredError extends Error {
  constructor(status) {
    super(`session ended (HTTP ${status})`);
    this.name = 'SessionExpiredError';
    this.status = status;
  }
}

/** Thrown when the gate refused, so a caller stops parsing an empty body. The session is untouched. */
export class RefusalError extends Error {
  constructor(url, status) {
    super(`refused: ${url} (HTTP ${status})`);
    this.name = 'RefusalError';
    this.status = status;
    this.url = url;
  }
}

/** The body as text, read from a clone so the caller can still read the original. Never throws. */
async function bodyTextOf(res) {
  try {
    return await res.clone().text();
  } catch {
    return '';
  }
}

/**
 * Build the app's authenticated fetch.
 *
 * It is a FACTORY rather than a bare function so the whole wiring — which status produces which
 * action — is testable without a browser: hand it a fake `fetchImpl` and two recorders and assert
 * what happened.
 *
 * Contract, one line per status:
 *   * 2xx/3xx/404/5xx → the response is returned unchanged. Caller error handling owns it.
 *   * 401             → `onSessionInvalid()`, response returned. Every call site already bails on
 *                       401, so this is the same contract as before — and now it is guaranteed
 *                       centrally rather than by 21 separate checks.
 *   * 403 + body      → `onSessionInvalid()`, then `SessionExpiredError` is thrown: the body is an
 *                       error payload, not data, and the caller must not use it.
 *   * 403 empty       → `onRefusal()`, then `RefusalError` is thrown. **The session is not touched.**
 */
export function createAuthedFetch({ fetchImpl, getToken, onSessionInvalid, onRefusal }) {
  return async function authedFetch(url, options = {}) {
    const res = await fetchImpl(url, {
      ...options,
      headers: {
        ...options.headers,
        // Unchanged from the call it replaces, sentinel and all: a null token still goes out as
        // `Bearer null`, which the server answers as a dead session — the honest outcome for a
        // caller that should have returned early, and not this change's business to alter.
        'Authorization': `Bearer ${getToken()}`,
      },
    });

    if (res.status !== 401 && res.status !== 403) return res;

    const kind = classifyHttpStatus(res.status, await bodyTextOf(res));
    const action = actionFor(kind);
    if (action === 'sign-out') {
      if (onSessionInvalid) onSessionInvalid(res.status);
      // A 401 keeps its old contract: the response goes back and the call site's own check (which
      // every one of them has) decides. A 403 with a body does not — nothing else would stop the
      // caller from parsing an error payload as data.
      if (res.status === 403) throw new SessionExpiredError(res.status);
      return res;
    }
    if (action === 'refusal-notice') {
      if (onRefusal) onRefusal(url, res.status);
      throw new RefusalError(url, res.status);
    }
    return res;
  };
}
