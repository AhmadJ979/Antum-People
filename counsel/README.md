# Counsel letters — the four packages, in the repository

**Moved here 2026-11-07, byte-for-byte, from `/home/team/shared`.** This directory holds the
**one authoritative copy** of each letter the business is preparing to send to counsel, under
version control and under a gate (`counsel-letter` in `scripts/check-all.py`). Nothing was
re-worded in the move: the md5s below are the ones the send index and the owner's approval refer
to, and they are the same bytes that were in `/home/team/shared` before the move.

**Nothing has been sent. No recipient has been named** (owner decision 15(a)). Custody is not
authorisation: a file being in the repository says nothing about whether it may go out.

## Which is which

| Directory | The letter | Numbered items | Its pair's shape | The `.txt` that gets sent — md5 |
|---|---|---|---|---|
| `uae-2026-11/` | UAE end-of-service benefit, + Appendix B and a 9-file package (cover email, send index, D1–D5 record, the checklist-strings draft, two verifiers) | 8 | **twin** | `uae-counsel-confirmation-request--send-ready.txt` — `0403bea40326350faf793156465cbad9` |
| `ksa-2026-11/` | KSA end-of-service benefit, + Appendix A (16 rows) | 7 | **twin** | `ksa-counsel-confirmation-request--send-ready.txt` — `99a74b94208cf7d6579d20d3f0cae786` |
| `pdpl-2026-11/` | UAE PDPL — the notice and the lawful-basis record, + Appendix A (P1–P15) | 5 | **document+letter** | `pdpl-counsel-request--send-ready.txt` — `e20c67ae8a462586d14a616d7811b0ef` |
| `access-2026-11/` | Access to personnel records (decision 27, `docs/access-model.md` §8 items 3–5) | 3 | **document+letter** | `access-model-counsel-request--send-ready.txt` — `3baa46aba857ef275e9750b7abeb4c56` |

The three directories added on 2026-11-07 hold a pair each and nothing else — no cover email, no
per-letter README. The facts that are the same for all four (this page, the pair shapes, the
rule, the gate) are written **once, here**; a copy of a rule is a copy that drifts. `uae-2026-11/`
keeps its own README because it carries a seven-file package and package-specific facts.

## The two pair shapes — measured, not assumed

`scripts/check-counsel-letter.py` compares each pair's word streams: strip `##` headings (`.md`
side), strip `**` and backticks (both sides), compare token lists. The four pairs do **not** all
have the same shape, and the row declares which is which rather than pretending otherwise:

| Pair | md tokens | txt tokens | differing regions | shape |
|---|---|---|---|---|
| uae | 1912 | 1912 | 0 | **twin** — word-identity REQUIRED |
| ksa | 1436 | 1436 | 0 | **twin** — word-identity REQUIRED |
| pdpl | 2337 | 1412 | 70 | **document+letter** — the `.md` contains the letter |
| access | 1628 | 720 | 38 | **document+letter** — the `.md` contains the letter |

A **twin** is the same letter twice: the `.md` keeps the `##` and `**`, the `.txt` is what is
sent, and any edit must land in **both**. A pair that disagrees with itself is RED, with the
differing regions and their positions printed.

A **document+letter** pair is not a twin and never was. The `.md` of PDPL and access is a working
document — a cross-walk table from letter item to the product's own numbering, a premise audit of
every sentence the letter asserts about our software, decision numbers, repository paths — and it
**contains** the letter rather than duplicating it. The access document says so itself, in a line
of its own header: `Send-ready text:` names `access-model-counsel-request--send-ready.txt` and
adds *"(the letter; line 1 is a status line, not part of the letter)"*. For these the row asserts
the two things that are actually true of
them: **the document still names the letter it wraps** (so a rename or a dropped pointer reddens)
and **the send index's md5 pin for the letter still holds** (so the letter's bytes cannot move
unrecorded). Requiring word-identity here would be a red that no edit could ever clear, and a
permanently red row is a row the team learns to ignore.

## The gate

`scripts/check-counsel-letter.py`, wired into `scripts/check-all.py` as `counsel-letter`:

- every file of the UAE package **present** — a missing one is RED and named, never a skip;
- **each pair judged on its own**, counts printed per pair, never as one aggregate;
- the **send index's four md5 pins** still hold — the index is the record of the bytes that were
  approved, so a letter whose bytes move without its pin moving is RED. The fix is to re-hash and
  record, never to loosen the pin;
- **Appendix B still true of the draft** — every quoted B/K row is the `description` field of the
  line it cites in `server/compliance_engine.js`, and the letter's own two md5 pins hold;
- **Appendix B still true inside the letters** — the letter verifier's 4 B rows per copy, the
  single question, Appendix A's 18 U rows, the 7 numbered items, and its own `--selftest`
  catching all 4 of its mutations;
- an argument the runner does not understand is **exit 2**, never a green run.

**Nothing this row reads is outside the repository any more (2026-11-08).** Until that date the
checklist-strings document was still in `/home/team/shared` and the row exited 3 there, which
`check-all` printed as **SKIP-FLAGGED** and counted as skipped. It moved into
`counsel/uae-2026-11/` on 2026-11-08, so `absent_exit=3` is **removed**: a missing
checklist-strings document is now a file of the tree that is missing — exit 1, RED, named — and
never a skip. `APPENDIX_DOC` still overrides the path, for judging a mutated copy.

```bash
python3 scripts/check-counsel-letter.py             # all four packages, per-pair counts
python3 scripts/check-all.py --only counsel-letter  # the same through the entry point
python3 scripts/check-counsel-letter.py --root /tmp/mut   # judge a scratch copy (how the red is proved)
```

## What is deliberately **not** here, and why

**Removed from this list on 2026-11-08:** `uae-appendix-b-checklist-strings.md`, which used to
be the first bullet here. It is now in `counsel/uae-2026-11/`, byte-identical. The reason this
file gave for leaving it out — that three repository documents
(`statutory-claims-determination.md`, `docs/statutory-claim-register.md`,
`ksa-contract-divergence-ruling.md`) cite it at its current path — **was not true**: none of the
three names it, and the only six mentions in the tree are the repository files that were
re-pointed in the move. The blocker was imaginary; the move was made.

- **`pdpl-counsel-request.md.pre-2026-10-29-appendix`** and
  **`pdpl-counsel-request--send-ready.txt.pre-2026-10-29-appendix`** — superseded drafts, left
  where they are in `/home/team/shared`. They are the record of what the PDPL letter said before
  Appendix A was added; the letter that may be sent is the one in `pdpl-2026-11/`.
- **Evidence and log files** in `/home/team/shared` — not documents of the package.
- **The other package documents** (cover email, send index, statutory schedule, premise audit,
  the six-corrections record) — still in `/home/team/shared`. Only the letters moved here.

## The rule this directory exists under

One authoritative copy: **the repository**. `/home/team/shared` holds a one-line **pointer** for
each moved file, naming this path — never a second copy of the text. If you find the text itself
in both places, the shared-directory copy is the defect: delete it and keep the pointer.

The send index still refers to the four letters by bare filename, as it did on 2026-10-29; read
those names against the four directories above, not against a single flat folder.
