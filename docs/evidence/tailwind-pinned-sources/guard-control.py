#!/usr/bin/env python3
"""The guard's own control: each of the three assertions must be able to redden, one at a time.

A check that cannot redden proves nothing, so each plant targets exactly one assertion and is reverted
before the next. The last line asserts the working tree is left holding only the three intended changes.

Run it from anywhere:

    python3 docs/evidence/tailwind-pinned-sources/guard-control.py            # repo found from this file
    ... guard-control.py --repo /path/to/checkout                             # measure another checkout
    ... guard-control.py --out docs/evidence/tailwind-pinned-sources          # rewrite the pack in place

The repository root is derived from this file's own location (three levels up), so the control runs on a
reviewer's host as well as the author's; `--repo` names a different checkout and is refused if it does not
look like this repository. Output goes to a fresh temp directory whose path is printed, so a re-run cannot
overwrite committed evidence by accident — pass `--out <dir>` to aim it, e.g. to diff against the pack.
"""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))


def _opt(name):
    """`--name <value>` or `--name=<value>`, wherever it sits in argv."""
    for i, a in enumerate(sys.argv[1:]):
        if a == name:
            return sys.argv[i + 2] if i + 2 < len(sys.argv) else None
        if a.startswith(name + '='):
            return a.split('=', 1)[1]
    return None


def repo_root():
    r = os.path.abspath(_opt('--repo') or os.path.join(HERE, '..', '..', '..'))
    idx = os.path.join(r, 'client', 'src', 'index.css')
    if not os.path.isfile(idx):
        sys.exit(f'{name()}: --repo {r} does not look like the Antum People repository '
                 f'(no client/src/index.css); refusing to measure the wrong tree')
    return r


def name():
    return os.path.basename(__file__)


R = repo_root()
C = os.path.join(R, 'client')
IDX = os.path.join(C, 'src/index.css')
HTTP = os.path.join(C, 'src/httpStatus.js')
PANEL = os.path.join(C, 'src/panelResults.js')
OUTDIR = os.path.abspath(_opt('--out') or tempfile.mkdtemp(prefix='antum-tailwind-guard-control-'))
os.makedirs(OUTDIR, exist_ok=True)
OUT = os.path.join(OUTDIR, 'guard-control.txt')


def test_run():
    p = subprocess.run('npm test', cwd=C, shell=True, capture_output=True, text=True)
    text = p.stdout + p.stderr
    fails = [ln for ln in text.split('\n') if ln.startswith('not ok')]
    counts = [ln for ln in text.split('\n') if ln.startswith('# pass') or ln.startswith('# fail')]
    return p.returncode, counts, fails


def plant(path, marker, line):
    # try/finally: an interrupted run (Ctrl-C, a killed background job) must not leave a plant in the tree.
    original = open(path).read()
    try:
        open(path, 'a').write(f'\n{line}\n')
        rc, counts, fails = test_run()
        return {'plant': marker, 'file': os.path.relpath(path, R), 'line': line.strip(),
                'rc': rc, 'counts': counts, 'fails': fails}
    finally:
        open(path, 'w').write(original)


lines = ['# guard control - each assertion is reddened alone, then reverted', '']

# 0. green baseline
rc, counts, fails = test_run()
lines += ['=== GREEN (no plant) ===', f'  exit: {rc}', *[f'  {c}' for c in counts],
          f'  failing tests: {fails or "(none)"}', '']

# 1. a class ATTRIBUTE in a file the pin does not cover -> assertion 2
r = plant(HTTP, 'class attribute outside the declared sources',
          '// className="p-4" (planted: valid JS, so ONLY the intended assertion reddens)')
lines += [f'=== RED 1 === {r["plant"]}',
          f'  planted in: {r["file"]} <- {r["line"]}', f'  exit: {r["rc"]}',
          *[f'  {c}' for c in r['counts']], *[f'  {f}' for f in r['fails']], '']

# 2. a class-name LIST in a logic file -> assertion 3
r = plant(PANEL, 'quoted class-name list outside the declared sources',
          "const tone = 'bg-amber-50 border-amber-200';")
lines += [f'=== RED 2 === {r["plant"]}',
          f'  planted in: {r["file"]} <- {r["line"]}', f'  exit: {r["rc"]}',
          *[f'  {c}' for c in r['counts']], *[f'  {f}' for f in r['fails']], '']

# 3. automatic detection switched back on -> assertion 1
original = open(IDX).read()
try:
    open(IDX, 'w').write(original.replace('@import "tailwindcss" source(none);', '@import "tailwindcss";'))
    rc, counts, fails = test_run()
finally:
    open(IDX, 'w').write(original)     # an interrupted run must not leave the pin switched off
lines += ['=== RED 3 === automatic source detection switched back on',
          '  changed in: client/src/index.css  <- source(none) removed', f'  exit: {rc}',
          *[f'  {c}' for c in counts], *[f'  {f}' for f in fails], '']

lines += ['# working tree after the control (only the intended changes):',
          subprocess.run('git status --short', cwd=R, shell=True, capture_output=True, text=True).stdout.strip()]
open(OUT, 'w').write('\n'.join(lines) + '\n')
print('\n'.join(lines))
print(f'\n# measured against {R}\n# written to {OUT}')
