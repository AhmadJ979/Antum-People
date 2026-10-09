# Label-rule re-check on the served bundle — per-surface counts against the `32a8f4e` baseline

**Read-only.** Signed in as the demo admin on the served product at `127.0.0.1:3000`, deployed tree
**`2028894`** (the tree pid 1498 runs from, `/home/team/shared/probable-octo-sniffle`), demo seeded
2026-10-09 10:46. Nothing was written to the product; no app code changed.
Measured 2026-10-09 by driving the app's own nav with real clicks and extracting each screen's
rendered text: `probes/count.js` (case-insensitive occurrence count over `document.body.innerText`)
and `probes/direct.js` (the label strings by their own text nodes, so a badge inside a card is
isolated from the card's other text).

## Counts, per surface

| surface | "Sample Demo Data" | "Illustrative" | label elements found |
|---|---|---|---|
| Executive Dashboard | 1 | **5** | 1 badge; `Illustrative`, `Illustrative Benchmark`, `Illustrative`, `Illustrative Benchmark`, `Illustrative Total` |
| Employee Directory | 1 | 0 | 1 badge |
| Transitions Hub | 1 | 0 | 1 badge |
| Pre-boarding | 1 | 0 | 1 badge |
| Strategic Intelligence | 1 | **10** | 1 badge; `Retention Insight (Illustrative)`, `Productivity Gap (Illustrative)`, `Liability Exposure (Illustrative)`, `Comparing cohort retention (Illustrative Benchmark)`, `82% (Illustrative)`, `83%`, `84%`, `81%`, `Avg days to full productivity (Illustrative Target)`, `Illustrative forecast based on UAE basic and KSA total salary rules` |
| **TOTAL** | **5** | **15** | |

Baseline recorded on the served bundle at `32a8f4e`: **"Sample Demo Data" ×1 · "Illustrative" ×12**.
Surface names as the app labels them: Executive Dashboard · Employee Directory · Transitions Hub ·
Pre-boarding · Strategic Intelligence.

## Reading it against the baseline

- **"Sample Demo Data" — unchanged in kind, wider in reach.** It is a single global badge, and it
  renders exactly once on each of the five surfaces (5 sightings = 1 badge × 5 screens). The
  baseline's ×1 reproduces exactly.
- **"Illustrative" — 15, three more than the baseline's 12.** The direction is additive: no surface
  lost a label. The three extra are **not attributed here**, because the `32a8f4e` record carries no
  per-surface breakdown to difference against; today 5 sit on the Executive Dashboard and 10 on
  Strategic Intelligence, and the other three surfaces carry none.
- **No missing or displaced label found.** Every seeded/benchmarked/forecast figure seen on the two
  figure-bearing surfaces carries its qualifier, and the demo-data badge is present on all five. The
  only number that moved is the "Illustrative" total, upward by three.

## Casing (worth knowing, not a defect)

The labels render **UPPERCASE** on screen — the badge reads `SAMPLE DEMO DATA` — while the DOM's
`textContent` keeps the title case (`Sample Demo Data`). `document.body.innerText` (what the eye
sees) is therefore uppercase and the source string title case. The counts above are
case-insensitive, so they match the baseline's title-case record either way.

## Reproduction

Raw per-surface captures: `raw/surface-*.json` (counts) and `raw/labels-*.json` (label strings).
Probes: `probes/count.js`, `probes/direct.js` — both pure DOM reads, no writes, no network calls.
