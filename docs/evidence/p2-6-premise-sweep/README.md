# The P2-6 premise sweep — "PDPL consent is captured" measured against the shipped instrument

**Date:** 2026-10-13 · **Author:** compliance · **Tree read:** `origin/main` = `a48668d`
**Re-derived 2026-10-14** against `origin/main` = `f46b7a9`, the tree this record is first landing on.
Every correction that re-derivation produced is written **into the claim it corrects**, not appended:
this file has never landed, so there is no landed text to preserve and an append-note here would be
ceremony. What moved: §2's no-basis citation, its version citation and its two `server/index.js`
citations; §4's design-spec row, its `preboarding-workspace.js` row and its pack-pointer row; §5's
counts; §6's file list; §7's hand-offs.
**Subject:** one spec line that kept generating a requirement the product does not implement, every
document that carried the same premise, and what was done to each.

---

## 1. What was asked, and the answer

`/home/team/shared/phase-roadmap-2-4.md:38-39` (P2-6's outcome and acceptance) said *"PDPL consent is
captured before personal documents are collected … no document is collected before the consent record
exists."* The program-manager measured the tracker row written from it against the row's own premise and
reported the mismatch (`roadmap-board-index.md:334` — Round 44's INSTANCE 4, which named three rows and
acted on none), then re-grounded that row in place (`:339`, Round 45's corrections; the P2-6 row named at
`:494`), recording the spec as the source the wording came from
(`/home/team/shared/round-45-reground-three-rows.md:22`).

**Measured against the product, the line is false in both halves, and the honest fix is to amend it —
not to report an unbuilt capture.** What gates collection is not a consent record and cannot be: the
notice assigns `consent` to exactly two purpose rows, both sensitive data
(`templates/privacy-notice.md:47-48` — occupational health, and biometric time & attendance), and **none
of the seven pre-boarding documents is either** (`server/preboarding-items.js:76-82`). The instrument
that gates them is a per-item record that **the notice was shown** — built, served and verified.

## 2. The shipped instrument (measured, not described)

| fact | evidence on `f46b7a9` |
|---|---|
| The instrument is the notice being **shown**, and the table's CHECK constraint makes it incapable of holding anything else | `server/preboarding-items.js:161` — `NOTICE_INSTRUMENT = 'notice_shown'` |
| An employee-track document cannot reach `received`/`verified` until the notice has been shown **for that item** — **428** | gate at `server/preboarding-items.js:466`; refusal at `:478`–`:480` |
| An item the notice assigns **no basis** to is not collectible at all — **409**, naming the counsel question it waits on | `server/preboarding-items.js:468`–`:474` (`Q1` for the two certificates, `Q5` for the emergency contact — the catalog rows at `:135`, `:142`, `:154`). **Corrected 2026-10-14:** this row cited `:432`–`:451`, which holds the jurisdiction-set and transition 409s and never the notice-basis one. The file is byte-identical at `a48668d` (`d3cc0df5…`), so the citation was wrong when it was written |
| A record with **no named actor** is refused — **400** | `server/preboarding-items.js:310`–`:312` |
| The recorded version is read from the notice the server serves, not from the caller | same comment block, `:316`–`:317` (re-derived 2026-10-14; the row said `:315`–`:317`) |
| The record has its own route; the two **case consent routes were removed, not reworded** | `POST /api/preboarding/cases/:id/notice-acknowledgements` at `server/index.js:740`; reason at `:727`–`:730` — re-derived 2026-10-14 (the row said `:749` and `:735`–`:738`, which is the numbering before #182 and #186 took that file from 892 to 883 lines) |
| The case-level consent table is **retired**: no reader, no writer, reason in the schema | `server/schema.sql:254`–`:267` (the reason comment; the table it retires begins `:268`) — corrected 2026-10-14 from `:255`–`:270` |
| The **employee**-level consent path is **gone — removed, not reworded** (owner decision 17, executed 2026-10-13) | the removal record where the route stood: `server/index.js:358`–`:363`. `consent_records` is **kept** for decision 14's purpose-scoped consent; the retirement is asserted in RETIRED (`server/reachability-register.js`). **Re-derived 2026-10-14:** this row read *"still writes `consent_records`, and has no caller"*, at `:359`–`:366` — true at `a48668d`, false since #182/#186 executed the decision |
| The client literal `{ …, lawful_basis: 'consent', consent_version: 'v1' }` is gone | `git grep consent_version origin/main -- client/src` → no client hit (re-run 2026-10-14 on `f46b7a9`) |

**Why amend, and not report.** Option (b) is for a spec that asks for more than we ship. The spec asks
the right *question* — is the notice in front of the hire before we collect their documents? — and the
product answers it per item, with the basis, the version and a named actor. The only unimplemented half
of P2-6 is the **hire-facing portal** (specified in §§8A–8C, blocked on owner decision 14): a portal,
not a consent capture. The last consent *capture* the product carried — the employee-level instrument —
has since been retired by owner decision 17, executed 2026-10-13: its route is gone, its place carries
the removal record, and the `consent_records` table stays for decision 14's purpose-scoped consent.
Nothing in the product now records a consent it cannot justify.

## 3. The source fix — the pack spec

`/home/team/shared/phase-roadmap-2-4.md` is in the pack, not the repository, and is cited as such
(`design-concepts/LAYER2-PREBOARDING-UI.md:53`, `roadmap-board-index.md:3`) — **so no PR can carry it.**

| | before | after |
|---|---|---|
| md5 | `14f79661bcff0b4f6d474792413e5aed` | `47393d6cda3194d5bc5adc6692075187` |
| lines (`wc -l`) | 105 | 133 |
| bytes | 8,594 | 10,916 |

Re-measured 2026-10-14: unchanged (133 lines, 10,916 B, `47393d6c…`). Shape of the diff: `38,39c38,39`
(the two criterion lines, replaced in place, so **no other line number in the file moves**) plus 28
lines appended after old line 105 (a dated `## Amendment` note at `:108`–`:133` recording what it
replaced, the shipped instrument, and the amendment's own before-md5). Written by
`~/amend-p2-6-spec.py`, which asserts md5, line count, the byte-identity of lines 1–37 and the exact
previous wording of `:38`/`:39` before writing.

**Disclosed: one of the script's after-checks was mis-specified.** "old wording gone" / "old acceptance
gone" **FAILED**, because the amendment note deliberately *quotes* the old wording as what it replaced.
Measured: `PDPL consent is captured` occurs exactly once (line 110) and `no document is collected before
the consent record exists` exactly once (line 111), both inside the note. The checks that matter — `:38`/
`:39` replaced, lines 1–37 byte-identical — passed.

## 4. The sweep — measured sites, and the disposition of each

Search patterns, so this is reproducible: `consent record`, `PDPL consent record`, `Record consent`,
`consent` near `collect`/`document`, `lock` near `consent` — over the repository at `origin/main` and
the pack, then read by hand.

| document | measured sites | class | disposition |
|---|---|---|---|
| `/home/team/shared/phase-roadmap-2-4.md` | 38–39 | **the source** | **amended in place** (§3) |
| `design-concepts/LAYER2-PREBOARDING-UI.md` | 82 · 541 · 544 · 550–553 · 562 · 564–566 · 574–575 · 583–589 · 628 · 714–716 · 885 · 902 · 937 · 1013 · 1036 | design spec, read as current | **no edit — the block this row used to book is dropped (2026-10-14).** The Product Designer re-grounded these sites **in place** (#185, `862022c`) and re-measured the code cites against the merged tree (#187, `a200c74`), so an appended correction would have arrived describing sites that no longer say what it said they did. Re-measured on `f46b7a9`: the premise strings as *live claims* are at **0** — `PDPL consent is captured` 0, `Consent recorded` 0 — and every one of the 13 `consent record`, 5 `consent_version` and 4 `consent_records` occurrences is a corrected live statement, a historical quotation inside one of the two movement notes, or the employee-instrument paragraph that records its own removal (`server/index.js:358`–`:363`) |
| `pdpl-lawful-basis-mapping.md` | 14 · 48 · 131 | dated reading (header: read at `cd9daa8`, 2026-10-09) | **dated note appended, carried by this PR** — 136 → **167** lines; **first 136 byte-identical** (corrected 2026-10-14: this row said 135, and the append begins after line 136, which `diff` on the two versions confirms). The appended note is **166 lines as first written and 167 with this re-derivation**: its own employee-writer sentence and two code citations were corrected in place inside the note, because the note had never landed either (§2's writer row is the same correction). The note's before-md5 is `d12e2df4…`; as it now stands the file is `e7a3edf6c1e18821c683654fbf6deca7` |
| `design-concepts/LAYER2-P2-2-IMPLEMENTATION-NOTES.md` | 10 (its banner) · 59–65 (item 5) | dated reading with its own correction banner | **one clause added to that same banner line**: `adfc4121…` → **`79510abeed9f01039e1ae41afe58c9b0`**, **104 lines before and after**, every other line byte-identical. **Re-derived 2026-10-14:** the clause's `server/index.js:735`–`:738` is now `:727`–`:730` (#186 took that file from 892 to 883 lines), and its `preboarding-items.js` / `schema.sql` citations stand because those files are byte-identical. *(The branch's first cut of that clause ended at `866ca2d8…`; the re-derivation changed the line it points at, so that figure was verified against the file and superseded rather than carried — a hash in an instruction is checked before it is written as current.)* The doc's own rule ("re-derive any line number instead of trusting one") is what makes an in-place banner edit safe here |
| `pdpl-acknowledgement-route-spec.md` | 16 · 30 · 113–121 · 135 · 147 | dated spec | **already re-grounded — no edit.** Its head note (`:10`) names the shipped instrument, states that none of §6's "Today" strings survives as UI text, and re-points every code citation; `:121` quotes the retired refusal as the *old* cell |
| `roadmap-board-index.md` | 334 · 339 | the corrected tracker record | **no edit** — it reports and then corrects the P2-6 row's own premise, quoting the replaced wording as what the row left behind (`:334` Round 44's report, `:339` Round 45's corrections, the row named at `:494`). Byte-identical at `a48668d` and `f46b7a9` (`8db7e708…`) |
| `design-concepts/COMPLIANCE-AUDIT-UI.md` | 48 · 516 · 517 | **a different instrument** — the employee-level consent register (decision 17), not P2-6's gate | **reported, not edited.** Mock copy, 2026-09-17 design pack (pack and repo copies byte-identical, md5 `1f6adda1…`, re-checked 2026-10-14), the string appears nowhere in `client/`, and the screen is not built |
| `design-concepts/README.md` | 15 · 17 | index label ("…and the PDPL consent gate") | **no edit** — the label names a section, and the gate it names exists; only its instrument was misnamed, which the designer's own re-grounding covers |
| `pdpl-portal-boundary-memo.md` | 22 · 23 · 80 · 154 | the corrected memo — **on the frozen send path** (`b6fa19e8…`) | **not touched.** Its facts 3–4 describe the pre-change record as a *finding*; its own correction is recorded there and in its PR |
| evidence transcripts: `docs/evidence/p2-2/http-acceptance.txt:27`; `docs/evidence/pdpl-acknowledgement-spec/README.md:41,151–155`; `docs/evidence/pdpl-lawful-basis-mapping/README.md:69`; `docs/evidence/l2-demo-seed/FINDINGS.md:69,70,80`; `docs/evidence/p2-6-portal-spec/measurements.txt:107,108`; `docs/evidence/notice-not-shown-copy-2026-10-12/README.md:105`; `docs/evidence/un-operable-controls-2026-10-12/reachability-report-2026-10-12.txt:59` | — | dated transcripts | **no edits.** A transcript records what the surface said on a named tree; rewriting one falsifies the record (`docs/evidence/l2-storage-decision/README.md:65` states the same rule for its own) |
| `server/preboarding-workspace.js:56` | a code comment: *"Consent recorded" is the PDPL consent record the employee track's gate already reads* | **a stale premise inside a served file — fixed in `main`** | **nothing left to do.** #186 (`959babd`, the cutover bundle) landed the booking this row made: at `f46b7a9` the comment (`:56`–`:59`) states that the employee-record consent flag was **retired** on 2026-10-13 (owner decision 17) and that what the gate reads is the notice recorded as *shown*, per collectable document. `git grep "Consent recorded" origin/main -- client server` still returns this comment and nothing else — no such UI string exists — but what it now says is true |
| pack pointers: `/home/team/shared/pdpl-lawful-basis-mapping.md` | — | **moved-pointer**, not a second copy | **no action.** It holds no copy of anything: it names `pdpl-lawful-basis-mapping.md` as the only copy and carries its own dated staleness test. **Re-measured 2026-10-14: 28 lines, 2,560 B, md5 `e0c3cfaa78f2d218fe3153f5ee4204df`** — the `691b0bae…` this record first cited is superseded by the pointer's own `last checked` line, appended 2026-10-14. The KSA analogy fails on the facts: that host file *was* a 10,662-byte second copy of a document the product serves, which is why decision 19 retired it; removing a pointer would destroy the only signpost saying where the document went |
| pack pointers: `/home/team/shared/pdpl-acknowledgement-route-spec.md` | — | **moved-pointer**, unchanged | **no action** — 15 lines, 996 B, md5 `4008f59e01df683d3e43b5c845742e32`; the repository document it points at is `pdpl-acknowledgement-route-spec.md` (163 lines, md5 `e8784595…`), both re-measured 2026-10-14 |
| pack pointers: `/home/team/shared/roadmap-board-index.md` | — | **moved-pointer — the class is at least three, not two** | **no action, one measurement worth having:** the pointer says "Last checked `2584361f…` (2026-10-08) … 221 lines, 65,348 bytes" while the repository copy is now **546 lines** (`8db7e708…`). Its own dated test is what makes that legible; the figure is a reading of the day it was written, exactly as this file's are |

Checked and clean (mention P2-6 without carrying the premise as current fact). **Four of these were
written here as bare paths and are pack documents — a bare path means the repository, so as first drafted
they stranded. They are corrected in place** (found 2026-10-14 by running the resolver's own rule over
this record): `/home/team/shared/phase2-gates-decision-memo.md`,
`/home/team/shared/phase2-decisions-recorded-2026-10-07.md`,
`/home/team/shared/round-44-index-board-reconciliation.md`,
`/home/team/shared/round-45-reground-three-rows.md` — the last of these being the Round 45 record §1 cites.
The repository documents in the same list are bare, which is right: `pdpl-portal-boundary-memo.md`
(its corrected cells), `demo-walkthrough-script.md:220`, `demo-weak-screens.md:74`,
`docs/evidence/p2-6-pdpl-memo/README.md:13` — the last three re-read on `f46b7a9` 2026-10-14: the demo
script's gate line, the roll-up total that is "not a consent figure any more", and the memo's transcript
digest all still resolve and still read as written. The skill `antum-board-row-removal` (`:128`) cites the
pack spec as the live example of a source that keeps regenerating a row; after this amendment the example
is historical, which the skill already says of its other cases.

## 5. The pack citation resolver

The 2026-10-12 record (`pack-path-resolution-sweep-2026-10-12.md`) states the rules, but its script is in
neither the repository nor the pack, so this is a **re-implementation of the stated rules** and its
numbers are today's — they are not a reproduction of that record's 112-document / 616-citation table.
Script, re-runnable: `/home/team/shared/scripts/pack-citation-resolver.py` (copy at
`~/pack-citation-resolver.py`).

Corpus: every `.md`/`.txt` under `/home/team/shared`, excluding the served tree
(`probable-octo-sniffle/`), `skills/` and `site/` (a dependency tree). Resolution roots, in order:
`origin/main` at the path written → the pack → relative to the citing file → the served tree → unique
basename → nothing. Run 2026-10-14 against `origin/main` = `f46b7a9`:

```
corpus: 123 pack documents (.md/.txt; served tree, skills/, site/ excluded)
repository files at origin/main: 673
  citations: 1075
  at path written: 650
  unique basename only: 5
  ambiguous basename: 189
  UNRESOLVED: 231
  canonical citations: 793
  canonical by basename: 5
  canonical UNRESOLVED: 154
CANONICAL unresolved citations: 56
```

The corpus grew from 118 to 123 documents between the sweep and this re-derivation (this record's own PR
folder is in the pack), so these are not the same run's figures as the ones first drafted for this
section; they are the current ones.

**The 154 is not a defect count, and saying so is the point.** The rule cannot read a token's *role*, so
the unresolved set is dominated by strings nobody is meant to follow: directory labels (`server/`,
`client/`), globs (`assets/index-*.js`), build-artifact names (`index-Dt2oLspq.js`, `raw-evidence.txt`),
module specifiers (`./db`), branch names, `git show` forms (`origin/main:templates/privacy-notice.md`),
placeholders (`<name>.md`), proposed component filenames, URLs, and one environment assignment
(`HOOK_DST=/etc/profile.d/…`). Filtered programmatically to tokens that contain a slash and end in a file
extension and carry no placeholder or glob — then read by hand — the **56 canonical unresolved citations**
come to **7 tokens / 7 distinct**, and two of the seven are not paths at all (`.js/.jsx/.ts/.tsx/.sql`, an
extension list, and the `HOOK_DST=` assignment). What a reader would try to follow and land nowhere today
is five:

- `/home/team/shared/templates/privacy-notice.md` — **not in this residual**, and worth saying why: the
  copy was retired by moving it aside, and the resolver now reaches the repository template by unique
  basename, so the 401-by-design miss this record's first draft listed no longer appears here;
- `client/dist/assets/index-BwgKPRwf.js`, `client/dist/assets/index-Cwq9dzzZ.js`, `assets/index-gt1pFhU5.js`,
  `assets/index-Dt2oLspq.js` — build artifacts, which live in the served tree the corpus excludes;
- `server/re-derive-eosb.js` — named in a dated record about a tree that no longer exists.

**The check that bears on this PR, run scoped:** the amended pack spec cites four repository paths and
**all four resolve** — `server/preboarding-items.js`, `templates/privacy-notice.md`, `server/schema.sql`,
`server/index.js` (`git cat-file -e origin/main:<path>` present for each, re-checked 2026-10-14). The spec
carried **no** path citations before the amendment, so nothing in it could strand. The repository documents
this PR edits cite `server/preboarding-items.js`, `server/schema.sql`, `server/index.js`,
`client/src/App.tsx`, `server/reachability-register.js`, `templates/privacy-notice.md`,
`design-concepts/LAYER2-P2-2-IMPLEMENTATION-NOTES.md`, `design-concepts/LAYER2-PREBOARDING-UI.md`,
`roadmap-board-index.md` and `pdpl-acknowledgement-route-spec.md` — all present at the paths written.

**Run scoped on this record itself** (`--file docs/evidence/p2-6-premise-sweep/README.md`, 2026-10-14):
110 citations, 92 canonical, **9 canonical unresolved** — and every one of the nine is a string this file
quotes *as* an unresolved token: the two extension lists (`.md`, `.txt`, `.js/.jsx/.ts/.tsx/.sql`), the four
build-artifact names, the glob example, and `server/re-derive-eosb.js`. **No citation this record makes in
order to be followed strands.** That also found a real one before it landed: four documents in §4's
"checked and clean" list are pack documents that were written as bare paths, which the rule reads as
repository paths — corrected in place there.

## 6. Cutover — measured, not assumed

The PR touches **three markdown files and nothing else**: this record, `pdpl-lawful-basis-mapping.md`,
and one clause in `design-concepts/LAYER2-P2-2-IMPLEMENTATION-NOTES.md`. No file under `client/`, none
under `server/`, no asset, no route; `git diff --stat origin/main...HEAD` on this branch reads 3 files,
and the pack spec's amendment (`/home/team/shared/phase-roadmap-2-4.md`) is outside the repository
entirely. The served surface is a built bundle plus the server process, and the server reads none of
these files. **No cutover is owed** — and the reason is the file list, not a precedent.

Two consequences worth stating, both measured:

- **The cutover the platform owes is real and is not this PR's.** #182 and #186 changed served files
  (`server/index.js`, `server/db.js`, `server/preboarding-workspace.js`); the served tree is still
  `9d2182a`, so those routes still answer on the live demo. Nothing here changes that, and nothing here
  should be read as closing it.
- **This record is what makes two citations in the merged design spec true.** `design-concepts/LAYER2-PREBOARDING-UI.md:552`
  and `:1211` cite `docs/evidence/p2-6-premise-sweep/` — a path that exists **only** on this branch
  (`git ls-tree -r --name-only origin/main | grep -c p2-6-premise-sweep` → **0**; on this branch → **1**).
  The path and the filename are therefore kept exactly as written, and both citations resolve against
  this branch's tree.

## 7. What is left for others

- **Product Designer:** §8/§8A/§11 are **done** — #185 re-grounded them in place and #187 re-measured the
  cites. What is left is the one finding below, which is theirs to act on because it is their file.
- **Next cutover (engineer):** **nothing from this record.** The `preboarding-workspace.js:56` comment and
  the `server/db.js` refusal both landed in #186's cutover bundle; the remaining cutover is that bundle's,
  not a booking made here.
- **Owner, decision 17:** **executed in the repository** (#182/#186) — the instrument is retired, its
  route is gone, its writers are fenced to zero, and `consent_records` is kept for decision 14's
  purpose-scoped consent. The `consent_granted`/`consent_date` **columns** are not dropped in that pass;
  the recommendation to enumerate them first stands as filed.
- **Lead:** the pack pointers are **moved-pointers, not stale copies** (§4) — three of them now, not two;
  and `design-concepts/COMPLIANCE-AUDIT-UI.md`'s mock copy for the consent register is the designer's
  wording call if that screen is built.

### An open finding — two rows of the movement note's map (flagged, not edited)

Two rows of the design spec's movement note are marked *"found by sweeping the class"*, and both name line
numbers that do not land on the content the row describes. Measured 2026-10-14, both ends:

| row | its own "was" number | what that line actually holds on `a48668d` | where the site it describes is |
|---|---|---|---|
| `:906` → `911` | §8C's `input.actor` contrast | §10 Q4, the **read-event** question (`:906` is that question's "honest default is not to record it" line) | the §8C paragraph is at `:869`–`:872` on `a48668d`; rewritten in place it is `:907`–`:921` at `f46b7a9`, and the clause the row describes is `:916`–`:919` — so `:911` lands four lines above it |
| `:1028` → `1040` | §12's 2026-10-09 cite-resolution record | **§11's heading** (`## 11. Acceptance traceability`) | the record is at `:989` on `a48668d` and `:1038` at `f46b7a9`; the row's `:1040` lands two lines inside it |

The other thirteen rows of that map check out: three were verified end-to-end (`:541`→`546`, `:885`→`931`,
`:1036`→`1090`; each "was" line holds the pre-pass text and each "is now" line holds the rewritten one on
`f46b7a9`). So this is two bad rows, not a bad method. **Flagged rather than edited:** the note is a dated
record inside the author's file, and the rows are theirs to correct — the same reason the sweep's own block
was dropped instead of landing beside their pass.
