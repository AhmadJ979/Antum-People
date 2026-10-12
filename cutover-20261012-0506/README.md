# Cutover #4 — 2026-10-12 05:06:55–05:07:21 UTC (deployed tree → `b54412d`)

Run by the lead (`deploy-main.sh`), **exit 0**, both clock times read off the run's own log committed beside
this file (`raw-evidence.txt`). This record was filed by **task `cffd9fc3`**, whose premise was that the run's
evidence was sitting in `/tmp` — not durable on a host that had just rebooted, destroying the product and its
guard. **The files were copied out of `/tmp` before anything else was written**, and every figure below is
either re-derived in my own session (marked *measured here*, with its read time) or quoted as the run's own
output (marked *the run's*).

## Why a cutover was owed — the team's test, applied

The test: diff the served tree against `origin/main` and count the files under `client/` or `server/`.
Cutover #3 left the tree at **`da3330d`**; this run deployed **`b54412d`**:

| | |
|---|---|
| delta `da3330d..b54412d` | **142 files** |
| of them under `client/` or `server/` | **6** — `client/src/App.tsx`, `server/index.js`, `server/preboarding-items.js`, `server/preboarding-items.test.js`, `server/preboarding.js`, `server/preboarding.test.js` |
| measured | `git diff --name-only da3330d b54412d` (this session) |

The six are the envelope change (**#125**, merged `b12b557`) plus the comment-only `totals` JSDoc (**#132**,
`server/preboarding-items.js`). Under the standing test the cutover was owed, and it is the second one owed
by code rather than by documents.

## What the run did — from `raw-evidence.txt`, the run's own stdout

| Step | Result |
|---|---|
| 1. fetch + move the tree | `HEAD is now at b54412d` — "Merge pull request #132 from AhmadJ979/docs/overview-totals-rule"; **tree content check OK** |
| 2. client build | **OK** — `tsc -b && vite build`, `dist/assets/index-Dt2oLspq.js` (vite prints `270.96 kB`, gzip 75.59 kB, built in 431ms) |
| 3. re-seed the demo dataset | **OK** — `FORCE CLEAR`, then all three cases re-created |
| 4. restart on port 3000 | old pid **380** stopped; **a foreign process held the port and was evicted** (see the finding); **product pid 1610** (`node index.js`) took it |
| 5. verify the live demo end to end | **all green** — battery below |
| 6. re-arm the watchdog | **watchdog pid 1707** |

**The build line is rounded; the artifact is not.** Vite prints `270.96 kB`; both the file the build wrote and
the bytes served over HTTP measure **270,962**. This is the same rounding that produced the 270,981/270,982
error on 2026-10-09 — the builder's line is a summary, never the size.

## The served asset — read off the live surface by me

| | |
|---|---|
| page | **200** |
| asset | **`assets/index-Dt2oLspq.js`** |
| bytes | **270,962** (`stat`) |
| md5 | **`5720cd6fbeca1966cb642f9cf6338a9c`** |
| read at | 2026-10-12 ~05:20Z, `curl` off port 3000, this session |

**And it could not have been anything else:** `git diff --name-only b12b557 origin/main -- client` = **0 files**
(measured here). The bundle is built from `client/`, nothing under `client/` has changed since the envelope
merge, so the artifact this run built is the artifact serving now — the same bytes two people verified on
2026-10-09, which is precisely why this cutover could ship it unaltered.

**The tree being served:** `pgrep -f 'node index.js'` → **pid 1610**, whose own cwd is
`/home/team/shared/probable-octo-sniffle/server` — the run's product pid, and the only product process
(pid 4770, in `/home/agent-product-designer/rig-served/`, is the designer's isolated rig, rule 26).

## The seed's three states, as the live API served them

Parsed by me out of `pb-overview.json`, the run's own capture (`GET /api/preboarding/overview`):

| start | state | tone | `open_count` | `hours_to_start` | chip |
|---|---|---|---|---|---|
| 2026-10-11 | **`started`** | **rose** | 21 | −29.12 | "Started 1 day ago · 21 items open" |
| 2026-10-13 | **`inside_48_hours`** | **amber** | 21 | +18.88 | "Inside 48 hours · 21 items open" |
| 2026-10-26 | **`clear`** | **slate** | 22 | +330.88 | "On track" |

**`distinct flag states: ['clear', 'inside_48_hours', 'started']`** — three cases, three states, as seeded.

The `totals` block the same response carried, verbatim:
`{"cases": 3, "cases_provisioned": 0, "cases_ready": 0, "cases_without_consent": 3, "items": 21,
"items_outstanding": 21, "items_received": 0, "items_verified": 0, "workspace_lines": 43,
"workspace_lines_open": 43}`

**Two fields, never summed:** `items_outstanding` **21** and `workspace_lines` **43** measure different
things, and adding them is meaningless. The per-case arithmetic shows why: `open_count` = that case's
employee-track items (7 in every case) + its workspace lines (**14 / 14 / 15** → 21 / 21 / 22), while the
totals' `items_outstanding` is the 7-per-case employee figure that reads **21** across three cases. The
workspace line counts differ by case because the lines are derived from each case's own role and department —
the third case carries `ws_finance_system_access`, which the other two do not.

## Security post-conditions

**The run's own battery, from `raw-evidence.txt`:** public status/title **200 `<title>Antum People</title>`** ·
demo login token **201 chars** (expect >100) · bad-password path **401** · roster **200**, **13 employees**,
first id `demo-emp-omar` · KSA offboarding checklist **10 tasks** (Hardware Return → Final Settlement
Payment) · consent-date field present for the departing employee (`demo-emp-sarah`, 1, `2026-09-23`) ·
settlement statement **rendered EOSB equal to the employee record** (`19824.78` = `19824.78`, match `True`),
**no unfilled `[brackets]`**, net payable `32824.78`.

**Re-measured by me, uncredentialed, at ~05:20Z:** no token → **401**; foreign `Origin` → **403**;
bad-password login → **401**. The product's own `server.log` carries my probe as its own line:
`[cors] refused Origin https://evil.example for GET /api/employees`.

**Not re-measured by me, and not claimed as mine:** the demo token's 201 characters and the roster's 13
employees need the demo credential, so those two stand as **the run's** figures. (Rule 26: a credentialed
pass belongs on an isolated rig, not the live product.)

## The guard and the product — pids, with this host's clock caveat reproduced

| | |
|---|---|
| guard | its **own log** (`/home/team/shared/probable-octo-sniffle/server/keep-alive.log`): `2026-10-12T05:07:15+00:00 armed as its own session leader (pid 1707)` — the earlier arm it replaced was `2026-10-09T13:46:37` (pid 17156) |
| guard, kernel-side | `/proc/1707` created **2026-10-12 05:07:15.865Z** — agrees with the log |
| product | `/proc/1610` created **2026-10-12 05:07:11.565Z** — inside the run's own window |
| both alive | yes, at ~05:20Z: `1610 node index.js`, `1707 bash scripts/keep-alive.sh` |

**`ps` disagrees, and `ps` is the one that is wrong here.** For those same two pids `ps -o lstart` reports
**05:09:30** and **05:09:35** — 2m19s later than their `/proc` creation times, and later than the run window
that the processes' own logs place them inside. The kernel's `btime` / `who -b` / `uptime -s` read
**05:05:24Z**, which carries the same offset: applying the measured 2m20s the brief's boot time of
**05:03:04Z** follows. **Recorded as measured, not resolved by preference:** on this host the `ps`/uptime
family is offset by about +2m20s while `/proc` file times and process-own logs agree with each other, which is
the standing method note (*trust a process's own log*) reproduced with a number attached.

## The evidence is run-stamped — and that is the rule-28 fix

Every artifact this run wrote carries the run stamp **`cutover-20261012-050655`**, and the run's own footer
names them:

```
=== cutover finished 2026-10-12T05:07:21+00:00 — run-stamped evidence:
    /tmp/cutover-20261012-050655-evidence.txt | build: /tmp/cutover-20261012-050655-build.log
    | seed: /tmp/cutover-20261012-050655-seed.log ===
```

This is the fix for the 10:46/13:46 mix-up, where three same-named files made one run's bytes look like
another's. Here the names cannot collide, and the evidence file's **own first line** confirms it:
`=== cutover 2026-10-12T05:06:55+00:00 ===` (rule 28 — identity from the artifact's content).

**One artifact's name would have misled me, so I checked rather than cited:** `/tmp/cutover-page` (filed in
`extra/`) is *not* the placeholder page — it references `/assets/index-Dt2oLspq.js`, i.e. it is the **product's
own served HTML**. The placeholder's evidence is instead the run's step-4 line, below.

## The finding — the failure mode, stated as one

**The host rebooted at 05:03:04Z and took the product and its guard with it. The platform's supervised
placeholder (`vite dev` from `/home/team/shared/site`) claimed port 3000, so from the reboot until the
product's first listen at 05:07:11.565Z the public URL answered 200 with a page that was not the product —
the wrong site, not an error.**

What is measured, link by link:

- the reboot: kernel-derived readings in the paragraph above, carrying a **−2m20s** correction to reach
  05:03:04Z;
- the product and guard being gone: the run stopped **pid 380** and re-armed the guard at 05:07:15, and the
  guard's log shows the 2026-10-09 arm (pid 17156) ending with no successor until this run;
- **the placeholder holding port 3000**, verbatim from the run: *"port 3000 held by a foreign process (pid
  1558: node /home/team/shared/site/node_modules/.bin/vite dev) — evicting and re-claiming"*;
- the product taking it back: `/proc/1610` created 05:07:11.565Z, and the run's window closes 05:07:21.

**The one link nobody sampled is what the URL returned during those four minutes** — the run's eviction line
proves the placeholder held the port at 05:07, and the product was down before that, but no request was
captured from the interval itself. Stated because the difference matters: **a visitor would have seen the
wrong site rather than a failure**, which is worse than an outage for anyone who happened to look.

**And it can happen again, which is the part worth carrying forward:** the platform restarted the placeholder
anyway — **pid 1631**, `node /home/team/shared/site/node_modules/.bin/vite dev`, started ~05:09, alive at my
read, merely unable to bind because the product holds 3000. It is a standing competitor for the port, and only
the product holding it first keeps the URL honest.

### The "noticed N late" lines are a seeder artifact, not an outage

The product's log emits two lines of the form *"This case reached the 48-hour mark while the app was not
running (noticed **77.12h** late) … nothing is marked missed"*. They invite a multi-day-outage reading. **The
arithmetic refutes it:**

| case start | its 48-hour mark | age of that mark at 05:07:11Z |
|---|---|---|
| 2026-10-11 | 2026-10-09T00:00Z | **77.12 h** ✱ in the log |
| 2026-10-13 | 2026-10-11T00:00Z | **29.12 h** ✱ in the log |
| 2026-10-26 | 2026-10-24T00:00Z | 282.88 h **in the future** — and no line, as expected |

The two figures in the log are **exactly** the ages of those two cases' own 48-hour marks at the moment the
seeder wrote them. The flag is derived on read, was correct on the first read after the restart, and the log
says so itself: *"the flag itself is derived and read correctly on the first read after restart; nothing is
marked missed."* **A freshly seeded case whose mark is already in the past produces this line; it measures the
seed's dates, not any outage.**

## What is in this record, and how it got here

| file | source | bytes |
|---|---|---|
| `raw-evidence.txt` | `/tmp/cutover-20261012-050655-evidence.txt` | 3,415 |
| `build.log` | `/tmp/cutover-20261012-050655-build.log` | 442 |
| `seed.log` | `/tmp/cutover-20261012-050655-seed.log` | 1,432 |
| `pb-overview.json` | `/tmp/cutover-20261012-050655-pb-overview.json` | 14,614 |
| `deploy-run.log` | `/tmp/deploy-run-1210.log` | 3,415 |

**The sources were copied, not moved**, so the running surface keeps its own copies until this merges.
**`deploy-run.log` and `raw-evidence.txt` are byte-identical** (both md5 `bb5401129c8003b8dabc81026b9d4c8c`) —
the evidence file *is* the script's stdout, so these are one artifact under two names, and it is recorded that
way rather than presented as two independent captures.

**`extra/` — three further artifacts of the same run, rescued for the same reason the five above were** (the
row named five files; these were also in `/tmp` and would die with it, so they are filed rather than described):

| file | what it is |
|---|---|
| `extra/served-page.html` | the product's served HTML captured with the run (799 B, references `index-Dt2oLspq.js`) — **not** the placeholder page |
| `extra/employees.json` | the roster the run's security check read: **13** employees, first `demo-emp-omar` (11,617 B) |
| `extra/settlement.json` | the settlement document content the run's EOSB check rendered (3,003 B) |

**Notes for the merge:** `*.log` is gitignored (`.gitignore`), so `git add -f` was used for the log files and
the **staged list was read back** before committing (rule 27 — the gitignore has swallowed a record's own
evidence before). `origin/main` has moved past the deployed tree since the run — see below — and this record
is docs only: **no file under `client/` or `server/`**.

## The one figure in this record that is already stale, and why it does not matter

The brief expected `origin/main` to still be `b54412d` ("nothing merged since 2026-10-09"). **Measured at
~05:20Z, it is `b87b065`** — `#139` (`pdpl/acknowledgement-route-spec`) merged after the run:

| | |
|---|---|
| how measured | `git fetch origin --prune`; `git rev-parse --short origin/main` → `b87b065`; `git log --oneline --first-parent -2 origin/main` |
| delta `b54412d..origin/main` | **2 files** — `docs/evidence/pdpl-acknowledgement-spec/README.md`, `pdpl-acknowledgement-route-spec.md` |
| of them under `client/` or `server/` | **0** |

So the deployed tree and `main` differ, **no cutover is owed by the difference**, and the served bundle is
unaffected — which is the same statement the `b12b557..origin/main -- client` = 0 measurement makes from the
other end.
