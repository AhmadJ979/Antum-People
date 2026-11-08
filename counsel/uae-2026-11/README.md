# UAE counsel letter package — repository copy

**Moved here 2026-11-07 from `/home/team/shared`, byte-for-byte, at `de22e80`.**
**Completed 2026-11-08:** the two remaining artefacts — the checklist-strings draft and the
letter verifier — joined them, byte-identical, at `b4bed5b` (see the table below).
This directory is now the **one authoritative copy** of the UAE letter and its package files,
under version control and under a gate (`counsel-letter` in `scripts/check-all.py`).
Nothing here was re-worded in the move: the two letter md5s below are the ones the send index
and the owner's approval refer to.

## What is here

| File | What it is | md5 (unchanged by the move) |
|---|---|---|
| `uae-counsel-confirmation-request--send-ready.txt` | **the file that gets sent**, 65 lines | `89b2bd58b1e8d33ef348a534cdb084ea` |
| `uae-counsel-confirmation-request.md` | the twin — word-identical, keeps `##` and `**` | `7bd134df0e532950a7e1c5949927e660` |
| `counsel-package-cover-email-2026-10-29.txt` | the paste-ready cover email | `df273054c733922330446363050c2547` |
| `counsel-package-send-index-2026-10-29.md` | the send index and pre-send checklist | `3784115914cd6ed192b9c65f2cddd1ac` on 2026-11-07 **before** the custody note; see below |
| `uae-counsel-letter-d1-d5-applied-2026-11-07.md` | the before→after record of the D1–D5 corrections | `9eaa26744b5e76adfa4c65cbb30dd54c` |
| `appendix-b-verify.py` | judges the Appendix B rows **in the draft** against `server/compliance_engine.js` | *(edited 2026-11-07 and 2026-11-08: paths only)* |
| `verify-appendix-b-in-letter.py` | judges Appendix B **inside the two letters** — the copy that gets sent | *(added 2026-11-08, byte-identical; paths re-grounded the same day)* |
| `uae-appendix-b-checklist-strings.md` | the Appendix B drafting record the B/K rows are quoted from | `414aaea423bc06008ffc9c6e0181768e` (2026-11-08, unchanged by the move) |
| `uae-letter-wordstream-check.py` | judges the twin and the send copy as word streams | *(edited 2026-11-07: paths only)* |

The verifiers were the only files whose bytes changed in these moves, and only in how they
resolve a path: they read their subject from **their own directory** and the source from the
worktree they sit in, instead of a hardcoded `/home/team/shared` prefix. Their logic, their
checks and their counts are untouched (40 checks / 0 failing; 21 checks / 0 failing with 4 of
4 selftest mutations caught; 1681 tokens either side / 0 differing).

**Two verifiers, not one, and neither is a superset of the other.** `appendix-b-verify.py`
judges the **draft** — 9 quoted B/K rows, the draft's own header-count sentences, the revision
it names, row-set completeness over the whole UAE block, the single question, and the two letter
md5 pins. `verify-appendix-b-in-letter.py` judges the **letters** — 4 B rows per copy, each quote
byte-identical to the source `description`, the question cell, Appendix A's 18 U rows, the 7
numbered items, and the two copies carrying the same four strings, plus a `--selftest` of 4
mutations. A draft can drift from the letter and a quoted string can be retyped "close enough";
each instrument catches the half the other cannot see.

## What is **not** here, and why

**Corrected 2026-11-07.** Until this date this section said the other three letters were still in
`/home/team/shared`. They are not: the **KSA, PDPL and access** letters and their `.md`
companions were moved into the repository the same day, each into a directory of its own —
`counsel/ksa-2026-11/`, `counsel/pdpl-2026-11/`, `counsel/access-2026-11/`. `counsel/README.md`
is the index: which directory is which letter, the md5 of each send copy, and the shape of each
pair.

The send index names **four** letters (UAE, KSA, PDPL, access) and says its claims were checked
against "the files in this directory". That was written on **2026-10-29**, when it meant the
shared directory; the file now carries a dated custody note at its top saying so, and its own
text is left as the 2026-10-29 record. Read "this directory" there as the 2026-10-29 shared
directory, not as this one. The index's own md5 moved with that note (`37841159…` → the value
`md5sum` reports today); its **four letter pins did not move**, and the row now checks them.

**Corrected 2026-11-08.** This section used to say the `uae-appendix-b-checklist-strings.md`
document the Appendix B rows are quoted from was still outside the repository, and that moving it
was blocked because three repository documents (`statutory-claims-determination.md`,
`docs/statutory-claim-register.md`, `ksa-contract-divergence-ruling.md`) cite it at its current
path. **That blocker did not exist.** `grep -rn` over the whole tree finds the document's name in
six places, all of them repository files this change re-points (`scripts/check-all.py`,
`scripts/check-counsel-letter.py`, `appendix-b-verify.py`, `counsel/README.md`, this file, and the
D1–D5 record) — and **none of those three documents mentions it at all**. The document moved here
on 2026-11-08, byte-identical (`414aaea4…`, 14,297 B, 188 lines), with the letter verifier beside
it. Still outside the repository, and deliberately: the two
`pdpl-counsel-request*.pre-2026-10-29-appendix` drafts. `counsel/README.md` says why.

For the gate the move is a **tightening, not a repointing**: `appendix-b-verify.py` now reads the
checklist-strings document from **this directory**, so a missing one is a file of the tree that is
missing — exit 1, RED, named — and the `counsel-letter` row's `absent_exit=3` declaration
(SKIP-FLAGGED, counted as skipped) is **gone**. `APPENDIX_DOC` still overrides the path, which is
how a mutation in a scratch copy is judged without dirtying the tree.

## The rule this directory exists under

One authoritative copy: **the repository**. `/home/team/shared` holds a one-line **pointer**
for each moved file, naming this path — never a second copy of the text. If you find the text
itself in both places, the shared-directory copy is the defect: delete it and keep the pointer.

## Checking it

```bash
python3 scripts/check-counsel-letter.py            # the row, on its own
python3 scripts/check-all.py --only counsel-letter # the same thing through the entry point
python3 counsel/uae-2026-11/appendix-b-verify.py   # the DRAFT: 40 checks, 0 failing
python3 counsel/uae-2026-11/verify-appendix-b-in-letter.py            # the LETTERS: 21 checks, 0 failing
python3 counsel/uae-2026-11/verify-appendix-b-in-letter.py --selftest # 4 mutations caught, 0 missed
python3 counsel/uae-2026-11/uae-letter-wordstream-check.py   # 1681 tokens, 0 differing
```
