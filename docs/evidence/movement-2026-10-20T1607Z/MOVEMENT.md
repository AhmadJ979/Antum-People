# Movement 2026-10-20T16:08:51Z → 16:09:19Z (28 s) — `58acdac`

Deployed **`58acdac`** (merge of **#272**, `fix/guard-role-not-shape`). This is the movement that
installs the guard fix on the host **and** the first one whose acceptance is the fix itself.

## What the movement did
| step | result |
|---|---|
| 1 fetch/reset | tree at `58acdac`; `git ls-remote origin refs/heads/main` = `58acdac82f7182142370a0d65ea383996ec73f0f` — the host no longer lags `main` |
| 1b host tools | **7 of 7** refreshed from `58acdac82f71`; the guard hook body md5 `728bf2cce72b8c6f9a3cf257f3dfc070`; the immediate second run was **idempotent — 7 unchanged, 0 bytes moved** |
| 2 build | `index-C9vf7pQB.js` 277.79 kB, `index-BK_EwcpZ.css` 35.30 kB |
| 3 seed | rebuilt; `eosb_accrued 19824.78` rendered == the record; **unfilled [brackets]: NONE**; net payable 32824.78 |
| 4 restart | port 3000 held by the product server (pid 21062) |
| 5 verify | 200 `<title>Antum People</title>`; bad password **401**; roster 200 (13 employees); 3 cases / 21 items; 3 distinct flag states `clear / inside_48_hours / started`; KSA checklist 10 tasks |
| 6 re-arm | watchdog armed; the previous guard was reaped by the PID its own lock names and wrote its own exit line |

## The after-state, measured — and the one place it was misstated
- Carried forward: `client/` is **proven byte-identical** between the tip whose build was measured
  (`2b14a94`) and the shipping tip (`58acdac`): `git diff --name-only 2b14a94 origin/main -- client/`
  is empty. The movement's own step-2 build then *confirmed* it at `58acdac`.
- Verified from the **public URL**, bytes downloaded and hashed:
  `index-C9vf7pQB.js` **277,790 B / md5 `e6ff5da3fd614ddcfe2c0beaa68164f4`**,
  `index-BK_EwcpZ.css` **35,306 B / md5 `cb54e6164a8e741ed807bac94577efcd`** — both **MATCH** the stated after-state.
- **DEFECT, recorded not used (`preflight-defect.txt`).** `cutover-preflight.sh` makes `MEASURED_TIP`
  overridable (line 85) but hardcodes the build record beside it (`MEASURED_ASSET=index-BG0peuOK.js`,
  274,242 B / `f65f15c1…`, last measured 2026-10-17 at `8fb4390`). Re-cutting the tip therefore produced a
  **green run stating a bundle that was never built**: `index-BG0peuOK.js 274242 B`. The gate is only
  half-overridable, so the override defeats it instead of reddening it. The true number came from the
  build and the public URL, both recorded above.
- **A second stated after-state that does not hold (`retired-routes.out`).** The package says the two
  retired routes answer **404**. They answer **403 with an empty body** when a token is presented and
  **401** without one — and a control path that never existed (`/api/nonexistent-route-xyz`) behaves
  **identically**. The deny-by-default `/api` gate fires before routing, so *retired* and *never
  registered* are indistinguishable from outside; the retirement is provable in the source, not by probing.

## The guard fix, accepted live (the point of this movement)
1. **The predicate, against the pre-fix revision** — `scripts/guard-role-vs-shape-test.sh --old 2b14a94`
   (`guard-predicate-test.out`): OLD (md5 `ed31f528`) calls **2 decoys** duplicate guards **and** the real
   loop; NEW calls **0 decoys** and **still the real loop (pid 23351)**. The true positive survives —
   the anti-vacuous control.
2. **The arm, with naming probes alive** — `guard-acceptance2.out`: two decoys in the log's exact shape
   (asserted: interpreter, a FLAG in argv[1], the path named). The armed guard was reaped by its own lock
   PID and wrote its own exit line (`EXIT: killed by SIGTERM (loop pid 23351)`); **the arm then succeeded
   on the first attempt in 1 s with 0 refusals**, leaving exactly one role-loop; the site answered 200
   throughout, and again after the decoys died.
3. **My first acceptance run was VOID and is kept** (`guard-acceptance.out`): the decoy was
   `bash -lc '…; sleep 240'` and bash **execs the last command of `-c`**, so the process became
   `argv: sleep 240` — it stopped naming the path, and the arm proved nothing. The corrected version
   asserts the decoy's shape and **refuses to report a verdict (exit 2)** if it is wrong. The shipped test
   documents the same trap at its line 87 — the construction was there to copy and I did not copy it first.

## Suites at the deployed tree
- server: **276 tests / 276 pass / 0 fail / 0 skipped**, exit 0 (`suite-server.out`)
- client: **26 tests / 26 pass / 0 fail / 0 skipped**, exit 0 (`suite-client.out`)
- **My first client run is kept as wrong** (`suite-client-WRONG-vitest.out`, exit 1): I invoked
  `npx vitest run --reporter=basic`, and this repo has **no vitest** — `client/package.json` runs
  `node --test src/*.test.js`; npx pulled `vitest@5.0.5` from the registry and died on the reporter.
  A rig with the wrong dependencies entirely, which is the class the plan already records.

## Host state after
`verify-live.out`: public 200 `<title>Antum People</title>`; listener pid 21062 `node index.js` with
cwd = the deployed tree's `server/`; no token **401**; bad password **401**; token 215 chars; roster
**200**; guard lock names 24580, its argv `bash scripts/keep-alive.sh`, `lsof` holder 24580 (one);
tree `58acdac` == remote `main`, 0 modified paths.

## Open at close
**7 PRs await the owner's tap: #260, #262, #265, #269, #271, #273, #274** — #273 and #274 were filed
during this movement (#273 is the fix for the defect found while reviewing #272). One ordering
constraint still holds: **#262 before the held exception-deletion** (row `33943cd4`), never before.
