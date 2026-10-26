# The correction path for a submitted probation evaluation

**Row `0484e79e`** — raised by the engineer in the P3-2 submission, filed by the lead.
**Decided before P3-4 lands**, because P3-3's escalations and P3-4's decision record both read these rows.
**Decision: taken here. Build: NOT in this PR** — this is the document the build is done from (see §4).
**Measured at** `main` = **`0afe5ac949b092ac08dc63541ccf0cfdd9aab209`**, in a detached worktree at that
revision (`/tmp/r78/main`) with its own database and its own port, never the live deployment.
**Evidence:** `docs/evidence/probation-correction-decision-2026-10-26/` — six raw transcripts; §2 says which
file each figure is in.

---

## 1. The decision

**A correction is an append-only row in its own table, `probation_evaluation_corrections`, that names the
evaluation it corrects and carries the corrected words, a REQUIRED reason, the named actor and the
timestamp.** It is reached by

```
POST /api/employees/:id/probation-evaluations/:evaluation_id/corrections
```

The submitted evaluation row is **never rewritten**. It stays the record of who submitted what, and when —
which is the whole reason `UNIQUE (employee_id, milestone_index)` and the 409 exist. The correction is
always a separate row with its own name on it, and both rows are kept.

Six properties, each a rule and not an implementation detail:

1. **Completion is EXISTENCE, not content.** A milestone reads `completed` because a submitted evaluation
   exists for it (P3-2, unchanged). A correction cannot make a completed milestone incomplete, and cannot
   make an unevaluated milestone complete. This is what keeps the correction path away from
   `probation_escalations`, whose `UNIQUE (employee_id, milestone_index)` would silently swallow a re-fire
   that P3-3's own `CATCH_UP_RULE` forbids ("A milestone is never silently skipped").
2. **A reason is required, and it is the point of the shape.** `content` says what the record now says;
   `reason` says why it changed. A correction with corrected words and no reason is an edit wearing a
   badge. Empty reason → 400, no row, no audit line.
3. **One audit row per correction**, naming the actor (decision 22), with the corrected text living in the
   correction row and not copied into the log — the same division P3-2 uses for the submission.
4. **The newest correction is the effective record**, ordered by `corrected_at`. Corrections are append-only
   and more than one is allowed; `correction_count` is published on every read, so a record that was
   corrected twice says so instead of looking like a record that was corrected once.
5. **An `as_of` reading is honest about corrections too.** `completionsFor` filters submissions by
   `substr(submitted_at,1,10) <= as_of`; corrections are filtered by `corrected_at` the same way, or a
   reading pinned to a past day would show today's correction under yesterday's date — the defect P3-2
   already closed for submissions.
6. **Correcting is not submitting.** The correction route consults no probation window and no milestone
   index: the record it corrects already exists and already named its milestone. This is deliberate and it
   is the difference a late discovery needs (measured: a submission for a hire whose window has ended is
   refused 400 — see §2).

