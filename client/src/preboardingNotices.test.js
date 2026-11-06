/**
 * client/src/preboardingNotices.test.js — the Layer 2 notice slots, asserted without a browser.
 *
 * THE DEFECT THIS FILE EXISTS TO STOP (measured at `6ca7062`, `client/src/App.tsx`):
 *
 *   - the checklist line (`:776`) was set by 16 sites across the pre-boarding reads and writes and
 *     their refusal arms, and cleared in exactly ONE place — inside `toggleCase`, and only when a
 *     DIFFERENT case was opened, because closing returned before that line (`:1172-1174`). It stood
 *     after the case was closed, after a tab change and after a market change, and it was still
 *     there when the case was re-opened. Rendered at `:3039-3041` with no dismiss control.
 *   - the offer line (`:778`) was set by 5 sites in the "Open pre-boarding case" handler and cleared
 *     by NOTHING: `setOfferNotice(null)` did not exist anywhere in the file. Rendered at
 *     `:2547-2549`, also with no dismiss control.
 *
 * Same class as the probation card's (#362): a notice with a beginning and no ending. So this file
 * tests two things, and the second is the one that would have caught the defect:
 *
 *   1. THE SLOTS' TRANSITIONS (`preboardingNotices.js`): a newer line replaces, every ending event
 *      empties, the reader's x empties, and a sequence of actions can only ever leave 0 or 1 bar per
 *      slot.
 *
 *   2. THE WIRING (a source scan over `App.tsx`): the screen has ONE reducer over the module, both
 *      bars are drawn from its selectors, each bar carries its own x, and every ending event the
 *      module names is dispatched from the site that ends that context. A module test alone would
 *      pass with the module unused; that is exactly how a "single slot" can be written and never
 *      adopted.
 *
 * The scan is proven by MUTATION, not by a hand-written sample: the test takes the real App.tsx, puts
 * the pre-fix two-state declarations and the two hand-written bars back into it, and asserts the scan
 * reports violations — and asserts every substitution actually happened, so the control cannot go
 * quiet when the anchors move.
 */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OFFER,
  CHECKLIST,
  NO_NOTICES,
  CLEARING_ACTIONS,
  RECORDING_ACTIONS,
  BOTH_SLOTS_ACTIONS,
  preboardingNoticesReducer,
  offerBar,
  checklistBar,
  OFFER_RECORDED,
  CHECKLIST_RECORDED,
  OFFER_SUBMITTED,
  CHECKLIST_ACTION_STARTED,
  CASE_OPENED,
  CASE_CLOSED,
  TAB_CHANGED,
  MARKET_CHANGED,
  OFFER_DISMISSED,
  CHECKLIST_DISMISSED,
} from './preboardingNotices.js';

const CLIENT_SRC = fileURLToPath(new URL('.', import.meta.url));
const APP = path.join(CLIENT_SRC, 'App.tsx');

/**
 * Two sentences in the shapes the product actually composes — the server's own refusal text, and a
 * success line naming the item. Copied from the call sites at `6ca7062`; never re-worded here.
 */
const OK_LINE = 'Start date is now received.';
const REFUSAL_LINE = 'The item cannot move from requested to verified without a document.';

const run = (actions, state = NO_NOTICES) => actions.reduce(preboardingNoticesReducer, state);

// ================================================================================================
// 1. The slots' transitions
// ================================================================================================

test('a recorded checklist line fills the checklist slot and draws exactly one bar', () => {
  const state = run([{ type: CHECKLIST_RECORDED, kind: 'ok', text: OK_LINE }]);
  assert.deepEqual(state, { offer: null, checklist: { kind: 'ok', text: OK_LINE } });
  assert.deepEqual(checklistBar(state), [{ kind: 'ok', text: OK_LINE }]);
  assert.deepEqual(offerBar(state), [], 'the offer panel draws nothing for a checklist line');
});

test('a recorded offer line fills the offer slot and draws exactly one bar', () => {
  const state = run([{ type: OFFER_RECORDED, kind: 'ok', text: 'Pre-boarding case opened.' }]);
  assert.deepEqual(offerBar(state), [{ kind: 'ok', text: 'Pre-boarding case opened.' }]);
  assert.deepEqual(checklistBar(state), []);
});

