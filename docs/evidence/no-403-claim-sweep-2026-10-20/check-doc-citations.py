#!/usr/bin/env python3
"""Fail when an `App.tsx:<n>` citation in design-concepts/ does not land on what it names.

    python3 check-doc-citations.py <doc-rev> [<code-rev>]     (code-rev defaults to doc-rev)

The expectation is read OUT OF THE DOCUMENT being judged, not kept in a table here: for each citation
group, the backticked SYMBOLS on the citing line are what it claims, and the group passes if at least
one of its numbers lands on a line containing one of them. A group whose numbers all point somewhere
else is printed and the check exits 1. Groups that name no symbol are reported as UNCHECKED — the
checker can only judge a citation that names something; it does not guess.
"""
import re, subprocess, sys

doc_rev = sys.argv[1]
code_rev = sys.argv[2] if len(sys.argv) > 2 else doc_rev

def show(rev, path):
    return subprocess.run(["git", "show", f"{rev}:{path}"], capture_output=True, text=True).stdout

code = show(code_rev, "client/src/App.tsx").split("\n")
files = [f for f in subprocess.run(["git", "ls-tree", "-r", "--name-only", doc_rev, "design-concepts"],
         capture_output=True, text=True).stdout.split("\n") if f.endswith(".md")]

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
        nums = [int(x) for x in re.findall(r"[:：](\d+)", l)]
        if not nums: continue
        toks = [t.strip() for t in re.findall(r"`([^`]+)`", " ".join(lines[i:i+2]))]
        toks = [t for t in toks if symbol(t)][:12]
        if not toks:
            unchecked += 1; print(f"UNCHECKED {f}:{i+1} App.tsx:{nums} — the citing line names no symbol"); continue
        landed = [n for n in nums if 0 < n <= len(code)
                  and any(re.sub(r"\s+", " ", t) in re.sub(r"\s+", " ", code[n-1]) for t in toks)]
        if landed:
            ok += 1; print(f"ok        {f}:{i+1} App.tsx:{nums} -> landed {landed}")
        else:
            fail += 1
            found = code[nums[0]-1].strip()[:70] if 0 < nums[0] <= len(code) else "<past EOF>"
            print(f"FAIL      {f}:{i+1} App.tsx:{nums} expects one of {toks[:4]} — :{nums[0]} is {found!r}")
print(f"\ndoc {doc_rev} vs code {code_rev}: {ok} ok, {fail} FAILING, {unchecked} unchecked")
sys.exit(1 if fail else 0)
