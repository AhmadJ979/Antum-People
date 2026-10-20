/**
 * The ONE entry point for every check the team owns has to do two things a reader cannot
 * verify by eye: (1) hand an operator every check in one command, and (2) PRINT the
 * difference between "this check is red because the tree is in a recorded defect state" and
 * "this check is red because someone broke something". This file gates exactly that.
 *
 * Why a gate here at all: `scripts/check-all.py` is the operator's form, but a control the
 * operator reaches only by hand, and that nothing asserts, is the same defect class this
 * entry point exists to close - the plan's line is *a check that cannot redden proves
 * nothing*. So:
 *   1. the script and the checks it names exist (a green run over a missing file is nothing);
 *   2. its classifier self-test passes - every case of the mapping, including the two the
 *      verdict depends on (RED-KNOWN must NOT fail the run; STALE-EXCEPTION MUST);
 *   3. on a DOCTORED COPY of this tree it reddens, names the check that broke AND the
 *      document whose index row went missing - with the copy GREEN at baseline first, so
 *      the reddening is a difference and not a property of the copy;
 *   4. a declaration that has gone stale FAILS the run: flip one GREEN check to known-red
 *      and the entry point must print STALE-EXCEPTION and exit non-zero, because an
 *      exception that no longer fires is a lie about the tree;
 *   5. the third exit code is real from the operator's side: the citation checker in a
 *      directory with no git above it must REFUSE (exit 2, "REFUSED"), never report the
 *      vacuous `0 ok, 0 FAILING` it would otherwise print over an empty document list.
 *
 * The suite is skipped inside these runs (`--no-suite`) and each run is narrowed with
 * `--only`: this file is itself part of the suite, so a gate that re-runs its own suite
 * would recurse, and a doctored copy without git object history would redden unrelated
 * checks for reasons of its own - narrowing keeps each assertion about the thing it names.
 *
 * TWO MEASURED TRAPS this file is written around, both of which produced a false green here
 * before they were fixed:
 *   - running THIS repository's `scripts/check-all.py` with `cwd` set to the copy. The script
 *     derives its root from its own `__file__`, so it judged the real tree and reported it
 *     green while the doctored copy was never looked at. The copy's OWN script must be run.
 *   - trusting a check's LAST line. The index check's last line is `FAIL: see the lists
 *     above`; the list naming the lost document is five lines higher. The entry point now
 *     prints a bounded tail for a red check, and this file asserts the NAME, not the FAIL.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.join(__dirname, '..');
const CHECK_ALL = path.join(repoRoot, 'scripts', 'check-all.py');
const CITE = 'docs/evidence/no-403-claim-sweep-2026-10-20/check-doc-citations.py';

/** Run a python script - by default this repository's check-all.py - and return {status, out}
 *  without throwing (the last test runs the citation checker through the same helper). */
function run(args, cwd, script) {
  try {
    const out = execFileSync('python3', [script || CHECK_ALL, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
    return { status: 0, out };
  } catch (err) {
    return { status: err.status === undefined ? -1 : err.status, out: (err.stdout || '') + (err.stderr || '') };
  }
}

/** A copy of the entry point, the checks it can run without dependencies, and enough of the
 *  tree that the only difference from the real one is what a test doctored. No .git above it. */
function copyTree(tag) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `antum-checkall-${tag}-`));
  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'design-concepts'), path.join(tmp, 'design-concepts'), { recursive: true });
  const citeDir = path.join(tmp, 'docs', 'evidence', 'no-403-claim-sweep-2026-10-20');
  fs.mkdirSync(citeDir, { recursive: true });
  fs.copyFileSync(path.join(repoRoot, CITE), path.join(citeDir, 'check-doc-citations.py'));
  return tmp;
}

test('the entry point and the checks it runs exist (it cannot pass vacuously)', () => {
  assert.ok(fs.existsSync(CHECK_ALL), `${CHECK_ALL} is missing - nothing was checked`);
  for (const p of ['scripts/check-design-concepts-index.py', 'scripts/check-index-ids.py',
                   'scripts/reachability-report.js', CITE]) {
    assert.ok(fs.existsSync(path.join(repoRoot, p)), `${p} is named by the entry point but missing`);
  }
});

