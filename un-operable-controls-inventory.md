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
   surface. **Recommended: remove** (an unoperable control that widens the API is the worst case here).
2. **`POST /api/compliance/calculate-eosb`** — a pure calculator over the request body; the product computes
   EOSB server-side for the settlement statement, so nothing needs the endpoint form. **Recommended: remove**
   (the engine keeps its unit tests; only the HTTP door goes).
3. **`POST /api/compliance/consent`** — the consent instrument. **Recommended: retire** per decision 17
   (retire the instrument, keep the subject), and stop the seeder fabricating consent.
4. **`GET /api/compliance/report`** — a compliance roll-up no client requests. **Recommended: wire or remove**
   — it is the only one of the six that looks like a *missing screen* rather than stray code, so the decision
   is genuinely the owner's.
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

1. **Remove `GET /api/employees/:id`** — dead route that decrypts a national ID (owner ruling, decision 20).
2. **Remove `POST /api/compliance/calculate-eosb`** if the owner agrees the engine needs no HTTP door.
3. **Execute decision 17** — retire the consent instrument and the tile; stop the seeder writing consent.
4. **`GET /api/compliance/report`** — wire it to a screen, or remove it (owner ruling; this one looks like a
   missing screen).
5. **`GET /api/preboarding/cases/:id`** — remove.
6. **`GET /api/preboarding/flag-watch`** — wire it to the operator check, or remove it.
7. **Decision 16** — unchanged; it is the one instance already documented.

Each fix will fail this check until the register entry is removed too, on purpose: the register is how the
defect stays visible, so removing the code and the entry are one act.
