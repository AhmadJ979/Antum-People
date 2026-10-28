#!/usr/bin/env python3
"""Falsify the watcher-note detection-latency guard, and restore the tree byte-exactly.

Run from the repository root:
    python3 docs/evidence/watcher-note-detection-claim-2026-10-28/falsify-guard.py [STAMP]
    # STAMP is the run stamp used for the green log's name, e.g. 0912Z; defaults to now (UTC)

Three mutations, each asking a different question of the guard built in
`server/watcher-note-detection-claim.test.js`:

    A  probation-old-clause-back   the removed closing clause APPENDED to the escalation note, with
                                   the corrected cadence clause left in place. This is the mutation
                                   that isolates the ABSENCE check: every presence assertion still
                                   passes, so only doesNotMatch / the sweep can catch it.
    B  flag-old-clause-back        the same, in server/preboarding-flag-scheduler.js — the second of
                                   the two served strings, proving ONE guard covers both.
    C  limitation-dropped          the cadence clause kept ("reads … every N minute(s) by design")
                                   with what it cannot see deleted. The sentence is still true-ish and
                                   carries no latency word, so nothing but the named-limitation
                                   assertion can catch it.

Each mutation edits ONLY the sentence under test, and is applied to the ORIGINAL text — never on top
of the previous mutation, because a run carrying two mutations cannot say which one the guard
noticed. The file is restored before the next mutation and again at the end, and the md5 of the
restored file is printed next to the md5 taken before the run: that is what makes the committed tree
the measured tree.

A mutation that does not redden the guard is a finding about the guard, not about the sentence.
"""
import hashlib
import io
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SERVER = os.path.join(REPO, 'server')
EVIDENCE = os.path.dirname(os.path.abspath(__file__))
GUARD = 'watcher-note-detection-claim.test.js'

PROBATION = os.path.join(SERVER, 'probation-escalation.js')
FLAG = os.path.join(SERVER, 'preboarding-flag-scheduler.js')
LOOP = os.path.join(SERVER, 'interval-watcher.js')

MUTATIONS = {
    'A': (
        'probation-old-clause-back', PROBATION,
        '${cadenceClause(ctx.intervalMs || DEFAULT_INTERVAL_MS)}`;',
        '${cadenceClause(ctx.intervalMs || DEFAULT_INTERVAL_MS)} It was seen within '
        '${Math.round((ctx.intervalMs || DEFAULT_INTERVAL_MS) / 60000)} minute(s) of the next tick.`;',
    ),
    'B': (
        'flag-old-clause-back', FLAG,
        '${cadenceClause(ctx.intervalMs)}`;',
        '${cadenceClause(ctx.intervalMs)} It was seen within '
        '${Math.round(ctx.intervalMs / 60000)} minute(s) of the next tick.`;',
    ),
    'C': (
        'limitation-dropped', LOOP,
        "  return `The watcher reads for what has come due every ${minutes} minute(s) by design; it cannot `\n"
        "    + 'see whether its own ticks ran on schedule, so that interval is the intended cadence, not a '\n"
        "    + 'measured detection time.';",
        "  return `The watcher reads for what has come due every ${minutes} minute(s) by design.`;",
    ),
}


def md5(text):
    return hashlib.md5(text.encode('utf-8')).hexdigest()


def run_one(stamp, name, path, old, new, original):
    assert original.count(old) == 1, 'expected exactly one occurrence in %s, found %d' % (path, original.count(old))
    mutated = original.replace(old, new)
    io.open(path, 'w', encoding='utf-8').write(mutated)
    res = subprocess.run(['node', '--test', GUARD], cwd=SERVER, capture_output=True, text=True)
    out = res.stdout + res.stderr
    log = os.path.join(EVIDENCE, 'guard-falsified-%s-%s.txt' % (name, stamp))
    io.open(log, 'w', encoding='utf-8').write(
        '# mutated file: %s\n# mutated md5: %s\n# guard: server/%s\n# command: cd server && node --test %s\n%s'
        % (os.path.relpath(path, REPO), md5(mutated), GUARD, GUARD, out))
    io.open(path, 'w', encoding='utf-8').write(original)  # restore before the next mutation
    counts = dict(re.findall(r'^# (tests|pass|fail) (\d+)$', out, re.M))
    print('%-28s exit %d  tests=%s pass=%s fail=%s  -> %s'
          % (name, res.returncode, counts.get('tests'), counts.get('pass'), counts.get('fail'),
             os.path.basename(log)))
    if res.returncode == 0:
        print('  *** DID NOT REDDEN: the guard did not notice this mutation ***')
    return res.returncode


def main():
    stamp = sys.argv[1] if len(sys.argv) > 1 else subprocess.run(
        ['date', '-u', '+%H%MZ'], capture_output=True, text=True).stdout.strip()
    wanted = sys.argv[2:] or list(MUTATIONS)
    originals = {path: io.open(path, encoding='utf-8').read() for path in (PROBATION, FLAG, LOOP)}
    before = {path: md5(text) for path, text in originals.items()}
    failed = False
    try:
        for key in wanted:
            name, path, old, new = MUTATIONS[key]
            if run_one(stamp, name, path, old, new, originals[path]) == 0:
                failed = True
    finally:
        for path, text in originals.items():
            io.open(path, 'w', encoding='utf-8').write(text)
    for path in (PROBATION, FLAG, LOOP):
        after = md5(io.open(path, encoding='utf-8').read())
        print('restored %-34s %s == %s -> %s'
              % (os.path.basename(path), before[path], after, before[path] == after))
        if before[path] != after:
            failed = True
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
