#!/usr/bin/env python3
"""Fail when a citation into ANOTHER document does not land where the citing sentence says.

    python3 scripts/check-cross-doc-citations.py               # judge HEAD
    python3 scripts/check-cross-doc-citations.py <rev>         # judge a named revision
    python3 scripts/check-cross-doc-citations.py --explain     # print what anchored every OK too
    python3 scripts/check-cross-doc-citations.py --roots a/b,c # judge other markdown trees
    python3 scripts/check-cross-doc-citations.py --selftest    # prove it reddens (plants, a green
                                                               # control, four non-findings, the
                                                               # anti-vacuous control and a real
                                                               # pre-existing tree)

WHY IT EXISTS. Two gates already read `:N` citations and NEITHER can judge a citation into another
document - a property of each one's own rule, not an oversight anyone can close there:

  * `docs/evidence/no-403-claim-sweep-2026-10-20/check-doc-citations.py` marks a citation whose
    document names a different file `OTHER-FILE` and declines to judge it: its question ("does this
    number land on a line carrying the symbol the citing line names?") is asked of
    `client/src/App.tsx`, and it has no second document to ask it of.
  * `scripts/check-doc-citation-ranges.py` asks only whether a range ASCENDS.

So `design-concepts/CLIENT-STATES.md` cited `LAYER3-IDENTITY.md` and `LAYER3-EMPLOYEE-OWN-VIEW.md`
by line number, wrongly, through every green run of both. This instrument judges that one class.

WHAT IT JUDGES, AND HOW. A citation is `SOMEDOC.md:<n>` - or `:<n>`-`:<m>`, `:n-m`, or a `:n,m`
list - where SOMEDOC is not the document doing the citing. Most of these citations already QUOTE the
target's words in the same sentence, and that quotation is the anchor: not a pin, not a recorded
number.

  1. Take the CITING SENTENCE - the block around the citation (a table row is its own block,
     otherwise the run of non-blank lines), then the sentence of that block containing the
     citation. Collect every quotation in it: a backticked span carrying prose (a space, a letter,
     12+ characters, no code punctuation, not a path or a `*.md` name), and a straight-or-curly
     double-quoted span. Nearest to the citation first.
  2. Locate the fragment in the TARGET document at the same revision, on text normalised
     identically on both sides (case-folded, whitespace collapsed, curly quotes and en/em dashes
     unified, `*` and backticks dropped so markdown emphasis cannot break a match). A fragment
     that wraps lines in the target still matches, because the match runs over the whole document
     and is then mapped back to line numbers.
  3. Require the cited line - or the cited range - to INTERSECT the lines the fragment actually
     occupies.

  OK             a quotation of the target lands on the cited line(s).
  DRIFT          a quotation of the target exists, but on different lines  -> RED, naming the
                 citing file:line, the cited span, the quotation, and the span the words are on.
  OUT-OF-BOUNDS  a cited number is past the target's last line           -> RED, always, whether
                 or not the sentence quotes anything (the separate, cheap check).
  UNJUDGEABLE    the sentence quotes nothing; or nothing it quotes occurs anywhere in the target;
                 or the target is not a document in this tree at this revision; or a bare name
                 resolves to more than one document. Counted and NAMED with its reason - never
                 silently passed, exactly as the sibling gate reports its `unchecked` count.
  same-document  `CLIENT-STATES.md:12` inside CLIENT-STATES.md is not a cross-document citation;
                 check-doc-citations.py owns that shape and this gate stays out of it.

WHAT IT DELIBERATELY DOES NOT FLAG - each of these is a plant in `--selftest`:

    a section number   `LAYER3-IDENTITY.md` §4 carries no `:N` and is not a citation.
    a code fence       `:n` inside a fenced block is prose about syntax, not a pointer.
    a same-document    see above.
    a clock time       `05:06:55` - a line reference's colon is never preceded by a digit, a
                       clock's always is.

WHAT IT CANNOT JUDGE - stated here so nobody reads a green run as "the pointers are correct":
a citation whose sentence quotes NOTHING is UNJUDGEABLE, and an ASCENDING citation that lands on
the wrong line with no quotation to anchor it is still not this instrument's question. The
quotation is the whole anchor, so a wrong line whose citation happens to quote a phrase that also
occurs on the cited line reads green here. Matching is case-folded and whitespace-collapsed, which
is what lets a quote a citing document opened mid-sentence ("*\"an empty state never shows a red...")
match the target's own capitalised "An empty state..."; the same leniency means a case-only
difference is not a defect. Measured on the tree this was written against: of 122 cross-document
citations, 14 are anchored and judged, 106 are UNJUDGEABLE and 2 are DRIFT - so this gate's reach is
as wide as the documents' habit of quoting, and no wider. The two other gates keep their own
questions, and a green from this one is a green about landing by quotation only.

WHICH TREE IT JUDGES, AND WHICH DOCUMENTS. Documents are read from a GIT REVISION
(`git show <rev>:<path>`), never from the working tree, so an uncommitted edit cannot make the run
green - and the revision is printed in the verdict, because a count must name its tree. The
repository is found from this file's own location, so the working directory does not matter.
The CITED documents judged are the `.md` files under `--roots` - default `design-concepts` (the
live design documents) plus the repository root (the live compliance and tracker documents). Every
OTHER tree that carries the same shape is ENUMERATED in the report with its count and left unjudged,
so the choice is visible rather than assumed: `docs/evidence/**` are DATED RECORDS of past
measurements, which the one-authoritative-copy rule forbids rewriting to track a live document, and
`templates/**` are served legal text judged by the counsel-string guard instead.

A BARE NAME IS RESOLVED BY SEARCH; A PATH IS NOT. `BRAND-IDENTITY.md` is a name a reader expects to
be found wherever it lives. `home/team/shared/templates/x.md:144` is a PATH: when it is not in the
tree the citation points at something this tree does not contain, and it is UNJUDGEABLE. Falling
back to a basename search there would judge the citation against a DIFFERENT copy of the document
and invent a drift - measured on this tree, that turned `roadmap-board-index.md`'s deliberate
contrast between the repository copy (`:142`) and the retired host copy (`:144`) into a red.

EXIT CODES - three, following `check-doc-citation-ranges.py` (the convention #266 set for an
instrument whose invocability is part of the measurement):
    0  judged: every quotation-anchored citation lands, and no citation is out of bounds
    1  judged: at least one DRIFT or OUT-OF-BOUNDS (each names file:line)
    2  REFUSED - NOTHING WAS CHECKED. No git working tree above this file, a revision that does
       not resolve, a root that lists no `.md` at that revision, or a tree on which the scan found
       NO cross-document citation at all. That last one is the anti-vacuous control: a scan that
       matches nothing would otherwise print `0 DRIFT` and read as a clean, and a green computed
       over an empty list is not a measurement. It fails the run (check-all prints CANNOT-JUDGE).

--selftest plants into a scratch clone and requires the CLONE'S OWN COPY of this file to judge them
(the instrument finds its repository from the location of its own file, so the source's copy would
judge the source tree, where no plant exists - the exact mistake `doc-citation-pin-selftest.py`
documents having made). It requires:

    S0  the baseline is GREEN and sees citations at all (not vacuous)
    S1  a stale citation REDDENS, naming file:line, both spans and the tree
    S2  the SAME citation quoting the line it cites stays GREEN - the green control, without which
        a gate that reddens on everything would pass S1
    S3  a number past the target's EOF REDDENS as OUT-OF-BOUNDS, with no quotation at all
    S4  the four non-findings leave the count unchanged and the run green
    S5  a root with no cross-document citation REFUSES at exit 2 - reachable from the operator's
        own command line, because a control the operator cannot reach is a false green
    S6  the real tree `0e401cf` REDDENS, so the proof is not confined to a plant this file invented

Every plant is committed before it is judged - a plant that is not committed is invisible to a
git-reading instrument - and every run is checked against the clone's own HEAD through the verdict
line's `[tree ...]` marker.
"""
import bisect
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SELF = os.path.basename(__file__)
DEFAULT_ROOTS = ("design-concepts", ".")

