# The reachability checker decided "call site" from a string's shape

Row `ff31a942`. The scanner read **any** uncommented `/api/...` in a client file as a CALL SITE. So
#254's merge result (`23989a0`) was RED — `257/51/256/1`, drift entry `GET /api/analytics at
client/src/panelResults.js:106` — because `panelLabelOf` compares a url against `'/api/analytics'` to
choose a human label. **A string nobody ever fetches was reported as a caller.**

The client literal was mine and it was fixed on the client side (PR #256); the check was **not**
weakened to make that merge green. This row is the check's own defect. It is the 2026-10-19 decision —
*a check must test the role a string plays* — one level up: the checker was testing the **shape**.

## What changed

`server/reachability.js` now applies ONE role test in every scope: a mention is a call site only when a
request-shaped call is within three lines of it. The shell scope already worked this way; JS/TS now does
too. The call shape is matched as a **family** (any identifier ending in `fetch`/`Request`, plus
`fetch(`, `axios`, `http.<verb>(`) and a helper outside the family must be declared in
`EXTRA_REQUEST_HELPERS`, which an anti-rot test requires to exist in the client tree — a roster nobody
checks is a guess.

**A mention that stops counting as a caller is not dropped: it moves to the PROSE bucket and is
printed** (`scripts/reachability-report.js` prints it beside the drift result). The check may not
silently shrink, so the price of the role test is paid in public.

## The runs (`runs.txt`, re-runnable)

| # | tree | scanner | call sites | drift |
|---|---|---|---|---|
| 1 | `23989a0` (#254) | old | 42 | **1** — `GET /api/analytics at client/src/panelResults.js:106` |
| 2 | `23989a0` (#254) | new | 38 | **0** — and the four label literals are PROSE at the same `file:line` |
| 3 | set comparison on `23989a0` | — | 42 → 38 | the only 4 lost entries ARE those labelling comparisons; 0 gained |
| 4 | `23989a0` + a planted caller | new | 39 | **1** — `GET /api/definitely-not-registered` (ANTI-VACUOUS CONTROL) |
| 5 | product tree, this branch | new | 38 | 0 | (identical to 38 before the change) |

**Run 4 is the one that matters.** Without it, "no drift" could mean "the check sees nothing" rather
than "nothing is wrong". The probe file lives outside the product (`/tmp/probe/planted.js`) and is
pointed at with an extra root, so no deliberately broken call site is ever written into the tree.

**Run 3 is the one that stops a false negative hiding.** Every mention that left the call-site set is
named. On the #254 tree all four are the labelling comparisons; on the product tree the sets are
identical, 38 before and 38 after. A test asserts the real set stays non-empty and still contains the
client's own calls, so a future family rule that lost the client would fail rather than pass quietly.

## Residual blind spots — stated, not implied

* a path built into a variable in one place and passed to a request somewhere far away;
* a path whose middle segment is composed at runtime;
* a helper whose name carries no fetch/request token and was not declared in `EXTRA_REQUEST_HELPERS`.

Each of these is reported as PROSE rather than as a caller, so a human reading the report sees it — the
check does not claim to be exhaustive, and this list is the part it does not claim.

## Where the assertions live

`server/reachability.test.js`, six tests at the foot of the file: the role test itself (comparison, map
key, cache key), request-shaped calls of four forms including one split across lines, the **anti-vacuous
control**, the **#254 regression** (the exact code that reddened `23989a0`), the guard that the real
client callers were not silenced, and the anti-rot check on the declared helpers.

`server/` + test-only: **no movement, no served behaviour change.** Measured at the end: server suite
**263 tests / 51 suites / 263 pass / 0 fail** (257 + these 6).
