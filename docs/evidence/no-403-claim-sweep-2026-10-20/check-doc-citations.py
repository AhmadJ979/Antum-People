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
THE REVISION PIN (added 2026-10-29, PR following #338). A dated reading is not a stale
citation, and the documents say so themselves: `LAYER2-PREBOARDING-UI.md` has carried the
rule "a pinned-revision cite is not a defect; an unpinned one is" since 2026-10-14, while
this instrument judged every number at the tip and consequently reddened on readings that
were correct at the revision they named. The marker is now readable:

    `@rev <sha>`     7-40 hex, appearing BEFORE the numbers it governs on the same line

A marker governs every citation number that follows it on that line, up to the next
marker; a number with no marker before it is judged at the code revision of the run (the
tip by default, or the second argument). So one line can carry readings from several
trees, and a number that is judged at the tip can follow a pinned run only if it comes
FIRST. A marker at the end of a line governs nothing - it is reported as UNUSED rather
than passed over. A marker that does not resolve to a commit, or that names a revision
where `client/src/App.tsx` does not exist, is a REFUSAL (exit 2): a pin is a claim about a
tree, and a claim the instrument cannot read is not a green.
The pin does NOT make a group judgeable: a group with no symbol is UNCHECKED whether or
not it is pinned. What the pin changes is WHICH TREE the symbol is looked for in.
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
_code_cache = {}
def code_at(rev):
    if rev not in _code_cache:
        _code_cache[rev] = show(rev, "client/src/App.tsx").split("\n")
    return _code_cache[rev]
code = code_at(code_rev)
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
    if re.match(r"^@rev [0-9a-f]{7,40}$", t): return False   # a pin MARKER is instrument syntax, not a symbol
    if re.match(r"^[:：]?[\d,]+$", t): return False
    if re.match(r"^[0-9a-f]{7,40}$", t): return False
    if t.endswith((".md", ".tsx", ".js", ".json", ".css", ".sql")): return False
    return any(c in t for c in "= {}<>-_\"'")
PIN = re.compile(r"@rev ([0-9a-f]{7,40})")
def pin_at(line, pos):
    """The revision governing a citation number at character offset `pos`: the last pin
    marker before it on the line, else the run's code revision."""
    rev = code_rev
    for m in PIN.finditer(line):
        if m.start() < pos: rev = m.group(1)
    return rev
def pin_unused(line):
    """A marker no number follows on this line governs nothing - say so, do not pass over."""
    last = None
    for m in PIN.finditer(line):
        last = m
    return last is not None and not re.search(r"[:\uff1a]\d+", line[last.end():])
bad_pins = []
for sha in sorted({m.group(1) for f in files for m in PIN.finditer(show(doc_rev, f))}):
    if git("rev-parse", "--verify", sha + "^{commit}").returncode != 0:
        bad_pins.append((sha, "does not resolve to a commit"))
    elif not show(sha, "client/src/App.tsx").strip():
        bad_pins.append((sha, "has no client/src/App.tsx"))
if bad_pins:
    print("REFUSED: nothing was checked - a revision pin cannot be read:")
    for sha, why in bad_pins:
        print("  @rev %-12s %s" % (sha, why))
    print("  A pin is a claim about a tree; a claim this instrument cannot read is not a green.")
    sys.exit(2)
ok = fail = unchecked = pinned = unused = 0
for f in files:
    lines = show(doc_rev, f).split("\n")
    for i, l in enumerate(lines):
        if "App.tsx" not in l: continue
        nums = []
        for m in re.finditer(r"App\.tsx[:\uff1a](\d+)", l):
            nums.append((int(m.group(1)), pin_at(l, m.start())))
        for m in re.finditer(r"`[:\uff1a](\d+)`", l):
            nums.append((int(m.group(1)), pin_at(l, m.start())))
        nums = [(n, r) for n, r in nums if 1 <= n <= len(code_at(r))]   # a time (09:37:41) or a port (:5173) is not a citation
        if not nums: continue
        if pin_unused(l):
            unused += 1
            print(f"UNUSED-PIN {f}:{i+1} - a `@rev` marker with no citation number after it on this line")
        toks = [t.strip() for t in re.findall(r"`([^`]+)`", " ".join(lines[i:i+2]))]
        toks = [t for t in toks if symbol(t)][:12]
        if not toks:
            unchecked += 1; print(f"UNCHECKED {f}:{i+1} App.tsx:{[n for n, _ in nums]} — the citing line names no symbol"); continue
        if any(r != code_rev for _, r in nums): pinned += 1
        def hits(tok, line):
            ids = re.findall(r"[A-Za-z_][A-Za-z0-9_.-]{4,}", tok)
            return any(i in line for i in ids) if ids else (tok in line)
        landed = [n for n, r in nums if any(hits(t, code_at(r)[n-1]) for t in toks)]
        if landed:
            ok += 1
            print(f"ok        {f}:{i+1} App.tsx:{[n for n, _ in nums]} -> landed {landed}")
        else:
            fail += 1
            n0, r0 = nums[0]
            found = code_at(r0)[n0-1].strip()[:70] if 0 < n0 <= len(code_at(r0)) else "<past EOF>"
            print(f"FAIL      {f}:{i+1} App.tsx:{[n for n, _ in nums]} expects one of {toks[:4]} — :{n0} at {r0[:12]} is {found!r}")
print(f"\ndoc {doc_rev[:12]} vs code {code_rev[:12]}: {ok} ok, {fail} FAILING, {unchecked} unchecked"
      f", {pinned} pinned, {unused} unused pin   [tree {tree}]")
sys.exit(1 if fail else 0)
