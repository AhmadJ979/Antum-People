# Decisions 21 and 17 executed — removal, retirement, and the checks that keep them gone

**Measured:** 2026-10-13 · **Branch:** `feat/decisions-21-17-remove-pii-routes-consent`
**Base:** `origin/main` = `a48668d` (PR #181 merged) · **Head measured:** `ff0138c` · **Served tree:** `9d2182a`
**Owner decisions:** 21 (remove the two routes whose payload is a PII read) and 17 (retire the
employee-record consent instrument, keep the subject). Both ruled 2026-10-13.

Everything below is copied output, not assertion. Raw files sit beside this one.

## 1. Callers, before the edit (register and test excluded — they are the books that record the change)

| route | client/src | server/*.js | scripts/ | tests/ |
|---|---|---|---|---|
| `GET /api/employees/:id` | **0 GET** | 0 | 0 | 0 |
| `GET /api/compliance/report` | **0** | 0 | 0 | 0 |
| `POST /api/compliance/consent` | **0** | 0 | 0 | 0 |

The path `/api/employees/` has four client hits, and the roles are what matter, not the count:
`App.tsx:985,986` are `/api/employees/:id/onboarding` and `…/offboarding`, and `App.tsx:1092,1112`
are both **`method: 'PUT'`** (`handleMarkProductive`, `handleTransitionToOffboarding`) — i.e. the
live `PUT /api/employees/:id`. **No client call site issues a GET on that path.**
Source: `enumeration-and-route-table.txt`.

## 2. Route table, measured on two scratch instances (ports 4731/4732, throwaway DBs, live 3000 untouched)

| request | before `a48668d` | after `ff0138c` |
|---|---|---|
| `GET /api/employees` (no token) | 401 | 401 |
| `GET /api/employees` | 200 | 200 |
| `GET /api/employees/:id` | **200** — 37-key body, `national_id_value` non-null: **true** | **404** — 1-key body, no identifier |
| `GET /api/compliance/report` | **200** — `{total:13, consentGranted:13, visaAlerts:0, alerts_len:0}` | **404** |
| `POST /api/compliance/consent` | **200** | **404** (`Cannot POST /api/compliance/consent`) |
| `GET /api/compliance/notice` | 200, version **v2.3** | 200, version **v2.3** |
| `GET /api/analytics/dashboard?jurisdiction=AE` | 200 | 200 |
| `GET /api/preboarding/checklist/overview?jurisdiction=AE` | 200 | 200 |
| `GET /api/compliance/templates/final-settlement-statement/:id` | 200, 3,003 B | 200, 3,003 B |

The decrypted identifier's **value** is deliberately not recorded anywhere in this pack; `:id`'s body
was checked for the *presence* of the field, not printed. Sources: `probe-before-before-tree.txt`,
`probe-after-tree.txt`, `rig-route-table-and-bundles.txt`.

## 3. What the removed writer left behind (the write, measured on the row)

`rig-write-transcript.txt` — both trees seeded fresh, same POST body to each:

| | before `a48668d` | after `ff0138c` |
|---|---|---|
| `demo-emp-omar` before the POST | `consent_granted:1, consent_date:"2026-09-23"` (seeder) | `consent_granted:0, consent_date:null` |
| `POST /api/compliance/consent` | **200**, body `{"id":"fea0047d-…"}` | **404** |
| `demo-emp-omar` after the POST | `consent_granted:1, consent_date:"2026-10-13"` | `consent_granted:0, consent_date:null` |
| `consent_records` rows | 13 → **14** | 13 → **13** |

So the route wrote **both** ends — a `consent_records` row and the employee flag — and with it gone
neither happens.

## 4. The seeder no longer fabricates consent

Fresh demo seed on each tree: `employees with consent_granted=1` — **13 before, 0 after**;
`consent_records rows` — **13 in both** (the seeder still writes purpose-scoped rows; the table stays).
Sources: `rig-route-table-and-bundles.txt` §2, `rig-write-transcript.txt`.

## 5. The tile: what the built client bundle says

`rig-route-table-and-bundles.txt` §7 — both trees built with `npx vite build`:

| tree | asset | bytes | md5 | `GRANTED ON` | `MISSING / REQUIRED` | `Notice-based` |
|---|---|---|---|---|---|---|
| before `a48668d` | `index-Cc1GodRa.js` | 274,065 | `9cdfbe5da81f6acf38fdb10de8a5e6fd` | 1 | 1 | 0 |
| after `ff0138c` | `index-Bh1-0KrL.js` | 274,243 | `91f05725a25c2b7b1f4328f1a5a110d5` | **0** | **0** | **1** |

The before-tree bundle is **byte-identical to the bundle the served tree is running**
(`index-Cc1GodRa.js`, 274,065 B, md5 `9cdfbe5d…`, cutover #5) — so the "after" column is a change
from the bundle clients actually load, not from a reconstruction of it.

## 6. Coupling, enumerated after the change

`companies.consent_granted` / `consent_date` are **not dropped**:

- **readers in the product: 0.** The last server-side reader was the removed report route; the tile
  was the only client reader.
- **writers still present: 2.** `POST /api/employees` still lists the column with the literal `0`
  (`server/index.js:201`, value at `:213`) — it writes *not granted*; and `PUT /api/employees/:id`'s
  numeric whitelist still admits `consent_granted` (`server/index.js:254`), so a direct caller could
  still set it. Neither path can set `consent_date` any more, so no path produces the GRANTED state
  the retired tile printed. **Recommendation (not done here):** narrow the PUT whitelist and drop the
  column from the INSERT list in a later change — a schema/whitelist edit, not a route removal.
- **`consent_records`:** table and schema kept (purpose-scoped consent, decision 14). Production

> **Annotated 2026-10-19, not rewritten:** this record's "decision 14" is the stale pairing corrected
> in the live documents on 2026-10-19 — the decision that kept the table is **17**; **14** is the
> portal-identity question. The line above stands as what was written on 2026-10-13.
  writers: **none** (the removed route was the only one). The demo seeder writes 13 rows
  (`scripts/seed-demo.js:493`).
- `client/src/App.tsx` still declares the two fields in its `Employee` interface — the roster answers
  `SELECT *`, so the type stays accurate; the comment there records that they are no longer displayed.

## 7. The removals are checked, and the checks were reddened

- `server/reachability-register.js` gains **RETIRED** (3 routes × removed-date/decision/why, plus 3
  source anchors); `CALLERLESS` drops the 3 entries; `DISPLAYED_VALUES` is now empty **with a comment
  saying what emptied it and what the empty state means**.
- `server/reachability.test.js` gains test 10 — "a retired element stays retired". Suite:
  **168 tests / 35 suites / 168 pass / 0 fail** (was 167/35 before). `full-suite-2026-10-13.txt`;
  `node scripts/reachability-report.js` exits **0** and prints all six as `[gone]`
  (`reachability-report.txt`).
- **Both branches of the new assertion were reddened, not assumed:**
  - retired route re-added to `server/index.js` → red with *"`GET /api/compliance/report` is
    registered again (server/index.js:178) …"*;
  - retired tile string re-added to `client/src/App.tsx` → red with *"… is back in
    client/src/App.tsx — the string `"✓ GRANTED ON ${selectedEmployee.consent_date}"` is the retired
    instrument returning …"*.
  - **Honest note on the first attempt:** both injections were planted at once, so only the route
    branch reddened (the anchor assertion never ran — the route assertion aborted the test first).
    The second run isolated the anchor branch and reddened it alone. Both transcripts are on file;
    the tree was verified clean (both anchors absent again, `git status` showing only the six
    intended files) between and after them.
  - Files: `negative-control-both-branches-together.txt`, `negative-control-anchor-branch-alone.txt`.

## 8. Build proof

`cd client && npm run build` → exit **0** (`tsc -b` then `vite build`), assets emitted:
`dist/assets/index-Bh1-0KrL.js` 274,243 B (md5 `91f05725…`), `index-pNSrK3wr.css` 35,365 B.
`client-build.txt`.

## 9. Cutover debt — measured, and a cutover IS owed (not performed)

Nothing was deployed; `deploy-main.sh` is lead/owner-gated and this task did not touch it.

| measurement | value |
|---|---|
| PR scope `a48668d..ff0138c` | 6 files, +190 / −73 |
| `server/index.js` | **+20 / −33** (net −13) |
| served tree `9d2182a` → `ff0138c` | 103 files |
| …of which under `client/` | **1** (`client/src/App.tsx`) |
| …of which under `server/` | **8** |
| `server/index.js` vs the served tree | +20 / −33 |

Because `server/index.js` (a served file) and the client bundle both change, the served tree no
longer matches `main` after this merge — **the next cutover is owed**, and the three-line `db.js`
fix already recorded for it can ride along.

## 10. Newly retired vs still open

`CALLERLESS` keeps 3 (`calculate-eosb`, `preboarding/cases/:id`, `preboarding/flag-watch`), the
`Request` dead end and the Exit modal are untouched. `GET /api/compliance/templates/:templateName/:employeeId`
also decrypts both ID columns and was **deliberately not touched** — it renders them into a document
the employee is a party to.
