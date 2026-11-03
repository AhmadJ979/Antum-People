#!/usr/bin/env python3
"""
DOES THE BYTES THIS TREE SERVES PROVE WHERE THEY CAME FROM?

    python3 scripts/check-served-provenance.py                  # the DEPLOYED tree
    python3 scripts/check-served-provenance.py --tree <path>    # any tree with client/dist
    python3 scripts/check-served-provenance.py --selftest       # plant the four mutants

THE DEFECT THIS ANSWERS TO (measured, 2026-11-02 - not re-litigated here)
  `client/dist` is gitignored and untracked. A checkout does not touch it, `git status`
  stays clean, and `--restart-only` does not rebuild - so a build in the deployed tree
  publishes bytes with NO merge, NO movement and NO restart. It happened: the shared tree's
  `client/dist` was rebuilt at 22:55:44 from the unmerged #353 branch and the live product
  served `index-B3KFG1-j.js` (295,549 B, md5 b86ba75e…) for ~50 minutes. The recorded pair
  for the deployed revision (`index-vsGFc45L.js`, 290,272 B, md5 5145487f…) was NOT ON DISK;
  its URL fell through the SPA catch-all and answered 200 with HTML, which is why no status
  code and no HTTP instrument could have found it. Every check this team owned read SOURCE.
  WORKFLOW rule 43 said "build in a worktree" and a rule in a markdown file is not a guard.

WHAT IT READS
  Not the source, not the API, not a status code. Three things, on disk, in the tree named:
    <tree>/client/dist/index.html               the document a browser is given
    <tree>/client/dist/build-provenance.json    what the build recorded about itself
    <tree>/client/dist/**                       the bytes themselves, hashed here
  `build-provenance.json` is written by the build itself (client/vite.config.ts, a
  closeBundle hook), so `cd client && npm run build` still writes it - the gate command is
  unchanged.

WHAT IT ASSERTS, each comparison printing BOTH sides
  1. entry-match            the asset `index.html` names is the entry the provenance recorded.
                            This is tonight's exact shape: an `index.html` naming a bundle
                            that came from somewhere else.
  2. entry-on-disk          that asset exists on disk with the recorded byte size AND md5.
                            Read from the FILESYSTEM, never over HTTP: a missing asset
                            answers 200 with the SPA shell, so a status is not a measurement.
  3. referenced-match       every `/assets/...` `index.html` names (the CSS too) is in the
                            record, and the record names nothing `index.html` does not - so
                            an `index.html` rewritten by hand cannot pass.
  4. css-referenced         `index.html` names at least one stylesheet. A build emits one;
                            a document that references none is not a build's output.
  5. index-html-unchanged   `dist/index.html`'s own bytes match the record. Hand-editing the
                            script name back (the 23:45 restore) is a change to this file.
  6. revision-match         the provenance revision equals `git rev-parse HEAD` OF THE TREE
                            BEING MEASURED. This is the one that catches "a build happened at
                            a different revision" and "a merge landed but the build did not"
                            (`--restart-only` does not rebuild).
  7. no-unrecorded-asset    no file sits in `dist/assets/` that the record does not name -
                            a foreign build's leftover bundle is evidence of a foreign build.
  8. files-intact           every recorded file exists with its recorded size and md5.

  A tree with NO `build-provenance.json` is not a skip and not a pass: it is an UNPROVEN
  SERVE, and it exits 1 with the reason printed. A check that cannot redden on a missing
  record would have passed all night on 2026-11-02.

WHAT IT CANNOT PROVE, SAID PLAINLY
  * It proves the served bytes are the bytes THIS TREE'S OWN BUILD produced at THIS TREE'S
    revision. It does not prove the revision is a good one, merged, reviewed or on `main`.
    A build of an unmerged branch that is checked out cleanly records its own revision and
    passes - the guard is the revision comparison, and a branch build in a worktree (rule 43)
    is exactly the legitimate case that must pass.
  * A tree built while DIRTY records `dirty: true` and its modified paths, and this check
    PRINTS that but does not fail on it: a build of a working tree is a legitimate build.
    The revision comparison is what catches the incident's shape.
  * It does not read the network. Whether the running process is serving this `dist` at all
    is a different question, answered by scripts/observe-serve-pair.sh and
    scripts/check-served-render.js - those read the URL, this reads the disk.
  * It cannot tell whether anyone looked at the screen. A proven, rendered, wrong page is
    still wrong.

EXIT CODES
  0  proven: every comparison above holds.
  1  RED: a named mismatch, or UNPROVEN (no record), or a missing/edited asset.
  2  CANNOT-JUDGE: no such tree, no `client/dist`, not a git repository, git unavailable -
     the check could not read what it needs to judge. Never printed as a red verdict.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

DEPLOYED_TREE = "/home/team/shared/probable-octo-sniffle"
PROVENANCE = "build-provenance.json"
SCHEMA = 1
ASSET_REF_RE = re.compile(r'(?:src|href)="(/assets/[^"]+)"')
ENTRY_RE = re.compile(r'<script\b[^>]*\bsrc="(/assets/[^"]+)"')

EXIT_OK, EXIT_RED, EXIT_CANNOT_JUDGE = 0, 1, 2


# ------------------------------------------------------------------ small mechanics

def md5_of(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def git(tree, *args):
    """(stdout, why). Never raises: a missing git is a fact to report, not a crash."""
    try:
        p = subprocess.run(["git"] + list(args), cwd=tree, capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.SubprocessError) as exc:
        return None, "git could not run: %s" % exc
    if p.returncode != 0:
        msg = (p.stderr or p.stdout or "").strip()
        first = msg.splitlines()[0].strip() if msg else "exit %d" % p.returncode
        return None, "git %s -> %s" % (" ".join(args), first)
    return p.stdout.strip(), None


class Report:
    """Rows are printed in order; every comparison prints BOTH sides, never a verdict word."""

    def __init__(self):
        self.rows = []
        self.reds = 0
        self.unproven = 0
        self.cannot = 0
        self.oks = 0

    def ok(self, code, text):
        self.oks += 1
        self.rows.append(("ok", code, text))

    def red(self, code, text):
        self.reds += 1
        self.rows.append(("RED", code, text))

    def unproven_(self, code, text):
        self.unproven += 1
        self.rows.append(("UNPROVEN", code, text))

    def cannot_(self, code, text):
        self.cannot += 1
        self.rows.append(("CANNOT-JUDGE", code, text))

    def note(self, text):
        self.rows.append(("--", "", text))

    def dump(self):
        for kind, code, text in self.rows:
            if kind == "--":
                print("  %s" % text)
            else:
                print("  [%-12s] %-22s %s" % (kind, code, text))


def resolve_tree(argv):
    """--tree PATH, else $ANTUM_SERVED_TREE, else the deployed tree. No silent fallback."""
    tree = None
    if "--tree" in argv:
        i = argv.index("--tree")
        if i + 1 >= len(argv):
            return None, "--tree needs a path"
        tree = argv[i + 1]
    elif os.environ.get("ANTUM_SERVED_TREE"):
        tree = os.environ["ANTUM_SERVED_TREE"]
    elif os.path.isdir(DEPLOYED_TREE):
        tree = DEPLOYED_TREE
    if tree is None:
        return None, ("no tree named: the deployed tree %s is not on this host and neither "
                      "--tree nor $ANTUM_SERVED_TREE was given" % DEPLOYED_TREE)
    return os.path.abspath(tree), None


# ------------------------------------------------------------------ the measurement

def judge(tree):
    rep = Report()
    dist = os.path.join(tree, "client", "dist")
    print("served-provenance: tree=%s" % tree)
    print("                   dist=%s" % dist)

    if not os.path.isdir(tree):
        rep.cannot_("tree-missing", "%s is not a directory" % tree)
        return rep
    if not os.path.isdir(dist):
        rep.red("dist-missing", "%s does not exist - this tree cannot be serving a build at all" % dist)
        return rep

    html_path = os.path.join(dist, "index.html")
    prov_path = os.path.join(dist, PROVENANCE)

    # --- the document a browser is given
    if not os.path.isfile(html_path):
        rep.red("index-html-missing", "%s does not exist" % html_path)
        return rep
    html = open(html_path, encoding="utf-8").read()
    html_bytes, html_md5 = os.path.getsize(html_path), md5_of(html_path)
    refs = sorted({p.lstrip("/") for p in ASSET_REF_RE.findall(html)})
    m = ENTRY_RE.search(html)
    html_entry = m.group(1).lstrip("/") if m else None
    print("                   index.html: %d B, md5 %s, names %d asset(s), entry=%s"
          % (html_bytes, html_md5, len(refs), html_entry or "NONE"))

    # --- the record the build wrote about itself
    if not os.path.isfile(prov_path):
        rep.unproven_("provenance-missing",
                      "no %s in %s - this serve is UNPROVEN: nothing on disk says what this "
                      "build was, so the served bytes cannot be tied to a revision. "
                      "Proof is a real build at a real revision (cd client && npm run build "
                      "in THIS tree); a hand-written record would be the false assurance this "
                      "check exists to prevent." % (PROVENANCE, dist))
        return rep
    try:
        prov = json.load(open(prov_path, encoding="utf-8"))
    except (ValueError, OSError) as exc:
        rep.unproven_("provenance-unreadable", "%s could not be read: %s" % (prov_path, exc))
        return rep
    if not isinstance(prov, dict) or prov.get("schema") != SCHEMA:
        rep.red("provenance-schema", "%s schema=%r, this check reads schema %d"
                % (prov_path, prov.get("schema") if isinstance(prov, dict) else prov, SCHEMA))
        return rep
    recorded = prov.get("files") or {}
    prov_entry = prov.get("entry")
    prov_refs = sorted(prov.get("referenced") or [])
    prov_rev = prov.get("revision")
    print("                   provenance: built_at=%s dirty=%s files=%d"
          % (prov.get("built_at_utc"), prov.get("dirty"), len(recorded)))
    if prov.get("dirty"):
        rep.note("NOTE (not a failure): the build ran on a dirty tree - %d modified path(s) at "
                 "build time: %s" % (len(prov.get("dirty_files") or []),
                                     ", ".join(prov.get("dirty_files") or []) or "(not listed)"))

    # --- 1. the entry index.html names vs the entry the build recorded
    if html_entry == prov_entry:
        rep.ok("entry-match", "index.html names entry %s = provenance entry %s" % (html_entry, prov_entry))
    else:
        rep.red("entry-mismatch",
                "index.html names entry %s  |  provenance recorded entry %s  -> the document "
                "points at a bundle this build did not produce" % (html_entry, prov_entry))

    # --- 2/3/4. every asset the document names: recorded, on disk, right bytes
    if not refs:
        rep.red("no-asset-referenced", "index.html names 0 /assets/ paths - a build names at least one")
    for rel in refs:
        full = os.path.join(dist, rel)
        rec = recorded.get(rel)
        if rec is None:
            rep.red("asset-unrecorded", "%s is named by index.html and NOT in the provenance record" % rel)
        if not os.path.isfile(full):
            rep.red("asset-missing-on-disk",
                    "%s named by index.html, absent from disk (%s) - a request for it answers 200 "
                    "with the SPA shell, which is why this is read from the filesystem"
                    % (rel, full))
            continue
        size, digest = os.path.getsize(full), md5_of(full)
        if rec is None:
            continue
        if size == rec.get("bytes") and digest == rec.get("md5"):
            rep.ok("asset-intact", "%-28s %8d B  md5 %s   = recorded %8d B  md5 %s"
                   % (rel, size, digest, rec.get("bytes"), rec.get("md5")))
        else:
            rep.red("asset-drift",
                    "%-28s disk %8d B md5 %s  |  recorded %8d B md5 %s"
                    % (rel, size, digest, rec.get("bytes", -1), rec.get("md5")))
    if any(r.endswith(".css") for r in refs):
        rep.ok("css-referenced", "index.html names %d stylesheet(s): %s"
               % (sum(1 for r in refs if r.endswith(".css")),
                  ", ".join(r for r in refs if r.endswith(".css"))))
    else:
        rep.red("css-not-referenced",
                "index.html names 0 stylesheets (names: %s) - every build of this client emits one"
                % (", ".join(refs) or "none"))

    # --- 3b. the record must name exactly what the document names
    if refs == prov_refs:
        rep.ok("referenced-match", "index.html names %d asset(s) = provenance references %d: %s"
               % (len(refs), len(prov_refs), ", ".join(refs)))
    else:
        rep.red("referenced-mismatch",
                "index.html names [%s]  |  provenance references [%s]"
                % (", ".join(refs) or "none", ", ".join(prov_refs) or "none"))

    # --- 5. index.html's own bytes
    rec_html = recorded.get("index.html")
    if rec_html is None:
        rep.red("index-html-unrecorded", "index.html is not in the provenance record")
    elif rec_html.get("bytes") == html_bytes and rec_html.get("md5") == html_md5:
        rep.ok("index-html-unchanged", "index.html %d B md5 %s = recorded %d B md5 %s"
               % (html_bytes, html_md5, rec_html.get("bytes"), rec_html.get("md5")))
    else:
        rep.red("index-html-moved",
                "index.html disk %d B md5 %s  |  recorded %d B md5 %s - the document was edited "
                "after the build" % (html_bytes, html_md5, rec_html.get("bytes"), rec_html.get("md5")))

    # --- 6. the revision, read from the tree being measured
    head, why = git(tree, "rev-parse", "HEAD")
    if head is None:
        rep.cannot_("revision-unreadable",
                    "cannot read HEAD of %s: %s" % (tree, why))
    elif prov_rev is None:
        rep.red("revision-absent",
                "provenance revision is null (%s)  |  HEAD of this tree %s - a build that could "
                "not name its revision cannot prove what it built"
                % (prov.get("revision_reason"), head))
    elif prov_rev == head:
        rep.ok("revision-match", "provenance revision %s = HEAD of this tree %s" % (prov_rev, head))
    else:
        rep.red("revision-mismatch",
                "provenance revision %s  |  HEAD of this tree %s  -> the bytes on disk were built "
                "at a different revision than this tree is at (a merge landed without a rebuild, "
                "or the build came from somewhere else)" % (prov_rev, head))

    # --- 7. nothing in dist/assets/ that the record does not name
    assets_dir = os.path.join(dist, "assets")
    on_disk = sorted(f for f in os.listdir(assets_dir)) if os.path.isdir(assets_dir) else []
    extra = [f for f in on_disk if "assets/" + f not in recorded]
    if extra:
        rep.red("unrecorded-asset-on-disk",
                "%d file(s) in dist/assets/ that this build did not produce: %s"
                % (len(extra), ", ".join(extra)))
    else:
        rep.ok("no-unrecorded-asset", "dist/assets/ holds %d file(s), all named by the record: %s"
               % (len(on_disk), ", ".join(on_disk) or "none"))

    # --- 8. every recorded file, intact (covers fonts/, favicon, icons)
    missing, drifted, intact = [], [], 0
    for rel, rec in sorted(recorded.items()):
        full = os.path.join(dist, rel)
        if not os.path.isfile(full):
            missing.append(rel)
            continue
        size, digest = os.path.getsize(full), md5_of(full)
        if size == rec.get("bytes") and digest == rec.get("md5"):
            intact += 1
        else:
            drifted.append("%s disk %d B %s | recorded %s B %s"
                           % (rel, size, digest, rec.get("bytes"), rec.get("md5")))
    if missing:
        rep.red("recorded-file-missing", "%d recorded file(s) absent from disk: %s"
                % (len(missing), ", ".join(missing)))
    if drifted:
        rep.red("recorded-file-drift", "%d recorded file(s) changed since the build: %s"
                % (len(drifted), "; ".join(drifted)))
    if not missing and not drifted:
        rep.ok("files-intact", "%d/%d recorded file(s) on disk with the recorded size and md5"
               % (intact, len(recorded)))
    return rep


def summarise(rep):
    print()
    rep.dump()
    print()
    print("counts: %d comparison(s) OK, %d RED, %d UNPROVEN, %d CANNOT-JUDGE"
          % (rep.oks, rep.reds, rep.unproven, rep.cannot))
    if rep.cannot:
        print("VERDICT: CANNOT-JUDGE - this check could not read what it needs, which is not a "
              "red verdict and not a pass. exit 2")
        return EXIT_CANNOT_JUDGE
    if rep.reds or rep.unproven:
        names = [code for kind, code, _ in rep.rows if kind in ("RED", "UNPROVEN")]
        print("VERDICT: NOT PROVEN - %d finding(s): %s" % (len(names), ", ".join(names)))
        print("         each line above prints both sides of its comparison. exit 1")
        return EXIT_RED
    print("VERDICT: PROVEN - the served bytes are the bytes this tree's own build produced at "
          "this tree's revision. exit 0")
    return EXIT_OK


# ------------------------------------------------------------------ the mutant harness

def _write_fixture_provenance(dist, revision):
    """A fixture record in the SAME schema client/vite.config.ts writes.

    Deliberately a mirror, not the writer itself: the writer is a vite hook, and the
    agreement between the two is proved where it matters - by a real `npm run build` in a
    real tree followed by this check, which is green only if the schemas match. If they
    ever drift, that run reddens on the real record and says so by name.
    """
    files = {}
    for root, dirs, names in os.walk(dist):
        dirs.sort()
        for name in sorted(names):
            full = os.path.join(root, name)
            rel = os.path.relpath(full, dist).replace(os.sep, "/")
            if rel == PROVENANCE:
                continue
            files[rel] = {"bytes": os.path.getsize(full), "md5": md5_of(full)}
    html = open(os.path.join(dist, "index.html"), encoding="utf-8").read()
    m = ENTRY_RE.search(html)
    return {
        "schema": SCHEMA,
        "written_by": "scripts/check-served-provenance.py --selftest fixture",
        "built_at_utc": "2026-11-03T00:00:00Z",
        "revision": revision,
        "revision_reason": None,
        "git_top_level": None,
        "dirty": False,
        "dirty_reason": None,
        "dirty_files": [],
        "entry": m.group(1).lstrip("/") if m else None,
        "referenced": sorted({p.lstrip("/") for p in ASSET_REF_RE.findall(html)}),
        "files": files,
    }


FIXTURE_HTML = """<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Antum People</title>
    <script type="module" crossorigin src="/assets/index-FIXTURE1.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-FIXTURE1.css">
  </head>
  <body><div id="root"></div></body>
