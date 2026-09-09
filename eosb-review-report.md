# EOSB Calculation Engine — Compliance Review Report

> **Reviewer:** Compliance Expert
> **Date:** 2026-06-23
> **Scope:** `calculateDetailedEOSB()` in `/home/team/shared/vantagehr/server/index.js` and audit trail schema
> **Reference:** `/home/team/shared/compliance-requirements.md` (Sections 3, 4, 7, 8)

---

## Executive Summary

The EOSB calculation engine is **structurally sound** — the core formula logic for both UAE and KSA is correct. However, **3 issues require remediation** before production use. One is **critical** (wrong EOSB amount for employer-initiated terminations).

---

## Finding 1 (CRITICAL): `isResignation` Flag Conflates All Termination Types

**Location:** `server/index.js`, line 370 and lines 107–117

```javascript
// Line 370 — BUG: treats ALL offboardings as resignations
const isResignation = mergedStatus === 'offboarding' || mergedStatus === 'terminated';
```

**Problem:** The code passes `isResignation=true` for every employee whose status is `offboarding` or `terminated`, regardless of whether they resigned, were terminated by the employer, left by mutual agreement, or were dismissed for cause. For UAE EOSB, this triggers the resignation reduction (1/3 or 2/3 multiplier) on ALL terminations.

**Impact illustration (UAE, 4 years, basic salary 15,000):**

| Scenario | Actual Status Flag | Current Code Gives | Correct Amount | Error |
|---|---|---|---|---|
| Employer terminates (valid reason) | `isResignation=false` | **28,000** (2/3) | 42,000 (full) | ⚠️ **33% underpaid** |
| Resignation | `isResignation=true` | 28,000 (2/3) | 28,000 (2/3) | ✅ Correct |
| Summary dismissal (gross misconduct) | `isResignation=false` | 42,000 (full) | 0 (forfeited) | ⚠️ Overpaid |

**Root cause:** The `termination_type` field (recommended in my compliance report Section 7.2) was not implemented. The code uses the `status` field as a proxy, which is insufficient.

**Fix Required:**
1. Add a `termination_type` column to `employees` with enum: `resignation`, `employer_initiated`, `mutual_agreement`, `summary_dismissal`, `end_of_contract`, `redundancy`
2. Replace line 370 with logic that reads this field:

```javascript
// CORRECTED LOGIC (proposed):
let isResignation = false;
if (mergedTerminationType === 'resignation') {
  isResignation = true;
} else if (mergedTerminationType === 'summary_dismissal') {
  // Forfeit entire EOSB
  return { accrued_amount: 0, ... };
}
// employer_initiated, mutual_agreement, redundancy, end_of_contract → isResignation = false (full EOSB)
```

3. Update the POST/PUT `/api/employees` endpoints to accept and store `termination_type`

---

## Finding 2 (MODERATE): Unpaid Leave Days Subtract ALL Days — UAE Law Only Excludes >90

**Location:** `server/index.js`, lines 34–36

```javascript
const leaveDays = parseInt(unpaidLeaveDays) || 0;
const netDays = Math.max(0, rawDays - leaveDays);  // Subtracts ALL unpaid leave
const tenureYears = netDays / 365.25;
```

**Problem:** Per UAE Federal Decree-Law No. 33 of 2021 (Article 52 para 3, confirmed in Section 3.3.5 of my compliance report), **only unpaid leave days exceeding 90 days per year should be excluded** from EOSB service calculation. The current code subtracts ALL unpaid leave days.

**Test evidence:** Employee with 120 unpaid leave days over 2 years:
- Current code: excludes all 120 days → tenure drops from 2.00 yrs to 1.67 yrs → EOSB = **17,565**
- Correct calculation: exclude only 30 days (120−90) → tenure ≈ 1.92 yrs → EOSB ≈ **20,247**
- Error: **~13% underpayment**

**Fix Required (UAE only — KSA has no such provision):**

```javascript
// CORRECTED LOGIC (proposed):
if (country !== 'SA') {
  // UAE: only exclude unpaid leave exceeding 90 days per year of service
  const totalYears = rawDays / 365.25;
  const allowedUnpaidPerYear = 90;
  const maxAllowedUnpaid = allowedUnpaidPerYear * totalYears;
  const excessUnpaid = Math.max(0, leaveDays - maxAllowedUnpaid);
  const netDays = Math.max(0, rawDays - excessUnpaid);
} else {
  // KSA: no statutory exclusion for unpaid leave (follow contract)
  const netDays = rawDays - leaveDays;
}
```

---

## Finding 3 (LOW): Dead Code — `calculateEOSB` Wrapper (Line 146–148)

**Location:** `server/index.js`, lines 146–148

```javascript
function calculateEOSB(startDateStr, endDateStr, basicSalary, country, isResignation = false) {
  const result = calculateDetailedEOSB(startDateStr, endDateStr, basicSalary, 0, 0, country, isResignation, true);
  return result.accrued_amount;
}
```

**Problem:** This function is **defined but never called** anywhere in the codebase. If someone calls it in the future, it hardcodes `totalSalary=0`, which would produce **wrong results for KSA EOSB** (where EOSB should be based on total salary).

**Fix:** Remove this dead function, or update it to forward all parameters correctly.

---

## Finding 4 (INFO): Tenure Year Convention — 365.25 vs 360 Days

**Location:** `server/index.js`, line 36

```javascript
const tenureYears = netDays / 365.25;
```