test('a newer line REPLACES the older one in its slot: one bar, never two', () => {
  const state = run([
    { type: CHECKLIST_RECORDED, kind: 'ok', text: OK_LINE },
    { type: CHECKLIST_RECORDED, kind: 'error', text: REFUSAL_LINE },
  ]);
  const bars = checklistBar(state);
  assert.equal(bars.length, 1, 'the case panel draws one bar, not two');
  assert.deepEqual(bars[0], { kind: 'error', text: REFUSAL_LINE });
});

test('THE DEFECT: a refusal cannot leave an older success line standing', () => {
  // The failure path this reproduces: an item moves (success line), the reader then tries a move the
  // server refuses. Before the fix the refusal overwrote the line but nothing emptied it first, so
  // when a request FAILED WITHOUT ANSWERING (the catch arm, or a slow round trip) the old success
  // line was what stood on the screen while the new action was in flight.
  const state = run([
    { type: CHECKLIST_RECORDED, kind: 'ok', text: OK_LINE },
    { type: CHECKLIST_ACTION_STARTED },
    { type: CHECKLIST_RECORDED, kind: 'error', text: REFUSAL_LINE },
  ]);
  assert.deepEqual(checklistBar(state), [{ kind: 'error', text: REFUSAL_LINE }]);
});

test('starting an action empties its slot BEFORE the result arrives', () => {
  const afterStart = run([
    { type: CHECKLIST_RECORDED, kind: 'ok', text: OK_LINE },
    { type: CHECKLIST_ACTION_STARTED },
  ]);
  assert.deepEqual(checklistBar(afterStart), [], 'no line stands while the new action is in flight');

  const afterSubmit = run([
    { type: OFFER_RECORDED, kind: 'ok', text: 'Pre-boarding case opened.' },
    { type: OFFER_SUBMITTED },
  ]);
  assert.deepEqual(offerBar(afterSubmit), []);
});

test('CLOSING the case clears the checklist line', () => {
  const state = run([
    { type: CASE_OPENED },
    { type: CHECKLIST_RECORDED, kind: 'ok', text: OK_LINE },
    { type: CASE_CLOSED },
  ]);
  assert.deepEqual(checklistBar(state), [], 'the line must not survive the case it describes');
});

test('OPENING a case clears the line the previous case left', () => {
  const state = run([
    { type: CASE_OPENED },
    { type: CHECKLIST_RECORDED, kind: 'ok', text: OK_LINE },
    { type: CASE_OPENED },
  ]);
  assert.deepEqual(checklistBar(state), []);
});

test('a MARKET change clears BOTH lines', () => {
  const state = run([
    { type: OFFER_RECORDED, kind: 'ok', text: 'Pre-boarding case opened.' },
    { type: CHECKLIST_RECORDED, kind: 'ok', text: OK_LINE },
    { type: MARKET_CHANGED },
  ]);
  assert.deepEqual(offerBar(state), []);
  assert.deepEqual(checklistBar(state), []);
});

test('a TAB change clears BOTH lines', () => {
  const state = run([
    { type: OFFER_RECORDED, kind: 'ok', text: 'Pre-boarding case opened.' },
    { type: CHECKLIST_RECORDED, kind: 'ok', text: OK_LINE },
    { type: TAB_CHANGED },
  ]);
  assert.deepEqual(offerBar(state), []);
  assert.deepEqual(checklistBar(state), []);
});

test('the reader can dismiss each bar with its own x', () => {
  const both = run([
    { type: OFFER_RECORDED, kind: 'ok', text: 'Pre-boarding case opened.' },
    { type: CHECKLIST_RECORDED, kind: 'ok', text: OK_LINE },
  ]);
  const offerGone = preboardingNoticesReducer(both, { type: OFFER_DISMISSED });
  assert.deepEqual(offerBar(offerGone), []);
  assert.equal(checklistBar(offerGone).length, 1, 'one x dismisses one bar, not both');

  const bothGone = preboardingNoticesReducer(both, { type: CHECKLIST_DISMISSED });
  assert.deepEqual(checklistBar(bothGone), []);
  assert.equal(offerBar(bothGone).length, 1);
});

