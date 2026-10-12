# The seed's state after the send-back — one case left unacknowledged (2026-10-12)

Row `bbf54b1a` was sent back for one change to the seed's state. This file records the revision, the state
it produces, and the reading that resolves the §6 / §7.6 collision. Raw run: `raw-seed-run-state-1.txt`.

## The change

`scripts/seed-demo.js` acknowledged **every** collectible item on **all three** demo cases (12 rows). The seed
now acknowledges only the **two cases whose starts are imminent** — `inside_48_hours` (+1 day) and `started`
(−1 day), the hires HR has already put the notice in front of — and leaves the **`clear` case (start +14
days) unacknowledged**. `recordNoticeAcknowledgement` still writes each row; the only new thing is
`notice_shown: true|false` on the three case definitions in `demoCases`, so which cases carry a record is
demo state in the seed's own vocabulary rather than an accident of the loop.

Why not the two states it replaces: acknowledging all three makes the roll-up read **0** — a tile that
demonstrates nothing *and* removes the demo's ability to show the one action this cycle adds. Acknowledging
none keeps the old **3** and shows none of the new behaviour. The middle state shows both: the tile reads
**1**, and a walkthrough can open the notice from the gate, record it per item on the `clear` case, and watch
the count fall.

## The state it produces, measured

The seed prints the state it produced, and the DB was then read directly:

```
- Opened OFR-2026-DEMO-01 (Omar Al-Farsi, AE, start 2026-10-26) — on track — 14 days out …;
  notice shown for 0/4 collectible ()
- Opened OFR-2026-DEMO-02 (Mariam Al-Kaabi, AE, start 2026-10-13) — inside 48 hours …;
  notice shown for 4/4 collectible (passport=Legal obligation, visa_or_entry_permit=Legal obligation,
  emirates_id=Legal obligation, bank_details=Performance of the employment contract / contractual necessity)
- Opened OFR-2026-DEMO-03 (Yousef Al-Hammadi, AE, start 2026-10-11) — start date already passed …;
  notice shown for 4/4 collectible (… same four …)

ack rows total: 8
per case: [{"OFR-2026-DEMO-01",0},{"OFR-2026-DEMO-02",4},{"OFR-2026-DEMO-03",4}]
cases with the notice not shown (the tile): 1
by basis: [{"Legal obligation",6},{"Performance of the employment contract / contractual necessity",2}]
rows for the no-basis items: 0
```

`server/demo-seed.test.js` holds all of it: 8 rows; every row `instrument='notice_shown'` and
`recorded_by='admin'`; none signed `system`/`demo-seed`/empty; exactly one case with no record and it is
`OFR-2026-DEMO-01`; the basis split 6/2; **0** rows for `education_certificate`, `experience_certificate`,
`emergency_contact`; the retired consent table and the reminders empty; and §4's arithmetic untouched
(21 employee-track items, 21 outstanding, 43 workspace lines).

## §6 / §7.6 — the collision and its resolution, written down

Spec **§6** says the roll-up label's *"count is unchanged, its meaning is not"*; **§7.6** says the seed writes
named-actor per-item acknowledgements. On a seeded demo both cannot hold literally.

**Resolution (the lead's, on the send-back): §6's "count is unchanged" governs the label and its
computation, not the number.** The rule that must survive is *the count is never hand-fixed — it is
computed*; its value moves because the demo data now exercises the feature. So the middle state is not a
contradiction of §6 but the first evidence for it.

**Consequence for the documents that quote the number:** the designer's surfaces quote the demo's old
`3 WITHOUT CONSENT` (`7cfe0ac3`). With this seed the tile reads **1**, not 0 — the designer's re-grounding
should carry **1**, and the label change §6 asks for is orthogonal to the digit.

**And the live demo is not re-seeded by this commit.** It still reads `3` until the next seed runs; after the
next seed it reads `1`. That is the number for anything read after that run.

## Gate

- `cd server && npm test` → **144 tests, 31 suites, 0 fail** (`# tests 144 / # suites 31 / # pass 144 / # fail 0`).
  The count is unchanged from the previous run of this branch because test *bodies* changed, not the number of
  tests.
- `cd client && npm run build` → **exit 0**, and the dist line, which is the half rule 15 wants quoted with
  the exit code: `dist/assets/index-BcziNE91.js   274.05 kB │ gzip: 76.39 kB`
  (`md5 e29f5ef4bc6ffb6a1e09907e7bc5980b`). This branch touches no file under `client/`; the gate is run
  because #143 did, and the merged tree is what ships.
