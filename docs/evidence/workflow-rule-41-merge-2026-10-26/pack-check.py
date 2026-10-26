#!/usr/bin/env python3
"""The team's four pack directions, PLUS the assertions rule 41 itself demands.

WHY THE EXTRA ONES. Rule 41 was written because a checker that only asks "is every file named?" cannot see a
claim that is false, nor a section that landed on main twice with every check still reading OK. So this pack's
checker does what that pack's checker needed and did not have: it reads the record's own claims OUT OF
README.md and judges them against THE MERGE RESULT - the revision this record is about - never against the
working tree, which later rules legitimately change (a rule 42 appended tomorrow must not redden this record).

WHAT IT CANNOT JUDGE, SAID OUT LOUD RATHER THAN SKIPPED QUIETLY. The live file lives outside the repository,
so the mirror-side content identity can be checked here and the live-side md5 cannot. That line is printed as
NOT CHECKABLE rather than counted as a pass.
"""
import hashlib, os, re, subprocess, sys

here = os.path.dirname(os.path.abspath(__file__))
os.chdir(here)
SKIP = {'pack-check.py', 'pack-check-runs.txt'}
names = sorted(f for f in os.listdir('.') if f not in SKIP)
readme = open('README.md', encoding='utf-8').read()
fail, cannot, notes = [], [], []

# --- direction 1: every file here is named in README.md, and every BACKTICKED BARE filename exists here ---
for n in names:
    if n not in readme:
        fail.append(f'{n} exists but is NOT named in README.md')
    if not os.path.isfile(n):
        fail.append(f'{n} is not a file')
# Only a BARE filename is a claim about a file in THIS directory: `../WORKFLOW.md` names a file in the
# repository, and reading its basename as a pack member invents a missing file (the sibling pack's RUN 4).
for tok in sorted(set(re.findall(r'`([^`\n]+)`', readme))):
    if '/' in tok or not re.fullmatch(r'[0-9A-Za-z_.\-]+\.(?:txt|md|log|py)', tok):
        continue
    if not os.path.exists(tok):
        fail.append(f'README names `{tok}` but it does not exist here')

# --- direction 2: manifest.txt is neither stale nor missing an entry ---
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

# --- direction 3: every file here is tracked by git ---
tracked = subprocess.run(['git', 'ls-files', '.'], capture_output=True, text=True).stdout.split()
tracked = {os.path.basename(t) for t in tracked}
for n in names:
    if n not in tracked:
        fail.append(f'{n} is not tracked by git')


# --- direction 4, the rule-41 half: the record's claims, read out of README.md ---
def git(*args):
    return subprocess.run(('git',) + args, capture_output=True, text=True)


def claim(pattern, what):
    m = re.search(pattern, readme)
    if not m:
        cannot.append(f'README no longer states {what} in a form this checker can read - refusing to guess')
        return None
    return m.group(1)


rev = claim(r'read \*\*out of this file\*\*[^\n]*?`([0-9a-f]{40})`', 'the merge result')
file_md5_claim = claim(r'md5 of every byte: `([0-9a-f]{32})`', 'the merged mirror file md5')
md5_claim = claim(r'the same number\*\*, `([0-9a-f]{32})`', 'the shared content md5')
blob_claim = claim(r'version that was reviewed \(`([0-9a-f]{8})`\)', 'the merged file blob (short)')

if rev:
    exists = git('cat-file', '-e', f'{rev}^{{commit}}').returncode == 0
    if not exists:
        cannot.append(f'the object {rev} is not in this clone (shallow?) - the record cannot be judged here')
    else:
        if git('merge-base', '--is-ancestor', rev, 'HEAD').returncode != 0:
            fail.append(f'the record names {rev[:8]} as the merge result, and it is not an ancestor of HEAD')
        raw = git('show', f'{rev}:WORKFLOW.md')
        if raw.returncode != 0:
            fail.append(f'{rev[:8]} carries no WORKFLOW.md')
        else:
            data = raw.stdout.encode()  # bytes, so the md5 is the file's own
            full = git('rev-parse', f'{rev}:WORKFLOW.md').stdout.strip()
            if blob_claim and not full.startswith(blob_claim):
                fail.append(f'README calls the merged blob {blob_claim}..., {rev[:8]} holds {full[:8]}')
            got_file = hashlib.md5(data).hexdigest()
            if file_md5_claim and got_file != file_md5_claim:
                fail.append(f'STALE claim: {rev[:8]}:WORKFLOW.md is md5 {got_file}, README says {file_md5_claim}')
            # The shared content identity: drop the mirror's '>' header lines and blank lines, exactly as the
            # live file is read with blank lines dropped (this is the pair the sync check compares).
            content = b''.join(l + b'\n' for l in data.split(b'\n') if l != b'' and not l.startswith(b'>'))
            got_content = hashlib.md5(content).hexdigest()
            if md5_claim and got_content != md5_claim:
                fail.append(f'STALE claim: the shared content md5 of {rev[:8]}:WORKFLOW.md is {got_content}, README says {md5_claim}')
            lines = data.decode().splitlines()
            n41 = len([l for l in lines if re.match(r'^41\.', l)])
            n40 = len([l for l in lines if re.match(r'^40\.', l)])
            if n41 != 1:
                fail.append(f'rule 41 appears {n41} time(s) in {rev[:8]}:WORKFLOW.md on the merge result, not once')
            if n40 != 1:
                fail.append(f'rule 40 appears {n40} time(s) in {rev[:8]}:WORKFLOW.md on the merge result, not once')
            if not fail:
                notes.append(f'claims judged against {rev[:8]}: file blob {full[:8]}, file md5 {got_file[:8]}, '
                             f'shared content md5 {got_content[:8]}, rule 41 x{n41}, rule 40 x{n40}')

notes.append('NOT CHECKABLE HERE: /home/team/shared/WORKFLOW.md - the live file is outside this repository; '
             'the mirror side is checked above and the live side was read in the session that wrote 03')
verdict = 'FAIL' if fail else ('CANNOT-JUDGE' if cannot else 'OK')
print(f'PACK {verdict} - {len(names)} files, {len(manifest)} manifest lines')
for f in fail:
    print('  FAIL  ' + f)
for c in cannot:
    print('  CANNOT-JUDGE  ' + c)
for n in notes:
    print('  note: ' + n)
sys.exit(1 if fail else (2 if cannot else 0))
