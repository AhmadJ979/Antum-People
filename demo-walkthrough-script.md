# Antum People — 10-Minute Pilot-Customer Demo Walkthrough Script

> **Audience:** Mid-market GCC CHRO / CFO / Head of People Ops (100–1,000 employees)
> **Goal:** Move the prospect from "compliance admin tool" to "strategic intelligence tier" — and land the 3-anchor free-pilot conversation.
> **Total runtime:** 10 minutes (4 segments + close). Timings are targets, not walls.
> **Presenter:** Founder-led (Ahmad's HR network) — technical detail available, but lead with outcomes.

> ⚠️ **Verification status — internal (for the presenter, not read aloud).** Re-walked end-to-end by the Product Designer on 2026-09-27 against a local instance of current `main` (982f1e6), seeded with the standard demo dataset. Sign-in works (wrong password → clean "Invalid username or password"; correct login → Executive Dashboard). The four tabs are: **Executive Dashboard → Employee Directory → Transitions Hub → Strategic Intelligence**. The demo now shows **9 employees (5 UAE + 4 KSA)**, a populated **offboarding pipeline** for the departing employee, and **computed** (not zero) dashboard figures.
>
> **This script matches what the screen actually shows today.** Do not describe a screen you haven't just seen; if anything looks different on the call, follow the *Caveats & guardrails* section rather than improvising numbers.

---

## Before you start — 30-second prep checklist

- [ ] **Confirm the live app loads** at https://b974147c03228029e277d1cbe6646fe6.ctonew.app before the call (200, renders the sign-in screen).
- [ ] **Sign in** at https://b974147c03228029e277d1cbe6646fe6.ctonew.app — demo account **`admin`**, password **supplied separately by Ahmad**. Do a test login ahead of the call; **never write the password into this file.**
- [ ] Confirm the app is showing **seeded sample data** (9 employees, UAE + KSA, one active onboarding and one active offboarding case). You'll see an amber **"Sample Demo Data"** badge in the header — that's expected, and you'll own it in Segment 1.
- [ ] Have two tabs ready to hot-switch: the **live app** and the **bilingual prototype** (`design-concepts/intelligence-dashboard-prototype.html`).
- [ ] PDFs printed or open in a viewer: `templates/privacy-notice.pdf`, `templates/data-processing-agreement.pdf`, `templates/dpia-questionnaire.pdf`.
- [ ] Know your honest caveats (see *Caveats & guardrails* at the end) — you will be asked.
- [ ] Pre-select one **UAE example** (e.g. Leila Mansour, Engineering) and one **KSA example** (e.g. Sarah Al-Qasimi, offboarding) for the jurisdiction side-by-side.
- [ ] **Memorize the "don't click" list:** do not open the **Settlement Statement** document preview in a live demo (see Caveat 6) — it is still an unfilled template. Use **Privacy Notice** and **Labor Contract** for document previews instead.

### What's live vs. what's a design prototype (know this cold)

| Surface | Status | Where |
|---|---|---|
| Sign-in, Executive Dashboard, Employee Directory, Transitions Hub, Strategic Intelligence | **Live build** | public URL, after login |
| Dashboard KPIs (Retention Lift, Time-to-Value, Cost-per-Hire, EOSB Liability) | **Live, computed from sample data** | Executive Dashboard |
| Onboarding / offboarding checklists | **Live logic + seeded tasks** | Employee Directory → per-employee detail |
| EOSB engine (UAE basic-salary vs KSA total-salary) | **Live logic** | `server/eosb.js`, `server/index.js` |
| Per-employee Compliance Center (consent status, EOSB basis, document previews) | **Live build** | Employee Directory detail |
| Consent capture, compliance report, template render | **Live endpoints** | `/api/compliance/consent`, `/report`, `/templates/:name/:id` |
| Exit-interview *intake* form | **Live form**, but captured data is not yet surfaced in any view | "Initiate Exit" → "Finalize Offboarding" modal |
| Compliance dashboard (DSR, breach register, consent audit) | **Design spec** | `design-concepts/COMPLIANCE-AUDIT-UI.md`, `COMPLIANCE-UI.md` |
| Bilingual EN/AR RTL dashboard | **Interactive prototype** | `design-concepts/intelligence-dashboard-prototype.html` |

---

# Segment 1 — Executive Dashboard, "one number the CFO would act on" (0:00 – 2:30)

**Goal:** Land the strategic value in the first 90 seconds — this is not a compliance checklist tool, it's a workforce-economics view for leadership.

### Click path
1. Sign in → lands on **Executive Dashboard** (default tab).
2. Point at the four headline cards across the top: **Retention Lift**, **Time-to-Value**, **Cost-per-Hire**, **EOSB Liability**.
3. Point at the two pipeline cards below: **Onboarding Pipeline** and **Offboarding Pipeline**.
4. Call out the **"Sample Demo Data"** badge in the header *before* they ask.

### What the customer sees (as of 2026-09-27)
- **Retention Lift (1-yr):** `+17%`, labelled `Illustrative Benchmark`.
- **Time-to-Value:** `16.3 d`, labelled `Illustrative`, with `target: 15 days`.
- **Cost-per-Hire:** `AE 9,000 AED` / `SA 4,750 SAR`, labelled `Illustrative Benchmark`.
- **EOSB Liability:** `AE … AED` / `SA … SAR` (accrued to date, split by jurisdiction).
- **Onboarding Pipeline:** one ramping employee (Omar Al-Farsi, Finance Analyst).
- **Offboarding Pipeline:** one departing employee (Sarah Al-Qasimi, Recruitment Specialist), "Exit Pending".
- The header carries an amber **"Sample Demo Data"** badge on every screen.

### Speaker notes
> "This is the screen your CFO would look at before a board meeting. Four numbers, but they're the four that move workforce cost: what it costs to hire, how long a hire takes to become productive, how much end-of-service we're carrying on the books, and whether people are staying. To be straight with you up front: **this is a seeded sample dataset**, not a live client's numbers — that's what the 'Sample Demo Data' badge is telling you. A few of the cards are marked 'Illustrative' because the benchmark line they're compared against is a placeholder, not a market index yet. What's real is the *calculation* underneath — the EOSB and cost-per-hire numbers are computed from the roster, per jurisdiction, not typed in."

### Anticipated questions
**Q: "Why do some cards say 'Illustrative'?"**
A: The figures themselves are computed from the sample data; the word "Illustrative" is on the *benchmark/forecast* comparison — we haven't connected a real external market benchmark yet. In the pilot we'd replace the illustrative benchmark with your own historical data, which is the honest upgrade path.

**Q: "Is the EOSB number UAE and Saudi together?"**
A: It's split — the card shows AE (on basic salary) and SA (on total salary) separately, because the two regimes accrue differently. That split is the point: you shouldn't lump them.

---

# Segment 2 — Employee Directory + the per-employee Compliance Center (2:30 – 5:00)

**Goal:** Show the jurisdiction-aware checklists *and* that compliance lives inside the employee record — with the consent and EOSB basis visible up front.

### Click path
1. Sidebar → **Employee Directory**.
2. Point at the table (9 rows, with region flags 🇦🇪/🇸🇦 and a **Gratuity Accrued** column).
3. Click **Omar Al-Farsi** (onboarding) → his **Onboarding Checklist** opens with 3 tasks.
4. Click **Sarah Al-Qasimi** (offboarding) → her **Offboarding Checklist** opens with 4 tasks (Hardware Return is checked/completed; the other three are pending).
5. Point at the right-hand **Compliance Center** panel: **Privacy Consent (PDPL)**, **EOSB Calculation Basis**, and the **Document Previews** (Privacy Notice, Labor Contract, and Settlement Statement for the departing employee).

### What the customer sees
- Onboarding checklist (Omar): *MoHRE Contract Signing (done) → Medical Insurance Application → Visa Stamping*.
- Offboarding checklist (Sarah): *Hardware Return (done) → Access Revocation → Final Settlement Calculation → Visa Cancellation (KSA)*.
- Compliance Center: consent status (`GRANTED`), EOSB basis **"Total Salary (KSA Rule)"** for Sarah vs **"Basic Salary (UAE Rule)"** for a UAE employee.
- Document previews render the Privacy Notice and Labor Contract with the employee's name filled in.

### Speaker notes
> "Watch what happens when I switch between a UAE and a Saudi employee — the checklist itself changes, because it's driven by jurisdiction, not a manual toggle. A Riyadh hire never sees a Dubai visa step. And look at the right-hand panel: consent status, the EOSB calculation basis, and the actual documents, all inside the employee record instead of a separate binder."
> *(If the consent line shows a blank date after "GRANTED ON" — a known cosmetic display bug — say:)* "Consent is tracked; the date field has a display glitch we're already fixing. The record itself is there."

### Anticipated questions
**Q: "Does it connect to Qiwa/MoHRE, or do we tick boxes manually?"**
A: Today the checklist is the system of record your HR team drives, and it encodes the sequence and compliance rules of each regulator. Direct Qiwa/MoHRE API push is on the roadmap — during the pilot we'd map your current manual steps so nothing is double-keyed.

**Q: "Why does the KSA basis say 'Total Salary'?"**
A: Because that's the rule — UAE accrues EOSB on basic salary, Saudi on total salary including allowances. Get that backwards and you're over- or under-provisioning across hundreds of people. The basis is shown per employee so finance can check it.

---

# Segment 3 — Transitions Hub (5:00 – 6:30)

**Goal:** Show onboarding and offboarding as two managed pipelines, not two piles of paper.

### Click path
1. Sidebar → **Transitions Hub**.
2. Point at **"Ramping Employees (Onboarding)"** (Omar Al-Farsi).
3. Point at **"Departing Employees (Offboarding)"** (Sarah Al-Qasimi).
4. Click either card to jump back into that employee's checklist in the Directory.

### What the customer sees
- Two lists side by side: who is ramping, who is departing.
- Omar shows a day counter since start ("Day 193" in the current seed — note this is a data quirk, see below).
- Sarah shows an "EXIT" label (her exit date is still pending in the sample data, so the date is blank).

### Speaker notes
> "This is the operational view your HR team lives in — everyone in motion in one place. The ramping list is who's onboarding, the departing list is who's offboarding. Click through and you're in that person's checklist with their compliance status."
> *(Pre-empt the blank exit date:)* "Sarah's exit date is blank because in this sample her offboarding is still in flight — once it's finalized, the date and the settlement figures fill in."

### Anticipated questions
**Q: "Why is that person still ramping after that many days?"**
A: That's a quirk of the sample dataset (the seed uses a start date several months back). In production the day counter reflects the real start date, and we'd flag anything that's been ramping past your target during the pilot.

---

# Segment 4 — Strategic Intelligence + bilingual prototype (6:30 – 9:30)

**Goal:** Show the analytics layer, be honest about what's illustrative, and close with the bilingual experience.

### Click path
1. Sidebar → **Strategic Intelligence**.
2. Point at the three summary cards (Retention Insight, Productivity Gap, Liability Exposure).
3. Point at **Retention Lift — 1-Yr Cohort**, then **Time-to-Value by Department**, then **EOSB Liability Forecast** (by jurisdiction & quarter).
4. Switch to the **bilingual prototype** tab (`design-concepts/intelligence-dashboard-prototype.html`) and click the **EN | العربية** toggle to show RTL mirroring.

### What the customer sees
- **Time-to-Value by Department** — avg days per department against a 15-day target (Engineering 16.7, HR 15, Marketing 18, etc.).
- **EOSB Liability Forecast** — the *current* quarter is the computed accrual (AE + SA split); later quarters are projected with growth multipliers (illustrative).
- **Retention Lift** — a cohort chart comparing sample retention against an *illustrative* benchmark.
- The bilingual prototype flips to RTL, with Arabic-Indic numerals and re-flowed currency.

### Speaker notes
> "This is the layer leadership pays for. Time-to-value by department shows you exactly where onboarding is slow. The EOSB forecast shows what you're carrying on the books today, and projects it forward — the current quarter is computed, the future quarters are a growth assumption your finance team should review. And the Arabic experience is designed in from the start, not bolted on — that's a working prototype, not the live build yet."
> *(Pre-empt the retention chart, which shows 100% sample retention per cohort:)* "The retention chart uses sample data with no departures in it yet, so it reads 100% — that's why the benchmark is marked illustrative. With your real attrition data it becomes a genuine cohort view, which is exactly what the pilot measures."

### Anticipated questions
**Q: "Are the forecast numbers committed?"**
A: No — the future quarters are growth multipliers. Say: "finance should review these assumptions before they're used in any budget."

**Q: "Is the Arabic actually correct, or machine-translated?"**
A: The compliance documents are professionally drafted bilingual templates (v2.0). UI strings are a maintained localization dictionary, not on-the-fly translation.

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

1. **This is sample data.** The demo is a seeded dataset, not a real client's production data — own the "Sample Demo Data" badge out loud rather than letting it hang there.
2. **"Illustrative" = not a real benchmark or forecast.** The KPI cards are computed from sample data, but the benchmark/forecast comparisons are placeholders. Never present a forecast number as a guarantee; say finance should review assumptions before budgeting.
3. **Retention Lift shows 100% per cohort.** The sample has no terminated employees, so retention is trivially 100% and the "lift" is 100% minus a made-up benchmark. Pre-empt this verbally; do not let a CHRO discover it.
4. **Legal documents need counsel sign-off.** The privacy notice, DPA, DPIA, and contract templates are pilot-ready drafts — explicitly tell the customer their counsel must review. Do not imply they are "approved" or "binding."
5. **Regulator integrations are roadmap, not live.** MoHRE/Qiwa/WPS/Mudad are workflow steps, not live API pushes.
6. **DO NOT open the Settlement Statement document preview in a demo.** It currently renders as an unfilled template with literal placeholders and a zero EOSB figure that contradicts the roster's accrued EOSB on the same page. Show **Privacy Notice** and **Labor Contract** instead, until the settlement template is wired to real per-employee figures.
7. **The document-preview header says "Legally Validated GCC Template"** — this overstates our position. If it comes up, say the templates are pilot-ready drafts, not validated. (It should be re-labelled; see the weak-screen audit.)
8. **The consent line may show "GRANTED ON" with a blank date** (a display bug). Pre-empt it; the consent record itself is seeded.
9. **DSR / breach-register / consent-audit dashboard is design-spec, not live.** The live product shows a per-employee Compliance Center only. Do not present the fuller dashboard as a working screen.

---

## Appendix — file & screen reference map

| In the script | Real reference |
|---|---|
| Executive Dashboard (4 KPIs + pipelines) | `GET /api/analytics/dashboard`; public URL → sidebar **Executive Dashboard** |
| Employee Directory + checklists + Compliance Center | public URL → sidebar **Employee Directory**; `GET /api/employees`, `/api/employees/:id/onboarding`, `/api/employees/:id/offboarding` |
| Transitions Hub | public URL → sidebar **Transitions Hub** |
| Strategic Intelligence (retention, TTV, EOSB forecast) | public URL → sidebar **Strategic Intelligence**; `GET /api/analytics/dashboard` |
| EOSB engine | `server/eosb.js`; `POST /api/compliance/calculate-eosb` |
| Onboarding/offboarding checklist templates | `server/compliance_engine.js` (`checklistTemplates`) |
| Document previews | `GET /api/compliance/templates/:templateName/:employeeId` |
| Consent capture | `POST /api/compliance/consent` → `consent_records` |
| Compliance report / consent coverage | `GET /api/compliance/report` |
| Compliance dashboard (DSR/breach/consent) — design spec | `design-concepts/COMPLIANCE-AUDIT-UI.md`, `COMPLIANCE-UI.md` |
| Bilingual EN/AR RTL dashboard — prototype | `design-concepts/intelligence-dashboard-prototype.html`, `INTELLIGENCE-DASHBOARD-UI.md` |
| Privacy notice v2.0 (bilingual) | `templates/privacy-notice.md` (v2.0) + `.pdf` |
| DPA / DPIA / contracts / settlement | `templates/data-processing-agreement.*`, `dpia-questionnaire.*`, `uae-employment-contract.md`, `ksa-employment-contract.md`, `final-settlement-statement.md` |
| Weak-screen audit (read alongside this script) | `demo-weak-screens.md` |
| Brand system | `design-concepts/BRAND-IDENTITY.md` (deep teal `#0F766E`) |

---

*Prepared by Product Designer, Antum — pilot-ready demo script v2.0 (re-walked 2026-09-27).*
