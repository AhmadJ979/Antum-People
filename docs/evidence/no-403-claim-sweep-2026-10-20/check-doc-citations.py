#!/usr/bin/env python3
"""Fail when an `App.tsx:<n>` citation in design-concepts/ does not land on what it names.
    python3 check-doc-citations.py [<doc-rev> [<code-rev>]]     (code-rev defaults to doc-rev)
THE BARE FORM (added 2026-10-20). With no argument it judges HEAD of the repository that
CONTAINS THIS FILE: the repository is found from this file's own location, so the working
directory does not matter. As merged, the bare form raised
`IndexError: list index out of range` on `sys.argv[1]` - reachable only by a reader who
already knew a revision to pass, which is what made it, in the plan's words, an instrument
the operator cannot reach. The run now names the tree it judged, because implying one is
the defect the naming exists to prevent. The file's PATH did not move: four other files
cite this one where it sits, and moving an instrument to tidy it would rename evidence.
EXIT CODES - three, and no report for the third (the convention #266 set for an instrument
whose invocability is part of the measurement):
    0  judged: every citation group that names a symbol landed on one of its numbers
    1  judged: at least one group did not land (the FAIL lines say which, and where)
    2  REFUSED - NOTHING WAS CHECKED. No git working tree, a revision that does not
       resolve, or `design-concepts/` listing no `.md` at that revision. Without this the
       run would print `0 ok, 0 FAILING` over an empty file list and read as a clean:
       a copy of this script outside a git tree gets 2, never 0.
BOTH REFUSALS WERE EARNED BY MEASUREMENT, not anticipated. The first cut of this fix ran
git with `-C <this file's own directory>`, and `git ls-tree <rev> design-concepts` reads
its pathspec RELATIVE TO THAT DIRECTORY - so from inside docs/evidence/... it matched
nothing and the check printed `0 ok, 0 FAILING, 0 unchecked`, exit 0, on a tree whose
citations it had just failed to read. A green computed over an empty list is not a
measurement. git therefore runs `-C <repository root>`, and an empty document list is
itself a refusal. (docs/evidence/one-entry-point-2026-10-20/runs.txt, section 2.)
The expectation is read OUT OF THE DOCUMENT being judged, not kept in a table here: for each citation
group, the backticked SYMBOLS on the citing line are what it claims, and the group passes if at least
one of its numbers lands on a line containing one of them. A group whose numbers all point somewhere
else is printed and the check exits 1. Groups that name no symbol are reported as UNCHECKED - the
checker can only judge a citation that names something; it does not guess.
THE REVISION PIN (added 2026-10-29, PR following #338). A dated reading is not a stale
citation, and the documents say so themselves: `LAYER2-PREBOARDING-UI.md` has carried the
rule "a pinned-revision cite is not a defect; an unpinned one is" since 2026-10-14, while
this instrument judged every number at the tip and consequently reddened on readings that
were correct at the revision they named. The marker is now readable:

    `@rev <sha>`     7-40 hex, appearing BEFORE the numbers it governs on the same line

A marker governs every citation number that follows it on that line, up to the next
marker; a number with no marker before it is judged at the code revision of the run (the
tip by default, or the second argument). So one line can carry readings from several
trees, and a number that is judged at the tip can follow a pinned run only if it comes
FIRST. A marker at the end of a line governs nothing - it is reported as UNUSED rather
than passed over. A marker that does not resolve to a commit, or that names a revision
where `client/src/App.tsx` does not exist, is a REFUSAL (exit 2): a pin is a claim about a
tree, and a claim the instrument cannot read is not a green.
The pin does NOT make a group judgeable: a group with no symbol is UNCHECKED whether or
not it is pinned. What the pin changes is WHICH TREE the symbol is looked for in.

THE CONTINUATION PASS (added 2026-11-03). A citation whose `App.tsx` is on one line and
whose numbers are on the next used to match no literal and was neither judged nor counted:
INVISIBLE, which is worse than unknown. It is now found and reported. Each such line gets
ONE of four verdicts, always with its file:line:

    CONTINUATION   the one file governing it is App.tsx -> REPORTED, not judged by default
    OTHER-FILE     the document names a different file there -> said, not judged here
    UNCHECKED      the citing line names several files, or none -> cannot attribute
    ok / FAIL      only with --judge-continuations (see the block below for why that is
                   opt-in: the symbol test misreads wrapped citations, measured)

THE `.html` TARGET (added 2026-11-08). `design-concepts/` holds three prototypes, and the
documents cite lines in them. The file-name pattern carried no `.html`, so
`design-concepts/intelligence-dashboard-prototype.html` was not a file to this instrument:
the walk for "the nearest file named above this number" went PAST it, to an `App.tsx`
mention 12 lines earlier, and attributed the prototype's numbers to the client - a wrong
answer stated with confidence, which is worse than the refusal. The `.html` name was
harvested as a SYMBOL as well, so a citation could be judged against a file name.
A number whose block names exactly one `.html` file is now attributed to that file, read at
the revision governing the number (the `@rev` pin before it, else the run's code revision -
the rule the pin already applies to `App.tsx`), and judged by the same symbol test:

    ok          a symbol on the citing line appears on one of the cited lines
    FAIL        none does - or a number is PAST THE END of that file at that revision
    UNCHECKED   the citing line names no symbol - counted and printed, never passed over

A number past the end is FAILING and not UNCHECKED: the line does not exist, so nothing can
be checked there, and silence is how a stale pointer survives. A `.html` target that is not
in the tree at the governing revision is a REFUSAL (exit 2), for the pin's reason - a
citation into a file the tree does not hold is a claim this instrument cannot read.
The symbol filter also admits a bare call site (`toArabic()`), measured: the old filter
asked for one of `= {}<>-_"'`, so the identifier that proves this prototype's numeral
citations was the one token dropped and the group was judged on the prose around it.
STILL NOT JUDGED, and said rather than implied: a prototype number written in prose
("(line 290)") is not a number this instrument sees - `:N` is its syntax.

FOUR NUMBERS, ALWAYS PRINTED, so a change in the set cannot pass quietly:

    citations found: <discovered>  = judged + not-judged + other-file
    continuation:    <lines> carrying <numbers>
    floor:           <the recorded census>       (SHRANK + exit 1 if discovered falls below)

FLAGS. `--floor N` re-records the census deliberately; `--ignore-floor` measures an old
branch; `--judge-continuations` prints the stronger, noisier reading of wrapped citations.
Positional <doc-rev> [<code-rev>] are read AFTER the flags are stripped, so a flag value
can never be taken for a revision.
"""
import os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
def _git(cwd, *args):
    return subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True)