**Audience.** The write rides `onboarding:write` with the SAME row scope P3-2 already applies (HR_ADMIN
company-wide; a MANAGER for the hire's own line; the hire themselves refused outright — §4e). The record is
not the manager's private note: it belongs to the milestone, so a hire's *current* manager may correct an
evaluation their predecessor submitted, and the name on the correction is what says so.

---

## 2. What was measured, at `0afe5ac`

*Every line below is a reading from the rig, not a reading of the code. File names are in
`docs/evidence/probation-correction-decision-2026-10-26/`.*

| Reading | Value | File |
|---|---|---|
| A second submission for one milestone | **409**, 181 B: `{"error":"milestone 1 already has a submitted evaluation — recorded by scratch-hr at 2026-10-26T15:21:58.870Z","recorded_by":"scratch-hr","recorded_at":"2026-10-26T15:21:58.870Z"}` — **no `evaluation_id` in the payload** | `02` §5 |
| The rows after it | **one** evaluation row, content and `submitted_at` byte-identical to the first submission; **no** audit row for the 409 | `03` |
| A correction attempt against the route the product does not have | with a valid `hr_admin` token **403, 0 B**; with no token **401, 41 B** | `02` §6 |
| The control that makes the 403 mean nothing | `POST /api/definitely-not-a-route-xyz` with the same token → **403, 0 B**, identical; a non-existent read route → **403, 0 B**; a route that exists, same method and token → **200** | `02` §6 |
| What a client can address | after the submission the timeline's `completion` object carries **`evaluation_id`, `completed_at`, `completed_by`, `milestone_due_date`** — so a correction is addressable from the screen's existing read | `02` §7 |
| A hire whose probation window has **ended** | submission refused **400** `this hire has no probation window that is still running, so there is no milestone to evaluate` | `02` §8 |
| A milestone that is **not yet due** | submission **accepted, 201** — a submission is a person's act, not a due-date event | `02` §9 |
| A manager who is not the hire's manager / the hire themselves / empty content / index 9 | **403, 0 B** / **403, 0 B** / **400** / **400 with `known_milestones`** | `02` §9 |
| The escalation, one submission later | the SAME row (`id` and `detected_at` identical), `resolved` derived **false → true**. **A later submission does not un-fire an escalation; it resolves it on read.** | `02` §10 |
| The escalation note text it printed | `…with no submitted evaluation, while the app was not running (noticed 255.35h late)` — the sentence already filed as defect (a) of row `3e66a47c`, reproduced here on a rig where the app *was* running | `02` §3 |
| Roster seed, `manager_id` | **0 of 14** employees carry one; 3 carry a probation window — defect (b) of `3e66a47c`, reconfirmed | `01` |
| The proposed DDL against an existing database | tables **19 → 20**, the new table's columns and two indexes created, **`probation_evaluations` dump md5 `91a83713…` and `audit_logs` dump md5 `05bdba7c…` unchanged**, second application a no-op; the tree's own `schema.sql` applied to the same database as a **control** added nothing | `04` |
| The read rule, executed in SQL over real rows | two corrections → newest wins (`corrected_by` named); `as_of 2026-10-26` → the newest correction; **`as_of 2026-10-25` → `null`, the original submission stands**; the original row still `A1-original: …` with `submitted_by`/`submitted_at` untouched | `04` |
| Client callers | evaluation route **0 hits** in `client/src`; escalation route **0 hits**; the timeline route is read at `client/src/App.tsx:741` | `05` |
| Registered `/api` routes | **30** (`server/access.js` `ROUTES`) | `05` |
| `evaluationsFor` | exported by the module and **called by nobody** at this revision — the read P3-4 is meant to use | `05` |

**Two consequences of this table, stated rather than left to be inferred.**

- **The 403 is not a route census.** The correction path answers exactly what any unregistered path answers,
  so "the route does not exist" is **not** provable from HTTP here; it is provable from the register, the
  `ROUTES` table and the source (row `ec8be09f`). The build must not be justified by that status code, and
  the pack must not read as if it were.
- **The submitted words are write-only today.** No route serves the content of an evaluation:
  `server/index.js` calls the module in exactly three places (`completionsFor`, `loadSubject`,
  `recordEvaluation`) and the timeline's `completion` object does not carry `content`. So the missing read is
  **not** introduced by the correction — it already exists for P3-2's own record, and one read serves both.
  §4e is what this decision does about that, and it is deliberately the smallest thing.

---

## 3. The two shapes this decision rejects

**A1 — a superseding submission in the evaluation table** (a new row that names the row it replaces, with
both kept, the newest counting as the submission). Rejected, for three measured reasons:

- `UNIQUE (employee_id, milestone_index)` is what makes "one milestone, one evaluation" true, and SQLite
  cannot relax it without rebuilding the table; the three properties that table's own comment relies on
  (attribution, one row per milestone, the 409) would all have to be re-derived.
- It would move `submitted_at` — i.e. a correction would silently change **when** the milestone read
  `completed`, and with it whether it was on time. The completion timestamp is the fact the escalation chain
  is built on, and it is not a thing a later edit may move.
- Two readers (`completionsFor`, the escalation's existence check) would have to choose among revisions on
  every read, adding a "which revision counts" question to both, to buy nothing that a second table does not
  buy.

**C — state the rule that corrections are out of product scope and are handled outside the product.**
Rejected as the *standing* shape, and this is not a matter of taste: the only out-of-band path is a direct
database write, which writes **no audit row and names no actor**, and decision 22 plus this team's own rule
("a defect fixed silently is indistinguishable from one never found") are exactly what an unlogged edit
violates. It is honest only as a *deferral*, and §7's sequencing is why the deferral is not taken either:
P3-4 is the next slice and it reads these rows.

**Rejected without needing a measurement: the status-flag shape** (the evaluation row gains
`corrected`/`corrected_by`/`corrected_reason` and only the latest correction is kept). It renames the
problem: the previous correction is destroyed, the original content column is updated if the corrected
words live there, and the row is no longer the immutable thing its own schema comment says it is.

---

## 4. The build

### (a) Schema — one new table, additive, measured safe

```sql
-- Layer 3 / P3-2 follow-up (row `0484e79e`) — the correction to a SUBMITTED evaluation. The submission
-- is never rewritten: this row names it, says what the record now says and WHY, and names who changed it.
-- `reason` is NOT NULL on purpose: a correction without a reason is an edit with no author-visible cause.
-- No UNIQUE key: more than one correction is allowed and the newest wins (ordered by `corrected_at`),
-- because a correction is itself an act and destroying one to make room for another would repeat the
-- defect this table exists to close.
CREATE TABLE IF NOT EXISTS probation_evaluation_corrections (
  id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  milestone_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  reason TEXT NOT NULL,
  corrected_by TEXT NOT NULL,
  corrected_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_probation_evaluation_corrections_evaluation
  ON probation_evaluation_corrections (evaluation_id);
CREATE INDEX IF NOT EXISTS idx_probation_evaluation_corrections_employee
  ON probation_evaluation_corrections (employee_id);
```

`employee_id` and `milestone_index` are copied in for the reason P3-2's table copies `milestone_due_date`:
the readers that need this row most (a roster-wide read, an escalation join) must not have to resolve
through another table, and a copied value cannot drift out of the row that was written. **No migration code
is owed**: `CREATE TABLE IF NOT EXISTS` is what carries a new table into a database that predates it, and
`server/column-migration.test.js` holds that property — `COLUMN_MIGRATIONS` is for adding a column to an
existing table, which this is not.

### (b) Module — `server/probation-evaluations.js`

- `correctEvaluation(subject, correction, context)` — `correction: { evaluation_id, content, reason }`,
  `context: { actor }`. Refusals are thrown as the module's own typed error, so a second caller cannot
  write an unattributable or unreasoned correction. Returns `{ correction, evaluation, effective }`.
- `correctionsFor(employeeId)` — every correction for one hire, oldest first.
- `effectiveEvaluation(evaluationId)` — the original row plus the newest correction applied, or the original
  alone. **This is the only function a reader may use to show an assessment**; P3-4 reads through it, and a
  reader that queries `probation_evaluations` directly will show a corrected record as the original.
- `completionsFor(employeeIds, { asOf })` — one extra query over the ids, merged into the `completion`
  object: `correction_count`, `last_corrected_by`, `last_corrected_at`. **No `content`** — see (e).
- `recordEvaluation`'s 409 gains `evaluation_id` and `milestone_index` in its payload, and its text points at
  the correction (`… A correction is recorded against that evaluation instead of a second submission.`).
  Today the refusal names who and when and **not** which row, so a client that hit the 409 cannot act on it
  without re-reading the timeline (measured, §2).

### (c) The route

```
POST /api/employees/:id/probation-evaluations/:evaluation_id/corrections
body: { content, reason }        →  201 { correction, evaluation, effective }
```

Transport only: the actor gate, the row scope, the typed refusal. `milestone_index` is **not** accepted in
the body — the row being corrected already carries it, and a second source could disagree with it.

| Condition | Answer | Note |
|---|---|---|
| no named actor | **400** `a named actor is required to correct a probation evaluation` | before any lookup (decision 22) |
| `content` empty | **400** `a correction must carry the manager's corrected words: content cannot be empty` | |
| `reason` empty | **400** `a correction must say why the recorded evaluation is being changed: reason cannot be empty` | new, and the point |
| unknown employee | **404** `Employee not found` | `loadSubject`, unchanged |
| no such evaluation **for that employee** | **404** `No submitted evaluation with that id for this employee` | one body for both causes: another hire's row id must not be a probe |
| the caller is the subject, or outside the row scope | **403**, no body | the gate's own shape, same as the submit route |
| the window has ended, or the milestone escalated, or the employee is terminated | **allowed** | deliberately: these are the cases this path exists for |
| more than one correction | **allowed**, appended | `correction_count` is what makes a thrash legible |

### (d) Audit

One row per correction: `performed_by` = the actor, `entity_type` = `'probation_evaluation_corrections'`,
`entity_id` = the correction's id, `action` = `'CREATE'`, `new_values` = the ids, the milestone, the actor,
`corrected_at` and the **reason** — and the corrected text stays in the correction row, exactly as the
submission's text stays in the evaluation row.

### (e) Reads — the smallest honest thing, and the one policy question it does not answer

- **The timeline's `completion` object gains metadata only** (`correction_count`, `last_corrected_by`,
  `last_corrected_at`). Its audience at this revision is HR_ADMIN, MANAGER (scoped) and FINANCE — **not the
  hire** (the timeline route rides `employees:read` and an `employee` holds no cell on it). A correction
  therefore becomes **visible as a correction** on the screen that already exists, without publishing a
  manager's words to a new reader.
- **The corrected text — and the original text — stay unread until the probation screen's own read lands**
  with the P3-4 slice, because *content* would go to FINANCE as well as to HR and the hire's manager, and
  that is a cell decision, not an engineer's. This is §8 item 13 below, and it is the price of the decision
  rather than a hidden assumption: the write path is complete and the record is auditable; the reading
  surface arrives with the screen that needs it. **The same is already true of P3-2's own submission text**,
  so this decision adds no new gap — it doubles an existing one, and names it.

### (f) Served text that changes

| Where | Today | After |
|---|---|---|
| the 409 message | `milestone 1 already has a submitted evaluation — recorded by scratch-hr at 2026-10-26T15:21:58.870Z` | `… recorded by scratch-hr at 2026-10-26T15:21:58.870Z. A correction is recorded against that evaluation instead of a second submission.` |
| the 409 payload | `error`, `recorded_by`, `recorded_at` | + `evaluation_id`, `milestone_index` |
| `docs/access-model.md` §8 item 12's neighbour | — | **new item 13** (the cell question, below) |

`probation-timeline.js`'s `COMPLETION_NOTE` ("A milestone reads `completed` only from a submitted
evaluation…") **stays true and is not changed**: a correction is not a submission and does not change
completion.

---

## 5. What must NOT change

1. The submission stays the only thing that makes a milestone read `completed`.
2. The 409 stays a 409 — a second submission is still refused, and the first row is still untouched. The
   correction is a different route, not a relaxation of this one.
3. `submitted_by` / `submitted_at` / `content` on the evaluation row remain write-once.
4. No unique key on corrections; no update and no delete route anywhere in this chain.
5. `probation_escalations` is not touched by a correction, and `resolved` stays a **derived read**
   (`Boolean(completed_at)`) — a correction does not rewrite what fired.
6. No new delivery channel: the correction is an in-product record, and nothing about it is proof that a
   message reached a person.

---

## 6. Consequences for the slices that read these rows

- **P3-3 (live).** An escalation for a milestone that was later corrected still reads `resolved: true`, and
  the correction is invisible to it unless the escalation read is extended. **Recommended, not required:**
  carry `correction_count` on the escalation's joined evaluation shape, so HR does not read "resolved" as
  "the evaluation still stands as submitted". A separate one-line change, in that module.
- **P3-4 (next).** Its decision record must read the assessment through `effectiveEvaluation`, and must
  publish `correction_count` beside it — otherwise the decision cites words the manager has since corrected.
  P3-4's own decision record will face the same question this row answered, and **this document is the
  convention it should adopt** (append a row that names the record, with a reason, an actor and a timestamp;
  never rewrite the record) — as its own table and its own route, not as a shared generic table.

---

## 7. The build's own tests (a builder should be able to write these cold)

1. A correction lands: 201, a named actor, a timestamp, **one** audit row, the original row byte-identical.
2. Empty `content` → 400, empty `reason` → 400 — both with **no row and no audit line**.
3. An unnamed token → 400 **before any lookup** (an unknown employee does not become a 404).
4. An `evaluation_id` that does not exist, and one that belongs to **another** hire, are the **same 404**.
5. The subject is refused 403 with no body; a manager outside the line is refused 403; a manager inside it
   and HR_ADMIN both succeed.
6. A **second** correction is accepted, and the effective content is the newest — with `correction_count`
   telling them apart.
7. **The pair that makes the shape mean something:** the original row is untouched (`content`,
   `submitted_by`, `submitted_at`) **and** the 409's payload now carries the `evaluation_id` that lets a
   client act — a control run that asserts the old payload's three keys only would pass on a tree that never
   gained the fourth.
8. A correction for a hire whose window has **ended** succeeds (the 400 that the submit route answers is a
   control here: same hire, the submit route, same moment).
9. A correction for a milestone that has **already escalated** succeeds, and the escalation row is unchanged
   in id, `detected_at` and `fired_by`.
10. A reading pinned with `?as_of` **before** a correction shows the original text and `correction_count: 0`.
11. `completionsFor` is still **one query for the roster plus one** — a per-hire query would turn one screen
    into N round trips (the property P3-2 wrote down).

---

## 8. What else moves with the build

- `server/access.js`: one `ROUTES` entry — `['POST', '/employees/:id/probation-evaluations/:evaluation_id/corrections', 'onboarding:write']` — with the row scope narrow, as the submit route's comment already sets out.
- **Route count 30 → 31**, which `docs/access-model.md` states and `server/access-model-instrument.test.js`
  checks; the document's route table gains a row and its citations are re-grounded (P3-3's own re-ground
  moved 15 citations; budget the same).
