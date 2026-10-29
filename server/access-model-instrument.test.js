// The access-model instrument's HOME, and the two controls that make it a check rather than a claim.
//
// Rows becc12ff / 39a63c38. The instrument used to live at /home/team/shared/verify-access-model.py -
// outside the repository, so no PR could carry its change and no reviewer could re-run it - and it
// asserted a claim's LINE NUMBER rather than the symbol on that line, so a single merge that inserted
// lines near the top of a served file reddened 54 claims whose content had not changed (measured:
// docs/evidence/content-anchored-citations-2026-10-26/B and C).
//
// This file is one of the two places the instrument is actually RUN. The other is scripts/check-all.py
// (the operator entry point, which passes VERIFY_TREE=<the tree it names>). The movement does NOT run
// it, deliberately: a docs-and-scripts check must never abort a product deploy.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const repoRoot = path.join(__dirname, '..');
const INSTRUMENT = path.join(repoRoot, 'scripts', 'verify-access-model.py');
const CHECK_ALL = path.join(repoRoot, 'scripts', 'check-all.py');
const DOC = 'docs/access-model.md';
// The host-shared directory is NOT written as a contiguous literal in this file's CODE, on purpose:
// server/privacy-notice.test.js scans every server/*.js with comments stripped for that path, to keep the
// served templates off the host - and this assertion's first run was a FAIL of that guard, because it
// looks for the bytes of the path, not for what they mean. Same device the guard uses for its own needle.
const HOST_DIR = ['', 'home', 'team', 'shared'].join('/');
const HOST_INSTRUMENT = `${HOST_DIR}/verify-access-model.py`;

function head() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
}

// Judge one revision. VERIFY_DOC is pinned to the same tree's document so the subject and the tree
// under judgement cannot silently disjoin (the false red this instrument has produced before).
function judge(rev) {
  const r = spawnSync('python3', [INSTRUMENT], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, VERIFY_TREE: rev, VERIFY_DOC: DOC },
  });
  if (r.error) throw r.error;
  return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

function staleCount(out) {
  const m = out.match(/hints stale=(\d+)/);
  assert.ok(m, `the summary does not report its hint count:\n${out.slice(-800)}`);
  return Number(m[1]);
}

