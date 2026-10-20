#!/usr/bin/env python3
"""pack-check - an evidence pack checks its own two directions.

  (1) every file in this pack directory is named in its README.md
  (2) every filename-shaped token inside a backticked span of README.md either
      exists in this pack, or resolves from the repository root, or is declared
      in the README's asserted external-names block
  (3) if this pack is inside a git work tree: every file in it is TRACKED - a
      `.gitignore` rule (*.log, for one) hides a file from a plain `git add`, and
      the working tree looks complete while the commit never carries it

Usage:  python3 pack-check.py [--root <repo root>] [--selftest]
Exit 0 = both directions hold; 1 = they do not (and what failed is printed).
"""
import os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
FILEISH = re.compile(r'[A-Za-z0-9_./-]+\.(?:txt|md|css|py|sh|log|js|json)\b')
BLOCK = re.compile(r'<!-- pack-check: external names -->(.*?)<!-- /pack-check -->', re.S)
SPAN = re.compile(r'`([^`]+)`')


def files(d):
    return sorted(f for f in os.listdir(d)
                  if os.path.isfile(os.path.join(d, f)) and not f.startswith('.'))


def repo_root(d):
    p = os.path.abspath(d)
    while p != '/' and not os.path.isdir(os.path.join(p, '.git')):
        p = os.path.dirname(p)
    return p or '/'


def check(d, root):
    text = open(os.path.join(d, 'README.md'), encoding='utf-8').read()
    block = BLOCK.search(text)
    allowed = set(FILEISH.findall(block.group(1))) if block else set()
    listed, bad = files(d), []
    tracked, refuse = 0, None
    if subprocess.run(['git', '-C', d, 'rev-parse', '--is-inside-work-tree'],
                      capture_output=True).returncode == 0:
        top = subprocess.run(['git', '-C', d, 'rev-parse', '--show-toplevel'],
                             capture_output=True, text=True).stdout.strip()
        for f in listed:
            rel = os.path.relpath(os.path.join(d, f), top)
            if subprocess.run(['git', '-C', top, 'ls-files', '--error-unmatch', rel],
                              capture_output=True).returncode == 0:
                tracked += 1
            else:
                bad.append(('NOT TRACKED by git (a .gitignore rule hides it - use git add -f)', f))
    else:
        refuse = 'not inside a git work tree: the tracking direction is NOT checked here'
    for f in listed:
        if f == 'README.md':
            continue
        if f not in text:
            bad.append(('NOT NAMED in README.md', f))
    tokens = set()
    for span in SPAN.findall(text):
        tokens.update(FILEISH.findall(span))
    outside, host = 0, 0
    for t in sorted(tokens):
        if t in listed or t == 'README.md':
            continue
        if t in allowed:
            outside += 1
            continue
        if t.startswith('/'):
            host += 1
            continue
        if '/' in t and os.path.exists(os.path.join(root, t)):
            continue
        if os.path.exists(os.path.join(d, os.path.basename(t))):
            continue
        bad.append(('NAMED but no such file', t))
    return listed, tokens, outside, host, tracked, refuse, bad, bool(block)


def show(d, root):
    listed, tokens, outside, host, tracked, refuse, bad, has_block = check(d, root)
    print('pack-check - tree %s' % d)
    print('  files in the pack        : %d' % len(listed))
    print('  filename-shaped names    : %d  (of which declared as outside this pack: %d)' % (len(tokens), outside))
    print('  cited host paths         : %d  (absolute, outside any repo - not checkable here)' % host)
    print('  tracked by git           : %d of %d%s' % (tracked, len(listed), '   (%s)' % refuse if refuse else ''))
    print('  asserted external block  : %s' % ('present' if has_block else 'MISSING'))
    for kind, name in bad:
        print('  FAIL: %s %s' % (kind, name))
    print('%s: every file in the pack is named in the README, and every name it uses has a file or a declaration.'
          % ('OK' if not bad else 'FAIL: see the lines above'))
    return 1 if bad else 0


def selftest():
    """Prove the check is load-bearing: green at baseline, red on each direction."""
    tmp = tempfile.mkdtemp(prefix='pack-check-')
    root = repo_root(HERE)
    rc = []
    base = os.path.join(tmp, 'base')
    shutil.copytree(HERE, base)
    rc.append(('baseline copy', show(base, root)))
    ren = os.path.join(tmp, 'renamed')
    shutil.copytree(HERE, ren)
    first = [f for f in files(ren) if f != 'README.md'][0]
    os.rename(os.path.join(ren, first), os.path.join(ren, 'ZZ-' + first))
    print('\n-- direction 1: a file in the pack that the README does not name --')
    rc.append(('file renamed', show(ren, root)))
    gone = os.path.join(tmp, 'lost')
    shutil.copytree(HERE, gone)
    victim = [f for f in files(gone) if f != 'README.md'][0]
    os.remove(os.path.join(gone, victim))
    print('\n-- direction 2: a name the README points at whose file was lost (%s) --' % victim)
    rc.append(('file lost', show(gone, root)))
    print('\nselftest: %s' % ('PASS' if [r for _, r in rc] == [0, 1, 1] else 'FAIL %s' % rc))
    shutil.rmtree(tmp)
    return 0 if [r for _, r in rc] == [0, 1, 1] else 1


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        raise SystemExit(selftest())
    root = repo_root(HERE)
    if '--root' in sys.argv:
        root = sys.argv[sys.argv.index('--root') + 1]
    raise SystemExit(show(HERE, root))
