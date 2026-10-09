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

---

## Third cutover, 2026-10-09 13:46 UTC — the same counts, re-read on the tree serving now, in two passes
**Read-only.** Everything above is the measurement of the tree **then** serving (`2028894`, seeded 10:46) and is kept exactly as taken. A **third cutover** ran **2026-10-09 13:46:11–13:46:43 UTC, exit 0**, moving the served tree `0dd1a97` → **`da3330d`** (the All-chip rendering-race fix, #119) and re-seeding the demo at **13:46:16**. This section records what the surface serves now; nothing above it is rewritten or renumbered.

**The rig is the served bundle — by md5, not by argument.** These readings were taken on the product at `127.0.0.1:3000`, signed in as the demo admin, driving the app's own nav with real clicks and running this directory's two probes **verbatim** (`probes/count.js`, `probes/direct.js`). That product serves `/assets/index-B8Hoaanh.js`: **270,982 bytes, md5 `abfe49feb21dc90b77743922f76a7399`** — the same bytes and the same md5 as the same path fetched anonymously from the public URL, three times running, and the same size the cutover's own build log records (`dist/assets/index-B8Hoaanh.js 270.98 kB`). The stylesheet did not move: `assets/index-BLszozVg.css`. *(The run record quotes 270,981 bytes; the bytes as downloaded and as built are 270,982 — recorded, not silently adopted.)*

| surface | "Sample Demo Data" | "Illustrative" | rendered-text length (above → now) | pass 1 | pass 2 |
|---|---|---|---|---|---|
| Executive Dashboard | 1 | **5** | 693 → 693 | same | same |
| Employee Directory | 1 | 0 | 1120 → 1120 | same | same |
| Transitions Hub | 1 | 0 | 348 → 348 | same | same |
| Pre-boarding | 1 | 0 | 5925 → **5923** | same | same |
| Strategic Intelligence | 1 | **10** | 1264 → 1264 | same | same |
| **TOTAL** | **5** | **15** | | | |

*"rendered-text length" is `document.body.innerText.length` as the register's own probe reports it: the reading above on the left, today's on the right.*

## Reading it against the section above
- **"Sample Demo Data" ×1 on each of the five surfaces — unchanged** (5 sightings = 1 badge × 5 screens).
- **"Illustrative" — 15 again: 5 on the Executive Dashboard, 10 on Strategic Intelligence, 0 on the other three.** Unchanged from the `2028894` reading, and still three above the `32a8f4e` baseline's ×12.
- **Both passes agree with each other, on every surface and every measure, and both agree with the section above on every label count.** No label was dropped, moved or softened by the third cutover.
- **The one reading that moved is not a label.** Pre-boarding's total rendered text length reads **5923** where the section above records **5925** — two characters — with its badge count and its "Illustrative" count identical and its single label hit (`Sample Demo Data`, near `Pre-boarding Intelligence`) unchanged. **Recorded, not attributed:** this register stored counts and label strings, not the full text, so the two reads cannot be differenced retroactively. The plausible candidate is a rendering change on that surface — the third cutover is the All-chip rendering-race fix, and Pre-boarding is the surface that carries the case-list chips — but that is a hypothesis, not a measurement.

## Honest limits (unchanged, and they still bind)
- Counts are **case-insensitive over `document.body.innerText`** — what the eye sees, per screen.
- **Two passes on one seed is a repeatability check, not a change-of-seed one.** Both passes ran on the 13:46:16 seed.
- The bundle's **×12** (a string count inside `index-B8Hoaanh.js`) and the rendered **15** (this table) are **different measures on the same asset**, never interchangeable.
- The casing note above still holds: labels render UPPERCASE, the DOM's `textContent` keeps title case.
- No figure here was pinned, moved or softened to make a screen agree (WORKFLOW.md rules 15 and 16).

Raw captures for both passes, alongside the files this section's predecessor wrote: `raw/da3330d-pass1-*.json` and `raw/da3330d-pass2-*.json` (counts), `*-labels.json` (label strings by their own text nodes). **The probes are unchanged** — that is what makes the two sections comparable. **A third corroboration of which screens were walked:** each capture's `len` matches the reading above exactly on four surfaces (693, 1120, 348, 1264) and on Pre-boarding within two characters (5923 against 5925), so the screens read are the screens this register reads. A `document.querySelector('h1,h2')` heading probe was attempted on both passes and returned an empty string everywhere (the app's screen titles are not `h1`/`h2` elements); it is **not** committed as evidence and is recorded here instead.

## Identity pass — "which screen was that?" answered from the DOM (2026-10-09, after cutover #3)

Prompted by the lead's note that a capture must show the thing it claims. Every `screen` field the
count probe emits is empty, so *which surface a capture came from* rested on the click order and on
the length matching this register's prior reading. That was an inference. It is measurement now.

**Two probe faults found and disqualified** (both would have let a capture be captioned wrongly):
- `probes/identity.js` `dir_heading` (`/Employee Directory/i` over body text) is **true on all five
  surfaces** — the sidebar carries that label on every screen (client/src/App.tsx:213; sidebar is a
  real `<aside>` at :1080 wrapping `<nav>` at :1108).
- `probes/identity.js` `active_nav` listed the three **non-selected** nav labels on every surface:
  the `[aria-current]` selector matched nothing and the class fallback matched inactive buttons.

Neither field supports the identity claim. Both are left in `raw/da3330d-identity-*` so the
correction is visible rather than retro-fitted.

**What the claim rests on now** — `probes/identity2.js`, `raw/da3330d-identity2-*`: it reads only the
**content region** (a body clone with `aside`/`nav`/`header` removed). All five regions are pairwise
distinct, and each carries a marker string absent from the other four:

| surface | region len | body len | marker only it has |
|---|---|---|---|
| Executive Dashboard | 422 | 693 | `Retention Lift (1-yr)` |
| Employee Directory | 771 | 1120 | `Name & Region` (table headers) |
| Transitions Hub | 113 | 348 | `Ramping Employees (Onboarding)` |
| Pre-boarding | 5564 | 5923 | `Pre-boarding Intelligence` |
| Strategic Intelligence | 965 | 1264 | `Strategic Workforce Intelligence` |

Region lengths are below the body-level lengths because the sidebar and header drop out — 5923 → 5564
on Pre-boarding is the check that the region probe really excluded them. Full comparison, computed:
`raw/da3330d-identity2-cross-comparison.txt`.

**Bundle md5, recorded per pass rather than once:** all four readings — `da3330d-pass1`, `-pass2`,
`-identity`, `-identity2` — ran against **270,982 bytes / md5 `abfe49feb21dc90b77743922f76a7399`**,
read off `assets/index-B8Hoaanh.js` on the served product (once per surface in the identity2 pass:
`raw/da3330d-identity2-*-bundle.txt`), matching the third cutover's build log line (`270.98 kB`).
The count probe reproduced identically in all four (Sample Demo Data ×1 per surface; Illustrative
5/0/0/0/10).

Honest limits: this is repeatability on **one** seed, not a change-of-seed check; counts are
case-insensitive over rendered text; `innerText` on a detached clone inserts no line breaks, so
exclusivity above is a whole-region property.
