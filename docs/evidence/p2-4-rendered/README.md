# P2-4 — the rendered pass of the workspace board

Row `439d47a6`. Evidence work: nothing in this pass changes code, and the one defect it found is
named here rather than fixed.

## The tree this describes

`origin/main` at **`b7630cb`**, the merge of PR #86 — so #86 is already in the tree under test and
there is no branch to merge for this pass. The rig worktree's tree hash is
`c71e893dec96289051ef4778ddb0408e3e8cd7fa`, which is the same object I measured as the merge tree
before the merge (`git rev-parse HEAD^{tree}` and `git merge-tree --write-tree origin/main HEAD`
agreeing at that value), so this is the code the owner merged, not a near neighbour of it.

Rig: own worktree, own database, own port (4717), throwaway credential, demo seed (`DEMO_SEED=true`)
plus **one KSA case created through the product's own creation path** (`POST /api/preboarding/cases`)
so the inactive-track refusal could be seen through the surface. The live deployment on port 3000
answered 200 before and after every step and was never touched.

## 1. The workspace section renders, with four function groupings

`01-four-groups-ae.png` (IT group), `02-admin-hr-manager-groups.png` (Admin, HR, Manager).

Case `OFR-2026-DEMO-01` (Omar Al-Farsi, Finance Analyst, Finance), payload
`payload-board-ae.json`:

```
derived_from : {role: 'Finance Analyst', department: 'Finance', profile_keys: ['finance_department']}
chips        : All (15) | IT (6) | Admin (3) | HR (2) | Manager (4)
groups       : IT · 0/6, Admin · 0/3, HR · 0/2, Manager · 0/4
```

Every line carries its owner, its status and a due date with the rule it came from, e.g.

```
IT      Laptop or device issued            IT       not_started  2026-10-18 (D-5)
IT      Licensed software installed        IT       not_started  2026-10-20 (D-3)
Admin   Parking pass issued                Admin    not_started  2026-10-22 (D-1)
HR      Employee file opened               HR       not_started  2026-10-20 (D-3)
HR      Payroll setup                      HR       not_started  2026-10-18 (D-5)
Manager First-week agenda prepared         Manager  not_started  2026-10-22 (D-1)
Manager 30-day check-in scheduled          Manager  not_started  2026-10-23 (D-0)
```

The role is doing real work rather than decorating: this case's department adds
`ws_finance_system_access`, which is why the case has 15 lines and IT has 6 where the two
Marketing cases have 14 and IT 5. The due dates are the case's own start date (`2026-10-23`) less
the line's offset, and they moved correctly when the case's start date differed per case.

## 2. The function filter narrows the board, and the counts still travel

`03-it-filter-narrowed.png`. Clicking `IT (6)` re-reads the board server-side
(`payload-board-ae-IT.json`):

```
view    : View by function | mode function | function IT | is_access_control false
groups  : ['IT']  (six IT lines only)
counts  : the narrowed board still carries IT (6), Admin (3), HR (2), Manager (4)
```

The panel header follows the narrowed board (`0 of 15 done` → `0 of 6 done`), and the sentence
under the chips is the server's own: this is a filter, not access control, and per-user scoping
ships with per-user accounts at Layer 3. Nothing on the screen claims a scope.

## 3. The two counts sit side by side and are never blended

`05-two-counts-on-row.png`, same case, same screen:

```
Verified: 0/7 · 7 outstanding        <- employee track (documents)
Workspace: 0 of 15 done · 15 open    <- workspace track (provisioning lines)
flag: clear, open_count 22           <- the derived flag reads both, 7 + 15
```

Three numbers, three meanings, no single blended figure anywhere.

## 4. A status move goes through the existing item route and the board re-reads

`04-status-move-reread.png`. Clicking the line's own `Requested` button on "Laptop or device
issued" (not a new control — the same item route the documents use) moved it, and the database
agrees:

```
(item_key=ws_device)  track=workspace  owner=IT  status=requested  last_actor=scratch
```

`last_actor` is the signed-in user, and only that case's row changed — the other three cases'
`ws_device` rows are still `not_started`. The board re-read in place: the line now shows
`requested` with `Received` / `Cancel`.

## 5. A refusal, seen through the surface

`06-sa-inactive-refusal.png`. On the KSA case (track kept but not active), attempting a move
renders the refusal as a red notice on the page:

> The SA workspace track is kept but not active in this release (UAE-first), so its lines cannot
> move off not started

and the database did not move: the SA lines are still `not_started` afterwards.

## DEFECT — the function filter is global, so it leaks across cases and mislabels "All"

`07-defect-filter-leaks-to-sa.png` plus the two payloads for the SA case.

With `IT` selected on one case and then another case opened, the second case renders **already
filtered**, and the chip row says:

```
chips: All (6) | IT (6) | Admin (3) | HR (2) | Manager (4)   highlighted: IT (6)
groups: IT · 0/6 only
```

The SA case has 15 lines and its payload confirms both readings
(`payload-board-sa-unfiltered.json`: mode `all`, totals 15, four groups;
`payload-board-sa-IT.json`: mode `function`, totals 6, one group). So on one screen the same case
reads:

- roll-up row: `Workspace: 0 of 15 done · 15 open`
- panel header: `WORKSPACE TRACK · 0 of 6 done`
- chips: `All (6)`

Two things are wrong: the filter follows the user into a case they did not filter, and the `All`
chip then shows the *narrowed* total, so "All" reads as if the case had six lines. Since the panel
is the surface the demo walks through, a prospect who watched an IT filter being applied earlier
sees a wrong-looking total on the next case.

Not fixed here, per the row: worth its own row. The narrow fix is to reset (or key) the filter per
case, and to have the `All` chip show the case's own total rather than the current view's.

## Observation (ambiguity, not necessarily a defect)

On a case whose track is not active, every line still offers its `Requested` button, and the click
is refused with a red notice (`06-sa-inactive-refusal.png`, `07-...png`). The refusal is correct
and honest; but the surface invites an action it already knows will fail. Disabling the actions and
saying why in place would read better — the designer's call, not mine.

Also visible in `01`/`02`: the expanded row leaves the left column empty beside the workspace
panel. The employee track occupies that column higher up, so this may be intentional layout; noting
it only so the designer can confirm it is what they meant.
