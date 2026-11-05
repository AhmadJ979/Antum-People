/**
 * client/src/probationNotice.test.js — the probation card's notice slot, asserted without a browser.
 *
 * THE DEFECT THIS FILE EXISTS TO STOP (measured on a rendered screen, 2026-11-04 demo dry run):
 * after "Record evaluation" and then "Record a correction", TWO notice bars stood on the card at
 * once, stacked, each with its own ×, and nothing but that × removed either of them — they also
 * survived a market switch. The cause was two pieces of state, each cleared only by its own modal
 * (App.tsx:657/:673, :1405/:1484, :1456/:1536 at `22a4093`).
 *
 * So this file tests two things, and the second is the one that would have caught the defect:
 *
 *   1. THE SLOT'S TRANSITIONS (`probationNotice.js`): recording replaces, and every ending event
 *      empties. A sequence of actions can only ever leave 0 or 1 bar.
 *
 *   2. THE WIRING (a source scan over `App.tsx`): the screen has ONE notice slot, every ending
 *      event the module names is dispatched somewhere in it, and neither of the two old states
 *      survives. A module test alone would pass with the module unused; that is exactly how a
 *      "single slot" can be written and never adopted.
 *
 * The scan is proven by MUTATION, not by a hand-written sample: the test takes the real App.tsx,
 * puts the pre-fix two-state declarations and the two-bar render block back into it, and asserts the
 * scan reports violations — and asserts both substitutions actually happened, so the control cannot
 * go quiet when the anchors move.
 */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EVALUATION,
  CORRECTION,
  NO_NOTICE,
  CLEARING_ACTIONS,
  RECORDING_ACTIONS,
  probationNoticeReducer,
  noticeBars,
  EVALUATION_RECORDED,
  CORRECTION_RECORDED,
  EVALUATION_FORM_OPENED,
  CORRECTION_FORM_OPENED,
  EVALUATION_SUBMITTED,
  CORRECTION_SUBMITTED,
  JURISDICTION_CHANGED,
  NOTICE_DISMISSED,
} from './probationNotice.js';

const CLIENT_SRC = fileURLToPath(new URL('.', import.meta.url));
const APP = path.join(CLIENT_SRC, 'App.tsx');

/** The two sentences the card can show, as the copy module writes them (never re-worded here). */
const EVAL_LINE = 'Evaluation recorded for day 30 — the milestone is now Completed.';
const CORR_LINE = 'Correction recorded — the effective wording is what you typed (correction 1).';

const run = (actions, state = NO_NOTICE) => actions.reduce(probationNoticeReducer, state);

// ================================================================================================
// 1. The slot's transitions
// ================================================================================================

test('a recorded evaluation fills the slot with the evaluation line', () => {
  const state = run([{ type: EVALUATION_RECORDED, text: EVAL_LINE }]);
  assert.deepEqual(state, { kind: EVALUATION, text: EVAL_LINE });
  assert.deepEqual(noticeBars(state), [{ kind: EVALUATION, text: EVAL_LINE }]);
});

test('recording an evaluation and THEN a correction leaves exactly ONE bar: the correction', () => {
  const state = run([
    { type: EVALUATION_RECORDED, text: EVAL_LINE },
    { type: CORRECTION_RECORDED, text: CORR_LINE },
  ]);
  const bars = noticeBars(state);
  assert.equal(bars.length, 1, 'the card draws one bar, not two');
  assert.equal(bars[0].kind, CORRECTION);
  assert.equal(bars[0].text, CORR_LINE);
});

test('the reverse order is one bar too: the evaluation replaces the correction', () => {
  const bars = noticeBars(run([
    { type: CORRECTION_RECORDED, text: CORR_LINE },
    { type: EVALUATION_RECORDED, text: EVAL_LINE },
  ]));
  assert.equal(bars.length, 1);
  assert.equal(bars[0].kind, EVALUATION);
  assert.equal(bars[0].text, EVAL_LINE);
});

