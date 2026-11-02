#!/usr/bin/env python3
"""
THE HOST TEMPLATE FOLDER IS RETIRED, AND THIS IS THE THING THAT NOTICES A COPY COMING BACK.

    python3 scripts/check-host-template-copies.py                  # judge the host's retired folder
    python3 scripts/check-host-template-copies.py --root DIR       # judge another folder (the proof does)
    ANTUM_HOST_TEMPLATES_DIR=DIR python3 scripts/check-host-template-copies.py   # same, for a movement

WHY THIS FILE EXISTS (the ruling it enforces)
  Owner ruling, 2026-10-29: **the repository is the sole authority for served documents.** A document
  that lives in the repository has exactly one authoritative copy - the repository's `templates/`. The
  host's `/home/team/shared/templates/` is a RETIRED location: it held a second, editable copy of the
  privacy notice, the UAE contract and the KSA contract, and a duplicate drifts (that is how
  `/home/team/shared/eosb-review-report.md` kept asserting a retracted claim in the directory the team
  and the owner read from). 11 duplicates were deleted on 2026-10-29 and the drifted one was quarantined.
  **A copy reappearing in that folder is a defect - and until this file existed, nothing noticed.**

  This is not a hypothetical. The same day's silent rollback of ~8 minutes showed the shape of the risk:
  a well-meant restore put older bytes back where the served ones belonged, and every check was green
  because nothing looked at *that* path. A retired folder that nothing watches is a folder that
  un-retires itself the first time someone is in a hurry.

WHAT `retired/` IS ALLOWED TO CONTAIN (the rule, decided here and stated so it can be argued with)
  The retired folder may contain exactly two things, and the second is a quarantine:

    1. NOTHING AT ITS TOP LEVEL. Zero files. Today's count is 0 and 0 is the requirement.
    2. A single flat directory named `retired/`, holding QUARANTINED files - and only of one shape:

           <document name>.<extension>.retired-<revision>

       e.g. `privacy-notice.md.retired-9d2182a`, `uae-employment-contract.md.retired-4c8779b`.
       - `<document name>.<extension>`: the file it was, with its extension (md, html, pdf ... - the
         extension is 1-8 alphanumeric characters, not a list of blessed ones, so quarantining a PDF
         tomorrow needs no edit here).
       - `.retired-<revision>`: a git revision, 7-40 lowercase hex characters, naming the commit the
         bytes were current at. That is the whole point of the suffix: a quarantined file says WHICH
         revision it was, so nobody has to guess whether it is older or newer than the repository's copy.
       - The suffix goes AFTER the extension (`privacy-notice.md.retired-9d2182a`), never before
         (`privacy-notice.retired-9d2182a.md` is a second authoritative copy of a document wearing a
         different name - the defect this whole ruling is about - and it reddens here).

  Everything else is a violation: a file at the top level, a file in any other directory, a file in a
  sub-directory of `retired/` (the quarantine is FLAT - a nested quarantine is a folder tree nobody
  reviews), a quarantine entry that is not a plain file, and any name that does not match the shape.

  The quarantine's own three files are therefore NOT a false alarm: they match the rule, and this run
  prints them as `quarantined` with the count. That is the difference between a rule and a name list.

WHY THE RULE IS WRITTEN HERE AND NOT IN THE FOLDER IT GOVERNS
  A README in `/home/team/shared/templates/` explaining that the folder must stay empty would be a file
  in the folder - the very thing this check reddens on. The folder cannot carry its own notice, so its
  notice lives in the repository, in this header and in the `what` line of this check's entry in
  `scripts/check-all.py`. (The retirement itself is recorded in
  `/home/team/shared/host-templates-retirement-2026-10-29.md`.)

HOW IT JUDGES: THE TREE, NEVER A LIST OF NAMES
  It WALKS the folder (`os.walk`, recursive, symlinked directories not followed) and judges every entry
  it finds. It carries no list of forbidden filenames, so a copy arriving under a name no one has
  thought of yet is judged exactly like `privacy-notice.md`: by WHERE it is and WHAT it looks like. A
  guard that names files passes vacuously the moment a new one appears; the proof beside this file
  plants a name that appears in no list (scripts/check-host-template-copies-test.sh, case F).

COUNTS, NOT A VERDICT (an instrument that measures nothing exits 0)
  Every run prints how many directories it walked and how many entries it examined, the top-level file
  count, the quarantine count and the violation count. A run that walked nothing cannot print "OK" -
  see the CANNOT-JUDGE cases below. The counts are the evidence that the verdict was earned.

THE SECOND FOLDER IT JUDGES, AND WHY (added 2026-11-02)
  `design-concepts/` had no guard, and the cost of that was measurable: a second copy of
  `BRAND-IDENTITY.md` sat at `/home/team/shared/design-concepts/` from 17 September until 2026-11-02,
  **one line behind** the repository and still asserting that `antum.ae` and `antum.me` are "registered &
  owned by Antum" - a claim the business cannot make, because it holds **no domain at all**. Every check
  was green while it stood there, because nothing looked at that folder. It is now a POINTER (the form
  the seven earlier conversions used, marker `POINTER, not a copy` in the first 400 bytes).

  So this file judges TWO folders, and the second has its own rule:

    /home/team/shared/design-concepts/  every entry must be ONE of
        1. a POINTER - the marker `POINTER, not a copy` in the first 400 bytes. This is the sanctioned
           form for a repository document that used to be duplicated here.
        2. DECLARED DEBT - named in `scripts/host-design-concepts-baseline.tsv` with its exact md5. That
           file records the copies that remain (mockups, prototypes, the older text of five documents) so
           this check can be green today without pretending they are not there. It is a DEBT REGISTER,
           not a list of blessed names: every entry pins the md5, so a declared file that drifts reddens
           exactly like an undeclared one, and the file prints how many entries are debt.
        3. anything else is a VIOLATION, named with its path and reason.

  `BRAND-IDENTITY.md` is deliberately NOT in the baseline: it is a pointer now, so a copy of it reappearing
  - the old text, the current text, any text - is an entry with no declaration and reddens.

  The design folder is judged only on a run that does NOT pass `--root` (the templates-only form the
  existing proof uses); pass `--design-root DIR` to judge another one. That is printed, never silent: a
  section that measured nothing says so on its own line.

EXIT CODES (the team's three)
  0  the folder is in its retired state: 0 files at the top level, every entry under `retired/` matching
     the quarantine rule
  1  RED: at least one entry is a violation, each one named with its path and its reason
  2  CANNOT-JUDGE: the folder does not exist, is not a directory, or could not be read. That is a RED
     for the operator - the check was asked to judge a folder and could not - and must never print as a
     green. `scripts/check-all.py` prints it as CANNOT-JUDGE and fails the run. (The folder DOES exist
     on this host and must: its absence means the retirement record and the host have parted company.)

WHAT IT DOES NOT SEE (stated so nobody reads it as more)
  * It does not compare bytes against the repository. A host file is a defect because of WHERE it is,
    not because of what it says - and a copy whose bytes happen to match today is still a second copy
    that will drift tomorrow.
  * It does not verify that `<revision>` resolves in git. A quarantined file naming a revision this
    repository has forgotten is not the defect class here (a copy reappearing is), and resolving
    revisions would make the judgement depend on which tree ran the check, not on the folder.
  * It is READ-ONLY: it opens no file for writing and stats only. It never deletes, quarantines or
    repairs anything - it names the defect and leaves the decision to a person.
  * IT IS NOT A MONITOR. Nothing schedules it: it notices a reappearing copy when someone runs it
    (`check-all.py`, or a movement's operator). No KPI or plan line may cite it as coverage.

PROVEN, NOT ASSERTED: `bash scripts/check-host-template-copies-test.sh` plants a copy at the top level,
  in a nested directory, in the quarantine under a name no list names, and in a sub-directory of the
  quarantine; requires each to redden on that exact path; requires the quarantine's three files to stay
  green throughout; and requires a missing folder to exit 2 rather than 0.
"""
import argparse
import hashlib
import os
import re
import sys

