# Cutover 2026-10-20 06:50:20Z → 06:51:16Z — `cf3dad3` → `b4f479a`

**Run by the lead, on the owner's word, from the tip the word named.** The owner merged **#236**
(`layer3/slice2-prerequisites`) as **`b4f479a`**, and nothing else was taken between that merge and the
movement. The run took **56 seconds** (06:50:20 → 06:51:16Z), not a window.

**Filed by the program manager on 2026-10-20, byte-exact from `/tmp`.** These files were the only copy of the
run and `/tmp` does not survive a reset (WORKFLOW rule 28: the record goes into the repository before the
next reset can destroy it). Every file below is a **copy, not a transcription**: `cmp` against the `/tmp`
original is silent for all seven, and the md5 of each filed file is listed beside the md5 of the file it came
from.

## What moved

| | |
|---|---|
| tree | **`cf3dad3` → `b4f479a`** — `git reset` to `FETCH_HEAD`, `HEAD is now at b4f479a Merge pull request #236 from AhmadJ979/layer3/slice2-prerequisites`, `tree content check OK`; the run's own last line: `deployed commit: b4f479a …` |
| the delta | **24 files** (`cf3dad3..b4f479a`, my measurement this round: 15 `docs/`, 6 `server/`, 1 `scripts/`, this index, `WORKFLOW.md`) — the 6 `server/` paths are the ones the running server loads (`access.js`, `index.js`, `db.js`, `schema.sql`) plus two test files |
| served bundle | **`assets/index-BG0peuOK.js`, 274,242 B, md5 `f65f15c109e76e86cd8b8abe7102f748`** — **byte-identical to the bundle `cf3dad3` served**: with **`client/` 0** files in the delta the build re-emitted the same artifact, which is what the unchanged name predicts and all it proves |
| served stylesheet | `assets/index-pNSrK3wr.css`, 35.36 kB (the build's own line) |
| port 3000 | the product server, **pid `3294`** (`node index.js`) — the run's step 4 reports `stopping pid 1929` then `port 3000 held by the product server (pid 3294)` |
| the guard | **pid `4604`**, re-armed in step 6, **`armed as its own session leader (pid 4604)`** per `server/keep-alive.log` at `2026-10-20T06:51:10+00:00` |
| host tooling | **7 of 7** copies installed/refreshed from `b4f479a` (`=== RESULT: 7 of 7 copies installed or refreshed from b4f479a7bbc3`); the second run in step 6b reports `nothing to do — all 7 copies already match this source (a second run changes no byte)` |

**Slice 2's prerequisites are now in force on the host** — and that is the substance of this movement, not the
bundle: the run's step 3 seed log opens with **`[DB] Upgraded: added column(s) users.employee_id`**, so the
column the prerequisites add exists in the live product database after the first boot on this tree. **Nothing
visual changed**, because no `client/` file moved.

## What the run's own log shows (steps as the script numbers them)

`1` fetch + reset to `b4f479a` — `tree content check OK` · `1b` install **7 of 7** copies from the tree ·
`2` build → `dist/assets/index-BG0peuOK.js 274.24 kB`, `✓ built in 414ms`, `client build OK` · `3` re-seed
against the product database → `seed OK` · `4` restart and claim port 3000 · `5` live verification · `6`
re-arm the watchdog (`watchdog pid: 4604`) · `6b` install again (nothing to do).

**Step 5's own numbers, quoted from `cutover-20261020-065020-evidence.txt`:** `public status/title: 200
<title>Antum People</title>`; `demo login token chars: 201 (expect >100)`; `bad-password path: 401 (expect
401)`; `roster: 200`, `employees: 13 | first id: demo-emp-omar`; pre-boarding `totals: {"cases": 3,
"cases_notice_not_shown": 1, "items": 21, "items_outstanding": 21, "workspace_lines": 43,
"workspace_lines_open": 43}` with `distinct flag states: ['clear', 'inside_48_hours', 'started'] (expect 3 …)`;
the KSA offboarding checklist's **10 tasks**; the departing employee's consent-date field
`('demo-emp-sarah', 0, None)`; the settlement statement's own check — **record EOSB vs rendered, `match:
True`, `unfilled [brackets]: NONE`** (the two figures and the net payable are in that file's own lines,
quoted there and not re-typed here).

**Step 3's seed, from `seed.log`:** 13 employees upserted; three pre-boarding cases — `OFR-2026-DEMO-01`
(clear, +14 days, `notice shown for 0/4 collectible`), `-02` and `-03` (`notice shown for 4/4 collectible`,
each basis named); `Consent records: none seeded (decision 17 — no instrument, and nothing reads the table).`

## Two things stated plainly, not hidden

1. **`WARNING: old watchdog still alive after 30s — forcing it down`** (`evidence.txt:84`). The outgoing guard
   **did not exit inside the deploy's 30-second window**, so the marker path forced it down before the new
   guard armed. The resulting guard is **pid 4604**, and `server/keep-alive.log` shows it arming at
   `06:51:10+00:00` and no re-arm since — but the 30-second grace is a real number that was exceeded, not a
   clean handover. Same wart as the 05:15 movement, recorded the same way.
2. **`live236.out` is half an artifact: its own second half is a FAILED read.** The `== served bytes ==` and
   `== access contract ==` sections ran fine; then `== live schema + rows ==` crashed —
   `Error: Cannot find module 'better-sqlite3'` from `server/[eval]`. That file therefore holds **no schema
   reading at all**, and the DB facts in the next section come from the separate **`db236.out`**, which read
   the same database successfully. The failed section is left in the filed bytes rather than trimmed.

## The live checks the lead measured after the cutover

**From `live236.out` (the sections that ran):** the asset the public HTML names is
**`assets/index-BG0peuOK.js`**; **fetched md5 `f65f15c109e76e86cd8b8abe7102f748` = on-disk md5**
`f65f15c109e76e86cd8b8abe7102f748` (`served == on-disk: YES`), **274,242 B** — the bytes a visitor downloads
are the bytes we hash. `GET /api/users` → **401 with no token, 200 with one** (token chars 201);
`bad password` → **401**; `GET /api/compliance/notice` → **200**; `GET /api/preboarding/checklist/overview` →
**200**; `GET /api/preboarding/cases/x/workspace` → **404** (the own-case route is live and gated under the
new read cell).

**From `db236.out` (the database itself):** `users columns : id,username,password_hash,role,created_at,employee_id`
— `employee_id` **appended last**, which is what `COLUMN_MIGRATIONS` does at boot. `users rows : 1`,
content `[{"username":"admin","role":"admin","employee_id":null}]` — **exactly one account, and its
`employee_id` is NULL: not backfilled, not guessed.** `users.employee_id present : true`;
`onboarding_tasks.completed_by present : true` (decision 22's actor column, still in force).
`audit_logs entity_type=user rows : 0` and `audit_logs performed_by=system : 0` — quoted as measured.

## My own independent read of the served surface — 2026-10-20T07:09:30Z

- Port **3000** held by **pid `3294`** `node index.js`, cwd `/home/team/shared/probable-octo-sniffle/server`
  — proven by mapping the listening inode **55808** from `/proc/net/tcp` to that pid's own file descriptors,
  not by asking the port.
- **`/proc/3294` ctime = `2026-10-20 06:50:30.907Z`** — the restart step 4 reports, to the second.
- **The trap, re-measured, because it would have produced a false sentence:** `ps -o lstart` on that same pid
  reads **`Tue Oct 20 07:03:25 2026`** and etime `06:05` — **12 m 55 s later** than the process's own `/proc`
  ctime and than the movement log's restart. This host suspends, and its process-start accounting moves with
  it. **A restart time is a `/proc/<pid>` ctime plus the log; `ps lstart` is not evidence for it.**
- The serving tree's own `HEAD` is **`b4f479a`** — the tree this movement installed.
- `GET /` → **200, 462 bytes**, page names **`assets/index-BG0peuOK.js`**, `<title>Antum People</title>`.
- **No token → 401** on `/api/users`, `/api/compliance/notice` and `/api/preboarding/checklist/overview`.
- The on-disk bundle (`client/dist/assets/index-BG0peuOK.js`, 274,242 B) and the bytes fetched over 3000 have
  the **same md5** — `f65f15c109e76e86cd8b8abe7102f748`. A second reader, independently.
- **The public URL** (`https://b974147c03228029e277d1cbe6646fe6.ctonew.app`) → **200, 799 bytes**,
  `<title>Antum People</title>`, naming **`assets/index-BG0peuOK.js`** — so the platform URL resolves to the
  product, and the 799-vs-462 difference is the platform's injected reload script (the same 799/462 pair the
  05:15 record measured).