# ------------------------------------------------------------------------------------ the shapes

# A cross-document citation: a `.md` document name (optionally with directories), then a bounded run
# of section refs / backticks / brackets / spaces, then `:N` with an optional second end. The
# `(?<![\d:])` before the colon is what separates a line reference from the `:55` in `05:06:55` -
# a clock's colon is always preceded by a digit, a line reference's never is.
CITE = re.compile(
    r"(?P<path>(?:[A-Za-z0-9_.\-]+/)*[A-Za-z0-9_.\-]+\.md)"
    r"(?P<mid>(?:`|\s|\u00a7[0-9.]*|[()\[\],;]|\band\b|\bto\b|\u2013|\u2014|-){0,40}?)"
    r"(?<![\d:]):(?P<a>\d{1,5})(?!\d)"
    r"(?P<rng>[ \t]*`?[ \t]*[\u2013\u2014-][ \t]*`?:?(?P<b>\d{1,5})(?!\d))?"
    # a `:n,m` list continues the same document
    r"(?P<more>(?:[ \t]*,[ \t]*`?:?\d{1,5}(?!\d))*)"
)

# Characters that make a backticked span CODE rather than prose: a call, a literal, a path, an
# operator. Measured on this tree - without this filter `input.actor || 'system'` reads as a
# quotation of whichever document the citation names, and a perfectly correct citation whose block
# happens to quote the product's own strings turns red. A backticked span is a quotation of the
# TARGET only when it is ordinary prose; anything else is not an anchor at all.
CODEISH = set("(){}[]=|<>\";/@#$%&~*\\")

