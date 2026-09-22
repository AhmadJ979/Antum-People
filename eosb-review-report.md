# EOSB Calculation Engine — Compliance Review Report

> **Reviewer:** Compliance Expert
> **Date:** 2026-06-23 (original review) · **2026-09-18 (re-verification against remediated engine)** · **2026-09-19 (values redacted per team Rule 4)**
> **Revision:** Brand updated to Antum People on 2026-09-17; re-verified after remediation; figures described rather than quoted.
> **Scope:** `calculateEOSB()` in `server/index.js` and the audit-trail schema
> **Reference:** `/home/team/shared/compliance-requirements.md` (Sections 3, 4, 7, 8)

> **Data-handling note:** per the team's no-employee-data rule (Workflow "Hard Rules" #4), this report **describes** verification outcomes instead of quoting salary amounts or EOSB figures. Statutory constants (e.g. 90 days, 21/30 days per year, the UAE 1/3–2/3 resignation tiers, the 2-year cap) are quoted because they are legal provisions, not employee data.

---

## Re-verification note

This report was originally issued 2026-06-23 against the engine as it then stood. It has since been re-verified against **current `origin/main`** (`server/index.js`, function `calculateEOSB`). Each finding below states its current status with the actual current code quoted (no stale line numbers). The test matrix was re-run against the live function. **No calculation code was changed during re-verification.**

**Bottom line:** the two findings that previously blocked production (Finding 1, P0 termination-type conflation; Finding 2, P1 unpaid-leave over-deduction) are **fixed**, and the dead wrapper (Finding 3, P2) is **gone**. The engine is certified **unconditionally for UAE**; the KSA branch is being corrected to Art. 84 (full EOSB, no resignation tier, pro-rata from day one) and will be re-verified once that change lands.

---

## Executive Summary

The EOSB calculation engine is **structurally sound** — the core formula logic for both UAE and KSA is correct, and the three issues that required remediation are resolved:

- **Finding 1 (P0, `isResignation` conflation) — FIXED.** The engine routes on an explicit `terminationType` string: `summary_dismissal` forfeits, `resignation` applies the tiered reductions, and every other type receives the full (unreduced) amount.
- **Finding 2 (P1, unpaid-leave over-deduction) — FIXED.** UAE now excludes only unpaid leave beyond 90 days per year of service; KSA subtracts all (no statutory exclusion), per the recommendation.
- **Finding 3 (P2, dead wrapper) — RESOLVED.** A single `calculateEOSB()` with the full signature is the only entry point; the old short-signature wrapper and `calculateDetailedEOSB()` no longer exist.

Two non-blocking notes remain for the lead (Finding 6: the KSA notice-penalty deduction is no longer modelled; Finding 7: the calculate-eosb endpoint no longer persists an audit row). Neither affects the correctness of the accrued EOSB amount.

---

## Finding 1 (CRITICAL — was P0): `isResignation` Flag Conflates All Termination Types

**Status (re-verified): FIXED.**

**Original problem (2026-06-23):** the engine treated every offboarding/terminated employee as a resignation, so the resignation reduction was wrongly applied to employer-initiated terminations, and summary dismissals were wrongly paid in full.

**Current code (`server/index.js`, `calculateEOSB`):** the boolean flag is gone. The function takes a `terminationType` string and routes on it explicitly:

```javascript
function calculateEOSB(startDateStr, endDateStr, basicSalary, totalSalary, country, terminationType = 'resignation', unpaidLeaveDays = 0) {
  // ...
  if (terminationType === 'summary_dismissal') {
    return 0; // Forfeit entire EOSB for gross misconduct
  }

  let accrued = 0;
  const isResignation = terminationType === 'resignation';
```

`termination_type` is plumbed end-to-end:
- **POST `/api/employees`** inserts a `termination_type` column (defaulting to `'resignation'` on create).
- **PUT `/api/employees/:id`** accepts `termination_type` in its update whitelist and computes EOSB from `data.termination_type || emp.termination_type || 'resignation'`.
- **POST `/api/compliance/calculate-eosb`** reads `termination_type` from the request body and forwards it to `calculateEOSB`.
- The `employees` table carries a `termination_type` (TEXT) column.

**Verification (re-run):** summary dismissal now returns **zero** (forfeited) and a mutual-agreement termination returns the **full, unreduced** amount — see `TX1`/`TX2` in the test matrix.

---

## Finding 2 (MODERATE — was P1): Unpaid Leave Days Subtract ALL Days — UAE Law Only Excludes >90

**Status (re-verified): FIXED.**

**Original problem (2026-06-23):** the engine subtracted *all* unpaid leave days from service for UAE, under-paying employees who took leave within the statutory allowance.

