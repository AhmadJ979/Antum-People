/**
 * client/src/probationEscalations.test.js — P3-3's panel, asserted without a browser.
 *
 * Two things this file exists to stop, both measured on a live screen on 2026-11-02:
 *
 *   1. A subtitle that asserts a FIXED milestone triple over a DERIVED variable. The panel read
 *      "30/60/90 derived from the start date" while `milestoneOffsets` gives `round(k * window / 3)`
 *      for k = 1, 2, 3 — so the sentence was true for a 90-day window and FALSE for a 180-day one,
 *      on the same screen, at the same time. The first test below is a source scan over every module
 *      the client can bundle: a milestone triple written back into the client reddens it.
 *
 *   2. A refusal rendered as an empty list. `GET /api/probation/escalations` refuses anything but
 *      company-wide scope with `403` and an EMPTY body, which `client/src/httpStatus.js` classifies
 *      as a refusal in place. A panel that drew `[]` there would tell a manager "no escalation has
 *      ever fired" when the truth is "you may not see the record". `escalationReading` returns
 *      `rows: null` on every branch that is not a granted read, so there is nothing to draw — and the
 *      second scan asserts App.tsx only ever renders the list inside the granted branch.
 *
 * The scans walk the tree rather than naming files: a guard that lists the filenames that mattered
 * the day it was written cannot see a new one. Both scans are proven by plants in a scratch
 * directory, so a scan that has stopped seeing its subject fails here instead of passing quietly.
 */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REFUSED,
  FAILED,
  GRANTED,
  REFUSED_SENTENCE,
  FAILED_SENTENCE,
  EMPTY_SENTENCE,
  LOADING_SENTENCE,
  loadingReading,
  escalationReading,
  escalationRowLine,
  escalationWatcherLine,
} from './probationEscalations.js';
import { probationSubtitle } from './probationTimeline.js';

const CLIENT_SRC = fileURLToPath(new URL('.', import.meta.url));

// --------------------------------------------------------------------------------------------
// A settled panel record, in the shapes `client/src/panelResults.js` produces.
// --------------------------------------------------------------------------------------------
const refusedRecord = (value) => ({ name: 'escalations', url: '/api/probation/escalations', status: REFUSED, value });
const grantedRecord = (value) => ({ name: 'escalations', url: '/api/probation/escalations', status: GRANTED, value });
const failedRecord = () => ({ name: 'escalations', url: '/api/probation/escalations', status: FAILED, error: new Error('offline') });

/** One row as `listEscalations` shapes it (`server/probation-escalation.js`'s `shape()`). */
const ROW = Object.freeze({
  id: 'esc-1',
  employee_id: 'demo-emp-omar',
  employee_name: 'Omar Al-Farsi',
  milestone_index: 1,
  milestone_day: 30,
  milestone_due_date: '2026-09-19',
  detected_at: '2026-11-02T21:15:38.000Z',
  late: true,
  late_by_hours: 1068.26,
  reporting_line: {
    manager: { employee_id: 'demo-emp-sara', name: 'Sara Haddad' },
    managers_manager: { employee_id: 'demo-emp-khalid', name: 'Khalid Nasser' },
    hr: [{ username: 'admin', employee_id: null, name: null }],
    missing: [],
    resolved: true,
  },
  reporting_line_missing: [],
  channel: 'none',
  fired_by: 'scheduler:probation-escalation',
  note: 'Milestone 1 passed its deadline.',
  resolved: false,
  correction_count: 0,
});

const WATCHER = Object.freeze({
  process_started_at: '2026-11-02T20:58:00.000Z',
  last_scan_at: '2026-11-02T21:15:38.000Z',
  interval_ms: 300000,
  escalations_recorded_in_this_process: 3,
  last_error: null,
  delivery: 'none',
  catch_up_rule: 'A deadline that fell before this escalation watcher started is escalated late.',
});

// ============================================================================================
// 1. The refusal and the empty list must not look alike.
// ============================================================================================

test('a REFUSED read carries no rows at all — there is nothing to draw as an empty list', () => {
  const reading = escalationReading(refusedRecord(undefined));
  assert.strictEqual(reading.kind, REFUSED);
  assert.strictEqual(reading.rows, null, 'a refusal must not carry an array: [] would render as "none found"');
  assert.strictEqual(reading.sentence, REFUSED_SENTENCE);
  assert.match(reading.sentence, /not shown for your account/i);
});

