# Pre-cutover render — the bundle the lead is about to ship, built and rendered

**Verdict, first: no client-side break found, and the quoted artifact is right.** The tree the cutover ships
(`7d95fbb`) builds to exactly the bundle three of us have been quoting — `assets/index-Dt2oLspq.js`,
**270,962 bytes, md5 `5720cd6fbeca1966cb642f9cf6338a9c`** — and that build, served on a rig, renders: the
Pre-boarding case list shows **three cases**, its "Cases open" tile reads **3** (that tile is the *only*
consumer of the `#125` envelope, `client/src/App.tsx:1682` ← `:586`), the same surface survives an empty
jurisdiction without an error, and the five surfaces' labels are **unchanged at 5 · 15** on this new bundle.
The cutover can run as sequenced.

Pass taken **2026-10-09 15:27:38 – 15:29:53 UTC**, on an isolated rig (own worktree, own database, own port
4741, own `JWT_SECRET`/`ENCRYPTION_KEY`, own throwaway credential). Nothing was written, re-seeded or
restarted on the product; the demo credential was never read (rule 26); the live surface was checked before
and after and stayed **200** throughout.

## 1. The artifact, proven before anything was read off it

| what | measured |
|---|---|
| tree built | `7d95fbb360358fc7abe7b75e73369698bc3c08da` — `origin/main`, fetched fresh; `main` had **not** moved past the briefed tree |
| build | `(cd client && npx tsc -b --force --verbose)` exit **0** · `npx vite build` exit **0** — `raw/build.txt` |
| built asset | `index-Dt2oLspq.js` · **270,962 bytes** · md5 **`5720cd6fbeca1966cb642f9cf6338a9c`** |
| stylesheet | `index-BLszozVg.css` · 35,199 bytes · md5 `e493ab996d7bb81b4568b2183e9204f9` |
| served by the rig over HTTP | same 270,962 bytes, same md5 (fetch of `/assets/index-Dt2oLspq.js`) |
| quoted expectation in the task brief | 270,962 bytes / `5720cd6fbeca1966cb642f9cf6338a9c` → **match** |

`tsc -b` was run from `client/` on purpose: at the repo root there is no `package.json` and `npx tsc -b`
resolves to the unrelated npm package, which exits 1 and looks like a compiler error.

Because the two identities agree, the instruction to stop and message the lead did not arise — reported
here as a measurement, not as a claim that the check was unnecessary.

## 2. A rig defect found on the way, and fixed rather than worked around

The first rig start **ran twice** (a lagging terminal session delivered the queued command late). The second
run `rm`'d `db.sqlite` out from under the first server and died on `EADDRINUSE`, so:

- the process actually holding port 4741 was run 1, whose fd 22 pointed at
  `…/db.sqlite (deleted)` — the *old* inode;
- `server.log` described run 2, the process that had already crashed;
- `scratch-pass.txt` held run 2's password while the live process served run 1's database, so
  `POST /api/login` answered `{"error":"Invalid username or password"}`.

The first browser pass therefore rendered the **pre-login shell** (`token acquired, length 0`). It is kept,
not deleted, as `raw/pass-run0-discarded-no-session.txt` — it is a record of a bad rig, **not** evidence,
and no figure below comes from it.

`scripts/rig-cutover-setup2.sh` is the fix and is self-verifying: it kills a listener **only** if
`/proc/<pid>/cwd` is this rig's `server/`, then proves one listener, a database fd pointing at the *current*
file (no `(deleted)`), `login` 200, `/api/employees` without a token 401, and live `:3000` 200 —
`raw/rig-construction.txt`. A file's name is not evidence of its contents; this is that lesson in process
table form.

## 3. The rendered pass — the part nobody had done

Every capture carries its own page identity beside it (rule 25): the page's module script `src` is
`/assets/index-Dt2oLspq.js` in **all** eleven readings, and is recorded in each `raw/*.json` under
`page_script_src`. The DOM reading sits in the JSON next to the picture in `shots/`.

