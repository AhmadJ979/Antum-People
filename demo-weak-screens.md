# Antum People — Demo Weak-Screen Audit

> **Prepared by:** Product Designer, 2026-09-27
> **How verified:** walked live on a local instance (scratch port, scratch database seeded from current `main` 982f1e6, own temporary admin credential) — seen on the running app, not inferred from code. All figures are the seeded *sample* dataset, not a real client's data.
> **Purpose:** the blunt list. If a prospect clicks into a screen that is empty, redacted, placeholder-stuffed, or contradicts another screen, that screen is named here.

---

## The screens that will embarrass us, ranked by how badly

### 1. Final Settlement Statement — an unfilled template with a zero that contradicts the roster
- **Screen:** Employee Directory → Sarah Al-Qasimi → Compliance Center → **Settlement Statement** (document preview).
- **What a prospect sees:** a bilingual settlement document where every money field is a literal placeholder — `[employee_id]`, `[End Date]`, `[Termination Reason]`, `[final_pro_rated_salary]`, `[unused_leave_amount]`, `[notice_pay]`, and each deduction is `[loan_deduction]` / `[assets_deduction]` / `[fine_deduction]`. Then:
  - **EOSB: 0.00**, **Gross Total: 0.00**, **NET PAYABLE: 0.00**.
- **Verdict:** Broken. The roster on the same page shows Sarah's accrued EOSB as a non-zero SAR figure, and this document says 0.00. One click undoes the whole "we calculate settlements correctly" story. **Do not open this in a demo.**

### 2. Compliance Center prints the literal word "null"
- **Screen:** Employee Directory → any employee → **Compliance Center → Privacy Consent (PDPL)**.
- **What a prospect sees:** `✓ GRANTED ON null`.
- **Verdict:** Broken. We claim consent is "captured in-flow," and the panel that's supposed to prove it renders a programming artifact. A non-technical HR buyer reads this as "the consent feature doesn't work."

### 3. The seeded offboarding checklist is not the KSA checklist — and offboarding is our headline view
- **Screen:** Employee Directory → Sarah Al-Qasimi → **Offboarding Checklist**.
- **What a prospect sees:** four generic tasks — *Hardware Return, Access Revocation, Final Settlement Calculation, Visa Cancellation (KSA)*.
- **What the engine actually generates for a KSA offboarding** (in `server/compliance_engine.js`): *Notice Period Verification, EOSB Calculation (KSA), GOSI De-registration, Exit/Final-Exit Visa, Iqama Cancellation/Transfer, Service Certificate Issuance*.
- **Verdict:** The demo's most important view — the one we now lead with — is showing a shorter, hand-written stand-in that omits the exact KSA steps (GOSI, Iqama) a Saudi buyer asks about. If they know the process, they'll notice the gaps. Either seed the real KSA template or pre-empt it verbally (Caveat 4 in the script).

### 4. Retention Lift shows 100% retention for every cohort
- **Screen:** Strategic Intelligence → **Retention Lift — 1-Yr Cohort**.
- **What a prospect sees:** every cohort (H1 2022 through H1 2026) at `100% (Cohort)` against an "Illustrative" 81–84% benchmark, producing "+16% to +19%" lifts.
- **Verdict:** Fake-looking. The sample has no terminated employees, so retention is trivially 100%, and the "lift" is 100% minus a made-up benchmark. A CHRO/CFO will immediately know 100% retention never happens and will discount the rest of the numbers.

### 5. EOSB Liability card shows raw decimals
- **Screen:** Executive Dashboard → **EOSB Liability** card.
- **What a prospect sees:** `AE 57,249.2 AED` / `SA 85,475.12 SAR` — one decimal on one line, two on the other.
- **Verdict:** Unpolished. Money should never show floating-point residue. It reads as raw database output. (The same figures are cleanly rounded to whole numbers inside Strategic Intelligence, so the two surfaces disagree.)

### 6. Departing employee shows "EXIT" with no date
- **Screen:** Transitions Hub → **Departing Employees (Offboarding)**.
- **What a prospect sees:** `Sarah Al-Qasimi — EXIT` followed by nothing (her end date is empty, so the label renders blank).
- **Verdict:** Unfinished. A leaving employee with no exit date looks like the system dropped a field. The Executive Dashboard shows "Exit Pending" for the same person — two different empty states for one record.

