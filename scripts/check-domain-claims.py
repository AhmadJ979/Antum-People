#!/usr/bin/env python3
"""
NO DOCUMENT MAY CLAIM WE OWN A DOMAIN WE DO NOT HOLD. THIS IS THE THING THAT NOTICES ONE THAT DOES.

    python3 scripts/check-domain-claims.py                 # judge every tracked .md in this repository
    python3 scripts/check-domain-claims.py --root DIR      # judge another tree (the proof does)
    python3 scripts/check-domain-claims.py --selftest      # plant the claim in a scratch tree, require RED

WHY THIS FILE EXISTS (the false claim it was written for)
  Until 2026-11-02 `design-concepts/BRAND-IDENTITY.md` line 9 read:

      - **Domains (registered & owned by Antum):** `antum.ae` (UAE), `antum.me` (global). ...

  That clause is **false**. A registrar check on 2026-11-02 returned AVAILABLE=FALSE for both names:
  `antum.ae` and `antum.me` are held by third parties, `getantum.com` is taken too, and **the business
  has bought no domain at all**. The product is served on a platform hostname; a real domain is an open
  owner decision (decision 9). `README.md` carried the same assertion in its "Primary Domains" line and
  listed the contact addresses with no caveat, and `legal-signoff-checklist.md` carried it a third time
  ("Domains ... are registered"). All three were corrected on 2026-11-02. This check exists so a fourth
  cannot appear quietly - the repository's own rule is that **a defect fixed silently is
  indistinguishable from one never found**, and that **a fix that stops a defect recurring does not
  clean the instances already stored - go and look**. This is the "go and look", made repeatable.

WHAT IT ASSERTS, AND HOW
  Every tracked `*.md` is read line by line. A line is a VIOLATION when it attaches an ownership or
  registration claim to Antum - "registered/owned/bought/held ... by/to Antum", "Antum owns/holds/... a
  domain", "the domains ... are registered/owned" - **and** the same line names a domain (a
  `.ae`/`.me`/`.com`/`.io`/`.app`/`.net`/`.org`/`.co`/`.dev` token) or the word "domain". It prints the
  file and the line number, and a bounded excerpt of the offending line.

  THE NEGATION RULE, WHICH IS WHAT MAKES THE CORRECTED TEXT PASSABLE. The corrected sentences say the
  thing that is true - "**no domain is registered to Antum**", "Antum holds **no** domain" - and a check
  that cannot tell an assertion from its denial would redden on the fix. So a match is dropped when a
  negation token (`no`, `not`, `none`, `never`, `neither`, `cannot`, `isn't`, `aren't`) appears in the
  clause before the match or inside the match itself. This is a deliberate FALSE-NEGATIVE margin: a line
  that both denies and asserts ownership is not caught here. It is stated rather than hidden.

WHAT IT DOES NOT SEE (stated so a green is not read as more than it is)
  * It judges TEXT, not the world. It cannot know whether a registrar released a name yesterday; it only
    knows that no document asserts a holding without denying it.
  * It reads `.md` only. The served documents under `templates/` and the client's strings are judged by
    other instruments (`check-counsel-strings.py`, the served-document renderer), not by this one.
  * It says nothing about whether a mailbox exists. `dpo@antum.ae` being reserved is asserted in prose by
    the documents themselves; this check does not verify DNS or MX.
  * A line inside a FENCED code block (```) is a QUOTATION, not an assertion: the evidence record for
    this very fix has to show the false sentence verbatim, and a check that reddens on its own evidence
    would be a check nobody can run. Fenced lines are COUNTED and printed as `quoted in a fence`, never
    judged. This is a rule about the form the text takes, not about which path it sits in - exempting a
    directory would be the vacuous-green trap, and a claim written as the document's own prose is judged
    wherever it lives.
  * A dated evidence transcript whose prose (not a fence) repeats the claim is NOT exempt: it is reported
    and a human decides whether the record or the sentence moves.

COUNTS, NOT A VERDICT (an instrument that measures nothing exits 0)
  Every run prints: files scanned, lines scanned, ownership claims matched (before the negation rule),
  denials skipped, and violations. A run that scanned no file is CANNOT-JUDGE, never OK.

EXIT CODES (the team's three)
  0  OK: at least one file scanned, zero violations
  1  RED: at least one violating line, each named as `path:line` with its excerpt
  2  CANNOT-JUDGE: the root is missing, is not a directory, or holds no markdown at all

WHO RUNS IT
  OPERATOR: `python3 scripts/check-domain-claims.py` (bare) and through `scripts/check-all.py`, which is
  where it is wired as a default check. NOT run by the movement: `scripts/cutover-preflight.sh` runs no
  `.py`, and a docs check able to abort a product deploy would invert the rule that a docs-only delta owes
  no movement. IT IS NOT A MONITOR: nothing schedules it; it notices a false claim when it is run.
"""
import argparse
import os
import re
import subprocess
import sys

