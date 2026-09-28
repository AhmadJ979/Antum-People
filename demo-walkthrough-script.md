# Antum People — 10-Minute Pilot-Customer Demo Walkthrough Script

> **Audience:** Mid-market GCC CHRO / CFO / Head of People Ops (100–1,000 employees)
> **Goal:** Move the prospect from "compliance admin tool" to "strategic intelligence tier" — and land the 3-anchor free-pilot conversation.
> **Total runtime:** 10 minutes (4 segments + close). Timings are targets, not walls.
> **Presenter:** Founder-led (Ahmad's HR network) — technical detail available, but lead with outcomes.

> ⚠️ **Verification status — internal (for the presenter, not read aloud).** Re-walked end-to-end by the Product Designer on 2026-09-27 against a local instance of current `main` (982f1e6), seeded with the standard demo dataset. Sign-in works. The four tabs are: **Executive Dashboard → Employee Directory → Transitions Hub → Strategic Intelligence**. The demo now shows **9 employees (5 UAE + 4 KSA)** and — the big one — a **populated offboarding pipeline**: the departing KSA employee has a 4-task offboarding checklist where it used to be empty. That view is now the opening act of this demo, because it's the one a KSA buyer weighs most heavily (EOSB, final settlement, visa/Iqama cancellation).
>
> **This script matches what the screen actually shows today.** If anything looks different on the call, follow *Caveats & guardrails* rather than improvising numbers.

---

## Before you start — 30-second prep checklist

- [ ] **Confirm the live app loads** at https://b974147c03228029e277d1cbe6646fe6.ctonew.app before the call (200, renders the sign-in screen).
- [ ] **Sign in** at https://b974147c03228029e277d1cbe6646fe6.ctonew.app — demo account **`admin`**, password **supplied separately by Ahmad**. Do a test login ahead of the call; **never write the password into this file.**
- [ ] Confirm the app shows **seeded sample data** (9 employees, UAE + KSA, one active onboarding and one active offboarding case). The header carries an amber **"Sample Demo Data"** badge — expected; you'll own it in Segment 3.
- [ ] Have two tabs ready: the **live app** and the **bilingual prototype** (`design-concepts/intelligence-dashboard-prototype.html`).
- [ ] PDFs printed or open: `templates/privacy-notice.pdf`, `templates/data-processing-agreement.pdf`, `templates/dpia-questionnaire.pdf`.
- [ ] Know your honest caveats (see *Caveats & guardrails*) — you will be asked.
- [ ] **Memorize the "don't click" list:** do not open the **Settlement Statement** document preview in a live demo (Caveat 6) — it is still an unfilled template with a zero EOSB line. Show **Privacy Notice** and **Labor Contract** for document previews instead.

### What's live vs. what's a design prototype (know this cold)

| Surface | Status | Where |
|---|---|---|
| Sign-in, Executive Dashboard, Employee Directory, Transitions Hub, Strategic Intelligence | **Live build** | public URL, after login |
| Offboarding pipeline (departing employee checklist) | **Live + populated (was empty until today)** | Employee Directory → Sarah Al-Qasimi |
| Onboarding checklists | **Live logic + seeded tasks** | Employee Directory → Omar Al-Farsi |
| Dashboard KPIs (Retention Lift, Time-to-Value, Cost-per-Hire, EOSB Liability) | **Live, computed from sample data** | Executive Dashboard |
| EOSB engine (UAE basic-salary vs KSA total-salary) | **Live logic** | `server/eosb.js`, `server/index.js` |
| Per-employee Compliance Center (consent status, EOSB basis, document previews) | **Live build** | Employee Directory detail |
| Consent capture, compliance report, template render | **Live endpoints** | `/api/compliance/consent`, `/report`, `/templates/:name/:id` |
| Exit-interview *intake* form | **Live form**, but captured data is not yet surfaced in any view | "Initiate Exit" → "Finalize Offboarding" modal |
| Compliance dashboard (DSR, breach register, consent audit) | **Design spec** | `design-concepts/COMPLIANCE-AUDIT-UI.md`, `COMPLIANCE-UI.md` |
| Bilingual EN/AR RTL dashboard | **Interactive prototype** | `design-concepts/intelligence-dashboard-prototype.html` |

---

# Segment 1 — Offboarding first: where the money and the compliance risk live (0:00 – 2:30)

**Goal:** Open on the departing employee's offboarding pipeline — the view that was empty until today and that a KSA buyer weighs most heavily. Lead with it; don't bury it behind onboarding.

### Click path
1. Sign in → land on **Executive Dashboard**.
2. Point at the **Offboarding Pipeline** card (Sarah Al-Qasimi, Recruitment Specialist, "Exit Pending").
3. Click into her record → the **Offboarding Checklist** opens (4 tasks).
4. Walk the checklist: **Hardware Return (done)** → **Access Revocation** → **Final Settlement Calculation** → **Visa Cancellation (KSA)**.
5. Point at the **Compliance Center**: **EOSB Calculation Basis = "Total Salary (KSA Rule)"** — then note a UAE employee shows **"Basic Salary (UAE Rule)"**.

### What the customer sees
- A **populated offboarding checklist** (4 tasks) where the first is checked off and three are pending — not an empty screen.
- The **KSA EOSB basis is Total Salary (including allowances)**, vs the UAE's Basic Salary basis — the single biggest source of over-/under-provisioning across a GCC roster.
- A **Visa Cancellation (KSA)** step, explicitly on the list for a Saudi departure.

### Speaker notes
> "Let me start where it costs you the most if it's wrong: offboarding. When someone leaves in Saudi, three things have to happen correctly — the end-of-service benefit is calculated on *total* salary, the visa/Iqama is cancelled, and GOSI is de-registered. Here's the live checklist for a departing KSA employee: one task already done, and the rest is the settlement sequence. Watch the right-hand panel — the EOSB basis here says 'Total Salary (KSA Rule)'. A UAE employee on the same screen says 'Basic Salary (UAE Rule)'. That one difference is the difference between over-provisioning and under-provisioning your liability, and it's wired into the product, not left to a spreadsheet."

### Anticipated questions
**Q: "Does it actually file the GOSI de-registration / cancel the Iqama for me?"**
A: Today the checklist is the system of record your HR team drives, and it encodes the correct sequence and the jurisdiction-specific basis. Direct integration with GOSI/MoHRE/Iqama portals is on the roadmap — during the pilot we map your current steps so nothing is double-keyed.

**Q: "What number will we actually pay this person?"**
A: The accrued EOSB figure is computed per employee and shown in the roster; the final settlement is generated from the same engine. (Hold this — see Caveat 6: the printed settlement *template* is still a draft and I won't open it in this demo.)

---

# Segment 2 — Onboarding, jurisdiction-aware (2:30 – 5:00)

**Goal:** Show onboarding as *one flow* that adapts to UAE vs KSA law, and that consent is captured as data — not a PDF afterthought.

### Click path
1. Sidebar → **Employee Directory**.
2. Click **Omar Al-Farsi** (onboarding) → his **Onboarding Checklist** opens with 3 tasks.
3. Point at the UAE sequence, then explain the KSA equivalent (Qiwa, Iqama, GOSI, Mudad) lives in the same engine.
4. Point at the **Compliance Center**: **Privacy Consent (PDPL)** and the **Document Previews**.

### What the customer sees
- Omar's onboarding checklist: *MoHRE Contract Signing (done) → Medical Insurance Application → Visa Stamping*.
- The consent status and EOSB basis in the Compliance Center, alongside ready-to-render document previews.

### Speaker notes
> "Onboarding is the same product, same flow — but it re-renders by jurisdiction. A UAE hire gets the MoHRE/WPS sequence; a Riyadh hire gets the Qiwa/Iqama/GOSI/Mudad sequence. A new hire in Riyadh should never see a Dubai visa step. And notice consent is in-flow — the last item on both lists is 'Privacy Notice Consent,' tracked with the version, not chased as a PDF later."

### Anticipated questions
**Q: "Does it connect to Qiwa/MoHRE, or do we tick boxes manually?"**
A: Today the checklist is the system of record your HR team drives; it encodes each regulator's sequence and rules. Direct API push is on the roadmap — the pilot maps your current manual steps so nothing is double-keyed.

**Q: "How do we prove consent if there's a dispute?"**
A: Every consent write creates a record (who, when, which version, lawful basis), and the employee record shows consent status up front. A dedicated consent-audit screen is on the roadmap.

---

# Segment 3 — Executive Dashboard: the four numbers leadership acts on (5:00 – 7:30)

**Goal:** Roll the operational views up into the leadership view — and be straight about which numbers are computed vs illustrative.

### Click path
1. Sidebar → **Executive Dashboard**.
2. Point at the four headline cards: **Retention Lift**, **Time-to-Value**, **Cost-per-Hire**, **EOSB Liability**.
3. Point at the two pipeline cards (Onboarding: Omar; Offboarding: Sarah).
4. Call out the **"Sample Demo Data"** badge in the header *before* they ask.

### What the customer sees (as of 2026-09-27)
- **Retention Lift (1-yr):** `+17%`, labelled `Illustrative Benchmark`.
- **Time-to-Value:** `16.3 d`, labelled `Illustrative`, with `target: 15 days`.
- **Cost-per-Hire:** `AE 9,000 AED` / `SA 4,750 SAR`, labelled `Illustrative Benchmark`.
- **EOSB Liability:** `AE … AED` / `SA … SAR` (accrued to date, split by jurisdiction).
- **Onboarding Pipeline:** one ramping employee (Omar). **Offboarding Pipeline:** one departing employee (Sarah).

### Speaker notes
> "This is the screen your CFO would look at before a board meeting: what it costs to hire, how long a hire takes to become productive, the end-of-service we're carrying on the books, and whether people are staying. To be straight with you: **this is a seeded sample dataset**, not a live client's numbers — that's what the 'Sample Demo Data' badge is. A few cards are marked 'Illustrative' because the benchmark they're compared against is a placeholder, not a market index yet. What's real is the *calculation* — EOSB and cost-per-hire are computed from the roster, per jurisdiction, not typed in."

### Anticipated questions
**Q: "Why do some cards say 'Illustrative'?"**
A: The figures are computed from sample data; the word "Illustrative" is on the benchmark/forecast *comparison*. In the pilot we'd replace the illustrative benchmark with your own history.

**Q: "Is the EOSB number UAE and Saudi together?"**
A: It's split — AE (basic salary) and SA (total salary) shown separately, because the two regimes accrue differently.

---

# Segment 4 — Strategic Intelligence + bilingual prototype (7:30 – 9:30)

**Goal:** Show the analytics layer, be honest about what's illustrative, and close with the Arabic experience.

### Click path
1. Sidebar → **Strategic Intelligence**.
2. Point at **Time-to-Value by Department**, then **EOSB Liability Forecast** (by jurisdiction & quarter).
3. Point at **Retention Lift — 1-Yr Cohort**.
4. Switch to the **bilingual prototype** and click the **EN | العربية** toggle to show RTL mirroring.

### What the customer sees
- **Time-to-Value by Department** — avg days per department against a 15-day target.
- **EOSB Liability Forecast** — the *current* quarter is the computed accrual (AE + SA split); later quarters are growth-multiplier projections.
- **Retention Lift** — a cohort chart comparing sample retention against an *illustrative* benchmark (see Caveat 3).
- The bilingual prototype flips to RTL with Arabic-Indic numerals and re-flowed currency.

### Speaker notes
> "This is the layer leadership pays for. Time-to-value by department shows you exactly where onboarding is slow. The EOSB forecast shows what you're carrying today and projects it forward — the current quarter is computed, the future quarters are a growth assumption your finance team should review. And the Arabic experience is designed in from the start — that's a working prototype, not the live build yet."

### Anticipated questions
**Q: "Are the forecast numbers committed?"**
A: No — the future quarters are growth multipliers. Say: "finance should review these assumptions before they're used in any budget."

**Q: "Is the Arabic correct, or machine-translated?"**
A: The compliance documents are professionally drafted bilingual templates (v2.0); UI strings are a maintained localization dictionary.

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

1. **This is sample data.** The demo is a seeded dataset, not a real client's production data — own the "Sample Demo Data" badge out loud.
2. **"Illustrative" = not a real benchmark or forecast.** The KPI cards are computed from sample data, but the benchmark/forecast comparisons are placeholders. Never present a forecast number as a guarantee.
3. **Retention Lift shows 100% per cohort.** The sample has no terminated employees, so retention is trivially 100% and the "lift" is 100% minus a made-up benchmark. Pre-empt this; do not let a CHRO discover it.
4. **The seeded offboarding checklist is generic, not the KSA checklist the engine generates.** The demo's departing-employee list reads *Hardware Return → Access Revocation → Final Settlement Calculation → Visa Cancellation (KSA)*. The engine's real KSA offboarding template is longer and different — *Notice Period Verification → EOSB Calculation (KSA) → GOSI De-registration → Exit/Final-Exit Visa → Iqama Cancellation/Transfer → Service Certificate Issuance*. Don't claim the demo screen shows GOSI/Iqama steps; say the engine produces the full KSA sequence and the demo seed is a shorter stand-in.
5. **Legal documents need counsel sign-off.** The privacy notice, DPA, DPIA, and contract templates are pilot-ready drafts — explicitly tell the customer their counsel must review. Do not imply they are "approved" or "binding."
6. **DO NOT open the Settlement Statement document preview in a demo.** It renders as an unfilled template with literal placeholders and a **0.00 EOSB** that contradicts the roster's accrued EOSB on the same page. Show **Privacy Notice** and **Labor Contract** instead.
7. **The document-preview header says "Legally Validated GCC Template"** — this overstates our position. If it comes up, say the templates are pilot-ready drafts, not validated.
8. **The consent line may show "GRANTED ON" with a blank date** (a display bug — the date field renders empty). Pre-empt it; the consent record itself is seeded.
9. **Regulator integrations are roadmap, not live.** MoHRE/Qiwa/WPS/Mudad are workflow steps, not live API pushes.
10. **DSR / breach-register / consent-audit dashboard is design-spec, not live.** The live product shows a per-employee Compliance Center only.

---

## Appendix — file & screen reference map

| In the script | Real reference |
|---|---|
| Offboarding checklist (Sarah) | public URL → Employee Directory → Sarah Al-Qasimi; `GET /api/employees/:id/offboarding` |
| Onboarding checklist (Omar) | public URL → Employee Directory → Omar Al-Farsi; `GET /api/employees/:id/onboarding` |
| Executive Dashboard (4 KPIs + pipelines) | public URL → sidebar **Executive Dashboard**; `GET /api/analytics/dashboard` |
| Transitions Hub | public URL → sidebar **Transitions Hub** |
| Strategic Intelligence | public URL → sidebar **Strategic Intelligence**; `GET /api/analytics/dashboard` |
| EOSB engine | `server/eosb.js`; `POST /api/compliance/calculate-eosb` |
| Checklist templates (UAE/KSA, onboarding/offboarding) | `server/compliance_engine.js` (`checklistTemplates`) |
| Document previews | `GET /api/compliance/templates/:templateName/:employeeId` |
| Consent capture | `POST /api/compliance/consent` → `consent_records` |
| Compliance report | `GET /api/compliance/report` |
| Compliance dashboard (DSR/breach/consent) — design spec | `design-concepts/COMPLIANCE-AUDIT-UI.md`, `COMPLIANCE-UI.md` |
| Bilingual EN/AR RTL — prototype | `design-concepts/intelligence-dashboard-prototype.html`, `INTELLIGENCE-DASHBOARD-UI.md` |
| Privacy notice v2.0 (bilingual) | `templates/privacy-notice.md` (v2.0) + `.pdf` |
| DPA / DPIA / contracts / settlement | `templates/data-processing-agreement.*`, `dpia-questionnaire.*`, `uae-employment-contract.md`, `ksa-employment-contract.md`, `final-settlement-statement.md` |
| Weak-screen audit (read alongside this script) | `demo-weak-screens.md` |
| Brand system | `design-concepts/BRAND-IDENTITY.md` (deep teal `#0F766E`) |

---

*Prepared by Product Designer, Antum — pilot-ready demo script v2.1 (re-walked 2026-09-27).*
