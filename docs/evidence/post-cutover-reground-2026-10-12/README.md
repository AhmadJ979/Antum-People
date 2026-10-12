# Post-cutover re-grounding — the 2026-10-12 movement (served bundle `index-Dt2oLspq.js`)

**Who:** Product Designer · **When:** 2026-10-12, 05:15–05:25 UTC · **Why:** row `d54350a7` — the
`#125`/`#109`/`#119` work that `demo-weak-screens.md` and `demo-walkthrough-script.md` name was cut over
this morning, so every one of those documents' bundle readings was stale, and the demo was re-seeded in
the same movement. This pack is the measurement behind the corrections made to both documents in this PR.

**This is not the cutover's own record.** The run was lead-owned; at the time of writing it has no record
in the repository (`git ls-tree -r --name-only origin/main | grep -c 'cutover-2026101'` → **0**). What is
here is my independent, read-only read of what the run left behind.

## 1. What is actually being served (read anonymously, 05:15–05:20Z)

| | |
|---|---|
| public URL | HTTP **200**, `<title>Antum People</title>`, entry script **`assets/index-Dt2oLspq.js`** |
| bytes / md5 | **270,962 bytes / `5720cd6fbeca1966cb642f9cf6338a9c`** |
| `127.0.0.1:3000` | **the same bytes** — md5 of the two fetched files compared equal |
| stylesheet | `assets/index-BLszozVg.css`, 35,199 bytes (unchanged from the third cutover) |
| anon API | `GET /api/preboarding/checklist/overview?jurisdiction=AE` → **401 `Authentication token required`** (the product's own answer, not a proxy's) |

