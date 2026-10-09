# The envelope on the Layer 2 case list — evidence for row `62d7142b`, task `5fd76616`

**Base:** `origin/main` at **`1371d9a`** when this branch was cut. (The task text named `204b50b`; `main` had
moved twice more, so the branch is cut from and measured against `1371d9a` — and since then against nothing
newer, re-fetched before submitting.)

**Scope of the change — 5 files, none of them the engine, the seed or the item model:**

| file | change |
|---|---|
| `server/preboarding.js` | `listCases` returns the envelope `{cases, totals}` instead of a bare array |
| `server/index.js` | the `GET /api/preboarding/cases` route serves it unchanged, contract comment kept |
| `client/src/App.tsx` | reads `data.cases`; the "Cases open" tile counts that array |
| `server/preboarding.test.js` | one existing assertion reads `.cases`; **+2 tests** |
| `server/preboarding-items.test.js` | two existing assertions read `.cases`; **+1 test** |

## The one design decision I had to make, and the alternative I rejected

`totals` for this endpoint counts **the set this call returned, under its own filters**
(`{cases, open, closed}`, with `open + closed === cases` because `CASE_STATUSES` is exactly those two).

The alternative was to make the list's `totals` the **checklist roll-up** — the item, consent and
workspace-line counts `preboardingItems.checklistOverview` computes. I rejected it: that roll-up is scoped
to a jurisdiction and **ignores the list's status filter**, so an envelope whose `cases` holds the open ones
and whose `totals` counts open *and* closed would have its two halves describing different sets. That is the
same class of defect as printing two counts as one number. If the lead wants the roll-up attached to this
endpoint, the right move is to give `checklistOverview` a status filter and reuse it — not to grow a second
arithmetic here. This is the one judgement call in the PR and it is flagged for review, not buried.

## Test evidence

```
$ cd server && node --test        # exit 0
# tests 137
# suites 31
# pass 137
# fail 0
```

**134 before this change, 137 after** — the three new tests are the two shape tests in
`preboarding.test.js` (`listCases` returns `{cases, totals}` with the split exhaustive; the route serves it
and the bare `res.json(cases)` is gone) and the envelope-keys test in `preboarding-items.test.js` (both
collection reads are envelopes; the roll-up keeps its `jurisdiction` echo). The task text's
"57 across four files" was stale and is not used.

## Build evidence (WORKFLOW rule 15 — raw tail, both halves, exit codes)

```
$ ( cd client && npx tsc -b --force ) ; echo "tsc -b exit code: $?"
tsc -b exit code: 0
$ ( cd client && npx vite build ) ; echo "vite build exit code: $?"
vite build exit code: 0
computing gzip size...
dist/index.html                   0.46 kB │ gzip:  0.29 kB
dist/assets/index-BLszozVg.css   35.19 kB │ gzip:  6.80 kB
dist/assets/index-Dt2oLspq.js   270.96 kB │ gzip: 75.59 kB
✓ built in 333ms
```

**The bundle name changes** (`index-B8Hoaanh.js` → `index-Dt2oLspq.js`), which is why a cutover is owed once
this merges: **lead-owned and lead-sequenced after the demo window.** I ran no deploy script, restarted
nothing, re-seeded nothing, and re-grounded no document that names the current bundle.

## Scratch-instance evidence (rule 14 — own port, own DB, own throwaway credential; live `:3000` untouched)

The live surface read **200 serving `index-B8Hoaanh.js`** immediately before and immediately after every pass
below. The scratch instance is `node index.js` from this tree on port **4721** against its own
`PRODUCT_DB_PATH`, seeded by the tree's own `scripts/seed-demo.js`.

**Pass 1 — the seeded demo data as it stands.** All four queries, as served:

