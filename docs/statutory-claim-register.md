# Statutory claim register

**Measured at:** deployed tree `/home/team/shared/probable-octo-sniffle`, branch `main`, commit **`2ff2891`** (`2ff2891003c8e1265bcb13ac45720e0c3c4fc330`), 2026-10-29.
**Author:** Compliance Expert.
**Why it exists:** the plan carried a statutory count with nothing behind it, and under the plan's own rule — *a count the plan cannot source to a file is withdrawn, not carried* — the headline `67 / 36 / 31 / 0`, the phrase `~20`, the identifier `U36` and `six strings` were withdrawn. This file is where the count now lives: one row per claim, each with a `path:line` at the revision named above. **Every line number below is a line of `2ff2891`.** A hash must name the revision it was measured from, so a row cited from any other revision is stale and must be re-measured, not renumbered. To read a row against the file it names: `git show 2ff2891:templates/uae-employment-contract.md | sed -n '126p'`.

## 1. What a row is, and what "shipped" means here

A row is **one line of a shipped artefact that asserts a proposition of labour or data-protection law**: it names a statute, an article, or the regulator that imposes a requirement, or it states a legal entitlement, rate, deadline or threshold — as a figure or as an immediate rule.

"Shipped" is not the same as "on a screen", and the difference matters here. `server/compliance_engine.js` classifies three of the four templates as **instruments** (`DOCUMENT_CLASS`, `:165-173`), and the product **withholds an instrument's body** when a fact it states is not held — a reader who asks for one receives the refusal document (`:259`), which carries *no clause, no signature block and no figure*. So:

* the **contract and settlement rows** below are shipped **text**, not a served **document**: the claims exist in the repository's template set, and the product declines to issue the bodies;
* the **checklist rows** are strings a signed-in user sees on the offboarding checklist;
* the **notice rows** are the privacy notice as it is served.

This is the team's own rule — *a claim about a screen must be sourced from a screen* — applied to the register rather than to the claim.

## 2. The inclusion test, and the near-misses it excludes

**The test (one sentence):** include a line when it asserts a proposition of law — a statute, article or regulator named, or a legal entitlement, rate, deadline or threshold stated as a figure or as an immediate rule; exclude every other line, including the near-misses below. The test is **line-based on purpose**, so the row set is re-derivable by the command in section 6 rather than by trusting this file.

**Excluded deliberately, with the boundary shown** (a reader who disagrees with one of these can move exactly that one line, and the count moves by one):

| Excluded near-miss | Where | Why |
|---|---|---|
| Bracketed placeholders | `templates/uae-employment-contract.md:121`, `:66`; `templates/ksa-employment-contract.md:130`, `:70` | the blank is the template's own; it asserts no legal fact, and an instrument with an unfilled fact is withheld rather than issued |
| Our own contractual undertakings that defer to the law | `uae-employment-contract.md:144` ("Comply with all applicable UAE laws…"), `:156` ("…other statutory entitlements"), `:157` ("…in accordance with the law"); `ksa-employment-contract.md:154`, `:162`, `:163` | they undertake compliance instead of asserting what the law provides, and each duplicates a row already counted |
| "Public holidays as declared by the Government" | `uae-employment-contract.md:113`; `ksa-employment-contract.md:121` | the entitlement is whatever the Government declares on the day; the line asserts no figure, deadline or article |
| Party, field and contact lines that name a regulator without stating a requirement | `uae-employment-contract.md:28`, `:33`; `ksa-employment-contract.md:29`, `:34`, `:35`; `templates/privacy-notice.md:107-109` | they identify who issues a licence or receives a complaint; no entitlement or deadline is asserted |
| A transfer safeguard stated as our practice | `templates/privacy-notice.md:89` (intra-group SCC/adequacy assessment) | it describes what we do, not what the law requires |
| The notice's paper attestation block | `templates/privacy-notice.md:244-248` | a consent-instrument question already carried as item 3 (product Q4) of the PDPL letter — not a citation |
| Day-of-rest and work-schedule rows and placeholders | `uae-employment-contract.md:83-86`; `ksa-employment-contract.md:88-91` | agreed terms and bracketed blanks, not assertions about the law |

**One judgement I made and record rather than smooth:** `uae-employment-contract.md:175` and `ksa-employment-contract.md:180` ("Internal Grievance … within 14 days") are **kept** as rows. They read as our own step, but the 14-day figure matches the settlement deadline figure we invented no article for, so excluding them as "our own contractual step" could hide a legal figure. Inclusive is the safe direction for a register of claims.

