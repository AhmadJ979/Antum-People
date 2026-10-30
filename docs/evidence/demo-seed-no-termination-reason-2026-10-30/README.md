# The demo seed cannot record a termination reason — and the test that shows it

**Owner direction, 2026-10-30, verbatim:** *"Never seed a demo termination reason — make that
impossible and show me the test."* This closes the open detail under the L4 ruling of 2026-10-29
(`termination_type` stays NULL until a named actor records a real event; a blank record computes the
EOSB **UNREDUCED** and the figure carries the basis it used).

Branch `fix/demo-seed-no-termination-reason`, commit `61d9c5f` (prerequisite: `main` = `414a007`).

## The before-state, measured (not read off the code)

`scripts/seed-demo.js` run against a throwaway database (`DEMO_SEED=true`,
`PRODUCT_DB_PATH=<mkdtemp>/demo.db`), then read with `node:sqlite`:

| | |
|---|---|
| employee rows written | **14** |
| rows carrying a `termination_type` | **0** |
| by status | `active 7 · onboarding 3 · offboarding 2 · terminated 2` |

So the seed **already wrote no termination reason** — #338 removed the last one (it had handed the
EOSB engine the hard-coded word `'resignation'` without ever writing it to the row, which shrank
`demo-emp-noura`'s figure from **19,247.36** to **6,415.79** on a reason no record held). What was
**not** true is that a reason was *impossible*: the employees INSERT enumerates its columns, so a
`termination_type` added to a persona would be **dropped in silence** (the trap that once made
`probation_end_date` take effect nowhere), and the one expression that does reach the database was a
template literal any edit could point at a reason.

The demo still needs its terminations: **2 terminated** (`demo-emp-yusuf` AE, `demo-emp-sultan` SA)
and **2 offboarding** (`demo-emp-noura` AE, `demo-emp-sarah` SA), for the offboarding and
replacement-cost surfaces. All four carry no reason, so the screens render the honest line
*"Unreduced — no termination reason recorded"*.

## What was closed, and how

1. **The data.** `scripts/seed-termination-guard.js#assertRosterCarriesNoTerminationReason` walks the
   whole roster (`personas` + `historicalLeavers`) **before any write** — before `--force-clear`
   deletes, before the first INSERT — and throws if any row names `termination_type` /
   `termination_reason` / `terminationType` / `terminationReason` with a non-blank value. The
   seeder's own `catch` exits 1, so a refused seed cannot be mistaken for a run, and it **names the
   row, the field and the value**.
2. **The write.** The employees INSERT now names `termination_type` **explicitly** and binds it to
   `terminationTypeSqlValue(SEEDED_TERMINATION_TYPE)`, which throws on anything but blank. The same
   constant is passed to `eosb.calculateEOSB` as the reason, so **the figure and the record come from
   one value** and cannot disagree — the #338 defect cannot be re-created by editing one line.
3. **Not policed, deliberately:** `PUT /api/employees/:id` may record a real reason (gated on
   `employees:write`, HR_ADMIN, named actor — `server/access.test.js`), and
   `exit_interviews.departure_reason` is a **different instrument** on a different table with its own
   route and gate; it reduces no benefit. The four seeded exit-interview reasons are still there, and
   the test prints them so a green run cannot be read as "the demo holds no reason anywhere".

## The test

`server/demo-seed-termination-reason.test.js` — 7 tests, `cd server && node --test
demo-seed-termination-reason.test.js`.

It judges **the seeded result**, not the seed source: it runs the real seeder against a throwaway
database (pinned `PRODUCT_DB_PATH` above the first require) and reads the database back. It prints
the number of employee rows it examined and requires it to be non-zero and to include a terminated
row, so a scan that examined nothing cannot pass. It then holds:

1. the seed completed and wrote a roster;
2. **zero** rows carry a termination reason (each row printed with its status and column value);
3. the demo still has its leavers — 2 terminated, 2 offboarding — all blank;
4. the leavers' `eosb_accrued` **equals** the engine's unreduced figure, **and** at least one leaver
   would have differed had a reason been passed (today `demo-emp-noura`: 19,247.36 vs 6,415.79) —
   so assertion 2 is not arithmetic coincidence;