repo = _git(HERE, "rev-parse", "--show-toplevel").stdout.strip()
def git(*args):
    # -C <repo ROOT>, never -C <this file's directory>: a pathspec passed to ls-tree is
    # read relative to the directory git is told to work in, and this file lives four
    # levels down inside docs/evidence/.
    return _git(repo or HERE, *args)
# FLAGS ARE STRIPPED BEFORE THE POSITIONAL ARGUMENTS ARE READ, so that `--floor 200` cannot
# be mistaken for a revision and silently judge a tree nobody named.
_argv = list(sys.argv[1:])
FLOOR_IGNORED = False
if "--ignore-floor" in _argv:
    FLOOR_IGNORED = True
    _argv.remove("--ignore-floor")
JUDGE_CONT = False
if "--judge-continuations" in _argv:
    JUDGE_CONT = True
    _argv.remove("--judge-continuations")
FLOOR_OVERRIDE = None
if "--floor" in _argv:
    _k = _argv.index("--floor")
    try:
        FLOOR_OVERRIDE = int(_argv[_k + 1])
    except (IndexError, ValueError):
        print("REFUSED: nothing was checked - --floor needs an integer.")
        sys.exit(2)
    del _argv[_k:_k + 2]
doc_rev = _argv[0] if len(_argv) > 0 else git("rev-parse", "HEAD").stdout.strip()
code_rev = _argv[1] if len(_argv) > 1 else doc_rev
if not repo or not doc_rev or git("rev-parse", "--verify", doc_rev + "^{commit}").returncode != 0:
    print("REFUSED: nothing was checked - repo=%s rev=%s does not resolve."
          % (repo or "(no git working tree above this file)", doc_rev or "(no revision given)"))
    print("  run it in a git working tree with no argument, or name one:")
    print("    python3 check-doc-citations.py [<doc-rev> [<code-rev>]]")
    sys.exit(2)
