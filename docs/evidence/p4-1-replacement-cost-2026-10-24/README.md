P4-1 — replacement cost: what was measured, and what it does not show
======================================================================

TREE. Branch `feat/p4-1-replacement-cost`, cut from `origin/main` = `9171400` (Merge PR #289).
Every number below was taken on THIS branch's tree, in one session, 2026-10-24.

WHAT SHIPPED. `server/replacement-cost.js` (the engine), `GET /api/employees/:id/replacement-cost`
(appended at the END of the routes section), the `ROUTES` entry in `server/access.js`, the §3.1 row
in `docs/access-model.md`, one seeded replacement hire in `scripts/seed-demo.js`, and the surface
change in `client/src/App.tsx` that reads the figure for every row carrying a termination flag.

THE FIGURES, COPIED NOT SUMMARISED (`rig-figures.txt`, a scratch instance on port 4719, its own DB,
its own throwaway credential, the live product on 3000 answering 200 before and after):

  demo-emp-sarah   CALCULATED  SAR 14,920  4/4 components
    recruitment        4,000   recorded on her own record
    vacancy cover      5,200   12 vacant days (2026-09-30 -> 2026-10-12) x 433.33/day
    onboarding/ramp    3,900   18 recorded ramp days x 433.33/day x 0.5
    lost productivity  1,820   the same 12 days x 433.33/day x 0.35
    -> the replacement named in the payload is demo-emp-lina, with the rule that found her.

  demo-emp-noura   PARTIAL     AED 12,600  2/4 components
    recruitment        7,000   recorded
    onboarding/ramp    5,600   21 recorded ramp days
    vacancy cover      NOT CALCULATED — "no replacement is recorded in this department and role,
    lost productivity  NOT CALCULATED   so the length of the vacancy is unknown"
    -> value null, not 0. A component that cannot be computed says so and says why.

BOTH BEHAVIOURS ARE DELIBERATE. Sarah's seat is refilled in the roster, so her vacancy window is
measurable; Noura's is left unfilled, so her flag is the case that must refuse to guess.

THE CONTROLS THAT MAKE THE CLAIMS NON-VACUOUS
  * `server/replacement-cost.test.js` — 15 tests, and the load-bearing ones re-derive every amount
    from the payload's own `inputs`, so a figure pinned to a constant fails. Two directions are
    pinned explicitly: a REAL zero (a replacement starting the day the seat emptied) is `calculated`
    with value 0; a MISSING record is `not_calculated` with value null.
  * server suite `304 tests / 51 suites / 0 fail / 0 skip` — exactly 15 more than main's 289, i.e.
    this change added tests and changed no existing outcome.
  * `client`: `tsc -b exit 0`, `npm run build exit 0`, bundle `index-CNpLMWLD.js` 283,703 B.
  * `server/reachability.test.js` 19/19 — the new route has a caller (the roster surface calls it),
    so it is not an orphan.
  * `scripts/check-all.py --no-suite` -> OK 4 / RED-KNOWN 1 / SKIP-FLAGGED 7, **exit 0**, "no check is
    unexpectedly red". The one RED-KNOWN is `doc-citations`, and the CONTROL is in
    `entry-point.txt`: the same command on UNCHANGED `origin/main` reads the identical verdict, so
    that recorded red is not this change's.

WHAT THIS PACK DOES NOT SHOW — stated rather than implied
  * **No browser pass.** The figure's rendering is proven by the type-check, the build and the
    payload's shape, NOT by a screenshot: nobody has looked at the row in a browser.
  * **The flag is the termination flag.** The schema has no performance flag (no column, no route,
    no data), so the surface hangs the figure on `status` offboarding/terminated or a recorded
    termination type, and does not invent a performance reading. A performance flag needs its own
    data source before it can carry this.
  * **Three rates are assumptions, not measurements**: vacancy cover x1, ramp shortfall x0.5,
    vacancy output shortfall x0.35. Every payload carries them with that sentence, and the surface
    prints them beside the total. They are the model's inputs, and the owner or counsel may set them
    differently; nothing about them is statutory.
  * **The figure is not a measured outcome.** No client data exists, so this reads the demo roster.
  * **Nothing was deployed.** The host still serves `f4314d8`; the new bundle is built but not served,
    and the new seed has not been run against the demo database.
  * **A movement is owed** (client/ + server/ + scripts/ delta), and the cutover record will need
    re-cutting at that movement's tip, as its own comment says.

A RIG DISCIPLINE NOTE, recorded because it cost two runs. The first two rig transcripts were
discarded: their own controls mutated the scratch DB (a doubled salary, a renamed role) and the read
that followed was of the MUTATED state — a read of the wrong state that still looked like a
measurement. The filed run uses a fresh DB, seeded once, read once, with nothing mutated near the
reads. **A control that mutates the state makes the next read about the mutation, not the tree.**
