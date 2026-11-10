#!/usr/bin/env python3
"""Prove that the `@rev` revision-pin path of check-doc-citations.py actually works.
    python3 scripts/doc-citation-pin-selftest.py [--keep]
    python3 scripts/doc-citation-pin-selftest.py --mutant <name>

WHY THIS EXISTS. The doc-citation instrument grew a revision pin on 2026-10-29
(`@rev <sha>` before the numbers it governs on the same line). Nothing proved the pin
did anything. A citation judged at the tip and a citation judged at a pinned tree both
print `ok`, and the only thing separating them is a counter in the footer that no one
had a control for. A fix that cannot redden is a comment, and so is a counter nobody
has watched move.

WHAT IT DOES. Seven plants, each one committed into a SCRATCH CLONE and each one judged
by running the clone's own copy of the real instrument over that clone:

  P1  a correct pin lands        -> the plant line is `ok` AND `pinned` rises by 1
  P2  the same citation, marker deleted
                                 -> `FAIL` and exit 1: the MARKER does the work, not
                                    the line number
  P3  a pin that cannot resolve  -> `REFUSED: nothing was checked`, exit 2, NO per-line
                                    report and NO footer (a refusal prints no counts)
  P4  a marker governing nothing -> `UNUSED-PIN` and `unused pin = 1`
  P5  a bare backticked SHA in prose, no marker
                                 -> stays UNCHECKED: a prose pin is not a pin
  P6  a correct pin naming a symbol that is NOT on that line at that revision
                                 -> `FAIL` and exit 1 while `pinned` STILL rises by 1.
                                    P1 alone cannot tell "the pin moved the tree" from
                                    "the counter moved"; P6 separates them.
  P7  a citation that WRAPS across a line break (`App.tsx:` on one line, the number on
      the next)            -> the instrument prints a `CONTINUATION` line for it. This is
                                    the one plant judged TWICE: P7 also runs the PRE-CHANGE
                                    instrument (the copy at `754031c`, extracted from the
                                    clone's own objects) over the same committed plant and
                                    requires that it prints NOTHING for that file. The new
                                    reading alone would not prove the old one was blind -
                                    it could have been reporting the line all along, in
                                    another word. Both readings are printed.

WHY A CLONE, AND WHY THE CLONE'S OWN COPY OF THE INSTRUMENT. The instrument reads GIT
OBJECTS (`git show <rev>:<path>`), so a plant that is not committed is invisible: the
run measures the parent commit and prints the parent's numbers with exit 0. That is why
every plant below is committed before it is judged. And the instrument finds its
repository from the location of ITS OWN FILE, ignoring the working directory - so
running the SOURCE repository's copy with cwd=<clone> judges the source tree, every
plant is invisible, and the footer still names the source's HEAD. The first cut of this
harness made exactly that mistake and all six plants came back with no delta. Every run
is therefore checked against the clone's HEAD through the footer's `[tree ...]` marker,
so that mistake cannot come back silently.

The clone is `git clone --shared`: no object is copied, and every historical revision
the plants name (`7a4e00a`, `b7630cb`) is present. The source repository is never
written to. If the clone cannot be made, this EXITS NON-ZERO rather than skipping: a
control that cannot run must not read as a pass.

Exit 0 only when all seven plants produced exactly the documented outcome. Any mismatch
prints the plant, the expectation and the actual output, and exits 1.

--mutant <name> is a second, separate proof: it weakens the instrument inside the clone
and requires a named plant to catch the weakening. See MUTANTS below.
"""
import os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
KEEP = "--keep" in sys.argv

REL_INSTRUMENT = "docs/evidence/no-403-claim-sweep-2026-10-20/check-doc-citations.py"
PLANT = "design-concepts/PIN-SELFTEST-PLANT.md"
FOOTER = re.compile(r"(\d+) ok, (\d+) FAILING, (\d+) unchecked, (\d+) pinned, (\d+) unused pin")
TREE = re.compile(r"\[tree ([0-9a-f]+)\]")
REPORT = re.compile(r"^(ok|FAIL|UNCHECKED|UNUSED-PIN|CONTINUATION|OTHER-FILE)\s", re.M)

