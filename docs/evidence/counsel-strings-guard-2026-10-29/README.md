# The counsel-string guard — evidence, 2026-10-29

**What this pack proves, and what it does not.** The owner said yes to a guard that reddens when the
text of a counsel-owned legal string changes without the change being marked. It is
`scripts/check-counsel-strings.py`, its manifest is `scripts/counsel-strings-manifest.json`, and its
controls are `scripts/counsel-strings-test.sh`. It is registered in the one operator entry point,
`scripts/check-all.py` (the guard as a default check; the controls under `--full`).

**Tree:** `docs/evidence/counsel-strings-guard-2026-10-29/raw/01-guard-green-at-head.txt` names the
head these runs were taken at in its own first lines. The hashes were read from **`414a007`** — the
branch adds four files, all under `scripts/`, and no served path loads any of them.

## 1. The count, re-derived from what the product serves — 48 served legal units

The plan carried a working figure of "~57 counsel-owned legal units". That figure was the designer's
hand inventory (`design-chrome-legal-inventory-2026-10-29.md`) counted by *class*, not by *what
serves*. This guard's set is derived from the responses, and it does not agree with 57 — so here is
the reconciliation, unit for unit.

| group | units | derived from (over HTTP, in this run) |
|---|---|---|
| `doc:*` | **7** | `GET /api/compliance/templates/<name>/<record>` → `content`, for every `.md` in `templates/`. The four **instruments** are served as their **refusal** (the document itself is withheld: the employer-side facts are held nowhere, decision 10) and the three **forms** render in full. |
| `notice:*` | **2** | `GET /api/compliance/notice` → `content` and `version` — the one document served with no substitution, i.e. the whole notice text reaches a client. |
| `basis:*` | **7** | `GET /api/preboarding/cases/<case>/checklist` → `notice.bases.<item_key>` — the lawful-basis catalogue as served, one row per document item, including the two rows the notice assigns no basis to (with their `pending_counsel` question numbers). |
| `task:*` | **32** | `GET /api/employees/<record>/{onboarding,offboarding}` → each task's `title` + `description`: **15 UAE** (onboarding 7 + offboarding 8) and **17 KSA** (onboarding 7 + offboarding 10). **This is the one place a statutory article number and a deadline render on a screen.** |
| **total** | **48** | 77,914 served bytes |

**Why 48 and the inventory's ~57 are different numbers, not a contradiction.** The inventory counted
4 instruments (not the 7 templates the route serves), the basis catalogue as **one** table rather
than the 7 rows the payload actually carries, and **32** generated task strings — which this
derivation reproduces exactly. It then added the refusal body and the 20 client-side legal strings.
Of those 20, **none is API-served**, so none can be hashed from what a client receives.

**The declared gap, printed on every run.** The 20 client-side legal strings are recorded in the
manifest under `not_hashed` with their derivation and the reason: hashing them would mean hashing the
built client bundle, which is gitignored and absent from a fresh tree. A gap that is printed is not a
silent omission. It is still a gap, and it is the largest thing this guard does not cover.

## 2. Where the hashes come from — a served response, never a source file

`raw/01-guard-green-at-head.txt` shows the run. It boots a scratch instance of **the tree it is run
from** (own port, throwaway database, own throwaway `hr_admin` user — the live demo credential is
never read, rule 14), creates the fixture **through the product's own writers**, and hashes the bytes
of the HTTP responses. Nothing reads `templates/*.md` for text; the only thing read off disk is the
*list* of template names, and each name is then fetched over HTTP — a name that serves nothing is a
red, not a silent omission.

Two details that are stated rather than hidden:

- **The fixture is fixed literals, not the demo seed.** The seeded demo's accruals are computed to
  "today", so a document rendering one moves every day and the guard would cry wolf daily. The
  fixture is two employees (UAE + KSA) created by `POST /api/employees` with fixed literals, each
  moved to `offboarding` by `PUT` so both task checklists exist, plus one pre-boarding case.
- **The record and case ids are masked out of the served bytes.** A refusal names the record it
  refused (`for the record <uuid>`) and the product mints a fresh uuid each run: fixture noise, not
  legal text. `mask()` in the guard does that, and the manifest says so.

