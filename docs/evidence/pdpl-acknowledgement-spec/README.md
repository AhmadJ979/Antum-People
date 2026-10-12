# Evidence — the acknowledgement-route spec

Row `2083308b`. Every value and every `file:line` in `pdpl-acknowledgement-route-spec.md` comes from one of the
transcripts below, run against `origin/main` = **`b54412d`** on this host. Nothing is quoted from another member's
report.

Measured 2026-10-12T05:05:30Z (UTC).

**What to check if this spec is challenged:** the seven bases in its §1 table come from the notice's own purpose
table (transcript 12) — `:44` legal obligation for three items, `:43` contract performance for bank details, and
**no row at all** for the two certificates and the emergency contact. The actor rule comes from transcripts 4-6:
the codebase holds two behaviours and the spec adopts the stricter one.

## The item set and its seven keys

```bash
$ git show origin/main:server/preboarding-items.js | sed -n '66,78p'
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
    ],
```

## The gate that option B rewrites

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

## What the consent record writes today

```bash
$ git show origin/main:server/preboarding-items.js | sed -n '242p;247p'
      ${db.escapeString(input.actor || 'system')}
    VALUES (${db.escapeString(randomUUID())}, ${db.escapeString(input.actor || 'system')},
```

## The consent route: the fallback the new route must NOT copy

```bash
$ git show origin/main:server/index.js | sed -n '721,729p'
app.post('/api/preboarding/cases/:id/consent', async (req, res) => {
  try {
    const result = await preboardingItems.recordConsent({
      case_id: req.params.id,
      consent_type: req.body && req.body.consent_type,
      lawful_basis: req.body && req.body.lawful_basis,
      consent_version: req.body && req.body.consent_version,
      actor: (req.user && req.user.username) || 'system',
    });
```

## The pattern to copy: P2-3's route passes a name or null

```bash
$ git show origin/main:server/index.js | sed -n '767,779p'
app.post('/api/preboarding/cases/:id/package/:itemKey/acknowledgement', async (req, res) => {
  try {
    const result = await preboardingPackage.recordAcknowledgement({
      case_id: req.params.id,
      item_key: req.params.itemKey,
      // The actor is the signed-in user, and it is passed explicitly: the module refuses a
      // record that does not name one.
      recorded_by: (req.user && req.user.username) || null,
      method: req.body && req.body.method,
      note: req.body && req.body.note,
    });
    res.status(result.created ? 201 : 200).json(result);
  } catch (err) {
```

## ...and its module refuses an unnamed actor

```bash
$ git show origin/main:server/preboarding-package.js | sed -n '196,206p'
  // Rule 3: no invented actor. A record without a named person would imply a hire who cannot
  // yet sign in, or a system that recorded something it never observed.
  const recordedBy = typeof input.recorded_by === 'string' ? input.recorded_by.trim() : '';
  if (!recordedBy) {
    throw new PreboardingPackageError(
      'recorded_by is required: there is no new-hire login in this release, so the record must '
      + 'name the person recording the acknowledgement on the hire\'s behalf', 400
    );
  }

  // Rule 3 again, from the other side: the product cannot obtain a signature, so a caller cannot
```

## The table that already has the right shape

```bash
$ git show origin/main:server/schema.sql | sed -n '284,297p'
CREATE TABLE IF NOT EXISTS preboarding_acknowledgements (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  acknowledgement_required INTEGER NOT NULL DEFAULT 0,
  recorded_by TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'in_product_record',
  note TEXT,
  acknowledged_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (case_id, item_key)
);
```

## The one-row-per-case table that cannot carry per-item bases

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

## The three client literals (v1, consent)

```bash
$ git show origin/main:client/src/App.tsx | sed -n '849p'
        body: JSON.stringify({ consent_type: 'pdpl_notice', lawful_basis: 'consent', consent_version: 'v1' })
```

## The four surfaces the copy changes

```bash
$ git grep -n "Without consent\|Record PDPL consent\|No PDPL consent record\|PDPL consent recorded" origin/main -- client/src/App.tsx
origin/main:client/src/App.tsx:860:      setChecklistNotice({ kind: 'ok', text: data.created ? 'PDPL consent recorded — documents can now be collected on this case.' : 'This case already had a PDPL consent record; nothing was recorded twice.' });
origin/main:client/src/App.tsx:1804:                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Without consent</div>
origin/main:client/src/App.tsx:1916:                                  No PDPL consent record — no document can be collected on this case yet.
origin/main:client/src/App.tsx:1938:                                        <span className="text-[10px] text-teal-700 font-semibold">PDPL consent recorded {detail.consent.granted_at}</span>
origin/main:client/src/App.tsx:1942:                                          Record PDPL consent
```

## The notice version header, and the acknowledgement block

```bash
$ git show origin/main:templates/privacy-notice.md | sed -n '6p;247p'
> **Version / الإصدار:** v2.2 (2026-09-17) — owner legal details applied (DPO name, partial address, entity status)
| Consent Version / إصدار الموافقة | v2.2 (2026-09-17) |
```

## The notice purposes: what is assigned, and what is absent

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

## The notice reaches a client only as a download

```bash
$ git grep -n "compliance/templates" origin/main -- server/index.js client/src/App.tsx
origin/main:client/src/App.tsx:920:      const res = await authedFetch(`${API_BASE}/api/compliance/templates/${templateName}/${selectedEmployee.id}`);
origin/main:server/index.js:350:app.get('/api/compliance/templates/:templateName/:employeeId', async (req, res) => {
```

## The item rows survive a set change (nothing creates them per key here)

```bash
$ git grep -n "emergency_contact" origin/main -- server/preboarding-items.js | head -3
origin/main:server/preboarding-items.js:77:      { item_key: 'emergency_contact', label: 'Emergency contact', category: 'welfare' },
origin/main:server/preboarding-items.js:89:      { item_key: 'emergency_contact', label: 'Emergency contact', category: 'welfare' },
```

## The spec's three load-bearing measurements

| Claim | Measured how |
|---|---|
| The record cannot stay one-row-per-case | `preboarding_consents` is `UNIQUE(case_id)` in effect (`schema.sql:258-267`); the seven bases differ, so the basis must be per item |
| A stricter actor rule already exists in this codebase | `preboarding-package.js:196-206` refuses an unnamed actor; `preboarding-items.js:242` and `index.js:728` fall back to `'system'` — the spec adopts the former |
| The notice is never shown at the point of collection | the only route that serves it is `GET /api/compliance/templates/:templateName/:employeeId` (`index.js:350`), called from an employee record (`App.tsx:1479`) — not from the pre-boarding gate |
