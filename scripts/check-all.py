#!/usr/bin/env python3
"""
ONE operator-facing entry point for every check the team owns.

    python3 scripts/check-all.py                  # the default set: fast, read-only, tree-scoped
    python3 scripts/check-all.py --full           # + the five off-host instrument proofs
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
             ("CANNOT-JUDGE", True), ("STALE-EXCEPTION", True), ("RIG-INCOMPLETE", True)]
    total = len(cases) + len(words)
    bad = 0
    for expect, code, want in cases:
        got = classify(expect, code)
        if got != want:
            bad += 1
        print("  %s  classify(%-9s, exit=%-4s) -> %s" % ("ok " if got == want else "BAD", expect, code, got))
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
              "(proof: scripts/check-host-template-copies-test.sh, cases J and K)"),

    dict(id="served-document-renderer", mode="default", expect="green",
         home="operator CLI (bare) + this entry point; run by nothing else, which is why it is here",
         cmd=[PY, "scripts/check-served-document-renderer.py"],
         what="every module under client/src (WALKED - not a list of names) hands a served document "
              "body to the DOM only as the `content` prop of MarkdownDocument: no injection sink, no "
              "`pre`/`code` element outside the renderer, no body printed raw anywhere. The body's "
              "field name is re-derived from server/ every run, and a check that cannot see its "
              "subject is RED, not green (scripts/check-served-document-renderer.py --selftest plants "
              "the violations and requires each to redden)"),

    dict(id="cors-error-contract", mode="full", expect="green", home="operator CLI, off-host",
         cmd=["bash", "scripts/cors-error-contract-test.sh"],
         what="the CORS + error-handling contract of server/index.js, booted off-host on its own port with a throwaway database"),

    dict(id="guard-deploy-marker", mode="full", expect="green", home="operator CLI, off-host",
         cmd=["bash", "scripts/guard-deploy-marker-test.sh"],
         what="the deploy marker behaves as claimed, on a scratch tree with a STUB guard - never the live one"),

    dict(id="install-host-tools", mode="full", expect="green", home="operator CLI, off-host",
         cmd=["bash", "scripts/install-host-tools-test.sh"],
         what="the host-tooling installer does what it claims, entirely off the host"),

    dict(id="keep-alive-deploypath", mode="full", expect="green", home="operator CLI, off-host",
         cmd=["bash", "scripts/keep-alive-deploypath-test.sh"],
         what="keep-alive.sh's BOTH arming paths - the regression the hardened loop of 2026-10-06 needed"),

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
        word = classify(c["expect"], code)
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
        c = dict(id="success-test", expect="green", home="operator CLI, LIVE-facing",
                 cmd=["bash", "scripts/success-test.sh", live_label],
                 what="the cutover's four success tests against whatever is public right now")
        t0 = time.time()
        p = subprocess.run(c["cmd"], cwd=ROOT, capture_output=True, text=True, timeout=600)
        shown, hidden = tail_lines(p.stdout + "\n" + p.stderr, TAIL_LINES)
        rows.append((c, classify("green", p.returncode), p.returncode, shown, time.time() - t0, hidden))

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