OK, RED, CANNOT_JUDGE = 0, 1, 2

# A domain-ish token. Deliberately broad (any 2-10 letter TLD from this list) so a new name we buy or
# quote is judged without editing the check. It is a shape, not a list of the names we care about today.
DOMAIN_RE = re.compile(r"\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:ae|me|com|io|app|net|org|co|dev)\b",
                       re.I)

CLAIM_PATTERNS = [
    # "registered & owned by Antum", "owned by Antum", "registered to Antum", "held by Antum"
    re.compile(r"\b(?:registered|owned|bought|purchased|acquired|held)\b[^.\n]{0,60}?\b(?:by|to)\s+Antum\b",
               re.I),
    # "Antum owns/holds/registered a domain", "Antum holds antum.ae"
    re.compile(r"\bAntum\s+(?:owns|holds|has\s+registered|registered|bought|purchased)\b[^.\n]{0,40}?"
               r"\b(?:domains?|antum\.)", re.I),
    # "the Domains ... are registered/owned", "Domains ... is ours"
    # `[^\n]`, NOT `[^.\n]`: the thing between "Domains" and "are registered" is a domain NAME, and a
    # domain name contains dots - the first cut of this pattern therefore missed the very line it was
    # written for (`Domains` `antum.ae` / `antum.me` `are registered`). Measured, not guessed.
    re.compile(r"\bdomains?\b[^\n]{0,40}?\b(?:are|is)\s+(?:registered|owned|ours)\b", re.I),
    # "**Primary Domains**: antum.ae (UAE), antum.me (global)" - the README's own shape, which names
    # our domains as a fact and says nothing about holding them. A label followed by a domain name.
    re.compile(r"\bprimary\s+domains?\b[^.\n]{0,40}?\b[a-z0-9][a-z0-9-]*\.(?:ae|me|com|io|app|net|org|co|dev)\b",
               re.I),
]

NEGATION_RE = re.compile(r"\b(?:no|not|none|never|neither|cannot|isn't|aren't|nor)\b", re.I)


def is_violation(line):
    """Return (matched_text, reason) for a line that asserts ownership, or None."""
    if not DOMAIN_RE.search(line) and "domain" not in line.lower():
        return None
    for pat in CLAIM_PATTERNS:
        for m in pat.finditer(line):
            prefix = line[:m.start()]
            if NEGATION_RE.search(prefix) or NEGATION_RE.search(m.group(0)):
                return ("DENIAL", m.group(0))   # counted, never a violation
            return ("CLAIM", m.group(0))
    return None


def markdown_files(root):
    """Tracked markdown if `root` is a git worktree (so an untracked scratch file is not judged),
    every `*.md` under the root otherwise. Returns (paths, mode)."""
    if os.path.isdir(os.path.join(root, ".git")) or os.path.isfile(os.path.join(root, ".git")):
        out = subprocess.run(["git", "-C", root, "ls-files", "-z", "--", "*.md"],
                             capture_output=True, check=True).stdout
        names = [n for n in out.decode("utf-8", "replace").split("\0") if n]
        return [os.path.join(root, n) for n in names], "git ls-files (tracked markdown only)"
    paths = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules")]
        for fn in filenames:
            if fn.endswith(".md"):
                paths.append(os.path.join(dirpath, fn))
    paths.sort()
    return paths, "os.walk (every *.md under the root)"


