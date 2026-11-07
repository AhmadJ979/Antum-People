#!/usr/bin/env python3
"""counsel-letter - the UAE counsel letter package lives in THIS REPOSITORY and is judged here.

WHY THIS ROW EXISTS
  Until 2026-11-07 the letter, its `.md` twin, the cover email, the send index, the D1-D5
  record and the two verifiers that judge them sat in /home/team/shared with no history and
  no check. The team's own rule is "one authoritative copy: the repository", and this was
  the last live document outside it. Moving it in is only half the job: a document nobody
  checks drifts. This row is the check.

WHAT IT ASSERTS (three separate things, each printed with its counts)
  1. Every file of the package is PRESENT in counsel/uae-2026-11/. A missing one is RED and
     named - never a quiet skip. (The moved package is part of the tree, so its absence is a
     defect in the tree, not an absent environment.)
  2. The `.md` twin and the `.txt` send copy are WORD-IDENTICAL once `##`, `**` and backticks
     are stripped - the word-stream check. It prints both token counts and the number of
     differing regions, so a one-word edit shows up with its position.
  3. Appendix B is still true: each quoted row is the `description` field of the line it
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
  `--letter-dir <path>` judges a copy of the package somewhere else, which is how the row's
  ability to redden is demonstrated without touching the tree:
      cp -r counsel/uae-2026-11 /tmp/mut/counsel/uae-2026-11
      ln -s "$PWD/server" /tmp/mut/server
      # change one word in /tmp/mut/counsel/uae-2026-11/uae-counsel-confirmation-request.md
      python3 scripts/check-counsel-letter.py --letter-dir /tmp/mut/counsel/uae-2026-11
  An argument this script does not understand is exit 2, never a clean run.
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_DIR = os.path.join(ROOT, "counsel", "uae-2026-11")
# The one input outside the repository: the doc the B/K rows are quoted from. Not moved with
# the package (see counsel/uae-2026-11/README.md), so its absence is a skip, not a red.
APPENDIX_DOC = os.environ.get("APPENDIX_DOC",
                              "/home/team/shared/uae-appendix-b-checklist-strings.md")
PY = sys.executable or "python3"

# The package. The two verifiers travel WITH it: a check that lives somewhere else can drift
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

USAGE = ("usage: check-counsel-letter.py [--letter-dir <dir>]\n"
         "  judges the counsel package in counsel/uae-2026-11/ (or in <dir>)\n"
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


def main(argv):
    args = argv[1:]
    letter_dir = DEFAULT_DIR
    i = 0
    while i < len(args):
        if args[i] == "--letter-dir":
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

    print("letter directory : %s" % letter_dir)
    missing = [f for f in REQUIRED if not os.path.isfile(os.path.join(letter_dir, f))]
    print("package files    : %d/%d present" % (len(REQUIRED) - len(missing), len(REQUIRED)))
    if missing:
        for f in missing:
            print("  MISSING: %s" % os.path.join(letter_dir, f))
        print("VERDICT: RED - the package is INCOMPLETE in this tree. A missing letter file is a")
        print("         defect in the tree, not an absent environment: it is never a skip.")
        return 1

    engine = os.path.join(ROOT, "server", "compliance_engine.js")
    print("source judged    : %s" % engine)
    if not os.path.isfile(engine):
        print("VERDICT: RED - the source the Appendix B rows cite is not in this tree, so the")
        print("         rows cannot be judged. This is a defect in the tree, not a skip.")
        return 1

    ws_code, ws_out = run(os.path.join(letter_dir, "uae-letter-wordstream-check.py"))
    ws = counts(ws_out)
    print()
    print("--- word-stream check (.md twin vs .txt send copy) ---")
    print(ws_out)
    print()

    ab_code, ab_out = run(os.path.join(letter_dir, "appendix-b-verify.py"))
    ab = counts(ab_out)
    print("--- appendix-b-verify (quoted rows vs server/compliance_engine.js) ---")
    print(ab_out)
    print()

    red = []
    if ws_code != 0:
        red.append("word-stream check exited %d" % ws_code)
    if ab_code not in (0, 3):
        red.append("appendix-b-verify exited %d" % ab_code)

    print("counts: package %d/%d files; word-stream %s md / %s txt tokens, %s differing; "
          "appendix-b %s checks, %s failing"
          % (len(REQUIRED) - len(missing), len(REQUIRED), ws["md_tokens"], ws["txt_tokens"],
             ws["differing"], ab["checks"], ab["failing"]))

    if red:
        print("VERDICT: RED - %s" % "; ".join(red))
        return 1

    if ab_code == 3:
        print("VERDICT: PARTIAL - the word-stream half was judged and holds; the appendix half")
        print("         judged NOTHING: %s is not on this machine." % APPENDIX_DOC)
        print("         Exiting 3 so this row prints SKIP-FLAGGED and is counted as SKIPPED.")
        print("         This is NOT a pass for Appendix B.")
        return 3

    print("VERDICT: OK - the package is complete in this tree, the twins are word-identical,")
    print("         and every Appendix B quotation still lands on the line it cites.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
