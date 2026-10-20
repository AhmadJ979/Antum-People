# Movement 2026-10-20T16:08:51Z → 16:09:19Z (28 s) — the guard fix, and the run that accepted it

Deployed `58acdac` (merge of **#272**, `fix/guard-role-not-shape`). Filed by **agent-product-designer**
under row `d9a3d818`, from the host directory `/home/team/shared/movements/2026-10-20T1607Z/`, the same
way the 15:11Z pack (`docs/evidence/movement-2026-10-20T1511Z/`, PR #274) was filed.

Two figures a reader comes here for:

- **This movement installed #272's guard fix** — the change that decides a duplicate guard by its *role*
  rather than by a string in its command line (`movement.log`, plus the diff's own tests at
  `scripts/guard-role-vs-shape-test.sh`).
- **The acceptance run is SEPARATE from the movement's own re-arm.** The movement re-armed the watchdog
  inside its own log at 16:09:19 (`movement.log`, step 6). The decoy acceptance ran at **16:10:51–16:10:58**
  (`guard-acceptance2.out`) and the predicate test against the **pre-fix** revision is its own file
  (`guard-predicate-test.out`). A movement that installs a fix cannot be its own acceptance test; these
  files are the run that came after it.

**`MOVEMENT.md` is the lead's own summary, carried here as a claim to verify, not as a source.** Every
claim below names the file that proves it. Where a file contradicts the summary, the file is filed and the
contradiction recorded (section 11).

## 1. How this pack was filed

| step | evidence |
|---|---|
| copied with `cp -p` semantics (`shutil.copy2`), mtimes preserved | `md5sums.txt` |
| **39 of 39** carried files verified **md5-identical to the host copy AFTER the copy** | re-run: `python3 -c` over `source-inventory.txt` (see section 14) |
| all 41 source files enumerated, 2 excluded, with hashes and reasons | `source-inventory.txt` |
| every file in this pack tracked by git (the `*.log` trap — `.gitignore` hides `*.log`) | `pack-check.py`, direction 3; `pack-check-runs.txt` |

## 2. The movement, step by step — `movement.log`

| claim | value | file |
|---|---|---|
| run window | 16:08:51Z → 16:09:19Z (**28 s**) | `movement.log` first/last lines |
| tree moved to `58acdac` | "HEAD is now at 58acdac Merge pull request #272 from AhmadJ979/fix/guard-role-not-shape" | `movement.log` |
| remote main at the same revision | `58acdac82f7182142370a0d65ea383996ec73f0f refs/heads/main` | `remote-main.txt` |
| host tools **7 of 7** refreshed from `58acdac82f71` | "RESULT: 7 of 7 copies installed or refreshed" | `movement.log` |
| the guard hook's body | md5 `728bf2cce72b8c6f9a3cf257f3dfc070` | `movement.log` (both runs) |
| **the second tooling run changed no byte** | "nothing to do — all 7 copies already match this source (a second run changes no byte)" | `movement.log`, 16:09:19 block |
| build | `dist/assets/index-BK_EwcpZ.css 35.30 kB`, `dist/assets/index-C9vf7pQB.js 277.79 kB`, "client build OK" | `movement.log` step 2 |
| seed | `eosb_accrued 19824.78` rendered == record; **unfilled [brackets]: NONE**; net payable `32824.78` | `movement.log` step 3 |
| restart | "stopping pid 22861 / port 3000 held by the product server (pid 21062)" | `movement.log` step 4 |
| verify | 200 `<title>Antum People</title>`, bad password 401, roster 200 (13 employees), 3 cases / 21 items, flag states `['clear','inside_48_hours','started']`, KSA checklist 10 tasks | `movement.log` step 5 |
| re-arm | watchdog pid 21352; marker written and removed; deploy copy revision `58acdac82f71` | `movement.log` step 6 |

## 3. The after-state, downloaded from the public URL — `verify-live.out`

| measured | value |
|---|---|
| public | 200, `<title>Antum People</title>` |
| bundle named by the served HTML | `assets/index-C9vf7pQB.js` |
| served bundle, **bytes downloaded and hashed** | **277,790 B**, md5 `e6ff5da3fd614ddcfe2c0beaa68164f4` — "MATCH: the served bundle is the stated after-state" |
| served stylesheet | **35,306 B**, md5 `cb54e6164a8e741ed807bac94577efcd` — MATCH |
| the listener is ours | pid **21062**, cmdline `node index.js`, cwd `…/probable-octo-sniffle/server` |
| auth contract | no token 401, bad password 401, token **215** chars, roster 200 |
| the guard | lock names **24580**, its argv `bash scripts/keep-alive.sh`, `lsof` holder **24580** (one) |
| the tree | HEAD `58acdac`, remote main `58acdac82f71`, **0 modified paths** |

The pack's own `preflight-defect.txt` is the other half of this figure: the true bytes for this movement
are `index-C9vf7pQB.js 277790 B e6ff5da3…` and `index-BK_EwcpZ.css 35306 B cb54e616…`, and the preflight
that claimed otherwise is the defect in section 8.

## 4. The guard fix, accepted live — the point of this movement

1. **The predicate, against the pre-fix revision** (`guard-predicate-test.out`, run
   `scripts/guard-role-vs-shape-test.sh --old 2b14a94`, old md5 `ed31f5285bab`):
   - OLD calls **2 decoys** duplicate guards **and** the real loop (`decoy(s) called guards: 2   real loop
     called guard: 1`);
   - NEW calls **0 decoys** and **still the real loop** (pid 23351);
   - verdict block: `ok OLD counts 2 decoy(s)…`, `ok NEW counts 0 decoys…`,
     `ok BOTH count the real loop (pid 23351) - the true positive survives (anti-vacuous)`.
   **The anti-vacuous control is the point of this file:** a predicate that called *nothing* a guard would
   also have "fixed" the defect.
2. **The arm, with two naming decoys alive** (`guard-acceptance2.out`): the decoys' argv asserted as the
   kernel holds them; the armed guard **reaped by the PID its own lock names** (never `pkill -f`) and its
   own exit line `2026-10-20T16:10:54+00:00 EXIT: killed by SIGTERM (loop pid 23351)`;
   `ARMED FIRST/SUCCESSFUL ATTEMPT: pid 24580`; `role-loops now: 24580` (exactly one);
   `refusals logged in this window: 0`; decoys still alive 2 of 2; public 200 throughout, and 200 after
   the decoys died.
3. **Both halves in one run, with exit codes** (`guard-evidence.out`, produced by `run-guard-evidence.sh`):
   `predicate test exit=0`, `arm acceptance exit=0`, `final: lock names 24580; site 200`.
4. **The instrument that produced 2** is `guard-acceptance2.sh`; the void first version of it is
   `guard-acceptance.sh` (section 5).

Why the trap was avoidable and was still hit: `MOVEMENT.md` records that the shipped test documents it —
`bash -lc '…; sleep 240'` execs its last command, so the process stops naming the path.

## 5. TWO ARTEFACTS IN THIS PACK ARE WRONG ON PURPOSE — do not read either as evidence

| file | md5 | what it is, and why it is void |
|---|---|---|
| `guard-acceptance.out` | `b0091eedb4b8c4f853ae3087014f8ee0` | **The lead's first arm run, VOID.** The decoy was `bash -lc '…; sleep 240'` and bash exec'd the last command, so the process became `argv: sleep 240` — it never named the path, and the arm proved nothing. The file's own line 267 prints `decoy argv: sleep 240` while its next line asserts "the decoy names the path" — **the run's stated premise is contradicted by its own argv dump.** The corrected version asserts the decoy's shape and **refuses to report a verdict (exit 2)** if it is wrong. Kept as wrong. |
| `suite-client-WRONG-vitest.out` | `9cca30aa81b598eb2f49c1816fef387b` | **A rig with the wrong dependencies entirely, VOID.** It ran `npx vitest run --reporter=basic` (`client suite exit=1`); this repository has **no vitest** — `client/package.json` runs `node --test src/*.test.js`; npx pulled `vitest@5.0.5` from the registry and died on the reporter. |

A third file needs the same care and is **not** one of the two above — see section 6.

## 6. `verify-live.console` is an EARLIER, SUPERSEDED run — it is not the after-state

`verify-live.console` and `verify-live.out` are **different runs of the same script**, and they disagree:

| field | `verify-live.console` (earlier) | `verify-live.out` (the after-state) |
|---|---|---|
| served js | `889e7270d1555c8acf65d23f1cccbd86 799 B` → **MISMATCH** | `e6ff5da3… 277790 B` → MATCH |
| served css | `889e7270d1555c8acf65d23f1cccbd86 799 B` → **MISMATCH** | `cb54e616… 35306 B` → MATCH |
| good login | token **0** chars | 215 chars |
| roster with token | **401** | 200 |
| retired routes | 401 / 401 | 403 / 403 |

Both js and css hashing to the **same 799-byte document** is the signature of the fallback document being
served for both asset URLs. The file ends `verify-live exit=0`.

**That exit code is itself a finding, checked and not assumed:** in `verify-live.sh`, the two
MATCH/MISMATCH lines are `say` calls and the script contains **no `exit` statement** — so the instrument
prints a mismatch and exits 0. A reader must not take `verify-live exit=0` as an assertion that the served
bytes matched the stated after-state; the match is carried by the MATCH lines in the good run, which do.

## 7. `verify-live.console2` is byte-identical to `verify-live.out`

One md5, `45b3f17ebaafdfdfa9ae49ce36f48a33`, two filenames — the same run captured twice. It is not a
second, corroborating measurement. (The 15:11Z pack had the same shape: `movement.log` and
`cutover-…-evidence.txt` shared one md5.)

## 8. The preflight defect — a gate whose knob is half-overridable

Three runs of the same preflight, all filed:

| file | outcome | the line that matters |
|---|---|---|
| `preflight-full.txt` (16:07:44Z, no override) | **FAIL — 3 precondition(s) do not hold** | deployed HEAD `2b14a94` vs expected `e19a98a`; public HTML names `assets/index-C9vf7pQB.js` when `assets/index-Bh1-0KrL.js` was expected; the moved-tip FAIL: `58acdac82f71 is 145 commit(s) past the measured d0422f4 and client/ CHANGED … the expected bundle hash is unknown`, after-state `assets/ <unknown>` |
| `preflight-recut.txt` (16:08:15Z, tip overridden) | **PASS** | and it prints an after-state this tree **never built**: `assets/index-BG0peuOK.js 274242 B md5 f65f15c109e76e86cd8b8abe7102f748`, `assets/index-pNSrK3wr.css 35365 B md5 eda548202468a7e0293053981037a594` |
| `preflight-reddened.txt` (16:08Z, deliberately wrong expectation `assets/index-WRONGNOPE.js`) | **FAIL — 1 precondition(s) do not hold** | proves this gate *can* redden, which is why the middle row is a defect of the override and not of the gate |

`preflight.txt` is the 20-line excerpt of the first run's status blocks. `preflight-defect.txt` is the
written finding: `MEASURED_TIP` is env-overridable (`cutover-preflight.sh:85`) while
`MEASURED_ASSET`/`MEASURED_ASSET_BYTES`/`MEASURED_ASSET_MD5`/`MEASURED_CSS*` are hardcoded, last measured
2026-10-17 at `8fb4390` — so overriding the tip alone re-points the gate at a tip while keeping another
tip's bytes, and the run goes **green carrying a number that was never measured**.

## 9. The retired routes — and a probe that cannot tell *retired* from *never registered*

`MOVEMENT.md` and `verify-live.out`'s own section heading say the two retired routes "still answer 404".
They do not. From `retired-routes.out`:

- `/api/employees/demo-emp-omar` — **403** with a token (`Content-Length: 0`), **401** without one;
- `/api/compliance/report` — the same;
- `/api/nonexistent-route-xyz`, a path that never existed — **403** with a token, **401** without.

The deny-by-default `/api` gate fires before routing, so *retired* and *never registered* are
indistinguishable from outside. **The stated after-state does not hold**; the retirement is provable in the
source, not by probing. This is filed as a contradiction, not repaired: `MOVEMENT.md` records it too.

## 10. Suites at the deployed tree

| suite | result | file |
|---|---|---|
| server | `# suites 51`, `# pass 276`, `# fail 0`, `# skipped 0`, `server suite exit=0` | `suite-server.out` |
| client | `# suites 4`, `# pass 26`, `# fail 0`, `# skipped 0`, `client suite (npm test) exit=0` | `suite-client.out` |
| client, first attempt | `client suite exit=1`, vitest stack | `suite-client-WRONG-vitest.out` (**void**, section 5) |

The client suite's runner is `run-client-suite.sh` — the wrapper that produced the correct pair.

## 11. Contradictions and empty fields found while verifying this pack

Recorded, not repaired:

1. **`verify-live.out` states an after-state for the retired routes (404) that its own measurement
   refutes (403/401).** Section 9. `retired-routes.out` is the probe.
2. **`verify-live.out`'s local comparison was never taken**: the fields
   `deployed dist js md5 (built this movement)` and `deployed dist css md5` are **empty**. Only the
   public-URL bytes carry the after-state claim; the build's own output is in `movement.log` step 2.
3. **`verify-live.console` contradicts `verify-live.out`** (799-byte document for both assets, token 0,
   roster 401) and **still exits 0** — section 6. Two runs, one filename apart; a reader must use
   `verify-live.out`.
4. **`verify-live.console2` adds no measurement** — byte-identical to `verify-live.out` (section 7).
5. **The preflight's green run names a bundle this tree never built** (section 8), and its WARN line
   states the belief behind it ("the built bundle is still index-BG0peuOK.js").
6. **`guard-acceptance.out` asserts a premise its own argv dump contradicts** (section 5).
7. **The PR list came from a route that failed first**: `prs-open.json` is
   `HTTP 401: Bad credentials (https://api.github.com/graphql)` and `prs-open.status` is `exit=1`, while
   `prs-open.txt` carries the list of **7** open PRs. Both are filed: the attempt that failed and the
   result that succeeded. The instrument is `get-prs.sh`; `review-prs.sh` is the reviewer's pass over them.
8. **`board-now.txt` is not movement evidence**: it was written at **17:07Z**, after the movement (a later
   board query showing the two then-in-progress rows). It is carried for completeness and labelled here.

## 12. Scope: what is carried, and what is not

The source directory holds **41** files. This pack carries **39**. The two not carried are
`plan-current.md` and `plan-current.json` (md5 `179fc2cc0f4cf2d6e0491733cf981904` and
`16bfaa3b96e3ad8f535aafe3a1b38534`, 82 and 5 lines): snapshots of the plan document, which is a live
document that lives outside this repository — a copy here would drift and could be mistaken for it.
`source-inventory.txt` lists **every** source file with its md5 and says `carried` or `excluded` with the
reason, so nothing is omitted quietly.

The board and tracker files that *are* carried (`board-counts.txt`, `board-open.txt`, `board-now.txt`,
`task-results.txt`, `pr-review.txt`) are the movement's recorded context, not evidence for the fix.

## 13. State at filing (added 2026-10-20 by agent-product-designer, after the movement)

Everything above describes the movement as it happened. Since then, independently of it:

- **#262 and #260 merged** (`83a53ff` = #260, `61914f4` = #262). `main` is now `61914f4`; this pack's
  branch is cut from it. So `MOVEMENT.md`'s "7 PRs await the owner's tap: #260, #262, #265, #269, #271,
  #273, #274" is **as of 16:12Z**: #260, #262, #265, #269, #271 and #274 have since merged; #273 remains
  open (read from the API at filing).
- **The ordering constraint `MOVEMENT.md` records — "#262 before the held exception-deletion"
  (row `33943cd4`) — is now met**, and its condition has fired: with #262 in `main`, `scripts/check-all.py`
  still declares `access-model` as `expect="known-red"` while the instrument reads green, which the entry
  point classifies as **STALE-EXCEPTION** and fails the run on. The deletion is prepared and open as
  **PR #275** (`hold/access-model-stale-exception`), no longer held by ordering, and awaiting the owner's tap.

## 14. How to check this pack

```sh
python3 docs/evidence/movement-2026-10-20T1607Z/pack-check.py     # exit 0 = the three directions hold
```

- **Direction 1** — every file in this directory is named in `README.md`.
- **Direction 2** — every filename this README names (in backticks) exists: in the pack, in the
  repository, or in the asserted external-names block (paths that live outside the repository, printed
  with their count).
- **Direction 3** — every file in this directory is **tracked by git**. Added after `.gitignore`'s `*.log`
  (line 6) dropped three files from the previous pack while the working tree looked complete; `git add -f`
  is required for the `.log` files here too.
- **Direction 4** — `md5sums.txt` is not stale: it matches the bytes of every file it lists. It lists
  every file in this pack **except itself and `pack-check-runs.txt`** — a log that records the verifying
  runs cannot be covered by a manifest generated from them, and the exclusion is one rule, printed by the
  check every run, rather than a gap.

`pack-check-runs.txt` holds the runs verbatim, **including two real reddenings of direction 3**: the pack
before anything was added to the index (0 tracked, 42 untracked), and the state after an `git add -f` whose
globs missed three files — the check named exactly the three (`prs-open.json`, `prs-open.status`,
`verify-live.console2`), which is the same class of miss as the `.gitignore` trap it exists to catch. A
check that cannot redden proves nothing.

## 15. Files in this pack

Evidence: `MOVEMENT.md`, `movement.log`, `verify-live.out`, `verify-live.console`,
`verify-live.console2`, `guard-predicate-test.out`, `guard-acceptance2.out`, `guard-acceptance.out`,
`guard-acceptance.console`, `guard-evidence.out`, `preflight-defect.txt`, `preflight-full.txt`,
`preflight-recut.txt`, `preflight-reddened.txt`, `preflight.txt`, `retired-routes.out`,
`suite-server.out`, `suite-client.out`, `suite-client-WRONG-vitest.out`, `remote-main.txt`,
`prs-open.txt`, `prs-open.json`, `prs-open.status`, `board-counts.txt`, `board-open.txt`,
`board-now.txt`, `task-results.txt`, `pr-review.txt`.

Instruments: `verify-live.sh`, `run-verify.sh`, `run-verify.console`, `guard-acceptance.sh`,
`guard-acceptance2.sh`, `run-guard-evidence.sh`, `run-guard-evidence.console`, `run-client-suite.sh`,
`get-prs.sh`, `review-prs.sh`, `snapshot-state.sh`.

Filed with the pack: `README.md`, `md5sums.txt`, `source-inventory.txt`, `pack-check.py`,
`pack-check-runs.txt`.
