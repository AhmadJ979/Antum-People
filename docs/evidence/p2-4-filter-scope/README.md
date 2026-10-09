# P2-4 defect — the workspace function filter belonged to the view, not to the case opened next

**Row:** `948bf491` · **Branch:** `fix/p2-4-filter-scope`, tip `a829176`, base `origin/main` `35cbaa1`
**Verified tree:** `8e430c9e296db12fbd52d00248fecff571160ef1` — the tip's tree hash, identical to
`git merge-tree --write-tree origin/main fix/p2-4-filter-scope`. The rig was built from that tree.

## The two faults and the two changes

1. `client/src/App.tsx` `toggleCase` — the filter was component state, so it followed the user into the
   next case; the open read took the default `fn = workspaceFunction` (`fetchCaseWorkspace`'s parameter
   list), i.e. the previous case's choice. It now resets to `All` and the read is issued with `All`
   explicitly, because on that tick the state still holds the old value. A board cached under a filter is
   not reused for the unfiltered view. *(the guard was `if (!caseWorkspaces[caseId])`: without this a
   cached narrowed board would render under a highlighted `All` chip — the same class of lie.)*
2. the `All` chip read `wsData.totals.open`, the **current view's** total, so it said 6 the moment a
   function was selected. It now sums `available_functions[].open` — the per-function counts the server
   returns whatever the view is — so it states the case's own figure in both modes.

## Evidence 1 — the payloads, straight from the API (the row asked for this pair)

`server` (unmodified by this fix) returns `available_functions` per function with `open` counts, and a
`totals` block for **the view**:

| case | view | `totals.open` | `sum(available_functions[].open)` | functions |
|---|---|---|---|---|
| `OFR-2026-DEMO-01` | all | 15 | **15** | IT:6 Admin:3 HR:2 Manager:4 |
| `OFR-2026-DEMO-01` | function=IT | 6 | **15** | IT:6 Admin:3 HR:2 Manager:4 |
| `OFR-2026-DEMO-02` | all | 14 | **14** | IT:5 Admin:3 HR:2 Manager:4 |
| `OFR-2026-DEMO-02` | function=IT | 5 | **14** | IT:5 Admin:3 HR:2 Manager:4 |

So `All` has a source that does not move with the view, and in `all` mode the sum equals `totals.open`
(15 = 15, 14 = 14) — the chip is unchanged where it was already right. `view.is_access_control` is
`false` in both modes. Raw payloads: `payload-board-01-all.json`, `payload-board-01-IT.json`,
`payload-board-02-*.json`.

## Evidence 2 — the rendered screen, DOM read on the fixed client

Same instance, fixed bundle `index-B3KoM02v.js` (the unfixed build was `index-CG8sEoa6.js`):

- case `OFR-2026-DEMO-02` as opened: chips `All (14) [SELECTED]`, `IT (5)`, `Admin (3)`, `HR (2)`,
  `Manager (4)` — the case's own total.
- after clicking `IT` **within that case**: chips `All (14)`, `IT (5) [SELECTED]`, and the panel header
  narrows to `Workspace track · 0 of 5 done · 5 past due`. **`All` kept the case's own 14 while the view
  narrowed to 5** — the exact reading the defect produced as `All (5)`.
- screenshot: `after-case02-narrowed-all-keeps-case-total.png`.

Files: `dom-case02-as-opened.json`, `dom-case02-narrowed.json`, `probes/` (the rig and the browser
probes, re-runnable), `rig-transcript.txt`, `build-proof.txt`.

## What this evidence does **not** yet show, stated plainly

The second half of the row's ask — a DOM capture of the **next case opened clean** after a filter was
applied elsewhere — is **not** in this set. The browser chain that would have produced it ended with the
board closed (the read returned no chips, so the click had toggled the row rather than opening the next
case), and the fix was already committed and the rig torn down by then. What stands behind that half
instead: the code path named above, the merged pass's own before-capture in
`docs/evidence/p2-4-rendered/§DEFECT` (the leak itself: `All (6)` on the SA case while `IT` was
highlighted), and the fact that opening a case now resets the state and reads with `All` explicitly.

## Out of scope, untouched

`view.is_access_control` stays `false`; the note under the chips stays the server's own sentence; one
owner per line stays stored on the row; due dates stay derived on read. The panel header still reports
the board on screen (`0 of 5 done` when IT is selected) — deliberately: it is the header of the board
being displayed, sitting directly under chips that now say which view that is, and the row's narrow fix
named only the chip and the reset.
