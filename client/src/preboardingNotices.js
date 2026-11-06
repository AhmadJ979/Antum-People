/**
 * client/src/preboardingNotices.js — the Layer 2 notice slots, and EVERY transition they have.
 *
 * THE DEFECT THIS MODULE EXISTS TO END (measured at `6ca7062`, `client/src/App.tsx`):
 *
 *   - `checklistNotice` was set by 16 sites across the pre-boarding reads and writes and their
 *     refusal arms, and cleared in exactly ONE place — inside `toggleCase`, and only when a
 *     DIFFERENT case was opened. Closing the open case returned before that line, so the line
 *     stood after the case was closed, after a tab change, after a market change, and it was
 *     still there when the case was re-opened. It had no dismiss control.
 *   - `offerNotice` was set by 5 sites in the "Open pre-boarding case" handler and cleared by
 *     NOTHING: `setOfferNotice(null)` did not exist anywhere in the file. A success line from
 *     the first offer stood until a later offer overwrote it. It had no dismiss control either.
 *
 * That is one defect in two places — the same class the probation card had (#362): a notice
 * with a beginning and no ending. So the fix is one module that owns the endings, not two more
 * `useState`s with a `null` written into each handler.
 *
 * WHY TWO SLOTS AND NOT ONE. The two bars render on two different panels of the same tab: the
 * offer line under the offer form, the checklist line under the case list. One shared slot would
 * mean recording an offer silently erases a line about a checklist item the reader is looking at
 * in the panel beside it — and the bar would have to move between panels depending on which act
 * came last, which is a worse lie than the one being fixed. They describe different subjects on
 * different surfaces, so they get one slot each. What they share is the LIFECYCLE: this one
 * reducer owns both, so "opening a case" or "changing market" cannot be wired for one and
 * forgotten for the other. A fix for one instance of a class is not a fix for the class.
 *
 * THE RULES, in one switch:
 *   - A newer line REPLACES the older one in its own slot (never stacks).
 *   - Starting an action that will produce its own line empties the slot first, so a failed or
 *     slow request cannot leave the previous success standing while the new one is in flight.
 *   - Every event that ends the context a line describes empties it: opening a case, closing a
 *     case, switching tab, switching market.
 *   - The reader can always dismiss a line with the x, on either bar.
 *
 * THE WORDING IS NOT THIS MODULE'S TO DECIDE. The sentences are composed at the call sites, from
 * the server's own refusal text and the product's own facts, and are stored BYTE-IDENTICAL — this
 * module decides WHICH line occupies a slot and WHEN the slot empties, never what a line says.
 * That is why it takes `{ kind, text }` rather than building a sentence: no wording moved in this
 * change, and nothing here can reword one.
 */

/** The slot a line belongs to. Named for the panel it renders on. */
export const OFFER = 'offer';
export const CHECKLIST = 'checklist';

// The recording events. These are the only actions that PUT a line in a slot.
export const OFFER_RECORDED = 'offer-recorded';
export const CHECKLIST_RECORDED = 'checklist-recorded';

// The ending events. Each is named for the thing that happened rather than collapsed into one
// `clear`, so a call site states WHY the slot emptied and a path that forgets to end a line is
// visible by its absence.
export const OFFER_SUBMITTED = 'offer-submitted';
export const CHECKLIST_ACTION_STARTED = 'checklist-action-started';
export const CASE_OPENED = 'case-opened';
export const CASE_CLOSED = 'case-closed';
export const TAB_CHANGED = 'tab-changed';
// Named MARKET_CHANGED, not JURISDICTION_CHANGED: `probationNotice.js` already exports a
// JURISDICTION_CHANGED, and the one file that imports both would not compile with two bindings of
// one name (TS2300, measured). It is the same event -- the header's market switch -- reaching a
// second reducer, and `switchJurisdiction` dispatches both.
export const MARKET_CHANGED = 'market-changed';
export const OFFER_DISMISSED = 'offer-dismissed';
export const CHECKLIST_DISMISSED = 'checklist-dismissed';

