# Antum People — 10-Minute Pilot-Customer Demo Walkthrough Script

> **Audience:** Mid-market GCC CHRO / CFO / Head of People Ops (100–1,000 employees)
> **Goal:** Move the prospect from "compliance admin tool" to "strategic intelligence tier" — and land the 3-anchor free-pilot conversation.
> **Total runtime:** 10 minutes (4 segments + close). Timings are targets, not walls.
> **Presenter:** Founder-led (Ahmad's HR network) — technical detail available, but lead with outcomes.

---

## Before you start — 30-second prep checklist

- [ ] **Confirm the live app loads** at https://b974147c03228029e277d1cbe6646fe6.ctonew.app — the site is currently being restored by the engineer; if it doesn't load, flag it and do not start the call.
- [ ] **Log in** with the demo account — **username `admin`**. Get the password from the engineer (it's the `ADMIN_INITIAL_PASSWORD` value; never write a password into this file).
- [ ] Confirm the app is showing **seeded demo data** (UAE + KSA employees, one active onboarding, one active offboarding).
- [ ] Have two tabs ready to hot-switch: the **live app** (https://b974147c03228029e277d1cbe6646fe6.ctonew.app) and the **bilingual prototype** (`design-concepts/intelligence-dashboard-prototype.html`).
- [ ] PDFs printed or open in a viewer: `templates/privacy-notice.pdf`, `templates/data-processing-agreement.pdf`, `templates/dpia-questionnaire.pdf`.
- [ ] Know your honest caveats (see *Caveats & guardrails* at the end) — you will be asked.
- [ ] Pre-select one **UAE example** and one **KSA example** employee for the EOSB side-by-side.

### What's live vs. what's a design prototype (know this cold)

| Surface | Status | File/screen |
|---|---|---|
| Executive Dashboard, Employee Directory, Transitions Hub, Strategic Intelligence | **Live build** | https://b974147c03228029e277d1cbe6646fe6.ctonew.app (after login) |
| Onboarding/offboarding checklists (UAE & KSA) | **Live logic** | `server/compliance_engine.js` (`checklistTemplates`) |
| EOSB engine (UAE basic-salary vs KSA total-salary) | **Live logic** | `server/index.js` (`calculateEOSB`) |
| Consent capture, compliance report, template render | **Live endpoints** | `/api/compliance/consent`, `/report`, `/templates/:name/:id` |
| Compliance dashboard (DSR, breach register, consent audit) | **Design spec** | `design-concepts/COMPLIANCE-AUDIT-UI.md` + `COMPLIANCE-UI.md` |
| Bilingual EN/AR RTL dashboard | **Interactive prototype** | `design-concepts/intelligence-dashboard-prototype.html` |

---

# Segment 1 — Onboarding, jurisdiction-aware (0:00 – 2:30)

**Goal:** Show that onboarding is *one flow* that adapts to UAE vs KSA law, and that consent is captured as data — not a PDF afterthought.

### Click path
1. Sidebar → **Transitions Hub** (`activeTab === 'transitions'`).
2. Point at **"Ramping Employees (Onboarding)"** card.
3. Click an onboarding employee (e.g. "Omar Hassan") → lands in **Employee Directory** detail.
4. Open the **onboarding checklist** (`GET /api/employees/:id/onboarding`).
5. Toggle the **jurisdiction** and show the checklist re-renders (UAE list vs KSA list).
6. Scroll to the last task: **"Privacy Notice Consent"** → click **Capture Consent** (`POST /api/compliance/consent`).

### What the customer sees
- UAE checklist: *MoHRE Contract Signing → Entry Permit → Medical Fitness → Emirates ID Biometrics → Residence Visa Stamping → WPS Registration → Privacy Notice Consent.*
- KSA checklist: *Qiwa Job Offer Acceptance → Qiwa Employment Contract → Medical Exam → Iqama Issuance → GOSI Registration → Mudad Enrollment → Privacy Notice Consent (Arabic first).*
- Consent step records a row with lawful basis + version (v2.0), not just a checkbox.

### Speaker notes
> "Every market has a checklist. The difference is ours are wired to the *right* regulator — MoHRE and WPS here, Qiwa and Mudad there. A new hire in Riyadh should never see a Dubai visa step. And notice the last item on both lists: consent isn't a form you chase later, it's captured in-flow, tagged to the privacy-notice version. That's what makes an audit trivial instead of a fire drill."

### Anticipated questions
**Q: "Does it actually connect to Qiwa/MoHRE, or do we tick boxes manually?"**
A: Today the checklist is the system of record that your HR team drives; it encodes the *sequence and compliance rules* of each regulator. Direct Qiwa/MoHRE API integration is on the roadmap — during the pilot we'd map your current manual steps so nothing is double-keyed.

**Q: "What if we hire someone on a different visa type?"**
A: The engine branches on jurisdiction + transition type, so adding a visa category is a template change, not a code change — that's exactly the kind of customization the pilot is designed to capture.

**Q: "How do we prove consent was captured if there's a dispute?"**
A: Every consent write creates an immutable `consent_records` row (who, when, which version, lawful basis). It's the same ledger the compliance dashboard audits — we'll show it in a few minutes.

---

# Segment 2 — EOSB calculator, UAE vs KSA (2:30 – 5:00)

**Goal:** Prove the two GCC EOSB regimes are handled *correctly* (not "close enough"), with a full gross/net breakdown and an audit trail.

### Click path
1. From **Employee Directory**, open a **UAE** employee → **Calculate EOSB** (`POST /api/compliance/calculate-eosb`).
2. Note the basis: **Basic Salary** — with tiered resignation discount.
3. Open a **KSA** employee → **Calculate EOSB** again.
4. Note the basis: **Total Salary (incl. allowances)** — with tiered resignation reduction (as implemented in `calculateEOSB`).
5. Show the **gross → deductions → net** breakdown.
6. Point at the **formula used** field + the audit trail (the calculation is logged, not a black box).

### What the customer sees
- UAE: 21 days/yr for first 5 years, 30 days/yr after; resignation discounts ⅓ (1–3 yr) and ⅔ (3–5 yr); capped at 2 years' basic salary.
- KSA: half-month/yr for first 5 years, full month after; resignation discounts ⅓ (2–5 yr) and ⅔ (5–10 yr); min 2 years' service.
- Both: `gross_amount`, `deductions`, `net_amount`, and `formula_used` rendered from `eosb_calculations`.

### Speaker notes
> "EOSB is where a wrong assumption costs real money. In the UAE you accrue on *basic* salary; in Saudi you accrue on *total* salary including allowances. Get that backwards and you're over- or under-provisioning across hundreds of employees. Watch what happens when I switch the jurisdiction — same employee data, materially different number. And it's not a black box: we show the formula and the gross/net breakdown, and every calculation is written to the audit ledger so finance can review it before it's ever paid."

### Anticipated questions
**Q: "How often is the formula updated when labor law changes?"**
A: The rules live in one place — `calculateEOSB` and the compliance engine — and our compliance lead reviews them against current UAE/KSA law. In the pilot we'd sign off on your specific contract types and edge cases.

**Q: "What about notice periods and unpaid leave?"**
A: Both are tracked — notice periods feed the EOSB effective date, and UAE's >90-day unpaid-leave exclusion is modeled. (Note: per our compliance spec, KSA's notice-shortfall deduction of up to 50% is a documented rule — confirm with the engineer whether your build enforces it before promising it live.) We'll validate those against your actual cases during the pilot.

**Q: "Can we see the liability *before* someone leaves?"**
A: Yes — the strategic view rolls up every employee's accrued EOSB into a single liability figure, which is the cash-flow conversation you should be having before terminations, not after. *(Bridge into Segment 4/close.)*

> ⚠️ **Caveat to hold:** the *quarterly forecast* is a projection using growth multipliers. Do not quote forecast numbers as committed figures — tell the customer "finance should review these assumptions before they're used in a budget." See *Caveats*.

---

# Segment 3 — Compliance dashboard (5:00 – 7:30)

**Goal:** Show compliance is *visible and auditable*, not a binder in a drawer — DSR SLAs, breach timing, consent coverage.

### Click path
1. Open the **compliance module** (designed in `design-concepts/COMPLIANCE-AUDIT-UI.md`; backed by `/api/compliance/report` + `consent_records`).
2. **Consent Audit Trail** — show coverage summary (active / pending / revoked) and a filterable ledger.
3. **DSR Management** — open a sample Data Subject Request and point at the **30-day SLA** bar and the "overdue" flag.
4. **Breach Register** — show the **72-hour regulator-notification timer** and the "new breach" flow.
5. **Vendor/EOSB audit** — reference the DPA + DPIA artifacts that back this view.

### What the customer sees
- Consent coverage % (`/api/compliance/report` → `consentGranted/total`).
- DSR list with type icons (Access / Erasure / Rectification / Portability / Restriction / Objection) and SLA state.
- Breach register with countdown + notification actions.
- The audit trail that ties each record to a timestamp and actor.

### Speaker notes
> "This is the part your DPO cares about and your CFO quietly dreads. A data subject request has a 30-day clock in both markets — miss it and you're exposed. A breach has a 72-hour notification window. This screen tells you *today* what's overdue, what's about to be, and whether your consent coverage is where PDPL needs it to be. And underneath every number is a timestamped audit trail — which is what the regulator will ask for first."

### Anticipated questions
**Q: "Which PDPL does this follow — UAE or KSA?"**
A: Both, jurisdiction-aware — UAE PDPL and KSA PDPL have different defaults (e.g. Arabic-first consent in KSA). The engine branches on the employee's jurisdiction, same as onboarding and EOSB.

**Q: "What happens at the 30-day / 72-hour deadline?"**
A: The UI surfaces escalating urgency states and the workflow enforces the required actions (identity verification, legal-hold check, regulator notification). The pilot's Compliance Accuracy KPI is measured against exactly these deadlines.

**Q: "Is the DPA/DPIA included or is that separate?"**
A: Included as part of the pilot pack — we'll hand you the DPA and DPIA templates in Segment 4. The templates need your counsel's sign-off before they're final.

---

# Segment 4 — Bilingual output & the pilot pack (7:30 – 9:30)

**Goal:** Show EN/AR is a *first-class* experience (RTL, Arabic-Indic numerals, localized documents) — and hand over the physical artifacts.

### Click path
1. Open the **bilingual dashboard** (`design-concepts/intelligence-dashboard-prototype.html`).
2. Click the **EN | العربية** toggle in the header.
3. Watch the layout mirror to **RTL** — sidebar flips right, text right-aligns, charts reverse.
4. Point at a KPI value: **"AED 6.3M"** becomes **"٦٫٣ مليون د.إ"** (Arabic-Indic numerals + currency reflow).
5. Show the rendered documents (already on screen): **privacy notice v2.0** (bilingual), **DPA**, **DPIA questionnaire**, plus the UAE/KSA contracts and settlement statement.

### What the customer sees
- Full RTL mirroring: sidebar, text alignment, icon order, chart axis direction.
- Arabic-Indic numerals + Arabic currency symbols (د.إ / ر.س).
- Bilingual `privacy-notice.md` (v2.0, 2026-09), `data-processing-agreement`, `dpia-questionnaire`, `uae-employment-contract`, `ksa-employment-contract`, `final-settlement-statement`.

### Speaker notes
> "A lot of regional tools treat Arabic as a translation layer bolted on at the end. We don't. The same dashboard flips to right-to-left, the numbers become Arabic-Indic, the currency moves to the right place — because your Arabic-speaking workforce and your English-speaking leadership see the *same data* in their *own* language. And here's the pilot pack: bilingual privacy notice v2.0, the DPA, the DPIA questionnaire, and the UAE and KSA contract templates — ready for your counsel to review."

### Anticipated questions
**Q: "Is the Arabic actually correct, or machine-translated?"**
A: The core compliance documents are professionally drafted bilingual templates (v2.0). UI strings are a maintained localization dictionary, not on-the-fly translation.

**Q: "Can we default KSA users to Arabic and UAE users to English?"**
A: Yes — language default is per-tenant/per-user, and KSA can be Arabic-first (which is also the PDPL expectation).

**Q: "Are these documents legally binding as-is?"**
A: They're pilot-ready drafts built from current UAE/KSA requirements — **your counsel must sign off** before they go into production. We're not substituting for legal review. *(This is a required honest caveat.)*

---

# Close — the pilot offer (9:30 – 10:00)

### Speaker notes
> "Here's the offer. We're running **three free anchor pilots** — full access, no cost — in exchange for three things: your feedback, a testimonial, and case-study rights. Success is measured on three KPIs we both agree on up front: **Retention Lift**, **Time-to-Value**, and **Compliance Accuracy**. If we move those numbers for you, we convert to the paid Intelligence Tier at renewal. Worst case, you've tightened your compliance for free. Best case, you've turned onboarding and offboarding into a leadership tool."

### The three KPIs (say these explicitly)
1. **Retention Lift** — % increase in 1-year retention.
2. **Time-to-Value** — days until a new hire is fully productive (visa + onboarding milestones).
3. **Compliance Accuracy** — % of offboarding cases with correct EOSB and privacy-compliant handling.

### Anticipated close question
**Q: "What do we need to commit to start?"**
A: A named HR lead, access to your current onboarding/offboarding process for one or two roles per jurisdiction, and a 30–60 minute working session. We'll bring the config; you bring the edge cases.

---

# Caveats & guardrails (read before every demo)

1. **EOSB quarterly forecast uses growth multipliers.** The projected quarterly liability is an *estimate*, not a committed figure. Say: "finance should review these assumptions before they're used in any budget." Never present a forecast number as a guarantee.
2. **Legal documents need counsel sign-off.** The privacy notice, DPA, DPIA, and contract templates are pilot-ready drafts. Do not imply they are "approved" or "binding" — explicitly tell the customer their counsel must review.
3. **Strategic Intelligence is descriptive today.** The live analytics endpoint surfaces `attritionRate`, `avgCostPerHire`, and total `eosbLiability`. The cohort-level *Retention Lift* and *Time-to-Value* trend views are the pilot success metrics and are presented as the design vision (`INTELLIGENCE-DASHBOARD-UI.md`) — not yet a live predictive engine. Frame them as "what we'll measure together in the pilot," not "what the dashboard already computes."
4. **Compliance dashboard is design-spec-backed.** The DSR/breach/consent-audit screens are specified in `COMPLIANCE-AUDIT-UI.md` and backed by live endpoints (`/api/compliance/*`), but the polished UI is shown via the design prototype. Be clear about which screen is the live build vs. the design concept.
5. **Regulator integrations are roadmap, not live.** MoHRE/Qiwa/WPS/Mudad are encoded as workflow *steps*; direct API push to those systems is roadmap. Don't overclaim integration.

---

## Appendix — file & screen reference map

| In the script | Real reference |
|---|---|
| Transitions Hub (onboarding/offboarding) | https://b974147c03228029e277d1cbe6646fe6.ctonew.app → sidebar **Transitions Hub** |
| Onboarding/offboarding checklists | `server/compliance_engine.js` → `checklistTemplates` (UAE / KSA) |
| EOSB engine | `server/index.js` → `calculateEOSB`; `POST /api/compliance/calculate-eosb` |
| Consent capture | `POST /api/compliance/consent` → `consent_records` |
| Compliance report / consent coverage | `GET /api/compliance/report` |
| Compliance dashboard (DSR/breach/consent) | `design-concepts/COMPLIANCE-AUDIT-UI.md`, `COMPLIANCE-UI.md` |
| Bilingual dashboard (EN/AR RTL) | `design-concepts/intelligence-dashboard-prototype.html`, `INTELLIGENCE-DASHBOARD-UI.md` |
| Privacy notice v2.0 (bilingual) | `templates/privacy-notice.md` (v2.0, 2026-09) + `.pdf` |
| DPA / DPIA / contracts / settlement | `templates/data-processing-agreement.*`, `dpia-questionnaire.*`, `uae-employment-contract.md`, `ksa-employment-contract.md`, `final-settlement-statement.md` |
| Brand system | `design-concepts/BRAND-IDENTITY.md` (deep teal `#0F766E`) |

---

*Prepared by Product Designer, Antum — pilot-ready demo script v1.0.*
