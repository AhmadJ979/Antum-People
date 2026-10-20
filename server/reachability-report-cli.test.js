/**
 * THE ANTI-VACUOUS CONTROL, FROM THE OPERATOR'S OWN PATH (row 422a77db).
 *
 * `server/reachability.test.js` plants a caller to an unregistered route and asserts the drift check
 * reddens on it. That control was reachable **only from the test runner**: `scripts/reachability-report.js`
 * — the one script in this repository whose whole job is to fail loudly — parsed no argv at all, so an
 * operator running it with `--extra-root /tmp/probe` got a normal report and **exit 0**. Measured
 * before the fix: the output named neither the flag nor the planted route.
 *
 * A control only the test runner can reach is not the operator's. An instrument the operator cannot
 * redden on purpose is one they can only trust on someone else's word — and the failure it hides is a
 * *green*, which nobody investigates.
 *
 * These tests run the script the way a person does, from a shell, and hold it to three things:
 *   1. an invocation it does not understand is REFUSED (exit 2, usage, and NO report printed) —
 *      because a flag silently ignored is indistinguishable from a clean pass;
 *   2. the control is reachable from the command line and reddens (exit 1, naming the planted site);
 *   3. the ordinary invocation still prints the ordinary report (exit 0 here) — the argv code must not
 *      have bought the operator's path at the cost of the default one.
 *
 * The planted file lives in the OS temp dir, never in this tree: a probe inside the repository would
 * be scanned by the DEFAULT run and make every later measurement wrong.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPORT = path.join(__dirname, '..', 'scripts', 'reachability-report.js');
const run = (...args) => spawnSync(process.execPath, [REPORT, ...args], { encoding: 'utf8' });

/** A directory holding one file with a REAL request-shaped call to a route the server does not register. */
function probeDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reachability-cli-probe-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'planted.js'),
    "authedFetch('/api/definitely-not-registered');\n");
  return dir;
}

test('the report REFUSES an invocation it does not understand, and prints no report', () => {
  for (const args of [['--nope'], ['--extra-root'], ['stray-positional']]) {
    const r = run(...args);
    const why = `args=${JSON.stringify(args)}`;
    assert.notStrictEqual(r.status, 0, `${why}: a wrong invocation must not exit 0`);
    assert.strictEqual(r.status, 2, `${why}: the invocation fault has its own exit code`);
    assert.ok(r.stderr.includes('Usage: node scripts/reachability-report.js'),
      `${why}: the operator is told how to invoke it`);
    // The whole point: no summary, no green sentence, no partial report — nothing that could be read
    // as "the tree is clean" by someone whose command was never understood.
    assert.ok(!r.stdout.includes('REGISTER SUMMARY'),
      `${why}: a refused invocation must not print the report`);
    assert.ok(!r.stdout.includes('Nothing new'),
      `${why}: a refused invocation must not print a green line`);
  }
});

test('a root that does not exist is refused rather than scanned', () => {
  const r = run('--extra-root', path.join(os.tmpdir(), 'reachability-cli-does-not-exist'));
  assert.strictEqual(r.status, 2, 'an unreadable root scans nothing and prints the same green as a clean tree');
  assert.ok(!r.stdout.includes('REGISTER SUMMARY'));
});

test('ANTI-VACUOUS CONTROL, OPERATOR-REACHABLE: the planted caller reddens the report', (t) => {
  const dir = probeDir(t);
  const r = run('--extra-root', dir);
  assert.ok(r.stdout.includes('also scanning: ' + dir),
    'the report says which roots it actually scanned — the flag was HEARD, not assumed');
  assert.ok(r.stdout.includes('/api/definitely-not-registered'),
    'the planted site is named in the output');
  assert.strictEqual(r.status, 1,
    'a callerless route found by this run is a NEW finding: exit 1, the same condition the test fails on');
  assert.ok(r.stdout.includes('NEW finding'), 'and the closing line says so');
});

test('the control is load-bearing: without the flag the planted caller is not found', (t) => {
  const dir = probeDir(t);
  const withFlag = run('--extra-root', dir);
  const without = run();
  assert.ok(withFlag.stdout.includes('/api/definitely-not-registered'));
  assert.ok(!without.stdout.includes('/api/definitely-not-registered'),
    'the probe is outside the default roots, so the reddening above is caused by the flag');
  assert.notStrictEqual(withFlag.status, without.status,
    'the same probe, the same tree: the flag is what moved the verdict');
});

test('the ordinary invocation still prints the ordinary report, and --help is not a report', () => {
  const plain = run();
  assert.strictEqual(plain.status, 0, 'nothing new on this tree: the default path is unchanged');
  assert.ok(plain.stdout.includes('REGISTER SUMMARY'), 'the summary still prints');
  assert.ok(!plain.stdout.includes('also scanning:'), 'no root was invented');

  const help = run('--help');
  assert.strictEqual(help.status, 0);
  assert.ok(help.stdout.includes('Usage: node scripts/reachability-report.js'));
  assert.ok(!help.stdout.includes('REGISTER SUMMARY'), 'asking for help is not asking for a report');
});