DEFAULT_ROOT = "/home/team/shared/templates"
QUARANTINE_DIR = "retired"

# <document name>.<ext>.retired-<git revision>. The suffix is anchored at the END, so a name with
# .retired- somewhere other than the suffix (a second copy wearing a different name) does not match.
QUARANTINE_RE = re.compile(
    r"^(?P<doc>[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9]{1,8})\.retired-(?P<rev>[0-9a-f]{7,40})$")

OK, RED, CANNOT_JUDGE = 0, 1, 2


def scan(root):
    """WALK the folder. Returns (dirs, entries, unreadable) - nothing is assumed about names."""
    dirs, entries, unreadable = [], [], []

    def onerror(err):
        unreadable.append("%s (%s)" % (getattr(err, "filename", "?"), err.strerror))

    for dirpath, dirnames, filenames in os.walk(root, topdown=True, onerror=onerror, followlinks=False):
        dirs.append(os.path.relpath(dirpath, root))
        # A symlinked directory is an ENTRY, not a place to walk into: it carries a path into the
        # retired folder while its target lives somewhere else, and following it would judge - and
        # count - a tree that is not this folder's.
        for d in sorted(dirnames):
            p = os.path.join(dirpath, d)
            if os.path.islink(p):
                dirnames.remove(d)
                entries.append((os.path.relpath(p, root), "symlinked-directory"))
        for f in sorted(filenames):
            p = os.path.join(dirpath, f)
            kind = "symlink" if os.path.islink(p) else ("file" if os.path.isfile(p) else "special")
            entries.append((os.path.relpath(p, root), kind))
    return dirs, entries, unreadable


