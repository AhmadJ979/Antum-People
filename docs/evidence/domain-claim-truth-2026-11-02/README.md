# The domain claim was false in three documents — corrected, its host copy reconciled, and guarded

*2026-11-02 · branch `docs/domain-claim-truth` off `origin/main` = `cb16b40` · a documentation-and-check
change: no served path moves, nothing was built, restarted, published or moved.*

## What was false

Two tracked documents asserted that the business owns domains it does not own. A third, found by the
check this change adds, asserted the same thing in a different shape:

The three lines, quoted verbatim as they stood at `cb16b40` (a fenced block, because they are
quotations and the guard that now judges this repository counts them as such rather than as claims):

```
1  design-concepts/BRAND-IDENTITY.md:9
   - **Domains (registered & owned by Antum):** `antum.ae` (UAE), `antum.me` (global). No DNS records published yet — so no website and no mailbox is served on them today.

2  README.md:21
   - **Primary Domains**: antum.ae (UAE), antum.me (global)

3  legal-signoff-checklist.md:33
   - **Domains** `antum.ae` / `antum.me` are registered; no website, portal, inbox or data-subject-request channel is asserted as live.
```

Why each is false:

- **Site 1** states ownership outright. A registrar check on 2026-11-02 returned `AVAILABLE=FALSE` for both
  names: they are held by third parties. `getantum.com` is taken too. **The business has bought no domain at
  all.**
- **Site 2** names the same two names as *primary* and says nothing about not holding them;
  `README.md:56-57` then listed the contact addresses with no caveat, while every other document marks
  them reserved.
- **Site 3** was **found by the new check, not by the brief.** The names *are* registered — **by third
  parties** — which is exactly the shape that reads as ours.

The plan's own wording is the authority: `antum.ae` and `antum.me` publish no DNS **and are not available
to buy**; a real domain is an open owner decision (decision 9). Nothing written here names a replacement,
prices one, or pre-empts the owner's choice.

## What the corrected text says (factual, minimal, one line each where the original was one line)

`design-concepts/BRAND-IDENTITY.md:9` — same line count before and after (81 lines), so the three
`BRAND-IDENTITY.md:11` citations in `LAYER2-PREBOARDING-UI.md` still land on the Arabic wordmark line:

```
- **Domains:** **no domain is registered to Antum** — the business holds none. `antum.ae` (UAE) and
  `antum.me` (global) are the intended names, but both are held by third parties and are not purchasable;
  `getantum.com` is taken too. The product's domain is **undecided** — an open owner decision. No DNS
  records exist and no website or mailbox is served on any of these names.
```

`design-concepts/BRAND-IDENTITY.md:10` — the contact-email line gains its caveat, because listing live
addresses directly under "no domain is registered" is the same falsehood in a second sentence:
`... — **reserved, not provisioned: with no domain held, none of them can receive mail.**`

`README.md:21` and the Contact block (`README.md:58`, one added line — the root README carries no
line-numbered citations, checked with `grep -rn "README\.md:[0-9]"`):

```
- **Primary Domains**: **none registered — Antum holds no domain.** `antum.ae` (UAE) and `antum.me`
  (global) are the intended names; both are held by third parties and are not purchasable. The product's
  domain is undecided (open owner decision).
...
- Every address above is **reserved, not provisioned — none of them can receive mail**: Antum holds no
  domain, so no mailbox is served on any of these names.
```

`legal-signoff-checklist.md:33` — one line to one line:
`- **Domains** antum.ae / antum.me are **not registered to Antum** (both are held by third parties, and are
not purchasable); no website, portal, inbox or data-subject-request channel is asserted as live.`

Every other statement in all three files is untouched: `git diff --stat` = `README.md 3 +-`,
`design-concepts/BRAND-IDENTITY.md 4 +-`, `legal-signoff-checklist.md 2 +-` (2 lines: 1 removed, 1 added).

## The host copy, reconciled to a pointer

`/home/team/shared/design-concepts/BRAND-IDENTITY.md` was **4,809 B, 81 lines, md5
`dc6e04f395dfb3a4d8012a9f89135f1c`**, dated 17 September — the same text the repository held at
`b8e3074`, i.e. **one line behind**: it still carried the pre-#344 `DD/MM/YYYY` date convention *and* the
false ownership clause. It is now a **pointer** in the exact form the seven earlier conversions used
(marker `POINTER, not a copy` in the first 400 bytes), following
`skills/antum-one-authoritative-copy/SKILL.md` §12. Proof, all mechanical:

