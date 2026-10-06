# Antum People — 10-Minute Pilot-Customer Demo Walkthrough Script (UAE-first)

> **Audience:** Mid-market UAE CHRO / CFO / Head of People Ops (100–1,000 employees)
> **Goal:** Move the prospect from "compliance admin tool" to "strategic intelligence tier" — and land the 3-anchor free-pilot conversation.
> **Total runtime:** 10 minutes (4 segments + close). Timings are targets, not walls.
> **Presenter:** Founder-led (Ahmad's HR network) — technical detail available, but lead with outcomes.

> ⚠️ **Verification status — internal (for the presenter, not read aloud).**
> - Rewritten and re-walked by the Product Designer on **2026-10-06** against the deployed commit **`80c3fff`** (`main`, PRs #47–#51), the same commit the public URL serves (`/assets/index-CPYz_PZb.js`).
> - **What I checked on the public URL myself** (anonymous, no login): `https://b974147c03228029e277d1cbe6646fe6.ctonew.app/` returns **200**, title **"Antum People"**, the app renders and the **sign-in screen appears** (Username / Password / "Forgot Password?" / "Sign In").
> - **What I could not check on the public URL:** every screen behind the login. WORKFLOW rule 10 says the demo credential is lead-managed and I must not use it, so those screens were verified on a **scratch instance of the same commit** (own port, own database, own throwaway credential) — not on the live tree. The rendered client bundle is the same file the public URL serves. **Ask the lead to run one logged-in pass on the public URL before the first call.**
> - **Every figure below was read off that instance in this session — none is recalled.** The seeded EOSB on a record is computed by the engine **when the seed runs**, so a currency figure can differ after a re-seed; counts and ratios are stable. Prefer counts and ratios in the narrative, and **re-read the dashboard the morning of the call**. Never write a figure into this script to make a screen look fuller — that is the defect class this team keeps sending back.
> - **Roster as served on this surface:** 10 records — 8 active (two of them mid-onboarding), one in offboarding, two historical leavers kept for the retention math.
> - **UAE-only, end to end.** No other jurisdiction appears anywhere in the flow below — no screen, figure, claim or control. The demo reads as a UAE product, and nothing in this script depends on anything outside it.
> - **The UAE resignation tier is unconfirmed.** Federal Decree-Law 33/2021 vs the repealed Law 8/1980 Art. 132 reduction is with counsel. Never present the UAE EOSB figure as legally validated.

---

## Before you start — 30-second prep checklist

- [ ] **Confirm the live app loads** at the public URL before the call (200, title "Antum People", sign-in screen renders).
- [ ] **Sign in** with the demo account (**`admin`**, password **supplied separately by Ahmad** — never written into this file). Do a test login ahead of the call.
- [ ] Confirm the app shows **sample data**, UAE selected, and the amber **"Sample Demo Data"** badge in the header.
- [ ] Have two tabs ready: the **live app** and the **bilingual prototype** (`design-concepts/intelligence-dashboard-prototype.html`).
- [ ] PDFs printed or open: `templates/privacy-notice.pdf`, `templates/data-processing-agreement.pdf`, `templates/dpia-questionnaire.pdf`.
- [ ] Know your honest caveats (see *Caveats & guardrails*) — you will be asked.
- [ ] **Leave the header controls alone — this is a UAE story from start to finish.** Do not change what region the dashboard is showing mid-demo; it breaks both the narrative and the arithmetic you have already said out loud.
- [ ] **Do not present the settlement figure as a compliance claim.** Open the Settlement Statement only with the "draft, subject to your counsel's review" framing (Segment 1).

### What's live vs. what's a prototype (know this cold)

| Surface | Status | Where |
|---|---|---|
| Sign-in, Executive Dashboard, Employee Directory, Transitions Hub, Strategic Intelligence | **Live build** | public URL, after login |
| UAE offboarding case (8 engine-sourced steps) | **Live + populated** | Employee Directory → Noura Al-Suwaidi |
| UAE onboarding checklists (7 steps each) | **Live logic + seeded tasks** | Employee Directory → Omar Al-Farsi / Reem Al-Hashemi |
| Dashboard KPIs (Retention Lift, Time-to-Value, Cost-per-Hire, EOSB Liability) | **Live, computed from sample data** | Executive Dashboard |
| EOSB engine (UAE basic-salary basis) | **Live logic, tier unconfirmed pending counsel** | `server/eosb.js` |
| Settlement Statement document | **Live render from the engine** (no placeholders) | Employee Directory → Noura → Compliance Center |
| Exit-interview intake form | **Live form**, captured data still not surfaced in any view | "Initiate Exit" → "Finalize Offboarding" |
| Bilingual EN/AR RTL dashboard | **Interactive prototype**, not the live build | `design-concepts/intelligence-dashboard-prototype.html` |
| Compliance dashboard (DSR, breach register, consent audit) | **Design spec** | `design-concepts/COMPLIANCE-UI.md` |

---

# Segment 1 — Offboarding first: where the money and the compliance risk live (0:00 – 2:30)

**Goal:** Open on a UAE departure in flight. This is the view the UAE buyer weighs most heavily (EOSB, final settlement, work permit and residency cancellation), and it is now populated for a UAE record rather than a Saudi one.

### Click path
1. Sign in → land on **Executive Dashboard** (UAE selected by default).
2. Point at the **Offboarding Pipeline** card: **Noura Al-Suwaidi — Account Manager — "Exit 2026-10-10"**.
3. Sidebar → **Employee Directory** → click her row → her **Offboarding Checklist** opens (**8 steps**).
4. Walk the list: **Hardware Return (done)** → **Access Revocation (done)** → **Notice Period Verification** → **EOSB Calculation (UAE)** → **Annual Leave Encashment** → **MoHRE Work Permit Cancellation** → **Residency Visa Cancellation** → **Final Settlement Payment**.
5. Point at the **Compliance Center** panel: **EOSB Calculation Basis = "Basic Salary (UAE Rule)"**.
6. (Optional, with the framing in the speaker notes) open **Settlement Statement** — it renders the engine's own figures for her record.

### What the customer sees
- A **populated offboarding checklist** with two steps already done and six pending — not an empty screen.
- The UAE sequence itself: **MoHRE work-permit cancellation** and **residency visa cancellation** on the list, in the right order, ahead of final settlement.
- **EOSB basis "Basic Salary (UAE Rule)"** — the UAE accrual basis, stated on the employee record.
- If you open it: a settlement document whose **EOSB line is the engine's accrued figure for that employee** (6,415.79 AED when measured on 2026-10-06), Gross Total 11,577.08, Net Payable 11,577.08, and lines the engine cannot compute reading **"not calculated"** — not zeros, not placeholders.

### Speaker notes
> "Let me start where it costs you the most if it's wrong: offboarding. This is a UAE departure already in flight. The checklist isn't a template someone typed — it comes out of the compliance engine, in order: equipment and access first, then notice, then the EOSB calculation, then MoHRE cancels the work permit and the residency visa follows, and only then the final payment. The EOSB basis here says **basic salary**, which is the UAE rule. And the settlement document is generated from the same engine — this figure is her accrued end-of-service, computed from her own start date and salary, not typed in."

### Anticipated questions
**Q: "Does it file the MoHRE cancellation / cancel the visa for me?"**
A: Today the checklist is the system of record your HR team drives, and it encodes the correct sequence and the UAE basis. Direct integration with MoHRE/MOHRE portals is on the roadmap — during the pilot we map your current steps so nothing is double-keyed.

**Q: "Is this settlement figure what we'd actually pay?"**
A: **Say this plainly:** "The calculation is live and it's the engine's own number. What is *not* yet signed off is one part of the UAE resignation rule — the reduced accrual for 1–3 and 3–5 years' service under the 2021 law — which our counsel is confirming. So treat this as a pilot-ready draft that your counsel reviews before anyone pays against it." (See Caveat 2.)

**Q: "What number will we actually pay this person?"**
A: The accrued EOSB is computed per employee and shown in the roster and on the settlement document, both from the same engine. The tier above is the open item.

---

# Segment 2 — Onboarding, UAE sequence (2:30 – 5:00)

**Goal:** Show onboarding as a live, UAE-specific flow that captures consent as data — not a PDF afterthought.

### Click path
1. Sidebar → **Employee Directory** → click **Omar Al-Farsi** (status *onboarding*) → his **Onboarding Checklist** (7 steps) opens.
2. Note two steps already complete, the rest pending.
3. Point at the **Compliance Center**: **Privacy Consent (PDPL)** shows a **granted date**, and the **Document Previews** (Privacy Notice, Labor Contract) render.
4. Optional: back to the dashboard's **Onboarding Pipeline** card — it lists the same two people, from the same source.

### What the customer sees
- A **UAE onboarding checklist** with real completion state, sourced from the engine.
- **Consent captured with a date**, on the employee record.
- Two ready-to-render documents (Privacy Notice, Employment Contract) — bilingual.

### Speaker notes
> "Onboarding is the same product, same engine — the sequence is the UAE one: contract and MoHRE steps, insurance, visa stamping. And notice consent is in-flow and dated, tracked against the version, not chased as a PDF later. The dashboard card and this checklist read from the same source, so they can't disagree."

### Anticipated questions
**Q: "Does it connect to MoHRE, or do we tick boxes manually?"**
A: Today the checklist is the system of record your HR team drives; it encodes the sequence and rules. Direct API push is on the roadmap — the pilot maps your current manual steps so nothing is double-keyed.

**Q: "How do we prove consent if there's a dispute?"**
A: Every consent write creates a record (who, when, which version, lawful basis), and the employee record shows the status and date up front. A dedicated consent-audit screen is on the roadmap.

---

# Segment 3 — Executive Dashboard: the four numbers leadership acts on (5:00 – 7:30)

**Goal:** Roll the operational views up into the leadership view — and be straight about which numbers are computed and which are placeholders.

### Click path
1. Sidebar → **Executive Dashboard**.
2. The four headline cards: **Retention Lift (1-yr)**, **Time-to-Value**, **Cost-per-Hire**, **EOSB Liability**.
3. The two pipeline cards: **Onboarding** (Omar, Reem) and **Offboarding** (Noura).
4. Call out the **"Sample Demo Data"** badge in the header *before* they ask.

### What the customer sees (measured 2026-10-06 on `80c3fff`)
- **Retention Lift (1-yr):** `+19%`, labelled `Illustrative` / `Illustrative Benchmark`.
- **Time-to-Value:** `19.2 d`, labelled `Illustrative`, `target: 15 days`.
- **Cost-per-Hire:** `AE 7,625.00 AED`, labelled `Illustrative Benchmark` (`recruitment + onboarding`).
- **EOSB Liability:** `AE 85,126.34 AED`, labelled `Illustrative Total` (`Accrued to date across regions`).
- **Onboarding Pipeline:** two people (Omar Al-Farsi, started 2026-08-20; Reem Al-Hashemi, started 2026-08-05).
- **Offboarding Pipeline:** one person (Noura Al-Suwaidi, `Exit 2026-10-10`).

### Speaker notes
> "This is the screen your CFO would look at before a board meeting: what it costs to hire, how long a hire takes to become productive, the end-of-service we're carrying on the books, and whether people are staying. To be straight with you: **this is a seeded sample dataset, not a live client's numbers** — that's what the 'Sample Demo Data' badge is. A few cards are marked 'Illustrative' because the thing they're compared *against* — a benchmark, a target — is a placeholder, not a market index yet. What's real is the *calculation*: EOSB and cost-per-hire are computed from the roster, per jurisdiction, not typed in."

### Anticipated questions
**Q: "Why do some cards say 'Illustrative'?"**
A: The figures are computed from sample data; "Illustrative" sits on the benchmark or target they're compared to. In the pilot we'd replace it with your own history.

**Q: "Is this UAE only, or does it cover the region?"**
A: "Every figure on this screen is UAE. The engine is built for the GCC and we are launching UAE-first — so the pilot is a UAE pilot."

---

# Segment 4 — Strategic Intelligence + bilingual prototype (7:30 – 9:30)

**Goal:** Show the analytics layer, be honest about what is illustrative, and close with the Arabic experience.

### Click path
1. Sidebar → **Strategic Intelligence**.
2. Point at **Retention Lift — 1-Yr Cohort**, then **Time-to-Value by Department**, then **EOSB Liability Forecast**.
3. Switch to the **bilingual prototype** and click **EN | العربية** to show RTL mirroring.

### What the customer sees (measured 2026-10-06 on `80c3fff`)
- **Retention Lift — 1-Yr Cohort** (UAE cohorts: the card reads 100% / 50% / 80% / 100%, each against a separately-labelled `Illustrative` benchmark — the 50% is a real mixed outcome, a cohort with both a leaver and a stayer, not a one-person cohort):

  | Cohort | Retention | Benchmark | Lift |
  |---|---|---|---|
  | H1 2022 | 100% | 82% | +18% |
  | H1 2023 | 50% | 83% | −33% |
  | H1 2024 | 80% | 84% | −4% |
  | H2 2026 | 100% | 81% | +19% |

- **Time-to-Value by Department:** Engineering 16.7 d, Finance 25 d, Product 19 d, Sales 21 d — each against a 15-day target, over-target shown in red.
- **EOSB Liability Forecast (UAE, by quarter):** Q3 2026 **84,667** → Q4 2026 **90,926** → Q1 2027 **133,477** → Q2 2027 **161,494**. The first quarter is the computed accrual; later quarters come from a tenure-derived growth assumption, not a booked forecast.
- The bilingual prototype flips to RTL with Arabic-Indic numerals and re-flowed currency.

### Speaker notes
> "This is the layer leadership pays for. Look at the retention chart first — and notice it is not flattering: the H1 2023 cohort is at 50%, and the cohort after it at 80%. That's the point: this is computed from leaver records, not smoothed. Time-to-value by department shows you exactly where onboarding is slow — Finance at 25 days against a 15-day target. The EOSB forecast shows what you're carrying today and projects it forward; the first quarter is computed, the later ones are a growth assumption your finance team should review. And the Arabic experience is designed in from the start — that's a working prototype, not the live build yet."

### Anticipated questions
**Q: "Are the forecast numbers committed?"**
A: No — the first quarter is the computed accrual; the later quarters are a growth assumption. Say: "finance should review these assumptions before they're used in any budget."

**Q: "Is the Arabic correct, or machine-translated?"**
A: The compliance documents are professionally drafted bilingual templates (v2.0); UI strings are a maintained localization dictionary.

---

# Close — the pilot offer (9:30 – 10:00)

### Speaker notes
> "Here's the offer. We're running **three free anchor pilots** — full access, no cost — in exchange for three things: your feedback, a testimonial, and case-study rights. Success is measured on three KPIs we both agree on up front: **Retention Lift**, **Time-to-Value**, and **Compliance Accuracy**. If we move those numbers for you, we convert to the paid Intelligence Tier at renewal. Worst case, you've tightened your compliance for free. Best case, you've turned onboarding and offboarding into a leadership tool."

### The three KPIs (say these explicitly)
1. **Retention Lift** — % increase in 1-year retention.
2. **Time-to-Value** — days until a new hire is fully productive (visa + onboarding milestones).
3. **Compliance Accuracy** — % of offboarding cases with correctly calculated EOSB and privacy-compliant handling.

### Anticipated close question
**Q: "What do we need to commit to start?"**
A: A named HR lead, access to your current onboarding/offboarding process for one or two roles, and a 30–60 minute working session. We'll bring the config; you bring the edge cases.

---

# Caveats & guardrails (read before every demo)

1. **This is sample data.** A seeded dataset, not a real client's production data — own the "Sample Demo Data" badge out loud, at the point where the prospect would otherwise assume the numbers are a customer's.
2. **The UAE EOSB resignation tier is unconfirmed.** The 1/3 (1–3 years) and 2/3 (3–5 years) reduction is frozen in the engine and flagged unconfirmed pending counsel. Never say the UAE EOSB is "validated", "certified" or "compliant". Say: *pilot-ready draft, subject to your counsel's review.* If counsel finds the reduction did not survive the 2021 law, every resigning UAE employee has been underpaid — that is why this stays a draft.
3. **"Illustrative" = not a real benchmark, target or forecast.** The KPI figures are computed from sample data; the comparisons are placeholders. Never present a forecast as a guarantee.
4. **Two of the four cohorts show negative lift (H1 2023 −33%, H1 2024 −4%).** That is real, computed from seeded leaver records, and it is the honest version of the chart. Do not hide it; use it to explain that cohorts are computed from exits, not assumed. (A single-leaver cohort used to read 0% — that was the data looking broken, not the metric.)
5. **The settlement document's header is still generic — the employer line is the placeholder "Antum Regional Hub" and the jurisdiction line is a template label.** The *figures* on it are the engine's; the header is not yet resolved to a real entity. Frame it as a draft template carrying live figures, and don't let the header become the story.
6. **Legal documents need counsel sign-off.** Privacy notice, DPA, DPIA and contract templates are pilot-ready drafts — say their counsel must review. The document-preview subtitle now says exactly that ("Pilot-ready draft — subject to your counsel's review").
7. **Regulator integrations are roadmap, not live.** MoHRE/WPS are workflow steps, not live API pushes.
8. **Exit-interview data is captured but never surfaced.** The "Exit Intelligence Intake" form collects departure reason, preventable-attrition flag and offered salary; no view renders it yet. If asked, say exit intelligence is a Phase 2 view, and the intake is already recording.
9. **DSR / breach-register / consent-audit dashboard is design-spec, not live.** The live product shows a per-employee Compliance Center only.
10. **One region per demo.** Leave the header controls untouched — changing what the dashboard shows mid-call breaks the story and the figures you have already said out loud. If a prospect asks about other countries, answer verbally: UAE-first is the launch.

---

## Appendix — file & screen reference map

| In the script | Real reference |
|---|---|
| Offboarding checklist (Noura) | public URL → Employee Directory → Noura Al-Suwaidi; `GET /api/employees/:id/offboarding` |
| Onboarding checklist (Omar / Reem) | public URL → Employee Directory → Omar Al-Farsi; `GET /api/employees/:id/onboarding` |
| Executive Dashboard (4 KPIs + pipelines) | public URL → sidebar **Executive Dashboard**; `GET /api/analytics/dashboard?jurisdiction=AE` |
| Transitions Hub | public URL → sidebar **Transitions Hub** |
| Strategic Intelligence | public URL → sidebar **Strategic Intelligence** |
| EOSB engine (frozen UAE tier) | `server/eosb.js` |
| Checklist templates (UAE onboarding/offboarding) | `server/compliance_engine.js` (`checklistTemplates`) |
| Document previews | `GET /api/compliance/templates/:templateName/:employeeId` |
| Consent capture | `POST /api/compliance/consent` → `consent_records` |
| Weak-screen audit (read alongside this script) | `demo-weak-screens.md` |
| Brand system | `design-concepts/BRAND-IDENTITY.md` (deep teal `#0F766E`) |

---

*Prepared by Product Designer, Antum — pilot-ready demo script v3.0 (UAE-first, re-walked 2026-10-06 against `80c3fff`).*
