# The access model — who may see what, on what basis, and what gets logged

**Status: specification. Not enforced by any code today.** This document is Layer 3 slice 1 (owner decision 11,
started 2026-10-19). The engineer's slice builds the mechanism; this is the policy it enforces. Until it is
enforced, the statement in §1 is the true one: **any authenticated caller reaches every `/api` route.**

**Measured at** `origin/main` = **`7b073f8`**, read this session. Every `file:line` below was asserted against that
tree, not recalled. Where a claim is about counsel's ground, it is marked **(counsel)** and this document stops.

---

## 1. The state today, measured

| Fact | Where | What it means |
|---|---|---|
| One auth gate, no role check | `server/index.js:134-137` — `app.use('/api', …)` skips only `/login` and `/health`, then calls `auth.authenticateToken` | authentication is enforced; **authorisation is not** |
| The token carries a role | `server/auth.js:86-90` — `jwt.sign({id, username, role}, …, {expiresIn:'8h'})` | the claim exists and is signed |
| The role is **never read for a decision** | `users.role` is read in exactly **two** places: `server/auth.js:87` (signing) and `server/index.js:127` (the login response) | every other `.role` in the tree is `employees.role` or `preboarding_cases.role` — **job titles**, not permissions (§2.4) |
| Every non-login route is reachable by any token | the route surface, §3 | a single `admin` account is the only account that exists (`server/migrate.js:20`, `scripts/seed-demo.js:682`, both `role='admin'`) |

**Consequence to hold on to:** the product is not "HR-only with weak controls". It is **one role, called admin, that
can do everything**, and the only control on it is a password. The interesting question is not whether the current
operator may do these things — they may — but what happens the first time a **second** account exists.

---

## 2. The roles

The smallest set a 100–1,000-person GCC employer needs, each **derived from data the product already holds** — and
one honest gap where it cannot be derived.

### 2.1 The five

| Role (`users.role` value) | Derived from | The job it does |
|---|---|---|
| `hr_admin` | the existing `admin` account, renamed | runs the lifecycle: roster, pre-boarding, offboarding, documents |
| `manager` | `employees.manager_id` — the reporting line the product already stores | sees **their own reports**, for the steps they must chase |
| `finance` | not stored; granted | EOSB and settlement figures; the economic sponsor's read |
| `employee` | **cannot be derived today — see 2.2** | their own record only |
| `compliance_viewer` | not stored; granted | **read-only** over audit records and the notice; exists so the person who acts is not the only reader of the log |

### 2.2 The gap: `users` has no link to `employees`

`users` is `(id, username, password_hash, role, created_at)` (`server/schema.sql:165-171`). **There is no
`employee_id`.** So:

- `employee` (self-service) **cannot be expressed** — the product cannot tell which employee row a signed-in person
  is. Adding `users.employee_id` (nullable, unique when set) is the prerequisite, and it belongs to the engineer's
  slice, not to this document.
- `manager` **can** be derived, but only as a *set* — the reports of the employee whose `id` equals the caller's
  `employee_id`. Which is the same missing column.

**So two of the five roles are unenforceable until `users.employee_id` exists.** This is stated here rather than
assumed away: a matrix cell that says "own reports only" is not implementable on today's schema.

### 2.3 What is deliberately *not* a role

Department, nationality, Emiratisation flag, and jurisdiction are **attributes, not permissions**. A `department`
column must never become an access boundary by itself — several employers make "department" mean "cost centre" in
one place and "site" in another. If a real customer needs departmental scoping, it arrives as a **scope** on a role
(e.g. `hr_admin` scoped to a department), not as a new role. **This is a decision for the owner**; it is called out
here so it is not silently invented later.

### 2.4 Naming hazard — three different `role` columns

`users.role` (a permission) collides by name with `employees.role` (a job title) and `preboarding_cases.role` (also
a job title). The collision is already noticed in passing at `server/preboarding-workspace.js:110`. It is a real
hazard for this build: an access check written against the wrong `role` would gate on a **job title** — e.g. treating
everyone titled "Manager" as a manager, regardless of the reporting line.

**Recommendation: rename `users.role` → `users.access_role` in the same PR that starts enforcing it**, so the class
of the column is in its name. `employees.role` and `preboarding_cases.role` keep their meaning.

---

## 3. The matrix

Every cell is a decision. `✔` = permitted; `✖` = refused; **scoped** = permitted only under the named restriction;
**field** = permitted, with named fields removed from the payload.

### 3.1 Roster and the employee record — the sensitive core