</html>
"""


def _git(tree, *args):
    subprocess.run(["git"] + list(args), cwd=tree, check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _build_fixture(base):
    """A scratch tree with a real git history, a dist, and a record in the real schema."""
    tree = os.path.join(base, "tree")
    dist = os.path.join(tree, "client", "dist")
    os.makedirs(os.path.join(dist, "assets"))
    os.makedirs(os.path.join(dist, "fonts"))
    open(os.path.join(tree, ".gitignore"), "w").write("client/dist\n")
    open(os.path.join(dist, "index.html"), "w").write(FIXTURE_HTML)
    open(os.path.join(dist, "assets", "index-FIXTURE1.js"), "w").write("console.log('fixture bundle')\n")
    open(os.path.join(dist, "assets", "index-FIXTURE1.css"), "w").write(":root{color-scheme:light}\n")
    open(os.path.join(dist, "favicon.svg"), "w").write("<svg xmlns='http://www.w3.org/2000/svg'/>\n")
    open(os.path.join(dist, "fonts", "fixture.woff2"), "wb").write(b"wOF2fixture")
    _git(tree, "init", "-q")
    _git(tree, "-c", "user.email=selftest@invalid", "-c", "user.name=selftest", "add", "-A")
    _git(tree, "-c", "user.email=selftest@invalid", "-c", "user.name=selftest",
         "commit", "-q", "-m", "fixture base")
    parent = subprocess.run(["git", "rev-parse", "HEAD"], cwd=tree, capture_output=True,
                            text=True, check=True).stdout.strip()
    _git(tree, "-c", "user.email=selftest@invalid", "-c", "user.name=selftest",
         "commit", "-q", "--allow-empty", "-m", "fixture head")
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=tree, capture_output=True,
                          text=True, check=True).stdout.strip()
    with open(os.path.join(dist, PROVENANCE), "w", encoding="utf-8") as f:
        json.dump(_write_fixture_provenance(dist, head), f, indent=2)
        f.write("\n")
    return tree, head, parent


def _run_check(tree):
    p = subprocess.run([sys.executable, os.path.abspath(__file__), "--tree", tree],
                       capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


def selftest():
    print("served-provenance --selftest: four mutants and a control, each on its own scratch tree")
    if shutil.which("git") is None:
        print("CANNOT-JUDGE: git is not on PATH, so no fixture can carry a revision")
        return EXIT_CANNOT_JUDGE
    base = tempfile.mkdtemp(prefix="served-provenance-selftest-")
    try:
        tree, head, parent = _build_fixture(base)
        print("  fixture: %s  HEAD=%s  parent=%s" % (tree, head[:12], parent[:12]))
        results = []

        def case(name, plant, want_exit, want_token, why):
            work = os.path.join(base, "mutant-" + name)
            shutil.copytree(tree, work, symlinks=True)
            plant(work)
            code, out = _run_check(work)
            hit = want_token in out
            good = (code == want_exit) and hit
            results.append((name, good, code, want_exit, want_token, hit, why, out))
            return good

        def plant_nothing(work):
            pass

        def plant_missing_entry(work):
            p = os.path.join(work, "client", "dist", "index.html")
            html = open(p, encoding="utf-8").read().replace("index-FIXTURE1.js", "index-GONE00000.js")
            open(p, "w").write(html)

        def plant_byte_flip(work):
            p = os.path.join(work, "client", "dist", "assets", "index-FIXTURE1.js")
            data = bytearray(open(p, "rb").read())
            data[0] ^= 0xFF
            open(p, "wb").write(bytes(data))

        def plant_moved_revision(work):
            p = os.path.join(work, "client", "dist", PROVENANCE)
            rec = json.load(open(p, encoding="utf-8"))
            rec["revision"] = parent
            json.dump(rec, open(p, "w", encoding="utf-8"), indent=2)

        def plant_no_record(work):
            os.remove(os.path.join(work, "client", "dist", PROVENANCE))

        def plant_stray_asset(work):
            open(os.path.join(work, "client", "dist", "assets", "index-FOREIGN.js"), "w").write("x\n")

        case("control-nothing-planted", plant_nothing, EXIT_OK, "VERDICT: PROVEN",
             "the untouched fixture is PROVEN - a harness with no green control proves nothing")
        case("a-entry-renamed-to-a-missing-asset", plant_missing_entry, EXIT_RED, "entry-mismatch",
             "tonight's shape: index.html names a bundle the build did not produce")
        case("b-one-byte-changed", plant_byte_flip, EXIT_RED, "asset-drift",
             "one byte flipped in the entry asset, both sizes and md5s printed")
        case("c-provenance-revision-moved-off-HEAD", plant_moved_revision, EXIT_RED, "revision-mismatch",
             "a build at a different revision than the tree it sits in")
        case("d-no-provenance-record", plant_no_record, EXIT_RED, "provenance-missing",
             "an unproven serve is a failure, never a skip")
        case("e-stray-asset-in-dist-assets", plant_stray_asset, EXIT_RED, "unrecorded-asset-on-disk",
             "a foreign build's leftover bundle is named")

        # an unknown flag must never buy a green run
        p = subprocess.run([sys.executable, os.path.abspath(__file__), "--trust-me"], capture_output=True, text=True)
        unknown_ok = p.returncode == EXIT_CANNOT_JUDGE
        print("  %s  unknown-flag --trust-me -> exit %d (must be %d)"
              % ("ok " if unknown_ok else "BAD", p.returncode, EXIT_CANNOT_JUDGE))

        print()
        bad = 0 if unknown_ok else 1
        for name, good, code, want_exit, token, hit, why, out in results:
            if not good:
                bad += 1
                print("  BAD  %-42s exit %s (wanted %s), token %r %s"
                      % (name, code, want_exit, token, "found" if hit else "NOT FOUND"))
                for line in out.splitlines():
                    if "VERDICT" in line or "[" in line:
                        print("         | %s" % line.strip()[:150])
            else:
                print("  ok   %-42s exit %s, %r named" % (name, code, token))
            print("       why: %s" % why)
        print()
        print("selftest: %d/%d mutants behaved as declared, control green, unknown flag refused"
              % (len(results) - sum(1 for r in results if not r[1]), len(results)))
        return EXIT_RED if bad else EXIT_OK
    finally:
        shutil.rmtree(base, ignore_errors=True)


# ------------------------------------------------------------------ entry point

def main(argv):
    if "--help" in argv or "-h" in argv:
        print(__doc__)
        return EXIT_OK
    if "--selftest" in argv:
        return selftest()
    known = {"--tree"}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in known:
            i += 2
            continue
        print("CANNOT-JUDGE: unknown argument %r - this check will not judge on an invocation it "
              "did not understand (see --help)" % a)
        return EXIT_CANNOT_JUDGE
    tree, why = resolve_tree(argv)
    if tree is None:
        print("CANNOT-JUDGE: %s" % why)
        return EXIT_CANNOT_JUDGE
    return summarise(judge(tree))


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
