/**
 * One screen, several panels, and what each panel KEEPS — row bd008d23 ("a refused sibling still blanks a
 * granted screen").
 *
 * THE DEFECT THIS EXISTS TO KILL. `fetchData`/`fetchTasks` in App.tsx fetched a screen's panels inside ONE
 * `Promise.all`. `createAuthedFetch` (see `httpStatus.js`) THROWS on a refusal, so one refused panel
 * rejected the whole pair and the granted panel's data was discarded: the roster rendered empty beneath a
 * notice reading "You don't have access to that", which to a reader is indistinguishable from the product
 * having lost the data. The refusal was visible; the granted data was not. Both must survive together.
 *
 * The rule, stated so it can be argued with: **a panel's outcome decides only that panel.** A refusal (or a
 * failure) removes that panel's data from the screen and is recorded against the url it came from,
 * and NOTHING it does can take a sibling's granted value away.
 *
 * `design-concepts/CLIENT-STATES.md` §3 names this as the fifth state and recommends shape (b) — the
 * refusal shown in place, against the panel it belongs to, which is why the url is carried here rather
 * than dropped: `onRefusal` already receives it and the state used to throw it away.
 *
 * This module is plain ES module JavaScript with no DOM, no React and no network: the network outcome
 * arrives as a promise and a tagged record leaves. That is what lets `panelResults.test.js` assert the
 * granted-and-refused pair — and REDDEN when the sibling rejection is allowed to blank the granted panel —
 * under `node --test`.
 */
import { SessionExpiredError } from './httpStatus.js';

/** The panel's data arrived. */
export const GRANTED = 'granted';
/** The policy gate refused this panel. The session is fine (`httpStatus.js` — a 403 with an empty body). */
export const REFUSED = 'refused';
/** The request never completed: offline, a dead server, or an answer that was not JSON. */
export const FAILED = 'failed';

/**
 * Turn one panel's outcome into a record: a fulfilled value, a refusal, or a failure.
 *
 * A refusal is recognised by the error the classifier throws, never by reading the body's text: matching a
 * human sentence is the copy-drift structure this product has a name for (CLIENT-STATES.md §3). A session
 * error is NOT a panel outcome at all — it is re-thrown by `callPanel` below, because ending a session is
 * not something one panel may decide.
 */
/** @returns {{name: string, url: string, status: string, value?: any, error?: any}} */
export function recordPanel(name, url, { value, error } = {}) {
  if (error) {
    return { name, url, status: error.name === 'RefusalError' ? REFUSED : FAILED, error };
  }
  return { name, url, status: GRANTED, value };
}

/**
 * Wait for ONE panel's call and record what happened, so a rejection cannot travel to its siblings.
 * A session error is re-thrown on purpose: the shipped classification owns that decision, and this
 * module must not swallow it.
 */
/**
 * @returns {Promise<{name: string, url: string, status: string, value?: any, error?: any}>}
 */
export async function callPanel(name, url, promise) {
  let response;
  try {
    response = await promise;
  } catch (error) {
    if (error instanceof SessionExpiredError) throw error;
    return recordPanel(name, url, { error });
  }
  // A 401 keeps its shipped contract (the factory returns the response and has ALREADY ended the
  // session via onSessionInvalid), but this module must not file it as a granted panel: a panel that is
  // not usable contributes no data, and the screen must not render as though it had loaded.
  if (response && response.status === 401) throw new SessionExpiredError(401);

  try {
    return recordPanel(name, url, { value: await response.json() });
  } catch (error) {
    // A body that is not JSON is a FAILED panel, not a crash: the screen says it could not load.
    return recordPanel(name, url, { error });
  }
}

/**
 * What the screen keeps: the granted values, and the refusals/failures by url to say in place.
 * Every outcome is decided on its own; there is deliberately no early exit and no shared rejection path.
 */
/**
 * @param {Array<{name: string, url: string, status: string, value?: any, error?: any}>} records
 * @returns {{data: Record<string, any>, refusals: {name: string, url: string}[], failures: {name: string, url: string}[]}}
 */
export function settlePanels(records) {
  /** @type {Record<string, any>} */
  const data = {};
  const refusals = [];
  const failures = [];
  for (const record of records) {
    if (record.status === GRANTED) {
      data[record.name] = record.value;
    } else if (record.status === REFUSED) {
      refusals.push({ name: record.name, url: record.url });
    } else {
      failures.push({ name: record.name, url: record.url });
    }
  }
  return { data, refusals, failures };
}

/** What a panel is called to a person, from the url it was asked for. Never shows the url itself. */
export function panelLabelOf(url) {
  if (typeof url !== 'string') return 'that';
  // No route literal lives here on purpose. This module LABELS a panel; it does not call one, and a
  // client file that spells out an api path is read as a CALL SITE by the reachability check
  // (`server/reachability.test.js`: "no client call site names a route the product does not register"),
  // which then reports drift for a string nobody ever fetched. That check's premise is right and stays
  // as it is; the literal was mine and it is gone. The url's own last path segment is all this needs.
  const lastSegment = String(url).split('?')[0].split('/').filter(Boolean).pop() || '';
  if (lastSegment === 'dashboard') return 'the dashboard figures';
  if (lastSegment === 'onboarding') return 'the onboarding tasks';
  if (lastSegment === 'offboarding') return 'the offboarding tasks';
  if (lastSegment === 'employees') return 'the roster';
  return 'that';
}

/**
 * The refusal sentence for one url. The shipped promise is kept word for word — a signed-in person is told
 * what they may not see, that nothing changed and that they are still signed in — and the panel is named
 * so the notice points at the panel it belongs to instead of the whole screen.
 */
export function refusalNoticeFor(url, message) {
  const base = message === undefined
    ? "You don't have access to that. Nothing was changed, and you are still signed in."
    : message;
  const label = panelLabelOf(url);
  if (label === 'that') return base;
  return base.replace('to that.', `to ${label}.`);
}
