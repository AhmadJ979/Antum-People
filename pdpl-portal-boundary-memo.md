# The PDPL position at the hire-facing portal boundary

**For:** P2-6 (the hire-facing portal) — this memo is the compliance position the portal's copy and its consent gate are built from.
**Author:** Compliance Expert · **Date:** 2026-10-09
**Measured against:** `AhmadJ979/Antum-People` @ **`b7630cb`** (merged PR #86, P2-4), fetched 2026-10-09. Every `file:line` below is that tree.
**Landed on:** `main` @ **`6221995`** (merged PR #93) — the tree the landing PR was rebased onto and every citation re-checked against. Six PRs merged while it was open (#84, #87, #88, #91, #92, #93), and the claim that matters is about their **class of files**, not the sha: `git diff --name-only b7630cb..6221995 | grep -c '^client/\|^server/'` → `0`, and the same filter over `compliance-requirements.md|legal-signoff-checklist.md|compliance-dpia-vendor-risk.md|templates/` → `0` lines. **If `main` has moved since, re-run those two commands before trusting a `file:line` here** — the merges were docs, evidence and images only (`roadmap-board-index.md`, `demo-weak-screens.md`, `demo-walkthrough-script.md`, `pilot-outreach-messages.md`, `design-concepts/**`, `docs/evidence/**`), which is why no citation moved. Stated as that reason, not a re-dating.
**Re-grounded 2026-10-09 at `cd9daa8`:** those two commands now return non-zero — `client/src/App.tsx`, `server/index.js`, `server/preboarding.js` and `server/document-store.js` all changed after the landing — so facts 4-6 and the evidence index were re-read at `cd9daa8` and their citations updated. **Fact 5 was wrong, not merely stale**; the correction is stated in full under §5.1. The findings are unchanged.
**Status:** working position, not legal advice. Each claim below is either **sourced** (to our own record, named), or marked **[UNCONFIRMED]**. Nothing here asserts that an existing claim is wrong — where our materials and this memo differ, the item is flagged for the lead.

> **The discipline this memo follows** (settled by the team, `statutory-claims-determination.md`): a claim is cited or it is marked unconfirmed; a qualifier with no source behind it is **dropped, not kept for tone**; and no EOSB claim appears here. The UAE EOSB engine is frozen and is out of scope.

---

## 1. What the boundary is today — measured, not assumed

Seven facts. Nothing in the sections that follow makes sense without them.

| # | Fact | Evidence (`b7630cb`) |
|---|---|---|
| 1 | **Antum is the processor; each client (employer) is the controller.** The notice is therefore *the employer's* notice, presented in Antum's product. The controller-side `[dpo_name]` placeholder in the notice belongs to the client's own DPO and is deliberately unfilled. | `legal-signoff-checklist.md:15,17` |
| 2 | **The gate is server-side, on the item transition to `received`/`verified`** (`COLLECTED_STATUSES`), not in the UI, so a direct API call cannot bypass it. A refusal is HTTP 428. | `server/preboarding-items.js:47`, and the gate at `:326-332` |
| 3 | **The pre-boarding consent record is per case, one row, no withdrawal.** `preboarding_consents(id, case_id UNIQUE, consent_type, lawful_basis, consent_version, granted_at, recorded_by, created_at)` — no `revoked_at`, no notice text, no notice hash. | `server/schema.sql:258-267` |
| 4 | **The client sends three literals.** Every consent record today says `consent_type:'pdpl_notice'`, `lawful_basis:'consent'`, `consent_version:'v1'` — regardless of which documents the case carries. | `client/src/App.tsx:849` |
| 5 | **The acting party can be nobody.** The route sends `actor` = the signed-in username **or the literal `'system'`** (`server/index.js:728`, route at `:721`), and the module falls back to `'system'` itself when writing the `recorded_by` column (`server/preboarding-items.js:242`). One shared admin account until Layer 3 makes the username a shared identity in any case. | cited |
| 6 | **The notice is never shown at the point of collection.** A "Record PDPL consent" button sits on the case card; the notice itself is reachable only as a *template download* in the documents area, keyed to an employee. | `client/src/App.tsx:1942` (button), `:1963` (tooltip), `:1914-1916` (row copy), `:1479` (template download) |
| 7 | **The product holds a reference, not bytes.** An item carries `document_reference` (≤120 chars), a file name or the reference the hire quoted; it never enters the audit trail, and there is no file storage in this release. | `server/preboarding-items.js:29-31`, limit at `:284` |

Two further facts that shape the answers:

- **A second, older consent store exists** and is still writable: `consent_records(id, employee_id, consent_type, status, consent_date, ip_address, lawful_basis, granted_at, revoked_at, consent_version)` (`server/schema.sql:93-105`, written by `POST /api/compliance/consent`, `server/index.js:340`). It declares `ip_address` and `revoked_at` and **never writes either** (`git grep ip_address` → the schema line only). So the product has two consent records, two shapes, one meaning-word. Undecided, not wrong.
- **The notice file is already bilingual and versioned: v2.2 (2026-09-17)**, and it carries its own "Consent Version / إصدار الموافقة" field reading **v2.2** (`templates/privacy-notice.md:6,247`). The product records `v1` (fact 4).

---

## 2. Item 1 — Notice before collection

**The question:** what must a UAE PDPL-compliant notice contain at the point a hire supplies a passport, Emirates ID, certificates, bank details or an emergency contact, and what must be true *before* the collection rather than disclosed afterwards.

### 2.1 What the notice must contain

Our own record of the required content is `compliance-requirements.md` §5.3, which lists six elements as an **implementation requirement**:

1. controller identity (the employer) · 2. purposes of processing · 3. categories of data collected · 4. data subject rights · 5. retention period · 6. cross-border transfer details (if any).

The notice template already satisfies this list and goes further — purposes mapped to lawful bases, third-party sharing, and rights (`templates/privacy-notice.md` §1.1, §1.2, §2, §3, §4, §5).

> **[UNCONFIRMED]** — that list is *our standard*, not a cited statutory list. Our reference set (`compliance-dpia-vendor-risk.md` §1.1) names UAE articles for processor duties, security, DPO, rights, breach and transfers — **and none for notice content**. The DPIA itself carries the standing caveat that article numbering must be re-confirmed (`compliance-dpia-vendor-risk.md:28`). Treat "the notice must contain these six" as our own implementation choice; **do not** attach an article number to it in product copy.

### 2.2 What must be true *before* collection

Five things, each operational rather than legal:

1. **The notice is shown *at* the collection point, not afterwards.** Today it is not (fact 6). The consent button exists; the notice does not. This is the single largest gap the portal closes.
2. **The employer's notice, presented by Antum as processor** — the portal must not present it as Antum's own notice, and must not fill the controller-side DPO contact with Antum's DPO (fact 1).
3. **The version shown is identifiable and the version shown is the version that was current.** v2.2 today, recorded as `v1` today (facts 4, 6).
4. **The wording covers every item the case will ask for, before the first request** — the portal asks for seven document types; the notice's categories table already names identity, contract, financial, immigration, qualification and dependants data (`templates/privacy-notice.md:28-37`). The hire should meet the notice before the first "Mark received", not after.
5. **Nothing is collected to satisfy the notice itself.** The notice is shown to the hire; it is not a reason to collect more.

**Decisive recommendation.** The portal must render the notice inline, before any collection control, with the version string visible, and the record must name that version. That is a display + one-field change, not a rewrite: the notice file, the version field, and the consent endpoint already exist.

---

## 3. Item 2 — Consent versus other lawful bases

**The question:** is a consent record the right instrument for each document type, or is some of it contract-performance processing dressed as consent?

### 3.1 The mismatch, stated plainly

Our own notice already assigns bases per purpose (`templates/privacy-notice.md:41-51`):

| The hire's document (UAE set, `server/preboarding-items.js` `DOCUMENT_SETS`) | Basis our own notice assigns to that purpose |
|---|---|
| Passport, Emirates ID, visa/entry permit | **Legal obligation** (visa, immigration, MoHRE registration) |
| Education certificate, experience certificate | **Contractual necessity / legal obligation** (establishing the employment and its registration) |
| Bank details (IBAN letter) | **Contractual necessity** (payroll, WPS) + legal obligation |
| Emergency contact | *(no row covers it — see 3.3)* |

> **Exactness note.** The notice carries no row naming qualification certificates; the mapping above for the education and experience certificates is to its employment-administration and government-registration rows. That is a gap in the notice — worth a row, flagged for the lead, not fixed here.

Against that, **every** case's consent record stores `lawful_basis:'consent'` (fact 4). So the product's record contradicts the product's own notice, in the same repository, for the same documents.

**Decisive recommendation.** Stop calling the pre-boarding gate "consent" for documents the notice assigns to contract or legal obligation. The record already has the right field — `lawful_basis` — so this is a **value and copy** change, not a schema change:

- The record carries the basis that actually applies, per the notice's purpose table.
- The portal's control reads as **notice acknowledgement** ("I have read the privacy notice shown above" and, where applicable, "I understand the basis on which my documents are processed"), with the basis named.
- A true **consent** record stays in the schema, for the cases where consent *is* the instrument — the notice already reserves consent for sensitive data (biometrics; certain health processing) (`templates/privacy-notice.md:45-48`). **None of the seven pre-boarding document types is such an item** — so today's answer is that the pre-boarding set needs *no* consent record at all, and the gate should ask for something else.

### 3.2 Why the distinction is worth the change (reasoning, not a citation)

Consent is the one basis the data subject can withdraw. Dressing documents that the employment relationship genuinely requires as consent hands the hire a withdrawal right over data the employer must hold to employ them and to register them with MoHRE — a right the product then cannot honour, since the case cannot proceed without those documents. The mismatch is therefore not cosmetic: it creates a promised right the business model cannot deliver.

> **[UNCONFIRMED]** — the "freely given consent in an employment relationship" analysis is imported doctrine from another jurisdiction's regulator. Our materials do not cite a UAE authority for it. It is offered here as product reasoning, **not** as a UAE legal requirement, and must not appear in product copy.

### 3.3 The emergency contact is a different person

Emergency-contact data is **third-party personal data**: the contact is not the hire, was not asked, and cannot be bound by a box the hire ticks. No row of our notice covers processing *their* data, and the hire is not a competent consenter on their behalf.

**Decisive recommendation.** Separate the item in the portal: it gets its own explanatory line ("we will contact this person only in an emergency"), it is **not** covered by the hire's acknowledgement as if the hire's own data, and its lawful basis is left **[UNCONFIRMED]**. Add it to the counsel question in §8 rather than guessing it.

### 3.4 What must change in the copy

The UI string "✗ MISSING / REQUIRED" on the employee record (`client/src/App.tsx:1464`) asserts a *requirement* to record consent. That is the unsourced-qualifier class we have already removed once (`statutory-claims-determination.md`). Recommended: "Not recorded", and, for the case card, "No notice acknowledgement on this case yet — documents cannot be collected until it is recorded."

---

## 4. Item 3 — Language

**The question:** must any of this be in Arabic, and what does the answer rest on?

| Claim | Status |
|---|---|
| Our notice template is **bilingual (EN + AR)**, Arabic version complete (`templates/privacy-notice.md` AR version from `:125`, acknowledgement block at `:237`). | **Sourced** — our own document, our own choice. |
| EN/AR in the portal is a **product decision** already in the plan (P2-6: "the hire-facing portal, EN/AR"). | **Sourced** — the plan. |
| The product's KSA checklist string demands Arabic-first: "Capture explicit consent for KSA PDPL compliance (Arabic first)." | **In the product** (`server/compliance_engine.js:38`) — the claim inside it is **[UNCONFIRMED]**. |
| "The KSA PDPL requires the privacy notice to be in Arabic (can be bilingual)." | **[UNCONFIRMED]** — `compliance-requirements.md` §6.4 (`:391`) states it with no article. Our DPIA cites KSA Art. 7/10 for "publish a privacy policy in Arabic" — with its own caveat that numbering must be re-confirmed (`compliance-dpia-vendor-risk.md:47,28`). |
| **No citation found** for a UAE requirement that a notice be in Arabic. | **Absence of evidence, stated as absence** — not a guess in either direction. |

**Where that was searched (so "no citation found" has provenance):** our own requirements doc (`compliance-requirements.md`), the DPIA's UAE article set (`compliance-dpia-vendor-risk.md` §1.1 — processor, security, DPO, rights, breach, transfers; **no language provision**), the notice template, and a repo-wide `grep` for language requirements. What it found that bears on language — and all of it is about something other than a UAE notice:

| Found | What it is | Why it does not answer this question |
|---|---|---|
| `compliance-requirements.md:391` (§6.4) | "The KSA PDPL requires the privacy notice to be in Arabic (can be bilingual)." | **KSA**, and uncited — see the row above. |
| `compliance-requirements.md:74` (§2.2, a KSA onboarding row) | The employment contract "Must be in Arabic (bilingual contracts permitted)", with the UAE column noted as "similar — Arabic as mandatory language". | A **contract**, not a notice; a passing assertion with no citation; and it is the sort of UAE claim that would need sourcing before it appeared in copy. **Flagged, not relied on.** |
| `compliance-dpia-vendor-risk.md:359,380` | "Is there an Arabic-first privacy notice…" (a DPIA question) and a target state. | A question and an aspiration, not a legal requirement. |

Externally, the UAE portal returned no data-protection page, and the primary texts were already recorded as unreachable from this host. **Nothing citable requires an Arabic *notice* in the UAE** — and nothing citable forbids it either, which is why the answer is unconfirmed rather than "no".

**The answer.** The UAE position on an Arabic-language notice is **[UNCONFIRMED] — no citation found**. The honest form of that answer is: we cannot cite it, so we do not claim it. The portal still ships **EN/AR**, because that is our product decision and the notice file is already bilingual; what it must not do is present Arabic as a legal obligation.

**Consequences for copy:**
- No "required by law", "statutory", "وفقاً للقانون" attached to the Arabic version.
- The Arabic copy inherits an open item: the **Arabic wordmark is `[TO CONFIRM]`** (`legal-signoff-checklist.md:27`; `templates/privacy-notice.md:9`). Arabic text uses Latin "Antum" until the owner supplies it. **Do not let the portal's AR copy lock in a transliteration the owner has not confirmed.**
- Because Antum is the processor, the Arabic notice shown is the *employer's*. The portal should say so in both languages, and the controller-side contact stays a client-completed placeholder.

---

## 5. Item 4 — What the record must prove

**The question:** actor, timestamp, the version of the notice shown, and whether an electronic acknowledgement through a portal is a record we can stand behind — with the e-signature claim kept out.

### 5.1 What the record proves today

An accurate reading of `preboarding_consents` (fact 3) plus the writer (facts 4-5):

| Field | What it actually proves |
|---|---|
| `granted_at` | A timestamp exists. Reliable. |
| `recorded_by` | *That the shared admin account recorded a row* — or, when no session is present, only the string `'system'` (`server/preboarding-items.js:242`). It does **not** prove the hire was shown anything: the hire is not the actor today. |
| `consent_version` | The literal `'v1'`, which corresponds to **no document**: the notice on file is **v2.2**. Measured history — the notice has read v2.2 since `02aa858` (2026-09-17), and the literal was typed three weeks later in `9c07344` (2026-10-07, P2-2). It was therefore never a version reference, stale or otherwise, so the record cannot prove which notice, if any, was shown. |
| `lawful_basis` | The literal `'consent'` for every case — see §3. |
| `consent_type` | The literal `'pdpl_notice'`. Naming a notice that is not displayed in the product. |
| *(absent)* | No notice text, no notice hash, no withdrawal, no scope (which items the acknowledgement covers). |

**So the truthful sentence about today's record is:** *the product records that the signed-in administrator recorded a PDPL consent record against a case, at a time, citing a version string that does not resolve to a document.* Nothing more. No copy may claim more.

> **Correction, 2026-10-09.** This memo's first revision said *"`recorded_by` is the signed-in user's username"*, citing `server/index.js:771`. Re-read at `cd9daa8`, that was wrong in two ways: the consent route sends **`actor`**, not `recorded_by` (`server/index.js:721-728`), and the module itself writes `input.actor || 'system'` into the `recorded_by` column (`server/preboarding-items.js:242`) — so the field **can name no person at all**. The `recorded_by` at `index.js`'s old `:771` belongs to the *pre-reading acknowledgement* route, a stricter module that **requires** a named actor (`server/preboarding-package.js:196-205`). The finding is unchanged and in fact sharper — the same codebase refuses an invented actor for the acknowledgement and permits one for the consent — but the first description was too generous to the product, and this is the record of the correction.

### 5.2 What it must prove once the hire is the actor

Four things, and the portal makes the fourth necessary:

1. **The notice shown** — text or an immutable version identifier the record resolves to (fix: record `v2.2`, and resolve `consent_version` to the notice file).
2. **Who acknowledged, and when** — the hire, self-served. `recorded_by` must distinguish **the acting hire** from **the recording product**, because at Layer 3 they are different parties and today's single field cannot hold both. Recommended: keep `recorded_by` as the actor and add the fact that capture was self-service (portal) versus recorded on the hire's behalf (in-product, today's path).
3. **What the acknowledgement covers** — the item scope (this case's document set), so a later item added to `DOCUMENT_SETS` does not silently fall under an acknowledgement given before it existed. This is the same defect class P2-4 avoided by storing each line's owner on the row.
4. **Whether it was withdrawn, and when** — `preboarding_consents` has **no `revoked_at`**; the older table declares one and never writes it. P2-6 owns the consent lifecycle, so this is P2-6's field to add.

### 5.3 The e-signature line stays out — and the wording is already settled

Do not call this a signature. The precedent is P2-3's acknowledgement wording (owner-ruled 2026-10-08): **an in-product record, not an electronic signature**. The portal's copy should say the acknowledgement is *recorded in the product* by the hire, and nothing about signature, sealing, witnessing or legal execution.

**[UNCONFIRMED]** — whether an electronic acknowledgement through this product would satisfy any UAE evidential requirement. We have no cited authority either way; the answer at launch is to describe what the product does and claim no legal effect.

### 5.4 The notice template's own acknowledgement block must not be inherited as-is

This is the finding that will otherwise reach the portal by default: `templates/privacy-notice.md:237-248` already ends with a bilingual `## Consent Acknowledgment / إقرار الموافقة` block, and its two operative rows are:

| Row | Why it cannot be reused by the portal |
|---|---|
| "I consent to the processing of my personal data as described, including [sensitive categories, where applicable]" — an unchecked box | A **blanket consent** line covering "processing as described". Against §3, that is precisely the instrument our own notice's purposes table does not support for these documents. |
| "**Signature / التوقيع** — ________________" | A **signature line**. A hire typing or tapping in a portal is not signing, and the settled position (P2-3, owner-ruled) is to keep the e-signature claim out. |

Its other rows are usable and should be kept: employee name, employee ID, jurisdiction, "I confirm I have read and understood this Privacy Notice", date, and **Consent Version** (which reads v2.2 — the right value, unlike the `v1` the client sends).

**Decisive recommendation.** The portal does **not** render this block. Its acknowledgement is the product's own control (§9, step 3), and the template's signature line and blanket-consent checkbox are superseded by it. Whether the template itself is revised is a product decision for the lead, not this memo's to make — it is a client-facing legal template, and it is already an open item in `legal-signoff-checklist.md`. Flagged here so the portal copy is not built from it.

---

## 6. Item 5 — Retention and the reference-string constraint

**The question:** the hire supplies a reference, not bytes — so what does the product's own record disclose about where the document actually lives and for how long?

### 6.1 What the product does and does not hold

- It holds a **≤120-character reference** — a file name or the reference the hire quoted — and it never enters the audit trail (fact 7).
- It holds **no bytes, no scan, no file**. There is no file storage in this release; the S3-compatible store is built only when IFZA registration completes (owner decision 2026-10-07, an event and not a date).

### 6.2 What follows, and what the portal may therefore say

| The product can | The product cannot |
|---|---|
| Record that a reference was supplied, and when | Return, display, verify, or delete the document |
| Delete the reference | Prove the document was deleted anywhere else |
| Prove its own state transitions | Prove the document exists at all |

So the portal copy must be honest about custody: the document is provided **to the employer**, who remains the controller and holds it in their own records; **Antum People records a reference to it**. Neither the product nor the notice may say the hire's documents are "stored securely in Antum People", and no control may offer to delete the document — only the reference.

### 6.3 Retention figures in the notice — flagged, not changed here

The notice's retention table (`templates/privacy-notice.md:54-65`) states "Minimum **2 years** post-termination (Labour Law)" for employment records, 5 years for EOSB/settlement (commercial/audit) and 6 years for KSA (ZATCA), with **no article cited**, and the consent-record row read "Duration of employment + **statutory** retention" — the same unsourced-qualifier pattern this team has already ruled on twice.

Per the standing discipline, that row's qualifier is a **DROP THE QUALIFIER** case: keep the meaning, drop "statutory". **The lead has ruled on it, and the drop is made in the same PR that lands this memo** — `templates/privacy-notice.md:62` (EN) and `:174` (the Arabic counterpart, the same row of the same table) now read "Duration of employment + retention period" and «مدة التوظيف + مدة الاحتفاظ». Every other figure in that table is untouched, and the same qualifier remains in two other places in the template — the paragraph under the table (`:66`, Arabic `:178`) and the third-party-sharing row for government registries (`:76`, "Statutory employment registration") — each left as a flag, not a ruling. The portal must not repeat any of those figures as a legal requirement.

---

## 7. MUST NOT BE CLAIMED AT LAUNCH

The list the portal's copy is checked against. Each line is a specific prohibition, not a theme.

1. **No "required by law", "statutory", or "legally required"** attached to: the notice acknowledgement; the consent record; the Arabic version; the retention figures; or the document set. We hold no citable source for any of them.
2. **No e-signature language** — no "signed", "electronically signed", "legally binding", "certified", "witnessed", "sealed". The acknowledgement is an in-product record (P2-3 precedent). The notice template's own `Signature / التوقيع` row (`templates/privacy-notice.md:248`) is **not** an exception, and §5.4 explains why it is not reused.
3. **No claim that Antum People stores the hire's documents.** It records a reference; the employer holds the document. No "uploaded to Antum People", no "stored securely in Antum People".
4. **No "delete my documents" control**, and no claim that deleting the reference deletes the document.
5. **No single blanket "I consent to the processing of my personal data"** presented as the basis for documents our own notice assigns to contract or legal obligation. Name the basis, or say the notice explains it. The template's own `I consent to the processing of my personal data as described` box (`templates/privacy-notice.md:245`) is exactly this pattern and is not reused (§5.4).
6. **No implication that the hire's acknowledgement covers the emergency contact's data** — a different person, basis [UNCONFIRMED].
7. **No UAE PDPL article numbers in user-facing copy.** Our article set is a team reference with its own re-confirmation caveat (`compliance-dpia-vendor-risk.md:28`); the numbers belong in internal documents only.
8. **No "compliant with UAE PDPL" / "PDPL certified" badge**, and no compliance certification claim of any kind.
9. **No breach-notification promise to the hire.** The 72-hour duty is the controller's, and our own materials flag its precision as needing re-confirmation (`compliance-dpia-vendor-risk.md:38`).
10. **No cross-border promise** ("your data never leaves the UAE"), in either direction. Our materials state the transfer rule and name Cabinet Decision 65/2022 as its implementing decision, but record **no adequacy determination and no executed safeguards** for our own transfers (`compliance-dpia-vendor-risk.md:39-40,60-62`).
11. **No Arabic-as-obligation framing** (§4), and **no unconfirmed Arabic wordmark** — Latin "Antum" until the owner confirms (`legal-signoff-checklist.md:27`).
12. **No claim that the product enforces the employer's retention period.** It holds a reference and a record; the employer's retention is the employer's.
13. **No "✗ MISSING / REQUIRED"** or equivalent requirement-assertion for the acknowledgement — "Not recorded" instead (§3.4).

---

## 8. What to do with the unconfirmed items

Everything marked **[UNCONFIRMED]** above is a question about the *law*, and the lead has ruled that legal sourcing runs through counsel, UAE-first. Every one of them also bites on the product, so they are named here rather than left implicit:

| Question | Where it bites | Status |
|---|---|---|
| Which UAE article, if any, governs privacy-notice **content**? | The notice's six-element list is our standard (§2.1) | No question on file |
| Must a UAE notice be in **Arabic**? | Portal AR copy (§4) | No question on file — **no citation found** either way |
| Does UAE law require the employment **contract** in Arabic (or any other hire-facing document)? | The AR contract template, and any contract copy the portal later shows | No question on file; our own materials assert it (`compliance-requirements.md:74`, uncited) |
| Is **consent** an available/valid basis for employer-collected pre-boarding documents in the UAE, and is there a restriction on consent in an employment relationship? | The gate's instrument and its copy (§3.1) | No question on file |
| What is the lawful basis for an **emergency contact's** data, and who may give it? | The emergency-contact item (§3.3) | No question on file |
| Is there a **retention floor** for employment records, and is "2 years post-termination" it? | The notice's retention table (§6.3) | No question on file |

The plan records the UAE letter as scope-limited to the EOSB resignation-reduction question; these five are not in front of counsel. **Recommendation for the lead:** decide whether to add them to the UAE letter or open a short PDPL letter. Until then the product ships with the prohibitions in §7, which need no legal input to obey.

---

## 9. What the portal must render — the short version for the designer

In order, on the hire's document step:

1. **The employer's notice, inline, in EN and AR** — the employer named as controller, Antum named as the platform (processor), the controller-side contact left to the client, version string visible (`v2.2`).
2. **The document list, each item with its purpose** in one line, taken from the notice's purposes table.
3. **One acknowledgement control** — "I have read the notice shown above" — with the applicable basis named where the notice assigns one (contract/legal obligation), and **not** a blanket consent for the whole set. This supersedes the template's own acknowledgement block (§5.4).
4. **A separate, explicit line for the emergency contact** — a different person, its own explanation, its own basis marked as being confirmed.
5. **The acknowledgement recorded** with: actor = the hire (self-service distinguished from today's on-behalf recording), timestamp, notice version, scope (this case's current document set). Withdrawal path recorded when it happens.
6. **Nothing else.** No upload control — the product takes a reference, and the copy says where the document lives.

**Copy constraints while the version is still `v1` in code and `v2.2` on file:** do not print a version number in the UI until the recorded value and the file agree. That single mismatch (fact 4 vs `templates/privacy-notice.md:6`) is the cheapest defect in this memo to fix and the most embarrassing to demo.

---

## 10. What this memo does not do

- **No code changed.** Nothing in `client/` or `server/` was edited for this memo; it is a position document. The PRs open when it was written (#84, #87) have since merged, together with #88, #91, #92 and #93 — all six docs-only — moving `main` from `b7630cb` to `6221995`. This memo touched neither the code nor any of those PRs.
- **One copy.** From this revision the memo lives in the repository at `pdpl-portal-boundary-memo.md`; `/home/team/shared/pdpl-portal-boundary-memo.md` is a pointer to it, naming the commit the pointer was last checked at.
- **No other claim was removed from the repo.** Where our materials and this memo differ, the item is **flagged for the lead**, with the change named, rather than made: the hardcoded `lawful_basis` literal, the `v1`/v2.2 record mismatch, the template's acknowledgement block (its signature row and blanket-consent box) and the `MISSING / REQUIRED` string are all exactly as they were. **One exception, ruled on by the lead and made in the same PR that lands this memo:** the retention row's unsourced `statutory` qualifier (§6.3).
- **No EOSB content.** The UAE engine is frozen and out of scope; no EOSB claim, tier or figure appears above.
- **No legal conclusion.** Everything marked [UNCONFIRMED] stays unconfirmed: it is a question for counsel (§8), not an assertion this memo is entitled to make.

## Evidence index (read at `b7630cb`, re-read at `cd9daa8` — the header says what moved and why)

- `server/preboarding-items.js:29-31` (no bytes, reference only) · `:47` (`COLLECTED_STATUSES`) · `:284` (reference ≤120) · `:206` (`hasConsent`) · `:327-328` (the gate) · `DOCUMENT_SETS` (AE set: passport, visa/entry permit, Emirates ID, education certificate, experience certificate, bank details, emergency contact)
- `server/schema.sql:258-267` (`preboarding_consents`) · `:93-105` (legacy `consent_records`, unused `ip_address`/`revoked_at`)
- `server/index.js:713` / `:721` (the two pre-boarding consent routes) · `:728` (`actor` = username **or `'system'`**) · `:340` (the older `/api/compliance/consent`) · `:771` (the acknowledgement route's `recorded_by`, `server/preboarding-package.js:196-205` requires it)
- `client/src/App.tsx:849` (the three literals) · `:1914-1963` (case card, button, tooltip) · `:1464` ("MISSING / REQUIRED") · `:1479` (notice reachable only as a template download)
- `templates/privacy-notice.md:6,247` (v2.2) · `:28-37` (categories) · `:41-51` (purposes ↔ bases) · `:54-65` (retention) · `:125` (Arabic version) · `:237-248` (acknowledgement block — blanket consent box at `:245`, signature row at `:248`)
- `compliance-requirements.md` §5.3 (notice content list) · `:391` (§6.4, the KSA Arabic claim) · `legal-signoff-checklist.md:15,17,27` (processor/controller, DPO, wordmark) · `compliance-dpia-vendor-risk.md:26-30,47` (article set + its own citation caveat)
