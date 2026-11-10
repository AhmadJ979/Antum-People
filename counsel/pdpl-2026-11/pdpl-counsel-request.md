# UAE PDPL counsel request — the document twin of the five questions

*2026-10-12 · compliance · **draft, not sent.** The two EOSB requests have had a `.md` + `--send-ready.txt`
pair since 2026-09-28/10-02; the PDPL five had **only a table inside `AhmadJ979/Antum-People · pdpl-lawful-basis-mapping.md` (repository root) §4**, so they
could not be sent by anyone but their author. This closes that gap: the moment a recipient is named, the letter is
`/home/team/shared/pdpl-counsel-request--send-ready.txt` and nothing else needs writing.*

**Blocked on one thing, and it is not in this document: a recipient** (owner decision 15(a)). Nothing here is sent,
and nothing here decides the engagement. **Path convention (standing):** a bare path in this document means the repository `AhmadJ979/Antum-People` (`git show origin/main:<path>`); a host-pack path is written absolutely, from the pack root (`/home/team/shared/`).

## The five, and the numbers the product already uses

The product refuses two items **by the question they wait on** — `server/preboarding-items.js:135,142`
(`pending_counsel: 'Q1'`, the two qualification certificates) and `:154` (`pending_counsel: 'Q5'`, the emergency
contact) — so whoever hits that 409 is shown a question number. The letter must therefore be the same set, and here
is the cross-reference between the letter's items and the numbering already in the product and in
`AhmadJ979/Antum-People · pdpl-acknowledgement-route-spec.md` (repository root) §8:

| letter item | product Q-number | what it decides | source of the question |
|---|---|---|---|
| 1 — notice content | **Q1** | whether our six notice elements are the required set; **and both halves of the certificate question** (why the certificates are withheld): the notice's category list does name qualifications and certifications while its purpose table has no matching row — so should that category row stand, and what purpose and lawful basis should its purpose row state, or should the category row drop what we do not collect | `AhmadJ979/Antum-People · pdpl-lawful-basis-mapping.md` (repository root) §4 row 1; spec §8 rows 2 and 4 |
| 2 — Arabic | **Q2** | whether the Arabic notice must be **certified** (the answer cannot change *whether* we ship Arabic — the template is already bilingual) | §4 row 2 |
| 3 — the instrument | **Q4** | whether recording the notice as *shown* (per item, with basis, version and actor) discharges the duty to inform for contract/legal-obligation documents — and what an employer-kept record may be where the hire has no account; **plus the paper attestation block, which collects consent while the software records *shown*** | §4 row 4; **this is 15(b) itself**; the paper block is verified in the notice at `templates/privacy-notice.md:270-274` |
| 4 — emergency contact | **Q5** | whose data, what basis pre-day-one, who may give it | §4 row 5; spec §8 ("not in this spec's gift") |
| 5 — retention | **Q6** | whether the two-year floor holds, and whether a floor attaches to the acknowledgement record itself | §4 row 6 |

**Q3 is retired, and that is why the letter numbers five while the spec numbers six.** Q3 was "must the employment
contract be in Arabic?" — **dropped because our own baseline answers it** (`compliance-requirements.md:38`, §1.2 UAE
requires the contract "in writing (Arabic + English/other)"). It left the letter on 2026-10-09 after the audit and
takes no letter item. **Anyone reading "the sixth counsel question" as a *number* will collide with this** — see the
flag at the end.

## What this draft does not need from the owner before it can go

- **It quotes no internal document.** `AhmadJ979/Antum-People · pdpl-lawful-basis-mapping.md` (repository root) §5 lists two things the owner must give for the
  letter: a recipient, and *whether the letter may quote our internal documents*. This draft is written so that the
  second is not asked — it describes what the product does, not what our memos say. **Nothing here needs that
  permission.**
- **It does not choose the framing.** §5 offers two: the five join the existing UAE counsel request, or they travel as
  a PDPL request of their own. The body is written to be either — it can be sent alone or lifted into the UAE letter
  unchanged, because the questions are identical either way.

## What it deliberately does not do

- **No legal position is asserted as settled.** Each item asks; none declares. The one place a position appears
  ("we do not ask for consent… we record that the notice was shown") is stated as **what the product does**, not as
  what the law requires — which is exactly the distinction the whole 15(b) thread rests on.
- **No article number is asserted.** The notice template carries the caution that its article references follow our
  own reference set and must be confirmed; the letter asks for the posts rather than asserting them.
