#!/usr/bin/env python3
"""Fail when this repository's WORKFLOW.md mirror has drifted from the live file.

    python3 scripts/check-workflow-mirror.py                    # judge this tree
    python3 scripts/check-workflow-mirror.py --live PATH        # judge against another live file
    python3 scripts/check-workflow-mirror.py --mirror PATH      # judge another mirror
    python3 scripts/check-workflow-mirror.py --selftest         # prove it can redden

WHY IT EXISTS. `WORKFLOW.md` in this repository is a DECLARED MIRROR of
`/home/team/shared/WORKFLOW.md`, the file the team actually maintains. Nothing compared the
two. On 2026-11-06 the drift was measured by hand and was three ways at once: the mirror was
missing rules 42 and 43 entirely (so a fresh clone carried neither the merge policy nor the
client-build rule), one sentence about the off-host check still said it "does not exist yet"
after it had shipped as `.github/workflows/uptime.yml`, and the mirror's own header claimed a
sync date, a revision and a rule range that were no longer what the file contained. A mirror
whose whole purpose is that a clone carries the workflow is worth exactly what a comparison
says it is - and a comparison a member has to remember to run is not a gate.

WHAT IT JUDGES. The mirror's body is defined as its lines that do not start with `>`: the
`>`-prefixed header is the mirror's own note to a reader and is deliberately not part of the
live text. That body must be **byte-identical** to the live file - not merely close after
blank lines are ignored. The construction that makes that possible is stated in the header
itself: the body is the live file verbatim with the header inserted between two of its lines,
so stripping `>` restores it exactly. This instrument therefore compares exactly, and a
mirror that is only blank-line-different is reported as DRIFT with the line named, because
`diff -B` would have called it a pass.

WHAT IT DOES NOT JUDGE, stated so a green is not read as more than it is:
  * The header's own claims. It cannot know whether "Last synced: <date>" or the rule range
    written in the header is true; it knows only that the body matches. The header is prose,
    and prose is checked by reading it.
  * WHICH live file is authoritative. It compares against the path it is given and says which
    path that was. On a machine with no live file there is nothing to compare and it says so
    (exit 3) rather than passing.

EXIT CODES - four. The fourth exists because the live file is OUTSIDE this repository: a
fresh clone or CI has no file to compare against, and that is not a verdict about the tree.
    0  judged: the body is byte-identical to the live file
    1  DRIFT: judged, and it is not - every differing line is printed with both sides
    2  REFUSED - NOTHING WAS CHECKED: no WORKFLOW.md in this tree, or a body with no content
       lines at all. A comparison over an empty body would otherwise print a clean 0-diff,
       and a green computed over nothing is not a measurement.
    3  LIVE-ABSENT - the live file is not on this machine. NOTHING WAS COMPARED. `check-all`
       prints this SKIP-FLAGGED and never OK, because a skip that reads like a pass is the
       defect this whole file answers to.

--selftest builds a scratch mirror and a scratch live file from THIS tree's WORKFLOW.md and
requires, in order: OK is reachable (so a DRIFT is a difference, not a property of the
instrument); a one-line plant in the live file is DRIFT naming that line; a one-line plant in
the mirror's BODY is DRIFT; a `>` line added to the header is still OK (the strip works, so
the header can be edited without reddening); a blank-line-only difference is DRIFT (the
stricter-than-`diff -B` claim is real); an absent live file is exit 3 and never OK; and an
empty body is exit 2. Each plant is removed before the next case, so no case can pass on the
previous one's plant.
"""
import argparse
import difflib
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_LIVE = "/home/team/shared/WORKFLOW.md"

OK, DRIFT, REFUSED, LIVE_ABSENT = 0, 1, 2, 3


def body_lines(path):
    """The mirror's body: every line that does not start with '>'. Read as bytes and decoded
    once, so a non-UTF-8 byte cannot be silently replaced and compared equal."""
    with open(path, "rb") as fh:
        text = fh.read().decode("utf-8")
    return [ln for ln in text.split("\n") if not ln.startswith(">")]


def md5(lines):
    return hashlib.md5("\n".join(lines).encode("utf-8")).hexdigest()


