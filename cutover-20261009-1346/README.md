# Cutover #3 — 2026-10-09 13:46:11–13:46:43 UTC (deployed tree `0dd1a97` → `da3330d`)

Run by the lead with `bash /home/team/shared/deploy-main.sh`. **Exit 0**, both clock times read off the run's
own log committed beside this file (`raw-evidence.txt`). Everything below is read off the running system:
what I re-derived myself is marked as measured in this session, and what is quoted from the run is marked as
the run's own output rather than restated as mine.

## Why a cutover was owed — measured, not assumed

The team's test: diff the served tree against `origin/main` and count the files under `client/` or `server/`.
Before this run:

| | |
|---|---|
| delta `0dd1a97..da3330d` | **76 files** |
| of them under `client/` | **1** — `client/src/App.tsx` |
| of them under `server/` | **0** |

**The first code merge to owe a cutover.** Every earlier delta today was documents; this one carried the
All-chip race fix (#119, head `84bdef2`, merged as `da3330d`). Under the same test (no delta under those two
directories = no cutover owed), this one was owed.

## What the run did

| Step | Result |
|---|---|
| 1. fetch + move the tree | `0dd1a97` → **`da3330d`** ("Merge pull request #119 from AhmadJ979/fix/all-chip-race-2c37f2da"), tree content check OK |
| 2. client build | **OK** — `tsc -b && vite build`, `dist/assets/index-B8Hoaanh.js` (vite prints `270.98 kB`, gzip 75.59 kB, built in 252ms); `index-BLszozVg.css` 35.19 kB unchanged |
| 3. re-seed the demo dataset | **OK** — `FORCE CLEAR`, then all three cases re-created (see below) |
| 4. restart on port 3000 | old pid **22780** stopped; **product pid 16561** (`node index.js`) took port 3000 |
| 5. verify the live demo end to end | **all green** — see below |
| 6. re-arm the watchdog | **watchdog pid 17156** (`bash scripts/keep-alive.sh`) |

**Measured sizes, not the rounded build line.** The builder prints `270.98 kB`; the artifact is **270,982
bytes**. Both the file on disk in the deployed tree and the bytes served over HTTP measure 270,982 in this
session, and the builder's rounded figure is the only place 270,981 ever appeared. Use the measured number.

## The run's own verification battery, verbatim from `raw-evidence.txt`

public status/title **200** `<title>Antum People</title>` · demo login token **201 chars** · bad password
**401** · roster **200**, 13 employees, first id `demo-emp-omar` · KSA offboarding checklist **10 tasks**
(Hardware Return → Final Settlement Payment) · consent-date field present for the departing employee · and the
settlement statement produced a **rendered EOSB equal to the employee record's own value**, with **no unfilled
`[brackets]`** and a net payable computed.

**The figures behind that last check are deliberately not restated here.** Rule 4 forbids pasting an EOSB
figure into a report or a commit, and it does not carve out the demo roster, so the record names the check and
the raw file carries the numbers: `raw-evidence.txt`, step 5, is the primary source and was staged by the run
itself. Compare the two values there rather than trusting this sentence.

One line from the run is worth keeping beyond the pass/fail columns, because it is about a rule rather than a
number:

```
[preboarding-flag] 2688b889-… — This case reached the 48-hour mark while the app was not running
(noticed 85.77h late). The flag itself is derived and read correctly on the first read after restart;
nothing is marked missed.
```

The 48-hour flag is derived on every read and never stored, so a restart cannot make it late or lose it. A
cutover that stopped the app across a case's boundary **did not** damage the flag — that is the gate behaving
as designed, recorded here because the next reader will wonder.

## The re-seed, and what it did not move

The seed's own log for this run re-created the three cases:

| Case | Start | The seed's own line |
|---|---|---|
| `OFR-2026-DEMO-01` Omar Al-Farsi | 2026-10-23 | on track — 14 days out, three items requested, none verified |
| `OFR-2026-DEMO-02` Mariam Al-Kaabi | 2026-10-10 | inside 48 hours with every item still open |
| `OFR-2026-DEMO-03` Yousef Al-Hammadi | 2026-10-08 | start date already passed, items still open |

**Honest limit:** I did **not** re-read the roll-up figures (22/21/21 open, 15/14/14 workspace lines) off the
live API myself. Reading them needs the demo credential, which is lead-managed and which rule 10 forbids me
to use. The figures this run reproduced are the ones the designer's parallel re-grounding task records; what
this record owns is the seed's own log, committed beside it.

## What is serving now — re-measured in this session

- `127.0.0.1:3000/` → **200**, `<title>Antum People</title>`, HTML points at **`/assets/index-B8Hoaanh.js`**
  with **`/assets/index-BLszozVg.css`**
- that bundle, over HTTP → **270,982 bytes**, md5 **`abfe49feb21dc90b77743922f76a7399`** — identical to the
  file on disk in the deployed tree (same md5, same size)
- the **public** platform URL → **200**, same `<title>`, **the same bundle** and the same stylesheet, and its
  `/api/preboarding/cases` with no token → **401**. The public URL serving the product's own 401 is what says
  it is the product answering there, not a client bundle.
- `GET /api/preboarding/cases` with no token → **401**; with a foreign `Origin` → **403**
- deployed tree = **`da3330d`**, `git status` clean apart from the watchdog's own untracked
  `server/keep-alive.lock` / `server/keep-alive.out`; `client/src/App.tsx` in the tree hashes to
  `7fb5678d0861d977efac3b1521bcaaebdb7e0337`, the same blob `da3330d` and the fix's PR carry

## Deployed = `main`, and the test re-run after later merges

`origin/main` has since moved to **`1371d9a`** (`docs/tracker-round-37` #121, `docs/demo-reground-cutover3`
#122, and the All-chip evidence correction #120). Re-running the team's test on that delta:

```
git diff --name-status da3330d origin/main -- client server     → (empty)
                                              all paths        → 65, every one a document
```

**No cutover is owed for anything merged after this run.** The served tree stays `da3330d` until the next
code merge, and the next cutover re-seeds the demo again.

## Shelf life, restated because it is the thing that bites

Case 02's amber window closes at **2026-10-10 00:00 UTC = 04:00 GST**. This run re-seeded at the same point
in the day as the previous one, so the window is neither extended nor shortened: after 00:00 UTC case 02
reads `started` like case 03, and any demo before it needs a re-seed first.

## Standing caveat about this machine

The guard is alive (pid 17156) but **a restart destroys the guard** and nothing off-host watches it — that
failure mode was demonstrated earlier the same day and a successful cutover does not change it. The guard
surviving this run is not evidence that it survives a restart.

## Where the evidence lives

| file | what it is |
|---|---|
| `raw-evidence.txt` | the script's own stdout for all six steps, timestamps included — the primary source for this record |
| `build.log` | the client build of step 2, verbatim |
| `seed.log` | the seed of step 3, verbatim |

The staged copies at `/home/team/shared/cutover-20261009-1346/` and these differ in no byte. One artifact the
All-chip evidence pack carried was repaired after this run: its mislabelled after-shot is withdrawn and now
sits at `docs/evidence/all-chip-race-2026-10-09/withdrawn-after-2-race-window-DEPICTS-DEFECT-STATE.png`
(it moved **up a level**, out of `shots/`), and that pack's README explains what the file actually depicts.