- Guard **pid `4604`** (`bash scripts/keep-alive.sh`), the pid the run's step 6 reports.

**What I took no part in:** I ran none of the above movement, and no host write of any kind — these reads are
anonymous and read-only (two routes without a token, `/proc`, `curl`, `git`). No credentialed read was taken
(rule 26), so nothing here is a signed-in measurement.

## What these artifacts do NOT show — stated because the gap is the finding

- **Not a client proof.** The bundle is byte-identical to the one `cf3dad3` served; the build's asset name is
  evidence that a build *ran*, and with `client/` unchanged the same name was the only possible outcome.
- **No observer run, and none is evidenced.** The run's step 1b installs `observe-serve-pair.sh` and the run
  never executes it, so this movement adds **no availability line**. The availability record remains what
  #233 filed — **a point, not a monitor** — and no availability *rate* may be quoted from this pack.
- **No outage or repair duration may be quoted.** This record measures the movement (56 seconds of the
  script's own steps); it does not timestamp the first answer of the restored service, and nothing here
  brackets an outage.
- **The `noticed 78.84h late` line is a seeder artifact, not outage evidence** (rule 30's corollary): a
  freshly seeded case whose 48-hour mark is already in the past reports a large lateness figure on the first
  read. The run's own line says the flag is derived and read correctly on the first read after restart.
- **The seventh artifact is one the run's own printed list does not name.** The script prints three
  run-stamped files (`-evidence.txt`, `-build.log`, `-seed.log`); `cutover-20261020-065020-pb-overview.json`
  carries the same run stamp and is the raw response body behind the `overview: 200` check. It is filed
  rather than dropped — the bytes are the run's, and re-fetching it later would be a different run. Its
  content is the demo seeder's own synthetic dataset (case `OFR-2026-DEMO-03`, `@example.com` addresses), so
  it carries no real personal data.
- **`movement-236.log` and the run's own evidence file are not the same bytes, and the difference is
  checkable:** `tail -n +2 movement-236.log | md5sum` = **`cb6877b56b3e941ffcc314ebaabfa9d8`** — *exactly*
  the evidence file's own md5. The wrapper log is the run's bytes plus one leading `nohup: ignoring input`.
  Both are filed because a reader comparing them should be able to see that for themselves.

## The artifacts, byte-exact, with where each came from

| filed as | copied from | bytes | md5 |
|---|---|---|---|
| `cutover-20261020-065020-evidence.txt` | `/tmp/cutover-20261020-065020-evidence.txt` | 7,601 | `cb6877b56b3e941ffcc314ebaabfa9d8` |
| `cutover-20261020-065020-build.log` | `/tmp/cutover-20261020-065020-build.log` | 442 | `2348f8189bb2e76162444a216d80312f` |
| `cutover-20261020-065020-seed.log` | `/tmp/cutover-20261020-065020-seed.log` | 1,996 | `552028c06a2c799d7740496a82f31e59` |
| `cutover-20261020-065020-pb-overview.json` | `/tmp/cutover-20261020-065020-pb-overview.json` | 14,859 | `5e334f212543bb06032991e1bbdfbcb1` |
| `movement-236.log` | `/tmp/movement-236.log` | 7,623 | `44d2447f43118218255d0e8bbf8f5839` |
| `live236.out` | `/tmp/live236.out` | 1,424 | `5f9c6528ec43be314e9f7c6c5eb4b5e9` |
| `db236.out` | `/tmp/db236.out` | 487 | `a45a8e5f2e879415816144948b3e1d39` |

**Staging note.** `.gitignore:6` is `*.log`, so the two `.log` files were staged with **`git add -f`** after
`git check-ignore -v` was run on their **untracked** names and printed `.gitignore:6:*.log` (rule 27).
**A nuance worth keeping, measured while doing it:** `git check-ignore` prints nothing and exits **1** for a
path that is *already tracked* — it warns you about a new `.log` and stays silent about one already in the
index — so the staged-list read-back (`git diff --cached --name-only`) is the check that catches a skip.

**No credential appears in any filed file, audited before staging:** the only occurrences of "token" are
`demo login token chars: 201 (expect >100)` and the two 401/200 lines of `live236.out` — lengths and status
codes, never a value. Nothing here changes `server/` or `client/`, and no movement was run to produce this
record.