## 3. The class convention

Two classes per row, both read at `2ff2891`:

* **basis** — whether a **repository-producible basis** exists: a file in *this* repository that states the provision itself, or a citation a reader can resolve from it. **All 79 rows are `none`.** Every article and every figure traces back to another Antum document, which is ourselves; no file in the repository reproduces the text of Federal Decree-Law 33/2021, Federal Decree-Law 45/2021, Royal Decree M/51 or Royal Decree M/148 (measured: `git ls-files | grep -Eci 'statute|legislation|decree|fdl|m-51|m-148'` prints `0`, and the statute names appear only inside our own artefacts). This is the same finding `statutory-claims-determination.md:10` recorded on 2026-10-06 at base `eeb4dd3`: *"We hold no consolidated text of either statute."*
* **asked** — whether the claim is put in question by a numbered item of a counsel letter. `no` = no letter asks it. Otherwise the letter and item: `UAE-1`…`UAE-6` (`/home/team/shared/uae-counsel-confirmation-request.md`), `KSA-1`…`KSA-5` (`/home/team/shared/ksa-counsel-confirmation-request.md`), `PDPL-1`…`PDPL-5` (`/home/team/shared/pdpl-counsel-request.md`, whose items the product numbers Q1, Q2, Q4, Q5, Q6).

**Naming is not asking.** The KSA letter's own closing paragraph names six articles as unconfirmed — *"The article numbers already reach a reader through the KSA offboarding checklist (Art. 84, Arts. 74–75) and through our KSA contract template (Art. 80, Art. 84, and its termination table's Arts. 74, 75, 77, 82) … and each stays unconfirmed until counsel answers"* — while its **questions** are five. A row is `asked` only when a numbered question puts that proposition in question; a row the background merely names is `no`.

**No letter has a recipient** (owner decision 15(a)). "Asked" therefore means *asked in the drafted letters as they stand*, not *asked of a lawyer*; and the letters' items are drafts that have never been sent.

## 4. The register

### 4.1 `templates/uae-employment-contract.md` — 27 rows

| # | line | claim as shipped (abridged) | basis | asked |
|---|---|---|---|---|
| REG-01 | `templates/uae-employment-contract.md:3` | governing instrument: UAE (Mainland) FDL 33/2021 | none | no |
| REG-02 | `templates/uae-employment-contract.md:7` | contracts must be filed with MoHRE; bilingual per UAE law | none | no |
| REG-03 | `templates/uae-employment-contract.md:58` | fixed-term contract under Article 8, FDL 33/2021 | none | no |
| REG-04 | `templates/uae-employment-contract.md:101` | basic salary at least 50% of total, per MoHRE guidelines | none | no |
| REG-05 | `templates/uae-employment-contract.md:108` | annual leave: 30 working days per year | none | no |
| REG-06 | `templates/uae-employment-contract.md:109` | sick leave: 90 days per year (15 full + 30 half + 45 unpaid) | none | no |
| REG-07 | `templates/uae-employment-contract.md:110` | maternity leave: 60 days (45 full + 15 half) | none | no |
| REG-08 | `templates/uae-employment-contract.md:111` | parental leave: 5 working days | none | no |
| REG-09 | `templates/uae-employment-contract.md:112` | Hajj leave: max 30 days, unpaid, once per employment | none | no |
| REG-10 | `templates/uae-employment-contract.md:119` | probation, employee: no notice | none | UAE-5 |
| REG-11 | `templates/uae-employment-contract.md:120` | probation, employer: 14 days | none | UAE-5 |
| REG-12 | `templates/uae-employment-contract.md:122` | summary dismissal: immediate, Art. 44 | none | UAE-3 |
| REG-13 | `templates/uae-employment-contract.md:126` | EOSB per Articles 51, 52, 53 and 132 of FDL 33/2021, basic salary only | none | UAE-1 |
| REG-14 | `templates/uae-employment-contract.md:128` | 1–5 years: 21 days' basic salary per year | none | UAE-1 |
| REG-15 | `templates/uae-employment-contract.md:129` | 5+ years: 30 days' basic salary per year | none | UAE-1 |
| REG-16 | `templates/uae-employment-contract.md:130` | cap: 2 years' basic salary (730 days) | none | UAE-1 |
| REG-17 | `templates/uae-employment-contract.md:131` | resignation reduction: 1/3 (1–3 yrs), 2/3 (3–5 yrs), full (5+ yrs) | none | UAE-2 |
| REG-18 | `templates/uae-employment-contract.md:132` | eligibility: minimum 1 year of continuous service | none | UAE-1 |
| REG-19 | `templates/uae-employment-contract.md:163` | termination ground: mutual agreement = Art. 42 | none | no |
| REG-20 | `templates/uae-employment-contract.md:164` | termination ground: expiry of fixed term = Art. 8 | none | no |
| REG-21 | `templates/uae-employment-contract.md:165` | termination ground: resignation by employee = Art. 43 | none | no |
| REG-22 | `templates/uae-employment-contract.md:166` | termination ground: termination by employer = Art. 43 | none | no |
| REG-23 | `templates/uae-employment-contract.md:167` | termination ground: summary dismissal = Art. 44 | none | UAE-3 |
| REG-24 | `templates/uae-employment-contract.md:168` | termination ground: redundancy = Art. 45 | none | no |
| REG-25 | `templates/uae-employment-contract.md:169` | termination ground: constructive dismissal = Art. 47 | none | no |
| REG-26 | `templates/uae-employment-contract.md:175` | internal grievance: written grievance to HR within 14 days | none | no |
| REG-27 | `templates/uae-employment-contract.md:181` | processing per UAE PDPL (FDL 45/2021) | none | no |

