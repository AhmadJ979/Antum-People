# Rendered pass on the served demo surface — deployed tree `2028894`

**Read-only.** Nothing was re-seeded, restarted, or written to the product. No app code changed.
Rendered from the live product at `127.0.0.1:3000` on **2026-10-09, 10:52–10:56 UTC**, deployed
commit **`2028894`** (re-seeded 10:46). The deployed tree also carries two untracked runtime files
(`server/keep-alive.lock`, `server/keep-alive.out`) — no code drift.

Served-surface spot-check at the same time: `GET /` → 200 `Antum People`; `GET /api/employees`
without a token → **401**; the same with `Origin: https://evil.example` → **403**. Posture holds.

**Second pass, same served tree** (2026-10-09 ~11:00–11:05 UTC, still read-only, same deployed
`2028894`): the surface was re-read to close the three gaps this file disclosed — the D-0 pair, the
other direction of the filter leak path, and the named race. New captures:
`dom-01-full-panel.json`, `dom-01-narrowed-it.json`, `dom-02-opened-after-01-filter.json`,
`dom-race-after-all-t0.json`, `dom-race-after-all-t1.json`, `race-samples.json` (the first pass's own
samples), `probes/read2.js`, `screenshots/05-rollup-scope-note-and-without-consent.png`.

## The API baseline, measured first (and it matches the given figures)

| case | start | state | tone | chip string (API) | open_count | hours_to_start | employee track | workspace lines | overdue | functions |
|---|---|---|---|---|---|---|---|---|---|---|
| DEMO-01 Omar Al-Farsi | 2026-10-23 | `clear` | slate | `On track` | 22 | 325.15 | 7 | 15 | 0 | IT 6 · Admin 3 · HR 2 · Manager 4 |
| DEMO-02 Mariam Al-Kaabi | 2026-10-10 | `inside_48_hours` | amber | `Inside 48 hours · 21 items open` | 21 | 13.153 | 7 | 14 | 7 | IT 5 · Admin 3 · HR 2 · Manager 4 |
| DEMO-03 Yousef Al-Hammadi | 2026-10-08 | `started` | rose | `Started 1 day ago · 21 items open` | 21 | −34.85 | 7 | 14 | 14 | IT 5 · Admin 3 · HR 2 · Manager 4 |

Every figure agrees with the baseline supplied with the task (13.2 and −34.8 are the rounded forms of
13.153 and −34.85). Raw payloads: `payload-overview-ae.json`, `payload-workspace-0{1,2,3}.json`,
`payload-checklist-01.json`, `payload-flag-watch.json`. `flag-watch` reports `process_started_at`
10:46:11Z, `delivery: "none"`, `boundaries_recorded: 2`.

## 1. Rendered chips, next to the API's own strings

