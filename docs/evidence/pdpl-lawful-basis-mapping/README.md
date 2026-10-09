# Evidence — the lawful-basis mapping (`pdpl-lawful-basis-mapping.md`)

Row `04e0f9ab`. Every cell of the mapping table and every fact in the document's §1 comes from one of the
transcripts below, run against `origin/main` = **`cd9daa8`** on this host. Nothing here is quoted from another
member's report or from a working tree.

Measured 2026-10-09T14:51:39Z (UTC).

Each heading names the claim the output supports.

## The tree

```bash
$ git log -1 --format='%h %s' origin/main
cd9daa8 Merge pull request #129 from AhmadJ979/docs/workflow-mirror-and-1234-record
```

## The three literals

```bash
$ git show origin/main:client/src/App.tsx | sed -n '849p'
        body: JSON.stringify({ consent_type: 'pdpl_notice', lawful_basis: 'consent', consent_version: 'v1' })
```

## The consent route and who it records

```bash
$ git show origin/main:server/index.js | sed -n '721,730p'
app.post('/api/preboarding/cases/:id/consent', async (req, res) => {
  try {
    const result = await preboardingItems.recordConsent({
      case_id: req.params.id,
      consent_type: req.body && req.body.consent_type,
      lawful_basis: req.body && req.body.lawful_basis,
      consent_version: req.body && req.body.consent_version,
      actor: (req.user && req.user.username) || 'system',
    });
    res.status(result.created ? 201 : 200).json(result);
```

## What the module writes into recorded_by

