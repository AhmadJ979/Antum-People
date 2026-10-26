#!/usr/bin/env python3
"""Four directions: every file here is named in README.md; every backticked BARE filename exists; every
file is tracked by git; manifest.txt is neither stale nor missing an entry. The checker and its run log are
about the pack rather than part of it, so neither is named by the manifest's rule."""
import hashlib, os, re, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
os.chdir(here)
SKIP = {'pack-check.py', 'pack-check-runs.txt'}
names = sorted(f for f in os.listdir('.') if f not in SKIP)
readme = open('README.md', encoding='utf-8').read()
fail = []
for n in names:
    if n not in readme:
        fail.append(f'{n} exists but is NOT named in README.md')
    if not os.path.isfile(n):
        fail.append(f'{n} is not a file')
# Only a BARE filename is a claim about a file in THIS directory: `scripts/check-all.py` names a file in the
# repository, and reading its basename as a pack file invents a missing file.
for tok in sorted(set(re.findall(r'`([^`\n]+)`', readme))):
    if '/' in tok or not re.fullmatch(r'[0-9A-Za-z_.\-]+\.(?:txt|md|log|py)', tok):
        continue
    if not os.path.exists(tok):
        fail.append(f'README names `{tok}` but it does not exist here')
manifest = {}
for line in open('manifest.txt', encoding='utf-8'):
    if line.strip():
        h, n = line.strip().split(None, 1)
        manifest[n] = h
for n, h in manifest.items():
    if not os.path.exists(n):
        fail.append(f'manifest names {n}, which is absent')
        continue
    got = hashlib.md5(open(n, 'rb').read()).hexdigest()
    if got != h:
        fail.append(f'STALE manifest: {n} is {got}, manifest says {h}')
for n in names:
    if n != 'manifest.txt' and n not in manifest:
        fail.append(f'{n} is not in manifest.txt')
tracked = subprocess.run(['git', 'ls-files', '.'], capture_output=True, text=True).stdout.split()
tracked = {os.path.basename(t) for t in tracked}
for n in names:
    if n not in tracked:
        fail.append(f'{n} is not tracked by git')
print('PACK ' + ('FAIL' if fail else 'OK') + f' - {len(names)} files, {len(manifest)} manifest lines')
for f in fail:
    print('  ' + f)
sys.exit(1 if fail else 0)