# The symbols below were read OUT OF THE TREES THEY ARE CITED AT, not guessed:
#   7a4e00a:1212 -> {user?.username || 'Admin User'}
#   tip:1216     -> `setChecklistNotice({ kind: 'error', ...`            (no `username`)
#   tip:1808     -> {formatAmount(analytics.avgCostPerHireAE)}
# The `tip:` entries are TIP readings - they say what the cited number holds at the tip of
# THIS tree, which is why P2 (the same 1212, unpinned) FAILS: at this tip, `:1212` is
# `handleLogout();`, and the `username` line has moved to :1453. They move whenever App.tsx
# grows, and the plant's own number must move with them: 1580 -> 1597 (the escalation panel,
# +61 lines above the analytics tab) -> 1602 (the probation write path, +5 more at that line)
# -> 1703 (the probation evaluation screen, +101 more above the analytics tab) -> 1808 (the
# correction screen, +105 more above the analytics tab; measured at a94bca9, where that
# symbol is on :1808, and on :1703 at 2a23e43) -> 1875 (the pre-boarding notice lifecycle,
# +67 more above the analytics tab; measured at 7a00a2d, where that symbol is on :1875)
# -> 1884 (the EOSB card's own 18 inserted lines, 2026-11-08, where that symbol is on
# :1884 - measured, not re-tipped) -> 1907 (the cost-per-hire card fix, 2026-11-08: the
# expression moved INTO the new `CostPerHireFigure` call, +19 below the component, and the
# two row divs it used to sit in were replaced - measured at 711804f, not re-tipped)
# -> 1925 (the refusal-not-empty fix, 2026-11-08: +18 lines above the analytics tab; measured
# at 08a9ca9, not re-tipped - and this is the link that reddened: at 08a9ca9 the plant still
# said 1907, so P4 reported `exit 1, expected 0` while its UNUSED-PIN was still printed,
# exactly the failure mode recorded below) -> 1938 (re-measured at fc5d705, 2026-11-10: the
# rest of the refusal-not-empty fix, which merged after 08a9ca9, added 13 lines above the
# analytics tab and moved the symbol down from the 1925 that reading recorded - measured,
# not re-tipped) -> 1941 (re-measured at 348ae34, 2026-11-10: #399 added 3 lines at App.tsx:879,
# above the analytics tab, and moved the symbol down from the 1938 that reading recorded -
# measured, not re-tipped); the
# example line moved 1212 -> 1216 for the
# same reason. A stale P4 number does not read as "re-tip me": the citation stops landing,
# and P4 reports `exit 1, expected 0` while its UNUSED-PIN is still printed. Re-measure the
# number before blaming the plant.
# The 1212 in P1/P2/P3/P6 is NOT a tip reading - it is the line at `7a4e00a`, where it holds
# `{user?.username || 'Admin User'}`, and it stays 1212 because that tree does not move.
# `{activeTab` is deliberately NOT used for P1: it is not on 7a4e00a:1212 (measured - it
# lives at tip:2171). A plant naming a symbol that is not there would make P1 red for the
# wrong reason. It appears in P6 instead, where its absence is the whole point.
P1 = """
# pin selftest plant

- `@rev 7a4e00a` `App.tsx:1212` renders `{user?.username || 'Admin User'}` at the revision it names.
"""
P2 = """
# pin selftest plant

- `App.tsx:1212` renders `{user?.username || 'Admin User'}` with no pin, so it is judged at the tip.
"""
P3 = """
# pin selftest plant

- `@rev deadbeefdeadbeef` `App.tsx:1212` renders `{user?.username || 'Admin User'}` at a tree nobody has.
"""
P4 = """
# pin selftest plant

- `App.tsx:1941` renders `{formatAmount(analytics.avgCostPerHireAE)}`, and this marker governs nothing: `@rev 7a4e00a`
"""
P5 = """
# pin selftest plant

- The `App.tsx:1183` cite is pinned by declaration at `b7630cb` and is correctly stale for that revision.
"""
P6 = """
# pin selftest plant

- `@rev 7a4e00a` `App.tsx:1212` renders `{activeTab === 'preboarding' && (` at the revision it names.
"""

P7 = """
# pin selftest plant

- The identity card renders `{user?.username || 'Admin User'}` at App.tsx:
  `:1212` on the tree it names, and the number is on the NEXT line, not this one.
"""

# The instrument BEFORE the continuation fix. P7 extracts this revision's copy of the
# instrument from the clone's own objects and runs it over the same committed plant, so
# "the old one was blind to this" is a measurement and not a claim about the past.
PRE_CONTINUATION_AT = "754031c"
PRE_CONTINUATION_NAME = "doc-cite-instrument-before-continuation.py"

