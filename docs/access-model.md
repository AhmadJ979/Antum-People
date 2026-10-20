# The access model — who may see what, on what basis, and what gets logged

**Status: the policy — amended after the mechanism landed, and again after its prerequisites did.** Layer 3 slice 1
(PR #223) built the gate; slice 2 (PR #236) built the two prerequisites this document named — the account→person
link and the pre-boarding read split — **and every cell is still `[admin]`, so nothing has been granted to
anyone.** What changed is that the ruling is now *expressible*: the column exists and the coarse cell is two cells.
**Amendment trail in §10**; the ruling the designer's own-view surface needed is in §3.2 and §4.

**Measured at** `origin/main` = **`b4f479a`**, re-asserted 2026-10-20. The first version read `7b073f8`, the second
`e2a4b4b`; each time the tree had moved under it, and **every `file:line` was re-derived by measurement, not by
arithmetic** — slice 1 moved `server/index.js` and `server/schema.sql`, and slice 2 moved both again. Rows that
changed by *completion* rather than by drift are marked **Changed by #223** or **Changed by #236**. Where a claim
is about counsel's ground, it is marked **(counsel)** and this document stops.

---

## 1. The state today, measured

| Fact | Where | What it means |
|---|---|---|
| One auth gate | `server/index.js:134-146` — `app.use('/api', …)` skips only `/login` and `/health`, then `authenticateToken`, then `access.gate` | authentication and a deny-by-default authorisation check both run on every `/api` route |
| The token carries a role | `server/auth.js:86-90` — `jwt.sign({id, username, role}, …, {expiresIn:'8h'})` | the claim exists and is signed |
| **Changed by #223 — the role is now read for a decision.** The first version of this row said it was read in exactly two places and consulted for none | before #223: `server/auth.js:87` (signing) and `server/index.js:128` (the login response) only. Now also `server/access.js:177` — `allowed.indexOf(req.user.role)` | the mechanism changed; the *conclusion* did not, because of the next row |
| **Every cell of the gate is `[admin]`** | `server/access.js:36` (`ROLES` has one member), `:45` (`POLICY` — all **16** resources are `[ROLES.ADMIN]`) | a second account can be created today (`server/index.js:172`) and **can do everything the first can**. The widening has not happened; this matrix is what decides it |
| Every other `.role` in the tree is a **job title** | `employees.role`, `preboarding_cases.role` | not permissions — the naming hazard is §2.4 |

**Consequence to hold on to:** the product is not "HR-only with weak controls". It is **one role, called admin,
that can do everything**, and the only control on it is a password. The interesting question is not whether the
current operator may do these things — they may — but what happens the first time a **second** account exists.

### 1.1 The mechanism this matrix fills — and the coarse cell #236 split

Two facts about the built gate decide how this document has to be written.

- **The gate denies in three ways** (`server/access.js:166-181`): a route whose resource is not in `POLICY`, a
  resource whose role list is empty, and a caller whose role is not in the list — each answered **403 with no
  body**, while a missing or bad token stays **401**. A route added without a line in `ROUTES` is refused rather
  than left open (`:83`), and `unpoliciedRoutes()` (`:150`) must stay empty — a check asserts it, and it is empty
  today. So adding a role **widens nothing by omission**: it widens exactly the cells this matrix names.
- **Changed by #236 — the coarse cell is now two cells, and the split is measured.** The first version of this
  section recorded that `preboarding:read` was **one** cell over **seven** routes, so the employee ruling (§3.2)
  could not be expressed without splitting it. Slice 2 built exactly that split (`server/access.js:66-67`):

  | Resource | Routes | Count |
  |---|---|---|
  | `preboarding:read` | `GET /preboarding/checklist/overview`, `GET /preboarding/flag-watch`, `GET /preboarding/cases` | **3** |
  | `preboarding:read:own` | `GET /preboarding/cases/:id`, `…/:id/checklist`, `…/:id/workspace`, `…/:id/package` | **4** |

  The two sets are **disjoint** — no route appears in both — and **both cells are still `[ROLES.ADMIN]`**, so the
  change makes the ruling writable and widens nobody. Measured by evaluating the merged module, not by reading it
  (§9 carries the command). **The own-scope grant (§3.2) is therefore a one-word edit from here:** add a role to
  `preboarding:read:own` and it gains the four single-case reads and *not* the list. That edit is slice 3's, and it
  is the change this document exists to make reviewable. `preboarding:write` (`server/access.js:68`) is still one
  cell over five routes, and stays `✖` for `employee` either way.

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
| `employee` | **`users.employee_id` — it EXISTS now (#236); nothing reads it yet, see 2.2** | their own record only |
| `compliance_viewer` | not stored; granted | **read-only** over audit records, accounts and the notice; exists so the person who acts is not the only reader of the log |

### 2.2 The link exists — and enforcement does not

**Changed by #236.** The first version of this section said `users` had **no** `employee_id` and that adding one
was the slice-2 prerequisite. It has been added, and *how* it was added matters as much as the fact:

- **`users` is now `(id, username, password_hash, role, created_at, employee_id)`** (`server/schema.sql:180-187`),
  with `employee_id` **nullable, declared last, and no default** (`:186`). Declared last on purpose: `ALTER TABLE
  ADD COLUMN` appends, so a fresh database and a migrated one read the same by name; a database that predates it
  gains the column from `COLUMN_MIGRATIONS` (`server/db.js:74`), the way `completed_by` did.
- **NULL means "not tied to a person yet", and it is deliberately not backfilled.** The single live `admin` row is
  NULL and stays NULL: guessing a link would invent the very fact this column exists to state.
- **Uniqueness is NOT yet enforced by the schema — measured, and stated because the difference matters.** The
  column is plain `TEXT`; `username` carries `UNIQUE` (`:182`) and `employee_id` does not. "One account per person"
  is therefore a **policy the product must hold, not a constraint the database holds**, and it must be added
  before any own-view grant is enforced — otherwise two accounts can point at one person and "own" stops meaning
  anything.
- **The column is a precondition, not a behaviour.** Nothing in `server/` yet reads `req.user.employee_id` to
  decide what a caller may see, and every cell is still `[admin]`. This is why the own-view cells in §3.2 are still
  `⊘` and not `✔`: **the column exists; the check does not.**

**The rule this section sets, for whoever writes that check:** an account whose `employee_id` is NULL is a
**refusal**, never a fall-through. A caller with no link gets the empty state (§4 of the designer's doc, case C) —
*"this account is not linked to a person's record"* — and must **never** be matched to a record by username,
e-mail, or a single-row assumption ("there is only one employee, so it must be them"). A loose match here produces
the one failure this whole model exists to prevent: a person shown someone else's record.

`manager` is derivable from the same column — as a *set*: the reports of the employee whose `id` equals the
caller's `employee_id`. That derivation is slice 3's, and it inherits the same refusal rule.

**A mark, because this is the defect underneath the designer's question.** A `✖` in the `employee` column could
mean two very different things — *denied by policy* or *permitted but not yet enforceable* — and a **surface can
only be built against the second**. The two are written differently, here and in every table below:

| Mark | Means | What a builder may do |
|---|---|---|
| **`✖`** | **denied by policy.** No future schema change makes it permitted | nothing — do not build it |
| **`⊘`** | **permitted by policy; not yet enforced** — the ruling says yes, the column exists (#236), but no check reads it and every cell is still `[admin]` (§2.2) | build the **empty state** and its sentence; do **not** ship it as a live read |

### 2.3 What is deliberately *not* a role

Department, nationality, Emiratisation flag, and jurisdiction are **attributes, not permissions**. A `department`
column must never become an access boundary by itself — several employers make "department" mean "cost centre" in
one place and "site" in another. If a real customer needs departmental scoping, it arrives as a **scope** on a
role (e.g. `hr_admin` scoped to a department), not as a new role. **This is owner decision 24 (§8), still open** —
it is written here so it is not silently invented later.

### 2.4 Naming hazard — three different `role` columns, and the rename did not ride slice 2

`users.role` (a permission) collides by name with `employees.role` (a job title) and `preboarding_cases.role`
(also a job title). The collision is noticed in passing at `server/preboarding-workspace.js:110`. It is a real
hazard: an access check written against the wrong `role` would gate on a **job title** — treating everyone titled
"Manager" as a manager, regardless of the reporting line. The gate is written against `req.user.role`
(`server/access.js:177`), which is the permission — correct today, and one refactor away from being wrong.

**Measured, and it is an unmet recommendation:** the rename **did not happen in slice 2**. `access_role` appears
nowhere in `server/` — the column is still `users.role` (§9 carries the grep). The first version of this section
recommended it ride the slice-2 PR "because that is where the hazard becomes real", and it should have; the
hazard has not gone away, it has been deferred. **It belongs to the next slice that enforces** — the one that
derives `manager` from `employees.manager_id` and will hold `employees.role` and the caller's role in one function.
The rename is four sites, all still cheap: `server/auth.js:87` (what is signed), `server/access.js:177` (what is
checked), `server/index.js:128` (what is returned at login), and `server/index.js:182` (`isKnownRole`).

---

## 3. The matrix

Every cell is a decision. **`✔`** permitted · **`✖`** denied by policy, whatever the schema gains later ·
**`⊘`** permitted by policy but **not yet enforceable** (§2.2) · **scoped** = permitted only under the named
restriction · **field** = permitted, with named fields removed from the payload.

### 3.1 Roster and the employee record — the sensitive core

| Route | Table(s) | hr_admin | manager | finance | employee | compliance_viewer |
|---|---|---|---|---|---|---|
| `GET /api/employees` (`:212`) | `employees` | ✔ | **scoped + field** (own reports; national-ID and pay columns removed) | **field** (pay columns only, as needed for settlement) | **✖ — the case in §6.1** | ✖ |
| `POST /api/employees` (`:242`) | `employees`, `onboarding_tasks`, `audit_logs` | ✔ | ✖ | ✖ | ✖ | ✖ |
| `PUT /api/employees/:id` (`:303`) | `employees`, `offboarding_tasks`, `audit_logs` | ✔ | ✖ | ✖ | ✖ | ✖ |
| `GET /api/employees/:id/onboarding` (`:374`) | `onboarding_tasks` | ✔ | ⊘ scoped (own reports) | ✖ | ⊘ scoped (own) | ✖ |
| `PUT /api/onboarding-tasks/:id` (`:383`) | `onboarding_tasks` | ✔ | ⊘ scoped (own reports) | ✖ | **✖ (§6.4 — the own view is read-only)** | ✖ |
| `GET /api/employees/:id/offboarding` (`:399`) | `offboarding_tasks` | ✔ | ✖ | ✖ | ⊘ scoped (own) | ✖ |
| `PUT /api/offboarding-tasks/:id` (`:408`) | `offboarding_tasks` | ✔ | ✖ | ✖ | ✖ | ✖ |

**National-ID columns never leave the HR boundary.** `national_id_value` and `national_id_iqama` are encrypted at
rest (`server/index.js:257`, `:352`) and are **decrypted into the roster response** (`:225`, `:228`) — encryption
at rest does nothing about disclosure if the read decrypts for everyone (§6.1).

### 3.2 Pre-boarding — and the ruling the designer's surface needed

| Route | Table(s) | hr_admin | manager | finance | employee | compliance_viewer |
|---|---|---|---|---|---|---|
| `POST /api/preboarding/cases` (`:688`) | `preboarding_cases`, `audit_logs` | ✔ | ✖ | ✖ | ✖ | ✖ |
| `GET /api/preboarding/cases` (`:712`) — **the list** | `preboarding_cases` | ✔ | scoped (own reports' hires) | ✖ | **✖ — never: no listing, no count** | ✖ |
| `GET /api/preboarding/cases/:id` (`:727`) | `preboarding_cases` | ✔ | ⊘ scoped (own reports' hires) | ✖ | **⊘ scoped (own) + field** | ✖ |
| `GET /api/preboarding/checklist/overview` (`:755`) — roll-up | `preboarding_items` | ✔ | ✖ | ✖ | **✖ — a company-wide roll-up** | ✔ (read-only) |
| `GET /api/preboarding/cases/:id/checklist` (`:763`) | `preboarding_cases`, `preboarding_items`, `preboarding_notice_acknowledgements` | ✔ | ⊘ scoped | ✖ | **⊘ scoped (own) + field** | ✖ |
| `GET /api/preboarding/cases/:id/workspace` (`:776`) | `preboarding_cases`, `preboarding_items`, `preboarding_reminders` | ✔ | ⊘ scoped | ✖ | **⊘ scoped (own), projection only** | ✖ |
| `POST …/items/:itemKey/status` (`:787`) | `preboarding_items`, `audit_logs` | ✔ | ✖ | ✖ | ✖ | ✖ |
| `POST …/reminders` (`:803`) | `preboarding_reminders`, `audit_logs` | ✔ | ✖ | ✖ | ✖ | ✖ |
| `POST …/notice-acknowledgements` (`:830`) | `preboarding_notice_acknowledgements`, `audit_logs` | ✔ | ✖ | ✖ | ✖ | ✔ (read-only) |
| `GET …/package` (`:890`) | `preboarding_cases`, `preboarding_acknowledgements` | ✔ | ✖ | ✖ | **⊘ scoped (own) + field** | ✖ |
| `POST …/package/:itemKey/acknowledgement` (`:901`) | `preboarding_acknowledgements`, `audit_logs` | ✔ | ✖ | ✖ | ✖ | ✖ |
| `GET /api/preboarding/flag-watch` (`:921`) | derived from cases + items | ✔ | ✖ | ✖ | **✖ — spans cases** | ✔ (read-only) |

**The ruling, stated plainly: option (a).** A person **may** read their **own** pre-boarding record — their own
case, their own items and flag, and the notice as it was shown to them — and the cells above say so with `⊘`.
*Why (a) and not (b):* in this half the reader **is the data subject**, so nothing is disclosed to a third party;
the record is about them, and answering them is the controller's own transparency, not a new sharing. Option (b)
— pushing this to decision 14's hire portal — would be right for the **hire who has no account**, and stays true
for them; it is not a reason to refuse an **employee** their own record. What makes (a) safe is that it is bounded
exactly as the design describes: **read-only, own record only, and field-limited.**

**What the own-view projection must strip** — the routes as they stand carry HR's working surface, so a raw
response handed to `employee` would leak colleague identifiers and internal notes (this is the "field" in every
`⊘` cell above):

- **`note`, `last_actor`, and every actor username** on `preboarding_items` — internal commentary and a colleague's
  name (`server/preboarding-items.js:497`, `:501`; insert paths `:372`, `:588`);
- **owner names on the workspace track** — show the **function** ("with IT"), never a person. The design's own rule
  (`LAYER3-EMPLOYEE-OWN-VIEW.md` §3) agrees, and the payload is where the names are;
- **`preboarding_reminders`** — what HR chased and when is not the person's record;
- **`created_by`** on the case (`server/schema.sql:206`) — an HR username;
- **counsel question numbers and internal refusal bodies** — on the one screen a non-HR person reads;
- **`document_reference`** — a reference string is not a held document, and must not be shown as one.

**`GET /api/preboarding/cases` stays `✖` for `employee` at every horizon.** "Own record only" means exactly one
record; a list route is the one place a scope check cannot be made safe, and a count of cases is a company-wide
figure. **This is why the resource split matters, and #236 built it** (§1.1): the grant that gives an employee
their own case is now `preboarding:read:own`, which does not contain the list.

### 3.3 Exit, EOSB, and the compliance documents

| Route | Table(s) | hr_admin | manager | finance | employee | compliance_viewer |
|---|---|---|---|---|---|---|
| `POST /api/exit-interviews` (`:671`) | `exit_interviews`, `employees` (sets `status='terminated'`) | ✔ | ✖ | ✖ | ✖ | ✖ |
| `POST /api/compliance/calculate-eosb` (`:424`) | **no table — stateless**; salaries come in the body | ✔ | ✖ | ✔ | ✖ | ✖ |
| `GET /api/compliance/notice` (`:433`) | none — served from `server/privacy-notice.js` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `GET /api/compliance/templates/:templateName/:employeeId` (`:455`) | `employees` (+ EOSB arithmetic) | ✔ | ✖ | scoped (settlement templates) | ✖ (**§6.2**) | ✖ |
| `GET /api/analytics/dashboard` (`:518`) | `employees`, `exit_interviews`, `onboarding_tasks` | ✔ | ✖ (**§6.3**) | ✔ | ✖ | ✔ (read-only) |

Two notes that matter:

- **The notice is not restricted, and that is deliberate.** It is the document a data subject is shown; every role
  may read it, and §3.2's own-view block links to it at the version recorded. Its route already answers 401 without
  a token and 200 with one.
- **`calculate-eosb` is stateless** — it reads no employee row, so it discloses nothing about a person. It is
  nevertheless restricted to the roles that may handle pay, because the *inputs are salaries*: a route that lets
  any caller compute a settlement figure invites one to be computed for a colleague whose salary was guessed.
  **An employee's own EOSB is not in this slice** — there is no basis row for showing a person their own accrual,
  the exit path is unreachable (decision 16), and a number shown is a number acted on. If the owner wants it, it
  is a separate decision with its own basis, not a side effect of the own view.

### 3.4 Audit records and accounts

| Route | Table(s) | hr_admin | manager | finance | employee | compliance_viewer |
|---|---|---|---|---|---|---|
| *(no read route exists)* | `audit_logs` | — | — | — | — | — |
| `GET /api/users` (`:163`) | `users` | ✔ | ✖ | ✖ | ✖ | **✔ (read-only)** — needed to resolve a `performed_by` name |
| `POST /api/users` (`:172`) | `users`, `audit_logs` | ✔ | ✖ | ✖ | ✖ | ✖ |
| `POST /api/login` (`:105`, unauthenticated, rate-limited) | `users` | — | — | — | — | — |

**Three findings in this section, two of them changed by landing rather than moving.**

1. **There is user administration now (#223).** `POST /api/users` creates an account, refuses a username that
   exists (409), refuses a password under 12 characters (400), and **refuses a role the policy does not know**
   (`server/index.js:182`, `access.isKnownRole`) — the right refusal, because it stops a typo becoming a role no
   cell can ever match. `GET /api/users` lists accounts (`:165` payload: `id, username, role, created_at` — **no
   password hash**).
2. **Changed by #236 — account creation is now attributable, and this was the sharpest gap in the document.** The
   previous version recorded that `POST /api/users` wrote **no audit row at all**, so an account — with a role —
   could be created with nothing recording who created it. It now writes one (`server/index.js:200-201`), with
   `performed_by` set to the authenticated caller, and the password deliberately **not** recorded. See §5.2.
3. **`audit_logs` is still write-only.** No route reads it. A log nobody can read is storage, not auditability.
   **Recommendation stands: a read route restricted to `compliance_viewer` and `hr_admin`**, so the person who
   performs a write is not the only person who can inspect it. That route does not exist yet.

---

## 4. The PDPL basis, per cell that touches personal data

UAE: **Federal Decree-Law No. 45 of 2021** (PDPL). KSA: **PDPL, Royal Decree No. M/19**. Article-level questions
are **(counsel)** — named here so they are asked, not answered.

**Who is the controller.** The **employer** is the controller of employee and candidate data. A colleague —
including a manager, and including a `finance` user — is **not** a controller; they act inside the controller's
processing. That is why a manager's access must be *purpose-bound and field-limited* rather than "read-only on
their team": the manager is not being given their own data, they are being given the controller's data about a
third person. **The `employee` own-view cells in §3.2 are the exception that proves the rule** — there the reader
*is* the data subject, so the same access is transparency rather than disclosure.

| Data | Purpose | Minimum necessary | Basis / open question |
|---|---|---|---|
| Employment record (name, job title, department, dates) | running the employment relationship | all roles, scoped to the relationship they hold with that person | contract performance; the employer is controller |
| Work contact details (`email`) | operational contact | hr_admin; manager for own reports | contract performance |
| **National ID / Iqama** | statutory identity and right-to-work checks | **hr_admin only**; never a manager, never finance, never in a list payload | statutory obligation. *(counsel)*: retention, and whether any manager flow has a lawful need |
| **Salary, allowances, EOSB accrued/paid** | payroll, settlement, statutory EOSB | hr_admin and finance; **a manager must not see a report's pay** | contract + statutory obligation. *(counsel)*: whether a manager may see a *band* rather than a figure |
| Visa status and expiry, probation end, Emiratisation band, governing law | statutory workforce obligations | hr_admin; manager for own reports (dates only, no identifiers) | statutory obligation |
| Candidate data (name, email, offer role) before start | pre-boarding | hr_admin; manager scoped to own line | **pre-contractual.** *(counsel)*: candidate contact details to a hiring manager, and candidate-data retention for hires that do not start |
| **The person's own pre-boarding record** (own case, own items, own document statuses) | the data subject's own record; transparency about what was asked of them | **the person themselves**, read-only, field-limited per §3.2 | the data subject reading their own data — not a disclosure. *(counsel)*: whether the **workspace track** (provisioning lines worked by other functions) is within this, or stays internal |
| **The notice acknowledgement, read by the person it concerns** (`item_label`, `acknowledged_at`, `notice_version`, `lawful_basis`, `recorded_by`) | showing a person what was recorded about them | the person themselves, and `hr_admin` / `compliance_viewer` for the accountability record | accountability. **`recorded_by` is permitted on the own view, deliberately:** it names the controller's own staff member acting officially on the reader's own record, and its purpose is to tell the reader who to ask — which is why it is *not* the same as the workspace owner names §3.2 strips, where the name allocates an internal task and says nothing about the reader. **Reversible in one field** if counsel disagrees |
| Exit interview (`detailed_feedback`, `satisfaction_score`) | offboarding and reasons analysis | hr_admin; aggregated for anyone else | contract. *(counsel)*: the interview's own promise to the leaver |
| Account records (`id`, `username`, `role`, `created_at`) | authentication and now authorisation | hr_admin; `compliance_viewer` read-only (to resolve `performed_by`) | legitimate interest / accountability. No password material is returned (`server/index.js:165` payload). **`employee_id` is now held too** (§2.2) — it is a link, and it is NULL for the single live account |
| Analytics cohorts | workforce reporting | hr_admin, finance, compliance_viewer — **aggregates only**; cohort sizes small enough to identify an individual are **(counsel)** | contract; the small-cohort re-identification question is counsel's |
| Audit records (`performed_by`, `old_values`, `new_values`) | accountability for changes | compliance_viewer, hr_admin | accountability. `old_values`/`new_values` carry **encrypted** identifiers (`server/index.js:352`) — the log is not a decryption back door, and must not become one |

**Data residency.** `employees.data_residency_country` exists and gates a **query filter** on the roster
(`server/index.js:214-221`) — and the comment there says so in as many words: nothing is hidden at the data layer,
only at the query the UI happens to send. **A filter is not an access control**; this matrix is the control.

---

## 5. What every write must log

### 5.1 What exists today — and where #223 and #236 changed it

| Write path | What the actor column gets | Where at `b4f479a` |
|---|---|---|
| Pre-boarding case, item status, reminders | `(req.user && req.user.username) \|\| 'system'` | `server/index.js:691`, `:795`, `:809` |
| Notice acknowledgement, package acknowledgement | `(req.user && req.user.username) \|\| null` → **the module refuses null (400)** | `server/index.js:833`, `:908`; constraint `recorded_by TEXT NOT NULL` (`server/schema.sql:327`, rationale at `:309`) |
| **`POST /api/employees`, `PUT /api/employees/:id`** | **the literal `'system'`** — not the signed-in user | `server/index.js:288`, `:356` |
| **The checklist tick — `PUT /api/onboarding-tasks/:id`** | **Changed by #223: it records the actor.** The first version said the column did not exist | `onboarding_tasks.completed_by` (`server/schema.sql:50`); written at `server/index.js:391`, with **400 when the actor is unnamed** |
| **`POST /api/users`** | **Changed by #236: it is now attributable.** The previous version of this row read *"nothing — this route writes no audit row at all"* | `server/index.js:200-201` — inserts into `audit_logs` with `performed_by` = the authenticated caller; the password is deliberately not recorded |

### 5.2 The rule this document sets

1. **Every write names the signed-in actor.** No write may be recorded as `'system'` when a person performed it.
   The two employee paths (`server/index.js:288`, `:356`) still do exactly that, and it is **worse than a missing
   actor**: a field that exists and holds a false name is a record a future reader will trust. **This is the
   document's longest-standing finding, and it is now the only one of its class left on the employee paths.**
2. **Account creation must be logged — it is the one write that grants permissions.** **Closed by #236:** the
   account route now writes an `audit_logs` row naming the caller (`server/index.js:200-201`). Stated rather than
   silently dropped, because this was the sharpest logging gap in the product: every *other* write's
   accountability depends on the account this route hands out.
3. **An unnamed actor is refused, not defaulted.** The acknowledgement's convention is the correct one — 400,
   backed by a `NOT NULL` constraint — and **#223 carried it to the checklist tick** (`server/index.js:388-391`).
   The `|| 'system'` fallback at `:691`, `:795`, `:809` should become `|| null` plus the same refusal: with the
   auth gate in front, a null actor means a defect, not a system event.
4. **The autonomous actor** (the recovery, the seeder, a migration) is a **separate, explicit value** — not a
   fallback. If a write genuinely has no human behind it, the record says which mechanism did it, so `'system'`
   means "a mechanism" and never "someone we did not identify".
5. **A write to `audit_logs` accompanies every state change**, with `old_values`/`new_values` as the encrypted
   identifiers already are — never a decrypted identifier in the log.

**Closed, stated so it is not re-litigated:** the class this document raised as decision 22 — a checklist tick
that recorded a date and no name — is fixed (#223: the actor is required, the refusal is a 400). And the account
route's silence is fixed (#236). **What remains open on this page is rule 1**, on the two employee write paths.

---

## 6. The cases that must be refused, named

Each was reachable by **any** authenticated caller before #223. The gate now refuses them by policy — because
every cell is `[admin]` — but the *matrix* has not yet narrowed them, so each remains a case the slice-3 policy
must refuse explicitly rather than by accident.

### 6.1 One employee reading a colleague's national ID and pay — `GET /api/employees`

The roster does `SELECT *` on `employees` (`server/index.js:220-221`), **decrypts both national-ID columns**
(`:225`) and returns the whole row (`:228`). Every employee's salary, allowances, accrued EOSB and decrypted ID
number are in that response.

**Why it must be refused:** this is the single highest-consequence read in the product. Pay and a national
identifier are exactly the data an insider misuses, and the response hands them over as a *list*, with no per-row
decision to make. With one shared admin account the exposure is theoretical; **the first `employee` account makes
it real**, and it is a one-request read of the whole company. §3.1 refuses it for `employee` outright and strips
the fields for everyone who is not `hr_admin`.

### 6.2 A manager or employee reading a settlement document — `GET /api/compliance/templates/…`

Reads one employee (`server/index.js:458`), decrypts their national IDs (`:461-462`), and substitutes the person's
identifiers and their EOSB into a contract or settlement document.

**Why it must be refused:** the response is a document *about a named person's money*, in a form that looks
official. Refused for `employee` absolutely, and for `manager` entirely — the reporting line does not carry a
settlement interest, and `finance` gets the templates it needs, not all of them. (Note the asymmetry with §3.2:
an employee may read their **own** record but **not** their own settlement document, because the document is a
statement of pay and the exit path is unreachable — decision 16.)

### 6.3 A manager reading company-wide pay through the dashboard — `GET /api/analytics/dashboard`

`SELECT *` on `employees` (`server/index.js:525`) plus `exit_interviews` and task rows, reduced to cohort figures.

**Why it must be refused for `manager`:** the figures are built from the whole roster. Even aggregated, a cohort in
a 100-person company is small enough to name an individual — and *that* threshold is **(counsel)**. Until it is
answered, the honest default is: aggregates to `hr_admin`, `finance` and `compliance_viewer`; a manager's own
view is not a dashboard.

### 6.4 Ticking a step on someone else's record — `PUT /api/onboarding-tasks/:id`

Takes a task id and a status (`server/index.js:383`). It requires a named actor to complete (`:388-391`) — **but
it still checks no ownership**. Any caller with the role can tick any task by id.

**Why it must be refused for `employee`:** this is the route by which a compliance step is marked done. The own
view (§3.2) is **read-only**, and the write stays refused. Even for `hr_admin` and `manager`, the scope check must
eventually exist: requiring an actor names *who* ticked it, not *that they were entitled to*. A control that
anyone can tick for anyone is not a control. **`employee_id` makes this check possible now (#236) and does not
make it exist** — that is slice 3's work.

### 6.5 Ending someone's employment — `POST /api/exit-interviews`

Writes the interview **and sets `employees.status='terminated'`, `end_date`** (`server/index.js:677`).

**Why it must be refused outside HR:** this is not a data-entry route; it terminates a person's employment record
in one un-roled call, with no actor in `exit_interviews` and no audit row. Of everything in §3.3 it is the one
where a wrong click is least recoverable.

---

## 7. Out of scope — stated, not implied

- **The hire-facing portal** (owner decision 14, open). It needs an identity mechanism for someone with no account.
  **The §3.2 ruling does not move this**: an **employee** may read their own record; a **hire with no account**
  still cannot, and their identity question is 14's. This is the boundary between the two surfaces, and it is the
  reason the ruling is (a) rather than (b).
- **Document storage and anything contract-shaped** (owner decision 10 — IFZA registration is the gate).
  `server/document-store.js` **has no SQL and is required by nothing but its own test** — it is unwired, and this
  document does not give it an access rule it cannot yet have.
- **Cross-tenant isolation.** One database, no tenancy model. Every role above is *within* one employer. A second
  customer on this instance would be a different design, not a new role.
- **Field-level encryption by role, key management, and rotation.** Out of scope; noted only where encryption at
  rest is mistaken for disclosure control (§3.1).
- **Retention and deletion schedules.** **(counsel)** and per-table; this document names the tables.
- **An employee's own pay, EOSB or settlement figures** — see §3.3; not this slice, and not a side effect of it.

---

## 8. Open questions for the owner and counsel

1. **Counsel:** retention periods per table, and the candidate-data question for hires that never start.
2. **Counsel:** whether a manager may see a report's pay *band*, and if a pay figure may ever reach a manager.
3. **Counsel:** the minimum cohort size for the dashboard before an aggregate becomes a disclosure.
4. **Counsel:** whether a manager may see a candidate's contact details before the start date.
5. **Counsel:** whether the **workspace track** (provisioning lines worked by other functions) belongs on an
   employee's own view at all, or stays internal — §3.2 permits it with owner names stripped.
6. **Owner — DECISION 23, still open:** does `compliance_viewer` stay in the role set? Dropping it makes the actor
   the only reader of their own record. **This document does not decide it**; it states the cost.
7. **Owner — DECISION 24, still open:** departmental scoping as a *scope* a role carries, rather than as new roles
   (§2.3). It decides how many roles the product ever has. **Not decided here.**
8. **Engineer — the prerequisites this document named are now BUILT (#236), so what remains is the check, not the
   column.** Closed: `users.employee_id` exists (§2.2) and the `preboarding:read` / `preboarding:read:own` split
   exists with the two sets disjoint (§1.1). Still open, and this is the next slice's work: (a) reading
   `req.user.employee_id` to decide "own" — **with the NULL-link refusal (§2.2), never a loose match**; (b) a
   **unique** constraint or check on `users.employee_id`, since "one person, one account" is not yet enforced by
   the schema; (c) the projection that strips the fields §3.2 names; (d) tick/scoping ownership (§6.4).
9. **Engineer — the rename still has not happened.** The `users.role` → `users.access_role` rename was recommended
   for the slice-2 PR and **did not ride it** (§2.4); it now belongs to the slice that enforces, and the hazard is
   unchanged until it lands.

---

## 9. How to check this document

Every claim above is checkable against `origin/main` with the artifact, not with trust. The commands are given as
run at `b4f479a`:

```sh
# the gate, the role it reads, and the two split cells (#223, #236)
git show origin/main:server/index.js  | sed -n '134,146p'
git show origin/main:server/access.js | sed -n '36p;45p;66,68p;166,181p'

# THE SPLIT, MEASURED — evaluates the merged module and prints the two route sets, their
# disjointness, the resource count, and that nothing is unpolicied. Run from the repo clone.
# NOTE the disjointness test is written `indexOf(...) === -1`, NOT `!own.includes(...)`: the `!`
# is bash history expansion inside the double-quoted command and dies with `event not found` when
# pasted into an interactive shell. Measured: the `!` form fails, this form prints `disjoint true`.
git show origin/main:server/access.js > /tmp/access.js
node -e "const a=require('/tmp/access.js');
  const cw=a.ROUTES.filter(r=>r[2]==='preboarding:read').map(r=>r[0]+' '+r[1]);
  const own=a.ROUTES.filter(r=>r[2]==='preboarding:read:own').map(r=>r[0]+' '+r[1]);
  console.log('resources',Object.keys(a.POLICY).length,'| routes',a.ROUTES.length);
  console.log('company-wide',cw.length,cw); console.log('own',own.length,own);
  console.log('disjoint',cw.every(x=>own.indexOf(x)===-1),'| unpolicied',a.unpoliciedRoutes().length);
  console.log('all admin',Object.keys(a.POLICY).every(k=>a.POLICY[k].join()==='admin'));"
# expected: resources 16 | routes 26 ; company-wide 3 ; own 4 ; disjoint true | unpolicied 0 ; all admin true

# the link the ruling needed, and the fact that NOTHING reads it yet (#236)
git show origin/main:server/schema.sql | sed -n '180,187p'     # users: employee_id :186, nullable, last
git show origin/main:server/db.js     | sed -n '68,75p'        # COLUMN_MIGRATIONS gains it on an old DB
git grep -n "req.user.employee_id" origin/main -- 'server/*.js'   # EMPTY: the column is a precondition

# the rename that did not ride slice 2 (§2.4) — expect no hit in server/
git grep -n "access_role" origin/main -- 'server/*.js'

# the roster that hands out decrypted identifiers and pay (§6.1)
git show origin/main:server/index.js | sed -n '212,229p'

# the false attribution still standing (§5.1) — the only one of its class left
git show origin/main:server/index.js | sed -n '288p;356p'

# the tick #223 fixed (decision 22), and the account route #236 made attributable
git show origin/main:server/index.js | sed -n '383,392p'
git show origin/main:server/index.js | sed -n '196,202p'

# the tables with no route and no reference at all
git grep -c 'analytics_metrics\|data_subject_requests\|breach_register\|eosb_calculations\|preboarding_consents' \
  origin/main -- 'server/*.js'
```

**The five inert tables.** `analytics_metrics`, `data_subject_requests`, `breach_register`, `eosb_calculations` and
`preboarding_consents` are declared in `server/schema.sql` and referenced by **nothing** outside tests — no route,
no writer, no reader. `consent_records` is retained but unwritten by decision 17. They are named so this matrix's
silence about them is an enumeration that states its exceptions, not an omission: **a table with no route needs no
access rule, and a table with no writer is not a control.** If a future slice gives any of them a route, the rule
is written then — and the DSAR and breach registers in particular will need one, since a register with no interface
is a log nobody can keep.

---

## 10. The amendment — what changed, and why

### 10.1 Amended 2026-10-20 against `b4f479a` (slice 2, PR #236)

**The three places the brief named, verified against the merged bytes rather than taken on trust — and two more
found by sweeping, because a re-grounding that only fixes the reported rows leaves the document lying elsewhere.**

1. **The resource count: 15 → 16** (§1). Verified by evaluating the merged `POLICY`, not by counting lines.
2. **§1.1 — the coarse cell is now two, and the split is measured, not described.** `preboarding:read` (3 routes:
   the list, the roll-up, the flag watch) and `preboarding:read:own` (4 routes: the case, checklist, workspace,
   package), **disjoint**, both `[ROLES.ADMIN]`. This is the single most consequential change in this pass: the
   ruling is now a one-word edit away instead of being inexpressible. My own count matches the lead's independent
   one exactly (3 / 4 / disjoint).
3. **§2.2 — the link exists and enforcement does not.** `users.employee_id` is present, nullable, declared last,
   not backfilled (the live `admin` row stays NULL). Two things I added because the measurement showed them and
   the brief's summary did not: **`employee_id` carries no `UNIQUE`** — so "one account per person" is a policy the
   product must hold, not a constraint the database holds — and **nothing in `server/` reads it yet**, which is why
   the own-view cells are still `⊘` and not `✔`.

**Found by sweeping, not named in the brief (this is why the sweep is the job):**

4. **`POST /api/users` now writes an audit row** (`server/index.js:200-201`, `performed_by` = the caller, password
   deliberately not recorded). §3.4, §5.1 and §5.2 all said the opposite; all three are corrected in place with the
   old wording shown, because **this was the document's sharpest finding** and a reader who quoted it deserves to
   see it closed rather than deleted.
5. **The rename did not ride slice 2.** §2.4 recommended it for exactly this PR, and `access_role` appears nowhere
   in `server/` — measured. It is now honestly recorded as an **unmet recommendation deferred to the next slice**,
   rather than left implying it landed.
6. **Decisions 23 and 24 added as open owner questions** (§8 items 6 and 7), marked as awaiting the owner and
   explicitly **not decided here** — the document states each one's cost and stops.

**Every `file:line` in this document was re-derived against `b4f479a` by locating the code**, not by arithmetic.
Slice 2 moved `server/index.js` (the route surface still 26 routes, but every cited line moved again) and
`server/schema.sql`. §9 carries the commands, including the one that measures the split by evaluating the module.

**What this pass does not claim.** Every cell is still `[admin]`: nothing has been granted to anyone, and the
steps are prerequisites being in place, not access being widened. `client/` and `server/` are untouched by this
change and **no movement is owed** — the code that runs is #236's, and this document only describes it accurately.

### 10.2 Amended 2026-10-19 against `e2a4b4b` (slice 1, PR #223)

**(i) The ruling the designer's own-view surface needed — option (a), with a bound.** A person may read their own
pre-boarding record: their own case, their own items and flag, and the notice as it was shown to them. The cells
are `⊘ scoped (own) + field` in §3.2 and §4; the list, the roll-up and the flag watch stay `✖` at every horizon.
Reason in §3.2, and the field list that must be stripped is there too — the routes as they stand carry HR's
working surface (actor usernames, `note`, `last_actor`, workspace owner names, reminders, `created_by`). **The
designer's doc was right to mark its dependence `(open)` rather than invent a permission**; that is what made the
question answerable rather than a build-time surprise.

**(ii) A distinction the matrix was missing, which was the defect underneath the question.** `✖` and "not yet
expressible" read identically in the first version, and a surface can only be built against the second. The marks
are now separate (§2.2), and every `employee` cell that depends on the link is `⊘` rather than `✖`.

**(iii) Drift and completion.** Slice 1 moved `server/index.js` and `server/schema.sql`; every citation was
re-derived. Four rows changed by *completion* rather than drift: the role is now read for a decision (§1); user
administration exists (§3.4); the checklist tick records `completed_by` with a 400 on an unnamed actor, closing
decision 22 (§5); and the "not enforced by any code" framing was replaced by "the cells are all `[admin]`" (§1).

**(iv) Two answers given rather than deferred:** the rename should ride the slice-2 PR (§2.4), and the resource
split is part of the ruling, not an implementation detail (§1.1). **The first of those was not taken — see 10.1
item 5. The second was.**

**What neither amendment does.** Neither decides the designer's naming question ("My lines" already names the
pre-boarding function scope; their "My records" is theirs and the owner's). Neither re-opens the hire-portal
boundary (decision 14). Neither touches `client/` or `server/`, and neither changes anything on the host: the
enforcement that exists is #223's, extended by #236's prerequisites, and **every cell of it is still `[admin]`.**
