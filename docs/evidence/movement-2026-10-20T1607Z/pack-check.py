#!/usr/bin/env python3
"""pack-check.py - the four directions this pack must hold, in one command.

    1. every file in this directory is NAMED in README.md
    2. every filename README.md names (in backticks) EXISTS - in the pack, in the repository, or in
       the asserted external-names block below (printed with its count)
    3. every file in this directory is TRACKED BY GIT (`.gitignore`'s `*.log` dropped three files from
       the 15:11Z pack while the working tree looked complete: `git add -f` is required for this pack
       too, and the ignore happens before the commit, not before the check)
    4. md5sums.txt is NOT STALE: it matches the bytes of every file it lists

Exit 0 only if all four hold. Print the count each direction judged, so a green over an empty list is
impossible to mistake for a green over the pack.
"""
import hashlib
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))   # the repository root

# Direction 2: names README.md is allowed to use that are NOT in this pack and NOT in this repository.
# Asserted rather than exempted: each is printed with its reason, and the count is printed every run.
EXTERNAL = {
    "docs/evidence/movement-2026-10-20T1511Z/": "the previous movement's pack, merged as PR #274",
    "cutover-preflight.sh:85": "the host preflight script, cited by line from preflight-defect.txt",
    "plan-current.md": "a source-dir snapshot, deliberately NOT carried (see source-inventory.txt)",
    "plan-current.json": "a source-dir snapshot, deliberately NOT carried (see source-inventory.txt)",
    "/home/team/shared/movements/2026-10-20T1607Z/": "the host source directory this pack was copied from",
    "assets/index-C9vf7pQB.js": "a built asset: named by the served HTML and printed by the preflight; the build output is gitignored, so no such path exists in the tree",
    "assets/index-Bh1-0KrL.js": "a built asset the stale preflight expected; same reason",
    "assets/index-WRONGNOPE.js": "the deliberately wrong expectation that reddened the preflight; same reason",
    "cutover-…-evidence.txt": "an ellipsis abbreviation of the 15:11Z pack's own evidence log (its full name differs; the abbreviation is used here only to refer to that pack)",
}

# Names README.md may use that are values or code identifiers, never paths. Asserted, and printed.
NON_PATH = {
    "shutil.copy2": "a Python library call, written in the README as the meaning of `cp -p` semantics",
    "vitest@5.0.5": "an npm package spec that npx pulled, quoted from the void client run",
    "32824.78": "a rendered money value from the seed log",
}

SKIP = re.compile(r"[\s=*<>()\[\]{}|]|^--|^[a-z0-9-]* -")   # commands, flags, expressions - not paths


def files():
    return sorted(f for f in os.listdir(HERE) if os.path.isfile(os.path.join(HERE, f)))


def md5(path):
    return hashlib.md5(open(path, "rb").read()).hexdigest()


def direction1(pack, readme):
    bad = [f for f in pack if f not in readme]
    print("1. every file in this directory is named in README.md: %d/%d" % (len(pack) - len(bad), len(pack)))
    for f in bad:
        print("   NOT NAMED: %s" % f)
    return bad


def direction2(readme):
    names = sorted(set(re.findall(r"`([^`\n]+)`", readme)))
    missing, external, nonpath = [], [], []
    for n in names:
        cand = n.strip().strip(".,;")
        if SKIP.search(cand) or "." not in os.path.basename(cand):
            continue
        cand = re.sub(r":\d+$", "", cand)          # a file:line citation
        if cand in EXTERNAL or n in EXTERNAL:
            external.append(n)
            continue
        if cand in NON_PATH or n in NON_PATH:
            nonpath.append(n)
            continue
        if (os.path.exists(os.path.join(HERE, cand)) or os.path.exists(os.path.join(ROOT, cand))
                or os.path.exists(os.path.join(ROOT, "docs/evidence/movement-2026-10-20T1607Z", cand))):
            continue
        missing.append(n)
    print("2. every filename README.md names exists: %d named, %d in the asserted external block, %d asserted non-paths, %d MISSING"
          % (len(names), len(external), len(nonpath), len(missing)))
    for n in missing:
        print("   MISSING: %s" % n)
    return missing


def direction3(pack):
    tracked, untracked, note = [], [], ""
    in_tree = subprocess.run(["git", "-C", ROOT, "rev-parse", "--is-inside-work-tree"],
                             capture_output=True, text=True).stdout.strip()
    if in_tree != "true":
        note = "  (NOT a git work tree - direction 3 skipped, and this skip is not a pass)"
    else:
        for f in pack:
            rel = os.path.relpath(os.path.join(HERE, f), ROOT)
            r = subprocess.run(["git", "-C", ROOT, "ls-files", "--error-unmatch", rel],
                               capture_output=True, text=True)
            (tracked if r.returncode == 0 else untracked).append(f)
    print("3. every file in this directory is tracked by git: %d tracked, %d UNTRACKED%s"
          % (len(tracked), len(untracked), note))
    for f in untracked:
        print("   UNTRACKED: %s  (git add -f %s)" % (f, f))
    return untracked


def direction4():
    man = os.path.join(HERE, "md5sums.txt")
    NOT_IN_MANIFEST = {"md5sums.txt", "pack-check-runs.txt"}   # itself, and the run log (it records the runs)
    if not os.path.exists(man):
        print("4. md5sums.txt is not stale: MISSING the manifest")
        return ["md5sums.txt"]
    listed, bad = 0, []
    for line in open(man):
        line = line.rstrip("\n")
        if not line.strip():
            continue
        digest, name = line.split(None, 1)
        listed += 1
        p = os.path.join(HERE, name.strip())
        if not os.path.exists(p):
            bad.append("%s (listed, absent)" % name)
        elif md5(p) != digest:
            bad.append("%s (bytes changed since the manifest)" % name)
    pack = set(files())
    unlisted = sorted(pack - NOT_IN_MANIFEST - {n.strip() for n in
                     (l.split(None, 1)[1].strip() for l in open(man) if l.strip())})
    print("4. md5sums.txt is not stale: %d file(s) listed, %d STALE, %d file(s) deliberately not listed "
          "(itself and the run log, which records the runs)" % (listed, len(bad), len(NOT_IN_MANIFEST)))
    for b in bad:
        print("   STALE: %s" % b)
    for u in unlisted:
        print("   NOT LISTED and not an asserted exclusion: %s" % u)
    return bad + unlisted


def main():
    pack = files()
    readme = open(os.path.join(HERE, "README.md")).read()
    print("pack: %s" % HERE)
    print("files judged: %d" % len(pack))
    print()
    bad = direction1(pack, readme) + direction2(readme) + direction3(pack) + direction4()
    print()
    if bad:
        print("VERDICT: %d problem(s) -> this pack does NOT hold" % len(bad))
        return 1
    print("VERDICT: all four directions hold (%d file(s))" % len(pack))
    return 0


if __name__ == "__main__":
    sys.exit(main())
