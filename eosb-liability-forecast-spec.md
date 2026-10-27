# P4-3 — the 12-month EOSB liability forecast

**Status: specification, not built.** Row `3fcec252`. Every figure below was measured in an isolated
scratch rig (own worktree, own database, port 4782 — never the live deployment) on **2026-10-27**, at
**`main` = `77be6fb`**.

Two revisions are named in the row and one in this document. The row was written against
`main` = `23a3ff3`; by the time this was measured main had moved to `77be6fb` (`#315`, `#316` —
the P2-5 flag note and the P3-3 screen verification). **The three files every number here depends on
are byte-identical at both revisions**, so a reading taken at either tree is the same reading:

| file | blob at `23a3ff3` | blob at `77be6fb` | sha256 (short) |
|---|---|---|---|
| `server/eosb.js` | `5f29bce85d63` | `5f29bce85d63` | identical |
| `server/index.js` | `c534101f6862` | `c534101f6862` | identical |
| `scripts/seed-demo.js` | `dd6d87d5dc82` | `dd6d87d5dc82` | identical |

(`git diff --stat 23a3ff3..origin/main -- server/eosb.js server/index.js server/schema.sql scripts/seed-demo.js` → empty.)

**Every figure is from the seeded demo roster (14 people, seeded salaries). It is an illustration of the
rule, not a client figure.** No client data exists.

---

## 1. The claim under test, phrase by phrase

> "A 12-month EOSB liability forecast from current tenure trajectories, with stated assumptions,
> finance-ready for CFO booking."

| phrase | verdict | why |
|---|---|---|
| **from current tenure trajectories** | **earned, with one caveat** | Tenure is a real field (`employees.start_date`) and the engine recomputes the accrual for any date on demand. But there is **no accrual table**: the only stored accrual is a cache on the employee row, written only when that row is written. So "trajectory" must mean *recompute at a future date*, and the existing headline does not do that — it adds up the cache. |
| **12-month** | **not yet** | What exists is four **hard-coded calendar quarter-ends** (`server/index.js:773-778`), the first of which is **already in the past**, spanning **9 months**, not 12. No rule exists for "the next 12 months". |
| **stated assumptions** | **not yet, and they are load-bearing** | The existing series carries two unstated assumptions that together move today's number by **85,423.94 (33.3%)**: every employee is projected as if they **resigned**, and **nobody ever leaves**. Section 5 turns these into a register. |
| **finance-ready for CFO booking** | **dropped** | It is not a statutory end-of-service provision under a recognised actuarial method. Section 7 states what it is instead and what it would take to become the former. **A CFO booking this as a provision would be booking an undiscounted, single-salary, resignation-basis projection.** |

---

## 2. What the engine and the analytics surface actually have today

### 2.1 The engine — one pure function, recomputed on demand

`server/eosb.js:4` — `calculateEOSB(startDateStr, endDateStr, basicSalary, totalSalary, country, terminationType = 'resignation', unpaidLeaveDays = 0)`.
One exported function (`:75`). No per-period rows, no accrual table, no stored schedule.

Read from the source at `77be6fb`:

- `endDateStr` null → **now** (`:6`). So the same call with a future date *is* the projection, and the
  same call with no end date is today's liability. One code path, two uses.
- Ungoverned input handling: unparseable dates → `0` (`:8`); country is KSA only if it is literally
  `'SA'` or `'KSA'` (`:10`) — **anything else falls through to the UAE branch**.
- Unpaid leave: KSA subtracts all of it (`:20`); UAE subtracts only the excess over 90 days per year of
  service (`:23-26`).
- `terminationType === 'summary_dismissal'` → `0` (`:31-33`), i.e. forfeiture.
- **KSA** (`:38-48`): basis is **total** salary (`salary`, falling back to `basic_salary`); half a month
  per year up to 5 years, a full month per year beyond; pro-rata from day one; **no resignation
  reduction**.
- **UAE** (`:49-70`): basis is **basic** salary; **`< 1 year` → 0** (`:53`); 21 days' basic per year for
  the first 5 years (`:56`); 30 days' basic per year beyond (`:60`); **cap = 24 months' basic** (`:64`);
  **resignation fractions 1/3 for tenure in [1, 3) and 2/3 for [3, 5)** (`:66-69`).