- **No fee, no engagement, no recipient** — the owner's.
- **The KSA half is not here.** The notice-compensation question (may it be set off against the EOSB, and the day
  counts) is labour law, and it is **already in the KSA request**: `/home/team/shared/ksa-counsel-confirmation-request--send-ready.txt:13`
  asks for "the current article(s), the correct periods, and the correct measure for unserved notice" and states the
  never-deducted treatment. What is *not* yet asked there is the **set-off** in terms — ours to add, one clause, if
  the owner wants it in the same letter.

## The paper attestation block — measured, and what it actually contains

*2026-10-12; re-grounded 2026-11-10.* The block is in the notice at `templates/privacy-notice.md:270-274` — v2.3 as served on 2026-10-12, the same rows in the v2.4 tree, which inserts §9 above them (and present in the pack's
`templates/privacy-notice.html`). It is more than "the block still collects consent", and the distinction decides what we ask:

| line | what it says | which instrument |
|---|---|---|
| `:270` | "I confirm I have read and understood this Privacy Notice / أُقر بأنني اطلعت…" — pre-set `Yes / نعم` | an **acknowledgement** — the instrument 15(b) built |
| `:271` | "I consent to the processing of my personal data as described, including [sensitive categories, where applicable]" — checkbox `☐ Yes / نعم` | **consent**, with a withdrawal path the product does not have |
| `:273` | `Consent Version / إصدار الموافقة` = `v2.4 (2026-11-10)` | names **our notice version a "Consent Version"** |
| `:274` | `Signature / التوقيع` | a hand-signed consent artefact |

Three consequences:

1. **One table carries two instruments** — an acknowledgement *and* a consent — so the paper form cannot be settled by
   the 15(b) ruling alone. That is why it is asked inside item 3 rather than assumed either way.
2. **"Consent Version" is a naming defect that is ours, not counsel's.** What we version is the *notice*; the word
   "Consent" in that field is our own drafting, and it becomes wrong the moment the answer to item 3 is "the
   acknowledgement is the instrument". Recorded here so it does not wait on a reply, and flagged to the lead.
3. **The bracketed `[sensitive categories, where applicable]` is the one place the paper form reaches the
   biometrics/health rows** — the only purposes our notice places under explicit consent (`:47-48`). If counsel keeps a
   consent line, that is the scope it should be confined to.

**Why it is folded into item 3 and not numbered as a sixth item:** the product's own numbering is Q1–Q6, and a seventh
letter item would collide with it. The lead's framing — that the block "belongs with" the instrument question — is the
same reading, and the letter states it in the product's own voice: *our software records that the notice was shown; the
paper form collects consent.*

## One flag, recorded rather than smoothed — **closed 2026-10-12 by plan revision 79**

**Revision 79 settles the count, and settles it the way this file read it:** the set is stated once — five PDPL items
plus the KSA clause = six, in the product's numbering — with the paper attestation block read as the acknowledgement
question met *at the point of the document* rather than as a seventh. The paragraphs below are kept as the record of
what was flagged before that, not as an open question.

Plan revision 76 counts the counsel set two ways: Current Focus #1 says *"six questions standing — five plus the KSA
statutory half"*, and #3 calls the notice's paper attestation block *"the sixth counsel question"*. Both cannot be the
sixth, and there is a third source of confusion: the product's own numbering **already contains a Q6** (retention), and
the retired Q3 is a third number in the same series. My reading, offered as a reading:

- the **count** is five PDPL (this letter) + one KSA (§3 of the KSA ruling) = six; and
- the **paper attestation block** ("I consent … ☐ Yes / نعم") is not a separate item — it is the same question as
  letter item 3, met at the point of the document: the product records the notice as *shown* while the paper block
  still collects consent. If the owner prefers it asked separately, it is one clause added to item 3.

The attestation block is **verified present in the served v2.3** and nothing in this cycle touched it; it is the one
part of this cluster that is a *live* document question rather than a stale-text one.

## Provenance

- Questionnaire: `AhmadJ979/Antum-People · pdpl-lawful-basis-mapping.md` (repository root) §4 (the audited set) and §5 (framing options).
- Product-side numbering and dependencies: `AhmadJ979/Antum-People · pdpl-acknowledgement-route-spec.md:143-155` (repository root) (§8).
- The refusals that name the numbers: `server/preboarding-items.js:135,142,154` (catalogue), `:351-357` and `:489-494` (the two 409 texts at `2ff2891` — reason at `:353`/`:491`, counsel number at `:354`/`:492`).
- The dropped Q3 and why: `AhmadJ979/Antum-People · pdpl-lawful-basis-mapping.md` (repository root) §4 row 3; `compliance-requirements.md:38,74`.
- The KSA clause already in the other letter: `/home/team/shared/ksa-counsel-confirmation-request--send-ready.txt:13`.

