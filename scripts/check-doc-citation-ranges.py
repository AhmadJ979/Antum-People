#!/usr/bin/env python3
"""Fail when a `:N`-`:M` line range in design-concepts/ runs BACKWARDS (N > M).

    python3 scripts/check-doc-citation-ranges.py               # judge HEAD
    python3 scripts/check-doc-citation-ranges.py <rev>         # judge a named revision
    python3 scripts/check-doc-citation-ranges.py --selftest    # prove it can redden (and that
                                                               # its two non-findings stay quiet)

WHY IT EXISTS. `check-doc-citations.py` cannot see this defect, and that is a property of its
own rule, not a gap anyone can close there: a citation GROUP is satisfied when ANY ONE of its
numbers lands on a line carrying the named symbol. A range written the wrong way round
(`:2103`-`:2073`) still contains a number that lands, so the group passes. Twelve of them
shipped that way on 2026-11-05 and were caught by a person sweeping by hand, not by the gate -
and a sweep a person has to remember is not a gate. This instrument judges the one thing the
other one structurally cannot: whether the two ends of a range are in order.

WHAT IT JUDGES. Every `:N`-`:M` range in `design-concepts/*.md` must ASCEND. The two ends may
be written `:1212`-`:1213`, `:1212`-`1213`, `:1212`-1213 or `App.tsx:1212`-`:1213` (en dash, em
dash or hyphen, with or without spaces); the report prints the matched text verbatim, so a
reader can see which form was judged. Every range is counted, and the counts are printed
whether the run is green or red.

WHAT IT DELIBERATELY DOES NOT FLAG - each of these is a plant in `--selftest`:

    equal endpoints     `:2456`-`:2456` is a legitimate one-line span (3 exist on the tree this
                        was written against). Not a reversed range; counted separately and named.
    movement arrows     `:2103` -> `:2073` is a statement that a pointer MOVED, not a range.
                        The `->` is not a dash, so it is not even counted as a range.
    clock times         `05:06:55-05:07:21Z` is a time span. A line reference's colon is never
                        preceded by a digit; a clock's always is. That is the whole test.

WHAT IT CANNOT JUDGE - stated here so nobody reads a green run as "the pointers are correct":
a range that ASCENDS but whose ends land on the wrong lines is a DIFFERENT defect, and it is
not this instrument's job. `:1198`-`:1689` is green here even if neither number is a line the
document is talking about. Whether a number lands on what its citing line names is what
`check-doc-citations.py` asks, and it asks it of the citing line's symbols; nothing in this
file looks at `client/src/App.tsx` at all. The two instruments answer two questions, and a
green from either is a green about that question only.

WHICH TREE IT JUDGES. Documents are read from a GIT REVISION (`git show <rev>:<path>`), never
from the working tree, so an uncommitted edit cannot make the run green - and a revision is
printed in the verdict, because a count must name its tree. The repository is found from this
file's own location, so the working directory does not matter.

EXIT CODES - three, and no report for the third (the convention #266 set for an instrument
whose invocability is part of the measurement):
    0  judged: every range ascends
    1  judged: at least one range is reversed (each REVERSED line names file:line and both ends)
    2  REFUSED - NOTHING WAS CHECKED. No git working tree above this file, a revision that does
       not resolve, `design-concepts/` listing no `.md` at that revision, or a tree on which the
       scan found NO ranges at all. That last one is the anti-vacuous control: a scan that
       matches nothing would otherwise print `0 REVERSED` and read as a clean. A green computed
       over an empty list is not a measurement.

--selftest plants a reversed range into a scratch clone and requires the clone's own copy of
this file to REDDEN on it, naming file:line and both numbers; it also requires the three
non-findings above to stay quiet, and it re-runs the pre-#365 tree (`5d012b7`), which is known
to carry reversed ranges, so the proof is not confined to a plant this file invented. A plant
that is not committed is invisible to a git-reading instrument, so every plant is committed
before it is judged, and every run is checked against the clone's own HEAD through the verdict
line's `[tree ...]` marker - the first cut of the sibling harness judged the SOURCE tree and
came back with no delta for six plants.
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
DOC_DIR = "design-concepts"
SELF = os.path.basename(__file__)

# A line reference is a colon that is NOT preceded by a digit (that is what separates `:1212`
# from the `:55` in `05:06:55`), then the line number, an optional backtick, an optional run of
# spaces, ONE dash (en/em/hyphen), an optional backtick, an optional second colon, and the
# second number. The trailing `(?!\d)` stops `:2103`-`:207` from being read as `:2103`-`:207`.
RANGE = re.compile(
    r"(?<![\d:]):(?P<a>\d{1,5})(?P<ta>`?)[ \t]*"
    r"(?P<dash>[\u2013\u2014\-])[ \t]*(?P<tb>`?)"
    r"(?P<colon>:?)(?P<b>\d{1,5})(?!\d)"
)


def git(cwd, *args):
    return subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True)


def repo_of(path):
    return git(path, "rev-parse", "--show-toplevel").stdout.strip()


def short(cwd, rev):
    r = git(cwd, "rev-parse", "--short", rev).stdout.strip()
    return r or rev


def scan(repo, rev):
    """(documents, ranges) at `rev`, read from git objects only.

    `ranges` is a list of dicts: file, line, a, b, text (the matched range verbatim).
    Raises LookupError with a reason when the tree cannot be judged at all.
    """
    if not repo:
        raise LookupError("no git working tree above this file")
    if git(repo, "rev-parse", "--verify", rev + "^{commit}").returncode != 0:
        raise LookupError("revision %r does not resolve in %s" % (rev, repo))
    listing = git(repo, "ls-tree", "-r", "--name-only", rev, DOC_DIR).stdout.split("\n")
    docs = sorted(f for f in listing if f.endswith(".md"))
    if not docs:
        raise LookupError("%s/ lists no .md document at %s" % (DOC_DIR, rev))
    ranges = []
    for path in docs:
        show = git(repo, "show", "%s:%s" % (rev, path))
        if show.returncode != 0:
            raise LookupError("cannot read %s at %s" % (path, rev))
        for lineno, line in enumerate(show.stdout.split("\n"), 1):
            for m in RANGE.finditer(line):
                ranges.append(dict(file=path, line=lineno,
                                   a=int(m.group("a")), b=int(m.group("b")),
                                   text=m.group(0)))
    if not ranges:
        raise LookupError("the scan found NO `:N`-`:M` range in %d document(s) at %s - a green "
                          "over an empty list is not a measurement" % (len(docs), rev))
    return docs, ranges


def judge(repo, rev, out):
    """Print the full report; return the exit code (0/1) and the counts."""
    docs, ranges = scan(repo, rev)
    tree = short(repo, rev)
    ascending = [r for r in ranges if r["a"] < r["b"]]
    equal = [r for r in ranges if r["a"] == r["b"]]
    reversed_ = [r for r in ranges if r["a"] > r["b"]]

    for r in reversed_:
        out.write("REVERSED  %s:%d  %s  (%d > %d)\n"
                  % (r["file"], r["line"], r["text"], r["a"], r["b"]))
    if reversed_:
        out.write("\n")

    out.write("ranges found:   %d in %d document(s) at %s   [tree %s]\n"
              % (len(ranges), len(docs), rev, tree))
    out.write("  ascending:    %d\n" % len(ascending))
    out.write("  equal ends:   %d   (a one-line span - legitimate, NOT flagged)\n" % len(equal))
    out.write("  REVERSED:     %d   (must be 0)\n" % len(reversed_))
    out.write("NOT JUDGED here: an ascending range whose ends land on the WRONG lines. Order is "
              "this instrument's question;\n                 landing is check-doc-citations.py's. "
              "A green run says every range ascends, and nothing more.\n")
    if reversed_:
        out.write("\nFAIL: %d reversed range(s) at %s   [tree %s]\n"
                  % (len(reversed_), rev, tree))
        return 1, dict(total=len(ranges), ascending=len(ascending),
                       equal=len(equal), reversed=len(reversed_), tree=tree)
    out.write("\nOK: every range ascends at %s   [tree %s]\n" % (rev, tree))
    return 0, dict(total=len(ranges), ascending=len(ascending),
                   equal=len(equal), reversed=0, tree=tree)


# ------------------------------------------------------------------------------- the selftest

PLANT_FILE = DOC_DIR + "/ZZ-RANGE-SELFTEST-PLANT.md"
PLANT_HEAD = "# scratch plant - written by %s --selftest, never by hand\n\n" % SELF
CONTROL_REV = "5d012b7"          # the pre-#365 tree: reversed ranges are KNOWN to exist there


def _commit_plant(clone, base, body):
    """reset the clone to `base`, write the plant file, commit it; return the new sha."""
    git(clone, "reset", "--hard", base)
    with open(os.path.join(clone, PLANT_FILE), "w", encoding="utf-8") as fh:
        fh.write(PLANT_HEAD + body + "\n")
    git(clone, "add", PLANT_FILE)
    c = git(clone, "-c", "user.name=selftest", "-c", "user.email=selftest@example.invalid",
            "commit", "-q", "-m", "selftest plant")
    if c.returncode != 0:
        raise RuntimeError("could not commit the plant: %s" % (c.stderr.strip() or c.stdout))
    return git(clone, "rev-parse", "HEAD").stdout.strip()


def selftest(keep=False):
    repo = repo_of(HERE)
    if not repo:
        print("REFUSED: nothing was checked - no git working tree above %s." % HERE)
        return 2
    base = git(repo, "rev-parse", "HEAD").stdout.strip()
    base_short = short(repo, base)
    if git(repo, "cat-file", "-e", "HEAD:scripts/" + SELF).returncode != 0:
        print("REFUSED: nothing was checked - scripts/%s is not COMMITTED at HEAD (%s)."
              % (SELF, base_short))
        print("  This instrument reads git objects, so a scratch clone made now would not")
        print("  contain it. Commit it, then run --selftest again.")
        return 2

    tmp = tempfile.mkdtemp(prefix="antum-range-selftest-")
    clone = os.path.join(tmp, "clone")
    try:
        made = subprocess.run(["git", "clone", "--shared", "-q", repo, clone],
                              capture_output=True, text=True)
        if made.returncode != 0:
            print("REFUSED: nothing was checked - could not make the scratch clone: %s"
                  % (made.stderr.strip() or made.stdout))
            return 2
        if git(clone, "rev-parse", "--verify", CONTROL_REV + "^{commit}").returncode != 0:
            print("REFUSED: nothing was checked - the control tree %s is not in the clone, so "
                  "the real-defect half of this proof cannot run." % CONTROL_REV)
            return 2
        # THE CLONE'S OWN COPY OF THIS FILE, never the source's: the instrument finds its
        # repository from the location of its own file, so the source's copy would judge the
        # source tree, where no plant exists - every plant would come back green and the
        # footer would name the source's HEAD. That is the exact mistake the sibling harness
        # (doc-citation-pin-selftest.py) documents having made.
        instrument = os.path.join(clone, "scripts", SELF)
        if not os.path.exists(instrument):
            print("REFUSED: nothing was checked - the clone has no scripts/%s at its base, so "
                  "the plants cannot be judged by the clone's own copy." % SELF)
            return 2
        return _plants(clone, base, instrument, keep, tmp)
    finally:
        if keep:
            print("\n--keep: scratch clone left at %s" % clone)
        else:
            shutil.rmtree(tmp, ignore_errors=True)


def _run(instrument, rev):
    p = subprocess.run([sys.executable, instrument, rev], capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


def _plants(clone, base, instrument, keep, tmp):
    bad = 0
    print("selftest: source %s, scratch clone %s, base %s"
          % (os.path.basename(instrument), clone, short(clone, base)))

    def expect(name, cond, detail):
        nonlocal bad
        if not cond:
            bad += 1
        print("  %s  %s" % ("ok " if cond else "BAD", name))
        if cond:
            # Print the instrument's OWN decisive lines, not just this harness's verdict: a
            # green tick over an unread output is the thing this whole file argues against.
            for line in detail.splitlines():
                if line.startswith("REVERSED") or "ranges found:" in line:
                    print("       %s" % line.strip())
        else:
            print("       %s" % detail.replace("\n", "\n       "))

    # R0 - the baseline: green, and NOT vacuous (it must see ranges at all)
    code, out = _run(instrument, base)
    base_total = _count(out, "ranges found:")
    base_equal = _count(out, "equal ends:")
    expect("R0  baseline %s is GREEN and sees %s range(s)" % (short(clone, base), base_total),
           code == 0 and base_total > 0 and ("[tree %s]" % short(clone, base)) in out,
           out)

    # R1 - the defect this instrument exists for: a reversed range must REDDEN, by name
    sha = _commit_plant(clone, base, "PLANT: `App.tsx:2103`\u2013`:2073`")
    code, out = _run(instrument, sha)
    expect("R1  reversed range REDDENS (exit 1) naming %s:3 and both ends" % PLANT_FILE,
           code == 1
           and ("REVERSED  %s:3" % PLANT_FILE) in out
           and "2103 > 2073" in out
           and ("[tree %s]" % short(clone, sha)) in out
           and _count(out, "REVERSED:") == 1,
           out)

    # R2 - equal endpoints: a legitimate one-line span. Seen (the count rises), never flagged.
    sha = _commit_plant(clone, base, "PLANT: `App.tsx:2456`\u2013`:2456`")
    code, out = _run(instrument, sha)
    expect("R2  equal endpoints do NOT fire (exit 0) and ARE counted (+1 equal)",
           code == 0 and _count(out, "equal ends:") == base_equal + 1
           and _count(out, "ranges found:") == base_total + 1,
           out)

    # R3 - a movement arrow is not a range: it must not fire, and must not be counted either.
    sha = _commit_plant(clone, base, "PLANT: `App.tsx:2103` \u2192 `:2073`")
    code, out = _run(instrument, sha)
    expect("R3  a `->` movement arrow does NOT fire and is NOT counted as a range",
           code == 0 and _count(out, "ranges found:") == base_total,
           out)

    # R4 - a clock-time span is not a line range (the colon is preceded by a digit).
    sha = _commit_plant(clone, base, "PLANT: the cutover ran 05:06:55\u201305:07:21Z")
    code, out = _run(instrument, sha)
    expect("R4  a clock-time span `05:06:55-05:07:21` does NOT fire and is NOT counted",
           code == 0 and _count(out, "ranges found:") == base_total,
           out)

    # R5 - the proof is not confined to a plant this file invented: a real tree, known to
    # carry reversed ranges, must redden. This is the half a synthetic plant cannot give.
    code, out = _run(instrument, CONTROL_REV)
    expect("R5  the real pre-#365 control tree %s REDDENS (exit 1)" % CONTROL_REV,
           code == 1 and _count(out, "REVERSED:") > 0,
           out)
    print("       control %s: %s reversed of %s range(s)"
          % (CONTROL_REV, _count(out, "REVERSED:"), _count(out, "ranges found:")))

    print("\nselftest: %s" % ("all plants produced their documented outcome"
                             if not bad else "%d plant(s) did NOT" % bad))
    return 1 if bad else 0


def _count(out, label):
    """The integer after `label` in the report, or -1 when the line is absent.

    Read from the instrument's OWN output, never from a number typed into this harness: a
    control that asserts a constant would keep passing after the instrument stopped counting.
    """
    for line in out.splitlines():
        if label in line:
            tail = line.split(label, 1)[1]
            m = re.search(r"-?\d+", tail)
            if m:
                return int(m.group(0))
    return -1


# ------------------------------------------------------------------------------------- main

def main(argv):
    args = list(argv)
    do_selftest = False
    keep = False
    for flag in ("--selftest", "--keep"):
        if flag in args:
            args.remove(flag)
            if flag == "--selftest":
                do_selftest = True
            else:
                keep = True
    unknown = [a for a in args if a.startswith("-")]
    if unknown:
        print("REFUSED: nothing was checked - unknown flag(s) %s." % " ".join(unknown))
        print("  usage: %s [<rev>] [--selftest [--keep]]" % SELF)
        return 2
    if len(args) > 1:
        print("REFUSED: nothing was checked - one revision at a time, got %d." % len(args))
        return 2
    if do_selftest:
        return selftest(keep=keep)

    repo = repo_of(HERE)
    rev = args[0] if args else "HEAD"
    try:
        code, _ = judge(repo, rev, sys.stdout)
        return code
    except LookupError as exc:
        print("REFUSED: nothing was checked - %s." % exc)
        print("  run it inside the repository, or name a revision: %s [<rev>]" % SELF)
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