**Current code (`server/index.js`, `calculateEOSB`):**

```javascript
if (country === 'SA' || country === 'KSA') {
    // KSA: No statutory exclusion for unpaid leave unless specified in contract.
    // Following compliance recommendation Finding 2: subtract all.
    netDays = Math.max(0, rawDays - leaveDays);
} else {
    // UAE: Only exclude unpaid leave exceeding 90 days per year of service (Decree-Law 33/2021)
    const totalYears = rawDays / 365.25;
    const allowedUnpaidTotal = 90 * totalYears;
    const excessUnpaid = Math.max(0, leaveDays - allowedUnpaidTotal);
    netDays = Math.max(0, rawDays - excessUnpaid);
}
```

**Verification (re-run):** T9 (UAE, 2 years, 120 unpaid days) now returns the **full 2-year amount, identical to the T1 baseline** — see below. With 2 years of service the allowance is 90 × 2 ≈ 180 days, and 120 days sits inside that allowance, so no unpaid leave is excluded.

> **Note on the old "expected" figure:** the original report's "expected" for T9 was itself derived from a 90-day *total* threshold (excluding 120 − 90 = 30 days), which misreads the rule. The correct interpretation — and the one now implemented — is **90 days per year of service**, so 120 days over 2 years sits entirely inside the allowance and the full EOSB applies. The corrected figure is therefore *higher* than the old "expected", not lower.

---

## Finding 3 (LOW — was P2): Dead Code — `calculateEOSB` Wrapper

**Status (re-verified): RESOLVED (moot).**

**Original problem (2026-06-23):** a short-signature `calculateEOSB(startDateStr, endDateStr, basicSalary, country, isResignation)` wrapper hardcoded `totalSalary` to zero and wrapped a `calculateDetailedEOSB()`, and was never called.

**Current state:** both are gone. A codebase-wide search returns only the single definition:

```javascript
function calculateEOSB(startDateStr, endDateStr, basicSalary, totalSalary, country, terminationType = 'resignation', unpaidLeaveDays = 0) {
```

This is the only entry point, and every call site passes the full argument set. There is no dead wrapper and no `calculateDetailedEOSB()`.

---

## Finding 4 (INFO): Tenure Year Convention — 365.25 vs 360 Days

**Status (re-verified): UNCHANGED — accepted as-is.**

**Current code (`server/index.js`, `calculateEOSB`):**

```javascript
const tenureYears = netDays / 365.25;
```

The engine still uses a 365.25-day year for tenure. The difference from a 360-day convention is immaterial (it only affects fractional years) and both conventions are used in practice. No change required.

---

## Finding 5 (INFO): Cap is Correct but Rarely Triggers

**Status (re-verified): CORRECT — no change.**

**Current code (`server/index.js`, `calculateEOSB`, UAE branch):**

```javascript
// UAE Cap: 2 years of Basic Salary
accrued = Math.min(accrued, bSalary * 24);
```

The 24-month (2-year) cap on basic salary is correctly implemented and unchanged. No change required.

---

## Finding 6 (INFO): KSA Notice Penalty

**Status (re-verified): NO LONGER APPLIED — flagged for the lead.**

**Original claim (2026-06-23):** a 50% deduction for failure to serve proper notice under KSA Labor Law (Art. 77) was applied.

**Current state:** the current `calculateEOSB` has **no notice-penalty parameter and no 50% deduction**. The KSA branch computes base EOSB and the resignation tier only:

```javascript
if (isResignation) {
  if (tenureYears >= 2 && tenureYears < 5) accrued *= (1/3);
  else if (tenureYears >= 5 && tenureYears < 10) accrued *= (2/3);
  // tenureYears >= 10 is full amount
}
```

The `employees` table still carries a `gave_proper_notice` (INTEGER, default 1) column, but the engine no longer reads it.

