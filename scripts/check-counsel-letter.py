#!/usr/bin/env python3
"""counsel-letter - the counsel letter packages live in THIS REPOSITORY and are judged here.

WHY THIS ROW EXISTS
  Until 2026-11-07 the letters, their `.md` companions, the cover email, the send index, the
  D1-D5 record and the two verifiers that judge them sat in /home/team/shared with no history
  and no check. The team's own rule is "one authoritative copy: the repository", and these were
  the last live documents outside it. Moving them in is only half the job: a document nobody
  checks drifts. This row is the check.

WHAT IT ASSERTS (six separate things, each printed with its own counts)
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
  5. Appendix B as it sits INSIDE the two letters is still what it claims - the letter
     verifier (`verify-appendix-b-in-letter.py`): 4 B rows per copy, each quote byte-identical
     to the source `description`, the single question, Appendix A's 18 U rows, the 8 numbered
     items, and the two copies carrying the same four strings. Its own `--selftest` is run too,
     and a mutation it fails to catch is RED: an instrument that cannot redden proves nothing.
  6. EACH `twin` LETTER STILL CARRIES ITS DECLARED NUMBERED-ITEM COUNT - uae 8, ksa 7, counted in
     the `.md` AND the `.txt`. Added 2026-11-12: until then the KSA count was asserted NOWHERE,
     because the in-letter verifier reads only the two UAE files and a deletion made in BOTH files
     of a twin is invisible to word-identity. Every run plants that deletion in a scratch copy and
     requires this checker to redden on the count, so the assertion is proved able to fail.

WHERE THE PATHS COME FROM
  Every path is resolved from this file, so the row judges the tree it is run in - a
  worktree, a clone, CI - and never a hardcoded /home/team/shared prefix.

  UNTIL 2026-11-08 one input was outside the repository: the checklist-strings document the
  Appendix B rows are quoted from, and this row exited 3 (check-all: SKIP-FLAGGED, counted as
  SKIPPED) when it was absent. That document moved into counsel/uae-2026-11/ on 2026-11-08, so
  the exit-3 half is GONE: a missing checklist-strings document is now a file of the tree that
  is missing - exit 1, RED, named - and never a skip. APPENDIX_DOC still overrides the path;
  it exists so a mutation in a scratch copy can be judged without dirtying the tree.

EXIT CODES (the team's convention)
  0 green · 1 RED (a named defect in the tree) · 2 REFUSED (bad invocation - it did not
  understand what it was asked to judge, so it refuses rather than buying a green).
  There is no exit 3 any more: this row has no input outside the repository.

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
import shutil
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# The checklist-strings doc the B/K rows are quoted from lives in the package since
# 2026-11-08, so the default is resolved from the package directory being judged (which
# `--root` / `--letter-dir` can move). APPENDIX_DOC still overrides it, for judging a
# mutated copy without dirtying the tree.
APPENDIX_DOC_ENV = os.environ.get("APPENDIX_DOC")
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
    "verify-appendix-b-in-letter.py",
    "uae-appendix-b-checklist-strings.md",
    "uae-letter-wordstream-check.py",
]

# THE FOUR PAIRS. `shape` is measured, not assumed, and the evidence for each is recorded here
# so a later reader can re-check the classification instead of trusting it:
#   uae, ksa    -> twin.  Measured 2026-11-12: 1912/1912 and 1436/1436 tokens, 0 differing
#                  (2026-11-07, before the probation item was added as UAE item 8 / KSA item 7:
#                  1681/1681 and 1154/1154).
#   pdpl,access -> document+letter.  Measured 2026-11-12: pdpl 2337 md / 1412 txt tokens and 70
#                  differing regions, access 1628/720 and 38. The `.md` of each carries a
#                  cross-walk table and a premise audit and says so in its own text (access:
#                  "Send-ready text: ... (the letter; line 1 is a status line, not part of the
#                  letter)"). These were never word-identical, so requiring identity would be a
#                  red no edit could ever clear - and a permanently red row is a row the team
#                  learns to ignore. What is required of them instead: the document names its
#                  letter, and the send index pins its bytes (assertion 3).
#
# THE NUMBERED-ITEM COUNT IS ASSERTED FOR THE TWO TWIN LETTERS (added 2026-11-12, closing a guard
# gap of the "a check that cannot redden proves nothing" class). Until then the KSA letter's item
# count was asserted NOWHERE: `verify-appendix-b-in-letter.py` reads only the two UAE files, so
# deleting a KSA item - from BOTH files of the pair, which is what word-identity cannot see - would
# have reddened no instrument at all, and the send index's pin would have been the only trace. The
# count is declared per pair below and checked in the `.md` AND the `.txt`; `--plant` (run by
# `main()` on every run, not only on request) deletes the last KSA item from a scratch copy of the
# tree and requires this checker to redden, so the assertion is proved able to fail.
# The two `document+letter` pairs carry no count: their `.md` is a working document, so a number
# counted over it would describe the document, not the letter.
PAIRS = [
    dict(id="uae", dir="counsel/uae-2026-11",
         md="uae-counsel-confirmation-request.md",
         txt="uae-counsel-confirmation-request--send-ready.txt", shape="twin", pin="UAE", items=8),
    dict(id="ksa", dir="counsel/ksa-2026-11",
         md="ksa-counsel-confirmation-request.md",
         txt="ksa-counsel-confirmation-request--send-ready.txt", shape="twin", pin="KSA", items=7),
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
         "  exit 0 green / 1 RED / 2 refused - there is no exit 3: this row has no input "
         "outside the repository since 2026-11-08")


def run(script, *args):
    """Run a verifier from the package directory and hand back (exit, output)."""
    p = subprocess.run([PY, script, *args], capture_output=True, text=True, timeout=300)
    return p.returncode, (p.stdout + p.stderr).strip()


def counts(text):
    """Read the verifier's OWN counts out of its output. A missing count is reported as
    absent, never defaulted to zero - a zero the instrument did not print is a number this
    runner invented."""
    out = {}
    for key, pat in (("checks", r"^checks run:\s*(\d+)"), ("failing", r"^FAILING:\s*(\d+)"),
                     ("passed", r"^checks passed:\s*(\d+)"), ("failed", r"^failures:\s*(\d+)"),
                     ("caught", r"^selftest:\s*(\d+) mutation\(s\) caught"),
                     ("not_caught", r"^selftest:\s*\d+ mutation\(s\) caught,\s*(\d+) not caught"),
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


# The numbered items of a letter, counted exactly the way the letter verifier counts them
# (`^\d+\. ` or `^**\d+\. `), so the two instruments cannot disagree about what an item is.
ITEM_LINE = re.compile(r"^(\d+\. |\*\*\d+\. )")


def numbered_items(path):
    return len([l for l in open(path, encoding="utf-8").read().splitlines()
                if ITEM_LINE.match(l)])


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
    if "items" in pair:
        for path in (md_path, txt_path):
            got = numbered_items(path)
            if got != pair["items"]:
                red.append("%s: %s has %d numbered item(s), expected %d - an item was added or "
                           "deleted" % (pid, os.path.basename(path), got, pair["items"]))
                lines.append("      %s: %d numbered item(s), expected %d"
                             % (os.path.basename(path), got, pair["items"]))
            else:
                lines.append("      %s: %d numbered item(s), as declared"
                             % (os.path.basename(path), got))

    if pair["shape"] != "twin":
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


def plant_deleted_item():
    """Delete the last KSA item from BOTH files of a SCRATCH copy of the package and require this
    checker to redden on the count. This is the proof the assertion added 2026-11-12 can fail: the
    pair stays word-identical under that edit, which is precisely why word-identity alone never
    saw a deleted KSA item, and why the KSA letter's item count was asserted nowhere until now.
    It runs on every invocation of `main()`, not only when someone remembers a flag - a control
    that is only reachable by a flag an operator does not know about is a false green.
    Returns (failures, printable_lines)."""
    pair = [p for p in PAIRS if p["id"] == "ksa"][0]
    n = pair["items"]
    lines = []
    failures = []
    tmp = tempfile.mkdtemp(prefix="counsel-plant-")
    try:
        shutil.copytree(os.path.join(ROOT, "counsel"), os.path.join(tmp, "counsel"))
        control_red, _ = judge_pair(tmp, pair, None)
        for name in (pair["md"], pair["txt"]):
            path = os.path.join(tmp, pair["dir"], name)
            text = open(path, encoding="utf-8").read()
            keep = [l for l in text.splitlines(keepends=True)
                    if not re.match(r"^(\*\*)?%d\. " % n, l)]
            assert len(keep) < len(text.splitlines(keepends=True)), \
                "the plant changed nothing in %s - the mutation itself is broken" % name
            open(path, "w", encoding="utf-8").write("".join(keep))
        planted_red, _ = judge_pair(tmp, pair, None)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    if control_red:
        failures.append("the plant's CONTROL reddened on an unedited copy (%s), so the plant cannot "
                        "say anything about the deletion" % control_red[0])
        lines.append("  control (an unedited copy)      : RED - %s" % control_red[0])
    else:
        lines.append("  control (an unedited copy)      : no red, as required")
    if not planted_red:
        failures.append("deleting KSA item %d from both files did NOT redden this checker - the "
                        "item-count assertion cannot fail, so it proves nothing" % n)
        lines.append("  plant (KSA item %d deleted)      : NO RED - the assertion is vacuous" % n)
    elif not any("numbered item" in r for r in planted_red):
        failures.append("the plant reddened, but not on the item count: %s" % planted_red[0])
        lines.append("  plant (KSA item %d deleted)      : RED for the wrong reason - %s"
                     % (n, planted_red[0]))
    else:
        lines.append("  plant (KSA item %d deleted)      : RED - %s" % (n, planted_red[0]))
    return failures, lines


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
    appendix_doc = APPENDIX_DOC_ENV or os.path.join(uae_dir, "uae-appendix-b-checklist-strings.md")
    print("tree judged      : %s" % root)
    print("uae package      : %s" % uae_dir)
    print("checklist doc    : %s%s" % (appendix_doc,
                                      "  (APPENDIX_DOC override)" if APPENDIX_DOC_ENV else ""))

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

    # ---- assertion 4: the UAE package's own verifiers ----
    ws_code, ws_out = run(os.path.join(uae_dir, "uae-letter-wordstream-check.py"))
    ws = counts(ws_out)
    print()
    print("--- word-stream check, UAE package's own verifier (.md twin vs .txt send copy) ---")
    print(ws_out)
    print()

    ab_code, ab_out = run(os.path.join(uae_dir, "appendix-b-verify.py"))
    ab = counts(ab_out)
    print("--- appendix-b-verify (the DRAFT's quoted rows vs server/compliance_engine.js) ---")
    print(ab_out)
    print()

    # ---- assertion 5: the copy that actually gets sent ----
    lv_code, lv_out = run(os.path.join(uae_dir, "verify-appendix-b-in-letter.py"))
    lv = counts(lv_out)
    print("--- verify-appendix-b-in-letter (Appendix B INSIDE the two letters) ---")
    print(lv_out)
    print()
    st_code, st_out = run(os.path.join(uae_dir, "verify-appendix-b-in-letter.py"), "--selftest")
    st = counts(st_out)
    print("--- verify-appendix-b-in-letter --selftest (its own ability to redden) ---")
    print(st_out)
    print()

    if ws_code != 0:
        red.append("uae: its own word-stream verifier exited %d" % ws_code)
    if ab_code != 0:
        red.append("appendix-b-verify exited %d - the checklist-strings document is a file of "
                   "this tree, so a refusal here is a defect in the tree, never a skip" % ab_code)
    if lv_code != 0:
        red.append("verify-appendix-b-in-letter exited %d - Appendix B in the letters is not "
                   "what it claims" % lv_code)
    if st_code != 0 or st["not_caught"] not in (0, None) or st["caught"] is None:
        red.append("verify-appendix-b-in-letter --selftest caught %s mutation(s), missed %s - an "
                   "instrument that cannot redden proves nothing"
                   % (st["caught"], st["not_caught"]))

    # ---- the plant: the item-count assertion must be proved able to fail ----
    plant_fail, plant_lines = plant_deleted_item()
    print("--- the plant: is the KSA item count really asserted? (a scratch copy, never this tree) ---")
    for line in plant_lines:
        print(line)
    print()
    red.extend(plant_fail)

    pins_holding = len([l for l in pin_lines if l.rstrip().endswith("holds")])
    print("counts: package %d/%d files; %d pairs judged per-pair above; send-index pins %d/%d hold; "
          "item-count plant %d failure(s); "
          "appendix-b %s checks, %s failing; in-letter %s checks, %s failing; "
          "in-letter selftest %s caught / %s missed"
          % (len(REQUIRED) - len(missing), len(REQUIRED), len(PAIRS),
             pins_holding, len(PAIRS), len(plant_fail), ab["checks"], ab["failing"],
             lv["passed"], lv["failed"], st["caught"], st["not_caught"]))

    if red:
        print("VERDICT: RED - %s" % "; ".join(red))
        return 1

    print("VERDICT: OK - all four packages are complete in this tree, every `twin` pair is")
    print("         word-identical and every `document+letter` document still names its letter,")
    print("         the send index's four pins hold, every Appendix B quotation in the draft still")
    print("         lands on the line it cites, and Appendix B inside both letter copies is verbatim")
    print("         and intact.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
