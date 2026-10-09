# Row `b3c32e38` — the Exit Intelligence Intake modal gets its opener

**Branch:** `fix/exit-modal-opener`, base `origin/main` `9831a9e`, commit `7c5e68c` (3 lines added to
`client/src/App.tsx`).

## The decision, and why it is "wire", not "delete"

The row offered two ways out. **Wired**, for three reasons that are all checkable in the repository:

1. **The capability is implemented end to end and read back.** `POST /api/exit-interviews`
   (`server/index.js:567`) inserts the interview and moves the employee to `terminated`; and
   `server/index.js:427` reads `SELECT * FROM exit_interviews` to build `exitsByReason`, which the Strategic
   Intelligence surface renders. Deleting the modal would have removed the **only writer** for a dataset the
   product displays — the fix would have made a shipped figure unproducible rather than reachable.
2. **Nothing else writes an exit interview.** In the client, `/api/exit-interviews` is called from exactly one
   place (`client/src/App.tsx:999`, inside `handleExitSubmit`). There is no second, working path — so the "the
   path lives elsewhere now" branch of the row is not true, and the capability was simply unreachable.
3. **The state it needs already exists in the demo.** The seed ships two employees in `offboarding` (and two
   `terminated`). This is not a state the UI can never produce.

**Where the opener went, and why there.** The employee detail panel's action row already renders the buttons
that drive the transition lifecycle — `Mark Productive` (onboarding), `Initiate Exit` (active/onboarding, sets
`status = 'offboarding'`). The new opener is a third member of that same row, shown **only** for
`status === 'offboarding'` — the state the POST moves *out of*: `active → Initiate Exit → offboarding checklist
→ Record Exit Interview → terminated`. No new surface was invented and nothing was made visible where it does
not belong.

## The greps that define the defect, before and after

```
$ grep -n "setShowExitModal" client/src/App.tsx          # before (tree 9831a9e)
407:  const [showExitModal, setShowExitModal] = useState(false);
1014:        setShowExitModal(false);
2193:      {showExitModal && (                 # render guard
2198:                <button onClick={() => setShowExitModal(false)} ...   # close button
# 0 occurrences of setShowExitModal(true) anywhere in client/src

$ grep -c "setShowExitModal(true)" client/src/App.tsx    # after (tree 7c5e68c)
1                                                        # :1384, the new opener
```

## Rule 15 build proof (tree `7c5e68c`, after the commit)

```
$ cd client && npm run build
> tsc -b && vite build
dist/assets/index-s9UoJ3fD.js   270.74 kB │ gzip: 75.41 kB
✓ built in 451ms
npm run build exit code: 0
```

## The path a user takes, rendered — read on an isolated rig

Rig: worktree of `7c5e68c` at port **4719**, its own `PRODUCT_DB_PATH`, its own throwaway credential; the live
product on 3000 answered 200 before and after. The pass clicks real elements and reads the DOM at each step.

1. **Transitions Hub → a departing employee.** `clicked departing: Noura Al-Suwaidi EXIT 2026-10-10`
   (the UAE offboarding case the seed added for the walkthrough).
2. **The opener is present, visible, and in the offboarding context.**
   `{"openerButtons":1,"visible":true,"section":"Offboarding Checklist"}` — screenshot
   `screenshots/01-offboarding-action-row.png`.
3. **It opens the modal.** `"opener clicked"` — screenshot `screenshots/02-exit-modal-open.png`.
4. **The four controls now read their labels — live, for the first time.** Previously these were the four the
   browser could not reach at all (row `bc89d0bd` recorded them as source-verified only):

   | control | accessible name | source |
   |---|---|---|
   | `exit-departure-reason` | Primary Departure Driver | `label[for]` |
   | `exit-preventable` | Preventable Attrition? | `label[for]` |
   | `exit-new-salary` | New Salary Offered (AED/SAR) | `label[for]` |
   | `exit-feedback` | Qualitative Feedback Context | `label[for]` |

   **This closes the last gap from the accessibility row: all 23 labelled controls are now readable on a
   rendered surface**, with 0 unnamed controls in this screen's probe.
5. **The capability completes, and the surface agrees with the database.**
   Filled and submitted through the UI: `{departure_reason: "Compensation", preventable: "1",
   new_salary: "24000", feedback_chars: 50}`. Read from the rig's database, same session:

   | | before | after |
   |---|---|---|
   | `exit_interviews` | 4 | **5** (a `Compensation` row appears) |
   | employees `offboarding` | 2 | **1** |
   | employees `terminated` | 2 | **3** |
6. **And the opener is self-consistent with the state it moves into:**
   `{"openerStillThere":0}` — once the employee is `terminated`, the button is gone. This one is a DOM read
   (`after-submit.json`), **not a screenshot**: the pass wrote screenshots of the two rendered states above and I
   am not citing a third file it never produced.

## Limits and things this does not claim

- **One opener, deliberately.** The Transitions Hub's `Departing Employees (Offboarding)` list still just
  navigates to the employee (its row click already did). A second button there would change a demo surface for
  no gain.
- **Not deployed.** Nothing here reaches the served tree (`2028894`) until a cutover; the live client is
  unchanged and still has no opener.
- **The exit modal has never been exercised by a real user** — this is the first time it is reachable at all, so
  its copy and its `satisfaction_score` default (`'3'`, no control of its own) have had no product review. The
  row's job was reachability; that review is not mine to fake.

Raw captures: `opener-present.json`, `exit-modal-probe.json`, `fill-submit.json`, `counts-before.json`,
`counts-after.json`, `rig-setup.txt`, `build-proof.txt`.
