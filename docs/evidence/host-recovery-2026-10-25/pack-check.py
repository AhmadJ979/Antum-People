#!/usr/bin/env python3
"""Four directions: every file the README names exists; every backticked filename exists; each file is
tracked by git; manifest.txt is not stale. Run from inside the pack (md5sum reads the reader's CWD)."""
import hashlib, os, re, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
os.chdir(here)
names = sorted(f for f in os.listdir('.') if f != 'pack-check.py')
readme = open('README.md', encoding='utf-8').read()
fail = []
for n in names:
    if n not in readme:
        fail.append(f'{n} exists but is NOT named in README.md')
    if not os.path.isfile(n):
        fail.append(f'{n} is not a file')
named = set(re.findall(r'`([0-9A-Za-z_.\-]+\.(?:txt|md|log|py))`', readme))
# A file the README names as ABSENT (lost with /tmp, or survived elsewhere) must be absent HERE.
# Naming an absence is part of the record; the check verifies the absence rather than demanding the file.
ABSENT = {'-build.log', '-seed.log'}   # named as lost with /tmp; they must not be here
for n in sorted(named):
    if n in ABSENT:
        if os.path.exists(n):
            fail.append(f'`{n}` is declared absent but exists in the pack')
        continue
    if not os.path.exists(n):
        fail.append(f'README names `{n}` but it does not exist here')
manifest = {}
for line in open('manifest.txt', encoding='utf-8'):
    line = line.strip()
    if line:
        h, n = line.split(None, 1)
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
for n in names:
    if n not in {os.path.basename(t) for t in tracked}:
        fail.append(f'{n} is not tracked by git')
print(f'{len(names)} files, {len(manifest)} manifest lines')
if fail:
    print('FAIL'); [print('  -', f) for f in fail]; sys.exit(1)
print('PACK OK: every file named, present, tracked, and matching its recorded md5')