| surface (app's own nav label) | script `src` | "Sample Demo Data" | "Illustrative" | reading | picture |
|---|---|---|---|---|---|
| Executive Dashboard | `/assets/index-Dt2oLspq.js` | 1 | 5 | `surface-dashboard.json` | `shots/dashboard.png` |
| Employee Directory | `/assets/index-Dt2oLspq.js` | 1 | 0 | `surface-employees.json` | `shots/employees.png` |
| Transitions Hub | `/assets/index-Dt2oLspq.js` | 1 | 0 | `surface-transitions.json` | `shots/transitions.png` |
| Pre-boarding | `/assets/index-Dt2oLspq.js` | 1 | 0 | `surface-preboarding.json` | `shots/preboarding.png` |
| Strategic Intelligence | `/assets/index-Dt2oLspq.js` | 1 | 10 | `surface-analytics.json` | `shots/analytics.png` |
| **TOTAL** | | **5** | **15** | | |

**Nothing moved.** These are the authoritative register's figures (`docs/evidence/label-per-surface-2026-10-09/`)
read on a **different bundle** — the first render of the `#125` client change. Method is that register's own:
a case-insensitive substring count over `document.body.innerText`, driving the app's own nav with real
clicks. `textContent` counts were taken too and agree (5 · 15). **Which one is reported:** `innerText`.

Casing, measured rather than assumed: the badge renders UPPERCASE, so a case-sensitive `'Sample Demo Data'`
count over `innerText` returns **0** on every surface; the case-sensitive `'Illustrative'` count over
`innerText` returns 5 on the Dashboard and 7 on Strategic Intelligence — i.e. rendered casing varies inside
one surface, which is exactly why the count is case-insensitive. Strategic Intelligence's eleven
label-bearing nodes are listed verbatim in `raw/surface-analytics.json` and match the register's inventory
(the four cohort figures extract here as `82% (Illustrative)`, a granularity difference in extraction, not
a count difference).

## 4. The envelope consumer — why this gate existed

`#125` changed one client line (`client/src/App.tsx:586`) to `setPreboardingCases(data.cases)`, with **no
fallback to a bare array on purpose**, and that array feeds exactly one place: the `Cases open` tile
(`:1682`, `preboardingCases.length`). Rendered on the built bundle:

- **tile = 3**, and the roll-up beneath it renders **three rows** — `raw/pb-rows.json`, `shots/pb-rows.png`:

| case | row chip | flag state rendered |
|---|---|---|
| Omar Al-Farsi | `UAE` · **On track** | no raised flag · `Start: 2026-10-23 · 14 d` |
| Mariam Al-Kaabi | `UAE` · **Inside 48 hours · 21 items open** | "21 items open · start in 48 hours or less" · `Start 2026-10-10 · **8.5 h before 00:00 on the start date**` |
| Yousef Al-Hammadi | `UAE` · **Started 1 day ago · 21 items open** | "Started with 21 items still open" · `Start 2026-10-08 · 1 d ago These were due before day one.` |

The amber copy is **coherent**: read at 15:29 UTC on 2026-10-09, a start of 2026-10-10 00:00 is 8.5 hours
away, which is what the row says; the server's own derivation log agrees to the minute (`noticed 39.41 h
late` / `87.48 h late` for the two cases that crossed the 48-hour mark while the app was not running —
`raw/server.log`). The employee-track items carry no owner while every workspace line names one, which is
P2-4's rule, not a gap.

- **The empty case is exercised too.** Clicking the header jurisdiction chip to **KSA** gives `Cases open: 0`,
  no rows, and no error — the tile and the "No open KSA pre-boarding cases" panel render from the same
  envelope; clicking back to **UAE** restores 3 and the three rows (`raw/jur-ksa.json`, `raw/jur-uae.json`,
  `shots/pb-jur-ksa.png`, `shots/pb-jur-uae.png`). A consumer that read the wrong key would have failed on
  both counts, not one.

## 5. The All chip and the function chips (`#119`'s gesture)

On Omar Al-Farsi's expanded row the chips read **`All (15)` · `IT (6)` · `Admin (3)` · `HR (2)` · `Manager (4)`**
— `All` equals the sum of the four functions, i.e. it states the **case's** figure rather than the current
view's, and the counts do not blink out while a view is being read. The select-then-reselect sequence — the
gesture that used to leave the previous case's board under the chip — moves the dark chip `All (15)` →
`IT (6)` → `All (15)` with the same four counts (`raw/board-1-initial.json`, `raw/board-2-it.json`,
`raw/board-3-all-again.json`; `shots/pb-row1-*.png`).

**Limit, stated rather than hidden.** The *content* comparison of the All board before and after the IT
round-trip was obtained for **one case only** — Mariam Al-Kaabi, whose board renders four groups
`IT · 0/5 · ADMIN · 0/3 · HR · 0/2 · MANAGER · 0/4` (14 lines, the per-role derivation of P2-4). My
follow-up pass re-clicked a row that was already expanded (the row toggle *closes* it), so for Omar the
three board JSONs hold the chip state and no board text (`region_found: false`, `region_len: 0`) and
`boardD-case2-all.json` is the only board captured. The helper that would have re-run this correctly
(`probes/pass-ensure.js`) is included but **was not run**, so case 1's board-content equality after the
`IT → All` round-trip stands **unperformed** — the chip state and the counts are measured, the board text is not.

## 6. Network and console

`raw/network-requests.txt`: document 200 · **`/assets/index-Dt2oLspq.js` 200 then 304** · CSS 200/304 ·
`GET /api/preboarding/cases?jurisdiction=AE&status=open` **200** · `…/checklist/overview?jurisdiction=AE`
200 · single-case `checklist` / `package` / `workspace` 200. The failure mode that matters for a rig of this
kind — the `crossorigin` bundle answered 5xx by a CORS rule that refuses the page's own origin, rendering
blank — **does not occur** (no 5xx anywhere in the capture).
`raw/page-errors.txt` is **empty (0 bytes)**; `raw/console.txt` likewise.

## 7. What this does not cover

- One build, one host, one pass. The md5 identity proven here is **build ↔ rig**: these bytes are what tree
  `7d95fbb` builds and what the rig served. It is *not* a claim about what the live URL serves tonight until
  the cutover actually runs.
- Labels were measured on the **AE-first default** only; the KSA switch was exercised on Pre-boarding, not
  re-measured across all five surfaces.
- Nothing here touches the unreachable Exit Intelligence Intake modal (owner decision 16), document storage,
  or the consent path; no write, no seed, no deploy, no restart was performed against the product.
- The demo's own shelf life (case 02's amber window, decision 2) is unchanged by this row.

## 8. Reproduction

| what | where |
|---|---|
| rig construction, ownership proof, credential, health contract | `scripts/rig-cutover-setup2.sh` · `raw/rig-construction.txt` |
| the five-surface pass, in order, every click and probe return | `scripts/rig-cutover-pass.sh` · `raw/pass-1-five-surfaces.txt` |
| the board/chip pass | `scripts/rig-cutover-board-pass.sh` · `raw/pass-2-board.txt` |
| the bad rig, kept as a record and not as evidence | `raw/setup-run1-defect.txt` · `raw/pass-run0-discarded-no-session.txt` |
| probes (counts + page identity, clicks, rows/flags, board) | `probes/` · md5s in `raw/md5-manifest.txt` |
| per-capture identity and reading | `raw/*.json` (`page_script_src`) beside `shots/*.png` |
| this pass's own asset identity | `raw/asset-identity.txt` |

The rig's credential is a throwaway inserted into the rig's own database and deleted with it; **the demo
credential is not in this directory nor anywhere in this repository.**