## What the letter gained on 2026-10-29, and why it is not item 6
**Appendix A carries the notice's own citations.** It holds the register's notice rows — `docs/statutory-claim-register.md`, REG-56–REG-70, 15 rows — in the register's order and under the register's ids, quoting that file's `claim` column and its `path:line`. It is **an appendix, not a sixth numbered item**, because this letter's five items are cross-walked to the product's Q1, Q2, Q4, Q5, Q6 (the table above) and a sixth numbered item would sit one number from Q6 — which is item **5** — and be read as Q6. The letter names Appendix A in its own text, and the register writes the cells of those 15 rows `PDPL-A (P1)`…`(P15)`. **The note above at `:48-49` still stands**: this letter asserts no article number of its own, and the appendix keeps it — every number in the table is the notice's, quoted from the row beside it.

## Appendix A — the notice's own citations (P1–P15)
Row references are `file:line` in our privacy notice; the line numbers are those of commit `2ff2891`, which the notice has not moved from. Each row is a citation our privacy notice carries that we cannot source from our own materials, and that none of the five numbered points above puts in question. No article number in the table below is ours: each is the notice's own, quoted from the row beside it, and where the notice states something we cannot source the question is the only thing we add. The last column is the ask for that row.

| # | Where | The citation as our notice carries it | What we ask |
|---|---|---|---|
| P1 | `templates/privacy-notice.md:4` | jurisdictions: UAE PDPL (FDL 45/2021) and KSA PDPL (Royal Decree M/148, as amended 2023) | confirm this states the law correctly / identify the correct article |
| P2 | `templates/privacy-notice.md:22` | processing under UAE PDPL and/or KSA PDPL as applicable | confirm this states the law correctly / identify the correct article |
| P3 | `templates/privacy-notice.md:43` | payroll/administration lawful basis: UAE PDPL Art. 4(2); KSA PDPL Art. 6 | confirm this states the law correctly / identify the correct article |
| P4 | `templates/privacy-notice.md:87` | UAE transfers per UAE PDPL Arts. 22–23 and Cabinet Decision No. 65 of 2022 | confirm this states the law correctly / identify the correct article |
| P5 | `templates/privacy-notice.md:88` | KSA transfers per KSA PDPL Art. 29 (as amended 2023), and SDAIA conditions for sensitive data | confirm this states the law correctly / identify the correct article |
| P6 | `templates/privacy-notice.md:93` | rights response within 30 days, extendable to 60 days in complex cases | confirm this states the law correctly / identify the correct article |
| P7 | `templates/privacy-notice.md:97` | access right: UAE PDPL Arts. 7–14; KSA PDPL Art. 12 | confirm this states the law correctly / identify the correct article |
| P8 | `templates/privacy-notice.md:98` | rectification: UAE Arts. 7–14; KSA Art. 12 | confirm this states the law correctly / identify the correct article |
| P9 | `templates/privacy-notice.md:99` | erasure/destruction: UAE Arts. 7–14; KSA Art. 12 (explicit right to destruction) | confirm this states the law correctly / identify the correct article |
| P10 | `templates/privacy-notice.md:100` | restriction: UAE Arts. 7–14; KSA Art. 12 | confirm this states the law correctly / identify the correct article |
| P11 | `templates/privacy-notice.md:101` | portability: UAE Arts. 7–14; KSA Art. 12 | confirm this states the law correctly / identify the correct article |
| P12 | `templates/privacy-notice.md:102` | objection: UAE Arts. 7–14; KSA Art. 12 | confirm this states the law correctly / identify the correct article |
| P13 | `templates/privacy-notice.md:103` | automated-processing disclosure: UAE PDPL Art. 14; KSA Art. 12 / SDAIA rules | confirm this states the law correctly / identify the correct article |
| P14 | `templates/privacy-notice.md:113` | security measures in line with UAE PDPL Art. 11 and KSA PDPL requirements | confirm this states the law correctly / identify the correct article |
| P15 | `templates/privacy-notice.md:117` | DIFC/ADGM employees governed by DIFC Law No. 5 of 2020 / ADGM DP Regulations 2021, not federal PDPL | confirm this states the law correctly / identify the correct article |
