#!/usr/bin/env python3
"""
ONE operator-facing entry point for every check the team owns.

    python3 scripts/check-all.py                  # the default set: fast, read-only, tree-scoped
    python3 scripts/check-all.py --full           # + the six off-host instrument proofs
    python3 scripts/check-all.py --live LABEL     # + the cutover success tests against what is serving
    python3 scripts/check-all.py --no-suite       # skip `node --test` (the slow one)
    python3 scripts/check-all.py --only ID        # ONE check, loudly labelled a PARTIAL run
    python3 scripts/check-all.py --selftest       # prove the classifier below, run nothing else

WHAT IT DOES
  Runs each check, and prints for each: what it asserted, the tree it judged, its exit, and
  what the check itself said. A red check prints a bounded TAIL of its own output, not its
  last line - `FAIL: see the lists above` is a real last line, and the list that names the
  lost document sits five lines higher (measured; the first cut printed the useless line).
  Then one total and ONE verdict.

WHY IT EXISTS
  Because the instruments had grown three homes - a bare CLI, a suite gate, a movement
  preflight - and an instrument reachable only from one of them is a false green for
  everyone in the other two. Two were reachable from NONE: `check-doc-citations.py`
  raised IndexError on its bare form, and `check-index-ids.py` had no gate at all. The
  plan's wording is exact: *an instrument that cannot be green on the tree it judges is
  not a gate*, and *a control the operator cannot reach is a false green*.

THE DISTINCTION THIS PRINTS (the reason to have one entry point rather than a list)
  A red check has two completely different meanings, and they must not print alike:
    RED-KNOWN       the tree is in a state that is RECORDED as the defect state. Its line
                    names where that is recorded and what would end it. It does not fail the run.
    BROKEN          the check is red and NOTHING declares that state. It fails the run.
  The mapping is computed from a declared expectation and the observed exit, never judged by
  eye, and `--selftest` asserts every case of it so a broken classifier cannot pass quietly.
  Three more words matter, and each fails the run: CANNOT-JUDGE (the check refused to read
  this tree - exit 2, the team's third code from #266 - which is not a red verdict and must
  never print as one), STALE-EXCEPTION (a declaration that no longer fires: an exception
  that lies about the tree is worse than no exception), and RIG-INCOMPLETE (the suite cannot
  be judged here because server/node_modules is absent - a rig report is not a tree report).

THE MOVEMENT DOES NOT RUN THIS, AND THIS FILE DOES NOT WIRE ITSELF IN (ruling, not choice)
  `scripts/cutover-preflight.sh` runs no checker and no `.py` (verified by grep, this run's
  evidence). A docs/tracker check able to abort a product deploy would invert this team's
  own rule that a docs-only delta owes no movement. Wiring any check into the movement is
  the lead's ruling to make. Every line below says which home it has, and the movement is
  not one of them.

ACTOR vs CHECK, STATED RATHER THAN IMPLIED
  This runs only instruments that ASSERT something and are safe to run anywhere. The
  deploy, the keep-alive loop, the installer, the re-seeder and the guard hook are ACTORS:
  they change the host, the live product or the demo data. They are LISTED below with their
  reason rather than quietly omitted - a register that shrinks quietly is the defect this
  whole file answers to. Classification is by reading each file's own header: a grep count
  cannot tell a check from an actor (`seed-demo.js` scores 0 on a grep for host-mutating
  words and rewrites the demo database).
"""
import os
import re
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CITE = "docs/evidence/no-403-claim-sweep-2026-10-20/check-doc-citations.py"
# IN the repository since 2026-10-26 (was /home/team/shared/verify-access-model.py, which no PR
# could carry). Resolved from this file, so the operator form works from any working directory.
ACCESS_MODEL = os.path.join(HERE, "verify-access-model.py")
PY = sys.executable or "python3"
TAIL_LINES = 8          # how much of a RED check's own output is shown (see the header)

# ---------------------------------------------------------------- the classifier (tested)

def classify(expect, code):
    """(declared expectation, observed exit) -> the word this run prints.

    exit 2 is the team's own third code (#266): the check REFUSED to judge - it could not
    read the tree - which is not the same event as a red verdict, and must never print as
    one. Anything outside 0/1/2 is a crash or a timeout and is named as such.
    """
    if code == 2:
        return "CANNOT-JUDGE"
    if code not in (0, 1):
        return "BROKEN-EXIT-%d" % code
    if expect == "green":
        return "OK" if code == 0 else "BROKEN"
    return "STALE-EXCEPTION" if code == 0 else "RED-KNOWN"


FAILING_WORDS = ("BROKEN", "BROKEN-EXIT", "CANNOT-JUDGE", "STALE-EXCEPTION", "RIG-INCOMPLETE")

def classify_check(c, code):
    """classify() plus the ONE case a check may declare about its own environment.

    A check whose SUBJECT can legitimately be absent from this machine must not be able to
    print OK - that is a skip that reads like a pass, the defect this file exists to close.
    `scripts/check-workflow-mirror.py` compares this tree's WORKFLOW.md with
    `/home/team/shared/WORKFLOW.md`, which is outside the repository: a fresh clone and CI have
    no such file, and nothing was compared there. It exits 3 for exactly that and declares
    `absent_exit=3`, so the row prints SKIP-FLAGGED and is counted as SKIPPED, never run.

    Only the declared code maps this way: the same check exiting 0, 1 or 2 is judged by
    classify() as usual, and any other code is still a BROKEN-EXIT crash. `--selftest` asserts
    all four.
    """
    if c.get("absent_exit") is not None and code == c["absent_exit"]:
        return "SKIP-FLAGGED"
    return classify(c["expect"], code)

def fails_run(word):
    """The ONE predicate the verdict uses. The self-test below asserts against this same
    function, so the classifier's documentation and the exit code cannot drift apart."""
    return any(word.startswith(w) for w in FAILING_WORDS)

def selftest():
    cases = [
        ("green", 0, "OK"),
        ("green", 1, "BROKEN"),
        ("green", 2, "CANNOT-JUDGE"),
        ("green", 137, "BROKEN-EXIT-137"),
        ("known-red", 1, "RED-KNOWN"),
        ("known-red", 0, "STALE-EXCEPTION"),
    ]
    words = [("OK", False), ("RED-KNOWN", False), ("BROKEN", True), ("BROKEN-EXIT-137", True),
             ("CANNOT-JUDGE", True), ("STALE-EXCEPTION", True), ("RIG-INCOMPLETE", True),
             ("SKIP-FLAGGED", False)]
    # The declared-absence case. A check whose subject can be absent from this machine exits
    # its own declared code; that code must print SKIP-FLAGGED - never OK (a skip that reads
    # like a pass) and never BROKEN-EXIT-3 (which would call a fresh clone a broken tree).
    # Everything else about the same check is classified as usual, asserted here so the
    # declaration cannot quietly widen.
    absent = dict(id="absent-check", expect="green", absent_exit=3)
    absent_cases = [
        (dict(absent), 3, "SKIP-FLAGGED"),
        (dict(absent), 0, "OK"),
        (dict(absent), 1, "BROKEN"),
        (dict(absent), 2, "CANNOT-JUDGE"),
        (dict(absent), 4, "BROKEN-EXIT-4"),
        (dict(id="no-declaration", expect="green"), 3, "BROKEN-EXIT-3"),
    ]
    total = len(cases) + len(words) + len(absent_cases)
    bad = 0
    for expect, code, want in cases:
        got = classify(expect, code)
        if got != want:
            bad += 1
        print("  %s  classify(%-9s, exit=%-4s) -> %s" % ("ok " if got == want else "BAD", expect, code, got))
    for c, code, want in absent_cases:
        got = classify_check(c, code)
        if got != want:
            bad += 1
        print("  %s  classify_check(absent_exit=%s, exit=%-3s) -> %s (must be %s)"
              % ("ok " if got == want else "BAD", c.get("absent_exit", "-"), code, got, want))
    for word, must_fail in words:
        got = fails_run(word)
        if got != must_fail:
            bad += 1
        print("  %s  fails_run(%-14s) -> %s (must be %s)"
              % ("ok " if got == must_fail else "BAD", word, got, must_fail))
    print("classifier self-test: %d/%d cases" % (total - bad, total))
    return 1 if bad else 0