tree = git("rev-parse", "--short", "HEAD").stdout.strip() or "UNKNOWN"
def show(rev, path):
    return git("show", f"{rev}:{path}").stdout
APP_TSX = "client/src/App.tsx"
_lines_cache = {}
def lines_at(rev, path=APP_TSX):
    """The lines of `path` at `rev`, cached. One cache for every target: until 2026-11-08
    the instrument judged exactly one file, and a `.html` prototype is now judged too."""
    key = (rev, path)
    if key not in _lines_cache:
        _lines_cache[key] = show(rev, path).split("\n")
    return _lines_cache[key]
def code_at(rev):
    return lines_at(rev, APP_TSX)
def nlines(rev, path):
    """How many lines `path` really has at `rev`. `show()` returns text ending in a newline,
    so `split("\\n")` leaves a trailing "" - and a message that says "329 line(s)" about a
    328-line file is a number a reader can catch with `wc -l`."""
    n = len(lines_at(rev, path))
    return n - 1 if n and lines_at(rev, path)[-1] == "" else n
code = code_at(code_rev)
files = [f for f in git("ls-tree", "-r", "--name-only", doc_rev, "design-concepts").stdout.split("\n")
         if f.endswith(".md")]
if not files:
    print("REFUSED: nothing was checked - `git ls-tree %s design-concepts` listed no .md file."
          % doc_rev[:12])
    print("  (this file is run with -C <repo root> %s; a wrong -C matches no pathspec and would"
          % repo)
    print("   otherwise report `0 ok, 0 FAILING` as a clean)")
    sys.exit(2)
print("tree %s - doc %s vs code %s - %d document(s)"
      % (tree, doc_rev[:12], code_rev[:12], len(files)))
CALL_SITE = re.compile(r"^[A-Za-z_][A-Za-z0-9_.]*\(\)$")
INLINE_CITE = re.compile(r"^[\w./-]*\.html[:\uff1a]\d+$")
def symbol(t):
    if not t or "App.tsx" in t: return False
    if re.match(r"^@rev [0-9a-f]{7,40}$", t): return False   # a pin MARKER is instrument syntax, not a symbol
    if re.match(r"^[:：]?[\d,]+$", t): return False
    if re.match(r"^[0-9a-f]{7,40}$", t): return False
    if t.endswith((".md", ".tsx", ".js", ".json", ".css", ".sql", ".html")): return False
    if INLINE_CITE.match(t): return False   # `foo.html:313` is a CITATION, not a symbol
    if CALL_SITE.match(t): return True   # `toArabic()` names code - see the header's html section
    return any(c in t for c in "= {}<>-_\"'")
PIN = re.compile(r"@rev ([0-9a-f]{7,40})")
def pin_at(line, pos):
    """The revision governing a citation number at character offset `pos`: the last pin
    marker before it on the line, else the run's code revision."""
    rev = code_rev
    for m in PIN.finditer(line):
        if m.start() < pos: rev = m.group(1)
    return rev
def pin_unused(line):
    """A marker no number follows on this line governs nothing - say so, do not pass over."""
    last = None
    for m in PIN.finditer(line):
        last = m
    return last is not None and not re.search(r"[:\uff1a]\d+", line[last.end():])
bad_pins = []
for sha in sorted({m.group(1) for f in files for m in PIN.finditer(show(doc_rev, f))}):
    if git("rev-parse", "--verify", sha + "^{commit}").returncode != 0:
        bad_pins.append((sha, "does not resolve to a commit"))
    elif not show(sha, "client/src/App.tsx").strip():
        bad_pins.append((sha, "has no client/src/App.tsx"))
if bad_pins:
    print("REFUSED: nothing was checked - a revision pin cannot be read:")
    for sha, why in bad_pins:
        print("  @rev %-12s %s" % (sha, why))
    print("  A pin is a claim about a tree; a claim this instrument cannot read is not a green.")
    sys.exit(2)
