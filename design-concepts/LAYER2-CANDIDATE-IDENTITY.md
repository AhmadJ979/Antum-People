# A pre-boarding case belongs to a person who is not yet an employee

**Row `44011fc6`** · design answer, docs-only, **no code, no movement**. Every citation below was **re-measured at
`main` = `495dc43`** (the row cites `ee4bbdf`, which is four merges old); the numbers are the ones this file was
written against, and the revision is named so a later reader can tell whether they still hold.

## 0. The answer, in one line

**A person exists before their employment record does, and this schema has nowhere to say so** — and the own-view
read is blocked **twice**, not once: `⊘` for the missing case → person link, and `COUNSEL_PENDING` for counsel's
§8 item 5. So **building the link alone would change no reachable behaviour**, and the honest answer to "what can be
built now" is **wait** — grounded in the ruling, not in the plumbing.

## 1. What identifies the person a case belongs to today

Read from `server/schema.sql` at `495dc43`:

| column | constraint | what it identifies |
|---|---|---|
| `preboarding_cases.id` | PK (`:201`) | the **case** |
| `preboarding_cases.offer_reference` | `NOT NULL UNIQUE` (`:202`) | the **offer** — not the person; a rehire is a second offer |
| `preboarding_cases.candidate_name` | `NOT NULL` (`:203`) | free text. Two people share a name; one person spells theirs two ways |
| `preboarding_cases.candidate_email` | **`TEXT`, no `NOT NULL`, no `UNIQUE`** (`:204`) | the only candidate-ish key — **optional, and permitted to repeat** |
| `preboarding_cases.created_by` | nullable (`:213`) | the **HR person** who opened it, not the candidate |

Three tables on the other side of the gap hold the person-identity the case lacks:

- `employees` (`:3`): `id` PK, and **`email TEXT UNIQUE NOT NULL`** (`:7`), `status DEFAULT 'onboarding'`.
- `users.employee_id` (`server/db.js:76`), **nullable and unique when set** — the index that makes that true is
  `idx_users_employee_id_unique` (`db.js:136`-`:139`), and `db.js:130`-`:132` says why it must throw loudly: two
  accounts for one person is exactly the state the scope checks cannot resolve.
- `preboarding_consents.case_id` (`schema.sql:293`, `NOT NULL UNIQUE`) — consent is **case-scoped**, and so is every
  acknowledgement (`:361`). The case is the only identity anything in Layer 2 hangs from.

**The asymmetry that decides the option space.** The one column the two side-by-side tables share is email, and it
carries **opposite constraints**: `employees.email` is *required and unique*; `candidate_email` is *optional and
repeatable*. So a join on it is not a relation, it is a **string match** — and a string match used to decide *whose row
this is* is the defect class this team fixed three times in one day: **a string's shape is not the role it plays.**
`candidate_email` may be absent (that is what the schema permits), so the match has no rule to be right by.

**How a case is born.** `POST /api/preboarding/cases` (`server/index.js:822`) calls
`preboarding.recordOfferAcceptance(req.body, { actor, source: 'intake_form' })`, refuses an unnamed actor with
**400** (`index.js:828`-`:829`), and is written as *"two callers of one function"* — the second being a future ATS
adapter (`index.js:819`-`:821`). So the candidate's identity arrives in a payload, and what the payload carries is a
name and an *optional* email.

## 2. The moment they become an employee

**There is no such moment in the product.** Measured: nothing writes an `employees` row from a case — the only
`INSERT INTO employees` in the server is the employee-issue path (`server/index.js:364`) and two test fixtures
(`access.test.js`, `schema-migration.test.js`). Pre-boarding and employment are two tables with no event between them.

That is not a gap in plumbing, it is the premise of the feature: **a pre-boarding candidate may have no `employees` row
at all — that is what pre-boarding means.** So "link the case to the employee" assumes the very row that may not exist
yet, and the schema cannot be read as if the employees row were waiting to be joined.

**What it implies for the own-view read.** The four routes the cell covers are
`GET /preboarding/cases/:id`, `/:id/checklist`, `/:id/workspace`, `/:id/package` (`server/access.js:279`-`:282`). To
grant any of them to *a person*, the read has to be scoped by something that exists **before employment**, or by
**possession** — there is no third possibility, because there is no employee row to resolve against.

## 3. The three options, each with its cost

### (a) A join column on the case

The case gains a column pointing at a person. It has two forms, and they are not the same size of decision:

- **(a1) a `people` table** — a person record that exists independently of an employment record, created at offer
  time. This is the only form that states the truth the feature rests on. Cost: a new table and migration, a write at
  `recordOfferAcceptance`, and reach: *who may see a person* is what decisions 23/24 are about. **It is decision 14's
  question seen from the data side**, which is why it must not be invented here.
- **(a2) a nullable `preboarding_cases.employee_id`, filled at conversion** — requires the conversion that
  **does not exist** (§2). Cost: it cannot be filled, so it grants nothing today and would encode a link that is
  null exactly when it is needed.

### (b) An identity carried by the invitation — the tokenised per-case link

The identity is the **link**, not a row: one case, one person, no join. This is decision 14's option 1.

