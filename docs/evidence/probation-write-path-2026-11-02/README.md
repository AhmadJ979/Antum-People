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