test('a refusal WINS over any payload that rode along with it', () => {
  // The control for the sentence above: an implementation that read `record.value` on the refused
  // branch would turn THIS refusal into `rows: []` and print "no escalation has been recorded" to a
  // manager who was refused. Feeding it a well-formed empty payload is what makes that visible.
  const reading = escalationReading(refusedRecord({ escalations: [], count: 0, watcher: WATCHER, note: 'x' }));
  assert.strictEqual(reading.kind, REFUSED);
  assert.strictEqual(reading.rows, null);
  assert.strictEqual(reading.sentence, REFUSED_SENTENCE);
  assert.notStrictEqual(reading.sentence, EMPTY_SENTENCE);
});

test('a GRANTED read that found nothing is an empty LIST with its own sentence', () => {
  const reading = escalationReading(grantedRecord({ escalations: [], count: 0, watcher: WATCHER, note: 'nothing is delivered' }));
  assert.strictEqual(reading.kind, GRANTED);
  assert.deepStrictEqual(reading.rows, []);
  assert.strictEqual(reading.sentence, EMPTY_SENTENCE);
  assert.notStrictEqual(reading.sentence, REFUSED_SENTENCE);
});

test('the refusal and the empty list are different readings, not two renderings of one', () => {
  const refused = escalationReading(refusedRecord({ escalations: [], count: 0 }));
  const empty = escalationReading(grantedRecord({ escalations: [], count: 0, watcher: WATCHER }));
  assert.notStrictEqual(refused.kind, empty.kind);
  assert.notStrictEqual(refused.rows, empty.rows, 'null vs [] — the whole point of the pair');
  assert.strictEqual(refused.rows, null);
  assert.deepStrictEqual(empty.rows, []);
});

test('a FAILED read is neither a refusal nor an empty list', () => {
  for (const record of [failedRecord(), grantedRecord({ count: 0 }), grantedRecord({ escalations: 'nope' }), grantedRecord(null), undefined]) {
    const reading = escalationReading(record);
    assert.strictEqual(reading.kind, FAILED);
    assert.strictEqual(reading.rows, null);
    assert.strictEqual(reading.sentence, FAILED_SENTENCE);
  }
});

test('before the first answer the panel has no list either', () => {
  const reading = loadingReading();
  assert.strictEqual(reading.rows, null);
  assert.strictEqual(reading.sentence, LOADING_SENTENCE);
});

// ============================================================================================
// 2. The granted read renders the three live rows and says nothing was sent.
// ============================================================================================

test('a granted read keeps every row it was sent, and the server note verbatim', () => {
  const note = 'The product has no mailer, no webhook and no SMS.';
  const reading = escalationReading(grantedRecord({ escalations: [ROW, ROW, ROW], count: 3, watcher: WATCHER, note }));
  assert.strictEqual(reading.kind, GRANTED);
  assert.strictEqual(reading.rows.length, 3);
  assert.strictEqual(reading.sentence, null, 'a non-empty list needs no explanation');
  assert.strictEqual(reading.note, note, 'the no-delivery note is surfaced as it arrived, never paraphrased');
});

test('a row line names the milestone, the day, the recipients and what is still open', () => {
  const line = escalationRowLine(ROW);
  assert.match(line, /Milestone 1 \(day 30\)/);
  assert.match(line, /19 September 2026/);
  // A day, not a clock: the row's instant is formatted through the ONE date convention, and the
  // assertion is written not to depend on the machine's timezone.
  assert.match(line, /Recorded \d{1,2} November 2026/);
  assert.match(line, /Sara Haddad \(manager\)/);
  assert.match(line, /Khalid Nasser \(manager\u2019s manager\)/);
  assert.match(line, /HR \(admin\)/);
  assert.match(line, /first seen 1068\.26h after it/);
  assert.match(line, /Still open/);
});

test('a reporting line that could not be resolved is NAMED, never quietly dropped', () => {
  const line = escalationRowLine({
    ...ROW,
    reporting_line: { manager: null, managers_manager: null, hr: [], missing: ['manager', 'managers_manager', 'hr'], resolved: false },
    reporting_line_missing: ['manager', 'managers_manager', 'hr'],
  });
  assert.match(line, /Addressed to nobody this record could resolve/);
  assert.match(line, /Not resolved: manager, managers manager, hr/);
});

test('a closed escalation says whether the assessment behind it was later corrected', () => {
  assert.match(escalationRowLine({ ...ROW, resolved: true, correction_count: 0 }), /Closed by a submitted evaluation/);
  assert.match(escalationRowLine({ ...ROW, resolved: true, correction_count: 2 }), /corrected 2 times/);
});

test('the watcher line distinguishes "nothing missed" from "the watch has never looked"', () => {
  const ran = escalationWatcherLine(WATCHER);
  assert.match(ran, /Last scan \d{1,2} November 2026/);
  assert.match(ran, /every 300s/);
  assert.match(ran, /3 recorded in this process/);
  assert.match(ran, /delivery: none/, 'the loop delivers nothing and the panel must not imply otherwise');
  const notRun = escalationWatcherLine({ ...WATCHER, last_scan_at: null, escalations_recorded_in_this_process: 0 });
  assert.match(notRun, /has not scanned yet/);
  assert.match(notRun, /delivery: none/);
  assert.match(escalationWatcherLine(undefined), /was not sent with this list/);
});