BACKTICK = re.compile(r"`([^`\n]{1,400})`")

DQUOTE = re.compile(r"[\"\u201c]([^\"\u201c\u201d]{12,400})[\"\u201d]")
FENCE = re.compile(r"^\s*(?:```|~~~)")

DASHES = {"\u2013": "-", "\u2014": "-", "\u2212": "-"}
QUOTES = {"\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"'}


def git(cwd, *args):
    return subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True)


def repo_of(path):
    return git(path, "rev-parse", "--show-toplevel").stdout.strip()


def short(cwd, rev):
    return git(cwd, "rev-parse", "--short", rev).stdout.strip() or rev


def norm(text):
    """The one normalisation, applied identically to a fragment and to a target document."""
    out = []
    for ch in text:
        out.append(DASHES.get(ch, QUOTES.get(ch, ch)))
    s = "".join(out)
    s = s.replace("*", "").replace("`", "")
    s = re.sub(r"\s+", " ", s)
    return s.strip().lower()


class Target(object):
    """A target document at a revision: raw lines, and its normalised text with a line map."""

    def __init__(self, path, text):
        self.path = path
        self.lines = text.split("\n")
        self.nlines = len(self.lines)
        starts, parts = [], []
        pos = 0
        for line in self.lines:
            starts.append(pos)
            nl = norm(line)
            parts.append(nl)
            pos += len(nl) + 1
        self.starts = starts
        self.text = " ".join(parts)

    def line_at(self, offset):
        i = bisect.bisect_right(self.starts, offset) - 1
        return min(max(i, 0), self.nlines - 1) + 1

    def span_of(self, fragment):
        """Every (first_line, last_line) the fragment occupies, or [] when it is absent."""
        needle = norm(fragment)
        if len(needle) < 8:
            return []
        spans, at = [], 0
        while True:
            i = self.text.find(needle, at)
            if i < 0:
                return spans
            spans.append((self.line_at(i), self.line_at(i + len(needle) - 1)))
            at = i + 1


def sentence_span(block, at):
    """The sentence of `block` that contains offset `at`.

    The brief's anchor is the CITING SENTENCE's own quotation, not any quotation that happens to
    sit in the same paragraph. Measured on this tree: widening to the paragraph makes a bullet that
    quotes the PRODUCT's own strings ("Arabic first", "verified is final") anchor a citation into a
    compliance document on a phrase that document happens to contain elsewhere - a true verdict
    for the wrong reason, which is worse than no verdict.
    """
    starts = [0] + [m.end() for m in re.finditer(r"(?<=[.!?])\s+", block)]
    ends = [m.end() for m in re.finditer(r"[.!?](?=\s|$)", block)] or [len(block)]
    s = max([x for x in starts if x <= at], default=0)
    e = min([x for x in ends if x >= at], default=len(block))
    return s, max(e, at + 1)


def quoted_fragments(block):
    """Prose quotations in a citing block, with their offset in the block: backticks, then `"..."`."""
    found = []
    for m in BACKTICK.finditer(block):
        q = m.group(1).strip()
        if len(q) < 12 or " " not in q or not re.search(r"[A-Za-z]", q):
            continue
        if q.endswith(".md") or set(q) & CODEISH:
            continue
        found.append((m.start(), q, "backticked"))
    for m in DQUOTE.finditer(block):
        q = m.group(1).strip()
        if "\n\n" in q or len(norm(q)) < 12:
            continue
        found.append((m.start(), q, "quoted"))
    found.sort()
    return found


def anchor(fragment):
    """The part of a fragment that is worth matching: an ellipsis splits it, longest piece wins."""
    pieces = [p for p in re.split(r"\u2026|\.\.\.", fragment) if norm(p)]
    if not pieces:
        return fragment
    return max(pieces, key=lambda p: len(norm(p)))


def blocks_of(text):
    """(first_line, last_line, text) for every blank-line-separated block, 1-based inclusive."""
    out, start, buf = [], None, []
    for i, line in enumerate(text.split("\n"), 1):
        if line.strip():
            if start is None:
                start = i
            buf.append(line)
        else:
            if start is not None:
                out.append((start, i - 1, "\n".join(buf)))
                start, buf = None, []
    if start is not None:
        out.append((start, len(text.split("\n")), "\n".join(buf)))
    return out


def block_for(blocks, lineno):
    for first, last, body in blocks:
        if first <= lineno <= last:
            return first, last, body
    return lineno, lineno, ""


# ------------------------------------------------------------------------------------- the scan

