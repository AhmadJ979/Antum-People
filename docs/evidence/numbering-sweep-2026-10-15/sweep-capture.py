#!/usr/bin/env python3
# The sweep's raw capture: the class located BY TEXT, before and after.
# "before" is not hand-typed and not remembered — it is a pristine copy of HEAD
# (the tree as it stood when the sweep started), extracted with `git archive`.
import os, subprocess, shutil

REPO = "/home/agent-program-manager/antum-people"
BEFORE = "/tmp/sweep-before-tree"
PATTERNS = ["decision 14", "decision 13", "decision 15(b)", "kept for decision 14",
            "decision 14's subject", "behind owner decision 13", "owner decision 1,",
            "left open", "purpose-scoped consent"]

os.chdir(REPO)
shutil.rmtree(BEFORE, ignore_errors=True)
os.makedirs(BEFORE)
subprocess.run(f"git archive HEAD | tar -x -C {BEFORE}", shell=True, check=True)
head = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()

def grep(root, pattern):
    r = subprocess.run(["grep", "-rn", "--exclude-dir=node_modules", "--exclude-dir=.git",
                        "--exclude-dir=probable-octo-sniffle",
                        "--exclude-dir=numbering-sweep-2026-10-15",
                        "--exclude=raw-text-search.txt", "--", pattern, root],
                       capture_output=True, text=True, timeout=120)
    return [l.replace(root, "<tree>", 1) for l in r.stdout.splitlines()
            if "node_modules" not in l and "/.git/" not in l and "/probable-octo-sniffle/" not in l]

out = [f"# The numbering sweep's raw text searches — 2026-10-15, Round 47",
       f"# 'before' = a pristine git archive of HEAD ({head}), the tree the sweep started from —",
       f"# extracted with `git archive`, so the before-state is reproducible and not hand-typed.",
       f"# 'after' = the working tree with the sweep applied.",
       f"# NOTE: the two host files (/home/team/shared) are outside the repository and are not in",
       f"# the archive. Their before-state is the two strings this record quotes (\"owner decision 14\"",
       f"# and \"owner decision 1\"); their after-state is captured live in the last section.", ""]

for p in PATTERNS:
    b, a = grep(BEFORE, p), grep(REPO, p)
    out.append(f"=== pattern: {p!r}   (before: {len(b)} hits in the repo   after: {len(a)} hits)")
    out.append("--- BEFORE (repo at HEAD) ---")
    out += b or ["(none)"]
    out.append("--- AFTER (working tree) ---")
    out += a or ["(none)"]
    out.append("")

out.append("=== the two host files, AFTER (they are not in the repository; no before-archive exists) ===")
out.append("--- pattern: 'owner decision 14' / 'owner decision 15(b)' / 'owner decision 1' / 'owner decision 2', in /home/team/shared ---")
for p in ["owner decision 14", "owner decision 15(b)", "owner decision 1,", "owner decision 2"]:
    for l in grep("/home/team/shared", p):
        out.append(f"{p!r} -> {l}")

dest = os.path.join(REPO, "docs/evidence/numbering-sweep-2026-10-15/raw-text-search.txt")
open(dest, "w", encoding="utf-8").write("\n".join(out) + "\n")
print("wrote", dest, len(out), "lines")