- Rounded to 2 dp (`:72`).

**The tier boundaries — where the money moves — therefore are: 1 year (UAE eligibility: nothing → something), 3 years (UAE resignation fraction 1/3 → 2/3), 5 years (rate 21 → 30 days basic for UAE, half → full month for KSA), and 25.5 years (the UAE 24-month cap binds: 105 days accrued at 5 years, then 30 days a year against a 720-day cap).** Nothing in the product names these boundaries to a reader.

### 2.2 The stored accrual is a cache, and the headline sums the cache

- On employee **create**: `server/index.js:366` writes `eosb_accrued = calculateEOSB(start_date, null, basic, total, country, 'resignation', unpaid_leave_days)` — no end date (i.e. *today at write time*), basis resignation.
- On employee **update** (`:454-463`): recomputed and stored the same way when a relevant field changes.
- The headline: `:686` `activeEmployees = employees.filter(e => e.status !== 'terminated')`; `:689` `totalEosb = Σ eosb_accrued`; `:752-754` the AE/SA buckets, also from the cache; `:797` published as `eosbLiability`.

**Nothing recomputes it as time passes.** Measured effect (rig, `docs/evidence/…/03`): moving one
employee's `start_date` back three years — i.e. simulating three more years of service with no write —
leaves her stored accrual at **31,896.04** while the engine returns **71,803.09** for her, and the
published headline does not move (**170,576 → 170,576**). The series *would* move, because it recomputes.

### 2.3 The one forecast-shaped thing that exists

`server/index.js:770-787`:

```js
const forecastQuarterEnds = [
  { quarter: 'Q3 2026', date: '2026-09-30' }, { quarter: 'Q4 2026', date: '2026-12-31' },
  { quarter: 'Q1 2027', date: '2027-03-31' }, { quarter: 'Q2 2027', date: '2027-06-30' }
];
const eosbLiabilitySeries = forecastQuarterEnds.map(({ quarter, date }) => { /* per active employee:
   calculateEOSB(e.start_date, date, e.basic_salary, e.salary, e.data_residency_country, 'resignation', 0) */ });
```

Four facts about it, all measured:

1. **It is the engine, and it is honest about that.** Recomputing each point per employee reproduces
   the served figures exactly at every one of the four coded dates (Q3 2026 167,164 · Q4 2026 180,728 ·
   Q1 2027 230,424 · Q2 2027 265,666, `combined`, unfiltered). It is not an interpolation and carries no
   growth multiplier.
2. **The window is wrong for the name.** Today is 2026-10-27. The first point (2026-09-30) is **26 days in
   the past**; the last is **9 months ahead**. It is a calendar series, not "the next 12 months".
3. **Every employee is projected as a resignation** (`'resignation'` is passed literally at `:782`),
   including the two offboarding people and the three onboarding ones.
4. **No departure is modelled**: an employee with an `end_date` keeps accruing past it, and a person whose
   employment has already ended stays in the roster.

### 2.4 Who reads it (this decides whether a movement is owed)

| served path | what it does |
|---|---|
| `client/src/App.tsx:401,408,409` | the payload's types, including `eosbLiabilitySeries` |
| `client/src/App.tsx:1549-1561` | renders `eosbByJurisdiction.AE` / `.SA` as two liability cards |
| `client/src/App.tsx:1889` | **generates a sentence**: "EOSB liability forecast shows a {rise\|steady} trend into 2027." — a claim derived from points [2] and [0] of the series, with the year hard-coded |
| `client/src/App.tsx:1973-1974` | the chart of the series |

`server/access.js:267` — `['GET', '/analytics/dashboard', 'analytics:read']`.

**Shown, not assumed: the client reads the series.** A change to the payload's shape or meaning owes a
`client/` movement (section 8), and the sentence at `App.tsx:1889` is a served claim that must be
re-examined whenever the rule changes — it asserts a trend about a number that today means
"undiscounted, resignation-basis, no departures, everyone still here".

---

## 3. Inputs and where each comes from

