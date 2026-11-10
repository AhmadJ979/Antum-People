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

/**
 * What a panel is called to a person, from the url it was asked for. Never shows the url itself.
 *
 * `method` decides whether the notice names a READ or an ACT, and it has to: the same url is the
 * roster when it is read and the add-employee action when it is written, and naming the read for a
 * refusal of the write tells the reader they may not read what is on the screen behind the notice.
 * Measured 2026-11-10 as `finance` (which holds `employees:read` and not `employees:write`): pressing
 * "Create Employee Profile" raised "You don't have access to the roster." while the roster was
 * rendered underneath it. Defaults to `GET`, so a caller that names no method keeps the read label.
 */
export function panelLabelOf(url, method = 'GET') {
  if (typeof url !== 'string') return 'that';
  // No route literal lives here on purpose. This module LABELS a panel; it does not call one, and a
  // client file that spells out an api path is read as a CALL SITE by the reachability check
  // (`server/reachability.test.js`: "no client call site names a route the product does not register"),
  // which then reports drift for a string nobody ever fetched. That check's premise is right and stays
  // as it is; the literal was mine and it is gone. The url's own path segments are all this needs.
  const segments = String(url).split('?')[0].split('/').filter(Boolean);
  const last = segments[segments.length - 1] || '';
  const prev = segments[segments.length - 2] || '';
  const write = !/^(GET|HEAD)$/i.test(String(method || 'GET'));
  if (write) return actLabelOf(segments, last, prev);

  if (last === 'dashboard') return 'the dashboard figures';
  if (last === 'onboarding') return 'the onboarding tasks';
  if (last === 'offboarding') return 'the offboarding tasks';
  if (last === 'employees') return 'the roster';
  // The reads that used to fall back to "that": a pre-boarding case's own panels, the served
  // documents, the accounts and the probation reads. "You don't have access to that." is true and
  // useless — it does not tell the reader which panel was refused, so it cannot be acted on.
  if (last === 'checklist') return 'the pre-boarding checklist';
  if (last === 'package') return 'the pre-reading package';
  if (last === 'workspace') return 'the pre-boarding workspace';
  if (last === 'overview') return 'the pre-boarding roll-up';
  if (last === 'cases') return 'the pre-boarding cases';
  if (segments.indexOf('templates') !== -1) return 'that document';
  if (last === 'notice') return 'the privacy notice';
  if (last === 'users') return 'the accounts';
  if (last === 'escalations') return 'the escalation records';
  if (last === 'timelines') return 'the probation timelines';
  if (last === 'probation-evaluations') return 'the probation evaluations';
  return 'that';
}

/**
 * The ACT a refused write was asking for, named from the url's own segments. A write is not a read:
 * "the roster" for a refused `POST` says the reader may not see a screen they are looking at, and
 * "that" says nothing at all. Every phrase below reads after "You don't have access to ___", so the
 * one shipped sentence carries both kinds and no new reassurance copy is introduced.
 */
function actLabelOf(segments, last, prev) {
  if (prev === 'employees') return "editing this employee's record";
  if (last === 'employees') return 'adding an employee';
  if (prev === 'onboarding-tasks') return 'updating that onboarding task';
  if (prev === 'offboarding-tasks') return 'updating that offboarding task';
  if (last === 'exit-interviews') return 'recording an exit interview';
  if (last === 'cases') return 'opening a pre-boarding case';
  if (last === 'status' && segments.indexOf('items') !== -1) return 'moving that checklist item';
  if (last === 'reminders') return 'sending that reminder';
  if (last === 'notice-acknowledgements') return 'recording that the notice was shown';
  if (last === 'acknowledgement') return 'recording that acknowledgement';
  if (last === 'probation-evaluations') return 'recording that evaluation';
  if (last === 'corrections') return 'recording that correction';
  if (last === 'escalations' || prev === 'escalations') return 'recording that escalation';
  return 'that';
}

/**
 * The refusal sentence for one url. The shipped promise is kept word for word — a signed-in person is told
 * what they may not see, that nothing changed and that they are still signed in — and the panel is named
 * so the notice points at the panel it belongs to instead of the whole screen.
 */
export function refusalNoticeFor(url, message, method = 'GET') {
  const base = message === undefined
    ? "You don't have access to that. Nothing was changed, and you are still signed in."
    : message;
  const label = panelLabelOf(url, method);
  if (label === 'that') return base;
  return base.replace('to that.', `to ${label}.`);
}
