# P3-2 — a milestone cannot be marked complete without a submitted manager evaluation

Row `69dbf57d` · branch `feat/probation-evaluations-p3-2` · base `ec2a29e` · 2026-10-26

## What was built

A probation milestone reads `completed` **only** from a submitted evaluation. The submission:

- **names its actor** — `submitted_by` is the signed-in username; an unnamed token is refused **400
  before any lookup** (decision 22's shape), and the module refuses it again so a second caller cannot
  write an unattributable row;
- **is time-stamped** — `submitted_at`, written once and never updated;
- **refuses empty content** — `''`, whitespace-only and a missing field are all 400, and nothing is
  stored (no row, no audit line);
- **stores the form against the employee AND the milestone** — `probation_evaluations`, keyed
  `(employee_id, milestone_index)`, with the milestone's own day and due date copied in at submission
  time so a later re-derivation cannot move the record of what was evaluated;
- **writes the audit row** decision 22 requires — `entity_type = 'probation_evaluations'`,
  `action = 'CREATE'`, `performed_by` = the actor.

Files: `server/probation-evaluations.js` (new, the rules), `server/index.js` (the route),
`server/schema.sql` (the table), `server/probation-timeline.js` (per-employee completions),
`server/access.js` (the policy cell), `server/reachability-register.js`, and the suite
`server/probation-evaluations.test.js` (new).

## The defect this row walked into, measured — P3-1's route answered 500

`01-p3-1-route-500-at-ec2a29e.txt`, measured 2026-10-26T10:48:44Z on a scratch rig at the branch's own
base tree:

```
$ GET /api/probation/timelines     status=500 bytes=33   {"error":"Internal Server Error"}
$ GET /api/employees               status=200           (same token, same server, same moment)
```

`server/index.js` referenced `probationTimeline` at three call sites and **never bound it** — no
`require('./probation-timeline')` exists anywhere in that file (count: 0), and the occurrence list in
the same evidence file shows only the uses. The route's own `catch` returned a 500 **and logged
nothing**, so no reading, log or screen ever surfaced it: the client's probation panel drew empty and
every other check stayed green. P3-1's module and its suite were correct; the binding, and the
assertion that would have caught it, were missing. Both are supplied here.

## The control — the check reddens without the fix

`02-control-without-the-binding.txt`: with the one `require` line removed and nothing else changed,
**3 of 11 fail**, each with `GET /api/probation/timelines must answer 200 (got 500:
{"error":"Internal Server Error"})`. Restored afterwards (verified: one binding, md5 `a0ff38fa…`).

## The suite

`03-full-suite-AFTER.txt`: **323 tests / 52 suites / 323 pass / 0 fail / 0 skipped, exit 0**
(pre-P3-2 it was 308 tests / 51 suites; this branch adds 11 tests and one suite).

Two pre-existing assertions had to be reconciled rather than relaxed, and each says so in place:

- `server/probation-timeline.test.js` held "P3-1 stores NO milestone". Its table-name filter was
  `/milestone|probation/i`, which reddened on `probation_evaluations` — a table that stores a
  submitted **evaluation**, keyed by a milestone index, and stores **no milestone** (the milestone is
  still derived on read, which is what that check exists to hold). The filter is now about milestone
  tables, and the word-scan beside it now strips SQL `--` comments: the schema's own prose counted as
  code, exactly the failure mode that check's note 2 already records for the seeder. Both changes are
  documented in the test's own numbered history, which is where a reader looks.
- `server/reachability-register.js` needs every entry to name the decision that owns it: the new
  route has no client caller yet (the form is the next slice), so it is registered with
  `decision 21 (leave it and say so)` and the reason stated out loud.

## What this change does NOT do

- **No client surface.** Nothing in `client/` calls the submission route, so the form a manager fills
  in is P3-3/P3-4's work; the route is reachable by path and exercised end to end by the suite.
- **No correction path.** A second submission for the same milestone is **409**, with the first row
  proven untouched. How a correction should be recorded (a new act with its own record, a superseding
  row, an edit trail) is a product decision, not one this row takes silently.
- **No new access-model cell.** The route is mapped to `onboarding:write` (HR_ADMIN + MANAGER) and the
  row scope is narrower than the role: a caller who is not company-wide may submit only for a hire
  whose `manager_id` is their own record, and `SELF` is refused outright (a hire cannot submit an
  evaluation about themselves). A **`probation:write` cell of its own** — which would also let a hire
  submit their own — is the narrower reading and is **raised for a ruling**, the same call P3-1 made
  for the read. P3-1's own read question (`probation:read` for the hire's own timeline) is still open.
- **Not measurable yet.** There is no client data, so "Probation Cycle Integrity" still has no outcome
  to report — this row makes it *recordable*, not measured.

## Movement owed

One **full movement**: `server/` changed (six files), so the deployed tree must be republished
(`bash /home/team/shared/deploy-main.sh`); `client/dist` did not move, so no rebuild is involved in the
diff itself. **No movement was run from this branch.** A restart-only is not enough — the served
`server/` code is what carries both the fix and P3-2.

## The state this branch was measured in

- Every reading above is from a **scratch rig** (`/tmp/rig-xiv/p31tree`, its own port 4741, its own
  database, its own account) or from the suite's own throwaway server — never the live service. The
  live product answered 200 throughout, its own process untouched.
- The rig was torn down after the readings; both rig ports are free.