test('recording the same kind twice replaces the text rather than stacking', () => {
  const bars = noticeBars(run([
    { type: EVALUATION_RECORDED, text: EVAL_LINE },
    { type: EVALUATION_RECORDED, text: 'Second line.' },
  ]));
  assert.equal(bars.length, 1);
  assert.equal(bars[0].text, 'Second line.');
});

test('the x empties the slot', () => {
  assert.equal(noticeBars(run([
    { type: EVALUATION_RECORDED, text: EVAL_LINE },
    { type: NOTICE_DISMISSED },
  ])).length, 0);
});

test('a market switch empties the slot', () => {
  assert.equal(noticeBars(run([
    { type: EVALUATION_RECORDED, text: EVAL_LINE },
    { type: JURISDICTION_CHANGED },
  ])).length, 0);
  assert.equal(noticeBars(run([
    { type: CORRECTION_RECORDED, text: CORR_LINE },
    { type: JURISDICTION_CHANGED },
  ])).length, 0);
});

test('opening EITHER form empties the slot — the orphan in the defect came from clearing only one', () => {
  for (const opening of [EVALUATION_FORM_OPENED, CORRECTION_FORM_OPENED]) {
    assert.equal(noticeBars(run([{ type: EVALUATION_RECORDED, text: EVAL_LINE }, { type: opening }])).length, 0,
      `${opening} must clear an evaluation bar`);
    assert.equal(noticeBars(run([{ type: CORRECTION_RECORDED, text: CORR_LINE }, { type: opening }])).length, 0,
      `${opening} must clear a correction bar`);
  }
});

test('a REFUSED submission cannot leave the previous success bar standing over it', () => {
  // What the screen does: the slot is emptied when the form opens and again when the form is
  // submitted; a refusal writes only the modal's own refusal and never touches the slot. So the
  // reader ends up with a refusal and NO stale success line beside it.
  const afterOpen = run([{ type: EVALUATION_RECORDED, text: EVAL_LINE }, { type: CORRECTION_FORM_OPENED }]);
  assert.equal(noticeBars(afterOpen).length, 0, 'opening the second form already ended the first bar');

  const afterRefusal = probationNoticeReducer(afterOpen, { type: CORRECTION_SUBMITTED });
  assert.equal(noticeBars(afterRefusal).length, 0, 'the submission empties the slot; the refusal is the modal\u2019s own line');

  // And the same when the reader submits without the modal having been re-opened.
  const stale = run([
    { type: EVALUATION_RECORDED, text: EVAL_LINE },
    { type: CORRECTION_SUBMITTED },
  ]);
  assert.equal(noticeBars(stale).length, 0);
});

test('every clearing action empties a filled slot, for both kinds', () => {
  for (const ending of CLEARING_ACTIONS) {
    for (const filled of [
      { type: EVALUATION_RECORDED, text: EVAL_LINE },
      { type: CORRECTION_RECORDED, text: CORR_LINE },
    ]) {
      assert.equal(noticeBars(run([filled, { type: ending }])).length, 0, `${ending} must empty the slot`);
    }
  }
});

test('a recording action with no words is NOT a bar', () => {
  for (const text of [undefined, null, '', '   ', '\n\t']) {
    assert.equal(noticeBars(probationNoticeReducer(NO_NOTICE, { type: EVALUATION_RECORDED, text })).length, 0,
      `text ${JSON.stringify(text)} must not draw a bar`);
  }
});

test('the line is stored byte-identical — the wording is the copy module\u2019s, not this module\u2019s', () => {
  const padded = `  ${EVAL_LINE}  `;
  const state = probationNoticeReducer(NO_NOTICE, { type: EVALUATION_RECORDED, text: padded });
  assert.equal(state.text, padded, 'no trimming, no rewriting');
});