def judge(rel, kind):
    """(violation kind or None, the sentence a reader needs)."""
    parts = rel.split(os.sep)
    name = parts[-1]
    if len(parts) == 1:
        return "TOP-LEVEL", ("a file at the TOP LEVEL of the retired folder - the folder holds 0 files; "
                             "the authoritative copy is templates/ in the repository")
    if parts[0] != QUARANTINE_DIR:
        return "FOREIGN-DIR", ("inside %r/ - the retired folder holds no directory but %r/ that may hold "
                               "files; a document copy here is a second authoritative copy"
                               % (parts[0], QUARANTINE_DIR))
    if len(parts) > 2:
        return "NESTED-IN-QUARANTINE", ("inside a sub-directory of %r/ - the quarantine is FLAT: a "
                                        "quarantined file sits directly in %r/" % (QUARANTINE_DIR, QUARANTINE_DIR))
    if kind != "file":
        return "NOT-A-PLAIN-FILE", ("a %s - a quarantined entry is a plain file; a link or a special file "
                                    "puts a document path back in the retired folder without its bytes"
                                    % kind)
    if not QUARANTINE_RE.match(name):
        return "BAD-QUARANTINE-NAME", ("the name does not match <document>.<ext>.retired-<revision> "
                                       "(e.g. privacy-notice.md.retired-9d2182a)")
    return None, "quarantined"


DESIGN_ROOT_DEFAULT = "/home/team/shared/design-concepts"
DESIGN_BASELINE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               "host-design-concepts-baseline.tsv")
POINTER_MARKER = b"POINTER, not a copy"


def load_design_baseline(path):
    """md5 + note per relative path. Returns (entries, error). A missing baseline is an ERROR, not an
    empty one: an empty register would declare every existing copy a violation, and a silent empty one
    would declare nothing at all - both are worse than refusing to judge."""
    if not os.path.isfile(path):
        return None, "%s does not exist - the debt register is part of the rule, not an accessory" % path
    entries = {}
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            line = line.rstrip("\n")
            if not line.strip() or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) < 2 or len(parts[0]) != 32:
                return None, "%s:%d is not `<md5>\\t<rel path>\\t[note]`" % (path, n)
            entries[parts[1]] = (parts[0].lower(), parts[2] if len(parts) > 2 else "")
    return entries, None


