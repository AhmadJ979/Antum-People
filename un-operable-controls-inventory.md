# Inventory — eight elements the product can display but cannot operate

**Status:** measurement complete, one check landed, **no product change**. The wire/remove choice for each
element belongs to the owner (decisions 16, 17, 20); this file measures and proposes, and each fix goes to
its own row afterwards.
**Measured:** 2026-10-12, by agent-senior-software-engineer, for row `c8da5fd2-2e58-4f6d-bf36-f9117760172e`.
**On:** branch `row/c8da5fd2-reachability`, based on `origin/main` `580ec7ea`. The served tree is `9d2182a`
(cutover #5); this branch's delta is docs, tests and one script — **no served behaviour changes**.
**Raw evidence:** `docs/evidence/un-operable-controls-2026-10-12/` — the measurement, the full suite, and the
five negative controls that prove the new check can fail.

## 1. Why this file exists — the pattern, not the instances

Three times now, something the product *displays* has had **no path a user can take to operate it**, and each
time a **person** found it, after the fact:

1. The **Exit Intelligence Intake modal** — no opener (decision 16; already documented in
   `exit-intake-reachability-finding.md`, not repeated here).
2. The **employee-record consent instrument** — its route has no caller, and the value its tile prints is
   written by the demo seeder (decision 17).
3. **`GET /api/compliance/report`** — no client code calls it (found while measuring 2).

The suite let all three through for one reason: **it tests writers and readers separately.** A route can have
a passing test and no caller. A tile can have a passing test and no writer that runs in production. Nothing in
the suite asked *"is there a path a user can actually take to this, and is its value produced by something that
runs?"* That missing question is what `server/reachability.test.js` now asks.

This is the same defect class as the pre-15(b) consent gate and the pre-#151 host-path resolution:
**correct-looking code with no live path.**

## 2. The inventory — eight elements, three classes

| # | element | where | class | status |
|---|---------|-------|-------|--------|
| 1 | `GET /api/employees/:id` | `server/index.js:170` | route — no caller | **new here** |
| 2 | `POST /api/compliance/calculate-eosb` | `server/index.js:335` | route — no caller | **new here** |
| 3 | `POST /api/compliance/consent` | `server/index.js:359` | route — no caller | known (decision 17) |
| 4 | `GET /api/compliance/report` | `server/index.js:424` | route — no caller | known (decision 20) |
| 5 | `GET /api/preboarding/cases/:id` | `server/index.js:646` | route — no caller | **new here** |
| 6 | `GET /api/preboarding/flag-watch` | `server/index.js:840` | route — no caller | **new here** |
| 7 | `showExitModal` — Exit Intelligence Intake | `client/src/App.tsx:459` (declaration) | control — never opened | known (decision 16) |
| 8 | the "✓ GRANTED ON {date}" tile | `client/src/App.tsx:1549` | value — no reachable writer | known (decision 17) |

Elements 3 and 8 are **the same instrument** seen from its two ends: the route nothing calls, and the tile
whose value only the seeder writes. They share decision 17, and they should be retired or rewired together.

**Numbering.** §8's disposition table uses **these** numbers and appends §7's `Request` dead end as element
**9** (a class of its own). One scheme in the file, so a ruling can cite a number once.

### Four of these are new

`GET /api/employees/:id`, `POST /api/compliance/calculate-eosb`, `GET /api/preboarding/cases/:id` and
`GET /api/preboarding/flag-watch` had not been recorded anywhere before this measurement. Three of the four
were found by the check on its first run, not by reading code.

### What each one means for Layer 1 — one line each

Nothing in Layer 1 is *broken* by these; each is a capability the product looks like it has and a user cannot
operate, or a figure with no producer. Wire, remove, or write down the choice — "leave it and say so" is only
an answer once it is in this table.

1. **`GET /api/employees/:id`** — the roster is what the UI reads and the detail view takes its employee from
   that list, so this route is dead; it also **decrypts the national ID** and is therefore an unnecessary PII
   surface — **one of two** callerless routes that decrypt a national ID, the other being element 4, which
   does it over the whole roster. **Recommended: remove** (an unoperable control that widens the API is the worst case here).
2. **`POST /api/compliance/calculate-eosb`** — a pure calculator over the request body; the product computes
   EOSB server-side for the settlement statement, so nothing needs the endpoint form. **Recommended: remove**
   (the engine keeps its unit tests; only the HTTP door goes).
3. **`POST /api/compliance/consent`** — the consent instrument. **Recommended: retire** per decision 17
   (retire the instrument, keep the subject), and stop the seeder fabricating consent.
4. **`GET /api/compliance/report`** — a compliance roll-up no client requests. **Recommended: remove.**
   Two measured facts moved this from "the owner's call" to a default. (i) The figure it would display is
   `consentGranted` — the **seeder-written** flag, written in exactly two places: `scripts/seed-demo.js:320`
   and the callerless `POST /api/compliance/consent` (`server/index.js:365`). Wiring it would put a number
   the seeder fabricates in front of a prospect until decision 17 is ruled *(the compliance expert's
   measurement)*. (ii) The handler (`server/index.js:424`) runs `auth.decrypt()` over `national_id_value` and
   `national_id_iqama` **for every employee** to compute those counts — it decrypts the **whole roster** and
   keeps only counts, and nothing calls it. Removing it takes a whole-roster PII read with it.
5. **`GET /api/preboarding/cases/:id`** — single-case detail; the UI reads the list plus the sub-resources it
   shows (checklist, workspace, package). **Recommended: remove** (the list response already carries the case).
6. **`GET /api/preboarding/flag-watch`** — exposes the flag watcher's record over HTTP while the scheduler
   reads the module directly, so it is a second, unused door to one value. **Recommended: wire it to the
   operator check** (it is the natural thing for a monitor to poll) **or remove it**; leaving it means Layer 1
   carries a route that reports on the 48-hour flag to nobody.
7. **The Exit modal** — the only thing that records an exit intake, with no opener. Decision 16 unchanged;
   note that until it is wired, **the exits-by-reason figure on the Strategic Intelligence surface has no
   producer in the product** (the seeder writes the four rows).
8. **The consent tile** — 13/13 demo employees read `✓ GRANTED ON 2026-09-23` because
   `scripts/seed-demo.js:320` writes `consent_granted = 1, consent_date = '2026-09-23'` as **literal values in
   the INSERT**, for every employee, with no basis, no version and no per-purpose scope. The only writer in the
   product is inside a route nothing calls. **Recommended: retire** with decision 17.

## 3. How it was established — and where it cannot be certain

A grep for callers is not enough, so here is exactly what was searched and what was found.

**Searched.** Every file under `client/src`, `scripts/` and `server/` (excluding `*.test.js`, the route
definition file, and this check's own three files) for occurrences of `/api/…`, with:

- **template literals** treated as paths — `:param` in a route matches `${expr}` in a call, one segment each;
- **prefix safety** — a route is not matched as a prefix of a longer path (`GET /api/employees/:id` is not
  considered called by `/api/employees/${id}/onboarding`);
- **method agreement** — the method is read from the call's own `method:` (JS) or `-X` (shell), defaulting to
  GET, which is what `fetch` and curl do;
- **comments skipped** — a path *named in prose* is not a caller. This mattered: `server/preboarding.js`'s
  docblock names `POST /api/preboarding/cases` and `POST /api/employees`, and a scanner that counts those
  reports reachability that does not exist.

**Found.** 28 `/api` routes. 20 reachable from a client call site; 2 reachable *only* through one dynamic call
site (`client/src/App.tsx:1068`, `/api/${endpoint}/${taskId}`, which the ternary at `:1067` resolves to the two
task routes); 6 with no caller anywhere. No client call site names a route that does not exist, and no route is
registered after the SPA catch-all.

**Where this method cannot be certain — stated so a green run is not read as more than it is:**

- **A path composed at runtime is not proven by equality.** There is exactly one such call site today, and it
  is *declared* in `server/reachability-register.js` with what it covers and why. A second one will not be
  silently missed: the test fails until it is declared.
- **A control can be hidden by something that is not a boolean** (a null selection, an empty list). This check
  only sees boolean state.
- **A path built at runtime in a *middle* segment** would not match (a trailing template keeps its literal
  prefix; a middle one would be a mismatch, i.e. a false orphan — reported, then triaged by a person).
- **Prose in a trailing comment** on a code line still counts as a hit, and a mention in an extension this
  scanner does not read (`.md`, `.py`) is not scanned at all.
- **The check cannot tell whether a displayed value is RIGHT** — only whether something that runs produces it.
- **A control rendered inside a JSX branch nothing can reach** is still "called" as far as this check sees.

## 4. The check that now asks the question

`server/reachability.test.js` (9 assertions) + `server/reachability.js` (the measurement) +
`server/reachability-register.js` (the registers). `scripts/reachability-report.js` prints the same measurement
for a person and exits non-zero if a new un-operable element appears, so the tool and the test cannot disagree.

What it asserts, and what each assertion would catch:

| assertion | catches |
|-----------|---------|
| every `/api` route is reachable, or registered callerless with a reason | a new orphan route (C1) |
| the callerless register matches reality exactly | a register that lies — a fixed orphan left in it |
| a dynamic-only route is covered by a declared call site | an undeclared runtime-built path |
| each declared dynamic site still exists and still means what it claims | the declaration going stale (C5) |
| no client call site names an unregistered route | client/route drift (C4) |
| no route is registered after the SPA catch-all | a route dead on arrival (C3) |
| every boolean control state can be opened, or is registered | a control with no opener (C2) |
| a displayed value has a writer in a reachable route, or is registered | a tile the product cannot produce |
| the measurement found routes and call sites at all | the whole check passing vacuously |

**It was reddened before it was trusted.** Five negative controls — one injected regression each, in a
throwaway worktree, reverted between them — each turned exactly the intended assertion red, and the tree
returned green and clean afterwards. Raw output:
`docs/evidence/un-operable-controls-2026-10-12/negative-controls-2026-10-12.txt`.

**One false alarm was found and fixed while building it, and it is worth recording:** the first version pinned
`client/src/App.tsx:1068` as the dynamic call site, so inserting an *unrelated line above it* turned the check
red — a false alarm about a call site that had not moved. Every register anchor is now located by its **text**
(`findOne`), not by a line number. A recorded line number goes stale on its own; this repository has been bitten
by that repeatedly.

Full suite after the change: **163 tests, 35 suites, 0 fail** (was 154 before these 9).

## 5. What a test still cannot find here — the person's share

So the next reader knows what the check does *not* excuse:

- **Semantic value-producing** — a number that is *computed* from seeded inputs, a cohort figure that is
  arithmetically consistent but fictional. The check sees a writer; it cannot see a fake writer.
- **A control that exists only in a screen nobody navigates to** — reachability *within* the product
  (is the surface this button lives on itself reachable?) is not measured here.
- **A route whose only caller is itself unreachable** for a non-boolean reason.
- **Copy that promises a capability the code lacks** — the *reverse* direction: a tile that says a control
  exists when it does not. That is a wording review, not a static check.

## 6. Follow-ups proposed (each its own row — none done here)

1. **Remove `GET /api/employees/:id`** — dead route that decrypts a national ID (one of two; element 4
   decrypts the whole roster) (owner ruling, decision 20).
2. **Remove `POST /api/compliance/calculate-eosb`** if the owner agrees the engine needs no HTTP door.
3. **Execute decision 17** — retire the consent instrument and the tile; stop the seeder writing consent.
4. **`GET /api/compliance/report`** — remove it: the figure it would show is the seeder's, and the handler
   decrypts the whole roster (owner ruling, decision 20). Wiring stays open only behind decision 17.
5. **`GET /api/preboarding/cases/:id`** — remove.
6. **`GET /api/preboarding/flag-watch`** — wire it to the operator check, or remove it.
7. **Decision 16** — unchanged; it is the one instance already documented.

Each fix will fail this check until the register entry is removed too, on purpose: the register is how the
defect stays visible, so removing the code and the entry are one act.

---

## 7. The fourth instance (2026-10-12) — a state a user can enter and cannot leave

Found on the live product by the designer; measured from the source, then observed over HTTP on a
scratch instance (both, below). A **different class** from the three above: not "no caller", not "no opener", but **a control that leads somewhere the product will not
let you leave.**

| where | what it does | line read |
|---|---|---|
| `client/src/App.tsx:2115` | `Request` — **no condition at all** | `sed -n '2115,2119p' client/src/App.tsx` |
| `client/src/App.tsx:2119` | `Mark received` — `disabled={!collectible || !ack}` | same read |
| `server/preboarding-items.js` (`setItemStatus`) | the collect gate fires **only** for `COLLECTED_STATUSES` — `not_started → requested` is not gated | the `COLLECTED_STATUSES.indexOf(status) !== -1` branch |
| `server/preboarding-items.js` (`NOTICE_BASES`) | `education_certificate`, `experience_certificate` (counsel **Q1**) and `emergency_contact` (**Q5**) are `basis: null, collectible: false` | the table, read as data by `parseNoticeBases()` |

**The flow:** press `Request` on one of those three → the status call answers **200**; `Mark received` is
disabled, so there is no next click; the item sits in `requested` forever and keeps counting in
`items_outstanding`. The server refuses `received` with **409** and names the counsel question — the
refusal is right, it just arrives one step too late.

**New assertion (test 10).** `deadEndItems()` measures both guards and the notice table; the test asserts
the dead-end set is **exactly** the registered set, that `Request` is still unguarded and `Mark received`
still guarded, and that every no-basis item is registered — so a fourth one cannot dead-end silently.
Green on the real tree (10 tests / 10 pass / 0 fail); **red under both injections** (C6, C7):
`docs/evidence/un-operable-controls-2026-10-12/negative-controls-flow-2026-10-12.txt`.

**Now measured over HTTP** (2026-10-12, after a first attempt died on my own probe's assumptions — both
runs are on file). A scratch instance of `origin/main` `1dae076` (port 4720, its own database; the live
product on 3000 was left alone and answered 200 before and after) reproduces the whole path raw:

| step | request | answer |
|---|---|---|
| the seeded demo case | `GET /api/preboarding/cases/:id/checklist` | **7** employee items, the three no-basis ones among them |
| a case the product opens | `POST /api/preboarding/cases` (accepted offer) | **201** — the same seven items |
| press `Request` | `POST …/items/education_certificate/status {status:"requested"}` | **200** — the item becomes `requested` |
| press `Mark received` | same route, `{status:"received"}` | **409** — "*cannot be collected in this release … (pending counsel Q1)*" |
| after both calls | `GET …/checklist` | still `requested` — **entered, cannot leave** |
| the roll-up | `GET /api/preboarding/checklist/overview?jurisdiction=AE` | `items_outstanding` **21 → 28** with the new case, and **still 28** through all three stranded requests |

`experience_certificate` and `emergency_contact` behave identically (409 naming **Q1** and **Q5**).
Transcript: `docs/evidence/un-operable-controls-2026-10-12/rig-instance-4-2026-10-12.txt`. The first,
incomplete attempt stays on file at `rig-attempt-instance-4-2026-10-12.txt`, superseded by it.

So the dead end is worse than "a refusal one step too late": **the item counts against the case
permanently** — the roll-up never moves while it sits in `requested`, and no status the product accepts
can clear it. It is reachable on the shipped demo, not only in a case a user creates.
**Correction to my own method:** the first probe located its items by searching the payload recursively,
and on two cases it landed on a shorter nested array — reporting four-item checklists where the answer is
seven. The transcript reads the documented top-level `items` field, filtered to `track === 'employee'`.

## 8. Dispositions — wire or remove, and what each costs

Numbered as **§2** — the same element numbers, with §7's `Request` dead end appended as **9**, a class of its
own. One scheme in this file, so a ruling can cite a number once.

| # | element | wire it — cost | remove it — cost | recommendation |
|---|---------|----------------|------------------|----------------|
| 1 | `GET /api/employees/:id` | a detail view nothing needs | ~14 lines; also **one of two** callerless routes that decrypt a national ID (the other is #4) | **remove** |
| 2 | `POST /api/compliance/calculate-eosb` | a calculator UI nobody asked for | ~9 lines; the engine keeps its tests | **remove** |
| 3 | `POST /api/compliance/consent` | nothing to build: 15(b)'s notice-shown record carries basis, version and actor; retire the boolean, re-point the tile | same edit — the instrument goes either way | **remove** (17) |
| 4 | `GET /api/compliance/report` | build the screen it implies — but the account it would print is `consentGranted`, the **seeder-written flag** (`scripts/seed-demo.js:320`; the only other writer is the callerless `POST /api/compliance/consent`, `server/index.js:365`), so wiring it puts a fabricated compliance figure in front of a prospect until decision 17 is ruled *(the compliance expert's measurement)* | ~10 lines, and nothing reads it — **and it takes a whole-roster PII read with it**: the handler at `server/index.js:424` runs `auth.decrypt()` over `national_id_value` and `national_id_iqama` for **every employee** and keeps only counts | **remove** — the default; wiring stays open only behind decision 17 |
| 5 | `GET /api/preboarding/cases/:id` | nothing needs it — the list carries the case | ~20 lines | **remove** |
| 6 | `GET /api/preboarding/flag-watch` | point the operator check at it | one route | **wire** |
| 7 | the Exit modal (decision 16) | a placement + a copy pass + the `satisfaction_score` default | delete the modal, `POST /api/exit-interviews` and the `exit_interviews` read behind `exitsByReason` — the only producer of a shipped figure | **wire** |
| 8 | the "✓ GRANTED ON {date}" tile | re-point it at 15(b)'s notice-shown record — nothing to build; that record carries basis, version and actor | retire the instrument with the tile, and stop the seeder writing consent | **retire the instrument** (decision 17) |
| 9 | the `Request` dead end (§7) | guard the control for non-collectible items **and** refuse `not_started → requested` with the 409 the collect gate already writes | nothing to remove; the alternative is to leave it and label it | **wire the guard** (the item's collectibility is counsel's, Q1/Q5) |
Every fix lands with its register entry removed in the same commit — the test fails otherwise, on purpose.
