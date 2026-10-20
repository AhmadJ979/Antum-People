# The anchor class: measure the recurrence, then choose the instrument

**Row `4fc611c9`** · analysis only, docs-only, no movement, and **no document rewritten here** (the sibling
re-groundings are a separate row). Written by the product designer, 2026-10-20.

The row asks three things: measure the recurrence rather than assert it; cost three structural options; recommend one
and say why, given that these documents are read by the owner and by counsel and that the team paid for this three
times in one day. This file is those three answers in order.

## 0. The one-line finding

**A line citation is a measurement, and a measurement has a revision.** All 13 anchors this document class carries
moved on the next merge, and five of them moved by **one line** — close enough to look right. The defect is not that
citations go stale; it is that they go stale **quietly**.

## 1. The recurrence, measured

### 1.1 Method, and why there is no simulated merge here

The row says "build the merge result of `#254` against current `main`". **`#254` merged at 09:37:41Z**, one minute
before `#255` (09:38:21Z), so its merge result is not a build I have to simulate — it is *in* `main`, and I measured it
directly. Measuring the real merge is strictly better evidence than merging a branch by hand and measuring that.

- **Instrument:** `docs/evidence/no-403-claim-sweep-2026-10-20/measure-app-tsx-anchors.py <old-rev> <new-rev>` —
  my own instrument, built earlier today for exactly this class.
- **Trees:** `7a4e00a` (the revision `LAYER3-IDENTITY.md`'s citations were re-grounded to in `#255`, and the revision
  PASS 3 validated 8 of 8 against) → **`b82398a`** (the tree `#254` left) → **re-verified at `main` = `9796d6b`**.
  The client moved once more between the last two (`client/src/panelResults.js`), but `App.tsx` did **not**, so every
  number in this file is identical at both trees and is stated here for `9796d6b`.
- **Filed output:** `docs/evidence/no-403-claim-sweep-2026-10-20/anchors-7a4e00a-vs-9796d6b.txt`, beside the earlier
  `...-vs-b82398a.txt` (identical in every `App.tsx` anchor, which is itself the check that the file did not move).

```
App.tsx: 7a4e00a=2529 lines   9796d6b=2539 lines   delta=+10
git diff --name-only 7a4e00a 9796d6b -- client server:
client/package.json
client/src/App.tsx
client/src/httpStatus.js
client/src/panelResults.js
client/src/panelResults.test.js
```

### 1.2 The anchors, at both trees