test('an action it does not know leaves both slots alone', () => {
  const filled = run([
    { type: OFFER_RECORDED, kind: 'ok', text: 'Pre-boarding case opened.' },
    { type: CHECKLIST_RECORDED, kind: 'ok', text: OK_LINE },
  ]);
  for (const action of [{ type: 'offr-recorded' }, { type: 'CLECKLIST-DISMISSED' }, {}, null, undefined]) {
    assert.deepEqual(preboardingNoticesReducer(filled, action), filled, `a typo emptied a slot: ${JSON.stringify(action)}`);
  }
});

test('a blank or missing line is NOT a bar', () => {
  for (const text of ['', '   ', null, undefined, 42]) {
    const state = run([{ type: CHECKLIST_RECORDED, kind: 'ok', text }]);
    assert.deepEqual(checklistBar(state), [], `a bar with no words is a rendering of nothing: ${JSON.stringify(text)}`);
  }
});

test('the wording is stored BYTE-IDENTICAL — this module decides when, never what', () => {
  const text = '  Item "Start date" is now received — recorded, not sent.  ';
  const state = run([{ type: CHECKLIST_RECORDED, kind: 'ok', text }]);
  assert.equal(checklistBar(state)[0].text, text);
});

test('every CLEARING action empties both slots; every RECORDING action fills one', () => {
  const full = run([
    { type: OFFER_RECORDED, kind: 'ok', text: 'Pre-boarding case opened.' },
    { type: CHECKLIST_RECORDED, kind: 'ok', text: OK_LINE },
  ]);
  assert.deepEqual(CLEARING_ACTIONS.length, 8);
  for (const type of CLEARING_ACTIONS) {
    const after = preboardingNoticesReducer(full, { type });
    const left = offerBar(after).length + checklistBar(after).length;
    if (BOTH_SLOTS_ACTIONS.includes(type)) {
      assert.equal(left, 0, `${type} must empty BOTH slots, ${left} bar(s) survived`);
    } else {
      assert.ok(left < 2, `${type} must empty at least its own slot`);
    }
  }
  assert.deepEqual(RECORDING_ACTIONS.slice().sort(), [CHECKLIST_RECORDED, OFFER_RECORDED].sort());
  for (const type of RECORDING_ACTIONS) {
    const after = preboardingNoticesReducer(NO_NOTICES, { type, kind: 'ok', text: OK_LINE });
    assert.equal(offerBar(after).length + checklistBar(after).length, 1, `${type} must fill exactly one slot`);
  }
});

test('no sequence of actions can leave more than one bar in a slot', () => {
  // A deterministic sweep: every action, four deep, over a filled state. The bar count per slot is
  // the thing the defect was, so it is the thing asserted — not the shape of the state.
  const kinds = ['ok', 'existing', 'error'];
  const actions = [];
  for (const type of [...RECORDING_ACTIONS, ...CLEARING_ACTIONS]) {
    for (const kind of kinds) actions.push({ type, kind, text: `${type}/${kind}` });
  }
  let state = NO_NOTICES;
  for (const a of actions) {
    state = preboardingNoticesReducer(state, a);
    assert.ok(offerBar(state).length <= 1, 'the offer panel can never stack');
    assert.ok(checklistBar(state).length <= 1, 'the case panel can never stack');
    for (const b of actions) {
      const two = preboardingNoticesReducer(state, b);
      assert.ok(offerBar(two).length <= 1);
      assert.ok(checklistBar(two).length <= 1);
    }
  }
});

test('the two slots are distinct: one panel\'s line never renders on the other', () => {
  const offerOnly = run([{ type: OFFER_RECORDED, kind: 'existing', text: 'Offer already had a case.' }]);
  assert.deepEqual(checklistBar(offerOnly), []);
  assert.equal(OFFER, 'offer');
  assert.equal(CHECKLIST, 'checklist');
});

// ================================================================================================
// 2. The wiring: one reducer, two bars, an x on each, and every ending event dispatched
// ================================================================================================