# id, plant, want-exit, want-status-word (None = not asserted), want pinned delta,
# want-footer (a refusal prints none), why
CASES = [
    ("P1", P1, 0, "ok", +1, True,
     "a correct pin lands and `pinned` rises by 1 - ok without a rising `pinned` would mean "
     "the number landed at the tip by luck and the pin was ignored"),
    ("P2", P2, 1, "FAIL", 0, True,
     "the same citation with the marker deleted FAILS: the marker, not the line number, does the work"),
    ("P3", P3, 2, None, None, False,
     "an unresolvable pin REFUSES: exit 2, no per-line report, no footer"),
    ("P4", P4, 0, "UNUSED-PIN", None, True,
     "a marker with no citation number after it is reported UNUSED-PIN and `unused pin` is 1"),
    ("P5", P5, 0, "UNCHECKED", 0, True,
     "a bare backticked SHA in prose is NOT a pin: the line stays UNCHECKED"),
    ("P6", P6, 1, "FAIL", +1, True,
     "a correct pin naming a symbol absent at that revision FAILS while `pinned` still rises: "
     "the pin is not a rubber stamp"),
    ("P7", P7, 0, "CONTINUATION", 0, True,
     "a citation wrapped across a line break is REPORTED (CONTINUATION) instead of being "
     "skipped in silence - and the pre-change instrument, run over the same plant, says "
     "nothing about it at all"),
]

# A control that cannot redden proves nothing, so this one had to be shown able to. Each
# mutant is a weakening of the instrument, applied inside the scratch clone and COMMITTED
# there, so the plants are judged by a broken instrument.
#
# (list of (old, new) replacements, the plant that must react, expected verdict)
#   expected="caught"     the named plant MUST fail -> proves that plant is load-bearing
#   expected="equivalent" NO plant may change      -> a measured no-op, recorded on purpose
#
# The three "equivalent" entries are RESULTS, not guesses. symbol() rejects a bare SHA on
# TWO independent lines - the `^[0-9a-f]{7,40}$` exclusion and the final character test
# `any(c in t for c in "= {}<>-_\"'")` - and either one alone keeps `b7630cb` out. So
# removing either one is a no-op, and removing BOTH (the `weaken-symbol` mutant) is what P5
# must catch. `accept-any-pin` is masked the same way: disabling the "does not resolve"
# branch leaves the `elif not show(sha, "client/src/App.tsx")` branch refusing the same pin,
# so the refusal is guarded twice. Both facts are recorded here rather than assumed, and
# re-running any of them re-checks them.
#
# KNOCK-ON, MEASURED 2026-11-03 and recorded rather than tidied away: `weaken-symbol` makes
# EVERY backticked token a symbol tree-wide, so lines that were UNCHECKED start being judged
# by junk and some fail. That is why it also knocks over P1, P4 and P7 (4 unexpected
# outcomes), not only its target P5. The mutant contract is about the TARGET - the run
# prints "MUTANT weaken-symbol CAUGHT by P5" and exits 0 - so the knock-ons do not make the
# mutant wrong; suppressing them would mean not judging the tree it was applied to.
MUTANTS = {
    "weaken-symbol": (
        [('if re.match(r"^[0-9a-f]{7,40}$", t): return False',
          "pass  # MUTANT: the bare-hex exclusion is gone"),
         ('return any(c in t for c in "= {}<>-_\\"\'")',
          "return True  # MUTANT: every backticked token is now a symbol")],
        "P5", "caught"),
    "ignore-pin": (
        [("if m.start() < pos: rev = m.group(1)",
          "if False: rev = m.group(1)  # MUTANT: the pin is ignored")],
        "P1", "caught"),
    "drop-hex-exclusion": (
        [('if re.match(r"^[0-9a-f]{7,40}$", t): return False',
          "pass  # MUTANT: the bare-hex exclusion is gone")],
        "P5", "equivalent"),
    "weaken-symbol-charset": (
        [('return any(c in t for c in "= {}<>-_\\"\'")',
          "return True  # MUTANT: every backticked token is now a symbol")],
        "P5", "equivalent"),
    "accept-any-pin": (
        [('if git("rev-parse", "--verify", sha + "^{commit}").returncode != 0:',
          "if False:  # MUTANT: the unreadable-pin branch is disabled")],
        "P3", "equivalent"),
}


def run(cmd, cwd):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)


def run_instrument(instrument, clone):
    """Run the instrument and return (exit code, combined output)."""
    r = run([sys.executable, instrument], clone)
    return r.returncode, r.stdout + r.stderr


def commit(clone, paths, message):
    add = run(["git", "add"] + paths, clone)
    com = run(["git", "-c", "user.name=pin-selftest", "-c", "user.email=pin-selftest@invalid",
               "commit", "--quiet", "-m", message], clone)
    if add.returncode != 0 or com.returncode != 0:
        return (add.stderr + com.stderr).strip()
    return None