| Route | Table(s) | hr_admin | manager | finance | employee | compliance_viewer |
|---|---|---|---|---|---|---|
| `GET /api/employees` (`:148`) | `employees` | ✔ | **scoped + field** (own reports; national-ID and pay columns removed) | **field** (pay columns only, as needed for settlement) | **✖ — this is the case in §6.1** | ✖ |
| `POST /api/employees` (`:178`) | `employees`, `onboarding_tasks`, `audit_logs` | ✔ | ✖ | ✖ | ✖ | ✖ |
| `PUT /api/employees/:id` (`:239`) | `employees`, `offboarding_tasks`, `audit_logs` | ✔ | ✖ | ✖ | ✖ | ✖ |
| `GET /api/employees/:id/onboarding` (`:310`) | `onboarding_tasks` | ✔ | scoped (own reports) | ✖ | scoped (own) | ✖ |
| `PUT /api/onboarding-tasks/:id` (`:315`) | `onboarding_tasks` | ✔ | scoped (own reports) | ✖ | ✖ (**§6.4**) | ✖ |
| `GET /api/employees/:id/offboarding` (`:322`) | `offboarding_tasks` | ✔ | ✖ | ✖ | scoped (own) | ✖ |
| `PUT /api/offboarding-tasks/:id` (`:327`) | `offboarding_tasks` | ✔ | ✖ | ✖ | ✖ | ✖ |

**National-ID columns never leave the HR boundary.** `national_id_value` and `national_id_iqama` are encrypted at
rest (`server/index.js:193-194`) and are **decrypted into the roster response** (`:159-164`) — encryption at rest is
doing nothing about disclosure if the read decrypts for everyone (§6.1).

### 3.2 Pre-boarding

| Route | Table(s) | hr_admin | manager | finance | employee | compliance_viewer |
|---|---|---|---|---|---|---|
| `POST /api/preboarding/cases` (`:598`) | `preboarding_cases`, `audit_logs` | ✔ | ✖ | ✖ | ✖ | ✖ |
| `GET /api/preboarding/cases` (`:622`) | `preboarding_cases` | ✔ | scoped (own reports' hires) | ✖ | ✖ | ✖ |
| `GET /api/preboarding/cases/:id` (`:637`) | `preboarding_cases` | ✔ | scoped | ✖ | ✖ | ✖ |
| `GET /api/preboarding/checklist/overview` (`:665`) | `preboarding_items` | ✔ | ✖ | ✖ | ✖ | ✔ (read-only) |
| `GET /api/preboarding/cases/:id/checklist` (`:673`) | `preboarding_items` | ✔ | scoped | ✖ | ✖ | ✖ |
| `GET /api/preboarding/cases/:id/workspace` (`:686`) | `preboarding_cases`, `preboarding_items` | ✔ | scoped | ✖ | ✖ | ✖ |
| `POST …/items/:itemKey/status` (`:697`) | `preboarding_items`, `audit_logs` | ✔ | scoped | ✖ | ✖ | ✖ |
| `POST …/reminders` (`:713`) | `preboarding_reminders`, `audit_logs` | ✔ | scoped | ✖ | ✖ | ✖ |
| `POST …/notice-acknowledgements` (`:740`) | `preboarding_notice_acknowledgements`, `audit_logs` | ✔ | ✖ | ✖ | ✖ | ✔ (read-only) |
| `GET …/package` (`:800`) | `preboarding_cases`, `preboarding_acknowledgements` | ✔ | ✖ | ✖ | ✖ | ✖ |
| `POST …/package/:itemKey/acknowledgement` (`:811`) | `preboarding_acknowledgements`, `audit_logs` | ✔ | ✖ | ✖ | ✖ | ✖ |
| `GET /api/preboarding/flag-watch` (`:831`) | derived from cases + items | ✔ | ✖ | ✖ | ✖ | ✔ (read-only) |

The candidate's own data (`candidate_name`, `candidate_email`, `role`, `reporting_line` —
`server/schema.sql:177-193`) belongs to a person **who is not an employee yet**. A manager's interest in a hire on
their line is real; their interest in the *candidate's* contact details for a hire that has not started is
**(counsel)**.

### 3.3 Exit, EOSB, and the compliance documents

