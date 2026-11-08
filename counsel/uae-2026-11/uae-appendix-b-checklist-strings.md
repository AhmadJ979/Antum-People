# Appendix B — the checklist strings we are keeping, put in front of counsel (UAE scope)

**Status: LANDED IN THE LETTER, 2026-11-04** (owner decision: *"Land the checklist strings as Appendix B"*). The four
rows below are now the letter's **Appendix B**, appended after Appendix A in **both** copies —
`/home/team/shared/uae-counsel-confirmation-request.md` (md5 `873d643f…` → `c399668030c7dd7b104a2c570f743372`) and its
`--send-ready.txt` twin (`76351f76…` → `f21ff5d7444d85ded79b1e3138715b05`) — with the **7 numbered items and Appendix A
byte-unchanged** (verified: both edits are pure appends). **Not sent:** the letter still needs a recipient address.

This file is kept as the **drafting record** (its own 40-check verifier still judges it). What a reader now needs is the
judge of the letter's copy: **`/home/team/shared/verify-appendix-b-in-letter.py`** — 21 checks, 0 failing, and a
`--selftest` that catches all 4 mutations (an en dash turned into a hyphen *inside a row*, a row's line number moved, a
row deleted, a reworded question). Its `--selftest` also records one measured trap: the B1 fragment appears **twice** in
the letter (the appendix row and the body prose describing it), so a mutant that edits the first occurrence scores a false
green — target the row.

**Author:** Compliance Expert. **Date:** 2026-11-04.
**Why it exists:** on 2026-11-03 the owner ruled that the unsourced citations in our checklists **stay as served** until
counsel sources them. A ruling that waits on counsel needs a document that reaches counsel, or it has no route to its own
expiry. This is that document, drafted.