This is the **same bundle the lead and the engineer verified on two trees for the held cutover** — so the
pre-cutover render pass (PR #138, `docs/evidence/pre-cutover-render-2026-10-09/`) was rendered against
*these bytes*, and its readings (three cases, the envelope's only consumer reading 3, the chip sequence,
KSA → 0, the labels) describe what is served now rather than what was about to be served.

## 2. The movement's own timestamps (read-only: `stat`, `ps`, `/proc`)

| evidence | value |
|---|---|
| deployed tree | `/home/team/shared/probable-octo-sniffle`, HEAD **`b54412d`**, working tree clean but for the guard's two untracked runtime files |
| built asset in that tree | `client/dist/assets/index-Dt2oLspq.js` — mtime **2026-10-12T05:07:00Z** |
| product process | pid **1610**, cwd `…/probable-octo-sniffle/server`, started **05:09:30Z** |
| demo database | `/home/team/.data/antum-product.db` — mtime **2026-10-12T05:07:02Z**, so **the seed ran in this movement** |

The DB write is the evidence that the movement's re-seed happened; the seeder derives every date as an
offset from the day it runs, so the seed date fixes the three cases' start dates.

## 3. The rig — the served tree, built and seeded, read through the product's own API

Worktree of `b54412d` at `~/rig-served`; **own port 4742, own database, own throwaway credential**
(WORKFLOW rule 14 — the live product was never signed into; `:3000` answered 200 before and after).

- **Build reproduces the served bytes**: `npx tsc -b --force` (exit 0, run from `client/` — at the repo
  root `npx tsc -b` resolves to an unrelated package) then `npx vite build` (exit 0) →
  `index-Dt2oLspq.js`, **270,962 bytes, md5 `5720cd6fbeca1966cb642f9cf6338a9c`** — byte-identical to what
  both live URLs serve. The rig then served that same asset (`raw/asset-and-build.txt`).
- **Health**: exactly one listener, its cwd this rig's `server/`; `GET /` → 200; `/api/employees` with no
  token → 401; live `:3000` → 200.
- **Seed** (`raw/seed.txt`, the seeder's own words): `OFR-2026-DEMO-01` Omar Al-Farsi, start
  **2026-10-26** (+14) · `-02` Mariam Al-Kaabi, start **2026-10-13** (+1) · `-03` Yousef Al-Hammadi, start
  **2026-10-11** (−1).

### The three cases as the API returns them (`raw/overview-AE.json`, HTTP 200)

| case | hire · role | start | flag state | chip | tone | hours_to_start | employee / workspace lines |
|---|---|---|---|---|---|---|---|
| `OFR-2026-DEMO-03` | Yousef Al-Hammadi · Operations Analyst | 2026-10-11 | `started` | `Started 1 day ago · 21 items open` | rose | −29.29 | 7 / **14** |
| `OFR-2026-DEMO-02` | Mariam Al-Kaabi · Marketing Coordinator | 2026-10-13 | `inside_48_hours` | `Inside 48 hours · 21 items open` | amber | +18.71 | 7 / **14** |
| `OFR-2026-DEMO-01` | Omar Al-Farsi · Finance Analyst | 2026-10-26 | `clear` | `On track` | slate | +330.71 | 7 / **15** |

`totals`: `{"cases":3,"items":21,"items_outstanding":21,"items_received":0,"items_verified":0,"cases_without_consent":3,"cases_ready":0,"workspace_lines":43,"workspace_lines_open":43,"cases_provisioned":0}`

**Three cases, three flag states, one row amber** — the demo's whole point, live again on this seed. The
workspace counts derive from each case's own role and department (15 / 14 / 14), and the two counts stay
two fields: 21 employee-track items outstanding against 43 workspace lines open, never one number.

**Shelf life.** Case 02's amber window closes at **00:00 UTC on 2026-10-13** (04:00 GST) — the start date
this seed gave it. After that the demo shows two `started` cases and no amber until the next re-seed.

## 4. The board-content check left unperformed on 2026-10-09 (now done)

On 2026-10-09 I recorded that the case-1 board-content equality after the `IT → All` round trip **stood
unmeasured**, because a follow-up click hit an already-expanded row (the row toggle *closes* it). This
pass expands the row only if it is collapsed, then compares the board **region's own text**.

| step | groups read off the rendered board | region length | region FNV-1a |
|---|---|---|---|
| case 1, `All` (initial) | `IT · 0/6` `ADMIN · 0/3` `HR · 0/2` `MANAGER · 0/4` | 4029 | 3111454695 |
| case 1, chip `IT` | `IT · 0/6` | 3080 | 3990918787 |
| case 1, chip `All` again | `IT · 0/6` `ADMIN · 0/3` `HR · 0/2` `MANAGER · 0/4` | 4029 | 3111454695 |

**The round trip restores the board region exactly** — group list, full region text and FNV all identical
between the initial `All` and the `All` after `IT`. The two captures are also **the same file**
(`raw/board-A-case1-all.json` and `raw/board-C-case1-all-again.json` both md5
`698b134bc8a0adcbb08a992b7e84e23a`), and their screenshots are one image (`e2e835d9…`): the comparison is
of bytes, not of a claim about them.

**And that is why the screenshots are not the evidence here.** The withdrawn case-2 capture's screenshot is
**byte-identical to the `All` state's** (same `e2e835d9…`) although its JSON says `region_found: false` — a
viewport image cannot tell the two cases apart at that scroll position, exactly the failure that made
`#119`'s published race-window frame worthless. Read the JSON, not the picture. 15 lines, each with one
owner on the line (`carry no owner field` count: 0). Header copy as rendered: *"WORKSPACE TRACK · 0 of 15
done from Finance Analyst · Finance"*, the function chips `All (15) IT (6) Admin (3) HR (2) Manager (4)`,
and the standing honesty line that the control is a filter, not access control. Page errors: **none**
(0 bytes); console: empty; live `:3000` 200 before and after; every capture in `shots/` carries its own
script src (`/assets/index-Dt2oLspq.js`) in `raw/page-identity.json` (rule 25).

**One capture in this pack is not evidence and is named as such:** `raw/boardD-case2-all.json` — the
second-case probe ran with `__caseName` still set to Omar while the row clicked was Mariam's, so it
reports `region_found: false` for a row whose board was open. It is kept, withdrawn and named; case 2's
line count above comes from the **API payload**, not from a board render.

## 5. What this pack does not claim

- **Not the live demo's figures, read signed in.** Rule 26: the live product was never signed into. The
  live surface's *identity* (§1) is measured anonymously; the *figures* (§3–4) are read on a rig built
  from the served tree and seeded the same day. The live seed's **date** is evidenced (§2); its row-level
  figures are not independently read here.
- **Not the run's own record** (§ preamble): the lead's cutover record is not in the repository yet.
- **No accrual-derived figure is re-read.** The money figures in the walkthrough script remain the
  2026-10-08 walk's readings, as they say.
- **The label registers were not re-counted in this pass.** They were re-measured on 2026-10-09 against
  the bundle now served (byte-identical), which is why the documents' label counts still stand.
- **Nothing was written to the live product**, and no live data was seeded, restarted or deployed in this
  pass. `:3000` answered 200 at the start and at the end of every step above.