# ------------------------------------------------------------------- the checks (registry)
# mode: "default" runs always; "full"/"live" need the flag. expect: "green" | "known-red".

CHECKS = [
    dict(id="design-concepts-index", mode="default", expect="green",
         home="operator CLI (bare) + suite gate",
         cmd=[PY, "scripts/check-design-concepts-index.py"],
         what="every design-concepts/*.md except README.md carries exactly ONE index row; no row names a missing document; the README's own exclusion is asserted; the index is not empty"),

    dict(id="index-ids", mode="default", expect="green",
         home="operator CLI (bare) - NO gate, which is why this entry point matters",
         cmd=[PY, "scripts/check-index-ids.py"],
         what="every id quoted in roadmap-board-index.md resolves against the board or git, no removal is unrecorded, and the re-check section's trigger structure is intact"),

    dict(id="doc-citations", mode="default", expect="green",
         home="operator CLI (bare form ADDED 2026-10-20 by this change - it raised IndexError before)",
         cmd=[PY, CITE],
         what="every `App.tsx:<n>` citation in design-concepts/ lands on a line carrying one of the symbols the citing line names"),

    dict(id="doc-citation-pin-selftest", mode="default", expect="green",
         home="operator CLI (bare) + this entry point; it needs git objects to clone, so the movement does not run it",
         cmd=[PY, "scripts/doc-citation-pin-selftest.py"],
         what="the `@rev` PIN control, not the citations themselves. Eight plants are committed into a scratch "
              "clone and judged by the clone's own copy of the instrument (the instrument finds its repo from "
              "its own file, so the source's copy would judge the source tree and see nothing). Each plant must "
              "produce its documented outcome: a correct pin `ok` with `pinned` rising by 1; the same citation "
              "without the marker FAILING; an unresolvable pin REFUSED at exit 2 with no per-line report and no "
              "footer; a marker governing nothing UNUSED-PIN; that same citation on a line carrying none of its "
              "identifiers FAILING (P4's number is DERIVED from client/src/App.tsx every run, so a line shift "
              "cannot redden it, and the control proves the derivation is not a rubber stamp); a bare backticked "
              "SHA in prose still UNCHECKED; and a correct pin naming a symbol absent at that revision FAILING "
              "while `pinned` still rises. "
              "A counter nobody has watched move is a comment - this is the watch. `--mutant <name>` is the "
              "second half: it weakens the instrument and requires a named plant to catch it"),

    # Wired in 2026-11-06. It exists because the instrument above cannot see this class at all:
    # a citation GROUP passes when ANY of its numbers lands, so `:2103`-`:2073` passed the gate
    # and shipped. `--selftest` is part of the same script rather than a second entry, so the
    # proof and the check cannot drift apart; it is the reason the entry can be trusted to
    # redden, and it is what a reader should run first if they doubt the green.
    dict(id="cross-doc-citations", mode="default", expect="green",
         home="operator CLI (bare) + this entry point; it reads git objects, so the movement does not run it",
         cmd=[PY, "scripts/check-cross-doc-citations.py"],
         what="judges a citation into ANOTHER document (`SOMEDOC.md:12`, `:12`-`:18`) against THAT "
              "document at HEAD, requiring the citing SENTENCE's own quotation to land on the cited line - "
              "the class both older citation gates decline to judge (one marks it OTHER-FILE, the other only "
              "asks whether a range ascends). It does NOT judge a citation whose sentence quotes nothing, nor "
              "an ASCENDING citation that lands on the wrong line with no quotation to anchor it: those are "
              "UNJUDGEABLE and NAMED, so a green here means every QUOTATION-ANCHORED citation lands - never "
              "that the pointers are correct. Zero citations found is a REFUSAL (exit 2), not a pass. "
              "THE MEASURED LIMIT, carried here rather than implied: of 122 cross-document citations under "
              "its roots, 16 are anchored and land, 0 are DRIFT, 0 are OUT-OF-BOUNDS and 106 are "
              "UNJUDGEABLE - that 106 is what this instrument does NOT judge, and a green says nothing "
              "about it. The two drifts its FIRST run reported, at bf9a484, were pdpl-portal-boundary-memo.md "
              "pointing at line 391 of compliance-requirements.md for a sentence on line 420; they were "
              "fixed in the TREE (the pointer moved to 420, the claim untouched) and this row became green, "
              "because a known-red row left standing is a row the team learns to ignore."),
    dict(id="doc-citation-ranges", mode="default", expect="green",
         home="operator CLI (bare) + this entry point; it reads git objects, so the movement does not run it",
         cmd=[PY, "scripts/check-doc-citation-ranges.py"],
         what="every `:N`-`:M` range in design-concepts/ ASCENDS - the class check-doc-citations.py "
              "structurally cannot judge, because a citation group is satisfied when any ONE of its numbers "
              "lands and a reversed range still contains one that does. Equal endpoints (`:2456`-`:2456`, a "
              "legitimate one-line span), `->` movement arrows and clock times are not ranges and are not "
              "flagged. It reads a git revision (`git show <rev>:<path>`, HEAD by default) and prints the tree "
              "it judged; an ASCENDING range that lands on the wrong line is a different defect and is NOT this "
              "instrument's question, which its header states so a green is not read as 'the pointers are "
              "correct'. `--selftest` commits plants into a scratch clone, requires the clone's own copy to "
              "redden on a reversed range naming file:line, requires the three non-findings to stay quiet, and "
              "re-runs the real pre-#365 tree, which is known to carry reversed ranges"),

    # Wired in 2026-11-06, with the resync it guards. `WORKFLOW.md` here is a DECLARED MIRROR of
    # `/home/team/shared/WORKFLOW.md` - the file the team actually maintains - and nothing
    # compared the two. Measured on 2026-11-06, the mirror was stale three ways at once: rules
    # 42 and 43 were missing entirely (a fresh clone carried neither the merge policy nor the
    # client-build rule), a sentence still said the off-host check "does not exist yet" after
    # it had shipped, and the header claimed a sync date, revision and rule range the file no
    # longer matched. `absent_exit=3` is the reason this entry needs the classifier above: the
    # live file is OUTSIDE the repository, so a fresh clone and CI have nothing to compare, and
    # that must print SKIP-FLAGGED rather than OK.
    dict(id="workflow-mirror", mode="default", expect="green", absent_exit=3,
         home="operator CLI (bare) + this entry point; it reads a file outside the repository, so the movement does not run it",
         absent_reason="no live file at the path this check reads (default /home/team/shared/WORKFLOW.md, "
                       "overridable with ANTUM_LIVE_WORKFLOW) - a fresh clone or CI. NOTHING WAS COMPARED: "
                       "the mirror's body was not judged. On the team's machine: "
                       "python3 scripts/check-workflow-mirror.py",
         cmd=[PY, "scripts/check-workflow-mirror.py"],
         what="this tree's WORKFLOW.md with its `>`-prefixed header lines stripped must be BYTE-IDENTICAL "
              "to /home/team/shared/WORKFLOW.md, and every differing line is printed with both sides. It is "
              "stricter than the `diff -B` the mirror's header documents: a blank-line-only difference is "
              "DRIFT here, because the mirror is built by inserting its header between two live lines, which "
              "makes exact identity achievable. A body with no content lines is a REFUSAL (exit 2), not a "
              "clean 0-diff. WHAT IT DOES NOT JUDGE: the header's own claims (sync date, revision, rule "
              "range) - it knows only that the body matches - and which live file is authoritative; it "
              "compares against the path it prints. `--selftest` builds a scratch pair from this tree's own "
              "file and requires: OK reachable; a one-line plant in the live file -> DRIFT quoting it; a "
              "one-line plant in the mirror's body -> DRIFT; a blank-line-only difference -> DRIFT; a new "
              "`>` header line -> still OK; an absent live file -> exit 3 and never OK; an empty body -> "
              "exit 2. Every plant is removed before the next case."),

    dict(id="reachability-report", mode="default", expect="green", report_only=True,
         home="operator CLI (bare) + suite gate",
         cmd=["node", "scripts/reachability-report.js"],
         what="prints callerless routes, unopenable controls and displayed-only values. This check exits 0 by DESIGN - it is a report; the three assertions that can redden live in server/reachability.test.js and server/reachability-report-cli.test.js"),

    dict(id="suite", mode="default", expect="green", suite=True, cwd="server",
         home="suite gate (operator form: cd server && node --test); the movement does NOT run it",
         cmd=["node", "--test"],
         what="the server suite - the doc/tracker-invariant gates (server/design-concepts-index.test.js, server/privacy-notice.test.js) plus the check-all classifier gate"),

    dict(id="access-model", mode="default", expect="green",
         home="IN the repository (scripts/verify-access-model.py) - a PR carries it; run by this entry point and by server/access-model-instrument.test.js",
         # VERIFY_TREE=@HEAD: judge THE TREE THIS RUN NAMES, not origin/main. This is the defect
         # recorded as 9148dee9 - the headline named the tree it judged while this check judged a
         # different one, so a branch green said nothing about the branch. @HEAD is substituted at
         # run time with the full sha of the tree under judgement (see the run loop).
         cmd=[PY, ACCESS_MODEL], env={"VERIFY_TREE": "@HEAD"},
         # The "-check" figure is NOT written here. It was hand-typed as "137-check" and stayed
         # there while the instrument grew to 141, so the entry point's own description of a
         # check it runs disagreed with that check's own output. It is now read out of the
         # instrument's summary line on every run (see instrument_label below).
         what="the {checks}-check access-model instrument against docs/access-model.md, the document the product's access model is delivered in",
         count_from_instrument=True),

    dict(id="host-template-copies", mode="default", expect="green",
         home="operator CLI (bare) + this entry point; it judges a HOST folder, so it is not run by the movement",
         cmd=[PY, "scripts/check-host-template-copies.py"],
         what="owner ruling 2026-10-29: the REPOSITORY is the sole authority for served documents, and "
              "/home/team/shared/templates is retired. The folder is WALKED, not matched against a list of "
              "names: 0 files at its top level, and only its flat retired/ may hold files, each named "
              "<document>.<ext>.retired-<revision>. A copy reappearing anywhere under it is RED and is named. "
              "A folder that is missing or unreadable exits 2 (CANNOT-JUDGE) - never a green "
              "(proof: scripts/check-host-template-copies-test.sh, cases J and K). Since 2026-11-02 the bare "
              "run ALSO judges /home/team/shared/design-concepts (added 2026-11-02 after a second copy of "
              "BRAND-IDENTITY.md stood there unnoticed for six weeks): every entry there must be a POINTER "
              "or declared with its md5 in scripts/host-design-concepts-baseline.tsv, and the run prints "
              "entries / pointers / declared debt / violations"),

    # Wired in 2026-11-07. The counsel letters were the LAST live documents of this business
    # still outside the repository: each a `.md` companion and the `.txt` that actually gets sent,
    # and for the UAE letter also the cover email, the send index, the D1-D5 record and the two
    # verifiers that judge them - all in /home/team/shared, with no history and no check. Rev 237
    # queues the move; this row is what makes the move worth having, because a document nobody
    # checks drifts. WIDENED the same day (#379) from the UAE package to all FOUR: uae, ksa, pdpl
    # and access, each judged per pair with its own counts, never as one aggregate.
    #
    # NO `absent_exit` ANY MORE (2026-11-08). Until then this row declared `absent_exit=3` - the
    # same declaration workflow-mirror makes - because the appendix verifier's SUBJECT, the
    # checklist-strings document its B/K rows are quoted from, was NOT in the repository, so a
    # fresh clone had nothing for that half to judge and the row printed SKIP-FLAGGED. That
    # document (and the letter verifier that judges the SENT copy) moved into
    # counsel/uae-2026-11/ on 2026-11-08, so the row now has NO input outside the repository.
    # The declaration is therefore REMOVED, not repointed: a missing checklist-strings document
    # is now a file of the tree that is missing, which is exit 1 and RED with its name printed.
    # Leaving `absent_exit=3` in place would have turned a tree defect into a skip, which is the
    # one thing this row must never do. A missing file OF THE PACKAGE was already exit 1 and
    # RED; an argument the runner does not understand is exit 2, so nobody buys a green by
    # guessing a flag.
    dict(id="counsel-letter", mode="default", expect="green",
         home="IN the repository (counsel/ + scripts/check-counsel-letter.py) - a PR carries it; "
              "the movement does not run it",
         cmd=[PY, "scripts/check-counsel-letter.py"],
         what="the FOUR counsel letter packages are IN the repository and still say what they said when "
              "they were approved. Five assertions, each with its own counts: (1) all 9 files of the UAE "
              "package are present in counsel/uae-2026-11/ - a missing one is RED and named, never a skip; "
              "(2) EACH OF THE FOUR PAIRS is judged on its own with its counts printed PER PAIR, never as "
              "one aggregate (an aggregate hides which letter moved): a `twin` pair - uae 1681/1681 tokens, "
              "ksa 1154/1154 - must be WORD-IDENTICAL once `##`, `**` and backticks are stripped, so a "
              "one-word edit shows up as a differing region with its position; a `document+letter` pair - "
              "pdpl 2316 md / 1412 txt, access 1628/720, which were never twins - must still NAME the "
              "letter it wraps, because its `.md` is a working document containing the letter. The shapes "
              "are measured and declared with their evidence, not assumed; requiring identity of the last "
              "two would be a red no edit could clear. (3) the send index's four md5 pins still hold - a "
              "letter whose bytes move without its pin moving is RED, and the fix is to re-hash and record, "
              "never to loosen the pin. (4) Appendix B is still true of the DRAFT - every quoted B/K row is "
              "the `description` field of the line it cites in server/compliance_engine.js, the row set "
              "still covers every citation-bearing description, and the letter's two md5 pins (89b2bd58... "
              "send copy, 7bd134df... twin) still hold. (5) Appendix B is still true INSIDE the two letters "
              "- the letter verifier's 4 B rows per copy, each quote byte-identical to the source, the "
              "single question, Appendix A's 18 U rows, the 7 numbered items, the two copies agreeing - and "
              "its own `--selftest` must catch all 4 of its mutations, because an instrument that cannot "
              "redden proves nothing. Both verifiers read their claims OUT OF the documents, so a stale or "
              "hand-edited copy cannot score green. WHAT IT DOES NOT JUDGE: whether any letter is correct "
              "in law or ready to send - only that its bytes are the bytes that were approved, that the "
              "twins agree and the document+letter documents still point at their letters, and that its "
              "citations still land. `--root <dir>` judges a whole scratch copy and `--letter-dir <dir>` "
              "just the UAE package, which is how the red is reproduced without touching the tree"),

    # Added 2026-11-02, the same day the false claim it catches was corrected in three documents.
    # A DEFAULT check: it reads 161 tracked .md files and 26,866 lines in well under a second, and it
    # touches nothing but the tree.
    dict(id="domain-claims", mode="default", expect="green",
         home="operator CLI (bare) + this entry point; not run by the movement, and nothing schedules it",
         cmd=[PY, "scripts/check-domain-claims.py"],
         what="no tracked markdown may assert that Antum holds a domain. It was written for the sentence "
              "`Domains (registered & owned by Antum): antum.ae, antum.me` - false, because the business "
              "holds NO domain (both names are held by third parties and are not purchasable, and the "
              "product's domain is an open owner decision). It walks every tracked .md, matches four claim "
              "shapes, exempts a clause that DENIES ownership (so the corrected text passes), and names "
              "file:line. Print counts, not verdicts: files / lines / claims / denials / violations, and a "
              "tree with no markdown is CANNOT-JUDGE, never OK. --selftest plants the original sentence and "
              "requires it to REDDEN"),

    dict(id="served-document-renderer", mode="default", expect="green",
         home="operator CLI (bare) + this entry point; run by nothing else, which is why it is here",
         cmd=[PY, "scripts/check-served-document-renderer.py"],
         what="every module under client/src (WALKED - not a list of names) hands a served document "
              "body to the DOM only as the `content` prop of MarkdownDocument: no injection sink, no "
              "`pre`/`code` element outside the renderer, no body printed raw anywhere. The body's "
              "field name is re-derived from server/ every run, and a check that cannot see its "
              "subject is RED, not green (scripts/check-served-document-renderer.py --selftest plants "
              "the violations and requires each to redden)"),

    # Added 2026-11-03, after the live product served an UNMERGED branch's bundle for ~50 minutes
    # and nothing caught it. `client/dist` is untracked, so a build in the deployed tree publishes
    # bytes with no merge, no movement and no restart; the recorded pair for the deployed revision
    # was not on disk at all, and its URL answered 200 with the SPA shell - so every status-based
    # instrument and every source-reading check passed. This one reads what the tree SERVES: the
    # dist/index.html, the build's own record (client/dist/build-provenance.json, written by
    # client/vite.config.ts at build time), and the bytes on disk. A tree with NO record is
    # UNPROVEN and exits 1 - deliberately, because on 2026-11-02 there was no record and that is
    # exactly the state that must not read as a pass. It judges the DEPLOYED tree (WORKFLOW rule
    # 7) unless --tree names another, and it prints both sides of every comparison.
    # THE TREE IS NAMED HERE (2026-11-08). Until this line passed `--tree`, the row was invoked
    # bare, and `resolve_tree()` falls back to DEPLOYED_TREE (/home/team/shared/probable-octo-sniffle)
    # - NEVER to the cwd - so inside a branch worktree this row judged the DEPLOYED tree and read
    # PROVEN, correctly for that tree, while this run's own header said `tree judged: <branch sha>`.
    # The aggregate could not see it: the row's output named a tree, the header named another, and
    # nothing compared them. Naming ROOT (the tree THIS FILE is in, which is also every other row's
    # cwd) makes the row line and the header agree by construction, and gives the two correct
    # readings: a branch tree reddens `revision-mismatch` (its dist is the deployed build, its HEAD
    # is the branch tip - the merge + a rebuild in the deployed tree is what closes it), and the
    # deployed tree stays green.
    dict(id="served-provenance", mode="default", expect="green",
         home="operator CLI (bare) + this entry point",
         cmd=[PY, "scripts/check-served-provenance.py", "--tree", ROOT],
         what="do the bytes this tree SERVES prove where they came from? Reads dist/index.html, "
              "dist/build-provenance.json and dist/** - never source, never a status code (a missing "
              "asset answers 200 with the SPA shell). Asserts the asset index.html names is the entry "
              "the build recorded; that it and every other named asset (the CSS too) exist on disk "
              "with the recorded byte size AND md5; that index.html's own bytes are the recorded ones; "
              "that the provenance revision equals `git rev-parse HEAD` OF THE TREE BEING MEASURED (a "
              "merge without a rebuild, or --restart-only, or a build from elsewhere all land here); "
              "and that dist/assets/ holds nothing the build did not name. Prints bytes, md5 and "
              "revision for BOTH sides of each comparison. NO record = UNPROVEN = exit 1, not a skip. "
              "THE TREE IS NAMED BY THIS ENTRY POINT (`--tree` = the tree this file is in), so the row "
              "line's `tree=` and the header's `tree judged` are the same tree: a branch worktree reddens "
              "`revision-mismatch` because its dist is the deployed build and its HEAD is the branch tip - "
              "that red is the row working, and the merge + a rebuild in the deployed tree closes it"),

    dict(id="served-provenance-controls", mode="full", expect="green", home="operator CLI, off-host",
         cmd=[PY, "scripts/check-served-provenance.py", "--selftest"],
         what="the served-provenance check's own mutants, each on its own scratch tree with a real git "
              "history: (control) nothing planted must be PROVEN, exit 0 - a harness with no green "
              "control proves nothing; (a) index.html's entry renamed to a missing asset must REDDEN "
              "naming entry-mismatch - tonight's exact shape; (b) one byte flipped in the entry asset "
              "must REDDEN naming asset-drift with both sizes and md5s; (c) the provenance revision "
              "moved off HEAD must REDDEN naming revision-mismatch; (d) the record deleted must REDDEN "
              "as UNPROVEN; (e) a stray bundle in dist/assets/ must REDDEN naming it. An unknown flag "
              "exits 2 rather than buying a green run"),

    # Added 2026-11-02, after the owner was shown a BLANK page while every instrument here was
    # green. Nothing in this file loaded a rendered screen: check-all, the 404-test server suite,
    # the bundle's md5 and the API all passed, and an uptime check would have missed it too - the
    # document answers 200. This one drives a headless browser at the local process AND both public
    # hostnames and asks whether the app MOUNTED (#root has a child and non-empty text), printing
    # the document status and every same-origin script/stylesheet status it measured.
    # It is a DEFAULT check because the failure it catches is the one the owner sees. It needs the
    # network and a browser: when either is missing it exits 2, which this file prints as
    # CANNOT-JUDGE and FAILS the run - a skip that reads like a pass is the defect it answers to.
    # The `.cto.site` hostname is declared RED inside the check, per target, not here: a
    # check-level known-red would swallow a real failure of the other two targets.
    dict(id="served-render", mode="default", expect="green", absent_exit=3,
         absent_reason="the target answered the PUBLIC GATE's page instead of the product and no gate "
                       "credential could be minted here (scripts/gate-cookie.js exit 3 names the file it "
                       "looked for: ANTUM_GATE_SECRET_FILE, default /home/team/shared/.antum-gate-secret). "
                       "Nothing about the rendered product was measured - this is not an outage.",
         home="operator CLI (bare) + this entry point",
         cmd=["node", "scripts/check-served-render.js"],
         what="does the SERVED product RENDER? For each target: the document's status from the "
              "browser's own network log, the status of every same-origin script/stylesheet the "
              "document NAMES (a named asset with no request reads NO-REQUEST and fails), and "
              "whether #root mounted (>=1 child element, non-empty innerText). One line per target "
              "with the measured values, never a bare verdict; a target declared red prints RED-KNOWN "
              "and does not fail the run, and a declaration that stops firing exits 1. NO target is "
              "declared red today: the .cto.site one was withdrawn on 2026-11-02 when its stated cause "
              "- an edge refusing every Origin-bearing request - turned out to be this repository's "
              "own CORS middleware, fixed in server/index.js. GATE-AWARE since 2026-11-08: the run "
              "mints a credential through scripts/gate-cookie.js and sends it to each target's origin, "
              "because server/public-gate.js answers a cookieless fetch with the gate page - a 200 "
              "that names no asset, which would read RED for a reason that is not a defect. A target "
              "that IS the gate page with no credential to get past it prints REFUSED and exits 3 "
              "(SKIP-FLAGGED here), never a pass and never an outage. Drives agent-browser headless "
              "with a per-target timeout, so a browser that will not start fails instead of hanging"),

    dict(id="served-render-controls", mode="full", expect="green", home="operator CLI, off-host",
         cmd=["node", "scripts/check-served-render.js", "--selftest"],
         what="the served-render check's own controls: three planted pages on a throwaway "
              "127.0.0.1 server driven through the SAME code path as a real target - one that mounts "
              "from a 200 script (must be GREEN with 2 assets and 1 child), one whose script answers "
              "403 (must REDDEN naming that asset and the 0 children), and one whose 200 script "
              "mounts nothing (must REDDEN on #root's child count, so the mount assertion is "
              "load-bearing and not just the asset one). An unknown flag exits 2 - a plausible "
              "invocation must never buy a green run"),

    # Added 2026-11-08. The plan's rule - "an empty result and a refusal must never render the same" -
    # had no instrument, and on the deployed tree `f4729f3` the Pre-boarding screen rendered
    # `0 / CASES OPEN` and "nothing outstanding to show for this jurisdiction" over three open AE cases
    # for the `demo` account, whose two routes the policy gate refuses. It reads SOURCE (client/src/App.tsx)
    # and asserts, per declared panel, that the empty state sits inside a branch selected by
    # `emptyArea(panelReading.<panel>)`, that the refusal sentence has a place on the screen, and
    # that the reading comes from a `callPanel('<panel>', ...)` record. A screen that decides "empty" from
    # the length of a list reddens here, and so does a reworded empty state the check can no longer see
    # (RED, never a silent skip). It does NOT judge what a browser paints: the rendered proof for this
    # change is a DOM transcript pair on scratch rigs, and the semantics are asserted by panelReading.test.js.
    # The declared set is printed every run, so an unjudged screen is stated rather than implied.
    dict(id="refusal-not-empty", mode="default", expect="green",
         home="operator CLI (bare) + this entry point",
         cmd=["node", "scripts/check-refusal-not-empty.js"],
         what="every declared client panel renders its EMPTY state only when its read was not refused and "
              "not failed, renders its refusal sentence on the screen, and takes its reading from a "
              "panel record. Green means the SHAPE of the screen holds - not that a browser paints it, and "
              "not that the refusal itself is correct (server/access.js decides that, and "
              "server/panel-reading-copy.test.js asserts the copy names the roles its cell allows)"),

    dict(id="refusal-not-empty-controls", mode="default", expect="green",
         home="operator CLI (bare) + this entry point",
         cmd=["node", "scripts/check-refusal-not-empty.js", "--selftest"],
         what="the refusal-not-empty check's own controls: six plants in a scratch copy of THIS tree's "
              "App.tsx, each required to redden - the empty state losing its gate (the pre-fix shape), the "
              "refusal sentence deleted, the reading taken from a bare fetch, and the empty-state text "
              "reworded under the gate, and the Strategic Intelligence banner losing its gate - plus the "
              "unplanted copy required to stay GREEN, so the plants are "
              "measured against a copy that passes"),

    # Added 2026-11-10 with the cap itself. The guard hook appends a line or two to server/guard-hook.log on
    # every shell command and nothing bounded it: the file stood at 11.6 MB on a /home that was 75% full.
    # The hook now rotates it at a fixed size, and this check drives the REAL hook (sourced the way
    # /etc/profile.d sources it) into a scratch tree - never the deployed one - and requires the cap to
    # hold, the kept copy to be bounded, the rotation body to contain no loop, and the cap to be
    # LOAD-BEARING: a copy with the rotation call removed must exceed the cap under the same notes, so the
    # green cannot come from a log that nothing wrote.
    dict(id="guard-hook-log-cap", mode="default", expect="green",
         home="operator CLI (bare) + this entry point",
         cmd=["bash", "scripts/guard-hook-log-cap-test.sh"],
         what="the guard hook's own log cap, driven through the real hook in a scratch tree: below the cap "
              "nothing rotates; at the cap the log becomes guard-hook.log.1 and BOTH files stay bounded; a "
              "200000 B log is trimmed to the cap by one note; the rotation function's own body holds no "
              "while/until/for and no recursion (the structural half of 'cannot spin'); 12 notes at a 1 B "
              "cap each finish inside a 10 s timeout and the log still ends bounded; and the mutant with the "
              "rotation call removed reaches 1296 B at a 512 B cap, so every bound here is measured against "
              "a hook that fails it"),

    # Added 2026-10-29 (owner said yes to the counsel-string guard). It is a DEFAULT check
    # because it is cheap and reads nothing but a scratch instance of this tree: measured at
    # 1.65 s, own port, throwaway database, throwaway user - and it boots a rig of THIS tree, so
    # it judges the working tree rather than a commit. Its green says the served legal text has
    # not moved since the revision the manifest names; it never says anyone read it.
    dict(id="counsel-strings", mode="default", expect="green",
         home="operator CLI (bare) + this entry point",
         cmd=[PY, "scripts/check-counsel-strings.py"],
         what="every legal string this product SERVES - the documents the templates route hands over, "
              "the notice as published, the lawful-basis rows the pre-boarding checklist serves, and the "
              "generated statutory task checklist - still matches its recorded hash. A CHANGED unit is RED "
              "unless the manifest was updated with a note in the same commit. Hashes come from the HTTP "
              "responses, never from a source file. Print counts, not verdicts: the run names its own blind "
              "spot and refuses any manifest that claims a counsel review"),

    dict(id="counsel-strings-controls", mode="full", expect="green", home="operator CLI, off-host",
         cmd=["bash", "scripts/counsel-strings-test.sh"],
         what="the counsel-string guard's own controls, each on a scratch COPY of this tree: a CHROME string "
              "moves and the guard stays GREEN (scope control); one served LEGAL sentence moves and the guard "
              "REDDENS naming the unit (change control); the same edit marked in the manifest reads GREEN with "
              "the unit printed as MARKED and still `unreviewed`; a manifest claiming a review is REFUSED; and "
              "an unknown flag exits 2 rather than buying a green run"),

    dict(id="cors-error-contract", mode="full", expect="green", absent_exit=3,
         home="operator CLI, off-host",
         absent_reason="the rig could not mint a gate credential (scripts/gate-cookie.js exit 3), so "
                       "nothing was measured - the CORS contract is unjudged, not green",
         cmd=["bash", "scripts/cors-error-contract-test.sh"],
         what="the CORS + error-handling contract of server/index.js, booted off-host on its own port "
              "with a throwaway database AND a gate of its own (throwaway passcode hash and signing key). "
              "GATE-AWARE since 2026-11-08: every ASSET fetch carries a cookie minted by "
              "scripts/gate-cookie.js - without it a 200 would be the gate page, which is why the row now "
              "also asserts the cookieless asset IS the gate page and that the cooked asset's BYTES are "
              "the built bundle. Every /api fetch deliberately sends NO cookie: /api is passed straight "
              "through to the app, so test 1's 403 for a foreign Origin is the assertion that the gate "
              "does not answer /api before the CORS middleware - the exact defect the first cut had"),

    dict(id="guard-deploy-marker", mode="full", expect="green", home="operator CLI, off-host",
         cmd=["bash", "scripts/guard-deploy-marker-test.sh"],
         what="the deploy marker behaves as claimed, on a scratch tree with a STUB guard - never the live one"),

    dict(id="install-host-tools", mode="full", expect="green", home="operator CLI, off-host",
         cmd=["bash", "scripts/install-host-tools-test.sh"],
         what="the host-tooling installer does what it claims, entirely off the host"),

    dict(id="deploy-main-gate", mode="full", expect="green", home="operator CLI, off-host",
         cmd=["bash", "scripts/deploy-main-gate-test.sh"],
         what="the movement's GATE DECISION and PRODUCT ASSERTION, driven through the real functions "
              "extracted from scripts/deploy-main.sh against throwaway trees in /tmp, each served by a "
              "rig built from that tree's OWN server/public-gate.js. Asserts (a) an ungated tree needs "
              "no credential and the product assertion runs, (b) a gated tree with its credential files "
              "mints a cookie and the served document names the built entry with bytes md5-identical to "
              "disk, (c) THE 2026-11-08 MUTATION — a gated tree judged with no cookie — FAILS and names "
              "what it could not prove, while the OLD bare status/title row is reproduced beside it "
              "reading `200 <title>Antum People — access</title>`, and (d) a supplied ANTUM_MEASURED_* "
              "record that disagrees prints AFTER-STATE MOVED naming both sides without failing the "
              "run. Never opens, creates or prints the host's gate credential"),

    dict(id="gate-rotate", mode="full", expect="green", home="operator CLI, off-host",
         cmd=["bash", "scripts/gate-rotate-test.sh"],
         what="the ONE-COMMAND GATE ROTATION, driven through the real functions extracted from "
              "scripts/gate-rotate.sh against a real HTTP rig that mounts the tree's OWN "
              "server/public-gate.js and reads its credential files at BOOT. Asserts (c) the full "
              "rotation: the pre-rotation cookie is REFUSED, a cookie minted from the new key works "
              "byte-for-byte, the new passcode opens the gate and the old one does not, the "
              "rendered-screen row holds, and the guard row holds by the LOCK's holder; (a) THE "
              "MUTATION THAT MATTERS — rotate the passcode only, signing key unchanged — the "
              "revocation row FAILS and the run says THE ROTATION REVOKED NOBODY; (b) both files "
              "rotated with NO RESTART — the running server still honours the old cookie, so the row "
              "fails again; (d) a deliberate row failure puts the OLD pair back and the old cookie "
              "works again, measured; (e) with no old plaintext on the host the old-passcode row is "
              "SKIP-FLAGGED and the run returns 3, never 0. Also asserts the passcode never reaches "
              "argv and no credential reaches a log. Never reads, creates or prints the host's gate "
              "credential"),

    dict(id="keep-alive-deploypath", mode="full", expect="green", home="operator CLI, off-host",
         cmd=["bash", "scripts/keep-alive-deploypath-test.sh"],
         what="keep-alive.sh's BOTH arming paths - the regression the hardened loop of 2026-10-06 needed"),

    dict(id="guard-rebuild-path", mode="full", expect="green", home="operator CLI, off-host",
         cmd=["bash", "scripts/guard-rebuild-path-test.sh"],
         what="the GUARD CANNOT BUILD IN THE DEPLOYED TREE (rule 43). The unit that replaced "
              "rebuild_client() is extracted whole from scripts/keep-alive.sh and driven against a "
              "scratch deployed tree: with a bundle present it does nothing, and with the bundle gone "
              "it REFUSES - naming the tree, the exact npm ci && npm run build it would have run and "
              "the sanctioned path (deploy-main.sh) - while client/dist stays byte-identical (md5) and "
              "mtime-identical. Mutations that must redden: (a) the OLD implementation extracted from "
              "this repository's own history, (b) a rebuild in a scratch tree COPIED into the deployed "
              "tree with no merge, (d) a refusal that is silent. Control: the fixed path, plus an "
              "END-TO-END run of the real loop against a real scratch tree on its own port that "
              "restores a kill -9ed listener in under 60 s with client/dist untouched, and with no "
              "bundle on disk refuses, still restores, builds nothing and never invokes npm"),

    dict(id="guard-install-path", mode="full", expect="green", absent_exit=3,
         home="operator CLI, off-host",
         cmd=["bash", "scripts/guard-install-path-test.sh"],
         what="the GUARD CANNOT INSTALL IN THE DEPLOYED TREE (rule 43's sibling, #391's follow-up). The "
              "unit that replaced start_server()'s `with_timeout 600 npm install` is extracted whole from "
              "scripts/keep-alive.sh, and a scanner that strips comments and quoted strings requires ZERO "
              "executable npm invocations in that script - with anti-vacuity controls (a planted line, and "
              "the pre-fix script from this repository's own history, which it must FIND). The real "
              "start_server is driven against a scratch deployed tree: with server/node_modules present the "
              "product STARTS and node_modules is byte-identical; with it absent start_server REFUSES - "
              "naming the tree, the exact install it would have run, WORKFLOW rule 43 and the sanctioned "
              "path (deploy-main.sh, plus the one-off `npm ci` a fresh host needs by hand) - and npm is "
              "never invoked. Mutations that must redden: (a) the OLD start_server extracted from history "
              "installs node_modules INTO the deployed tree, (b) an install in a scratch dir copied in, "
              "(c) a refusal that is silent, (d) the scanner against the pre-fix script. Control plus an "
              "END-TO-END run of the real loop against a real scratch worktree on its own port: a kill -9ed "
              "listener is restored in under 60 s with client/dist and node_modules untouched and npm never "
              "invoked, and with node_modules moved aside the loop REFUSES in its own log, installs "
              "nothing, keeps holding its lock, and restores the listener once the dependencies are back. "
              "exit 3 = SKIP-FLAGGED (the end-to-end half could not run), never a pass"),

    dict(id="observe-serve-pair", mode="full", expect="green", home="operator CLI, off-host",
         cmd=["bash", "scripts/observe-serve-pair-test.sh"],
         what="the public-URL observer does what it claims, off-host, without touching the live tree"),

    # Wired in 2026-10-20 on the lead's ruling. It spawns two decoy processes in the shape of the
    # 2026-10-20 keep-alive.log entries and needs a LIVE armed guard (its lock) to be the true-positive
    # control, so it is a host instrument, not a tree check - hence --full. Exit 2 prints as
    # CANNOT-JUDGE and FAILS the run (deliberately): when the rig cannot judge - same bytes on both
    # sides, an OLD that already carries the fix, or no live loop to control against - saying so beats
    # a green nobody measured. It never signals the guard.
    dict(id="guard-role-vs-shape", mode="full", expect="green", home="operator CLI, on a host with an armed guard",
         cmd=["bash", "scripts/guard-role-vs-shape-test.sh"],
         what="the duplicate-guard check judges a process's ROLE (argv position: interpreter + non-flag first arg) not the SHAPE of a string that merely names keep-alive.sh. Compares the recorded pre-fix revision (2b14a94) against this tree, holds two decoys in the log's own shape, and requires both sides to count the live loop. exit 2 = CANNOT-JUDGE; it never signals, starts or stops a guard"),

    dict(id="host-template-copies-proof", mode="full", expect="green", home="operator CLI, off-host",
         cmd=["bash", "scripts/check-host-template-copies-test.sh"],
         what="drives the retired-folder guard against a scratch copy of the folder (never the host one) and "
              "requires each plant to REDDEN on its own path: a copy at the top level, a copy in a nested "
              "directory, a name no list names, a second copy with the .retired- suffix in the middle, a "
              "nested directory inside the quarantine, and a symlink. It requires the quarantine's 3 files "
              "to stay green in EVERY red run, a missing folder and a file-instead-of-folder to exit 2, the "
              "fixture and the live host folder to be byte-identical afterwards, and the clean run's counts "
              "(2 directories, 3 entries, 0 top-level, 3 quarantined, 0 violations) to be printed - a green "
              "with a zero count is the defect it asserts against"),

    # Wired in 2026-11-10. The notice was SERVED as v2.4 while the pilot pack's own HTML still said
    # "Version 2.2" and its PDF was dated 2026-09-18: every status instrument was green and a client
    # would have been handed a notice two versions behind the product. The trio list is read out of
    # templates/build-html.js's own document table, so a document added there is judged without this
    # entry changing; the PDF half reads the printed header back out of the bytes (the header is
    # letter-spaced and "fi" is a ligature, so it compares compacted text). A PDF the instrument cannot
    # read is exit 2 (CANNOT-JUDGE), never a pass. `--selftest` plants each disagreement in a scratch
    # copy - the HTML alone stale, the .md moved under its derivatives, the real pre-fix PDF from this
    # repository's own history, and an unreadable PDF - and requires each to be reported on its own file.
    # 2026-11-11: the PDF half also judges THE FACE ITS ARABIC IS PRINTED IN. All three PDFs embedded
    # DejaVuSans and nothing else while the builder's Noto Naskh @font-face was never requested, so a
    # client-facing document printed its Arabic in a fallback face and nothing went red. The declared
    # face is read out of build-html.js (family + the file the @font-face points at); a document whose
    # HTML carries Arabic must have that face embedded in its PDF. A builder with no @font-face at all is
    # a FAILURE, not a skip - the instrument would be comparing against a face nobody declares.
    dict(id="template-derivatives", mode="default", expect="green",
         home="operator CLI (bare)",
         cmd=["node", "scripts/check-template-derivatives.js"],
         what="every pilot-pack derivative (HTML and PDF) carries the version and the date of the Markdown "
              "it is built from, and prints its Arabic in the face the builder declares. Per document: the "
              ".md's own \"**Version ...**\" line; the HTML's builder-written meta line (Version <v> &middot; "
              "<date>) and footer (v<v>); the PDF's printed header, read back out of the bytes with ligatures "
              "expanded and spacing removed; and the PDF's embedded font list, which must carry the @font-face "
              "family declared by templates/build-html.js whenever the document's HTML carries Arabic. exit 2 = "
              "CANNOT-JUDGE when a PDF yields no readable text at all"),
]