**Measured at:** the shared tree `/home/team/shared/probable-octo-sniffle`, commit **`2a23e43`** (branch `main`, after the merge of PR #358),
file `server/compliance_engine.js`. Every line number below is a line of `2a23e43`.

`git diff --name-only 99ff072 2a23e43 -- server/compliance_engine.js` prints nothing: this module is byte-identical on the
**deployed** tree (`99ff072`) and on `main` now, so the lines and the quotes below are true of **what the product is serving
today**, not only of a branch.

## 1. What this appendix asks, and what it does not

* **Every row is a question.** No row states an article of ours, and this file offers no legal opinion. The one question is
  asked identically of every row, in the row's own cell.
* **Every quote is the served string, verbatim.** Each is the `description` field of the object at the line named, copied out
  of the file by script, not retyped. Section 7 is the command that re-derives all of them.
* **The strings are in the product, not in a draft.** `server/index.js:766` calls `generateTasks(...)` for an offboarding
  employee, which copies these `title`/`description` pairs onto that employee's checklist as tasks, and the signed-in user
  reads them on the offboarding screen. That is why an answer has to reach the string itself, not a summary of it.
* **What it does not do:** it does not ask for the strings to be changed, and it does not propose wording. The strings stay
  exactly as served until an answer arrives, per the owner's ruling.

**The inclusion test, stated so a reader can move a row:** include a description when it **names an article** (`Art.`, `Arts.`,
`Article`, `FDL`, `M/51`) **or states a statutory deadline as a figure** (`within N days`, `within N weeks`, or a day range such
as `N–M days`). Applied to the UAE block of `server/compliance_engine.js`:

| | onboarding | offboarding | total |
|---|---|---|---|
| descriptions in the UAE block | 7 | 8 | 15 |
| **carrying an article number or a deadline** | **0** | **4** | **4** |

So Appendix B is **4 rows: 0 onboarding, 4 offboarding.** The onboarding block carries none — its seven descriptions
name regulators and steps (MoHRE, entry permit, medical fitness, Emirates ID, visa stamping, WPS, the privacy notice) but no
article and no deadline. The near-misses on both sides are named in section 4 rather than silently dropped.

## 2. Appendix B — the UAE checklist strings (B1–B4)

Row references are `file:line` in `server/compliance_engine.js` at `2a23e43`. The quoted column is the string the product serves.

| # | Where | Checklist row (its title) | The string as the product serves it (verbatim) | Question to counsel |
|---|---|---|---|---|
| B1 | `server/compliance_engine.js:22` | Notice Period Verification | "Confirm notice period served (30–90 days per contract)." | Which article governs this, or is the claim wrong? |
| B2 | `server/compliance_engine.js:23` | EOSB Calculation (UAE) | "Calculate basis = basic wage only (FDL 33/2021 Arts. 51–53)." | Which article governs this, or is the claim wrong? |
| B3 | `server/compliance_engine.js:26` | Residency Visa Cancellation | "Complete visa cancellation within 30 days." | Which article governs this, or is the claim wrong? |
| B4 | `server/compliance_engine.js:27` | Final Settlement Payment (within 14 days) | "Complete final payment within 14 days." | Which article governs this, or is the claim wrong? |

The four rows, counted by what they carry — **a fact about the strings, not an opinion on them:** one row carries an article
number (B2, `:23`); the other three carry figures only — one day range qualified "per contract" (B1, `:22`) and two stated
deadlines (B3 `:26`, B4 `:27`). Nothing here says any of the four is right or wrong; that is what the question column asks.

## 3. Out of scope — the KSA (`M/51`) rows, listed so nobody adds them to a UAE letter

`server/compliance_engine.js` carries a second jurisdiction. **17 of its descriptions are KSA**, and 5 of those carry an
article or a deadline. They are governed by Saudi Royal Decree **M/51**, not by UAE law: a UAE-qualified counsel cannot
answer them, and putting them in a UAE letter would either get no answer or an answer from the wrong instrument. **They are
NOT part of Appendix B and must not be added to it.** They belong in the KSA letter (`/home/team/shared/ksa-counsel-confirmation-request.md`).

Listed here only so the boundary is visible and the count is checkable:

| # | Where | Checklist row (its title) | The string as served (verbatim) | Why out of scope |
|---|---|---|---|---|
| K1 | `server/compliance_engine.js:43` | Notice Period Verification | "Confirm served or compensated (M/51 Arts. 74–75)." | Saudi (M/51): names a KSA article |
| K2 | `server/compliance_engine.js:44` | EOSB Calculation (KSA) | "Calculate basis = total monthly salary including allowances (M/51 Art. 84)." | Saudi (M/51): names a KSA article |
| K3 | `server/compliance_engine.js:46` | Iqama Cancellation/Transfer | "Complete Iqama formalities (within 90 days)." | Saudi (M/51): states a KSA deadline as a figure |
| K4 | `server/compliance_engine.js:48` | Service Certificate Issuance | "Issue mandatory service certificate (within 2 weeks)." | Saudi (M/51): states a KSA deadline as a figure |
| K5 | `server/compliance_engine.js:50` | Final Settlement Payment | "Pay salary + EOSB + leave + notice (within the settlement deadline)." | Saudi (M/51): refers to a deadline without stating one |

**Count check:** 4 UAE rows asked (section 2) + 5 KSA rows excluded (this section) = 9, which is the whole of the
citation-bearing set in this module. The register `docs/statutory-claim-register.md` (section 4.5) independently lists the
same nine lines as REG-71…REG-79 — four UAE, five KSA — at the same line numbers. It measured them at `2ff2891`; all nine
lines are **byte-identical** at `2ff2891` and at `2a23e43` (the only changes to this file since are below line 50, in
`REQUIRED_FACTS` and `renderTemplate`), so no checklist line moved under a register row.

## 4. What did not fit the shape

Named so the boundary is a decision the owner can make, not an omission.

**(a) UAE descriptions that assert an obligation but name no article and no deadline — excluded, 2.** If the owner wants any
of them asked, each moves the count by one and nothing else:

* `server/compliance_engine.js:11` (MoHRE Contract Signing) — "Ensure the employee signs the official MoHRE contract template."
* `server/compliance_engine.js:13` (Medical Fitness Test) — "Schedule and complete the mandatory medical fitness test in UAE."

They were excluded on the stated test because each asserts a step or an obligation without naming what imposes it — no
article, no figure. The string at `:13` calls the medical fitness test "mandatory" and never says what makes it so; that is
the closest of the two to the test, and the more arguable exclusion. `:11` calls the MoHRE template "official" for the same
reason.

**(b) A deadline referred to but never stated — 1, and KSA anyway.** `server/compliance_engine.js:50` says
"Pay salary + EOSB + leave + notice (within the settlement deadline)." — "within the settlement deadline" names no figure and no article. It is in the KSA block, so it is out of scope for a
UAE letter (section 3, K5); it is listed here because a numeric test on deadlines alone would miss it.

**(c) The two privacy-notice checklist rows — excluded.** `server/compliance_engine.js:17` and `:38` state what the product
records when the notice is shown. They carry no article number and no deadline; the PDPL letter asks the notice's own
citations separately (its Appendix A, rows P1–P15).

**(d) Everything else in the module — excluded by the test.** Hardware return, access revocation, annual-leave encashment,
work-permit cancellation, Qiwa/GOSI/Mudad steps, Iqama formalities, final exit visa: steps and systems, no article, no figure.

## 5. What this adds over what the letter already asks — read before inserting

**This is the honest part, and it is not what the brief assumed.** Three of the four rows are *already* put in question by
numbered items of the UAE letter, **in paraphrase**:

| Row | Already asked, in paraphrase | Where |
|---|---|---|
| B1 (notice, 30–90 days) | "We use a notice period of **30–90 days per contract**" | letter item 5 |
| B2 (basic wage, Arts. 51–53) | "We calculate on **basic wage only** … We believe this is **Art. 51**" | letter item 1 |
| B3 (visa cancellation, 30 days) | "the visa must be cancelled within **30 days** of termination" | letter item 6 |
| B4 (final settlement, 14 days) | "final settlement is payable within **14 days**" | letter item 6 |

So the gap the ruling needs closed is **not** "counsel was never asked about these figures" — counsel was, in the letter's
own words. The gap is that **no question anywhere quotes the checklist string**, so an answer cannot be applied to the string
that stays on the screen: counsel can confirm "14 days" and we still cannot show, from the letter, which served sentence that
answer corrects. Appendix B closes exactly that gap, and nothing more.

**Two ways to land it, owner's call:**

1. **Add Appendix B as a second appendix** (what this file drafts). Cost: the letter grows by one table; no item is
   renumbered, because an appendix takes no number (the same reason the PDPL letter's Appendix A is an appendix and not a
   sixth item).
2. **Quote the four strings inside items 1, 5 and 6** instead, and add no appendix. Cheaper, but it edits three numbered
   items, and item 6 would then carry two verbatim strings.

Either way the requirement is the same: **the string itself must reach counsel verbatim**, or the ruling cannot be discharged.

## 6. The closing line the letter can cite

For insertion as the last paragraph of the appendix (or as the paragraph that introduces it, if the owner prefers the
strings folded into items 1, 5 and 6). It asserts no article and offers no opinion:

> "Appendix B lists the 4 UAE offboarding-checklist entries our product shows with an article number or a deadline and no
> source we hold. Each is quoted exactly as the product serves it, byte for byte. They stay in the product unchanged until you
> answer, and each answer will be applied to the string itself. The only article numbers in Appendix B are the ones our own
> strings already carry, quoted in the row beside them; we assert none of our own. If a string is simply wrong, say so and we
> will correct or remove it — that answer ends the question for that row just as an article number would."

## 7. How to check this file

**Re-derive the row set and every quote.** The loop prints the four source lines; each must contain the string quoted in
section 2, character for character:

```
cd /home/team/shared/probable-octo-sniffle && for n in 22 23 26 27; do
  sed -n "${n}p" server/compliance_engine.js
done
```

**Re-derive the count.** This prints `8` — descriptions carrying `Art`/`FDL`/`M/51` or a numeric deadline (the one
reference-only row, `:50`, is not in it, which is why section 3 lists five KSA rows and this command counts four):

```
cd /home/team/shared/probable-octo-sniffle && awk 'NR>=8 && NR<=52' server/compliance_engine.js \
  | grep -cE "(Arts?\.|Article|FDL|M/51|within [0-9]+ (days|weeks)|[0-9]+[^0-9]+[0-9]+ days)"
```

**The two scripts, so this can be re-run rather than hand-fixed:** `/home/team/shared/appendix-b-generate.py` (writes this
file, quotes injected from the source) and `/home/team/shared/appendix-b-verify.py` (reads this file, judges every quote
against `server/compliance_engine.js` and the revision this file names; `APPENDIX_DOC=<path>` judges a copy). The verifier
runs 40 checks. It was shown to redden on three mutants of this document — an en dash typed as a hyphen, a row's line number
moved by one, and the stated count inflated by one — each of which it failed; the unmodified file passes 0 failing.

**Guard against a re-typed quote.** Every quoted string in sections 2 and 3 was injected from the file by script; if this
document is ever hand-edited, re-run the generator rather than fixing a character by hand — an em dash typed as a hyphen is a
paraphrase, and a paraphrase is the one thing this appendix may not contain.

---

**Counts, printed (not a verdict):** 4 rows asked (B1–B4, 0 onboarding / 4 offboarding) · 5 KSA rows excluded · 32
descriptions in `server/compliance_engine.js` (15 UAE, 17 KSA) · 9 of them carry an article number or a deadline
reference (4 UAE, 5 KSA — of which 8 state a figure and 1 only refers to a deadline).