| Route | Table(s) | hr_admin | manager | finance | employee | compliance_viewer |
|---|---|---|---|---|---|---|
| `POST /api/exit-interviews` (`:581`) | `exit_interviews`, `employees` (sets `status='terminated'`) | ✔ | ✖ | ✖ | ✖ | ✖ |
| `POST /api/compliance/calculate-eosb` (`:334`) | **no table — stateless**; takes salaries in the body | ✔ | ✖ | ✔ | ✖ | ✖ |
| `GET /api/compliance/notice` (`:343`) | none — served from `server/privacy-notice.js` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `GET /api/compliance/templates/:templateName/:employeeId` (`:365`) | `employees` (+ EOSB arithmetic) | ✔ | ✖ | scoped (settlement templates) | ✖ (**§6.2**) | ✖ |
| `GET /api/analytics/dashboard` (`:428`) | `employees`, `exit_interviews`, `onboarding_tasks` | ✔ | ✖ (**§6.3**) | ✔ | ✖ | ✔ (read-only) |

Two notes that matter:

- **The notice is not restricted, and that is deliberate.** It is the document a data subject is shown; every role
  may read it. Its route already answers 401 without a token and 200 with one.
- **`calculate-eosb` is stateless** — it reads no employee row, so it discloses nothing about a person. It is
  nevertheless restricted to the roles that may handle pay, because the *inputs are salaries*; a route that lets any
  caller compute a settlement figure is a route that invites one to be computed for a colleague whose salary was
  guessed.

### 3.4 Audit records and users

| Route | Table(s) | hr_admin | manager | finance | employee | compliance_viewer |
|---|---|---|---|---|---|---|
| *(no read route exists)* | `audit_logs` | — | — | — | — | — |
| `POST /api/login` (`:104`, unauthenticated, rate-limited) | `users` | — | — | — | — | — |
| *(no route lists, creates or edits users)* | `users` | — | — | — | — | — |

**Two findings, both today's state, neither fixed by this document:**

1. **`audit_logs` is write-only.** There is no route that reads it. A log nobody can read is not auditability — it
   is storage. **Recommendation: a read route restricted to `compliance_viewer` and `hr_admin`, with a reason for
   the separation of duties recorded** — the person who performs a write should not be the only person who can
   inspect it.