def list_docs(repo, rev, root):
    if root in (".", "", "/"):
        listing = git(repo, "ls-tree", "--name-only", rev).stdout.split("\n")
        return sorted(f for f in listing if f.endswith(".md"))
    listing = git(repo, "ls-tree", "-r", "--name-only", rev, root).stdout.split("\n")
    return sorted(f for f in listing if f.endswith(".md"))


def find_citations(text):
    """Every cross-document citation in one document, with the block it sits in."""
    blocks = blocks_of(text)
    out, fenced = [], False
    for lineno, line in enumerate(text.split("\n"), 1):
        if FENCE.match(line):
            fenced = not fenced
            continue
        if fenced:
            continue
        for m in CITE.finditer(line):
            path = m.group("path")
            nums = [int(m.group("a"))]
            if m.group("rng"):
                nums.append(int(m.group("b")))
            for extra in re.finditer(r"\d{1,5}", m.group("more") or ""):
                nums.append(int(extra.group(0)))
            # A table row is its own block; the whole table would anchor a row on its neighbour's
            # words. Anything else uses its blank-line block.
            if line.lstrip().startswith("|"):
                first = last = lineno
                body = line
            else:
                first, last, body = block_for(blocks, lineno)
            out.append(dict(line=lineno, path=path, nums=nums, text=m.group(0),
                            block=body, block_first=first))
    return out


def resolve(repo, rev, citing, path, cache):
    """(target_path, reason). reason is None on success, else why it cannot be judged."""
    if path in cache:
        return cache[path]
    cand = [path]
    base = os.path.dirname(citing)
    if base:
        cand.append(os.path.normpath(os.path.join(base, path)))
    for c in cand:
        if git(repo, "cat-file", "-e", "%s:%s" % (rev, c)).returncode == 0:
            cache[path] = (c, None)
            return cache[path]
    # A BARE NAME is resolved by search; a PATH is not. `BRAND-IDENTITY.md` is a name a reader
    # expects to be found wherever it lives. `home/team/shared/templates/x.md:144` is a PATH, and
    # when it is not in the tree the citation points at something this tree does not contain - so
    # it is UNJUDGEABLE. Falling back to a basename search there would judge the citation against a
    # DIFFERENT copy of the document and invent a drift: measured on this tree, that turned a
    # deliberate contrast between the repository copy and the retired host copy into a red.
    if "/" in path:
        cache[path] = (None, "%s is not a document in the tree at this revision" % path)
        return cache[path]
    name = os.path.basename(path)
    listing = git(repo, "ls-tree", "-r", "--name-only", rev).stdout.split("\n")
    hits = [f for f in listing if f.endswith("/" + name) or f == name]
    if len(hits) == 1:
        cache[path] = (hits[0], None)
    elif not hits:
        cache[path] = (None, "%s is not a document in the tree at this revision" % path)
    else:
        cache[path] = (None, "%s names %d documents (%s)"
                       % (path, len(hits), ", ".join(sorted(hits)[:4])))
    return cache[path]


