#!/usr/bin/env python3
"""counsel-letter - the counsel letter packages live in THIS REPOSITORY and are judged here.

WHY THIS ROW EXISTS
  Until 2026-11-07 the letters, their `.md` companions, the cover email, the send index, the
  D1-D5 record and the two verifiers that judge them sat in /home/team/shared with no history
  and no check. The team's own rule is "one authoritative copy: the repository", and these were
  the last live documents outside it. Moving them in is only half the job: a document nobody
  checks drifts. This row is the check.

WHAT IT ASSERTS (four separate things, each printed with its own counts)
  1. Every file of the UAE package is PRESENT in counsel/uae-2026-11/. A missing one is RED and
     named - never a quiet skip. (The moved package is part of the tree, so its absence is a
     defect in the tree, not an absent environment.)
  2. EACH OF THE FOUR PAIRS is judged on its own, and the counts are printed PER PAIR - never
     rolled into one aggregate, because an aggregate hides which letter moved. The comparison
     is the word-stream rule: strip `##` headings (`.md` side), strip `**` and backticks (both
     sides), compare token lists. Two shapes exist in this tree and each is declared below with
     the evidence for it, not assumed:
       * `twin` - the `.md` and the `.txt` are the same letter, and must be WORD-IDENTICAL
         (0 differing tokens). A pair that disagrees with itself is RED with the differing
         regions and their positions printed.
       * `document+letter` - the `.md` is a working document (cross-walk tables, a premise
         audit, decision numbers) that CONTAINS the letter, so it is longer than the letter by
         construction. Word-identity is not asserted for it and never was; what IS asserted is
         that the document still NAMES the letter it wraps - so renaming the letter, or dropping
         the pointer to it, reddens.
  3. The send index's four md5 pins still hold. The index is the record of the bytes that were
     approved, so a letter whose bytes move without its pin moving is RED. The fix is to
     re-hash and record the new figure - never to loosen the pin.
  4. Appendix B is still true: each quoted row is the `description` field of the line it
     cites in server/compliance_engine.js, the row set still covers every citation-bearing
     description, and the letter's two md5 pins still hold - the appendix verifier, which
     reads its claims out of the document rather than from a variable.

WHERE THE PATHS COME FROM
  Every path is resolved from this file, so the row judges the tree it is run in - a
  worktree, a clone, CI - and never a hardcoded /home/team/shared prefix. The one input
  still outside the repository is the checklist-strings document the Appendix B rows are
  quoted from (it was not moved with the package). When it is absent this row exits 3 and
  check-all prints SKIP-FLAGGED and counts it as SKIPPED, never OK - the same declaration
  `workflow-mirror` makes for its live file.

EXIT CODES (the team's convention)
  0 green · 1 RED (a named defect in the tree) · 2 REFUSED (bad invocation - it did not
  understand what it was asked to judge, so it refuses rather than buying a green) ·
  3 the outside-repo input is absent: NOTHING WAS JUDGED by the appendix half.

REPRODUCING THE RED
  Two overrides judge a copy somewhere else, which is how the row's ability to redden is
  demonstrated without touching the tree:
      # the whole counsel tree, for a per-pair mutation
      cp -r counsel /tmp/mut/counsel && ln -s "$PWD/server" /tmp/mut/server
      # change one character in /tmp/mut/counsel/ksa-2026-11/*--send-ready.txt
      python3 scripts/check-counsel-letter.py --root /tmp/mut
      # or just the UAE package
      python3 scripts/check-counsel-letter.py --letter-dir /tmp/mut/counsel/uae-2026-11
  An argument this script does not understand is exit 2, never a clean run.
"""
import hashlib
import os
import re
import subprocess
import sys
import difflib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# The one input outside the repository: the doc the B/K rows are quoted from. Not moved with
# the package (see counsel/README.md), so its absence is a skip, not a red.
APPENDIX_DOC = os.environ.get("APPENDIX_DOC",
                              "/home/team/shared/uae-appendix-b-checklist-strings.md")
PY = sys.executable or "python3"

