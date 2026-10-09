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