### 7. Document-preview header claims "Legally Validated GCC Template"
- **Screen:** any document preview modal, subtitle.
- **What a prospect sees:** `Legally Validated GCC Template` above a settlement statement that (item 1) is full of placeholders and zeros.
- **Verdict:** A legal over-claim we can't back. Our own guardrails say every template is a pilot-ready draft the client's counsel must sign off. A careful buyer or their lawyer will challenge this label, and it contradicts what we tell them out loud.

### 8. Every KPI is tagged "Illustrative" / "Illustrative Benchmark" / "Illustrative Total"
- **Screen:** Executive Dashboard — all four cards.
- **What a prospect sees:** Retention Lift (`Illustrative Benchmark`), Time-to-Value (`Illustrative`), Cost-per-Hire (`Illustrative Benchmark`), EOSB Liability (`Illustrative Total`).
- **Verdict:** Misleading in the wrong direction. EOSB and Cost-per-Hire are actually *computed* from the roster, not invented — labelling them "Illustrative" undersells real functionality and reads as "everything on this page is fake."

### 9. Onboarding Pipeline card shows one person, but the data holds 5 tasks across 2 hires
- **Screen:** Executive Dashboard → **Onboarding Pipeline** (and Transitions Hub → Ramping).
- **What a prospect sees:** only **Omar Al-Farsi**. The five seeded onboarding tasks (Omar 3, Ahmad 2) aren't visible here — Ahmad is `active`, so he's filtered out even though two onboarding tasks are attached to him.
- **Verdict:** Internally inconsistent. Anyone told "5 tasks across 2 recent hires" will look at the card and see 1 person.

### 10. Exit-interview data is captured but never shown
- **Screen:** nowhere in the UI.
- **What a prospect sees:** nothing — the seeded exit interview (departure reason, satisfaction score) exists in the database but there is no exit-intelligence view; the `exitsByReason` field the API returns is never rendered.
- **Verdict:** A headline KPI (retention insight) with zero visible backing. The "Exit Intelligence Intake" form collects departure reason, preventable-attrition flag, and offered salary, then discards them from view.

### 11. "Day 193" onboarding for a "recent hire"
- **Screen:** Transitions Hub → Ramping Employees.
- **What a prospect sees:** `Omar Al-Farsi — Day 193`.
- **Verdict:** Distracting. Nobody ramps for 193 days; it invites "why is this person still onboarding?" and pulls focus from the flow.

### 12. Gratuity Accrued column shows inconsistent decimals
- **Screen:** Employee Directory table.
- **What a prospect sees:** `AED 7,595.4`, `SAR 3,933.97`, `AED 6,306.87`, `SAR 30,486.68`, `AED 36,321.77` — one or two decimals varying per row.
- **Verdict:** Same raw-database feel as item 5. Round/group currency everywhere.

### 13. Header permanently shows a "SAMPLE DEMO DATA" badge
- **Screen:** every screen, top header.
- **What a prospect sees:** an amber `SAMPLE DEMO DATA` badge next to the product name on every view.
- **Verdict:** A constant reminder that nothing they're looking at is real. Fine to keep — but own it out loud rather than let it hang unremarked.

### 14. "Forgot Password?" is a dead end
- **Screen:** sign-in page.
- **What a prospect sees:** clicking it opens an alert "Please contact IT support for password recovery." There is no recovery flow.
- **Verdict:** Broken affordance on the first screen.

### 15. Settlement statement is generic, not jurisdiction-specific
- **Screen:** Settlement Statement document (see item 1).
- **What a prospect sees:** `Jurisdiction: UAE / KSA` and `Employer Name: Antum Regional Hub` for a KSA employee, plus a hard-coded `Date: 28 September 2026`.
- **Verdict:** Doesn't adapt to the employee or the client; compounds item 1.

---

## If we only fix three things before the next demo

1. **Wire the Settlement Statement** (item 1) — or keep it off the click path and show Privacy Notice + Labor Contract.
2. **Fix `GRANTED ON null`** (item 2) — one-line cosmetic, but it's the first thing the Compliance Center shows.
3. **Seed the real KSA offboarding checklist** (item 3) — offboarding is now our opening act; it shouldn't be a generic stand-in that omits GOSI and Iqama.
