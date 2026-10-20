# Movement evidence — 2026-10-20T08:49:15Z → 08:50:12Z (`b4f479a` → `ca681dd`, PR #239)

Filed by **agent-program-manager** on 2026-10-20 with the round that records the movement (Round 52, `roadmap-board-index.md`).
Run stamp **`20261020-084915`**. The artifacts below are the run's **own bytes**, copied out of `/tmp` with `cp -p` and proved
equal to their originals by `cmp` **and** by md5 — **nothing here was re-run to make the pack read better**, except the two
files marked *mine* in the table, which say in their own headers what they are.

The movement is the one that took the host from `b4f479a` (the slice-2 prerequisites) to **`ca681dd` (PR #239, the Layer 3
slice-2 read paths)**. It is the first movement of the day whose **served bundle changed**.

## How to re-verify this pack

```sh
# every filed artifact, byte-for-byte, against the merge result that carries it
for f in *; do git cat-file -p <merge>:docs/evidence/cutover-2026-10-20T084915/$f | md5sum; done
# and the numbers in the table below
md5sum * | sort
```

## Artifacts, as filed (bytes and md5 read off the filed files themselves)

| filed as | bytes | md5 | what it is |
|---|---|---|---|
| `movement-239.log` | 7,617 | `f873340314b187490a45e5275c6371f5` | the deploy wrapper's own log for this run |
| `cutover-20261020-084915-evidence.txt` | 7,595 | `0b2b032b8febe882a714932ff35aaec1` | the script's tee'd stdout, all six steps |
| `cutover-20261020-084915-build.log` | 442 | `4591ca41d53367dd7db16043ebefec1a` | the client build's raw output |
| `cutover-20261020-084915-seed.log` | 2,153 | `5e95b28268094c1cfa8f8ef54378f102` | the demo re-seed's raw output |
| `cutover-20261020-084915-pb-overview.json` | 14,851 | `97f744b8290f08da81cbedd309e82e55` | the raw pre-boarding overview body behind the run's `overview` check |
| `live239.out` | 1,931 | `b73bf847fe0a2fd8812b1cf90a4198fd` | the lead's post-cutover live checks — **carries its own failure, kept** |
| `dbcheck239.js` | 1,601 | `d05df9e20b0865506b492dd413a204cd` | the lead's DB-check script — **its output is not in `/tmp`; see the warts** |
| `uniqprobe.js` | 1,257 | `346ae77fb01141932447d312d889ca21` | the lead's unique-when-set probe script |
| `uniqprobe.out` | 502 | `5ed08a77b09f9d17b0b8562cd59c3c48` | that probe's output — **its first expectation did not hold; see the warts** |
| `inspect239.log` | 4,270 | `b525f1443aff8ed413f6286bed1bd091` | the tree-side reads (policy exports, 17 resources, renames, the index's SQL) |
| `build239.txt` | 453 | `44512e01010f449c5b6020abc4f6a515` | the typecheck+build run at the merged tip, rc 0 |
| `b239.sum` | 688 | `2296a77fd73642ebc1c0b87cabe5a721` | the same build's tail plus the emitted `dist/` assets and their md5 |
| `suite239.txt` | 71,030 | `d662b61f72d1edd006abd47b0885c943` | the lead's full `node --test` output in the worktree `/tmp/wt239` |
| `suite239.sum` | 55 | `277e07fd911baae5a4391aca09473d91` | its summary: 254 tests / 51 suites / 254 pass / 0 fail |
| `cells239.txt` | 889 | `0089eecf824f2bd677966d5d37d02713` | the merged tree's own policy read: `PENDING_CELLS`, `COUNSEL_PENDING`, `unpolicied []` |
| `observer-2026-10-20T0856.txt` | 1380 | `eb913c6fdce421acecf1e4b42414ebc1` | **mine** — `scripts/observe-serve-pair.sh` run **once**, after the bundle changed |
| `suite-r52-own.txt` | 71010 | `4dfef6cb39b9d20417e10a2ee753efa0` | **mine** — `node --test` at `ca681dd` in my own worktree, install named |
| `db-post-boot-r52.out` | 1479 | `bd9bdcb371f7336dca38327de86439ca` | **mine** — read-only probe of a copy I took of the live DB; the lead's 08:50 copy had been removed from `/tmp` |

`inspect239.out` is **byte-identical to `inspect239.log`** (`cmp` → SAME, both `b525f144…`), so it is not filed twice.

## What the run states, as the run states it

- **Window and window's tree.** `=== cutover 2026-10-20T08:49:15+00:00 ===` … `=== cutover finished 2026-10-20T08:50:12+00:00` — **57 seconds**. Tree `b4f479a` → `ca681dd`; `tree content check OK`; `deployed commit: ca681dd Merge pull request #239 from AhmadJ979/layer3/slice2-read-paths`.
- **7 of 7 host tools from the new tree** (`install-host-tools` 08:49:16, backups `host-tools-backup-20261020T084916Z`), including the `zz-antum-product-guard.sh` hook; the **second** install run at 08:50:12 reports *"nothing to do — all 7 copies already match this source (a second run changes no byte)"*.
- **The client build succeeded before anything was restarted** (rule 15): `✓ built in 291ms`, `client build OK`, and **the emitted asset is new** — `dist/assets/index-DyH3JYJh.js 274.24 kB`, `dist/assets/index-pNSrK3wr.css 35.36 kB`.
- **The bundle is what the public URL serves**, measured after the cutover: on-disk `274249 7cb512fb81f0687fa35723ca049a939a`, HTML names `assets/index-DyH3JYJh.js`, served `274249 7cb512fb…` — **three-way equal** (`live239.out`).
- **The demo was re-seeded inside the movement:** `OFR-2026-DEMO-03` (Yousef Al-Hammadi, AE, start 2026-10-19) opened; items 7 `not_started`; notice shown 4/4 with its bases; `Seeding completed successfully.` / `seed OK`.
- **Restart and re-arm:** `stopping pid 3294` → `port 3000 held by the product server (pid 25778)`; `watchdog pid: 27453`; deploy marker written (pid 25247) and removed.
- **The run's own end-to-end verification** (step 5): `GET /` 200 `<title>Antum People</title>`; demo token **215 chars**; bad password **401**; roster **200, 13 employees**; the three pre-boarding flag states render (`clear`, `inside_48_hours`, `started`); the KSA offboarding checklist returns **10 tasks**; the settlement statement's rendered EOSB **19824.78 equals the employee record's 19824.78** with `unfilled [brackets]: NONE`, net payable 32,824.78.
- **A derived flag read correctly on the first read after restart:** `[preboarding-flag] … This case reached the 48-hour mark while the app was not running (noticed 80.82h late) … nothing is marked missed.`
- **The live DB ran BOTH migrations on boot** (`live239.out`): `users` columns are `id, username, password_hash, access_role, created_at, employee_id`; **the legacy `role` column is gone**; rows: one — `admin`, `access_role` **`hr_admin`**, `employee_id` **null**, `created_at` `2026-10-20 08:49:22`; `onboarding_tasks.completed_by` present. `cells239.txt` reports `unpolicied []` and `unknownRoles []`.
- **The gate is gated on the host:** no token → **401** on `/api/users` and `/api/employees`; with a token → **200**; `/api/preboarding/cases/no-such-id/workspace` → **404**, `/api/preboarding/cases/no-such-id` → **404**.
- **The merge this movement carries, read as the merge result:** `ca681dd` (12:46:47+04:00), first parent `2cf608b`, second `8107170` — **11 files: 9 `server/`, `scripts/seed-demo.js`, `client/src/App.tsx`** (+1,274 / −279). `b4f479a..ca681dd` is exactly those three merges (#238, #237, #239) with `docs/access-model.md` and Round 51's evidence pack as the only non-code paths.
- **Rule 15's proof for the client-touching PR, supplied at the merged tip:** the submission did not state a build; the lead's post-merge runs do — `build239.txt` and `b239.sum` show `tsc -b && vite build`, `build rc=0`, and the emitted `dist/assets/index-DyH3JYJh.js 274249` with md5 `7cb512fb81f0687fa35723ca049a939a`.

## Warts, stated rather than smoothed

1. **The forced guard-kill REPEATED — it is a pattern, with two dated instances.** `WARNING: old watchdog still alive after 30s — forcing it down` appears in **this** run (08:50; the outgoing guard was **pid 4604**, armed at 06:51 the same morning; the incoming guard is **pid 27453**) and in the **06:51** movement of the same day (`docs/evidence/cutover-2026-10-20T065020/`). Twice in one day, the same line, against a guard **armed earlier the same day**: at 06:51 the outgoing guard is the one the previous (05:16) movement armed and the incoming guard is `4604`; at 08:50 the outgoing guard is `4604` (armed at 06:51) and the incoming one is `27453`. **What the two logs state is the warning and the forced kill; the cause is not known from them and is not guessed here.** Filed as the log states it, forced kill included.
2. **`live239.out` carries its own failure and it is kept.** Its inline index query dies on a quoting bug — `Error: no such column: "index" - should this be a string literal in single-quotes?` — so **that file carries no index list**, and the two facts it would have carried (`sqlite_master`'s index row for `users`) need another artifact. The file's other measurements stand on their own.
3. **`dbcheck239.js` has no output in `/tmp`.** The script is filed as it was run; its own `readOnly: true` handle means the `INSERT` probe inside it cannot produce the `UNIQUE` message it looks for, so its output would not have proved the index even if it existed. **`db-post-boot-r52.out` (mine) fills that gap:** a read-only probe of a copy of the live DB taken at 09:01Z, which reads `users`' columns, the `sqlite_master` row for the partial unique index, the `users` rows and `audit_logs.performed_by`'s distinct values.
4. **`uniqprobe.out` did not hold its own first expectation, and one half of it tested nothing.** Its lines: `employee probed: demo-emp-ahmad`, `before: 4 users; 1 linked to it`, then `1st link refused (unexpected): UNIQUE constraint failed: users.employee_id` — the "free link" the probe assumed was **already taken**, so the contrast it drew is between an occupied link and a second attempt; the `2nd link` line does refuse with `UNIQUE constraint failed: users.employee_id`, which is the index working. Then `two unlinked accounts refused (index is not partial): UNIQUE constraint failed: users.username` — **a different constraint answered**, so the probe's NULL half said nothing about the partial index. **A control whose positive case cannot run is a control that proves nothing** (the standing lesson, instance five).
5. **The movement's own printed list and the files it leaves differ again** — the run names `/tmp/cutover-20261020-084915-{evidence,build,seed}.log` and the overview JSON exists besides; the pack files the run's bytes rather than the run's list.

## What this pack does NOT claim

- It does not claim the host's live DB equals `db-post-boot-r52.out` **now**: the probe reads a **copy** taken at 09:01Z (its source path, md5 and mtime are in the probe's own header), and a copy is not the live file, which may have moved since.
- It does not claim an availability **rate**. The observer's line is one dated point, run by hand, and the file says so.
- It does not re-derive any figure the plan or the index already carries; where a figure appears here it was read off the artifact named in the same bullet.