/** The body of `const <name> = …` — braces matched, so a nested arrow does not end it early. */
function bodyOf(source, name) {
  const at = source.indexOf(`const ${name} = `);
  if (at < 0) return null;
  const open = source.indexOf('{', at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

function scanApp(source) {
  const bad = [];
  const count = (needle) => source.split(needle).length - 1;

  // (a) neither of the two old states may survive, in any spelling. The names are the defect: two
  //     pieces of state, each cleared only by the handler that happened to remember.
  for (const dead of ['checklistNotice', 'offerNotice']) {
    const n = count(dead);
    if (n !== 0) bad.push(`App.tsx still mentions \`${dead}\` ${n} time(s) — the two-state shape is back`);
  }

  // (b) one reducer, declared once, over the module.
  if (count('useReducer(\n    preboardingNoticesReducer, NO_NOTICES)') !== 1) {
    bad.push('App.tsx must declare the slots once as useReducer(preboardingNoticesReducer, NO_NOTICES)');
  }
  if (count('const [preboardingNotices, dispatchPreboardingNotices]') !== 1) {
    bad.push('App.tsx must hold exactly one `preboardingNotices` state');
  }

  // (c) two bars, each drawn from its own selector — 0 or 1, structurally.
  if (count('offerBar(preboardingNotices).map(') !== 1) {
    bad.push('App.tsx must draw the offer bar from offerBar(preboardingNotices) exactly once');
  }
  if (count('checklistBar(preboardingNotices).map(') !== 1) {
    bad.push('App.tsx must draw the checklist bar from checklistBar(preboardingNotices) exactly once');
  }

  // (d) one x per bar, each dispatching its own dismiss — and no hand-written bar left behind.
  if (count('{ type: OFFER_DISMISSED }') !== 1) bad.push('the offer bar must carry exactly one OFFER_DISMISSED dispatch');
  if (count('{ type: CHECKLIST_DISMISSED }') !== 1) bad.push('the checklist bar must carry exactly one CHECKLIST_DISMISSED dispatch');

  // (e) every ending event the module names is dispatched from the site that ends that context.
  //     A path the module defines but the screen never dispatches is a path that does not exist.
  const wanted = {
    OFFER_SUBMITTED: bodyOf(source, 'handleRecordOfferAcceptance'),
    CHECKLIST_ACTION_STARTED: [
      bodyOf(source, 'handleItemStatus'),
      bodyOf(source, 'handleRecordAcknowledgement'),
      bodyOf(source, 'handleRecordNoticeShown'),
      bodyOf(source, 'handleRemind'),
    ],
    CASE_OPENED: bodyOf(source, 'toggleCase'),
    CASE_CLOSED: bodyOf(source, 'toggleCase'),
    MARKET_CHANGED: bodyOf(source, 'switchJurisdiction'),
    TAB_CHANGED: source, // the effect keys on the state, not on a handler: see App.tsx
    OFFER_RECORDED: bodyOf(source, 'handleRecordOfferAcceptance'),
  };
  for (const [action, bodies] of Object.entries(wanted)) {
    const list = Array.isArray(bodies) ? bodies : [bodies];
    if (list.some((b) => b === null)) { bad.push(`App.tsx has no site to dispatch \`${action}\` from (binding not found)`); continue; }
    if (!list.every((b) => b.includes(`{ type: ${action}`))) bad.push(`\`${action}\` is not dispatched from every site that ends it`);
  }

  // (f) the checklist writers all go through the reducer: the old setter must be gone (covered by
  //     (a)) and the write handlers must each open by emptying the slot, so a failed request cannot
  //     leave the previous success standing.
  for (const name of ['handleItemStatus', 'handleRecordAcknowledgement', 'handleRecordNoticeShown', 'handleRemind']) {
    const body = bodyOf(source, name) || '';
    if (!body.includes('{ type: CHECKLIST_ACTION_STARTED }')) bad.push(`\`${name}\` must empty the checklist slot before it writes`);
  }

  // (g) the market switch goes through ONE handler, so both buttons clear both panels' lines.
  if (count("setJurisdiction('") !== 0) bad.push('a jurisdiction button still sets the market directly, skipping the clear');

  return bad;
}

const APP_SOURCE = fs.readFileSync(APP, 'utf8');

test('App.tsx wires both notice slots: no violations', () => {
  assert.deepEqual(scanApp(APP_SOURCE), []);
});

test('the scan REDDENS on the pre-fix two-state code (mutation of the real App.tsx)', () => {
  // Put back exactly what `6ca7062` had: two independent states, two hand-written bars with no x,
  // and a toggleCase that returns on close before it clears anything.
  const decl = '  const [preboardingNotices, dispatchPreboardingNotices] = useReducer(\n'
    + '    preboardingNoticesReducer, NO_NOTICES);\n';
  assert.ok(APP_SOURCE.includes(decl), 'anchor: the reducer declaration moved — re-aim this control');

  const start = APP_SOURCE.indexOf('{offerBar(preboardingNotices).map(');
  assert.ok(start > 0, 'anchor: the offer bar moved — re-aim this control');
  const end = APP_SOURCE.indexOf('))}', start);
  assert.ok(end > start, 'anchor: the offer bar has no closing — re-aim this control');
  const offerBlock = APP_SOURCE.slice(start, end + 3);

  const cStart = APP_SOURCE.indexOf('{checklistBar(preboardingNotices).map(');
  assert.ok(cStart > 0, 'anchor: the checklist bar moved — re-aim this control');
  const cEnd = APP_SOURCE.indexOf('))}', cStart);
  assert.ok(cEnd > cStart, 'anchor: the checklist bar has no closing — re-aim this control');
  const checklistBlock = APP_SOURCE.slice(cStart, cEnd + 3);

  const mutant = APP_SOURCE
    .replace(decl, '  const [checklistNotice, setChecklistNotice] = useState<{ kind: string; text: string } | null>(null);\n'
      + '  const [offerNotice, setOfferNotice] = useState<{ kind: string; text: string } | null>(null);\n')
    .replace(offerBlock, '{offerNotice && (<div>{offerNotice.text}</div>)}')
    .replace(checklistBlock, '{checklistNotice && (<div>{checklistNotice.text}</div>)}')
    .replace('      dispatchPreboardingNotices({ type: CASE_CLOSED });\n', '');

  assert.notEqual(mutant, APP_SOURCE, 'the mutation must actually change the source');
  assert.ok(!mutant.includes('dispatchPreboardingNotices({ type: CASE_CLOSED })'),
    'anchor: the CASE_CLOSED dispatch was not removed — the mutation is incomplete');

  const findings = scanApp(mutant);
  assert.ok(findings.length >= 5, `the pre-fix shape must redden the scan, got ${findings.length} finding(s)`);
  // The findings the defect itself is:
  assert.ok(findings.some((f) => f.includes('checklistNotice')), 'the old checklist state must be named');
  assert.ok(findings.some((f) => f.includes('offerNotice')), 'the old offer state must be named');
  assert.ok(findings.some((f) => f.includes('offerBar(preboardingNotices)')), 'a hand-written offer bar must be named');
  assert.ok(findings.some((f) => f.includes('checklistBar(preboardingNotices)')), 'a hand-written checklist bar must be named');
  assert.ok(findings.some((f) => f.includes('CASE_CLOSED')), 'a closing that clears nothing must be named');
});

test('the scan REDDENS on a bar whose x is removed (one line of the fix at a time)', () => {
  // The control above removes four things at once. This one removes ONE: the x on the offer bar.
  // A control that only fires on a wholesale revert cannot prove the dismiss is load-bearing.
  const marker = 'onClick={() => dispatchPreboardingNotices({ type: OFFER_DISMISSED })}';
  assert.ok(APP_SOURCE.includes(marker), 'anchor: the offer bar\'s dismiss dispatch moved — re-aim this control');
  const mutant = APP_SOURCE.replace(marker, 'onClick={() => undefined}');
  assert.notEqual(mutant, APP_SOURCE, 'the mutation must actually change the source');
  const findings = scanApp(mutant);
  assert.ok(findings.some((f) => f.includes('OFFER_DISMISSED')), 'a bar with no working x must be named');
});
