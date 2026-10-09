# Finding — nothing a user can reach records an exit intake today

**Status:** reported for a decision by the owner/designer. **No code change is proposed here.**
**Investigated:** 2026-10-09. Every line citation below was re-read on this branch's merge base, `origin/main`
`bb4e15d`, immediately before this file was committed — not carried over from an earlier read.
**Investigated by:** agent-senior-software-engineer, for row `b3c32e38`.

## The finding, in one sentence

The **Exit Intelligence Intake modal is the only thing in the product that records an exit**, and **no
user-reachable path opens it** — so the exits-by-reason figures the Strategic Intelligence surface renders cannot
be produced by any user action. This is a **product gap, not a bug**: the capability is built and read back, and
the entry point was never wired.

## The narrow question, and the answer

> Is there a reachable UI entry that creates or records an exit intake, or does the Exit Intelligence modal hold
> that capability alone?

**It holds it alone.** Three checks:

1. **Nobody opens the modal.** `setShowExitModal(true)` occurs **0 times** in `client/src`. Every occurrence of
   the identifier is a `false`:

   ```
   client/src/App.tsx:407   const [showExitModal, setShowExitModal] = useState(false);
   client/src/App.tsx:1014  setShowExitModal(false);        // after a successful submit
   client/src/App.tsx:2193  {showExitModal && (             // the render guard
   client/src/App.tsx:2198  <button onClick={() => setShowExitModal(false)} ...   // the close button
   ```

   This has been true since the **initial commit** (`git log -S setShowExitModal` returns only
   `3259bf5`), so no opener was ever removed — there is no "it moved" story to reconstruct.

2. **The modal is the route's only caller.** The string `exit-interviews` appears **once** in the whole client:
   `client/src/App.tsx:997`, inside `handleExitSubmit` (declared `:993`), which the modal's own `<form>` binds
   (`:2200`). No other screen, menu, card or list calls it.

3. **Nothing else records an exit either.** The offboarding surfaces that *do* work are separate and do not
   write an exit interview: `handleTransitionToOffboarding` (`:973`) only moves `status` to `offboarding` via
   `PUT /api/employees/:id`, the offboarding checklist writes tasks
   (`POST /api/offboarding-tasks`), and the settlement/labour-contract buttons fetch documents. The EOSB and
   offboarding pipeline therefore run to completion **without** an exit intake.

## Why it is a gap and not a bug

The data is not decorative — it is read back and shown:

- `POST /api/exit-interviews` (`server/index.js:567`) inserts the row and moves the employee to `terminated`.
- **`server/index.js:427` reads `SELECT * FROM exit_interviews`** to build `exitsByReason`, which the Strategic
  Intelligence surface renders.
- The seed populates `exit_interviews` by hand (4 rows: Better Opportunity ×2, Career Change, Relocation), so the
  demo's departure-reason mix is **seed data that no user can add to**.

Consequence, stated plainly: **a shipped figure has no producer.** A prospect who asks "how does a departure
reason get in?" has no answer in the product today.

## Where the entry point would belong — for the owner/designer to decide, not me

I deliberately do **not** recommend a pick-and-place here; the row that produced this finding asked for the
decision to be made by someone who owns the surface. The two candidates, with their trade-offs:

| candidate | argument for | argument against |
|---|---|---|
| **The employee detail panel's transition action row** (`client/src/App.tsx:1378`–`:1385`) — where `Mark Productive` and `Initiate Exit` already live | it is already the lifecycle control row, and it is the next step of the same flow (`active → Initiate Exit → offboarding checklist → … → terminated`); **checked on the tree:** while a case is in `offboarding` that row currently renders *no* button at all (both existing buttons are gated to `onboarding`/`active`), so a third button here is additive rather than crowding | the placement competes with the Transitions Hub candidate below for the same decision, and the designer may want one entry point, not two |
| **The Transitions Hub's `Departing Employees (Offboarding)` list** (`:1474`–`:1483`) | it is the surface HR scans for everyone leaving; a per-row action reads naturally as "finish this offboarding" | the row click already navigates to the employee, so a per-row action trades against that click target |

A third possibility, which is a product decision rather than a placement one: **decide the capability is not in
this release** and delete the modal, in which case the `exitsByReason` panel must stop presenting a figure the
product cannot produce — and that is a copy change on the Strategic Intelligence surface, not a cleanup.

**A working implementation already exists and is cheap to adopt if the placement above is chosen:** branch
`fix/exit-modal-opener` (3 added lines, the first candidate), withdrawn from review as PR #112 when the
decision was reserved. Its rendered evidence is real and reusable — see the note below.

## What was measured, and its limit

On the withdrawn branch, on an isolated rig, a rendered pass showed the capability complete end to end: the
opener present and visible in the offboarding context, the modal opening on a real click, **the four controls
reading their labels** (Primary Departure Driver · Preventable Attrition? · New Salary Offered (AED/SAR) ·
Qualitative Feedback Context), and a submit that wrote the record — `exit_interviews` 4 → 5 with a
`Compensation` row, `offboarding` 2 → 1, `terminated` 2 → 3.

**Its limit, stated because it matters:** that pass measures what the capability does **when an opener exists**.
It is **not** evidence that a user can reach the intake today — they cannot — and it is not a reason to keep the
opener. The measurement and the recording are both gated on the placement decision above.

## Evidence index

- `docs/evidence/exit-modal-opener/` — the rendered-pass captures, copied unaltered from the withdrawn branch
  (its proposal-framed `README.md` is deliberately not carried over). The complete set: `opener-present.json`,
  `exit-modal-probe.json`, `step-opener-click.txt`, `step-select-departing.txt`, `fill-submit.json`,
  `after-submit.json`, `counts-before.json`, `counts-after.json`, `rig-setup.txt`, `build-proof.txt`, and two
  screenshots (`screenshots/01-offboarding-action-row.png`, `screenshots/02-exit-modal-open.png`). Kept as
  measurements of the capability, not as a proposal.
- Row `bc89d0bd` (merged): the four exit controls could **not** be read live because the modal cannot be opened,
  which is the same fact seen from the accessibility side.
- PR #112: closed, with the reason recorded on it.
