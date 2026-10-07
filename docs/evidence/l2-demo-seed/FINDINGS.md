# L2 demo seed — three pre-boarding cases, one per flag state

Owner decision 2026-10-07 (task `86749e1f`). Seed data and nothing else: no schema change, no
change to `server/preboarding-items.js`, no change to the P2-1 case-creation path, no flag
column, no stored state.

## What was seeded

Three cases, created **through the product's own path** (`preboarding.recordOfferAcceptance`),
with items moved **only** through `preboardingItems.setItemStatus`. The seed writes no case or
item row by hand, so it cannot drift from what a real caller gets.

| Case | Offer ref | Who | Start date | Items | State it produces |
| --- | --- | --- | --- | --- | --- |
| 1 | `OFR-2026-DEMO-01` | the roster's own in-flight UAE hire | seed day **+14** | 3 requested, 4 not started, 0 received, 0 verified | on track |
| 2 | `OFR-2026-DEMO-02` | new, plainly-a-demo UAE hire | seed day **+1** | all 7 open | inside 48 hours with open items |
| 3 | `OFR-2026-DEMO-03` | new, plainly-a-demo UAE hire | seed day **−1** | all 7 open | start date passed, items still open |

**The states are derived, not stored.** Gate 2 (2026-10-07) decided the 48-hour flag is computed
from the start date and the item statuses. The seed therefore stores a start date and item
statuses — nothing else — and `server/demo-seed.test.js` asserts that `preboarding_cases` carries
no flag-like column at all. The three states are what a reader gets from the data the moment the
flag is built.

**No flag chip renders today, and none was faked.** P2-5 owns the flag; it does not exist yet.
Nothing in this change adds a chip, a placeholder, a stored state or copy implying a computed
flag. What the surface shows for each case today is the start date, the days to start as the
product computes it (**+14 / +1 / −1**), and the item statuses — which is exactly the input the
flag will read. Screenshots below show that live rendering, not a red badge we cannot compute.

**Dates are offsets, never fixed dates** (rule 16). `dayOffset(n)` computes each start date from
the day the seed runs, and a replay **refreshes** the date on the three rows the seed owns rather
than leaving a stale demo behind — the case-creation path deliberately never rewrites an existing
case, so the seed does it for these three rows and logs it. Proven in `replay-verify.txt`: a start
date planted as `2000-01-01` came back as seed day +1 on the next run, with 3 cases and 21 items
still 3 cases and 21 items.

**Case 1 points at the roster row by its id — `demo-emp-omar` — and here is how, because the table
cannot hold it.** `preboarding_cases` has no `employee_id` column and this task may not change the
schema. So the pointer is that row's id carried in `source` (`source='roster:demo-emp-omar'`, a
column the creation path already takes from its caller), and the person's own name, email, role,
department and jurisdiction are **read back out of the roster row** rather than retyped, with the
test failing if `demo-emp-omar` is not there or is not the onboarding row.

**One thing the owner's brief and the frozen demo data disagree about, stated rather than hidden.**
Case 1's start date is the brief's offset (seed day +14). The roster row it points at carries its
own `start_date` from P2-1's demo (`2026-08-20`, the in-flight onboarding). I did not reconcile
them: moving the roster date would move the frozen demo figures this task must not touch, and
ignoring the offset would ignore the brief. Both records are as their owners specified; a reader
who opens the case and the roster side by side will see the two dates differ.

**Nothing else in the demo moved.** Two scratch instances were seeded in the same session,
seconds apart — `origin/main` `5ed731e` on 4719 and this branch on 4720 — and the transcripts
differ only on the pre-boarding lines. AE headcount 7, payroll 10,500, EOSB liability 85,199,
cost-per-hire 8,286, time-to-value 19.2 d, cohorts 100/50/100/100 and the four-quarter forecast
ladder are byte-identical before and after; so are the KSA figures. Full diff in
`figures-before-after.txt`.

## Browser pass (the controls, clicked)

Scratch instance only — port 4720, its own throwaway DB and credential, seeded from this branch.
Live deployment on port 3000 answered 200 before and after the pass. Nothing was clicked on the
live tree, and no product code changed as a result of this pass.

| # | Screenshot | What it shows |
| --- | --- | --- |
| 01 | `01-rollup-three-states.png` | the Pre-boarding screen with all three cases, plus the demo badge |
| 02 | `02-case-checklist.png` | a case's employee track: the seven UAE items and their statuses |
| 03 | `03-consent-gate-disabled.png` | the consent gate refusing: `Mark received` disabled on every item, banner "No PDPL consent record — no document can be collected on this case yet." |
| 04 | `04-consent-recorded.png` | after `Record PDPL consent`: the gate opens, "PDPL consent recorded — documents can now be collected on this case." |
| 05 | `05-item-received.png` | Passport copy moving requested → **received** ("Verify" / "Send back" now offered) |
| 06 | `06-item-verified.png` | Passport copy **verified** — the full requested → received → verified path |
| 07 | `07-rollup-after-transitions.png` | the roll-up re-read after the transition, totals moved with it |

Also verified in the browser: the tile labelled **"Cases open" reads 3** and the rows behind it
are the three cases (tile and list agree); the breadcrumb reads **Pre-boarding** (not the old
"Preboarding Panel"); **"SAMPLE DEMO DATA"** is present in the header; no console errors.

**The gate is not just a greyed button.** The UI disables `Mark received` (title: "A document
cannot be collected before the PDPL consent record exists"), and the API refuses the same
transition for a caller that skips the UI — `gate-proof.js` records
`received without consent -> status 428: A document cannot be collected before the PDPL consent
record exists for this case. Record PDPL consent first.`, with the item left at `requested`.

## Two things found while doing this, neither introduced here

1. **The roll-up is still not jurisdiction-scoped** (the P2-2 browser finding, still open, on its
   own row): `client/src/App.tsx` calls `/api/preboarding/checklist/overview` with no
   `jurisdiction`, while the case list beside it passes one. The server already supports the
   argument. This seed is all-AE, so the defect cannot show itself here — it needs a KSA case on a
   UAE-header surface. Flagged so it is not mistaken for fixed because the screenshots look right.
2. **The two pre-boarding read endpoints return different shapes**: `GET /api/preboarding/cases`
   returns a bare array, `GET .../checklist/overview` returns `{ cases, totals }`, and the
   roll-up's per-case object uses `outstanding_count` / `consent_recorded` / `days_to_start`
   rather than the list's field names. A seeder or reviewer reading one shape for the other gets a
   silent empty read.

## Evidence in this directory

- `build-proof.txt` — `tsc -b` (exit 0, three projects) and `vite build` (exit 0, dist lines) at
  the commit under test. Both run from `client/`: `npx tsc` from the repo root fetches an
  unrelated npm package and is not the compiler.
- `test-counts.txt` — per-file counts with the command to re-run them: eosb 12, preboarding 11,
  preboarding-items 31, schema-migration 3, **demo-seed 7** = **64 tests, 14 suites, 64 pass,
  0 fail** (`cd server && npm test`).
- `http-acceptance.txt` — the unedited HTTP transcript: the three cases, their item statuses, the
  roll-up totals, the 401 without a token.
- `seed-output.txt` — the seed's own log, and the baseline log showing it has no such section.
- `figures-before-after.txt` — the full before/after diff of the analytics figures.
- `replay-verify.txt` — idempotency and the start-date refresh.
- `screenshots/` — the seven screenshots above.
