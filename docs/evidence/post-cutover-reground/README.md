# Post-cutover re-grounding of the demo documents — 2026-10-09

> **Superseded again, same day — the readings still stand, the bundle moved a third time.** A **third cutover ran 13:46:11–13:46:43 UTC on 2026-10-09** (tree `0dd1a97` → **`da3330d`**, the All-chip race fix #119): the served bundle is now **`assets/index-B8Hoaanh.js`, 270,982 bytes, md5 `abfe49feb21dc90b77743922f76a7399`**, stylesheet `index-BLszozVg.css` unchanged, and the demo was re-seeded in the same run. The banner below (12:34, `index-gt1pFhU5.js`) and this file's own readings were correct when taken and are kept exactly as taken. **The figures it records did not move** — the re-seed reproduced them figure-for-figure, and the sizes in the banners differ only because the bundle did. For current state read `demo-weak-screens.md` and `demo-walkthrough-script.md`; for the run itself read `cutover-20261009-1346/README.md`.
>
> **Superseded in part, same day — the readings stand, the bundle moved.** This is the measurement of the **10:46 cutover's tree (`2028894`)** and it is kept exactly as taken. A **second cutover** ran **12:34 UTC on 2026-10-09** (tree `0dd1a97`, the accessibility fix #109); the served bundle is now **`assets/index-gt1pFhU5.js`, 270,523 bytes** (`assets/index-BLszozVg.css`) and the demo was re-seeded at **12:34:14**. **The figures it records did not move** — the second seed reproduced them figure-for-figure. For current state read `demo-weak-screens.md` and `demo-walkthrough-script.md`.

**Why this exists:** rows `0fb0cd6a` (the demo's counts and the script's spoken figures) and the
audit's P2-4 wording. Every number this file records is a number now written into
`demo-weak-screens.md` and `demo-walkthrough-script.md`, so the two documents can be checked against
their source rather than trusted.

**Who read what.** The **served-surface readings** (bundle identity, endpoint behaviour, bundle string
counts) are mine, taken 2026-10-09 11:55–11:58 UTC. The **case and item counts** were read off the
served surface by the engineer's rendered pass at 10:52–10:56 UTC the same morning, whose raw payloads
are committed under `docs/evidence/p2-4-served-pass/` (merged in #103 as `693325d`). **I did not re-run that
pass** and the documents say so.

## 1. The cutover landed, and the public URL is the product

```
$ curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/                       → 200
$ curl -s http://127.0.0.1:3000/ | grep -i title
     <title>Antum People</title>
     <script type="module" crossorigin src="/assets/index-B3KoM02v.js"></script>
$ curl -s https://<platform dev URL>/ | grep -iE "title|index-"
     <title>Antum People</title>
     /assets/index-B3KoM02v.js          ← the same bundle as :3000
     /assets/index-LszozVg.css          ← the same stylesheet
$ curl -s -o /dev/null -w "%{http_code}\n" "<platform dev URL>/api/preboarding/checklist/overview?jurisdiction=AE"
     401   {"error":"Authentication token required"}
```

The public URL and `127.0.0.1:3000` serve the same bundle, and the public URL's `/api/*` answers with
the **product's own** 401 body — a client bundle's strings cannot produce that. (The website dev
server is a separate process, `node .../vite dev` in `/home/team/shared/site`; the product is
`node index.js` in `/home/team/shared/probable-octo-sniffle/server`.)

## 2. The bundle the public URL serves now carries every string the walk found missing

Counted with `grep -o -F <string> /tmp/served.js | wc -l` against the served bundle
(`assets/index-B3KoM02v.js`, 269,188 bytes):

| String | 2026-10-08 (pre-cutover bundle) | 2026-10-09 (served bundle) |
|---|---|---|
| `HR roll-up` | 1 | 1 |
| `Record an accepted offer` | 2 | 2 |
| `/api/preboarding` | 7 | **10** |
| `Sample Demo Data` | 1 | 1 |
| `before 00:00 on the start date` | 0 | **2** |
| `Pre-reading package` | 0 | **1** |
| `Record acknowledgement` | 0 | **1** |
| `no delivery channel in this release` | 0 | **1** |
| `no delivery channel` (any wording) | 1 | **2** |
| `is not built yet` (the stale client string of row `83c22f60`) | 1 | **0** |
| `View by function` | — | 1 |

`whatever track created it` and `This narrows the board to one function` count **0** in the bundle by
design: both are *server* strings (the payload's own `scope_note` and `view.note`), which is the fix
`83c22f60`/`#96` made — the client renders what the payload sends instead of holding its own copy.

## 3. The figures the two documents now carry — and their source

From the engineer's pass payloads (`docs/evidence/p2-4-served-pass/`), re-read here by script:

| Read | Value | Payload |
|---|---|---|
| `flag.open_count`, cases 03 / 02 / 01 | **21 / 21 / 22** | `payload-overview-ae.json` → `cases[].flag.open_count` |
| workspace `totals.lines`, cases 01 / 02 / 03 | **15 / 14 / 14** | `payload-workspace-01/02/03.json` → `totals.lines` |
| `IT` lines per case (01/02/03) | 6 / 5 / 5 | `available_functions[]` |
| `items_outstanding` | **21** | `totals.items_outstanding` |
| `workspace_lines_open` | **43** (15 + 14 + 14) | `totals.workspace_lines_open` |
| `cases` / `cases_without_consent` | 3 / **3** | `totals` |
| employee track per case | 7 lines, 0 complete, 7 outstanding | `summary.by_track.employee` |
| case 01 `derived_from.profile_keys` | `["finance_department"]` (the 15th line) | `payload-workspace-01.json` |
| start dates, cases 01 / 02 / 03 | 2026-10-23 / 2026-10-10 / 2026-10-08 (seed day 2026-10-09) | `start_date` |
| flag watcher `delivery` / boundaries | `none` / 2 recorded, late by 34.77 h and 82.77 h | `payload-flag-watch.json` |

**The two counts that must never be added:** `items_outstanding` (21, the employee track) and
`workspace_lines_open` (43, the workspace track) are separate fields. "64 outstanding" is not a number
this product computes.

## 4. What this evidence does **not** cover

- The engineer's rendered pass was not re-run by me; its payloads are cited, not reproduced.
- The rendered copy of the flag panel on the clear case (`22 items still open…`) is **derived** from the
  measured `open_count` plus the panel template measured on 2026-10-08 — the template is measured, the
  number is the chip's. The documents tell the presenter to read it off the screen.
- The dashboard headcount ("7 active employees" in the roster caveat) was **not** re-measured here; that
  box is dated to the 2026-10-08 walk.
- The demo-case-1 contradiction (case 01 starts seed day +14 while roster row `demo-emp-omar` reads
  started 2026-08-20) is recorded in the served payloads as **still present** — the cutover ran with it
  unresolved, which is owner decision 1.