DOM read of the three collapsed rows (`dom-rollup-three-rows.json`): each row renders its state's
chip verbatim — `On track`, `Inside 48 hours · 21 items open`, `Started 1 day ago · 21 items open` —
and the panel bodies render the server's own sentences, e.g. DEMO-02 `21 items open · start in 48
hours or less`, DEMO-03 `Started with 21 items still open` + `These were due before day one.`
One distinct "Derived from every item on this case…" scope note across the page (count stated once).
Screenshots: `screenshots/01-rollup-three-chips.png`.

## 2. The two track counts are never printed as one number

Rendered per row, separately labelled and from different sources:
`Verified: 0/7 · 7 outstanding` (**employee track**, 7 items each case) and `Workspace: 0 of 14 done ·
14 open` (DEMO-03/02) / `Workspace: 0 of 15 done · 15 open` (DEMO-01). The case totals 22/21/21 appear
only in the flag's own derived strings (`21 items open`, `22 items still open, with 14 days to go`),
never as the workspace count. Inside the panel the header reads `WORKSPACE TRACK · 0 of 15 done` for
DEMO-01 and `0 of 14 done · 7 past due` for DEMO-02.

## 3. DEMO-01's workspace board as rendered

Chips: `All (15) [SELECTED]`, `IT (6)`, `Admin (3)`, `HR (2)`, `Manager (4)`. Groups rendered in
order with their own counts: **IT · 0/6**, **ADMIN · 0/3**, **HR · 0/2**, **MANAGER · 0/4** = 15 lines.
Owner/function appears on every line as the leading tag, e.g.
`Laptop or device issued IT · hardware · not started · due 2026-10-18 (D-5) · in 9 d` → `Requested`,
`Employee file opened HR · hr file · not started · due 2026-10-20 (D-3)`, `Building card or access
badge issued Admin · building card · not started · due 2026-10-22 (D-1)`. In the **collapsed** row the
same lines render with an explicit `owner:` prefix (`owner: IT`, `owner: Admin`, `owner: HR`,
`owner: Manager`). Due-date pairs confirmed in the captured panel text: **D-5 = 2026-10-18**,
**D-3 = 2026-10-20**, **D-1 = 2026-10-22**. The **D-0** pair could not be read here: it sits in the MANAGER group's last
two lines and this pass's panel text was truncated at 3000 chars before them. **Closed in the second
pass** — `probes/read2.js` reads the panel untruncated (1906 chars) and the MANAGER tail renders
`30-day check-in scheduled Manager · manager setup · not started · due 2026-10-23 (D-0) · in 14 d`
and `Team introduction arranged Manager · manager setup · not started · due 2026-10-23 (D-0) · in 14 d`.
All four offsets are confirmed **as rendered** and match the cutover baseline (D-5 2026-10-18 ·
D-3 2026-10-20 · D-1 2026-10-22 · D-0 2026-10-23). Raw: `dom-01-full-panel.json`.
Screenshot: `screenshots/02-board-demo01-15-lines.png`.

## 4. The owed read — the closed loop (the acceptance this row was written for)

Sequence: open DEMO-02 → apply the function filter → open DEMO-01. DOM reads:
`dom-02-opened.json`, `dom-02-narrowed-it.json`, `dom-01-opened-after-02-filter.json`.

| step | chips as rendered | groups rendered | panel header |
|---|---|---|---|
| DEMO-02 opened | `All (14) [SELECTED]` · IT (5) · Admin (3) · HR (2) · Manager (4) | IT 0/5 · ADMIN 0/3 · HR 0/2 · MANAGER 0/4 | `0 of 14 done · 7 past due` |
| DEMO-02 after clicking `IT` | `All (14)` · **`IT (5) [SELECTED]`** | **IT 0/5 only** | `0 of 5 done · 5 past due` |
| **DEMO-01 opened next** | **`All (15) [SELECTED]`** · IT (6) · Admin (3) · HR (2) · Manager (4) | **IT 0/6 · ADMIN 0/3 · HR 0/2 · MANAGER 0/4** | `0 of 15 done` |

**No leak.** The next case opened clean: its own full 15-line board across all four functions, the
`All` chip highlighted and stating the case's own sum, with no trace of the `IT` filter used on
DEMO-02. The second half of the same fix is visible in row 2: while the view narrows to IT, `All` keeps
the case's own 14 rather than reporting the narrowed 5 — the reading the old code produced as `All (5)`.

**The other direction, closed in the second pass.** The filter was applied to DEMO-01, then DEMO-02
was opened (`dom-01-narrowed-it.json` → `dom-02-opened-after-01-filter.json`), reporting the fields
that reader captures:

| step | chips as rendered | due pairs in panel | panel | consent |
|---|---|---|---|---|
| DEMO-01 after clicking `IT` | `All (15)` · **`IT (6) [SELECTED]`** | D-5, D-3 only | 957 chars | 1 |
| **DEMO-02 opened next** | **`All (14) [SELECTED]`** · IT (5) · Admin (3) · HR (2) · Manager (4) | D-5, D-3, D-1, D-0 | 1860 chars | 1 |

**No leak in this direction either:** DEMO-02 opened on its own full board with `All` highlighted, its
chip 14 its own sum (5+3+2+4), all four groups rendered. The offsets are DEMO-02's own — D-5
`2026-10-05`, D-3 `2026-10-07`, D-1 `2026-10-09`, **D-0 `2026-10-10`, its start date** — the read-time
derivation visible on a second case, not DEMO-01's numbers repeated.
## 5. The one-tick race — **observed in the first pass; this section was wrong and is corrected here**

It previously read "Not observed, and not claimed … no samples were recorded". **That was false, and
the raw samples had been appended to the end of this file as a stray line — which is how the error
surfaced in the second pass.** The samples exist: `race-samples.json`, seven of them, `t` = ms.

| t (ms) | chips as rendered | groups rendered | panel header |
|---|---|---|---|
| 57061, 57419, 57976, 58933 | **`All (14)[SEL]`** · IT (5) · Admin (3) · HR (2) · Manager (4) | **`IT · 0/5` only** | **`0 of 5 done · 5 past due`** |
| 60592, 62950, 66108 | same | `IT · 0/5`, `ADMIN · 0/3`, `HR · 0/2`, `MANAGER · 0/4` | `0 of 14 done · 7 past due` |

Read exactly: after `All` was clicked on DEMO-02, whose board had been narrowed to `IT`, the panel kept
rendering **the narrowed board and its narrowed header** (`0 of 5 done · 5 past due`) while the `All`
chip was already the highlighted one, and resolved to the case's full 14-line board at t=60592. The
chip's own label never moved off the case's true sum (`All (14)` throughout) — it is the **rendered
lines and the panel header** that lag. Self-correcting, as the plan records; real, not hypothetical.

Two limits, stated rather than glossed:
1. **The window was artificially widened.** `probes/racepatch.js` patches `window.fetch` **in the
   page** (client-side only — server code untouched, nothing written to the product) to delay every
   `/workspace` response by 2500 ms. This measures *that* the stale render happens; it does **not**
   measure how long a user sees it at natural latency, which on a local server is probably
   milliseconds.
2. **Not a selector artifact.** The same highlight test (`bg-slate-900` on the chip button) read
   `IT (6) [SELECTED]` when `IT` was clicked and `All (14) [SELECTED]` on a full board in the same
   pass, so `[SEL]` tracks the real chip.

**Second pass, no delay injected:** two consecutive untruncated reads taken immediately after clicking
`All` (`dom-race-after-all-t0.json`, `dom-race-after-all-t1.json`) both returned
`All (14) [SELECTED]` with the full 1860-char board and all four groups — the stale render did not
appear at ~1 s read resolution without injected latency.

## One environment lesson (not a product finding)

A **synthetic** click (`element.click()` through `eval`) does **not** switch this app's top-nav tab —
the page stays on the Executive Dashboard — while a real click by accessible ref does. This is the
whole explanation of the "no case rows" failure in my earlier rig pass, which I reported as an
unresolved rig failure: it was the click mechanism, not the product. Future passes should drive the
nav with `snapshot -i` → `click @ref`, as `probes/drive3.sh` does.
