# Decision 17 — the retired consent columns, enumerated and recommended (2026-10-15)

**For:** owner decision 17 — *retire the instrument, keep the subject*. The `consent_granted` / `consent_date`
columns were deliberately **not** dropped in the 2026-10-13 pass; the ruling was to **enumerate first, then
recommend**. This is that enumeration and that recommendation. **It drops nothing.**

**Author:** Compliance Expert · **Date:** 2026-10-15.
**Measured at:** `origin/main` = **`f05ebc4`** — every count and every `file:line` in §§1–8 is that tree.
**Landed on:** `main` = **`662e881`**. The three documents §8.3 named as stale were corrected in the same PR
(§9), line-for-line, so their citations did not move.
**Citations re-checked at the landing tree:** `git diff --numstat f05ebc4..662e881` shows only
`scripts/deploy-main.sh` and `scripts/restore-product.sh` under `server/`, `scripts/` or `client/`, and
**none of the 17 files this record cites changed** (`server/index.js`, `server/schema.sql`, `server/db.js`,
`server/reachability-register.js`, `server/reachability.test.js`, `server/column-migration.test.js`,
`scripts/reachability-report.js`, `scripts/seed-demo.js`, `client/src/App.tsx`, the three corrected documents,
`un-operable-controls-inventory.md`, `design-concepts/LAYER2-PREBOARDING-UI.md`, `compliance-audit-enhancement.md`,
and the two evidence records).
**Doc-only, by measurement, not by assertion:** `git diff --name-only` over this PR's commits →
`0` paths under `client/` or `server/`. **No build is owed, and none is claimed.**
**Reproducing it:** every figure is derived by a command quoted beside it (§6, §8.1). The generator that produced
them is host-side (`/home/team/shared/decision-17-columns-enumeration-gen.py`, not tracked in this repository);
re-running it against a newer `main` produces a **fresh dated record**, never an in-place rewrite of this one.

---

# `employees.consent_granted` / `consent_date` — the enumeration decision 17 asks for

**For:** the lead (to take to the owner) · **By:** Compliance Expert · **Date:** 2026-10-15
**Measured against:** `AhmadJ979/Antum-People` @ **`f05ebc4`** (`origin/main`, fetched today), plus a
**read-only** read of the live product DB at `/home/team/.data/antum-product.db` (`sqlite3` opened as
`file:…?mode=ro`, so no write was possible).
**Row:** task `385589e1` — decision 17 (`#182` `9ce469d` + `#186` `8e7e2c3`) is DECIDED and EXECUTED; what
the row still holds is this enumeration, per the lead's instruction of 2026-10-14: *the columns are to be
enumerated first, then recommended.*
**Status of the tree: unchanged by this document.** Nothing was edited, dropped, or deployed — this is the
measurement the recommendation rests on. Every line citation below was asserted against `f05ebc4` before
this file was written, and the counts are derived from `git grep` on the same tree.

> **Reproduce it** (from a clone, `git fetch origin` first) — §6 has the exact commands. The live-read half
> is a read-only `SELECT`; the rest is `git grep`/`git show` at `f05ebc4`.

---

## 0. What is being enumerated — two objects, not one

| object | where | state |
|---|---|---|
| `employees.consent_granted` | `server/schema.sql:22` — `INTEGER DEFAULT 0` | the retired instrument's flag; no writer, no reader, live value `0` |
| `employees.consent_date` | `server/schema.sql:23` — `TEXT` | the same instrument's date; no writer, no reader, live value `NULL` |
| `consent_records.consent_date` | `server/schema.sql:98` — `TEXT` | **a different object with the same column name**, in the table decision 17 explicitly KEPT (subject of decision **17** — 14 is the portal-identity question) |

Any count that adds these together is wrong, and this is the first place a reader goes wrong: `consent_date`
is one of the two retired employee columns **and** a live column of the kept `consent_records` table. The
enumeration below is about the two **employee** columns; §3 names every place the boundary runs.

## 1. Every occurrence, by the role the string plays

`git grep -E 'consent_granted|consent_date'` at `f05ebc4` → **131 hits in 50 files**:
**18 in 7 source files**, **16 in 6 repo documents**,
**97 in 37 historical evidence files** (dated records under `docs/evidence/**` and
`cutover-*/` — they describe the state they were written in and are not claims about today).

