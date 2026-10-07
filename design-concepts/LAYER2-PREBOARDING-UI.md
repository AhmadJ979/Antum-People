# Antum People — Layer 2 Pre-boarding: the HR working surface

> **Status: design only — nothing in this document is built, shipped or live.** It is the spec
> for **P2-2** (employee-track document collection) and **P2-4** (workspace-track provisioning
> checklist), plus the surfaces of **P2-5** (the derived 48-hour flag) and **P2-6** (EN/AR and
> PDPL consent). **P2-1** — the offer-acceptance trigger and the single case-creation path —
> **landed on `main` as PR #66 (2026-10-07)** and is **out of scope here**: this spec consumes the
> case model, it does not define it. P2-1's own tab is reviewed against this spec in
> `design-concepts/LAYER2-P2-1-IMPLEMENTATION-REVIEW.md`.
>
> **Grounded on:** `client/src/App.tsx`, `server/schema.sql`, `server/preboarding.js` and
> `server/index.js` on `main` at **`34fdd63`** (first read 2026-10-06) and **re-grounded on `main`
> at `75e3ff2`** — the merge of PR #66 — on 2026-10-07. Also read:
> `design-concepts/BRAND-IDENTITY.md` (palette, type), `design-concepts/USER-JOURNEY-MAPS.md`
> (Stage 1 — Pre-Arrival, Days −14 to −1), `design-concepts/DASHBOARD-WIREFRAMES.md` (wireframe
> house style).
>
> **Every line number below is that revision's, and code moves.** Before relying on one, re-derive
> it from the anchors this file leans on —
> `grep -n "id: 'dashboard'" client/src/App.tsx` (the nav) ·
> `grep -n "^CREATE TABLE" server/schema.sql` (the tables) ·
> `grep -n "api/preboarding" server/index.js` (the Layer 2 case routes). When PR #66 landed
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
since the first reading, the re-read number is the one shown.

| Thing the Layer 2 surface needs | What exists today | Where |
|---|---|---|
| A place to live in the nav | **Five** tabs, since P2-1: **Executive Dashboard, Employee Directory, Transitions Hub, Pre-boarding, Strategic Intelligence** | `App.tsx:628`–`:632`; tab state `:199` |
| A case to hang every item on | `preboarding_cases(id, offer_reference UNIQUE, candidate_name, candidate_email, role, department, reporting_line, jurisdiction, start_date, status, source, offered_at, created_by, created_at, updated_at)` — **exists since P2-1**; on `main`, **not deployed** | `schema.sql:177`–`:193` |
| One case-creation path, not two | `recordOfferAcceptance` is the only writer (idempotent on `offer_reference`); `POST /api/preboarding/cases` reaches it, `GET` list and `GET :id` read it back | `server/preboarding.js:119`, `:97`, `:104`; `server/index.js:580`, `:597`, `:606` |
| A Layer 2 tab to extend | The tab exists — an intake form and a case list, house-styled | `App.tsx:1184`–`:1321` |
| A checklist item that can carry an **owner** | `interface Task` has `id, employee_id, title, description, due_date, completed_at, status, category, ttv_milestone` — **no owner, no track, no Arabic text** | `App.tsx:32`–`:41` |
| The same, in storage | `onboarding_tasks(id, employee_id, title, description, due_date, completed_at, status, category, ttv_milestone, created_at)` — **no owner, no track, no function** | `schema.sql:43`–`:55` |
| **Any item at all, attached to a case** | **Nothing.** P2-1 records the *case* — there is no item table and no per-item state yet, which is what §3, §5 and §6 are waiting on | — |
| A consent record to gate documents on | `consent_records(id, employee_id, consent_type, status, consent_date, ip_address, lawful_basis, granted_at, revoked_at, consent_version)`, plus `employees.consent_granted` / `consent_date` | `schema.sql:93`–`:105`, `App.tsx:23` |
| Per-function identity ("IT sees only its own lines") | `users(id, username, password_hash, role, created_at)` exists, but the product seeds **one shared account** — no per-user login to scope a view by | `schema.sql:165`–`:171` |
| Somewhere to put a collected document | **Nothing.** No `documents` table, no file storage, no upload surface | — |
| A record of an acknowledgement (JD, NDA) | **Nothing.** `consent_records` is a consent record, not an acknowledgement record | — |
| Bilingual / RTL rendering | **No i18n layer in the client.** The bilingual reference is the AR prototype and the EN/AR mockups | `design-concepts/intelligence-dashboard-prototype.html`, `intelligence-dashboard-{ar,en}-mockup.png` |
| A way to notify anyone | **No delivery channel** — no mailer, webhook or SMS anywhere in the product | plan, Gate 2 decision (2026-10-06) |
| An in-process timer / scheduled check | **Nothing.** No cron, no working systemd on this host | plan §6; Gate 2 decision |
| Any derived "days remaining" or flag computation | **Nothing** | — |
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

