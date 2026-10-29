#!/usr/bin/env python3
"""
verify-access-model.py — re-derive every claim in docs/access-model.md.

Why this is a file and not a shell one-liner: a check that scrolls away is a claim, not a
check. The previous pass reported "77 claims hold" from a heredoc and the reviewer could not
re-run it (recorded as a gotcha in skills/antum-claims-verifier-reddening).

It reads every `file:line` citation out of the document, asserts the content at that line in
the tree it is told to measure, and separately evaluates the merged access module so the
resource/structure claims are measured rather than described.

**Since 2026-10-20 the STRUCTURAL claims are read OUT OF THE DOCUMENT and compared to the
measurement (section 3b).** Before that the numbers lived only in this file's head, and the
consequence was measured by the lead: a copy of the document asserting "all **16** resources",
"every cell is still `[admin]`, so nothing has been granted" and "the coarse cell is two cells"
scored **103/103, exit 0** against the very tree that refutes all three — because `VERIFY_DOC`
could not change a verdict. The lesson is one level up from "a check that cannot be reddened
proves nothing": **a check that never reads its subject proves nothing about its subject.** The
fixture for that lesson is in the repository and needs no invention:
`git show ca681dd:docs/access-model.md > /tmp/prev.md`, then judge it — it must FAIL.

**Shell gotcha, hit twice for real:** a `!` inside a double-quoted string in an interactive
shell triggers history expansion and kills the command mid-run (`bash: !r.resource: event not
found`). Section 3b asserts the document's ```sh blocks are `!`-free so a future edit cannot
reintroduce it. Never write `!` inside double quotes in a printed command.

Usage:
    python3 verify-access-model.py                     # judge the working tree HEAD, its own doc
    VERIFY_TREE=<rev> python3 verify-access-model.py   # judge another tree (pin ITS doc too, below)
    VERIFY_DOC=<path> python3 verify-access-model.py   # judge another copy of the doc

Exit 0 only if every claim holds. Prints one OK/FAIL line per claim plus a summary.
Exit 1 = a claim FAILED.  Exit 2 = CANNOT-JUDGE: the document judged is not the document at the
tree judged (a HYBRID run), or the revision does not resolve. The headline always names the
resolved sha the content came from, never a ref name.
operator form : python3 scripts/verify-access-model.py  (bare; root derived from this file's own location)
also run as a GATE by : server/access-model-instrument.test.js (the suite) and scripts/check-all.py
NOT run by : the movement (scripts/cutover-preflight.sh) - a scripts/docs check must not abort a deploy

**Since 2026-10-26 a LINE NUMBER IS A HINT, never the assertion (rows becc12ff / 39a63c38).**
Every claim resolves its SYMBOL in the file at the tree under judgement and asserts it is there;
the recorded line only picks between occurrences, and is reported when it is out of date rather
than enforced. Before this, a merge that inserted lines near the top of a served file reddened
every claim below it, and three separate re-grounds were spent re-typing numbers a machine could
follow. What can still redden: a symbol that is gone or renamed, an ambiguous resolution, and a
document that no longer cites the site at all. What cannot: a line that merely moved. The controls
are in docs/evidence/content-anchored-citations-2026-10-26/ - including the one that MUST redden
(a renamed symbol) and the one that MUST NOT (the same file with lines inserted above it).
"""
import os, re, subprocess, sys, json, tempfile, hashlib

SUBJECT_DOC = "docs/access-model.md"   # the repo path of the document this checker judges
DOC = os.environ.get("VERIFY_DOC", SUBJECT_DOC)
_VERIFY_TREE = os.environ.get("VERIFY_TREE") or None


