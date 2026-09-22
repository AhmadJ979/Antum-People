# EOSB Engine Gaps — Written Specification

> **Author:** Compliance Expert
> **Date:** 2026-09-19
> **Status:** Specification for review — **no engine code changes** in this document's scope.
> **Scope:** two gaps surfaced by the 2026-09-18 EOSB re-verification: (1) the KSA notice-penalty deduction is no longer modelled; (2) `POST /api/compliance/calculate-eosb` no longer persists an audit row. Findings 1–3 of the review are **fixed and stay fixed** — nothing here proposes changing that remediated logic.
> **Data note:** test inputs and expected values below are **synthetic fixtures** (round, clearly non-real amounts), used only to specify arithmetic for the engineer. No real employee values appear.

---

## 1. Summary of recommendations

| Gap | Recommendation | Rationale (one line) |
|---|---|---|
| **Gap 1 — notice penalty** | **Do not fold it into `calculateEOSB`.** Model it as a separate final-settlement deduction, in its own calculation step, with its own inputs and audit fields. | End-of-service benefit and notice-period compensation are legally distinct obligations; conflating them destroys the audit trail and makes "EOSB" unreconstructable. |
| **Gap 2 — audit trail** | **Persist an `eosb_calculations` row for every calculation**, written in the same transaction as the calculation, with PII held out of clear text. | A compliance product must be able to reproduce any figure a regulator or auditor asks about. |

The detailed requirements, statutory basis, arithmetic, boundary cases, and test vectors follow.

---

## 2. Gap 1 — Notice penalty (KSA and UAE)

### 2.1 Current behaviour

- `employees` has `gave_proper_notice` (INTEGER, default `1`), but `calculateEOSB` never reads it.
- `calculateEOSB` returns a single accrued EOSB figure with no notice deduction.
- Consequence: an employee who resigns without serving notice is **not** charged the statutory notice compensation, and an employer who waives notice is not credited — in both directions the number is silent about a real statutory item.

### 2.2 Statutory basis

**KSA — Labour Law, Royal Decree No. M/51 (as amended):**

- **Notice period** — for an indefinite-term contract the notice period is **60 days** for a worker paid monthly and **30 days** for others; for a fixed-term contract it cannot exceed the unexpired term. (Statutory reference: the notice-period provision — cited in our own `compliance-requirements.md` within "Articles 74–86".)
- **Notice compensation** — if the terminating party does **not** serve the full notice period, the other party is entitled to compensation **equal to the worker's wage for the duration of the notice period, or the remaining part of it**. This is a *wage-for-unserved-notice* amount, **not** a flat percentage of EOSB.
- **Summary dismissal** — grounds under Art. 80/81 forfeit EOSB; the notice question is then moot because there is no settlement to deduct from.

**UAE — Federal Decree-Law No. 33 of 2021 (as amended):**

- **Notice period** — agreed in the contract, **minimum 30 days, maximum 90 days** (our `compliance-requirements.md` §KSA/UAE comparison records this).
- **Notice compensation** — if a party fails to serve the full notice period, the other party is entitled to compensation equal to the worker's wage for the unserved period (the Decree-Law's notice provisions).
- **Summary dismissal** — Article 44 grounds forfeit EOSB.

> **Important correction to earlier artefacts:** the original EOSB review (Finding 6) and `compliance-requirements.md` described the KSA notice penalty as "a 50% deduction" / "up to 50% of EOSB". That was a simplification. The statutory measure is **wage for the unserved notice period** (a number of days × the daily wage), not a percentage of EOSB. This spec supersedes the "50%" wording. **Exact article numbers should be confirmed against the current consolidated text of each statute before code lands** — the treatment above is the rule; the pin-cite is the thing to verify.

### 2.3 Recommendation — keep it out of `calculateEOSB`

`calculateEOSB` should continue to return the **accrued EOSB only** (its current, now-correct output after Findings 1–3). The notice compensation is a **separate settlement line item** computed by a distinct function (e.g. `calculateNoticeCompensation`), then subtracted on the final-settlement statement, never merged into the EOSB figure. Reasons:

1. **Legal distinctness** — EOSB is an accrued statutory benefit; notice compensation is a breach-of-notice remedy. An auditor must be able to see each as its own number.
2. **Auditability** — the existing `eosb_calculations` audit table records an EOSB calculation; notice compensation belongs in its own record so neither figure is ever "baked into" the other.
3. **Reconstructability** — if the two are summed, the original EOSB can no longer be derived from the stored value.

If the team later decides the settlement statement must show a single net figure, that net figure is computed at **display/settlement time** from the two separate stored components — never by mutating EOSB.

