# Evidence — the three unresolving citations in `docs/access-model.md`, 2026-10-20

Merged by PR #262. Raw runs in `controls-final.txt`; this file says what each one proves.

## What was wrong

Three of the **eleven** sites in §10.2's coverage table that were in **no check at all** were cited
**one line off** the block they name:

| section | cited | actually lands on | corrected to |
|---|---|---|---|
| §2.2 | `db.js:120-127` | the blank line above the block; stops one line short of the words the page quotes (*"the boot would fail"*, `:128`) | `db.js:126-128` |
| §2.4 | `access.js:4` | the file's opening *WHY THIS EXISTS* paragraph | `access.js:67` |
| §6.4 | `access.js:192-195` | the `SCOPES` entry line, for a note that begins at `:193` | `access.js:193-196` |

They are **not citations that drifted**: each was written that way in the commit that re-grounded it and
the code has not moved since. Measured, both empty at the tip:

```
git log ce28e99..HEAD -- server/access.js
git log da4f0c1..HEAD -- server/db.js
```

## The instrument

`verify-access-model.py` is **not in the repository** — `git ls-files` finds only `docs/access-model.md` —
so the rows below live in `/home/team/shared/verify-access-model.py` (490 lines) and this pack is the only
copy of their output inside the repo.

| | md5 | checks |
|---|---|---|
| before | `77eb78ed3248a43b48d01056ec99ae35` | 127 |
| after | `68d30d4c51b2337b6323364091d25926` | 137 |

Added: 3 `[doc citation]` rows (family 3 → 6), 3 `[stale text]` rows refusing each OLD form, 4 `[partition]`
rows that **read §10.2's four numbers out of the page and compare them with a recount**. The family is also a
named list now (`DOC_CITATIONS`) that the enforcing loop and the partition check both read.

## The controls, and what each proves

| control | result | proves |
|---|---|---|
| A · branch document, new instrument | **137/137, rc 0** | the edits add no failing check |
| B · `origin/main`'s document, **old** instrument | 127/127, rc 0 | **the check that was silent** — the old instrument passes the three wrong citations |
| C · `origin/main`'s document, new instrument | **128/137, 9 FAILs** | the new rows redden on the defect state. **`origin/main` reads red until this PR merges** — deliberately |
| iso1 · §2.4 → `access.js:4` | 133/137, 4 FAILs | that site's stale row, its family row, and the two partition rows a coverage change moves |
| iso2 · §2.2 → `db.js:120-127` | 133/137, 4 FAILs | same shape |
| iso3 · §6.4 → `access.js:192-195` | 134/137, 3 FAILs | stale + partition; **the family row stays green** because §8 item 9 still cites the range — which is exactly why a family row alone is not enough and each site carries a pair |
| tbl · one table number `48` → `49` | 136/137, 1 FAIL | each printed number is load-bearing, not decorative |

## The table moved, and why

| §10.2's table | with the 3-entry family | with the 6-entry family |
|---|---|---|
| distinct `file:line` sites | 49 | **48** |
| compared as citations | 3 | **6** |
| pinned only as tree claims | 35 | **34** |
| in no check at all | 11 | **8** |

* **49 → 48** is the count doing its job: `access.js:193-196` appeared twice under two different ranges, one
  of them wrong, so correcting it merged two sites into one.
* the partition is a function of the **family** as well as of the page: three new family entries moved
  `3 → 6` and `11 → 8` with no byte of the page's citations changing.
* the family is **named in the page's shorthand** (`access.js` `:67`) on purpose: a family row tests whether
  the string appears *anywhere* on the page, so naming an entry as a citation inside the paragraph that
  describes it satisfies the very row it describes. Measured: with the full form, a reverted §2.4 kept its
  family row green; with the shorthand it reddens.

## Reproducing

```
python3 verify-access-model.py                                  # green on the merged page, 137/137
VERIFY_DOC=<old copy> VERIFY_TREE=origin/main python3 verify-access-model.py   # control B/C
```

## Still not closed

**Eight** sites remain in **no check at all**, named in the page in shorthand. §10.3's prose also names
`index.js:829` as a citation, which satisfies that family row — its binding rests on the `:824-828` stale
row, which is the row that matters.
