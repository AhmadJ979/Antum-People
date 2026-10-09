# Antum People — Demo Weak-Screen Audit (UAE-first build)

> **Prepared by:** Product Designer · **re-grounded 2026-10-08** (first version 2026-10-06) · **re-read post-cutover 2026-10-09** · revision walked: `origin/main` = `2584361`
> **Two surfaces, both named, because the answer differs.** **(1) The live surface a prospect sees today** — read anonymously on 2026-10-08: the public URL serves the Layer 1 product only (bundle `assets/index-Cwq9dzzZ.js`, 258,648 bytes; it carries the pre-boarding tab's P2-2 strings and **none** of the pre-reading package's or the 48-hour chip's). **(2) The tree the next cutover carries** — `origin/main` = `2584361`, walked the same day on an isolated scratch instance: own port, own database, own throwaway credential (WORKFLOW rule 14). The live tree was never logged into, never written to, and answered 200 before and after the pass.
> **Why two surfaces matter:** Layer 2's pre-boarding cases, the derived 48-hour chip, the jurisdiction-scoped roll-up and the pre-reading package are **merged to `main` and deliberately not on the live surface**. One cutover lands them together, and it is held on one owner ruling (demo case 1 — see item 8). Nothing in this document may be read as "the demo shows it" when only `main` has it.
> **Dated correction, 2026-10-09 — the workspace track.** **P2-4 merged as PR #86** (`main` = `b7630cb`) *after* this walk. The **four statements below that said the workspace track is "not built" are false** and are corrected in place; the walk itself, its revision (`2584361`), and every figure it read stand exactly as taken, because none of them moved. What changed is only what the track **is**: built and merged — and, on that day, *not cut over*, so the live surface and the demo cases looked as they did on the walk. *(Superseded later the same day: the cutover ran — see the next note.)*
> **Dated correction, 2026-10-09, post-cutover — the two surfaces are one, and the flagged counts moved.** **The public URL now serves the product itself.** Measured off the served surface at 11:55–11:58 UTC on 2026-10-09: the public URL's HTML and `127.0.0.1:3000` carry the **same bundle** (`assets/index-B3KoM02v.js`, 269,188 bytes, and the same `assets/index-LszozVg.css`), and `GET /api/preboarding/checklist/overview?jurisdiction=AE` on the **public** URL answers the product's own `401 {"error":"Authentication token required"}` — a client bundle's strings cannot produce that answer. So every **"not on the live surface" / "lands at the cutover"** statement below is **history from before the cutover**, kept because it records how the surface was verified — not because it is still true. **The figures moved with it:** the flag counts every item on a case, so with the cases' provisioning lines now seeded its per-case count reads **22 / 21 / 21**, where this walk read 7 — the same rule over a bigger board. Current figures, and who read them, are in **"The counts on the served surface"** below. Where this document and that section disagree, that section is the newer read. **Also closed on 2026-10-09:** the demo case-1 question this frame says the cutover was "held on" is **decided** — the owner ruled **option (a), leave case 1 as seeded** — so the cutover is no longer held on anything, and the "see item 8" pointer in that frame is stale (the items were renumbered on 2026-10-08; the case-1 box now lives in `demo-walkthrough-script.md`, and the roster half of it is item 5 here). **Updated for the second cutover, 2026-10-09 12:34 UTC:** the served tree moved `2028894` → `0dd1a97` (the accessibility fix, #109) and the bundle is now **`assets/index-gt1pFhU5.js`, 270,523 bytes** with `assets/index-BLszozVg.css` — read anonymously off the public URL (HTTP 200, `<title>Antum People</title>`, and it carries the a11y attributes). The reading above stands as the measurement of the 10:46 tree; what it claims — that both surfaces carry the *same* bundle — is still true, and is still the point. **Updated for the third cutover, 2026-10-09 13:46 UTC:** the served tree moved `0dd1a97` → `da3330d` (the All-chip rendering-race fix, #119) and the bundle is now **`assets/index-B8Hoaanh.js`, 270,982 bytes, md5 `abfe49feb21dc90b77743922f76a7399`**, with the stylesheet **unchanged** at `assets/index-BLszozVg.css`; the demo was re-seeded at **13:46:16 UTC** and reproduces the same figures. Read anonymously, HTTP 200 from both the public URL and `127.0.0.1:3000`, byte-for-byte the same file from each.
> **How verified:** every claim below was observed in this session — screens read in a browser on the scratch instance (screenshot + rendered text kept beside this file), counts and figures read from the product's own API, the public URL read anonymously. Nothing is carried forward from the 2026-10-06 version without re-checking it, and every re-checked item says what changed if anything did.
> **Figure discipline:** accrual-derived figures move — the EOSB liability card read **85,249.00 AED** on this pass (it read 85,126.34 / 85,125.43 / 85,129.04 / 85,141.22 across five reads on 2026-10-06), and the settlement's EOSB line read **6,415.79** again. Counts, statuses and cohorts did not wobble. Re-read before quoting.
> **Purpose:** the blunt list. If a prospect can click into a screen that is empty, placeholder-stuffed, or contradicts another screen, it is named here.

---

## The short version

- **The audit's job is being done:** of the 10 items closed on 2026-10-06, **10 re-checked clean today**, and of the Layer 2 findings raised since, **four are already fixed** (item F1–F4 below) — including the row that printed a bare **`· -1 d`**.
- **Three things a prospect can see today, still open:** the settlement statement's header still reads **"Jurisdiction: UAE / KSA"** with employer **"Antum Regional Hub"** for a UAE employee (item 1); exit-interview data is captured and **nothing renders it** (item 2); the sign-in screen still calls the product an **"HR Onboarding/Offboarding Intelligence Platform"** (item 8, new).
- **Three new findings this pass — and one of the three is a reclassification rather than a new screen.** The sign-in screen still calls the product an **"HR Onboarding/Offboarding Intelligence Platform"** (item 8, new). The roster's **unguarded day-count arithmetic** prints a negative day for a future-dated hire (item 9, new *as a reclassification*: the 2026-10-06 audit listed the `Day 193` symptom as closed, and what this pass found is that the arithmetic behind it has no floor). The EOSB forecast carries an all-zero **`KSA: 0.00 SAR`** column on the UAE surface (item 10, new). None of the three is visible on today's demo data — and the pre-boarding hires (+1 d, +14 d) are exactly the records that would make item 9 visible.
- **One item is not a defect and should not be "fixed":** the H1 2023 cohort at 50% (item 4). It is the only proof on screen that cohorts come from real leaver records.
- **The honest limits stay on the document, not hidden in it:** no delivery channel, no hire-facing portal, an acknowledgement is an in-product record and **not** an e-signature, and the workspace track (IT/Admin/HR/Manager checklists) is **built, merged, cut over and seeded** *(corrected 2026-10-09, twice: P2-4 merged as PR #86, then the cutover ran the same day and the three demo cases now carry 15 / 14 / 14 provisioning lines)*.

## What the next cutover changes for a prospect

| On screen | Before 2026-10-09 (the 2026-10-08 walk, on the then-live Layer 1 build) | **On the served surface now** (2026-10-09, post-cutover — figures in "The counts on the served surface" below) |
| --- | --- | --- |
| Pre-boarding tab | the P2-2 employee-track checklist, **zero cases** | **three seeded cases**, one per state — each with its employee track (**7 items**) and its **provisioning lines derived from the case's own role and department** (**15 / 14 / 14**) |
| The 48-hour flag | absent | a derived chip per row, counting **every item on the case, both tracks**: ⚪ `On track` (**22 items open**) · 🟠 `Inside 48 hours · 21 items open` · 🔴 `Started 1 day ago · 21 items open` — the walk read **7** on these same cases, before their provisioning lines existed |
| Row distance copy | absent | `· 14 d` · `· 13.2 h before 00:00 on the start date` · `· started 1 d ago` — **the hours value is time-of-day-sensitive: read yours off the screen** (the walk's 14.6 h and the 2026-10-09 pass's 13.153 h are the same row at different clock times) |
| HR roll-up totals | absent | header **`3 CASES OPEN`** · **21 items outstanding** (employee track only) · 0 verified · 3 without consent — **and, separately, the workspace track's 43 lines open** (15 + 14 + 14). The payload keeps them as two fields (`items_outstanding` = 21, `workspace_lines_open` = 43) and the screen keeps them apart; **never add them into one "64 outstanding"** |
| Pre-reading package | absent | 9 items per case, 2 requiring an acknowledgement, **no delivery channel** |
| Everything in Layer 1 | yes | unchanged |

## The counts on the served surface (read 2026-10-09, post-cutover)

Three seeded cases, one per flag state, **as seeded 2026-10-09** — twice that day: **10:46 UTC** (the morning cutover, tree `2028894`) and again at **12:34:14** after the **second cutover** (tree `0dd1a97`, the accessibility fix #109), and a **third at 13:46:16** after the **third cutover** (tree `da3330d`, the All-chip race fix #119) — all three seeds agreeing figure-for-figure.
**Evidence basis for the All-chip fix (#119), stated so no reader assumes a photograph exists.** The
fix's evidence is the **machine-scored samples** in the engineer's pack
(`docs/evidence/all-chip-race-2026-10-09/`, e.g. `after-samples.json` — the per-tick chip row and group
headers). The **race-window shot taken with the fix is not captured**, and the frame once published as the
fixed state was the **defect** state: it is withdrawn, renamed and kept as
`withdrawn-after-2-race-window-DEPICTS-DEFECT-STATE.png` (no longer under `shots/`). So what stands for
#119 is the samples, not an image — read `after-samples.json`, and treat any screenshot in this repository
as evidence for the *fix* only if it carries its own script src per the pack's own rule.
 Every figure below belongs to that day's seed and to no other. Read off the served surface by the **engineer's rendered pass at 10:52–10:56 UTC on 2026-10-09** (raw payloads committed under `docs/evidence/p2-4-served-pass/`, merged in #103 as `693325d`; **I did not re-run that pass**; the bundle and endpoint readings in the note at the top of this file are mine, taken at 11:55–11:58 UTC the same morning).

| Case | Hire · role | Start | Flag chip | The flag's own count | Employee track | Workspace track (derived from role + department) |
|---|---|---|---|---|---|---|
| `OFR-2026-DEMO-03` | Yousef Al-Hammadi · Operations Analyst | 2026-10-08 | 🔴 `Started 1 day ago · 21 items open` | **21** | 7 items · 0 complete · 7 outstanding | 14 lines (IT 5 · Admin 3 · HR 2 · Manager 4) · 14 open · **14 overdue** |
| `OFR-2026-DEMO-02` | Mariam Al-Kaabi · Marketing Coordinator | 2026-10-10 | 🟠 `Inside 48 hours · 21 items open` | **21** | 7 items · 0 complete · 7 outstanding | 14 lines (IT 5 · Admin 3 · HR 2 · Manager 4) · 14 open · **7 overdue** |
| `OFR-2026-DEMO-01` | Omar Al-Farsi · Finance Analyst | 2026-10-23 | ⚪ `On track` | **22** | 7 items · 0 complete · 7 outstanding | **15 lines** (IT 6 · Admin 3 · HR 2 · Manager 4) · 15 open · 0 overdue |

Roll-up totals for the jurisdiction (`payload-overview-ae.json`): `cases` 3 · `items_outstanding` **21** · `items_received` 0 · `items_verified` 0 · `cases_without_consent` **3** · `cases_ready` 0 · `workspace_lines` **43** · `workspace_lines_open` **43** · `cases_provisioned` 0.

**Why case 01 reads 22 and not 21 — and why the flag's number is not the employee-track number.** The flag covers **every item on the case, whatever track created it**: 7 employee documents **+** the case's own provisioning lines. Case 01 derives **15** lines (its `profile_keys` include `finance_department`); the other two derive 14. That the lines are *derived from the case* rather than shipped as a template is the whole point of P2-4 — and it is what makes one case's board one line bigger than its neighbours'.

**The two figures that must never be printed as one number.** The roll-up's **21 items outstanding** is the employee track across three cases (7 × 3). The workspace track's **43 lines open** is 15 + 14 + 14. They arrive as two separate fields and the screen keeps them separate; a document that adds them into "64 outstanding" would be inventing a number the product does not compute, and would hand an HR lead one problem where the product models two, owned by different people. **Read one, name which one it is, then read the other.**

**And the flag records; it does not deliver.** `delivery: "none"`; two boundaries recorded (the two cases that crossed the line), each marked **late** in its own record (34.77 h and 82.77 h) because the process was down when they fell — recorded late, and the record says so. Nothing was sent anywhere.

**Flag copy, verbatim (2026-10-09 seed).** Case 01 — *"22 items still open, with 14 days to go — the flag starts 48 hours before the start date."* · Case 02 — **body empty**, headline *"21 items open · start in 48 hours or less"* · Case 03 — *"These were due before day one."*

**Shelf life, and the rule that goes next to these figures.** Everything above describes the **2026-10-09 seed**, taken three times that day (10:46, 12:34:14 and 13:46:16, agreeing figure-for-figure). Case 02's amber window closes at **00:00 UTC on 2026-10-10 — 04:00 GST**; after that it reads `started` like case 03 and the demo has **no amber at all**. So: **re-seed before any demo on or after 2026-10-10**, and re-read every figure in this section afterwards — a re-seed moves the start dates, and therefore every count derived from them. The walkthrough script carries the same warning where its spoken figures sit: **re-check those figures against a freshly seeded instance before any demo that is not run on one.**

**And do not resolve the consent label.** The live endpoint answers `{"consent": null}` on all three cases, so the demo's own **"3 WITHOUT CONSENT"** wording is still true today. Owner decision 14 — consent versus a notice acknowledgement — is **open**, so this document keeps the label accurate and leaves the decision alone.

**Say which surface you are showing.** The cutover has run, so the pre-boarding segment may be demoed from the public URL — but **re-read the counts on the day**: they are seeded, and a re-seed moves every derived figure. Check the header reads **3 CASES OPEN** before you start.

## This audit and the walkthrough script say the same thing — and here is the mapping

Two documents describing the same weak screens differently is a credibility problem in front of a prospect who has both, so the mapping is stated rather than left to the reader. The walkthrough script (`demo-walkthrough-script.md`, v4.0) carries the same findings in its **Caveats & guardrails** list; this audit is the longer form and carries the measurement behind each one.

| This audit | Walkthrough script | Agreement |
| --- | --- | --- |
| 1 — settlement header generic (`UAE / KSA`, `Antum Regional Hub`) | Caveat 5 | same fact, same reading date; the audit adds that the waiver clause names the placeholder twice more and that the document carries **no EOSB-basis line and no counsel marker** |
| 2 — exit-interview data never surfaced | Caveat 8 | identical, including the client-only-as-a-type detail (`App.tsx:224`) and today's `exitsByReason` reading |
| 3 — UAE offboarding 8 steps vs KSA 10 | Caveat 10 | identical |
| 4 — H1 2023 at 50% (lift −33%) | Caveat 4 | identical |
| 5 — roster 8 rows (5/1/1/1) and the pre-hire in the headcount | Caveat 11 | identical |
| 6 — the KSA switch is visible | Caveat 12 | identical (leave the controls alone; answer verbally) |
| 7 — "Illustrative" labels | Caveat 3 | identical |
| 8 — the sign-in line undersells the platform | **added to the script's list this session (Caveat 15)** | new finding; the script now carries it |
| 9 — roster day count unguarded (`Day -n`) | Caveat 11 (last paragraph) | **new as a reclassification**: the 2026-10-06 audit listed the `Day 193` symptom as *closed*, so what is new is that the arithmetic behind it has no floor — same finding and same seed behaviour as the script's line, which now also names `2584361` as the revision it was re-read on |
| 10 — the forecast's all-zero `KSA: 0.00 SAR` column | **added to the script's list this session (Caveat 16)** | new finding; the script now carries it |
| F1–F4, the chip, the package | Caveats 13 and 14, and Segment 3 | same limits in the same words: no delivery channel, no hire-facing portal, nothing "sent", an acknowledgement **recorded in the product** |

**One script line was corrected to match this audit's measurement.** The script's provenance table listed the Compliance Center's **"Basic Salary (UAE Rule)"** line as *carried from 2026-10-06 and not re-opened on this pass*. It **was** re-opened on the screen on 2026-10-08 — it renders on the offboarding record's Compliance Center (`App.tsx:1337`) — so the script now says so, and the audit carries the reading.

---

## Closed and re-checked this session (`main` = `2584361`, 2026-10-08)

Each item was re-opened this pass rather than restated. "Closed" means **seen on the screen** (or read from the product's own payload), not believed.

1. **The Settlement Statement renders the engine's own figures with no placeholders.** For Noura Al-Suwaidi (UAE, offboarding) the document reads Monthly Salary (Pro-rated) **5161.29**, EOSB **6415.79**, Gross Total **11577.08**, Total Deductions **0.00**, **NET PAYABLE AMOUNT: 11577.08**; uncomputable lines read **"not calculated"** (3 of them: leave encashment, notice pay, ticket allowance); **zero `[placeholder]` tokens**; the date renders dynamically as **8 October 2026**; employee name and ID come from the record.
   - **Seen:** Employee Directory → Noura Al-Suwaidi → Compliance Center → Settlement Statement, opened on the scratch instance 2026-10-08 (screenshot `06-settlement-modal.png`). The figures are accrual-derived — re-read before quoting.
2. **`GRANTED ON null` is gone.** The Compliance Center consent line reads **"✓ GRANTED ON 2026-09-23"**.
   - **Seen:** same screen, 2026-10-08. **Backed by the dataset:** the compliance report returns **`total: 13, consentGranted: 13`** — 13 records, 13 consents, so a null consent date cannot render from this data.
3. **The offboarding checklist is the engine's list, in the engine's order.** The UAE record carries **8 steps**: Hardware Return → Access Revocation → Notice Period Verification → **EOSB Calculation (UAE)** → Annual Leave Encashment → **MoHRE Work Permit Cancellation** → **Residency Visa Cancellation** → Final Settlement Payment (within 14 days).
   - **Seen:** rendered on the Compliance Center screen, 2026-10-08, and read from `/api/employees/demo-emp-noura/offboarding` the same minute. Item 3 below is about the same list.
4. **Retention cohorts compute from real leaver records and still read 100 / 50 / 100 / 100.** On the UAE surface: H1 2022 **100%** (lift +18), H1 2023 **50%** (lift −33), H1 2024 **100%** (+16), H2 2026 **100%** (+19), each against an explicitly labelled illustrative benchmark (82/83/84/81). The unfiltered series is wider (H1 2023 67%, H1 2024 80%, H2 2022–2023 100%) — **the UAE surface is the one to demo.**
   - **Seen:** Strategic Intelligence → Retention Lift — 1-Yr Cohort, 2026-10-08 (screenshot `08-strategic.png`); series re-read from `/api/analytics/dashboard` both filtered and unfiltered.
5. **Onboarding Pipeline agrees with the data.** One UAE record in flight — Omar Al-Farsi, `Started 2026-08-20`, and his onboarding checklist is **7 tasks, 2 done**. The card is derived server-side, so card and checklist cannot disagree.
   - **Seen:** Executive Dashboard → Onboarding Pipeline, and the checklist via API, 2026-10-08.
6. **Document-preview header over-claim removed, and now confirmed on the screen (not the bundle).** The modal subtitle reads **"PILOT-READY DRAFT — SUBJECT TO YOUR COUNSEL'S REVIEW"**; **"Legally Validated" appears nowhere** — not in the rendered modal, not in the shipped bundle.
   - **Seen:** Compliance Center → Document Previews → Settlement Statement, 2026-10-08 (screenshot `06-settlement-modal.png`). The 2026-10-06 pass left this to a bundle grep; this pass closed it on the screen.
7. **"Forgot Password?" is no longer a dead end, and the copy is confirmed rendered.** Clicking it shows **"To reset your password, contact your Antum administrator."**
   - **Seen:** the sign-in screen, clicked this pass, 2026-10-08 (screenshot `10-signin-forgot.png`). The 2026-10-06 pass could not surface the panel; it is settled.
8. **Money formatting is consistent.** Roster gratuity and dashboard cards render fixed 2 decimals — `AED 7,686.07`, `AED 36,541.96`, cost-per-hire **8,286.00 AED**, liability **85,249.00 AED**. The settlement's EOSB line matches the roster's accrued figure for the same person (6,415.79 both places) — the two screens agree, which is the check that matters.
   - **Seen:** Employee Directory and Executive Dashboard, 2026-10-08; values re-read from the API the same minute.
9. **Offboarding pipeline shows an exit date.** The departing record reads **`Exit 2026-10-10`**, not a blank.
   - **Seen:** Executive Dashboard → Offboarding Pipeline, 2026-10-08 (screenshot `01-dashboard.png`).
10. **"Day 193" is gone — but the arithmetic behind it is not guarded.** The in-flight hire renders a plausible count (Omar: Day 49). The formula is still `Math.ceil((now − start_date) / 24h)` with no floor (`App.tsx:1383`), which is why it can go negative — see **item 9**, where the arithmetic is newly known to be unguarded (the audit that closed `Day 193` did not know that).
    - **Seen:** day counts computed for all 8 UAE rows this pass (49, 859, 911, 966, 997, 1272, 1308, 1682); formula read in the client at `App.tsx:1383`.

### Also closed: the `Origin` / blank-page / stack-trace hole (2026-10-06, re-checked anonymously today)

- **Re-checked 2026-10-08, anonymously, on the live public URL:** a request carrying a **non-allowlisted `Origin` gets a deliberate `403 {"error":"Forbidden"}`** — no stack, no filesystem paths; **no token keeps the 401 contract**; **root serves 200**. Same contract on the scratch instance.
- **Still true and worth knowing:** an `access-control-allow-origin` value echoed at the public URL is the **platform proxy's**, not ours.

---

## Fixed since the last audit — the Layer 2 findings, and what found them

These are the audit doing its job. Each was found by re-reading running code against the spec, and each is now closed — which is the evidence that a prospect should care about.

| # | What was wrong | Fixed by | What it reads now (measured 2026-10-08, `main` = `2584361`) |
| --- | --- | --- | --- |
| **F1** | The pre-boarding case list was the one screen **not** scoped to the header's jurisdiction — a UAE header could list KSA cases | PR #70 (`5ed731e`); owner decision 2026-10-07 to scope the list and keep the row's chip | the list call carries `?jurisdiction=AE&status=open` (`App.tsx:518`). **Proved on the scratch database this pass:** the seeded demo holds AE cases only, so a filtered and an unfiltered read agree by construction — so one **SA** case was opened through the product's own path and the reads then differ: `?jurisdiction=AE` → **3 cases**; unfiltered → **4** (the three AE plus `AUDIT-KSA-CHECK-01/SA`). The filter does its job (`06-scope-probe.txt`) |
| **F2** | The tile labelled **"Cases open" counted rows**, not open cases | PR #70 (`5ed731e`) | the tile reads from the same endpoint it counts (comment at `App.tsx:516`); screen reads **3 / CASES OPEN** with exactly three rows beneath |
| **F3** | The breadcrumb spelled the tab differently from the nav (`Preboarding Panel`) | PR #70 (`5ed731e`) | sidebar and breadcrumb read one list; screen reads **Pre-boarding** in both |
| **F4** | The roll-up row printed a **bare negative day count** (`· -1 d`) for a case already started | PR #77 (`one-distance rule`), documented in the spec | the row reads **`· started 1 d ago`** for the started case, **`· 14 d`** for the clear case and **`· 14.6 h before 00:00 on the start date`** for the inside-48-hours case — one derivation, absolute, never signed |

**Two Layer 2 capabilities landed with the cutover** (both read on the scratch instance on 2026-10-08; both **on the served surface since 2026-10-09** — figures in "The counts on the served surface" above):

- **The 48-hour chip (P2-5)** — derived on every read from the start date and **every item on the case**, never stored; clears itself when the last item is collected; **no dismiss and no snooze**. The row's own distance comes from the same derivation (F4). **Seen on screen** (screenshot `02-preboarding-collapsed.png`, the 2026-10-08 walk): 🔴 **"Started 1 day ago · 7 items open"** / 🟠 **"Inside 48 hours · 7 items open"** / ⚪ **"On track"**, with headlines *"Started with 7 items still open"*, *"7 items open · start in 48 hours or less"*, *"On track"*, and the row lines `· started 1 d ago` / `· 14.6 h before 00:00 on the start date` / `· 14 d`. **Those counts have moved:** on the served surface on 2026-10-09 the same three chips read **22 / 21 / 21**, because the cases now carry their provisioning lines. The wording is the rule; the number is a reading — **take it off the screen.**
- **The pre-reading package (P2-3)** — 9 items per case, of which **2 require an acknowledgement** (signed JD, NDA). Read this pass from the case's own package payload (`/api/preboarding/cases/<id>/package`), which is what the strip renders; the automated pass did not expand a row to the package strip itself, so the strip's rendered copy is **not** claimed from this pass. Per the payload: every item states its own honest non-state, **"Not sent — this release has no delivery channel (no mailer, webhook or SMS), so the product cannot deliver this item"** and **"Not tracked — there is no hire-facing portal in this release, so no read event exists to record"**, and an acknowledgement is recorded **in the product, by the signed-in user, on the hire's behalf** — an in-product record, **not** an electronic signature, with signature-implying methods refused by name.
- **The roll-up's coverage sentence was corrected by P2-4 — and the client caught up before the cutover.** The server's one canonical note now reads: *"Derived from every item on this case, whatever track created it: the employee track's documents and the workspace track's provisioning lines both count, because both are items on the case."* (`server/preboarding-flag.js:48`–`:50`, with the correction and the sentence it replaced recorded at `:43`). **The client now renders the server's single sentence instead.** The engineer's row `83c22f60` landed (with the filter fix, #100) and the cutover carries it: **measured on the served bundle on 2026-10-09, `is not built yet` occurs 0 times** (`assets/index-B3KoM02v.js`, 269,188 bytes) — **and 0 again on the bundle serving now, re-read by the designer on 2026-10-09: `assets/index-B8Hoaanh.js`, 270,982 bytes, md5 `abfe49fe…` (`grep -c` over the bytes as fetched).** *(This bullet previously quoted the stale string and asked to be re-read when the fix landed. It landed, so the quote is deleted rather than dated again.)* *(Corrected twice, 2026-10-09: first when it was noticed that the quoted string was not credibility — it was a sentence the product no longer meant, while the rule underneath it never changed; then when the fix landed and the quote itself became obsolete. Both halves are now settled on the served surface.)* *(A second cutover ran later the same day, 12:34 UTC, and a third at 13:46 UTC; "before the cutover" here is the 10:46 run, and the client on the current served bundle is newer than both.)*

---

## Still open — ranked by how badly they'd land

### 1. The Settlement Statement header is still generic (and the artefact travels)
- **Screen:** Employee Directory → an offboarding record → Compliance Center → **Settlement Statement**.
- **What a prospect sees:** engine figures and a 2-decimal net total, above **"Jurisdiction: UAE / KSA"** and employer **"Antum Regional Hub"** — for a UAE employee. The waiver clause in section 4 names the same placeholder twice more, so the artefact a prospect's counsel reads **looks like a template that has not been filled in**, at the point where it is most persuasive.
- **Verdict:** unchanged from 2026-10-06 and still the first thing a lawyer looks at. Frame it out loud as a draft template with live figures, and say that the header resolves to the client's entity once registration and the entity record exist (IFZA registration is a hard gate on signing).
- **Design spec (mine to specify, engineering's to build) — unchanged, still the ask:** (1) employer line from the client's own entity record, never a name that reads like a real company; (2) **one** jurisdiction, derived from the employee record, reading *"United Arab Emirates — Federal Decree-Law No. 33 of 2021"*; (3) employee block from the record; (4) the status chip on the document itself in the wording already shipped in Document Preview — **"Pilot-ready draft — subject to your counsel's review"**; (5) the EOSB line names its basis. **Confirmed this pass:** the Compliance Center does render **"Basic Salary (UAE Rule)"** as the EOSB basis (`App.tsx:1337`), but the **document itself carries no basis line and no counsel marker at all** — so 5 is still open, on the artefact that travels.

### 2. Exit-interview data is still captured and never shown
- **Screen:** nowhere in the UI.
- **What a prospect sees:** nothing. The API returns `exitsByReason` for the surface the demo uses — **Career Change 1, Better Opportunity 1** (unfiltered: Better Opportunity 2, Career Change 1, Relocation 1) — and **no view renders it**.
- **Re-checked this pass:** `exitsByReason` appears in the client exactly once, as a TypeScript type (`App.tsx:224`); no component reads it. Filed, still open.
- **Verdict:** a headline retention story with no visible backing. Say **"Phase 2 view"** if asked; the intake is already recording. The design direction from the 2026-10-06 spec stands: a small breakdown panel beside Retention Lift, departure reason **and** the separate preventable-attrition flag, a real empty state ("No exit interviews recorded for this period"), and the offered-salary field shown to HR leadership only — with the compliance expert confirming the PDPL position before it is surfaced at all.

### 3. The UAE offboarding showcase is shorter than the KSA one it replaces
- **Screen:** Employee Directory → an offboarding record → **Offboarding Checklist**.
- **What a prospect sees:** **8 steps**, 2 operational + 6 UAE-specific. The KSA list is **10 steps** and is not on screen on the UAE surface.
- **Re-checked this pass:** both counts read from the API the same minute (UAE 8, KSA 10; the KSA list adds GOSI De-registration, Iqama Cancellation/Transfer, Final Exit Visa and Service Certificate Issuance, and drops MoHRE/Residency Visa). The old flow's *side-by-side* "UAE accrues on basic salary, KSA on total salary" contrast is gone with it, and the basis is now stated on the record instead of demonstrated.
- **Verdict:** not a defect — the UAE list is stronger on specifics a UAE buyer recognises, and the order is right. **Do not pad it with claims to get the length back.** If the contrast is wanted, get it verbally.

### 4. The retention card carries one genuinely negative cohort
- **Screen:** Strategic Intelligence → Retention Lift — 1-Yr Cohort.
- **What a prospect sees:** **100% / 50% / 100% / 100%**, H1 2023 at 50% with **lift −33%** against an illustrative 83% benchmark.
- **Re-checked this pass** (rendered, plus the series from the API): unchanged, and still a **real mixed outcome** — a cohort holding both a leaver and a stayer — not a single-leaver cohort that reads as broken data.
- **Verdict:** not a defect. Script the explanation rather than letting a CHRO discover it.

### 5. The roster carries a terminated record — and the demo's headcount includes a pre-hire
- **Screen:** Employee Directory (UAE).
- **What a prospect sees:** **8 rows** — 5 active, 1 onboarding, 1 offboarding, 1 **terminated** — with gratuity accruals; 13 records are held in total (8 UAE / 5 KSA). The onboarding row is Omar, showing **ONBOARDING · AED 0.00 accrued**, and he is also the pre-boarding case on the Layer 2 tab.
- **Re-checked this pass:** 8 AE rows, statuses as above (API + screen).
- **Verdict:** honest and required for the retention math, but say the numbers before they are counted. **8 UAE records — 5 active, 1 onboarding, 1 offboarding, 1 leaver.** Separately, the demo's *"7 active employees"* counts any non-`terminated` status, so it includes the pre-hire the Pre-boarding tab says has not started — an owner decision (case 1 of the Layer 2 demo data), not a screen defect, and the walkthrough script works either way.

### 6. The KSA switch is visible in the header
- **Screen:** every screen, header right (`🇦🇪 UAE` / `🇸🇦 KSA`).
- **Re-checked this pass:** still visible, still deliberate.
- **Verdict:** an open owner decision, not a defect. It invites "so do you do Saudi?" mid-UAE pitch — answer verbally; do not switch the toggle mid-demo to demonstrate it.

### 7. Every card still carries "Illustrative" / "Illustrative Benchmark" / "Illustrative Total"
- **Screen:** Executive Dashboard, Strategic Intelligence.
- **Re-checked this pass:** present on the dashboard cards and on all three Strategic Intelligence insight cards.
- **Verdict:** deliberate and owner-mandated; own the distinction out loud — the **number** is computed, the **comparison** is a placeholder.

### 8. **New — the sign-in screen still describes an HR onboarding tool, not the platform** *(cosmetic, but it is the first line a prospect reads)*
- **Screen:** the sign-in screen, above the fold, before any credential is typed.
- **What a prospect sees:** **"HR Onboarding/Offboarding Intelligence Platform"** under the product name.
- **Why it matters:** the pitch opens on workforce intelligence — cost-per-hire, retention, EOSB exposure — and the product's own first line narrows it to onboarding/offboarding administration. It is one string, and it is the cheapest credibility fix on this list.
- **Verdict:** change one line; the product underneath already does more than the line says.

### 9. **New — the roster's day count has no floor, so a future-dated hire prints `Day -n`** *(new as a reclassification: the 2026-10-06 audit listed the `Day 193` symptom as closed — what is new is that the arithmetic behind it is unguarded)*
- **Screen:** the day-count badge the dashboard renders per in-flight hire (`App.tsx:1383`).
- **What a prospect would see:** a **negative** day count (`Day -2`) for anyone whose start date is in the future — raw arithmetic, not a labelled state. `Math.ceil((now − start_date) / 24h)` has no guard below zero.
- **Measured 2026-10-08:** **not visible on this seed** — every one of the 8 UAE rows has a past start date (day counts 49, 859, 911, 966, 997, 1272, 1308, 1682), so nothing renders negative today. The exposure is the direction the demo is heading: the pre-boarding hires (start **+1 day** and **+14 days**) are exactly the records that would be added to a roster to show pre-boarding in the same view. This is a **code-level** finding, stated as one.
- **Verdict:** guard it the way the row distance was guarded (F4) — an absolute value plus a word ("starts in 2 d"), never a bare signed number. Cheap; do it before a future-dated hire appears in a demo.

### 10. **New — the EOSB forecast carries an all-zero KSA column on the UAE surface**
- **Screen:** Strategic Intelligence → EOSB Liability Forecast — by Jurisdiction & Quarter.
- **What a prospect sees:** four quarters of UAE figures (84,667 → 90,926 → 133,477 → 161,494 AED) beside **`KSA: 0.00 SAR`** in every column.
- **Verdict:** arithmetically correct for a UAE-scoped view and arithmetically honest — but a zero column invites "is the Saudi side broken?". Either filter the column out of the UAE view or label it in one line ("no KSA records in scope"). Low effort, removes a question nobody wants mid-pitch.

---

## Honest limits that are features of the truth, not defects

These belong on the document because a prospect who finds them unaided trusts us less than one who is told.

- **The flag is a state, not an event.** There is **no mailer, webhook or SMS** in this release. Nothing is sent, nothing is "notified", and no surface implies otherwise — the watcher reports `delivery: "none"` and the package says "Not sent" on every row.
- **There is no hire-facing portal.** No candidate logs in, so no "read" event exists to record; the package says so on every row rather than showing an invented status.
- **An acknowledgement is an in-product record, not an e-signature.** It is recorded by the signed-in user on the hire's behalf, `recorded_by` is required, and signature-implying methods are refused by name.
- **The workspace track (IT / Admin / HR / Manager checklists) is built, merged and — since 2026-10-09 — cut over and seeded** *(corrected twice on 2026-10-09: P2-4 merged as PR #86, then the cutover ran)*. The three demo cases now carry their provisioning lines (**15 / 14 / 14**, derived from each case's own role and department), so it **may** be demoed as a workspace board. One honest line while demoing it: the **"View by function"** control is a **filter, not access control** — everyone signed in can still open any case and see every line (`is_access_control: false`). "My lines" ships with per-user accounts at Layer 3.
- **One shared admin account.** Per-user accounts and role-based access arrive at Layer 3; until then the product can name the signed-in HR user and nothing more.
- **No real client data, by rule.** The product holds its own database and the team store holds zero product rows; every figure here is seeded sample data, labelled **"SAMPLE DEMO DATA"** in the header.
- **The UAE resignation tier is with counsel.** Nothing on screen claims certification, and the one document that used to ("Legally Validated") no longer says it.

## If we only fix two things before the next demo

1. **Resolve the Settlement Statement header** to the employee's jurisdiction and the real entity name (item 1) — the figures are good and the net total is right; the header and the waiver clause are what a lawyer reads. Spec attached above.
2. **Change the sign-in line** (item 8) — one string, seen before anything else, and today it undersells the product we are actually pitching.

*Then, in order:* guard the day count (item 9, cheap and heading our way), then the KSA switch decision (item 6) and the forecast's zero column (item 10). **The `Origin` / blank-page hole stays closed** and no longer belongs on this list.

## What this document does not claim

- It does not claim **the numbers in it are today's numbers.** Since the 2026-10-09 cutover the live surface **does** show the 48-hour chip, the seeded pre-boarding cases, the scoped roll-up and the pre-reading package — but every figure in the walk above was read on 2026-10-08, and the counts moved when those cases were re-seeded (the flag's per-case counts went 7 → 21 / 21 / 22 as the provisioning lines landed). **Read "The counts on the served surface" above, then re-read the screen.**
- It does not claim any figure is stable. Accrual-derived numbers move between seeds — re-read before quoting.
- It does not claim Layer 2 is complete: the workspace track (P2-4) is **built, merged and cut over** *(corrected 2026-10-09 — the cutover and the re-seed both landed; see the counts section)*, the hire-facing portal is **not built** (it waits on the owner's identity ruling), and the flag has no delivery channel by design.
- It does not carry a finding forward unexamined: every item above was re-read this session, and the four Layer 2 findings that closed say what closed them.
