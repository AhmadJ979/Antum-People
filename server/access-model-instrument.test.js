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

// A throwaway commit that is HEAD with one file's bytes replaced. Nothing in the real index or
// worktree is touched: the index is a temp file and the commit is dangling.
function synthTree(file, transform, label) {
  const idx = path.join(os.tmpdir(), `antum-synth-index-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  const env = { ...process.env, GIT_INDEX_FILE: idx };
  const g = (args, input) => execFileSync('git', args, { cwd: repoRoot, env, encoding: 'utf8', input });
  try {
    const original = execFileSync('git', ['show', `HEAD:${file}`], { cwd: repoRoot, encoding: 'utf8' });
    const mutated = transform(original);
    assert.notStrictEqual(mutated, original, 'the synthetic mutation changed no byte - the control would prove nothing');
    const blob = g(['hash-object', '-w', '--stdin'], mutated).trim();
    g(['read-tree', 'HEAD']);
    g(['update-index', '--cacheinfo', `100644,${blob},${file}`]);
    return g(['commit-tree', g(['write-tree']).trim(), '-p', 'HEAD', '-m', label]).trim();
  } finally {
    fs.rmSync(idx, { force: true });
  }
}

test('the instrument lives in the repository, and the entry point points at it', () => {
  assert.ok(fs.existsSync(INSTRUMENT), 'scripts/verify-access-model.py is missing - the instrument is host state again');
  const ca = fs.readFileSync(CHECK_ALL, 'utf8');
  assert.ok(!ca.includes('/home/team/shared/verify-access-model.py'),
    'check-all still names the host copy: a change to the instrument could not ride a PR');
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
  assert.ok(staleCount(r.out) > staleCount(base.out),
    `the shift was not even reported: stale hints ${staleCount(r.out)} vs base ${staleCount(base.out)}`);
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
