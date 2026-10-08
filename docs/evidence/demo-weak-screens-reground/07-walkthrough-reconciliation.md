# Reconciliation — the audit and the walkthrough script, 2026-10-08

The audit (`demo-weak-screens.md`) and the demo script (`demo-walkthrough-script.md`) describe the same
weak screens and are read by the same person in the same call. Two documents disagreeing is a credibility
problem in front of a prospect who has both, so the mapping was done deliberately and is stated in both
files: the audit carries a mapping table, and the script's footer points back at it.

## Findings present in both, agreeing

| Audit item | Script caveat | Checked for agreement on |
| --- | --- | --- |
| 1 settlement header generic | 5 | the exact strings (`UAE / KSA`, `Antum Regional Hub`), that the figures are the engine's, and the draft framing |
| 2 exit-interview data never surfaced | 8 | `exitsByReason` = Career Change 1 / Better Opportunity 1, and that the client uses the field only as a type (`App.tsx:224`) |
| 3 UAE offboarding 8 steps vs KSA 10 | 10 | the two counts and the instruction not to pad the list |
| 4 H1 2023 at 50% (lift −33%) | 4 | the reading and the "do not hide it" instruction |
| 5 roster 8 rows, 5/1/1/1, the pre-hire in the headcount | 11 | the status split and the counting caveat |
| 6 the KSA switch is visible | 12 | leave the controls alone; answer verbally |
| 7 "Illustrative" labels | 3 | the labels stay and the computed/placeholder split is said out loud |
| 9 roster day count unguarded (`Day -n`) | 11 (last paragraph) | the formula, the line, and that no row on this seed shows it |
| F1–F4, the chip, the package, the flag | 13, 14, Segment 3 | no delivery channel; no hire-facing portal; nothing "sent"; an acknowledgement **recorded in the product**, not an e-signature; the workspace track not built |

## Disagreements found, and what was done about each

The rule applied: the audit is the longer form and carries the measurement; the script's line is corrected
to match, never the other way round.

1. **The script's provenance table listed the Compliance Center's `Basic Salary (UAE Rule)` line as
   "carried from the 2026-10-06 walk … not re-opened this pass". That was wrong as of today** — the line
   was re-opened on the rendered offboarding record's Compliance Center (the EOSB basis row, `App.tsx:1337`)
   on the scratch instance of `2584361`. **Fixed in the script**, and the audit carries the reading
   (`03-dom-settlement.txt`, `screenshots/06-settlement-modal.png`).
2. **The script's `Day -n` line named only `404b29d`.** The same arithmetic was re-read the same day on
   `2584361` — same line, `App.tsx:1383` — so the script now names both revisions, and both documents now
   say the same thing about the seed (no row shows it; all 8 UAE counts are positive, 49 … 1682).
3. **Two findings existed only in the audit.** The sign-in screen's "HR Onboarding/Offboarding Intelligence
   Platform" line and the EOSB forecast's all-zero `KSA: 0.00 SAR` column were in the audit and absent from
   the script's caveat list, which a person reading both would notice. **Both were added to the script**
   (Caveats 15 and 16) as short entries that cross-reference the audit's item numbers, because both are
   things a prospect can see during a call (the sign-in screen before any credential is typed; the forecast
   card when it is read aloud).
4. **No other fact disagreed.** Figures that differ between the two files are dated readings of
   accrual-derived lines (the EOSB liability card), which both files label as readings — not a
   disagreement to reconcile.

## What was not changed, and why

- **The script's other readings keep their own dates.** Its pre-boarding segment was measured on `404b29d`;
  this audit measured `2584361`. Those are two honest records of two revisions, and the script's provenance
  table already says which is which. Nothing in the script was re-dated, because re-dating a reading to a
  revision it was not taken on would be the exact failure both documents guard against.
- **The script's length and shape are untouched.** It is read under time pressure in a call; the
  reconciliation added two short caveats and corrected one line, and moved the rest of the thinking into
  the audit, where there is room for it.
- **The demo credential is in neither file**, not by name, not paraphrased, and not with a location hint
  beyond "supplied separately by the owner".