def judge(repo, rev, roots, out, explain=False):
    """Print the full report; return the exit code and the counts."""
    if not repo:
        raise LookupError("no git working tree above this file")
    if git(repo, "rev-parse", "--verify", rev + "^{commit}").returncode != 0:
        raise LookupError("revision %r does not resolve in %s" % (rev, repo))
    tree = short(repo, rev)

    citing_docs, citations = [], []
    for root in roots:
        docs = list_docs(repo, rev, root)
        if not docs:
            raise LookupError("%s/ lists no .md document at %s" % (root, rev))
        for path in docs:
            text = git(repo, "show", "%s:%s" % (rev, path)).stdout
            citing_docs.append(path)
            for c in find_citations(text):
                c["citing"] = path
                if os.path.basename(c["path"]) == os.path.basename(path) and \
                        c["path"] in (path, os.path.basename(path)):
                    c["verdict"] = "SAME-DOC"
                    c["why"] = "not a cross-document citation"
                citations.append(c)

    cross = [c for c in citations if "verdict" not in c]
    if not cross:
        raise LookupError("the scan found NO cross-document citation in %d document(s) under %s at "
                          "%s - a green over an empty list is not a measurement"
                          % (len(citing_docs), ", ".join(roots), rev))

    cache, targets = {}, {}
    for c in cross:
        tpath, reason = resolve(repo, rev, c["citing"], c["path"], cache)
        c["target"] = tpath
        if reason:
            c["verdict"], c["why"] = "UNJUDGEABLE", reason
            continue
        if tpath not in targets:
            targets[tpath] = Target(tpath, git(repo, "show", "%s:%s" % (rev, tpath)).stdout)
        t = targets[tpath]
        hi = max(c["nums"])
        if hi > t.nlines:
            c["verdict"] = "OUT-OF-BOUNDS"
            c["why"] = "line %d is past %s's last line (%d)" % (hi, tpath, t.nlines)
            continue
        # The CITING SENTENCE's quotations, nearest first: a block may carry several, and the one
        # beside the citation is the one the citation is quoting.
        cite_at = max(0, c["block"].find(c["text"]))
        s0, s1 = sentence_span(c["block"], cite_at)
        c["sentence"] = c["block"][s0:s1]
        frags = [f for f in quoted_fragments(c["block"]) if s0 <= f[0] < s1]
        if not frags:
            c["verdict"] = "UNJUDGEABLE"
            c["why"] = "no quotation in the citing sentence to anchor on"
            continue
        frags.sort(key=lambda f: abs(f[0] - cite_at))
        landed = None
        for _, frag, kind in frags:
            spans = t.span_of(anchor(frag))
            if not spans:
                continue
            # The FIRST fragment that exists anywhere in the target is the anchor. Only a
            # fragment that is really in the target can be a quotation of it - a block that quotes
            # the product's own strings and names a document by line number is not evidence about
            # that document, and must not be judged as if it were.
            c.setdefault("quote", frag)
            c.setdefault("kind", kind)
            c.setdefault("found_at", (min(s[0] for s in spans), max(s[1] for s in spans)))
            c["multi"] = len(spans) > 1
            a, b = min(c["nums"]), max(c["nums"])
            if any(s[0] <= b and s[1] >= a for s in spans):
                landed = frag
                break
        if landed is not None:
            c["verdict"] = "OK"
            continue
        if "found_at" in c:
            c["verdict"] = "DRIFT"
            c["why"] = ("the %s words %r are on %s:%d-%d, not on the cited line(s)"
                        % (c["kind"], c["quote"][:60], tpath,
                           c["found_at"][0], c["found_at"][1]))
        else:
            c["verdict"] = "UNJUDGEABLE"
            c["why"] = ("nothing this sentence quotes (%d fragment(s), nearest %r) occurs in %s - "
                        "there is no anchor to judge"
                        % (len(frags), frags[0][1][:60], tpath))

    def count(v):
        return [c for c in citations if c.get("verdict") == v]

    bad = [c for c in citations if c["verdict"] in ("DRIFT", "OUT-OF-BOUNDS")]
    for c in bad:
        out.write("%-12s %s:%d  %s  -> %s\n"
                  % (c["verdict"], c["citing"], c["line"], c["text"], c["why"]))
    unj = count("UNJUDGEABLE")
    for c in unj:
        out.write("%-12s %s:%d  %s  -> %s\n"
                  % ("UNJUDGEABLE", c["citing"], c["line"], c["text"], c["why"]))
    if bad or unj:
        out.write("\n")
    if explain:
        for c in citations:
            if c["verdict"] in ("OK", "SAME-DOC"):
                out.write("EXPLAIN %-10s %s:%d  %s  <- %s\n"
                          % (c["verdict"], c["citing"], c["line"], c["text"],
                             ("%r on %s:%d-%d" % (c.get("quote", "")[:70], c.get("target", ""),
                                                  c.get("found_at", (0, 0))[0],
                                                  c.get("found_at", (0, 0))[1]))
                             if c.get("found_at") else c.get("why", "")))

    # Enumeration, so the choice of root is visible rather than assumed: every other tree that
    # carries the same shape, counted and named as NOT JUDGED.
    judged = set(roots)
    others = {}
    for path in git(repo, "ls-tree", "-r", "--name-only", rev).stdout.split("\n"):
        if not path.endswith(".md"):
            continue
        top = path.split("/")[0] if "/" in path else "."
        if top in judged:
            continue
        text = git(repo, "show", "%s:%s" % (rev, path)).stdout
        n = len([c for c in find_citations(text)
                 if os.path.basename(c["path"]) != os.path.basename(path)])
        if n:
            others[top] = others.get(top, 0) + n
    for top in sorted(others):
        out.write("NOT JUDGED   %-24s %d cross-document citation(s) - outside --roots (%s)\n"
                  % (top if top != "." else "(repository root)", others[top],
                     ",".join(roots)))

    out.write("cross-document citations: %d in %d document(s) under %s at %s   [tree %s]\n"
              % (len(cross), len(citing_docs), ", ".join(roots), rev, tree))
    out.write("  OK (quotation lands):    %d\n" % len(count("OK")))
    out.write("  DRIFT (wrong line):      %d   (must be 0)\n" % len(count("DRIFT")))
    out.write("  OUT-OF-BOUNDS:           %d   (must be 0)\n" % len(count("OUT-OF-BOUNDS")))
    out.write("  UNJUDGEABLE:             %d   (nothing quoted that is IN the target, or the target "
              "is not in the tree - NAMED above, never passed)\n" % len(unj))
    out.write("  same-document:           %d   (not this instrument's question)\n"
              % len(count("SAME-DOC")))
    out.write("  multi-line quote:        %d   (the quoted words occur on more than one span; "
              "any one landing is enough)\n" % len([c for c in citations if c.get("multi")]))
    out.write("NOT JUDGED here: a citation whose block quotes NOTHING is UNJUDGEABLE, and an "
              "ASCENDING citation that lands on the\n"
              "                 wrong line with no quotation to anchor it is still not this "
              "instrument's question. The quotation is\n"
              "                 the whole anchor: a green says every anchored citation lands, and "
              "nothing more.\n")
    if bad:
        out.write("\nFAIL: %d cross-document citation(s) do not land at %s   [tree %s]\n"
                  % (len(bad), rev, tree))
        return 1, dict(total=len(cross), bad=len(bad), unjudgeable=len(unj), tree=tree)
    out.write("\nOK: every quotation-anchored cross-document citation lands at %s   [tree %s]\n"
              % (rev, tree))
    return 0, dict(total=len(cross), bad=0, unjudgeable=len(unj), tree=tree)


