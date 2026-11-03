# The probation write path — 2026-11-02

**What this closes:** nothing in the product could put a hire on probation. `probation_end_date` is the
one column the whole probation surface is derived from (`server/probation-timeline.js`: a NULL means the
hire is not on probation, so no timeline exists at all), and the only writer of that column in the tree
was `scripts/seed-demo.js`. The panel rendered — it renders two seeded hires on the live demo — so a
buyer's first question, *"where do I set this?"*, had no answer. A feature only the demo seed can
populate is a mock, however good the screen looks.

## The defect state, measured (not recalled)

Read-only, against the live product's database (`/home/team/.data/antum-product.db`), no credential used:

```
{"employees":15,"with_window":3,"escalations":3,"evaluations":0}
```

Every probation row is seeded. In the tree at `fff847b`, `probation_end_date` was named by
`server/schema.sql`, by the reads in `server/index.js` and `server/probation-timeline.js`, and by
`scripts/seed-demo.js` — and by no route that writes.

## What changed

| Where | Change |
| --- | --- |
| `server/probation-timeline.js` | `resolveWindow({start_date, window_days, end_date})` and `endDateForWindow` — the ONE place a probation end date is computed, in UTC, through the same `addDays`/`wholeDays` pair `probationWindow` reads it back with. `WINDOW_CHOICES = [90, 180]` is what the interface offers; the resolver accepts any positive whole number of days, because a contract that says 60 is a real contract and refusing it would be inventing a rule with no source. |
| `server/index.js` `POST /api/employees` | `probation_end_date` added to the INSERT **column list** and given its value **in the matching position** (the list is positional — an entry in one and not the other shifts every value after it). The audit row records the STORED end date, not only the length asked for. |
| `server/index.js` `PUT /api/employees/:id` | `probation_end_date` and `probation_window_days` both admitted, so an existing hire moves ONTO probation or OFF it (a clear stores NULL, never `''`). A PUT that moves `start_date` past a stored end date is refused rather than silently deleting the timeline. |
| `client/src/App.tsx` | one select in the New Strategic Hire modal: **None / 90 days / 180 days**. No free-text date. |
| `server/reachability-register.js` | a `DISPLAYED_VALUES` entry for the probation timeline, marked `writer: 'required'`. |
| `server/reachability.test.js` | the guard can no longer pass vacuously: an **empty register FAILS**, an entry marked `required` **reddens if the write path disappears**, a writer must be a SQL statement (not any `column =` line), and the panel anchor is re-checked. |
| `scripts/verify-access-model.py` | two CLAIMS hints re-grounded (`527→584`, `550→748`) — the probation blocks moved the symbols, not the occurrences. |
| `server/probation-write.test.js` | new suite: 12 tests, a real server on a scratch port and a throwaway database. |

## The milestone offsets — measured, and the 180-day case the panel's subtitle gets wrong

`milestoneOffsets(length)` is the thirds of the window plus the window's own end:

* **90 days → `[30, 60, 90]`** — which is what the panel's subtitle ("30/60/90 derived from the start date") describes.
* **180 days → `[60, 120, 180]`** — for which that same subtitle is **false**. It is a served string asserting a
  fixed rule over a derived variable. **Not fixed here**: the panel and its subtitle are the next round's
  work, deliberately out of this PR's scope.

The suite asserts the panel payload's milestone days equal `probationTimeline.milestoneOffsets(window)` for
both windows — the module's own arithmetic, not a second copy written in the test — and that each due date
is `start_date + offset` in UTC.

## Redden controls (each planted in a throwaway worktree at the branch tip, then reverted)

Recorded raw in `controls.txt` beside this file. Every one of these runs `node --test` from the worktree's
`server/`.

| Control | Planted | Result |
| --- | --- | --- |
| 0 | nothing (the tree the PR ships) | `probation-write` 12/12 pass · `reachability` 19/19 pass |
| A | drop the probation VALUE from the INSERT, keep the column named | **exit 1**, 11 fail: `position 25 holds undefined, which is not this column's value: the lists have shifted` |
| B | keep both lists the same length, put the WRONG value at probation's position | **exit 1**, 8 fail: `position 25 holds "${db.escapeString(data.start_date)}"` |
| C | remove the whole product write path (INSERT column + PUT update line) | **exit 1**: `a displayed value marked 'writer: required' has NO writer in a route a user can reach` |
| D | empty the `DISPLAYED_VALUES` register | **exit 1**: `the displayed-value register is EMPTY, so this guard is measuring nothing` |
| E | rename the panel heading in `client/src/App.tsx` | **exit 1**: `expected exactly one line containing "<h3 …>Probation timelines</h3>", found 0` |