```
=== 1. the repo still holds the bytes the pointer quotes ===
  git show b8e3074:design-concepts/BRAND-IDENTITY.md  md5=dc6e04f395dfb3a4d8012a9f89135f1c  4809 B  81 lines
  pointer claims        md5=dc6e04f395dfb3a4d8012a9f89135f1c  4,809 B  81 lines
  MATCH

=== 2. the md5 the host file ACTUALLY held, measured before the overwrite ===
  dc6e04f395dfb3a4d8012a9f89135f1c  (md5sum taken at session start; 4809 B; 81 lines)

=== 3. the pointer is not byte-identical to ANY blob in the object database ===
  pointer md5=28510a8a7fa2e71227ab2f1de95fd551  3247 B  51 lines
  objects parsed        : 6733
  blobs byte-identical  : 0  []

=== 4. no shared non-blank line with the document body ===
  body non-blank(non-structural) lines : 70
  pointer non-blank lines             : 36
  SHARED (want 0)                     : 0 []

=== 5. control: append one real body line to a scratch copy -> shared must go 0 -> 1 ===
  control plant                       : '- **Company / legal brand:** Antum'
  shared before/after                 : 0 / 1
```

Two notes on how that was measured, because the first cut was wrong: the line-set comparison initially
reported **1** shared line, ` ``` ` — the code-fence delimiter, three characters of markdown, not document
text; structural lines (` ``` `, `---`) are excluded and the number is printed either way. And the
control's first plant was `---`, which is structural, so it moved 1 → 2 and proved nothing about text; the
plant shown above is a real body line.

The pointer names the retraction in one line — **the claim that the business owns `antum.ae` and
`antum.me`** — so it cannot be fetched later as merely "older". It carries **no document text**.

**Why the other 20 entries in that host folder were not touched.** They are not part of this brief, and
they are not all the same defect: 15 are byte-identical to the repository, 5 hold older text, and 2 of the
files are HTML prototypes the repository *links to* (`design-concepts/INTERACTIVE-CONSENT-SPECS.md:5`).
Converting them is a queued pass, and they are now **counted** rather than invisible — see below.

## The guard: `scripts/check-domain-claims.py`

It walks every **tracked** `.md` (`git ls-files`), matches four claim shapes, exempts a clause that
*denies* ownership (so the corrected sentences pass and the check does not redden on its own fix), and
names `file:line`. It prints files / lines / claims / denials / violations, and a tree with no markdown is
CANNOT-JUDGE (exit 2), never OK.

### GREEN on the corrected tree

```
  files scanned          : 162  (git ls-files (tracked markdown only))
  lines scanned          : 27155
  ownership claims seen  : 6  (matches of the claim shapes, before the negation rule)
  denials skipped        : 6  (a clause that denies ownership is not a claim)
  quoted in a fence      : 3840  (lines inside ``` - a quotation, counted and not judged)
  violations             : 0
OK: 162 files / 27155 lines scanned, 6 claim(s) matched, 6 denial(s) skipped, 0 violations.
```

`162` is this note itself, which is tracked markdown like any other; before this note existed the run
read **161 files / 26,866 lines** at `cb16b40`. On the tree after rebasing onto #345's merge the same run
reads **163 files** (that merge added one tracked note) with **0 violations** — printed, never assumed. The three verbatim quotations above are inside a fence and are counted
in `quoted in a fence`, not judged — that is the rule the check states, and it is what lets the evidence
for a false-claim fix quote the false claim.

### RED on the unfixed tree — `--root` at a worktree of `cb16b40`, the revision this branch starts from

```
  lines scanned          : 26865
  ownership claims seen  : 3
  denials skipped        : 0
  violations             : 3
      RED   README.md:21
            claim: 'Primary Domains**: antum.ae'
      RED   design-concepts/BRAND-IDENTITY.md:9
            claim: 'registered & owned by Antum'
      RED   legal-signoff-checklist.md:33
            claim: 'Domains** `antum.ae` / `antum.me` are registered'
FAIL: 3 line(s) assert a domain holding the business does not have. ... exit 1
```

**This red run is what found site 3.** The first cut of the `domains … registered` shape used
`[^.\n]` between the label and the verb — and the thing in between is a *domain name*, which contains dots,
so it matched nothing on that line. Measured, then widened to `[^\n]`; the comment in the file says so.

### `--selftest` — the plant, and the control that keeps the fix passable

```
--- selftest case: plant (the 2026-11-02 false sentence) ---
      RED   BRAND.md:2
    exit=1 (want 1)
--- selftest case: corrected wording (must stay green) ---
OK: 1 files / 3 lines scanned, 1 claim(s) matched, 1 denial(s) skipped, 0 violations.
    exit=0 (want 0)
--- selftest case: the bare 'domains ... are registered' shape ---
      RED   checklist.md:2
    exit=1 (want 1)
--- selftest case: no markdown at all ---
    exit=2 (want 2)
--- selftest case: this repository ---
OK: 161 files / 26866 lines scanned, 4 claim(s) matched, 4 denial(s) skipped, 0 violations.
    exit=0 (want 0)