# ------------------------------------------------------------------------------- the selftest

PLANT = "design-concepts/ZZ-CROSSDOC-SELFTEST-PLANT.md"
PLANT_HEAD = ("# scratch plant - written by %s --selftest, never by hand\n\n"
              "This file is a plant. It is committed into a scratch clone and judged by that\n"
              "clone's own copy of the instrument.\n\n" % SELF)
ROOT_ARGS = ("--roots", ",".join(DEFAULT_ROOTS))
CONTROL_REV = "0e401cf"      # pre-#372: the cross-document citations into LAYER3-* had drifted


def _commit(clone, base, name, body):
    git(clone, "reset", "--hard", base)
    path = os.path.join(clone, name)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(PLANT_HEAD + body + "\n")
    git(clone, "add", name)
    c = git(clone, "-c", "user.name=selftest", "-c", "user.email=selftest@example.invalid",
            "commit", "-q", "-m", "selftest plant")
    if c.returncode != 0:
        raise RuntimeError("could not commit the plant: %s" % (c.stderr.strip() or c.stdout))
    return git(clone, "rev-parse", "HEAD").stdout.strip()


def _probe(clone, base):
    """(target_doc, quote, quote_line, wrong_line) read out of the clone, not typed in here.

    A hard-coded quote rots the moment somebody edits the target, and a plant that has rotted
    reports the harness's staleness rather than the instrument's reach. So the harness finds a
    long prose line in the clone's own target document and derives both plants from it.
    """
    target = "design-concepts/LAYER3-IDENTITY.md"
    text = git(clone, "show", "%s:%s" % (base, target)).stdout
    lines = text.split("\n")
    best = None
    for i, line in enumerate(lines, 1):
        s = line.strip()
        if not s or s.startswith("#") or s.startswith("|") or s.startswith("-") or s.startswith("*"):
            continue
        s = re.sub(r"[`*]", "", s)
        if len(s) >= 60 and " " in s:
            best = (i, s)
            break
    if not best:
        return None
    lineno, sentence = best
    quote = sentence.split(". ")[0].rstrip(".")
    if len(quote) > 120:
        quote = quote[:120].rsplit(" ", 1)[0]
    wrong = lineno + 40 if lineno + 40 <= len(lines) else max(1, lineno - 40)
    return target, quote, lineno, wrong


def selftest(keep=False):
    repo = repo_of(HERE)
    if not repo:
        print("REFUSED: nothing was checked - no git working tree above %s." % HERE)
        return 2
    base = git(repo, "rev-parse", "HEAD").stdout.strip()
    if git(repo, "cat-file", "-e", "HEAD:scripts/" + SELF).returncode != 0:
        print("REFUSED: nothing was checked - scripts/%s is not COMMITTED at HEAD (%s)."
              % (SELF, short(repo, base)))
        print("  This instrument reads git objects, so a scratch clone made now would not")
        print("  contain it. Commit it, then run --selftest again.")
        return 2
    tmp = tempfile.mkdtemp(prefix="antum-crossdoc-selftest-")
    clone = os.path.join(tmp, "clone")
    try:
        made = subprocess.run(["git", "clone", "--shared", "-q", repo, clone],
                              capture_output=True, text=True)
        if made.returncode != 0:
            print("REFUSED: nothing was checked - could not make the scratch clone: %s"
                  % (made.stderr.strip() or made.stdout))
            return 2
        # THE CLONE'S OWN COPY, never the source's - see the module docstring.
        instrument = os.path.join(clone, "scripts", SELF)
        if not os.path.exists(instrument):
            print("REFUSED: nothing was checked - the clone has no scripts/%s at its base."
                  % SELF)
            return 2
        probe = _probe(clone, base)
        if not probe:
            print("REFUSED: nothing was checked - could not derive a probe from the clone's own "
                  "LAYER3-IDENTITY.md.")
            return 2
        return _plants(clone, base, instrument, probe, keep)
    finally:
        if keep:
            print("\n--keep: scratch clone left at %s" % clone)
        else:
            shutil.rmtree(tmp, ignore_errors=True)


