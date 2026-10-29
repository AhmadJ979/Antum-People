#!/usr/bin/env python3
"""
THE SERVED DOCUMENT REACHES THE DOM ONE WAY, AND THIS CHECK NAMES THE WAY.

    python3 scripts/check-served-document-renderer.py            # judge the deployed tree
    python3 scripts/check-served-document-renderer.py --tree DIR # judge another tree
    python3 scripts/check-served-document-renderer.py --selftest # prove this check can redden

WHY THIS FILE EXISTS (the defect it answers, measured at 2ff2891)
  #329 fixed, by hand, the screen a reader was shown when they clicked "Settlement Statement": the
  preview printed the served document's MARKUP in a `<pre>` - a literal `# Document not issued`, a
  literal `**NOT ISSUED.**`, in monospace. The guard shipped beside that fix (`client/src/markdown.test.js`,
  "the parser returns data only, and the view never injects HTML") scans **two filenames**,
  `markdown.js` and `markdownView.js`, for `dangerouslySetInnerHTML` and `.innerHTML =`.
  It passes today only because the served bytes enter the client through one surface
  (`App.tsx:2746` -> `MarkdownDocument`). The guard cannot see that surface: a new commit that prints
  a document's `content` in a `<pre>` anywhere else under `client/src` leaves it green. That is
  rule 8's exact shape - **a check that cannot redden proves nothing** - and this file is the fix.

THE RULE, STATED ONCE (what "the right rule" means here)
  A served document body may reach the DOM **only** as the `content` prop of `MarkdownDocument`,
  the one module that turns served markdown into React elements (no markup strings, no injection).
  The rule is about the ELEMENT and the HAND-OFF, not about a filename, because a filename is a
  fact about today's tree and the invariant is about the served bytes.

HOW IT IS ENFORCED - four checks over every module the client can bundle
  R1 SINK     no HTML-injection primitive anywhere in `client/src`: `dangerouslySetInnerHTML`,
              `.innerHTML =`, `.outerHTML =`, `insertAdjacentHTML`, `document.write(`.
  R2 LITERAL  the two elements whose children print literally - `pre` and `code` - may be created
              ONLY by a module that exports `MarkdownDocument` (derived by reading the code, not by
              naming a path). `<pre>{content}</pre>` is the exact shape #329 removed; the element is
              the mechanism, not the string. Inside the renderer the rule still bites: R3 forbids a
              document body in the `pre`'s children there too (the code block is built from PARSED
              block lines, never from the document).
  R3 HAND-OFF a read of the served body - `X.<field>` for the field name(s) re-derived from the
              SERVING side (see below) - is allowed in exactly two positions and nowhere else:
                `content: <read>`     storing it (an object property value), e.g. into React state
                `content={<read>}`    handing it to an element as a prop - and that module must
                                      import `MarkdownDocument`
              Everything else is a violation: a child of any element (`<div>{doc.content}</div>`,
              `<pre>{doc.content}</pre>`, `createElement('pre', null, doc.content)`), a template
              literal, a bracket read (`doc['content']`), an attribute of any other name
              (`__html: doc.content`). One read in a forbidden position is enough - the guard is
              deliberately strict, and a NEW legitimate hand-off shape must be added here on purpose.
  R0 ONE WAY  the tree must still contain at least one `content={<read>}` hand-off, and at least one
              read at all. Without this the check would go green the moment served content stopped
              being displayed (or stopped being recognisable) - a false green, which is the failure
              rule 8 is about. "The guard cannot see the body it guards" is a RED, not a pass.

WHERE THE FIELD NAME COMES FROM (the guard reads the server before the client)
  A guard that hard-codes the string `content` goes quietly vacuous the day the serving side renames
  its field. So the field name(s) are RE-DERIVED on every run, from the two places the server states
  them: `compliance_engine.js`'s `return { content: rendered, ... }` and every `res.json({ ... <field>:
  rendered.<x> | compliance.refusalDocument(...) })` in `server/index.js`. If neither can be read, this
  check exits 2 (CANNOT-JUDGE) - it will not print a green for a premise it could not establish.

WHAT IT DOES NOT SEE (stated so nobody reads it as more)
  * It is a text scanner with a small comment/string/regex-aware tokenizer, not a parser. It does not
    follow a document body through an alias (`const body = doc.content` then `<pre>{body}</pre>`): the
    alias's first read is a forbidden position and DOES redden, but a body that reaches a name this
    check never sees as a read is beyond it. It does not see a `.tsx` file outside `client/src`, nor
    a runtime string built from a fetched payload.
  * Test files (`*.test.*`, `*.spec.*`) are excluded by the walk: they are not bundled, and a guard
    whose own mutants are read as violations would redden on a correct tree.
  * It judges BYTES ON DISK, working tree included - the header names the revision it measured and
    says so when tracked bytes are modified.
  It is a tree check: it changes nothing, runs no server and touches no database.

PROVEN, NOT ASSERTED: `--selftest` plants violations in a scratch COPY of the tree and requires each
  to redden, with a clean-copy control that must stay green and a comment-only control that must not
  false-positive. One plant is a filename no list names (a new `Preview.tsx`), which is the finding
  itself: the guard is not a filename check. Exit 2 refuses to judge.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ROOT = os.path.dirname(HERE)
CLIENT_SRC = os.path.join("client", "src")
MODULE_EXT = (".js", ".jsx", ".ts", ".tsx", ".mjs")
TEST_FILE = re.compile(r"\.(?:test|spec)\.[A-Za-z0-9]+$")
SKIP_DIRS = {"node_modules", "dist", "__tests__"}
# characters after which a `/` opens a REGEX literal rather than a division
REGEX_LEAD = set("(,=:[!&|?{};+-*%~^<>") 

EXIT_OK, EXIT_RED, EXIT_CANNOT_JUDGE = 0, 1, 2


# --------------------------------------------------------------------------------- tokenizer
def strip_comments(src):
    """Blank every comment, keeping the source EXACTLY the same length.

    Comments are the whole reason this step exists: `App.tsx:2739` and `markdown.js:5` both EXPLAIN
    the `<pre>{renderedTemplate.content}</pre>` defect in prose. A scanner that reads its own
    explanation reddens on a correct tree - the trap `tailwindSources.test.js` documents - and one
    that skips comment handling would have flagged the fix as the defect. Length is preserved so a
    violation can still be reported with the line number a reader can open.
    """
    out = list(src)
    i, n = 0, len(src)
    prev = ""  # last significant code character seen (for regex-literal detection)
    while i < n:
        c = src[i]
        if c in ('"', "'", "`"):
            quote = c
            i += 1
            while i < n:
                if src[i] == "\\":
                    i += 2
                    continue
                if src[i] == quote:
                    i += 1
                    break
                i += 1
            prev = quote
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            while i < n and src[i] != "\n":
                out[i] = " "
                i += 1
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            out[i] = out[i + 1] = " "
            i += 2
            while i < n and not (src[i] == "*" and i + 1 < n and src[i + 1] == "/"):
                if src[i] != "\n":
                    out[i] = " "
                i += 1
            if i < n:
                out[i] = out[i + 1] = " "
                i += 2
            continue
        if c == "/" and (prev == "" or prev in REGEX_LEAD):
            j = i + 1
            in_class = False
            while j < n:
                if src[j] == "\\":
                    j += 2
                    continue
                if src[j] == "[":
                    in_class = True
                elif src[j] == "]":
                    in_class = False
                elif src[j] == "/" and not in_class:
                    break
                elif src[j] == "\n":
                    break
                j += 1
            i = j + 1 if j < n and src[j] == "/" else i + 1
            prev = "/"
            continue
        if not c.isspace():
            prev = c
        i += 1
    return "".join(out)


def line_of(src, index):
    return src.count("\n", 0, index) + 1


# ------------------------------------------------------------------------------- the tree
def modules_of(root):
    """Every module the client can bundle, DISCOVERED by walking - never a list of names.

    This is the fix's centre. The guard it replaces named `markdown.js` and `markdownView.js`; a new
    `Preview.tsx` was invisible to it. Here a file is in scope because of where it lives, so a file
    that does not exist yet is already covered.
    """
    base = os.path.join(root, CLIENT_SRC)
    found = []
    if not os.path.isdir(base):
        return found
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for name in sorted(filenames):
            if name.endswith(MODULE_EXT) and not TEST_FILE.search(name):
                found.append(os.path.join(dirpath, name))
    return sorted(found)


def derive_body_fields(root):
    """The served-body field name(s), read off the SERVING side. (fields, evidence, problems)."""
    fields, evidence, problems = set(), [], []
    engine = os.path.join(root, "server", "compliance_engine.js")
    index = os.path.join(root, "server", "index.js")
    try:
        with open(engine, encoding="utf-8") as fh:
            engine_src = strip_comments(fh.read())
    except OSError as err:
        engine_src = ""
        problems.append("cannot read server/compliance_engine.js (%s)" % err.strerror)
    try:
        with open(index, encoding="utf-8") as fh:
            index_src = strip_comments(fh.read())
    except OSError as err:
        index_src = ""
        problems.append("cannot read server/index.js (%s)" % err.strerror)

    # The engine first: its render function returns the body under a name, and that name is what the
    # route forwards (`content: rendered.content`). The ENGINE names the body; a route key is counted
    # only when its value IS that name (or the refusal body built for it). Taking keys off the route
    # alone would also take `missing`/`missing_fields` - the LIST of unheld facts, not the document.
    engine_fields = set()
    for m in re.finditer(r"return\s*\{\s*([A-Za-z_$][\w$]*)\s*:\s*rendered\b", engine_src):
        engine_fields.add(m.group(1))
        evidence.append("compliance_engine.js:%d returns `%s`" % (line_of(engine_src, m.start()), m.group(1)))
    if not engine_fields:
        problems.append("compliance_engine.js no longer returns the rendered body under a name "
                        "(no `return { <field>: rendered }`): the name this check scans the client for "
                        "cannot be re-derived, so a green here would be a green on a stale premise")
        return set(), evidence, problems
    fields = set(engine_fields)
    for m in re.finditer(
            r"([A-Za-z_$][\w$]*)\s*:\s*(?:rendered\.([\w$]+)|compliance\.refusalDocument\s*\()", index_src):
        key, engine_field = m.group(1), m.group(2)
        if engine_field is None or engine_field in engine_fields:
            fields.add(key)
            evidence.append("index.js:%d serves `%s`" % (line_of(index_src, m.start()), key))
    return fields, evidence, problems


SINKS = [
    ("dangerouslySetInnerHTML", re.compile(r"dangerouslySetInnerHTML")),
    (".innerHTML =", re.compile(r"\.innerHTML\s*=")),
    (".outerHTML =", re.compile(r"\.outerHTML\s*=")),
    ("insertAdjacentHTML", re.compile(r"insertAdjacentHTML")),
    ("document.write(", re.compile(r"document\.write\s*\(")),
]
LITERAL_ELEMENT = [
    ("<pre>", re.compile(r"<pre(?=[\s>/])")),
    ("<code>", re.compile(r"<code(?=[\s>/])")),
    ("createElement('pre')", re.compile(r"createElement\(\s*['\"]pre['\"]")),
    ("createElement('code')", re.compile(r"createElement\(\s*['\"]code['\"]")),
]
BODY_READ = r"\.\s*%s\b|\[\s*['\"]%s['\"]\s*\]"
RENDERER_EXPORT = re.compile(r"export\s+(?:async\s+)?(?:function|const|let)\s+MarkdownDocument\b")
IMPORTS_RENDERER = re.compile(
    r"import\b[^;\n]*\bMarkdownDocument\b[^;\n]*from\s*['\"][^'\"]*markdownView[^'\"]*['\"]"
    r"|import\b[^;\n]*from\s*['\"][^'\"]*markdownView[^'\"]*['\"][^;\n]*\bMarkdownDocument\b")


def scan(root):
    """Judge one tree. Returns a report dict; `violations` empty means green."""
    modules = modules_of(root)
    fields, evidence, premise_problems = derive_body_fields(root)
    report = dict(root=root, modules=modules, fields=sorted(fields), evidence=evidence,
                  premise_problems=list(premise_problems), violations=[], handoffs=[],
                  reads=[], renderers=[], cannot_judge=[])
    if not modules:
        report["cannot_judge"].append("no module found under %s - this tree has nothing to judge"
                                      % os.path.join(root, CLIENT_SRC))
        return report
    if not fields:
        report["cannot_judge"].extend(premise_problems)
        return report

    read_re = re.compile(BODY_READ % ("(?:%s)" % "|".join(map(re.escape, fields)),
                                      "|".join(map(re.escape, fields))))
    store_re = re.compile(r"(?:^|[^\w$])(?:%s)\s*:\s*$" % "|".join(map(re.escape, fields)))
    handoff_re = re.compile(r"(?:^|[^\w$])(?:%s)\s*=\s*\{\s*$" % "|".join(map(re.escape, fields)))

    sources = {}
    for path in modules:
        rel = os.path.relpath(path, root).replace(os.sep, "/")
        with open(path, encoding="utf-8") as fh:
            sources[rel] = strip_comments(fh.read())
        if RENDERER_EXPORT.search(sources[rel]):
            report["renderers"].append(rel)

    if not report["renderers"]:
        report["cannot_judge"].append(
            "no module exports MarkdownDocument: the renderer this check exists to protect is not in "
            "this tree, so 'the body reaches the DOM one way' cannot be judged")

    for rel, code in sources.items():
        is_renderer = rel in report["renderers"]

        # R1 - an injection sink, anywhere, renderer included.
        for label, pattern in SINKS:
            for m in pattern.finditer(code):
                report["violations"].append((rel, line_of(code, m.start()), "R1 SINK",
                                             "%s - a served document can become markup" % label))

        # R2 - the two literal-print elements, outside the renderer.
        if not is_renderer:
            for label, pattern in LITERAL_ELEMENT:
                for m in pattern.finditer(code):
                    report["violations"].append((rel, line_of(code, m.start()), "R2 LITERAL",
                                                 "%s created outside the renderer - a served document "
                                                 "printed as text instead of rendered" % label))

        # R3 - every read of a served body, and where it goes.
        for m in read_re.finditer(code):
            # What precedes the read is the CONTEXT that decides whether it is a hand-off. The read
            # begins at the `.` and its own receiver (`doc`, `renderedTemplate`) sits in between, so
            # the receiver chain is peeled off first: `... content: doc|.content` -> `... content: `.
            before = re.sub(r"[\w$.\)\]]*$", "", code[max(0, m.start() - 200):m.start()])
            token = m.group(0)
            if store_re.search(before):
                report["reads"].append((rel, line_of(code, m.start()), "store", token))
                continue
            if handoff_re.search(before):
                report["handoffs"].append((rel, line_of(code, m.start()), token))
                report["reads"].append((rel, line_of(code, m.start()), "hand-off", token))
                if not is_renderer and not IMPORTS_RENDERER.search(code):
                    report["violations"].append(
                        (rel, line_of(code, m.start()), "R3 HAND-OFF",
                         "hands a served body to a `content=` prop without importing MarkdownDocument "
                         "- the module that prints a document must be the module that owns the renderer"))
                continue
            report["reads"].append((rel, line_of(code, m.start()), "PRINT", token))
            report["violations"].append(
                (rel, line_of(code, m.start()), "R3 HAND-OFF",
                 "%s is printed outside the renderer (not `content: <read>` and not "
                 "`content={<read>}`) - it may reach the DOM only through MarkdownDocument" % token))

    # R0 - the check must not be vacuous: the body still has to reach a renderer.
    if sources and not report["reads"]:
        report["violations"].append(
            ("(tree)", 0, "R0 ONE WAY",
             "no read of the served body field(s) %s appears under %s: either the served document is no "
             "longer displayed (re-ground this check) or it is read in a shape this check cannot see - "
             "both are red, because a guard that cannot see its subject proves nothing"
             % (report["fields"], CLIENT_SRC)))
    elif sources and not report["handoffs"]:
        report["violations"].append(
            ("(tree)", 0, "R0 ONE WAY",
             "no `content={<read>}` hand-off to MarkdownDocument exists: the renderer is no longer how a "
             "served document reaches the DOM"))
    return report


# ------------------------------------------------------------------------------- the report
def git(root, *args):
    try:
        out = subprocess.run(["git", "-C", root, *args], capture_output=True, text=True, timeout=30)
        return out.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def print_report(report):
    root = report["root"]
    sha = git(root, "rev-parse", "--short", "HEAD") or "UNKNOWN"
    dirty = [l for l in git(root, "status", "--porcelain").splitlines() if l.strip() and not l.startswith("??")]
    print("=" * 100)
    print("served-document render guard - the served document reaches the DOM one way")
    print("  tree judged : %s @ %s%s" % (root, sha,
                                        " (DIRTY: %d tracked path(s) modified - working-tree bytes, not the commit's)"
                                        % len(dirty) if dirty else " (no tracked modification)"))
    print("  rule        : a served document body may reach the DOM only as the `content` prop of"
          " MarkdownDocument")
    print("  modules     : %d walked under %s (tests excluded - they are not bundled)"
          % (len(report["modules"]), CLIENT_SRC))
    print("  body field  : %s   [re-derived from the serving side: %s]"
          % (", ".join(report["fields"]) or "(none)", "; ".join(report["evidence"]) or "(nothing found)"))
    print("  renderer(s) : %s   [derived: a module exporting MarkdownDocument]"
          % (", ".join(report["renderers"]) or "(none)"))
    for rel, line, kind, token in report["reads"]:
        print("    read      : %s:%s  %-9s %s" % (rel, line, kind, token))
    for rel, line, token in report["handoffs"]:
        print("    hand-off  : %s:%s  -> MarkdownDocument content=  (%s)" % (rel, line, token))
    print("  R1 sinks    : %d" % sum(1 for v in report["violations"] if v[2].startswith("R1")))
    print("  R2 literal  : %d" % sum(1 for v in report["violations"] if v[2].startswith("R2")))
    print("  R3 hand-off : %d" % sum(1 for v in report["violations"] if v[2].startswith("R3")))
    print("  R0 one way  : %d" % sum(1 for v in report["violations"] if v[2].startswith("R0")))
    print("-" * 100)
    if report["cannot_judge"]:
        for line in report["cannot_judge"]:
            print("CANNOT-JUDGE: %s" % line)
        print("VERDICT: this tree was NOT judged (exit 2). A premise the check reads could not be "
              "established - fix the check before trusting any green it prints.")
        return EXIT_CANNOT_JUDGE
    if report["violations"]:
        for rel, line, rule, message in report["violations"]:
            print("FAIL %-11s %s:%s  %s" % (rule, rel, line, message))
        print("VERDICT: %d violation(s) - served document content can reach the DOM without the renderer "
              "(or the guard can no longer see it). exit 1" % len(report["violations"]))
        return EXIT_RED
    print("PASS: %d module(s) walked, %d read(s) of the served body, every one of them handed to "
          "MarkdownDocument; no injection sink, no literal-print element outside the renderer. exit 0"
          % (len(report["modules"]), len(report["reads"])))
    return EXIT_OK


# ------------------------------------------------------------------------------- the control
PREVIEW_PLANT = """\
import React from 'react';

