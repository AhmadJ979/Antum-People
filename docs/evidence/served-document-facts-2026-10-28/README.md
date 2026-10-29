# A served document refuses rather than inventing a fact — evidence, 2026-10-28

Branch `fix/no-invented-document-values`, commit **2667e96**, cut from `origin/main` = **3d69bd2**
(the deployed tree, movement #6). PR body carries the argument; this directory carries the raw
readings.

## What the reader gets, before → after (scratch rig, one instance per tree)

Every reading below is the SERVED body of a route, fetched with a token on a scratch instance of that
tree (own port, own seeded DB, own throwaway `hr_admin`), seeded from each tree's own
`scripts/seed-demo.js` minutes apart. `evidence-transcript.txt` holds both runs and the teardown.

| served document | before (`3d69bd2`) | invented literals in it | after (`2667e96`) | invented literals |
|---|---|---|---|---|
| `GET /api/compliance/templates/uae-employment-contract/demo-emp-ahmad` | 200, 9,393 B | `Antum Regional Hub`, `TL-882733-G`, `EST-99228`, `HR Director` | 200, 852 B — NOT ISSUED | none |
| `…/ksa-employment-contract/demo-emp-fatima` | 200, 9,375 B | `Antum Regional Hub`, `TL-882733-G`, `QIWA-88271`, `HR Director` | 200, 836 B — NOT ISSUED | none |
| `…/final-settlement-statement/demo-emp-noura` | 200, 2,393 B | `Antum Regional Hub` (`0.00` rows) | 200, 926 B — NOT ISSUED | none |
| `…/privacy-notice/demo-emp-ahmad` | 200, 17,775 B | `Antum Regional Hub`, `Dubai Internet City, UAE / Riyadh Business Gate, KSA`, `privacy@antum.ae` | 200, 769 B — NOT ISSUED | none |
| `GET /api/compliance/notice` (raw) | 200, 17,665 B, md5 `6004b0a5…` | none — it serves its own `[employer_name]` blank | 200, 17,665 B, md5 **`6004b0a5…`** (unchanged) | none |
| `…/breach-notification-letters/demo-emp-ahmad` (form) | 200, 11,302 B, md5 `770ae371…` | none | 200, 11,302 B, md5 **`770ae371…`** | none |
| `…/data-processing-agreement/demo-emp-ahmad` (form) | 200, 14,908 B, md5 `a18d438a…` | none | 200, 14,908 B, md5 **`a18d438a…`** | none |
| `…/dpia-questionnaire/demo-emp-ahmad` (form) | 200, 8,837 B, md5 `770b522d…` | none | 200, 8,837 B, md5 **`770b522d…`** | none |

The three forms are byte-identical across the change (the same body md5 on both trees): this change
touches the instruments, and nothing else. The raw notice is unchanged too — it already served its own
visible blanks rather than an invented Controller.

Live product on port 3000 read **200** before and after the pass; the rig's own listeners were verified
by `/proc/<pid>/cwd` and stopped (`listeners on 4752/4753: 0`).

### What a reader gets instead — the whole refusal, verbatim

`templates/uae-employment-contract` for `demo-emp-ahmad` (852 B, and it is the entire body):

```
# Document not issued / لم يتم إصدار المستند

**NOT ISSUED.** This response is not the document you asked for. It contains no clause, no
signature block and no figure, and nothing in it may be read, signed or presented as one.

The document `uae-employment-contract`, for the record `demo-emp-ahmad`, states facts that no
record in this product holds. Filling such a hole with a plausible licence number, a party name
or a 0.00 is what we will not do, so the document is withheld until the facts are recorded:

- employer legal name
- trade licence number
- MoHRE establishment code
- visa status
- probation period
- employer signatory name
- employer signatory title

Record them and request the document again. The employer-side facts are the employer own
identity and registration; the rest are amounts and terms the employee record does not carry.
```

`templates/final-settlement-statement` for `demo-emp-noura` names, in document order: `employer legal
name`, `accrued leave amount`, `notice-period pay`, `ticket allowance`, `other payments`, `outstanding
loan deduction`, `unreturned assets deduction`, `traffic fine deduction`, `total deductions`, `net
settlement payable`. The salary-derived figures that ARE held (pro-rated salary `5161.29`, EOSB
`6415.79`, gross `11577.08`) were computed and are deliberately absent from the list — a refusal that
named a held fact would send a reader to record something we already have.

## The guard: red on the old tree, green on the new one

`server/served-document-facts.test.js` (14 tests, 5 suites) reads the SERVED bodies of both routes
over every template on disk — not the source file — and requires that none of the seven literals
appears anywhere, that no instrument ships any part of its document body, and that the renderer still
produces the document when every fact is supplied (the positive control, so "refuse" is not the only
thing the file would accept).

| run | readings |
|---|---|
| `guard-RED-before-fix.log` — the test on `3d69bd2`, before the fix | `# tests 14 · # suites 5 · # pass 1 · # fail 13`, exit 1. First failure: `uae-employment-contract must not be issued` (`+ undefined − false`); the literal check names the served literal per URL. |
| `guard-GREEN-after-fix.log` — the same test on `2667e96` | `# tests 14 · # suites 5 · # pass 14 · # fail 0`, exit 0. |

The single pass on the red run is the control test (`the control: the same read catches a literal the
engine would have to be told to keep`), which passes on both trees by construction — it plants a
literal and requires the comparison to notice it.

Full server suite on `2667e96`: **`# tests 369 · # suites 61 · # pass 369 · # fail 0`**, exit 0
(`cd server && PRODUCT_DB_PATH=/tmp/docs-full-suite.db node --test`; 355/56/0 at `3d69bd2` + this
file's 14 tests and 5 suites). No existing test asserted any of the seven literals, so no existing
assertion was edited, weakened or deleted: **0 test sites changed, 0 fixtures changed**.

## Files

- `evidence-transcript.txt` — both rig runs: tree hash and blob hash per state, seed line, listener
  with its `/proc/<pid>/cwd`, the unauthenticated 401 probe, the per-document table above, teardown.
- `refusal-uae-employment-contract.md`, `refusal-final-settlement-statement.md` — the after bodies,
  whole.
- `guard-RED-before-fix.log`, `guard-GREEN-after-fix.log` — the two guard readings.
- `full-suite-after.log` — the suite at `2667e96`.

An earlier run of this rig (not filed here) rendered the KSA contract's Iqama line as ciphertext rather
than a number. That was **this rig's** error, not the product's: the server had been restarted by hand
with a different `ENCRYPTION_KEY` than the seed used. The filed run seeds and boots each state with one
generated key in one script, and that line renders as it should. Nothing in this directory quotes an
identity value.
