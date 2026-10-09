# Cutover 2026-10-09 10:45–10:46 — measured state

Lead-owned. Raw run output: `/tmp/cutover-evidence.txt` (host) · `/tmp/cutover-seed.log` · `/tmp/cutover-build.log`.

## What landed
- **Deployed tree: `2028894`** ("Merge pull request #102 from AhmadJ979/docs/tracker-round-31"), verified by `git log --oneline -1` in the deployed tree at the end of the run.
- Tree moved from `5ed731e` → `2028894`. `25a3af0` (the hash the plan revision 56 recorded as `main`) is an ancestor: the only delta was **#102**, one file, `roadmap-board-index.md`, +20/−4. The owner merged it after the plan revision was written.
- Client build OK from the deployed tree: `dist/assets/index-B3KoM02v.js` 269.18 kB (gzip 75.07), built in 390 ms.
- Demo dataset re-seeded `--force-clear` against `/home/team/.data/antum-product.db`.
- **Port 3000 given to the product** (owner decision 2026-10-09). The platform's website dev server (`/home/team/shared/site`, pid 633) was stopped; it respawned (pid 1473 + esbuild 1481) but does **not** hold 3000. Product pid 1498 holds it.
- Watchdog armed from the deployed tree: pid 1593 (`bash scripts/keep-alive.sh`).

## Served surface, as measured (2026-10-09 10:46–10:50)
| check | result |
|---|---|
| public URL root | 200, `<title>Antum People</title>` (product, not the site SPA) |
| `POST /api/login` (demo admin) | 200, token 201 chars |
| bad password | 401 |
| `GET /api/employees` with token | 200, 13 employees, first `demo-emp-omar` |
| foreign `Origin` on `/api/employees` | **403** |
| no token | **401** |
| bogus bearer token | 403 — deliberate: `server/index.js:63` returns one generic 403 for "anything else" (unverifiable token and foreign origin alike). Access denied either way; by design, not a finding. |
| EOSB final settlement (DEMO sarah) | rendered EOSB 19824.78 = record 19824.78, no unfilled `[brackets]`, net payable 32824.78 |
| KSA offboarding checklist | 10 tasks, `Final Settlement Payment` last |

## The three demo cases — one per flag state
| case | hire | start | state | chip | open | hours_to_start |
|---|---|---|---|---|---|---|
| OFR-2026-DEMO-01 | Omar Al-Farsi (Finance Analyst) | 2026-10-23 | `clear` | "On track" (slate) | 22 | 325.2 |
| OFR-2026-DEMO-02 | Mariam Al-Kaabi (Marketing Coordinator) | 2026-10-10 | `inside_48_hours` | "Inside 48 hours · 21 items open" (amber) | 21 | **13.2** |
| OFR-2026-DEMO-03 | Yousef Al-Hammadi (Operations Analyst) | 2026-10-08 | `started` | "Started 1 day ago · 21 items open" (rose) | 21 | −34.8 |

Flag bodies, verbatim: 01 `"22 items still open, with 14 days to go — the flag starts 48 hours before the start date."` · 02 body empty, headline `"21 items open · start in 48 hours or less"` · 03 `"These were due before day one."`
`scope_note` (all three): `"Derived from every item on this case, whatever track created it: the employee track's documents and the workspace track's…"` — the payload's own string, no hard-coded sentence (row `83c22f60`, #96).
Consent: **`{"consent": null}` on all three** — the PDPL gate is closed on every case.

**Shelf life, measured not assumed:** case 02's `hours_to_start` is 13.2 from ~10:47 UTC, so its start instant is **2026-10-10 00:00 UTC = 04:00 GST** — the amber window closes at exactly the 04:00 GST figure the plan recorded. A demo shown after that reads `started`, like case 03. **Re-seed before any demo on/after 2026-10-10.**

## P2-4 workspace track, served (case DEMO-01)
- `derived_from`: `{"role": "Finance Analyst", "department": "Finance", "profile_keys": ["finance_department"]}` — lines derived from the case's own role/department.
- `totals`: `{lines: 15, complete: 0, open: 15, overdue: 0}`; `available_functions`: IT 6 · Admin 3 · HR 2 · Manager 4 = **15**, i.e. the `All` chip's sum equals the case's own line count.
- **Every one of the 15 lines carries its owner on the row** (`IT`/`Admin`/`HR`/`Manager`), and due dates are computed on read: D-5 → 2026-10-18, D-3 → 2026-10-20, D-1 → 2026-10-22, D-0 → 2026-10-23.
- `view.is_access_control`: **false**, with the filter-not-access-control note intact.

Per-case workspace totals: 01 = 15 lines open (0 overdue) · 02 = 14 open / 7 overdue · 03 = 14 open / 14 overdue. Employee track contributes 7 items per case (01: 7+15=22 open; 02/03: 7+14=21).

## Standing facts from this run
- **The website has no serving path while the product holds 3000.** The site's dev server is supervised and respawned but cannot bind 3000; the platform URL and the `-dev` URL both now answer with the product. Options for the owner: publish the site (build + swap the live copy, independent of port 3000), give it a domain (Plus+), or accept the platform URL alone.
- **The guard is armed now, but a restart still destroys it** — it could not re-arm itself after the 08:44 restart, which is why the surface was dark for ~2 hours. Only an off-host check survives (owner decision 5).
- Any commit merged after `2028894` is **undeployed** until the next cutover (re-run `deploy-main.sh`; it re-seeds as part of the run, which also refreshes the demo's dates).