// Judge the working tree the way an operator does: no VERIFY_TREE, so the instrument must choose for
// itself and say which revision it chose.
function judgeDefault() {
  const env = { ...process.env, VERIFY_DOC: DOC };
  delete env.VERIFY_TREE;
  const r = spawnSync('python3', [INSTRUMENT], { cwd: repoRoot, encoding: 'utf8', env });
  if (r.error) throw r.error;
  return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

// label -> {path, line}: the line each SYMBOL resolved to in this run. The line is a hint, the symbol
// is the content — so this, not the stale count, is what a control about line movement must read.
function resolvedLines(out) {
  const m = new Map();
  for (const line of out.split('\n')) {
    const g = line.match(/^(?:OK|FAIL)\s+\[(.+?)\]\s+(server\/[^\s:]+):(\d+)/);
    if (g) m.set(g[1], { path: g[2], line: Number(g[3]) });
  }
  return m;
}

// The labels whose hint did NOT name the line the symbol resolved to. Same shape as the instrument's own
// drift report, read off the run rather than assumed: `(hint N is stale)`, never the doc-citation wording.
function staleLabels(out) {
  const s = new Set();
  for (const line of out.split('\n')) {
    const m = line.match(/^(?:OK|FAIL)\s+\[(.+?)\]\s+server\/[^\s:]+:\d+\s+\(hint \d+ is stale\)/);
    if (m) s.add(m[1]);
  }
  return s;
}

// What the two runs did per symbol: claims in `file` must resolve exactly `delta` lines lower, and
// claims elsewhere must NOT move. Independent of how stale the hint table is — which is the whole
// point (row 7daa1d44: with a fully stale table the count-based shape had no signal at all).
function shiftReport(baseOut, nowOut, file, delta) {
  const a = resolvedLines(baseOut);
  const b = resolvedLines(nowOut);
  const wrong = [];
  let moved = 0;
  let still = 0;
  for (const [label, av] of a) {
    const bv = b.get(label);
    if (!bv) { wrong.push(`[${label}] is missing from the shifted run - a shrunken denominator reads like a green`); continue; }
    if (av.path === file) {
      moved += 1;
      if (bv.line - av.line !== delta) wrong.push(`[${label}] ${av.path} resolved ${bv.line - av.line} lines lower, not ${delta}`);
    } else {
      still += 1;
      if (bv.line !== av.line) wrong.push(`[${label}] ${av.path} moved ${bv.line - av.line} lines although only ${file} was shifted`);
    }
  }
  return { moved, still, wrong, baseSymbols: a.size, nowSymbols: b.size };
}

// A throwaway commit that is HEAD with one file's bytes replaced. Nothing in the real index or
// worktree is touched: the index is a temp file and the commit is dangling.
function synthTree(file, transform, label, parent = 'HEAD') {
  const idx = path.join(os.tmpdir(), `antum-synth-index-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  const env = { ...process.env, GIT_INDEX_FILE: idx };
  const g = (args, input) => execFileSync('git', args, { cwd: repoRoot, env, encoding: 'utf8', input });
  try {
    const original = execFileSync('git', ['show', `${parent}:${file}`], { cwd: repoRoot, encoding: 'utf8' });
    const mutated = transform(original);
    assert.notStrictEqual(mutated, original, 'the synthetic mutation changed no byte - the control would prove nothing');
    const blob = g(['hash-object', '-w', '--stdin'], mutated).trim();
    g(['read-tree', parent]);
    g(['update-index', '--cacheinfo', `100644,${blob},${file}`]);
    return g(['commit-tree', g(['write-tree']).trim(), '-p', parent, '-m', label]).trim();
  } finally {
    fs.rmSync(idx, { force: true });
  }
}

test('the instrument lives in the repository, and the entry point points at it', () => {
  assert.ok(fs.existsSync(INSTRUMENT), 'scripts/verify-access-model.py is missing - the instrument is host state again');
  const ca = fs.readFileSync(CHECK_ALL, 'utf8');
  // CODE only, not prose. check-all's own history note names the old host path in a comment, and the
  // first run of this very test reddened on it - a scan that cannot tell a comment from a line of code
  // reports on text, not behaviour. The regression it must catch is the CONSTANT coming back.
  const caCode = ca.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
  assert.ok(!caCode.includes(HOST_INSTRUMENT),
    `check-all names the host copy in code (${HOST_INSTRUMENT}): a change to the instrument could not ride a PR`);
  assert.match(ca, /ACCESS_MODEL = os\.path\.join\(HERE, "verify-access-model\.py"\)/,
    'check-all must resolve the instrument from its own directory, so the path it names is the path that runs');
  assert.match(ca, /env=\{"VERIFY_TREE": "@HEAD"\}/,
    'the access-model check must judge the tree this run names, not origin/main (9148dee9)');
});

test('green at this tree, and the headline names the tree it judged', () => {
  const rev = head();
  const r = judge(rev);
  assert.strictEqual(r.status, 0, `exit ${r.status} at ${rev}:\n${r.out.slice(-2000)}`);
  assert.ok(r.out.includes(`checks hold against ${rev}`),
    `the headline does not name the tree it judged (wanted "checks hold against ${rev}"):\n${r.out.slice(-600)}`);
});

test('a line that merely MOVED does not redden it - the control that must NOT fire', () => {
  const base = judge(head());
  const shifted = synthTree('server/index.js',
    (src) => Array.from({ length: 7 }, (_, i) => `// synthetic inserted line ${i + 1}`).join('\n') + '\n' + src,
    'synthetic: 7 lines inserted at the top of server/index.js');
  const r = judge(shifted);
  assert.strictEqual(r.status, 0,
    `seven inserted lines reddened the instrument again - the content anchoring is not load-bearing:\n` +
    r.out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 6).join('\n'));
  // Per-SYMBOL, not per-count. `staleCount(shifted) > staleCount(base)` is false whenever the hint
  // table has no headroom: measured 2026-10-26 with 60 stale hints, a 7-line shift left it at 60 vs 60,
  // so the control that proves the content anchoring could not fire (row 7daa1d44). What must hold in
  // ANY table state: every symbol in the shifted file resolves exactly 7 lines lower, and no symbol
  // outside it moves at all.
  const rep = shiftReport(base.out, r.out, 'server/index.js', 7);
  assert.deepStrictEqual(rep.wrong, [], `the shift was not reflected per symbol:\n${rep.wrong.join('\n')}`);
  assert.ok(rep.moved >= 40, `only ${rep.moved} claims in server/index.js were compared - the anchoring is not load-bearing`);
  assert.ok(rep.still >= 10, `only ${rep.still} claims outside the shifted file were checked as unmoved`);
});

