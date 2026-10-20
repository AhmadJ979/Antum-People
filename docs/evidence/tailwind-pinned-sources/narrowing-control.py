#!/usr/bin/env python3
"""The narrowing control, three branches, one planted word.

The word is `columns-3`: a real Tailwind utility that occurs nowhere in this tree or in either built
stylesheet, so its presence or absence in the output is caused by the plant and nothing else.

  A. HAZARD   - old index.css (automatic source detection), word planted in a TEST file
                -> the rule must APPEAR. Without this branch, "absent" in B could just mean the word was
                   never a valid candidate, and the whole narrowing would be unfalsifiable.
  B. NARROWED - new index.css (pinned sources), same plant, same file
                -> the rule must NOT appear.
  C. ALIVE    - new index.css, word planted in a file that IS still scanned (App.tsx)
                -> the rule must APPEAR, so B is not a build that stopped working.

Every branch records the build's own tail and exit code, and the CSS is read from dist after each build.
Files are restored afterwards; the script asserts the working tree is left holding only index.css.

The repository root is derived from this file's own location (three levels up), so the control runs on a
reviewer's host as well as the author's; `--repo` names a different checkout and is refused if it does not
look like this repository. Output — the transcript and the three built stylesheets — goes to a fresh temp
directory whose path is printed, so a re-run cannot overwrite committed evidence by accident; pass
`--out <dir>` to aim it (e.g. at this pack, to diff the rebuilt control CSS in place).

Branch A needs the file as it was BEFORE the pin. That revision is DERIVED — the parent of the commit that
introduced `source(none)`, found with `git log -S` — because once the pin has merged, `HEAD:` is already
the pinned form and the control would abort. `--old-rev <rev>` names the pre-pin state explicitly.
"""
import glob
import os
import re
import shutil
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
        sys.exit(f'{os.path.basename(__file__)}: --repo {r} does not look like the Antum People '
                 f'repository (no client/src/index.css); refusing to measure the wrong tree')
    return r


R = repo_root()
WORD = 'columns-3'
C = os.path.join(R, 'client')
IDX = os.path.join(C, 'src/index.css')
TEST = os.path.join(C, 'src/httpStatus.test.js')
APP = os.path.join(C, 'src/App.tsx')
OUTDIR = os.path.abspath(_opt('--out') or tempfile.mkdtemp(prefix='antum-tailwind-narrowing-control-'))
os.makedirs(OUTDIR, exist_ok=True)
OUT = os.path.join(OUTDIR, 'narrowing-control.txt')


def old_ref():
    """The pre-pin `index.css` for branch A, derived rather than hardcoded.

    Branch A needs the file as it was BEFORE the pin, and once the pin has merged, `HEAD:` is already the
    pinned form — so `git show HEAD:...` cannot be used (it aborts: 'index.css states are wrong'). Find the
    commit that INTRODUCED `source(none)` into that file and take its parent. `--old-rev` overrides it.
    """
    forced = _opt('--old-rev')
    if forced:
        return forced
    commits = sh(f'git log --format=%H -S "source(none)" -- {os.path.relpath(IDX, R)}',
                 cwd=R).stdout.split()
    if not commits:
        sys.exit(f'{os.path.basename(__file__)}: no commit in this repository introduces source(none) into '
                 f'{os.path.relpath(IDX, R)}; pass --old-rev <rev> naming the pre-pin state')
    return f'{commits[-1]}^'          # newest first -> the last entry is the introducing commit


def sh(cmd, cwd=C):
    return subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True)


def built_css():
    files = glob.glob(os.path.join(C, 'dist/assets/index-*.css'))
    assert len(files) == 1, files
    return files[0]


def run(label, css_text, plant_path, note):
    # try/finally: an interrupted run (Ctrl-C, a killed background job) must not leave the tree modified.
    # It did once — a killed run left branch A's unpinned index.css and a planted test file behind, and the
    # next run's precondition refused the dirty tree. The refusal was right; leaving it dirty was not.
    original = open(plant_path).read()
    try:
        open(IDX, 'w').write(css_text)
        open(plant_path, 'a').write(f'\n// {WORD}\n')
        b = sh('npm run build')
        tail = b.stdout.strip().split('\n')[-5:]
        css_file = built_css()
        css = open(css_file).read()
        present = f'.{WORD}' in css or f'.{WORD}{{' in css
        hit = re.search(r'\.columns-3\{[^}]*\}', css)
        shutil.copyfile(css_file, os.path.join(OUTDIR, f'control-{label}.css'))
        return {
            'label': label, 'note': note, 'exit': b.returncode, 'css': os.path.basename(css_file),
            'bytes': len(css), 'present': present, 'rule': hit.group(0) if hit else '',
            'planted_in': os.path.relpath(plant_path, R), 'tail': '\n'.join(tail),
            'stderr': b.stderr.strip().split('\n')[-1] if b.returncode else '',
        }
    finally:
        open(plant_path, 'w').write(original)
        open(IDX, 'w').write(new_css)      # the pinned form, i.e. the state the tree arrived in


OLD_REF = old_ref()
old_css = sh(f'git show {OLD_REF}:client/src/index.css').stdout
new_css = open(IDX).read()   # the pinned version, currently in the working tree
assert 'source(none)' in new_css, f'{IDX} is not the pinned form; branch B/C need it (see --help)'
assert 'source(none)' not in old_css, f'{OLD_REF}:client/src/index.css is already pinned; ' \
                                      f'branch A needs the pre-pin form (see --help)'
assert sh(f'grep -rn "{WORD}" client/src client/index.html').stdout == '', 'the word is not unique to the plant'

runs = [
    run('A-hazard', old_css, TEST, 'old auto-detection + plant in a TEST file -> rule must APPEAR'),
    run('B-narrowed', new_css, TEST, 'pinned sources + plant in a TEST file -> rule must NOT appear'),
    run('C-alive', new_css, APP, 'pinned sources + plant in a SCANNED file -> rule must APPEAR'),
]

lines = [f'# narrowing control - planted word: {WORD!r} (occurs nowhere in the tree or in either CSS)',
         f'# each branch: file(s) written, `npm run build` in client/, then dist/assets/index-*.css read back', '']
for r in runs:
    lines += [
        f'=== {r["label"]} === {r["note"]}',
        f'  planted in: {r["planted_in"]}',
        f'  build exit: {r["exit"]}',
        f'  built css: {r["css"]} ({r["bytes"]} B)',
        f'  .columns-3 present: {r["present"]}',
        f'  rule text: {r["rule"] or "(no such rule)"}',
        '  build tail:',
        *[f'    {t}' for t in r['tail'].split('\n')],
        '',
    ]
lines += ['# files restored; the working tree holds only client/src/index.css as a change:',
          sh('git status --short', cwd=R).stdout.strip(), '']

open(OUT, 'w').write('\n'.join(lines))
print('\n'.join(lines))
print(f'\n# measured against {R}\n# written to {OUT}\n# control CSS written to {OUTDIR}/control-*.css')
