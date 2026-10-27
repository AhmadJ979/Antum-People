#!/usr/bin/env python3
"""pack-check.py — verify this pack's claims against its own artifacts.

Run:  python3 docs/evidence/p3-3-screen-2026-10-26/pack-check.py [pack_dir]

Every check is load-bearing: it fails if the claim it covers is false in the artifact it names.
The check is deliberately able to REDDEN — a pack whose checker cannot fail proves nothing.
Prove it by copying the pack, falsifying one claim in the copy, and re-running (see README).
"""
import json
import hashlib
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = sys.argv[1] if len(sys.argv) > 1 else HERE


def find_repo():
    """The tree the source checks read. Walk up from the pack, then ask git from the pack's dir.

    Returns None when there is no repository to judge — the copy-in-/tmp case. That state is
    CANNOT-JUDGE (exit 2), never a FAIL: a check that reports "the claim is false" because it
    could not open the file would be a false red, and a check that quietly passes would be a
    false green. Both are worse than saying "I could not tell".
    """
    d = PACK
    for _ in range(8):
        if os.path.isdir(os.path.join(d, ".git")) or os.path.isfile(os.path.join(d, ".git")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    try:
        out = subprocess.run(["git", "-C", PACK, "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True)
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except OSError:
        pass
    return None


REPO = find_repo()

results = []


def check(cid, claim, ok, detail=""):
    results.append((cid, claim, bool(ok), detail))


def cannot_judge(cid, claim, why):
    results.append((cid, claim, None, why))


def read(name):
    with open(os.path.join(PACK, name), encoding="utf-8") as fh:
        return fh.read()


# --- C1: the pack's own bytes --------------------------------------------------------------
md5_lines = [l for l in read("md5sums.txt").splitlines() if l.strip()]
bad = []
for line in md5_lines:
    want, _, path = line.partition("  ")
    try:
        got = hashlib.md5(open(os.path.join(PACK, path), "rb").read()).hexdigest()
    except OSError as exc:
        bad.append("%s (%s)" % (path, exc))
        continue
    if got != want:
        bad.append("%s: want %s got %s" % (path, want, got))
check("C1", "every file matches md5sums.txt", not bad, "; ".join(bad) or "%d files" % len(md5_lines))

# --- C2: what the screen showed -----------------------------------------------------------
panel_raw = read("04-probation-panel.txt").strip()
panel = json.loads(json.loads(panel_raw)) if panel_raw.startswith('"') else json.loads(panel_raw)
text = panel.get("panel", "") + "\n"
full = text.upper()
check("C2a", "the panel is on screen (heading 'Probation timelines')", "PROBATION TIMELINES" in full)
check("C2b", "Omar's day-30 milestone reads OVERDUE on screen", "DAY 30 · OVERDUE · 19 SEP 2026" in text)
check("C2c", "Omar's day-60 milestone reads OVERDUE on screen", "DAY 60 · OVERDUE · 19 OCT 2026" in text)
check("C2d", "the word 'escalat' appears on screen ZERO times",
      panel.get("escalation_mentions") == 0 and "escalat" not in text.lower(),
      "count=%r" % panel.get("escalation_mentions"))
names = panel.get("manager_names", {})
check("C2e", "no manager-chain name from Fatima/Khalid is on screen",
      names.get("Fatima") == 0 and names.get("Khalid") == 0, json.dumps(names))

# --- C3: what the API carried (so the gap is the screen, not the data) --------------------
payload = read("02-api-payload.txt")
for who in ("Salim Al-Nuaimi", "Fatima Al-Zahrani", "Khalid Al-Dosari"):
    check("C3-" + who.split()[0], "the payload names %s" % who, who in payload)
check("C3-missing", "the payload shows the chain resolved with nothing missing",
      '"missing": []' in payload and '"resolved": true' in payload)

# --- C4: the code gap ---------------------------------------------------------------------
gap = read("06-code-gap.txt")
check("C4a", "the client has no caller for the escalations route", "NO CLIENT CALLER" in gap)
check("C4b", "the client contains no 'escalat' at all", "ZERO occurrences" in gap)
check("C4c", "the timelines payload (the only probation call) carries no reporting/escalation field",
      "NO CLIENT CALLER" in gap and "reporting_line" in read("06-code-gap.txt"))

# --- C5: the verdict is stated and is the one the evidence supports -----------------------
readme = read("README.md")
check("C5", "the verdict line is DOES NOT SHOW IT", "Verdict: DOES NOT SHOW IT" in readme)

# --- C6: re-derive the decisive fact from the source tree, not from this pack -------------
def git_grep(pattern):
    # -i, and a path that works whether REPO is the repo root or a parent of it
    p = subprocess.run(["git", "-C", REPO, "grep", "-ni", pattern, "--", "client/"],
                       capture_output=True, text=True)
    return p.stdout.strip()


if REPO is None:
    for cid, claim in (("C6a", "source tree: `git grep -i escalat client/` returns nothing"),
                       ("C6b", "source tree: no client reference to the escalations route"),
                       ("C7c", "source tree: the route is inside the CALLERLESS block")):
        cannot_judge(cid, claim, "no repository above %s" % PACK)
else:
    hits = git_grep("escalat")
    check("C6a", "source tree: `git grep -i escalat client/` returns nothing", hits == "", hits[:200])
    esc_route = git_grep("probation/escalations")
    check("C6b", "source tree: no client reference to the escalations route", esc_route == "", esc_route[:200])

# --- C7: the gap is REGISTERED, not a discovery — the pack must not overclaim --------------------
reg = read("07-register-says-callerless.txt")
check("C7a", "the register entry is filed as evidence, naming the route",
      "'GET /api/probation/escalations'" in reg, "")
check("C7b", "the register entry names an owner (decision 21) and says the screen does not exist yet",
      "decision 21" in reg and "does not exist yet" in reg, "")
# re-derive it from the source tree: the key must sit inside the CALLERLESS block
if REPO is not None:
    regpath = os.path.join(REPO, "server", "reachability-register.js")
    try:
        regsrc = open(regpath, encoding="utf-8").read()
    except OSError as exc:
        cannot_judge("C7c", "source tree: the route is inside the CALLERLESS block", str(exc))
    else:
        block = regsrc.split("const CALLERLESS = {")[1].split("\n};")[0] if "const CALLERLESS = {" in regsrc else ""
        inside = "'GET /api/probation/escalations'" in block
        check("C7c", "source tree: the route is inside the CALLERLESS block", inside,
              "%d chars of block" % len(block))

# --- report -------------------------------------------------------------------------------
# 0 = every claim held · 1 = a claim is FALSE · 2 = a claim could not be judged at all.
# A check that cannot be judged must not read as a pass (WORKFLOW: CANNOT-JUDGE, exit 2).
width = max(len(c) for c, _, _, _ in results)
failed = unjudged = 0
for cid, claim, ok, detail in results:
    if ok is None:
        unjudged += 1
        verdict = "CANNOT-JUDGE"
    else:
        verdict = "PASS" if ok else "FAIL"
        if not ok:
            failed += 1
    print("%-*s  %-12s  %s%s" % (width, cid, verdict, claim,
                                 ("  [%s]" % detail) if detail else ""))
print("\n%d checks, %d failed, %d cannot-judge" % (len(results), failed, unjudged))
sys.exit(1 if failed else (2 if unjudged else 0))