// ============================================================================================
// 3. The subtitle. True for a window of ANY length.
// ============================================================================================

test('the subtitle names where the milestones come from and no milestone at all', () => {
  const two = probationSubtitle(2);
  assert.strictEqual(two, '2 hires on probation \u00b7 milestones derived per hire from its own start date and probation window');
  assert.strictEqual(probationSubtitle(1), '1 hire on probation \u00b7 milestones derived per hire from its own start date and probation window');
  assert.strictEqual(probationSubtitle(0), '0 hires on probation \u00b7 milestones derived per hire from its own start date and probation window');
  // It takes the COUNT and nothing else, so it cannot depend on a window and cannot go stale the way
  // a triple does. Any two counts describe windows of different lengths and get the same rule.
  assert.strictEqual(probationSubtitle.length, 1);
  assert.ok(!/\d+\s*[/,]\s*\d+\s*[/,]\s*\d+/.test(two), 'the subtitle must not carry a milestone triple');
});

// ============================================================================================
// 4. Guard: a milestone triple must not come back into the client.
// ============================================================================================

/**
 * The triples that are false for some window the product can produce. `30/60/90` is the one that was
 * served; `60/120/180` is the 180-day window's own triple, so a "fix" that swaps one for the other is
 * caught by the same rule. Separators are `/` or `,` — a JSX text, a template literal and an array
 * literal all read as a triple.
 */
const TRIPLE = /\b30\s*[/,]\s*60\s*[/,]\s*90\b|\b60\s*[/,]\s*120\s*[/,]\s*180\b/g;

/** Every module the client can bundle. Test files are excluded: they are not shipped, and this file
 *  names the very triples it forbids. */
function bundledModules(root) {
  const found = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...bundledModules(full));
      continue;
    }
    if (!/\.(js|jsx|ts|tsx)$/.test(entry.name)) continue;
    if (/\.(test|spec)\./.test(entry.name)) continue;
    found.push(full);
  }
  return found;
}

/**
 * Is this offset inside a comment? Cheap and order-based rather than a parser: a match is exempt when
 * a line comment opens on its own line before it, or when more block comments have opened than
 * closed before it. Prose is allowed to NAME the triple it is explaining — `client/src/probationTimeline.js`
 * does exactly that — and a comment is never rendered, so it cannot be the defect this guard is for.
 */