def judge_design(root, baseline_path):
    """Judge the design-concepts folder. Returns (exit code, counts dict). Prints its own counts."""
    print("  --- design-concepts folder (the second ruled location) ---")
    print("  design folder judged  : %s" % root)
    if not os.path.exists(root):
        print("CANNOT-JUDGE: %s does not exist - the folder is not retired, so its absence means the "
              "record and the host have parted company. exit 2" % root)
        return CANNOT_JUDGE, {}
    if not os.path.isdir(root):
        print("CANNOT-JUDGE: %s is not a directory. exit 2" % root)
        return CANNOT_JUDGE, {}

    entries, err = load_design_baseline(baseline_path)
    if err:
        print("CANNOT-JUDGE: %s. exit 2" % err)
        return CANNOT_JUDGE, {}

    dirs, seen, unreadable = scan(root)
    if unreadable:
        for u in unreadable:
            print("      unreadable  %s" % u)
        print("CANNOT-JUDGE: %d unreadable location(s) under %s. exit 2" % (len(unreadable), root))
        return CANNOT_JUDGE, {}

    pointers, declared, violations = [], [], []
    for rel, kind in seen:
        if kind != "file":
            violations.append((rel, "NOT-A-PLAIN-FILE", "a %s where a plain file or a pointer belongs" % kind))
            continue
        full = os.path.join(root, rel)
        try:
            with open(full, "rb") as f:
                head = f.read(400)
                f.seek(0)
                digest = hashlib.md5(f.read()).hexdigest()
        except OSError as e:
            print("CANNOT-JUDGE: %s could not be read (%s). exit 2" % (rel, e))
            return CANNOT_JUDGE, {}
        if POINTER_MARKER in head:
            pointers.append(rel)
            continue
        if rel in entries:
            if entries[rel][0] == digest:
                declared.append((rel, entries[rel][1]))
            else:
                violations.append((rel, "DECLARED-BUT-DRIFTED",
                                   "declared md5 %s, file is %s - a debt entry that moved is a new copy"
                                   % (entries[rel][0], digest)))
            continue
        violations.append((rel, "UNDECLARED-COPY",
                           "not a pointer and not in the debt register - a second copy of a repository "
                           "document, md5 %s" % digest))

    print("  entries examined      : %d  (walked, not matched against a list of names)" % len(seen))
    print("  pointers              : %d  (the sanctioned form for a repository document)" % len(pointers))
    for rel in pointers:
        print("      ok    %s" % rel)
    print("  declared debt         : %d  (in scripts/host-design-concepts-baseline.tsv, md5 pinned)"
          % len(declared))
    print("  violations            : %d" % len(violations))
    for rel, why, detail in violations:
        print("      RED   %s" % rel)
        print("            %s: %s" % (why, detail))

    if len(seen) == 0:
        print("CANNOT-JUDGE: the walk examined no entry under %s. exit 2" % root)
        return CANNOT_JUDGE, {}

    counts = {"entries": len(seen), "pointers": len(pointers), "declared": len(declared),
              "violations": len(violations)}
    if violations:
        print("FAIL: %d entr(ies) in %s that the ruling does not allow - each is named above."
              % (len(violations), root))
        return RED, counts
    return OK, counts