# The UAE package. The two verifiers travel WITH it: a check that lives somewhere else can drift
# from the thing it checks, and this directory is the one home the whole package has.
REQUIRED = [
    "uae-counsel-confirmation-request--send-ready.txt",
    "uae-counsel-confirmation-request.md",
    "counsel-package-cover-email-2026-10-29.txt",
    "counsel-package-send-index-2026-10-29.md",
    "uae-counsel-letter-d1-d5-applied-2026-11-07.md",
    "appendix-b-verify.py",
    "uae-letter-wordstream-check.py",
]

# THE FOUR PAIRS. `shape` is measured, not assumed, and the evidence for each is recorded here
# so a later reader can re-check the classification instead of trusting it:
#   uae, ksa    -> twin.  Measured 2026-11-07: 1681/1681 and 1154/1154 tokens, 0 differing.
#   pdpl,access -> document+letter.  Measured 2026-11-07: pdpl 2316 md / 1412 txt tokens and 70
#                  differing regions, access 1628/720 and 38. The `.md` of each carries a
#                  cross-walk table and a premise audit and says so in its own text (access:
#                  "Send-ready text: ... (the letter; line 1 is a status line, not part of the
#                  letter)"). These were never word-identical, so requiring identity would be a
#                  red no edit could ever clear - and a permanently red row is a row the team
#                  learns to ignore. What is required of them instead: the document names its
#                  letter, and the send index pins its bytes (assertion 3).
PAIRS = [
    dict(id="uae", dir="counsel/uae-2026-11",
         md="uae-counsel-confirmation-request.md",
         txt="uae-counsel-confirmation-request--send-ready.txt", shape="twin", pin="UAE"),
    dict(id="ksa", dir="counsel/ksa-2026-11",
         md="ksa-counsel-confirmation-request.md",
         txt="ksa-counsel-confirmation-request--send-ready.txt", shape="twin", pin="KSA"),
    dict(id="pdpl", dir="counsel/pdpl-2026-11",
         md="pdpl-counsel-request.md",
         txt="pdpl-counsel-request--send-ready.txt", shape="document+letter", pin="PDPL"),
    dict(id="access", dir="counsel/access-2026-11",
         md="access-model-counsel-request.md",
         txt="access-model-counsel-request--send-ready.txt", shape="document+letter",
         pin="access"),
]

SEND_INDEX = "counsel/uae-2026-11/counsel-package-send-index-2026-10-29.md"

USAGE = ("usage: check-counsel-letter.py [--root <dir>] [--letter-dir <dir>]\n"
         "  judges the four counsel letter packages under <root>/counsel/ (default: this tree)\n"
         "  --letter-dir overrides only the UAE package directory\n"
         "  exit 0 green / 1 RED / 2 refused / 3 appendix input absent (NOTHING JUDGED there)")


def run(script):
    """Run a verifier from the package directory and hand back (exit, output)."""
    p = subprocess.run([PY, script], capture_output=True, text=True, timeout=300)
    return p.returncode, (p.stdout + p.stderr).strip()


def counts(text):
    """Read the verifier's OWN counts out of its output. A missing count is reported as
    absent, never defaulted to zero - a zero the instrument did not print is a number this
    runner invented."""
    out = {}
    for key, pat in (("checks", r"^checks run:\s*(\d+)"), ("failing", r"^FAILING:\s*(\d+)"),
                     ("md_tokens", r"^md\s+tokens[^:]*:\s*(\d+)"),
                     ("txt_tokens", r"^txt tokens:\s*(\d+)"),
                     ("differing", r"^differing regions:\s*(\d+)")):
        m = re.search(pat, text, re.M)
        out[key] = int(m.group(1)) if m else None
    if "0 differing tokens" in text:
        out["differing"] = 0
    return out


def tokens(path, markdown):
    """The word-stream rule, byte for byte the one counsel/uae-2026-11/uae-letter-wordstream-check.py
    applies: strip heading markers on the `.md` side, strip `**` and backticks on both sides, then
    compare token lists. Restated here because that verifier is bound to its own directory, and
    this table must be able to judge a pair in any of the four."""
    text = open(path, encoding="utf-8").read()
    if markdown:
        text = re.sub(r"(?m)^#+\s*", "", text)
    text = text.replace("**", "").replace("`", "")
    return text.split()