SKIPS = [
    dict(id="cutover-preflight", home="movement preflight - THE HOST, and ONLY the host",
         why=("its preconditions are HOST state (dependency links in the live tree, the port, the armed guard), not the tree. "
              "Run in a scratch tree it CORRECTLY reports FAIL - measured: exit 1, 'PREFLIGHT FAIL - 3 precondition(s) do not "
              "hold' - so a red here would say nothing about the tree. DELIBERATELY not wired in: see the header."),
         run="bash scripts/cutover-preflight.sh    (on the host, before a movement)"),
    dict(id="success-test", home="operator CLI, LIVE-facing",
         why="it judges WHAT IS SERVING, not the tree: the cutover's four success tests against the public URL. Not a tree check.",
         run="bash scripts/success-test.sh LABEL    (or this entry point with --live LABEL)"),
]

ACTORS = [
    ("scripts/deploy-main.sh", "moves the live product to origin/main: fetch, build, re-seed, restart"),
    ("scripts/keep-alive.sh", "the self-healing loop: starts/kills/restarts the product"),
    ("scripts/restore-product.sh", "restart-only recovery (a name for deploy-main.sh --restart-only)"),
    ("scripts/rollback-to-9d2182a.sh", "reverts the host to the pre-cutover commit"),
    ("scripts/install-host-tools.sh", "installs the operator tooling into /home/team/shared"),
    ("scripts/antum-product-guard-hook.sh", "the login-shell hook re-arming the guard (/etc/profile.d/zz-antum-product-guard.sh)"),
    ("scripts/antum-arm-guard.sh", "one command after a machine replacement: installs the login-shell hook from the tree and starts the guard (idempotent; never builds, seeds or stops anything)"),
    ("scripts/seed-demo.js", "rewrites the demo database (the labelled sample data every figure is read from)"),
    ("scripts/observe-serve-pair.sh", "probes the LIVE public URL; its off-host proof is scripts/observe-serve-pair-test.sh, listed above"),
]

