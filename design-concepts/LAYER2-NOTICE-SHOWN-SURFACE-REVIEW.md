# Layer 2 — the notice-shown surface, seen on the served product (2026-10-12)

**A report, not a change.** Nothing here is applied: the portal screens are blocked on the owner's
decision 14, and the brief for this pass asked for findings with the screen and the exact string plus
proposed fixes, "rather than applying them blind".

Read on a rig carrying the **served tree** (`9d2182a` = `origin/main`, build byte-identical to the live
asset `index-Cc1GodRa.js`) over a **copy of the live demo DB** (md5 `7c74c485…`), after the 06:42Z
cutover. Raw captures: `docs/evidence/post-cutover-5-2026-10-12-0642-reground/` (DOM text under `raw/`, the
payloads, and the probes' logs). The live `:3000` was never signed in to (rule 26).

## What is new to the eye

The gate is now a **notice-shown record**, per document, and the screen says so in three places: the
roll-up tile, the case panel, and each item row. The sentence that carries the whole idea is the item
line, and it is right: *"Notice basis: Legal obligation · the notice has not been shown for this document
yet"* — basis and state on one line. The record, once written, is rendered as
*"{label}: shown on {date} against notice {version}, recorded by {actor} · basis {basis}"*.

## Findings

### 1. The tile reads `1 CASES · NOTICE NOT SHOWN` — a grammar error on the one tile the demo points at
**Screen:** Pre-boarding → HR roll-up, third tile, live-read reading 1. **Exact string:**
`1 CASES · NOTICE NOT SHOWN`. The value and the label are separate elements, so the unit cannot agree with
the number; at 3 it read correctly, at the seeded value of 1 it does not.
**Proposed fix (client, one line):** make the noun count-aware — `1 CASE · NOTICE NOT SHOWN` when the
value is 1, `N CASES …` otherwise — or put the number inside the label line. This is the tile the
walkthrough's live moment moves from 1 to 0, so it is also the tile a prospect reads twice.

### 2. `Request` is enabled on an item the notice assigns no basis to — and the server accepts it
**Screen:** the clear case → `Education certificate` / `Experience certificate` / `Emergency contact`.
The row carries the amber line and its `Mark received` is (correctly) disabled with the title *"The notice
assigns no basis to this document, so it cannot be collected in this release — the reason is on the line
above"*. But `Request` has no such guard: clicking it succeeds — `POST …/items/education_certificate/status
{status:"requested"}` → **HTTP 200** — and the item then sits in `requested` with `Mark received` disabled
forever and `Cancel` as the only way back.
**Why it matters:** it is a control that leads nowhere, on a screen we walk a prospect through; and the
requested item stays in `items_outstanding` for good, so a case can never read complete. **Proposed fix:**
disable `Request` for `collectible === false` items with the same reason text the refusal carries, so the
interface offers only steps the rule permits.

### 3. The one refusal a viewer will actually see is the least legible sentence on the screen
**Screen:** the same item rows. **Exact string:** `Not collectible in this release: the privacy notice has
no purpose row for qualifications, so no basis is assigned to it (pending counsel Q1).`
"purpose row" is internal notice structure, and `Q1` is an internal question number with nothing on the
surface to resolve it. The server's own fuller wording — *"…No acknowledgement can be recorded for it,
because the notice has no basis to record."* — is the honest, legible version, and it never reaches the
screen.
**Proposed fix:** render the server's sentence, and name the question in words — e.g. *"We will not record
a basis the notice does not assign. Waiting on counsel's answer about qualification documents."* The
refusal is the feature; it should read as a decision, not an error code.

### 4. The record names the signed-in account, and pre-RBAC that is one account for everyone
**Server:** `server/index.js:753` — `const recordedBy = (req.user && req.user.username) || null`. A body
`recorded_by` is ignored (verified: a record posted with `recorded_by: "Someone Else"` came back
`recorded_by: "scratch-admin"`). That is the right property — a record cannot be made to name someone who
was not there — but it means the audit trail names the **account**, and until Layer 3 there is one shared
admin account. **Proposed fix:** say what the field is while that is true (e.g. render "recorded by the
signed-in account"), and keep the demo script from claiming the record identifies a person.

### 5. The button's own precondition lives only in a tooltip
`Record that the notice was shown` is disabled until the notice is opened, and the explanation is a
`title` attribute: *"Open the notice first — this records that it was shown, and the notice has to be
openable from here for that to mean anything."* On a demo screen a presenter clicks, nothing happens, and
the sentence is invisible. **Proposed fix:** render that sentence in the panel while the notice is
unopened (it is the product's best argument for why the record is meaningful).

### 6. Timestamps are printed raw
The record lines render `acknowledged_at` directly: `shown on 2026-10-12T06:49:44.731Z`. **Proposed fix:**
format to the local reading (`12 Oct 2026 · 10:49 GST`) as the rest of the product does; the ISO form is
storage, not screen.

### 7. Two counts of "open" sit close together and neither names its scope
The tile is `21 ITEMS OUTSTANDING` (employee track, 7 × 3). Each row's chip says `… · 21 items open` and
`… · 22 items open` — *every* item on that case, both tracks (the API's own `scope_note` says so). Both are
correct and the screen keeps them as separate fields as designed, but the words "outstanding" and "open"
never say employee track vs whole case. **Proposed fix (copy):** name the scope where the eye lands — the
chip's line could read `22 items open on the case · 7 with the hire` — so nobody adds them.

## Kept as it is (deliberately)

- The **refusal at 409/428 is the right shape** and the state-machine refusal fires first, so an item in
  `not_started` returns a state message rather than a basis message; that ordering is defensible.
- `delivery: "none"` and the pre-reading package's *"not available — no delivery channel in this release"*
  lines are unchanged by the movement and still read honestly.
- The one-act/one-record helper line and the "not a signature" sentence are exactly right; keep them.