| input | field / table | where the code reads it | notes measured on the seeded roster |
|---|---|---|---|
| tenure start | `employees.start_date` | `eosb.js:5` | `NOT NULL`; present on 14/14 |
| known departure | `employees.end_date` | passed as the engine's 2nd argument **only in the ad-hoc route** (`index.js:562`); **never in the series** (`:782` hard-codes the quarter date) | present on 4/14 (2 offboarding, both dates in the past; 2 terminated) |
| UAE accrual basis | `employees.basic_salary` | `eosb.js:51` | non-zero on 14/14 in the seed; schema default `0.0` |
| KSA accrual basis | `employees.salary`, falling back to `basic_salary` | `eosb.js:42` | non-zero on 14/14 |
| jurisdiction | `employees.data_residency_country` | `eosb.js:10` | `AE` 9 / `SA` 5; **column is nullable** |
| exit mode | `employees.termination_type` | `eosb.js:31` — only `'summary_dismissal'` changes the answer | **NULL on 14/14** |
| unpaid leave | `employees.unpaid_leave_days` | headline uses it (`:366`); the series passes `0` (`:782`) | `0` on 14/14 |
| already-paid EOSB | `employees.eosb_paid` | read at `:379-391` on write, **never netted off the headline or the series** | `0` on 14/14 |
| roster scope | `employees.status` | `index.js:686` (`!== 'terminated'`) | 7 active · 3 onboarding · 2 offboarding · 2 terminated |

The projection needs **nothing that does not already exist** — except one thing it must refuse to invent:
a per-person exit mode (A1) and a departure assumption (A2).

---

## 4. The projection rule

**Rule P4-3-1 — window.** A run takes a date `T` (the run date) and produces the window
`[T, T + 12 months]`, sampled at `T` and at each quarter-end that falls strictly inside it, each point
**labelled with its own date**. No calendar constants in code; a point whose date is not in the window is
not published. *This replaces `index.js:773-778`.*

**Rule P4-3-2 — point value.** For each employee `e` in scope, the component at date `d` is
`calculateEOSB(e.start_date, min(d, e.end_date_or_infinity), e.basic_salary, e.salary,
e.data_residency_country, basis, e.unpaid_leave_days)` — the engine, unchanged, one call per employee per
point, and the total is the sum of the components. *The `min(...)` is the departure rule; the
`basis` is A1; the unpaid-leave argument is the row's own column, not `0`.*

**Rule P4-3-3 — who is in scope.** Employees whose employment overlaps the window: `status` is
`active` or `onboarding` (a person who has not started yet accrues nothing, and the engine returns 0 for a
window before their start date — measured), **plus** `offboarding` employees **up to and including their
`end_date`**. An employee whose `end_date` is **before** `T` is out of scope and is reported as an
exclusion, not as a zero.

**Rule P4-3-4 — tier crossings are named, not smoothed.** For each employee the rule reports whether the
window contains a tenure boundary (1, 3, 5 or 25.5 years, section 2.1) and, if so, the date and the size of
the step, computed as `value(boundary) − value(boundary − 1 day)`. A forecast that interpolates across a
boundary is wrong by the size of the step, and on this roster **8 of 12 in-scope employees cross one**.

**Rule P4-3-5 — departures are either known or admitted.** Employees with an `end_date` inside the window
contribute up to that date and nothing after it. Employees without one are assumed to stay for the whole
window, and **the payload says so** (`assumed: ["no_departures"]`), because the product has no attrition
assumption and must not imply one.

**Rule P4-3-6 — the number carries its basis.** `basis` is either `resignation` (the current behaviour) or
`full_entitlement` (the accrual before any resignation fraction). Both may be published; a figure published
without its basis is a defect. On this roster at `T` the two differ by **85,423.94** (section 5, A1).

**Rule P4-3-7 — a component the engine cannot derive is `cannot_compute`, and the total is `partial`.**
See section 6. The honesty layer is P4-1's, applied here: never a silent zero, never a silent jurisdiction.

### 4.1 What those rules produce on the seeded roster (illustration, not a client figure)

Run date `T` = 2026-10-27, 12 in-scope employees (section 4, rule P4-3-3), engine unchanged:

| point | basis `resignation` | basis `full_entitlement` |
|---|---|---|
| `T` | **171,144.56** | **256,568.50** |
| `T` + 12 months | **294,633.64** | **357,211.70** |
| change over the window | **+123,489.08** | **+100,643.20** |