test('the classifier self-test passes: every case of the mapping, and which words fail a run', () => {
  const { status, out } = run(['--selftest'], repoRoot);
  assert.strictEqual(status, 0, `the classifier self-test is RED:\n${out}`);
  assert.match(out, /classifier self-test: (\d+)\/\1 cases/, 'the self-test must report every case as passing');
  assert.match(out, /RED-KNOWN\s*\) -> False/, 'RED-KNOWN must NOT fail the run');
  assert.match(out, /STALE-EXCEPTION\) -> True/, 'STALE-EXCEPTION MUST fail the run');
  assert.match(out, /BROKEN\s*\) -> True/, 'BROKEN MUST fail the run');
});

test('a doctored copy: GREEN at baseline, then RED naming the lost index row', () => {
  const tmp = copyTree('red');
  const index = path.join(tmp, 'design-concepts', 'README.md');
  const lines = fs.readFileSync(index, 'utf8').split('\n');
  const rows = lines.map((l, i) => ({ l, i, m: /^\|\s*`([^`]+)`/.exec(l) }))
    .filter((r) => r.m && r.m[1].endsWith('.md'));
  assert.ok(rows.length > 0, 'no .md rows found in the copy - this control would be vacuous');
  const victim = rows[0].m[1];
  const script = path.join(tmp, 'scripts', 'check-all.py');
  try {
    // BASELINE: the same copy, nothing doctored, must be green for THIS check.
    const before = run(['--no-suite', '--only', 'design-concepts-index'], tmp, script);
    assert.strictEqual(before.status, 0, `the copy is red before any doctoring - it is not a control:\n${before.out}`);
    assert.match(before.out, /\[OK\s*\]\s+design-concepts-index/, `baseline must read OK:\n${before.out}`);
    assert.match(before.out, new RegExp(`repository\\s*: ${tmp}`),
      'the run must say which tree it judged - this assertion is what caught it judging the wrong one');

    // THE DOCTORING: one index row dropped.
    fs.writeFileSync(index, lines.filter((_, i) => i !== rows[0].i).join('\n'));

    const after = run(['--no-suite', '--only', 'design-concepts-index'], tmp, script);
    assert.strictEqual(after.status, 1, `a dropped index row did NOT fail the entry point:\n${after.out}`);
    assert.match(after.out, /\[BROKEN\s*\]\s+design-concepts-index/, `the broken check must be named BROKEN:\n${after.out}`);
    assert.ok(after.out.includes(victim),
      `the run must NAME the document whose row went missing (not merely say FAIL); it said:\n${after.out}`);
    assert.match(after.out, /PARTIAL RUN\s*: --only design-concepts-index/,
      'a narrowed run must SAY it is partial - a partial green read as a whole green is the defect itself');
    assert.match(after.out, /VERDICT: .*NOT in a declared state -> design-concepts-index/,
      `the verdict must say this red is undeclared and name it:\n${after.out}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('a declaration that no longer fires FAILS the run (an exception that lies is worse than none)', () => {
  const tmp = copyTree('stale');
  const script = path.join(tmp, 'scripts', 'check-all.py');
  const src = fs.readFileSync(script, 'utf8');
  const needle = 'dict(id="design-concepts-index", mode="default", expect="green",';
  assert.ok(src.includes(needle), 'the anchor for this control moved - fix the test, do not weaken it');
  fs.writeFileSync(script, src.replace(needle, needle.replace('expect="green"', 'expect="known-red"')));

  try {
    const { status, out } = run(['--no-suite', '--only', 'design-concepts-index'], tmp, script);
    assert.strictEqual(status, 1, `a known-red declaration over a GREEN check did not fail the run:\n${out}`);
    assert.match(out, /\[STALE-EXCEPTION\]\s+design-concepts-index/,
      `the stale declaration must be reported as STALE-EXCEPTION naming the check:\n${out}`);
    assert.match(out, /VERDICT: .*NOT in a declared state.*design-concepts-index/,
      'a stale declaration must appear in the failing verdict, not be tolerated');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('no git above it: the citation checker REFUSES (exit 2) instead of reporting a vacuously clean run', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'antum-checkall-nogit-'));
  try {
    const dest = path.join(tmp, 'check-doc-citations.py');
    fs.copyFileSync(path.join(repoRoot, CITE), dest);
    const { status, out } = run([], tmp, dest);
    assert.strictEqual(status, 2, `with no git working tree it must refuse, not report a clean:\n${out}`);
    assert.match(out, /REFUSED/, `the refusal must say REFUSED:\n${out}`);
    assert.doesNotMatch(out, /FAILING/, 'a refusal is not a verdict about citations - it must not print one');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
