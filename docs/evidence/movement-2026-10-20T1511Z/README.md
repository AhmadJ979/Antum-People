# The 15:11Z movement — what was deployed, and the artefact behind every claim

Compiled 2026-10-20 by agent-product-designer (product designer) from the host's scratch set at
`/home/team/shared/movements/2026-10-20T1511Z/`. **Gathered, not adjudicated:** the durability claim
belongs to whoever ran each command. Who ran what is section 10; what this pack cannot establish is
section 11.

Check this pack before believing it (both directions — every file named here exists here, and every
file here is named here):

    python3 docs/evidence/movement-2026-10-20T1511Z/pack-check.py

## 1. What moved, and when

`cutover-20261020-151147-evidence.txt` (the deploy's own run-stamped record) and `movement.log`.

- cutover **2026-10-20T15:11:47+00:00 → 15:12:12+00:00 — 25 seconds** (first and last line of the record).
- tree `/home/team/shared/probable-octo-sniffle`, port 3000, mode `full-movement`; the deploy script's own
  size and digest are printed on line 2 (`29009 B`, sha256 `dc09ff95269cb503`).
- deployed commit **`2b14a94`** (merge of #268), and the tree is clean at `origin/main`: `measured-lv.txt`
  line 28 — `HEAD: 2b14a94 (=origin/main? 2b14a94) dirty files: 0`.
- the host tooling was installed twice, idempotently: 7 of 7 refreshed at 15:11:49, and the second run at
  15:12:12 printed `nothing to do — all 7 copies already match this source (a second run changes no byte)`
  (record lines 34 and 104).
- **`movement.log` and `cutover-20261020-151147-evidence.txt` are byte-identical** (measured with `cmp`;
  one md5 `a71e4837…`, 7,549 B). Two names, one artefact — recorded so nobody hunts for a difference.

## 2. The two stylesheet states, as bytes

`served-before-35d-served.css` · `served-after-index-BK_EwcpZ.css`

| state | bytes | md5 |
|---|---|---|
| before | 35,805 | `3709a147a167307b5f46c2ecbc3e0431` |
| after | 35,306 | `cb54e6164a8e741ed807bac94577efcd` |

The **after** file is the state the host served, and that is checkable from this pack: `measured-lv.txt`
line 8 (`assets/index-BK_EwcpZ.css http=200 bytes=35306 md5=cb54e6164a8e741ed807bac94577efcd`) and again
at 15:13:45 in `measured-live-verify.txt` line 4. The **before** file's md5 is the recorded baseline, and
its bytes are here so a reader can check any copy against them rather than believe the number.

Cross-pack identity, measured today: `docs/evidence/tailwind-pinned-sources/index-DvmxiaxC.before.css`
and `docs/evidence/tailwind-pinned-sources/index-BK_EwcpZ.after.css` carry the **same two md5s** as the files here — the two packs describe
the same two states. And the before state is *reproducible*: rebuilding the merged tree with the pin
removed and the pinned test file absent produces 35,805 B, md5 `3709a147…`, and the same filename
`index-DvmxiaxC.css` — the three build tails are filed in the #268 pack (`pin-removed-build-tails.txt`),
which this branch corrects.

## 3. The bundle: the same bytes under a different name

`cutover-20261020-151147-build.log` · `measured-lv.txt`

- as built: `dist/assets/index-C9vf7pQB.js` **277.79 kB** (build log line 39).
- as served: **277,790 B, md5 `e6ff5da3fd614ddcfe2c0beaa68164f4`** (`measured-lv.txt` line 9).
- **A filename that moved over identical bytes is not a change.** The old name (`index-CovU_C3n.js`) is
  **not in this pack** — it is named in `docs/evidence/tailwind-pinned-sources/README.md`'s before/after
  table. What this pack establishes is the after-name and its bytes; the "same bytes, new name" sentence
  is a claim about two packs, and both halves are cited.

## 4. The auth surface, the roster, and the pre-boarding figures

`measured-lv.txt` · `measured-vpb.txt` · `cutover-20261020-151147-evidence.txt`

- 200 with `<title>Antum People</title>` (`measured-lv.txt` lines 4-5); bad password **401**; no token on
  the roster **401**; a good password returns a **215-char** token (lines 12-14 of the same file, and the
  deploy's own end-to-end block).
- roster **13** rows, first id `demo-emp-omar`.
- pre-boarding: **3 cases, 21 items, 7 items per case**; item states **`not_started` ×18 / `requested` ×3**
  — `measured-vpb.txt` lines 11-13 (`7`, `7`, and `{'requested': 3, 'not_started': 4}`).
- totals as the API serves them (`measured-vpb.txt` line 3): `cases 3`, `items 21`, `items_outstanding 21`,
  `cases_notice_not_shown 1`, `workspace_lines 43`, `cases_ready 0`, `cases_provisioned 0`.
- **Items are not lines.** The deploy's per-case line `open 21 | lines emp/ws 7 14` is *workspace lines*
  (7 employee + 14 workspace), not items; the third case reads `open 22`. Both figures are in the files
  and they are labelled differently — conflating them would put a wrong number in prose.
- the three case-level states as served, distinct and read (deploy record lines 60-63):
  `started` (rose) / `inside_48_hours` (amber) / `clear` (slate).

## 5. The notice — what is here, and what is not

`cutover-20261020-151147-seed.log` · `cutover-20261020-151147-evidence.txt`

- **established:** the seed records the notice as shown **for 4/4 collectible** on `OFR-2026-DEMO-03`, and
  names each of the four with its basis — passport and visa_or_entry_permit and emirates_id as
  *Legal obligation*, bank_details as *Performance of the employment contract / contractual necessity*
  (record line 44 = seed log line 28).
- **derived, and stated as a derivation:** 7 items per case minus those 4 = **3 items with no basis row**.
  The three are **not named in any file here**.
- **not here at all:** the notice's **version string**. `v2.3` occurs in no file in this pack (measured by
  grep across the set; the command and its empty result are in the pull request). A version quoted from
  the plan is asserted there, not by this pack.
- also established: **one** case reads notice-not-shown (`cases_notice_not_shown 1`) — and the artefacts do
  not make that the same case the 4/4 sentence is about. They are not equated here.

## 6. Case timing: the offsets are arithmetic on dates, not a field

`cutover-20261020-151147-seed.log` · `cutover-20261020-151147-evidence.txt`

- the three start dates, seeded and served: **2026-10-19 / 2026-10-21 / 2026-11-03** (record lines 60-62).
- against the movement date 2026-10-20 that is **−1 / +1 / +14 days**. That is computed here from those
  dates: **the API's `days_to_start` field is captured nowhere in this pack** (grep, recorded). Where a
  figure must be quoted *as served*, it has to be measured; this pack quotes the dates it has.

## 7. The guard: one acceptance, and a defect that is not a pass

`measured-ge.txt` · `measured-diag.txt` · `measured-lv2.txt`

- **the handoff exit, quoted not paraphrased** — `measured-ge.txt` line 8:
  `483:2026-10-20T15:13:31+00:00 EXIT: killed by SIGTERM (loop pid 23028)`. Loop pid **23028** is the
  watchdog the cutover armed 25 seconds earlier (`watchdog pid: 23028`, deploy record line 84).
- **the lock+PID check that says one guard, pid 27783, from 15:13:58** — `measured-ge.txt` lines 1-4
  (`lock PID: 27783`, `/proc/27783/cmdline: /usr/bin/bash scripts/keep-alive.sh`,
  `exact-count of guard loops: 1`) and the arm line at 15:13:58 (line 26); the process table with its
  parent and start time is `measured-diag.txt` line 2.
- **the refusal sequence is a DEFECT, not a clean re-arm.** Six attempts between 15:13:46 and 15:13:56
  refused to start, each naming "another keep-alive.sh" that was **not a guard**: the processes named in
  those lines are shells running the host's own session-bootstrap probe (`sh -c bash -lc 'HOME=/home/agent-lead bash -lc '...'` whose argv carried
  `/home/team/shared/probable-octo-sniffle/scripts/keep-alive.sh`) — a process whose *argv* mentions the path — while the lock was free
  (`measured-ge.txt` lines 10-14, beside the lock-PID evidence in the same file).
- **27 seconds with no guard: 15:13:31 → 15:13:58.** Site up, nothing red. Cross-reference: open row
  **`11705f3c`** (guard arming). This pack must not be read as evidence that the re-arm was clean.
- the recovery was the hook's, not the operator's: ten `hook: guard already running (pid 27783), nothing
  to do` lines (`measured-ge.txt` lines 31-40) — a start that had to be retried until it was confirmed.
- afterwards both paths still answered: `public 200  localhost:3000 200` (`measured-ge.txt` line 43).
- **a false count lives in this set, and it is named here rather than quietly dropped.** `measured-lv2.txt`
  line 23 reads `guard processes now: 4`, produced by a `pgrep -f`-style count; the authoritative count is
  **1** (the lock's PID checked against `/proc`). That same file records two gaps in its own instrument
  (`fuser: command not found`, `bc: command not found`), so its guard line is an instrument report, not a
  guard count. The row that asked for this pack attributed the false count to `measured-diag.txt`; measured,
  it is in **`measured-lv2.txt`**, while `measured-diag.txt` is the process table plus the guard script's own
  comments — which warn against exactly that command.

## 8. The suites, at the deployed tree

`measured-lv.txt`

- server **271 tests / 51 suites / 271 pass / 0 fail**; client **26 / 4 / 26 / 0** (lines 31-37), read at
  `2b14a94` while it was the served tree.
- **the host used to read 257** because test files lagged the tree; this figure is only true from this
  movement on. An older pack's 257 is not a contradiction of this one.

## 9. Demo data: the figures that must match, and one derived flag

`cutover-20261020-151147-evidence.txt`

- EOSB: record `19824.78` vs rendered `19824.78`, `match: True`; **unfilled `[brackets]: NONE`**; net
  payable `32824.78` (lines 78-81). The rendered figure has no unfilled merge bracket.
- the KSA offboarding checklist as served: **10 tasks**, named in order (lines 64-75).
- one derived flag fired on the first read after restart and is read correctly — case `6c349e1b`, noticed
  87.2h late, **nothing marked missed** (line 51).

## 10. Attribution — who ran what

- `cutover-20261020-151147-evidence.txt`, `cutover-20261020-151147-build.log`,
  `cutover-20261020-151147-seed.log`, `movement.log`: the **deploy's own** run-stamped output
  (`deploy-main.sh`, 15:11:47Z). No one typed these.
- `measured-lv.txt`, `measured-live-verify.txt`, `measured-vpb.txt`, `measured-lv2.txt`,
  `measured-ge.txt`, `measured-diag.txt`: the **lead's** measurements, 15:12:45-15:14Z, with the five
  scripts that produced them in this directory (`verify-live.sh`, `verify-live2.sh`, `verify-pb.sh`,
  `guard-evidence.sh`, `diag-guard.sh`) — so the commands are re-runnable rather than described.
- `served-before-35d-served.css`, `served-after-index-BK_EwcpZ.css`: captured from the host, both states.
- **two files are mine, added today and marked as mine:** `md5sums.txt` and `pack-check.py`.
- **nothing in this pack was re-run by me.** I re-verified the copy byte-for-byte (**17/17 files
  md5-identical** after copying), the cross-pack stylesheet identity of section 2, and I ran `pack-check.py`.
  The two re-measurements made today live in their own packs (sections 2 and the #267 pack), not here.

## 11. Named gaps — what a reader might expect and will not find

- the notice's **version string** (`v2.3`) — in no file here;
- the API field **`days_to_start`** — not captured; the start dates are, and section 6 says which is which;
- **which** three items carry no basis row — not named here (only that three do);
- the **before-bundle filename** — in the #268 pack, not here;
- anything the host did **after 15:14Z** — the last measurement in this set is `measured-ge.txt` line 43.
  No availability *rate* can be quoted from a point.

## 12. The pack checks itself

    python3 docs/evidence/movement-2026-10-20T1511Z/pack-check.py

Both directions, computed: every file in this directory is named in this README **and** every
filename-shaped token in this README exists in this directory (or is an explicitly external path that
exists in the repository). Exit 0 when both hold.
The list that direction is checked against is this README itself - `README.md` is the list, so it is
exempt from naming itself. Its reddening is recorded in the pull request, and `pack-check.py --selftest`
re-runs it: a copy with one file renamed exits 1 naming it, and a copy whose README names a file that is
not there exits 1 naming that.

The runs it produced, verbatim, are `pack-check-runs.txt` (the green bare run, then `--selftest`:
baseline green; one file renamed -> red naming it; one file's bytes removed -> red naming the lost file).

## 13. Names this pack cites and does not contain

Some prose here is about artefacts this pack is not the home of: the old bundle filename, two build
outputs, and the two #268 stylesheet files. They are declared in the block below so the checker can tell a
deliberate outside-citation from a name whose file was lost. The checker **prints how many names it
allowed** - the block is an asserted exemption, so a growing one is visible rather than silent.

<!-- pack-check: external names -->
`index-CovU_C3n.js` | `index-C9vf7pQB.js` | `index-DvmxiaxC.before.css` | `index-BK_EwcpZ.after.css`
`index-DvmxiaxC.css` | `index-CfrFKMaL.css` | `assets/index-BK_EwcpZ.css` | `dist/assets/index-BK_EwcpZ.css`
`dist/assets/index-C9vf7pQB.js` | `pin-removed-build-tails.txt` (the #268 pack) | `deploy-main.sh`
<!-- /pack-check -->
