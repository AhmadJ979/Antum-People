# The access model — who may see what, on what basis, and what gets logged

**Status: the policy — and as of this revision it is also, cell for cell, the enforcement.** Layer 3 slice 1
(PR #223) built a deny-by-default gate with every cell `[admin]`. Slice 2 (PRs #236 and **#239**) filled the
cells: the five roles in §2.1 now exist in the data, `server/access.js` carries the matrix below as `POLICY`,
scopes and field rules, and **access has widened on purpose** — the plan's line "every cell is still `[admin]`"
was true at `b4f479a` and is **false at `ca681dd`**. §10 records both passes. **Amendment trail in §10**; the
ruling the designer's own-view surface needed is in §3.2 and §4.

**Measured at** `origin/main` = **`ca681dd`**, re-asserted 2026-10-20. This document has been re-derived against
three trees as it moved (`7b073f8` → `e2a4b4b` → `b4f479a` → `ca681dd`); **every `file:line` below was re-derived
by measurement, never by arithmetic**, and the commands are in §9. Where a claim is about counsel's ground it is
marked **(counsel)**; where it is a cell the code refuses *for now because counsel owns the question* it is marked
**`⚖`** and the code calls it `COUNSEL_PENDING` (§2.2).

---

## 1. The state today, measured

| Fact | Where | What it means |
|---|---|---|
| One auth gate | `server/index.js:138-150` — `app.use('/api', …)` skips only `/login` and `/health`, then `authenticateToken`, then `access.gate` | authentication and a deny-by-default authorisation check both run on every `/api` route |
| **The token carries the role, and the role is read** | `server/auth.js:91-92` (signed) · `server/access.js:378` (`allowed.indexOf(req.user.access_role)`) · `server/index.js:132` (login response) | the claim exists, is signed, and decides every request |
| **Changed by #239 — the cells are populated.** The first two versions of this document said every cell was `[admin]` and nothing had widened | `server/access.js:73` (`ROLES` — **five**), `:91` (`POLICY` — **17** resources, most with more than one role) | **access has widened.** There are five roles in the data, and a second account can be created with any of them (`server/index.js:228`) |
| Scoping is enforced, not just the cell | `access.js:189` (`SCOPES`), `:318` (`scopeFor`), `:326` (`scopedAllows`), `index.js:180` (`relationTo`), consulted at `index.js:199`, `:297`, `:504` | a cell says *which* roles; `SCOPES` says *how far* — `all` / `reports` / `own`, resolved per row |
| Field rules are enforced | `access.js:213` (`EMPLOYEE_FIELD_GROUPS`), `:224` (`FIELD_RULES`), `:334` (`fieldsRemovedFor`), applied at `index.js:309` | a manager's roster row carries no national ID and no pay; finance's carries no national ID (§4) |
| **An unstated scope refuses** | `access.js:318-323` (`scopeFor` returns `null`), `:326-331` (`scopedAllows(null, …) === false`) — measured: `scopeFor('onboarding:read','nobody')` → `null`, `scopedAllows('own','other')` → `false` | "how far may this role reach" never falls back to "everywhere" |
| **One account per person is now a constraint** | `server/db.js:134-139` — `idx_users_employee_id_unique`, a partial unique index created **after** the column migrations | enforced by the database, not by policy (§2.2); a duplicate in the data throws at boot |
| Every other `.role` in the tree is a **job title** | `employees.role`, `preboarding_cases.role` | not permissions — the naming hazard is §2.4, and **the rename has now landed** |

**Consequence to hold on to:** the product is no longer "one role called admin". It is **five roles with a
deny-by-default gate, a per-resource matrix, and row-level scopes** — and the interesting question is no longer
whether access can be expressed but whether each enforced cell matches the ruling in §3. Where the code and this
document disagree, **the code is what runs** and the disagreement is a defect in whichever of the two is wrong.

### 1.1 The mechanism this matrix fills — and the three cells pre-boarding now needs

- **The gate denies in four ways** (`server/access.js:367-386`): a route whose resource is not in `POLICY`; a
  resource whose role list is empty; a caller whose role is not in the list; and a **scope of `null`** — a
  scope-bearing resource whose `SCOPES` table does not cover the caller's role. Each is **403 with no body**;
  a missing or bad token stays **401** from `authenticateToken`. A route with no line in `ROUTES` is refused,
  not left open (`:250`), and `unpoliciedRoutes()` (`:351`) must stay empty — a check asserts it, and it is
  empty, and `unknownRolesInPolicy()` (`:357`) is empty too — measured: `[]` and `[]`. **So a role widens
  exactly the cells this matrix names**, and a cell cannot name a role the product does not have.
- **Changed by #239 — `preboarding:read` is now THREE cells, and each one is an argument.** At `b4f479a` it was
  two; the third was forced by the same reasoning §1.1 made for the first split:

  | Resource | Routes | Count | Cell |
  |---|---|---|---|
  | `preboarding:read` | `GET /preboarding/cases` — **the collection itself** | **1** | `[hr_admin]` |
  | `preboarding:read:own` | `GET /preboarding/cases/:id`, `…/:id/checklist`, `…/:id/workspace`, `…/:id/package` | **4** | `[hr_admin]`, with `⊘` for `employee` and `manager` (below) |
  | `preboarding:read:aggregate` | `GET /preboarding/checklist/overview`, `GET /preboarding/flag-watch` — the **derived** company-wide reads | **2** | `[hr_admin, compliance_viewer]` |

  A list is the one shape a per-row scope cannot make safe, so it sits alone and `employee` never holds it. The
  two derived reads name no single record, so they can be granted to the viewer **without** granting it the
  collection — which one resource could not have expressed.

---

## 2. The roles

### 2.1 The five — now in the data, not just in this document

| Role | In `ROLES` at | Derived from | The job it does |
|---|---|---|---|
| `hr_admin` | `access.js:74` | the `admin` account, renamed — value and column both (`users.access_role`) | runs the lifecycle: roster, pre-boarding, offboarding, documents |
| `manager` | `:75` | `employees.manager_id` against the caller's own `users.employee_id` (`index.js:180`, `relationTo`) | sees **their own reports**, for the steps they must chase |
| `finance` | `:76` | not stored; granted | EOSB and settlement figures; the economic sponsor's read |
| `employee` | `:77` | `users.employee_id` — **read now**, by `relationTo` | their own record only |
| `compliance_viewer` | `:78` | not stored; granted | **read-only** over audit records, accounts, the notice and the derived company-wide reads |

### 2.2 The link, the missing second link, and the three marks

**The first version of this section said `users` had no `employee_id`; the second said it existed and nothing read
it. Both are now out of date, and the true state is more precise than either.**

- **`users.employee_id` exists** (`server/schema.sql:193`): nullable, declared last, deliberately not backfilled —
  the live `admin` row is NULL and stays NULL. **Changed by #239 — uniqueness IS enforced, but not by
  `schema.sql`, and where I looked is the lesson.** The column is still plain `TEXT` and `schema.sql` still carries
  no `UNIQUE` on it — measured — and **that is where the previous revision stopped, which made its conclusion half
  wrong.** The constraint exists as a partial unique index created **after the column migrations**:
  `idx_users_employee_id_unique` (`server/db.js:138`, registered in `POST_MIGRATION_INDEXES` at `:134-139`:
  `CREATE UNIQUE INDEX IF NOT EXISTS … ON users (employee_id) WHERE employee_id IS NOT NULL`). It **cannot** live in
  `schema.sql`, which runs *before* the migrations — on a database predating `users.employee_id` the index would
  name a column that does not exist yet and the boot would fail (`db.js:120-127` says exactly this). A duplicate
  already in the data **throws**, a loud boot failure rather than a silently absent constraint — the right way
  round, since two accounts for one person is precisely the state the scope checks cannot resolve. **So "one
  account per person" is a constraint the database now holds; a schema read is not a database read.** What
  remains a *policy*, deliberately, is the **case→person link** for pre-boarding (below).
- **It IS read now.** `relationTo()` (`index.js:180`) resolves the caller's relation to a row — `self`, `report`,
  `other`, `unknown` — from the caller's `employee_id` and `employees.manager_id`, and `scopedAllows`
  (`access.js:326`) turns that into a decision. So the own view and the reports view are **live**, not pending.
- **Changed by #239 — a THIRD prerequisite is missing, and the code names it rather than hiding it.** The gate's
  `PENDING_CELLS` (`access.js:155`) records that **`preboarding_cases` has no `employee_id`**: a case carries
  `candidate_name`, `candidate_email`, `role`, `department`, `reporting_line` and **no reference to an
  `employees` row** (`schema.sql:200`). So `users.employee_id` can say *which person the caller is* but cannot
  say *which case is theirs*. The only link that exists anywhere is a demo convention — `scripts/seed-demo.js`
  writes `source = 'roster:<employee id>'`, and a real client's case is created with `source = 'intake_form'`.
  **This is why `preboarding:read:own` still excludes `employee`** — not an omission but a missing column, and
  the honest answer to "which case is theirs" is currently "we cannot tell", so nobody is given it.

**The marks, now three plus one — and each is a different machine-readable structure in `access.js`:**

| Mark | Means | Where it lives | What a builder may do |
|---|---|---|---|
| **`✖`** | **denied by policy at every horizon.** No future schema change makes it permitted — the absence IS the mark | a role simply not in a `POLICY` cell (`:91`) | nothing — do not build it |
| **`⊘`** | **permitted by policy, not yet EXPRESSIBLE** — the ruling says yes and a column is missing | `PENDING_CELLS` (`:155`), which names the missing link; a check asserts such a role is **not** in the cell | build the **empty state** and its sentence; do **not** ship it as a live read |
| **`⚖`** | **denied for now because counsel owns the question** — neither of the above | `COUNSEL_PENDING` (`:169`), keyed to this document's §8 item numbers — items 3, 4 and 5 are **decision 27** | nothing yet; the refusal is provisional and named |
| **`✔`** | **permitted and ENFORCED** | a role present in the cell | use it |

**Why the distinction is kept in code and not only here:** flattening `✖` into `⊘` would make a permanent refusal
look temporary; flattening `⚖` into either would make a counsel question look like a missing column or a settled
denial. The gate reads `POLICY` alone, so a `⊘` or `⚖` role **cannot pass** — the marks are documentation that a
check keeps honest, not a second policy.

### 2.3 What is deliberately *not* a role

Department, nationality, Emiratisation flag, and jurisdiction are **attributes, not permissions**. A `department`
column must never become an access boundary by itself. If a customer needs departmental scoping it arrives as a
**scope** a role carries, not a new role. **Owner decision 24 (§8 item 7), still open** — and note the product
now has five roles with `SCOPES` as the mechanism that makes a sixth unnecessary.

### 2.4 The naming hazard — and the rename LANDED

`users.role` collided by name with `employees.role` (a job title) and `preboarding_cases.role` (also a job title).
**Changed by #239: the rename happened**, exactly where the second version of this document predicted it would —
in the slice that derives `manager` from `employees.manager_id`, and so is the slice where `users.access_role` and
`employees.role` sit in one function. The column is `users.access_role` (`schema.sql:191`), the JWT claim is
`req.user.access_role` (`access.js:378`, `auth.js:91-92`), and `access.js:4` records the rename as this slice's.
**What remains true:** the hazard was real while it lasted, the fix is a rename and a migration rather than a
second name kept alongside (a role value the list does not know is refused), and the gate is written against the
permission — correct today, as it was before the rename.

---

## 3. The matrix — as enforced

Every cell is a decision, and at `ca681dd` every cell below is the code. **`✔`** permitted and enforced ·
**`✖`** denied by policy at every horizon · **`⊘`** permitted, column missing · **`⚖`** counsel-pending ·
**scoped** = `SCOPES` · **field** = `FIELD_RULES`.

### 3.1 Roster and the employee record — the sensitive core

| Route | hr_admin | manager | finance | employee | compliance_viewer |
|---|---|---|---|---|---|
| `GET /api/employees` (`:281`) | ✔ (`all`) | **✔ scoped `reports` + field** (no national ID, no pay) | **✔ `all` + field** (no national ID) | **✖ (§6.1)** | ✖ |
| `POST /api/employees` (`:336`) | ✔ | ✖ | ✖ | ✖ | ✖ |
| `PUT /api/employees/:id` (`:403`) | ✔ | ✖ | ✖ | ✖ | ✖ |
| `GET /api/employees/:id/onboarding` (`:480`) | ✔ (`all`) | ✔ (`reports`) | ✖ | **✔ (`own`) — live, not `⊘`** | ✖ |
| `PUT /api/onboarding-tasks/:id` (`:500`) | ✔ (`all`) | ✔ (`reports`) | ✖ | **✖ (§6.4 — the own view is read-only)** | ✖ |
| `GET /api/employees/:id/offboarding` (`:521`) | ✔ (`all`) | ✖ | ✖ | **✔ (`own`)** | ✖ |
| `PUT /api/offboarding-tasks/:id` (`:533`) | ✔ | ✖ | ✖ | ✖ | ✖ |

**National-ID columns never leave the HR boundary.** They are encrypted at rest and the roster's read decrypts
them (`index.js:318-319`) — encryption at rest discloses nothing if the read decrypts for everyone. #239 closed
this properly: the decrypt happens **only for a column the caller's role is served**, inside the projection
(`index.js:309-319`), and `fieldsRemovedFor` returning `null` — policy silent about a role — is a **refusal**
(`index.js:310`), not "serve everything".

**A scope the table does not cover is a refusal, and that is asserted.** `scopeFor` returns `null` rather than
falling back to `all` (`access.js:318-323`); the call sites refuse on it. The failure mode this prevents is the
worst one available here: "how far may this role reach" defaulting to "everywhere".

### 3.2 Pre-boarding — the ruling, and the cell that still waits on a column

| Route | hr_admin | manager | finance | employee | compliance_viewer |
|---|---|---|---|---|---|
| `POST /api/preboarding/cases` (`:822`) | ✔ | ✖ | ✖ | ✖ | ✖ |
| `GET /api/preboarding/cases` (`:852`) — **the list** | ✔ | **⊘** ⚖ | ✖ | **✖ — never: no listing, no count** | ✖ |
| `GET /api/preboarding/cases/:id` (`:867`) | ✔ | **⊘** | ✖ | **⊘** ⚖ | ✖ |
| `GET /api/preboarding/checklist/overview` (`:895`) — roll-up | ✔ | ✖ | ✖ | **✖ — a company-wide roll-up** | ✔ (read-only) |
| `GET /api/preboarding/cases/:id/checklist` (`:903`) | ✔ | **⊘** | ✖ | **⊘** | ✖ |
| `GET /api/preboarding/cases/:id/workspace` (`:916`) | ✔ | **⊘** | ✖ | **⊘** ⚖ | ✖ |
| `POST …/items/:itemKey/status` (`:927`) | ✔ | ✖ | ✖ | ✖ | ✖ |
| `POST …/reminders` (`:947`) | ✔ | ✖ | ✖ | ✖ | ✖ |
| `POST …/notice-acknowledgements` (`:976`) | ✔ | ✖ | ✖ | ✖ | **✖ — corrected, see below** |
| `GET …/package` (`:1036`) | ✔ | **⊘** | ✖ | **⊘** | ✖ |
| `POST …/package/:itemKey/acknowledgement` (`:1047`) | ✔ | ✖ | ✖ | ✖ | ✖ |
| `GET /api/preboarding/flag-watch` (`:1067`) | ✔ | ✖ | ✖ | **✖ — spans cases** | ✔ (read-only) |

**A correction to this document, made by the code.** The previous version marked
`POST …/notice-acknowledgement` as **"✔ (read-only)"** for `compliance_viewer`. That is self-contradictory — a
write is not read-only — and `access.js:125-127` refuses the cell and **names the contradiction for this
document's owner rather than guessing at it**. The document was wrong; the code is right; the cell is `✖` for
`compliance_viewer`, and if the owner wants the acknowledgement recorded by a viewer that is a decision, not a
typo to be smoothed over.

**The ruling, unchanged: option (a).** A person **may** read their **own** pre-boarding record — their own case,
their own items and flag, and the notice as it was shown to them. *Why (a) and not (b):* the reader **is the data
subject**, so nothing is disclosed to a third party; answering them is the controller's own transparency. Option
(b) — decision 14's hire portal — stays true for the **hire with no account**, and is not a reason to refuse an
**employee** their own record. What makes (a) safe is that it is bounded: **read-only, own record only,
field-limited.** **What is new since the ruling: the bound is now the only thing left to build.** The column
`preboarding_cases.employee_id` is the missing piece (§2.2), and the scope machinery that will use it already
exists and is already exercised on the task routes.

**What the own-view projection must strip** — the routes carry HR's working surface, so a raw response handed to
`employee` would leak colleague identifiers and internal notes:

- **`note`, `last_actor`, and every actor username** on `preboarding_items` (`server/preboarding-items.js:517`,
  `:521`; insert paths `:389`, `:609`);
- **owner names on the workspace track** — show the **function** ("with IT"), never a person;
- **`preboarding_reminders`** — what HR chased and when is not the person's record;
- **`created_by`** on the case (`schema.sql:213`) — an HR username;
- **counsel question numbers and internal refusal bodies** — on the one screen a non-HR person reads;
- **`document_reference`** — a reference string is not a held document.

### 3.3 Exit, EOSB, and the compliance documents

| Route | hr_admin | manager | finance | employee | compliance_viewer |
|---|---|---|---|---|---|
| `POST /api/exit-interviews` (`:805`) | ✔ | ✖ | ✖ | ✖ | ✖ |
| `POST /api/compliance/calculate-eosb` (`:549`) | ✔ | ✖ | ✔ | ✖ | ✖ |
| `GET /api/compliance/notice` (`:558`) | ✔ | ✔ | ✔ | ✔ | ✔ |
| `GET /api/compliance/templates/…` (`:580`) | ✔ (all) | ✖ | ✔ (**settlement templates only**, `TEMPLATE_SCOPES` `access.js:235`, applied `index.js:588`) | ✖ (**§6.2**) | ✖ |
| `GET /api/analytics/dashboard` (`:652`) | ✔ | **⚖ (§8 item 3)** | ✔ | ✖ | ✔ (read-only) |

- **The notice is not restricted, and that is deliberate.** It is the document a data subject is shown. Every
  role may read it; its route answers 401 without a token and 200 with one.
- **`calculate-eosb` is stateless** — it reads no employee row, so it discloses nothing about a person. It is
  nevertheless restricted to the roles that handle pay, because **the inputs are salaries**.
- **A manager's dashboard refusal is the honest default, not a settled answer** — it is `⚖`, and the code says so
  (§8 item 3).

### 3.4 Audit records and accounts

| Route | hr_admin | manager | finance | employee | compliance_viewer |
|---|---|---|---|---|---|
| *(no read route exists)* | — | — | — | — | — |
| `GET /api/users` (`:218`) | ✔ | ✖ | ✖ | ✖ | **✔ (read-only)** |
| `POST /api/users` (`:228`) | ✔ | ✖ | ✖ | ✖ | ✖ |
| `POST /api/login` (`:105`, unauthenticated, rate-limited) | — | — | — | — | — |

1. **User administration exists, and now writes the link as well as the role.** `POST /api/users` creates an
   account, refuses a username that exists (409), a password under 12 characters (400), and a role the policy
   does not know (`index.js:238`, `access.isKnownRole`) — the right refusal, because a typo must not become a
   role no cell can match. `GET /api/users` returns `username`, `access_role`, `created_at` and **no password
   material** (`:221`).
2. **Account creation is attributable** (#236): it writes an `audit_logs` row with `performed_by` set to the
   authenticated caller, and the password deliberately not recorded (`index.js:269-270`).
3. **`audit_logs` is still write-only.** No route reads it. A log nobody can read is storage, not auditability.
   **Recommendation stands:** a read route restricted to `compliance_viewer` and `hr_admin`.

---

## 4. The PDPL basis, per cell that touches personal data

UAE: **Federal Decree-Law No. 45 of 2021** (PDPL). KSA: **PDPL, Royal Decree No. M/19**. Article-level questions
are **(counsel)** — named so they are asked, not answered.

**Who is the controller.** The **employer** is the controller of employee and candidate data. A colleague —
including a manager, and including a `finance` user — is **not** a controller; they act inside the controller's
processing. That is why a manager's access is *purpose-bound and field-limited* rather than "read-only on their
team": the manager is not being given their own data. **The `employee` own-view cells are the exception that
proves the rule** — there the reader *is* the data subject, so the same access is transparency, not disclosure.

| Data | Purpose | Minimum necessary | Basis / open question |
|---|---|---|---|
| Employment record (name, job title, department, dates) | running the employment relationship | all roles, scoped to the relationship they hold | contract performance; the employer is controller |
| Work contact details (`email`) | operational contact | hr_admin; manager for own reports | contract performance |
| **National ID / Iqama** | statutory identity and right-to-work checks | **hr_admin only** — enforced: removed from the manager's and finance's payloads (`FIELD_RULES`) | statutory obligation. *(counsel)*: retention, and whether any manager flow has a lawful need |
| **Salary, allowances, EOSB accrued/paid** | payroll, settlement, statutory EOSB | hr_admin and finance; **a manager must not see a report's pay** — enforced | contract + statutory obligation. *(counsel)*: whether a manager may see a *band* |
| Visa status and expiry, probation end, Emiratisation band, governing law | statutory workforce obligations | hr_admin; manager for own reports (dates only) | statutory obligation |
| Candidate data (name, email, offer role) before start | pre-boarding | hr_admin; manager scoped to own line — **`⊘` until the case→person link exists** | **pre-contractual.** ⚖ *(counsel)*: candidate contact details to a hiring manager (§8 item 4) |
| **The person's own pre-boarding record** | the data subject's own record; transparency about what was asked of them | **the person themselves**, read-only, field-limited per §3.2 — **`⊘` until the link exists** | the data subject reading their own data — not a disclosure. ⚖ *(counsel)*: whether the workspace track belongs on the own view (§8 item 5) |
| **The notice acknowledgement, read by the person it concerns** (`item_label`, `acknowledged_at`, `notice_version`, `lawful_basis`, `recorded_by`) | showing a person what was recorded about them | the person themselves, and `hr_admin` / `compliance_viewer` | accountability. **`recorded_by` is permitted on the own view, deliberately:** it names the controller's staff member acting on the reader's own record, so it answers "who do I ask" — unlike the workspace owner names §3.2 strips. **Reversible in one field** |
| Exit interview (`detailed_feedback`, `satisfaction_score`) | offboarding and reasons analysis | hr_admin; aggregated for anyone else | contract. *(counsel)*: the interview's own promise to the leaver |
| Account records (`id`, `username`, `access_role`, `created_at`, `employee_id`) | authentication and authorisation | hr_admin; `compliance_viewer` read-only | legitimate interest / accountability. No password material is returned (`index.js:221`). `employee_id` is a link, NULL for the account that predates it |
| Analytics cohorts | workforce reporting | hr_admin, finance, compliance_viewer — **aggregates only**; small cohorts are ⚖ (§8 item 3) | contract; the small-cohort re-identification question is **(counsel)** |
| Audit records (`performed_by`, `old_values`, `new_values`) | accountability for changes | compliance_viewer, hr_admin | accountability. `old_values`/`new_values` carry encrypted identifiers; the log is not a decryption back door |

**Data residency.** `employees.data_residency_country` gates a **query filter** on the roster (`index.js:291-303`)
— the comment there says so: nothing is hidden at the data layer. **A filter is not an access control**; the
`SCOPES`/`FIELD_RULES` machinery above is.

---

## 5. What every write must log

### 5.1 What exists today — at `ca681dd`

| Write path | Actor column gets | Where |
|---|---|---|
| Pre-boarding case, item status, reminders | `actorOf(req)` — `(req.user && req.user.username) \|\| null` (`index.js:203`) | `:828`, `:931` |
| Notice / package acknowledgement | the same — `recordedBy` (`:979`, package `:1054`) — and **an unnamed actor is REFUSED (400)**: the refusal is the module's, `preboarding-items.js:360-364`, mapped back as `err.status` (`:1061`) | `:976` (package `:1047`); constraint `recorded_by TEXT NOT NULL` (`schema.sql:334`) |
| `POST /api/employees`, `PUT /api/employees/:id` | **Changed by #239: the signed-in actor**, replacing the literal `'system'` | `:343`→`:387-388`, `:410`→`:461-462` |
| The checklist tick `PUT /api/onboarding-tasks/:id` | `completed_by`, with **400 when the actor is unnamed** (#223) | `:503`; column `schema.sql:50` |
| `POST /api/users` | **the authenticated caller** (#236), password never recorded | `:267`→`:269-270` |

**The literal `'system'` is RETIRED — measured: zero occurrences as a value in `server/index.js`.** The two
employee write paths were this document's longest-standing finding, and #239 closed them.

### 5.2 The rule this document sets

1. **Every write names the signed-in actor — CLOSED at `ca681dd`.** The `'system'` fallbacks are gone from every
   write path; `actorOf` returns `null` rather than a false name. **Stated rather than deleted**, because this
   was the finding a reader may have quoted.
2. **Account creation must be logged — CLOSED by #236** (`index.js:269-270`).
3. **An unnamed actor is refused, not defaulted** — the acknowledgement convention, carried to the checklist tick
   by #223 and to the case path at `index.js:829`, which is the refusal itself (`if (!actor) return
   res.status(400)`). **An earlier revision of this line cited `:824-828`** — the rationale comment above the
   refusal, five lines of prose that end one line before the code that does the refusing. A citation that stops
   at the comment evidences the *intent*, not the refusal; the corrected line is in §9's check.
4. **The autonomous actor is a separate, explicit value** — not a fallback. Where a write genuinely has no human
   behind it, the record says which mechanism did it.
5. **A write to `audit_logs` accompanies every state change**, with `old_values`/`new_values` as the encrypted
   identifiers already are — never a decrypted identifier in the log.

**Closed, so it is not re-litigated:** decision 22's class (a tick recording a date and no name) — #223. The
account route's silence — #236. The false `'system'` attribution — #239. **Every logging rule on this page is
closed; one cell is not.** **Decision 26** (§8 item 10) asks whether a role whose *whole* definition is
"read-only" (`compliance_viewer`, §2.1) may make **one write** — the notice acknowledgement — and the code refuses
it today. This page is where that question lands: granting it would add a write to a role this page only ever
describes as reading, and §8 item 10 rests on rule 2 above as the reason it matters. **Read the page as closed on
logging and open on that one cell**; the flat "nothing on this page is open" an earlier revision carried was the
kind of over-claim this document exists to catch.

---

## 6. The cases that must be refused, named

Each was reachable by **any** authenticated caller before #223. At `ca681dd` each is refused by the **absence of
a role from a cell** — which is why they are asserted in `server/access.test.js` rather than commented.

### 6.1 One employee reading a colleague's national ID and pay — `GET /api/employees`
The roster does `SELECT *` on `employees` (`index.js:303`), decrypts both national-ID columns (`:318-319`) and
returns the row. **Refused for `employee` and `compliance_viewer` by their absence from the cell** (`access.js:95`);
a manager is line-scoped and loses the national-ID and pay columns; finance keeps pay and loses the identifiers.

### 6.2 A manager or employee reading a settlement document — `GET /api/compliance/templates/…`
Reads one employee (`index.js:588-596`), decrypts their national IDs, and substitutes the person's identifiers
and EOSB into a document. **Refused for `employee` and `manager`**; `finance` reaches settlements only
(`TEMPLATE_SCOPES`), and a role absent from that table gets `undefined` — a refusal, never `all`.

### 6.3 A manager reading company-wide pay through the dashboard — `GET /api/analytics/dashboard`
`SELECT *` on `employees` (`index.js:659`) plus exit and task rows, reduced to cohort figures. **Refused for
`manager`** — and the refusal is marked `⚖` rather than settled: the small-cohort threshold is **(counsel)** (§8 item 3), and the honest default until it is answered is to refuse rather than guess.

### 6.4 Ticking a step on someone else's record — `PUT /api/onboarding-tasks/:id`
Requires a named actor (`index.js:503`) and is now **refused for `employee`** (the cell is
`[hr_admin, manager]`). For a manager, the scope is `reports` — so a manager cannot tick their own step, and the
code **names that as a deliberate refusal rather than inferring "reports includes self"** (`access.js:192-195`).

### 6.5 Ending someone's employment — `POST /api/exit-interviews`
Writes the interview and sets `employees.status='terminated'` (`index.js:811`; route at `:805`). **`hr_admin` only.** Of everything
in §3.3 it is the one where a wrong click is least recoverable.

---

## 7. Out of scope — stated, not implied

- **The hire-facing portal** (decision 14, open) — needs an identity mechanism for someone with no account. The
  §3.2 ruling does not move it: an **employee** may read their own record; a **hire with no account** still cannot.
- **Document storage and anything contract-shaped** (decision 10, IFZA). `server/document-store.js` is **unwired**
  — no SQL, required by nothing but its own test — and this document gives it no access rule it cannot have.
- **Cross-tenant isolation.** One database, no tenancy model; every role above is *within* one employer.
- **Field-level encryption by role, key management, rotation.** Noted only where encryption at rest is mistaken
  for disclosure control (§3.1).
- **Retention and deletion schedules.** **(counsel)**, per-table.
- **An employee's own pay, EOSB or settlement figures** — not this slice, and not a side effect of it.

---

## 8. Open questions

1. **Counsel:** retention periods per table, and candidate data for hires that never start.
2. **Counsel:** whether a manager may see a report's pay *band*.
3. **Counsel — `⚖` in the code (decision 27 — the block with items 4 and 5):** the minimum cohort size
   before an aggregate becomes a disclosure. Until answered, a manager's dashboard row is refused
   (`COUNSEL_PENDING`, `access.js:169`). One thing blocks all three — a **counsel recipient**, decision
   15a — which is why the plan numbers them as **one decision** rather than three.
4. **Counsel — `⚖` (decision 27):** whether a manager may see a candidate's contact details before the start date.
5. **Counsel — `⚖` (decision 27):** whether the **workspace track** belongs on an employee's own view, or stays internal.
6. **Owner — decision 23, still open:** does `compliance_viewer` stay in the role set? Dropping it makes the
   actor the only reader of their own record. **Not decided here.**
7. **Owner — decision 24, still open:** departmental scoping as a *scope* a role carries rather than new roles.
   **Not decided here.**
8. **Engineer — the prerequisites this document named are BOTH in place** (`users.employee_id`, the read split),
   **and a third is now named by the code**: `preboarding_cases` has no `employee_id`, so no cell can say *which
   case is a person's*. That is a schema decision, and it is the one thing between §3.2's ruling and its
   enforcement. Closed since the last revision: the rename (landed, §2.4), the `'system'` attribution (§5.2).
9. **Owner — decision 25, still open (found by the engineer in #239):** **a `manager` cannot read their OWN
   onboarding tasks.** The matrix gives the manager column `scoped (own reports)` and the employee column
   `scoped (own)`, and one account holds one role — so `reports` excludes the caller. The code refuses to infer
   its way out: "widening `reports` to include the caller would be the kind of inference this file refuses; it is
   raised in the PR body instead" (`access.js:193-196`). *The cost:* a person who manages a team and is also on
   one cannot see their own steps. *The alternative:* widen `reports` to include self, which is a policy change,
   not a fix. **Not decided here.**
10. **Owner — decision 26, still open — and it is a cell THIS DOCUMENT got wrong.** The notice-acknowledgement
   POST (§3.2) was marked **"✔ (read-only)"** for `compliance_viewer`, a role §2.1 defines as read-only. The code
   refuses the cell and names the contradiction (`access.js:125-127`). *The cost of granting it:* it widens a
   role whose whole definition is "read-only", and §5.2 rule 2 makes the account/holdership surface
   accountability-bearing. *The cost of refusing it:* a viewer cannot record an acknowledgement. **Not decided
   here** — say so explicitly rather than leaving a contradiction in place.

---

## 9. How to check this document

```sh
# the cells, the roles, and the three pre-boarding resources — measured by EVALUATING the module
git show origin/main:server/access.js > /tmp/a.js
node -e "const a=require('/tmp/a.js');
  console.log('roles',Object.keys(a.ROLES).length,'| resources',Object.keys(a.POLICY).length,'| routes',a.ROUTES.length);
  const by={}; for(const [m,p,r] of a.ROUTES)(by[r]=by[r]||[]).push(m+' '+p);
  for (const k of ['preboarding:read','preboarding:read:own','preboarding:read:aggregate'])
    console.log(k, JSON.stringify(a.POLICY[k]), (by[k]||[]).length);
  console.log('unpolicied',a.unpoliciedRoutes().length,'| unknown roles',a.unknownRolesInPolicy().length);
  console.log('cells not admin-only:',Object.entries(a.POLICY).filter(([k,v])=>['admin'].indexOf(v.join())===-1).map(([k])=>k).length);"  # written with indexOf on purpose: no history-expansion character in the quoted string

# the gate, the scope machinery, and the marks
git show origin/main:server/access.js | sed -n '91,95p;155,180p;189,210p;318,333p;367,386p'

# the link that exists, the link that is missing, and the rename
git show origin/main:server/schema.sql | sed -n '187,194p'    # users: access_role :191, employee_id :193
git show origin/main:server/schema.sql | sed -n '200,203p'    # a case has NO employee_id
git grep -n "req.user.employee_id" origin/main -- 'server/*.js'   # read now, via relationTo

# §5.2 rule 3 — the refusal is the code, not the comment above it (line 829, not 824-828)
git show origin/main:server/index.js | sed -n '824,830p'
# the write paths and the retired literal (expect no value occurrence)
git grep -n "accessScope\|relationTo" origin/main -- server/index.js
git show origin/main:server/index.js | grep -v '^\s*//' | grep -c "'system'"

# the open owner decisions, by the number the plan cites: 23, 24, 25, 26,
# and 27, which covers §8 items 3, 4 and 5
git show origin/main:docs/access-model.md | grep -n 'decision 2[3-7]'
```

**The five inert tables.** `analytics_metrics`, `data_subject_requests`, `breach_register`, `eosb_calculations`
and `preboarding_consents` are declared in `server/schema.sql` and referenced by **nothing** outside tests — no
route, no writer, no reader. `consent_records` is retained but unwritten by decision 17. **A table with no route
needs no access rule, and a table with no writer is not a control** — named so the silence is an enumeration
that states its exceptions. The DSAR and breach registers will need a rule when they get an interface.

---

## 10. The amendment — what changed, and why

### 10.1 Amended 2026-10-20 against `8ec9f69` (the decision numbers — and the case-sensitive search that missed two of them)

**The plan numbers three things this document is the register for, and a reader must be able to cite them here by
number:** **25** (§8 item 9 — a manager cannot read their own onboarding tasks), **26** (§8 item 10 —
`compliance_viewer` against the one write), **27** (the counsel block over §8 items 3, 4 and 5).

1. **Decisions 25 and 26 were already recorded — in a case a search for them misses.** §8 items 9 and 10 have
   carried `DECISION 25` and `DECISION 26` since #239, but the plan writes `decision 25` and `decision 26`, and a
   case-sensitive search for the plan's form finds neither. Measured before this change, `grep -n 'decision
   2[3-7]' docs/access-model.md` matched **two** lines and both were *outside* §8. **The numbers were present and
   the string a reader searches for was not**, so the register now uses the plan's own form and a citation and a
   search agree. **Nothing was renumbered:** 23, 24, 25 and 26 keep the numbers they had.
2. **Decision 27 had neither a number nor a site in this file.** It is recorded **on the three items it covers**
   (3, 4 and 5) rather than as an appendix, with the single blocker named — a **counsel recipient** (decision
   15a) — because the plan numbers them as one decision precisely so they cannot be actioned apart.
3. **The checker enforces this now.** A new check in `shared/verify-access-model.py` reads the five open owner decisions
   out of §8 and fails when one is missing in the plan's own form: **124/124, exit 0** against the tree with this
   document, **123/124, exit 1** against the previous document bytes — the new check reddens on the document that
   prompted it, which is the only way to know it is load-bearing.

### 10.2 Amended 2026-10-20 against `be8e99d` (two citations moved under this document — re-grounded, not adjusted)

**The pre-boarding module's own `'system'` fallback was retired at the source, and every citation below it moved.**
`requireActor` (`preboarding-items.js:198`) now throws a 400 where the write happens, applied at `:421` and `:573`;
the plan filed that fallback as a defect and the fix is real — the pattern `actor || 'system'` matched **5 lines
across 2 files** before it and **0** after. Nothing this document *says* about those lines changed. The lines
underneath them did:

| cited in this document | was pointing at | now points at |
|---|---|---|
| §5.1 `preboarding-items.js:343-347` | the `recorded_by` read and its refusal | **`:360-364`** |
| §3.2 `:497` | `note =` in the item update | **`:517`** |
| §3.2 `:501` | `last_actor =` in the item update | **`:521`** |
| §3.2 `:372` (insert path) | the `note` value on insert | **`:389`** |
| §3.2 `:588` (insert path) | the `note` value on the reminder insert | **`:609`** |

The shifts are **+17, +20, +21, +20 and +20**: a re-ground is a measurement, not arithmetic, and any one offset
carried across the file would have put four of these five on a line that holds something else.

**The blind spot this exposed is reduced, not closed — and "one citation per site" was an over-claim, corrected
here by measurement.** Its `[doc citation]` family enforced one citation (`index.js:829`), so a citation to a file
that MOVED passed silently while the checker's own tree claims for that same file reddened — the instrument could
see the tree move and not the document. The family holds **3** entries (`index.js:829`,
`preboarding-items.js:360-364`, `preboarding-items.js:517`), and that is the whole of what compares **this page's**
numbers against the tree. Measured at `9796d6b` on 2026-10-20:

| this page cites | count |
|---|---|
| distinct `file:line` sites | **49** |
| compared as citations (the family above) | **3** |
| pinned only as **tree claims** — redden when the file moves, never compare the number printed here | **35** |
| in **no check at all** | **11** |

The eleven are `access.js` `:4`, `:192-195`; `auth.js` `:91-92`; `db.js` `:120-127`; `index.js` `:199`,
`:291-303`, `:310`, `:503`; `preboarding-items.js` `:198`, `:343-347`; `schema.sql` `:50` — written in this
page's own backticked shorthand, so that naming them does not itself invent eleven new citations.
The exposure is the **+1 regime**, not silence: a citation that moved by one line still lands on something that
reads like what it names, so a reader checking it by eye — or a re-ground done by eye — sees nothing wrong.
**Closing it is one entry per site, and it is not done here**: the sentence that promised it is the thing being
corrected.

**And the count quoted above has been overtaken TWICE by that same work — this paragraph demonstrates its own
rule.** §10.1 records the checker reading `124/124` for this document when it was written; the retired-fallback
claim took it to `125/125`; and the two `[doc citation]` entries described just above — the ones that would have
caught these five moved citations — take it to **127/127**, which is what the instrument reads against this
document now. This paragraph was first written at `125/125` and corrected here at `127/127`: a number quoted in
an amendment is a measurement at the time it is written, including in the sentence that says so.

### 10.3 Amended 2026-10-20 against `ee4bbdf` (the same afternoon — the checker learned to read its own subject)

**This amendment changes the CHECKER, and records two defects this document carried that its own check could not
see.** All three findings came from sweeping past the brief, and the first two are in this file.
1. **§5.2 rule 3 cited the rationale comment, not the refusal.** It pointed at a five-line comment block ending
   *one line before* the `if (!actor)` return that does the refusing — the refusal is `index.js:829`. A citation
   that stops at the comment evidences the *intent*, not the mechanism. The checker had asserted `:829` as a tree
   claim all along and still passed the sentence, because **it asserted the tree's lines and never the
   document's citations to them.** That coupling is now a check (`[doc citation]`); reverting the citation
   reddens it (two FAILs, exit 1).
2. **§5.2 closed itself with an over-claim.** The flat sentence "nothing on this page is open" was written
   before the notice-acknowledgement cell was reclassified — and **decision 26 is open, and it asks whether a
   role whose whole definition is read-only may make one write**, which is precisely what that page is about.
   The page now reads **closed on logging, open on that one cell**, with the cost stated; the flat form is
   checked for by absence, so restoring it reddens.
3. **The checker's own headline was wrong.** It printed "103/103 claims hold" while **107** checks executed: the
   denominator was hand arithmetic and the measured-cell list had outgrown it. A count a human maintains by hand
   drifts silently and *understates* proof. It is now counted, and the summary reads `123/123 (ran=123, fails=0)`.

**Why this belongs in the document and not only in the checker.** The row that produced it was raised on a
measurement: a copy of this document asserting **all 16 resources**, the admin-only cell state, and the coarse
cell as two cells, scored the *same* 103/103 against the tree that refutes all three — because the numbers lived
in the checker's head, and handing it a different document could not change a verdict. **The structural claims
are now read OUT of the document** — the resource count; the role set from §2.1's own table; each pre-boarding
cell's route count *and* role list from §1.1; the widened-versus-admin-only state; the ten counsel marks; and the
§8 items the code keys its marks against — and compared against the measured module. The reddening fixture needs
no invention; it is already in the repository:

```sh
git show ca681dd:docs/access-model.md > /tmp/prev.md
VERIFY_DOC=/tmp/prev.md python3 /home/team/shared/verify-access-model.py
# -> 112/121, exit 1, and the failures name the drift rather than describing it:
#    the resource count (16 against 17), the route count on the list cell, the two missing cell
#    rows (own and aggregate), and the four places the admin-only claim still stood live
```

**What this document now claims — and what it does not.** `123/123` says **this document matches the tree it is
measured against**, on the claims a checker can read out of both. It does not say the tree is correct; and a
claim no checker can parse is not thereby checked — a false sentence with no number in it, a ruling the owner has
not made, or a legal basis counsel has not confirmed all pass it untouched. **The previous revision of this
section quoted "103/103" as verification of this document. It was a statement about the tree alone, and it was
true of a document asserting the opposite of the code.**

### 10.4 Amended 2026-10-20 against `ca681dd` (the enforcement slice, PR #239)

**A verifier, not a reading.** I re-ran the landed checker (`shared/verify-access-model.py`) against the new
`main` first: **20 of 94 claims still held, exit 1.** The 74 failures were the worklist, and four of them were
substantive rather than line drift.

1. **Access has widened — the plan's "every cell is still `[admin]`" is now false.** Five roles
   (`access.js:73-79`), 17 resources, most cells with more than one role. **Every §3 cell was rewritten to the
   enforced state**, and the header no longer claims nothing widened.
2. **The pre-boarding read is three cells, not two** (§1.1): `preboarding:read` (the list, 1 route),
   `preboarding:read:own` (4 single-case routes), and a new **`preboarding:read:aggregate`** (the roll-up and the
   flag watch, 2 routes) — the third forced by the same argument as the first split, because the viewer may have
   the derived reads and not the collection.
3. **The §3.2 ruling's remaining gap is a missing column, not an omission** (§2.2). I put the question to the
   lead — *is `preboarding:read:own` excluding `employee` deliberate or an oversight?* — and the code answers it:
   `preboarding_cases` has no `employee_id`, so nothing joins a person to their case, and the gate records that
   in `PENDING_CELLS` instead of guessing. **The `⊘` mark is now a machine-readable structure, and `✖` a role's
   absence from a cell.**
4. **My document contained an error, and the code caught it** (§3.2): the notice-acknowledgement POST was marked
   "✔ (read-only)" for a role defined as read-only. Corrected to `✖`, with the contradiction recorded rather than
   smoothed over.
5. **The rename landed** (§2.4) — `users.access_role`, in exactly the slice the previous revision predicted.
6. **The `'system'` attribution is closed** (§5.1, §5.2) — zero value occurrences; `actorOf` returns `null`
   rather than a false name.
7. **`COUNSEL_PENDING` now encodes this document's §8 items 3, 4 and 5** — so the §8 numbering is load-bearing
   in code, and a counsel answer means deleting a mark, not editing prose.

**Every `file:line` was re-derived**; `server/index.js` grew from 939 to 1,119 lines and `schema.sql` from 375,
moving essentially every citation. §9 carries the commands.

**A correction to this pass, from the lead's brief — and the lesson is about where I looked.** I read
`schema.sql`, found no `UNIQUE` on `users.employee_id`, and wrote that "one account per person" was a policy
rather than a constraint. That was **half the story**: the constraint is a partial unique index created **after
the column migrations** (`db.js:134-139`), precisely because `schema.sql` runs before them and would name a
column that does not yet exist on an older database. **A schema read is not a database read** — the live schema
now carries constraints that the schema file cannot state, so §2.2 and §1 carry both. Decisions **25** and
**26** are added alongside 23 and 24, with their costs, and **not answered**: a `manager` cannot read their own
onboarding tasks (§8 item 9), and a `compliance_viewer` recording an acknowledgement contradicts the read-only
role (§8 item 10).

**What this pass does not claim.** It describes the cells as they are enforced; it does not rule that they are
right. Where this document and the code disagree the code runs, and the disagreement is a defect in whichever is
wrong — one such defect was found here (§3.2), and §8 item 9 asks the owner to settle it. Docs only: `client/` 0,
`server/` 0, **no movement owed**.

### 10.5 Amended 2026-10-20 against `b4f479a` (slice-2 prerequisites, PR #236)

Re-grounded by measurement, 94/94 claims: the resource count 15 → 16; the split of the coarse cell into
`preboarding:read` (3) and `preboarding:read:own` (4), disjoint, both `[admin]`; `users.employee_id` present,
nullable, not backfilled — **and carrying no `UNIQUE`, so "one account per person" was a policy the product had
to hold rather than a constraint the database held.** Found by sweeping rather than named in the brief:
`POST /api/users` had begun writing an audit row, and the rename had **not** ridden slice 2. Decisions 23 and 24
recorded as open. **The negative control that made it a measurement: the same document judged against the merge
before slice 2 reddens at 31/94.**

### 10.6 Amended 2026-10-19 against `e2a4b4b` (slice 1, PR #223)

The ruling the designer's own-view surface needed — **option (a), with a bound**: a person may read their own
pre-boarding record; the list, the roll-up and the flag watch stay `✖` at every horizon. The distinction the
matrix was missing: `✖` and "not yet expressible" read identically, and a surface can only be built against the
second — which is why the marks are separate, and now separate in code. Two answers given rather than deferred:
the rename should ride the slice that enforces (**taken**, §2.4), and the resource split is part of the ruling,
not an implementation detail (**taken**, then extended to three cells, §1.1).

**What no amendment does.** None decides the designer's naming question ("My lines" names the pre-boarding
function scope; their "My records" is theirs and the owner's). None re-opens the hire-portal boundary (decision
14). None touches `client/` or `server/`, and none changes the host: the enforcement that exists is #223's
mechanism, and #236 and #239 filled it.