# --- THE CONTINUATION BLIND SPOT, CLOSED 2026-11-03 -----------------------------------
# The loop below used to open `if "App.tsx" not in l: continue`. A citation that WRAPS -
# the `App.tsx` on one line and the numbers on the next - therefore matched no literal and
# was neither judged nor counted as unchecked. It was INVISIBLE, which is worse than
# unknown: 14 such numbers on 9 continuation lines sat in these documents while the run
# printed a clean 75 ok / 0 FAILING / 8 unchecked. A citation the instrument cannot judge
# may be reported as unjudged; it may not be silent.
#
# A NUMBER ALONE DOES NOT SAY WHICH FILE IT NUMBERS. These documents cite several files,
# and a bare `:` number belongs to whichever file the document itself names: on
# CLIENT-STATES.md:115 a bare `:138` is `httpStatus.js`, and on :318 `:213` is
# `LAYER3-EMPLOYEE-OWN-VIEW.md`. Attributing every bare number to App.tsx would INVENT
# citations, and an invented citation is the same defect class as an invented figure. So
# each continuation number is resolved the way a reader resolves it - from the file named
# on its own line, else on the nearest preceding line of the same block - and it is judged
# ONLY when exactly one file governs it and that file is App.tsx.
#
# WHY THEY ARE REPORTED RATHER THAN JUDGED BY DEFAULT. The instrument's judgement is "at
# least one backticked symbol on the citing line appears on one of the cited lines". That
# test is calibrated for a citation whose number and symbol were written together. Applied
# to wrapped citations it harvests prose and globs instead of code: measured on these
# documents at 754031c it produced 13 "failures", of which 8 named a description
# (`· the notice has not been shown for this document yet`), a glob (`border-r-*`) or a
# fragment (`)}`) that no line could ever contain. Five of the 13 look like genuine
# staleness - documents that name their tree in PROSE ("measured on `f46b7a9`") instead of
# with an `@rev` marker, which the pin path cannot honour. Reddening the gate on eight
# wrong symbols to report five right ones would make the gate wrong. So the default is to
# NAME them: file:line, the numbers, the line the `App.tsx` actually sits on, and the
# reason. `--judge-continuations` prints that stronger, noisier reading on demand.
#
# CITATION_FLOOR. A count that can shrink quietly is the same blindness one level up. The
# number of citation groups discovered is compared against a recorded floor; if a document
# is edited and citations disappear, the run says SHRANK and exits 1 rather than printing a
# smaller clean set. The floor is a claim about the DOCUMENTS, so it is counted before the
# `1 <= n <= len(App.tsx)` range filter and cannot move when App.tsx grows or shrinks.
# Re-census deliberately with `--floor N`; `--ignore-floor` is for measuring an old branch.
CITATION_FLOOR = 287
CITATION_FLOOR_AT = "754031c (the documents; this PR changes none of them)"
if FLOOR_OVERRIDE is not None:
    CITATION_FLOOR = FLOOR_OVERRIDE

# `.html` joined this pattern on 2026-11-08. A name the pattern does not match is not a file
# to `governing()`, which then walks PAST it and attributes the number to an older mention.
FILE_REF = re.compile(r"(?<![\w./-])([\w][\w./-]*\.(?:tsx|jsx|js|json|css|md|sql|py|html))\b")
CONT_REASON = ("reported, not judged: the symbol test is calibrated for a citation whose "
               "number and symbol share a line, and on wrapped ones it names prose or a glob "
               "instead of code (see --judge-continuations)")
def pin_on(line):
    """The last `@rev` marker on a line, or None."""
    last = None
    for m in PIN.finditer(line):
        last = m.group(1)
    return last
def files_named(line):
    """The file names a line refers to, as basenames, in order, de-duplicated."""
    out = []
    for m in FILE_REF.finditer(line):
        b = os.path.basename(m.group(1))
        if b not in out:
            out.append(b)
    return out
HTML_EXT = (".html",)
def is_html(name):
    return name.lower().endswith(HTML_EXT)