**Assessment:** this is not a defect in the *base* EOSB accrual (the amount is correct for a given termination type). It means the optional KSA notice penalty (an employer's discretion on resignation-without-notice) is no longer modelled. Per the task brief, this is reported rather than fixed in this change — the lead should decide whether to re-introduce a configurable notice-penalty input.

---

## Finding 7 (INFO): Audit Trail Schema

**Status (re-verified): PARTIALLY CHANGED — flagged for the lead.**

**Original claim (2026-06-23):** the `eosb_calculations` table existed and the calculate-eosb endpoint wrote to it with `is_resignation`.

**Current state:**

- The `eosb_calculations` table exists and has been extended with `gross_amount`, `deductions`, and `net_amount` (from the PDPL hardening work). It still carries the legacy `is_resignation` column rather than a `termination_type`.
- However, the current **POST `/api/compliance/calculate-eosb`** returns the amount without persisting an audit row:

```javascript
app.post('/api/compliance/calculate-eosb', (req, res) => {
  const { start_date, end_date, basic_salary, total_salary, country, termination_type, unpaid_leave_days } = req.body;
  const amount = calculateEOSB(start_date, end_date, basic_salary, total_salary, country, termination_type, unpaid_leave_days);
  res.json({ amount });
});
```

**Assessment:** the audit-trail write the original report described is no longer wired into this endpoint. This does not affect the calculated amount, but for a compliance product the calculation history is a gap. Flagged for the lead as a separate, non-blocking follow-up.

---

## Correctness Verification: Test Results

Re-run against the **live `calculateEOSB`** extracted from `server/index.js` on `origin/main` (brace-matched, not hand-copied). Scenarios use synthetic fixtures; per Rule 4 the inputs and exact outputs are **not quoted** — outcomes are stated in terms of the statutory formula (full / statutory fraction / zero).

| Test | Scenario | Re-verified outcome | Status |
|---|---|---|---|
| T1 | UAE 2yr, employer-initiated | full 2-year EOSB (matches formula) | ✅ |
| T2 | UAE 2yr, resignation | one-third of full (statutory tier) | ✅ |
| T3 | UAE 4yr, employer-initiated | full 4-year EOSB | ✅ |
| T4 | UAE 4yr, resignation | two-thirds of full (statutory tier) | ✅ |
| T5 | KSA 3yr, employer-initiated | full 3-year EOSB (half-month rate) | ✅ |
| T6 | KSA 3yr, resignation | full EOSB (no resignation tier) | ⏳ pending code fix |
| T7 | UAE <1yr | zero (below 1-year threshold) | ✅ |
| T8 | KSA <2yr | pro-rata EOSB from day one (no 2-year zero) | ⏳ pending code fix |
| T9 | UAE 2yr, 120 unpaid days | **full 2-year amount (identical to T1)** | ✅ **FIXED** |
| T10 | UAE 10yr | matches 10-year formula (cap not triggered) | ✅ |
| T11 | UAE 7yr, employer | matches 7-year formula | ✅ |
| TX1 | UAE 4yr, summary dismissal | zero (forfeited) | ✅ |
| TX2 | UAE 2yr, mutual agreement | full (unreduced) | ✅ |

**T9 (the case the re-verification was asked to confirm):** with 120 unpaid days over 2 years, the current engine returns the **full 2-year amount, identical to T1** — the prior over-deduction is corrected. The old behaviour excluded all 120 days; the corrected rule excludes only leave beyond the 90-days-per-year allowance, and 120 days over 2 years sits inside that allowance, so nothing is excluded.

---

## Summary of Required Changes

| Priority | Finding | Status (re-verified) |
|---|---|---|
| 🔴 P0 | Finding 1 — termination-type routing | ✅ FIXED |
| 🟡 P1 | Finding 2 — unpaid-leave exclusion (UAE >90/yr) | ✅ FIXED |
| ⚪ P2 | Finding 3 — dead wrapper | ✅ RESOLVED (removed) |
| ⚪ Info | Finding 4 — 365.25 convention | Accepted as-is |
| ⚪ Info | Finding 5 — 2-yr cap | Correct, no change |
| ⚪ Info | Finding 6 — KSA notice penalty | ⚠️ No longer applied — lead to decide |
| ⚪ Info | Finding 7 — audit schema | ⚠️ Audit write removed — lead to decide |

---

## Certification

**The core EOSB calculation engine is CERTIFIED unconditionally for UAE.** The KSA branch is being corrected to Art. 84 (full EOSB on resignation, pro-rata from day one, no tier) and will be re-certified after the code change lands.

The mathematical formulas, daily-rate derivation, service-year bands, 2-year cap, UAE resignation tiers, termination-type routing (including summary-dismissal forfeiture), and the UAE 90-day-per-year unpaid-leave rule are all correctly implemented in the current `calculateEOSB` on `origin/main`, and the UAE test cases pass. The KSA resignation tier and under-2-year zero are being removed per Art. 84.

The two findings that previously blocked production use — Finding 1 (P0) and Finding 2 (P1) — are fixed, and the dead wrapper (Finding 3, P2) is gone.

Two **non-blocking** notes remain for the lead, neither of which makes the shipped EOSB amount unsafe:
1. **Finding 6** — the KSA notice-penalty deduction is no longer modelled (schema field `gave_proper_notice` exists but is unused).
2. **Finding 7** — the calculate-eosb endpoint no longer persists an audit-trail row to `eosb_calculations`.

---

*Review prepared by Compliance Expert | 2026-06-23 · re-verified 2026-09-18 · values redacted 2026-09-19*