def compare(mirror_path, live_path):
    """-> (exit code, list of report lines). No printing, so --selftest judges the same
    function the operator does."""
    if not os.path.exists(mirror_path):
        return REFUSED, ["REFUSED: no mirror at %s - nothing was compared" % mirror_path]
    if not os.path.exists(live_path):
        return LIVE_ABSENT, [
            "LIVE-ABSENT: the live file %s is not on this machine." % live_path,
            "             NOTHING WAS COMPARED. This is not a pass: a fresh clone and CI have no",
            "             live file, and check-all prints this row SKIP-FLAGGED, never OK.",
        ]

    body = body_lines(mirror_path)
    live = body_lines(live_path)
    if not [ln for ln in body if ln.strip()]:
        return REFUSED, ["REFUSED: %s has no body content - a 0-diff over an empty body is not"
                         " a measurement" % mirror_path]

    head = ["mirror : %s" % mirror_path, "live   : %s" % live_path]
    if body == live:
        return OK, head + [
            "body   : %d line(s), md5 %s" % (len(body), md5(body)),
            "live   : %d line(s), md5 %s" % (len(live), md5(live)),
            "OK: the body is byte-identical to the live file; 0 differing line(s).",
        ]

    out = head + [
        "body   : %d line(s), md5 %s" % (len(body), md5(body)),
        "live   : %d line(s), md5 %s" % (len(live), md5(live)),
        "DRIFT: the body is NOT the live file. Differing regions, body line(s) vs live line(s):",
    ]
    sm = difflib.SequenceMatcher(a=body, b=live, autojunk=False)
    regions = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        regions += 1
        out.append("  %-8s body %s / live %s" % (
            tag.upper(), _span(i1, i2), _span(j1, j2)))
        for ln in body[i1:i2]:
            out.append("    body: %s" % _clip(ln))
        for ln in live[j1:j2]:
            out.append("    live: %s" % _clip(ln))
    out.append("DRIFT: %d differing region(s). The mirror's body must be the live file verbatim;"
               " resync it, never renumber or reword a rule to make this green." % regions)
    return DRIFT, out


def _span(i1, i2):
    """1-based, inclusive line numbers for a difflib opcode (i2 is exclusive)."""
    if i2 - i1 == 0:
        return "none (insert at %d)" % i1
    if i2 - i1 == 1:
        return str(i1 + 1)
    return "%d-%d" % (i1 + 1, i2)


def _clip(s, n=110):
    s = s.replace("\t", " ")
    return s if len(s) <= n else s[:n] + "..."


# ------------------------------------------------------------------------------- selftest

