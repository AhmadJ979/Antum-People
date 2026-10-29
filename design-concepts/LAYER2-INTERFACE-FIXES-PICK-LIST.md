# Decision 20 — the six interface fixes, as a pick-list

**A decision aid, not a change.** No `client/` or `server/` file is touched by this pass. Answer it in one
line — *"apply 1, 3, 5"*.

**Read at `origin/main` = `4b30e63`** (`git rev-parse origin/main`, this session); the six rows' sites are
**re-grounded at `fabef59` (2026-10-29)** — see "What this page is not". `client/` is
**byte-identical to the served tree** `e19a98a` — `git diff --name-only e19a98a..4b30e63 -- client/` returns
**0 files** — so the client lines below are the **served** lines, not a branch's. Blobs behind the citations:
`client/src/App.tsx` md5 `946aa9bacf540afe67ea4c6b8edb8e63`, `server/preboarding-flag.js`
`3702f231b0d7bd512592bdcb9a622d29`, `server/preboarding-items.js` `d3cc0df5603ddcd8f81a985c44a69a84`.
Rendered strings are quoted from the served pass already on file,
`docs/evidence/post-cutover-5-2026-10-12-0642-reground/raw/`.

## The pick-list

| # | The fix | Site | What it reads / does now | Proposed | Size | Where |
|---|---------|------|--------------------------|----------|------|-------|
| **1** | The tile's grammar at 1 | `client/src/App.tsx:2242` (value), `:2250` (label) | the label is the source string `Cases · notice not shown`, uppercased by the CSS `uppercase` class, and its unit is hard-coded, so it cannot agree with the number | count-aware noun in the source: the label reads `Case · notice not shown` at 1, `Cases · notice not shown` otherwise | 1 line | client |
| **2** | The honest refusal never reaches the screen | `client/src/App.tsx:2461`–`:2465` (sentence at `:2463`) | `Not collectible in this release: the privacy notice has no purpose row for qualifications, so no basis is assigned to it (pending counsel Q1).` — internal structure, and a question number nothing on the surface resolves | a sentence in words, e.g. *"We will not record a basis the notice does not assign. Waiting on counsel's answer about qualification documents."* | 2 lines | client (wording: compliance) |
| **3** | The record names the account and nothing says so | `client/src/App.tsx:2402`, `:2646` (the second prints `{item.acknowledgement.recorded_by}` and omits the words) | `… recorded by scratch-admin · basis Legal obligation` — reads as a person; pre-RBAC it is one shared account | name the field: `recorded by the signed-in account (scratch-admin)` | 2 lines | client |
| **4** | The record button's precondition lives only in a tooltip | `client/src/App.tsx:2420`–`:2427` (`disabled` `:2421`, title `:2422`–`:2424`, sentence `:2423`) | `title="Open the notice first — this records that it was shown, and the notice has to be openable from here for that to mean anything"` — a presenter clicks, nothing happens, the sentence is invisible | render that sentence in the panel while the notice is unopened (it is the product's best argument for why the record means anything) | ~4 lines | client |
| **5** | Timestamps are printed raw | `client/src/App.tsx:2401`, `:2646` | `shown on 2026-10-12T06:49:44.731Z` — storage, on screen | format as the product does elsewhere — the server already renders long-form dates (`server/index.js:403`, `toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'})`, the `8 October 2026` of the settlement statement); the client has no date helper, so add one and use it at both sites | 1 helper + 2 sites | client |
| **6** | Two counts of "open", neither naming its scope | `server/preboarding-flag.js:191`, `server/preboarding-flag.js:203` (chips); `client/src/App.tsx:2234` (value) `:2235` (label) | the chip is the server's `items open` string (`server/preboarding-flag.js:191`) beside the tile `{checklistOverview.totals.items_outstanding}` — two different measures that can read the **same number**: the tile is the employee track (7 × 3), the chip is every item on the case (employee + workspace) | name the scope where the eye lands: chip `22 items open on the case · 7 with the hire`, tile `Items outstanding · employee track` | 2 strings + 1 label | server + client |

**Every one of the six owes a deployment movement.** Five touch `client/`, which rebuilds the bundle and
moves the served asset's md5; #6 touches `server/` on the served path as well. They are one pass and one
movement, not six — the marginal cost of the sixth fix is a rebuild we are already paying for.

## How the six were found — the plan names four, and the count is the plan's

No artifact enumerates six. The design work is
`design-concepts/LAYER2-NOTICE-SHOWN-SURFACE-REVIEW.md`, which carries **seven** findings; the plan names
four of them ("the tile's grammar at 1, the honest refusal never reaching the screen, the record button's
precondition living only in a tooltip, raw ISO timestamps"). Four of the seven map to those one-for-one
(review §1, §3, §5, §6 → the four named here). **The remaining two are review §4 (§3 above) and review §7
(§6 above).**

The third leftover, **review §2 — `Request` is enabled on an item the notice assigns no basis to** — is
**not** one of these: it is the `Request` dead end measured as element **9** of
`un-operable-controls-inventory.md`, and the plan assigns its ruling to **decision 21** ("the product ruling
is whether `Request` should be offered where the item cannot be received"). It is a behaviour guard on a
server route, not a copy or interface fix, and it should be ruled there.

So the set is derived by exclusion, not asserted: **the seven findings, minus the one that belongs to
decision 21.** If the owner's intent was a different five-and-one, the pick-list numbers are what to correct
— the sites and the strings are measured either way.

## Order, and what to do about all six

**Recommended order: 1 → 5 → 3 → 4 → 2 → 6.**

- **1, 5, 3, 4 first — four fixes, one client file, no wording decision, one rebuild.** 1 is on the tile the
  walkthrough's live moment moves (1 → 0), so a prospect reads it twice. 5 is the cheapest credibility fix
  on the page. 3 and 4 are the same panel as 5 and cost nothing extra.
- **2 next, but its sentence is the compliance expert's to word.** The refusal *is* the feature; the current
  sentence is the least legible on the screen. Worth doing — with the replacement wording supplied, not
  invented here.
- **6 last, deliberately.** It changes a string that **three dated documents quote** (the chip in
  `demo-weak-screens.md`, `demo-walkthrough-script.md` and the evidence packs), so it should land with those
  records re-grounded rather than silently. Worth doing: two numbers that can read identically, one of them
  meaning something else, is the defect the plan already warns about ("never add them into one 64
  outstanding").

**Nothing here should be dropped.** If the owner wants the smallest defensible pass, that is **1, 3, 4, 5**
— all legibility, none of it a wording or compliance call. The full set is one movement either way.

## What this page is not

- It is **not** the change, and it does not pre-empt the review that wrote the findings: the surface review's
  own wording is quoted for #2, and its scope proposal for #6 is what #6 proposes.
- It is **not** a claim that these are the only six. `main` and the served tree move; the sites above were
  measured at `4b30e63` and **re-grounded at `fabef59` (2026-10-29)** — each `file:line` re-derived from the symbol it names, not renumbered.
- Whichever are applied, `design-concepts/LAYER2-NOTICE-SHOWN-SURFACE-REVIEW.md` should be annotated
  **applied** for those and left standing for the rest — a report describes the state it was written in, and
  the annotation is what tells the next reader which is which.
