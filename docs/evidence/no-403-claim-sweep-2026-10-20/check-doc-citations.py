#!/usr/bin/env python3
"""Fail when an `App.tsx:<n>` citation in design-concepts/ does not land on what it names.

    python3 check-doc-citations.py [<doc-rev> [<code-rev>]]     (code-rev defaults to doc-rev)

THE BARE FORM (added 2026-10-20). With no argument it judges HEAD of the repository that
CONTAINS THIS FILE: the repository is found from this file's own location, so the working
directory does not matter. As merged, the bare form raised
`IndexError: list index out of range` on `sys.argv[1]` - reachable only by a reader who
already knew a revision to pass, which is what made it, in the plan's words, an instrument
the operator cannot reach. The run now names the tree it judged, because implying one is
the defect the naming exists to prevent. The file's PATH did not move: four other files
cite this one where it sits, and moving an instrument to tidy it would rename evidence.

EXIT CODES - three, and no report for the third (the convention #266 set for an instrument
whose invocability is part of the measurement):
    0  judged: every citation group that names a symbol landed on one of its numbers
    1  judged: at least one group did not land (the FAIL lines say which, and where)
    2  REFUSED - NOTHING WAS CHECKED. No git working tree, a revision that does not
       resolve, or `design-concepts/` listing no `.md` at that revision. Without this the
       run would print `0 ok, 0 FAILING` over an empty file list and read as a clean:
       a copy of this script outside a git tree gets 2, never 0.

BOTH REFUSALS WERE EARNED BY MEASUREMENT, not anticipated. The first cut of this fix ran
git with `-C <this file's own directory>`, and `git ls-tree <rev> design-concepts` reads
its pathspec RELATIVE TO THAT DIRECTORY - so from inside docs/evidence/... it matched
nothing and the check printed `0 ok, 0 FAILING, 0 unchecked`, exit 0, on a tree whose
citations it had just failed to read. A green computed over an empty list is not a
measurement. git therefore runs `-C <repository root>`, and an empty document list is
itself a refusal. (docs/evidence/one-entry-point-2026-10-20/runs.txt, section 2.)

The expectation is read OUT OF THE DOCUMENT being judged, not kept in a table here: for each citation
group, the backticked SYMBOLS on the citing line are what it claims, and the group passes if at least
one of its numbers lands on a line containing one of them. A group whose numbers all point somewhere
else is printed and the check exits 1. Groups that name no symbol are reported as UNCHECKED - the
checker can only judge a citation that names something; it does not guess.
"""
import os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))

def _git(cwd, *args):
    return subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True)

repo = _git(HERE, "rev-parse", "--show-toplevel").stdout.strip()

def git(*args):
    # -C <repo ROOT>, never -C <this file's directory>: a pathspec passed to ls-tree is
    # read relative to the directory git is told to work in, and this file lives four
    # levels down inside docs/evidence/.
    return _git(repo or HERE, *args)

doc_rev = sys.argv[1] if len(sys.argv) > 1 else git("rev-parse", "HEAD").stdout.strip()
code_rev = sys.argv[2] if len(sys.argv) > 2 else doc_rev
if not repo or not doc_rev or git("rev-parse", "--verify", doc_rev + "^{commit}").returncode != 0:
    print("REFUSED: nothing was checked - repo=%s rev=%s does not resolve."
          % (repo or "(no git working tree above this file)", doc_rev or "(no revision given)"))
    print("  run it in a git working tree with no argument, or name one:")
    print("    python3 check-doc-citations.py [<doc-rev> [<code-rev>]]")
    sys.exit(2)
tree = git("rev-parse", "--short", "HEAD").stdout.strip() or "UNKNOWN"

def show(rev, path):
    return git("show", f"{rev}:{path}").stdout

code = show(code_rev, "client/src/App.tsx").split("\n")
files = [f for f in git("ls-tree", "-r", "--name-only", doc_rev, "design-concepts").stdout.split("\n")
         if f.endswith(".md")]
if not files:
    print("REFUSED: nothing was checked - `git ls-tree %s design-concepts` listed no .md file."
          % doc_rev[:12])
    print("  (this file is run with -C <repo root> %s; a wrong -C matches no pathspec and would"
          % repo)
    print("   otherwise report `0 ok, 0 FAILING` as a clean)")
    sys.exit(2)

print("tree %s - doc %s vs code %s - %d document(s)"
      % (tree, doc_rev[:12], code_rev[:12], len(files)))

def symbol(t):
    if not t or "App.tsx" in t: return False
    if re.match(r"^[:：]?[\d,]+$", t): return False
    if re.match(r"^[0-9a-f]{7,40}$", t): return False
    if t.endswith((".md", ".tsx", ".js", ".json", ".css", ".sql")): return False
    return any(c in t for c in "= {}<>-_\"'")

ok = fail = unchecked = 0
for f in files:
    lines = show(doc_rev, f).split("\n")
    for i, l in enumerate(lines):
        if "App.tsx" not in l: continue
        nums = []
        for a, b in re.findall(r"App\.tsx[:：](\d+)|`[:：](\d+)`", l):
            n = int(a or b)
            if 1 <= n <= len(code): nums.append(n)          # a time (09:37:41) or a port (:5173) is not a citation
        if not nums: continue
        toks = [t.strip() for t in re.findall(r"`([^`]+)`", " ".join(lines[i:i+2]))]
        toks = [t for t in toks if symbol(t)][:12]
        if not toks:
            unchecked += 1; print(f"UNCHECKED {f}:{i+1} App.tsx:{nums} — the citing line names no symbol"); continue
        def hits(tok, line):
            ids = re.findall(r"[A-Za-z_][A-Za-z0-9_.-]{4,}", tok)
            return any(i in line for i in ids) if ids else (tok in line)
        landed = [n for n in nums if hits_any(toks, code[n-1])] if False else \
                 [n for n in nums if any(hits(t, code[n-1]) for t in toks)]
        if landed:
            ok += 1; print(f"ok        {f}:{i+1} App.tsx:{nums} -> landed {landed}")
        else:
            fail += 1
            found = code[nums[0]-1].strip()[:70] if 0 < nums[0] <= len(code) else "<past EOF>"
            print(f"FAIL      {f}:{i+1} App.tsx:{nums} expects one of {toks[:4]} — :{nums[0]} is {found!r}")
print(f"\ndoc {doc_rev[:12]} vs code {code_rev[:12]}: {ok} ok, {fail} FAILING, {unchecked} unchecked   [tree {tree}]")
sys.exit(1 if fail else 0)