def selftest():
    mirror_src = os.path.join(ROOT, "WORKFLOW.md")
    if not os.path.exists(mirror_src):
        print("REFUSED: --selftest needs this tree's WORKFLOW.md to build its scratch copies;"
              " there is none at %s" % mirror_src)
        return REFUSED
    tmp = tempfile.mkdtemp(prefix="antum-wfmirror-selftest-")
    cases, bad = [], 0

    def run_case(name, want, mirror, live, must_say=None):
        code, lines = compare(mirror, live)
        text = "\n".join(lines)
        good = code == want and (must_say is None or must_say in text)
        cases.append(good)
        print("  %s  %-46s exit=%d (want %d)%s" % (
            "ok " if good else "BAD", name, code, want,
            "" if must_say is None else "  must say %r" % must_say))
        if not good:
            for ln in lines:
                print("        | %s" % ln)
        return code, text

    try:
        mirror = os.path.join(tmp, "WORKFLOW.md")
        shutil.copyfile(mirror_src, mirror)
        # The scratch live file IS the mirror's stripped body - so OK is reachable, and every
        # later DRIFT is a difference from a state this instrument has already called green.
        live = os.path.join(tmp, "LIVE-WORKFLOW.md")
        with open(live, "wb") as fh:
            fh.write("\n".join(body_lines(mirror)).encode("utf-8"))

        run_case("control: the scratch pair is OK", OK, mirror, live, "byte-identical")

        # Plant 1 - a one-line drift in the LIVE file (the live file gained a rule).
        planted = "PLANT-2026-11-06 a rule the mirror does not have"
        with open(live, "ab") as fh:
            fh.write(("\n" + planted).encode("utf-8"))
        _, text = run_case("plant in the LIVE file -> DRIFT", DRIFT, mirror, live, "DRIFT")
        named = planted in text
        cases.append(named)
        print("  %s  the DRIFT report quotes the planted line" % ("ok " if named else "BAD"))
        with open(live, "wb") as fh:
            fh.write("\n".join(body_lines(mirror)).encode("utf-8"))

        # Plant 2 - a one-line drift in the MIRROR's body (the direction that actually
        # happened: a clone carrying text the live file no longer says). The victim is the
        # last non-final body line, and its index in the RAW file is computed by counting the
        # non-`>` lines, so the header's presence cannot shift the edit onto a header line.
        body = body_lines(mirror)
        victim = len(body) - 2                     # the last non-final body line
        assert body[victim].strip(), "the plant would be a blank line; pick another"
        # The marker goes at the START of the line on purpose: the report clips each side to
        # 110 characters, and a marker appended to the end of a long rule sat outside the clip
        # - the selftest found that, which is the reason it asserts on the text at all.
        stale = "STALE-WORDING " + body[victim]
        raw = open(mirror, "rb").read().decode("utf-8").split("\n")
        idx = [i for i, ln in enumerate(raw) if not ln.startswith(">")][victim]
        raw[idx] = stale
        with open(mirror, "wb") as fh:
            fh.write("\n".join(raw).encode("utf-8"))
        run_case("plant in the MIRROR body -> DRIFT", DRIFT, mirror, live, "STALE-WORDING")
        raw[idx] = body[victim]
        with open(mirror, "wb") as fh:
            fh.write("\n".join(raw).encode("utf-8"))

        # Plant 3 - a blank line only. `diff -B` calls this in sync; this instrument must not.
        with open(live, "ab") as fh:
            fh.write(b"\n")
        run_case("blank-line-only difference -> DRIFT (not diff -B)", DRIFT, mirror, live)
        with open(live, "wb") as fh:
            fh.write("\n".join(body_lines(mirror)).encode("utf-8"))

        # Non-finding - a `>` line added to the header must stay OK, or the header could not
        # be edited without reddening the gate.
        with open(mirror, "ab") as fh:
            fh.write(b"\n> a new header line a member added")
        run_case("non-finding: a new '>' header line -> OK", OK, mirror, live, "byte-identical")
        shutil.copyfile(mirror_src, mirror)

        # Absence - the live file is not on this machine. Never OK.
        run_case("absent live file -> exit 3, never OK", LIVE_ABSENT, mirror,
                 os.path.join(tmp, "NO-SUCH-LIVE.md"), "NOTHING WAS COMPARED")

        # Refusal - a mirror with no body content.
        empty = os.path.join(tmp, "EMPTY.md")
        with open(empty, "wb") as fh:
            fh.write(b"> only a header\n> and nothing else\n")
        run_case("empty body -> exit 2 REFUSED", REFUSED, empty, live, "REFUSED")

        # The CLI's own exit code, not just the function's: this is what check-all sees.
        p = subprocess.run([sys.executable, os.path.abspath(__file__),
                            "--mirror", mirror, "--live", os.path.join(tmp, "NO-SUCH-LIVE.md")],
                           capture_output=True, text=True)
        good = p.returncode == LIVE_ABSENT
        cases.append(good)
        print("  %s  the CLI exits 3 when the live file is absent (got %d)"
              % ("ok " if good else "BAD", p.returncode))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print("selftest: %d/%d case(s)" % (sum(1 for c in cases if c), len(cases)))
    return 0 if all(cases) else 1


def main(argv):
    ap = argparse.ArgumentParser(add_help=True, description=__doc__.split("\n")[0])
    ap.add_argument("--mirror", default=os.path.join(ROOT, "WORKFLOW.md"))
    ap.add_argument("--live", default=os.environ.get("ANTUM_LIVE_WORKFLOW", DEFAULT_LIVE))
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args(argv[1:])
    if a.selftest:
        return selftest()
    code, lines = compare(a.mirror, a.live)
    for ln in lines:
        print(ln)
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv))