_target_cache = {}
def target_path(rev, name):
    """The repository path a document's file name points at, at `rev` - or None.

    A document writes the name as a reader would (`design-concepts/foo.html`, or a bare
    `foo.html`), so the name as written and its basename under design-concepts/ are both
    tried. `git cat-file -e` is the existence test because `git show` answers "" for BOTH an
    absent path and an empty file, and judging a citation against an empty file is the
    silent pass this instrument exists to refuse."""
    key = (rev, name)
    if key not in _target_cache:
        b = os.path.basename(name.lstrip("./"))
        found = None
        for cand in dict.fromkeys([name.lstrip("./"), "design-concepts/" + b]):
            if cand and git("cat-file", "-e", "%s:%s" % (rev, cand)).returncode == 0:
                found = cand
                break
        _target_cache[key] = found
    return _target_cache[key]
def governing(lines, i):
    """The file(s) a bare `:n` on line i belongs to: named on the line itself, else on the
    nearest preceding line of the same block (a blank line ends the block)."""
    own = files_named(lines[i])
    if own:
        return own, i
    j = i - 1
    while j >= 0 and lines[j].strip() != "":
        f = files_named(lines[j])
        if f:
            return f, j
        j -= 1
    return [], None
def hits(tok, line):
    ids = re.findall(r"[A-Za-z_][A-Za-z0-9_.-]{4,}", tok)
    return any(x in line for x in ids) if ids else (tok in line)
def group_tokens(lines, i, span=2):
    """The backticked SYMBOLS a citation group claims.

    A same-line citation keeps the 2-line window this instrument has always used, because
    its `App.tsx:n` and its symbol are often on adjacent lines. A CONTINUATION citation is
    read on its OWN line: the evidence for a wrapped citation is the line that states the
    number, and taking the next line instead picks up the symbol of a different list item.
    A weaker subject gets a narrower rule, never a looser one."""
    win = " ".join(lines[i:i + span])
    toks = [t.strip() for t in re.findall(r"`([^`]+)`", win)]
    return [t for t in toks if symbol(t)][:12]

# --- THE `.html` TARGET, CHECKED BEFORE ANYTHING IS JUDGED ---------------------------
# A citation into a prototype is judged against that file at its governing revision. If the
# file is not in the tree there, nothing below can judge the number, and a run that said
# nothing about it would read as a pass - so it REFUSES, exactly as a pin naming a revision
# with no App.tsx does. Measured on the documents at b4bed5b: 2 groups, 3 numbers, all of
# them in a prototype that is in the tree, so this refusal is the fail-closed branch.
html_need = {}
for f in files:
    _dl = show(doc_rev, f).split("\n")
    for i, l in enumerate(_dl):
        if not re.search(r"`[:\uff1a]\d+`", l):
            continue
        _gov, _gi = governing(_dl, i)
        if len(_gov) != 1 or not is_html(_gov[0]):
            continue
        _inherit = pin_on(_dl[_gi]) or code_rev
        for m in re.finditer(r"`[:\uff1a](\d+)`", l):
            _rev = pin_at(l, m.start()) if pin_on(l) else _inherit
            html_need.setdefault((_rev, _gov[0]), []).append("%s:%d" % (f, i + 1))
bad_targets = [(rev, name, where) for (rev, name), where in sorted(html_need.items())
               if target_path(rev, name) is None]
if bad_targets:
    print("REFUSED: nothing was checked - a citation names a .html file that is not in the tree:")
    for rev, name, where in bad_targets:
        print("  %s at %s (cited from %s)"
              % (name, rev[:12], ", ".join(sorted(set(where))[:3])))
    print("  A citation into a file the tree does not hold cannot be judged; it is not a skip.")
    sys.exit(2)