5. the refusal is **exercised**: a roster naming a reason throws naming
   `demo-emp-planted.termination_type = "resignation"`, the blank states do not throw, and
   `terminationTypeSqlValue('resignation')` throws;
6. one static signal the seeded bytes cannot give: an omitted column and a NULL column leave
   identical bytes, so the source is asserted to **name** `termination_type` in the INSERT and to
   bind it to the guard's constant;
7. printed disclosure of the exit-interview reasons (see above) and that none of them reached
   `employees.termination_type`.

## The proof it is load-bearing — three plants, on the real tree

Each plant was applied to the working tree, the test run, the output captured, and the tree reverted
and verified clean before the next one (`git status --porcelain` empty). Raw output beside this file.

| plant | what it plants | result |
|---|---|---|
| `clean.txt` | nothing — the committed tree | **7/7 pass**, `examined 14 employee rows … 0 carry a termination reason` |
| `plant-1.txt` | `termination_type: 'resignation'` on `demo-emp-yusuf` (the silently-dropped field) | **RED** — the seed refuses and names `demo-emp-yusuf.termination_type = "resignation"` |
| `plant-2.txt` | the seed's single constant flipped to `'resignation'` (the writer's refusal) | **RED** — `Refusing to write termination_type = "resignation" from the demo seed` |
| `plant-3.txt` | the INSERT bound to the literal `'resignation'`, every guard bypassed | **RED** — 4 of 7 fail, naming all 14 rows and their value: the **result-level** assertion bites on its own |

Plant 3 is the one that matters for a later reader: with every guard removed, the test still reddens
on the bytes the seeder wrote.

## The blind spot (what a green run does NOT prove)

A green run proves **the demo seeder writes no termination reason and refuses one**, judged on the
rows a scratch seed produced. It cannot prove anything about the database the product is *serving*: a
reason recorded through the gated API by a person walking the demo, or carried in by a restored DB
snapshot, is outside this file's reach — it holds the seed, not the deployment — and it does not
judge the exit-interview instrument (printed above, by design).

## Open, for the owner (not decided here)

**A re-seed erases a recorded reason.** The employees write is `INSERT OR REPLACE` and the column is
written blank, so re-seeding the demo *clears* whatever reason someone recorded on a demo row. That is
the **opposite** defect to the one this change fixes (it destroys a decision an actor made, rather
than inventing one), and it is not silently forgiven: the seeder's own note says so, and the
`--force-clear` path also deletes the demo's escalation/evaluation/audit rows. Telling a demo
re-seed from a real deployment re-seed is possible only by intent, not by mechanism — `deploy-main.sh`
runs `seed-demo.js --force-clear` against the product database, the same script a demo rehearsal runs,
with the same `PRODUCT_DB_PATH`. Any fix costs a decision (preserve `termination_type` across the
REPLACE, or refuse to re-seed a row whose reason was recorded by an actor, or mark demo-recorded
reasons as sample data) and a change at the write path in this same file. Recorded here; not built.

## How to reproduce

```bash
cd server && node --test demo-seed-termination-reason.test.js      # 7/7, prints the counts
# the plants are one-line edits to scripts/seed-demo.js / scripts/seed-termination-guard.js:
#   plant 1  add `termination_type: 'resignation',` after `id: 'demo-emp-yusuf',`
#   plant 2  const SEEDED_TERMINATION_TYPE = 'resignation';   (scripts/seed-termination-guard.js)
#   plant 3  replace the INSERT's `${seedTermination.terminationTypeSqlValue(...)}` with 'resignation'
```

A `server/` + `scripts/` delta **owes a movement** (the seeder is run by `deploy-main.sh`); the
movement is the lead's to run and was **not** run by this change. No `client/` file changed, so no
build and no `dist` restoration is owed.