def run(root, verbose_header=True):
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if verbose_header:
        print("domain-claim check - no document may claim a domain we do not hold")
        print("  rule        : a line that attaches 'registered/owned/bought/held ... by/to Antum', "
              "'Antum owns/holds a domain',")
        print("                or 'the domains ... are registered/owned' to a domain name is RED, unless "
              "the clause denies it")
        print("  tree judged : %s" % root)
        print("  NOT a monitor: nothing schedules it; it notices a false claim when it is run.")

    if not os.path.exists(root):
        print("CANNOT-JUDGE: %s does not exist - not a pass, an unjudged tree. exit 2" % root)
        return CANNOT_JUDGE, {}
    if not os.path.isdir(root):
        print("CANNOT-JUDGE: %s is not a directory. exit 2" % root)
        return CANNOT_JUDGE, {}

    try:
        files, mode = markdown_files(root)
    except Exception as e:                                    # git present but unusable
        print("CANNOT-JUDGE: the file list could not be read from %s (%s). exit 2" % (root, e))
        return CANNOT_JUDGE, {}

    violations, claims, denials, lines_scanned, fenced = [], 0, 0, 0, 0
    for path in files:
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                in_fence = False
                for n, line in enumerate(f, 1):
                    lines_scanned += 1
                    if line.lstrip().startswith("```"):
                        in_fence = not in_fence
                        continue
                    if in_fence:
                        fenced += 1
                        continue
                    verdict = is_violation(line)
                    if verdict is None:
                        continue
                    kind, text = verdict
                    claims += 1
                    if kind == "DENIAL":
                        denials += 1
                        continue
                    rel = os.path.relpath(path, root)
                    violations.append((rel, n, text, line.rstrip()))
        except OSError as e:
            # a file the check cannot read is not a file it judged: refuse the whole run rather than
            # report a green over a tree it only partly saw
            print("CANNOT-JUDGE: %s could not be read (%s). exit 2" % (path, e))
            return CANNOT_JUDGE, {}

    print("  files scanned          : %d  (%s)" % (len(files), mode))
    print("  lines scanned          : %d" % lines_scanned)
    print("  ownership claims seen  : %d  (matches of the claim shapes, before the negation rule)" % claims)
    print("  denials skipped        : %d  (a clause that denies ownership is not a claim)" % denials)
    print("  quoted in a fence      : %d  (lines inside ``` - a quotation, counted and not judged)" % fenced)
    print("  violations             : %d" % len(violations))
    for rel, n, text, line in violations:
        print("      RED   %s:%d" % (rel, n))
        print("            claim: %r" % text)
        print("            line : %s" % (line[:200] + ("..." if len(line) > 200 else "")))

    if len(files) == 0:
        print("CANNOT-JUDGE: no markdown was found under %s - a check that judged nothing cannot be "
              "green. exit 2" % root)
        return CANNOT_JUDGE, {"files": 0}

    counts = {"files": len(files), "lines": lines_scanned, "claims": claims,
              "denials": denials, "violations": len(violations)}
    if violations:
        print("FAIL: %d line(s) assert a domain holding the business does not have. Antum holds NO "
              "domain: `antum.ae` and `antum.me` are held by third parties and are not purchasable, and "
              "the product's domain is an open owner decision." % len(violations))
        return RED, counts
    print("OK: %d files / %d lines scanned, %d claim(s) matched, %d denial(s) skipped, 0 violations."
          % (len(files), lines_scanned, claims, denials))
    return OK, counts