- **What it buys.** It makes the own-view read **expressible with no schema change at all**, because the read is
  scoped by *possession of a link that names one case* rather than by a relation between tables. Of the three options
  it is the only one that does not wait on the schema question.
- **What it costs, and this is the part that must not be smoothed over.** The claim weakens from *"the reader is the
  data subject"* — the language of the access ruling (#227) — to *"the reader holds the link"*. A forwarded link is
  indistinguishable from the person; revocation and rotation are the only controls; and a bearer credential in a URL
  is the weakest form of proof the product has. It also says nothing about the record **after** employment begins.
- **What it breaks.** It does not pre-empt decision 14 — it *is* decision 14's option 1, so choosing it here would
  settle 14 by accident. Named, not settled.

### (c) A link created at conversion

- **Requires** the conversion event to exist first: measured, it does not. So this option is not a link, it is
  *inventing a hire workflow* to have somewhere to put one.
- **And it answers the wrong question.** Even built, it grants the own view only **after** the person is an employee —
  when the pre-boarding record is already history. It is the right shape for a later *"my records"* view (the Layer 3
  collisions in decision 25), not for this one.

## 4. Where it collides — named, not settled

| open question | the collision |
|---|---|
| **14** portal identity | (b) *is* its option 1, and (a1) is its data-side half. Nothing here can be built without answering it |
| **23 / 24** roles and scoping | (a1) adds a thing roles can reach; "who may see a person" is the same question as how many roles the product ever has, and `compliance_viewer`'s standing (23) sits on it |
| **25** a manager cannot read its own tasks | the `preboarding:read:own` **manager** cell is the identical shape: `reports` and `own` on one account, one role each. Whatever fixes 25 fixes this cell's manager half |
| **26** the viewer write contradiction | the model's own consistency problem — a cell that reads one way and writes another. Not on this path, but the same owner ruling covers it |
| **counsel §8 item 5** | recorded already as `COUNSEL_PENDING['preboarding:read:own'][EMPLOYEE]` (`access.js:173`-`:175`): *whether the workspace track belongs on the person's own view at all* |

**The interaction the row did not name, and it matters.** §8 item 5 is about **one** of the four routes —
`/:id/workspace` — but the gate is per **cell**, so counsel's question on one route currently refuses all four. The
team has already ruled on this shape (*"when the gate is coarser than the ruling, the ruling splits the gate"*), so a
future answer to §8 item 5 could be expressed as a **split** rather than a refusal — and the client's per-panel rule
(*a refusal may not empty a granted region*) is what makes a split safe to express. Named here; **not settled, and not
built.**

## 5. What can be built now, and what must wait

**Must wait, and not because of effort:**

1. **The link** — (a1) needs decisions 14/23/24; (a2) needs a conversion that does not exist.
2. **The own-view grant itself** — it needs the link **and** counsel's §8 item 5. Two independent blockers on one
   cell means **the schema change alone changes nothing**, which is why building it now would be work against a
   question rather than an answer.

**Buildable now without pre-empting anything:**

1. **This statement of the missing link**, so the next reader does not rediscover it as plumbing.
2. **The `⊘` mark staying honest** — `access.js:32`-`:35` says a check asserts that a pending cell has not quietly
   become granted; that check is the reason we can wait without drift.
3. **One measurement worth recording, because it stops a false positive:** the demo database holds **3 cases, 0 with a
   NULL `candidate_email`, 3 distinct emails** (`SELECT COUNT(*), SUM(candidate_email IS NULL), … FROM
   preboarding_cases`, read-only, 2026-10-20). **A demo cannot answer this question** — the constraint that matters
   (`candidate_email` is optional) is never exercised by seeded rows, so a green demo is not evidence that an email
   join would work. Say it here rather than let the sample stand in for the schema.

**The honest form of "wait":** nothing that **grants** can be built until decision 14 and counsel's §8 item 5 are
answered. The blocker is not the schema change; it is the two questions the schema change would answer by accident.

## 6. Consistency with the two documents that already touch this

Measured by grep at `495dc43`, for the specific claim this file makes:

- **`LAYER2-PREBOARDING-UI.md`** — no claim contradicts this one. Its `employee_id` hits are about a checklist item's
  *owner* (`:79`-`:80`) and about `interface Task` (`:80`), not about the case → person link. **One adjacent fact is
  worth flagging rather than editing:** `:1133` records that an earlier spec (2026-09-21) "specifies an e-signature
  component and a consent record keyed to `employee_id`" — **the shipped consent table is keyed to `case_id`**
  (`schema.sql:293`). That line is not stale as a description of that spec; it is simply the line a reader would find
  while looking for the shipped shape, and the shipped shape is case-scoped. **Said here, not silently edited there.**
- **`LAYER2-P2-2-IMPLEMENTATION-NOTES.md`** — no hit on this claim; nothing to reconcile.

## 7. What this file does not claim

- It does not settle 14, 23, 24, 25, 26 or §8 item 5, and it does not propose a schema **change** — it prices three.
- It does not claim a `people` table is required: it is the honest **form** of (a), and (a) is not the recommended
  first move.
- It does not quote the live database. The three-case figure is **demo data**, and by §5's own argument it is not
  evidence about candidates.
- **No `client/` or `server/` path is touched: docs-only, no build proof, no movement.**
