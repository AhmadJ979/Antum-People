#!/usr/bin/env python3
"""The guard's own control: each of the three assertions must be able to redden, one at a time.

A check that cannot redden proves nothing, so each plant targets exactly one assertion and is reverted
before the next. The last line asserts the working tree is left holding only the three intended changes.
"""
import os
import subprocess

R = '/home/agent-senior-software-engineer/antum-people'
C = os.path.join(R, 'client')
IDX = os.path.join(C, 'src/index.css')
HTTP = os.path.join(C, 'src/httpStatus.js')
PANEL = os.path.join(C, 'src/panelResults.js')
OUT = '/tmp/tw/guard-control.txt'


def test_run():
    p = subprocess.run('npm test', cwd=C, shell=True, capture_output=True, text=True)
    text = p.stdout + p.stderr
    fails = [ln for ln in text.split('\n') if ln.startswith('not ok')]
    counts = [ln for ln in text.split('\n') if ln.startswith('# pass') or ln.startswith('# fail')]
    return p.returncode, counts, fails


def plant(path, marker, line):
    original = open(path).read()
    open(path, 'a').write(f'\n{line}\n')
    rc, counts, fails = test_run()
    open(path, 'w').write(original)
    return {'plant': marker, 'file': os.path.relpath(path, R), 'line': line.strip(),
            'rc': rc, 'counts': counts, 'fails': fails}


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
open(IDX, 'w').write(original.replace('@import "tailwindcss" source(none);', '@import "tailwindcss";'))
rc, counts, fails = test_run()
open(IDX, 'w').write(original)
lines += ['=== RED 3 === automatic source detection switched back on',
          '  changed in: client/src/index.css  <- source(none) removed', f'  exit: {rc}',
          *[f'  {c}' for c in counts], *[f'  {f}' for f in fails], '']

lines += ['# working tree after the control (only the intended changes):',
          subprocess.run('git status --short', cwd=R, shell=True, capture_output=True, text=True).stdout.strip()]
open(OUT, 'w').write('\n'.join(lines) + '\n')
print('\n'.join(lines))
