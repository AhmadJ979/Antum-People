# Per-surface label pass on the served tree — nothing moved

**Read-only.** Measured on an **isolated rig** (port 4721, its own database, its own throwaway credential) running
tree **`0dd1a97`** — the tree the deployed product serves — built to bundle
**`assets/index-gt1pFhU5.js`, 270,523 bytes**. Two rendered passes,
**2026-10-09 12:53:48 – 12:55:32 UTC**, on a rig seeded 12:52:23 UTC. Nothing was written to the product; no app
code changed, so no cutover follows from this row.

## Why a rig, and what makes the rig the served surface

The live surface is read anonymously only (row `662338bc`), so the credentialed pass ran on a rig. Three checks
tie that rig to what the public actually gets (`transcripts/asset-check.txt`, `transcripts/tree-compare.txt`):

- Anonymously, `GET /` on port 3000 references `assets/index-gt1pFhU5.js`, and the asset fetches
  **HTTP 200, 270,523 bytes**.
- The rig's own `vite build` of tree `0dd1a97` produced that file **byte for byte**:
  `md5 fb6e0df5493fc67a9d9cd9fba5dfa9e2` on both sides.
- The deployed tree's HEAD is `0dd1a97a9d133adf974834cbac6e669383d569b2`, and its **22 `server/*.js` files are
  md5-identical** to the rig's — so the API behind the rendered screens is the same code too.

## Counts, per surface

Case-insensitive occurrence counts over `document.body.innerText`, per surface, driving the app's own nav with real
clicks — the counter is the one Baseline v2 used (`probes/count.js`, carried over from that pass).
`raw-pass1/` and `raw-pass2/` are **two independent passes** over the same five surfaces; they agree exactly.

| surface (app's own label) | "Sample Demo Data" | "Illustrative" | Baseline v2 (tree `2028894`) | Δ |
|---|---|---|---|---|
| Executive Dashboard | 1 | 5 | 1 · 5 | none |
| Employee Directory | 1 | 0 | 1 · 0 | none |
| Transitions Hub | 1 | 0 | 1 · 0 | none |
| Pre-boarding | 1 | 0 | 1 · 0 | none |
| Strategic Intelligence | 1 | 10 | 1 · 10 | none |
| **TOTAL** | **5** | **15** | **5 · 15** | **none** |

## Label inventory, in document order

Read with a text-node walker (`probes/labels.js`), which is what isolates a qualifier from the figure it qualifies:

- **Executive Dashboard — 6:** `Sample Demo Data` · `Illustrative` · `Illustrative Benchmark` · `Illustrative` ·
  `Illustrative Benchmark` · `Illustrative Total`
- **Employee Directory — 1:** `Sample Demo Data`
- **Transitions Hub — 1:** `Sample Demo Data`
- **Pre-boarding — 1:** `Sample Demo Data`
- **Strategic Intelligence — 11:** `Sample Demo Data` · `Retention Insight (Illustrative)` ·
  `Productivity Gap (Illustrative)` · `Liability Exposure (Illustrative)` ·
  `Comparing cohort retention (Illustrative Benchmark)` · `% (Illustrative)` ×4 ·
  `Avg days to full productivity (Illustrative Target)` ·
  `Illustrative forecast based on UAE basic and KSA total salary rules`

The four `% (Illustrative)` nodes are the 82 / 83 / 84 / 81 % cohort figures: the numeral sits in its own sibling
element, so the text node carries the qualifier alone. Baseline v2 recorded those four as
`82% (Illustrative)`, `83%`, `84%`, `81%` — **the same four markers, a different extraction.**

## What moved, and what did not

**Nothing moved.** Baseline v2 was taken on the previous tree (`2028894`, seed 10:46); this pass is on `0dd1a97`
(rig seed 12:52). Two cutovers, the accessibility change (#109) and the storage-decision record (#108) separate
them, and the per-surface figures are identical on all five surfaces — 1 badge sighting each, 15 `Illustrative`
occurrences split 5 / 10. The reason is not the evidence (#109 is attribute-only, #108 is comments in
`server/document-store.js`); the counts were re-measured, not reasoned from that, which is the point of the row.
**No figure-bearing surface lost a label, and no surface gained one.**

## Casing

The labels render **UPPERCASE** on screen (`SAMPLE DEMO DATA`) while the DOM's `textContent` keeps title case. The
counts are case-insensitive and read `innerText` — what the eye sees. One consequence worth knowing: `innerText`
covers the whole document including scrolled-out content, while a screenshot shows only the top of a surface, so
`shots/*.png` illustrate the render but are not the denominator of any count here.

## The two measures, kept apart

This record is the **per-surface rendered** measure. The **bundle-string** measure (`"Sample Demo Data"` ×1 ·
`"Illustrative"` ×12 on the served bundle) is a different measure and neither stands in for the other. For asset
identity only, the served bundle was re-checked here: `grep -o Illustrative | wc -l` → **12** and
`grep -ci "sample demo data"` → **1**, i.e. the same asset the tracker's Round 33 recorded. That is a check that
the asset matches, **not** this row's result.

## Reproduction

| what | where |
|---|---|
| rig construction (worktree, own DB, seed, build, boot, login) | `transcripts/setup.txt` |
| pass 1 and pass 2 in order, every click and every probe return | `transcripts/pass.txt`, `transcripts/pass2.txt` |
| asset/length/md5 and listener-tree checks | `transcripts/asset-check.txt` |
| deployed tree vs rig tree, server file md5s | `transcripts/tree-compare.txt` |
| probes | `probes/count.js` (counts) · `probes/labels.js` (text nodes) · `probes/probe.js` (counts + label elements + headings), md5s below |
| raw per-surface returns | `raw-pass1/`, `raw-pass2/` |
| one screenshot per surface | `shots/{dashboard,employees,transitions,preboarding,analytics}.png` |

Probe md5s: `count.js 8f7a1137fcd4928786110de4fb9d582d` · `labels.js a0ee8af318bbc760299e797e09418952` ·
`probe.js 119059e25497659aa467983f4321da4c`.

The rig's credential is a throwaway inserted into the rig's own database; **the demo credential is not in this
directory or any file in this repository.** The live deployment was untouched before and after
(`live 3000 untouched: 200`, and again after teardown).