function insideComment(source, offset) {
  const lineStart = source.lastIndexOf('\n', offset) + 1;
  if (source.slice(lineStart, offset).includes('//')) return true;
  const before = source.slice(0, offset);
  const opened = (before.match(/\/\*/g) || []).length;
  const closed = (before.match(/\*\//g) || []).length;
  return opened > closed;
}

/** Every rendered milestone triple in a tree, as `file:line`. */
function findTriples(root) {
  const hits = [];
  for (const file of bundledModules(root)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(TRIPLE)) {
      if (insideComment(source, match.index)) continue;
      hits.push(`${path.relative(root, file)}:${source.slice(0, match.index).split('\n').length}`);
    }
  }
  return hits;
}

test('no module the client bundles asserts a fixed milestone triple', () => {
  const modules = bundledModules(CLIENT_SRC);
  // Anti-vacuity: a scan that sees nothing proves nothing. The app file must be among them.
  assert.ok(modules.length >= 5, `the scan found only ${modules.length} modules — it is not reading the tree`);
  assert.ok(modules.some((file) => path.basename(file) === 'App.tsx'), 'the scan must include the app file');
  assert.deepStrictEqual(findTriples(CLIENT_SRC), [],
    'a fixed milestone triple is false for the windows it does not name; derive it or say where it comes from');
});

test('the triple scan reddens on code and stays quiet on the comment that explains it', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'triple-scan-'));
  try {
    // A filename no list names: this is the finding, not a name count.
    fs.writeFileSync(path.join(scratch, 'Preview.tsx'),
      'export const Preview = () => <p>30/60/90 derived from the start date</p>;\n');
    assert.deepStrictEqual(findTriples(scratch), ['Preview.tsx:1']);

    // The false-positive control: the same text, in a comment, must stay green.
    fs.writeFileSync(path.join(scratch, 'Preview.tsx'),
      '// it said 30/60/90 until 2026-11-02\n/* and 60/120/180 was the other window */\nexport const Preview = () => null;\n');
    assert.deepStrictEqual(findTriples(scratch), [], 'a comment cannot be rendered, so it cannot be the defect');

    // A string literal and an array literal are both code.
    fs.writeFileSync(path.join(scratch, 'triples.js'),
      'export const A = `2 hires on probation \u00b7 30/60/90`;\nexport const B = [30, 60, 90];\n');
    assert.deepStrictEqual(findTriples(scratch), ['triples.js:1', 'triples.js:2']);

    // The 180-day twin: swapping the triple for its twin is the same defect one window later.
    fs.writeFileSync(path.join(scratch, 'triples.js'), 'export const C = "60/120/180";\n');
    assert.deepStrictEqual(findTriples(scratch), ['triples.js:1']);

    // A test file is not bundled and is not judged. (`triples.js` is cleared first: this case asks
    // what the walk sees in a TEST file, not what is left over from the case above.)
    fs.rmSync(path.join(scratch, 'triples.js'));
    fs.writeFileSync(path.join(scratch, 'triples.test.js'), 'export const D = "30/60/90";\n');
    assert.deepStrictEqual(findTriples(scratch), []);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

// ============================================================================================
// 5. Guard: the escalation LIST is rendered only on a granted reading.
// ============================================================================================

const BEGIN = '{/* P3-3 -- the escalation records. BEGIN';
const END = '{/* P3-3 escalation records -- END */}';

/** The escalation panel's own JSX, between its two markers — nothing else in the file. */
function escalationBlock(source) {
  const begin = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  assert.ok(begin >= 0, `App.tsx no longer carries the panel's BEGIN marker (${BEGIN}) — re-ground this scan`);
  assert.ok(end > begin, `App.tsx no longer carries the panel's END marker (${END}) — re-ground this scan`);
  return source.slice(begin, end);
}

test('App.tsx renders the escalation list only inside a GRANTED reading', () => {
  const source = fs.readFileSync(path.join(CLIENT_SRC, 'App.tsx'), 'utf8');
  const block = escalationBlock(source);

  // The list is reached through the granted branch and only through it.
  const grantedAt = block.indexOf("escalation.kind === 'granted'");
  assert.ok(grantedAt >= 0, 'the block must branch on the reading kind');
  const rowReads = [...block.matchAll(/escalation\.rows/g)].map((m) => m.index);
  assert.ok(rowReads.length > 0, 'the block must read the rows it was sent — a panel that renders none is not this panel');
  for (const at of rowReads) {
    assert.ok(at > grantedAt, 'escalation.rows is read before the granted guard — a refusal would reach the list');
  }
  // No null-to-empty fallback: `(rows || []).map(...)` is exactly the defect, wearing a list.
  assert.ok(!/rows\s*\|\|\s*\[\]/.test(block), 'rows must never be coerced to [] — a refusal would render as "none found"');
  assert.ok(!/rows\s*\?\?\s*\[\]/.test(block), 'rows must never be coerced to [] — a refusal would render as "none found"');
  // Exactly one list, and it maps the rows the reading carries.
  assert.strictEqual((block.match(/\.map\(/g) || []).length, 1, 'the block must render exactly one list');
  assert.match(block, /escalation\.rows\.map\(/);
  // Both sentences have a render site: the empty-list one and the refusal/failure one.
  assert.ok((block.match(/\{escalation\.sentence\}/g) || []).length >= 2,
    'the refusal sentence needs its own render site, separate from the empty-list one');
  // The server's own note is surfaced, not paraphrased.
  assert.match(block, /\{escalation\.note\}/);
  assert.match(block, /\{escalation\.watcherLine\}/);
});

test('the block scan reddens when the list escapes the granted branch', () => {
  const render = (jsx) => `${BEGIN} */}\n${jsx}\n${END}`;
  const granted = `{escalation.kind === 'granted' ? (escalation.rows.map((r) => <li key={r.id} />)) : (<div>{escalation.sentence}</div>)}`;
  assert.ok(!/rows\s*\|\|\s*\[\]/.test(escalationBlock(render(granted))));

  // The defect, verbatim: a refusal coerced into an empty list.
  const coerced = `{(escalation.rows || []).map((r) => <li key={r.id} />)}\n<div>{escalation.sentence}</div>`;
  assert.ok(/rows\s*\|\|\s*\[\]/.test(escalationBlock(render(coerced))), 'the coercion control must be visible to the scan');

  // A list rendered before the guard is the other way the refusal reaches the screen.
  const unguarded = `{escalation.rows.map((r) => <li key={r.id} />)}\n{escalation.kind === 'granted' ? null : null}\n<div>{escalation.sentence}</div>`;
  const block = escalationBlock(render(unguarded));
  const grantedAt = block.indexOf("escalation.kind === 'granted'");
  assert.ok(block.indexOf('escalation.rows.map(') < grantedAt, 'the unguarded control must be visible to the scan');
});