def selftest():
    """Plant the claim in a scratch tree and require RED; require the corrected wording to stay GREEN.

    A check that cannot redden proves nothing, so the plant is the point. Nothing here touches the
    repository: the scratch tree is under /tmp and is removed at the end."""
    import shutil
    import tempfile

    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    base = tempfile.mkdtemp(prefix="domain-claims-selftest-")
    fails = []

    # 1. THE PLANT: the exact sentence this check was written for, in a file of its own.
    planted = ("# Brand\n"
               "- **Domains (registered & owned by Antum):** `antum.ae` (UAE), `antum.me` (global). "
               "No DNS records published yet.\n")
    d = os.path.join(base, "plant")
    os.makedirs(d)
    with open(os.path.join(d, "BRAND.md"), "w", encoding="utf-8") as f:
        f.write(planted)
    print("\n--- selftest case: plant (the 2026-11-02 false sentence) ---")
    out = run(d, verbose_header=False)
    print("    exit=%d (want 1)" % out[0])
    if out[0] != RED:
        fails.append("plant: exit %d, wanted RED (1)" % out[0])

    # 2. CONTROL - the corrected wording must stay GREEN, or the check reddens on the fix itself.
    fixed = ("# Brand\n"
             "- **Domains:** **no domain is registered to Antum** - the business holds none. `antum.ae` "
             "and `antum.me` are intended names held by third parties; the product's domain is undecided.\n"
             "- **Contact emails:** `privacy@antum.ae` - reserved, not provisioned.\n")
    d = os.path.join(base, "fixed")
    os.makedirs(d)
    with open(os.path.join(d, "BRAND.md"), "w", encoding="utf-8") as f:
        f.write(fixed)
    print("\n--- selftest case: corrected wording (must stay green) ---")
    out = run(d, verbose_header=False)
    print("    exit=%d (want 0)" % out[0])
    if out[0] != OK:
        fails.append("corrected wording: exit %d, wanted OK (0)" % out[0])

    # 3. The third site's old shape - a bare "the Domains ... are registered" - must redden too.
    third = "# Sign-off\n- **Domains** `antum.ae` / `antum.me` are registered; no website is asserted.\n"
    d = os.path.join(base, "third")
    os.makedirs(d)
    with open(os.path.join(d, "checklist.md"), "w", encoding="utf-8") as f:
        f.write(third)
    print("\n--- selftest case: the bare 'domains ... are registered' shape ---")
    out = run(d, verbose_header=False)
    print("    exit=%d (want 1)" % out[0])
    if out[0] != RED:
        fails.append("third shape: exit %d, wanted RED (1)" % out[0])

    # 4. A tree with no markdown at all must be CANNOT-JUDGE, never a green.
    d = os.path.join(base, "empty")
    os.makedirs(d)
    with open(os.path.join(d, "notes.txt"), "w", encoding="utf-8") as f:
        f.write("nothing to judge\n")
    print("\n--- selftest case: no markdown at all ---")
    out = run(d, verbose_header=False)
    print("    exit=%d (want 2)" % out[0])
    if out[0] != CANNOT_JUDGE:
        fails.append("empty tree: exit %d, wanted CANNOT-JUDGE (2)" % out[0])

    shutil.rmtree(base, ignore_errors=True)

    # 5. And the repository this script lives in must itself be green, or the check ships a red tree.
    print("\n--- selftest case: this repository ---")
    out = run(here)
    print("    exit=%d (want 0)" % out[0])
    if out[0] != OK:
        fails.append("this repository: exit %d, wanted OK (0)" % out[0])

    print("")
    if fails:
        print("SELFTEST FAILED (%d):" % len(fails))
        for f in fails:
            print("    %s" % f)
        return RED
    print("SELFTEST OK: the plant reddens, the corrected wording stays green, an empty tree is "
          "CANNOT-JUDGE, and this repository is green.")
    return OK


def main(argv):
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--root", default=None, help="the tree to judge (default: the repository of this script)")
    ap.add_argument("--selftest", action="store_true", help="prove the check can redden, on scratch trees")
    args = ap.parse_args(argv[1:])
    if args.selftest:
        return selftest()
    root = os.path.abspath(args.root) if args.root else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    rc, _ = run(root)
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv))