2. **There is no user administration at all.** Accounts exist only because `server/migrate.js:20` or
   `scripts/seed-demo.js:682` put them there. The mechanism that *assigns* a role is therefore a runbook step or a
   new route (engineer's slice) — and until it exists, this matrix describes what the product should refuse, not
   what an operator can currently configure.

---

## 4. The PDPL basis, per cell that touches personal data

UAE: **Federal Decree-Law No. 45 of 2021** (PDPL). KSA: **PDPL, Royal Decree No. M/19**. Article-level questions are
**(counsel)** — they are named here so they are asked, not answered.

**Who is the controller.** The **employer** is the controller of employee and candidate data. A colleague — including
a manager, and including a `finance` user — is **not** a controller; they are acting inside the controller's
processing. That is the whole reason a manager's access must be *purpose-bound and field-limited* rather than
"read-only on their team": the manager is not being given their own data, they are being given the controller's
data about a third person.

| Data | Purpose | Minimum necessary | Basis / open question |
|---|---|---|---|
| Employment record (name, department, job title, dates) | running the employment relationship | all roles, scoped to the relationship they hold with that person | contract performance; the employer is controller |
| Work contact details (`email`) | operational contact | hr_admin; manager for own reports | contract performance |
| **National ID / Iqama** | statutory identity and right-to-work checks | **hr_admin only**; never a manager, never finance, never in a list payload | statutory obligation. *(counsel)*: retention, and whether any manager flow has a lawful need |
| **Salary, allowances, EOSB accrued/paid** | payroll, settlement, statutory EOSB | hr_admin and finance; **manager must not see a report's pay** | contract + statutory obligation. *(counsel)*: whether a manager may see a *band* rather than a figure |
| Visa status and expiry, probation end, Emiratisation band, governing law | statutory workforce obligations | hr_admin; manager for own reports (dates only, no identifiers) | statutory obligation |
| Candidate data (name, email, offer role) before start | pre-boarding | hr_admin; manager scoped to own line | **pre-contractual.** *(counsel)*: candidate contact details to a hiring manager, and candidate-data retention for hires that do not start |
| Exit interview (`detailed_feedback`, `satisfaction_score`) | offboarding and reasons analysis | hr_admin; aggregated for anyone else | contract. *(counsel)*: the interview's own promise to the leaver |
| **Notice acknowledgements** (`recorded_by`, `acknowledged_at`) | evidencing that the notice was shown | hr_admin, compliance_viewer (read) | accountability. The row is `recorded_by TEXT NOT NULL` (`server/schema.sql:311`; the rule's own rationale is written at `:293`) — a record with no named actor cannot be inserted at all |
| Analytics cohorts | workforce reporting | hr_admin, finance, compliance_viewer — **aggregates only**; cohort sizes small enough to identify an individual are **(counsel)** | contract; the small-cohort re-identification question is counsel's |
| Audit records (`performed_by`, `old_values`, `new_values`) | accountability for changes | compliance_viewer, hr_admin | accountability. `old_values`/`new_values` carry **encrypted** identifiers (`server/index.js:288-289`; the value written is the encrypted form — `:289` for the update path) — the log is not a decryption back door, and must not become one |

**Data residency.** `employees.data_residency_country` exists and gates a **query filter** on the roster
(`server/index.js:150-157`) — and the comment there says so in as many words: nothing is hidden at the data layer,
only at the query the UI happens to send. **A filter is not an access control**; this matrix is the control.

---

## 5. What every write must log

### 5.1 What exists today — three different conventions for one question

| Write path | What the actor column gets | Where |
|---|---|---|
| Pre-boarding case, item status, reminders | `(req.user && req.user.username) \|\| 'system'` | `server/index.js:601`, `:705`, `:719` |
| Notice acknowledgement, package acknowledgement | `(req.user && req.user.username) \|\| null` → **the module refuses null (400)** | `server/index.js:743`, `:818`; constraint `recorded_by TEXT NOT NULL` |
| **`POST /api/employees`, `PUT /api/employees/:id`** | **the literal `'system'`** — not the signed-in user | `server/index.js:224`, `:292` |
| **Checklist tick (`PUT /api/onboarding-tasks/:id`)** | **no actor column exists at all** | `server/index.js:315-320`; decision 22 |

### 5.2 The rule this document sets

1. **Every write names the signed-in actor.** No write may be recorded as `'system'` when a person performed it.
   The two employee paths (`:224`, `:292`) currently do exactly that, and it is **worse than the missing actor**: a
   field that exists and holds a false name is a record a future reader will trust.
2. **An unnamed actor is refused, not defaulted.** The pre-boarding acknowledgement's convention is the correct one
   — 400, backed by a `NOT NULL` constraint. The `|| 'system'` fallback at `:601`, `:705`, `:719` should become
   `|| null` plus the same refusal: with the auth gate in front, a null actor means a defect, not a system event.
3. **The checklist tick gains `completed_by`** (decision 22), with the same 400. Until it does, the tick is an
   unnamed assertion and the shipped description says so in as many words.
4. **The autonomous actor** (the recovery, the seeder, a migration) is a **separate, explicit value** — not a
   fallback. If a write genuinely has no human behind it, the record says which mechanism did it, so "system" means
   "a mechanism" and never "someone we did not identify".
5. **A write to `audit_logs` accompanies every state change**, with `old_values`/`new_values` as the encrypted
   identifiers already are — never a decrypted identifier in the log.

---

## 6. The cases that must be refused, named

Each of these is reachable by **any** authenticated caller today. None is hypothetical; each is a route and a line.

### 6.1 One employee reading a colleague's national ID and pay — `GET /api/employees`

The roster does `SELECT *` on `employees` (`server/index.js:155-157`), **decrypts both national-ID columns**
(`:159-164`) and returns the whole row to the caller. Every employee's salary, allowances, accrued EOSB and
decrypted ID number are in that response.

**Why it must be refused:** this is the single highest-consequence read in the product. Pay and a national
identifier are exactly the data an insider misuses, and the response hands them over as a *list*, with no per-row
decision to make. With one shared admin account the exposure is theoretical; the **first** `employee` account makes
it real, and it is a one-request read of the whole company.

**Shape of the fix (engineer's):** row scope (own reports / own record) **and** field removal — the national-ID
columns and the pay columns must be dropped from any response that is not `hr_admin` (§3.1). A field-limited
response is required even for `hr_admin` list views if a narrower one is ever possible; the UI should ask for what
it needs.

### 6.2 A manager or employee reading a settlement document — `GET /api/compliance/templates/…`

Reads one employee (`:368`), decrypts their national IDs (`:371-372`), and substitutes the person's identifiers and
their EOSB into a contract or settlement document.

**Why it must be refused:** the response is a document *about a named person's money*, in a form that looks
official. It is refused for `employee` absolutely, and for `manager` entirely — the reporting line does not carry a
settlement interest, and `finance` gets the templates it needs, not all of them.

### 6.3 A manager reading company-wide pay through the dashboard — `GET /api/analytics/dashboard`

`SELECT *` on `employees` (`:435`) plus `exit_interviews` and task rows, reduced to cohort figures.

**Why it must be refused for `manager`:** the figures are built from the whole roster. Even aggregated, a cohort in a
100-person company is small enough to name an individual — and *that* threshold (how small a cohort may be before it
is a disclosure) is **(counsel)**. Until it is answered, the honest default is: aggregates to `hr_admin`, `finance`
and `compliance_viewer`; nothing to a manager.

### 6.4 Ticking a step on someone else's record — `PUT /api/onboarding-tasks/:id`

Takes a task id and a status (`server/index.js:315-320`). **No ownership check, no actor, and any status string is
accepted.**

**Why it must be refused:** this is the route by which a compliance step is marked done. If self-service arrives
without a scope check, one employee can mark another's onboarding — or their own — complete, and the product records
the date and no name (§5.1). A control that anyone can tick for anyone is not a control.

### 6.5 Ending someone's employment — `POST /api/exit-interviews`

Writes the interview **and sets `employees.status='terminated'`, `end_date`** (`:587`).

**Why it must be refused outside HR:** this is not a data-entry route; it terminates a person's employment record
in one unauthenticated-by-role call, with no actor in `exit_interviews` and no audit row. Of everything in §3.3 it is
the one where a wrong click is least recoverable.

---

## 7. Out of scope — stated, not implied

- **The hire-facing portal** (owner decision 14, open). It needs an identity mechanism for someone with no account;
  this matrix says nothing about it. The pre-boarding acknowledgement's actor is the *HR user showing the notice*,
  not the hire, and that stays true until 14 is decided.
- **Document storage and anything contract-shaped** (owner decision 10 — IFZA registration is the gate).
  `server/document-store.js` **has no SQL and is required by nothing but its own test** — it is unwired, and this
  document does not give it an access rule it cannot yet have.
- **Cross-tenant isolation.** One database, no tenancy model. Every role above is *within* one employer. A second
  customer on this instance would be a different design, not a new role.
- **Field-level encryption by role, key management, and rotation.** Out of scope; noted only where encryption at
  rest is mistaken for disclosure control (§3.1).
- **Retention and deletion schedules.** They are **(counsel)** and per-table; this document names the tables.

---

## 8. Open questions for the owner and counsel

1. **Counsel:** retention periods per table, and the candidate-data question for hires that never start.
2. **Counsel:** whether a manager may see a report's pay *band*, and if a pay figure may ever reach a manager.
3. **Counsel:** the minimum cohort size for the dashboard before an aggregate becomes a disclosure.
4. **Counsel:** whether a manager may see a candidate's contact details before the start date.
5. **Owner:** is `compliance_viewer` in the minimum set, or does `hr_admin` read the audit log alone? The cost of
   dropping it is stated: the actor becomes the only reader of their own record.
6. **Owner:** departmental scoping as a *scope* on a role rather than as new roles (§2.3).
7. **Engineer (slice 2):** `users.employee_id`, without which `manager`-scoped and `employee` cells cannot be
   enforced at all.

---

## 9. How to check this document

Every claim above is checkable against `origin/main` with the artifact, not with trust:

```sh
# the gate, and the role that is never consulted
git show origin/main:server/index.js | sed -n '134,137p'
git grep -n '\.role' origin/main -- 'server/*.js' | grep -v '\.test\.js'   # two hits: auth.js:87, index.js:127

# the employer of §6.1
git show origin/main:server/index.js | sed -n '148,166p'

# the false attribution of §5.1
git show origin/main:server/index.js | sed -n '223p;291p'

# the tick with no actor (decision 22)
git show origin/main:server/index.js | sed -n '315,320p'
git show origin/main:server/schema.sql  | sed -n '43,55p'    # completed_at, and no completed_by

# the constraint that makes an unnamed acknowledgement impossible
git show origin/main:server/schema.sql | sed -n '302,320p'   # recorded_by TEXT NOT NULL

# the tables with no route and no reference at all
git grep -c 'analytics_metrics\|data_subject_requests\|breach_register\|eosb_calculations\|preboarding_consents' \
  origin/main -- 'server/*.js'
```

**The five inert tables.** `analytics_metrics`, `data_subject_requests`, `breach_register`, `eosb_calculations` and
`preboarding_consents` are declared in `server/schema.sql` and referenced by **nothing** outside tests — no route,
no writer, no reader. `consent_records` is retained but unwritten by decision 17. They are named here so this
matrix's silence about them is an enumeration that states its exceptions, not an omission: **a table with no route
needs no access rule, and a table with no writer is not a control.** If a future slice gives any of them a route,
the rule is written then — and the DSAR and breach registers in particular will need one, since a register with no
interface is a log nobody can keep.
