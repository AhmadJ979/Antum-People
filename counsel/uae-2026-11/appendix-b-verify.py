#!/usr/bin/env python3
"""Judge the Appendix B checklist-strings doc against the source file.

Reads the CLAIMS OUT OF THE DOCUMENT (never from the generator's variables), so a
stale or hand-edited doc cannot score green.

WHERE THINGS ARE (re-grounded 2026-11-07 when the letter package moved into the
repository, and again 2026-11-08 when the checklist-strings doc followed it). Every path
this instrument reads is resolved from THIS FILE, never from a hardcoded
/home/team/shared prefix, so it judges the tree it is checked out in:

  * the LETTER and its .md twin  -> this directory (counsel/uae-2026-11/)
  * the checklist-strings doc    -> this directory, since 2026-11-08
  * server/compliance_engine.js  -> two levels up, in the same worktree
  * the revision the doc names   -> `git -C` the same worktree

UNTIL 2026-11-08 one input was OUTSIDE the repository - the checklist-strings doc the B/K
rows are quoted from - and this instrument REFUSED with exit 3 when it was absent, which
check-all printed as SKIP-FLAGGED and counted as skipped. The doc now lives here, so that
refusal is GONE: a missing doc is a file OF THE TREE that is missing, i.e. RED with exit 1
and its name printed, never a skip. /home/team/shared keeps a one-line POINTER at the old
path, and judging the pointer as the document would judge nothing - so the default is this
directory, and it is never the host path. APPENDIX_DOC still overrides it: that is how a
mutation in a scratch copy is proved without dirtying the tree.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
DOC = os.environ.get("APPENDIX_DOC", os.path.join(HERE, "uae-appendix-b-checklist-strings.md"))
SRC = os.path.join(REPO, "server", "compliance_engine.js")

if not os.path.isfile(DOC):
    print("RED: the document this instrument judges is not in this tree")
    print("  doc  : %s" % DOC)
    print("  why  : it is part of the repository (counsel/uae-2026-11/) since 2026-11-08, so its")
    print("         absence is a defect in the tree, not an absent environment. NOTHING WAS")
    print("         JUDGED - this is not a pass, and it is not a skip either.")
    print("  fix  : restore it from git. Do NOT point APPENDIX_DOC at the old /home/team/shared")
    print("         path: that path holds a one-line POINTER, not a copy, and a pointer judged")
    print("         as the document judges nothing.")
    sys.exit(1)
if not os.path.isfile(SRC):
    print("RED: no server/compliance_engine.js in the tree this instrument lives in")
    print("  src  : %s" % SRC)
    print("  why  : this file must sit at counsel/uae-2026-11/ inside the repository, two levels")
    print("         below the tree root. NOTHING WAS JUDGED - this is not a pass.")
    sys.exit(1)

doc = open(DOC, encoding="utf-8").read()
src = open(SRC, encoding="utf-8").read().splitlines()

fails = []
checks = 0

def ck(ok, msg):
    global checks
    checks += 1
    if not ok:
        fails.append(msg)

# 1. every row in the B and K tables: quote at the line named, verbatim
rows = re.findall(r"^\| ([BK]\d+) \| `server/compliance_engine\.js:(\d+)` \| [^|]*\| \"([^\"]+)\" \|", doc, re.M)
ck(len(rows) == 9, "expected 9 quoted rows in the doc, found %d" % len(rows))
for rid, n, quoted in rows:
    n = int(n)
    line = src[n - 1]
    ck(quoted in line, "%s: quoted text is not the line %d of the source" % (rid, n))
    m = re.search(r"description: '([^']*)'", line)
    ck(m is not None and m.group(1) == quoted,
       "%s: quote differs from the description field at :%d" % (rid, n))

# 2. the doc's own header count must match the B rows it actually carries
b = [r for r in rows if r[0].startswith("B")]
k = [r for r in rows if r[0].startswith("K")]
ck(len(b) == 4, "doc must carry 4 B rows, carries %d" % len(b))
ck(len(k) == 5, "doc must carry 5 K rows, carries %d" % len(k))
ck("Appendix B is **4 rows: 0 onboarding, 4 offboarding.**" in doc,
   "the stated row count sentence is missing or changed")
ck("4 rows asked (B1–B4, 0 onboarding / 4 offboarding)" in doc,
   "the closing counts line is missing or changed")

# 3. the provenance sentence must name a revision that really holds these lines
rev = re.search(r"commit \*\*`([0-9a-f]{7,40})`\*\*", doc)
ck(rev is not None, "no measured-at revision named")
if rev:
    import subprocess
    out = subprocess.run(["git", "-C", REPO,
                          "show", "%s:server/compliance_engine.js" % rev.group(1)],
                         capture_output=True, text=True)
    ck(out.returncode == 0, "named revision %s has no compliance_engine.js" % rev.group(1))
    if out.returncode == 0:
        rl = out.stdout.splitlines()
        for rid, n, quoted in rows:
            n = int(n)
            ck(n <= len(rl) and quoted in rl[n - 1],
               "%s: quote is not at :%d of the revision the doc names (%s)" % (rid, n, rev.group(1)))

# 4. the row set must be complete: every citation-bearing description in the
#    UAE block appears as a B row, and none of the excluded KSA lines is one
ARTICLE = re.compile(r"\bArts?\.|\bArticle\b|\bFDL\b|\bM/51\b")
DEADLINE = re.compile(r"\bwithin\s+\d+\s+(?:days?|weeks?)\b|\b\d+\s*[-\u2013]\s*\d+\s+days?\b", re.I)
ENTRY = re.compile(r"^\{ title: '(.*)', description: '(.*)' \},?$")
jur = phase = None
cited = {"UAE": [], "KSA": []}
for n, raw in enumerate(src, 1):
    s = raw.strip()
    m = re.match(r"^(UAE|KSA): \{$", s)
    if m: jur, phase = m.group(1), None; continue
    if re.match(r"^(onboarding|offboarding): \[$", s): phase = s.split(":")[0]; continue
    m = ENTRY.match(s)
    if m and jur and (ARTICLE.search(m.group(2)) or DEADLINE.search(m.group(2))):
        cited[jur].append(n)
ck(sorted(int(r[1]) for r in b) == sorted(cited["UAE"]),
   "B rows %s != UAE citation-bearing lines %s" % (sorted(int(r[1]) for r in b), sorted(cited["UAE"])))
ck(sorted(int(r[1]) for r in k)[:4] == sorted(cited["KSA"]),
   "K rows do not cover the KSA citation-bearing lines %s" % sorted(cited["KSA"]))
ck(all(int(r[1]) not in cited["UAE"] for r in k), "a KSA row names a UAE line")

# 5. no legal assertion of our own: every B/K row's question cell is the one question
qs = set(re.findall(r"\| (Which article governs this, or is the claim wrong\?) \|", doc))
ck(qs == {"Which article governs this, or is the claim wrong?"},
   "the question cell is not the single uniform question: %s" % qs)

# 6. the letter and its twin must be untouched by this draft
#    The pin names a STATE, not a permanent hash: re-grounded 2026-11-12 after the PROBATION ITEM
#    was applied as the letter's new item 8 (the text of /home/team/shared/counsel-probation-item-
#    draft-2026-11-11.md, inserted after item 7; Appendix B itself untouched), so this row can still
#    redden on an accidental edit. The earlier pins (md 7bd134df..., txt 89b2bd58... re-grounded
#    2026-11-07 for the D1-D5 wording fixes on points 3, 4, 5, 7 and the Appendix A preamble; before
#    that md 873d643f..., txt 76351f76... on 2026-11-04) were correct for their day and were
#    superseded by later edits, not wrong for theirs.
#    Since the move of 2026-11-07 these are read from THIS directory (the repository copy), so the
#    pin follows the letter into the repository instead of naming a shared-directory path.
import hashlib
for f, want in (("uae-counsel-confirmation-request.md", "a0c77beb858eb070b20d57734c0e40d6"),
                ("uae-counsel-confirmation-request--send-ready.txt", "0403bea40326350faf793156465cbad9")):
    p = os.path.join(HERE, f)
    got = hashlib.md5(open(p, "rb").read()).hexdigest() if os.path.isfile(p) else "MISSING"
    ck(got == want, "%s md5 is %s, not the %s this draft recorded" % (f, got, want))

print("checks run: %d" % checks)
print("FAILING: %d" % len(fails))
for f in fails:
    print("  FAIL", f)
sys.exit(1 if fails else 0)
