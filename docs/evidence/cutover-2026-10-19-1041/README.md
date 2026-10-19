# Cutover 2026-10-19 10:40:31Z → 10:41:27Z — `e19a98a` → `a5aa0e6`

**Run by the lead, on the owner's word, from the frozen tip.** The owner gave the word at ~10:39Z
("run the refresh from the tip, measure, move and re-seed before any demo"); the tip was frozen at
`origin/main` = **`a5aa0e62f22900c330c7867b2947e84ffbd72f25`** and no merge was taken between the word and
the movement. The movement itself took **56 seconds** (10:40:31 → 10:41:27Z), not a window.

## What moved

| | |
|---|---|
| tree | `e19a98a` → **`a5aa0e6`** (40 commits; `client/` UNCHANGED from the measured `d0422f4`, so the package stands) |
| served bundle | **`assets/index-BG0peuOK.js`, 274,242 B, md5 `f65f15c109e76e86cd8b8abe7102f748`** |
| served stylesheet | `assets/index-pNSrK3wr.css`, 35,365 B, md5 `eda548202468a7e0293053981037a594` |
| the figure's status | **measured on the served bytes**, not quoted: fetched off the public URL and hashed here (below) |
| was serving | `index-Bh1-0KrL.js` (tree `e19a98a`) |

## The measurements, all taken after the run

- `GET /assets/index-BG0peuOK.js` over the public URL → **200, 274,242 bytes, md5 `f65f15c1…`** — the
  bytes the public downloads are the bytes we measured. `GET /assets/index-pNSrK3wr.css` → 200, 35,365 B,
  md5 `eda54820…`.
- `GET /` → **200**, and the served HTML names `assets/index-BG0peuOK.js` (`served-index.html`).
- `GET /api/compliance/notice` → **401 without a token, 200 with one**; `version` **v2.3**; the served
  `content` hashes to md5 **`6004b0a5b23ac5aa68415da5e45ec2cd`** and is **`diff`-identical to
  `templates/privacy-notice.md` at `a5aa0e6`** (`notice-served.json`).
- The two retired routes answer **404 with a valid token**: `GET /api/compliance/report`,
  `GET /api/employees/demo-emp-omar`.
- Port 3000 is the product server (**pid 11319**); the guard is **pid 14104**, named by
  `server/keep-alive.lock`, `/proc/14104/cmdline` = `bash scripts/keep-alive.sh`.
- **The host's hook/deploy pair is now ONE revision** — the first time since the replacement: the
  refresh installed 6 of 6 copies from `a5aa0e6`, and the live hook carries
  `source-revision: a5aa0e62f229…` / `source-blob-md5: 728bf2cc…` with **3** `deploy-in-progress`
  marker-reads (`run.log:31`; the served tree's hook had 0). A movement's kill window can now stand its
  own hook down.

## What the run's own log shows (`run.log`, byte-identical to the run-stamped evidence file)

Build OK at the measured asset name (`cutover-20261019-104031-build.log`); `seed OK`; roster **13
employees** (`first id: demo-emp-omar`); **three distinct flag states** — `started` (2026-10-18),
`inside_48_hours` (2026-10-20), `clear` (2026-11-02); KSA offboarding checklist **10 tasks**; the
departing employee's consent-date field reads `('demo-emp-sarah', 0, None)` — the fabricated consent the
seeder used to write is absent; settlement statement matched (record `19824.78` = rendered `19824.78`,
**no unfilled `[brackets]`**, net payable `32824.78`). Demo login token 201 chars; bad-password path 401.

## Two things the run states plainly, neither hidden

1. **`WARNING: old watchdog still alive after 30s — forcing it down`** (`run.log:81`). The previous guard
   (pid 1106) did not exit on its own inside the deploy's grace period, so step 6 forced it down before
   arming pid 14104. The lock and `/proc` agree on 14104 after the run, so the guard is the one the tree
   just deployed — but the 30-second grace period is a real number to keep in view, not a clean handover.
2. **A pre-boarding case crossed the 48-hour mark while the app was not running** (`run.log:48`), noticed
   **82.68h** late. The flag is **derived**, and it read correctly on the first read after the restart;
   nothing was marked missed. That 82.68h is the *app's* own lateness arithmetic, **not** an observed
   outage — no artifact here timestamps the first answer, so this record measures the movement, not an
   exposure window.

## Before / after, as the live API serves it

`before-overview-AE.json` (md5 `5d95a694…`, taken 10:40Z pre-movement) and `after-overview-AE.json`
(md5 `e879de04…`, taken post-movement after the re-seed): 3 cases, 21 items, 43 workspace lines,
1 case with the notice not shown, in both. The re-seed is what makes the tile and the row agree —
**movement, then re-seed, then demo.**

## Files (md5)

```
after-overview-AE.json                     e879de04a47e0fb166b8aff36559dd44
before-overview-AE.json                    5d95a694c8bcd7b90543f6988ddc972f
cutover-20261019-104031-build.log          40c8a19ea94e0ab29bcdf087d949c9a2
cutover-20261019-104031-evidence.txt       8ab025840c92820ab9351d25dada70b9   (= run.log, see below)
cutover-20261019-104031-seed.log           d8bdf5be32b87eb07b248959d802dbc9
notice-served.json                         bc9318f2994dd43dd9ccb692d9b0ab2f
preflight.log                              2fce4db4470bb505ed35554643bffd31
run.log                                    8ab025840c92820ab9351d25dada70b9
served-index.html                          89cbd358c2b132d74880713c6ab07aae
```

**`run.log` and the run-stamped evidence file are the same bytes** (one md5 above) — the deploy writes
its evidence as a copy of its stdout. They are kept under both names so a reader can find the file the
run's own last line names, and the shared hash is stated rather than left to look like two independent
artifacts. The logs are staged with `git add -f`: `.gitignore:6` carries `*.log` and has swallowed a
record's own evidence twice.

## What this record does NOT prove

- **No off-host observer.** Nothing here detects a replacement, and a placeholder answering 200 still
  looks healthy (decision 5). Repair is fast; detection is still nothing.
- **No outage or repair duration.** Nothing here timestamps the first answer.
- **Not the next movement's precondition.** This is the record of one run at one tip; `a5aa0e6` is the
  served tree as of 10:41:27Z and any later merge moves the tip past it.