> **Out-of-scope flag for the lead's awareness (not a change request):** `compliance-requirements.md` currently states KSA resignations receive **full** EOSB with the notice penalty as the only differentiator, while `calculateEOSB` (as remediated under Finding 1) applies UAE-style resignation **tiers** (1/3, 2/3) to KSA. These are opposite models. This spec does **not** touch that (Findings 1–3 are fixed), but if the notice compensation is later layered on top of the existing KSA tier, a resigning KSA employee could be reduced twice. Before any settlement work proceeds, the tier-vs-notice-penalty question should be settled once so the two reductions don't stack unintentionally.

### 2.4 Inputs and units

For the **notice-compensation** step (new, separate from EOSB):

| Input | Type / unit | Notes |
|---|---|---|
| `gave_proper_notice` | boolean | `true` = full notice served (or waived); `false` = notice not fully served |
| `notice_waived_by_employer` | boolean | employer explicitly waives the remainder — equivalent to served |
| `notice_period_days` | integer (days) | contract/statutory notice; KSA 60/30, UAE 30–90 per contract |
| `notice_days_served` | integer (days) | days actually served/garden-leave; default 0 |
| `total_salary` | decimal (monthly) | basis for the daily wage (KSA uses total salary incl. allowances) |
| `country` | 'AE' \| 'SA' | selects statutory defaults for the notice period |

The engine must **derive** `notice_period_days` from `country` + contract when not supplied, rather than trusting a client-supplied figure silently.

### 2.5 Arithmetic and rounding

```
shortfall_days = gave_proper_notice || notice_waived_by_employer ? 0
               : max(0, notice_period_days - notice_days_served)

daily_wage     = total_salary / 30            // 30-day month convention, matching EOSB daily rate

notice_compensation = daily_wage × shortfall_days
```

- **Currency** = the salary currency (AED / SAR as stored).
- **Rounding** = compute to full precision, round the final settlement line to **2 decimal places** (`Math.round(x * 100) / 100`), the same convention as `calculateEOSB`.
- **Floor** = the notice compensation may **offset** EOSB and other settlement lines but must **never make the net settlement negative**; if `notice_compensation > total_settlement`, the deduction is capped at `total_settlement` and the residual is a separate employer claim, not an engine output.

### 2.6 Boundary cases

| Case | Expected behaviour |
|---|---|
| Full notice served | `gave_proper_notice = true` → shortfall 0, no deduction |
| Notice partially served | deduct only the unserved remainder |
| Garden leave | days on garden leave count as **served** (the worker is standing by for the employer) → add to `notice_days_served` |
| Employer waiver | `notice_waived_by_employer = true` → no deduction (and record the waiver in the audit row) |
| Termination during probation | no statutory notice is owed during probation → no notice compensation |
| Summary dismissal (Art. 44 / 80–81) | EOSB is already 0 (forfeited); notice compensation is moot — do not emit a negative settlement |
| KSA vs UAE | **both** jurisdictions impose notice compensation for unserved notice; the only differences are the statutory notice length (KSA 60/30 vs UAE 30–90 contract) and the salary basis (KSA total incl. allowances; UAE basic wage is the EOSB basis, but notice compensation in UAE is also generally computed on the wage) |

### 2.7 Test cases (synthetic fixtures)

Synthetic KSA worker: **total monthly salary 10,000 SAR**, notice period **60 days**, daily wage = 10,000 / 30 = **333.3333… SAR/day**.

| ID | Scenario | Inputs | Expected notice compensation | Expected EOSB effect |
|---|---|---|---|---|
| NC-1 | Full notice | gave_proper_notice=true | 0 | EOSB unchanged |
| NC-2 | No notice served | shortfall 60 | 20,000.00 SAR | EOSB unchanged (deduction is a separate settlement line) |
| NC-3 | Partial notice (20 of 60 days) | shortfall 40 | 13,333.33 SAR | EOSB unchanged |
| NC-4 | Employer waiver | waived=true | 0 | EOSB unchanged |
| NC-5 | Garden leave (60 days on garden leave) | served=60 | 0 | EOSB unchanged |
| NC-6 | Probation | probation=true | 0 | EOSB already 0 (UAE <1yr; KSA pro-rata from day one) |
| NC-7 | Summary dismissal | termination_type=summary_dismissal | n/a (moot) | EOSB = 0 |

Synthetic UAE worker: **basic wage 15,000 AED**, notice period **30 days**, daily wage = 500 AED/day.

| ID | Scenario | Inputs | Expected notice compensation |
|---|---|---|---|
| NC-8 | No notice, 30-day period | shortfall 30 | 15,000.00 AED |
| NC-9 | Partial (10 of 30 days) | shortfall 20 | 10,000.00 AED |