- **8 of 12** in-scope employees cross a tenure tier inside the window, and those eight employees' own
  deltas are **93,942.66 = 76.1%** of the whole 12-month change. The four who cross nothing contribute the
  rest. *A forecast that smooths across the boundaries is wrong about three quarters of the movement.*
- The largest single mover is a UAE employee crossing **5 years** (delta over the window **33,712.60**, of
  which the step at the boundary alone is **19,895.39**).
- The **1-year UAE eligibility cliff** is visible as a step from nothing: two UAE employees read **0.00**
  at `T` and **2,627.83** / **2,306.18** at `T` + 12 months, solely by crossing 1 year. A KSA employee
  crossing the same 1-year mark gains **30.11** at the boundary — KSA pro-rates from day one, so there is
  no cliff there. *Two jurisdictions, one rule, two shapes of movement.*
- The two `offboarding` rows whose `end_date` has passed (Sarah **19,824.78**, Noura **6,415.79**, both at
  their own end dates) are still **inside** the headline figure above; rule P4-3-3 excludes them.

---

## 5. The assumption register

The register *is* the deliverable. Each row: the assumption, its measured effect on the demo roster, and
what would falsify it.

| # | assumption | measured effect (demo roster, `T` = 2026-10-27) | what falsifies it |
|---|---|---|---|
| **A1** | **Exit mode: everyone is projected as a resignation.** `'resignation'` is passed literally (`index.js:782`); `termination_type` is NULL on all 14 rows, so per-person exit mode is unknown. | resignation basis **171,144.56** vs full entitlement **256,568.50** → the assumption suppresses **85,423.94 (33.3%)**. The three UAE employees under 3 years are the extreme case (Ahmad: 6,490.53 vs 19,471.59). | A per-person `termination_type`, or a policy decision that a *provision* books the full entitlement (a provision normally does — the resignation fraction is a forfeiture rule, not a reduction of what has accrued). |
| **A2** | **No departures.** Nobody in scope leaves during the window; nothing is netted for attrition. | Not measurable as a delta today: the product has no attrition assumption and the seed's exits are historical. The *reverse* is measured: the two offboarding rows whose `end_date` has **already passed** (Sarah 2026-09-30, Noura 2026-10-10) are still inside the headline, and recomputing them at *today* — what the coded series does — overstates them by **485.03 + 121.25 = 606.28**. | Any turnover assumption the CFO agrees to; then the forecast falls by the accrual of the people assumed to leave, and the number must show both. |
| **A3** | **One salary for the whole service period.** The engine takes a single `basic_salary`/`salary` (`eosb.js:42,51`) and applies it to every day of service — so a raise is applied retrospectively to the entire tenure. | Not measurable on the seed (no salary history exists; every row has one salary). **Unknown, and stated as unknown.** | Any employee whose pay changed during service. Then both the current liability and the forecast are wrong, and the fix is a salary history or a stated "current salary, applied throughout" basis. |
| **A4** | **Jurisdiction is known and is AE or SA.** | A country the engine does not know (e.g. `XX`) silently gets **UAE** rules — the engine returns 6,492.16 for one employee — while the AE/SA buckets drop him: buckets sum to **164,083.55** against a total of **170,576**, i.e. **6,492.45 unattributed**, and the series' `combined` falls 265,666 → 249,542. The column is nullable, so this is reachable. | A row whose `data_residency_country` is NULL or a third country. |
| **A5** | **The accrual basis is populated.** | Setting one UAE employee's `basic_salary` to 0 makes the engine return **0.00** for him *silently*: the headline stays at **170,576** (it reads the cache) while the series drops 265,666 → **245,561**. The schema's own default is `0.0`, so a missing basis is indistinguishable from a zero wage. | Any row created without a basic salary — a salary the product cannot see becomes a person who costs nothing. |
| **A6** | **`status != 'terminated'` means "employed".** (`index.js:686`) | 5 of the 12 in-scope people are `onboarding` or `offboarding`, and they carry **28,090.35 of the 171,144.56** liability (16.4%) — including two whose stated end dates have passed. | A roster where `offboarding` rows are not re-scoped to their `end_date`; then people who have left keep accruing. |
| **A7** | **The window is calendar-aligned.** | Four hard-coded quarter-ends; today the first is 26 days in the **past** and the last is 9 months ahead. | `T` after 2027-06-30, when every published point is historical. |
| **A8** | **Unpaid leave is zero in the projection.** The series passes `0` for everyone (`:782`) while the headline passes the row's column (`:366`). | 0 on 14/14 today, so the effect is invisible — and therefore the two served numbers disagree about the same person as soon as one row has leave. | Any employee with unpaid leave; then the series and the headline use different inputs for the same fact. |