/**
 * PLANTED VIOLATION (scratch copy only, never committed): a document preview that bypasses the
 * renderer. This file's NAME is in nobody's list - that is the point of the plant.
 */
export function Preview({ doc }: { doc: { title: string, content: string } }) {
  return (
    <div className="p-4">
      <h3>{doc.title}</h3>
      <pre>{doc.content}</pre>
    </div>
  );
}
"""
DIV_PLANT = """\
import React from 'react';

/** PLANTED VIOLATION: the body interpolated as a child of a div - not a `<pre>`, still raw. */
export function Body({ doc }: { doc: { content: string } }) {
  return <div className="whitespace-pre-wrap">{doc.content}</div>;
}
"""
INJECT_PLANT = """\
import React from 'react';

/** PLANTED VIOLATION: an injection sink - the body turned into markup. */
export const Injected = ({ html }: { html: string }) => (
  <div dangerouslySetInnerHTML={{ __html: html }} />
);
"""
CREATE_PLANT = """\
import React from 'react';

/** PLANTED VIOLATION: the body as a child argument of createElement. */
export function Body({ doc }) {
  return React.createElement('pre', { className: 'font-mono' }, doc.content);
}
"""


def _copy_tree(src_root, dst_root):
    """A faithful scratch copy: the client's source (no node_modules/dist) + the two server files
    the premise is derived from. Nothing else is read by the guard."""
    shutil.copytree(os.path.join(src_root, CLIENT_SRC), os.path.join(dst_root, CLIENT_SRC),
                    ignore=shutil.ignore_patterns("node_modules", "dist", "__tests__"))
    os.makedirs(os.path.join(dst_root, "server"), exist_ok=True)
    for name in ("compliance_engine.js", "index.js"):
        shutil.copy2(os.path.join(src_root, "server", name), os.path.join(dst_root, "server", name))


def _append(dst_root, rel, text):
    path = os.path.join(dst_root, rel)
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(text)


def _write(dst_root, rel, text):
    path = os.path.join(dst_root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


def _read(dst_root, rel):
    with open(os.path.join(dst_root, rel), encoding="utf-8") as fh:
        return fh.read()


def _replace(dst_root, rel, old, new):
    text = _read(dst_root, rel)
    assert old in text, "selftest plant target missing from %s" % rel
    _write(dst_root, rel, text.replace(old, new))


def selftest():
    """Prove this check reddens. Each case mutates a scratch COPY of the real tree.

    The control cases matter as much as the mutants: the clean copy must stay GREEN (a guard that
    reddens on the correct tree is noise and gets switched off) and the comment-only case must stay
    green (the fix's own explanation, `App.tsx:2739`, must not be read as the defect).
    """
    root = DEFAULT_ROOT
    cases = []

    def case(name, mutate, want):
        tmp = tempfile.mkdtemp(prefix="served-render-selftest-")
        try:
            _copy_tree(root, tmp)
            mutate(tmp)
            rep = scan(tmp)
            if want == "green":
                got = "green" if not rep["violations"] and not rep["cannot_judge"] else "red"
            elif want == "red":
                got = "red" if rep["violations"] else ("cannot-judge" if rep["cannot_judge"] else "green")
            else:
                got = "cannot-judge" if rep["cannot_judge"] else ("red" if rep["violations"] else "green")
            detail = ""
            if rep["violations"]:
                rel, line, rule, message = rep["violations"][0]
                detail = "%s %s:%s (%d violation(s))" % (rule, rel, line, len(rep["violations"]))
            elif rep["cannot_judge"]:
                detail = rep["cannot_judge"][0][:90]
            ok = got == want
            cases.append((ok, name, want, got, detail))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def plant_pre(tmp):
        _write(tmp, "client/src/Preview.tsx", PREVIEW_PLANT)

    def plant_div(tmp):
        _write(tmp, "client/src/DocumentBody.tsx", DIV_PLANT)

    def plant_inject(tmp):
        _write(tmp, "client/src/Injected.tsx", INJECT_PLANT)

    def plant_create(tmp):
        _write(tmp, "client/src/body.js", CREATE_PLANT)

    def plant_in_app(tmp):
        # THE SEED THE REVIEW ASKED FOR: one line, in the file the renderer is called from.
        _replace(tmp, "client/src/App.tsx",
                 "<MarkdownDocument content={renderedTemplate.content} />",
                 "<MarkdownDocument content={renderedTemplate.content} />\n"
                 "                    <pre>{renderedTemplate.content}</pre>")

    def plant_comment(tmp):
        # The same text, inside a comment: must NOT redden (the fix explains itself in prose).
        _append(tmp, "client/src/App.tsx",
                "\n/* <pre>{renderedTemplate.content}</pre> - the old defect, described only */\n")

    def drop_premise(tmp):
        _replace(tmp, "server/compliance_engine.js", "return { content: rendered, missing };",
                 "return { rendered, missing };")
        _replace(tmp, "server/index.js", "content: rendered.content", "body_html: rendered.content")
        _replace(tmp, "server/index.js",
                 "content: compliance.refusalDocument({ templateName, employeeId, missing: rendered.missing })",
                 "refusal: compliance.refusalDocument({ templateName, employeeId, missing: rendered.missing })")

    def hide_body(tmp):
        # The served body stops being read at all: the guard must refuse to go green.
        for rel in ("client/src/App.tsx",):
            text = _read(tmp, rel)
            _write(tmp, rel, text.replace(".content", ".body").replace("content: data.content", "x: 1"))

    case("clean copy of the real tree", lambda tmp: None, "green")
    case("a NEW filename printing the body in <pre>", plant_pre, "red")
    case("the body as a child of a plain div", plant_div, "red")
    case("dangerouslySetInnerHTML in a new module", plant_inject, "red")
    case("createElement('pre', ..., body) in a .js module", plant_create, "red")
    case("one <pre> line beside the renderer call in App.tsx", plant_in_app, "red")
    case("the same text inside a COMMENT (false-positive control)", plant_comment, "green")
    case("serving side renames the body field (premise gone)", drop_premise, "cannot-judge")
    case("the body no longer read at all (vacuous guard)", hide_body, "red")

    print("served-document render guard - self-test (mutants planted in a scratch copy of %s)" % root)
    bad = 0
    for ok, name, want, got, detail in cases:
        if not ok:
            bad += 1
        print("  %s  %-58s want %-13s got %-13s %s"
              % ("ok " if ok else "BAD", name, want, got, detail))
    print("self-test: %d/%d cases" % (len(cases) - bad, len(cases)))
    if bad:
        print("SELFTEST FAILED: the guard does not redden where it must (or reddens where it must not). "
              "exit 1")
        return EXIT_RED
    print("SELFTEST PASSED: every plant reddens, the clean tree and the comment-only tree stay green. "
          "exit 0")
    return EXIT_OK


def main(argv):
    ap = argparse.ArgumentParser(add_help=True, description=__doc__.splitlines()[1])
    ap.add_argument("--tree", default=DEFAULT_ROOT,
                    help="the tree to judge (default: the repository this script lives in, i.e. the deployed tree)")
    ap.add_argument("--selftest", action="store_true", help="prove the guard can redden; run nothing else")
    args = ap.parse_args(argv[1:])
    if args.selftest:
        return selftest()
    root = os.path.abspath(args.tree)
    if not os.path.isdir(os.path.join(root, CLIENT_SRC)):
        print("CANNOT-JUDGE: %s has no %s - this is not the client's tree" % (root, CLIENT_SRC))
        return EXIT_CANNOT_JUDGE
    return print_report(scan(root))


if __name__ == "__main__":
    sys.exit(main(sys.argv))
