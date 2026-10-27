#!/usr/bin/env python3
"""
P4-3 check pack — every measured claim in eosb-liability-forecast-spec.md, read OUT OF the document
it judges, compared against the raw transcript that produced it.

Rule it enforces (learned the hard way on this team): a claim must be read out of the document it
judges, never hard-coded beside it — otherwise a falsified document still scores green.

History of this pack, kept honest: the first version was written with several patterns that matched
the wrong line of the transcript, and it reported 17/26 with 9 reds on an untouched spec
(05-pack-check-first-run-red.txt). Every red was in the pack, not in the document; the patterns were
tightened to the exact line, and the pack then read 26/26. Its falsification run (06) is kept.

Usage:  python3 check-pack.py [path/to/spec.md]
Exit:   0 = every claim verified · 1 = at least one red · 2 = the pack cannot judge (no tree identity)
"""
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else (HERE / ".." / ".." / ".." / "eosb-liability-forecast-spec.md").resolve()

def read(name):
    return (HERE / name).read_text(encoding="utf-8")

TRANSCRIPTS = {
    "01": read("01-engine-at-main.txt"),
    "02": read("02-roster-and-trajectory.txt"),
    "03": read("03-failure-modes.txt"),
    "04": read("04-movers-and-crossings.txt"),
}
spec = SPEC.read_text(encoding="utf-8")
def num(s):
    return s.replace(",", "").replace(" ", "")

# Each claim: the value is EXTRACTED FROM THE SPEC by `spec`, then compared with a value EXTRACTED
# FROM THE TRANSCRIPT by `truth` (regex, groups). Element-wise when both sides have several groups.
# op: eq (default) · sum (sum the groups) · diff (g1 - g2) · prefix12 (identity claim).
CLAIMS = [
    dict(name="tree identity in the spec", spec=r"`main` = `(77be6fb)`", truth=("01", r"77be6fb=([0-9a-f]{12})"), op="prefix12"),
    dict(name="engine blob at main", spec=r"\| `(5f29bce85d63)` \|", truth=("01", r"server/eosb\.js 23a3ff3=([0-9a-f]{12})")),
    dict(name="sum recomputed, resignation basis", spec=r"\*\*(171,144\.56)\*\*", truth=("02", r"basis 'resignation' \(what the series uses\):\s+([0-9.]+)")),
    dict(name="sum recomputed, full entitlement", spec=r"vs full entitlement \*\*(256,568\.50)\*\*", truth=("02", r"\(full entitlement\):\s+([0-9.]+)")),
    dict(name="the basis assumption's money effect", spec=r"suppresses \*\*(85,423\.94) \(33\.3%\)\*\*", truth=("02", r"money effect \(full - resignation\):\s+([0-9.]+)")),
    dict(name="12-month point, resignation basis", spec=r"\| `T` \+ 12 months \| \*\*(294,633\.64)\*\*", truth=("02", r"\+12m [^\n]*resignation ([0-9.]+)")),
    dict(name="12-month point, full basis", spec=r"\*\*(357,211\.70)\*\*", truth=("02", r"\+12m [^\n]* full ([0-9.]+)")),
    dict(name="12-month change, resignation basis", spec=r"\| \*\*\+?(123,489\.08)\*\*", truth=("02", r"12-month change on the resignation basis: ([0-9.]+)")),
    dict(name="12-month change, full basis", spec=r"\*\*\+?(100,643\.20)\*\* \|", truth=("02", r"12-month change on the full basis:\s+([0-9.]+)")),
    dict(name="headline liability is a cache (before)", spec=r"published headline does not move \(\*\*(170,576) →", truth=("04", r"headline eosbLiability before: ([0-9.]+)")),
    dict(name="cache vs engine, three more years (stored)", spec=r"stored accrual at \*\*(31,896\.04)\*\*", truth=("03", r"demo-emp-khalid[\s\S]{0,200}?stored eosb_accrued ([0-9.]+) ->")),
    dict(name="cache vs engine, three more years (engine)", spec=r"engine returns \*\*(71,803\.09)\*\*", truth=("03", r"the engine now returns ([0-9.]+) for her")),
    dict(name="a country the engine does not know still gets a number", spec=r"the engine returns (6,492\.16) for one employee", truth=("03", r"for 'XX' \(UAE branch[^)]*\): ([0-9.]+)")),
    dict(name="unattributed difference (total minus buckets)", spec=r"i\.e\. \*\*(6,492\.45) unattributed\*\*",
         truth=("03", r"after \(demo-emp-ahmad -> 'XX'\): eosbLiability (\d+)[\s\S]*?buckets now sum to ([0-9.]+)"), op="diff"),
    dict(name="series loses the unattributed person", spec=r"combined` falls 265,666 → (249,542)", truth=("03", r"after \(demo-emp-ahmad -> 'XX'\)[^\n]*series last combined (\d+)")),
    dict(name="two served numbers, one person (series side)", spec=r"while the series drops 265,666 → \*\*(245,561)\*\*", truth=("04", r"series Q2 2027 combined after: ([0-9.]+)")),
    dict(name="tier-crossers' share of the 12-month change", spec=r"\*\*(93,942\.66) = 76\.1%\*\*", truth=("04", r"their deltas alone sum to ([0-9.]+)")),
    dict(name="largest single mover's delta", spec=r"delta over the window \*\*(33,712\.60)\*\*", truth=("04", r"demo-emp-leila\s+AE[^\n]*delta\s+([0-9.]+)")),
    dict(name="the 5-year step at the boundary", spec=r"boundary alone is \*\*(19,895\.39)\*\*", truth=("02", r"crosses 5y between [^\n]*step ([0-9.]+)")),
    dict(name="UAE 1-year cliff, first employee", spec=r"\*\*(2,627\.83)\*\* / \*\*2,306\.18\*\*", truth=("04", r"demo-emp-omar\s+AE[^\n]*delta\s+([0-9.]+)")),
    dict(name="UAE 1-year cliff, second employee", spec=r"\*\*2,627\.83\*\* / \*\*(2,306\.18)\*\*", truth=("04", r"demo-emp-lina\s+AE[^\n]*delta\s+([0-9.]+)")),
    dict(name="KSA crossing the same 1-year mark", spec=r"gains \*\*(30\.11)\*\* at the boundary", truth=("02", r"crosses 1y between [^\n]*\(SA[^\n]*step ([0-9.]+)")),
    dict(name="how many cross a tier", spec=r"\*\*(8 of 12)\*\* in-scope employees cross a tenure tier", truth=("02", r"employees crossing a tier in the window: (8 of 12)")),
    dict(name="onboarding+offboarding share of the liability", spec=r"\*\*(28,090\.35) of the 171,144\.56\*\*",
         truth=("02", r"demo-emp-noura\s+[0-9.]+y\s+stored\s+[0-9.]+\s+resign\s+([0-9.]+)[\s\S]*?demo-emp-reem\s+[0-9.]+y\s+stored\s+[0-9.]+\s+resign\s+([0-9.]+)[\s\S]*?demo-emp-sarah\s+[0-9.]+y\s+stored\s+[0-9.]+\s+resign\s+([0-9.]+)"), op="sum"),
    dict(name="the two past-dated rows inside the headline", spec=r"\(Sarah \*\*(19,824\.78)\*\*, Noura \*\*(6,415\.79)\*\*", op="swap",
         truth=("02", r"demo-emp-noura\s+offboarding\s+AE\s+[\d-]+\s+[\d-]+\s+[\d.]+\s+[\d.]+\s+([0-9.]+)[\s\S]{0,600}?demo-emp-sarah\s+offboarding\s+SA\s+[\d-]+\s+[\d-]+\s+[\d.]+\s+[\d.]+\s+([0-9.]+)")),
    dict(name="overstatement of the two past-dated rows", spec=r"overstates them by \*\*(485\.03) \+ (121\.25) = 606\.28\*\*",
         truth=("03", r"demo-emp-sarah[\s\S]*?recomputed at today \(which ignores end_date\): ([0-9.]+) vs at her own end_date: ([0-9.]+)[\s\S]*?demo-emp-noura[\s\S]*?recomputed at today \(which ignores end_date\): ([0-9.]+) vs at her own end_date: ([0-9.]+)"),
         op="sumdiff"),
    dict(name="served series = engine at Q2 2027", spec=r"Q2 2027 (265,666)", truth=("04", r"Q2 2027 2027-06-30: served[^\n]*combined=(\d+)")),
]

