# Antum People — 10-Minute Pilot-Customer Demo Walkthrough Script (UAE-first)

> **Audience:** Mid-market UAE CHRO / CFO / Head of People Ops (100–1,000 employees)
> **Goal:** Move the prospect from "compliance admin tool" to "strategic intelligence tier" — and land the 3-anchor free-pilot conversation.
> **Total runtime:** 10 minutes (5 segments + close). Timings are targets, not walls.
> **Presenter:** Founder-led (Ahmad's HR network) — technical detail available, but lead with outcomes.

> ⚠️ **Verification status — internal. Do not read aloud.**
> - **Re-walked by the Product Designer on 2026-10-08**, step by step, on a **scratch instance of `origin/main` = `404b29d`** — own port (4716), own database, own throwaway credential (WORKFLOW rule 14; the live tree was neither tested nor modified, and the deployment on port 3000 answered **200** before and after every pass). Every reading below was taken on that instance, in a browser and over the API, in one sitting. Provenance per figure class is in the table at the end of this note.
> - **Not read off old screenshots.** The previous version of this script (v3.1) described a surface from 2026-10-06 that had **no pre-boarding layer at all**. Segment 3 is new, and the readings in Segments 1–5 were re-taken.
> - **UAE-only, end to end.** No other jurisdiction appears anywhere in the flow below — no screen, figure, claim or control. Nothing in this script depends on anything outside the UAE surface.
> - **Dated correction, 2026-10-09 — the workspace track.** This walk was taken on `404b29d`; **P2-4 merged as PR #86 afterwards** (`main` = `b7630cb`), so the workspace track is no longer "not built". The three places below that said so are corrected in place (the live-vs-`main` table, the "who owns the outstanding items" answer, and Caveat 14). No reading taken on the walk changes: the track was merged but **not cut over** on 2026-10-08, so the surface a prospect saw that day was the one this walk describes. *(Superseded later the same day — the cutover ran, and every count in Segment 3 was re-read; see the dated correction directly below.)*

> - **Dated correction, 2026-10-09, post-cutover — Segment 3 is live, and its figures were re-read.** The cutover ran. Measured on the served surface at 11:55–11:58 UTC: the public URL and `127.0.0.1:3000` carry the **same bundle** (`assets/index-B3KoM02v.js`, 269,188 bytes), and `GET /api/preboarding/checklist/overview?jurisdiction=AE` on the **public** URL answers the product's own `401 {"error":"Authentication token required"}`. The gate below is therefore **satisfied**, Segment 3 can be demoed from the public URL — and **the chips now read 22 / 21 / 21**, because the three cases carry their provisioning lines. The walk's own readings stand as taken; the section below is kept as the record of how the gate was checked, with today's reading added to it.

## 🚦 Read this before you demo Segment 3 — the gate, and how it was checked

Read on **2026-10-08**, the public URL served the deployment cut over on **2026-10-07** (`5ed731e`), and the table below was the comparison — one *client bundle* against another, both fetched anonymously. **The cutover has since run, so what the walk's second column describes is now what the public URL serves.** Re-measured on the served surface on **2026-10-09 11:57 UTC** (`assets/index-B3KoM02v.js`, 269,188 bytes, HTTP 200 from both the public URL and `127.0.0.1:3000`):

| String, counted with `grep -o -F … \| wc -l` | Public URL's bundle | Scratch build of `404b29d` |
|---|---|---|
| `HR roll-up` | 1 | 1 |
| `Record an accepted offer` | 2 | 2 |
| `/api/preboarding` | 7 | 9 |
| `Sample Demo Data` (the header badge) | 1 | 1 |
| `before 00:00 on the start date` — the row's amber reading | **0** | 2 |
| `Pre-reading package` | **0** | 1 |
| `Record acknowledgement` | **0** | 1 |
| `no delivery channel in this release` — the package strip's own line | **0** | 1 |
| `no delivery channel` (any wording) | 1 | 2 |

**The same strings, re-counted on the served bundle on 2026-10-09** — the same strings, one bundle, before and after the cutover:

| String | Served bundle, 2026-10-08 (pre-cutover) | **Served bundle, 2026-10-09 (post-cutover)** |
|---|---|---|
| `HR roll-up` | 1 | **1** |
| `Record an accepted offer` | 2 | **2** |
| `/api/preboarding` | 7 | **10** |
| `Sample Demo Data` (the header badge) | 1 | **1** |
| `before 00:00 on the start date` — the row's amber reading | **0** | **2** |
| `Pre-reading package` | **0** | **1** |
| `Record acknowledgement` | **0** | **1** |
| `no delivery channel in this release` — the package strip's own line | **0** | **1** |
| `no delivery channel` (any wording) | 1 | **2** |

**Every string the walk found missing from the published client is now in the bundle the public URL serves.** Nothing on the left is a claim about the product's behaviour: it is a string count, and the two columns are the same measurement a day apart.

**Read the table for what it is — a comparison of one *client bundle* against another.** It shows what the published client can render; it does **not** show what the published *server* computes, because the chip and the headline wording are served by the API (`server/preboarding-flag.js`), so their absence from a bundle proves nothing by itself. At the time of the walk the plan recorded the live deployment's own commit as `5ed731e` (the 2026-10-07 cutover, before P2-5), and the walk did **not** verify the live server's commit itself: an inference is not a measurement. *(Superseded 2026-10-09 — the cutover ran, and the served surface was then verified directly, by the product's own API answer.)*

**What that meant, before the cutover** *(superseded 2026-10-09 — the two columns above are now one bundle)* **:** the public URL's client carried the pre-boarding screen from P2-2 (the tab, the offer-acceptance intake form, the HR roll-up) and **none of the pre-reading package's strings**. The flag (P2-5, #76), the three seeded cases (#73), the scoped roll-up (#74), the row's distance rule (#77) and the pre-reading package (P2-3, #79 — merged **today**) were all on `main` and **none of them was on the public URL** at the time of the walk. The cutover that carried them was held on **one owner ruling (demo case 1)**; nothing technical was outstanding. *(Superseded 2026-10-09: the cutover ran, and every one of those strings is now in the bundle the public URL serves — see the counts directly above.)*

**So, in order:**

1. **The 10-second check — now a count check, not a gate check.** Open Pre-boarding on the public URL the morning of the call; the cutover has run, so the gate is satisfied. **Check the header reads `3 CASES OPEN`, with one row amber and one red** — and take the chips' numbers off the screen rather than out of this script: a re-seed moves them (on these cases the flag read 7, then 21/21/22 once the provisioning lines were seeded). An empty state now means the **deployment is down**, not un-cut-over.
2. **If the deployment is down, cut Segment 3 rather than dressing it up.** Do not promise a screen that is not answering, and never demo the segment from a scratch instance while the prospect is looking at the public URL. Say the layer is in the build and you will show it on the next call, and keep the rest of the script.
3. **Say the honest sentence anyway:** *"this landed in the build this week"* — the derived-alarm story is stronger when the prospect knows it is new (it is: 2026-10-09).
4. **Never present a scratch instance as "the product you'd get".** Rule 14 exists for a reason: the scratch instance is how we read the truth, not what we sell from.

## 📅 Re-seed the morning of any demo — the three-state story has a one-morning shelf life

**The seed dates its three cases as offsets from the day the seed runs** (that is deliberate: a fixed date would go stale silently). Measured on the seed of **2026-10-08**:

| Case | Start | State that morning |
|---|---|---|
| `OFR-2026-DEMO-03` — Yousef Al-Hammadi | 2026-10-08 (seed day −1) | 🔴 Started, items open |
| `OFR-2026-DEMO-02` — Mariam Al-Kaabi | 2026-10-10 (**seed day +1**) | 🟠 Inside 48 hours |
| `OFR-2026-DEMO-01` — Omar Al-Farsi | 2026-10-23 (seed day +14) | ⚪ On track |

**Case 2 is the perishable one.** Its amber window closes at **00:00 UTC on its start date (04:00 GST)** — after that it is a red case like case 3, and the demo shows **two started and one on track with no amber anywhere**. The one visible amber is the whole point of Segment 3. **Use the "Re-seed on the host with `DEMO_SEED=true`" procedure the day of the call, and run the logged-in pass again afterwards: the accrual figures move with the seed too.**

**Not a caveat to hide — a line to say:** *"These are seeded sample employees, dated relative to when we loaded them, and one of them is deliberately hours away from day one. That is the point: the alarm is derived, not typed in."*

---

## Figure discipline — three classes, three ways to treat them

- **Stable — say these freely:** counts (3 pre-boarding cases; 8 UAE roster records — 5 active, 1 onboarding, 1 offboarding, 1 leaver), dates, checklist lengths and order, chip states, the shape of a row's distance, and any figure the card labels `Illustrative` **where the number itself is computed and only its comparison is illustrative**.
- **Day-sensitive — never state as the expected value:** anything derived from accrued service **to today** — the **EOSB Liability** card total, the settlement's **EOSB / Gross Total / Net Payable** lines, and the **EOSB forecast ladder** (its first quarter *is* the accrual). **Read them off the screen during the call and say what the card says.** On 2026-10-08 the liability card read **`AE 85,247.11 AED`**; earlier builds read 85,126.34, 85,125.43, 85,129.04, 85,129.27 and 85,141.22 on other days. Those are *readings*, not the value to say out loud.
- **Time-of-day-sensitive — read them, never script them:** the amber case's own distance (`15.4 h before 00:00 on the start date` at 08:36 UTC on 2026-10-08; `13.2 h` at 10:53 UTC on 2026-10-09 — same row, same rule, different hour) shrinks through the day, and the amber **window** closes at 00:00 UTC on the start date. Where this script quotes one, it is labelled a reading with the hour.
- **Never write a figure into this script to make a screen look fuller.** That is the defect class this team keeps sending back; every number here came off the instance named above or is labelled as carried from an earlier pass.

### Roster as served on the UAE surface (re-read 2026-10-08)

**8 records — 5 active, 1 onboarding, 1 in offboarding, 1 terminated** (the terminated record is kept for the retention math). 13 records are held across both jurisdictions; only the UAE rows appear on this surface, and the **unfiltered** headcount is 11 — **say the UAE number (7 active counting the onboarding row, 8 rows), never the unfiltered one.**

### The UAE resignation tier is unconfirmed

Federal Decree-Law 33/2021 vs the repealed Law 8/1980 Art. 132 reduction is with counsel. **Never present the UAE EOSB figure as legally validated.** See Caveat 2.

---

## Before you start — 60-second pre-flight

- [ ] **Confirm the live app loads** at the public URL (200, title "Antum People", sign-in screen renders).
- [ ] **Sign in** with the demo account (**`admin`**, credentials **supplied separately by the owner** — never written into this file). Do a test login ahead of the call.
- [ ] **Run the Segment 3 gate** (above): Pre-boarding → three cases? If not, cut the segment.
- [ ] **Re-seed that morning** (above) and re-run this pass: accruals and the amber window both move.
- [ ] Confirm the app shows **sample data**, UAE selected, and the **"SAMPLE DEMO DATA"** badge in the header.
- [ ] Have two tabs ready: the **live app** and the **bilingual prototype** (`design-concepts/intelligence-dashboard-prototype.html`).
- [ ] PDFs printed or open: `templates/privacy-notice.pdf`, `templates/data-processing-agreement.pdf`, `templates/dpia-questionnaire.pdf`.
- [ ] Know your honest caveats (*Caveats & guardrails*) — you will be asked.
- [ ] **Leave the header controls alone — this is a UAE story from start to finish.** Changing what the dashboard shows mid-demo breaks both the narrative and the arithmetic you have already said out loud.
- [ ] **Do not present the settlement figure as a compliance claim** — open it only with the "draft, subject to your counsel's review" framing (Caveat 2).

### What's live vs. what's on `main` vs. what's a prototype (know this cold)

| Surface | Status | Where |
|---|---|---|
| Sign-in, Executive Dashboard, Employee Directory, Transitions Hub, Strategic Intelligence | **Live build** | public URL, after login |
| Pre-boarding tab: the offer-acceptance intake form and the HR roll-up | **Live build** — and since 2026-10-09 **populated: three cases, three states** | public URL → Pre-boarding |
| **The 48-hour flag, its three seeded cases and the pre-reading package** | **Live since 2026-10-09** — the cutover ran, and the flag's counts on the served cases read **22 / 21 / 21** | public URL → Pre-boarding (Segment 3) |
| UAE offboarding case (8 engine-sourced steps) | **Live + populated** | Employee Directory → Noura Al-Suwaidi |
| UAE onboarding checklist (Omar, 7 steps) | **Live logic + seeded tasks** | Employee Directory → Omar Al-Farsi |
| Dashboard KPIs (Retention Lift, Time-to-Value, Cost-per-Hire, EOSB Liability) | **Live, computed from sample data** | Executive Dashboard |
| EOSB engine (UAE basic-salary basis) | **Live logic, tier unconfirmed pending counsel** | `server/eosb.js` |
| Settlement Statement document | **Live render from the engine** (no placeholders) | Employee Directory → Noura → Compliance Center |
| Exit-interview intake form | **Live form**, captured data still not surfaced in any view (Caveat 8) | "Initiate Exit" → "Finalize Offboarding" |
| The workspace track (IT / Admin / HR tasks for the new hire) | **Live since 2026-10-09** (P2-4, PR #86; cut over and seeded) — **15 / 14 / 14** provisioning lines on the three demo cases, derived from each case's own role and department | case detail → the provisioning board; its `View by function` control is a **filter, not access control** |
| Bilingual EN/AR RTL dashboard | **Interactive prototype**, not the live build | `design-concepts/intelligence-dashboard-prototype.html` |
| Compliance dashboard (DSR, breach register, consent audit) | **Design spec** | `design-concepts/COMPLIANCE-UI.md` |

---

# Segment 1 — Offboarding first: where the money and the compliance risk live (0:00 – 2:00)

**Goal:** Open on a UAE departure in flight. This is the view the UAE buyer weighs most heavily — EOSB, final settlement, work permit and residency cancellation — and it is populated for a UAE record.

### Click path
1. Sign in → land on **Executive Dashboard** (UAE selected by default).
2. Point at the **Offboarding Pipeline** card: **Noura Al-Suwaidi — Account Manager — "Exit 2026-10-10"**.
3. Sidebar → **Employee Directory** → click her row → her **Offboarding Checklist** opens.
4. Walk the list — **8 steps, 2 already done** (read 2026-10-08): **Hardware Return ✓** → **Access Revocation ✓** → **Notice Period Verification** → **EOSB Calculation (UAE)** → **Annual Leave Encashment** → **MoHRE Work Permit Cancellation** → **Residency Visa Cancellation** → **Final Settlement Payment (within 14 days)**.
5. Point at the **Compliance Center** panel: **EOSB Calculation Basis = "Basic Salary (UAE Rule)"** *(carried from the 2026-10-06 walk — not re-opened on this pass; the string is rendered from the record's own `data_residency_country`, `App.tsx:1337`)*.
6. *(Optional, with the framing in the speaker notes)* open **Settlement Statement** — it renders the engine's own figures for her record.

### What the customer sees
- A **populated offboarding checklist** with two steps done and six pending — not an empty screen.
- The UAE sequence itself: **MoHRE work-permit cancellation** and **residency visa cancellation** on the list, in the right order, ahead of final settlement.
- **EOSB basis "Basic Salary (UAE Rule)"** — the UAE accrual basis, stated on the employee record.
- If you open it: a settlement document whose **EOSB line is the engine's accrued figure for that employee** (read on 2026-10-08: **EOSB 6,415.79 · Gross Total 11,577.08 · Net Payable 11,577.08 · deductions 0.00**, and the document dated "8 October 2026" — all day-sensitive: **read them off the document and say what it says**), with uncomputable lines reading **"not calculated"** — not zeros, not placeholders.

### Speaker notes
> "Let me start where it costs you the most if it's wrong: offboarding. This is a UAE departure already in flight. The checklist isn't a template someone typed — it comes out of the compliance engine, in order: equipment and access first, then notice, then the EOSB calculation, then MoHRE cancels the work permit and the residency visa follows, and only then the final payment. The EOSB basis here says **basic salary**, which is the UAE rule. And the settlement document is generated from the same engine — this figure is her accrued end-of-service, computed from her own start date and salary, not typed in."

### Anticipated questions
**Q: "Does it file the MoHRE cancellation / cancel the visa for me?"**
A: Today the checklist is the system of record your HR team drives, and it encodes the correct sequence and the UAE basis. Direct integration with the MoHRE portals is on the roadmap — during the pilot we map your current steps so nothing is double-keyed.

**Q: "Is this settlement figure what we'd actually pay?"**
A: **Say this plainly:** "The calculation is live and it's the engine's own number. What is *not* yet signed off is one part of the UAE resignation rule — the reduced accrual for 1–3 and 3–5 years' service under the 2021 law — which our counsel is confirming. So treat this as a pilot-ready draft that your counsel reviews before anyone pays against it." (See Caveat 2.)

---

# Segment 2 — Onboarding, UAE sequence (2:00 – 3:00)

**Goal:** Show onboarding as a live, UAE-specific flow that captures consent as data — not a PDF afterthought. Keep this tight: Segment 3 is the new material.

### Click path
1. Sidebar → **Employee Directory** → click **Omar Al-Farsi** (status *ONBOARDING*) → his **Onboarding Checklist** opens.
2. Walk it — **7 steps, 2 complete** (read 2026-10-08): **MoHRE Contract Signing ✓**, **Entry Permit Issuance ✓**, then **Medical Fitness Test**, **Emirates ID Biometrics**, **Residence Visa Stamping**, **Wages Protection System (WPS) Registration**, **Privacy Notice Consent**.
3. Point at the **Compliance Center**: the **PDPL consent** line reads **"✓ GRANTED ON 2026-09-23"** on this record (from the record's own `consent_date`; every seeded record carries a date, so a `GRANTED ON null` line cannot render from this dataset).
4. Point at the roster row itself: **ONBOARDING · AED 0.00 · "Accrued to date"** — a hire mid-flow accrues nothing yet, which is the honest reading.

### What the customer sees
- A **UAE onboarding checklist** with real completion state, sourced from the engine.
- **Consent captured with a date**, on the employee record.
- Two ready-to-render documents (Privacy Notice, Employment Contract) — bilingual.

### Speaker notes
> "Onboarding is the same product, same engine — the sequence is the UAE one: contract and MoHRE steps, insurance, visa stamping. And notice consent is in-flow and dated, tracked against a version, not chased as a PDF later. The dashboard card and this checklist read from the same source, so they can't disagree."

### ⚠️ Before you say "Omar" twice — the demo-case-1 contradiction (owner decision, still open)

The roster's Omar (`demo-emp-omar`, *onboarding*, started **2026-08-20**) is **also** the person the seeded pre-boarding case `OFR-2026-DEMO-01` says starts **2026-10-23**. *(The 2026-10-09 cutover ran with this unresolved — case 01 still starts at seed day +14 while the roster row still says 2026-08-20 — so the contradiction below is **live on the served surface**, not a thing of the old build.)* So:

- The Employee Directory shows him **ONBOARDING at AED 0.00 accrued** (measured 2026-10-08), and the Pre-boarding tab says he **has not started** — both true of the seeded rows, and a prospect who reads both will see it.
- The dashboard's **"7 active employees" includes him**, because the headcount counts any record that is not `terminated` — a pre-hire in the count.

**Two honest ways to handle it, on the day:**

1. **Do not stitch the two together.** Keep Omar's Employee Directory row in Segment 2 and use **case 3's red row and case 2's amber row** as the pre-boarding story, saying Omar's case as *"the third one is a hire who is still three weeks out — nothing to see yet, which is the point: no false alarm."* If asked directly, say: *"that's one seeded record doing double duty in the sample data — it is a demo-data artefact, not product behaviour."*
2. **If the owner picks option (b) and case 1 is pointed at a fourth hire**, this whole box goes away, and the three pre-boarding names no longer touch the roster's onboarding row. Nothing else in this script changes.

*(The decision — leave it (a), or give case 1 a fourth hire (b) — is on the owner's desk. This script works either way; only this box changes.)*

---

# Segment 3 — Pre-boarding Intelligence: the 48-hour flag (3:00 – 5:30) · **the headline segment**

**Goal:** Show the layer that makes this a workforce-intelligence product rather than a form-filler: **one derived alarm per case, no stored state, no snooze**, and the pre-reading package behind it. *(The cutover gate above is satisfied — 2026-10-09.)*

### Click path
1. Sidebar → **Pre-boarding**. The header reads **"3 CASES OPEN"**; the HR roll-up below it reads **21 ITEMS OUTSTANDING · 0 ITEMS VERIFIED · 3 WITHOUT CONSENT** — that 21 is the **employee track** (7 items × 3 cases). The **workspace** track is counted and shown **separately** (43 provisioning lines open across the three cases): **never say "64 outstanding"** — the product keeps the two as separate fields, and an HR lead will read them as two teams' problems, which is what they are.
2. Read the **three rows top to bottom** — the server orders the roll-up `ORDER BY start_date ASC, created_at ASC` (`server/preboarding-items.js:469`), earliest first, so the story reads itself:

   | Row | Candidate | Start | Chip | Row line | Flag panel |
   |---|---|---|---|---|---|
   | 1 | **Yousef Al-Hammadi** · Operations Analyst · Operations | 2026-10-08 | 🔴 **Started 1 day ago · 21 items open** | `Start: 2026-10-08 · started 1 d ago` | "Started with 21 items still open" + "These were due before day one." |
   | 2 | **Mariam Al-Kaabi** · Marketing Coordinator · Marketing | 2026-10-10 | 🟠 **Inside 48 hours · 21 items open** | `Start: 2026-10-10 · 13.2 h before 00:00 on the start date` — **time-of-day-sensitive: read yours off the screen** | "21 items open · start in 48 hours or less" |
   | 3 | **Omar Al-Farsi** · Finance Analyst · Finance | 2026-10-23 | ⚪ **On track** | `Start: 2026-10-23 · 14 d` | "On track" + "22 items still open, with 14 days to go — the flag starts 48 hours before the start date." |

   *(Chips and row lines re-read on the served surface on 2026-10-09: the cutover ran, and the counts moved with the re-seed — the walk's "7 items open" chips now read 21/21/22, and the whole row is worth re-reading out loud rather than quoting from here. The amber row's hours value is time-of-day-sensitive, and so is its state: it crosses into the red exactly at 00:00 UTC on its start date. The third row's panel only shows when the flag is raised; a clear case carries no red/orange panel at all.)*

   *The fourth reading, which none of these three rows shows:* a **clear** case whose start date has passed with **every item complete** still reads `clear` — not overdue — and its row prints **`· started 6 d ago`**, from the same absolute guard as row 1, never a signed negative. It is written down because it is the case a reader does not think of.
3. **Open row 1** (click the row; the label flips from `Open` to `Close`). Inside it, in order:
   - **`OFR-2026-DEMO-03`** and the **EMPLOYEE TRACK** heading,
   - **"Record PDPL consent"** with the line **"No PDPL consent record — no document can be collected on this case yet."** — the consent gate is in the module, not in a policy PDF,
   - the **7 document items** with category and a `Request` control each,
   - **"Record a reminder for 7 outstanding item(s)"** with the copy *"A reminder is recorded in the product. There is no mailer, webhook or SMS yet, so nothing is sent to the hire — the delivery channel is a separate decision."*
   - and the **PRE-READING PACKAGE · 0/9 acknowledged · 0/2 required** strip (P2-3, merged 2026-10-08): nine items, **JD and NDA carry a required acknowledgement**, each row reading **`Sent: not available — no delivery channel in this release`**, **`Read: not tracked — no hire-facing portal in this release`**, **`Acknowledged: not recorded`**, with a `Record acknowledgement` control.
4. **Close row 1 and open row 2** *(optional, only if you have the seconds)* to show the amber case's own list. If time is tight, skip — the chip and the row line already told the story.

### What the customer sees
- **Three cases, three states, one visibly red** — an HR manager's morning, not an empty screen.
- A chip whose wording is a **state**, never a message: "Inside 48 hours", "Started 1 day ago", "On track".
- On the red row, the item list says **exactly who owns nothing**: *"no owner on this item — the employee-track items carry no owner field"*. It does not invent an owner to look complete.
- **The pre-reading package exists as a list, with an honest delivery line on every row** — and the acknowledgement is recorded **in the product, by the signed-in user, on the hire's behalf: an in-product record, not an electronic signature.**

### Speaker notes
> "This is the screen I'd want on the wall on a Monday morning. Three offers accepted, three hires coming. Look at what the system says about each one, and notice it says nothing until it should: the hire three weeks out reads **On track** — no false alarm. The one who starts tomorrow reads **Inside 48 hours, 21 items open** — with 13 hours on the clock (read that number off the screen; it shrinks by the minute) and seven documents still missing from her, plus fourteen provisioning lines IT and Admin have not started, that is a phone call today, not a surprise on day one. And the one who started yesterday is **red**: *started with 21 items still open, these were due before day one*. Nobody had to configure that alarm, and nobody can switch it off — there is no snooze. It is **derived from the case every time the page is read**, so it cannot go stale, it cannot be marked 'handled' while the work is undone, and when the last document lands it disappears by itself. And every row tells you *whose* item it is — and where the data model has no owner, it says so instead of inventing one."

### If they ask — the flag, honestly
- **"Does it email IT / remind anyone?"** No — and no screen pretends otherwise. There is **no mailer, webhook or SMS in this release**; the package rows literally read *"Not sent — this release has no delivery channel"*, and the reminder control says the reminder is *recorded in the product*, not sent. The watcher behind the flag reports `delivery: "none"`. If they press: *"the alarm is the product telling you; chasing is a later build, and the honest answer today is that HR reads this screen."*
- **"What if nobody opens the app for a week?"** The flag is computed on read, so nothing is missed and nothing needs catching up — a case that crosses the 48-hour line while the app is closed still reads **Inside 48 hours** the moment it is opened. The watcher additionally *records* the boundary crossing (it logged two on this instance, both marked *"while the app was not running"* — that is a record for audit, not a notification).
- **"Who owns the outstanding items?"** On the **employee** track, nobody: those items carry no owner field and the row says exactly that — the product does not invent one. The **workspace** track is different, and it is built: every provisioning line carries **exactly one owner** (IT / Admin / HR / Manager) **stored on the line itself**, so a later catalogue edit cannot silently reassign work in flight (P2-4, PR #86). That board is **on the served surface since 2026-10-09** — the three demo cases carry **15 / 14 / 14** provisioning lines — so it is no longer a `main`-only claim. *(Before the cutover this answer read "that board is on `main` and lands with the cutover — it is not on screen on today's data." It is on screen now; this edit also healed a mid-word line break that rendered the source as "on t oday's".)* What is still **not** available is *"you see only your own lines"*: with one shared admin account the function view is a **filter, not access control**, and it becomes "my lines" at Layer 3. *(Corrected 2026-10-09: this answer used to end "— not built".)*
- **"Did the hire read the pre-reading?"** Not tracked — there is no hire-facing portal in this release, so no read event exists to record. The package says so on every line. The acknowledgement, where recorded, is a record, not a signature, and an e-signature cannot be claimed from this build.
- **"Is this per-person access?"** No — it is one shared admin account today. Per-user accounts and function scoping ("my lines") land at **Layer 3**, and no real client data goes in before that. If they ask for access control on the pilot, that is the honest roadmap answer.

---

# Segment 4 — Executive Dashboard: the four numbers leadership acts on (5:30 – 7:30)

**Goal:** Roll the operational views up into the leadership view — and be straight about which numbers are computed and which comparisons are placeholders.

### Click path
1. Sidebar → **Executive Dashboard**.
2. The four headline cards: **Retention Lift (1-yr)**, **Time-to-Value**, **Cost-per-Hire**, **EOSB Liability**.
3. The two pipeline cards: **Onboarding** (Omar, "Started 2026-08-20") and **Offboarding** (Noura, "Exit 2026-10-10").
4. Call out the **"SAMPLE DEMO DATA"** badge in the header *before* they ask.

### What the customer sees — **read each card at demo time** (readings below taken 2026-10-08 on `404b29d`)
- **Retention Lift (1-yr):** `+19%`, labelled `Illustrative` / `Illustrative Benchmark`. *(A reading; the card is computed from seeded cohorts.)*
- **Time-to-Value:** `19.2 d`, labelled `Illustrative`, `target: 15 days`. **Read it off the card** — the unfiltered feed reads 18 d, and the card is the filtered one.
- **Cost-per-Hire:** `AE 8,286.00 AED`, labelled `Illustrative Benchmark` (`recruitment + onboarding`).
- **EOSB Liability: do not script a number.** It recomputes accrued service to today; on 2026-10-08 it read **`AE 85,247.11 AED`** (labelled `Illustrative Total`, `Accrued to date across regions`), and it has read five other values across earlier builds. **Read it off the card and quote what it says.**
- **Onboarding Pipeline:** **one person** on this surface (Omar Al-Farsi, started 2026-08-20). Reem's record is a KSA record and does not appear here.
- **Offboarding Pipeline:** one person (Noura Al-Suwaidi, `Exit 2026-10-10`).

### Speaker notes
> "This is the screen your CFO would look at before a board meeting: what it costs to hire, how long a hire takes to become productive, the end-of-service we're carrying on the books, and whether people are staying. To be straight with you: **this is a seeded sample dataset, not a live client's numbers** — that's what the 'Sample Demo Data' badge is. A few cards are marked 'Illustrative' because the thing they're compared *against* — a benchmark, a target — is a placeholder, not a market index yet. What's real is the *calculation*: EOSB and cost-per-hire are computed from the roster, per jurisdiction, not typed in. And the headcount on this surface counts the UAE records only — if you switch the toggle, the number changes, which is why I'm leaving it alone."

### Anticipated questions
**Q: "Why do some cards say 'Illustrative'?"**
A: The figures are computed from sample data; "Illustrative" sits on the benchmark or target they're compared to. In the pilot we'd replace it with your own history.

**Q: "Is this UAE only, or does it cover the region?"**
A: "Every figure on this screen is UAE. The engine is built for the GCC and we are launching UAE-first — so the pilot is a UAE pilot."

---

# Segment 5 — Strategic Intelligence + bilingual prototype (7:30 – 9:30)

**Goal:** Show the analytics layer, be honest about what is illustrative, and close with the Arabic experience.

### Click path
1. Sidebar → **Strategic Intelligence**.
2. Point at **Retention Lift — 1-Yr Cohort**, then **Time-to-Value by Department**, then **EOSB Liability Forecast**.
3. Switch to the **bilingual prototype** and click **EN | العربية** to show RTL mirroring.

### What the customer sees — the forecast is read at demo time; the cohort ratios below were read 2026-10-08 on the UAE surface
- **Retention Lift — 1-Yr Cohort** (read 2026-10-08: **100% / 50% / 100% / 100%**, each against a separately-labelled `Illustrative` benchmark — the 50% is a real mixed outcome, a cohort with both a leaver and a stayer):

  | Cohort | Retention | Benchmark | Lift |
  |---|---|---|---|
  | H1 2022 | 100% | 82% | +18% |
  | H1 2023 | 50% | 83% | −33% |
  | H1 2024 | 100% | 84% | +16% |
  | H2 2026 | 100% | 81% | +19% |

- **Time-to-Value by Department** (read 2026-10-08, **four** departments on the UAE surface): Engineering 16.7 d, Finance 25 d, Product 19 d, Sales 21 d — each against a 15-day target, over-target shown in red. Read the card and name the one or two worst rows rather than reciting all four. *(HR 15 d, Operations 14 d and Marketing 18 d appear on the unfiltered feed only — those are KSA records.)*
- **EOSB Liability Forecast (UAE, by quarter): do not script these numbers** — its first quarter *is* the accrual-to-today figure, so the whole ladder moves with it. **Read the four quarters off the card during the call.** *(Reading on 2026-10-08: Q3 2026 84,667 → Q4 2026 90,926 → Q1 2027 133,477 → Q2 2027 161,494. The first quarter is the computed accrual; the later quarters are a tenure-derived growth assumption, not a booked forecast.)*
- The bilingual prototype flips to RTL with Arabic-Indic numerals and re-flowed currency.

### Speaker notes
> "This is the layer leadership pays for. Look at the retention chart first — and notice it is not flattering: the H1 2023 cohort is at 50%, a cohort holding both a leaver and a stayer. That's the point: this is computed from leaver records, not smoothed. Time-to-value by department shows you exactly where onboarding is slow — Finance at 25 days against a 15-day target. The EOSB forecast shows what you're carrying today and projects it forward; the first quarter is computed, the later ones are a growth assumption your finance team should review. And the Arabic experience is designed in from the start — that's a working prototype, not the live build yet."

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
2. **Time-to-Value** — days until a new hire is fully productive (visa + onboarding milestones). **Pre-boarding is the half of this we can move before day one.**
3. **Compliance Accuracy** — % of offboarding cases with correctly calculated EOSB and privacy-compliant handling.

### Anticipated close question
**Q: "What do we need to commit to start?"**
A: A named HR lead, access to your current onboarding/offboarding process for one or two roles, and a 30–60 minute working session. We'll bring the config; you bring the edge cases.

---

# Caveats & guardrails (read before every demo)

1. **This is sample data.** A seeded dataset, not a real client's production data — own the "SAMPLE DEMO DATA" badge out loud, at the point where the prospect would otherwise assume the numbers are a customer's.
2. **The UAE EOSB resignation tier is unconfirmed.** The 1/3 (1–3 years) and 2/3 (3–5 years) reduction is frozen in the engine and flagged unconfirmed pending counsel. Never say the UAE EOSB is "validated", "certified" or "compliant". Say: *pilot-ready draft, subject to your counsel's review.* If counsel finds the reduction did not survive the 2021 law, every resigning UAE employee has been underpaid — that is why this stays a draft.
3. **"Illustrative" = not a real benchmark, target or forecast.** The KPI figures are computed from sample data; the comparisons are placeholders. Never present a forecast as a guarantee.
4. **One of the four cohorts shows negative lift — H1 2023 at 50% (lift −33%).** That is real, computed from seeded leaver records, and it is the honest version of the chart. Do not hide it; use it to explain that cohorts are computed from exits, not assumed.
5. **The settlement document's header is still generic — the employer line is the placeholder "Antum Regional Hub" and the jurisdiction line reads "UAE / KSA" on a UAE employee's document** (both re-read 2026-10-08 from the rendered document). The *figures* on it are the engine's; the header is not yet resolved to a real entity. Frame it as a draft template carrying live figures, and don't let the header become the story.
6. **Legal documents need counsel sign-off.** Privacy notice, DPA, DPIA and contract templates are pilot-ready drafts — say their counsel must review. The document-preview subtitle says exactly that ("Pilot-ready draft — subject to your counsel's review").
7. **Regulator integrations are roadmap, not live.** MoHRE/WPS are workflow steps, not live API pushes.
8. **Exit-interview data is captured but never surfaced.** The "Exit Intelligence Intake" form collects departure reason, preventable-attrition flag and offered salary. The dashboard API returns `exitsByReason` (read 2026-10-08: Career Change 1, Better Opportunity 1) and **no view renders it** — in the client source the field appears only as a type declaration (`App.tsx:224`), never as a render, and the string occurs in neither bundle (property names survive minification). If asked, say exit intelligence is a Phase 2 view and the intake is already recording.
9. **DSR / breach-register / consent-audit dashboard is design-spec, not live.** The live product shows a per-employee Compliance Center only.
10. **The UAE offboarding showcase is 8 steps where the KSA flow had 10.** Do not pad it with claims to get the length back; if they want the jurisdiction contrast, make it verbally — the engine carries a second jurisdiction's basis for Phase 2.
11. **The roster carries a terminated record and a possibly-contradictory onboarding row.** 8 UAE records — 5 active, 1 onboarding, 1 offboarding, 1 leaver — and the onboarding row is also the third seeded pre-boarding case (see Segment 2's box). Say the numbers before they are counted for you. **One more roster arithmetic to know:** the in-flight list prints each hire's day count as `Math.ceil((now − start_date) / 24h)` (`App.tsx:1383`; re-read 2026-10-08 on `origin/main` = `404b29d` and again the same day on `2584361` — same line), so a **future-dated** hire prints a negative count (`Day -n`) — raw arithmetic, not a labelled state. **No row on this seed shows it** (the only in-flight UAE hire started 2026-08-20, in the past; every one of the 8 UAE rows computes to a positive count — 49 … 1682), but do not put a future-dated hire on screen in front of a prospect without knowing it is there: the two seeded pre-boarding hires start **+1 day** and **+14 days** from seed day, and they are exactly the records that would expose it if one were added to the roster.
12. **One region per demo.** Leave the header controls untouched — changing what the dashboard shows mid-call breaks the story and the figures you have already said out loud. If a prospect asks about other countries, answer verbally: UAE-first is the launch.
13. **No delivery channel exists.** Nothing in this product sends an email, SMS or webhook, and no screen implies one did. Never say a reminder, notice or package "was sent" or "was emailed" — say it is **recorded in the product**, which is what the screens say.
14. **One thing here is not live, and one is built but not cut over — get both right.** The **hire-facing portal does not exist**, so no read event is tracked: do not demo or promise it. The **workspace track is built and merged** (P2-4, PR #86) and arrives with the same cutover as the rest of the pre-boarding layer — every provisioning line carrying exactly one owner, stored on the line. But the **demo cases carry no provisioning lines until the demo is re-seeded**, so **do not put the workspace board on screen on today's data**, and do not call it unbuilt either. If asked: *the second track is built; it lands with this cutover; its per-line owners are on the record.* *(Corrected 2026-10-09: this caveat said the workspace track "is not built" — false as of #86's merge.)*
15. **The sign-in screen describes an HR onboarding tool, not the platform.** Under the product name it reads **"HR Onboarding/Offboarding Intelligence Platform"** — the first line a prospect reads, before any credential is typed, and narrower than the pitch that follows it (cost-per-hire, retention, EOSB exposure). Get ahead of it if the call opens there, and change the line. *(Added 2026-10-08 with `demo-weak-screens.md` item 8.)*
16. **The EOSB forecast carries an all-zero KSA column on the UAE surface** — four quarters of UAE figures beside `KSA: 0.00 SAR`. It is arithmetically correct for a view scoped to the header jurisdiction. If asked whether the Saudi side is broken, say the view is scoped to the UAE header and the KSA records are not in scope here — and do **not** switch the region control mid-demo to prove it (Caveat 12). *(Added 2026-10-08 with `demo-weak-screens.md` item 10.)*

---

## Appendix — file & screen reference map

| In the script | Real reference |
|---|---|
| Offboarding checklist (Noura) | public URL → Employee Directory → Noura Al-Suwaidi; `GET /api/employees/:id/offboarding` |
| Onboarding checklist (Omar) | Employee Directory → Omar Al-Farsi; `GET /api/employees/:id/onboarding` |
| Executive Dashboard (4 KPIs + pipelines) | public URL → sidebar **Executive Dashboard**; `GET /api/analytics/dashboard?jurisdiction=AE` |
| **Pre-boarding HR roll-up (Segment 3)** | sidebar **Pre-boarding**; `GET /api/preboarding/checklist/overview?jurisdiction=AE` |
| **The flag itself** | `server/preboarding-flag.js` — derived on every read; boundary inclusive at exactly 48.00 h |
| **The three seeded cases** | `scripts/seed-demo.js` (run with `DEMO_SEED=true`) → `OFR-2026-DEMO-01/02/03`, offsets from seed day (on the 2026-10-09 seed: 2026-10-08 / 2026-10-10 / 2026-10-23) |
| **Pre-reading package + acknowledgement** | `GET /api/preboarding/cases/:id/package`; `POST …/package/:itemKey/acknowledgement`; `server/preboarding-package.js` |
| **Flag watcher (records, delivers nothing)** | `GET /api/preboarding/flag-watch` → `delivery: "none"` |
| **Layer 2 design spec (source of truth for this segment)** | `design-concepts/LAYER2-PREBOARDING-UI.md` (§5.1 = the seeded cases) |
| Transitions Hub | public URL → sidebar **Transitions Hub** |
| Strategic Intelligence | public URL → sidebar **Strategic Intelligence** |
| EOSB engine (frozen UAE tier) | `server/eosb.js` |
| Checklist templates (UAE onboarding/offboarding) | `server/compliance_engine.js` (`checklistTemplates`) |
| Document previews | `GET /api/compliance/templates/:templateName/:employeeId` |
| Consent capture | `POST /api/compliance/consent` → `consent_records` |
| Weak-screen audit (read alongside this script) | `demo-weak-screens.md` |
| Brand system | `design-concepts/BRAND-IDENTITY.md` (deep teal `#0F766E`) |

---

## Provenance — where each class of figure in this script came from

| Figure class | How it was read | Pass |
|---|---|---|
| The three cases, their chips, row lines and flag panels | Rendered page text + screenshots, scratch instance of `origin/main` = `404b29d`, port 4716 | 2026-10-08 08:36–08:41 UTC |
| Roll-up totals (3 cases / 21 outstanding / 0 verified / 3 without consent) | Same instance, rendered page | 2026-10-08 |
| Pre-reading package (9 items, 0/9 acknowledged, 0/2 required, delivery/read lines) | Same instance, opened row + `GET /api/preboarding/cases/:id/package` | 2026-10-08 |
| Checklists (Noura 8 steps / 2 done; Omar 7 steps / 2 done), roster (8 records, 5/1/1/1), consent date 2026-09-23 | Same instance, API + rendered page | 2026-10-08 |
| Dashboard card readings (19.2 d, AE 8,286.00, +19%, AE 85,247.11) | Same instance, rendered cards | 2026-10-08 |
| Cohorts (100/50/100/100) and Time-to-Value by department (16.7 / 25 / 19 / 21 d) | Same instance, API + card | 2026-10-08 |
| Settlement figures (EOSB 6,415.79 · Gross 11,577.08 · Net 11,577.08) and the "UAE / KSA" + "Antum Regional Hub" header | Same instance, rendered document markdown | 2026-10-08 |
| Public URL: 200, title, bundle size, and which strings the live bundle carries | Anonymous fetch of the published URL and its bundle — **no login, no credential** | 2026-10-08 |
| The "Basic Salary (UAE Rule)" line on the Compliance Center | **Re-read on the rendered record** — the offboarding record's Compliance Center shows the EOSB basis as `Basic Salary (UAE Rule)`, with the rendering condition in the shipped client (`App.tsx:1337`) | 2026-10-08, `origin/main` = `2584361` — **corrected**: an earlier version of this table said the line was carried and "not re-opened this pass", which was wrong |
| Everything behind the login **on the public URL** | **Not measured by me** — the demo credential is lead-managed (rule 10). The lead's own logged-in pass is the record for that surface | — |

*Prepared by Product Designer, Antum — pilot-ready demo script **v4.0** (UAE-first; re-walked 2026-10-08 against `origin/main` = `404b29d` on a scratch instance, with the pre-boarding segment gated on the Layer 2 cutover).*
*Reconciled 2026-10-08 with `demo-weak-screens.md` (re-grounded the same day on `origin/main` = `2584361`): the two documents carry the same findings, this script's caveat list is the short form and the audit is the longer one carrying the measurements. Three changes came out of that reconciliation — Caveats 15 and 16 were added (the sign-in line and the forecast's zero KSA column), Caveat 11 now names both revisions the day count was re-read on, and the provenance table's "Basic Salary (UAE Rule)" line was corrected, because that line was re-opened on the rendered screen and the earlier note said it had not been. The audit's mapping table names which of its items corresponds to which caveat here.*