def _run(instrument, *args):
    p = subprocess.run([sys.executable, instrument] + list(args), capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


def _count(out, label):
    """The integer after `label` in the report, or -1 when the line is absent.

    Read from the instrument's OWN output, never from a number typed into this harness: a control
    that asserts a constant would keep passing after the instrument stopped counting.
    """
    for line in out.splitlines():
        if label in line:
            m = re.search(r"-?\d+", line.split(label, 1)[1])
            if m:
                return int(m.group(0))
    return -1


def _plants(clone, base, instrument, probe, keep):
    target, quote, quote_line, wrong_line = probe
    line = PLANT_HEAD.count("\n") + 1          # the plant body's own first line, not a typed 5
    bad = 0
    print("selftest: source %s, scratch clone %s, base %s"
          % (os.path.basename(instrument), clone, short(clone, base)))
    print("  probe: %s:%d quotes its own line %r; the stale plant cites :%d"
          % (target, quote_line, quote[:60] + ("..." if len(quote) > 60 else ""), wrong_line))

    def expect(name, cond, detail, show=()):
        nonlocal bad
        if not cond:
            bad += 1
        print("  %s  %s" % ("ok " if cond else "BAD", name))
        for text in detail.splitlines():
            if any(text.startswith(k) or k in text for k in show):
                print("       %s" % text.strip())
        if not cond:
            print("       %s" % detail.replace("\n", "\n       "))

    # S0 - the baseline. It is judged as a DELTA, not against a fixed zero: this instrument's own
    # tree carries a recorded defect (see the module docstring), and a harness that demanded exit 0
    # here would either fail forever or tempt someone to delete the finding. What S0 must prove is
    # that the scan SEES its subject.
    code, out = _run(instrument, base, *ROOT_ARGS)
    b_total = _count(out, "cross-document citations:")
    b_ok = _count(out, "OK (quotation lands):")
    b_drift = _count(out, "DRIFT (wrong line):")
    b_oob = _count(out, "OUT-OF-BOUNDS:")
    clean = 0 if b_drift == 0 else 1
    expect("S0  baseline %s is judged, sees %s citation(s) (%s DRIFT) and names its tree"
           % (short(clone, base), b_total, b_drift),
           code == clean and b_total > 0 and b_drift >= 0
           and ("[tree %s]" % short(clone, base)) in out, out,
           show=("cross-document citations:", "OK (quotation lands):", "DRIFT (wrong line):"))

    # S1 - the defect this instrument exists for: a stale citation must REDDEN, by name and span.
    sha = _commit(clone, base, PLANT,
                  "PLANT: the rule is quoted here - \"%s\" - and it lives at `%s:%d`."
                  % (quote, target, wrong_line))
    code, out = _run(instrument, sha, *ROOT_ARGS)
    expect("S1  a stale cross-document citation REDDENS naming %s:%d, both spans and the tree"
           % (PLANT, line),
           code == 1 and ("DRIFT        %s:%d" % (PLANT, line)) in out
           and (":%d" % wrong_line) in out and (":%d-" % quote_line) in out
           and ("[tree %s]" % short(clone, sha)) in out
           and _count(out, "DRIFT (wrong line):") == b_drift + 1, out,
           show=("DRIFT", "DRIFT (wrong line):"))

    # S2 - THE GREEN CONTROL. The same citation, quoting the line it actually cites, must add an OK
    # and no DRIFT. Without this, a gate that reddens on everything would pass S1.
    sha = _commit(clone, base, PLANT,
                  "PLANT: the rule is quoted here - \"%s\" - and it lives at `%s:%d`."
                  % (quote, target, quote_line))
    code, out = _run(instrument, sha, *ROOT_ARGS)
    expect("S2  the same citation quoting the line it cites adds an OK and no DRIFT (green control)",
           code == clean and _count(out, "OK (quotation lands):") == b_ok + 1
           and _count(out, "DRIFT (wrong line):") == b_drift, out,
           show=("OK (quotation lands):", "DRIFT (wrong line):", "EXPLAIN"))

    # S3 - in bounds is a separate, cheap check: a number past the target's EOF is RED whatever the
    # quotation says - here there is no quotation at all.
    sha = _commit(clone, base, PLANT,
                  "PLANT: no quotation at all, just a number past the end - `%s:99999`." % target)
    code, out = _run(instrument, sha, *ROOT_ARGS)
    expect("S3  a number past the target's EOF REDDENS as OUT-OF-BOUNDS naming %s:%d"
           % (PLANT, line),
           code == 1 and ("OUT-OF-BOUNDS %s:%d" % (PLANT, line)) in out
           and _count(out, "OUT-OF-BOUNDS:") == b_oob + 1, out, show=("OUT-OF-BOUNDS",))

    # S4 - the four non-findings, in one plant: none is a cross-document citation, so neither the
    # citation count nor the DRIFT count may move, and the exit must be the baseline's.
    sha = _commit(clone, base, PLANT, "\n".join([
        "PLANT A - a section number with no line reference: `%s` \u00a74." % target,
        "",
        "PLANT B - a line reference inside a code fence:",
        "",
        "```",
        "    `%s:1234` is prose about syntax, not a pointer" % target,
        "```",
        "",
        "PLANT C - a same-document citation: `%s:12`." % os.path.basename(PLANT),
        "",
        "PLANT D - a clock time: the cutover ran 05:06:55-05:07:21Z.",
    ]))
    code, out = _run(instrument, sha, *ROOT_ARGS)
    expect("S4  the four non-findings stay quiet: citation count and DRIFT count unchanged",
           code == clean and _count(out, "cross-document citations:") == b_total
           and _count(out, "DRIFT (wrong line):") == b_drift, out,
           show=("cross-document citations:", "NOT JUDGED", "DRIFT (wrong line):"))

    # S5 - the anti-vacuous control must be reachable from the operator's own command line: a root
    # with no cross-document citation REFUSES at exit 2 rather than printing a clean zero.
    code, out = _run(instrument, base, "--roots", "docs/notes")
    expect("S5  a root with no cross-document citation REFUSES at exit 2 (never a green zero)",
           code == 2 and "NO cross-document citation" in out, out, show=("REFUSED",))

    # S6 - the proof is not confined to a plant this file invented: the real pre-#372 tree, whose
    # cross-document citations had drifted through every green run of both older gates, must redden.
    if git(clone, "rev-parse", "--verify", CONTROL_REV + "^{commit}").returncode == 0:
        code, out = _run(instrument, CONTROL_REV, *ROOT_ARGS)
        expect("S6  the real control tree %s REDDENS (exit 1)" % CONTROL_REV,
               code == 1 and _count(out, "DRIFT (wrong line):") > 0, out,
               show=("DRIFT", "DRIFT (wrong line):", "cross-document citations:"))
        print("       control %s: %s DRIFT of %s citation(s), %s unjudgeable"
              % (CONTROL_REV, _count(out, "DRIFT (wrong line):"),
                 _count(out, "cross-document citations:"), _count(out, "UNJUDGEABLE:")))
    else:
        bad += 1
        print("  BAD  S6  the control tree %s is not in the clone, so the real-defect half of "
              "this proof cannot run" % CONTROL_REV)

    print("\nselftest: %s" % ("all plants produced their documented outcome"
                              if not bad else "%d plant(s) did NOT" % bad))
    return 1 if bad else 0


# ------------------------------------------------------------------------------------- main

def main(argv):
    args = list(argv)
    do_selftest = keep = explain = False
    roots = list(DEFAULT_ROOTS)
    rest = []
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--selftest":
            do_selftest = True
        elif a == "--keep":
            keep = True
        elif a == "--explain":
            explain = True
        elif a == "--roots":
            i += 1
            if i >= len(args):
                print("REFUSED: nothing was checked - --roots needs a comma-separated list.")
                return 2
            roots = [r.strip().strip("/") for r in args[i].split(",") if r.strip()]
        elif a.startswith("--roots="):
            roots = [r.strip().strip("/") for r in a.split("=", 1)[1].split(",") if r.strip()]
        elif a.startswith("-"):
            print("REFUSED: nothing was checked - unknown flag %r." % a)
            print("  usage: %s [<rev>] [--roots a/b,c/d] [--selftest [--keep]]" % SELF)
            return 2
        else:
            rest.append(a)
        i += 1
    if len(rest) > 1:
        print("REFUSED: nothing was checked - one revision at a time, got %d." % len(rest))
        return 2
    if do_selftest:
        return selftest(keep=keep)

    repo = repo_of(HERE)
    rev = rest[0] if rest else "HEAD"
    try:
        code, _ = judge(repo, rev, tuple(roots), sys.stdout, explain=explain)
        return code
    except LookupError as exc:
        print("REFUSED: nothing was checked - %s." % exc)
        print("  run it inside the repository, or name a revision: %s [<rev>] [--roots a/b]"
              % SELF)
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
