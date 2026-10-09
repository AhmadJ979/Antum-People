#!/usr/bin/env python3
"""Cross-check every task id quoted in the board index against the board itself.

Since 2026-10-08 the index's single authoritative copy is the REPOSITORY one
(roadmap-board-index.md in AhmadJ979/Antum-People); /home/team/shared holds only a
pointer, and checking the pointer would silently find nothing. Pass a path to check
a different copy.

Landed in the repository on 2026-10-09 (Round 32) so the next holder of the tracker
does not have to rediscover it; the procedure it serves is skills/antum-board-row-removal.
Run it from the repository root or anywhere else:

    python3 scripts/check-index-ids.py
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_INDEX = os.path.join(HERE, os.pardir, "roadmap-board-index.md")
INDEX = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INDEX)
text = open(INDEX).read()
quoted = sorted(set(re.findall(r"`([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})`", text)))

out = subprocess.run(
    ["team-db", "SELECT id, title, status FROM tasks"],
    capture_output=True, text=True, check=True,
)
board = {r["id"]: r for r in json.loads(out.stdout)}

# Ids the index quotes ON PURPOSE as removed, each recorded in the single "Removed
# rows" block that says what happened to the row. These are expected to be absent
# from the board; anything else absent is a real error. Add a row here only after a
# removal was run and read back empty. The 8-hex prefix of each is exempted
# automatically below, which matters: a removed id is usually also quoted in short
# form somewhere, and that check would otherwise fail forever.
#
# A removal that follows a DECISION rather than a duplicate can additionally be
# quoted throughout the DATED ROUNDS - a decision row reads "still backlog" in round
# after round, and rewriting those lines would rewrite the record of what was read
# when. That is allowed: the rounds say what was read then, and the "Removed rows"
# block is the one place in the index that says what happened to the row.
REMOVED = {
    "86c3927d-b6c3-4da2-9ecf-df2b9e4ee20b",  # L2-F1, removed 2026-10-07 (duplicate of bc89d0bd)
    "e09c6873-dac3-4573-b3c5-b69328a2f829",  # L2-F2, removed 2026-10-07 (resolved by owner decision)
    "91f44175-4204-4a20-976a-b1318578da7b",  # demo case-1 decision row, removed 2026-10-09 (owner ruled: leave case 1)
}

# 8-hex tokens the index quotes that are neither board ids nor git objects: rule 19
# publishes, on every round, the sha256 of the index content its PR merged, and that
# is quoted in short form. They are legitimate, so they must not read as typos - but
# they are also not self-evidently real, so re-derive any entry before trusting it.
# All of these reproduce from the index's own history:
#   git show 25a3af0:roadmap-board-index.md | sha256sum   ->  0171e2f3...
#   git show ff498d5:roadmap-board-index.md | sha256sum   ->  1132b63b... (3-commit tree)
#   git show 51097e6:roadmap-board-index.md | sha256sum   ->  1171239d... (= main's file)
# NOTE: the set grows by one entry per round that quotes a fresh content sha in short
# form. When the checker reports a token here as unresolved, re-derive it first - and
# only then add it. A token that does NOT re-derive is exactly the typo this catches.
CONTENT_SHAS = {
    "0171e2f3",  # index content merged by PR #101, 2026-10-09 09:35:52Z
    "1132b63b",  # #102 as 3 commits - the tree the lead's first verification measured
    "1171239d",  # #102 as frozen and merged, 4 commits (now on main as 2028894)
    "b484920f",  # index content merged by PR #105 (Round 32), 2026-10-09 12:12:31Z
}

print("index checked:", INDEX)
print("ids quoted in index:", len(quoted))
if not quoted:
    # A pointer file or an empty file quotes no ids, so every check below would
    # pass vacuously. Refuse rather than report a false clean.
    print("FAIL: no task ids found in that file - nothing was checked.")
    raise SystemExit(2)
missing = [i for i in quoted if i not in board]
unexpected = [i for i in missing if i not in REMOVED]
print("quoted ids NOT on the board:", missing)
print("...of which EXPECTED (recorded removals):", sorted(i for i in missing if i in REMOVED))
print("...of which UNEXPECTED (must be empty):", unexpected)

# Tokens that are known-good and need no further resolution: a deliberately removed
# id's prefix, and a published content sha.
known_other = {i[:8] for i in REMOVED} | CONTENT_SHAS

# Short-form references (``b2b93295-…``) escape a full-UUID regex. Check each 8-hex
# prefix inside backticks resolves to exactly one board row, so a truncated or
# mistyped short id cannot slip through the gap the full-UUID check leaves.
short = sorted(set(re.findall(r"`([0-9a-f]{8})[-…\s]", text)))
bad_short = []
for s in short:
    if s in known_other:
        continue  # deliberately dead id, or a published content sha
    hits = [i for i in board if i.startswith(s)]
    if len(hits) != 1:
        bad_short.append((s, len(hits)))
print("short-form refs checked:", len(short))
print("short refs that do NOT resolve to exactly one board row:", bad_short)

# The index's MOST COMMON id form is a bare backticked 8-hex token (`1b7a3f03`),
# with no dash/ellipsis after it - so it escapes both checks above (the full-UUID
# regex needs 36 chars, the short-form regex needs a trailing separator). Left
# uncovered, a mistyped bare short id passes silently: exactly the failure this
# tool exists to catch. Each such token must be EITHER exactly one board row OR a
# real git object (a commit/tree sha is legitimately quoted too). Anything else is
# a typo. Board ids are matched first, since an 8-hex board prefix is never a sha.
repo = os.path.dirname(os.path.abspath(INDEX)) or "."
bare = sorted(set(re.findall(r"`([0-9a-f]{8})`", text)))
ok_row, ok_git, bad_bare = [], [], []
for t in bare:
    if t in known_other:
        continue
    if len([i for i in board if i.startswith(t)]) == 1:
        ok_row.append(t)
        continue
    r = subprocess.run(["git", "-C", repo, "cat-file", "-t", t], capture_output=True, text=True)
    if r.returncode == 0:
        ok_git.append(t)
        continue
    bad_bare.append(t)
print("bare backticked 8-hex tokens:", len(bare))
print("  ...resolving to exactly one board row:", len(ok_row))
print("  ...resolving to a git object (sha):", len(ok_git))
print("  ...NEITHER (typos) - must be empty:", bad_bare)
for i in quoted:
    if i in board:
        print("%s  %s  [%s]" % (i, board[i]["title"][:70], board[i]["status"]))