test('an action the module does not know leaves the slot alone (it cannot blank a bar by typo)', () => {
  const state = run([{ type: EVALUATION_RECORDED, text: EVAL_LINE }, { type: 'not-an-action' }]);
  assert.deepEqual(state, { kind: EVALUATION, text: EVAL_LINE });
  assert.equal(probationNoticeReducer(undefined, undefined), NO_NOTICE, 'an absent action is an empty slot, not a crash');
});

test('noticeBars can only ever return 0 or 1 bars, whatever it is handed', () => {
  const shapes = [
    NO_NOTICE, {}, { kind: EVALUATION }, { kind: EVALUATION, text: '' }, { text: EVAL_LINE },
    { kind: EVALUATION, text: EVAL_LINE }, { kind: CORRECTION, text: CORR_LINE },
    { kind: EVALUATION, text: EVAL_LINE, extra: CORR_LINE }, [{ kind: EVALUATION, text: EVAL_LINE }],
  ];
  for (const shape of shapes) {
    const bars = noticeBars(shape);
    assert.ok(Array.isArray(bars), 'always a list');
    assert.ok(bars.length <= 1, `never two bars, got ${JSON.stringify(shape)}`);
  }
});

test('the module\u2019s two action lists are disjoint and cover the whole vocabulary', () => {
  assert.equal(CLEARING_ACTIONS.length, 6);
  assert.equal(RECORDING_ACTIONS.length, 2);
  for (const action of CLEARING_ACTIONS) {
    assert.ok(!RECORDING_ACTIONS.includes(action), `${action} cannot both record and clear`);
  }
});

// ================================================================================================
// 2. The wiring — App.tsx must actually use the slot
// ================================================================================================

/** The body of `const <name> = ... { ... }`, brace-matched. `null` when there is no such binding. */
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

/**
 * Every way the screen can be wrong about the notice, as a list of violations. An empty list is the
 * only pass. It returns findings rather than asserting so the mutation control below can read them.
 */
function scanApp(source) {
  const bad = [];
  const count = (needle) => source.split(needle).length - 1;

  // (a) neither of the two old states may survive, in any spelling.
  for (const dead of ['evaluationNotice', 'correctionNotice']) {
    const n = count(dead);
    if (n !== 0) bad.push(`App.tsx still mentions \`${dead}\` ${n} time(s) — the two-state shape is back`);
  }

  // (b) exactly one slot, declared as a reducer over the module.
  if (count('useReducer(probationNoticeReducer, NO_NOTICE)') !== 1) {
    bad.push('App.tsx must declare the slot exactly once as useReducer(probationNoticeReducer, NO_NOTICE)');
  }
  if (count('const [probationNotice, dispatchProbationNotice]') !== 1) {
    bad.push('App.tsx must hold exactly one `probationNotice` slot');
  }

  // (c) one bar, drawn from the selector, with one x.
  if (count('noticeBars(probationNotice).map(') !== 1) {
    bad.push('App.tsx must draw the notice from noticeBars(probationNotice) exactly once');
  }
  if (count('{ type: NOTICE_DISMISSED }') !== 1) {
    bad.push('App.tsx must have exactly one dismiss dispatch for the notice');
  }

  // (d) every ending event the module names is dispatched from the screen, and every recording
  //     event too. A path the module defines but the screen never dispatches is a path that does
  //     not exist — the defect's own shape.
  const wanted = {
    EVALUATION_RECORDED: bodyOf(source, 'handleRecordEvaluation'),
    CORRECTION_RECORDED: bodyOf(source, 'handleRecordCorrection'),
    EVALUATION_FORM_OPENED: bodyOf(source, 'openEvaluationForm'),
    CORRECTION_FORM_OPENED: bodyOf(source, 'openCorrectionForm'),
    EVALUATION_SUBMITTED: bodyOf(source, 'handleRecordEvaluation'),
    CORRECTION_SUBMITTED: bodyOf(source, 'handleRecordCorrection'),
    JURISDICTION_CHANGED: bodyOf(source, 'switchJurisdiction'),
    NOTICE_DISMISSED: source,
  };
  for (const [action, body] of Object.entries(wanted)) {
    if (body === null) { bad.push(`App.tsx has no \`${action}\` site to dispatch from (binding not found)`); continue; }
    if (!body.includes(`{ type: ${action}`)) bad.push(`\`${action}\` is never dispatched from its site`);
  }

  // (e) the recorded line must come from the copy module, unaltered.
  const evalBody = bodyOf(source, 'handleRecordEvaluation') || '';
  const corrBody = bodyOf(source, 'handleRecordCorrection') || '';
  if (!evalBody.includes('text: evaluationRecordedLine(day)')) {
    bad.push('the evaluation bar must carry evaluationRecordedLine(day) verbatim');
  }
  if (!corrBody.includes('text: correctionRecordedLine(shownText, shownCount)')) {
    bad.push('the correction bar must carry correctionRecordedLine(shownText, shownCount) verbatim');
  }

  // (f) the market switch must go through ONE handler, for both buttons.
  if (count("setJurisdiction('") !== 0) bad.push('a jurisdiction button still sets the market directly, skipping the clear');
  if (count('switchJurisdiction(') !== 2) {
    bad.push(`both market buttons must call switchJurisdiction (found ${count('switchJurisdiction(')})`);
  }

  return bad;
}