ok = fail = unchecked = pinned = unused = other = 0
unch_plain = unch_cont = unch_html = cont_groups = cont_nums = 0
html_groups = html_nums = html_ok = html_fail = html_unchecked = html_past = 0
for f in files:
    lines = show(doc_rev, f).split("\n")
    for i, l in enumerate(lines):
        has_app = "App.tsx" in l
        nums = [(int(m.group(1)), pin_at(l, m.start()))
                for m in re.finditer(r"App\.tsx[:\uff1a](\d+)", l)]
        nums += [(int(m.group(1)), pin_at(l, m.start()))
                 for m in re.finditer(r"`[:\uff1a](\d+)`", l)]
        # `name.html:290` written INLINE is the same citation as a bare `:290` below a line
        # naming the file, and until 2026-11-08 it was a number this instrument did not see
        # at all (the bare form's regex requires a backtick immediately before the colon).
        inline_html = [(os.path.basename(m.group(1)), int(m.group(2)), m.start())
                       for m in re.finditer(r"([\w][\w./-]*\.html)[:\uff1a](\d+)", l)]
        gi = None
        gov_note = ""
        if has_app:
            kind = "app"
            if not nums:
                continue
        else:
            nums += [(n, r) for _, n, r in inline_html]
            if not nums:
                continue
            gov, gi = governing(lines, i)
            if not gov:
                kind = "unattributed"
                gov_note = "no file is named on this line or before it in the block"
            elif len(gov) > 1:
                kind = "ambiguous"
                gov_note = ("line %d names %d files (%s), so a bare `:` number here cannot be "
                            "attributed to one of them" % (gi + 1, len(gov), ", ".join(gov)))
            elif is_html(gov[0]):
                # A `.html` prototype: these numbers are that file's, at the revision
                # governing them - a pin before the number, else the pin on the line that
                # names the file, else the run's code revision.
                kind = "html"
                target = gov[0]
                inherit = pin_on(lines[gi]) or code_rev
                nums = [(int(m.group(1)),
                         pin_at(l, m.start()) if pin_on(l) else inherit)
                        for m in re.finditer(r"`[:\uff1a](\d+)`", l)]
                nums += [(n, pin_at(l, off) if pin_on(l) else inherit)
                         for _, n, off in inline_html]
                gov_note = "the file named at line %d is %s" % (gi + 1, target)
            elif gov[0] != "App.tsx":
                kind = "other"
                gov_note = "the file named at line %d is %s, not App.tsx" % (gi + 1, gov[0])
            else:
                kind = "cont"
                inherit = pin_on(lines[gi]) or code_rev
                nums = [(int(m.group(1)),
                         pin_at(l, m.start()) if pin_on(l) else inherit)
                        for m in re.finditer(r"`[:\uff1a](\d+)`", l)]
                gov_note = "the `App.tsx` is on line %d, not this one" % (gi + 1)
        if kind != "app":
            cont_groups += 1
            cont_nums += len(nums)
        if kind == "html":
            html_groups += 1
            html_nums += len(nums)
            # NOT filtered by range: a number past the end of the prototype is a FAILING
            # (below), not a number to drop. The port exclusion stays where it was needed.
        else:
            # a bare `:5173` (a port) or a wrapped time is not a citation - the same exclusion
            # as before, now applied to continuation numbers too.
            nums = [(n, r) for n, r in nums if 1 <= n <= len(code_at(r))]
        if not nums:
            continue
        if pin_unused(l):
            unused += 1
            print(f"UNUSED-PIN {f}:{i+1} - a `@rev` marker with no citation number after it on this line")
        shown = [n for n, _ in nums]
        if kind == "other":
            other += 1
            print(f"OTHER-FILE {f}:{i+1} :{shown} - NOT judged here: {gov_note}")
            continue
        if kind in ("unattributed", "ambiguous"):
            unchecked += 1
            unch_plain += 1
            print(f"UNCHECKED {f}:{i+1} :{shown} - cannot attribute this number to App.tsx: {gov_note}")
            continue
        if kind == "cont" and not JUDGE_CONT:
            unchecked += 1
            unch_cont += 1
            print(f"CONTINUATION {f}:{i+1} App.tsx:{shown} - {gov_note}. {CONT_REASON}")
            continue
        if kind == "html":
            toks = group_tokens(lines, i, span=1)
            paths = {r: target_path(r, target) for _, r in nums}
            past = [(n, r) for n, r in nums if n > nlines(r, paths[r])]
            if past:
                fail += 1
                html_fail += 1
                html_past += len(past)
                n0, r0 = past[0]
                print(f"FAIL      {f}:{i+1} {target}:{shown} - :{n0} is past the end of "
                      f"{paths[r0]} at {r0[:12]} ({nlines(r0, paths[r0])} line(s)): "
                      f"a citation to a line that does not exist cannot land"
                      + (f"  [{gov_note}]" if gov_note else ""))
                continue
            if any(r != code_rev for _, r in nums):
                pinned += 1
            if not toks:
                unchecked += 1
                unch_html += 1
                html_unchecked += 1
                print(f"UNCHECKED {f}:{i+1} {target}:{shown} - the citing line names no symbol"
                      + (f" ({gov_note})" if gov_note else ""))
                continue
            landed = [n for n, r in nums
                      if any(hits(t, lines_at(r, paths[r])[n-1]) for t in toks)]
            if landed:
                ok += 1
                html_ok += 1
                print(f"ok        {f}:{i+1} {target}:{shown} -> landed {landed}"
                      + (f"  [{gov_note}]" if gov_note else ""))
            else:
                fail += 1
                html_fail += 1
                n0, r0 = nums[0]
                print(f"FAIL      {f}:{i+1} {target}:{shown} expects one of {toks[:4]} - :{n0} "
                      f"at {r0[:12]} is {lines_at(r0, paths[r0])[n0-1].strip()[:70]!r}"
                      + (f"  [{gov_note}]" if gov_note else ""))
            continue
        toks = group_tokens(lines, i, span=1 if kind == "cont" else 2)
        if not toks:
            unchecked += 1
            if kind == "cont":
                unch_cont += 1
            else:
                unch_plain += 1
            print(f"UNCHECKED {f}:{i+1} App.tsx:{shown} - the citing line names no symbol"
                  + (f" ({gov_note})" if gov_note else ""))
            continue
        if any(r != code_rev for _, r in nums):
            pinned += 1
        landed = [n for n, r in nums if any(hits(t, code_at(r)[n-1]) for t in toks)]
        if landed:
            ok += 1
            print(f"ok        {f}:{i+1} App.tsx:{shown} -> landed {landed}"
                  + (f"  [{gov_note}]" if gov_note else ""))
        else:
            fail += 1
            n0, r0 = nums[0]
            found = code_at(r0)[n0-1].strip()[:70] if 0 < n0 <= len(code_at(r0)) else "<past EOF>"
            print(f"FAIL      {f}:{i+1} App.tsx:{shown} expects one of {toks[:4]} - :{n0} at "
                  f"{r0[:12]} is {found!r}"
                  + (f"  [{gov_note}]" if gov_note else ""))
