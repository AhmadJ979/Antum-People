# Antum People — Demo Weak-Screen Audit (UAE-first build)

> **Prepared by:** Product Designer, 2026-10-06
> **Build walked:** the deployment live on **2026-10-06** (`3cf625e` at the time of the walk), on a scratch instance — own port, own database, own throwaway credential (rule 14).
> The open items below are still open — two of them carry a design spec (items 1 and 2) so engineering can pick them up without another round-trip.
> **How verified:** the public URL was checked anonymously (200, title, sign-in screen renders — see the walkthrough script's verification note). Every screen behind the login was walked in a browser on a **scratch instance of the deployed build** (own port, own database, own throwaway credential), plus raw API reads. WORKFLOW rule 10 keeps the live demo credential with the lead, so no logged-in pass was run against the public URL. All figures are the seeded *sample* dataset.
> **Figure discipline:** accrual-derived figures — the EOSB liability total, the settlement's EOSB / Gross / Net, the forecast ladder — are recorded here as **dated readings**, never as expected values, because they move. Four reads of the builds deployed on 2026-10-06 gave four different UAE liability values: **85,126.34** (designer's first instance), **85,125.43** (lead's live pass, twenty minutes later), **85,129.04** (designer's re-seeded instance), **85,129.27** (designer's scratch instance of the deployment live that day). Counts and ratios did not wobble the same way, which is the split the walkthrough script now teaches.
> **Purpose:** the blunt list. If a prospect can click into a screen that is empty, placeholder-stuffed, or contradicts another screen, it is named here.

---

## Closed since the last audit (2026-09-27) — verified this session

**How to read this list:** every item carries the screen it was observed on and the date. Items marked **carried** were confirmed on an earlier pass and were **not** re-opened in this walk — they are closed on that earlier observation, not a fresh one, and belong on the next logged-in pass. Numbers that moved with the demo data (PR #52 restored the KSA records) are marked with the date they were read. "Closed" here means **seen on the screen**, not believed.

1. **Settlement Statement no longer renders as an unfilled template.** For the seeded UAE offboarding record it renders the engine's own figures (on 2026-10-06: EOSB 6,415.79, Gross Total 11,577.08, Net Payable 11,577.08, deductions 0.00), **zero `[placeholder]` tokens**, and uncomputable lines read **"not calculated"**. The document date is dynamic (rendered 6 October 2026, not a hard-coded date).
   - **Seen:** Employee Directory → Noura Al-Suwaidi → Compliance Center → **Settlement Statement**, opened 2026-10-06; the lead's logged-in pass the same day confirmed **zero `[placeholder]`** on this record. Those three figures are **readings of accrual-derived lines from that day** — the record's stored accrual was still 6,415.79 when re-read from the API on 2026-10-06, and the liability card it feeds moved four times the same day. Re-read before quoting.
2. **`GRANTED ON null` is gone.** The Compliance Center consent line renders the seeded consent date.
   - **Seen — carried, not re-opened on the screen today:** recorded from the 2026-09-27 pass. Today's walk did not re-open the consent line itself, so that observation stands on the earlier pass. **Build-level check today:** the compliance report re-read on 2026-10-06 returns **13 records, 13 consents granted, 0 null or empty consent dates**, so a `GRANTED ON null` line cannot render from this dataset. The shipped bundle also renders the line from the record's own `consent_date` field rather than a hard-coded value. Re-confirm the rendered line on the next logged-in pass.
3. **The offboarding checklist is the engine's list, not a hand-written stand-in.** The UAE record carries **8 tasks in the engine's order** (Hardware Return, Access Revocation → Notice Period Verification, EOSB Calculation (UAE), Annual Leave Encashment, MoHRE Work Permit Cancellation, Residency Visa Cancellation, Final Settlement Payment).
   - **Seen:** Employee Directory → Noura Al-Suwaidi → **Offboarding Checklist**, 8 rows in the engine's order, 2026-10-06 (screenshot `04-noura-offboarding.png`); the lead's live pass today counted the same 8 items.
4. **Retention cohorts compute from real leaver records.** On the UAE surface the cohorts read **H1 2022 100%, H1 2023 50%, H1 2024 100%, H2 2026 100%** (read 2026-10-06) — the 0% cohort that read as broken data is gone, and the H1 2023 50% is a real mixed outcome, not a lone leaver. Behind the surface, the unfiltered series still carries the KSA leavers (H1 2023 67%, H1 2024 80%), which is why the surface must stay the thing you demo.
   - **Seen:** Sidebar → **Strategic Intelligence** → Retention Lift — 1-Yr Cohort, 2026-10-06; the UAE surface values were confirmed independently on the lead's logged-in pass the same day, and the unfiltered series was re-read from the API on 2026-10-06.
5. **Onboarding Pipeline agrees with the data.** The UAE surface card lists **one person in flight — Omar**, who is also the only UAE record with incomplete onboarding tasks; Reem's record is KSA again, so she is not on this surface. The card is derived server-side, so it and the checklists cannot disagree.
   - **Seen:** Sidebar → **Executive Dashboard** → Onboarding Pipeline card, 2026-10-06 — one UAE record in onboarding, matching the single UAE onboarding checklist. Confirmed on the lead's logged-in pass the same day.
6. **Document-preview header over-claim removed.** The modal subtitle now reads **"Pilot-ready draft — subject to your counsel's review"** (it previously said "Legally Validated GCC Template").
   - **Seen — carried, not re-opened today:** the wording was changed in the document-preview modal and is owner-set; today's walk did not re-open the modal. **Build-level check today:** `Pilot-ready draft` and `subject to your counsel` are present in the shipped bundle and **`Legally Validated` is absent from it entirely** — the over-claim is gone from the built artefact, not merely edited in source. Re-confirm the modal itself on the next logged-in pass.
7. **"Forgot Password?" is no longer a dead end.** It opens the inline copy "To reset your password, contact your Antum administrator."
   - **Seen:** the `Forgot Password?` control on the sign-in screen, 2026-10-06 (screenshot `01-signin.png`). The inline copy itself is **carried** from the previous pass — not re-clicked today. **Build-level check today:** `contact your Antum administrator` is present in the shipped bundle. **Remaining check:** the inline copy as rendered — an automated click on `Forgot Password?` did not surface the panel in my pass, so this stays open rather than assumed.
8. **Money formatting is consistent.** Roster gratuity and the dashboard cards render a fixed 2 decimals (cost-per-hire read `AE 8,286.00 AED` on 2026-10-06; the liability card read four different values that day — `85,126.34`, `85,125.43`, `85,129.04`, `85,129.27` — same formatting, different day-sensitivity) instead of mixed 1/2-decimal raw output.
   - **Seen:** Employee Directory gratuity column and the Executive Dashboard cards, 2026-10-06. Cost-per-hire read `8,286` (AE) from the API that day, against `7,625` before the KSA records were restored — a good example of a figure that is stable *within* a deployment but not across one.
9. **Offboarding pipeline shows an exit date.** The departing record reads `Exit 2026-10-10`, not a blank after "EXIT".
   - **Seen:** Sidebar → **Executive Dashboard** → Offboarding Pipeline card, reading `Exit 2026-10-10` (screenshot `02-dashboard-ae.png`).
10. **"Day 193" is gone.** The ramping list now shows a plausible day count for the two in-flight hires.
   - **Seen:** the ramping / in-flight list, 2026-10-06 — a plausible day count per in-flight hire and no `Day 193`.

## Still open — ranked by how badly they'd land

### 1. The Settlement Statement header is still generic (and the figures are the reason it matters)
- **Screen:** Employee Directory → Noura Al-Suwaidi → Compliance Center → **Settlement Statement**.
- **What a prospect sees:** figures from the engine, above a header reading **"Jurisdiction: UAE / KSA"** and employer **"Antum Regional Hub"** (a placeholder), for a UAE employee.
- **Verdict:** Much improved — it is no longer a zero-filled template, so it can be opened in a demo. But the header still does not resolve to the employee's own jurisdiction or the client's entity, which is exactly what a careful buyer's counsel will look at first. Frame it as a draft template with live figures.
- **Design spec (mine to specify, engineering's to build) — what the header has to resolve:**
  1. **Employer line** — the client's own legal name. If the platform has no organisation/entity record to read it from today, that is engineering's first check; what must not happen is a hard-coded string that reads like a real company (today's **"Antum Regional Hub"** does — replace the *name* before the *layout* if you only get one of the two).
  2. **Jurisdiction line** — one jurisdiction, derived from the employee record, reading **"United Arab Emirates — Federal Decree-Law No. 33 of 2021"**. Never a two-jurisdiction string; this document is about one person under one law.
  3. **Employee block** — full name, employee ID, designation, contract start and end dates, each from the record, none typed.
  4. **A status chip on the document itself**, in the same wording already used in the Document Preview modal: **"Pilot-ready draft — subject to your counsel's review."** The artefact travels farther than the demo does; it must not arrive looking certified.
  5. **The EOSB line names its basis** (basic salary, UAE rule) and keeps the unconfirmed marker while the resignation tier is with counsel.
  - **Not verified:** which of these fields exist in the data model today. I specified the header, not the schema — that check is the first step on the engineering side.

### 2. Exit-interview data is still captured and never shown
- **Screen:** nowhere in the UI.
- **What a prospect sees:** nothing. The "Exit Intelligence Intake" form collects departure reason, preventable-attrition flag and offered salary; the API returns `exitsByReason` (read 2026-10-06, all jurisdictions: Better Opportunity 2, Career Change 1, Relocation 1) and **no view renders it** — and note that series is not jurisdiction-filtered.
- **Verdict:** A headline retention story with no visible backing. Say "Phase 2 view" if asked; the intake is already recording.
- **Design spec (Phase 2 view — direction, not available now):** surface `exitsByReason` as a small breakdown panel next to the Retention Lift card, on the same surface the cohorts already live on, labelled as sample data like everything else on the demo.
  - **Two series, not one:** departure **reason** and the separate **preventable-attrition** flag — a CHRO's first question is "was it avoidable?", not "why did they say they left".
  - **Empty state matters more than the chart here:** with no exit interviews recorded, the panel must read "No exit interviews recorded for this period" rather than render an empty axis. Nothing on this surface may look broken.
  - **The offered-salary field is third-party compensation data captured about a leaver.** My recommendation is to show it to HR leadership only, and to have the compliance expert confirm the PDPL position before it is surfaced at all.
  - **Phase 2 scope:** the preventability *trend* belongs to Layer 4 (Workforce Cost Intelligence); this demo needs only the breakdown, so build the small version.

### 3. The UAE offboarding showcase is shorter than the KSA one it replaces — and the contrast that carried the story is gone
- **Screen:** Employee Directory → Noura Al-Suwaidi → Offboarding Checklist.
- **What a prospect sees:** **8 steps** (2 operational + 6 legal/UAE-specific).
- **What the walkthrough lost:** the old flow leaned on a *side-by-side* contrast — "KSA accrues on total salary, UAE on basic salary" — which was the single clearest "we know your jurisdiction" moment. On a UAE-only surface there is no second jurisdiction on screen, so the basis is now stated on the record ("Basic Salary (UAE Rule)") rather than demonstrated by contrast.
- **Does the flow lose force?** Less than I expected. The UAE list is stronger on specifics a UAE buyer recognises — **MoHRE work-permit cancellation** and **residency visa cancellation** in the correct order — and the opening act now belongs to the buyer's own jurisdiction instead of a Saudi employee. What it loses is length and the comparative beat. **Do not pad it with claims to get the length back.** If you want the contrast, get it verbally ("the engine carries a second jurisdiction's basis for Phase 2"), not by switching the toggle mid-demo.

### 4. The retention card carries one genuinely negative cohort
- **Screen:** Strategic Intelligence → Retention Lift — 1-Yr Cohort.
- **What a prospect sees:** on the UAE surface the card reads **100% / 50% / 100% / 100%** (read 2026-10-06) — H1 2023 at 50% (lift −33%), the others at or near their illustrative benchmarks.
- **Verdict:** Not a defect. The 50% is a **real mixed outcome** — a cohort holding both a leaver and a stayer — rather than a single-leaver cohort that reads as broken data. It is the best available proof that cohorts come from real exit records. It *will* still be read as a negative story about the sample employer, so script the explanation (Caveat 4) rather than letting a CHRO discover it.

### 5. The roster carries a terminated record
- **Screen:** Employee Directory (UAE).
- **What a prospect sees:** the UAE surface serves **8 rows** — 5 active, 1 onboarding, 1 in offboarding and 1 badged **terminated**. (13 records are held in total: 8 UAE / 5 KSA; only the UAE rows appear here.)
- **Verdict:** Honest and required for the retention math, but a UAE buyer counting heads will see a small, partly historical roster. Know the numbers and say them before they are asked: **8 UAE records — 5 active, 1 onboarding, 1 offboarding, 1 leaver.** The all-jurisdiction active headcount (11) is not what this surface shows, so say the UAE number.

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
- **This contradicts the "generic 500s" hardening claim, and the generic handler does not cover this class of throw.** The generic 500 handler is app-level error middleware; a throw from the **CORS middleware runs before the route** and never reaches it, so Express's own default HTML error page is what comes back. So it is not only a blank page on a foreign host — the response body **discloses the stack and absolute filesystem paths** to any caller who sets one header (`.../server/index.js:29:16`, and `/home/team/shared/probable-octo-sniffle/server/node_modules/cors/...`).
- **Why it matters:** it is a hardening-claim contradiction, an internal-path disclosure, and a hard blocker the moment the product is served from **any other host** — `antum.ae`, a client's own domain, a forwarded port. The published demo works today only because its two hosts are allowlisted.
- **Independently reproduced by the lead** on a scratch instance of `80c3fff`: bad `Origin` → **500 with Express's default HTML error page**; allowlisted origin → 401 (correct); no origin → 401 (correct). **Filed as engineering task `08fa5d5c`.**
- **Hit again first-hand on 2026-10-06:** a browser pointed at a fresh scratch instance of the deployed build could not load the app at all — the shell arrived and the module request was rejected, leaving a **blank page** until the scratch copy's allowlist was patched by hand. Same symptom, no special conditions: this is what a custom domain gets on day one. Scratch only — the live allowlist was not touched.
- **Reproduction (scratch only):** `curl -H 'Origin: http://127.0.0.1:4713' <scratch>/api/employees` → 500. Same request with the allowlisted origin → 401 (correct).
- **Suggested direction (engineering call, not mine to make):** allow same-origin requests and any configured host, derive the allowlist from configuration rather than two hard-coded literals, and return a plain 403 instead of throwing into the error handler.
- **Filed as engineering task `08fa5d5c`** — the fix and its acceptance criteria live there, not in this audit.
- **Not verified against the live deployment** — I did not probe the live server with a bad origin, because that request class is what crashes or 500s it.

---

## If we only fix three things before the next demo

1. **Resolve the Settlement Statement header** to the employee's jurisdiction and the real entity name (item 1) — the figures are now good; the header is what a lawyer reads. **Spec attached above.**
2. **Close the `Origin` / blank-page / stack-trace hole** (new item A) — before any non-platform host, or any custom domain, is pointed at the product.
3. **Decide the KSA switch's visibility** (item 6) — a two-second answer that removes a recurring mid-pitch question.