/** Both slots empty. `null` per slot, so a component renders nothing rather than an empty box. */
export const NO_NOTICES = Object.freeze({ offer: null, checklist: null });

/** Every action that ends a line (one slot or both). Walked by the test, not by the reducer. */
export const CLEARING_ACTIONS = Object.freeze([
  OFFER_SUBMITTED,
  CHECKLIST_ACTION_STARTED,
  CASE_OPENED,
  CASE_CLOSED,
  TAB_CHANGED,
  MARKET_CHANGED,
  OFFER_DISMISSED,
  CHECKLIST_DISMISSED,
]);

/** The only actions that can put a line in a slot. */
export const RECORDING_ACTIONS = Object.freeze([OFFER_RECORDED, CHECKLIST_RECORDED]);

/**
 * The ending events that end BOTH lines, because they end the surface both bars sit on.
 * Opening or closing a case and changing tab or market are not acts on one panel: they change
 * which case, which market or which screen the reader is on, and a line about the previous one
 * standing over the new one is the same defect in the other direction.
 */
export const BOTH_SLOTS_ACTIONS = Object.freeze([
  CASE_OPENED,
  CASE_CLOSED,
  TAB_CHANGED,
  MARKET_CHANGED,
]);

/**
 * A line, or `null`. The text is stored EXACTLY as given — it is the call site's sentence, and
 * trimming it here would be this module editing wording it does not own. A blank line is no line.
 */
function noticeOf(kind, text) {
  if (typeof text !== 'string' || text.trim() === '') return null;
  return { kind, text };
}

/**
 * @typedef {{ kind: string, text: string }} Notice
 * @typedef {{ offer: Notice | null, checklist: Notice | null }} Notices
 *
 * The JSDoc is not decoration: `tsc -b` reads this module even with `checkJs` off, and without a
 * declared state type it would infer the shape from `NO_NOTICES` (two `null`s) and then refuse the
 * reducer at its `useReducer` call site in App.tsx.
 */

/**
 * Both slots' whole life, in one switch.
 *
 * @param {Notices} [state]
 * @param {{ type?: string, kind?: string, text?: string }} [action]
 * @returns {Notices}
 *
 * An action it does not know leaves BOTH slots alone rather than clearing them: a typo at a call
 * site must not be able to empty a bar the reader is reading, and the unrecognised action is
 * caught by the test that walks `CLEARING_ACTIONS` / `RECORDING_ACTIONS` instead.
 */
export function preboardingNoticesReducer(state = NO_NOTICES, action) {
  if (!action || typeof action.type !== 'string') return state;
  switch (action.type) {
    case OFFER_RECORDED:
      return { ...state, offer: noticeOf(action.kind, action.text) };
    case CHECKLIST_RECORDED:
      return { ...state, checklist: noticeOf(action.kind, action.text) };
    case OFFER_SUBMITTED:
      return { ...state, offer: null };
    case CHECKLIST_ACTION_STARTED:
      return { ...state, checklist: null };
    case OFFER_DISMISSED:
      return { ...state, offer: null };
    case CHECKLIST_DISMISSED:
      return { ...state, checklist: null };
    case CASE_OPENED:
    case CASE_CLOSED:
    case TAB_CHANGED:
    case MARKET_CHANGED:
      return { ...state, offer: null, checklist: null };
    default:
      return state;
  }
}

/**
 * What a panel draws, as a list — because "how many bars are on this panel" is the question the
 * defect was, and a list can be counted. It is `[]` or one element, structurally: there is no
 * state this function can be handed that yields two bars in one slot.
 */
function barOf(notice) {
  if (!notice || typeof notice.text !== 'string' || notice.text.trim() === '') return [];
  return [{ kind: notice.kind, text: notice.text }];
}

/** The offer panel's bar(s): 0 or 1. */
export function offerBar(state) {
  return barOf(state && state.offer);
}

/** The case panel's bar(s): 0 or 1. */
export function checklistBar(state) {
  return barOf(state && state.checklist);
}