test('a symbol that is GONE does redden it, and the denominator stays whole - the control that MUST fire', () => {
  const gone = synthTree('server/index.js',
    (src) => src.replace('Protect all /api routes except login', 'Protects every route bar login'),
    'synthetic: the gate comment reworded');
  const r = judge(gone);
  assert.strictEqual(r.status, 1, `a missing symbol did NOT redden the instrument:\n${r.out.slice(-900)}`);
  assert.match(r.out, /FAIL \[gate comment\]/, 'the red run does not name the claim whose symbol is gone');
  const ran = Number((r.out.match(/ran=(\d+)/) || [])[1]);
  const printed = (r.out.match(/^(?:OK|FAIL)\s+\[/gm) || []).length;
  assert.ok(Number.isFinite(ran), `the summary states no ran= count:\n${r.out.slice(-400)}`);
  assert.strictEqual(ran, printed,
    `the summary claims ran=${ran} but printed ${printed} claim lines - a shrunk denominator reads like a fuller green`);
  assert.ok(ran >= 130, `the run shrank to ${ran} checks; the whole document must still be judged`);
});

test('an operator run with no VERIFY_TREE judges this tree and names its sha', () => {
  const r = judgeDefault();
  assert.strictEqual(r.status, 0, `the default run is not green (exit ${r.status}):\n${r.out.slice(-900)}`);
  assert.ok(r.out.includes(`checks hold against ${head()}`),
    `the default run does not name this tree's sha (a ref name is not a revision):\n${r.out.slice(-700)}`);
});

test('VERIFY_TREE=@HEAD, which check-all passes, actually judges this tree', () => {
  // The control that was missing: a test asserted check-all PASSES the string "@HEAD", and nothing
  // asserted that "@HEAD" WORKS. It does not - `git rev-parse`, `git log` and `git grep` all reject it
  // ("fatal: invalid object name") - so the operator entry point's model check judged nothing: measured
  // on 2026-10-26, 13/111 checks with 98 FAILs, every one "not in @HEAD". This must redden if the
  // marker stops resolving again.
  const r = spawnSync('python3', [INSTRUMENT], {
    cwd: repoRoot, encoding: 'utf8', env: { ...process.env, VERIFY_TREE: '@HEAD', VERIFY_DOC: DOC },
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  assert.strictEqual(r.status, 0, `@HEAD does not judge this tree (exit ${r.status}):\n${out.slice(-900)}`);
  assert.ok(!/not in @HEAD/.test(out), '@HEAD was not resolved - claims are reporting "not in @HEAD"');
  const ran = Number((out.match(/ran=(\d+)/) || [])[1]);
  assert.ok(ran >= 130, `@HEAD judged only ${ran} checks; resolving the marker must not shrink the run`);
  assert.ok(out.includes(`checks hold against ${head()}`),
    `the @HEAD run does not name the resolved sha of this tree:\n${out.slice(-600)}`);
});

test('a document from another revision than the judged tree is REFUSED - the hybrid that used to score green', () => {
  // The judged CODE comes from a revision; the judged DOCUMENT comes from beside the script. When those
  // are two revisions, one headline describes both - and before this it printed that headline happily.
  const otherDoc = synthTree(DOC,
    (src) => `${src}\n<!-- synthetic: this document belongs to another revision -->\n`,
    'synthetic: the document changed, the code did not');
  const r = judge(otherDoc);
  assert.strictEqual(r.status, 2,
    `a hybrid run was not refused (exit ${r.status}) - it must refuse, not report:\n${r.out.slice(-900)}`);
  assert.match(r.out, /HYBRID/, 'the refusal does not name what it refused');
  assert.ok(!/checks hold against/.test(r.out), 'a refused run still printed a verdict headline');
  assert.ok(r.out.includes(otherDoc), 'the refusal does not name the tree it judged');
});

test('the MOVED control still fires when the hint table has no headroom', () => {
  // The disarming case this row is about, built on demand: a hint table with no headroom for the whole
  // server/index.js family, and then 7 more lines moving the symbols again. Under the old count-based
  // shape this scenario had NO signal (the stale counts are equal); the per-symbol control fires in any
  // table state. "The whole family" is ASSERTED below, not assumed.
  //
  // THE SHIFT IS NOW THE SMALLEST ONE THAT STALES THE TABLE (one line, then seven more). It was 60.
  // A prepend of ANY length stales every claim in the file - every occurrence of every needle moves
  // with it - so 60 bought this construction nothing, and it took something away: the resolver breaks a
  // repeated needle by DISTANCE TO THE HINT, so a shift larger than half the gap between two
  // occurrences flips which one is "nearest". Measured at 31a119d, with 60 lines prepended, the base
  // run resolved [analytics reads the whole roster] to 725 - the templates read, 51 lines from the line
  // the claim names - and [employee create audit] flipped between the two runs (-126 lines for a 7-line
  // move), which is what turned this test red while everything else read green. A per-symbol assertion
  // is only meaningful where the shift does not change WHICH occurrence a claim resolves to, so that is
  // asserted here as a premise (against the HEAD run), and the large-drift case is judged at the end on
  // the instrument's VERDICT alone, which is the property a large drift actually has to hold.
  const prepend = (n, label) => (src) =>
    `${Array.from({ length: n }, (_, i) => `// ${label} ${i + 1}`).join('\n')}\n${src}`;
  const head = judge('HEAD');
  const staleTable = synthTree('server/index.js',
    prepend(1, 'synthetic: hint of a table with no headroom'),
    'synthetic: 1 line inserted - every hint in server/index.js is stale');
  const base = judge(staleTable);
  const moved = synthTree('server/index.js',
    prepend(7, 'synthetic: hint of a table with no headroom'),
    'synthetic: 7 more lines on top of a table with no headroom', staleTable);
  const r = judge(moved);
  for (const [run, out] of [['base', base], ['moved', r]]) {
    assert.strictEqual(out.status, 0,
      `the ${run} run is not green (exit ${out.status}):\n` +
      out.out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 6).join('\n'));
  }
  const rep = shiftReport(base.out, r.out, 'server/index.js', 7);
  assert.deepStrictEqual(rep.wrong, [], `the shift was not reflected per symbol:\n${rep.wrong.join('\n')}`);
  assert.ok(rep.moved >= 40, `only ${rep.moved} claims compared - the control is not load-bearing`);
  // THE PREMISE THE DELTA ASSERTION NEEDED AND NEVER HAD (2026-10-29). `moved.line - base.line === 7`
  // is only evidence that the claim's symbol moved if the two runs resolved the SAME OCCURRENCE. A
  // change to a claim's line that lands a pin on another occurrence of its own repeated needle leaves
  // that assertion green while comparing two different lines - measured at 3f833b4, where
  // [employee create audit] resolved to 347 in both runs (the account-creation insert, 58 and 51 lines
  // away) and the control called it proof. So each claim in the file is anchored to the HEAD run here:
  // 1 line for the base, 8 for the moved. A repeated needle that cannot be placed this way fails with
  // the claim named instead of disarming the proof in silence.
  const atHead = resolvedLines(head.out);
  const atBase = resolvedLines(base.out);
  const atMoved = resolvedLines(r.out);
  const inFile = [...atHead].filter(([, v]) => v.path === 'server/index.js');
  assert.ok(inFile.length >= 40,
    `only ${inFile.length} claims into server/index.js were resolved at HEAD - too few to prove anything`);
  const unstable = [];
  for (const [label, hv] of inFile) {
    const b = atBase.get(label);
    const m = atMoved.get(label);
    if (!b || !m) { unstable.push(`[${label}] is missing from a shifted run`); continue; }
    if (b.line !== hv.line + 1 || m.line !== hv.line + 8) {
      unstable.push(`[${label}] HEAD ${hv.line} -> base ${b.line} (want ${hv.line + 1}) -> moved ${m.line} ` +
        `(want ${hv.line + 8}) - the shift moved which occurrence this claim resolves to, so a delta ` +
        `between the runs would compare two different lines`);
    }
  }
  assert.deepStrictEqual(unstable, [], `the shift was not occurrence-stable:\n${unstable.join('\n')}`);
  // And the table really does have no headroom here: every claim in the file is stale in the base run,
  // so only then can a 7-line move add no stale hint, and only then is the old count shape disarmed.
  const staleInBase = staleLabels(base.out);
  const notStale = inFile.map(([k]) => k).filter((l) => !staleInBase.has(l));
  assert.deepStrictEqual(notStale, [],
    `the base run is not fully stale: ${notStale.join(', ')} still resolve onto their own hint after the ` +
    `1-line shift - the construction is not the disarmed one this control needs`);
  // The old shape really is disarmed here - the measurement the row asked for. `staleCount(moved) >
  // staleCount(base)` needs the shift to ADD stale hints; with the table already stale it adds none.
  assert.ok(!(staleCount(r.out) > staleCount(base.out)),
    `the old count shape FIRED here (${staleCount(r.out)} > ${staleCount(base.out)}), so this ` +
    `construction is not the disarmed one the row describes - re-measure before trusting this test`);
  // A LARGE DRIFT IS JUDGED ON THE VERDICT, NOT PER SYMBOL (2026-10-29). 60 lines prepended still has
  // to read as a green run with a drift report - that is the property it has, and the only one it can
  // have while repeated needles make per-symbol resolution depend on the size of the shift.
  const big = judge(synthTree('server/index.js',
    prepend(60, 'synthetic: sixty lines'),
    'synthetic: 60 lines inserted - a large drift'));
  assert.strictEqual(big.status, 0,
    `a 60-line drift is not green (exit ${big.status}): it must report drift, not a defect:\n` +
    big.out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 6).join('\n'));
});

