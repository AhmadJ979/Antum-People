#!/usr/bin/env python3
"""Re-run the MERGED document's OWN counting method — at the revision it used, and at main.

`design-concepts/CLIENT-STATES.md` as merged (PR #244, `8ec9f69`) states its central premise from a count
it prints so the count can be re-taken:

    git grep -c '401' -- client/   ->  client/src/App.tsx:19   (lines)
    git grep -c '403' -- client/   ->  client/src/assets/react.svg:1   (an SVG path coordinate, not code)

and concludes, from that: **"The client contains no 403 handling at all"**, and in §2, "There is no `403`
branch anywhere." Both sentences are in the file on `main` today.

The count was taken at `ee4bbdf` and the conclusion was drawn at `ee4bbdf`. Between `ee4bbdf` and `main`,
PR #241 shipped `client/src/httpStatus.js` — 403 classification for every authenticated call. So the
sentences are now FALSE ON `main`, and this script proves it by re-running the document's own method.

A count is not a claim, but this one was written down as one, in the present tense, in a document that is
served from a repository that has moved. `git grep -c` has no opinion about the revision it was run at; a
reader arriving later supplies it from the tree, not from the sentence.

Exit 0 iff  the sentence HELD at the old revision  AND  is FALSE at the new one.
Exit 1 otherwise — i.e. if the check cannot distinguish the two revisions, it proves nothing.

Re-point REV_OLD / REV_NEW to re-take it after any later merge.
"""
import subprocess
import sys

REV_OLD = "ee4bbdf"        # the revision the merged sentence was measured at
REV_NEW = "8ec9f69"        # main at the time of this correction (PR #244's own merge commit)
SOURCE_SUFFIXES = (".js", ".jsx", ".ts", ".tsx")


def hits(rev, pattern):
    """`git grep -c <pattern> -- client/` at <rev>, as a list of 'file:count' strings."""
    p = subprocess.run(["git", "grep", "-c", pattern, rev, "--", "client/"],
                       capture_output=True, text=True)
    out = p.stdout.strip()
    return [ln for ln in out.splitlines() if ln] if out else []


def classify(lines):
    """Split hits into source files and non-source (an SVG is a path coordinate, not handling).

    `git grep -c <pat> <rev> -- client/` prints '<rev>:<path>:<count>'. Splitting on the FIRST
    colon alone yields the revision, which is the bug this function shipped with for one run —
    the verdict line caught it, because every file then classified as 'not source'.
    """
    src, non = [], []
    for ln in lines:
        parts = ln.split(":", 2)
        path = parts[1] if len(parts) == 3 else parts[0]
        (src if path.endswith(SOURCE_SUFFIXES) else non).append(ln)
    return src, non


fails = 0
print(f"CLIENT-STATES.md's own count, re-run.  REV_OLD={REV_OLD}  REV_NEW={REV_NEW}\n")
for rev in (REV_OLD, REV_NEW):
    print(f"=== {rev}")
    for pat in ("401", "403"):
        lines = hits(rev, pat)
        src, non = classify(lines)
        print(f"    git grep -c '{pat}' -- client/  ->  {len(lines)} file(s); "
              f"{len(src)} in source, {len(non)} not")
        for ln in lines:
            print(f"        {ln}")
    print()
    old_src, _ = classify(hits(rev, "403"))
    if rev == REV_OLD:
        held = len(old_src) == 0          # no 403 in source: the sentence was true here
        print(f"    => 403 in source at {REV_OLD}: {len(old_src)}  "
              f"({'the sentence HELD here' if held else 'the sentence was ALREADY false here'})\n")
    else:
        false_now = len(old_src) > 0      # 403 in source: the sentence is false here
        print(f"    => 403 in source at {REV_NEW}: {len(old_src)}  "
              f"({'the sentence is FALSE here' if false_now else 'the sentence still holds here'})\n")

held_old = len(classify(hits(REV_OLD, "403"))[0]) == 0
false_new = len(classify(hits(REV_NEW, "403"))[0]) > 0
if not held_old:
    print(f"FAIL  the sentence was not true at {REV_OLD} either — this check cannot attribute the change")
    fails += 1
if not false_new:
    print(f"FAIL  the sentence is not false at {REV_NEW} — nothing is proved by this run")
    fails += 1

print(f"\nVERDICT: the sentence HELD at {REV_OLD} and is FALSE at {REV_NEW}"
      if fails == 0 else f"\n{fails} check(s) failed — the run proves nothing")
sys.exit(1 if fails else 0)