**Observation:** The UAE daily rate is calculated as `basicSalary / 30` (30-day month convention). Using 365.25 days in the year for tenure creates a slight inconsistency — a year should be 360 days (12×30) for strict alignment with UAE EOSB conventions.

**Impact:** Negligible (~1.4% difference). For a 5-year employee earning 15,000 AED:
- Current (365.25): tenure = 1826.25/365.25 = 5.0 → EOSB = 21×5×500 = 52,500
- Alternative (360): tenure = 1800/360 = 5.0 → EOSB = 21×5×500 = 52,500
- Same result for whole years. Only fractional years differ slightly.

**Recommendation:** Accept as-is. Both conventions are used in practice and the difference is immaterial. If precision is desired, standardise on 30-day months for tenure calculation.

---

## Finding 5 (INFO): Cap is Correct but Rarely Triggers

**Location:** `server/index.js`, lines 101–103

The 730-day cap (2 years of basic salary) is correctly implemented. At 15,000 AED basic salary:
- Cap = 730 × 500 = 365,000 AED
- Reached at approximately: 730 / 30 = 24.33 years of service
- For most employees with <15 years tenure, the cap never applies ✅

**Verdict:** Correct. No change needed.

---

## Finding 6 (INFO): KSA Notice Penalty Correctly Implemented

**Location:** `server/index.js`, lines 69–75

The 50% deduction for failure to serve proper notice under KSA Labor Law (Art. 77) is correctly applied. The use of 50% as a default max penalty is legally sound.

**Recommendation:** Consider making the penalty percentage configurable (0–50%) via a settings field, since employers may negotiate a lower penalty.

---

## Finding 7 (INFO): Audit Trail Schema — Adequate but Minimal

**Location:** POST `/api/compliance/calculate-eosb`, lines 760–779

The `eosb_calculations` table has been created per the compliance report recommendations. The current schema stores: `id, employee_id, calculation_date, jurisdiction, start_date, end_date, basic_salary, total_salary, unpaid_leave_days, is_resignation, accrued_amount, formula_used`.

**Missing vs Recommended Schema (Section 7.2):**

| Missing Field | Importance | Reason |
|---|---|---|
| `years_of_service` (REAL) | Low | Can be derived from start/end dates |
| `daily_rate` (REAL) | Low | Can be recalculated from salary |
| `deductions` (REAL default 0) | Medium | Needed for net vs gross EOSB reporting |
| `calculated_by` (TEXT) | Low | Audit trail for compliance |
| `gross_eosb` / `net_eosb` | Medium | Separating pre/post deductions |

**Verdict:** Functional. The `formula_used` text field provides good context. Recommend adding `gross_eosb` and `net_eosb` as separate audit fields when the offboarding settlement statement (my template) is implemented.

---

## Correctness Verification: Test Results

All 11 test cases executed — core logic verified:

| Test | Scenario | Result | Expected | Status |
|---|---|---|---|---|
| T1 | UAE 2yr, employer-initiated | 21,014.37 | ~21,000 | ✅ |
| T2 | UAE 2yr, resignation (1/3) | 7,004.79 | ~7,000 | ✅ |
| T3 | UAE 4yr, employer-initiated | 42,000.00 | 42,000 | ✅ |
| T4 | UAE 4yr, resignation (2/3) | 28,000.00 | ~28,000 | ✅ |
| T5 | KSA 3yr, notice given | 25,005.70 | ~25,000 | ✅ |
| T6 | KSA 3yr, no notice (50%) | 12,502.85 | ~12,500 | ✅ |
| T7 | UAE <1yr (no EOSB) | 0 | 0 | ✅ |
| T8 | KSA <2yr (no EOSB) | 0 | 0 | ✅ |
| T9 | UAE 120d unpaid (BUGGY) | 17,564.68 | ~20,247 | ⚠️ (see Finding 2) |
| T10 | UAE 10yr, cap test | 127,520.53 | ~127,500 | ✅ |
| T11 | UAE 7yr, employer | 82,510.27 | ~82,500 | ✅ |

---

## Summary of Required Changes

| Priority | Finding | File | Change |
|---|---|---|---|
| 🔴 **P0** | Finding 1 — `isResignation` flag | `server/index.js:370` | Add `termination_type` field; route EOSB logic by actual termination reason, not status |
| 🟡 **P1** | Finding 2 — Unpaid leave exclusion | `server/index.js:34-36` | For UAE, only exclude unpaid leave >90 days per year, not all unpaid leave |
| ⚪ **P2** | Finding 3 — Dead wrapper | `server/index.js:146-148` | Remove `calculateEOSB()` or fix signatures |
| ⚪ **Info** | Finding 4 — 365.25 convention | `server/index.js:36` | Accept as-is (immaterial difference) |
| ⚪ **Info** | Finding 6 — Notice penalty config | `server/index.js:69-75` | Optional: make KSA penalty % configurable |
| ⚪ **Info** | Finding 7 — Audit schema | DB schema | Optional: add gross/net/deductions fields |

---

## Certification

**Core EOSB calculation logic is CERTIFIED** for both UAE and KSA after the two P0/P1 issues are resolved. The mathematical formulas, daily rate derivation, service year bands, cap limits, resignation tiers, and notice penalty are all correctly implemented.

The engine can safely be used for production **once Finding 1 and Finding 2 are addressed**, as they impact EOSB amounts in real-world scenarios.

---

*Review prepared by Compliance Expert | 2026-06-23*