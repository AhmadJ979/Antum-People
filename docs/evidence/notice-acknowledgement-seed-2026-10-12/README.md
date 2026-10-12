# Evidence — the seed records the notice as shown (15(b), option B, §7.6)

Follow-up to #143, which shipped the mechanism and left the **seed** writing not a single
acknowledgement. That was my error against the spec's own runbook: §7.6 says *"Seed: named actor,
per-item acknowledgements, the two §4 items left uncollectible"*, and §6's empty state is a design
state, not the demo's state. This pass makes the seed do it, and the demo show it.

- `rig-run-raw.txt` — the raw run: the seed's own output, the demo's counts re-read, and a
  before/after on a case with nothing recorded. Everything quoted below is from it.
- `test-run-144-pass.txt` — `cd server && node --test`: **144 tests, 31 suites, 0 fail** (143 in #143;
  the seed's assertions grew).
- `client-build-raw.txt` — `cd client && npm run build`, the owner's standing rule.

## The client build (from `client/`, never the repo root)

```
npm run build exit=0
dist/assets/index-BcziNE91.js   274.05 kB │ gzip: 76.39 kB
client/dist/assets/index-*.js — 274056 bytes, md5 e29f5ef4bc6ffb6a1e09907e7bc5980b
```

## The seed, as it ran

```
- Opened OFR-2026-DEMO-01 (Omar Al-Farsi, AE, start 2026-10-26) — on track — 14 days out, three
  items requested, none verified; items: 3 requested, 4 not_started; notice shown for 4/4 collectible
  (passport=Legal obligation, visa_or_entry_permit=Legal obligation, emirates_id=Legal obligation,
  bank_details=Performance of the employment contract / contractual necessity)
- Opened OFR-2026-DEMO-02 (Mariam Al-Kaabi, AE, start 2026-10-13) — inside 48 hours with every item
  still open; items: 7 not_started; notice shown for 4/4 collectible (…)
- Opened OFR-2026-DEMO-03 (Yousef Al-Hammadi, AE, start 2026-10-11) — start date already passed,
  items still open; items: 7 not_started; notice shown for 4/4 collectible (…)
```

The run prints the state it produced rather than asserting it: the item counts **and** the notice
record per item with its own basis. The name is `admin` — the demo account a walkthrough signs in
as, which is the session that would write the row in the product; not `system` (the module refuses
an unnamed actor) and not `demo-seed` (that names the seeder, not the person).

## The demo's counts, re-read after that seed

```
totals: {"cases":3,"items":21,"items_outstanding":21,"items_received":0,"items_verified":0,
         "cases_notice_not_shown":0,"cases_ready":0,"workspace_lines":43,"workspace_lines_open":43,
         "cases_provisioned":0}

OFR-2026-DEMO-01  items_total 7 · outstanding 7 · by_status {not_started:4, requested:3} ·
                  notice_recorded true · v2.2 · collectible 4 · acknowledged 4 · no basis 3
OFR-2026-DEMO-02  items_total 7 · outstanding 7 · by_status {not_started:7} · … acknowledged 4 · no basis 3
OFR-2026-DEMO-03  items_total 7 · outstanding 7 · by_status {not_started:7} · … acknowledged 4 · no basis 3

acknowledgement rows by basis: Legal obligation 9 · contractual necessity 3
distinct recorded_by: admin
rows for the no-basis items: 0
rows in the retired consent table: 0
notice version on the demo rows == the served file: true
```

So the figures §4 protected are intact — **7 employee-track items per case, 21 outstanding, 43
workspace lines, nothing collected** — and the acknowledgement neither collects a document nor
touches the flag states.

## Before / after, on a case with nothing recorded

```
BEFORE: receive the passport -> refused 428 The privacy notice has not been shown for Passport copy yet,
        so it cannot be collected. Record that the notice was shown first.
record, unnamed actor   -> refused 400 recorded_by is required: there is no new-hire login in this
        release, so the record must name the person who showed the notice, on the hire's behalf
record passport         -> created:true  "Passport copy"            basis "Legal obligation"   v2.2  by admin
record bank details     -> created:true  "Bank details (IBAN letter)" basis "…contractual necessity" v2.2  by admin
record education cert   -> refused 409 …the privacy notice has no purpose row for qualifications, so no
        basis is assigned to it (pending counsel Q1)…
AFTER:  receive the passport -> "received"
```

## One consequence that moves a demo figure, flagged not buried

`cases_notice_not_shown` reads **0** after this seed. Spec §6 says the roll-up label's *"count is
unchanged, its meaning is not"*, and §7.6 says the seed records the acknowledgements: on a seeded
demo those two sentences cannot both hold, and the runbook is the operative one — it is also the only
version in which the demo shows option B's whole point, a per-item record with the notice's own basis
and a named person. The live demo is untouched by this pass (no re-seed was run, per the lead's
instruction to test against the seed as it stands), so **today it still reads 3** under the old number
and will read **0** the first time the new seed runs; the demo's "3 WITHOUT CONSENT" line is retired
either way, which is the designer's re-grounding row. The two documents that quote 3 are hers, not
this PR's.