Control C is the one worth reading twice. Its **first** version passed: with both write paths removed the
guard stayed green on `auditNewValues.probation_end_date = probationEnd` — the audit payload's own field,
which writes to no table — because `columnWriters` matches `column =` anywhere. That is why the writer
measurement now requires a SQL-shaped line, and why control C is recorded here as having been run three
times: the first two runs are the reason the third means something.

## Gates

See the PR body for the exact counts pasted from the run of this tree: `cd server && node --test`,
`cd client && npm run build` (a client file changed, so the build is required and `dist` is emitted), and
`python3 scripts/check-all.py`.

## Not done here, deliberately

* **No deployment.** This branch is not on `main` and nothing has moved on the host. A client file changed,
  so the next movement must include a client build; `deploy-main.sh --restart-only` does not build.
* **The panel and its subtitle are untouched**, as is the escalation UI. The subtitle's 180-day falsehood is
  named above for the next round.
* **The demo seed is untouched** — the point of the change is a write path a user has.

## Gates, measured on this tree (`4e4c70e7fa7752ee0f76e1a894854b11b9cd3e74`)

```
$ cd server && node --test
exit=0
# tests 439
# suites 71
# pass 439
# fail 0
# cancelled 0
# skipped 0
# todo 0


$ cd client && npm run build   # tsc -b && vite build
exit=0
dist/index.html                   0.47 kB │ gzip:  0.30 kB
dist/assets/index-CdmIUBt1.css   37.75 kB │ gzip:  7.36 kB
dist/assets/index-jEqRoaAt.js   291.08 kB │ gzip: 81.22 kB
[32m✓ built in 303ms[39m


$ python3 scripts/check-all.py
exit=1
  [skip] install-host-tools   home: operator CLI, off-host - off-host instrument proof, run with --full: bash scripts/install-host-tools-test.sh
  [skip] keep-alive-deploypath home: operator CLI, off-host - off-host instrument proof, run with --full: bash scripts/keep-alive-deploypath-test.sh
  [skip] observe-serve-pair   home: operator CLI, off-host - off-host instrument proof, run with --full: bash scripts/observe-serve-pair-test.sh
  [skip] guard-role-vs-shape  home: operator CLI, on a host with an armed guard - off-host instrument proof, run with --full: bash scripts/guard-role-vs-shape-test.sh
  [skip] host-template-copies-proof home: operator CLI, off-host - off-host instrument proof, run with --full: bash scripts/check-host-template-copies-test.sh
  [skip] success-test         home: operator CLI, LIVE-facing - run with --live LABEL: bash scripts/success-test.sh LABEL

ACTORS listed, never run (they change the host, the live product or the demo data - not checks):
  [actor] scripts/deploy-main.sh               moves the live product to origin/main: fetch, build, re-seed, restart
  [actor] scripts/keep-alive.sh                the self-healing loop: starts/kills/restarts the product
  [actor] scripts/restore-product.sh           restart-only recovery (a name for deploy-main.sh --restart-only)
  [actor] scripts/rollback-to-9d2182a.sh       reverts the host to the pre-cutover commit
  [actor] scripts/install-host-tools.sh        installs the operator tooling into /home/team/shared
  [actor] scripts/antum-product-guard-hook.sh  the login-shell hook re-arming the guard (/etc/profile.d/zz-antum-product-guard.sh)
  [actor] scripts/seed-demo.js                 rewrites the demo database (the labelled sample data every figure is read from)
  [actor] scripts/observe-serve-pair.sh        probes the LIVE public URL; its off-host proof is scripts/observe-serve-pair-test.sh, listed above

----------------------------------------------------------------------------------------------------
totals: 12 check(s) run, 9 skipped
        OK               10
        BROKEN           2
        SKIP-FLAGGED     9

VERDICT: 2 check(s) RED and NOT in a declared state -> doc-citations, doc-citation-pin-selftest
         this is the BROKEN case: nothing declares this state. exit 1
DONE
```

## The gate, after the re-grounding (2026-11-02, `64c7cf7`)

The run above is RED on `doc-citations` and `doc-citation-pin-selftest`. Both were
this branch's own doing: `client/src/App.tsx` gains 21 lines and replaces 2 (hunks at
old 644, 1292, 2760), so every unpinned `App.tsx` citation below line 644 moved by
+4, +5 or +19. No product code was touched to fix it; the citations moved.

**The control that says the failures were mine, not inherited.** Judged with the OLD
documents against the OLD code, the instrument is clean:

```
doc fff847b vs code fff847b: 75 ok, 0 FAILING, 8 unchecked, 21 pinned, 0 unused pin
```

