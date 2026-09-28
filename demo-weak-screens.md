# Antum People — Demo Weak-Screen Audit

> **Prepared by:** Product Designer, 2026-09-27
> **Scope:** Every screen a prospect would actually click, walked live on a local instance (scratch port, own scratch database seeded from current `main` 982f1e6, own temporary admin credential). Not read from code — seen on the running app.
> **What this is:** the list of things that would undercut us in front of a prospect. Severity = how much it hurts a sales conversation, not how hard it is to fix.
> All figures below are the seeded *sample* dataset, not a real client's data.

---

## CRITICAL — would contradict our own story or show us as unfinished

### 1. Final Settlement Statement renders as an unfilled template (EOSB shows 0.00)
- **Screen:** Employee Directory → Sarah Al-Qasimi (offboarding) → Compliance Center → **Settlement Statement** (document preview).
- **What a prospect sees:** A bilingual settlement document where the money section is literal placeholders and zeros:
  - `Employee ID [employee_id]`, `Last Working Day [End Date]`, `Reason for Termination [Termination Reason]`
  - `Monthly Salary (Pro-rated) [final_pro_rated_salary]`, `Notice Period Pay [notice_pay]`, and every deduction line is a `[bracket]` placeholder
  - **EOSB = 0.00**, **Gross Total = 0.00**, **NET PAYABLE AMOUNT: 0.00**
  - The acknowledgment line is still `holder of [national_id]`
- **How bad:** This is the worst one. The roster on the very same page shows Sarah's accrued EOSB as **SAR 19,793.66**, but the "Final Settlement" document says **0.00**. A CFO who clicks "Settlement Statement" to see the thing we claim computes settlements correctly instead sees a blank template that contradicts the number next to it. If we show the EOSB engine in the same demo, this single click undoes it. Do not click this document in a demo until it is wired to real per-employee settlement figures.

### 2. Compliance Center shows the literal word "null" — "✓ GRANTED ON null"
- **Screen:** Employee Directory → any employee → **Compliance Center → Privacy Consent (PDPL)**.
- **What a prospect sees:** `✓ GRANTED ON null` (the consent date column is empty for every seeded employee, so the UI prints the word "null").
- **How bad:** High. We open the demo claiming consent is "captured in-flow, tagged to version v2.0," and the panel that is supposed to prove it literally renders a programming artifact. It reads as a broken feature to a non-technical HR buyer.

### 3. Retention Lift chart shows 100% retention for every cohort
- **Screen:** Strategic Intelligence → **Retention Lift — 1-Yr Cohort**.
- **What a prospect sees:** Every cohort (H1 2022 through H1 2026) shows **100% (Cohort)** against an "Illustrative" benchmark of 81–84%, producing "+16% to +19%" lifts.
- **How bad:** High. 100% one-year retention for *every* cohort is obviously not real (the seed has no terminated employees, so retention is trivially 100%). The "lift" numbers are therefore 100% minus a made-up benchmark — noise dressed as insight. If the buyer is a CHRO/CFO, they will immediately spot that 100% retention never happens, and it calls every other number into question.

---

## HIGH — looks unfinished or unpolished

### 4. EOSB Liability card shows raw decimals
- **Screen:** Executive Dashboard → **EOSB Liability** card.
- **What a prospect sees:** `AE 57,249.2 AED` / `SA 85,475.12 SAR`. Two jurisdictions with different decimal precision (one decimal vs. two), on a headline money figure.
- **How bad:** Medium-high. Money should never show floating-point residue. It reads as "the numbers are raw database output, not curated," which undermines the "intelligence platform" positioning. (The same figures appear cleanly rounded as 57,249 / 85,475 inside Strategic Intelligence, so the two surfaces disagree.)

### 5. Departing Employees row shows "EXIT" with no date
- **Screen:** Transitions Hub → **Departing Employees (Offboarding)**.
- **What a prospect sees:** `Sarah Al-Qasimi — EXIT` followed by nothing (her end date is empty, so the label renders blank).
- **How bad:** Medium-high. A leaving employee with no exit date looks like the system lost a field. Also contrasts with the Executive Dashboard card which shows "Exit Pending" for the same person — two different empty states for one record.

### 6. Document preview is labelled "Legally Validated GCC Template"
- **Screen:** Any document preview modal header.
- **What a prospect sees:** The subtitle `Legally Validated GCC Template` above a settlement statement that (per item 1) is full of placeholders and zeros.
- **How bad:** High risk. "Legally Validated" is a legal claim we cannot make — our own guardrails say every template is a pilot-ready draft that the client's counsel must sign off. A careful buyer (or their lawyer) will challenge this, and it directly contradicts the honest caveat we tell them out loud. This label should say "Pilot-ready draft — subject to your counsel's review."