- `server/reachability-register.js`: a second CALLERLESS entry, with the same reason the submit route's
  entry gives (the surface arrives with the probation screen; exercised end to end by the suite).
- `docs/access-model.md` §8: **new item 13** — *the `probation:correct` cell, and who may read a manager's
  assessment of a hire.* Today the write rides `onboarding:write` and the text is unread; a read cell would
  decide whether FINANCE, and whether the hire themselves, may read it. **Candidate for decision 27's
  counsel set, on the same reasoning as items 11 and 12 — not taken here, because adding a cell is the
  owner's call.**
- §8 item 1 (retention per table): name the new table, as every other table is named.
- `server/schema.sql`'s comment above `probation_evaluations` currently says *"A correction needs a decision
  (see server/probation-evaluations.js), not a second convention invented here."* — **that sentence is
  discharged by this document and must be replaced by a pointer to it**, or the next reader will think the
  question is still open.
- The module header's bullet ("How a CORRECTION should be recorded is a product decision this module does
  not take") likewise becomes a reference to the decision.
- A `server/` delta owes a **movement** (the worked rule: a delta in `server/`, `client/` or `scripts/` owes
  one unless no served path loads it, shown) — and `check-all` runs the instrument **from the deployed
  tree**, so the route count and the citation moves are what the movement publishes.