### 1.1 Schema (2 hits + the sibling)

| site | text | role |
|---|---|---|
| `server/schema.sql:22` | `consent_granted INTEGER DEFAULT 0,` | the column the decision left in place, on purpose |
| `server/schema.sql:23` | `consent_date TEXT,` | same |
| `server/schema.sql:98` | `consent_date TEXT,` | **not this column** — `consent_records`, the kept table |
| `server/schema.sql:39` | `gave_proper_notice INTEGER DEFAULT 1,` | **not a consent column** — the EOSB notice-period flag (§3.1) |

### 1.2 Write paths — measured **0**

The decision's test is "a retired instrument must not keep a write path". Both of the paths this row's
predecessor found are gone, and each removal stands as a dated fence where the code used to be:

| site | text | role |
|---|---|---|
| `server/index.js:196` | `// Decision 17 fence (2026-10-13, lead's ruling): this INSERT no longer names` | the create-`INSERT` no longer names the column |
| `server/index.js:256` | `// Decision 17 fence … removed from this numeric whitelist` | `PUT /api/employees/:id` no longer admits the key |
| `server/index.js:358` | `// REMOVED 2026-10-13, owner decision 17 executed:` | `POST /api/compliance/consent` stood here — the instrument's only product writer |
| `scripts/seed-demo.js:314` | `// Decision 17 (2026-10-13): this insert no longer writes …` | the one writer that actually ran, stopped |

**Reader/writer count in the product: 0 and 0.** Measured, not asserted: the shipped check run **at
`f05ebc4`**, in a detached worktree of `origin/main` so that it read the revision this document cites
rather than whichever branch happens to be checked out:

```
  [fenced] consent_granted
  [fenced] consent_date
```

**The report exits 1 at this revision, and the reason is unrelated to these two columns.** It is red because the
`CLIENT CALLS THAT NAME NO ROUTE` rule reads a *prose* mention of the retired decision-21 route as a call:

```
  GET /api/compliance/report at scripts/cutover-preflight.sh:223
```