**Two more, unregistered because they are absences rather than choices:** the engine has **no cap for KSA**
(the UAE cap at `:64` has no KSA twin) — whether KSA law caps EOSB is a legal question, not a
product one, and it belongs to the compliance expert; and **`eosb_paid` is never netted** off either
figure, so a partially-paid entitlement would be counted twice (0 on 14/14 today, so untested).

---

## 6. The "one it cannot compute" case, and the honesty layer

P4-1 already ships the pattern: a component it cannot derive says so, and the total reads `partial`. The
EOSB surface has **no such layer at all** — it returns a number for every row, and section 5 shows the
number it returns is sometimes a silent zero (A5), sometimes a silent jurisdiction (A4), and sometimes a
cached value that the engine no longer returns (2.2).

Required behaviour for the forecast:

| condition | component | reason code |
|---|---|---|
| in scope, both the basis field and the jurisdiction are usable | `computed` | — |
| `data_residency_country` is neither `AE` nor `SA` (including NULL) | `cannot_compute` | `jurisdiction_unknown` |
| jurisdiction is `AE` and `basic_salary` is not > 0 — or `SA` and neither `salary` nor `basic_salary` is > 0 | `cannot_compute` | `accrual_basis_missing` |
| `end_date` is before the run date and `status` is not `terminated` | `excluded` | `employment_ended` |
| framed in scope but the window starts before `start_date` | `computed` = 0 | `not_yet_started` (a real zero, not an unknown) |

And: **the forecast total is `partial` whenever any component is `cannot_compute`**, and the payload
publishes `assumed`, `basis`, and the count of each exclusion. A total that reads whole while a component
is missing is the defect this section exists to prevent.

**The headline must also be re-derived from the engine, or labelled as what it is.** Today
`eosbLiability` is a sum of caches written at unknown past times; the series is computed now. They can
disagree about one person (section 5 A5: 170,576 vs 245,561 for the same roster and the same screen), and
they can disagree about time itself (2.2). Either recompute the headline at read time, or label it
"last recorded accrual" — but do not publish two differently-derived numbers under one name.

---

## 7. What this number is **not**

- **It is not a statutory end-of-service provision under a recognised actuarial method.** It is an
  **undiscounted projection of accrued EOSB entitlement at today's salary**, computed by one deterministic
  function from the roster the product holds.
- **It is not an IAS 19 defined-benefit figure.** There is no discount rate, no salary-escalation
  assumption, no turnover, mortality or retirement-age assumption, and no projected-unit-credit service
  cost. Discounting alone changes the number materially over 9–12 months, before any actuarial assumption.
- **It is not measured against an obligation the company has actually incurred in full**: it is either the
  resignation-discounted accrual (A1) or the full accrual, and it is not netted for amounts already paid
  (`eosb_paid`, A8/§5).
- **It is not a basis for booking a provision, a filing, or an audit.** It covers EOSB only — not leave
  encashment, airfare, notice or gratuity variants — and it covers people whose employment status the
  product infers from one string column (A6).
- **What would make it finance-ready** (in order): a stated basis and scope; netting of paid amounts;
  a discount rate; a turnover and salary-escalation assumption; a period movement schedule (service cost,
  interest cost, benefits paid, actuarial gain/loss); and an actuary's review. Until then the honest label
  is **"an undiscounted projection of accrued EOSB entitlement, engine-computed, under the stated
  assumptions"**, and the phrase *finance-ready for CFO booking* is dropped.
- **And the failure mode to design out, in the row's words:** a CFO acting on a number our product called
  finance-ready when it is a projection. The product's own sentence today — "EOSB liability forecast shows
  a rise into 2027" (`App.tsx:1889`) — asserts a trend about a resignation-basis, no-departure,
  everyone-still-here number, and would read to a CFO as an accrual trend. Any change to the rule owns that
  sentence.

---

## 8. Movement owed