**Scoping — decided by the owner, 2026-10-07:** the list call passes the header's **active
jurisdiction (AE by default)**, so a UAE-header surface never shows a KSA case — the rule the roster
and the dashboard already follow, and the same defect class as the settlement header still reading
"UAE / KSA". **The row's jurisdiction chip stays**, also the owner's call: it is the case's own
recorded value, and on a scoped list it will normally repeat the header's. The row anatomy below
therefore lists it as a field, and S2 shows the same value on the case itself (§3) — the reader
never has to infer a case's jurisdiction from the header's switch. The code change lands in the P2-2
PR, not here. (The P2-1 build, shipped before this decision, already renders the chip; what is
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
│  │ Start 2026-10-12  ·  started 2 days ago                                             │    │
│  │ Employee track  ████░░░░░░  6 of 9   ·   Workspace track  ████████░░  4 of 6        │    │
│  │ Open now:  IT · Laptop issued   IT · Email + SSO   (2)                              │    │
│  │ [ Open case ]                                                                        │    │
│  ├────────────────────────────────────────────────────────────────────────────────────┤    │
│  │ 🟠  INSIDE 48 HOURS · 5 ITEMS OPEN                        sample row, not a record   │    │
│  │ A. Haddad (placeholder)   ·  Marketing Manager  ·  Marketing                        │    │
│  │ Start 2026-10-16  ·  in 2 days                                                      │    │
│  │ Employee track  █████░░░░░  4 of 9   ·   Workspace track  ███░░░░░░░  2 of 6        │    │
│  │ Open now:  IT · Laptop issued   IT · Email + SSO   Admin · Building card            │    │
│  │            Manager · 30-day check-in set   HR · Emirates ID uploaded (3 more)       │    │
│  │ [ Open case ]                                                                        │    │
│  ├────────────────────────────────────────────────────────────────────────────────────┤    │
│  │ ⚪  ON TRACK                                              sample row, not a record   │    │
│  │ M. Farouk (placeholder)   ·  Product Designer  ·  Product                           │    │
│  │ Start 2026-10-26  ·  in 12 days                                                     │    │
│  │ Employee track  ████████░░  8 of 9   ·   Workspace track  ████████░░  5 of 6        │    │
│  │ Open now:  HR · Signed NDA (1)                                                       │    │
│  │ [ Open case ]                                                                        │    │
│  └────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                            │
│  Mock reference time: 2026-10-14 09:00 (GST). Row contents are invented placeholders for   │
│  layout only — do not seed them. The counts shown ("6 of 9", "4 of 6") are placeholder     │
│  magnitudes so the rows have a shape; they are not the specified checklist lengths.        │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Row anatomy — every field and whether it exists today

| Field on the row | Rule | Source today |
|---|---|---|
| **Flag chip** (🔴 / 🟠 / ⚪) | From the derived flag in §5. First thing scanned, always left-most. | **Nothing** — must be computed |
| **Name** | Case subject. | `employees.first_name/last_name` |
| **Job role · Department** | The role the offer was accepted for. | `employees.role`, `employees.department` |
| **Jurisdiction** (UAE / KSA chip) | The case's **own** recorded value, right-aligned on the name line. **Kept by the owner's decision (2026-10-07)** even though the list is scoped to the header's jurisdiction, so on a scoped list it normally repeats the header's. | `preboarding_cases.jurisdiction` — rendered since P2-1 (`App.tsx:1303`–`:1305`) |
| **Start date** | The anchor of the whole surface. A case cannot exist without one (P2-1). | `employees.start_date` |
| **Relative time** ("in 2 days" / "started 2 days ago") | Derived from the start date **at read time**, never stored. Definition: whole days = `ceil((start_date 00:00 − now) / 24h)`; negative renders as "started *n* days ago". | **Nothing** — must be computed |
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

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Pre-boarding            A. Haddad  ·  Marketing Manager  ·  Marketing  ·  UAE           │
│                           Start 2026-10-16  ·  in 2 days                                  │
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
│  │ ☐ Emirates ID upload     pending     │  │ ☐ IT · Laptop issued         due 10-15   │   │
│  │   └ needs the scan, not the number   │  │   └ owner: IT · due D-1                  │   │
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
| When per-user accounts exist | The same chips, plus the signed-in user's function pre-selected and forced, with other functions' lines read-only. | "**My lines**" — a scope |

The distinction is a **wording** requirement, not a nicety: shipping the filter and calling it
"My lines" would tell a client that IT cannot see HR's lines when nothing stops it. That is the
kind of claim this team has had to retract before.

---

## 5. The derived 48-hour flag (P2-5)

### Definition (single, derived, never stored)

```
flag_is_raised  =  open_items_in_case > 0
                   AND  (start_date 00:00 − now) ≤ 48h
```

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
| **Clear** | No open items, **or** more than 48h to start with everything open still fine | ⚪ **On track** | "On track" | "Started *n* days before day one." (only when items exist and are open) | Slate / Success Green |
| **Inside 48 hours with open items** | `open > 0` and `≤ 48h` to start | 🟠 **Inside 48 hours · *n* terms open** | "*n* items open, start in under 48 hours" | Names each open item **and its owner's function**, worst-first | Warm Amber |
| **Start date passed, items still open** | `open > 0` and start < now | 🔴 **Started *n* days ago · *n* items open** | "Started with *n* items still open" | Same list; adds the honest line "these were due before day one" | Coral Red |
| *No start date* | — | — | Cannot render: a case without a start date cannot exist (P2-1). If one were ever read, the surface shows the error state, **not** a default date. | | Rose |

### Copy rules — what the flag may and may not say

The flag is a **state, not an event**. On this product there is no mailer, webhook or SMS, so:

- **Never:** "sent", "notified", "emailed", "reminder sent", "alerted IT", "IT has been informed".
- **Never:** a timestamp that implies a message went out, or a bell/paper-plane/envelope icon.
- **Always:** present-tense state — "5 items open", "start in under 48 hours", "opens in this view".
- When an unprompted in-app notice exists (Gate 2's in-process timer), it says what the app did:
  *"This case reached the 48-hour mark while the app was open"* — and, if the server was down
  across the boundary, the flag simply reads correctly on the next read with **no** "missed
  notification" state, because a derived flag has nothing to miss.

### Where the flag surfaces (three places, one definition)

1. **S1 row chip** — the scan target; drives ordering (§2).
2. **S2 header banner** — one line naming the count, the owners and the clearing rule (the banner
   in §3 is the template).
3. **S3 function filter** — a count badge per function chip ("IT (2)"), so a function lead sees
   their own exposure without reading every row.

All three read the same derivation. No surface may compute its own version.

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
│  │ cannot be uploaded or requested before a PDPL consent record exists for this case.│   │
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
| **D3** | A **due date derived from the start date** per line | P2-4 requires one; the *offset per line* is a product decision (§10 Q3) | Product (lead) + engineering |
| **D4** | **Per-user accounts / function identity** | "IT/Admin see only their own lines" (P2-4) has no account model behind it | Product, then engineering (§4) |
| **D5** | A **document store** | P2-2 collects passports, Emirates IDs, certificates, bank details; no table, no storage, no upload surface today | Engineering + PDPL (compliance expert) |
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

**Status, 2026-10-07:** three of these are in front of the owner — **Q1** (whether the demo carries
seeded pre-boarding cases), **Q4** (per-user accounts) and **Q5** (document storage, which is
blocking P2-2's acceptance criteria). Nothing in §2–§8 changes for Q2, Q3, Q6 or Q7; the answers to
Q1, Q4 and Q5 will be recorded here rather than left implicit.

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
| **P2-2** — every item has a status; incomplete items visible to HR without opening each case; documents stored per employee | §2 row anatomy (open-now list on the row); §3 per-item status; storage is D5 |
| **P2-3** — each item shows sent/read/acknowledged; JD and NDA have a recorded acknowledgement | §3 pre-reading strip; the record itself is D6; "sent" is blocked by D10 |
| **P2-4** — assignment derived from the role, not typed; each line has a responsible function; IT/Admin see only their own lines | §6 derivation; §2 owner chips; the last clause is D4 (and is not claimable until then) |
| **P2-5** — fires on the 48-hour boundary; names the incomplete items and their owners; clears when the items complete | §5 definition (inclusive boundary), copy rules, and three states |
| **P2-6** — EN/AR documents and portal; no document collected before a consent record exists | §7, §8 (the gate is on collection, not just on the button) |

---

## 12. What this document does not claim

- **No screen here is built.** Every mock is a design artefact. Nothing in §2–§8 is a live
  surface, and no surface may ship with copy that implies otherwise. (P2-1's intake form and case
  list — `App.tsx:1184`–`:1321` — are built on `main`, but they are not these screens: §3's case
  detail, §4's function view and §5's flag do not exist anywhere, and §2's list is a superset of
  what P2-1 renders.)
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
chip; §3 S2: the case's own jurisdiction in the detail header) and §10's status. Screens are design,
not build.*
