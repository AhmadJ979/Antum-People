/**
 * What a panel's READ means for that panel's screen — "an empty result and a refusal must never render
 * the same".
 *
 * THE DEFECT THIS EXISTS TO KILL. Measured 2026-11-08 on the deployed tree `f4729f3`, signed in as the
 * client-demo account (`demo`, `access_role` `finance`): `GET /api/preboarding/cases` and
 * `GET /api/preboarding/checklist/overview` both answer the policy gate's refusal — `403` with an EMPTY
 * body, `server/access.js`'s deliberate shape — and the screen rendered the SUCCESS-BUT-EMPTY state
 * instead. The tile read `0 / CASES OPEN` and the roll-up read "No open UAE pre-boarding cases — nothing
 * outstanding to show for this jurisdiction. Record an accepted offer to open one." while the database
 * held three open AE cases and `admin` (hr_admin) received all three from the same route. The refusal
 * existed only in the browser console, and a console is not a screen.
 *
 * WHY THE FETCH HAD NO READING TO CONSULT. `createAuthedFetch` (`httpStatus.js`) THROWS a `RefusalError`
 * for that shape (and a `SessionExpiredError` for a dead session); both pre-boarding call sites caught
 * everything into `console.error`, so the state kept its initial `[]` / `null` and the render could not
 * tell "nobody may show me this" from "there is nothing to show". A 500 or an unparseable body landed in
 * the same place, which is why `FAILED` is a third outcome here and not folded into the refusal.
 *
 * THE RULE, in one function: a panel's EMPTY state is renderable only when its read was not refused and
 * not failed. `emptyArea()` names the three outcomes so a screen has ONE place to branch on, and
 * `scripts/check-refusal-not-empty.js` can see, in the source, which arm of that branch an empty-state
 * sentence sits in. `panelReadings()` turns the records `settlePanels()` already decides into the reading
 * a screen keeps — nothing here re-reads a status code, so the session-vs-refusal classification stays in
 * `httpStatus.js` and there is no second convention.
 *
 * WHAT THIS MODULE DOES NOT DECIDE, and must not be read as deciding: whether the refusal is CORRECT. It
 * is. `server/access.js` POLICY keeps `preboarding:read` and `preboarding:read:aggregate` outside
 * `finance`, and this change touches no policy cell and no account. It also does not author the sentence
 * from its own opinion: `refusalSentenceFor()` composes it from the roles the policy cell ALLOWS, and
 * `server/panel-reading-copy.test.js` asserts that set equals the cell — so a policy change reddens the
 * copy instead of leaving a served sentence asserting something the gate no longer does.
 *
 * Plain ES module JavaScript: no DOM, no React, no network. `client/src/panelReading.test.js` drives it
 * under `node --test`, so "a refusal never renders as an empty result" is asserted rather than assumed.
 */
import { GRANTED, REFUSED, FAILED } from './panelResults.js';

/** The read has not come back yet (first paint). Not a refusal, and not an empty result. */
export const PENDING = 'pending';

/** The three things a panel's empty area can be. */
export const EMPTY = 'empty';
export const REFUSAL_AREA = 'refusal';
export const FAILED_AREA = 'failed';

/**
 * Which of the three a panel's empty area must show, from the reading the screen kept.
 *
 * An UNREAD panel (undefined, or `PENDING`) returns `EMPTY`: before the first answer there is no
 * evidence of a refusal, and showing one would be a refusal the user never received.
 */
export function emptyArea(reading) {
  if (reading === REFUSED) return REFUSAL_AREA;
  if (reading === FAILED) return FAILED_AREA;
  return EMPTY;
}

/** May this panel render its empty state? False for a refusal and for a failed read. */
export function mayRenderEmpty(reading) {
  return emptyArea(reading) === EMPTY;
}

/**
 * The reading a screen keeps, from the SAME records `settlePanels()` decides — so the data and the
 * notice about the data can never be computed from different evidence.
 *
 * @param {Array<{name: string, status: string}>} records
 * @returns {Record<string, string>} panel name -> `GRANTED` | `REFUSED` | `FAILED`
 */
export function panelReadings(records) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const record of records || []) {
    if (record && typeof record.name === 'string') out[record.name] = record.status;
  }
  return out;
}

/**
 * The human word for each role in `server/access.js` ROLES. A role with no word here cannot be named in
 * a sentence, and `panelReading.test.js` asserts every declared role has one — so a new role in a cell
 * cannot silently produce "read by undefined".
 */
export const ROLE_WORDS = Object.freeze({
  hr_admin: 'HR',
  manager: 'a manager, for their own line',
  finance: 'finance',
  compliance_viewer: 'a compliance viewer',
  employee: 'the employee themselves',
});

/**
 * The panels whose screen HAS an empty state, the policy cell that decides them, and the roles that cell
 * allows. `resource` is the exact key in `server/access.js` POLICY; `roles` is asserted to EQUAL that
 * cell by `server/panel-reading-copy.test.js`, which is what keeps the sentence below true.
 */
