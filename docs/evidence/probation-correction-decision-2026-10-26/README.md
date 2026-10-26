# Evidence — the correction path for a submitted probation evaluation (row `0484e79e`)

**Tree measured:** `main` = **`0afe5ac949b092ac08dc63541ccf0cfdd9aab209`**, in a detached worktree at that
revision (`/tmp/r78/main`; `git rev-parse HEAD` printed in `00`). **Read not asserted:** `docs/evidence` is
not the tree under test — the worktree is, and the tree is named in the file that used it.
**Taken:** 2026-10-26, 15:20–15:25 UTC.
**The decision these readings support:** `probation-correction-path-spec.md` (repository root).

## The rig

The product's server reads `PRODUCT_DB_PATH`, so the readings come from an isolated instance — **never the
live deployment**: `PORT=4781`, its own seeded database at `/tmp/r78/rig/corr.db`, three throwaway accounts
in it (`scratch-hr` `hr_admin`, `scratch-mgr` `manager`, `scratch-emp` `employee`). The live product was read
only as a control: `curl http://localhost:3000/` stayed **200** before and after the pass (printed in `00`).
The seed's admin is not created without `DEMO_ADMIN_PASSWORD_HASH`, which is expected, and no live
credential was used anywhere in this pass.

## Files, and what each one shows

| File | Shows | The control in it |
|---|---|---|
| `00-tree-and-instance.txt` | the tree (`HEAD` = `origin/main` = `0afe5ac…`), the `node_modules` symlink and that `express` is present, the seed's exit code, the database file created, and the live port-3000 reading | the live product answers 200, i.e. nothing here touched it |
| `01-seeded-probation-surface.txt` | the identity of the database the probe opened (path + **its own** three scratch accounts = 1 rig), the seeded roster by status (14: 7 active, 3 onboarding, 2 offboarding, 2 terminated), **0 of 14 with a `manager_id`**, 3 with a probation window, and the two hires this rig reads with their derived milestones | the account count is 0 **before** the rig writes (so the 3 after are this rig's), and the script refuses to run unless `PRODUCT_DB_PATH` is under `/tmp/r78/` |
| `02-evaluation-surface-at-0afe5ac.txt` | the submission surface over HTTP: the timeline before and after, the first submission (201), the **409** for a second (with the row untouched), a correction attempt against the route the product does **not** have, the window-ended refusal, the scope refusals, and the escalation before and after | three of them: an unregistered POST **and** an unregistered GET answer **403/0 B** exactly like the correction path (so a 403 proves the gate ran and **nothing about routes**), while a route that exists with the same method and token answers **200** |
| `03-rows-and-audit-rows.txt` | the rows the API left behind, read straight from the rig database: two evaluations (one per successful write), two `CREATE` audit rows naming the actor, the 409's **absence** from both, and the table's column list | the audit `new_values` carries no content — the corrected text lives in its own row, not twice |
| `04-proposed-ddl-additive-and-read-rule.txt` | the DDL this decision proposes, **executed** against a copy of a real database: 19 → 20 tables, columns and indexes created, the evaluations and audit dumps byte-identical, a second application a no-op — then the read rule in SQL (newest correction wins; `as_of` before both corrections returns `null`) | applying the tree's **own** `schema.sql` to the same database first changes nothing and adds no correction table — so the delta is the proposal, not the tree |
| `05-census-client-routes-cells.txt` | the counts the decision cites: 0 client callers of the evaluation route, 0 of the escalation route, the timeline route's caller (`client/src/App.tsx:741`), **30** registered routes, the route's cell, the register entry, and that `evaluationsFor` has no caller | the register entry and the `ROUTES` line are the *code* answer to "does the route exist", which the HTTP status cannot give |
| `check-pack.py` | the checker: **28 checks**, each reading its claim **out of `probation-correction-path-spec.md`** and comparing it with the same figure read out of the transcript the spec names, each reading a string out of the transcript it names and comparing it with the figure the spec quotes — so a figure that drifts from its own raw output reddens its own line | it checks the spec against the pack, and it is not the tree: a figure that is wrong in *both* would still pass, which is why §2's table names the file each figure came from |
| `06-pack-check-run.txt` | that checker's run, with its exit code, against this tree | the run above it: the first attempt **failed** two checks (a mis-parsed count in the checker itself, and a phrasing the spec does not use), and the failures are why the passing run means something |

| `07-pack-check-falsification.txt` | the checker falsified: the same four figures changed in a copy of the spec, and the first version of the checker **staying green on it** — which is how the defect in the checker itself was found — then the rewritten checker failing 4 of 28 on the same copy and passing on the real spec | the falsified copy IS the control, and the first run is kept rather than deleted: a passing check is only worth something beside the run that reddened |

## What this pack does NOT show

- **Nothing here exercises the correction route**, because it does not exist at this revision: `02` shows
  what the *absence* looks like, and the spec's route, refusals and payload are **specified, not measured**.
  The exception is the DDL and the read rule, which were executed (`04`) — in SQL, not through the module.
- No browser was used: the client's rendering of a correction count is not measured and not designed here.
- The rig's roster is the demo seed. Its missing `manager_id` (0 of 14) is a property of the **seed** —
  defect (b) of row `3e66a47c` — and not a statement about any client's data.
- The escalation note text quoted in `02` (`… while the app was not running …`) is the defect already filed
  as (a) of row `3e66a47c`; it is reproduced here because this rig shows the same sentence on a host where
  the app *was* running. It is not a finding of this row.

## Reproducing it

The rig lived at `/tmp/r78/` and was torn down at the end of the pass; the five scripts are transcribed in
the spec's §2 reading table only as figures, so a re-run rebuilds them: a detached worktree at the tree
above (or the merge result, if `main` has moved), `server/node_modules` symlinked to a real install, a DB
under `/tmp`, three scratch accounts, `PORT=4781`, then the HTTP cases in `02`'s order — and **the controls
in the same run**, because every negative in this pack is only as strong as the thing that would have
reddened beside it.