So every one of the 31 FAILING groups appeared with this branch's `App.tsx` edit.

**Two proofs per shifted number, both asserted before anything was written.**

1. *Content identity.* The diff only INSERTS lines, so for every old line `n` outside
   the two replaced lines, `App.tsx` at `fff847b` line `n` is byte-identical to
   `App.tsx` at `e1f62bc` line `n+delta`. All 44 distinct shifts verified identical.
   A shift here is not a guess about where the content went; it is the same line at
   its new number.
2. *The instrument's own symbol test*, re-run on the shifted number: 38 of 52 land.
   The other 14 are the far end of a range whose symbol sits on the near end (for
   example `:1428`-`:1440`, the identity card), and the instrument judges per GROUP,
   so the group lands on the near end.

52 numbers on the 31 named lines, across 6 files. **31 insertions, 31 deletions** -
the document line count does not change, so nothing else in these files is
renumbered by the edit.

**Not moved, on purpose.** Pinned readings (a `@rev` marker before the number):
`@rev 75e3ff2` `App.tsx:355` at `LAYER2-P2-1-IMPLEMENTATION-REVIEW.md:54`, and
`@rev 75e3ff2` `App.tsx:981`-`:982` at `LAYER2-PREBOARDING-UI.md:615` and `:1214`.
And `README.md:23`'s pairs dated in prose (`:1268`-`:1269` at `7a4e00a`, `:1251`-`1198`
at `7b073f8`): they describe older trees, and shifting them would make them describe
neither tree.

**The pin control was red for a reason that had nothing to do with pins.** Plant P4
cites `App.tsx:1580` for `{formatAmount(analytics.avgCostPerHireAE)}`; that symbol is
at 1585 now, so the plant's own citation stopped landing and P4 exited 1 where it
must exit 0. The plant's number moved to the line that carries the symbol it names.
**No expectation changed** - P4 is still (exit 0, `UNUSED-PIN`, unused pin == 1), and
P1/P2/P3/P6 are pinned to `7a4e00a`, which a tip move cannot reach.

**Measured at `64c7cf7`:**

```
python3 scripts/check-all.py
totals: 12 check(s) run, 9 skipped
        OK               12
        SKIP-FLAGGED     9
VERDICT: every check that can be green on this tree is green. exit 0

doc-citations        doc 64c7cf7 vs code 64c7cf7: 75 ok, 0 FAILING, 8 unchecked, 21 pinned, 0 unused pin
doc-citation-pin-selftest  6 plant(s) judged, 0 unexpected outcome(s)   exit 0
  baseline at 64c7cf7: 75 ok, 0 FAILING, 8 unchecked, 21 pinned, 0 unused pin, exit 0
  P1 exit 0, 76 ok, 0 FAILING, 22 pinned     (pin lands, pinned rises by 1)
  P2 exit 1, 1 FAILING                       (marker deleted)
  P3 exit 2, refused, no report, no footer   (unresolvable pin)
  P4 exit 0, 76 ok, 1 unused pin             (marker governs nothing)
  P5 exit 0, 9 unchecked                     (bare SHA in prose is not a pin)
  P6 exit 1, 22 pinned                       (correct pin, symbol absent there)

cd server && node --test
# tests 439   # suites 71   # pass 439   # fail 0   # cancelled 0   # skipped 0   # todo 0
```

**The pin still reddens.** `--mutant ignore-pin` (the instrument's pin resolution
disabled, committed inside the scratch clone) prints
`MUTANT ignore-pin CAUGHT by P1 - the control reddens on a weakened instrument.`
exit 0. P1 is the plant that proves it: a pin the instrument ignores cannot land
`7a4e00a`'s line, so P1 fails and `pinned` stops rising.

**What is still stale, and is not fixed here.** The instrument only reads a line that
contains the literal `App.tsx`, so a citation on the continuation line of a bullet is
invisible to it. These carry numbers this branch's edit moved, each read in context,
and are left for a single follow-up change rather than widened into this one:

| document | line | numbers, now off by +4 or +5 |
|---|---|---|
| `CLIENT-STATES.md` | 65, 114, 247, 288 | `:739`, `:1503`, `:1228`, `:2216`-`:2225` |
| `LAYER2-P2-1-IMPLEMENTATION-REVIEW.md` | 98 | `:2122` |
| `LAYER2-PREBOARDING-UI.md` | 618, 1215, 1366, 1367 | `:1407`-`:1408`, `:1463`-`:1467`, `:2440`, `:1793`, `:1865` |

Fourteen numbers on nine lines. The checker is green without them because each sits
in a bullet whose named line lands; that is the instrument's blind spot, not a
statement that the numbers are right.