def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def judge_pair(root, pair, letter_dir_override):
    """Judge one pair. Returns (red_reasons, printable_lines). Every reason names the pair."""
    lines = []
    red = []
    pid = pair["id"]
    pkg = letter_dir_override if (letter_dir_override and pid == "uae") \
        else os.path.join(root, pair["dir"])
    md_path = os.path.join(pkg, pair["md"])
    txt_path = os.path.join(pkg, pair["txt"])

    missing = [p for p in (md_path, txt_path) if not os.path.isfile(p)]
    if missing:
        for p in missing:
            lines.append("  %-6s MISSING: %s" % (pid, p))
        red.append("%s: a file of the pair is missing - the pair cannot be judged" % pid)
        return red, lines

    a = tokens(md_path, True)
    b = tokens(txt_path, False)
    regions = [op for op in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes()
               if op[0] != "equal"]
    identical = (a == b)
    lines.append("  %-6s shape=%-15s md %4d tokens / txt %4d tokens / %d differing region(s)"
                 % (pid, pair["shape"], len(a), len(b), len(regions)))

    if pair["shape"] == "twin":
        if not identical:
            red.append("%s: the twin pair is NOT word-identical (%d differing region(s))"
                       % (pid, len(regions)))
            for tag, i1, i2, j1, j2 in regions[:8]:
                lines.append("      %-8s md[%d:%d]=%r  txt[%d:%d]=%r"
                             % (tag, i1, i2, a[i1:i2][:10], j1, j2, b[j1:j2][:10]))
            if len(regions) > 8:
                lines.append("      ... %d further region(s) not printed" % (len(regions) - 8))
    else:
        # document+letter: the document must still NAME the letter it wraps. This is the
        # assertion that can redden for this shape - a rename, a move, or a dropped pointer.
        if pair["txt"] not in open(md_path, encoding="utf-8").read():
            red.append("%s: %s no longer names %s - the document does not say which letter it "
                       "wraps" % (pid, pair["md"], pair["txt"]))
            lines.append("      the document does not contain the string %r" % pair["txt"])
        if identical:
            lines.append("      NOTE: this pair is now word-identical; the `document+letter` "
                         "declaration above is stale and should be re-measured")
    return red, lines


def judge_pins(root, results):
    """Assertion 3: the send index's four md5 pins still hold. A pin that cannot be FOUND is a
    red, not a skip - a row that cannot see the record of the approved bytes must not be green."""
    lines = []
    red = []
    index = os.path.join(root, SEND_INDEX)
    if not os.path.isfile(index):
        return ["the send index %s is not in this tree - the md5 pins cannot be read" % SEND_INDEX], lines
    text = open(index, encoding="utf-8").read()
    for pair in PAIRS:
        pid = pair["id"]
        m = re.search(r"\b%s\s+`([0-9a-f]{32})`" % re.escape(pair["pin"]), text)
        if not m:
            red.append("%s: the send index carries no md5 pin for %s - the approved bytes are "
                       "unrecorded" % (pid, pair["pin"]))
            lines.append("  %-6s pin: NOT FOUND in the send index" % pid)
            continue
        pinned = m.group(1)
        actual = results.get(pid)
        if actual is None:
            lines.append("  %-6s pin %s: no file to hash" % (pid, pinned))
            continue
        if pinned != actual:
            red.append("%s: the send index pins %s but the file is %s" % (pid, pinned, actual))
            lines.append("  %-6s pin %s  FILE %s  MISMATCH" % (pid, pinned, actual))
        else:
            lines.append("  %-6s pin %s  FILE %s  holds" % (pid, pinned, actual))
    return red, lines


