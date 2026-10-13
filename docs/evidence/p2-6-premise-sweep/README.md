# The P2-6 premise sweep — "PDPL consent is captured" measured against the shipped instrument

**Date:** 2026-10-13 · **Author:** compliance · **Tree read:** `origin/main` = `a48668d`
**Subject:** one spec line that kept generating a requirement the product does not implement, every
document that carried the same premise, and what was done to each.

---

## 1. What was asked, and the answer

`/home/team/shared/phase-roadmap-2-4.md:38-39` (P2-6's outcome and acceptance) said *"PDPL consent is
captured before personal documents are collected … no document is collected before the consent record
exists."* The program-manager re-grounded the tracker row written from it (`roadmap-board-index.md:334`,
and `:339` naming the pack spec) and flagged the spec as the source.

**Measured against the product, the line is false in both halves, and the honest fix is to amend it —
not to report an unbuilt capture.** What gates collection is not a consent record and cannot be: the
notice assigns `consent` to exactly two purpose rows, both sensitive data
(`templates/privacy-notice.md:47-48` — occupational health, and biometric time & attendance), and **none
of the seven pre-boarding documents is either** (`server/preboarding-items.js:76-82`). The instrument
that gates them is a per-item record that **the notice was shown** — built, served and verified.

## 2. The shipped instrument (measured, not described)

| fact | evidence on `a48668d` |
|---|---|
| The instrument is the notice being **shown**, and the table's CHECK constraint makes it incapable of holding anything else | `server/preboarding-items.js:161` — `NOTICE_INSTRUMENT = 'notice_shown'` |
| An employee-track document cannot reach `received`/`verified` until the notice has been shown **for that item** — **428** | gate at `server/preboarding-items.js:466`; refusal at `:478`–`:480` |
| An item the notice assigns **no basis** to is not collectible at all — **409**, naming the counsel question it waits on | `server/preboarding-items.js:432`–`:451` (`Q1` for the two certificates, `Q5` for the emergency contact) |
| A record with **no named actor** is refused — **400** | `server/preboarding-items.js:310`–`:312` |
| The recorded version is read from the notice the server serves, not from the caller | same comment block, `:315`–`:317` |
| The record has its own route; the two **case consent routes were removed, not reworded** | `POST /api/preboarding/cases/:id/notice-acknowledgements` at `server/index.js:749`; reason at `:735`–`:738` |
| The case-level consent table is **retired**: no reader, no writer, reason in the schema | `server/schema.sql:255`–`:270` |
| The **employee**-level consent path still writes `consent_records`, and has **no caller** | `server/index.js:359`–`:366` (owner decision 17) |
| The client literal `{ …, lawful_basis: 'consent', consent_version: 'v1' }` is gone | `git grep consent_version origin/main -- client/src` → no client hit |

**Why amend, and not report.** Option (b) is for a spec that asks for more than we ship. The spec asks
the right *question* — is the notice in front of the hire before we collect their documents? — and the
product answers it per item, with the basis, the version and a named actor. The only unimplemented half
of P2-6 is the **hire-facing portal** (specified in §§8A–8C, blocked on owner decision 14): a portal,
not a consent capture. The one genuine consent *capture* left in the product is the employee-level
instrument, and decision 17 already covers it with a recommendation.

## 3. The source fix — the pack spec

`/home/team/shared/phase-roadmap-2-4.md` is in the pack, not the repository, and is cited as such
(`design-concepts/LAYER2-PREBOARDING-UI.md:53`, `roadmap-board-index.md:3`, `:339`) — **so no PR can
carry it.**

| | before | after |
|---|---|---|
| md5 | `14f79661bcff0b4f6d474792413e5aed` | `47393d6cda3194d5bc5adc6692075187` |
| lines (`wc -l`) | 105 | 133 |
| bytes | 8,594 | 10,916 |

