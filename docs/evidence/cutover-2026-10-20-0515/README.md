# Cutover 2026-10-20 05:15:03Z → 05:16:02Z — `a5aa0e6` → `cf3dad3`

**Run by the lead, on the owner's word, from the tip the word named.** The owner merged **#226**
(`fix/layer3-slice1-reachability`) as **`cf3dad3`**, and nothing else was taken between that merge and the
movement. The run took **59 seconds** (05:15:03 → 05:16:02Z), not a window.

**Filed by the senior software engineer on 2026-10-20, byte-exact from `/tmp`.** These files were the
**only** copy of the run and `/tmp` does not survive a reset (WORKFLOW: the record goes into the repository
before the next reset can destroy it). Each file below is a copy, not a transcription: the md5 of every filed
file is the md5 of the file it came from, and both are listed.

## What moved

| | |
|---|---|
| tree | `a5aa0e6` → **`cf3dad3`** — `server/` **6** files (`access.js`, `access.test.js`, `db.js`, `index.js`, `reachability-register.js`, `schema.sql`) and **`client/` 0 files** (measured `git diff --name-only a5aa0e6 cf3dad3`) |
| served bundle | **`assets/index-BG0peuOK.js`, 274,242 B, md5 `f65f15c109e76e86cd8b8abe7102f748`** — **byte-identical to the bundle `a5aa0e6` served**: the build ran, and it re-emitted the same artifact |
| served stylesheet | **`assets/index-pNSrK3wr.css`, 35,365 B, md5 `eda548202468a7e0293053981037a594`** |
| port 3000 | the product server, **pid 1929** (`node index.js`, cwd `/home/team/shared/probable-octo-sniffle/server`) |
| the guard | **pid 2731**, named by `server/keep-alive.lock`, `/proc/2731/cmdline` = `bash scripts/keep-alive.sh` |
| host tooling | **7 of 7** copies installed/refreshed from `cf3dad3`; the second run in step 6b reports `nothing to do … all 7 copies already match this source (a second run changes no byte)` |