def main(argv):
    args = argv[1:]
    root = ROOT
    letter_dir = None
    i = 0
    while i < len(args):
        if args[i] == "--root":
            if i + 1 >= len(args):
                print("REFUSED: --root needs a path. NOTHING WAS JUDGED.")
                print(USAGE)
                return 2
            root = os.path.abspath(args[i + 1])
            i += 2
        elif args[i] == "--letter-dir":
            if i + 1 >= len(args):
                print("REFUSED: --letter-dir needs a path. NOTHING WAS JUDGED.")
                print(USAGE)
                return 2
            letter_dir = os.path.abspath(args[i + 1])
            i += 2
        else:
            print("REFUSED: unknown argument %r - this checker will not buy a green run by "
                  "guessing what you meant. NOTHING WAS JUDGED." % args[i])
            print(USAGE)
            return 2

    uae_dir = letter_dir or os.path.join(root, "counsel", "uae-2026-11")
    print("tree judged      : %s" % root)
    print("uae package      : %s" % uae_dir)

    missing = [f for f in REQUIRED if not os.path.isfile(os.path.join(uae_dir, f))]
    print("package files    : %d/%d present" % (len(REQUIRED) - len(missing), len(REQUIRED)))
    if missing:
        for f in missing:
            print("  MISSING: %s" % os.path.join(uae_dir, f))
        print("VERDICT: RED - the package is INCOMPLETE in this tree. A missing letter file is a")
        print("         defect in the tree, not an absent environment: it is never a skip.")
        return 1

    engine = os.path.join(root, "server", "compliance_engine.js")
    print("source judged    : %s" % engine)
    if not os.path.isfile(engine):
        print("VERDICT: RED - the source the Appendix B rows cite is not in this tree, so the")
        print("         rows cannot be judged. This is a defect in the tree, not a skip.")
        return 1

    red = []
    # ---- assertion 2: each pair, on its own, with its own counts ----
    print()
    print("--- pairs, judged one at a time (word-stream rule; counts are PER PAIR) ---")
    hashes = {}
    for pair in PAIRS:
        pair_red, pair_lines = judge_pair(root, pair, letter_dir)
        red.extend(pair_red)
        for line in pair_lines:
            print(line)
        txt_path = os.path.join(
            letter_dir if (letter_dir and pair["id"] == "uae")
            else os.path.join(root, pair["dir"]), pair["txt"])
        if os.path.isfile(txt_path):
            hashes[pair["id"]] = md5(txt_path)

    # ---- assertion 3: the send index's pins ----
    print()
    print("--- the send index's md5 pins (the bytes that were approved) ---")
    pin_red, pin_lines = judge_pins(root, hashes)
    red.extend(pin_red)
    for line in pin_lines:
        print(line)

    # ---- assertion 4: the UAE package's own two verifiers ----
    ws_code, ws_out = run(os.path.join(uae_dir, "uae-letter-wordstream-check.py"))
    ws = counts(ws_out)
    print()
    print("--- word-stream check, UAE package's own verifier (.md twin vs .txt send copy) ---")
    print(ws_out)
    print()

    ab_code, ab_out = run(os.path.join(uae_dir, "appendix-b-verify.py"))
    ab = counts(ab_out)
    print("--- appendix-b-verify (quoted rows vs server/compliance_engine.js) ---")
    print(ab_out)
    print()

    if ws_code != 0:
        red.append("uae: its own word-stream verifier exited %d" % ws_code)
    if ab_code not in (0, 3):
        red.append("appendix-b-verify exited %d" % ab_code)

    pins_holding = len([l for l in pin_lines if l.rstrip().endswith("holds")])
    print("counts: package %d/%d files; %d pairs judged per-pair above; send-index pins %d/%d hold; "
          "appendix-b %s checks, %s failing"
          % (len(REQUIRED) - len(missing), len(REQUIRED), len(PAIRS),
             pins_holding, len(PAIRS), ab["checks"], ab["failing"]))

    if red:
        print("VERDICT: RED - %s" % "; ".join(red))
        return 1

    if ab_code == 3:
        print("VERDICT: PARTIAL - the pairs and the pins were judged and hold; the appendix half")
        print("         judged NOTHING: %s is not on this machine." % APPENDIX_DOC)
        print("         Exiting 3 so this row prints SKIP-FLAGGED and is counted as SKIPPED.")
        print("         This is NOT a pass for Appendix B.")
        return 3

    print("VERDICT: OK - all four packages are complete in this tree, every `twin` pair is")
    print("         word-identical and every `document+letter` document still names its letter,")
    print("         the send index's four pins hold, and every Appendix B quotation still lands")
    print("         on the line it cites.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
