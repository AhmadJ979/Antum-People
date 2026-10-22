#!/usr/bin/env python3
"""pack-check — the four directions this pack must hold, run against its own directory.

1. every file in this directory is named in README.md
2. every backticked filename README.md names either exists here, or is in the ASSERTED EXTERNAL
   block (host-side files this pack quotes but does not carry) — and every external name is
   asserted ABSENT here, so a real file of that name would be caught rather than ignored
3. every file in this directory is tracked by git          <- reddens for real before `git add`
4. md5sums.txt is not stale and lists every file except the two that cannot be listed for a reason:
   itself, and the run log that records these runs

Exit 0 only when all four hold. A check that cannot redden proves nothing: direction 3 did fail
before the files were added, and the first version of directions 1 and 2 failed on two defects of
their own — both runs are in pack-check-runs.txt rather than being tidied away.
"""
import hashlib
import os
import re
import subprocess
import sys

D = os.path.dirname(os.path.abspath(__file__))
files = sorted(f for f in os.listdir(D) if os.path.isfile(os.path.join(D, f)))
readme = open(os.path.join(D, "README.md"), encoding="utf-8").read() if "README.md" in files else ""

# Host-side files this pack quotes in prose and in the reproduce block. They are not pack files.
EXTERNAL = {
    "index-C9vf7pQB.js", "index-BK_EwcpZ.css",          # served assets, of the deployed tree
    "keep-alive.lock", "keep-alive.log", "keep-alive.out", "guard-hook.log",  # the guard's own files
    "check-all.py", "deploy-main.sh", "observe-serve-pair.sh", "keep-alive.sh",
    "antum-product-guard-hook.sh", "zz-antum-product-guard.sh", "entrypoint.sh",
    "pub.html", "url.js",
}
# Cannot be listed in md5sums.txt: itself, and the log of the runs that md5sums the others.
NOT_LISTED = {"md5sums.txt", "pack-check-runs.txt"}

fails = 0
print("pack: %s" % D)
print("files judged: %d" % len(files))

# 1 ---------------------------------------------------------------- every file is named in README
missing = [f for f in files if f not in readme]
print("1. every file in this directory is named in README.md: %d/%d%s"
      % (len(files) - len(missing), len(files), "" if not missing else "  MISSING: %s" % missing))
fails += 1 if missing else 0

# 2 ------------------------------------------- every filename README names exists or is external
named = sorted(set(re.findall(r"`([A-Za-z0-9._-]+\.(?:md|txt|py|js|json|sh|out|log|html))`", readme)))
external_named = sorted(n for n in named if n in EXTERNAL)
absent = [n for n in named if n not in files and n not in EXTERNAL]
external_present = [n for n in external_named if n in files]
print("2. filenames README.md names: %d named, %d in the asserted external block, %d ABSENT%s%s"
      % (len(named), len(external_named), len(absent),
         "" if not absent else "  -> %s" % absent,
         "" if not external_present else "  EXTERNAL-BUT-PRESENT: %s" % external_present))
fails += 1 if (absent or external_present) else 0

# 3 --------------------------------------------------------------- every file is tracked by git
tracked = subprocess.run(["git", "ls-files", D], capture_output=True, text=True).stdout.split()
tracked_names = {os.path.basename(p) for p in tracked}
untracked = [f for f in files if f not in tracked_names]
print("3. every file in this directory is tracked by git: %d tracked, %d UNTRACKED%s"
      % (len(files) - len(untracked), len(untracked), "" if not untracked else "  -> %s" % untracked))
fails += 1 if untracked else 0

# 4 ------------------------------------------------------------------------ md5sums is not stale
listed, stale, unlisted = {}, [], []
sums_path = os.path.join(D, "md5sums.txt")
if os.path.isfile(sums_path):
    for line in open(sums_path, encoding="utf-8"):
        m = re.match(r"^([0-9a-f]{32})\s+\*?(.+)$", line.strip())
        if m:
            listed[m.group(2)] = m.group(1)
    for f in files:
        if f in NOT_LISTED:
            continue
        h = hashlib.md5(open(os.path.join(D, f), "rb").read()).hexdigest()
        if f not in listed:
            unlisted.append(f)
        elif listed[f] != h:
            stale.append(f)
    extra = sorted(set(listed) - {f for f in files if f not in NOT_LISTED})
    print("4. md5sums.txt is not stale: %d listed, %d STALE, %d unlisted, %d listed-but-absent; "
          "deliberately not listed: %s"
          % (len(listed), len(stale), len(unlisted), len(extra), sorted(NOT_LISTED)))
    fails += 1 if (stale or unlisted or extra) else 0
else:
    print("4. md5sums.txt: ABSENT")
    fails += 1

print("\nVERDICT: %s" % ("all four directions hold (%d file(s))" % len(files) if not fails
                         else "%d direction(s) FAILED" % fails))
sys.exit(1 if fails else 0)