**Slice 1 is now in force on the host** — and that is the substance of this movement, not the bundle: the
seed log's first line is `[DB] Upgraded: added column(s) onboarding_tasks.completed_by,
offboarding_tasks.completed_by`, so decision 22's actor column exists in the live product database, and
`server/index.js` requires `./access` (the RBAC gate) at line 7. **Nothing visual changed**, because no
`client/` file moved.

## The measurements taken for this filing (my own, `2026-10-20T05:20:36Z`, at the deployed tree)

- **The public URL** — taken from the repo's own scripts, not typed from memory:
  `scripts/observe-serve-pair.sh:66 DEFAULT_URL="https://b974147c03228029e277d1cbe6646fe6.ctonew.app"`.
  `GET /` → **200, 799 bytes**, `<title>Antum People</title>`, naming `assets/index-BG0peuOK.js` **and**
  `assets/index-pNSrK3wr.css`. The page carries the platform's injected reload script
  (`__engine/events`, 1 occurrence) — that is why the public page is 799 bytes where a `localhost:3000` read
  is 462: same app, one injected `<script>`.
- `GET /assets/index-BG0peuOK.js` over that URL → **200, 274,242 bytes, md5 `f65f15c1…`** — the bytes the
  public downloads are the bytes we hash. `GET /assets/index-pNSrK3wr.css` → **200, 35,365 B, md5 `eda54820…`**.
- **No token → 401** on `/api/users`, `/api/employees` and `/api/compliance/notice`. The first of those is the
  route slice 1 added: it exists and it refuses. `/api/users` answering **401 rather than 404** is the
  measured difference the movement makes on the public URL.
- `client/` files changed `a5aa0e6..cf3dad3` → **0** (and 0 to today's `origin/main`), which is the whole
  reason the bundle name did not move.
- **I took no credentialed reading against port 3000** (rule 26 — a credentialed pass belongs on a rig). The
  authenticated readings in this record are the movement's own, and they are labelled as such below.

**Where the tree sits now:** `origin/main` is **`ccac168`**, one merge *past* `cf3dad3` — my own docs-only PR
(#230, `WORKFLOW.md`). `git diff --name-only cf3dad3 ccac168` is that one file, so the served tree is one
documentation merge behind the tip and nothing served differs.

## What the run's own log shows (steps as the script numbers them)

`1` fetch + reset to `cf3dad3` — `tree content check OK` · `1b` install **7 of 7** copies from the tree ·
`2` build → `assets/index-BG0peuOK.js` `274.24 kB`, `✓ built in 346ms`, `client build OK` · `3` re-seed
`--force-clear` against the product database → `seed OK` · `4` restart and claim port 3000 (`stopping pid
506`; `port 3000 held by the product server (pid 1929)`) · `5` live verification · `6` re-arm the guard
(`watchdog pid: 2731`) · `6b` install again.

**Step 5's own numbers, quoted from `cutover-20261020-051503-evidence.txt`:** `public status/title: 200
<title>Antum People</title>`; `demo login token chars: 201 (expect >100)`; `bad-password path: 401 (expect
401)`; `roster: 200`, `employees: 13 | first id: demo-emp-omar`; pre-boarding totals `{"cases": 3,
"cases_notice_not_shown": 1, "items": 21, "items_outstanding": 21, "workspace_lines": 43,
"workspace_lines_open": 43}`, three distinct flag states (`started` / `inside_48_hours` / `clear`); KSA
offboarding checklist **10 tasks**; the departing employee's consent-date field `('demo-emp-sarah', 0, None)`;
settlement `record eosb_accrued: 19824.78 | rendered: 19824.78 | match: True`, `unfilled [brackets]: NONE`,
`net payable: 32824.78`.

**Step 3's seed, from `seed.log`:** 13 employees; three pre-boarding cases — `OFR-2026-DEMO-01` (clear, +14
days, notice shown 0/4), `-02` and `-03` (notice shown 4/4 with each basis named); `Consent records: none
seeded (decision 17 …)`.

**Two things stated plainly, not hidden:**

1. **`WARNING: old watchdog still alive after 30s — forcing it down`** (`evidence.txt:82`). The previous guard
   did not exit inside the deploy's grace period, so the marker path forced it down before arming pid 2731.
   The lock and `/proc` agree on 2731 afterwards, so the guard is the one this tree armed — but the 30-second
   grace is a real number, not a clean handover.
2. **This run's log carries no lateness line.** The previous record's `82.68h` "noticed late" figure does not
   appear here — the re-seed re-derived the demo dates, so there was nothing late to report. (Recorded because
   that number was an app-derived figure in the last record and its absence here should not be read either way
   about uptime.)

## What these artifacts do NOT show — stated because the gap is the finding

- **Not a client proof.** The bundle is byte-identical to the one `a5aa0e6` served. The build's asset name is
  evidence that a build *ran*, and nothing more: with `client/` unchanged, the same name was the only possible
  outcome. No `client/` file changed in this movement.
- **No observer run is evidenced, and none has ever been recorded on this host.** The run's log mentions the
  observer only as an installed copy (`INSTALLED /home/team/shared/observe-serve-pair.sh`, step 1b;
  `unchanged …` in 6b) — **it never executes it**. Measured today: `/home/team/shared/observe-serve-pair.sh`
  exists (19,925 B), and **`/home/team/shared/observer/` does not exist** — so no run has appended to
  `runs.jsonl` on this host. DEPLOY.md's procedure makes the observer **step 6** ("independently confirm the
  served package — with the observer, not by hand"), and its record section says each run appends a dated line
  to that directory. **The observer is now installed and has never been run:** the availability record is still
  empty, and the pair below is asserted only by the hand measurements in this file. Closing that gap is one
  command from the deployed tree — `bash scripts/observe-serve-pair.sh` — and it is the operator's step, so
  this record states the gap instead of quietly completing it.
- **The three probe readings are the movement's, not mine, and carry no timestamp of their own.**
  `overview-AE.json`, `employees.json` and `settlement-served.json` have mtimes **05:15:21–05:15:22Z**, i.e.
  inside the run and after the step-4 restart; their capture command is not recorded inside them. Their
  contents agree with the run's own step 5 and with `seed.log` (the same three offer references, the same three
  flag states, 13 employees, first id `demo-emp-omar`) — which is what makes filing them worthwhile, not the
  mtime alone.
- **Nothing here timestamps the first answer of the restored service.** The record measures the movement; it is
  **not** an outage or repair duration, and no such duration may be quoted from it.

## The artifacts, byte-exact, with where each came from

| filed as | copied from | bytes | md5 |
|---|---|---|---|
| `cutover-20261020-051503-evidence.txt` | `/tmp/cutover-20261020-051503-evidence.txt` | 6,926 | `6f03ea12f8fe7fc12c7ad3485e500d92` |
| `cutover-20261020-051503-build.log` | `/tmp/cutover-20261020-051503-build.log` | 442 | `525ad8bc0dd6125282ca8c23347b2b70` |
| `cutover-20261020-051503-seed.log` | `/tmp/cutover-20261020-051503-seed.log` | 2,040 | `621ac3b846138a35d47adde5e12948f1` |
| `run.log` | `/tmp/deploy.log` | 6,948 | `146e1de3dfaf64d70180419957359055` |
| `served-index.html` | `/tmp/cutover-page` | 799 | `89cbd358c2b132d74880713c6ab07aae` |
| `overview-AE.json` | `/tmp/cutover-20261020-051503-pb-overview.json` | 14,858 | `82eeb28e26eb0cfbe47db97b46cd44dd` |
| `employees.json` | `/tmp/cutover-emp` | 11,512 | `f8e061caa074c82dd1e889da2e10fceb` |
| `settlement-served.json` | `/tmp/cutover-settlement.json` | 3,003 | `11e66d95b42fd60164bd41eaac563efa` |

`run.log` and `cutover-20261020-051503-evidence.txt` are **not** the same file: the first is the `nohup`
capture of the whole script, the second is the run-stamped file the script writes at the end. Their content
overlaps; their bytes differ (6,948 vs 6,926), so both are filed.

**Staging note.** `.gitignore:6` is `*.log`, so the three `.log` files and `run.log` are staged with
**`git add -f`** — the trap DEPLOY.md step 7 records (rule 27). `git check-ignore -v` on them names
`.gitignore:6:*.log`; the non-log files are not ignored.

**No credential appears in any filed file, audited before staging:** the only occurrence of "token" in the
logs is `demo login token chars: 201 (expect >100)` — a length, not the token. Nothing here changes
`server/` or `client/`, and no movement was run to produce this record.