### 4.2 `templates/ksa-employment-contract.md` — 26 rows

| # | line | claim as shipped (abridged) | basis | asked |
|---|---|---|---|---|
| REG-28 | `templates/ksa-employment-contract.md:4` | governing law: Saudi Labor Law (Royal Decree M/51), as amended | none | no |
| REG-29 | `templates/ksa-employment-contract.md:7` | must be registered with Qiwa; Arabic the primary legal language; non-Saudi contracts fixed-term | none | no |
| REG-30 | `templates/ksa-employment-contract.md:92` | overtime: 150% (normal) / 200% (weekends, public holidays) | none | no |
| REG-31 | `templates/ksa-employment-contract.md:93` | Ramadan working hours: 6 hours per day | none | no |
| REG-32 | `templates/ksa-employment-contract.md:109` | KSA EOSB is calculated on total salary, unlike UAE | none | KSA-2 |
| REG-33 | `templates/ksa-employment-contract.md:116` | annual leave: 21 working days per year (min) | none | no |
| REG-34 | `templates/ksa-employment-contract.md:117` | sick leave: 120 days per year (30 full + 60 at 75% + 30 unpaid) | none | no |
| REG-35 | `templates/ksa-employment-contract.md:118` | maternity leave: 10 weeks, full pay | none | no |
| REG-36 | `templates/ksa-employment-contract.md:119` | paternity leave: 3 days | none | no |
| REG-37 | `templates/ksa-employment-contract.md:120` | Hajj leave: max 15 days, unpaid, once per employment | none | no |
| REG-38 | `templates/ksa-employment-contract.md:127` | probation, either party: no notice required | none | KSA-4 |
| REG-39 | `templates/ksa-employment-contract.md:128` | post-probation, employee non-Saudi: 30 days | none | KSA-4 |
| REG-40 | `templates/ksa-employment-contract.md:129` | post-probation, employee Saudi: 60 days | none | KSA-4 |
| REG-41 | `templates/ksa-employment-contract.md:131` | summary dismissal: immediate, Art. 80, M/51 | none | KSA-3 |
| REG-42 | `templates/ksa-employment-contract.md:135` | EOSB per Article 84, M/51, on total monthly salary | none | KSA-1 |
| REG-43 | `templates/ksa-employment-contract.md:139` | first 5 years: half a month's total salary per year | none | KSA-1 |
| REG-44 | `templates/ksa-employment-contract.md:140` | each subsequent year: one full month's total salary | none | KSA-1 |
| REG-45 | `templates/ksa-employment-contract.md:142` | unserved notice: compensation = the unserved period's wage, a separate settlement item, never deducted from EOSB | none | KSA-4 |
| REG-46 | `templates/ksa-employment-contract.md:164` | employer provides a service certificate within 2 weeks of termination | none | KSA-5 |
| REG-47 | `templates/ksa-employment-contract.md:170` | termination ground: mutual agreement = Art. 74 | none | no |
| REG-48 | `templates/ksa-employment-contract.md:171` | termination ground: expiry of fixed term = Art. 74 | none | no |
| REG-49 | `templates/ksa-employment-contract.md:172` | termination ground: resignation by employee = Arts. 75, 77 | none | no |
| REG-50 | `templates/ksa-employment-contract.md:173` | termination ground: summary dismissal = Art. 80 | none | KSA-3 |
| REG-51 | `templates/ksa-employment-contract.md:174` | termination ground: force majeure = Art. 82 | none | no |
| REG-52 | `templates/ksa-employment-contract.md:180` | internal grievance: written grievance to HR within 14 days | none | no |
| REG-53 | `templates/ksa-employment-contract.md:186` | processing per KSA PDPL (Royal Decree M/148) | none | no |

