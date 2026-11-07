# UAE counsel letter package — repository copy

**Moved here 2026-11-07 from `/home/team/shared`, byte-for-byte, at `de22e80`.**
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
| `appendix-b-verify.py` | judges the Appendix B rows against `server/compliance_engine.js` | *(edited 2026-11-07: paths only)* |
| `uae-letter-wordstream-check.py` | judges the twin and the send copy as word streams | *(edited 2026-11-07: paths only)* |

The two verifiers were the only files whose bytes changed in this move, and only in how they
resolve a path: they read their subject from **their own directory** and the source from the
worktree they sit in, instead of a hardcoded `/home/team/shared` prefix. Their logic, their
checks and their counts are untouched (40 checks / 0 failing; 1681 tokens either side / 0
differing).

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

Still outside the repository, and deliberately: the
`uae-appendix-b-checklist-strings.md` document the Appendix B rows are quoted from, and the two
`pdpl-counsel-request*.pre-2026-10-29-appendix` drafts. `counsel/README.md` says why for each.

That first one matters for the gate: `appendix-b-verify.py` reads
`/home/team/shared/uae-appendix-b-checklist-strings.md` (overridable with `APPENDIX_DOC`). It
is the one input the check still reads from outside the repository, so on a fresh clone or in
CI that half judges nothing — the `counsel-letter` row then prints **SKIP-FLAGGED** and is
counted as **skipped**, never as OK. Moving that document in is the obvious follow-up and was
deliberately not done here: three repository documents (`statutory-claims-determination.md`,
`docs/statutory-claim-register.md`, `ksa-contract-divergence-ruling.md`) cite it at its current
path, and re-pointing them is a separate, reviewable change.

## The rule this directory exists under

One authoritative copy: **the repository**. `/home/team/shared` holds a one-line **pointer**
for each moved file, naming this path — never a second copy of the text. If you find the text
itself in both places, the shared-directory copy is the defect: delete it and keep the pointer.

## Checking it

```bash
python3 scripts/check-counsel-letter.py            # the row, on its own
python3 scripts/check-all.py --only counsel-letter # the same thing through the entry point
python3 counsel/uae-2026-11/appendix-b-verify.py   # 40 checks, 0 failing
python3 counsel/uae-2026-11/uae-letter-wordstream-check.py   # 1681 tokens, 0 differing
```