*(These are hypothetical round numbers chosen only to make the arithmetic checkable; they are not any real person's pay.)*

---

## 3. Gap 2 — EOSB audit-trail persistence

### 3.1 Current behaviour

`POST /api/compliance/calculate-eosb` computes the amount and returns `{ amount }` with **no row written** to `eosb_calculations`. The table exists (and already carries `gross_amount`, `deductions`, `net_amount` from the PDPL-hardening work) but is never populated by this endpoint.

### 3.2 Required behaviour

Every calculation must produce one immutable audit row so a regulator or auditor can **reconstruct the calculation from stored inputs**. The row records: **what** was calculated, **from which inputs**, **by whom**, and **when**.

### 3.3 Fields to record

| Field | Type | Purpose |
|---|---|---|
| `id` | UUID | primary key |
| `employee_id` | UUID (FK → employees) | the subject — **the only link to the person; no identifiers are copied here** |
| `calculation_date` | timestamp | when calculated |
| `jurisdiction` | 'AE' \| 'SA' | which rule set applied |
| `start_date`, `end_date` | date | service period |
| `basic_salary`, `total_salary` | decimal | inputs (see §3.4 on storage) |
| `unpaid_leave_days` | integer | input |
| `termination_type` | text | `resignation` / `summary_dismissal` / … — **replaces the legacy `is_resignation`** |
| `accrued_amount` | decimal | EOSB output |
| `gross_amount`, `deductions`, `net_amount` | decimal | gross / any deductions / net (if a settlement figure is stored) |
| `formula_used` | text | e.g. `"UAE 21/30 days; 90-day unpaid-leave rule"` — human-reconstructable |
| `calculated_by` | text | authenticated user id (from the JWT), or `'system'` for automated recalc |
| `created_at` | timestamp | immutable |

**Schema change required:** drop the legacy `is_resignation` column (or stop writing it) and store `termination_type` instead, so the audit record uses the same vocabulary as the engine.

### 3.4 PII and PDPL constraints — what must NOT be written in clear

- **Never** write `national_id_value`, `national_id_iqama`, `email`, `first_name`, `last_name`, or any direct identifier into `eosb_calculations`. The `employee_id` UUID is sufficient to join to `employees`; those columns there are already encrypted (`auth.encrypt`, AES-256-GCM).
- **Salary fields** (`basic_salary`, `total_salary`) are personal data under UAE PDPL (Federal Decree-Law No. 45 of 2021) and KSA PDPL (Royal Decree M/19 of 2021). They are **necessary** to reconstruct the calculation, so their storage is lawful (compliance with a legal obligation / legitimate interest), but they should be **encrypted at rest** (`auth.encrypt`) to match the product's existing posture, and **decrypted only at audit/display time** for authorised roles.
- **Derived amounts** (`accrued_amount`, `gross_amount`, `deductions`, `net_amount`) may be stored in clear for querying/aggregation, but access must still be role-restricted (they reveal compensation).
- **Access** — RBAC: only compliance/HR/payroll/audit roles may read the table; least privilege; access logged.

### 3.5 Retention and access (UAE/KSA PDPL)

- Retain the audit row for **at least** the statutory limitation period for employment/wage claims (1 year in each jurisdiction) **plus a buffer**; recommend **5 years** as the documented retention baseline, after which records are **anonymised or deleted** per the retention schedule.
- Data minimisation: store only the fields in §3.3; no free-text that could absorb unrelated personal data.

### 3.6 Transactionality and failure handling

- **Same transaction** as the calculation: the calculation is pure (no state), so the transaction is effectively the audit `INSERT`. The requirement is that a successful response and a persisted audit row are **atomic** — you may never return a successful `{ amount }` without a durable row.
- **If the audit write fails:** return **500** (do not return the amount), so the caller knows the calculation was not durably recorded; log the failure for retry. For a compliance product, a calculation without an audit record is worse than a failed request.

---

## 4. Decisions requested from the lead

1. **Confirm the notice penalty stays a separate settlement component** (recommended) rather than being folded into `calculateEOSB`. If you want a single net settlement figure, I'll specify that as a display-time composition of the two stored components.
2. **Confirm the statutory measure is wage-for-unserved-notice** (this spec supersedes the earlier "50%" wording). I'll pin the exact article numbers against the current consolidated texts before any code lands.
3. **Confirm salary-at-rest encryption** for the audit row (`auth.encrypt` on `basic_salary`/`total_salary`) — or approve clear-text-with-RBAC if you prefer queryability over encryption.

*Specification prepared by Compliance Expert | 2026-09-19*