```
GET /api/preboarding/cases                            -> {cases: 3, totals: {cases: 3, open: 3, closed: 0}}
GET /api/preboarding/cases?jurisdiction=AE&status=open-> {cases: 3, totals: {cases: 3, open: 3, closed: 0}}
GET /api/preboarding/cases?status=open                -> {cases: 3, totals: {cases: 3, open: 3, closed: 0}}
GET /api/preboarding/cases?jurisdiction=AE            -> {cases: 3, totals: {cases: 3, open: 3, closed: 0}}
GET /api/preboarding/checklist/overview?jurisdiction=AE -> keys ['cases','jurisdiction','totals'], cases 3
```

Pass 1 cannot distinguish anything — one state, one jurisdiction — so it is not the evidence. **Pass 2 is.**

**Pass 2 — contrasting state**, made in the scratch DB only (one case closed, one moved to `SA`), rows
read back out of that DB:

```
[{"offer_reference":"OFR-2026-DEMO-01","jurisdiction":"AE","status":"open"},
 {"offer_reference":"OFR-2026-DEMO-02","jurisdiction":"SA","status":"open"},
 {"offer_reference":"OFR-2026-DEMO-03","jurisdiction":"AE","status":"closed"}]

cases                             rows 03/AE/closed, 02/SA/open, 01/AE/open | totals {cases:3, open:2, closed:1} invariant true
cases?jurisdiction=AE             rows 03/AE/closed, 01/AE/open             | totals {cases:2, open:1, closed:1} invariant true
cases?jurisdiction=SA             rows 02/SA/open                           | totals {cases:1, open:1, closed:0} invariant true
cases?status=open                 rows 02/SA/open, 01/AE/open               | totals {cases:2, open:2, closed:0} invariant true
cases?status=closed               rows 03/AE/closed                         | totals {cases:1, open:0, closed:1} invariant true
cases?jurisdiction=AE&status=open rows 01/AE/open                           | totals {cases:1, open:1, closed:0} invariant true

the client's own query (?status=open): cases.length = 2 | totals.open = 2 | agree: true
```

Contracts re-checked on the same instance: **no token → 401**, unknown status →
**400 `{"error":"status must be one of open, closed"}`** (the filter still refuses rather than quietly
matching nothing).

Teardown: the scratch process was found by `/proc/<pid>/cwd` (it is `node index.js`, so a path match would
miss it), killed, listeners on 4721 back to 0, scratch DB deleted, live `:3000` still 200.

## Honest limits

- **No HTTP test harness exists in this suite** — `server/index.js` binds a port when it is required, and
  there is no supertest, no `app.listen` in tests, no fetch. So the route's response is pinned the way this
  file already pins the single case writer: by reading `index.js` as text. The module's shape is pinned by a
  real assertion, and the **served** shape is what the scratch passes above measured. Reviewers who want an
  HTTP assertion need a harness built first; that is a separate piece of work, not something to fake here.
- **The client change is not browser-verified.** I read `App.tsx` at its render site and the build is green,
  but I did not drive a browser against the scratch instance, so "the tile still shows the right number" rests
  on: the request asks `status=open`, the response's `cases` holds the open ones
  (`cases.length = 2 = totals.open`, measured above), and the tile counts `preboardingCases.length`. Say so
  rather than call it verified.
- **The seeder needs no change, and this is a correction.** The brief expected `scripts/seed-demo.js` to be
  the consumer that "printed 0 case(s) against a live array". It does not consume this function at all:
  `grep -rn "listCases" scripts/` is empty, and its pre-boarding calls are
  `preboarding.recordOfferAcceptance` (line 563), `preboardingItems.getItem` (592), `setItemStatus` (594) and
  `listItems` (600). The string `case(s)` does not appear in any script in `scripts/` or in
  `deploy-main.sh`. So the sweep came back clean, and the trap does not exist at this call site.
- **`listCases` has exactly one shipped consumer** — the route at `server/index.js:605` — plus the tests.
  Nothing else in `server/`, `client/` or `scripts/` calls it, which is what makes "no compatibility shim"
  safe rather than optimistic.