def apply_mutant(instrument, name, clone):
    """Weaken the clone's copy of the instrument and commit it, so the plants see it."""
    pairs = MUTANTS[name][0]
    with open(instrument, encoding="utf-8") as fh:
        text = fh.read()
    for old, new in pairs:
        if text.count(old) != 1:
            print("CANNOT-JUDGE: a mutation target appears %d times in the instrument, not once: %r"
                  % (text.count(old), old))
            return False
        text = text.replace(old, new)
    with open(instrument, "w", encoding="utf-8") as fh:
        fh.write(text)
    err = commit(clone, [REL_INSTRUMENT], "mutant %s" % name)
    if err:
        print("CANNOT-JUDGE: could not commit the mutation: %s" % err)
        return False
    return True


def main():
    mutant = None
    if "--mutant" in sys.argv:
        i = sys.argv.index("--mutant")
        if i + 1 >= len(sys.argv) or sys.argv[i + 1] not in MUTANTS:
            print("usage: --mutant {%s}" % "|".join(sorted(MUTANTS)))
            return 2
        mutant = sys.argv[i + 1]

    src = run(["git", "rev-parse", "--show-toplevel"], HERE)
    repo = src.stdout.strip()
    if not repo:
        print("CANNOT-JUDGE: scripts/ is not inside a git working tree, so there is nothing to clone.")
        print("  " + (src.stderr.strip() or "(git rev-parse printed nothing)"))
        return 2
    if not os.path.exists(os.path.join(repo, REL_INSTRUMENT)):
        print("CANNOT-JUDGE: the instrument is not at %s" % os.path.join(repo, REL_INSTRUMENT))
        return 2

    tmp = tempfile.mkdtemp(prefix="doc-cite-pin-selftest-")
    clone = os.path.join(tmp, "clone")
    failures = []
    try:
        r = run(["git", "clone", "--shared", "--quiet", repo, clone], tmp)
        if r.returncode != 0:
            print("CANNOT-JUDGE: could not make the scratch clone of %s" % repo)
            print(r.stderr.strip())
            return 2
        head = run(["git", "rev-parse", "--short", "HEAD"], clone).stdout.strip()
        # THE CLONE'S OWN COPY, never the source's - see the module docstring.
        instrument = os.path.join(clone, REL_INSTRUMENT)
        if not os.path.exists(instrument):
            print("CANNOT-JUDGE: the clone has no copy of the instrument at %s" % REL_INSTRUMENT)
            return 2
        print("scratch clone of %s at %s; judging with the clone's own copy of %s"
              % (repo, head, REL_INSTRUMENT))

        if mutant:
            if not apply_mutant(instrument, mutant, clone):
                return 2
            print("MUTANT %s applied and committed - the plants below are judged by a broken "
                  "instrument; %s is expected to be %s"
                  % (mutant, MUTANTS[mutant][1], MUTANTS[mutant][2].upper()))

        # --- baseline, before any plant: the numbers every delta is measured against.
        base, base_out = run_instrument(instrument, clone)
        b = FOOTER.search(base_out)
        if not b:
            print("CANNOT-JUDGE: the baseline run printed no footer:\n" + base_out)
            return 2
        b_ok, b_fail, b_unch, b_pin, b_unused = (int(b.group(i)) for i in range(1, 6))
        print("baseline at %s: %d ok, %d FAILING, %d unchecked, %d pinned, %d unused pin, exit %d"
              % (head, b_ok, b_fail, b_unch, b_pin, b_unused, base))
        if b_fail != 0 or base != 0:
            print("  NOTE: the committed tree is not citation-clean; the deltas below are still "
                  "meaningful, but that is its own defect.")

        for cid, text, want_exit, want_word, want_pin_delta, want_footer, why in CASES:
            with open(os.path.join(clone, PLANT), "w", encoding="utf-8") as fh:
                fh.write(text.lstrip("\n"))
            err = commit(clone, [PLANT], "plant %s" % cid)
            if err:
                failures.append("%s: could not commit the plant: %s" % (cid, err))
                continue

            got, out = run_instrument(instrument, clone)
            # The plant commit MOVED the clone's HEAD; read it again rather than reusing the
            # baseline sha, or every case fails its own tree check for the right reason and
            # the harness reports six failures on six correct behaviours.
            cur_head = run(["git", "rev-parse", "--short", "HEAD"], clone).stdout.strip()
            problems = []
            if got != want_exit:
                problems.append("exit %d, expected %d" % (got, want_exit))

            foot = FOOTER.search(out)
            if want_footer:
                if not foot:
                    problems.append("printed no footer")
                else:
                    tree_m = TREE.search(out)
                    if not tree_m or not (cur_head.startswith(tree_m.group(1))
                                          or tree_m.group(1).startswith(cur_head)):
                        problems.append("footer names tree %r but the clone is at %r - the run "
                                        "judged a different tree from the one planted into"
                                        % (tree_m.group(1) if tree_m else None, cur_head))
                    g_pin, g_unused = int(foot.group(4)), int(foot.group(5))
                    if want_pin_delta is not None and g_pin - b_pin != want_pin_delta:
                        problems.append("pinned moved %+d, expected %+d (%d -> %d)"
                                        % (g_pin - b_pin, want_pin_delta, b_pin, g_pin))
                    if cid == "P4" and g_unused != 1:
                        problems.append("unused pin = %d, expected 1" % g_unused)
            else:
                if foot:
                    problems.append("printed a footer (%r); a refusal must print no counts"
                                    % foot.group(0))
                if "REFUSED: nothing was checked" not in out:
                    problems.append("did not print `REFUSED: nothing was checked`")
                if REPORT.search(out):
                    problems.append("printed a per-line report; a refusal must print none")

            if want_word is not None:
                word = None
                for line in out.split("\n"):
                    if PLANT + ":" in line:
                        word = line.split()[0]
                        break
                if word != want_word:
                    problems.append("plant line reported %r, expected %r" % (word, want_word))

            if cid == "P7":
                # THE OTHER HALF OF THE CONTROL: the same committed plant, the OLD instrument.
                old_src = run(["git", "show", PRE_CONTINUATION_AT + ":" + REL_INSTRUMENT],
                              clone).stdout
                if not old_src.strip():
                    problems.append("could not read the pre-change instrument at %s"
                                    % PRE_CONTINUATION_AT)
                else:
                    old_path = os.path.join(clone, PRE_CONTINUATION_NAME)
                    with open(old_path, "w", encoding="utf-8") as fh:
                        fh.write(old_src)
                    o_code, o_out = run_instrument(old_path, clone)
                    old_lines = [ln for ln in o_out.split("\n") if PLANT + ":" in ln]
                    if o_code != 0:
                        problems.append("the pre-change instrument exited %d on a clean "
                                        "tree - its silence would then prove nothing"
                                        % o_code)
                    if old_lines:
                        problems.append("the pre-change instrument REPORTED the plant after "
                                        "all (%r) - it was not blind to this" % old_lines[0])
                    print("        -> pre-change instrument at %s: exit %d, %d line(s) for "
                          "%s (expected 0)" % (PRE_CONTINUATION_AT, o_code, len(old_lines),
                                               PLANT))
                    os.remove(old_path)

            if problems:
                failures.append("%s: %s" % (cid, "; ".join(problems)))
                print("FAILED %s  %s" % (cid, why))
                for p in problems:
                    print("        - %s" % p)
                for ln in out.rstrip().split("\n")[-6:]:
                    print("        | %s" % ln)
            else:
                print("ok     %s  %s" % (cid, why))
                if foot:
                    print("        -> exit %d, %s ok, %s FAILING, %s unchecked, %s pinned, %s unused pin"
                          % (got, foot.group(1), foot.group(2), foot.group(3), foot.group(4),
                             foot.group(5)))
                else:
                    print("        -> exit %d, refused, no per-line report and no footer" % got)
    finally:
        if KEEP:
            print("\n--keep: scratch clone left at %s" % clone)
        else:
            shutil.rmtree(tmp, ignore_errors=True)

    print("\n%d plant(s) judged, %d unexpected outcome(s)" % (len(CASES), len(failures)))

    if mutant:
        target, expected = MUTANTS[mutant][1], MUTANTS[mutant][2]
        caught = any(f.startswith(target + ":") for f in failures)
        if expected == "caught":
            if caught:
                print("MUTANT %s CAUGHT by %s - the control reddens on a weakened instrument."
                      % (mutant, target))
                return 0
            print("MUTANT %s SURVIVED: %s did not catch it, so %s is not load-bearing."
                  % (mutant, target, target))
            return 1
        if not failures:
            print("MUTANT %s EQUIVALENT as documented: no plant changed, so the mutated line "
                  "is not load-bearing on its own." % mutant)
            return 0
        print("MUTANT %s was documented as equivalent but CHANGED an outcome - that comment "
              "is wrong and the mutated line now matters:" % mutant)
        for f in failures:
            print("  " + f)
        return 1

    if failures:
        for f in failures:
            print("  " + f)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
