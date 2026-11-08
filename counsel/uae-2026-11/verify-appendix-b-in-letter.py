#!/usr/bin/env python3
"""Judge Appendix B as it now sits INSIDE the two UAE counsel letter copies.

Why this file exists: the draft (`uae-appendix-b-checklist-strings.md`) has its own verifier, which
judges the DRAFT. Once the appendix was copied into the letter, nothing judged the copy a reader
will actually send -- a letter can drift from the draft, and a quoted string can be retyped "close
enough". This checks the letter, not the draft.

What it asserts, in the letter AND its `--send-ready.txt` twin:
  1. exactly 4 B-rows, one per line number of `server/compliance_engine.js` that carries a citation;
  2. each row's quoted string is BYTE-IDENTICAL to that line's `description` field in the source;
  3. each row asks the identical single question;
  4. Appendix A is intact (18 U-rows) and the letter still has its 7 numbered items;
  5. the two copies carry the same four strings (neither can drift from the other).

It exits 1 on any failure and prints counts, never a bare verdict. `--selftest` mutates a COPY (an
en dash turned into a hyphen, a line number moved, a row deleted) and requires a red for each -- a
check that cannot redden proves nothing.

WHERE IT LIVES (re-grounded 2026-11-08, when it moved into the repository). Every path it
reads is resolved from THIS FILE, never from a hardcoded /home/team/shared prefix, so it
judges the tree it is checked out in: the two letters sit beside it in
counsel/uae-2026-11/, and server/compliance_engine.js is two levels up in the same worktree.

It is NOT the same instrument as `appendix-b-verify.py` in the same directory, and neither
is a superset of the other: that one judges the DRAFT (the checklist-strings doc) against
the engine; this one judges the COPY THAT GETS SENT. Different subjects, different checks.

Usage:
    python3 counsel/uae-2026-11/verify-appendix-b-in-letter.py [--selftest]
"""

import re
import sys
import tempfile
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
LETTERS = [
    os.path.join(HERE, 'uae-counsel-confirmation-request.md'),
    os.path.join(HERE, 'uae-counsel-confirmation-request--send-ready.txt'),
]
SOURCE = os.path.join(REPO, 'server', 'compliance_engine.js')
# The four lines of the UAE offboarding block that carry an article number or a stated deadline.
LINES = (22, 23, 26, 27)
QUESTION = 'Which article governs this, or is the claim wrong?'


def served_strings(source_path=SOURCE):
    lines = open(source_path, encoding='utf-8').read().splitlines()
    out = {}
    for n in LINES:
        m = re.search(r"description: '([^']*)'", lines[n - 1])
        assert m, f'no description on {source_path}:{n} - the line moved; re-measure before trusting this'
        out[n] = m.group(1)
    return out


def judge(path, want):
    """Returns (ok_count, failures[list of str])."""
    text = open(path, encoding='utf-8').read()
    failures = []
    ok = 0

    rows = [l for l in text.splitlines() if re.match(r'^\| B[1-4] \|', l)]
    if len(rows) != len(LINES):
        failures.append(f'{len(rows)} B-row(s), expected {len(LINES)}')
    seen = {}
    for line in rows:
        if len(line.split('|')) != 7:
            failures.append(f'row does not have 5 cells: {line[:60]!r}')
            continue
        tag, where, _title, quoted, question = [c.strip() for c in line.strip('|').split('|')]
        m = re.search(r':(\d+)`?$', where)
        if not m:
            failures.append(f'{tag}: no file:line in {where!r}')
            continue
        n = int(m.group(1))
        if n not in want:
            failures.append(f'{tag}: cites line {n}, which is not one of the four citation-bearing lines')
            continue
        got = quoted.strip('"')
        if got != want[n]:
            failures.append(f'{tag} :{n}: quoted string is not the served string\n    letter: {got!r}\n    served: {want[n]!r}')
        else:
            ok += 1
        if question != QUESTION:
            failures.append(f'{tag}: question is not the one identical question: {question!r}')
        else:
            ok += 1
        seen[n] = got
    missing = [n for n in LINES if n not in seen]
    if missing:
        failures.append(f'no row for line(s) {missing}')

    urows = len([l for l in text.splitlines() if re.match(r'^\| U\d+ \|', l)])
    if urows != 18:
        failures.append(f'Appendix A has {urows} row(s), expected 18 - the appendix edit touched it')
    else:
        ok += 1
    items = len([l for l in text.splitlines() if re.match(r'^(\d+\. |\*\*\d+\. )', l)])
    if items != 7:
        failures.append(f'letter has {items} numbered item(s), expected 7 - something was renumbered')
    else:
        ok += 1
    return ok, failures, seen


def run(letters=LETTERS, source=SOURCE):
    want = served_strings(source)
    total_ok = 0
    all_fail = []
    per_file = {}
    for path in letters:
        ok, failures, seen = judge(path, want)
        total_ok += ok
        per_file[path] = seen
        for f in failures:
            all_fail.append(f'{os.path.basename(path)}: {f}')
    if len(per_file) == 2:
        a, b = list(per_file.values())
        if a != b:
            all_fail.append('the two letter copies do not carry the same four strings')
        else:
            total_ok += 1
    return total_ok, all_fail


def selftest():
    """Mutate a copy of the letter and require a RED for each mutation."""
    base = LETTERS[0]
    text = open(base, encoding='utf-8').read()
    # NOTE: the B1 fragment appears TWICE in the letter -- once in the appendix row, once in the body
    # prose that describes it. A plain str.replace(..., 1) hits the BODY first and leaves the row intact,
    # which is a mutant aimed at the wrong line and scores a false green (measured 2026-11-04). The
    # mutations below therefore rebuild or target the ROW itself.
    def mutate_row(t):
        out = []
        for line in t.splitlines(keepends=True):
            if line.startswith('| B1 |'):
                line = line.replace('30–90 days per contract', '30-90 days per contract')
            out.append(line)
        return ''.join(out)

    cases = {
        'en dash typed as a hyphen inside the B1 row': mutate_row(text),
        'a row line number moved by one': text.replace('compliance_engine.js:22', 'compliance_engine.js:21', 1),
        'a row deleted': '\n'.join(l for l in text.splitlines() if not l.startswith('| B3 |')) + '\n',
        'a question reworded': text.replace(QUESTION, 'What article applies?', 1),
    }
    red = green = 0
    for name, mutated in cases.items():
        assert mutated != text, f'mutant {name!r} changed nothing - the mutation itself is broken'
        with tempfile.NamedTemporaryFile('w', suffix='.md', delete=False, encoding='utf-8') as fh:
            fh.write(mutated)
            tmp = fh.name
        try:
            _ok, failures = run(letters=[tmp], source=SOURCE)
        finally:
            os.unlink(tmp)
        if failures:
            red += 1
            print(f'ok     knows red: {name} -> {failures[0].splitlines()[0]}')
        else:
            green += 1
            print(f'FAILED cannot redden: {name} - the mutant scored green')
    print(f'\nselftest: {red} mutation(s) caught, {green} not caught')
    return 0 if green == 0 else 1


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        sys.exit(selftest())
    ok, failures = run()
    for f in failures:
        print(f'FAIL {f}')
    print(f'\nchecks passed: {ok}')
    print(f'failures: {len(failures)}')
    print('VERDICT: ' + ('Appendix B in the letters is verbatim and intact. exit 0' if not failures
                         else 'Appendix B in the letters is not what it claims. exit 1'))
    sys.exit(0 if not failures else 1)