def resolve_rev(ref):
    """A REF is not evidence - resolve it to the sha the content actually comes from.

    A ref can move between the run and the reading (`origin/main` did, twice, on 2026-10-26), and a
    headline that names a ref does not say which bytes were judged. Accepts a commit or a tree sha.

    `@HEAD` is NOT a git revision - `rev-parse`, `git log` and `git grep` all reject it ("fatal:
    invalid object name '@HEAD'"). It is the marker scripts/check-all.py passes, meaning "the tree this
    run names", so read it that way. Measured on 2026-10-26: without this, the operator entry point's
    model check judged NOTHING - 13/111 checks with 98 FAILs, every one of them "not in @HEAD", which
    check-all could only report as one red check. The string was asserted by a test; that it WORKED
    was asserted by nothing.
    """
    if ref.startswith('@'):
        ref = ref[1:] or 'HEAD'
    for spec in (ref + "^{commit}", ref + "^{tree}"):
        r = subprocess.run(["git", "rev-parse", "--verify", "--quiet", spec],
                           capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    return None


# THE HYBRID DEFECT (row 7daa1d44). This checker reads the CODE from a revision (`git show <TREE>:...`)
# and the DOCUMENT from the working copy. When those are two different revisions - any branch that
# changes `server/` and the doc together, which #306 was - one run judges one tree's code against
# another tree's document and prints ONE clean headline. It defaulted to `origin/main` while reading
# the document beside itself, so a run inside a branch was a hybrid even when it looked right (it was
# right only because the code content happened to be identical on both sides). The default is now the
# working tree's own HEAD, and a run whose document is not the document at the judged revision is
# REFUSED (exit 2, CANNOT-JUDGE) rather than reported. `VERIFY_TREE=<rev>` still judges another tree -
# pin that tree's own document with `VERIFY_DOC` and the pair is honest again.
TREE_REF = _VERIFY_TREE or "HEAD"
TREE = resolve_rev(TREE_REF)

# Every claim: (file, line HINT, substring that must RESOLVE in that file, label).
# The hint is not the assertion - see `resolve()` below.
# These are the *content* assertions; the structural ones live in check_module() below.
CLAIMS = [
    ("server/index.js", 156, "Protect all /api routes except login", "gate comment"),
    ("server/index.js", 168, "access.gate(req, res, next)", "gate mount"),
    ("server/index.js", 150, "access_role: user.access_role", "login response carries the role"),
    ("server/auth.js", 92, "access_role: user.access_role", "the role claim in the token"),
    ("server/access.js", 73, "const ROLES", "the role table"),
    ("server/access.js", 74, "HR_ADMIN", "hr_admin exists"),
    ("server/access.js", 78, "COMPLIANCE_VIEWER", "compliance_viewer exists (five roles)"),
    ("server/access.js", 91, "const POLICY", "the policy table"),
    ("server/access.js", 95, "ROLES.HR_ADMIN, ROLES.MANAGER, ROLES.FINANCE", "roster cell: three roles"),
    ("server/access.js", 125, "read-only", "the contradiction this document had, named for its owner"),
    ("server/access.js", 155, "const PENDING_CELLS", "the not-yet-expressible marks"),
    ("server/access.js", 169, "const COUNSEL_PENDING", "the counsel-pending marks"),
    ("server/access.js", 182, "const SCOPE", "all / reports / own"),
    ("server/access.js", 189, "const SCOPES", "the scope table"),
    ("server/access.js", 193, "REPORTS", "a manager does not include self, asserted"),
    ("server/access.js", 213, "EMPLOYEE_FIELD_GROUPS", "the field groups"),
    ("server/access.js", 224, "FIELD_RULES", "which role loses which group"),
    ("server/access.js", 235, "TEMPLATE_SCOPES", "settlement documents only"),
    ("server/access.js", 250, "const ROUTES", "the route table"),
    ("server/access.js", 388, "function scopeFor", "scopeFor"),
    ("server/access.js", 396, "function scopedAllows", "scopedAllows"),
    ("server/access.js", 404, "function fieldsRemovedFor", "fieldsRemovedFor"),
    ("server/access.js", 421, "function unpoliciedRoutes", "unpolicied check"),
    ("server/access.js", 437, "function gate", "the gate"),
    ("server/access.js", 448, "allowed.indexOf(req.user.access_role)", "the gate reads the role"),
    ("server/index.js", 123, "app.post('/api/login'", "login route (public)"),
    ("server/index.js", 187, "async function callerEmployeeId", "the caller's link"),
    ("server/index.js", 198, "async function relationTo", "self / report / other, resolved"),
    ("server/index.js", 214, "async function scopeAllowsTarget", "the scope refusal helper"),
    ("server/index.js", 221, "const actorOf", "one actor convention"),
    ("server/index.js", 236, "app.get('/api/users'", "accounts list route"),
    ("server/index.js", 238, "access_role", "accounts payload, no password hash"),
    ("server/index.js", 246, "app.post('/api/users'", "account creation route"),
    ("server/index.js", 256, "access.isKnownRole", "unknown role is refused"),
    ("server/index.js", 287, "INSERT INTO audit_logs", "account creation is logged"),
    ("server/index.js", 299, "app.get('/api/employees'", "roster route"),
    ("server/index.js", 315, "SCOPE.REPORTS", "the manager's line filter"),
    ("server/index.js", 321, "SELECT * FROM employees", "roster selects the whole row"),
    ("server/index.js", 327, "fieldsRemovedFor", "the field half of the cell"),
    ("server/index.js", 336, "auth.decrypt(row.national_id_value)", "decrypts only what is served"),
    ("server/index.js", 359, "app.post('/api/employees'", "create employee"),
    ("server/index.js", 367, "a named actor is required to create an employee", "unnamed actor refused (400)"),
    ("server/index.js", 420, "INSERT INTO audit_logs", "employee create audit"),
    ("server/index.js", 436, "app.put('/api/employees/:id'", "update employee"),
    ("server/index.js", 444, "a named actor is required to update an employee", "unnamed actor refused (400)"),
    ("server/index.js", 527, "INSERT INTO audit_logs", "employee update audit"),
    ("server/index.js", 546, "/api/employees/:id/onboarding", "onboarding read"),
    ("server/index.js", 550, "scopeAllowsTarget", "the read is scoped"),
    ("server/index.js", 566, "app.put('/api/onboarding-tasks/:id'", "the tick route"),
    ("server/index.js", 576, "a named actor is required to complete a task", "the tick refuses an unnamed actor"),
    ("server/index.js", 587, "/api/employees/:id/offboarding", "offboarding read"),
    ("server/index.js", 599, "app.put('/api/offboarding-tasks/:id'", "offboarding write"),
    ("server/index.js", 615, "calculate-eosb", "eosb, stateless"),
    ("server/index.js", 624, "app.get('/api/compliance/notice'", "the notice route"),
    ("server/index.js", 653, "app.get('/api/compliance/templates/", "settlement documents"),
    ("server/index.js", 660, "templatesAllowedFor", "which documents a role may render"),
    ("server/index.js", 665, "SELECT * FROM employees", "templates read one employee"),
    ("server/index.js", 668, "auth.decrypt(emp.national_id_value)", "templates decrypt the national ID"),
    ("server/index.js", 769, "app.get('/api/analytics/dashboard'", "analytics route"),
    ("server/index.js", 776, "SELECT * FROM employees", "analytics reads the whole roster"),
    ("server/index.js", 954, "app.post('/api/exit-interviews'", "exit route"),
    ("server/index.js", 977, "status = 'terminated'", "exit terminates employment"),
    ("server/index.js", 998, "app.post('/api/preboarding/cases'", "case creation"),
    ("server/index.js", 1005, "a named actor is required to record an offer acceptance", "case refuses an unnamed actor"),
    ("server/index.js", 1028, "app.get('/api/preboarding/cases'", "the case LIST"),
    ("server/index.js", 1043, "app.get('/api/preboarding/cases/:id'", "ONE case"),
    ("server/index.js", 1071, "checklist/overview", "the roll-up"),
    ("server/index.js", 1079, ":id/checklist", "checklist"),
    ("server/index.js", 1094, ":id/workspace", "workspace"),
    ("server/index.js", 1105, "items/:itemKey/status", "item status"),
    ("server/index.js", 1125, "reminders", "reminders"),
    ("server/index.js", 1154, "notice-acknowledgements", "acknowledgement route"),
    ("server/index.js", 1214, ":id/package'", "package"),
    ("server/index.js", 1225, "package/:itemKey/acknowledgement", "package acknowledgement"),
    ("server/index.js", 1245, "flag-watch", "flag watch"),
    ("server/preboarding-items.js", 360, "recorded_by", "the module reads the actor"),
    ("server/preboarding-items.js", 363, "recorded_by is required", "and REFUSES an unnamed one"),
    ("server/schema.sql", 187, "CREATE TABLE IF NOT EXISTS users", "users table"),
    ("server/schema.sql", 189, "username TEXT UNIQUE", "username is unique"),
    ("server/schema.sql", 191, "access_role TEXT", "the rename LANDED"),
    ("server/schema.sql", 193, "employee_id TEXT", "employee_id exists, nullable, last"),
    ("server/schema.sql", 200, "CREATE TABLE IF NOT EXISTS preboarding_cases", "cases table"),
    ("server/schema.sql", 213, "created_by", "case created_by"),
    ("server/schema.sql", 334, "recorded_by TEXT NOT NULL", "the NOT NULL constraint"),
    ("server/db.js", 134, "POST_MIGRATION_INDEXES", "constraints that cannot live in schema.sql"),
    ("server/db.js", 138, "idx_users_employee_id_unique", "one account per person, as an index"),
    ("server/db.js", 138, "WHERE employee_id IS NOT NULL", "partial, so NULL links stay legal"),
    ("server/db.js", 124, "nullable, unique when set", "why it is post-migration, not in schema.sql"),
]

def git_show(path):
    r = subprocess.run(["git", "show", f"{TREE}:{path}"], capture_output=True, text=True)
    if r.returncode != 0:
        return None
    return r.stdout.splitlines()

# The page's citations that this checker compares against the tree — the `[doc citation]` family.
# Named as data on 2026-10-20 so the §10.2 partition check below counts the SAME list this loop
# enforces: two readers of one list drift apart, one list cannot.
DOC_CITATIONS = [
        ("index.js:921", "server/index.js", "a named actor is required to record an offer acceptance",
         "§5.2 rule 3 cites the refusal itself, not the comment above it"),
        # Added 2026-10-20, after a merge MOVED this file's lines under the document: the checker's own
        # tree claims for server/preboarding-items.js reddened (343/346 -> 360/363) while the document's
        # citations to the same file passed silently. One citation per site is enforced here; when a move
        # reddens these, the other citations on that site are re-derived by measurement, not arithmetic.
        ("preboarding-items.js:360-364", "server/preboarding-items.js", "recorded_by",
         "§5.1 cites the module's own actor read and its refusal"),
        ("preboarding-items.js:517", "server/preboarding-items.js", "note = ",
         "§3.2 cites where the projection's `note` field is written"),
        # Added 2026-10-20 with the correction that fixed them. Each of the three sites was cited ONE
        # LINE OFF from the block it names, and each was written that way in the re-ground commit itself
        # (the code has not moved since: `git log ce28e99..HEAD -- server/access.js` is empty) — so this is
        # not a citation that drifted, it is a citation that never resolved. Nothing compared these sites:
        # they were three of the eleven in no check at all. One entry per site, so the next move reddens
        # on the document rather than being caught by eye.
        ("access.js:67", "server/access.js", "the rename that rides this slice",
         "§2.4 cites where the rename is recorded, not the file's opening block"),
        ("access.js:193-196", "server/access.js", "Note, and asserted",
         "§6.4 cites the whole note that names the manager's own-steps refusal"),
        ("db.js:126-128", "server/db.js", "measured reason:",
         "§2.2 cites the clause that says why the unique index cannot live in schema.sql"),
        # Added 2026-10-26 with P3-3 (row `bb60c7a3`): the §3.1 row for the escalation read. Before this,
        # that row's citation was compared to nothing — the tree's own route count would redden if the
        # route vanished, but the document's pointer to it could drift onto any other line in silence.
        ("index.js:1371", "server/index.js", "app.get('/api/probation/escalations'",
         "§3.1 cites the P3-3 escalation read route itself, not the comment block above it"),
        # Added 2026-10-26 with the re-ground in §10.7. The ROUTES append moved every line below it by +15;
        # these three sites were covered by a tree claim alone, so this page could drift onto any other line
        # and only the tree would redden. One entry per site, the citation string verbatim as the page carries it.
        ("access.js:388", "server/access.js", "function scopeFor",
         "§2.1's scope-refusal row cites `scopeFor`, the function that returns null"),
        ("access.js:396", "server/access.js", "function scopedAllows",
         "§4 cites `scopedAllows` where a scope becomes a decision"),
        ("access.js:448", "server/access.js", "allowed.indexOf(req.user.access_role)",
         "§2.1, §4 and §9 cite the gate's role read itself"),
]

def resolve(lines, needle, hint):
    """Where does `needle` live in this file? -> (line or None, all hits, ambiguous).

    THE ASSERTION IS RESOLUTION, NOT THE LINE NUMBER. `hint` is the line the record was written
    against; it is used to choose between several occurrences (the same string legitimately appears
    many times - `INSERT INTO audit_logs`, `access_role`, `SELECT * FROM employees`), and never to
    decide whether the claim holds. Returns None when the symbol is absent (a real defect) or when two
    hits are equidistant from the hint and no honest choice exists (ambiguous, also a FAIL).
    """
    hits = [i + 1 for i, l in enumerate(lines) if needle in l]
    if not hits:
        return None, [], False
    if hint in hits:
        return hint, hits, False
    best = min(hits, key=lambda h: (abs(h - hint), h))
    tied = [h for h in hits if abs(h - hint) == abs(best - hint)]
    if len(tied) > 1:
        return None, hits, True
    return best, hits, False

def main():
    # A revision that does not resolve must fail CLOSED, before the header is printed: `git show` cannot
    # resolve it, so every claim below would "fail" for the wrong reason and the run would print a
    # verdict about a tree it never read. (Measured 2026-10-26: the operator entry point's check passed
    # `@HEAD`, which is not a git revision at all - 13/111 with 98 FAILs, each saying "not in @HEAD".)
    if TREE is None:
        print(f"CANNOT-JUDGE: VERIFY_TREE={TREE_REF!r} resolves to no commit and no tree in this repository.")
        return 2
    print(f"verify-access-model.py")
    print(f"  document      : {DOC}")
    print(f"  tree measured : {TREE}")
    head = subprocess.run(["git", "log", "-1", "--format=%h %ci %s", TREE],
                          capture_output=True, text=True).stdout.strip()
    print(f"  tree is       : {head}")
    print()

    fails = 0
    # The headline count is what the checker RAN, not hand arithmetic. The previous summary used
    # `len(CLAIMS) + 3 + 10 + 2` and the measured-cell list had grown to 14 while the constant stayed
    # 10, so it printed "103/103" while 107 checks executed. A denominator a human maintains by hand
    # drifts silently and understates proof; a counter cannot.
    ran = 0
    def P(ok, tag, label, note=""):
        nonlocal ran, fails
        ran += 1
        print(("OK   " if ok else "FAIL ") + f"[{tag}] {label}")
        if note and not ok:
            print("        " + note)
        if not ok:
            fails += 1
    if not os.path.exists(DOC):
        print(f"FAIL: document not found at {DOC}")
        return 1
    judged_bytes = open(DOC, "rb").read()
    doc = judged_bytes.decode("utf-8")

    # --- 0. the document and the tree must be ONE revision (row 7daa1d44) ---------------------
    at_rev = subprocess.run(["git", "show", f"{TREE}:{SUBJECT_DOC}"], capture_output=True)
    if at_rev.returncode != 0:
        print(f"CANNOT-JUDGE: {SUBJECT_DOC} does not exist at {TREE} - nothing to judge the tree against.")
        return 2
    if judged_bytes != at_rev.stdout:
        print("CANNOT-JUDGE: HYBRID RUN - the document judged is not the document at the tree judged.")
        print(f"  tree judged     : {TREE}   (VERIFY_TREE={TREE_REF}) - the CODE is read from here")
        print(f"  document judged : {DOC}   md5 {hashlib.md5(judged_bytes).hexdigest()}")
        print(f"  document at tree: {TREE}:{SUBJECT_DOC}   md5 "
              f"{hashlib.md5(at_rev.stdout).hexdigest()}")
        print("  One headline over that pair would describe two revisions at once. To judge another")
        print("  tree, pin its own document too:")
        print(f"    git show {TREE}:{SUBJECT_DOC} > /tmp/doc.md && "
              f"VERIFY_DOC=/tmp/doc.md VERIFY_TREE={TREE} python3 scripts/verify-access-model.py")
        return 2

    # --- 1. content claims, resolved by content -------------------------------------
    # Each claim asserts its SYMBOL is in the file at the tree under judgement. The recorded line is a
    # hint that chooses between occurrences and is reported when stale - it is never the assertion, so a
    # merge that inserts lines above a block can no longer redden every claim below it.
    cache = {}
    stale_hints = []
    for path, hint, needle, label in CLAIMS:
        if path not in cache:
            cache[path] = git_show(path)
        lines = cache[path]
        if lines is None:
            P(False, label, f"{path}: not in {TREE}")
            continue
        got, hits, ambiguous = resolve(lines, needle, hint)
        if ambiguous:
            P(False, label, f"{path}: {needle!r} occurs at {hits}, equidistant from the hint {hint}",
              note="name the occurrence unambiguously - the hint cannot choose between two equal distances")
            continue
        if got is None:
            on_hint = lines[hint - 1].strip()[:100] if hint <= len(lines) else "<past end of file>"
            P(False, label, f"{path}: {needle!r} is NOT in the file at {TREE} (hint {hint})",
              note=f"the symbol this claim names is gone or renamed; the hinted line reads: {on_hint}")
            continue
        P(True, label, f"{path}:{got}" + ("" if got == hint else f"  (hint {hint} is stale)"))
        if got != hint:
            stale_hints.append((path, hint, got, label))

    # --- 2. the document must not carry the stale figures it moved away from.
    # Plain substring checks on purpose: these needles contain `**` and backticks, and a regex
    # built from them dies with "multiple repeat" — a crash is not a FAIL, so don't use regex here.
    # A hit count does not know a string's ROLE: a superseded phrase is allowed to survive as a
    # quotation showing what changed, and is a defect as a live claim. So each occurrence is
    # checked for its context, not merely counted.
    QUOTED_BY = ("previous version of this row read", "The previous version of this row",
                 "The first version of this section said", "read *\"nothing",
                 "An earlier revision of this line cited", "Read the page as closed on")
    for stale, label in [
        ("all 15 resources", "the superseded 15-resource count"),
        ("There is no\n`employee_id`.", "the superseded no-employee_id claim"),
        ("nothing — this route writes no audit row at all",
         "the superseded unlogged-account claim"),
        (":824-828", "the citation that stopped at the rationale comment, not the refusal"),
        # Added 2026-10-20 with the three citations corrected below them. A family entry alone cannot
        # bind a site whose cited string appears ELSEWHERE in the document too (`access.js:193-196` was
        # already cited correctly at §8 item 9), so each corrected site also refuses its OLD FORM. The
        # backticks are part of the needle on purpose: "`access.js:4`" cannot be a prefix of a longer
        # citation, so the check cannot false-positive on `access.js:40`.
        ("`access.js:4`", "the citation that named the file's opening block for the rename"),
        ("`db.js:120-127`", "the citation that started on the blank line above the block"),
        ("`access.js:192-195`", "the citation that started on the SCOPES entry line, not the note"),
    ]:
        bad = 0
        for m in re.finditer(re.escape(stale), doc):
            context = doc[max(0, m.start() - 300):m.start()]
            if not any(q in context for q in QUOTED_BY):
                bad += 1
        P(not bad, "stale text",
          f"{label} — " + ("survives only inside its own correction" if not bad
                           else f"present as a LIVE claim in {bad} place(s)"))

    # The over-claim is checked by ABSENCE of its bolded form, deliberately not by the QUOTED_BY
    # heuristic above: the correction paragraph sits within the 300-char window, so the heuristic
    # would excuse a live claim near it. A reader restoring the sentence restores it bolded, and the
    # correction never sets it in bold — so this can redden and cannot false-positive on a quotation.
    P("**Nothing on this page is open" not in doc, "stale text",
      "the flat 'Nothing on this page is open' over-claim is absent (decision 26 is open)")

    # --- 2b. the document's OWN citations must resolve to the line that carries the claim.
    # This closes the blind spot that let §5.2 rule 3 cite `index.js:824-828` while the refusal is
    # `:829`: the checker asserted the TREE's lines but never what the DOCUMENT cites, so a citation
    # could drift onto the rationale comment and every tree claim still passed. A check that cannot
    # redden on a document's cross-reference passes a document whose citations have gone stale.
    doc_hints = []
    for cited, fpath, needle, label in DOC_CITATIONS:
        src = git_show(fpath) or []
        hint = int(cited.split(":")[1].split("-")[0])
        if cited not in doc:
            P(False, "doc citation", f"{cited} appears nowhere in the document — {label}")
            continue
        got, _hits, ambiguous = resolve(src, needle, hint)
        if ambiguous:
            P(False, "doc citation", f"{cited}: {needle!r} occurs equidistant from the cited line "
                                     f"{hint} — {label}", note="the citation cannot choose between them")
        elif got is None:
            P(False, "doc citation", f"{cited} — {label}",
              note=f"{needle!r} is NOT in {fpath} at {TREE}; the cited line reads: "
                   f"{src[hint - 1].strip()[:100] if hint <= len(src) else '<past end of file>'}")
        else:
            P(True, "doc citation", f"{cited} — {label}"
              + ("" if got == hint else f"  (cited line {hint} is stale; resolves at :{got})"))
            if got != hint:
                doc_hints.append((cited, got, label))

    # --- 2c. §10.2's coverage table, RECOUNTED rather than believed. ------------------------------
    # The table printed four numbers and nothing re-derived them; the two paragraphs under it exist
    # because those numbers had been overtaken twice by the work around them. A coverage table that
    # nothing re-derives is the defect it describes, so the table is read OUT OF the page and compared
    # with a recount taken from the page and this file's own two lists.
    site_pat = re.compile(r"([A-Za-z0-9_./-]+\.(?:js|py|sql|json|ts|tsx|sh|md))[:](\d+)(?:-(\d+))?")
    sites = {}
    for i, ln in enumerate(doc.split("\n"), 1):
        for m in site_pat.finditer(ln):
            sites.setdefault((m.group(1).split("/")[-1], int(m.group(2))), set()).add(i)
    fam = {(c.split(":")[0].split("/")[-1], int(c.split(":")[1].split("-")[0]))
           for c, _f, _n, _l in DOC_CITATIONS}
    claim_keys = {(p.split("/")[-1], n) for p, n, _needle, _label in CLAIMS}
    recounted = [
        len(sites),
        sum(1 for k in sites if k in fam),
        sum(1 for k in sites if k not in fam and k in claim_keys),
        sum(1 for k in sites if k not in fam and k not in claim_keys),
    ]
    for pat, label, got in zip(
        [r"\|\s*distinct `file:line` sites\s*\|\s*\*\*(\d+)\*\*",
         r"\|\s*compared as citations \(the family above\)\s*\|\s*\*\*(\d+)\*\*",
         r"\|\s*pinned only as \*\*tree claims\*\*[^|]*\|\s*\*\*(\d+)\*\*",
         r"\|\s*in \*\*no check at all\*\*\s*\|\s*\*\*(\d+)\*\*"],
        ["distinct file:line sites", "compared as citations", "pinned only as tree claims",
         "in no check at all"],
        recounted):
        m = re.search(pat, doc)
        want = int(m.group(1)) if m else None
        P(want == got, "partition",
          f"§10.2's coverage table: {label} — printed {want}, recounted {got}"
          + ("" if want is not None else " (the table row is gone)"),
          note="" if want == got else "re-ground the table from the recount, not by arithmetic")

    # --- 3. the structural claims, measured by evaluating the merged module
    meas = None
    src = subprocess.run(["git", "show", f"{TREE}:server/access.js"],
                         capture_output=True, text=True).stdout
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as fh:
        fh.write(src)
        mpath = fh.name
    js = f"""
const a = require({json.dumps(mpath)});
const cw  = a.ROUTES.filter(r => r[2] === 'preboarding:read');
const agg = a.ROUTES.filter(r => r[2] === 'preboarding:read:aggregate');
const own = a.ROUTES.filter(r => r[2] === 'preboarding:read:own');
const out = {{
  resources: Object.keys(a.POLICY).length,
  routes: a.ROUTES.length,
  roles: Object.keys(a.ROLES).length,
  roleVals: Object.keys(a.ROLES).map(k => a.ROLES[k]),
  policy: a.POLICY,
  counsel: a.COUNSEL_PENDING,
  list: cw.length, own: own.length, agg: agg.length,
  disjoint: !cw.some(x => own.includes(x)) && !cw.some(x => agg.includes(x)) && !own.some(x => agg.includes(x)),
  unpolicied: a.unpoliciedRoutes().length,
  widened: Object.entries(a.POLICY).filter(([k, v]) => v.join() !== 'admin').length,
  employeeNotInOwn: a.POLICY['preboarding:read:own'].indexOf(a.ROLES.EMPLOYEE) === -1,
  managerNotInAnalytics: a.POLICY['analytics:read'].indexOf(a.ROLES.MANAGER) === -1,
  unknownRoles: a.unknownRolesInPolicy().length,
  nullScopeRefuses: a.scopedAllows(null, 'self') === false,
  ownNotOther: a.scopedAllows('own', 'other') === false,
}};
console.log(JSON.stringify(out));
"""
    r = subprocess.run(["node", "-e", js], capture_output=True, text=True)
    os.unlink(mpath)
    if r.returncode != 0 or not r.stdout.strip():
        P(False, "structure", "could not evaluate the merged module",
          note=r.stderr.strip()[:200])
    else:
        m = json.loads(r.stdout)
        meas = m
        checks = [
            (m["resources"] == 17, f"17 resources (measured {m['resources']})"),
            # 30 since this tree: P3-3 added `GET /api/probation/escalations`, mapped to the existing
            # `employees:read` cell (docs/access-model.md §3.1, which carries its row in the same change
            # — rule 41's count, published as 29 -> 30 rather than moved silently). Before that, 29 since
            # 62665dc (PR #306): P3-2 added `POST /api/employees/:id/probation-evaluations`, mapped to
            # the existing `onboarding:write` cell (docs/access-model.md §3.1) — the §3.1 row moved with it, which is
            # what this check requires. Before that, 28 since 83a8b5e: P4-1 added GET /api/employees/:id/replacement-cost and
            # P3-1 added `GET /api/probation/timelines`, mapped to the existing `employees:read` cell (docs/access-model.md §3.1). This number IS the route inventory the
            # model was written for, so a route added without re-grounding the document reddens here —
            # which is what happened on 2026-10-22, when PR #287 landed a route and no §3 row, turning
            # this check from green (137/137 at 93de0bd) to red (80/137 at f4314d8) and check-all's
            # verdict to BROKEN. The row now exists and the number moves with it.
            (m["routes"] == 31, f"31 routes declared (measured {m['routes']})"),
            (m["roles"] == 5, f"five roles exist (measured {m['roles']})"),
            (m["list"] == 1, f"the list cell covers 1 route (measured {m['list']})"),
            (m["own"] == 4, f"the own cell covers 4 routes (measured {m['own']})"),
            (m["agg"] == 2, f"the aggregate cell covers 2 derived reads (measured {m['agg']})"),
            (m["disjoint"], "the three route sets are pairwise disjoint"),
            (m["unpolicied"] == 0, "no unpolicied route"),
            (m["widened"] > 0, f"access HAS widened: {m['widened']} cells are not admin-only"),
            (m["employeeNotInOwn"], "the own cell still excludes employee (the case link is missing)"),
            (m["managerNotInAnalytics"], "a manager is refused the dashboard"),
            (m["unknownRoles"] == 0, f"no cell names an unknown role (measured {m['unknownRoles']})"),
            (m["nullScopeRefuses"], "an unstated scope refuses (scopedAllows(null, self) === false)"),
            (m["ownNotOther"], "own does not reach another person (scopedAllows(own, other) === false)"),
        ]
        for ok, label in checks:
            P(ok, "measure", label)

    # --- 3b. THE DOCUMENT'S OWN STRUCTURAL CLAIMS, READ OUT OF THE DOCUMENT.
    # Not "does the tree have 17 resources" (section 3) but "does THIS DOCUMENT say 17, and does
    # what it says match". The verdict must depend on DOC; that is the coupling whose absence let
    # a copy asserting "all **16** resources", "every cell is still `[admin]`" and "the coarse cell
    # is two cells" score 103/103 against the tree that refutes all three.
    # Extraction that finds nothing is a FAIL, never a silent skip: a check must not pass merely
    # because it could not find its input.
    def region(start, end):
        i = doc.find(start)
        if i < 0:
            return None
        j = doc.find(end, i + len(start))
        return doc[i:(j if j > 0 else len(doc))]

    if meas is None:
        P(False, "doc→tree",
          "cannot read the document's structural claims: the merged module did not evaluate")
    else:
        # (a) the resource count
        mm = re.search(r"\*\*(\d+)\*\*\s+resources", doc)
        if mm:
            P(int(mm.group(1)) == meas["resources"], "doc→tree",
              f"the document's resource count ({mm.group(1)}) == measured {meas['resources']}")
        else:
            P(False, "doc→tree", "the document states no '**N** resources' count to compare")

        # (b) the role set, read out of §2.1's table
        s21 = region("### 2.1", "### 2.2")
        roles_doc = sorted(set(re.findall(r"^\|\s*`([a-z_]+)`\s*\|", s21 or "", re.M)))
        P(bool(roles_doc) and roles_doc == sorted(meas["roleVals"]), "doc→tree",
          f"§2.1's role set {roles_doc} == measured {sorted(meas['roleVals'])}")

        # (c) each pre-boarding cell — route count AND role list — out of §1.1's table
        s11 = region("### 1.1", "\n## ")
        cells = {}
        for mm in re.finditer(
                r"^\s*\|\s*`(preboarding:read[^`]*)`\s*\|[^|\n]*\|\s*\*\*(\d+)\*\*\s*\|\s*([^|\n]*)\|",
                s11 or "", re.M):
            cells[mm.group(1)] = (int(mm.group(2)), mm.group(3))
        for cell, cnt in [("preboarding:read", meas["list"]),
                          ("preboarding:read:own", meas["own"]),
                          ("preboarding:read:aggregate", meas["agg"])]:
            if cell not in cells:
                P(False, "doc→tree",
                  f"§1.1 states no row for `{cell}` (the tree gives it {cnt} route(s))")
                continue
            doc_cnt, doc_cell = cells[cell]
            P(doc_cnt == cnt, "doc→tree",
              f"§1.1's `{cell}` route count ({doc_cnt}) == measured {cnt}")
            want = sorted(meas["policy"].get(cell, []))
            rm = re.search(r"\[([a-z_, ]+)\]", doc_cell)
            got = sorted(x.strip() for x in rm.group(1).split(",")) if rm else []
            P(got == want, "doc→tree",
              f"§1.1's `{cell}` cell {got} == measured {want}")

        # (d) the [admin]-vs-multi-role state, read from the document's own sentence
        if re.search(r"access (?:has|HAS) widened", doc):
            P(meas["widened"] > 0, "doc→tree",
              f"the document says access widened; measured {meas['widened']} non-admin cell(s)")
        elif re.search(r"every cell (?:is|of the gate is)[^.\n]{0,30}`\[admin\]`", doc):
            P(meas["widened"] == 0, "doc→tree",
              f"the document says every cell is `[admin]`; measured {meas['widened']} non-admin cell(s)")
        else:
            P(False, "doc→tree",
              "the document states neither the widened nor the admin-only state")

        # (e) the refuted admin-only forms may survive only as quotations
        REFUTED_CTX = QUOTED_BY + ("the plan's",)
        bad = 0
        for mm in re.finditer(r"every cell (?:is|of the gate is)[^.\n]{0,30}`\[admin\]`", doc):
            ctx = doc[max(0, mm.start() - 300):mm.start()]
            tail = doc[mm.end():mm.end() + 60]
            if any(q in ctx for q in REFUTED_CTX) or "is now false" in tail:
                continue
            bad += 1
        P(bad == 0, "doc→tree",
          f"no LIVE claim that every cell is `[admin]` (found {bad})")

        # (f) the counsel count, and the §8 items the code keys its marks against
        n_counsel = doc.count("*(counsel)*")
        P(n_counsel == 10, "doc→tree",
          f"the document carries its 10 `*(counsel)*` marks (found {n_counsel})")
        # ensure_ascii=False: json.dumps would escape '§' to \u00a7 and the regex would find nothing,
        # turning a real coupling into a vacuous empty-set check.
        keyed = sorted(set(int(x) for x in re.findall(
            r"§8 item (\d+)", json.dumps(meas["counsel"], ensure_ascii=False))))
        s8 = set(int(x) for x in re.findall(r"^(\d+)\. ", region("## 8.", "## 9.") or "", re.M))
        P(bool(keyed) and all(x in s8 for x in keyed), "doc→tree",
          f"every §8 item the code keys against exists in §8 ({keyed} ⊆ {sorted(s8)})")

        # (g) the document's printed commands must be `!`-free inside double quotes
        blocks = re.findall(r"```sh\n(.*?)```", doc, re.S)
        if blocks:
            bad = sum(b.count("!") for b in blocks)
            P(bad == 0, "doc→tree",
              f"the document's ```sh blocks carry no `!` (history expansion kills them; found {bad})")
        else:
            P(False, "doc→tree", "the document has no ```sh block to check for `!`")

        # (h) the open OWNER decisions the plan numbers must be IN §8, in the form a reader searches for.
        # Case-sensitive on purpose: the plan writes `decision 25` while §8 wrote `DECISION 25`, so a
        # case-sensitive search for the plan's form found nothing although the number sat right there in
        # caps — a citation that cannot be found is a citation that does not land. This searches exactly
        # as a reader would, so dropping one of the five from the register reddens here.
        s8b = region("## 8.", "## 9.") or ""
        nums = sorted(set(int(x) for x in re.findall(r"decision (\d+)(?![0-9A-Za-z])", s8b)))
        want = {23, 24, 25, 26, 27}
        miss = sorted(want - set(nums))
        P(not miss, "doc id",
          f"§8 records every open owner decision the plan numbers, in the plan's own form — missing "
          f"{miss or 'none'} (found {nums})")

    # --- 4. the claims the document says are EMPTY must be empty
    for pattern, label, want_empty in [
        (r"RENAMES", "the rename is implemented as a migration (db.js RENAMES)", False),
        (r"SELECT employee_id FROM users", "the caller's employee_id IS read now (callerEmployeeId)", False),
        # The pre-boarding module's OWN fallback, which the plan filed as a defect and be8e99d retired
        # at source: `requireActor` (preboarding-items.js:198) throws a 400 where the write happens.
        # Measured: this pattern matched 4 lines at 8ec9f69 and 0 at be8e99d — so this check reddens on
        # the tree that carried the defect, which is the only way to know it is load-bearing.
        (r"actor \|\| 'system'", "the module's own 'system' fallback is retired (requireActor, :198)", True),
    ]:
        r = subprocess.run(["git", "grep", "-n", "-E", pattern, TREE, "--", "server/"],
                           capture_output=True, text=True)
        found = (r.returncode == 0)
        ok = (found != want_empty) if want_empty else found
        tag = "empty" if want_empty else "present"
        P(ok, tag, label, note=r.stdout.strip()[:200] or "(nothing)")

    print()
    if stale_hints or doc_hints:
        worst = max([abs(g - h) for _p, h, g, _l in stale_hints] +
                    [abs(g - int(c.split(":")[1].split("-")[0])) for c, g, _l in doc_hints])
        print(f"HINT DRIFT - {len(stale_hints)} of {len(CLAIMS)} claim hints and {len(doc_hints)} of "
              f"{len(DOC_CITATIONS)} doc citations no longer name the line the symbol is on (worst {worst} "
              f"lines). NOT a verdict: a line number is a hint, the assertion is that the symbol resolves.")
        for path, hint, got, label in stale_hints:
            print(f"    {path}: hint {hint} -> resolves at {got}   [{label}]")
        for cited, got, label in doc_hints:
            print(f"    cited {cited} -> resolves at :{got}   [{label}]")
        print("    Re-grounding these is a documentation act, not a fix; nothing is wrong with the tree.")
    print()
    _where = TREE if not _VERIFY_TREE else f"{TREE} (VERIFY_TREE={_VERIFY_TREE})"
    print(f"{ran - fails}/{ran} checks hold against {_where}   (ran={ran}, fails={fails}, "
          f"hints stale={len(stale_hints) + len(doc_hints)})")
    print(f"tree is {TREE} - the document it judged is byte-identical to {SUBJECT_DOC} at that tree")
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main())