def main(argv):
    ap = argparse.ArgumentParser(add_help=True)
    # `default=None`, not DEFAULT_ROOT: this script must be able to tell "the operator passed --root"
    # from "nobody passed anything", because the design-concepts folder is judged only on the bare run
    # (the existing proof drives this script with --root on scratch folders and must not be coupled to
    # host state).
    ap.add_argument("--root", default=None,
                    help="the retired folder to judge (default: %s)" % DEFAULT_ROOT)
    ap.add_argument("--design-root", default=None,
                    help="the design-concepts folder to judge (default: %s, and only when --root is "
                         "not given)" % DESIGN_ROOT_DEFAULT)
    args = ap.parse_args(argv[1:])
    root = os.path.abspath(args.root or os.environ.get("ANTUM_HOST_TEMPLATES_DIR") or DEFAULT_ROOT)

    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    rev = "UNKNOWN"
    if os.path.isdir(os.path.join(repo, ".git")) or os.path.isfile(os.path.join(repo, ".git")):
        import subprocess
        try:
            rev = subprocess.run(["git", "-C", repo, "rev-parse", "--short", "HEAD"],
                                 capture_output=True, text=True, check=True).stdout.strip() or "UNKNOWN"
        except Exception:
            rev = "UNKNOWN (git could not name it)"

    print("host template folder check - the repository is the sole authority for served documents")
    print("  rule                  : the retired host folder holds 0 files, and only %r/ may hold files,"
          % QUARANTINE_DIR)
    print("                          each named <document>.<ext>.retired-<revision> (flat, plain files)")
    print("  folder judged         : %s" % root)
    print("  check read from tree  : %s" % rev)
    print("  NOT run by            : the movement. It judges a HOST folder, loads nothing served, and")
    print("                          `grep -c scripts server/index.js` is 0 - no served path reads scripts/")
    print("  IS NOT A MONITOR      : nothing schedules it. It notices a reappearing copy when it is run.")

    # --- the second ruled folder, judged FIRST so a red here is never hidden by a green below --------
    design_root = os.path.abspath(args.design_root or os.environ.get("ANTUM_HOST_DESIGN_DIR", "")
                                 or DESIGN_ROOT_DEFAULT)
    if args.design_root or args.root is None or os.environ.get("ANTUM_HOST_DESIGN_DIR"):
        design_rc, design_counts = judge_design(design_root, DESIGN_BASELINE)
        if design_rc != OK:
            return design_rc
        print("  design-concepts       : %d entries / %d pointers / %d declared debt / 0 violations"
              % (design_counts["entries"], design_counts["pointers"], design_counts["declared"]))
    else:
        print("  design-concepts       : NOT JUDGED - --root was given without --design-root (the "
              "templates-only form).")
        print("                          This is printed, not silent: pass --design-root DIR to judge "
              "that folder too.")

    if not os.path.exists(root):
        print("  CANNOT-JUDGE          : %s does not exist. The retired folder must exist on this host -"
              % root)
        print("                          its absence means the retirement record and the host have parted")
        print("                          company, and this check cannot judge a folder it cannot open.")
        print("CANNOT-JUDGE: %s is missing - not a pass, an unjudged folder. exit 2" % root)
        return CANNOT_JUDGE
    if not os.path.isdir(root):
        print("CANNOT-JUDGE: %s is not a directory. exit 2" % root)
        return CANNOT_JUDGE

    dirs, entries, unreadable = scan(root)
    if unreadable:
        print("  unreadable            : %d location(s) - a folder that cannot be read cannot be judged:"
              % len(unreadable))
        for u in unreadable:
            print("      %s" % u)
        print("CANNOT-JUDGE: %d unreadable location(s) under %s. exit 2" % (len(unreadable), root))
        return CANNOT_JUDGE

    top_level, quarantined, violations = [], [], []
    for rel, kind in entries:
        why, detail = judge(rel, kind)
        if why is None:
            quarantined.append((rel, kind))
        else:
            violations.append((rel, why, detail))
            if why == "TOP-LEVEL":
                top_level.append(rel)

    # --- the counts, printed before the verdict (an instrument that measures nothing exits 0) ------
    print("  directories walked    : %d  %s" % (len(dirs), dirs))
    print("  entries examined      : %d  (every file, link and special file under the folder, walked -"
          % len(entries))
    print("                          not matched against a list of names)")
    print("  files at TOP LEVEL    : %d   (want 0)" % len(top_level))
    print("  quarantined (matching): %d" % len(quarantined))
    for rel, kind in quarantined:
        print("      ok    %s" % rel)
    print("  violations            : %d" % len(violations))
    for rel, why, detail in violations:
        print("      RED   %s" % rel)
        print("            %s: %s" % (why, detail))

    if len(dirs) == 0 and len(entries) == 0:
        # cannot happen after a successful os.walk (it yields the root itself), but a check whose own
        # subject it never saw must not print a green (rule: the guard cannot see its subject is a RED)
        print("CANNOT-JUDGE: the walk saw no directory at all under %s. exit 2" % root)
        return CANNOT_JUDGE

    if violations:
        print("FAIL: %d entr(ies) in the retired folder that the ruling does not allow - each is named "
              "above with its path." % len(violations))
        print("      The authoritative copy is templates/ in the repository; a host copy is a second copy "
              "that will drift.")
        return RED

    print("OK: %d entries examined, %d at the top level (want 0), %d quarantined and matching the rule, "
          "0 violations." % (len(entries), len(top_level), len(quarantined)))
    print("    %s is in its retired state." % root)
    return OK


if __name__ == "__main__":
    sys.exit(main(sys.argv))