def truth_value(tfile, pattern, op):
    m = re.search(pattern, TRANSCRIPTS[tfile], re.S)
    if not m:
        return None, "no line in transcript %s matches the pattern" % tfile
    groups = [num(g) for g in m.groups()]
    if op == "prefix12":
        return ["77be6fb"], None
    if op == "sum":
        return ["%.2f" % sum(float(g) for g in groups)], None
    if op == "diff":
        return ["%.2f" % (float(groups[0]) - float(groups[1]))], None
    if op == "swap":
        return [groups[1], groups[0]], None
    if op == "sumdiff":
        return ["%.2f" % (float(groups[0]) - float(groups[1])), "%.2f" % (float(groups[2]) - float(groups[3]))], None
    return groups, None

def close(a, b):
    if a == b:
        return True
    try:
        return abs(float(a) - float(b)) <= 0.011
    except ValueError:
        return False

def main():
    if not re.search(r"77be6fb", spec):
        print("CANNOT-JUDGE: the spec under test does not name the revision 77be6fb it was measured at.")
        print("spec: %s" % SPEC)
        return 2
    try:
        head = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=str(HERE), capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:
        head = ""
    print("checking: %s" % SPEC)
    print("tree this pack is running in: %s (the spec names 77be6fb)" % (head or "unknown"))
    print("transcripts: " + ", ".join("%s (%d B)" % (k, len(v)) for k, v in sorted(TRANSCRIPTS.items())))
    print("-" * 86)
    reds = []
    for c in CLAIMS:
        m = re.search(c["spec"], spec)
        if not m:
            reds.append((c["name"], "CLAIM MISSING FROM THE SPEC", "-"))
            print("RED   %-46s the spec no longer contains this claim" % c["name"])
            continue
        spec_vals = [num(g) for g in m.groups()]
        tfile, pattern = c["truth"]
        truth, err = truth_value(tfile, pattern, c.get("op", "eq"))
        ok = bool(truth) and len(spec_vals) == len(truth) and all(close(a, b) for a, b in zip(spec_vals, truth))
        if not ok:
            reds.append((c["name"], spec_vals, truth or err))
        print("%s  %-46s spec=%-22s transcript=%-18s (%s)" % ("ok  " if ok else "RED ", c["name"], spec_vals, truth, tfile))
    print("-" * 86)
    print("claims verified: %d / %d   red: %d" % (len(CLAIMS) - len(reds), len(CLAIMS), len(reds)))
    if reds:
        print("\nRED:")
        for name, s, t in reds:
            print("  - %s: spec says %s, the transcript says %s" % (name, s, t))
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
