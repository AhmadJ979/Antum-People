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
"""
import glob
import os
import re
import shutil
import subprocess

R = '/home/agent-senior-software-engineer/antum-people'
WORD = 'columns-3'
C = os.path.join(R, 'client')
IDX = os.path.join(C, 'src/index.css')
TEST = os.path.join(C, 'src/httpStatus.test.js')
APP = os.path.join(C, 'src/App.tsx')
OUT = '/tmp/tw/control.txt'


def sh(cmd, cwd=C):
    return subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True)


def built_css():
    files = glob.glob(os.path.join(C, 'dist/assets/index-*.css'))
    assert len(files) == 1, files
    return files[0]


def run(label, css_text, plant_path, note):
    open(IDX, 'w').write(css_text)
    original = open(plant_path).read()
    open(plant_path, 'a').write(f'\n// {WORD}\n')
    b = sh('npm run build')
    tail = b.stdout.strip().split('\n')[-5:]
    css_file = built_css()
    css = open(css_file).read()
    present = f'.{WORD}' in css or f'.{WORD}{{' in css
    hit = re.search(r'\.columns-3\{[^}]*\}', css)
    shutil.copyfile(css_file, f'/tmp/tw/control-{label}.css')
    open(plant_path, 'w').write(original)
    return {
        'label': label, 'note': note, 'exit': b.returncode, 'css': os.path.basename(css_file),
        'bytes': len(css), 'present': present, 'rule': hit.group(0) if hit else '',
        'planted_in': os.path.relpath(plant_path, R), 'tail': '\n'.join(tail),
        'stderr': b.stderr.strip().split('\n')[-1] if b.returncode else '',
    }


old_css = sh('git show HEAD:client/src/index.css').stdout
new_css = open(IDX).read()   # the pinned version, currently in the working tree
assert 'source(none)' in new_css and 'source(none)' not in old_css, 'index.css states are wrong'
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