# ------------------------------------------------------------------------------- the run

def git(*args):
    return subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True).stdout.strip()

def instrument_label(what, out):
    """A count the instrument owns, taken from the instrument - never typed here.

    The instrument's last line is `NNN/NNN checks hold against <sha> (ran=N, ...)`. Any `{checks}`
    placeholder in a registry entry's `what` is filled from it. If that line is absent the
    placeholder is left VISIBLE - a reader sees `the {checks}-check ...` rather than a number
    nobody measured - and the run is already red or CANNOT-JUDGE in that case, since no summary
    means the instrument did not reach a verdict.
    """
    if "{checks}" not in what:
        return what
    m = re.search(r"^(\d+)/(\d+) checks hold", out, re.M)
    return what.replace("{checks}", m.group(2)) if m else what


def tail_lines(text, n=TAIL_LINES):
    """The bounded, decisive end of a check's own output. A red check's LAST line is often
    `FAIL: see the lists above` - true, and useless to a reader. The list that names what
    went wrong is above it, so a red check shows a tail and says how much it is showing."""
    lines = [l.rstrip() for l in text.splitlines() if l.strip()]
    return lines[-n:], max(0, len(lines) - n)

def main(argv):
    flags = set(a for a in argv[1:] if a.startswith("--"))
    want_full = "--full" in flags
    want_suite = "--no-suite" not in flags
    only = None
    if "--only" in argv:
        i = argv.index("--only")
        only = argv[i + 1] if len(argv) > i + 1 else ""
    live_label = None
    if "--live" in argv:
        i = argv.index("--live")
        live_label = argv[i + 1] if len(argv) > i + 1 else "unlabelled"

    if "--selftest" in flags:
        print("check-all classifier self-test (nothing else run)")
        return selftest()

    tree = git("rev-parse", "--short", "HEAD") or "UNKNOWN"
    # the FULL sha of the same tree, handed to any check that judges a revision, so the check and
    # the headline cannot name different trees (9148dee9)
    tree_full = git("rev-parse", "HEAD") or "origin/main"
    # Untracked paths are reported separately from modified ones: the rig's own dependency
    # link (server/node_modules) is untracked BY DESIGN and must not make every run claim
    # the tree's bytes moved. A tracked modification is the signal that matters.
    porcelain = [l for l in git("status", "--porcelain").splitlines() if l.strip()]
    modified = [l for l in porcelain if not l.startswith("??")]
    untracked = [l for l in porcelain if l.startswith("??")]
    if modified:
        treeline = "%s (DIRTY: %d tracked path(s) modified - NOT the commit's bytes)" % (tree, len(modified))
    else:
        treeline = "%s (no tracked modification%s)" % (
            tree, "" if not untracked else "; %d untracked path(s), e.g. the rig's node_modules link" % len(untracked))
    print("=" * 100)
    print("check-all - every check the team owns, one entry point")
    print("  tree judged   : %s" % treeline)
    print("  repository    : %s" % ROOT)
    print("  NOT run by    : the movement. scripts/cutover-preflight.sh runs no checker (grep, this run's evidence).")
    print("                  Wiring a check into the movement is the lead's ruling to make, not this script's.")
    if only:
        ids = [c["id"] for c in CHECKS if c["id"] == only]
        if not ids:
            print("  --only %r names no check. Known: %s" % (only, ", ".join(c["id"] for c in CHECKS)))
            return 2
        print("  PARTIAL RUN   : --only %s - ONE check of %d. The verdict below covers THIS check alone." % (only, len(CHECKS)))
    print("=" * 100)

    rows = []
    for c in CHECKS:
        if only and c["id"] != only:
            continue
        cwd = os.path.join(ROOT, c.get("cwd", ""))
        if c.get("external") and not os.path.isfile(c["cmd"][-1]):
            rows.append((c, "SKIP-NOT-ON-HOST", None, ["not on this host: %s - an instrument outside the repository "
                                                       "cannot ride a PR or a movement" % c["cmd"][-1]], 0.0, 0))
            continue
        if c.get("suite"):
            if not want_suite:
                rows.append((c, "SKIP-FLAGGED", None, ["skipped by --no-suite"], 0.0, 0))
                continue
            if not os.path.isdir(os.path.join(ROOT, "server", "node_modules")):
                rows.append((c, "RIG-INCOMPLETE", None,
                             ["server/node_modules is ABSENT: without it this tree reads 187/35/185/2 (two LOAD failures, "
                              "84 tests never run) - a rig report, not a tree report.",
                              "Fix: ln -s /home/team/shared/probable-octo-sniffle/server/node_modules server/node_modules"],
                             0.0, 0))
                continue
        if c["mode"] == "full" and not want_full and not only:
            rows.append((c, "SKIP-FLAGGED", None, ["off-host instrument proof - run it with --full"], 0.0, 0))
            continue

        t0 = time.time()
        out = ""
        try:
            env = None
            if c.get("env"):
                env = dict(os.environ)
                for _k, _v in c["env"].items():
                    env[_k] = tree_full if _v == "@HEAD" else _v
            p = subprocess.run(c["cmd"], cwd=cwd, capture_output=True, text=True, env=env,
                               timeout=1800 if c.get("suite") else 600)
            code = p.returncode
            out = p.stdout + "\n" + p.stderr
        except subprocess.TimeoutExpired:
            code, out = 124, "TIMED OUT"
        dt = time.time() - t0
        word = classify_check(c, code)
        if c.get("suite") and code is not None:
            # Read the TAP totals out of the suite's own report. Do NOT take the last `# `
            # line: node's ExperimentalWarning about SQLite also opens with `# ` and sits in
            # the same stream - measured, and it made the summary read as the warning.
            totals = [m.groups() for m in
                      (re.match(r"^# (tests|suites|pass|fail) (\d+)\s*$", ln) for ln in out.splitlines()) if m]
            if totals:
                out = "server suite: " + ", ".join("%s %s" % (k, v) for k, v in totals)
        if c.get("count_from_instrument"):
            c = dict(c, what=instrument_label(c["what"], out))
        shown, hidden = tail_lines(out, 1 if word in ("OK", "RED-KNOWN") else TAIL_LINES)
        rows.append((c, word, code, shown, dt, hidden))

    if live_label is not None:
        # GATE-AWARE 2026-11-08: the script exits 3 when the URL answered the PUBLIC GATE's page and
        # no gate credential could be minted (scripts/gate-cookie.js names the file it looked for).
        # Declared here so that code prints SKIP-FLAGGED - never OK, and never BROKEN-EXIT-3, which
        # would call a gated product a broken tree. This row is built inline, so it must call
        # classify_check() rather than classify(): a declaration classify() cannot see is no
        # declaration at all, and the row would have gone red on exit 3.
        c = dict(id="success-test", expect="green", absent_exit=3,
                 absent_reason="the public URL answered the PUBLIC GATE's page and no gate credential "
                               "could be minted here (scripts/gate-cookie.js exit 3 names the file it "
                               "looked for: ANTUM_GATE_SECRET_FILE, default "
                               "/home/team/shared/.antum-gate-secret). TEST 1 - the served page, the "
                               "asset it names and the served==deployed bytes - was NOT judged; "
                               "TESTs 2-4 and SURVIVAL were. Not an outage.",
                 home="operator CLI, LIVE-facing",
                 cmd=["bash", "scripts/success-test.sh", live_label],
                 what="the cutover's four success tests against whatever is public right now")
        t0 = time.time()
        p = subprocess.run(c["cmd"], cwd=ROOT, capture_output=True, text=True, timeout=600)
        shown, hidden = tail_lines(p.stdout + "\n" + p.stderr, TAIL_LINES)
        rows.append((c, classify_check(c, p.returncode), p.returncode, shown, time.time() - t0, hidden))

    # --------------------------------------------------------------------- print per check
    for c, word, code, shown, dt, hidden in rows:
        print()
        print("[%-13s] %-24s %s   exit=%s   %.1fs" % (word, c["id"], "tree=" + tree,
                                                      "-" if code is None else code, dt))
        print("                 home : %s" % c["home"])
        print("                 what : %s" % c.get("what", ""))
        for i, ln in enumerate(shown):
            print("                 %s : %s" % ("said" if i == 0 else "    ", ln[:170]))
        if hidden:
            print("                 ...  : %d earlier line(s) not shown - full output: %s"
                  % (hidden, " ".join(c["cmd"])))
        if word == "RED-KNOWN":
            print("                 WHY THIS IS NOT A REGRESSION: the tree is in a RECORDED DEFECT STATE - %s"
                  % c.get("known_reason", ""))
            print("                 recorded at : %s" % c.get("known_pointer", ""))
            print("                 ends when   : %s" % c.get("known_ends_when", ""))
        if word == "RIG-INCOMPLETE":
            print("                 THIS RIG CANNOT JUDGE IT (see the two lines above)")
        if word == "SKIP-FLAGGED" and c.get("absent_reason"):
            print("                 NOT JUDGED  : %s" % c["absent_reason"])
            print("                 counted as  : SKIPPED, never run - this row is not a pass")

    if not only:
        print()
        print("-" * 100)
        print("checks NOT run by default, each with its reason and its own command (nothing is omitted quietly):")
        for s in SKIPS:
            print("  [skip] %-20s home: %s" % (s["id"], s["home"]))
            print("         why : %s" % s["why"])
            print("         run : %s" % s["run"])
        for c in CHECKS:
            if c["mode"] == "full" and not want_full:
                print("  [skip] %-20s home: %s - off-host instrument proof, run with --full: %s"
                      % (c["id"], c["home"], " ".join(c["cmd"])))
        print("  [skip] %-20s home: operator CLI, LIVE-facing - run with --live LABEL: bash scripts/success-test.sh LABEL"
              % "success-test")

        print()
        print("ACTORS listed, never run (they change the host, the live product or the demo data - not checks):")
        for path, why in ACTORS:
            print("  [actor] %-36s %s" % (path, why))

    print()
    print("-" * 100)
    counts = {}
    for (c, word, code, shown, dt, hidden) in rows:
        counts[word] = counts.get(word, 0) + 1
    run = sum(v for k, v in counts.items() if not k.startswith("SKIP"))
    print("totals: %d check(s) run, %d skipped%s" % (run, len(rows) - run, "   [PARTIAL: --only %s]" % only if only else ""))
    for k in ("OK", "RED-KNOWN", "BROKEN", "CANNOT-JUDGE", "STALE-EXCEPTION", "RIG-INCOMPLETE",
              "SKIP-FLAGGED", "SKIP-NOT-ON-HOST"):
        if counts.get(k):
            print("        %-16s %d" % (k, counts[k]))
    for k in sorted(counts):
        if k.startswith("BROKEN-EXIT"):
            print("        %-16s %d" % (k, counts[k]))

    failing = [c["id"] for (c, word, code, shown, dt, hidden) in rows if fails_run(word)]
    known = [c["id"] for (c, word, code, shown, dt, hidden) in rows if word == "RED-KNOWN"]
    print()
    if failing:
        print("VERDICT: %d check(s) RED and NOT in a declared state -> %s" % (len(failing), ", ".join(failing)))
        print("         this is the BROKEN case: nothing declares this state. exit 1")
        return 1
    if known:
        print("VERDICT: no check is unexpectedly red. %d check(s) are red in a state that is RECORDED as the "
              "defect state (%s) -" % (len(known), ", ".join(known)))
        print("         their lines above name where that is recorded and what ends it. exit 0")
        return 0
    print("VERDICT: every check that can be green on this tree is green. exit 0")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
