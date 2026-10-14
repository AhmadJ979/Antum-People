# Item 3 — fencing the retired consent flag's write paths (2 → 0), and the check that keeps them fenced

**2026-10-13, third commit on `feat/decisions-21-17-remove-pii-routes-consent`** (PR #186, which carries
items 1 and 2 of the cutover bundle; #182 merged as `9ce469d`). Owner/lead ruling: *a retired instrument with
live write paths is not retired.* Nothing is deployed.

## 1. The enumeration — before the edit

Every mention of the two columns in `client/src`, `server`, `scripts` and the tests, classified by role:
`fence-proof.txt` §A. The two write paths were:

| write path | how it writes | why `columnWriters()` never saw it |
|---|---|---|
| `POST /api/employees` | names `consent_granted` in the **column list of a multi-line INSERT**, with the literal `0` in the value list | that check searches **line by line** for `INSERT … column`, and the column sits on a continuation line |
| `PUT /api/employees/:id` | the key was admitted by the route's **numeric whitelist array**, checked with `.includes(key)` | the line names neither `INSERT`, `UPDATE … SET` nor `column =` |

That gap is worth stating plainly: the check that makes a "the only writer is the demo seeder" claim
truthful could not see either writer, so the claim was wrong for the whole life of the instrument.
`columnWritePaths()` (below) is structural for exactly this reason.

**No caller sends the key.** A grep for request bodies (`body`, `JSON.stringify`, `fetch`, `axios`) naming
either column returns nothing; the only client mention is the two-field type declaration in `App.tsx`. So
the removal is safe, and it was made rather than reported.

## 2. The edit

- `POST /api/employees` — `consent_granted` removed from the INSERT column list **and** its `0` removed
  from the matching value position (the pair moves together or the INSERT is off by one);
- `PUT /api/employees/:id` — the key removed from the numeric whitelist;
- each site carries a short comment naming decision 17 and stating that the **column stays** with its
  schema `DEFAULT 0`.

`server/index.js` **+7/−3**. The columns and `consent_records` are untouched, per decision 17's scope
(enumerated first, recommended later — not dropped in this pass).

## 3. The write-path count, measured by the shipped check itself

`columnWritePaths('consent_granted')`, run against the HEAD file and then the edited file (`fence-proof.txt` §B;
the edited file was restored byte-identically afterwards, md5 verified):

| state | result |
|---|---|
| before (`9ce469d`) | **2** — `INSERT INTO employees names it in its column list (server/index.js:197)`, `a key whitelist of 6 keys admits it (server/index.js:254)` |
| after | **`[]`** — 0 |

## 4. The assertion reddens on all three of its branches

`server/reachability.test.js` gains a test that asserts the write-path set is empty **and** that the column
is still in `schema.sql` with `DEFAULT 0`. Suite 168 → **169**. Both halves were reddened deliberately
(`fence-proof.txt` §C), each injection reverted between runs:

| injection | result |
|---|---|
| key back in the PUT whitelist | **1 fail** — `a key whitelist of 6 keys admits it (server/index.js:258)` |
| column back in the create-INSERT | **1 fail** — `INSERT INTO employees names it in its column list (server/index.js:200)` |
| column deleted from `schema.sql` | **1 fail** — *"the column was dropped: decision 17 keeps it … dropping it is a separate decision, not a tidy-up"* |
| injections removed | **12 tests / 12 pass / 0 fail**, tree clean (only the four intended files modified) |

`scripts/reachability-report.js` prints the same measurement for a person (`RETIRED COLUMNS` →
`[fenced] consent_granted`) and exits 0; item (1)'s guard is still **3/3**; **full suite 169 tests /
35 suites / 169 pass / 0 fail**.

## 5. Cutover measurement — re-taken against the then-current `origin/main` (rule 22)

`origin/main` at measurement time: **`9ce469d`**. Served tree **`9d2182a`**.

| measurement | value |
|---|---|
| `9d2182a` → `origin/main` | **114 files** — `client/` **1**, `server/` **8** |
| this task's branch on top of `origin/main` (PR #186) | 4 files — `server/db.js`, `server/preboarding-workspace.js`, 2 evidence files |
| `9d2182a` → working tree (branch + item 3) | **118 files** — `client/` **1**, `server/` **10** |
| item 3's commit | `server/index.js` +7/−3, `server/reachability.js` +40, `server/reachability.test.js` +22, `scripts/reachability-report.js` +9 |
| client asset | **moves**: served `index-Cc1GodRa.js` 274,065 B md5 `9cdfbe5d…` → merged state `index-Bh1-0KrL.js` 274,243 B md5 `91f05725…` (from the App.tsx change in #182; item 3 touches no client file, so the asset does not move again) |

**A cutover is owed and is not taken here.** No deploy script was run or scheduled; the gate is the lead's
and the owner's. Deploy what `origin/main` **is** — not what this branch is — which is why the table names
both.