- `server/` — **yes.** The rule changes `server/index.js` (the series at `:770-787`, the window, the
  basis and departure arguments, the honesty layer, the headline's derivation at `:689`/`:797`) and may
  touch `server/eosb.js` (KSA cap, if the compliance expert rules it; unpaid-leave input). One movement.
- `client/` — **yes, and shown rather than assumed**: `client/src/App.tsx:1549-1561` (the two buckets),
  `:1889` (a generated trend sentence), `:1973-1974` (the chart), with the payload types at `:401,408,409`.
  A changed payload shape or a re-labelled number changes rendered text, which is a served-text change and
  therefore owes a movement. If the build changes only *values* and not the shape, the movement is still
  owed for the sentence at `:1889`, which must stop asserting a trend it cannot support — and that change
  is served text, by the same rule the team applied to the availability claims (`#312`, `#315`).
- **No movement is owed for this document** (markdown).

---

## 9. Tests that would have to redden if the rule is wrong

Each of these is a test that **fails when the behaviour is wrong**, and each has a control:

1. **Window.** With the clock pinned to a date, the first published point is ≥ that date and the last is
   ≤ date + 12 months; the point labels carry dates. *Control: falsify the window to the old hard-coded
   quarter list — the test must redden.*
2. **Departure.** An employee with `end_date` inside the window has the same value at every point on or
   after that date, and the value at `end_date` equals `calculateEOSB(start, end_date, …)`. *Control: pass
   the point date instead of `min(point, end_date)` — must redden.*
3. **Tier step.** For an employee crossing a boundary in the window, `value(day after) − value(day before)`
   equals the reported step and is > 0; and the series is not monotone *only* at boundaries for a stable
   roster. *Control: replace 21 days with 30 in the engine — the UAE step test must redden.*
4. **Basis named.** Two runs with different `basis` return different numbers and each payload names its
   basis. *Control: drop the basis field from the payload — must redden (the test asserts its presence).*
5. **Honesty layer.** A UAE row with `basic_salary = 0`, and a row with `country = 'XX'`, each produce a
   `cannot_compute` component with the right reason code and a **`partial`** total. *Control: restore the
   silent-0 behaviour — must redden.*
6. **Cache is not the engine.** The published headline equals the sum of components recomputed at the run
   date (or is explicitly labelled as a stored value in a separate field). *Control: move a `start_date`
   back three years with no write — with the cache in place the equality must redden.*
7. **Unpaid leave is read, not assumed.** For a row with `unpaid_leave_days > 0`, the series point equals
   a hand-computed engine call using that column. *Control: pass `0` (today's code) — must redden.*
8. **Buckets add up.** `AE + SA` equals the total whenever every in-scope row has a known jurisdiction, and
   the difference is published when it does not. *Control: set a country to `XX` — the test must redden on
   the equality and pass on the published difference.*
9. **Paid amounts are netted** (once decided): a row with `eosb_paid > 0` is not counted twice. *Control:
   stop netting — must redden.*

A rule this size with no reddening test is a claim, not a rule; the pack behind this spec shows the
measurements reddening when falsified (`docs/evidence/eosb-forecast-2026-10-27/`).

---

## 10. Stated as unknowns

1. Whether UAE practice books the **full** accrual as a provision (A1) or the resignation-discounted one.
   This is a legal/accounting question — it decides the headline basis, and it is not mine to answer.
2. Whether KSA law caps EOSB as the UAE branch caps it (`eosb.js:64` has no KSA twin). Compliance expert.
3. Whether `offboarding` rows should leave the roster once `end_date` passes (they do not today), and
   whether that is a data-quality problem on the client's side or a rule on ours.
4. The salary-history question (A3) — the engine cannot express a raise inside a service period, and I do
   not know whether a client roster would carry the history to fix it.
5. `eosb_paid` netting: untested, because every seeded row is zero.
6. Attrition: no assumption exists in the product, and the seed's exits are historical; the effect of a
   turnover assumption on this roster is unmeasured.

## 11. What this spec deliberately does not do

Per the row: **no screen design**, **no DDL**, **no date promised**, and **nothing in
`docs/access-model.md`**. The read is the existing `analytics:read` route
(`server/access.js:267`); a forecast read across the company (rather than the roster) is an access
question and **stays behind decision 27** until counsel answers — noted here so no builder wires it by
accident.
