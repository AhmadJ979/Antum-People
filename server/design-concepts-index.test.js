/**
 * The design-concepts index is an INVENTORY, and this makes the inventory a GATE.
 *
 * What it guards, and why the suite is the right home: the defect no citation checker can see is a
 * merge that DROPS an index row while no number anywhere moves. `design-concepts/README.md` lists
 * one row per document, and nothing else reads that register - so the moment to catch a missing row
 * is the merge result, which is the read this suite is. (The movement is deliberately NOT asked to
 * check it: an index row is not a precondition for shipping served bytes, and a docs-only delta owes
 * no movement - see `scripts/check-design-concepts-index.py`, which states that in its own output.)
 *
 * Two things are asserted here, and the second is the one that makes the first mean anything:
 *   1. the check is GREEN on the tree it judges, run BARE (the operator's form - no arguments, no
 *      --root): a check the operator cannot reach is a false green, and a check that needs a flag
 *      the operator does not know is one too;
 *   2. the check REDDENS on a doctored copy of that same tree: one row dropped, and the run must
 *      fail *and name the document it lost*. Without this the suite would only prove that a script
 *      exits 0 - and a check that cannot redden proves nothing.
 *
 * The measurement lives in `scripts/check-design-concepts-index.py`; this file runs it. If the file
 * is renamed, the script's own output names the old path, so the two cannot drift apart silently.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.join(__dirname, '..');
const CHECK = path.join(repoRoot, 'scripts', 'check-design-concepts-index.py');

/** Run the check and return {status, out} without throwing on a non-zero exit. */
function runCheck(args, cwd) {
  try {
    const out = execFileSync('python3', [CHECK, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
    return { status: 0, out };
  } catch (err) {
    return { status: err.status === undefined ? -1 : err.status, out: (err.stdout || '') + (err.stderr || '') };
  }
}

test('the design-concepts index check exists where it says it does (it cannot pass vacuously)', () => {
  assert.ok(fs.existsSync(CHECK), `${CHECK} is missing - nothing was checked`);
  const index = path.join(repoRoot, 'design-concepts', 'README.md');
  assert.ok(fs.existsSync(index), 'design-concepts/README.md is missing - nothing was checked');
  const docs = fs.readdirSync(path.join(repoRoot, 'design-concepts')).filter((f) => f.endsWith('.md'));
  assert.ok(docs.length > 1, 'fewer than two documents found - a green run here would mean nothing');
});

test('the check is green, and runs BARE - the operator\'s form, with no arguments', () => {
  const { status, out } = runCheck([], repoRoot);
  assert.strictEqual(status, 0, `the index check is RED on this tree:\n${out}`);
  assert.match(out, /^OK:/m, 'a green run must say OK in its own output');
  assert.match(out, /tree \S+/, 'a green run must NAME the tree it judged, not imply one');
  assert.match(out, /operator form/, 'a green run must say how an operator reaches it');
});

test('the name of the tree is the tree, not a claim: a copy with one row dropped must FAIL, naming the loss', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'antum-index-gate-'));
  try {
    for (const dir of ['design-concepts', 'scripts']) {
      fs.cpSync(path.join(repoRoot, dir), path.join(tmp, dir), { recursive: true });
    }
    const index = path.join(tmp, 'design-concepts', 'README.md');
    const lines = fs.readFileSync(index, 'utf8').split('\n');
    const rows = lines
      .map((l, i) => ({ l, i, m: /^\|\s*`([^`]+)`/.exec(l) }))
      .filter((r) => r.m && r.m[1].endsWith('.md'));
    assert.ok(rows.length > 0, 'no .md rows found in the copy - this control would be vacuous');
    const victim = rows[0].m[1];
    fs.writeFileSync(index, lines.filter((_, i) => i !== rows[0].i).join('\n'));

    const { status, out } = runCheck(['--root', tmp], repoRoot);
    assert.strictEqual(status, 1, `dropping the row for ${victim} did NOT redden the check:\n${out}`);
    assert.ok(out.includes(victim), `the failing run must NAME the document whose row went missing; it said:\n${out}`);
    assert.match(out, /FAIL/, 'a red run must say FAIL in its own output');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
