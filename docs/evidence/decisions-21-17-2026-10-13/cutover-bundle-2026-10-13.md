# The cutover bundle — three items, measured

**2026-10-13, follow-up commit on `feat/decisions-21-17-remove-pii-routes-consent`** (PR #182 merged as
`9ce469d`; a merged PR cannot be reopened, so this rides the same branch into a new PR). Parent head
`560cffc`. Nothing is deployed — the deploy is the lead's and the owner's gate, and this file reports
numbers only.

## 1. Item 1 — the PII route removals and the instrument retirement (already merged)

Not repeated here: `README.md` in this directory, and `un-operable-controls-inventory.md` §9. Route table
200→404 on all three, seeder 13→0, bundle `GRANTED ON` 1→0.

## 2. Item 2 — `server/db.js`, the pinned-path refusal (folded in only because it keeps the guard green)

**What changed:** `db.js` keeps its fallback (`process.env.PRODUCT_DB_PATH || '/home/team/.data/antum-product.db'`,
line 25 — the product still needs it) and now **refuses** to use it when the test runner is the caller:
if `PRODUCT_DB_PATH` is unset and `NODE_TEST_CONTEXT` is set, the module throws before it opens anything,
naming the pin and the guard. 12 insertions / 1 deletion, one `if` block — the "three lines" grew a little
to carry the reason, which is the point of it.

**Red-then-green, on the real tree** (`dbjs-refusal-and-guard-red-then-green.txt`, copied verbatim):

| step | result |
|---|---|
| guard test on the fixed tree | **3 tests / 3 pass / 0 fail**, exit 0 |
| the guard's premise assertions still match | fallback line intact at `db.js:25`; refusal conditioned on `NODE_TEST_CONTEXT` |
| an **unpinned** test file (`zz-unpinned-probe.test.js`, written for the purpose) | exit **1** — `PRODUCT_DB_PATH is unset while running under the test runner …` — the file can no longer reach the live database |
| the **static guard** reddens on that same file | exit **1**, `# pass 2 # fail 1`, naming it: *"loads db.js (directly or transitively) and never sets PRODUCT_DB_PATH — it would run against the live database"* |
| hazard file removed | exit 0, **3/3 green** again, tree clean (only the two intended files modified) |
| full suite | **168 tests / 35 suites / 168 pass / 0 fail**, exit 0 |

So the fix is **load-bearing and the check is not weakened**: the static check still catches an unpinned
file, and the runtime refusal catches the same hazard even if the static check were bypassed. The pinned
direction is exercised by the suite itself: every test file pins, and all 168 pass.
(The one line my transcript's `tail -1` swallowed in step 2 is Node's own `ExperimentalWarning`; the
throwaway-pinned run exited 0 with no error.)

**The live product database was never opened.** Same bytes, same mtime, before and after:
`229376 bytes, mtime 2026-10-12 06:42:04`, md5 `7c74c485fe925a6d0498df825d40f64c`; live product on port
3000 answered **200** at the end. The production direction is asserted against the *source* (the fallback
line is still there), not by binding the live file.

## 3. Item 3 — the last textual trace of the retired instrument

`git grep "Consent recorded" origin/main -- client server` returned exactly one hit,
`server/preboarding-workspace.js:56` — a comment justifying a workspace line the product omits:
*"Consent recorded" is the PDPL consent record the employee track's gate already reads*. That described the
retired instrument. It now reads:

> **"Consent recorded" would name the employee-record consent flag the product **retired** on 2026-10-13
> (owner decision 17): what the gate actually reads is the notice recorded as *shown*, one row per
> collectable document per case, with its basis, the notice version and a named actor.

4 insertions / 2 deletions, comment only — no behaviour, no route, no query. The phrase survives deliberately
as the *name of the line being omitted*; what is gone is the claim that the gate reads a consent record.

## 4. Cutover debt — measured, not acted on

| measurement (served tree `9d2182a` → head) | value |
|---|---|
| files | **114** |
| …under `client/` | **1** (`client/src/App.tsx`) |
| …under `server/` | **8** |
| client asset | `index-Bh1-0KrL.js`, 274,243 B, md5 `91f05725…` (unchanged since the removal commit) |
| this follow-up | `server/db.js` +12/−1, `server/preboarding-workspace.js` +4/−2 |

A cutover is **owed** (one served server file and the client bundle both differ from the served tree).
**Nothing was deployed**; no cutover script was run or scheduled.