const APP_SOURCE = fs.readFileSync(APP, 'utf8');

test('App.tsx wires the single notice slot: no violations', () => {
  assert.deepEqual(scanApp(APP_SOURCE), []);
});

test('the scan REDDENS on the pre-fix two-state code (mutation of the real App.tsx)', () => {
  // Put back exactly what `22a4093` had: two states, and two independent bars each with its own x.
  const slotDecl = /  const \[probationNotice, dispatchProbationNotice\] = useReducer\(probationNoticeReducer, NO_NOTICE\);\n/;
  assert.ok(slotDecl.test(APP_SOURCE), 'anchor: the single-slot declaration moved — re-aim this control');

  const oneBarStart = APP_SOURCE.indexOf('{/* ONE bar');
  assert.ok(oneBarStart > 0, 'anchor: the one-bar render block moved — re-aim this control');
  const oneBarEnd = APP_SOURCE.indexOf('))}', oneBarStart);
  assert.ok(oneBarEnd > oneBarStart, 'anchor: the one-bar render block has no closing — re-aim this control');
  const oneBar = APP_SOURCE.slice(oneBarStart, oneBarEnd + 3);
  assert.ok(oneBar.includes('noticeBars(probationNotice).map('), 'anchor: that block is not the notice bar');

  const TWO_BARS = '\n                {evaluationNotice && (\n'
    + '                  <div><span>{evaluationNotice}</span>'
    + '<button onClick={() => setEvaluationNotice(null)}>&times;</button></div>\n'
    + '                )}\n'
    + '                {correctionNotice && (\n'
    + '                  <div><span>{correctionNotice}</span>'
    + '<button onClick={() => setCorrectionNotice(null)}>&times;</button></div>\n'
    + '                )}\n';

  const mutant = APP_SOURCE
    .replace(slotDecl, '  const [evaluationNotice, setEvaluationNotice] = useState<string | null>(null);\n'
      + '  const [correctionNotice, setCorrectionNotice] = useState<string | null>(null);\n')
    .replace(oneBar, TWO_BARS);

  assert.notEqual(mutant, APP_SOURCE, 'the mutation must actually change the source');

  const findings = scanApp(mutant);
  assert.ok(findings.length >= 4, `the pre-fix shape must redden the scan, got ${findings.length} finding(s)`);
  // The three findings the defect itself is:
  assert.ok(findings.some((f) => f.includes('evaluationNotice')), 'the old evaluation state must be named');
  assert.ok(findings.some((f) => f.includes('correctionNotice')), 'the old correction state must be named');
  assert.ok(findings.some((f) => f.includes('noticeBars(probationNotice)')), 'two hand-written bars must be named');
});