Shape of the diff: `38,39c38,39` (the two criterion lines, replaced in place, so **no other line number
in the file moves**) plus 28 lines appended after old line 105 (a dated `## Amendment` note at
`:108`–`:133` recording what it replaced, the shipped instrument, and the amendment's own before-md5).
Written by `~/amend-p2-6-spec.py`, which asserts md5, line count, the byte-identity of lines 1–37 and the
exact previous wording of `:38`/`:39` before writing.

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
| `design-concepts/LAYER2-PREBOARDING-UI.md` | 82 · 541 · 544 · 550–553 · 562 · 564–566 · 574–575 · 583–589 · 628 · 714–716 · 885 · 902 · 937 · 1013 · 1036 | design spec, reads as current | **dated block appended** — 1133 → 1198 lines (`:1134`–`:1198`); first 1132 byte-identical, so no other document's `:NNN` citation moves. Names each stale site and why; does not rewrite §8/§8A/§11, which are the Product Designer's pass |
| `pdpl-lawful-basis-mapping.md` | 14 · 48 · 131 | dated reading (header: read at `cd9daa8`, 2026-10-09) | **dated note appended** — 136 → 166 lines; first 135 byte-identical |
| `design-concepts/LAYER2-P2-2-IMPLEMENTATION-NOTES.md` | 10 (its banner) · 59–65 (item 5) | dated reading with its own correction banner | **one clause added to that same banner line**: `adfc4121…` → `866ca2d85a15542585ae30b9d86d3a65`, **104 lines before and after**, every other line byte-identical. The doc's own rule ("re-derive any line number instead of trusting one") is what makes an in-place banner edit safe here |
| `pdpl-acknowledgement-route-spec.md` | 16 · 30 · 113–121 · 135 · 147 | dated spec | **already re-grounded — no edit.** Its head note (`:10`) names the shipped instrument, states that none of §6's "Today" strings survives as UI text, and re-points every code citation; `:121` quotes the retired refusal as the *old* cell |
| `roadmap-board-index.md` | 334 · 339 | the corrected tracker record | **no edit** — it quotes the old criterion as what the row replaced |
| `design-concepts/COMPLIANCE-AUDIT-UI.md` | 48 · 516 · 517 | **a different instrument** — the employee-level consent register (decision 17), not P2-6's gate | **reported, not edited.** Mock copy, 2026-09-17 design pack (pack and repo copies byte-identical, md5 `1f6adda1…`), the string appears nowhere in `client/`, and the screen is not built |
| `design-concepts/README.md` | 15 · 17 | index label ("…and the PDPL consent gate") | **no edit** — the label names a section, and the gate it names exists; only its instrument was misnamed, which the appended block covers |
| `pdpl-portal-boundary-memo.md` | 22 · 23 · 80 · 154 | the corrected memo — **on the frozen send path** (`b6fa19e8…`) | **not touched.** Its facts 3–4 describe the pre-change record as a *finding*; its own correction is recorded there and in its PR |
| evidence transcripts: `docs/evidence/p2-2/http-acceptance.txt:27`; `docs/evidence/pdpl-acknowledgement-spec/README.md:41,151–155`; `docs/evidence/pdpl-lawful-basis-mapping/README.md:69`; `docs/evidence/l2-demo-seed/FINDINGS.md:69,70,80`; `docs/evidence/p2-6-portal-spec/measurements.txt:107,108`; `docs/evidence/notice-not-shown-copy-2026-10-12/README.md:105`; `docs/evidence/un-operable-controls-2026-10-12/reachability-report-2026-10-12.txt:59` | — | dated transcripts | **no edits.** A transcript records what the surface said on a named tree; rewriting one falsifies the record (`docs/evidence/l2-storage-decision/README.md:65` states the same rule for its own) |
| `server/preboarding-workspace.js:56` | a code comment: *"Consent recorded" is the PDPL consent record the employee track's gate already reads* | **a stale premise inside a served file** | **recorded, not fixed here.** `git grep "Consent recorded" origin/main -- client server` returns this comment and nothing else — no such UI string exists. It cannot ride a docs-only PR; it belongs with the `db.js` fix the plan books for the next cutover |
| pack copies: `/home/team/shared/pdpl-lawful-basis-mapping.md` (`691b0bae…`), `/home/team/shared/pdpl-acknowledgement-route-spec.md` (`4008f59e…`) | — | **stale second copies**, each diverging from `origin/main` (`d12e2df4…`, `e8784595…`) before this PR | **reported for the lead; not touched.** Re-copying them would recreate the second-copy problem the repository-as-authority rule exists to prevent |

Checked and clean (mention P2-6 without carrying the premise as current fact):
`phase2-gates-decision-memo.md`, `phase2-decisions-recorded-2026-10-07.md`, `pdpl-portal-boundary-memo.md`
(its corrected cells), `round-44-index-board-reconciliation.md`, `round-45-reground-three-rows.md`,
`demo-walkthrough-script.md:220`, `demo-weak-screens.md:74`,
`docs/evidence/p2-6-pdpl-memo/README.md:13`. The skill `antum-board-row-removal` (`:128`) cites the pack
spec as the live example of a source that keeps regenerating a row; after this amendment the example is
historical, which the skill already says of its other cases.

## 5. The pack citation resolver

The 2026-10-12 record (`pack-path-resolution-sweep-2026-10-12.md`) states the rules, but its script is in
neither the repository nor the pack, so this is a **re-implementation of the stated rules** and its
numbers are today's — they are not a reproduction of that record's 112-document / 616-citation table.
Script, re-runnable: `/home/team/shared/scripts/pack-citation-resolver.py` (copy at
`~/pack-citation-resolver.py`).

Corpus: every `.md`/`.txt` under `/home/team/shared`, excluding the served tree
(`probable-octo-sniffle/`), `skills/` and `site/` (a dependency tree). Resolution roots, in order:
`origin/main` at the path written → the pack → relative to the citing file → the served tree → unique
basename → nothing.

```
corpus: 118 pack documents (.md/.txt; served tree, skills/, site/ excluded)
repository files at origin/main: 657
  citations: 943          at path written: 586     by unique basename: 1
  ambiguous basename: 151                  UNRESOLVED as written: 356
  canonical citations: 699   canonical at path written: 574   canonical UNRESOLVED: 124
```

**The 124 is not a defect count, and saying so is the point.** The rule cannot read a token's *role*, so
the unresolved set is dominated by strings nobody is meant to follow: directory labels (`server/`,
`client/`), globs (`assets/index-*.js`), build-artifact names (`index-Dt2oLspq.js`, `raw-evidence.txt`),
module specifiers (`./db`), branch names, `git show` forms (`origin/main:templates/privacy-notice.md`),
placeholders (`<name>.md`), proposed component filenames, URLs. Filtered by hand to tokens that both
contain a slash and name a file, the residual is **22 tokens / 15 distinct**, and only these would a
reader try to follow and land nowhere today:

- `/home/team/shared/templates/privacy-notice.md` (×4) — **unresolved by design**: the copy was retired
  by moving it aside, so nothing sits at the path;
- `client/dist/assets/index-*.js`, `assets/index-Cc1GodRa.js`, `index-gt1pFhU5.js`, `index-Dt2oLspq.js`,
  `client/dist/assets/index-Cwq9dzzZ.js`, `client/dist/assets/index-BwgKPRwf.js` — build artifacts, which
  live in the served tree the corpus excludes;
- `server/re-derive-eosb.js`, `extra/served-page.html`, `label-rule-recheck/README.md` — named in dated
  records about trees that no longer exist.

**The check that bears on this PR, run scoped:** the amended pack spec cites four repository paths and
**all four resolve** — `server/preboarding-items.js`, `templates/privacy-notice.md`, `server/schema.sql`,
`server/index.js` (`git cat-file -e origin/main:<path>` present for each). The spec carried **no** path
citations before the amendment, so nothing in it could strand. The repository documents this PR edits
cite `server/preboarding-items.js`, `server/schema.sql`, `server/index.js`, `client/src/App.tsx`,
`templates/privacy-notice.md` and `design-concepts/LAYER2-P2-2-IMPLEMENTATION-NOTES.md` — all present at
the paths written.

## 6. Cutover — measured, not assumed

The PR touches **four markdown files and nothing else**: two `design-concepts/` specs,
`pdpl-lawful-basis-mapping.md`, and this record. No file under `client/`, none under `server/`, no asset,
no route; `git diff --stat` on the branch is 3 changed files (+96/−1) plus this untracked directory. The
pack spec's edit is outside the repository entirely. The served surface is a built bundle plus the server
process, and the server reads none of these files. **No cutover is owed** — and the reason is the file
list, not a precedent.

## 7. What is left for others

- **Product Designer:** §8/§8A/§11 need the re-grounding pass. The appended block names every stale site
  (`:82`, `:541`, `:544`, `:550`–`:553`, `:562`, `:564`–`:566`, `:574`–`:575`, `:583`–`:589`, `:628`,
  `:714`–`:716`, `:885`, `:902`, `:937`, `:1013`, `:1036`) and the two stranded citations.
- **Next cutover (engineer):** the comment at `server/preboarding-workspace.js:56`, alongside the
  `server/db.js` fix already booked.
- **Owner, decision 17:** the employee-level consent instrument is the only consent *capture* left
  (`consent_records` + the callerless `POST /api/compliance/consent`). Untouched by this PR; the
  recommendation stands as filed.
- **Lead:** two pack copies of repository documents are stale (`691b0bae…`, `4008f59e…`) and
  `design-concepts/COMPLIANCE-AUDIT-UI.md`'s mock copy for the consent register is the designer's wording
  call if that screen is built.
