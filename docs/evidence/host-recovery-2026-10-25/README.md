# Host recovery, 2026-10-25T07:13:22Z replacement — restart-only recovery, verified

Row `b5d5dcd5`. This pack files the host's recovery record. **Its title's premise is corrected by its own
measurements: nothing was replaced on 2026-10-24.** That day's two "host events" were *suspensions* of the
sandbox (see 04), and the replacement this row anticipated actually happened on **2026-10-25T07:13:22Z**,
where the restart-only recovery in 02 restored the product.

## What was measured, and by which instrument

| reading | 2026-10-24 (the row's premise) | 2026-10-25 (what happened) |
| --- | --- | --- |
| `boot_id` | `751182d1-…` unchanged across two readings | **changed** to `719854c3-…` |
| `uptime` | grew 2071 s → 2548 s across readings | **reset** to 44 s |
| guard / product | same pids throughout (5899 / 5820) | **absent** until the recovery armed them (1911 / 1652) |
| wall vs guest time | wall +2127 s against guest +477 s = a suspension | reset = a real boot |

The instrument that separates these cases did not exist before this work; it does now
(`/home/team/shared/host-boot-ledger.txt`, **05** here). Its three rows: 10-24 twice with the same
`boot_id` and growing `uptime` (suspension), 10-25 with a new `boot_id` and `uptime` 44 s (replacement).

**Why this matters beyond the pack:** `btime`, `uptime -s`, `who -b` and `dmesg --ctime` all report the
boot as `now − uptime`. They agree with each other because they *are* one subtraction (measured:
`btime − (now − uptime) = −1 s`), and they are wrong by the accumulated suspension. The derived boot time
on 10-24 read 11:03:22Z and 10:35:53Z in two readings of the *same* kernel; the real, non-derived marker is
`/proc/1`'s own start stamp, which sat at 2026-10-23T15:32:47Z while guest uptime was 0.78 h — about 19.5 h
of the previous 20.3 h were suspended. So the plan's "serving since 09:22Z" was true of the **process** and
false as an **availability** claim; 04 records the measurement that split it.

## The state the replacement left (01)

- `boot_id` `719854c3-…`, `uptime` 44 s, `boot_wall` 2026-10-25T07:13:22Z; **no guard, no product**.
- `/etc/profile.d/` held only `cto-env-vars.sh`: the guard hook was gone, as after every replacement.
- **Port 3000 was held by something that is not ours** — `node … /home/team/shared/site/node_modules/.bin/vite dev`
  (pid 587/1542) — so the public URL answered **the marketing site** (200, 2,978 B, `/src/styles/app.css`),
  not the product. The plan's port convention is the product on 3000 and the site dev server on 3001; after a
  replacement the site server starts first and takes 3000, which is the same 3000 contention decision 28
  names, arriving from the other direction.

## The recovery (02), and why this tier

`origin/main` measured **equal** to the deployed tree (`3257047`) and a bundle was on disk, so a movement was
not owed and `--restart-only` was the correct tier — it cannot change which commit is served. Run:
`bash scripts/deploy-main.sh --restart-only`, **exit 0**, 07:14:59 → 07:15:19Z (20 s). It evicted the foreign
listener and re-claimed 3000 in the same window, restarted the product, re-armed the watchdog, installed the
missing hook from the tree (1 of 7 host copies installed; the other six "already match"), and reported the
served bytes equal to the on-disk bundle with both measured at run time.

## Acceptance, taken independently of the script's own report (03)

1. **3000 is ours**: `node` pid 1652 on `*:3000 (LISTEN)`; the evicted site dev server is back on **3001**.
2. **Guard**: `flock -n` probe **exit 1 = HELD**; the lock's claim `1911` **==** its holder `1911`; hook
   present (`/etc/profile.d/zz-antum-product-guard.sh`, 10,380 B, 07:15) and logging.
3. **Served pair == on-disk bundle, both measured now**: `assets/index-CNpLMWLD.js` 283,703 B md5
   `62f0fae0baf2b71f7607d86f6834dab1`, `assets/index-CSQHlfh4.css` 35,932 B md5
   `2cdb30957b86cca3e6c9df949a0c2c40` — identical served and on disk.
4. **The gate answers 401** without a token: `/api/employees`, `/api/probation/timelines`,
   `/api/employees/1/replacement-cost`.
5. **The entry point at the deployed tree**: `check-all.py --no-suite` → **OK 4, RED-KNOWN 1, exit 0** ("no
   check is unexpectedly red"); `observe-serve-pair.sh` → **PAIR HOLDS (exit 0)**. This is also the close of
   row `4f79ea73`: the access-model red that P4-1 left on main is gone at `3257047`, which is the tree the
   movement (2026-10-24 11:58) put live.

## What this pack does NOT show

- **Not a monitor.** Every host event to date was noticed by a member, not by a check. Decision 5's off-host
  check still does not exist; the boot ledger is a manual instrument that someone must read.
- **No available-rate claim.** Whether the public URL answers while the guest is suspended has still not been
  taken — it needs a curl at a moment the activity log shows a long blank. 04 records how to take it.
- **Nothing about the demo's shape.** The recovery's own end-to-end verify printed
  `distinct flag states: ['clear', 'started']` where the seed produced three: the pre-boarding flags are
  derived from dates and have moved on since the seed. Re-seeding before any demo remains decision 3.
- No movement was made and none is owed: `docs/` only, and the served bytes were already on disk.

## The movement this pack is filed at (2026-10-24 11:58:26Z -> 11:58:48Z, 22 s, exit 0)

The served tree was moved to **`3257047`** (the merge commit of #292) by the lead's full movement, and this
pack is filed at that tip. Measured after it: served pair == deployed dist **byte for byte**
(`assets/index-CNpLMWLD.js` 283,703 B md5 `62f0fae0baf2b71f7607d86f6834dab1`, `assets/index-CSQHlfh4.css`
35,932 B md5 `2cdb30957b86cca3e6c9df949a0c2c40`), three gate routes **401**, guard flock **HELD** with claim
== holder == pid **13964**, hook paired, host-tool install **idempotent**, `observe-serve-pair.sh` **PAIR
HOLDS**. The movement's console and the deployed-tree check run are **06** and **08** here.

**Its preflight refused first, and that refusal is part of the record.** The pinned after-state record
(`ANTUM_MEASURED_TIP`) was **211 commits stale**, so the preflight could only refuse until the record was
re-measured: the lead rebuilt the tip in a scratch worktree, sampled peak disk (**2,196 MB free** at the low
point) and supplied the **whole** record — it is seven fields or nothing, and a tip alone is a refusal. **07**
is that record.

**One artifact named as absent rather than omitted:** the movement's run-stamped evidence
(`/tmp/cutover-20261024-115826-evidence.txt` and its `-build.log` / `-seed.log`) was **cleared by the
2026-10-25T07:13:22Z replacement** - `/tmp` does not survive it. What it contained is re-measured in **03**
and in this README's acceptance table, from the running host rather than from the log that was lost. This
recovery's own run-stamped evidence does survive, because it was written *after* that replacement: it is
**09** here.

## The correction this pack exists to carry (the lead's own plan number was wrong)

The plan said "the machine booted at 10:36:07Z" and, later, "at 11:03:22Z". Both are the **same derivation**
(`date - uptime`) drifting forward with no boot: measured live on the *same* boot identity `751182d1-...`,
11:10:24Z gave uptime 2071 s (=> 10:35:53Z) and 11:54:59Z gave uptime 3096.81 s (=> 11:03:22Z) — the derived
"boot instant" moved **+27.5 min** while nothing restarted. So the derived boot instant is not a boot instant,
and **the recovered window is the measured 09:45:06 -> 11:09:13Z, not 10:36-10:52**.

## The ledger's rule was wrong, and is fixed and proved here

`/home/team/shared/host-boot-ledger.txt` first said "if boot_wall moves FORWARD ... the host restarted" —
which calls a suspension a restart, exactly the case it was built to catch. Its header now states the two
events **separately** (a boot = `boot_id` changes **and** uptime resets; a suspension = `boot_id` unchanged
and uptime advancing **more slowly** than the wall interval) and quotes this file's own lines as proof of
each branch: the 2026-10-24 pair (same `boot_id`, uptime 2658 s -> 2844 s, boot_wall sliding 11:03:22Z ->
11:03:23Z) and the 2026-10-25 line (new `boot_id`, uptime 44 s). **05** is that file as of this pack.

## Every digest names the revision it was measured at

| file | measured at / copied from |
| --- | --- |
| `01-pre-recovery-state.txt` | the live host, 2026-10-25 between 07:13:22Z (boot) and 07:14:59Z (recovery) |
| `02-recovery-restart-only.log` | `deploy-main.sh --restart-only` at tree `3257047`, 07:14:59 -> 07:15:19Z |
| `03-acceptance.txt` | the live host and the public URL at tree `3257047`, 07:15:53Z |
| `04-suspension-2026-10-24.txt` | the live host, 2026-10-24 11:45-11:51Z, boot `751182d1-...` |
| `05-boot-ledger.txt` | `/home/team/shared/host-boot-ledger.txt`, as of 2026-10-25T07:15:53Z |
| `06-movement-console-2026-10-24-1158.txt` | the lead's movement console, 2026-10-24T12:00Z |
| `07-preflight-record.log` | the lead's re-measured preflight record, 2026-10-24T12:00Z |
| `08-checkall-deployed-3257047.out` | `check-all --no-suite` at the deployed tree `3257047`, 2026-10-24T12:00Z |
| `09-recovery-run-evidence-2026-10-25.txt` | this recovery's own run, tree `3257047`, 07:14:59 -> 07:15:19Z |

## Files in this pack

- `README.md` — this record.
- `01-pre-recovery-state.txt` — the host as the replacement left it, before anything was run.
- `02-recovery-restart-only.log` — the deploy script's own run log, `--restart-only`, exit 0.
- `03-acceptance.txt` — the independent acceptance run: 3000 ours, guard flock/claim/holder, served pair vs
  on-disk bundle both measured, three gate routes 401, entry point exit 0, PAIR HOLDS.
- `04-suspension-2026-10-24.txt` — the measurement that corrected 2026-10-24 from "replacement" to
  "suspension", including the derived-boot-stamp trap.
- `05-boot-ledger.txt` — the append-only host boot ledger, as of this recovery.
- `06-movement-console-2026-10-24-1158.txt` — the movement that put `3257047` live, 22 s, exit 0.
- `07-preflight-record.log` — the re-measured after-state record the preflight demanded.
- `08-checkall-deployed-3257047.out` — the entry point at the deployed tip.
- `09-recovery-run-evidence-2026-10-25.txt` — this recovery's own run-stamped evidence.
- `manifest.txt` — md5 of every file above.
