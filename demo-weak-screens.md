# Antum People — Demo Weak-Screen Audit (UAE-first build)

> **Prepared by:** Product Designer, 2026-10-06
> **Build audited:** deployed commit **`80c3fff`** (`main`, PRs #47–#51) — the commit the public URL serves (`/assets/index-CPYz_PZb.js`).
> **How verified:** the public URL was checked anonymously (200, title, sign-in screen renders — see the walkthrough script's verification note). Every screen behind the login was walked in a browser on a **scratch instance of the same commit** (own port, own database, own throwaway credential; the rendered bundle is the same file the public URL serves), plus raw API reads. WORKFLOW rule 10 keeps the live demo credential with the lead, so no logged-in pass was run against the public URL. All figures are the seeded *sample* dataset.
> **Purpose:** the blunt list. If a prospect can click into a screen that is empty, placeholder-stuffed, or contradicts another screen, it is named here.

---

## Closed since the last audit (2026-09-27) — verified this session

1. **Settlement Statement no longer renders as an unfilled template.** For the seeded UAE offboarding record it renders the engine's own figure (EOSB 6,415.79, Gross Total 11,577.08, Net Payable 11,577.08, deductions 0.00), **zero `[placeholder]` tokens**, and uncomputable lines read **"not calculated"**. The document date is now dynamic (renders 6 October 2026, not a hard-coded date).
2. **`GRANTED ON null` is gone.** The Compliance Center consent line renders the seeded consent date.
3. **The offboarding checklist is the engine's list, not a hand-written stand-in.** The UAE record carries **8 tasks in the engine's order** (Hardware Return, Access Revocation → Notice Period Verification, EOSB Calculation (UAE), Annual Leave Encashment, MoHRE Work Permit Cancellation, Residency Visa Cancellation, Final Settlement Payment).
4. **Retention cohorts compute from real leaver records.** UAE cohorts read H1 2022 100%, H1 2023 **50%** (lift −33), H1 2024 **80%** (lift −4), H2 2026 100% — no longer trivially 100% everywhere, and the one-person 0% cohort that read as broken data is gone.
5. **Onboarding Pipeline agrees with the data.** The card lists the same two people the onboarding checklists belong to (Omar, Reem); it is derived server-side, so the card and the checklists cannot disagree.
6. **Document-preview header over-claim removed.** The modal subtitle now reads **"Pilot-ready draft — subject to your counsel's review"** (it previously said "Legally Validated GCC Template").
7. **"Forgot Password?" is no longer a dead end.** It opens the inline copy "To reset your password, contact your Antum administrator."
8. **Money formatting is consistent.** Roster gratuity and the dashboard cards render a fixed 2 decimals (e.g. `AED 85,126.34`, `AE 7,625.00 AED`) instead of mixed 1/2-decimal raw output.
9. **Offboarding pipeline shows an exit date.** The departing record reads `Exit 2026-10-10`, not a blank after "EXIT".
10. **"Day 193" is gone.** The ramping list now shows a plausible day count for the two in-flight hires.

## Still open — ranked by how badly they'd land

### 1. The Settlement Statement header is still generic (and the figures are the reason it matters)
- **Screen:** Employee Directory → Noura Al-Suwaidi → Compliance Center → **Settlement Statement**.
- **What a prospect sees:** figures from the engine, above a header reading **"Jurisdiction: UAE / KSA"** and employer **"Antum Regional Hub"** (a placeholder), for a UAE employee.
- **Verdict:** Much improved — it is no longer a zero-filled template, so it can be opened in a demo. But the header still does not resolve to the employee's own jurisdiction or the client's entity, which is exactly what a careful buyer's counsel will look at first. Frame it as a draft template with live figures.

### 2. Exit-interview data is still captured and never shown
- **Screen:** nowhere in the UI.
- **What a prospect sees:** nothing. The "Exit Intelligence Intake" form collects departure reason, preventable-attrition flag and offered salary; the API returns `exitsByReason` (UAE: Better Opportunity 1, Career Change 1, Relocation 1) and **no view renders it**.
- **Verdict:** A headline retention story with no visible backing. Say "Phase 2 view" if asked; the intake is already recording.

### 3. The UAE offboarding showcase is shorter than the KSA one it replaces — and the contrast that carried the story is gone
- **Screen:** Employee Directory → Noura Al-Suwaidi → Offboarding Checklist.
- **What a prospect sees:** **8 steps** (2 operational + 6 legal/UAE-specific).
- **What the walkthrough lost:** the old flow leaned on a *side-by-side* contrast — "KSA accrues on total salary, UAE on basic salary" — which was the single clearest "we know your jurisdiction" moment. On a UAE-only surface there is no second jurisdiction on screen, so the basis is now stated on the record ("Basic Salary (UAE Rule)") rather than demonstrated by contrast.
- **Does the flow lose force?** Less than I expected. The UAE list is stronger on specifics a UAE buyer recognises — **MoHRE work-permit cancellation** and **residency visa cancellation** in the correct order — and the opening act now belongs to the buyer's own jurisdiction instead of a Saudi employee. What it loses is length and the comparative beat. **Do not pad it with claims to get the length back.** If you want the contrast, get it verbally ("the engine carries a second jurisdiction's basis for Phase 2"), not by switching the toggle mid-demo.

### 4. Two cohorts read negative lift
- **Screen:** Strategic Intelligence → Retention Lift — 1-Yr Cohort.
- **What a prospect sees:** H1 2023 at 50% (lift −33%) and H1 2024 at 80% (lift −4%) against illustrative benchmarks.
- **Verdict:** Not a defect — it is the honest, computed version, and it is the best available proof that cohorts come from real exit records. But it *will* be read as a negative story about the sample employer, so script the explanation (Caveat 4) rather than letting a CHRO discover it.

### 5. The roster carries two terminated records
- **Screen:** Employee Directory (UAE).
- **What a prospect sees:** 10 UAE rows, two of them badged **terminated**, alongside the in-flight offboarding case.
- **Verdict:** Honest and required for the retention math, but a UAE buyer counting heads will see "10 employees, 2 already gone". Know the number (8 active, 2 onboarding, 1 offboarding, 2 historical leavers) and say it before it is asked.

### 6. The KSA switch is visible in the header
- **Screen:** every screen, header right.
- **Verdict:** An open owner decision (keep visible vs testing-only flag). It is not a defect, but it invites the question "so do you do Saudi?" mid-UAE pitch. Leave it alone and answer verbally.

### 7. Every card still carries "Illustrative" / "Illustrative Benchmark" / "Illustrative Total"
- **Screen:** Executive Dashboard, Strategic Intelligence.
- **Verdict:** Deliberate and owner-mandated (the labels stay). It slightly undersells the computed figures, so own the distinction out loud: the *number* is computed, the *comparison* is a placeholder.

---

## New this session — not a screen, but it can take the demo down

### A. An unlisted `Origin` gets a **500 with a stack trace**, and the app renders **blank** on any host that is not on the two-item allowlist
- **What I observed:** on a scratch instance of the deployed commit, a request carrying `Origin: http://127.0.0.1:4713` (any host other than the two platform preview origins) is answered **HTTP 500** with Express's default HTML error page — including a **full stack trace and internal file paths** — instead of a clean 403. Because the built `index.html` loads its bundle with a `crossorigin` attribute, a browser on any other origin gets the HTML (200) and then a **blank white page**, since the module request is the one that is rejected.
- **Why it matters:** it contradicts the "generic 500s" hardening claim, it leaks internal paths, and it is a hard blocker the moment the product is served from **any other host** — `antum.ae`, a client's own domain, a forwarded port. The published demo works today only because its two hosts are allowlisted.
- **Reproduction (scratch only):** `curl -H 'Origin: http://127.0.0.1:4713' <scratch>/api/employees` → 500. Same request with the allowlisted origin → 401 (correct).
- **Suggested direction (engineering call, not mine to make):** allow same-origin requests and any configured host, derive the allowlist from configuration rather than two hard-coded literals, and return a plain 403 instead of throwing into the error handler.
- **Not verified against the live deployment** — I did not probe the live server with a bad origin, because that request class is what crashes or 500s it.

---

## If we only fix three things before the next demo

1. **Resolve the Settlement Statement header** to the employee's jurisdiction and the real entity name (item 1) — the figures are now good; the header is what a lawyer reads.
2. **Close the `Origin` / blank-page / stack-trace hole** (new item A) — before any non-platform host, or any custom domain, is pointed at the product.
3. **Decide the KSA switch's visibility** (item 6) — a two-second answer that removes a recurring mid-pitch question.