| anchor the document cites | `7a4e00a` | `9796d6b` (today's `main`) | shift |
|---|---|---|---|
| sidebar comment | 1188 | 1198 | +10 |
| Sign Out button | 1198 | 1208 | +10 |
| identity card, name line | 1212 | 1222 | +10 |
| identity card, role line | 1213 | 1223 | +10 |
| recorded-by print #1 | 2097 | 2107 | +10 |
| recorded-by print #2 | 2152 | 2162 | +10 |
| `checklistNotice` state | 529 | 530 | **+1** |
| `checklistNotice` banner | 2383 | 2393 | +10 |
| login heading | 363 | 364 | **+1** |
| login form | 375 | 376 | **+1** |
| dismiss button (`ml-3`) | 415 | 416 | **+1** |
| error icon (`mr-2`) | 368 (and 1286) | 369 (and 1296) | **+1** / +10 |
| `space-x-3` (brand row) | 1192, 1205 | 1202, 1215 | +10 |

**13 of 13 moved. 0 landed by accident.** So the row's specific question — how many of the 8 anchors PASS 3 validated
move, and do any still land — answers: **all 8 moved, none still lands.** No citation in that file is right by
accident, which is the luckier of the two possible answers.

Two insertion regions explain the pattern: **+1** line inserted above line 363, and **9** more between line 530 and
line 1188. Everything above the first hunk shifts by one; everything below the second shifts by ten.

### 1.3 The property that decides the instrument

A **+10** shift is visibly wrong: `App.tsx:1212` now shows the wrong thing and a reader notices. A **+1** shift is
**nearly right**: the doc says `ml-3` at `:415`, and at `:416` there is the `ml-3`. A reader who checks the citation
sees the thing the citation names, one line off, and concludes the document is fine. **Five of the thirteen anchors
sit in that regime.**

That is the defect to design against — not staleness, but staleness that reads as correctness. It also means a
hand-check ("does this line look like what it says?") is **not** a sufficient acceptance test for a citation, which is
why PASS 3 could truthfully report 8 of 8 and be false one merge later.

### 1.4 While this analysis was being written, it happened again

`main` moved a **fifth** time today while this row was in progress — a `client/` path (`client/src/panelResults.js`)
changed after the tree I first measured at. It did not touch `App.tsx`, so no number here changed, but the event is
the point: **this document carries citations, so it names its tree** (`9796d6b`), and that is the recommendation in
section 3 applied to itself. A document that quotes a revision can survive a merge; a document that does not, cannot.

### 1.5 The merge that carried the instrument also removed two index rows

While this row was in review, the owner merged `main` into this branch (merge commit `9aa76b1`, 2026-10-20T13:50:29+04:00,
parents `d8a67a9` and `5017d39`). The merge result carries **fewer lines in `design-concepts/README.md` than either
parent** — 47 at `d8a67a9`, 46 at `5017d39`, **45 at `9aa76b1`** — and `git diff d8a67a9 9aa76b1 -- design-concepts/README.md`
shows two rows **removed with nothing inserted in their place**: the index row for `LAYER3-IDENTITY.md` (re-grounded and
merged an hour earlier as `#257`) and this file's own row. Both parents had inserted into the same table.

Two things follow, and both bear on the instrument question:

- **A line-number checker could not have caught this.** No citation was involved — a register lost two entries. The
  instrument that reddens on it has the same shape as the citation checker and is just as cheap: **every
  `design-concepts/*.md` has exactly one index row**, counted from the citing artefact's own filename. *Presence is not
  citability, and an absent row cannot be found by a reader searching for it.*
- **A merge is a resolution, and a resolution can take neither side.** Git does not conflict on two inserts into one
  table; here the resolution dropped **both** rather than duplicating them. The check is mechanical: after any merge,
  count the rows — **one row, not two, and not zero.**

Both rows were restored in the commit that carries this paragraph, **byte-identical to their parent revisions**, and
`git diff 5017d39 HEAD -- design-concepts/README.md` is the proof: an addition only, no removal.

### 1.6 The class is wider than this file

`#257`'s checker run found the same defect in **40 further citations** across five sibling `design-concepts/`
documents, all moved by the same merge: `LAYER2-PREBOARDING-UI.md` (19), `LAYER2-P2-1-IMPLEMENTATION-REVIEW.md` (9),
`LAYER2-INTERFACE-FIXES-PICK-LIST.md` (5), `CLIENT-STATES.md` (4), `LAYER2-P2-2-IMPLEMENTATION-NOTES.md` (3). Those
are stale, not false, and re-grounding them is a separate row. The point of recording them here is the **cost of the
status quo**: one merge cost one re-grounding (`#255`), one instrument (`#257`), and 40 unaddressed citations.

## 2. The three options, and what each costs

### (a) Cite a symbol or selector instead of a line

The doc stops writing `:1212` and starts quoting something that exists in the file — the anchor string the checker
already re-extracts out of the document (`title="Sign Out"`, `{/* Sidebar */}`, `|| 'Admin User'`).

- **What it buys.** A quoted string **survives moves** — it is still findable after a +10 shift, by the owner and by
  counsel, with nothing but a text search. A line number is only meaningful inside a checkout at one revision; a
  string is meaningful in any copy of the document, in any search box, at any time. And it fails **loudly**: if the
  string is gone, the claim is visibly unverifiable rather than subtly mispointed.
- **What it costs.** Some markup is anonymous: a wrapper `div` carrying only utility classes often has **no unique
  stable string**. `space-x-3` matches twice; `mr-2` matches twice; `ml-3` is a class that appears elsewhere. Each
  such citation needs either a disambiguating neighbour or a description of the region — and if the honest answer is
  "add an identity to this element", that is a **change to `client/`, i.e. a movement**, which is a real cost.
- **What it reads like.** Denser prose. `ClientsPanel header (grep `Reports to`)` reads worse than `:1212`, and a
  *range* (`:1212`–`:1213` for the two identity-card lines) has no natural symbol form.
- **Cannot do.** It cannot express position, and the owner sometimes wants position ("it is the third card down").

### (b) Keep line numbers, make the checker a gate the movement runs

`#257` ships a checker that reads each citation's expectation **out of the document it judges**, so a stale copy
cannot score green. This option wires it into the movement so staleness reddens at the next cutover instead of
accumulating silently across three merges.

- **What it buys.** The prose stays clean, the existing citations keep working, and the class becomes **detectable
  and enforced** rather than re-measured by hand. It is the only one of the three that catches the **+1** regime,
  because it compares content at the cited line, not line numbers.
- **What it costs — and this is the honest part.** The checker **is not yet a gate**: on a *correct* document its run
  reported 42 failing of which **2 are false positives, verified by hand** (a citing line that names `Sign In`, which
  lives a few lines below the cited `div`; and a range end written without backticks). A gate that reddens on a
  correct document blocks a movement for no reason, so **closing those two modes is the prerequisite**, plus a wiring
  row in `scripts/`, plus the discipline of stating which tree the gate measured. Until then its red count is an
  **upper bound, not a defect count**.
- **Residual hole.** A gate runs **at movement time**. A document merged between two movements can be stale for that
  window — the difference is it can no longer be stale *undetected* for long, and it can never be stale *and quoted
  as verified*.
- **Cost to a movement.** Cheap: it reads git objects, needs no build, and belongs beside the other pre-flight checks.

### (c) Stop citing positions; describe shape

The docs describe what a screen does and how it is arranged, and carry no line numbers at all.

- **What it buys.** Nothing can go stale by a line insertion. The prose becomes what a designer would actually write,
  and it reads best to a non-engineer.
- **What it costs.** It removes **the only falsifiable part**. A prose description of shape cannot be checked against
  the tree by any instrument, so when the screen changes and the description does not, **nothing reddens** — the
  defect class returns, undetectably. That is precisely the trap the plan already names: *a check that cannot be
  reddened proves nothing*, and its sibling, *a claim about a tree written in a tense that assumes the tree does not
  move is true the moment it is written and false the moment it merges*. Shape-only prose is that sentence with no
  instrument left to catch it.
- **Cannot do.** It cannot be verified. It trades a detectable defect for an undetectable one.

## 3. Recommendation

**Do (a) and (b) together, with (c) as the fallback where no grep-able anchor exists — plus one standing admission.**

1. **Make the anchor string the primary form of a citation, and the line number its convenience pointer.** Every
   position claim carries a string that exists in the file today. This is what makes a citation checkable by a
   *reader* with no checkout, and it is what the checker already reads its expectation out of — so doc and instrument
   verify each other.
2. **State the tree beside the numbers, per document.** One line, in the header, naming the revision the citations
   were measured at. `#257` already does this for `LAYER3-IDENTITY.md` (all three trees named). A number without its
   revision is the defect; a number with it is a measurement.
3. **Then gate it (b), after closing the two false-positive modes** — separate row, because a check that reddens on a
   correct document is not a gate, and the anti-vacuous control matters more than the check it guards.
4. **Where no anchor string exists, say so in the document** rather than citing a bare number. That is (c)'s honest
   half — an admission of what a region cannot be pinned to — without (c)'s fatal half, silence about position.

**Why this, given the readers.** Counsel reads a claim and needs to know *which text* it rests on; the owner reads a
description and occasionally wants to see the screen. A quoted string serves both: counsel can find the string in any
copy of the document, and the owner can search for it in the code. A bare line number serves neither outside one
checkout at one revision — it is the form that produced three re-groundings in a single day.

**Why not (c) alone.** It is the only option that leaves the class unmeasurable, and this team has now paid three
times for exactly the failure it would hide.

**The cost of the recommendation, stated plainly:** close two false-positive modes, one wiring row in `scripts/`, one
revision line per document, and denser prose where markup is anonymous. That is less than the measured cost of the
status quo in one day.

## 4. What this file does not claim

- **No option is self-maintaining.** Every option still needs a person or a gate at the point the tree moves. The
  choice is only about whether the defect is **loud** or **quiet**.
- **40 stale sibling citations remain unaddressed** by this analysis; re-grounding them is a separate row, and this
  file deliberately does not touch those documents.
- **No `client/` or `server/` path is changed. Purely docs. No movement is owed.**
- **The checker's red count is an upper bound** (42 ran, 2 verified false positives on a correct document, 40 real),
  so it must not be quoted as a defect count.