### 4.3 `templates/final-settlement-statement.md` — 2 rows

| # | line | claim as shipped (abridged) | basis | asked |
|---|---|---|---|---|
| REG-54 | `templates/final-settlement-statement.md:53` | EN waiver: acknowledgment of "full and final settlement", no further claims, waiver of future claims | none | no |
| REG-55 | `templates/final-settlement-statement.md:55` | AR waiver: the same waiver in Arabic | none | no |

### 4.4 `templates/privacy-notice.md` — PDPL citations, 15 rows

| # | line | claim as shipped (abridged) | basis | asked |
|---|---|---|---|---|
| REG-56 | `templates/privacy-notice.md:4` | jurisdictions: UAE PDPL (FDL 45/2021) and KSA PDPL (Royal Decree M/148, as amended 2023) | none | no |
| REG-57 | `templates/privacy-notice.md:22` | processing under UAE PDPL and/or KSA PDPL as applicable | none | no |
| REG-58 | `templates/privacy-notice.md:43` | payroll/administration lawful basis: UAE PDPL Art. 4(2); KSA PDPL Art. 6 | none | no |
| REG-59 | `templates/privacy-notice.md:87` | UAE transfers per UAE PDPL Arts. 22–23 and Cabinet Decision No. 65 of 2022 | none | no |
| REG-60 | `templates/privacy-notice.md:88` | KSA transfers per KSA PDPL Art. 29 (as amended 2023), and SDAIA conditions for sensitive data | none | no |
| REG-61 | `templates/privacy-notice.md:93` | rights response within 30 days, extendable to 60 days in complex cases | none | no |
| REG-62 | `templates/privacy-notice.md:97` | access right: UAE PDPL Arts. 7–14; KSA PDPL Art. 12 | none | no |
| REG-63 | `templates/privacy-notice.md:98` | rectification: UAE Arts. 7–14; KSA Art. 12 | none | no |
| REG-64 | `templates/privacy-notice.md:99` | erasure/destruction: UAE Arts. 7–14; KSA Art. 12 (explicit right to destruction) | none | no |
| REG-65 | `templates/privacy-notice.md:100` | restriction: UAE Arts. 7–14; KSA Art. 12 | none | no |
| REG-66 | `templates/privacy-notice.md:101` | portability: UAE Arts. 7–14; KSA Art. 12 | none | no |
| REG-67 | `templates/privacy-notice.md:102` | objection: UAE Arts. 7–14; KSA Art. 12 | none | no |
| REG-68 | `templates/privacy-notice.md:103` | automated-processing disclosure: UAE PDPL Art. 14; KSA Art. 12 / SDAIA rules | none | no |
| REG-69 | `templates/privacy-notice.md:113` | security measures in line with UAE PDPL Art. 11 and KSA PDPL requirements | none | no |
| REG-70 | `templates/privacy-notice.md:117` | DIFC/ADGM employees governed by DIFC Law No. 5 of 2020 / ADGM DP Regulations 2021, not federal PDPL | none | no |

### 4.5 `server/compliance_engine.js` — the offboarding checklists, 9 rows

| # | line | claim as shipped (abridged) | basis | asked |
|---|---|---|---|---|
| REG-71 | `server/compliance_engine.js:22` | UAE checklist: notice period served, 30–90 days per contract | none | UAE-5 |
| REG-72 | `server/compliance_engine.js:23` | UAE checklist: EOSB basis = basic wage only (FDL 33/2021 Arts. 51–53) | none | UAE-1 |
| REG-73 | `server/compliance_engine.js:26` | UAE checklist: visa cancellation within 30 days | none | UAE-6 |
| REG-74 | `server/compliance_engine.js:27` | UAE checklist: final settlement payment within 14 days | none | UAE-6 |
| REG-75 | `server/compliance_engine.js:43` | KSA checklist: notice served or compensated (M/51 Arts. 74–75) | none | KSA-4 |
| REG-76 | `server/compliance_engine.js:44` | KSA checklist: EOSB basis = total monthly salary (M/51 Art. 84) | none | KSA-1 |
| REG-77 | `server/compliance_engine.js:46` | KSA checklist: Iqama cancellation/transfer within 90 days | none | KSA-5 |
| REG-78 | `server/compliance_engine.js:48` | KSA checklist: service certificate within 2 weeks | none | KSA-5 |
| REG-79 | `server/compliance_engine.js:50` | KSA checklist: salary + EOSB + leave + notice "within the settlement deadline" | none | KSA-5 |

