#!/usr/bin/env python3
# Round 47 — the numbering sweep + the tracker's own index updates (2026-10-15).
# Derived-or-refuse: every replacement asserts its own occurrence count BEFORE writing.
# Proved by: per-file md5 + line count before/after, and a per-hunk diff read afterwards.
import hashlib, os, re, subprocess, sys

REPO = "/home/agent-program-manager/antum-people"
SHARED = "/home/team/shared"
os.chdir(REPO)
MARK = '*(“14” → 17, numbering corrected 2026-10-15)*'

def md5(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest()

def lines(p):
    return len(open(p, encoding='utf-8').read().splitlines())

def sub(path, old, new, expect=1):
    """Replace `old` with `new`; refuse unless it occurs exactly `expect` times."""
    t = open(path, encoding='utf-8').read()
    n = t.count(old)
    assert n == expect, f"REFUSED {path}: expected {expect} occurrence(s) of {old!r}, found {n}"
    return t.replace(old, new)

FILES = []
def edit(path, *pairs):
    before_md5, before_lines = md5(path), lines(path)
    t = open(path, encoding='utf-8').read()
    for old, new in pairs:
        n = t.count(old)
        assert n == 1, f"REFUSED {path}: {n} occurrence(s) of {old[:70]!r}"
        t = t.replace(old, new, 1)
    open(path, 'w', encoding='utf-8').write(t)
    FILES.append((path, before_md5, md5(path), before_lines, lines(path)))
    print(f"  edited {path}: {before_md5[:12]} -> {md5(path)[:12]}  lines {before_lines} -> {lines(path)}")

# ---------------------------------------------------------------- raw capture
os.makedirs("docs/evidence/numbering-sweep-2026-10-15", exist_ok=True)
pats = ["decision 14", "decision 13", "decision 15(b)", "purpose-scoped consent",
        "owner decision 1,", "left open"]
raw = ["# raw text searches, before the sweep — the class, located BY TEXT (2026-10-15, Round 47)",
       f"# tree: {subprocess.run(['git','rev-parse','HEAD'],capture_output=True,text=True).stdout.strip()}", ""]
for p in pats:
    for root in (".", SHARED):
        r = subprocess.run(["grep", "-rn", "--exclude-dir=node_modules", "--exclude-dir=.git",
                            "--exclude-dir=probable-octo-sniffle", "--", p, root],
                           capture_output=True, text=True, timeout=120)
        hits = [l for l in r.stdout.splitlines()
                if "node_modules" not in l and "/.git/" not in l and "/probable-octo-sniffle/" not in l]
        raw.append(f"--- pattern: {p!r}   dir: {root}   hits: {len(hits)}")
        raw += hits
    raw.append("")
open("docs/evidence/numbering-sweep-2026-10-15/raw-text-search.txt", 'w', encoding='utf-8').write("\n".join(raw) + "\n")
print("  wrote raw-text-search.txt")

# ---------------------------------------------------------------- the sweep
print("A. the consent table, which is decision 17's")
edit("pdpl-lawful-basis-mapping.md",
     ("`consent_records` is kept for decision 14's purpose-scoped consent.",
      f"`consent_records` is kept for decision 17's purpose-scoped consent {MARK}."))
edit("docs/evidence/p2-6-premise-sweep/README.md",
     ("`consent_records` is **kept** for decision 14's purpose-scoped consent",
      f"`consent_records` is **kept** for decision 17's purpose-scoped consent {MARK}"),
     ("table stays for decision 14's purpose-scoped consent.",
      f"table stays for decision 17's purpose-scoped consent {MARK}."),
     ("is kept for decision 14's\n  purpose-scoped consent.",
      f"is kept for decision 17's\n  purpose-scoped consent {MARK}."))
edit("docs/evidence/decisions-21-17-2026-10-13/README.md",
     ("table and schema kept (purpose-scoped consent, decision 14).",
      f"table and schema kept (purpose-scoped consent, decision 17). {MARK}"))
edit("un-operable-controls-inventory.md",
     ("(table kept, decision 14)",
      f"(table kept, decision 17; “14” → 17, corrected 2026-10-15)"))
edit("server/reachability-register.js",
     ("decision 14's subject)", "decision 17's subject)"))

print("B. the quorum of two — portal 14, port collision 2")
edit("roadmap-board-index.md",
     ("unassigned behind owner decision 13;", "unassigned behind owner decision 14;"))

print("C. the quoted transcript keeps its words; a dated note goes under it")
p = "docs/evidence/pdpl-lawful-basis-mapping/README.md"
p_before, p_lines = md5(p), lines(p)
t = open(p, encoding='utf-8').read()
anchor = "$ git show origin/main:demo-weak-screens.md | sed -n '64p'"
assert t.count(anchor) == 1, "REFUSED: the quoted transcript's command line is not unique"
i = t.index(anchor)
j = t.index("\n```", i) + 4          # end of the fenced block
note = ("\n> **Numbering note, appended 2026-10-15.** The paragraph quoted above is a transcript of "
        "`demo-weak-screens.md:64` as it read then, and it keeps its own words and its own number. The question it calls "
        "*“owner decision 14”* — consent versus a notice acknowledgement — is **decision 15(b)**: 14 is the "
        "portal-identity question. `pdpl-lawful-basis-mapping.md:135` carries the same caution, and the sweep's "
        "record is `docs/evidence/numbering-sweep-2026-10-15/`.\n")
t2 = t[:j] + note + t[j:]
assert t2 != t
open(p, 'w', encoding='utf-8').write(t2)
FILES.append((p, p_before, md5(p), p_lines, lines(p)))
print(f"  annotated {p}: {p_before[:12]} -> {md5(p)[:12]}  lines {p_lines} -> {lines(p)}")

print("D. the two host files (not in the repository — no PR, no cutover)")
for path, old, new in [
    (f"{SHARED}/post-cutover-reground.md",
     "**left open** (owner decision 14)", f"**left open** (owner decision 15(b)) *(“14” → 15(b), corrected 2026-10-15)*"),
    (f"{SHARED}/post-replacement-availability-and-pii-window-2026-10-14.md",
     "collision of owner decision 1,", f"collision of owner decision 2 *(“1” → 2, corrected 2026-10-15)*,"),
]:
    edit(path, (old, new))

print("\nFILES TOUCHED IN THE REPO:")
for f, b, a, bl, al in FILES:
    print(f"  {f}  {b[:12]} -> {a[:12]}  lines {bl} -> {al}")
