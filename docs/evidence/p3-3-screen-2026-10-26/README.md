# P3-3 on screen — does the deployed demo show the named manager chain?

**Row `edba3d2b`. Date 2026-10-26. Judged tree: `8bd3ca0` (the deployed tree). Verdict: DOES NOT SHOW IT.**

The claim under test is the plan's own sentence — *"P3-3 is live and its headline shows on the deployed
demo"*, with the chain *Omar → Salim Al-Nuaimi → Fatima Al-Zahrani; Reem → Khalid Al-Dosari → Fatima*. The
row's premise was right: that sentence rested on a JSON payload, not on a screen. It is **an inference, and
it is false as written.** The escalation records are not rendered anywhere in the product. Nothing about them
is even *fetched*: **the client never calls `GET /api/probation/escalations`.** That fact was **already known
and owned** — the reachability register lists the route as `CALLERLESS` with a named owner — so the false
thing here is one sentence in the plan, not the product's behaviour. This pack turns the inference into a
measurement and names the file that owns the eventual change.

## Provenance — which tree, and what bytes

| | measured |
|---|---|
| tree under judgement | **`8bd3ca0`** — read off the deployed tree itself (`git -C /home/team/shared/probable-octo-sniffle rev-parse HEAD`), not assumed |
| `origin/main` at the time | `23a3ff3` (#314) — **2 commits ahead, docs-only**: `git diff --name-only 8bd3ca0..main -- client/ server/ scripts/` returns **0 paths**, and `main` has **no** client caller for the escalations route either, so the finding is not stale against `main` |
| what the public URL serves | `GET /` → **200**, 799 B, naming `assets/index-CNpLMWLD.js` md5 `62f0fae0baf2b71f7607d86f6834dab1` and `assets/index-CSQHlfh4.css` md5 `2cdb30957b86cca3e6c9df949a0c2c40` |
| the rig's bundle | **copied from the deployed tree's own `client/dist`**, so those two md5s are the rig's bytes as well — what the rig renders IS what the public URL serves, not a rebuild that might differ |

## Method — a rig at the served tree, never a session on the live product

The row's instruction was to load the deployed product in a browser and mint an `hr_admin` session on it. I
did not do that, and the reason is a rule the lead restated on 2026-10-26: **a credentialed rendered pass
runs on an isolated rig, never on the live product** (WORKFLOW rules 10, 14 and 26 — "a session on it is a
state change on the thing we are selling"). Instead:

1. `git worktree add --detach ~/rig-8bd3ca0 8bd3ca0` — the deployed tree's own revision.
2. `client/dist` **copied from the deployed tree** (not rebuilt): bundle md5s equal the served pair.
3. Its own scratch DB (`DEMO_SEED=true`, `scripts/seed-demo.js`), its own port **4711**, and **its own
   throwaway credential** (`scratch`, `access_role=hr_admin`) — never the lead-managed demo password.
4. Unauthenticated health check on the rig: `/api/employees` → **401** (the contract). The live deployment
   was verified **200 before and after** the pass, and was never signed in to.
5. `agent-browser` against the rig, session injected into `localStorage`, then the walk below.

This is stronger than the shortcut for the question actually asked: the claim is a property of the *client
code*, and the client code is identical between the rig and the live host (equal bundle md5). The one thing
it cannot speak to — what the live database holds — cannot change the verdict, because no screen asks for
that data (see the finding).

## The walk, and what is on screen

Dashboard → **Employee Directory** (the probation panel lives on that tab, `App.tsx:1639`). Screenshot:
`screens/02-employee-directory-probation.png`.

What a reader sees, quoted from the DOM (`04-probation-panel.txt`):

- panel heading **`Probation timelines`**, subtitle **`2 HIRES ON PROBATION · 30/60/90 DERIVED FROM THE START DATE`**
- **`Omar Al-Farsi`** — `20 Aug 2026 → 18 Nov 2026 (90 days)`; **`DAY 30 · OVERDUE · 19 SEP 2026`**,
  **`DAY 60 · OVERDUE · 19 OCT 2026`**, `DAY 90 · UPCOMING · 18 NOV 2026`;
  `3 milestones · day 30 / day 60 / day 90 · next: Overdue 19 Sep 2026`
- **`Lina Haddad`** — `12 Oct 2026 → 10 Jan 2027 (90 days)`; all three milestones `UPCOMING`
- one note: `A milestone reads 'completed' only from a submitted evaluation (P3-2): the record names the
  manager who submitted it and the moment they did. A milestone with no submission stays upcoming, due or overdue.`
- then the roster table (`Lina Haddad`, `Omar Al-Farsi`, `Hassan Al-Mansoori`, `Noura Al-Suwaidi`, …)

**On the same tree the API does carry the chain** (`02-api-payload.txt`, read on the rig): three escalation
records — Omar's day-30 and day-60, Reem's day-30 — each with

```
"reporting_line": { "manager": {"name": "Salim Al-Nuaimi"},
                    "managers_manager": {"name": "Fatima Al-Zahrani"},
                    "missing": [], "resolved": true }
```
and Reem's reading `Khalid Al-Dosari` → `Fatima Al-Zahrani`. So the data exists and resolves; **the screen
is where it stops.**

## The four questions, answered

1. **Does the escalation show the named manager chain?** **No.** No surface mentions escalations at all:
   `escalation_mentions: 0`, `Fatima: 0`, `Khalid: 0` in the rendered page (`04-probation-panel.txt`).
2. **What does a reader see for each row?** For the *milestones*: the hire's name, the window, and each
   milestone's day, state and date — with `OVERDUE` on Omar's day-30 and day-60. For the *escalation
   records*: **nothing.** No person to escalate to, no escalation note, no record that an escalation fired.
3. **Does any surface claim the app was not running?** **No.** The one note on screen makes no availability
   claim (quoted above), and `git grep -niE "not running|was down|app down|unavailable"` over `client/` finds
   no such string (the only `unavailable` hits are `package_unavailable_reason`, an unrelated pre-boarding
   field). The corrected escalation note — `"The deadline fell before this escalation watcher started; it was
   first seen … (917.83h after the deadline)"` — is in the payload and never reaches a screen, so it cannot
   mislead a buyer either.
4. **If the client does not render `reporting_line` at all, that is the finding.** **It does not.** See below.

## The register already said so — the plan is what disagrees

This is **not an undiscovered gap**, and it must not be presented as one. `server/reachability-register.js`
at `8bd3ca0` lists the route in `CALLERLESS` in its own words:

> `'GET /api/probation/escalations'` … *"P3-3 records a missed probation milestone's escalation in
> `probation_escalations` and serves it over HTTP so HR can look up when it fired and to whom. **The screen
> that will list it is the probation surface's next slice and does not exist yet**, so no click in the product
> calls this route; it is exercised end to end by `server/probation-escalation.test.js`. **Deliberate and
> tested, not an orphan.**"* — owner: *decision 21 (leave it and say so) — the listing surface arrives with
> the probation screen's next slice (P3-4 / row `bb60c7a3`'s follow-up), and until it does this entry is what
> says so out loud.*

So the product is doing what the register says it does. **The defect is one sentence in the plan** —
*"its headline shows on the deployed demo"* — which contradicts the register and reads a JSON payload as a
screen. The useful action is therefore not an emergency screen build: it is to **correct that sentence**, and
to let the listing surface arrive where the register already assigns it (P3-4's next slice). The
`client/` change and its movement still belong to that slice — the entry stays in `CALLERLESS` until then,
and the register's own rule is that a fixed orphan leaves the register in the same commit.

## The gap and who owns it

`client/src/App.tsx` renders the probation surface from `probationTimelines` only:

- `:741-742` — the **only** probation call in the client: `GET /api/probation/timelines?jurisdiction=…`
- `:1639-1680` — the panel, which formats `probationTimelines` and the server's `note`
- `git grep -ni "escalat" 8bd3ca0 -- client/` → **zero occurrences** (not even the word)
- `reporting_line` appears in the client **five times, all of them the offer-intake form field**
  (`:68` type, `:640` init, `:838` reset, `:2062-2063` the input) — never a rendered escalation
- the timelines payload's keys are `['completions_recorded','note','timelines']`: **no reporting or
  escalation data is even carried** on the route the client does call

So rendering the chain needs a **new client change** — a call to
`GET /api/probation/escalations` (registered at `server/access.js:340` under `employees:read`, handler
`server/index.js:1320`) plus a rendering block, most naturally inside the existing panel at
`client/src/App.tsx:1639`, with its vocabulary (state chips, day labels) beside
`client/src/probationTimeline.js`. **Movement owed by that change: one** — a `client/` delta owes a bundle
rebuild *and* a deployment movement, and the served asset's md5 will move. It belongs to the slice the
register already names (P3-4's follow-up), not to the correction of a sentence. (This pack is docs-only and
owes none.)

## Caveats, and one reading deliberately discarded

- **A void reading is kept in the pack.** `03-dom-probe-VOID-before-render.txt` is a probe taken ~3 s after
  `location.reload()`, before React had painted: it reports `textlen: 698` with every name at 0. It is
  **worthless as evidence of absence** — a zero-hit probe on a page that has not rendered cannot tell
  "the chain is not shown" from "nothing is shown". It is filed as `VOID` because the same mistake is easy to
  repeat, and because the passing reading only means something beside it. The real reading is
  `04-probation-panel.txt` (`textlen: 3276`).
- **Rig database vs live database.** The rig's escalation rows come from the same seeder run on the same
  tree; the live host's rows were raised by its own watcher. This pack makes **no claim about what the live
  database holds** — it does not need to: the client never requests that data, so no screen can render it
  whatever the table contains.
- **A field-name hazard worth naming while we are here.** In one escalation record, `resolved` appears
  **twice with two meanings**: `reporting_line.resolved: true` (the *chain* resolved to named people — what
  the plan quotes) and the record's own `resolved: false` (the escalation itself is not actioned). Anyone
  reading "each resolved: true" from the plan and then the payload can conclude the wrong one. The plan's
  sentence should say *`reporting_line.resolved`* when it means the chain.
- **I did not sign in to the live product, and no password was read.** Unauthenticated live readings only
  (URL, status, byte count, asset md5s, which process holds 3000). If a live-host screenshot is wanted
  anyway, that is the lead's call and the lead's pass.

## Files

| file | what it is |
|---|---|
| `01-rig-setup.txt` | the rig: tree, bundle md5s vs the served pair, scratch DB, own port and credential, live deployment 200 before and after |
| `02-api-payload.txt` | `GET /api/probation/escalations` on the rig — the chain, `missing: []`, `reporting_line.resolved: true`, `channel: none`, and the corrected note |
| `03-dom-probe-VOID-before-render.txt` | **VOID** — the pre-paint probe, kept as the trap it is |
| `04-probation-panel.txt` | the rendered page at the probation surface: panel text, `escalation_mentions: 0`, manager-name counts |
| `05-salim-context.txt` | proves the single `Salim` on screen is his **roster row**, not the chain (`Salim Al-Nuaimi / Senior Accountant / FINANCE / ACTIVE`) |
| `06-code-gap.txt` | the client's only probation call, the absent caller, `reporting_line`'s five form-only sites, and that `main` is unchanged in all of this |
| `07-register-says-callerless.txt` | **the register's own `CALLERLESS` entry** for the route, with its owner (decision 21) — the evidence that this is a plan sentence to correct, not a gap to discover |
| `screens/01-app-loaded.png` | the signed-in shell (rig, `scratch` / `HR_ADMIN`) |
| `screens/02-employee-directory-probation.png` | **the evidence screenshot**: the probation panel with Omar's two OVERDUE chips and no escalation anywhere |
| `md5sums.txt`, `pack-check.py` | the pack's own integrity and claim check |

**Reproduce:** the recipe is `01-rig-setup.txt` (worktree at `8bd3ca0`, copy the deployed `client/dist`,
seed a scratch DB with `DEMO_SEED=true`, own credential/port, then walk Dashboard → Employee Directory).