export const REFUSED_PANELS = Object.freeze({
  preboarding_cases: Object.freeze({
    label: 'the pre-boarding cases',
    sentence_subject: 'The pre-boarding cases',
    plural: true,
    resource: 'preboarding:read',
    roles: Object.freeze(['hr_admin']),
  }),
  preboarding_overview: Object.freeze({
    label: 'the pre-boarding roll-up',
    sentence_subject: 'The pre-boarding roll-up',
    // Singular: "the roll-up ARE read by" is the kind of sentence a refusal cannot afford, because the
    // reader is already being told no. Asserted in panelReading.test.js.
    plural: false,
    resource: 'preboarding:read:aggregate',
    roles: Object.freeze(['hr_admin', 'compliance_viewer']),
  }),
  // The employer record (owner ruling 2026-11-10, option (b)). Mapped to the roster's own read cell, so
  // the sentence's roles are the roster's; the `words` override is what stops the generic manager word
  // ("a manager, for their own line") claiming a row scope this route does not apply — the employer is
  // the company itself, not another person's row.
  employer_record: Object.freeze({
    label: 'the employer record',
    sentence_subject: 'The employer record',
    plural: false,
    resource: 'employees:read',
    words: Object.freeze({ manager: 'a manager' }),
    roles: Object.freeze(['hr_admin', 'manager', 'finance']),
  }),
  probation: Object.freeze({
    label: 'the probation timelines',
    sentence_subject: 'The probation timelines',
    plural: true,
    resource: 'employees:read',
    roles: Object.freeze(['hr_admin', 'manager', 'finance']),
    // "a manager, for their own line" carries a comma, and `joinWords` joins with commas: in a list of
    // three it reads "HR, a manager, for their own line and finance". The comma is dropped here so the
    // sentence stays readable; the qualifier itself is kept, because a manager's reach is not HR's.
    words: Object.freeze({ manager: 'a manager for their own line' }),
  }),
  // ---- The rest of the class (#392 fixed three panels and named these four as unfixed) ----------
  // Each is a screen whose EMPTY state was rendered from the LENGTH of a list a refusal left behind.
  employees: Object.freeze({
    label: 'the roster',
    sentence_subject: 'The roster',
    plural: false,
    resource: 'employees:read',
    roles: Object.freeze(['hr_admin', 'manager', 'finance']),
    words: Object.freeze({ manager: 'a manager for their own line' }),
  }),
  analytics: Object.freeze({
    label: 'the dashboard figures',
    sentence_subject: 'The dashboard figures',
    plural: true,
    resource: 'analytics:read',
    roles: Object.freeze(['hr_admin', 'finance', 'compliance_viewer']),
  }),
  onboarding: Object.freeze({
    label: 'the onboarding tasks',
    sentence_subject: 'The onboarding tasks',
    plural: true,
    resource: 'onboarding:read',
    roles: Object.freeze(['hr_admin', 'manager', 'employee']),
    words: Object.freeze({ manager: "the hire's manager" }),
  }),
  offboarding: Object.freeze({
    label: 'the offboarding tasks',
    sentence_subject: 'The offboarding tasks',
    plural: true,
    resource: 'offboarding:read',
    roles: Object.freeze(['hr_admin', 'employee']),
  }),
});

/**
 * The word for one role IN ONE PANEL'S SENTENCE: the panel's own override where it declares one, else
 * the generic `ROLE_WORDS` entry. A panel overrides a word when the generic one is true but reads badly
 * inside a list ("a manager, for their own line" -> "HR, a manager, for their own line and finance"), or
 * when the role is a different person on that screen (the onboarding list's manager is the HIRE'S).
 * `server/panel-reading-copy.test.js` uses this function rather than the raw table, so the assertion
 * "the sentence names every role the cell allows" is still made against the words the sentence uses.
 */
export function roleWordsFor(name, role) {
  const panel = REFUSED_PANELS[name];
  const override = panel && panel.words ? panel.words[role] : undefined;
  return override || ROLE_WORDS[role];
}

/** `a`, `a and b`, `a, b and c` — the sentence reads as prose, never as a list of tokens. */
function joinWords(words) {
  if (words.length === 0) return '';
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/**
 * What a refused panel says, in the product's own refusal voice (`probationEvaluationCopy.js`'s modal:
 * "You can't record evaluations for this employee from this account. Nothing was recorded, and you are
 * still signed in."). Three claims, in that order: what this account cannot read, that nothing was
 * changed, and that the session is intact — followed by who CAN read it, which is the one fact that
 * makes the refusal actionable rather than a dead end.
 *
 * It says nothing about WHY beyond the account, because the gate tells the client nothing beyond that
 * (the body is empty by design), and it never claims the data is empty.
 */
export function refusalSentenceFor(name) {
  const panel = REFUSED_PANELS[name];
  if (!panel) throw new Error(`no refusal copy declared for panel ${JSON.stringify(name)}`);
  const who = joinWords(panel.roles.map((role) => roleWordsFor(name, role)));
  const verb = panel.plural ? 'are' : 'is';
  return `You can't read ${panel.label} from this account. Nothing was changed, and you are still `
    + `signed in. ${panel.sentence_subject} ${verb} read by ${who}.`;
}

/**
 * What a panel says when its read FAILED (offline, a 500, a body that was not JSON). A different fact
 * from a refusal and stated as one: nothing says the data is absent, only that it could not be read.
 */
export function failedSentenceFor(name) {
  const panel = REFUSED_PANELS[name];
  if (!panel) throw new Error(`no failure copy declared for panel ${JSON.stringify(name)}`);
  return `${panel.sentence_subject} could not be read just now, so nothing is shown for them. `
    + 'Nothing was changed, and you are still signed in.';
}

/** The sentence a panel's empty area shows, or `null` when it may show its empty state. */
export function emptyAreaSentence(name, reading) {
  const area = emptyArea(reading);
  if (area === REFUSAL_AREA) return refusalSentenceFor(name);
  if (area === FAILED_AREA) return failedSentenceFor(name);
  return null;
}

/** Re-exported so a screen compares against one name, not against string literals. */
export { GRANTED, REFUSED, FAILED };