## 5. The rows no counsel question reaches

**32 rows in the two contract templates are covered by no counsel question — 17 UAE (REG-01…REG-09, REG-19…REG-22, REG-24…REG-27) and 15 KSA (REG-28…REG-37, REG-47…REG-49, REG-51…REG-53); 30 of those 32 are figure-bearing** (the two without a figure are `uae-employment-contract.md:7` and `ksa-employment-contract.md:7`, the filing/registration notes). This is the class the plan called "the statutory half": leave entitlements, overtime and Ramadan hours, registration requirements, the residual termination-ground articles, the grievance deadline, and both PDPL instrument citations inside the contracts.

**The settlement statement's waiver is asked in no letter** — `templates/final-settlement-statement.md:53` (EN) and `:55` (AR). It is the one row whose legal effect a reader signs: it records a settlement as "full and final" and waives future claims, and no letter asks whether a waiver of that breadth is effective in either jurisdiction.

**The notice's 15 PDPL citations are asked in no letter.** The PDPL letter's items are the notice's content, Arabic certification, the shown-versus-consented instrument, the emergency contact and retention — and it says so itself: *"No article number is asserted. The notice template carries the caution that its article references follow our own reference set and must be confirmed; the letter asks for the posts rather than asserting them"* (`/home/team/shared/pdpl-counsel-request.md:48-49`).

**The checklist rows are the only part of this surface a letter reaches.** All 9 `compliance_engine.js` rows are asked — Art. 84 and Arts. 74–75 through the KSA letter, Arts. 51–53 and the notice/deadline claims through the UAE letter. So the checklist a signed-in user actually reads is the covered part, and the documents nobody can read yet are the uncovered part.

**The cheapest fix is one added line to each letter**, and its insertion points are recorded in `/home/team/shared/counsel-letter-six-corrections-2026-10-29.md`. It is **not** implemented here: the owner's one-line answer is pending, and this PR changes no letter.

## 6. Totals, and the command that reproduces them

**Total: 79 rows** — UAE contract 27, KSA contract 26, settlement statement 2, privacy notice 15, offboarding checklists 9.
**With a repository-producible basis: 0 of 79.**
**Asked in a counsel letter: 30. Not asked: 49** (= 17 UAE contract + 15 KSA contract + 2 settlement + 15 notice).

**Row set, re-derived from the files (not from this document).** Run in the deployed tree at `2ff2891`; it prints `79`:

```
cd /home/team/shared/probable-octo-sniffle && {
  grep -cE '^(> \*\*Jurisdiction:\*\* UAE|> \*\*Note:|This is a \*\*Limited Term|EOSB shall be calculated|The Employee acknowledges receipt|1\. \*\*Internal Grievance\*\*|\| \*\*(Annual|Sick|Maternity|Parental|Hajj) Leave|\| \*\*During Probation|\| \*\*Summary Dismissal|\| (Mutual agreement|Expiry of fixed term|Resignation by Employee|Termination by Employer|Summary dismissal \(gross|Redundancy|Constructive dismissal)|^- \*\*[0-9]|^- \*\*(Cap:|Resignation reduction:|Eligibility:))' templates/uae-employment-contract.md
  grep -cE '^(> \*\*Governing Law:|> \*\*Note:|> \*\*Compensation for Failure|EOSB shall be calculated|The Employee acknowledges receipt|1\. \*\*Internal Grievance\*\*|5\. Provide a service certificate|\| Overtime Rate|\| Ramadan Hours|\| \*\*(Annual|Sick|Maternity|Paternity|Hajj) Leave|\| \*\*During Probation|\| \*\*Post-Probation \(Employee|\| \*\*Summary Dismissal|\| (Mutual agreement|Expiry of fixed term|Resignation by Employee|Summary dismissal \(gross|Force majeure)|\| (First 5 years|Each subsequent year))' templates/ksa-employment-contract.md
  grep -cE 'holder of \*\*\[national_id\]\*\*|^أقر أنا ' templates/final-settlement-statement.md
  grep -cE '^(> \*\*Jurisdictions|This Privacy Notice explains|You have the following rights|We implement appropriate technical|If you are employed by an entity|^- \*\*(UAE|KSA):\*\* transfers|\| Administering your employment|\| \*\*(Access|Rectification|Erasure|Restriction|Portability|Objection|Automated-processing))' templates/privacy-notice.md
  grep -cE 'Notice Period Verification|EOSB Calculation|Residency Visa Cancellation|Final Settlement Payment|Iqama Cancellation/Transfer|Service Certificate Issuance' server/compliance_engine.js
} | awk '{s+=$1} END{print s}'
```

