# The register's four-count summary, reproducible from one command — 2026-10-14

**What was wrong.** `scripts/reachability-report.js` printed three of the register's four defect
categories. `DEAD_END_ITEMS` (defined at `server/reachability-register.js:100`, asserted at
`server/reachability.test.js:252–265`) was imported by the test and by nothing else, so the
four-count line the plan and the tracker quote —

`{"CALLERLESS":3,"UNOPENABLE_CONTROLS":1,"DISPLAYED_VALUES":0,"DEAD_END_ITEMS":3}`

— could not be reproduced from any single command. A count quoted without a run is a memory.

**What this changes.** One file: `scripts/reachability-report.js`.

1. A **`REGISTER SUMMARY`** section, printed first, counts all four categories from the register
   module's own exports and emits the `raw:` JSON line above.
2. `DEAD_END_ITEMS` gets its own section (`ITEMS OFFERED A MOVE THEY CAN NEVER COMPLETE`), listing
   each item, its reason, its owner, and the guards that make it a dead end
   (`requestControlGuard()` — the Request control at `App.tsx:2129` is **not** guarded, `Mark received`
   at `:2133` is disabled unless collectible, and the collect gate fires only for collected statuses).
3. The summary is checked **in both directions** against the register module's actual exports, before
   anything else is printed. A declared category the register no longer exports, or an export the
   report does not declare, makes the report print `REGISTER SUMMARY — REFUSED` and exit 1. A report
   that can quietly drop a category is the defect, not the missing line.
4. Where a category has a measurement (`r.classify()`, `r.uiStateReachability()`, `r.deadEndItems()`),
   the summary prints the **measured** count beside the register's and reports a disagreement as a
   finding. `DISPLAYED_VALUES` says plainly that its set is measured by the test and **not re-derived
   here** — re-deriving it in a second place is how two readers of one measurement start disagreeing.
5. The closing tally is a set of **element ids**, not a running counter: the summary and the sections
   look at the same elements, and counting events reported one orphan route as two findings. Control F
   below checks exactly that.

## The one command, and its run

```
$ node scripts/reachability-report.js          # exit 0 = nothing new, exit 1 = a NEW un-operable element
...
  CALLERLESS            3   routes registered in server/index.js that nothing calls
    measured: 3 — agrees with the register
  UNOPENABLE_CONTROLS   1   boolean UI state whose setter is never called with true
    measured: 1 — agrees with the register
  DISPLAYED_VALUES      0   a tile whose value no production path writes
    measured: not re-derived here — the test measures this set ...
  DEAD_END_ITEMS        3   an item offered a move the collect gate then refuses
    measured: 3 — agrees with the register

  raw: {"CALLERLESS":3,"UNOPENABLE_CONTROLS":1,"DISPLAYED_VALUES":0,"DEAD_END_ITEMS":3}
```

| file | what it is |
|------|-----------|
| `report-four-counts-*.txt` | the whole report on the branch tip, `exit=0`, 144 lines |
| `register-raw-counts-*.txt` | the same four numbers from the register module **directly** (`node -e …`), with the command in the file — the summary's numbers are checked against an independent read, not against themselves |
| `reachability-test-*.txt` | `node --test reachability.test.js` on the same tree: **12 tests / 12 pass / 0 fail**, exit 0 |
| `decision-number-counts-*.txt` | the tracker's Round 43 entry states the report prints `decision 21` ×5 / `decision 20` ×0. Re-measured old vs new on the same tree: **5 / 0 both ways** — this change does not move that figure |
| `controls-transcript-*.txt` | the control run's own summary (see below) |
| `controls-harness.sh` | the harness that produced the controls, **verbatim as it ran**. It points at the author's scratch paths by design: it is a control harness, not a shipped script (`scripts/` conventions do not apply to it) |
| `control-{A..F}-{OLD,NEW}.txt` | each control's raw output, old report first and new report second, on the same altered tree |

**Where the numbers describe.** `server/reachability.js` resolves its root as `path.join(__dirname, '..')`,
so the report measures the checkout it lives in. These runs were taken in the working tree of this
branch, cut from `fa58787` (the `origin/main` tip at 15:53Z, read this session).

**Which bytes ran — so a reader never has to compare a report against a different script.** The
control run and the run in `report-four-counts-*.txt` used the same file:

| file | bytes | sha256 |
|------|-------|--------|
| `scripts/reachability-report.js` (new) | 14,495 | `484f41c0a316a40ffc8de7e5848b7a685957826e362e2444ff2fb2ce2b003bb9` |
| `origin/main:scripts/reachability-report.js` (old, the "OLD" column below) | 6,402 | `6fadf29d2108b0bf9187749573e22e68485f75a964b1da6373774b65b42dd3e3` |
| `controls-harness.sh` (as run) | 7,166 | `6c284447a05416081066ea9828022ce17bf83f4fc83b1e3852791f1c7973f7f1` |

The script's own mtime is `2026-10-14T15:55:30Z`, the control run started at `15:55:46Z`, and the
harness's saved copy of the new report hashes identical to the working-tree file — so the old/new
pairs are a before/after of one file, not of two revisions of it.

## The controls — in a scratch worktree, never the live tree

Harness: `git worktree add --detach rc-scratch HEAD`, injections applied with `python3` to the named
line, `git checkout -- server scripts` between controls, `git status --porcelain` read back empty
(besides the report script being swapped). The **old** report (`origin/main:scripts/reachability-report.js`)
is run first, on the same altered tree, so every control is a before/after pair.

| control | injected into the scratch tree | OLD report | NEW report |
|---------|--------------------------------|-----------|-----------|
| **A** | `DEAD_END_ITEMS` renamed to `DEAD_END_PENDING` (both occurrences: `:100`, `:197`) | **exit 0, 102 lines, mentions a dead end 0 times** — silently omitted | **REFUSED**, exit 1: `MISSING DEAD_END_ITEMS` + `UNDECLARED DEAD_END_PENDING` |
| **B** | a fifth category `ORPHANED_JOBS` defined and exported | **exit 0, silent** | **REFUSED**, exit 1: `UNDECLARED ORPHANED_JOBS` |
| **C** | one entry added to `DEAD_END_ITEMS` that the measurement does not support | **exit 0, silent** | register `4`, `measured: 3 — DISAGREES`, `registered but not measured: work_permit_transfer`, **1 NEW finding**, exit 1 |
| **D** | a fourth no-basis item injected into `NOTICE_BASES` (`server/preboarding-items.js`) | **exit 0, silent** | register `3`, `measured: 4 — DISAGREES`, `measured but not registered: insurance_card`, **1 NEW finding**, exit 1 |
| **E** | nothing — the unmodified tree | exit 0, 102 lines | exit 0, 144 lines, `raw: {…"DEAD_END_ITEMS":3}` |
| **F** | one new callerless route `GET /api/control-orphan-route`, registered before the SPA catch-all | **1 NEW finding**, exit 1 | **1 NEW finding**, exit 1 — seen by the summary *and* by the route sections, counted **once** |

Controls C and D are the two directions of the same cross-check: C is a register entry the measurement
cannot see, D is a measured item the register does not carry. The old report is silent on both, and
exits 0.

## What this owes, and what it does not

**No `client/` or `server/` path is touched, so this owes no cutover.** Measured on the branch:

```
$ git merge-base origin/main HEAD
fa5878757a72b60b6d85671b6876ff9b35f68fb9
$ git diff --name-only $(git merge-base origin/main HEAD) HEAD | wc -l
21
$ git diff --name-only $(git merge-base origin/main HEAD) HEAD | grep -v '^docs/evidence/reachability-report-four-counts-2026-10-14/'
scripts/reachability-report.js
$ git diff --name-only $(git merge-base origin/main HEAD) HEAD -- client server
(empty)   count: 0
```

Taken **after** the commit, on the committed tree (`7acddd8` at the first read; re-derive it — the
branch tip moves if anything else lands): 21 files, of which **one** is outside this evidence
directory, and **zero** are under `client/` or `server/`.

The served path is `client/` (the built bundle) and `server/` (the process); `scripts/` is neither, and
no route, module or asset that ships reads this file. Nothing in the served tree changes.

**One observation, not fixed here — it is not this change's scope.** `un-operable-controls-inventory.md:145`
describes `server/reachability.test.js` as "(9 assertions)"; the file now runs **12** tests (measured:
`# tests 12`, in `reachability-test-*.txt`), and the table under it does not carry the dead-end
assertion at all — the same category this PR makes visible in the report. Reported rather than edited,
so this diff stays one file plus its evidence.
