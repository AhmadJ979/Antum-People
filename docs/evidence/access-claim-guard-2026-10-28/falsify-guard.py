#!/usr/bin/env python3
"""Falsify the served-access-claim guard, and restore the tree byte-exactly.

Run from the repository root:

    python3 docs/evidence/access-claim-guard-2026-10-28/falsify-guard.py A   # old sentence back
    python3 docs/evidence/access-claim-guard-2026-10-28/falsify-guard.py     # all three, then restore

Each mutation rewrites ONLY the `const VIEW_NOTE = ...;` statement of
server/preboarding-workspace.js, runs the guard under its documented command, writes the raw log to
this directory, then restores the file from the in-memory copy taken before the first mutation and
prints the md5 of the restored file next to the md5 taken before the run. The two must be equal:
that is what makes the committed tree the measured tree.

A mutation that does not redden the guard is a finding about the guard, not about the sentence.
"""
import hashlib
import io
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
WS = os.path.join(REPO, 'server', 'preboarding-workspace.js')
GUARD = 'preboarding-access-claim.test.js'
EVIDENCE = os.path.dirname(os.path.abspath(__file__))

OLD_SENTENCE = """const VIEW_NOTE = 'This narrows the board to one function. It is a filter, not access control: '
  + 'everyone signed in can still open any case and see every line. Per-user scoping — "My lines" '
  + '— ships with per-user accounts at Layer 3.';"""

DROP_A_ROLE = """const VIEW_NOTE = 'This narrows the board to one function. It is a filter, not access control: it '
  + 'changes which lines are drawn, never who may open a case. Opening a case is decided by the '
  + 'policy gate on the resource preboarding:read:own, whose cell holds hr_admin alone — a signed-in '
  + 'manager, employee or compliance_viewer is refused before this board is built. Every caller who '
  + 'reaches it can open every case; a per-person read is not built: nothing joins a pre-boarding '
  + 'case to a person, and whether this board belongs on that view at all is open with counsel.';"""

NAMED_NOT_REFUSED = """const VIEW_NOTE = 'This narrows the board to one function. It is a filter, not access control: it '
  + 'changes which lines are drawn, never who may open a case. Opening a case is decided by the '
  + 'policy gate on the resource preboarding:read:own; a signed-in manager, finance, employee or '
  + 'compliance_viewer opens the board alongside hr_admin. A per-person read is not built yet: '
  + 'nothing joins a pre-boarding case to a person.';"""

MUTATIONS = {
    'A': ('old-sentence-back', OLD_SENTENCE),
    'B': ('role-dropped-from-note', DROP_A_ROLE),
    'C': ('role-not-refused', NAMED_NOT_REFUSED),
}


def md5(text):
    return hashlib.md5(text.encode('utf-8')).hexdigest()


def stamp():
    return subprocess.run(['date', '-u', '+%H%MZ'], capture_output=True, text=True).stdout.strip()


def run_one(name, note, head, tail):
    io.open(WS, 'w', encoding='utf-8').write(head + note + tail)
    res = subprocess.run(['node', '--test', GUARD], cwd=os.path.join(REPO, 'server'),
                         capture_output=True, text=True)
    out = res.stdout + res.stderr
    log = os.path.join(EVIDENCE, 'guard-falsified-%s-%s.txt' % (name, stamp()))
    io.open(log, 'w', encoding='utf-8').write(out)
    counts = dict(re.findall(r'^# (tests|pass|fail) (\d+)$', out, re.M))
    print('%-28s exit %d  tests=%s pass=%s fail=%s  -> %s'
          % (name, res.returncode, counts.get('tests'), counts.get('pass'), counts.get('fail'),
             os.path.basename(log)))
    if res.returncode == 0:
        print('  *** DID NOT REDDEN: the guard did not notice this mutation ***')
    return res.returncode


def main():
    wanted = sys.argv[1:] or list(MUTATIONS)
    original = io.open(WS, encoding='utf-8').read()
    before = md5(original)
    start = original.index('const VIEW_NOTE = ')
    end = original.index('\nclass PreboardingWorkspaceError')
    head, tail = original[:start], original[end:]
    try:
        for key in wanted:
            name, note = MUTATIONS[key]
            run_one(name, note, head, tail)
    finally:
        io.open(WS, 'w', encoding='utf-8').write(original)
    after = md5(io.open(WS, encoding='utf-8').read())
    print('restored: %s == %s -> %s' % (before, after, before == after))
    return 0 if before == after else 1


if __name__ == '__main__':
    sys.exit(main())