```bash
$ git show origin/main:server/preboarding-items.js | sed -n '234,247p'
      id, case_id, consent_type, lawful_basis, consent_version, granted_at, recorded_by
    ) VALUES (
      ${db.escapeString(id)},
      ${db.escapeString(caseId)},
      ${db.escapeString(input.consent_type)},
      ${db.escapeString(input.lawful_basis)},
      ${db.escapeString(input.consent_version)},
      ${db.escapeString(grantedAt)},
      ${db.escapeString(input.actor || 'system')}
    )
  `);

  await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, new_values, timestamp)
    VALUES (${db.escapeString(randomUUID())}, ${db.escapeString(input.actor || 'system')},
```

## The gate (employee track only)

```bash
$ git show origin/main:server/preboarding-items.js | sed -n '326,332p'
  if (track === 'employee'
      && COLLECTED_STATUSES.indexOf(status) !== -1
      && !(await hasConsent(caseId))) {
    throw new PreboardingItemError(
      'A document cannot be collected before the PDPL consent record exists for this case. '
      + 'Record PDPL consent first.',
      428
```

## The sibling module refuses an unnamed actor

```bash
$ git show origin/main:server/preboarding-package.js | sed -n '196,202p'
  // Rule 3: no invented actor. A record without a named person would imply a hire who cannot
  // yet sign in, or a system that recorded something it never observed.
  const recordedBy = typeof input.recorded_by === 'string' ? input.recorded_by.trim() : '';
  if (!recordedBy) {
    throw new PreboardingPackageError(
      'recorded_by is required: there is no new-hire login in this release, so the record must '
      + 'name the person recording the acknowledgement on the hire\'s behalf', 400
```

## The consent table

```bash
$ git show origin/main:server/schema.sql | sed -n '258,267p'
CREATE TABLE IF NOT EXISTS preboarding_consents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE,
  consent_type TEXT NOT NULL,
  lawful_basis TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  recorded_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## The document set (UAE, active)

```bash
$ git show origin/main:server/preboarding-items.js | sed -n '66,77p'
const DOCUMENT_SETS = {
  AE: {
    active: true,
    label: 'UAE pre-boarding documents',
    items: [
      { item_key: 'passport', label: 'Passport copy', category: 'identity' },
      { item_key: 'visa_or_entry_permit', label: 'Visa or entry permit', category: 'immigration' },
      { item_key: 'emirates_id', label: 'Emirates ID', category: 'identity' },
      { item_key: 'education_certificate', label: 'Education certificate', category: 'qualification' },
      { item_key: 'experience_certificate', label: 'Experience certificate', category: 'qualification' },
      { item_key: 'bank_details', label: 'Bank details (IBAN letter)', category: 'payroll' },
      { item_key: 'emergency_contact', label: 'Emergency contact', category: 'welfare' },
```

## The notice's purpose table (v2.2)

```bash
$ git show origin/main:templates/privacy-notice.md | sed -n '43,50p'
| Administering your employment and payroll (including WPS reporting) | Performance of the employment contract / contractual necessity (UAE PDPL Art. 4(2); KSA PDPL Art. 6) |
| Visa, immigration, Emiratisation/Saudization, and government registration (MoHRE / Qiwa) | Legal obligation |
| Benefits and insurance administration | Contractual necessity / legitimate interest |
| Performance management and training | Legitimate interest |
| Health & safety and occupational health | Legal obligation / vital interest / explicit consent (sensitive data) |
| Time & attendance via biometrics (where applicable) | Explicit consent (sensitive data) |
| HR analytics and workforce intelligence | Legitimate interest (with DPIA where required) |
| Complying with retention and audit obligations | Legal obligation |
```

## The notice version, both places it is written

```bash
$ git show origin/main:templates/privacy-notice.md | sed -n '6p;247p'
> **Version / الإصدار:** v2.2 (2026-09-17) — owner legal details applied (DPO name, partial address, entity status)
| Consent Version / إصدار الموافقة | v2.2 (2026-09-17) |
```

## The demo's own note that no consent row exists

```bash
$ git show origin/main:demo-weak-screens.md | sed -n '64p'
**And do not resolve the consent label.** The live endpoint answers `{"consent": null}` on all three cases, so the demo's own **"3 WITHOUT CONSENT"** wording is still true today. Owner decision 14 — consent versus a notice acknowledgement — is **open**, so this document keeps the label accurate and leaves the decision alone.
```

## The frozen engine, untouched

```bash
$ git show origin/main:server/eosb.js | md5sum
36b5dcdc0ee64e0cad5505dd757a5742  -
```

## The mapping in one line, as the evidence shows it

- **What the notice assigns** to the purposes these seven documents are collected for: contract performance
  and legal obligation (purpose table, above) — **consent only for biometrics and certain sensitive data**,
  and no pre-boarding document is either.
- **What the product records** for every case: `lawful_basis:'consent'`, `consent_version:'v1'` — three
  hardcoded literals in the client, independent of the documents (`App.tsx:849`).
- **What can act**: the signed-in username **or the string `'system'`** (`index.js:728`, and the module's own
  fallback at `preboarding-items.js:242`) — while the sibling acknowledgement module **refuses** an unnamed
  actor (`preboarding-package.js:196-202`). Two standards, one product surface.
- **The record** is one row per case with no withdrawal column (`schema.sql:258-267`).
- **No code was changed by this row**: the gate, the literals and the copy are exactly as the transcripts show
  them, and `server/eosb.js` is byte-identical at `36b5dcdc0ee64e0cad5505dd757a5742`.

# Addendum — the audit of the six counsel questions (2026-10-09T14:56:46Z UTC)

Added after the lead's instruction: *"If, doing this, you find that one of the six questions is not actually
a question (because the repository already answers it), say so and drop it; a shorter letter is a better letter."*

Each of the six was checked against our own materials at `origin/main` = **`631bdd5`**. The verdicts are in the
document's §4; these are the outputs behind them. **The decisive check was the section heading** — an Arabic
obligation and an Arabic-mandatory contract row both exist in this repository, and both sit under **KSA**,
which is the jurisdiction we have held. Read on the heading, not on the phrase.

## Which jurisdiction each contract row belongs to (this is what decides the drop)

```bash
$ git show origin/main:compliance-requirements.md | grep -n '^##' | sed -n '1,10p'
11:## Table of Contents
25:## 1. UAE Labor Law
27:### 1.1 Governing Legislation
34:### 1.2 Onboarding Requirements
46:### 1.3 Offboarding Requirements
62:## 2. KSA Labor Law
64:### 2.1 Governing Legislation
70:### 2.2 Onboarding Requirements
83:### 2.3 Offboarding Requirements
97:## 3. EOSB — UAE
```

## The UAE contract row (in 1.2) — the repository's answer for the UAE

```bash
$ git show origin/main:compliance-requirements.md | sed -n '38p'
| **Employment Contract** | Must be in writing (Arabic + English/other). Must be the standard MoHRE contract template. Must specify: salary, duration, work location, working hours, leave entitlements. | Schema needs contract_type (limited/unlimited), contract_language fields. Generate compliant contract templates. |
```

## The KSA contract row (in 2.2) — the row my first draft wrongly cited

```bash
$ git show origin/main:compliance-requirements.md | sed -n '74p'
| **Employment Contract** | Must be in Arabic (bilingual contracts permitted). Must specify: salary, duration, place of work, probation period, leave, notice period. Must be in writing. | Similar to UAE — support Arabic as mandatory language, contract templates. |
```

## The UAE PDPL 5.2 baseline: consent is not the instrument here

```bash
$ git show origin/main:compliance-requirements.md | grep -n 'Contractual necessity\|Art. 4(2)' | head -4
300:| **Consent** | Processing employee data requires explicit consent. For HR processing (contractual necessity), Art. 4(2) allows processing without consent. | Consent capture on onboarding. Purpose limitation notices. |
```

## The Arabic-notice obligation sits under KSA, not UAE

```bash
$ git show origin/main:compliance-dpia-vendor-risk.md | sed -n '42p;47p'
### 1.2 KSA PDPL (Royal Decree M/148, as amended 2023)
| **Controller obligations** | Art. 7, Art. 10 | Controller must ensure lawful processing; publish a privacy policy in Arabic. | Arabic-first notices; controller register. |
```

## Nothing gives the emergency contact a basis

```bash
$ git grep -n -i 'emergency contact' origin/main -- '*.md' 'server/preboarding-items.js' | grep -v '^origin/main:client' | cut -c1-120
origin/main:design-concepts/LAYER2-P2-2-IMPLEMENTATION-NOTES.md:32:| The item sets | `server/preboarding-items.js:64`–
origin/main:design-concepts/LAYER2-PREBOARDING-UI.md:252:│  │ ☐ Emergency contact      pending     │  │       
origin/main:pdpl-portal-boundary-memo.md:36:**The question:** what must a UAE PDPL-compliant notice contain at the point
origin/main:pdpl-portal-boundary-memo.md:75:| Emergency contact | *(no row covers it — see 3.3)* |
origin/main:pdpl-portal-boundary-memo.md:93:### 3.3 The emergency contact is a different person
origin/main:pdpl-portal-boundary-memo.md:221:6. **No implication that the hire's acknowledgement covers the emergency co
origin/main:pdpl-portal-boundary-memo.md:242:| What is the lawful basis for an **emergency contact's** data, and who may
origin/main:pdpl-portal-boundary-memo.md:256:4. **A separate, explicit line for the emergency contact** — a different 
origin/main:pdpl-portal-boundary-memo.md:274:- `server/preboarding-items.js:29-31` (no bytes, reference only) · `:47` (
origin/main:server/preboarding-items.js:77:      { item_key: 'emergency_contact', label: 'Emergency contact', category: 
origin/main:server/preboarding-items.js:89:      { item_key: 'emergency_contact', label: 'Emergency contact', category: 
origin/main:templates/privacy-notice.md:29:| **Contact Data** | home address, personal email, mobile number, emergency c
```

## The retention floor the notice already asserts (UAE column)

```bash
$ git show origin/main:templates/privacy-notice.md | sed -n '58,62p'
| Record Type | UAE | KSA |
|---|---|---|
| Employment & payroll records | Minimum **2 years** post-termination (Labour Law) | Minimum **2 years** post-termination (Labour Law) |
| End-of-Service (EOSB) and financial/settlement records | **5 years** (commercial/audit) | **6 years** (ZATCA tax retention) |
| Consent records | Duration of employment + retention period | Duration of employment + retention period |
```

## The notice's own caution about its article references

```bash
$ git show origin/main:templates/privacy-notice.md | sed -n '8p'
> **Note / ملاحظة:** Article references follow the Antum People compliance reference set. Confirm against final official translations before client-facing certification.
```

## Verdicts, and what each rests on

| Question | Verdict | Resting on |
|---|---|---|
| 1 notice content | stands | our six elements are our own list, no article (`compliance-requirements.md:312-318`); the template says its references need confirming (`:8`) |
| 2 Arabic notice | stands, sharpened | the only Arabic-notice obligation in the repository is **KSA** (`compliance-dpia-vendor-risk.md:42,47`); nothing for the UAE |
| 3 Arabic contract | **dropped** | **UAE §1.2** answers it — writing, "Arabic + English/other" (`:38`); the Arabic-mandatory row is **KSA §2.2** (`:74`) |
| 4 consent as a basis | narrowed | our **§5.2 UAE** baseline already says contractual necessity allows processing without consent (`:300`) |
| 5 emergency contact | stands | no purpose row in the notice (`:43-50`), nothing else in the repository |
| 6 retention floor | narrowed | the notice already asserts the floor (`:58-62`) |
