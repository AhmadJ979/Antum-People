# Antum People — Layer 2 Pre-boarding: the HR working surface

> **Status: every screen here is still design — and P2-2 has now built a first cut of it.**
> **P2-2 landed on `main` as PR #70 (`5ed731e`, 2026-10-07):** the per-case checklist, the AE and SA
> item sets, the status machine, the PDPL consent gate, an in-product reminder record, an HR
> roll-up, and the document-byte boundary. **Before quoting §§2–3 as a description of the product,
> read `design-concepts/LAYER2-P2-2-IMPLEMENTATION-NOTES.md`** — it states, with citations, what is
> built and where the build differs from this design. It is the spec for **P2-2** (employee-track
> document collection) and **P2-4** (workspace-track provisioning checklist), plus the surfaces of
> **P2-5** (the derived 48-hour flag) and **P2-6** (EN/AR and PDPL consent). **P2-1** — the
> offer-acceptance trigger and the single case-creation path —
> **landed on `main` as PR #66 (2026-10-07)** and is **out of scope here**: this spec consumes the
> case model, it does not define it. P2-1's own tab is reviewed against this spec in
> `design-concepts/LAYER2-P2-1-IMPLEMENTATION-REVIEW.md`.
>
> **Grounded on:** `client/src/App.tsx`, `server/schema.sql`, `server/preboarding.js` and
> `server/index.js` on `main` at **`34fdd63`** (first read 2026-10-06) and **re-grounded on `main`
> at `75e3ff2`** — the merge of PR #66 — on 2026-10-07, and `server/preboarding-items.js` and
> `server/document-store.js` were read on `main` at **`5ed731e`** — the merge of PR #70 — the same
> day. **§5's copy and the row's distance reading were re-read on `main` at `f3f2bac`** — the merge
> of PR #76 — on 2026-10-07: `server/preboarding-flag.js` (the derivation, its three states and the
> amber headline), and `client/src/App.tsx`, where the row's `relDays()` helper arrived with
> **PR #77 — merged on 2026-10-07, `main` now at `56fd1fd`** — and is **not** in `f3f2bac` itself.
> Also read:
> `design-concepts/BRAND-IDENTITY.md` (palette, type), `design-concepts/USER-JOURNEY-MAPS.md`
> (Stage 1 — Pre-Arrival, Days −14 to −1), `design-concepts/DASHBOARD-WIREFRAMES.md` (wireframe
> house style).
>
> **Every line number below is that revision's, and code moves.** Before relying on one, re-derive
> it from the anchors this file leans on —
> `grep -n "id: 'dashboard'" client/src/App.tsx` (the nav) ·
> `grep -n "^CREATE TABLE" server/schema.sql` (the tables) ·
> `grep -n "api/preboarding" server/index.js` (the Layer 2 case routes) ·
> `grep -n "documentSetFor" server/preboarding-items.js` (the item sets) ·
> `grep -n "h before 00:00" client/src/App.tsx` (the row's distance copy) ·
> `grep -n "start in 48 hours or less" server/preboarding-flag.js` (the amber headline). When PR #66 landed
> `App.tsx` grew by 245 lines and every `App.tsx:` citation in this file had to be re-read, which
> is why this note now names the revision it was read at.
>
> **P2 criteria** quoted below (P2-2, P2-3, P2-4, P2-5, P2-6) are from the team's roadmap,
> `phase-roadmap-2-4.md`, which is held in the shared team directory rather than in this repo —
> so a reader here can see which acceptance line each screen answers.
>
> **Every figure inside a mock below is invented placeholder content for layout only.** The
> names are deliberately *not* the seeded records, so that no row here can be mistaken for a
> reading of any surface. The demo's own readings live in `demo-walkthrough-script.md` and are
> read off the screen at call time, never from this file.

---

## 0. What the product actually has today

This is the honest starting point. Every line below was read in the repo, not assumed. The table
was **re-read on `main` at `75e3ff2`** (2026-10-07), after P2-1 landed; where a line number moved
since the first reading, the re-read number is the one shown. **P2-2 then landed (`5ed731e`) and
changed some of these answers** — each row it changed says so in place and points at
`LAYER2-P2-2-IMPLEMENTATION-NOTES.md` §2 for the current state, so this table is not read as if it
were still today's. **P2-5 then landed too (`f3f2bac`, PR #76, on `main` and not deployed): it
answers one more row of this table, marked in place.**

| Thing the Layer 2 surface needs | What exists today | Where |
|---|---|---|
| A place to live in the nav | **Five** tabs: **Executive Dashboard, Employee Directory, Transitions Hub, Pre-boarding, Strategic Intelligence**. **Changed by P2-2:** the tabs are one list now, read by both the sidebar and the breadcrumb | `App.tsx:115`–`:125` (`NAV_ITEMS`, `navLabel`); tab state `:272` |
| A case to hang every item on | `preboarding_cases(id, offer_reference UNIQUE, candidate_name, candidate_email, role, department, reporting_line, jurisdiction, start_date, status, source, offered_at, created_by, created_at, updated_at)` — **exists since P2-1**; on `main`, **not deployed** | `schema.sql:177`–`:193` |
| One case-creation path, not two | `recordOfferAcceptance` is the only writer (idempotent on `offer_reference`); `POST /api/preboarding/cases` reaches it, `GET` list and `GET :id` read it back | `server/preboarding.js:119`, `:97`, `:104`; `server/index.js:580`, `:597`, `:606` |
| A Layer 2 tab to extend | The tab exists — an intake form and a case list, house-styled | `App.tsx:1184`–`:1321`. **Changed by P2-2:** the tab is now the intake form plus an "HR roll-up — outstanding items" panel, in `App.tsx:1397`–`:1650`; the old range is gone |
| A checklist item that can carry an **owner** | `interface Task` has `id, employee_id, title, description, due_date, completed_at, status, category, ttv_milestone` — **no owner, no track, no Arabic text** | `App.tsx:32`–`:41` |
| The same, in storage | `onboarding_tasks(id, employee_id, title, description, due_date, completed_at, status, category, ttv_milestone, created_at)` — **no owner, no track, no function** | `schema.sql:43`–`:55` |
| **Any item at all, attached to a case** | **Built by P2-2:** `preboarding_items(id, case_id, item_key, label, category, jurisdiction, required, status, document_reference, note, requested_at, received_at, verified_at, last_actor, …)`, `UNIQUE (case_id, item_key)`. The AE set is 7 items, the SA set 6 and inactive this release. **Still absent: owner, due date, track** — so §3's per-item owner and due date, and §6's track split, are still waiting | `schema.sql:202`–`:227`; `server/preboarding-items.js:64`–`84` |
| A consent record to gate documents on | `consent_records(id, employee_id, …)` for *employees*, plus `employees.consent_granted` / `consent_date` — and, **added by P2-2**, `preboarding_consents(case_id UNIQUE, consent_type, lawful_basis, consent_version, granted_at, recorded_by)` for the *case*, which is the one this surface gates collection on (refused **428** without it) | `schema.sql:93`–`:105`, `:244`–`:255`; `server/preboarding-items.js:195` |
| Per-function identity ("IT sees only its own lines") | `users(id, username, password_hash, role, created_at)` exists, but the product seeds **one shared account** — no per-user login to scope a view by | `schema.sql:165`–`:171` |
| Somewhere to put a collected document | **Nothing — deliberately, and now by the owner's decision.** P2-2 records a short `document_reference` (a file name, or the reference HR quoted) and refuses the bytes: `server/document-store.js` throws **501** behind `saveDocument`/`readDocument` and names `ANTUM_DOCUMENT_STORE` as the one door. **The owner decided the shape on 2026-10-07: Option D ships now — reference string only, no bytes — and Option C (an S3-compatible object store) is built when the entity is registered; IFZA registration is the gate, an event rather than a date. No real document bytes before it.** The pointer is therefore the personal data: the item says *which* document, whose, when recorded and where it lives, and the content stays where HR already keeps it | `server/document-store.js`; spec §10 Q5 |
| A record of an acknowledgement (JD, NDA) | **Nothing.** `consent_records` is a consent record, not an acknowledgement record | — |
| Bilingual / RTL rendering | **No i18n layer in the client.** The bilingual reference is the AR prototype and the EN/AR mockups | `design-concepts/intelligence-dashboard-prototype.html`, `intelligence-dashboard-{ar,en}-mockup.png` |
| A way to notify anyone | **No delivery channel** — no mailer, webhook or SMS anywhere in the product | plan, Gate 2 decision (2026-10-06) |
| An in-process timer / scheduled check | **Nothing.** No cron, no working systemd on this host | plan §6; Gate 2 decision |
| A demo dataset to look at | **Added by the L2 demo seed (PR #73, on `main`, not deployed):** three pre-boarding cases, one per flag state by construction — start = seed **+14** (`OFR-2026-DEMO-01`), seed **+1** (`-02`), seed **−1** (`-03`). Each carries the AE 7-item set with everything open, and **no consent record** (a seed test asserts that, deliberately: the presenter records consent on screen and watches the gate open). **Nothing stores a flag or a state** | `scripts/seed-demo.js`; evidence `docs/evidence/l2-demo-seed/`; states and their expected readings §5.1 |
| Any derived "days remaining" or flag computation | **Built by P2-5 (PR #76), on `main` at `f3f2bac` — not deployed:** `server/preboarding-flag.js` derives the flag on every read from the start date and the open items, and returns the three states with both `days_to_start` and `hours_to_start`. **Nothing stores a state**, and the seed's own test still asserts that. **The copy beside it was fixed the same day: PR #77, merged, makes the row take the flag's own reading** (`relDays()`) — `· 14 d`, `· 7.5 h before 00:00 on the start date` or `· started 1 d ago`, the last also covering a *clear* case whose start date has passed with its items complete — where `f3f2bac` still printed the raw `days_to_start` (`14` / `1` / `-1`). The server side is untouched | `server/preboarding-flag.js`; §5, §5.1 |
| The labels we must not lose | **"Sample Demo Data"** badge — in the **app-level header**, so it also covers the new Pre-boarding tab — and the **"Illustrative …"** markers | `App.tsx:660`; `:721`, `:723`, `:738`, `:775`, `:812`, `:1061`, `:1067`, `:1073`, `:1088`, `:1104`, `:1116`, `:1145` |

**Visual language to extend, not replace** (exact classes as served):

- Checklist row — `flex items-start space-x-3 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-teal-200 transition`; checkbox `mt-1 h-4 w-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500 cursor-pointer`; done title `line-through text-slate-400`, open title `text-slate-800 text-sm font-bold`; description `text-xs text-slate-500` (`App.tsx:955`–`:966`).
- Dark panel — `bg-slate-900 text-white p-6 rounded-xl shadow-lg`, section heading `font-bold text-teal-400 text-sm tracking-widest uppercase` (`App.tsx:975`–`:976`).
- Small caps field label — `text-[10px] font-bold text-slate-400 uppercase tracking-widest` (`App.tsx:980`, `:987`) — P2-1's intake form reuses this class throughout (`App.tsx:1214`–`:1264`).
- Empty state — `py-12 text-center text-slate-400 text-sm italic` (`App.tsx:969`). P2-1's case list uses a dashed-border variant instead (`App.tsx:1291`–`:1293`).
- Status colours from `BRAND-IDENTITY.md`: **Success Green** `#22C55E` complete · **Warm Amber** `#F59E0B` due-soon / at-risk · **Coral Red** `#EF4444` overdue / blocking · **Sky Blue** `#3B82F6` onboarding/info · **Deep Teal** `#0F766E` primary action.

---

## 1. Where the surface lives

**Recommendation (design call, reversible): a fifth top-level nav item — `Pre-boarding` — between
Transitions Hub and Strategic Intelligence.**

> **Built, exactly here.** P2-1 landed this placement: nav entry `App.tsx:631`, tab render
> `App.tsx:1184`–`:1321` (PR #66, 2026-10-07). The paragraphs below were written before that tab
> existed and are now a description of what shipped, not only a proposal. What the tab does *not*
> yet have — because it is P2-2/P2-4/P2-5, not P2-1 — is everything §2–§6 specify; the review of
> the shipped surface against this spec is `design-concepts/LAYER2-P2-1-IMPLEMENTATION-REVIEW.md`.

- Layer 2 is the layer the business is selling next; hiding it under Transitions Hub makes the
  buyer ask where it is. The nav already names layers 1 and 4 ("Transitions Hub", "Strategic
  Intelligence"), so a third layer-named tab is consistent.
- The list in §2 is an **HR working surface**, opened daily and left open — that earns a tab, not
  a sub-section.
- **Alternative considered and rejected:** a section inside Transitions Hub. Rejected because
  Transitions Hub today is about *people leaving or moving*; pre-boarding is about *someone not yet
  in the building*, and mixing the two makes both lists less scannable.

If the lead prefers the sub-section, only §2's placement changes — every state, rule and row
anatomy below stays identical.

---

## 2. Screen S1 — Pre-boarding cases (the list)

**Purpose (this is P2-2's acceptance criterion, not a nice-to-have):** HR sees **every live case
without opening one**. If a fact needs a click to discover, it belongs on this row.

**Demo data — decided by the owner, 2026-10-07:** the demo **will** carry **three seeded
pre-boarding cases**, one per flag state, as seed data only, with the "Sample Demo Data" badge
intact and no real-person PII. The states must arise **by construction** from the seeded dates and
item statuses — the 48-hour flag stays *derived* and is never stored. The board task is `[L2 seed]`
(`86749e1f`); the sequencing consequence (no derivation exists in code yet, so seed data alone
cannot make three *states* appear) is stated in `LAYER2-P2-2-IMPLEMENTATION-NOTES.md` §4.

**Scoping — decided by the owner, 2026-10-07:** the list call passes the header's **active
jurisdiction (AE by default)**, so a UAE-header surface never shows a KSA case — the rule the roster
and the dashboard already follow, and the same defect class as the settlement header still reading
"UAE / KSA". **The row's jurisdiction chip stays**, also the owner's call: it is the case's own
recorded value, and on a scoped list it will normally repeat the header's. **He decided this knowing
it is redundant under scoping** — he was told in those words and kept it, so the repetition is his
choice, not a defect for a reviewer to re-open, and revisiting it is his call. The row anatomy below
therefore lists it as a field, and S2 shows the same value on the case itself (§3) — the reader
never has to infer a case's jurisdiction from the header's switch. The code change **landed in the P2-2 PR (PR #70, `5ed731e`)**, not here. (The P2-1 build, shipped before this decision, already renders the chip; what is
missing is the jurisdiction argument on the list call — see `LAYER2-P2-1-IMPLEMENTATION-REVIEW.md`
F1.)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [Antum People]  Dashboard │ Employees │ Transitions │ Pre-boarding │ Analytics   [👤]      │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  Pre-boarding cases                              [ Sample Demo Data ]      [ EN │ AR ]      │
│  3 live · 1 needs attention now · 1 started with items still open                           │
│                                                                                            │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐    │
│  │ 🔴  STARTED 2 DAYS AGO · 2 ITEMS OPEN                    sample row, not a record    │    │
│  │ S. Nasser (placeholder)   ·  Sales Executive  ·  Sales                              │    │
│  │ Start 2026-10-12  ·  started 2 d ago                                                │    │
│  │ Employee track  ████░░░░░░  6 of 9   ·   Workspace track  ████████░░  4 of 6        │    │
│  │ Open now:  IT · Laptop issued   IT · Email + SSO   (2)                              │    │
│  │ [ Open case ]                                                                        │    │
│  ├────────────────────────────────────────────────────────────────────────────────────┤    │
│  │ 🟠  INSIDE 48 HOURS · 5 ITEMS OPEN                        sample row, not a record   │    │
│  │ A. Haddad (placeholder)   ·  Marketing Manager  ·  Marketing                        │    │
│  │ Start 2026-10-16  ·  43.0 h before 00:00 on the start date                          │    │
│  │ Employee track  █████░░░░░  4 of 9   ·   Workspace track  ███░░░░░░░  2 of 6        │    │
│  │ Open now:  IT · Laptop issued   IT · Email + SSO   Admin · Building card            │    │
│  │            Manager · 30-day check-in set   HR · Emirates ID verified (3 more)       │    │
│  │ [ Open case ]                                                                        │    │
│  ├────────────────────────────────────────────────────────────────────────────────────┤    │
│  │ ⚪  ON TRACK                                              sample row, not a record   │    │
│  │ M. Farouk (placeholder)   ·  Product Designer  ·  Product                           │    │
│  │ Start 2026-10-26  ·  12 d                                                           │    │
│  │ Employee track  ████████░░  8 of 9   ·   Workspace track  ████████░░  5 of 6        │    │
│  │ Open now:  HR · Signed NDA (1)                                                       │    │
│  │ [ Open case ]                                                                        │    │
│  └────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                            │
│  Mock reference time: 2026-10-14 09:00 (GST). Row contents are invented placeholders for   │
│  layout only — not seeded. The counts shown ("6 of 9", "4 of 6") are placeholder           │
│  magnitudes so the rows have a shape; they are not the specified checklist lengths.        │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Row anatomy — every field and whether it exists today

| Field on the row | Rule | Source today |
|---|---|---|
| **Flag chip** (🔴 / 🟠 / ⚪) | From the derived flag in §5. First thing scanned, always left-most. | **Nothing** — must be computed |
| **Name** | Case subject. | `employees.first_name/last_name` |
| **Job role · Department** | The role the offer was accepted for. | `employees.role`, `employees.department` |
| **Jurisdiction** (UAE / KSA chip) | The case's **own** recorded value, right-aligned on the name line. **Kept by the owner's decision (2026-10-07)**, decided **knowingly** — he was told it is redundant on a scoped list and kept it, so revisiting it is his call, not a reviewer's. | `preboarding_cases.jurisdiction` — rendered since P2-1 (`App.tsx:1303`–`:1305`) |
| **Start date** | The anchor of the whole surface. A case cannot exist without one (P2-1). | `employees.start_date` |
| **Relative time** — one reading, from the flag | **The row renders the flag's own derivation, never a second computation** (lead ruling, 2026-10-07, §5) — so one row can never carry two distances that disagree. Derived from the start date **at read time**, never stored; whole days = `ceil((start_date 00:00 − now) / 24h)`. The three readings, exactly: **clear / not raised → whole days** (`· 14 d`) · **inside 48 hours → hours, one decimal** (`· 7.5 h before 00:00 on the start date`) · **start date passed → `started 1 d ago`**, absolute value, **never a bare negative** — and the same absolute branch catches the case a reader will not think of, a *clear* case whose start date has passed with every item complete (`· started 6 d ago`). §5's copy rules carry the arithmetic behind this. | **Nothing** — must be computed |
| **Employee-track progress** | `n of m` items complete, plus a bar. Counts, not percentages-as-scores. | **Partly** — counts computable from `onboarding_tasks.status`; the *track split* has no column (§9 D2) |
| **Workspace-track progress** | Same shape, separate bar, same row height. | Same |
| **Open-now list** | **Owner + item title** for the incomplete items, worst-first, capped at 4 with a `(n more)` tail. This is the "who owns each open item" answer (P2-4) and it is on the *row*, not behind the click. | **Owner does not exist** (§9 D1) |
| **Open case** | Drill-down to S2. The only action on the row. | — |

### Ordering

1. **Overdue first** (start date passed, items open), then **inside 48 hours with open items**,
   then everything else.
2. Within a group, **soonest start date first**.
3. Never re-order on hover, selection or read — the list must not move under a cursor.

### States

| State | What renders |
|---|---|
| **No live cases** | The house empty state (`py-12 text-center text-slate-400 text-sm italic`): *"No pre-boarding cases in flight."* Plus one non-blocking line pointing at the intake form (P2-1's surface) as the way a case begins. Never a bare table header. |
| **One case** (the demo's current shape) | The list renders one row. It must not stretch a "1 case" layout into a hero card — the same row anatomy renders at any count, so the surface reads the same on day 1 and at scale. |
| **Many cases** | Same rows; the "needs attention" summary line at the top becomes the scanning aid (count of overdue + count inside 48h). |
| **Case whose start date passed but every item is complete** | Renders as **complete**, not overdue. Tone is Success Green, not Coral. This is the case that proves the flag is derived, not sticky. |

### What must never appear on this screen

- A score, a risk rating, a percentage-complete ring, or any invented composite metric.
- A per-case cost, salary or EOSB figure. Layer 2 is about readiness; money belongs to Layer 4.
- Any aggregate that reads as a benchmark. Counts of cases are fine; comparisons are not.

---

## 3. Screen S2 — Case detail (the two tracks)

**The case's own jurisdiction is read here**, in the detail header — name · role · department ·
**jurisdiction** — because this is the one screen that is about a *single* case and §6's track
derivation reads the recorded column. It is the same value the row carries on S1 (§2), so the two
can never disagree; the difference is context, not content: the list is read in the header's
jurisdiction, and the detail is read on its own.
**This header is the reviewer's recommendation, not an owner ruling.** The owner ruled on the
**row's** chip (2026-10-07); he was not asked about the detail header. If he would rather the detail
header dropped it, the row still carries the case's jurisdiction and nothing else in §3 changes.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Pre-boarding            A. Haddad  ·  Marketing Manager  ·  Marketing  ·  UAE           │
│                           Start 2026-10-16  ·  43.0 h before 00:00 on the start date      │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐  ┌─────────────────────┐  │
│  │ 🟠 INSIDE 48 HOURS — 5 items open                          │  │ Consent (PDPL)      │  │
│  │ Computed from the start date and the items still open.     │  │ ✓ Recorded          │  │
│  │ It clears by itself when the last open item completes;     │  │ on 2026-10-09       │  │
│  │ nothing here was emailed or sent to anyone.                │  │ Documents unlocked  │  │
│  └────────────────────────────────────────────────────────────┘  └─────────────────────┘  │
│                                                                                            │
│  ┌──────────────────────────────────────┐  ┌──────────────────────────────────────────┐   │
│  │ EMPLOYEE TRACK   4 of 9 complete     │  │ WORKSPACE TRACK   2 of 6 complete        │   │
│  │ (the new hire's own items)            │  │ (provisioning, by function)              │   │
│  │                                      │  │                                          │   │
│  │ ☑ Passport copy          done 10-08  │  │ ☑ IT · Laptop ordered        done 10-09  │   │
│  │ ☑ Visa / entry permit    done 10-09  │  │ ☑ IT · Account created       done 10-11  │   │
│  │ ☐ Emirates ID copy       pending     │  │ ☐ IT · Laptop issued         due 10-15   │   │
│  │   └ records a ref, not the number   │  │   └ owner: IT · due D-1                  │    │
│  │ ☐ Education certificate  pending     │  │ ☐ Admin · Building card      due 10-15   │   │
│  │ ☐ Experience letters     pending     │  │ ☐ Manager · 30-day check-in  due 10-15   │   │
│  │ ☐ Bank details (IBAN)    pending     │  │ ☐ HR · Offer letter filed    due 10-15   │   │
│  │ ☐ Emergency contact      pending     │  │                                          │   │
│  │ ☐ Signed JD              pending     │  │ Every line carries an owner and a due    │   │
│  │ ☐ Signed NDA             pending     │  │ date, derived from the start date.       │   │
│  └──────────────────────────────────────┘  └──────────────────────────────────────────┘   │
│                                                                                            │
│  Pre-reading package (acknowledgement tracked per item)                                    │
│  ☐ Org chart   ☐ Reporting line   ☐ Team members   ☐ Handbook   ☐ Policies                 │
│  ☐ Code of conduct   ☐ Dress code                                                          │
│                                                                                            │
│  Mock reference time: 2026-10-14 09:00 (GST). Placeholder content for layout only.          │
│  The counts ("4 of 9", "2 of 6") are placeholder magnitudes, not the specified checklist    │
│  lengths; the item lists themselves come from P2-2 / P2-3's content decisions.             │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Item-row anatomy** (extends the served checklist row, does not replace it): checkbox ·
title · status · **owner chip** · **due date** · an optional one-line qualifier. The owner chip is
a small pill (`text-[10px] font-bold uppercase tracking-widest`) carrying one of **IT · Admin ·
HR · Manager** — the four functions P2-4 names.

**Two tracks, one case, never merged.** P2-2 and P2-4 are separate acceptance criteria with
separate owners; a single blended list would hide which function is late. The two panels sit
side by side on desktop and stack on narrow screens, employee track first.

**Per-track roll-up is a count, never a percentage-as-score.** "4 of 9 complete" is a fact;
"44% ready" is an invented metric.

---

## 4. Screen S3 — Function view ("my lines")

This is the surface P2-4 asks for in its acceptance line *"IT/Admin see only their own lines."*
**It cannot be built as written today, and the spec says so plainly.**

- `users` does carry a `role` column (`schema.sql:165`), but the product seeds **one shared
  account** — so "who is looking" is not knowable at request time. A function filter with no
  account model is a **view convenience, not an access boundary**, and must never be described as
  one: HR would still see every line, and IT could still open any case.
- **What the design needs from that decision (not for me to make):** per-user accounts with a
  function attribute, and a decision on whether the four functions are *permission scopes* or
  merely *default filters*. Until then:

| Phase | What ships | What it is called in the UI |
|---|---|---|
| Now (single shared account) | A **filter** on S1/S2: chips `All · IT · Admin · HR · Manager` that narrow the open-now list to one function. Visible to whoever is signed in. | "**View by function**" — a filter |
| When per-user accounts exist — **owner, 2026-10-07: at Layer 3 build time, and "My lines" ships with them** | The same chips, plus the signed-in user's function pre-selected and forced, with other functions' lines read-only. | "**My lines**" — a scope |

The distinction is a **wording** requirement, not a nicety: shipping the filter and calling it
"My lines" would tell a client that IT cannot see HR's lines when nothing stops it. That is the
kind of claim this team has had to retract before.
**The owner answered the timing on 2026-10-07:** per-user accounts land **at Layer 3 build time**,
**"My lines" ships with them**, and **no real client data enters the product until per-user RBAC is
live** — so until then the filter ships under the label "View by function", and the honest answer to
a prospect who asks about access control is *"role-based access is on the Layer 3 roadmap"*.

---

## 5. The derived 48-hour flag (P2-5)

### Definition (single, derived, never stored)

```
flag_is_raised  =  open_items_in_case > 0
                   AND  (start_date 00:00 − now) ≤ 48h
```

- **Track-agnostic (lead ruling, 2026-10-07):** the flag reads **every item on the case, whichever
  track created it**. Today that is the employee track, because it is the only one that exists; when
  P2-4 lands, its workspace items join this same rule and the definition above does not change.
- **Derived, not stored:** it is computed on every read from the start date and the items' current
  status, so it cannot drift from the data and cannot survive a restart as a stale value.
- **Boundary is inclusive at exactly 48 hours.** P2-5 says the flag *"fires on the 48-hour
  boundary, not at some point that day."* An inclusive comparison is what makes that true: at
  T−48:00:00 the flag is raised, not "later that morning".
- **Clears by itself.** The instant the last open item is marked complete, the flag is gone on the
  next read. There is **no dismiss, no snooze and no "acknowledge" control** — a dismissible flag
  is a flag that lies about the state of the work.
- **A start date that has passed does not clear it.** Items still open after day one keep the flag
  raised, escalated in tone (Coral, "started"), because that is the honest state.

### The three states, exactly

| State | Condition | Chip | Headline copy | Body copy | Colour |
|---|---|---|---|---|---|
| **Clear** | No open items, **or** more than 48h to start with everything open still fine | ⚪ **On track** | "On track" | "*n* items still open, with *d* days to go — the flag starts 48 hours before the start date." (only when items exist and are open) | Slate / Success Green |
| **Inside 48 hours with open items** | `open > 0` and `≤ 48h` to start | 🟠 **Inside 48 hours · *n* items open** | "*n* items open · start in 48 hours or less" | Names each open item, its status and the distance to start — **hours, one decimal**, the row's one rule (§2) — and its owner's function **only where one exists** (see the copy rules) | Warm Amber |
| **Start date passed, items still open** | `open > 0` and start < now | 🔴 **Started *n* days ago · *n* items open** | "Started with *n* items still open" | Same list; adds the honest line "these were due before day one" | Coral Red |
| *No start date* | — | — | Cannot render: a case without a start date cannot exist (P2-1). If one were ever read, the surface shows the error state, **not** a default date. | | Rose |

**Why the amber headline reads "or less" (lead ruling, 2026-10-07).** The boundary above is
**inclusive at exactly 48.00 h**, so "*n* items open, start in **under** 48 hours" is false at the one
instant the flag must first be true. The headline is **"*n* items open · start in 48 hours or less"** —
true at 48.00 h and at every instant after it, and true at all the hours before it too.

### Copy rules — what the flag may and may not say

The flag is a **state, not an event**. On this product there is no mailer, webhook or SMS, so:

- **Never:** "sent", "notified", "emailed", "reminder sent", "alerted IT", "IT has been informed".
- **Never:** a timestamp that implies a message went out, or a bell/paper-plane/envelope icon.
- **Never a bare negative day count — on the row as well as on the chip.** `Start: 2026-10-06 · -1 d`
  is what the built roll-up printed for the started case until **PR #77** — measured 2026-10-07 on
  `main` at `f3f2bac` (§5.1) and fixed by #77, merged the same day. `-1` is an input, not a
  message: the Coral state says **"Started 1 day ago · 7 items open"**, and the row's own reading is
  **`· started 1 d ago`**. **The server is unchanged** — `days_to_start` stays the raw signed
  number — and the guard that renders it absolutely is in the built client bundle (verified by the
  lead, 2026-10-07), so no row can print a bare negative even while the API keeps returning one.
  **P2-5's acceptance includes: no surface prints a negative `days_to_start`. A row is a surface**,
  and this rule was first written against the chip alone.
- **One distance per row — the row reads the flag's own derivation (lead ruling, 2026-10-07).** The
  row's distance is taken from the flag's fields, never recomputed beside it, so a row can never
  carry two numbers that disagree. **Why the rule exists — the arithmetic:** §2 counts **whole days**
  while §5 measures **hours**, so a case with `days_to_start = 2` is between 24 and 48 hours out for
  the whole of that day; the engineer reported one (2026-10-07) reading `2 d` beside its own chip's
  *"Inside 48 hours · 7 items open"*. Both numbers were true under their own definitions and both sat
  on the same row. The row therefore renders exactly three readings: **whole days** when the flag is
  clear or not raised (`· 14 d`) · **hours, one decimal**, inside 48 hours (`· 7.5 h before 00:00 on
  the start date`, measured from **UTC midnight** of the start date, as the derivation does) ·
  **`started 1 d ago`** once the start date has passed, as an absolute value. The absolute form also
    covers the *clear* case whose start date has passed with every item complete: it is not overdue,
  and its row still may not print `· -6 d`. **As built (PR #77), that case renders `· started 6 d
  ago`** — the absolute form is what keeps this rule true where it is least expected.
- **An owner is never invented.** Owners exist only on the workspace track (P2-4), which does not
  exist yet, so on today's employee-track items the flag names the item, its status and the distance
  to start (§2's one reading), and says plainly that **no owner is recorded** rather than implying
  one. If the owner later wants owners on the employee track, that is his decision and its own row
  (lead ruling, 2026-10-07).
- **Always:** present-tense state — "5 items open", "start in 48 hours or less", "opens in this view".
- When an unprompted in-app notice exists (Gate 2's in-process timer), it says what the app did:
  *"This case reached the 48-hour mark while the app was open"* — and, if the server was down
  across the boundary, the flag simply reads correctly on the next read with **no** "missed
  notification" state, because a derived flag has nothing to miss.

**Anchor check — re-read off `origin/main` = `404b29d`, 2026-10-08.** The client anchors this section rests on, each with the grep that finds it, run against the merged file rather than a branch:

- `{row.flag.chip}` — `git show origin/main:client/src/App.tsx | grep -n "row.flag.chip"` -> **`:1690`** (the guard) and **`:1696`** (the span); the `Open`/`Close` span sits at `:1699`.
- the row's own distance — `... | grep -n "relDays(row.flag)"` -> **`:1674`**.
- `h before 00:00 on the start date` — `... | grep -n "h before 00:00"` -> **two** hits, **`:197`** (the flag's own derivation in `relDays`) and **`:1733`** (the panel's own line). It is **not** a unique anchor: quote the hit you mean.

An earlier submission cited `:1624` for the third of these and `:1605` for the first. Both were carried rather than re-read: `:1605` was this span when the review ran against `5087136`, `:1624` was never right, and **PR #79 (2026-10-08) added 165 lines to this file, none deleted** (`git diff --numstat 5087136 404b29d -- client/src/App.tsx` -> `165  0`; 1887 lines -> 2052), which is why no single offset describes the move: `:157` -> `:197` (+40) but `:1602` -> `:1696` (+94). That is why the anchors above are pinned to the commit they were read from and given with their greps.

### Where the flag surfaces (three places, one definition)

1. **S1 row chip** — the scan target; drives ordering (§2).
2. **S2 header banner** — one line naming the count, the owners and the clearing rule (the banner
   in §3 is the template).
3. **S3 function filter** — a count badge per function chip ("IT (2)"), so a function lead sees
   their own exposure without reading every row.

All three read the same derivation. No surface may compute its own version.

### 5.1 The seeded cases — P2-5's acceptance against the demo's own data
The demo dataset now carries the three cases the owner asked for (PR #73, on `main`; seeded through
the product's own `recordOfferAcceptance` and `setItemStatus`, no stored state). **Their dates are
offsets from the day the seed runs**, so what is fixed is the offset, never the date — read this
table as *inputs*, and re-derive the states on the day you look. Every figure below was read off a
scratch instance of `origin/main` on 2026-10-07 (own DB and port; the live deployment untouched):

| Offer | Case | Offset / start that day | Items | Distance the row must print (§2's one rule) | State §5 requires | What P2-5 must render there |
|---|---|---|---|---|---|---|
| `OFR-2026-DEMO-01` | Omar Al-Farsi (roster `demo-emp-omar`) | **+14** · 2026-10-21 | 7 open (3 `requested`, 4 `not_started`) | `· 14 d` — whole days | **Clear** | ⚪ **On track** · headline "On track" · body "7 items still open, with 14 days to go — the flag starts 48 hours before the start date." · Slate/Green |
| `OFR-2026-DEMO-02` | Mariam Al-Kaabi | **+1** · 2026-10-08 | 7 open (all `not_started`) | `· n.n h before 00:00 on the start date` — **hours, one decimal**, not `· 1 d`. The implemented example is `· 7.5 h` (PR #77's evidence, read at the hour that scratch case ran); the value shrinks through the seed day, so a fixed offset cannot pin it and the reading is written as *n.n* | **Inside 48 hours** | 🟠 **Inside 48 hours · 7 items open** · "7 items open · start in 48 hours or less" · names each open item, its status and the distance to start, with an owner only where one exists (see the copy rules) · Warm Amber |
| `OFR-2026-DEMO-03` | Yousef Al-Hammadi | **−1** · 2026-10-06 | 7 open (all `not_started`) | `started 1 d ago` — absolute value; **PR #77 (merged) replaced the bare `· -1 d` this row printed before it** | **Started, items open** | 🔴 **Started 1 day ago · 7 items open** · "Started with 7 items still open" · same list + "these were due before day one" · Coral Red |

Three things this table settles for P2-5 — the first as it was read on the deployed surface, marked
where PR #76 has since moved it:

1. **The states are not on the screen** — as this table was first read. No flag chip rendered
   anywhere on the surface of the day (the row's two chips are the jurisdiction and the case status
   `Open`). The seed deliberately faked nothing — so at that reading the demo showed the right facts
   and no alarm, and **P2-5 is what turns the three cases into one visible red, one amber and one
   clear.**
   **Changed by PR #76 (re-read 2026-10-07):** the flag has since merged on `main` at `f3f2bac` —
   `server/preboarding-flag.js`, and the chip, headline and open-item block it derives at
   `App.tsx:1581` and `{row.flag.chip}` at `App.tsx:1696` (both re-read on `origin/main` = `404b29d`, 2026-10-08). It draws **inside the built HR roll-up**, not yet on §2's list row or
   §3's detail header, and the live deployment still runs `5ed731e`, which draws none. The three
   readings in the table above are therefore now the acceptance line for a **built** component rather
   than for one still to be built — **and none of the three changes.**
2. **`-1 d` must not survive — and it was the row, not the chip, that printed it.** See the copy
   rule above: the started case's message is a sentence, not a negative number, and the row beside
   the chip reads `started 1 d ago`. The built roll-up's row is where the bare `· -1 d` was printed
   (measured 2026-10-07 on `main` at `f3f2bac`); **PR #77, merged the same day, is the fix**, so this
   reading is the row's, not only the flag's (§2) — and the row is where the surface could disagree
   with the chip about the same case.
3. **The three-state demo has a shelf life of one morning.** Case 2's start is seed day **+1**, so its
   amber window closes at 00:00 UTC on that date (**04:00 GST**) — after that it is a Coral case
   like case 3, and the demo shows two started and one on track, with no amber anywhere. Re-seed on
   the morning of a demo, and say on the day that the demo was seeded that morning; the plan already
   requires the same for the accrual figures.

**The fourth case, which the three rows above do not show (as built, PR #77).** A case whose start
date has passed **with every item complete** derives *clear*, not overdue — and its row must still
not print a signed negative, so it renders **`· started 6 d ago`**. Same branch, same reason as row
3; it is written down because it is the case a reader does not think of.

**What this table is not.** It is not a claim that any state is computed today, and it is not a
reading of a built flag: the right-hand column is this spec's requirement, applied by hand to the
measured inputs. **The distance column is the same kind of statement** — the reading §2's one rule
*requires* of the row (whole days, hours, or `started n d ago`), not a reading of any built row: the
`· 1 d` and `· -1 d` the roll-up printed when this table was written are kept out of it precisely
because the ruling of 2026-10-07 forbids them. Nothing here asks the seed to store a state.

---

## 6. The workspace track (P2-4)

P2-4's acceptance: *"assignment is derived from the role, not typed per case; each line has a
responsible function."* So the case-creation path (P2-1) must carry enough to choose the lines —
the role, the department, the reporting line and the jurisdiction — and the checklist is then a
**consequence** of those fields, never a form HR fills in per hire.

| Function | Lines it owns (direction, not final copy) | Marks complete | Accountable if late |
|---|---|---|---|
| **IT** | Laptop/device, email + SSO account, licensed software, system access, VPN | IT | IT |
| **Admin** | Building card / access badge, desk & seat, parking, petty-cash float | Admin | Admin |
| **HR** | Employee file opened, signed JD filed, signed NDA filed, consent recorded, payroll setup, visa/entry-permit tracking | HR | HR |
| **Manager** | 30-day check-in scheduled, buddy/mentor assigned, first-week agenda, team introduction | Manager | Manager |

**Three things this section deliberately does not decide** (they are product decisions, and
inventing them would be worse than leaving them open — the offsets are §10 Q3, and the item lists
themselves are P2-4's content decision):

1. **How many lines, exactly.** The table is a direction; the final count is a product call.
2. **The due-date offset per line.** The spec's rule is only *"every line has a due date derived
   from the start date"* — the numbers (D−5, D−3, D−1 …) are not mine to set and are **not** in
   this document.
3. **Which function owns a line when two could.** Needs one owner per line, by rule.

**Naming hazard to flag for engineering:** `employees.role` is the *person's job role*
("Marketing Manager"); `users.role` is a *system* role on the login account. P2-4's "derived from
the role" means the first. The case model should not overload one column name for both.

---

## 7. EN/AR (P2-6, and the standing quality standard)

Bilingual is a **requirement**, not a translation pass at the end: `WORKFLOW.md`'s quality
standards say *"maintain bilingual support (EN/AR) for all user-facing interfaces."*

**What must be bilingual on this surface:** the nav label, every list column header and summary
line, every item title and description, every status word, the consent notice, and the document
names. **What is not translated:** the case subject's name, and any value read from a record.

**Direction and layout**

- AR is **RTL**: the whole surface flips — nav, row order of the chips, the open-now list, the
  two track panels (workspace track leads when the reading direction is RTL? **No — keep the
  employee track first in both directions**, because it is the case's subject and the order is
  semantic, not visual).
- Reference implementation: `design-concepts/intelligence-dashboard-prototype.html` (the bilingual
  prototype, RTL + Arabic-Indic numerals) and the EN/AR mockup pair. This spec follows that
  prototype rather than inventing a second convention.
- Arabic strings run ~20–30% longer than English at the same size: the row must be laid out for
  the longer string, and no label may be truncated to fit EN.
- **Copy source:** the AR strings are **not in this document**. They need a translator or the
  owner; inventing them (or an Arabic wordmark) is prohibited — `BRAND-IDENTITY.md:11` records the
  Arabic wordmark as **`[TO CONFIRM]`**, and the rule is to use the Latin "Antum" in Arabic strings
  until it is confirmed.
- **One source for item text:** item titles must come from the same generator that produces the
  Layer 1 checklist (the compliance engine), so EN and AR cannot drift apart item by item.

---

## 8. The consent gate (P2-6)

P2-6's acceptance: **"no document is collected before the consent record exists."** That makes the
gate the *first* thing on the employee track, not a checkbox buried in a settings panel.

**Locked state (no consent record):**

```
│ EMPLOYEE TRACK   0 of 9 complete                                                        │
│                                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐   │
│  │ 🔒 Documents are locked until consent is recorded                                 │   │
│  │ The new hire's documents (passport, Emirates ID, certificates, bank details)      │   │
│  │ cannot be collected or verified before a PDPL consent record exists for this case.│   │
│  │ [ Record consent ]      ← the only enabled action on this track                   │   │
│  └──────────────────────────────────────────────────────────────────────────────────┘   │
│  ☐ Passport copy        locked   ☐ Emirates ID     locked   ☐ Bank details   locked     │
```

- The lock is a state on the **document items**, not on the case: the workspace track stays
  available (a laptop does not require personal documents), and the pre-reading package may be
  offered, since it collects nothing.
- **Nothing collected may be stored while locked** — the lock is on collection, not just on the
  button: a direct API write of a document for a case with no consent record is a defect, and the
  acceptance test for P2-6 is exactly that request.
- The consent line reads from the record, in the existing house style: `✓ Recorded <date>` in
  Success Green, `✗ Missing / required` in Coral (`App.tsx:981`–`:982`). The screen shows **that**
  a record exists and **when** — never the record's contents.
- Unlocking is automatic on the record's existence; there is no "unlock" button, so the state can
  never disagree with the record.

---

## 9. Every place this design depends on something the product does not have

| # | The design needs | Why | Whose decision |
|---|---|---|---|
| **D1** | An **owner / responsible function** on every item | The row's "open now" list and P2-4's "each line has a responsible function" both read it; today `onboarding_tasks` has no such column and `Task` has no such field | P2-1's case model (engineering) |
| **D2** | A **track** discriminator (employee vs workspace) on items | Two panels, two progress counts, two owners — one table today | P2-1's case model |
| **D3** | A **due date derived from the start date** per line | P2-4 requires one; the *offset per line* is a product decision (§10 Q3, still open) | Product — **the owner's call, §10 Q3** — + engineering |
| **D4** | **Per-user accounts / function identity** | "IT/Admin see only their own lines" (P2-4) has no account model behind it | Product, then engineering (§4) |
| **D5** | A **document store** | P2-2 collects passports, Emirates IDs, certificates and bank details, and stores **no bytes**: an item carries a reference and a status. **Decided by the owner, 2026-10-07 — Option D is the product now, and Option C (an S3-compatible object store) is built when the entity is registered.** Building it is then a change behind one interface (`saveDocument`/`readDocument`), with the PDPL work the compliance expert owes on the chosen store | Engineering (built when IFZA registration completes) + PDPL (compliance expert) |
| **D6** | An **acknowledgement record** for the JD and NDA | P2-3: "nothing is marked acknowledged without the acknowledgement existing" | Engineering + PDPL |
| **D7** | **EN/AR strings and an i18n/RTL layer** | Bilingual is a standing quality standard; the client has no i18n layer today | Design (layout, done here) + a translator/owner for the AR copy |
| **D8** | The **derived flag computation** | §5's definition, computed on read | Engineering (P2-5) |
| **D9** | An **in-process timer + startup catch-up** for the unprompted notice | Gate 2, owner-decided 2026-10-06; only affects *whether the app speaks first*, never correctness | Engineering |
| **D10** | **A delivery channel** — mailer, webhook or SMS | Without it, the flag can never say "notified", and the pre-reading package's "sent" state has no mechanism | Product; the spec is worded so nothing breaks if it never arrives |
| **D11** | **Enough live cases to read as a company** | A working list with one row does not demonstrate the surface; the demo surface currently carries one in-flight case | Owner (roster-size decision, already open) |
| **D12** | A decision on **how the three flag states are shown in a demo** | Three states need three cases at different distances from their start dates | Owner (§10 Q3) |
| **D13** | **How a Manager owner is identified** | `employees.manager_id` exists, but the case must name the manager **for the accepted offer**, which may differ from the current record | P2-1's case model |

---

## 10. Open questions for the owner — asked, not answered

**Status, 2026-10-07 — Q1, Q4 and Q5 are answered by the owner, and recorded here in his terms:**
**Q1 — seeded demo cases.** The demo carries **three cases, one per flag state**, on his own brief,
filed as the queued task `[L2 seed]` (`86749e1f`) and gated behind P2-2 reaching `main` — which it
now has. So S1 is demonstrated **with data**, and the three states §5 specifies are the three that
get seeded. **Q2 is answered with it:** the states come from the seeded dates and item statuses, and
the flag stays *derived* — nothing stores a state.
**Q4 — per-user accounts.** They land **at Layer 3 build time**, and **"My lines" ships with them**.
The hard gate attached: **no real client data until per-user RBAC is live**, and the honest line in a
pilot conversation is *"role-based access is on the Layer 3 roadmap"*. The filter-now / scope-later
split in §4 (D4) is exactly right and stays.
**Q5 — document storage.** His words: *"Option D ships now (reference string only, no bytes stored).
Option C (S3-compatible external object store) is built when the entity is registered. No real
document bytes stored before that. IFZA registration is the gate — not a date, an event."* So an item
records a **reference and a status** and never accepts bytes, and under Option D the **pointer** is
where the personal data sits — which is why the consent gate in §4 matters **more** under it, not
less. Frames that imply the product holds the document itself are wrong: see §2's item rows and §5's
copy, corrected on 2026-10-07.
Q3, Q6 and Q7 remain open and block nothing today.
**One consequence of Q1 the sequence has to face:** no state is derived in code yet (§5 is not
built), so seed data alone can make the underlying facts true but cannot make three *states* appear
on the screen — see `LAYER2-P2-2-IMPLEMENTATION-NOTES.md` §4.

1. **Can the working list show enough cases to be credible?** With one live case the surface
   cannot demonstrate a list, the ordering rule, or the three flag states. This is the same
   roster-size decision already open on P4-2/P4-3; I am not assuming an expansion.
2. **How should the three flag states be demonstrated before there are three cases?** Options I
   can see: seed cases at three distances (an owner decision about the demo dataset), or present
   the states as designed screens that are explicitly labelled as design, never as the live app.
   I will not build anything that renders a fake case in the live surface.
3. **The due-date offset per workspace line** (D−5? D−3? D−1?) — a product decision; Layer 2 has
   no statutory deadline behind it, and I will not invent one.
4. **Per-user accounts: when?** Until they exist, the function view ships as a **filter**, and the
   words "IT see only their own lines" cannot be said. Is the filter acceptable for the first
   pilot, or does the pilot wait for real accounts?
5. **Document storage**: where do collected documents live, and does the PDPL position need the
   compliance expert before P2-2 is built? (No storage exists today.)
6. **Who supplies the Arabic copy** for these surfaces, and when? Every string in §2–§8 needs an
   AR equivalent, including the consent notice.
7. **Is the pre-reading package "offered" or merely "listed"?** Without a delivery channel the
   package cannot be sent. If it cannot be sent, its per-item state must read as *not yet
   delivered* rather than implying a send — see D10.

---

## 11. Acceptance traceability

| Criterion | Where it is satisfied |
|---|---|
| **P2-2** — every item has a status; incomplete items visible to HR without opening each case; documents stored per employee | §2 row anatomy (open-now list on the row); §3 per-item status; storage is D5 — **met as a reference under the owner's Option D (2026-10-07): the item records where the document lives, never the bytes** |
| **P2-3** — each item shows sent/read/acknowledged; JD and NDA have a recorded acknowledgement | §3 pre-reading strip; the record itself is D6; "sent" is blocked by D10 |
| **P2-4** — assignment derived from the role, not typed; each line has a responsible function; IT/Admin see only their own lines | §6 derivation; §2 owner chips; the last clause is D4 (and is not claimable until then) |
| **P2-5** — fires on the 48-hour boundary; names the incomplete items and their owners; clears when the items complete | §5 definition (inclusive boundary), copy rules, and three states; **§5.1 holds the three seeded cases' expected readings to build against; the derivation is **track-agnostic**, and no surface prints a negative `days_to_start` or invents an item owner**. **Two lead rulings of 2026-10-07 are folded in: the row and the chip share one derivation** (§2's relative-time row: whole days / hours to one decimal / `started n d ago`, so one row cannot carry two distances), **and the amber headline reads *"n items open · start in 48 hours or less"***, because the boundary is inclusive at exactly 48.00 h and "under 48 hours" is false there |
| **P2-6** — EN/AR documents and portal; no document collected before a consent record exists | §7, §8 (the gate is on collection, not just on the button) |

---

## 12. What this document does not claim

- **No screen here is built.** Every mock is a design artefact. Nothing in §2–§8 is a live
  surface, and no surface may ship with copy that implies otherwise. (P2-1's intake form and case
  list — `App.tsx:1184`–`:1321` — are built on `main`, but they are not these screens: §3's case
  detail and §4's function view do not exist anywhere, and §2's list is a superset of what P2-1
  renders. **§5's flag has since been built** — `server/preboarding-flag.js`, PR #76 — **and draws
  inside the built HR roll-up** (`App.tsx:1581`, `{row.flag.chip}` at `:1696` on `origin/main` = `404b29d`), *not* on §2's list row or §3's detail
  header, and not on the live deployment, which still runs `5ed731e`; §5.1 carries the re-read.)
- **No figure here is a reading.** The mock rows are invented placeholders, deliberately not the
  seeded records, and are marked as such on the face of every screen.
- **No checklist length is specified here.** The `n of m` counts in the mocks are placeholder
  magnitudes that give the rows a shape; the item lists come from P2-2/P2-3's content decisions,
  and the per-line due-date offsets are open (§10 Q3).
- **Labelling survives.** The **"Sample Demo Data"** badge and the **"Illustrative …"** markers
  stay exactly as they are on the surface these panels join; this spec adds no card without a
  label and relabels nothing.
- **No statutory claim is made in this document.** Layer 2's deadlines (the 48-hour flag, the
  per-line due dates) are product rules, not legal rules, and are described as such.

---

*Product Designer — 2026-10-06. Written against `origin/main` at `34fdd63`; **re-grounded
2026-10-07 on `main` at `75e3ff2`** (the merge of PR #66), which is what the line numbers now
name. Amended 2026-10-07 with the owner's scoping decision (§2 S1: scope the list, keep the row
chip; §3 S2: the case's own jurisdiction in the detail header) and §10's status. **Amended again
2026-10-07 after P2-2 landed (PR #70, `5ed731e`)** — the §0 rows P2-2 changed are marked in place,
and `LAYER2-P2-2-IMPLEMENTATION-NOTES.md` carries the build-vs-design deltas. Screens are design,
not build.*
*Amended again 2026-10-07 after the L2 demo seed landed (PR #73) — **§5.1 is new**: the three seeded
cases read off a scratch instance of that merge, the readings P2-5 must produce for each, and the
copy rule that no surface prints a negative `days_to_start`. The three-state demo's one-morning
shelf life is stated there too. Independent design review of the same surface:
`/home/team/shared/l2-surface-review/REVIEW.md`.*
*Amended 2026-10-07 with the lead's P2-5 ruling: the flag is **track-agnostic** — workspace items
join it unchanged when P2-4 lands — and an item's **owner is never invented** where none is recorded,
which on today's employee-track items is always. See §5's definition, state table and copy rules.*
*Amended 2026-10-07 with the lead's **one-distance ruling** (attributed to the lead, not the owner):
**the row reads the flag's own derivation, never a second computation** — so its reading is whole
days when clear (`· 14 d`), **hours to one decimal** inside 48 hours (`· 7.5 h before 00:00 on the
start date`), and `started n d ago` once the start date has passed, never a bare negative. The
arithmetic is in §5's copy rules: §2 counts whole days while §5 measures hours, so a case with
`days_to_start = 2` is 24–48 h out all day and could read `2 d` beside an amber chip — both true,
one row. **The same amendment corrects §5's amber headline to "*n* items open · start in 48 hours or
less"**, because the boundary is inclusive at exactly 48.00 h and "under 48 hours" is false at the
instant the flag first fires. §5.1's distance column now states the reading the rule *requires*; §2's
S1 and §3's S2 mocks were re-padded to it. Three status statements the PR #76 merge had made false
are marked in place, each with its citation: §0's "flag computation — **Nothing**" row, §5.1 item 1,
and §12's "§5's flag [does] not exist anywhere".*
*Corrected 2026-10-07 with **PR #77 merged** (`main` at `56fd1fd`), while this branch was open: the
row rule is written in the past tense against the strings #77 implemented — `· 14 d` / `· 7.5 h
before 00:00 on the start date` / `· started 1 d ago` / `· started 6 d ago` — and the sentence
saying the built roll-up "prints `-1 d` today" now reads as what it printed before #77. The server is
unchanged: `days_to_start` is still the raw signed input, and the absolute-value guard is in the
built bundle.*