`raw/02-determinism-verdict.txt`: two independent rigs (different port, different database) produced
**the same 48 hashes, 0 differing lines**. A guard that hashed differently on every run would cry
wolf, and that is the failure this pair of runs rules out. A run costs **1.65 s**.

## 3. The two controls — the raw output is `raw/03-controls-and-sibling-test.txt`

| arm | what moved | result |
|---|---|---|
| 0 | nothing (scratch copy of this tree) | **GREEN** |
| **A — scope control** | an item **label** the screen shows (`Passport copy` → `Passport copy (scope control)`), served bytes demonstrably changed: `before 'Passport copy'  after 'Passport copy (scope control)'` | **GREEN** — a chrome string is not this guard's business. Without this arm a whole-file hash would look like a working guard. |
| **B — change control** | one served **legal** sentence (`**NOT ISSUED.** This response is not the document you asked for.`) | **RED**, naming the units whose hash moved: `doc:final-settlement-statement, doc:ksa-employment-contract, doc:privacy-notice, doc:uae-employment-contract` |
| **C — marked** | the same edit, then `--write-manifest --note "…"` | **GREEN**, the four units printed as **MARKED**, each still `unreviewed` |
| **D — honesty (extra)** | a manifest whose first unit claims `review: reviewed_by_counsel` | **RED** — a review cannot be earned while no counsel recipient exists |

Arm B reddens on **four** units, not one, and that is correct: the refusal sentence is one string
served under four template names. Naming all four is the guard telling the truth about where the
text lives.

`counsel-strings-test: 8 ok, 0 FAIL` — including the two structural assertions that keep the guard
non-vacuous: it judged **48** units (a run that judges nothing cannot pass) and the served set equals
the manifest set (48 = 48). An unknown flag exits **2**, never 0.

## 4. Unmarked versus marked

- **Unmarked change** — the served bytes move and the manifest still holds the old hash: **RED**,
  exit 1, naming every unit that moved. `check-all.py` fails the run.
- **Marked change** — `--write-manifest --note "why this text moved"` writes the new hash plus a
  `marked` block (previous hash, note, who, when, the revision measured from). The run is green and
  prints the unit under `CHANGED, MARKED`. The mark is part of the diff a reviewer reads.
- **A new or vanished unit** — the served set and the manifest set must be **equal**: a document that
  arrives with no manifest entry, or an entry nothing serves any more, is RED in both directions.
  That is what stops a new legal document riding into a green run.
- `--write-manifest` **refuses (exit 2) if any unit moved and no note was given**. Rewriting a hash
  with no sentence beside it is the silent edit this guard exists to make impossible.

## 5. The blind spot, stated in the guard's own header

1. It detects that a string **CHANGED**. It cannot tell whether anyone read it, whether the change was
   legally significant or a typo fix, or whether the new text is right or wrong.
2. No counsel recipient exists (the plan records none), so every unit is and stays **`unreviewed`** —
   and the guard FAILS a manifest that claims otherwise. It never says "counsel-approved".
3. It covers the **server-served** legal surface. The 20 client-side legal strings are named as a gap,
   not covered.

## 6. Movement

**No movement is owed, and here is the evidence:**

```
$ grep -c "scripts" server/index.js
0
$ grep -rn "check-counsel-strings\|counsel-strings" server/ client/src/
(nothing)
$ grep -nE "python3|check-|\.py" scripts/cutover-preflight.sh
(nothing - the movement runs no checker, as check-all.py's own header records)
```

The delta's paths: `scripts/check-all.py` (two registry entries and one header line),
`scripts/check-counsel-strings.py`, `scripts/counsel-strings-manifest.json`,
`scripts/counsel-strings-test.sh` — plus this evidence pack, which nothing loads either.
Every one is under `scripts/` or `docs/`, and no served path loads any of them.

## 7. What was measured on the tree, and what was not

- **Server suite in the deployed tree:** 397 tests / 63 suites / 0 fail (unchanged by this delta).
- `python3 scripts/check-all.py --only counsel-strings` → `OK … exit=0 1.6s`.
- No client change, so no `client/dist` build was made or touched anywhere in this work — the
  deployed tree's built assets were never rebuilt, and the served bundle is untouched.
