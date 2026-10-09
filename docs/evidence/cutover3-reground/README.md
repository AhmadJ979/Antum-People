# Cutover #3 re-ground — what is serving, the label counts, and the demo figures (2026-10-09)

**Read-only.** Taken by the designer on the served product, signed in as the demo admin. **GETs only** — no
case created or edited, nothing re-seeded, no restart, no row deleted. The demo is live and may be shown to a
prospect; nothing in this pass could change what a prospect sees.

Cutover #3 ran **2026-10-09 13:46:11–13:46:43 UTC, exit 0**, moving the served tree **`0dd1a97` → `da3330d`**
(the All-chip rendering-race fix, #119) and re-seeding the demo at **13:46:16**.

## 1. What is serving, by measurement
| what | reading |
|---|---|
| bundle | `/assets/index-B8Hoaanh.js` — **270,982 bytes**, md5 **`abfe49feb21dc90b77743922f76a7399`** |
| stylesheet | `/assets/index-BLszozVg.css` — **unchanged** by this cutover |
| HTTP | **200** from the public URL and from `127.0.0.1:3000`, same bytes from each |
| stability | three anonymous fetches off the public URL: same 270,982 bytes, same md5 each time |
| the cutover's own build log | `dist/assets/index-B8Hoaanh.js 270.98 kB` |
| stale engine string | `is not built yet` — **0 occurrences** in the bytes as served |

*The run record and the task text both write the size as 270,981 bytes; the bytes as downloaded, and as the
build log rounds them, are **270,982**. Recorded rather than silently adopted.*

## 2. The label counts, per surface — two passes
In `docs/evidence/label-rule-recheck/README.md`, appended as **"Third cutover, 2026-10-09 13:46 UTC"**. In
short: **"Sample Demo Data" ×1 on each of the five surfaces, "Illustrative" 15** (Executive Dashboard 5 ·
Strategic Intelligence 10 · the other three 0) — identical to the `2028894` reading and to the `32a8f4e`
baseline's per-surface shape, on both passes. Raw captures: `docs/evidence/label-rule-recheck/raw/da3330d-pass{1,2}-*`.

## 3. The demo figures, re-read off the served API on the 13:46:16 seed
`GET /api/preboarding/checklist/overview?jurisdiction=AE` (raw: `raw/overview-AE.json`):

| case | start | chip, verbatim | state · tone · raised | open count | employee open | workspace lines | workspace open | overdue lines | hours to start |
|---|---|---|---|---|---|---|---|---|---|
| `OFR-2026-DEMO-01` | 2026-10-23 | `On track` | `clear` · slate · no | **22** | 7 | **15** | 15 | 0 | 321.89 |
| `OFR-2026-DEMO-02` | 2026-10-10 | `Inside 48 hours · 21 items open` | `inside_48_hours` · amber · **yes** | **21** | 7 | **14** | 14 | 7 | 9.89 |
| `OFR-2026-DEMO-03` | 2026-10-08 | `Started 1 day ago · 21 items open` | `started` · rose · **yes** | **21** | 7 | **14** | 14 | 14 | −38.11 |

Roll-up, as the endpoint states it: `items_outstanding` **21** · `workspace_lines_open` **43** ·
`cases_without_consent` **3** · `items_received` 0 · `cases_ready` 0 · `cases_provisioned` 0.

Other measured strings, unchanged: DEMO-01's headline `On track` and body *"22 items still open, with 14 days
to go — the flag starts 48 hours before the start date."*; DEMO-02's headline `21 items open · start in 48
hours or less`; DEMO-03's headline `Started with 21 items still open` and body *"These were due before day
one."*; `boundary_hours` 48, `boundary_inclusive` true on all three.

**Nothing moved.** Every figure above equals the one the demo documents quote for the 10:46 and 12:34 seeds:
22 / 21 / 21 open, 15 / 14 / 14 workspace lines, 3 cases without consent, the same three start dates, the same
chips word for word. **No spoken or printed figure in the demo documents needed correcting for this cutover.**

### The workspace track's own shape (raw: `raw/workspace-OFR-2026-DEMO-0n.json`)
| case | lines | by function | overdue | due dates derived on read |
|---|---|---|---|---|
| DEMO-01 | **15** | IT 6 · Admin 3 · HR 2 · Manager 4 | 0 | 10-18 · 10-20 · 10-22 · 10-23 |
| DEMO-02 | **14** | IT 5 · Admin 3 · HR 2 · Manager 4 | 7 | 10-05 · 10-07 · 10-09 · 10-10 |
| DEMO-03 | **14** | IT 5 · Admin 3 · HR 2 · Manager 4 | 14 | 10-03 · 10-05 · 10-07 · 10-08 |

DEMO-01 carries one more IT line than the other two, and its payload names why: `derived_from.profile_keys` is
`["finance_department"]` on DEMO-01 and empty on the other two. The extra line is derived from the case's own
profile, not seeded by hand. Due dates are derived on every read from the case's start date (D-5 · D-3 · D-1 ·
D-0), which is why they move with the seed.

## 4. Honest limits
- **Every figure belongs to the 2026-10-09 13:46:16 seed and to no other.** A re-seed moves the start dates and
  therefore every derived count. Nothing here was re-seeded by me; **a re-seed is the lead's action**.
- **`items_outstanding` (21) and `workspace_lines_open` (43) are different measures and were never added
  together.** 21 counts the employee track's documents; 43 counts the workspace track's lines across three
  cases. The endpoint's own `items` figure (21) is the employee track's, not a total of both.
- **`hours_to_start` is time-of-day-sensitive** (DEMO-02 read 9.89 h at ~14:00 UTC) — it is the one figure here
  that moves within a single seed. The chips and counts do not.
- **The flag is derived on every read and never stored**, over every item on the case, whatever track created
  it — that is why DEMO-01 counts 22 (7 employee + 15 workspace) and the other two count 21 (7 + 14).
- **Shelf life:** case 02's amber window closes at **00:00 UTC on 2026-10-10 — 04:00 GST**, after which it reads
  `started` like case 03 and the demo has no amber. Only a re-seed on or after 2026-10-10 restores it.
- **Two-character note, carried from the label register:** Pre-boarding's rendered text length reads 5923 today
  against the register's 5925 on the `2028894` tree, with every label count on that surface identical.
  Unattributed; the register states the hypothesis and the reason it stays a hypothesis.
- The label counts in §2 were read on `127.0.0.1:3000`, which serves the same bundle as the public URL by md5
  (§1). They are counts over rendered text, not over the payloads in §3.

## Why the 13:46 re-seed reproduced the 12:34 seed — confirmed, not assumed

Asked for by the lead this cycle, with the note that if anything had moved, that would be the finding.
Nothing moved, and the reason is in the seed's own code rather than in an assumption:

- `scripts/seed-demo.js:492-500` states the rule and implements it: *"Every date is an offset from the
  seed's own reference date, so what is fixed here is the offset, not the date."* `dayOffset(days)` is
  `new Date()` (today, UTC) plus `days`, returned as an ISO date.
- The three case offsets are constants: DEMO-01 `offset_days: 14` (:529), DEMO-02 `1` (:542),
  DEMO-03 `-1` (:555), applied at :562.
- All three seeds ran on **2026-10-09** (10:46, 12:34:14, 13:46:16), so each computed today+14/+1/−1 =
  **2026-10-23 / 2026-10-10 / 2026-10-08** — exactly the start dates the served API returns. Same day
  gives the same dates, which give the same derived figures. The reproduction is a consequence of the
  mechanism, not a coincidence and not an inert re-seed.
- Independent corroboration from that cutover's own log (`cutover-20261009-1346/seed.log`): it prints
  `- Opened OFR-2026-DEMO-01 (Omar Al-Farsi, AE, start 2026-10-23)`, `-02 … start 2026-10-10`,
  `-03 … start 2026-10-08`. It says **Opened**, not **Refreshed** — `--force-clear` deletes the demo
  rows first, so each run *creates* the cases and the date-refresh branch (:574-585) never fires. The
  same-day reproduction does not even depend on the refresh path.
- Consequence, derived rather than quoted: case 02 reads amber while today+1 is 2026-10-10. At 00:00 UTC
  on 2026-10-10 (= 04:00 GST) the seed's own arithmetic moves DEMO-02 to "start date already passed" and
  the demo has no amber state at all until a re-seed on or after the 10th. The shelf-life comes from
  `offset_days: 1`, not from a clock anyone has to watch.

## What each capture shows, and the md5 it ran against

Prompted by the same note (a shot that proves the rig ran is not evidence of the thing it claims), the
label pass was re-backed: two probe fields were **disqualified** for matching the sidebar rather than a
screen, and the identity claim now rests on content-region captures whose cross-comparison is computed
and committed — `docs/evidence/label-rule-recheck/raw/da3330d-identity2-cross-comparison.txt`. All four
readings (pass 1, pass 2, identity, identity2) ran against **270,982 bytes / md5
`abfe49feb21dc90b77743922f76a7399`**, read off `assets/index-B8Hoaanh.js` on the served product once per
surface. Details and limits: `docs/evidence/label-rule-recheck/README.md`.