---

## 9. What this document does not decide

1. **Whether a hire may read the manager's assessment of them, and whether FINANCE may** (§8 item 13).
2. **Retention for the correction row** — counsel's §8 item 1 covers every table, and this adds one.
3. **The probation screen's shape** — where a correction is offered, and how a corrected record is rendered
   (`correction_count` is the payload; the rendering is P3-4/design work).
4. **Whether P3-4's decision record adopts this convention** — recommended in §6, and its own decision.
5. **Withdrawing a completion.** No path in this decision can un-complete a milestone. If the team ever wants
   "this evaluation was filed in error and the milestone is not complete", that is a different decision, with
   the escalation's idempotence and the "never silently skipped" rule to answer first.

---

## 10. What was NOT measured (so no reader mistakes a prediction for a reading)

- **The route does not exist**, so nothing here is an end-to-end measurement of it: §4 is a specification,
  and its refusals are specified, not observed. What *was* observed is the surface it replaces (§2).
- The **DDL was executed** against a copy of a real database (§2, `04`), and the read rule was executed in
  SQL — but not through the module, and not under the server.
- The **client rendering** of `correction_count` is not designed here and was not measured.
- The **movement cost** of the build is a prediction (the last five movements: 23 / 22 / 26 / 23 / 22 s);
  the citation re-grounding effort is estimated from P3-3's own, not measured for this change.
- The rig's own roster is the **demo seed**, so its `manager_id`-less shape is the demo's, not a claim about
  a real client's data (defect (b) of row `3e66a47c`).