judged = ok + fail
discovered = judged + unchecked + other
print(f"\ndoc {doc_rev[:12]} vs code {code_rev[:12]}: {ok} ok, {fail} FAILING, {unchecked} unchecked"
      f", {pinned} pinned, {unused} unused pin   [tree {tree}]")
print(f"citations found: {discovered} group(s) - {judged} judged ({ok} ok, {fail} FAILING), "
      f"{unchecked} NOT judged ({unch_plain} with an unattributable or missing file, {unch_cont} wrapped-but-unjudged), "
      f"{other} OTHER-FILE (a bare `:` number whose document names another file)")
print(f"continuation:   {cont_groups} citing line(s) carry {cont_nums} number(s) with no `App.tsx` "
      f"on the line - the class this instrument used to skip IN SILENCE"
      + ("   [--judge-continuations: they WERE judged]" if JUDGE_CONT else ""))
print(f"html targets:   {html_groups} group(s) carry {html_nums} number(s) attributed to a .html "
      f"file at its governing revision - {html_ok + html_fail} judged ({html_ok} ok, "
      f"{html_fail} FAILING), {html_unchecked} unchecked (no symbol on the citing line), "
      f"{html_past} past the file's end")
print(f"floor:          {CITATION_FLOOR} group(s) discovered, recorded at {CITATION_FLOOR_AT}"
      + ("   [OVERRIDDEN by --floor]" if FLOOR_OVERRIDE is not None else ""))

shrank = (discovered < CITATION_FLOOR) and not FLOOR_IGNORED
if shrank:
    print(f"\nSHRANK: {discovered} citation group(s) discovered, below the recorded floor of "
          f"{CITATION_FLOOR} (recorded at {CITATION_FLOOR_AT}).")
    print("  A smaller set is not a cleaner one. Either a document lost citations - which is a")
    print("  finding, not a tidy-up - or the census needs moving deliberately:")
    print(f"    python3 {os.path.basename(__file__)} --floor {discovered}   (re-record the floor)")
sys.exit(1 if (fail or shrank) else 0)