SELFTEST OK: the plant reddens, the corrected wording stays green, an empty tree is CANNOT-JUDGE, and this
repository is green.
```

**Stated limit, not hidden:** a line that both denies and asserts ownership is skipped (the negation rule
is a false-negative margin), and the check judges *text*, not the world — it cannot know whether a registrar
released a name yesterday.

## The host-copy check, widened to `design-concepts/`

`scripts/check-host-template-copies.py` now judges a second folder. Every entry there must be **one of**:
a **pointer** (marker in the first 400 bytes); or **declared debt** — listed in
`scripts/host-design-concepts-baseline.tsv` with its **exact md5**; anything else is RED, named with its path
and reason. `BRAND-IDENTITY.md` is deliberately **absent** from the register, so a copy of it reappearing —
old text, current text, any text — reddens.

Bare run on the host:

```
  --- design-concepts folder (the second ruled location) ---
  design folder judged  : /home/team/shared/design-concepts
  entries examined      : 21  (walked, not matched against a list of names)
  pointers              : 1  (the sanctioned form for a repository document)
      ok    BRAND-IDENTITY.md
  declared debt         : 20  (in scripts/host-design-concepts-baseline.tsv, md5 pinned)
  violations            : 0
  design-concepts       : 21 entries / 1 pointers / 20 declared debt / 0 violations
...
OK: 3 entries examined, 0 at the top level (want 0), 3 quarantined and matching the rule, 0 violations.
    /home/team/shared/templates is in its retired state.
```

PLANT A — the old document re-copied over the pointer, in a scratch folder (`--design-root /tmp/…`):

```
  entries examined      : 2
  pointers              : 0
  declared debt         : 1
  violations            : 1
      RED   BRAND-IDENTITY.md
            UNDECLARED-COPY: not a pointer and not in the debt register - a second copy of a repository
            document, md5 dc6e04f395dfb3a4d8012a9f89135f1c
FAIL: 1 entr(ies) in /tmp/design-plant that the ruling does not allow - each is named above.
exit 1
```

PLANT B — a *declared* file's bytes moved (`README.md`, one line appended):

```
  pointers              : 1
  declared debt         : 0
  violations            : 1
      RED   README.md
            DECLARED-BUT-DRIFTED: declared md5 49dbd7d7805c59a0ca5717cbbfeef306, file is
            dc4e4563b920b75600482dc02ea699c8 - a debt entry that moved is a new copy
exit 1
```

The register is a **debt register, not a list of blessed names**: it pins md5s, so a declared file that
drifts reddens exactly like an undeclared one, and the run prints how many entries are debt.

The design folder is judged only on the **bare** run (or with `--design-root`), so the existing proof —
which drives the script with `--root` on scratch template folders — is not coupled to host state. That skip
is **printed on its own line**, never silent. The existing proof still passes unchanged:

```
== 20 passed, 0 failed ==
```

## Was any served path affected? No — shown, not asserted

```
== A. does any CODE load the three corrected files? ==
  6 hits under server/ client/src/ scripts/ - ALL SIX are prose in this change's own docstrings/comments
  (scripts/check-host-template-copies.py:70,88; scripts/check-all.py:176; scripts/check-domain-claims.py:10,18;
  scripts/host-design-concepts-copy baseline comment). Zero code reads them.
  Root README.md from code: the 5 grep hits are all `design-concepts/README.md` (a test fixture path in
  server/design-concepts-index.test.js and server/check-all-classifier.test.js) - not the root README.

== B. does anything load the host design-concepts folder? ==
  one markdown link, design-concepts/INTERACTIVE-CONSENT-SPECS.md:5, to the PROTOTYPE html (untouched);
  everything else is this change's own prose and its DESIGN_ROOT_DEFAULT constant.

== C. the movement runs neither ================================================
  grep -c "scripts" server/index.js      : 0
  grep -c "\.py" scripts/cutover-preflight.sh : 0

== D. the delta ==
 README.md 3 +- · design-concepts/BRAND-IDENTITY.md 4 +- · legal-signoff-checklist.md 2 +-
 scripts/check-all.py 21 ++- · scripts/check-host-template-copies.py 156 +++- · (2 new scripts)

== E. client/dist untouched ==
-rw-r--r-- 1 root root  37757 2026-10-30 16:49 index-CdmIUBt1.css
-rw-r--r-- 1 root root 290272 2026-10-30 16:49 index-vsGFc45L.js
```

The method is #344's: name every file in the delta, then show that no code path loads any of them. It does
not: the three corrected files are documents, the two new files are instruments, and the bundle's mtime is
still 2026-10-30 16:49. **No build, no restart, no movement, no publish.**

## Checks at this tree

`python3 scripts/check-all.py --no-suite` → **exit 0, 9 OK / 0 BROKEN, 9 skipped** (the `suite` entry is
SKIP-FLAGGED only because `--no-suite` was passed), including the two this change touches:
`host-template-copies` OK 0.1 s and `domain-claims` OK 0.2 s.

## Not done here, deliberately

- **No domain was named, priced or pre-empted.** The owner's choice (decision 9) is untouched.
- **The other 20 host copies were not converted** — queued pass, now counted.
- **The 12 unjudged citations** (plan item 3) are untouched: this branch changes no `App.tsx:<n>` citation.
- **No compliance wording was restyled.** Each edit removes a false claim or adds its caveat; nothing else
  in the three documents moved.