Replace `-c` with `-n` to list the 79 lines with their numbers — that listing is what the rows above were written from, and any line it prints that no row carries means this register is stale.

**The sub-totals, read off this document's own columns** (`| # | line | claim | basis | asked |`):

```
cd /home/team/shared/probable-octo-sniffle && \
  grep -c '^| REG-' docs/statutory-claim-register.md                                                   # 79 rows
awk -F'|' '/^\| REG-/ && $5 ~ /none/ {n++} END{print n}' docs/statutory-claim-register.md              # 79 with no repository-producible basis
awk -F'|' '/^\| REG-/ && $6 ~ /^ *no *$/ {n++} END{print n}' docs/statutory-claim-register.md          # 49 asked in no letter
awk -F'|' '/^\| REG-/{split($3,a,":"); c[a[1]]++} END{for (f in c) print c[f], f}' docs/statutory-claim-register.md   # 27 / 26 / 2 / 15 / 9
```

### The withdrawn split could not be reproduced

This register is not an arithmetic restatement of the withdrawn headline; it replaces it.

* **`67 / 36 / 31 / 0` is not reproducible.** No row set I can construct from the five artefacts, at any granularity I tried, yields 36 UAE and 31 KSA, and the withdrawn figure named no source file and no test. **This register's total is 79, with 0 of 79 carrying a repository-producible basis** — the one quarter of that headline which survives re-measurement is the `0`.
* **`21 unasked template rows (10 UAE + 11 KSA, 18 figure-bearing)` is not reproducible either.** Measured on the same five files with the test in section 2: **32** unasked contract-template rows, **17 UAE + 15 KSA**, **30 figure-bearing**. The gap is a row-definition gap, not a disagreement about the law: the withdrawn count is consistent with a much coarser row (one row per table or per entitlement family) than the line-based test this register states and the command above re-derives. **The arithmetic being internally consistent is not evidence**, so the old numbers are reported as not reproduced rather than carried — and the two that a future re-read should check first are the contract-template counts, because a different row definition moves them.
* Nothing in this register asserts that any claim is **wrong**. Every row is "unconfirmed": `basis none` says we cannot source it from our own repository, and `asked no` says no letter asks it — neither says the law says otherwise.

## 7. What unchanged today, and must not be read as coverage

**The six corrections applied today to the host-pack counsel letters removed statements about our own product that were false at this tip; they added no question to any letter.** So the "asked in no letter" counts in section 5 **stand as measured here**, and a future reader must not read the corrections as coverage of the statutory schedule: correcting a letter's claims about ourselves is not asking counsel about the law. No letter has a recipient (15a), and no letter has been sent.

The same PR that adds this register also corrects one stale cross-reference in `statutory-claims-determination.md:10` (the KSA letter has five numbered items, and notice is item 4, not 6). That is a numbering correction; it adds no question either.

## 8. Limits of this register, stated so they are not mistaken for omissions

* **It is a register of claims in shipped text, not of screens.** Section 1 says what "shipped" means; the contract and settlement bodies are withheld by the product, so a reader cannot see them today. That does not make their claims less shipped — it makes them unreviewed by anybody but us.
* **It measures five artefacts**, the four templates named in the plan plus the checklist strings in `server/compliance_engine.js`. `templates/breach-notification-letters.md`, `data-processing-agreement.md` and `dpia-questionnaire.md` are classified as **forms**, not instruments, and are out of scope here; their claims are a separate read.
* **It carries no legal opinion.** Where a row's article or figure is wrong, only counsel can say so — the letters ask.
* **The register is a measurement of `2ff2891`.** Server, client or script changes that move a quoted line make the affected rows stale; the markdown-only rule does not apply to this file, because its rows cite lines that other commits move.