That line (`scripts/cutover-preflight.sh:223`, added with #196) is an `echo` **describing** what the preflight verified —
the rule cannot tell a description from a request, the same role-blindness the register's own comment records. It does
not touch the columns: `RETIRED COLUMNS` is `[fenced]` for both. Measured this way because a report that can quietly
omit a category cannot stay green, and because a green check with a red reason that is not a defect is how a gate stops
meaning anything. Reported to the lead (§4.5).

`RETIRED COLUMNS` is the rule at `scripts/reachability-report.js:241` ("a retired instrument must not keep a
write path (decision 17 fence)"); `server/reachability.test.js:165` asserts the same set is empty. (The
earlier count was 2; the register records why the first count was incomplete — a line-by-line search cannot
see a column on the continuation line of a multi-line `INSERT`.)

### 1.3 Response carriage — the columns still travel, in one payload

| site | text | role |
|---|---|---|
| `server/index.js:156-157` | `SELECT * FROM employees …` | **the roster route's query** |
| `server/index.js:164` | `res.json(decrypted);` | the row is spread (`{...emp}`) into the response — so **`GET /api/employees` still returns both keys to any authenticated client** |

This is the distinction the word "reader" blurs: no code *reads the value*, but two columns **are carried**
in the roster payload. The client records the same fact at `client/src/App.tsx:23` ("The roster route still
returns the two columns (it is `SELECT *`), and no tile on this screen reads them any more").
The other `SELECT *` reads do **not** carry them outward, measured: `server/index.js:435` feeds the analytics
dashboard, whose response is computed metrics and whose `onboardingPipeline` (`:529`) maps an explicit field
subset; `:243` and `:368` are internal reads.

### 1.4 Client — a type declaration and nothing else

| site | text | role |
|---|---|---|
| `client/src/App.tsx:25-26` | `consent_granted: number;` / `consent_date: string \| null;` | the `Employee` interface still admits both keys; **zero consumers** |
| `client/src/App.tsx:1560` | `Notice-based — recorded per pre-boarding case` | what replaced the retired tile |
| `client/src/App.tsx:1563` | `… No consent flag is held on the employee record.` | the tile's claim — see §4.3 for the one word worth watching |

### 1.5 Checks that hold the retirement in place

| site | role |
|---|---|
| `scripts/reachability-report.js:241` | the shipped check enumerating the write paths of both columns |
| `server/reachability.test.js:165` | asserts the write-path set is **empty** |
| `server/reachability.test.js:174` | asserts the schema **still carries** `consent_granted INTEGER DEFAULT 0` — **this assertion fails on a drop** |
| `server/reachability-register.js:139,172,181` | the `RETIRED` entries and the source anchors that must stay absent |

Measured at `f05ebc4`: the report prints `[fenced]` for both columns, and its own
four-category count reads `{"CALLERLESS":3,"UNOPENABLE_CONTROLS":1,"DISPLAYED_VALUES":0,"DEAD_END_ITEMS":3}` — the register's counts as the plan states them, re-derived here
rather than quoted.

### 1.6 Repo documents — accurate, stale, pseudocode, dated

| site | what it says | verdict |
|---|---|---|
| `un-operable-controls-inventory.md:318,322` | "not dropped: readers in the product **0** … `columnWritePaths('consent_granted')`: **2 → 0**" | **accurate** — and the only doc that states the residue deliberately |
| `design-concepts/LAYER2-PREBOARDING-UI.md:608` | "setting `employees.consent_granted` — was removed on 2026-10-13 (owner decision 17)" | **accurate** |
| `tech-stack.md:44-45` | `consent_granted` — "PDPL/GDPR explicit privacy consent flag (1 = True, 0 = False)"; `consent_date` — "Timestamp when privacy consent was explicitly granted" | **STALE** — documents a live consent capability that decision 17 retired |
| `demo-walkthrough-script.md:170` | step 3: "Point at the **Compliance Center**: the **PDPL consent** line reads **'✓ GRANTED ON 2026-09-23'**" | **STALE** — instructs a presenter to point at a state the product no longer produces |
| `demo-walkthrough-script.md:165,175` | "captures consent as data"; "**Consent captured with a date**, on the employee record" | **STALE** — the same claim in the goal and in "what the customer sees" |
| `demo-walkthrough-script.md:364` | `| Consent capture | POST /api/compliance/consent → consent_records |` | **STALE** — tabulates a **removed** route (it answers 404) as the live consent mechanism |
| `pdpl-portal-boundary-memo.md:4,30` | dated **2026-10-09**; "A second, older consent store exists **and is still writable**" | **dated record, partly expired** — the route that could write it is gone; the seeder still writes |
| `compliance-audit-enhancement.md:5,747,749` | a **2026-06-23 proposal** whose §"erasure pseudocode" names `consent_granted = 0`, `consent_date = NULL`, `gave_proper_notice = NULL` | **pseudocode, not code** — measured: no `eraseSql`/`ERASED` exists anywhere under `server/`, `scripts/` or `client/`. It is the one place the columns reappear *inside a would-be implementation*, i.e. the re-entry point if a DSR/erasure path is ever built |

## 2. The live data — the residue is **gone**

Read-only, `/home/team/.data/antum-product.db` (mtime **2026-10-14 16:16:34Z** — the cutover's re-seed):

| measure | value |
|---|---|
| `employees` rows | **13** |
| rows with `consent_granted = 1` | **0** |
| rows with `consent_date` non-null | **0** |

**13/13 now read `consent_granted = 0, consent_date = NULL`** — the column holds the truth: this
product has no per-employee consent record to produce. The row's own 2026-10-12 measurement was
**13/13 reading `✓ GRANTED ON 2026-09-23`**; the seeder change (`scripts/seed-demo.js:314`) plus the
cutover's re-seed is what removed it. **This is the part of decision 17 that had to be re-measured after the
cutover, and it is done.**

## 3. The boundary — named, so this enumeration is not mistaken for a complete one

Every enumeration is smaller than its class. These are the adjacent objects I checked and deliberately did
**not** fold in:

1. **`employees.gave_proper_notice`** (`server/schema.sql:39`, `INTEGER DEFAULT 1`) — an **EOSB** notice-period
   flag, not consent (`compliance-requirements.md:270`, `eosb-engine-gaps-spec.md:26`), and `eosb-review-report.md:145`
   records that the engine **no longer reads it**. Same shape as the retired consent flag — a boolean on the
   employee record that nothing writes and nothing reads, defaulting to a value that asserts itself (`1` =
   notice served) — but a **different decision's** subject. It is named here so nobody "tidies" it as part of
   decision 17.
2. **`consent_records`** — the kept table (13 rows). Its shape is the right one and **decision 17** owns it. *(Numbering: an earlier draft of this record said 14. `consent_records` is 17's — 17 is the decision that retired the instrument and kept the subject. The numbering audit the lead reported on 2026-10-15 found the same collision at two other sites; this was a third.)*
   **But the seeder still fabricates into it**: measured today, all **13** rows are
   `consent_type='PDPL_DATA_PROCESSING', status='granted'` with `lawful_basis`, `consent_version` and
   `granted_at` **all NULL** (13 of 13), carrying a literal `consent_date='2026-09-23 09:00:00'`
   against `created_at` up to **2026-10-14 16:16:33**. Nothing reads them, so nothing displays them — this is not a
   live defect and it is out of this row's scope; it is the *same class* as the fabrication decision 17
   retired, one table over, and it is the reason the inventory's phrase "purpose-scoped rows" should be read
   as *intended* purpose-scoped: they carry a type and no basis.
3. **`preboarding_notice_acknowledgements`** (8 rows) — the **live** replacement instrument: the notice
   *shown*, per document, with basis, version and named actor (decision 15(b)).
4. **`preboarding_consents`** — **0 rows**, i.e. the earlier pre-boarding store is empty; that
   retirement did not leave a residue.

## 4. Findings (what the retirement left behind)

1. **No write path, no reader, no display, and — measured today — no residue in the data.** The instrument is
   retired in behaviour.
2. **Two columns remain in the schema**, by the lead's instruction, with a test that *asserts they remain*
   (`server/reachability.test.js:174`). This is a declared residue, not an oversight — but it is the one
   place where "retired" and "still there" are both true.
3. **Three documents still describe the retired instrument as live** (`tech-stack.md:44-45`, four lines of
   `demo-walkthrough-script.md`, and — as a dated record — `pdpl-portal-boundary-memo.md:30`). Of these the
   demo script matters most: it is the artifact a presenter reads aloud to a prospect, and its step 3 tells
   them to point at a line the product no longer prints. **No customer-facing claim in it is true of
   `f05ebc4`.**
4. **The tile's own sentence is one word ahead of the schema**: "No consent flag is held on the employee
   record" is true of behaviour (nothing records one) and not yet true of the schema (two columns exist).
   If the columns are dropped, the sentence becomes literally true; if they are kept, "held" should be read
   as "recorded". Either way it is not a false statement today — flagging it because it is exactly the
   string a future reader will check against `schema.sql`.

5. **The enumeration turned up one defect on `main` that is about neither column.** The reachability report
   exits **1** at `f05ebc4` — measured, §1.5 — because `scripts/cutover-preflight.sh:223` (added with #196)
   *names* the retired decision-21 route inside an `echo` that describes what the preflight verified, and the
   check's `CLIENT CALLS THAT NAME NO ROUTE` rule reads a description as a call. Nothing was re-added and the
   retirement is intact. What is wrong is that **a green check now carries a red reason that is not a
   defect** — which is how a gate stops meaning anything. Fixed by teaching the check the role a string
   plays, not by touching the route; the finding is the lead's, and it is not mine to edit.

## 5. Recommendation

**Keep the columns; drop the descriptions. Re-open the drop only when a schema-change pass is open anyway.**
The reasons, in order of weight:

1. **The defect decision 17 was taken on is gone.** What was wrong was a *displayed* compliance state no
   production path could produce. Measured: 0 writers, 0 readers, and the live data now honest
   (13/13 at default). A drop changes nothing a user can see.
2. **A drop is not a tidy-up here; the tree says so itself.** It would have to touch, deliberately:
   `server/schema.sql:22-23`; the **test at `server/reachability.test.js:174` that asserts the column
   exists** ("dropping it is a separate decision, not a tidy-up" — its own message); the inventory's §9.2;
   `tech-stack.md`; and the client interface at `App.tsx:25-26`.
3. **On the live database a drop does not propagate by itself.** `db.js` applies `schema.sql`, whose tables are
   `CREATE TABLE IF NOT EXISTS` — so editing the DDL leaves an existing DB untouched. Removing the columns
   from the shipped DB needs an explicit migration or a re-seed, i.e. **it rides a cutover** — and Layer 1 is
   the layer that is never restarted. Paying a cutover for two columns nobody touches is the wrong trade.
4. **The cost of keeping them is documentation drift, which is cheap and bounded** — and it is the drift we
   already have. Keeping the columns costs 4 doc lines and 2 interface lines to correct; dropping them costs a
   migration, a test re-decision and a cutover.

**Concretely, what I recommend be done (one pass, no code change to Layer 1):**

- `tech-stack.md:44-45` — mark both columns **retired by decision 17 (2026-10-13)**: still in the schema,
  written by nothing, read by nothing, value `DEFAULT 0`/`NULL`. (Wording must not delete the columns from the
  doc — an absent row would read as a dropped column.)
- `demo-walkthrough-script.md` — retire the four stale spots: `:165`, `:170`, `:175`, `:364`. Step 3 should
  point at the **Compliance Center's notice-shown tile** instead (`App.tsx:1560`), which is what the product
  actually prints; the "Consent capture" table row should name the 15(b) notice-shown record, not the removed
  route.
- The **enumeration itself** (this document) is the record for the two columns; §3.2 (the seeder's
  `consent_records` rows) should go to the row that owns decision 17, as a named, measured item.
- **Re-open a drop only when a schema pass is open for another reason** — and then do it as its own decision,
  with the test's second assertion changed on purpose and said out loud, not as a tidy-up.

**If the owner prefers the drop now**, the honest price is: one migration or re-seed on the live DB, a
re-decided test assertion, four doc sites, and a Layer 1 cutover — and this document is the input to that
decision, not a substitute for it.

## 6. Reproduce every number

```bash
cd <clone> && git fetch origin && git rev-parse --short origin/main     # f05ebc4

# every occurrence, and the role split this document uses
git grep -n -I -E 'consent_granted|consent_date' origin/main -- . | wc -l
git grep -n -I -E 'consent_granted|consent_date' origin/main -- server client scripts

# the two columns as the live DB holds them (read-only; cannot write)
sqlite3 'file:/home/team/.data/antum-product.db?mode=ro' \
  "SELECT COUNT(*), COALESCE(SUM(consent_granted),0), SUM(consent_date IS NOT NULL) FROM employees;"

# the write-path check the product ships — self-contained, needs no node_modules —
# and the assertion that keeps the column in the schema.
# NOTE: the report reads the WORKING TREE, so run it at the revision you are quoting:
git worktree add --detach /tmp/wt origin/main
( cd /tmp/wt && node scripts/reachability-report.js | grep -A3 'RETIRED COLUMNS' )   # → [fenced] both columns
grep -n "columnWritePaths('consent_granted')" server/reachability.test.js
git worktree remove --force /tmp/wt
```

*The generator that produced every number above — it asserts each citation against the tree, derives the counts
from `git grep`, reads the product DB read-only, and runs the shipped report (refusing to write at all if the
report will not run) — is `/home/team/shared/decision-17-columns-enumeration-gen.py`. Re-run it against a newer
`origin/main` and the figures move with the tree instead of ageing in place.*

*Written 2026-10-15 · every citation asserted against `f05ebc4` before this file was written; the only
product-database access was read-only.*

---

## 8. Delta 2026-10-15 (lead's re-framing): every site by *what it does with the value*

The lead asked for the four verbs — **writes / displays / gates / counts** — and for the three options with
what breaks in each. Measured this session at `origin/main` = `f05ebc4` (`git log --oneline -1 origin/main`).

### 8.1 The verbs, with the command behind each

| Verb | Sites | Command | Result |
|---|---|---|---|
| **writes** | **0** | `git grep -n -E "(INSERT\|UPDATE\|SET)[^;']*(consent_granted\|consent_date)" origin/main -- server` | only match is `server/index.js:360`, a **tombstone comment** quoting the removed statement. The shipped check agrees: `[fenced] consent_granted` / `[fenced] consent_date`. |
| **reads** | **0** | `git grep -c -E 'consent_granted\|consent_date' origin/main -- server client scripts` → 7 files / 18 hits; then every other `server/*.js` listed | 24 of the 30 `server/*.js` files contain **no occurrence at all** (`auth.js`, `db.js`, `eosb.js`, `preboarding*.js`, `compliance_engine.js`, `document-store.js`, `privacy-notice.js`, all their tests…). The 6 exceptions: `index.js` (5 comments), `schema.sql` (DDL), `reachability-register.js`, `reachability.test.js` (2 assertions), `reachability-report.js` (1), and not a reader among them. |
| **gates** | **0** | `git grep -n -E '(consent_granted\|consent_date)[[:space:]]*(===\|==\|!==\|!=\|&&\|\|\|\|\?)' origin/main -- server client scripts` | `none anywhere in server/ client/ scripts/`. A gate needs a read; there is no read. |
| **displays** | **0 in code** | `git grep -n 'GRANTED ON' origin/main -- client/src` → no match; `git grep -n -E 'consent_granted\|consent_date' origin/main -- client/src` → `App.tsx:25-26` only | the two lines are a **TS interface declaration with zero consumers**; the replacing tile is notice-based (`App.tsx:1560`, claim `:1563`). |
| **counts / asserts** | 2 | `scripts/reachability-report.js` (`columnWritePaths`), `server/reachability.test.js:164-177` | the report **counts** write paths (prints `[fenced]`, i.e. zero); the test **asserts** the count is `[]` **and** that the column is still in the schema — its own message: *"the column was dropped: decision 17 keeps it (enumerated first, recommended later) — dropping it is a separate decision, not a tidy-up"*. |
| **declares** | 1 | `client/src/App.tsx:25-26` | shape only, no reader. |
| **carries** | 1 | `server/index.js:156-157` (`SELECT *`) → `:164` (`res.json`) | **not a read and not a display**: both keys still travel inside the roster payload to any authenticated client. This is the one live exposure a bare hit count hides — and it is why "nothing reads them" is true while "nothing carries them" is not. |

### 8.2 **The honest one-liner: nothing reads them any more.**

Nothing in the product, the seeder, the tests or the client reads either column; nothing writes them;
nothing gates on them; nothing displays them. Live rows are at the default (`13/13` read
`consent_granted = 0, consent_date = NULL`, §3). The two commands that carry the whole claim are the
`reads` row and the `gates` row above, and the shipped check's two `[fenced]` lines.

**The one surviving "display" is a document, not code — and it is decision 17's original defect in prose.**
`demo-walkthrough-script.md` still instructs a presenter to point at a line reading
`✓ GRANTED ON 2026-09-23` (referenced at `:170`). The product no longer prints that line anywhere
(the register records the tile **retired**). A runbook that has a human *state a displayed compliance
value the software cannot produce* is the same class of defect the register exists to prevent — it has
only moved from the screen into the script. **This is the one item in this delta I recommend acting on.**

### 8.3 The three options, and what breaks in each

**(a) keep — recommended.** Breaks nothing. Cost is the bounded doc drift already enumerated in §1.6
(`tech-stack.md:44-45`, four lines of the demo script, `pdpl-portal-boundary-memo.md:30` as a dated
record) plus the §8.2 prose display. Nothing a user can see changes; the register's residue stays
deliberate and asserted.

**(b) keep-but-stop-writing — already the state, not an option.** Measured: **0 write paths** (both
fences + the seeder stop), live data honest at default. There is no writer left to stop. If the lead
wants this option, the answer is "executed, earlier".

**(c) drop — mechanically blocked in today's framework, and it re-owes a movement.** Measured this
session, and this is the correction to my earlier note:
- The boot-time migration mechanism is **add-only**: `server/db.js:56` `COLUMN_MIGRATIONS`,
  `:75 applyColumnMigrations` → `ALTER TABLE … ADD COLUMN`, idempotent. `db.js:48-51` says it is
  *"deliberately NOT a general migration framework: no version numbers, no down-migrations"*, and that
  anything needing a value computed per row *"belongs in its own change"*. A **drop cannot be expressed**
  in it.
- A schema-only drop therefore **reddens a test**: `server/column-migration.test.js:119-124` asserts,
  for **every** table, `deepStrictEqual([...columnsOf(migrated)] .sort(), [...columnsOf(fresh)].sort())`
  — two-directional set equality, so a fresh DB without the columns and a migrated DB with them **fail**.
- Plus `server/reachability.test.js:174`'s deliberate assertion ("dropping it is a separate decision")
  would have to be re-decided rather than edited, plus `client/src/App.tsx:25-26`, plus the §1.6 doc sites.
- And it is a `server/` change → per the lead's own constraint it **re-owes a deployment movement** on the
  layer that is never restarted.

So the drop is a *design* change (a new down-migration kind + two re-decided assertions), not a tidy-up —
worth doing only when a schema pass is open for another reason. **Recommendation unchanged: keep; drop the
stale descriptions; re-open the drop only alongside a schema change.**

*Note on reuse of the generator (§6): re-running it against a newer `origin/main` produces a **fresh dated
record** — it must not be used to rewrite this record's numbers in place (WORKFLOW quality standard:
a dated record is evidence, not a live claim).*


---

## 9. The prose pass this PR carried (§8.3's "one item I recommend acting on")

Three documents still described the retired instrument as live. Each is fixed at its own site, and each is
labelled below as a **correction** (the document makes a live claim, so the claim is corrected) or an
**annotation** (the document is a dated record, so its body stands and a note says what has since stopped
being true) — the distinction `design-concepts/LAYER2-P2-2-IMPLEMENTATION-NOTES.md:10` already sets for this repo.

| Site | Kind | What it said | What it says now |
|---|---|---|---|
| `demo-walkthrough-script.md:165` | **correction** | "captures consent as data" | "records the privacy notice as **shown** — per document, in-flow" |
| `demo-walkthrough-script.md:170` | **correction** | step 3: point at a line reading `✓ GRANTED ON 2026-09-23` | step 3 points at the tile that **states the instrument** ("Notice-based — recorded per pre-boarding case") and says plainly that the old line was retired and **there is no date to read** |
| `demo-walkthrough-script.md:175` | **correction** | "Consent captured with a date, on the employee record" | "the notice recorded as shown — per document, with its basis, its version and the person who showed it" |
| `demo-walkthrough-script.md:179` | **correction** (adjacent, same claim) | "notice consent is in-flow and dated" | "the notice is shown in-flow and recorded per document — with its version and the name of whoever showed it" |
| `demo-walkthrough-script.md:364` | **correction** | `| Consent capture | POST /api/compliance/consent → consent_records |` | the row now reads **retired** (the route answers 404) and points at the live instrument, the notice-shown acknowledgement |
| `tech-stack.md:44-45` | **correction** | both columns described as live (`consent_date`: "Timestamp when privacy consent was explicitly granted") | both marked **retired instrument, column retained** — no writer, no reader, no display |
| `pdpl-portal-boundary-memo.md:30` | **annotation** | "A second, older consent store exists **and is still writable** … written by `POST /api/compliance/consent`" | the quotation **stands** as the 2026-10-09 reading; a note immediately below it records that the route is **removed**, the seeder no longer writes the table, and the column defaults are all that remain |

**One site deliberately left alone:** `demo-walkthrough-script.md:377` (a provenance row reading "consent date
2026-09-23", dated **2026-10-08**) is a dated record of what that pass read. It is history, not a live claim.

**One finding this pass did not fix, because it is a `server/` change:** the onboarding checklist still carries
the step **"Privacy Notice Consent — Capture explicit consent for UAE PDPL compliance"**
(`server/compliance_engine.js:17`, and the KSA twin at `:38`). The step's *description* instructs a capture the
product no longer performs. Changing it moves the served tree and re-owes a deployment movement; it is reported
here for the lead's ruling, not changed.
