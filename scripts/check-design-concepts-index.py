#!/usr/bin/env python3
"""
Inventory check: every document in design-concepts/ carries exactly one index row.

WHY THIS EXISTS
  The defect class no citation checker can see: a merge that DROPS an index row while no
  number anywhere moves. A citation checker reads the text; this reads the register. The
  near-miss it was written for - PR #259 merged a state that deleted the
  `LAYER3-IDENTITY.md` row, and was caught by a reader, not by a check (2026-10-20).

WHAT IT ASSERTS - each one can redden, and none is decorative
  1. every `design-concepts/*.md` EXCEPT README.md has EXACTLY ONE row in
     `design-concepts/README.md`;
  2. README.md has ZERO rows for itself - its exclusion is ASSERTED here, not left
     silent, so it cannot drift into "no row and nobody knows why";
  3. no row names a `*.md` that is not in the directory - a row left pointing at a
     document that was deleted or renamed is an inventory defect too;
  4. the index is not empty. An empty index satisfies (1) vacuously only if no documents
     exist; with documents present it fails (1), and with none present this fails here.
     A check that a wholesale deletion of the register can leave green is not a gate.

THE TRAP THIS CHECK IS WRITTEN AROUND
  `git ls-tree` and `ls` return `design-concepts/NAME.md`; the rows carry the BARE
  filename `NAME.md`. A check that compares a path against a row key reports 0 rows for
  every document and calls it a defect - a check asserting the defect. Measured twice in
  one session (2026-10-20). Both sides are therefore reduced to basenames, deliberately.

SCOPE, STATED RATHER THAN IMPLIED
  Only `*.md`. The directory also ships an html wireframe and prototype plus several png
  mockups, which the index lists by convention. They are NOT checked here, and this line
  exists so that a green run is not read as covering them.

IT RUNS BARE
  python3 scripts/check-design-concepts-index.py
  No argument is required: the operator's form is the bare one. (`check-doc-citations.py`
  cannot run bare - `argv[1]` raises IndexError as merged - which is the measured reason
  this check takes its root from its own location instead of from a flag.)

  --root DIR   measure another tree (used to falsify: the same bytes must redden on a
               doctored copy). Default: the repository containing this script.
"""
import os
import re
import subprocess
import sys

ROW = re.compile(r"^\|\s*`([^`]+)`")

def main(argv):
    root = None
    if len(argv) > 1:
        if argv[1] == "--root" and len(argv) > 2:
            root = os.path.abspath(argv[2])
        else:
            print("usage: python3 scripts/check-design-concepts-index.py [--root DIR]")
            return 1
    if root is None:
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    pkg = os.path.join(root, "design-concepts")
    index = os.path.join(pkg, "README.md")
    if not os.path.isfile(index):
        print("FAIL: no index at %s - nothing could be checked." % index)
        return 1

    try:
        rev = subprocess.run(["git", "-C", root, "rev-parse", "--short", "HEAD"],
                             capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        rev = "(not a git working tree - the tree this judged is UNKNOWN)"

    docs = sorted(f for f in os.listdir(pkg) if f.endswith(".md"))
    expected = [d for d in docs if d != "README.md"]
    rows = []
    for line in open(index, encoding="utf-8"):
        m = ROW.match(line)
        if m:
            rows.append(m.group(1))

    print("design-concepts inventory check - tree %s" % rev)
    print("  documents (*.md)          : %d" % len(docs))
    print("  want exactly one row each : %d  (README.md excluded, and its exclusion is asserted)" % len(expected))
    print("  index rows read           : %d" % len(rows))

    missing, doubled, stray, self_row = [], [], [], []
    for d in expected:
        n = rows.count(d)
        if n == 0:
            missing.append(d)
        elif n > 1:
            doubled.append((d, n))
    for key in rows:
        if key == "README.md":
            self_row.append(key)
        elif key.endswith(".md") and key not in docs:
            stray.append(key)

    ok = True
    print("  ...documents with NO row  : %s" % (missing if missing else "none"))
    if missing:
        ok = False
    print("  ...documents with >1 row  : %s" % (doubled if doubled else "none"))
    if doubled:
        ok = False
    print("  ...rows naming no document : %s" % (stray if stray else "none"))
    if stray:
        ok = False
    print("  ...rows for README.md     : %s  (must be none - the exclusion is asserted, not assumed)"
          % (self_row if self_row else "none"))
    if self_row:
        ok = False
    print("  ...index non-empty        : %s" % ("OK" if rows else "FAIL - an empty index is not a green index"))
    if not rows:
        ok = False

    if not ok:
        print("FAIL: see the lists above")
        return 1
    print("OK: all %d documents carry exactly one index row, no row is stray, and the "
          "README's own exclusion is asserted." % len(expected))
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
