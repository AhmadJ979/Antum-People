# Cutover #2 — 2026-10-09 12:34:06–12:35:03 UTC (deployed tree `2028894` → `0dd1a97`)

Run by the lead with `bash /home/team/shared/deploy-main.sh`. **Exit 0.** Everything below is read off the
running system, not off the script's intentions.

## Why a cutover was owed — measured, not assumed

The morning's rule for deciding this: diff the served tree against `origin/main` and count the files under
`client/` or `server/`. Before this run:

```
git diff --stat 2028894 origin/main -- client server
 client/src/App.tsx               | 100 +++++++++++++++++++--------------------
 server/document-store.js         | 100 ++++++++++++++++++++++++---------------
 server/preboarding-items.test.js |  29 +++++++++---
 3 files changed, 135 insertions(+), 94 deletions(-)
```

**Three files under `client/` or `server/`** — the first real code delta since the morning cutover, because
`client/src/App.tsx` changed (the accessibility fix, #109). Total delta was 83 files; the rest are documents.
Under the morning's own test (0 files under those directories = no cutover owed), this one was owed.

## What the run did

| Step | Result |
|---|---|
| 1. fetch + move the tree | `2028894` → **`0dd1a97`** (merge of #109) |
| 2. client build | **OK** — `tsc -b && vite build`, `dist/assets/index-gt1pFhU5.js` **270,523 bytes**, gzip 75.36 kB, built in 324ms |
| 3. re-seed `--force-clear` | **OK** — demo re-seeded at **12:34:14** (`created_at` on all three cases) |
| 4. restart on port 3000 | old pid 1498 stopped; **product pid 22780** (`node index.js`) took port 3000 |
| 5. verify | **all green** — see below |
| 6. re-arm the watchdog | old guard forced down after 30s; **watchdog pid 23258** (`scripts/keep-alive.sh`) |

The script's own verification battery, verbatim from its output: public URL **200** with
`<title>Antum People</title>`; demo login token **201 chars**; bad password **401**; roster **200**, 13
employees, first id `demo-emp-omar`; KSA offboarding checklist **10 tasks**; consent-date field
`('demo-emp-sarah', 1, '2026-09-23')`; settlement statement **rendered = record (19824.78)**, unfilled
brackets **NONE**, net payable 32824.78.

## The re-seed reproduced the morning's demo exactly

The re-seed is part of a cutover run, so the documents' figures had to be re-checked rather than assumed.
Read from `/api/preboarding/checklist/overview` on the live product after the run:

| Case | Start | `days_to_start` | `state` | `chip` (server's string, verbatim) | `open_count` |
|---|---|---|---|---|---|
| `OFR-2026-DEMO-01` Omar Al-Farsi | 2026-10-23 | 14 | `clear` | `On track` (slate) | **22** |
| `OFR-2026-DEMO-02` Mariam Al-Kaabi | 2026-10-10 | 1 | `inside_48_hours` | `Inside 48 hours · 21 items open` (amber) | **21** |
| `OFR-2026-DEMO-03` Yousef Al-Hammadi | 2026-10-08 | −1 | `started` | `Started 1 day ago · 21 items open` (rose) | **21** |

`totals`: cases 3 · items 21 · `items_outstanding` 21 · **`cases_without_consent` 3** · `workspace_lines` **43**
· `workspace_lines_open` 43. So **22/21/21 open and 15/14/14 workspace lines are unchanged** — the same dates,
the same counts, the same chips as the 10:46 seed. The documents that pin their figures to "as seeded
2026-10-09 10:46 UTC" are still telling the truth about a seed taken today; only the *time* in that phrase
belongs to the earlier run.

**The documents that are now stale are the ones that name the served bundle** (`index-B3KoM02v.js`,
269,188 bytes) **and the deployed tree `2028894`** as current state. Both changed in this run.

## What is serving now — read anonymously, as a prospect sees it

- `/` → **200**, `<title>Antum People</title>`, HTML points at **`assets/index-gt1pFhU5.js`**
- that bundle, fetched from the **public** URL → **270,523 bytes**, identical to the build in this run's log
- the bundle **carries the accessibility fix**: `intake-offer-ref`, `intake-candidate-name`,
  `intake-start-date`, `task-title-` each present
- `GET /api/preboarding/cases` with **no token** → **401**; with a **foreign `Origin`** → **403**
- deployed tree = **`0dd1a97`**, `git status` clean apart from the watchdog's own untracked
  `server/keep-alive.lock` / `server/keep-alive.out`

**Deployed = `main` = `0dd1a97` as of 12:35:03 UTC.** Anything merged after it is undeployed until the next
cutover, and the next cutover re-seeds the demo again.

## Shelf life, restated because it is unchanged and it is the thing that bites

Case 02's amber window closes at **2026-10-10 00:00 UTC = 04:00 GST**. The re-seed did **not** move it — case
02 still starts 2026-10-10. After that, case 02 reads `started` like case 03, and any demo before it needs a
re-seed first.

## Standing caveat about this machine

The guard was armed and working before this run and this run re-armed it (pid 23258), but **a restart destroys
the guard** and nothing off-host watches it — that failure mode was demonstrated this morning and is unchanged
by a successful cutover. The guard surviving *this* run is not evidence that it survives a restart.
