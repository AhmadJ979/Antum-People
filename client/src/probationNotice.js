/**
 * client/src/probationNotice.js — the probation card's ONE notice slot.
 *
 * WHY THIS MODULE EXISTS (measured on a rendered screen, 2026-11-04 demo dry run):
 *
 *   The card carried TWO independent pieces of state, `evaluationNotice` and `correctionNotice`
 *   (App.tsx:657 and :673 at `22a4093`). Each was set on its own success (:1456, :1536) and cleared
 *   only by opening ITS OWN modal (:1405, :1484). Nothing cleared the other one: no timeout, no
 *   clear-on-navigation, no clear on a market switch. So the moment a reader recorded an evaluation
 *   and then a correction, BOTH bars were on screen at once, stacked, each with its own ×, and the
 *   evaluation bar was orphaned for the rest of the session.
 *
 *   That is not two bugs. It is one shape: N pieces of state that each own a bar on the same card,
 *   where every clear path knows about exactly one of them. Adding a third bar would repeat it. So
 *   the fix is the class: ONE slot, and every event that can end a notice is named here, in one
 *   switch, where a reader can see the whole set at once.
 *
 * WHAT THE SLOT GUARANTEES:
 *   - A recorded line REPLACES whatever the slot held. Two actions in a row can never leave two
 *     bars, because there is only one value to render (`noticeBars` returns 0 or 1 bar, never 2).
 *   - Opening EITHER form, submitting EITHER form, changing jurisdiction, and the × all end the
 *     current notice. A refused submission therefore cannot leave a stale bar behind: the slot was
 *     already emptied when the form was opened, and a refusal writes only the modal's own refusal.
 *   - An empty or missing line is NOT a bar. A bar with no words would be a rendering of nothing.
 *
 * THE WORDING IS NOT THIS MODULE'S TO DECIDE. The sentences come from `probationEvaluationCopy.js`
 * (`evaluationRecordedLine`, `correctionRecordedLine`) and are stored byte-identical — this module
 * decides WHICH line occupies the slot and WHEN the slot empties, never what the line says.
 */

/** Which write the line in the slot describes. A correction is not a submission and the bar says so. */
export const EVALUATION = 'evaluation';
export const CORRECTION = 'correction';

// The recording events. These are the only actions that PUT something in the slot.
export const EVALUATION_RECORDED = 'evaluation-recorded';
export const CORRECTION_RECORDED = 'correction-recorded';

// The ending events. Each is named for the thing that happened rather than collapsed into one
// `clear`, so the call site states WHY the slot emptied and a path that forgets to end it is
// visible by its absence.
export const EVALUATION_FORM_OPENED = 'evaluation-form-opened';
export const CORRECTION_FORM_OPENED = 'correction-form-opened';
export const EVALUATION_SUBMITTED = 'evaluation-submitted';
export const CORRECTION_SUBMITTED = 'correction-submitted';
export const JURISDICTION_CHANGED = 'jurisdiction-changed';
export const NOTICE_DISMISSED = 'notice-dismissed';

/** The empty slot. `null`, so a component renders nothing rather than an empty box. */
export const NO_NOTICE = null;

/** Every action that ends the current notice. */
export const CLEARING_ACTIONS = Object.freeze([
  EVALUATION_FORM_OPENED,
  CORRECTION_FORM_OPENED,
  EVALUATION_SUBMITTED,
  CORRECTION_SUBMITTED,
  JURISDICTION_CHANGED,
  NOTICE_DISMISSED,
]);

/** The only actions that can put a line in the slot. */
export const RECORDING_ACTIONS = Object.freeze([EVALUATION_RECORDED, CORRECTION_RECORDED]);

/**
 * A notice, or `null`. The text is stored EXACTLY as given — it is the copy module's sentence and
 * trimming it here would be this module editing wording it does not own. A blank line is no notice.
 */
function noticeOf(kind, text) {
  if (typeof text !== 'string' || text.trim() === '') return NO_NOTICE;
  return { kind, text };
}

/**
 * @typedef {{ kind: 'evaluation' | 'correction', text: string }} Notice
 *
 * The JSDoc above the reducer is not decoration: `tsc -b` reads this module even with `checkJs`
 * off, and without a declared state type it would infer the parameter from the `null` default
 * (`null | undefined`) and then refuse the reducer at its `useReducer` call site in App.tsx.
 */

/**
 * The slot's whole life, in one switch.
 *
 * @param {Notice | null} [state]
 * @param {{ type?: string, text?: string }} [action]
 * @returns {Notice | null}
 *
 * An action it does not know leaves the slot ALONE rather than clearing it: a typo at a call site
 * must not be able to empty a bar the reader is reading, and the unrecognised action is caught by
 * the test that walks `CLEARING_ACTIONS` / `RECORDING_ACTIONS` instead.
 */
export function probationNoticeReducer(state = NO_NOTICE, action) {
  if (!action || typeof action.type !== 'string') return state;
  switch (action.type) {
    case EVALUATION_RECORDED:
      return noticeOf(EVALUATION, action.text);
    case CORRECTION_RECORDED:
      return noticeOf(CORRECTION, action.text);
    case EVALUATION_FORM_OPENED:
    case CORRECTION_FORM_OPENED:
    case EVALUATION_SUBMITTED:
    case CORRECTION_SUBMITTED:
    case JURISDICTION_CHANGED:
    case NOTICE_DISMISSED:
      return NO_NOTICE;
    default:
      return state;
  }
}

/**
 * What the card draws, as a list — because "how many bars are on screen" is the question the defect
 * was, and a list can be counted. It is `[]` or one element, structurally: there is no state this
 * function can be handed that yields two bars.
 */
export function noticeBars(notice) {
  if (!notice || typeof notice.text !== 'string' || notice.text.trim() === '') return [];
  return [{ kind: notice.kind, text: notice.text }];
}