### 7. Every KPI is tagged "Illustrative" / "Illustrative Benchmark" / "Illustrative Total"
- **Screen:** Executive Dashboard — all four cards.
- **What a prospect sees:** Retention Lift (`Illustrative Benchmark`), Time-to-Value (`Illustrative`, `target: 15 days`), Cost-per-Hire (`Illustrative Benchmark`), EOSB Liability (`Illustrative Total`).
- **How bad:** Medium. The labels are honest, but they're inconsistent with the data: EOSB liability and Cost-per-Hire are actually *computed* from the roster, not invented — labelling them "Illustrative" undersells real functionality and reads as "everything on this page is fake." The presenter must have a crisp sentence ready (see the walkthrough script), otherwise the buyer silently discounts every number.

---

## MEDIUM — misleading or internally inconsistent

### 8. Onboarding Pipeline card shows one person, but the data holds "5 tasks across 2 hires"
- **Screen:** Executive Dashboard → **Onboarding Pipeline** (and Transitions Hub → Ramping).
- **What a prospect sees:** Only **Omar Al-Farsi** in the ramping list. The five seeded onboarding tasks (Omar 3, Ahmad 2) are not visible here — Ahmad is `active`, so he doesn't appear in the "onboarding" filter even though two onboarding tasks are attached to him.
- **How bad:** Medium. Anyone told "the onboarding pipeline has 5 tasks across 2 recent hires" will look at the card and see 1 person. The tasks only surface when you open each employee in the Directory. Either adjust the presenter script (recommended) or fix the pipeline query.

### 9. Exit-interview data is captured but never shown anywhere
- **Screen:** Nowhere in the UI.
- **What a prospect sees:** Nothing — the seeded exit interview (departure reason "Better Opportunity", satisfaction 4/5) exists in the database but there is no exit-intelligence view, no "why are people leaving" chart, and the `exitsByReason` field the API returns is never rendered.
- **How bad:** Medium. Retention insight is a headline KPI of the Intelligence Tier, but the only exit record in the demo is invisible. The "Exit Intelligence Intake" form collects departure reason, preventable-attrition flag, and offered salary — then discards them from view.

### 10. "Day 193" onboarding for a "recent hire"
- **Screen:** Transitions Hub → Ramping Employees.
- **What a prospect sees:** `Omar Al-Farsi — Day 193`.
- **How bad:** Low-medium. Omar's start date (2026-03-20) makes him ~6 months into onboarding. Nobody ramps for 193 days. It invites the obvious question "why is this person still onboarding?" and distracts from the flow.

### 11. Gratuity Accrued column shows inconsistent decimals
- **Screen:** Employee Directory table.
- **What a prospect sees:** `AED 7,595.4`, `SAR 3,933.97`, `AED 6,306.87`, `SAR 30,486.68`, `AED 36,321.77` — one or two decimals, varying per row, plus `AED 0` for the new hire.
- **How bad:** Low-medium. Same "raw database" feel as item 4. Should be rounded/grouped currency everywhere.

### 12. Header permanently shows a "SAMPLE DEMO DATA" badge
- **Screen:** Every screen, top header.
- **What a prospect sees:** An amber `SAMPLE DEMO DATA` badge next to the product name on every single view.
- **How bad:** Low-medium. Honest, and arguably correct for a demo, but it's a constant reminder that nothing they're looking at is a real client's production data. Fine to keep — but the presenter should own it deliberately rather than let it hang there unremarked.

---

## LOW — cosmetic but worth knowing before a prospect points it out

### 13. "Forgot Password?" is a dead end
- **Screen:** Sign-in page.
- **What a prospect sees:** Clicking "Forgot Password?" opens an alert: "Please contact IT support for password recovery." There is no recovery flow.
- **How bad:** Low (prospects rarely click it), but it's a broken affordance on the very first screen.

### 14. Settlement statement is generic, not jurisdiction-specific
- **Screen:** Settlement Statement document (see item 1).
- **What a prospect sees:** `Jurisdiction: UAE / KSA` and `Employer Name: Antum Regional Hub` for a KSA employee — the document doesn't adapt to the employee's jurisdiction or the client's entity, and the footer shows a hard-coded `Date: 28 September 2026`.
- **How bad:** Low on its own, but it compounds item 1.

---

## Summary (what to fix before the demo, in order)

1. **Do not open the Settlement Statement** in a live demo until it renders real per-employee figures (item 1) — or swap it for the Privacy Notice and Labor Contract, which render content.
2. Fix the `GRANTED ON null` consent-date bug (item 2) — cosmetic, one-line, but it's the first thing the Compliance Center shows.
3. Either fix the 100%-retention cohorts (item 3) or pre-empt it verbally with the line in the walkthrough script.
4. Round currency and align the two EOSB surfaces (items 4, 11).
5. Change "Legally Validated GCC Template" to a pilot-ready-draft label (item 6).
6. Give the presenter explicit spoken lines for every "Illustrative"/"Sample Demo Data" label (item 7, 12) — the script now has them.
