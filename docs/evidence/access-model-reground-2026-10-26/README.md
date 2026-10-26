# Re-grounding `docs/access-model.md` and its instrument — 2026-10-26

Board row **9988b364**, "Re-ground the 15 stale line citations in docs/access-model.md (after
P3-2 merges)". The gate is open: P3-2 merged in #306. The row expected 15 stale hints; the
measured count at the merged tip is **60**, and one of them had become a real FAIL.

Branch: `docs/reground-access-model-citations` — PR #308. Base: `62665dc` (main after #306).

## The numbers

| | at `62665dc` (before) | this branch (after) |
|---|---|---|
| instrument verdict | `136/137 … (ran=137, fails=1, hints stale=60)` | `137/137 … (ran=137, fails=0, hints stale=0)` |
| exit | 1 | 0 |
| stale-hint lines printed | 60 | 0 |
| `server/access-model-instrument.test.js` | 2 of 4 red | 4 of 4 green, both controls fire |
| full suite | 323 tests / 321 pass / **2 fail** | 323 tests / **323 pass** / 0 fail, EXIT=0 |

The two suite reds at the tip were both `server/access-model-instrument.test.js`, and both were
reddening on **one** FAIL — `[measure] 28 routes declared (measured 29)`:

- `green at this tree, and the headline names the tree it judged` — the instrument exited 1;
- `a line that merely MOVED does not redden it — the control that must NOT fire` — the control
  asserts a 7-line shift **is reported** (`staleCount(shifted) > staleCount(base)`), and with
  every index.js hint already stale the shift added nothing: **60 vs 60**. Drift at zero is what
  lets that control be measurable again.

## What moved, and by how much

- `scripts/verify-access-model.py` — the declared route inventory `28 -> 29` (P3-2's
  `POST /api/employees/:id/probation-evaluations`), and **59 of 88 claim hints** re-grounded
  (`server/index.js` 52 pairs, `server/access.js` 6).
- `docs/access-model.md` — a section 3.1 row for the new route plus the prose note that table's
  convention gives such a row, **29 citations** re-grounded, and the one stale `DOC_CITATIONS`
  entry (`index.js:829 -> index.js:875`).
- Section 10.2's coverage figures re-derived **from the instrument's recount**, as that check's
  own note requires: `pinned only as tree claims 31 -> 32`, `in no check at all 10 -> 9`.

The claims and the document cite the same line numbers, so they had to move together: moving only
the claims desynchronised the section 10.2 recount, which is the instrument saying the page and
its checks no longer agree.

## How each file here was produced

- `01-instrument-BEFORE-at-62665dc.txt` — `python3 scripts/verify-access-model.py` in a detached
  worktree of `62665dc` (main, unmodified).
- `02-instrument-AFTER-this-branch.txt` — the same command on this branch.
- `03-instrument-own-tests-4of4.txt` — `node --test access-model-instrument.test.js`.
- `04-full-suite-AFTER.txt` — `npm test` from `server/` on this branch (323 tests / 52 suites /
  0 fail / EXIT=0).

## Spot-checks (the row's step 3)

Each cited line opens on the thing the document says it is:

```
server/index.js:149   // Protect all /api routes except login
server/index.js:875   if (!actor) return res.status(400) ...
server/index.js:1257  app.post('/api/employees/:id/probation-evaluations', ...
server/access.js:357  function scopeFor(resource, role) {
```

## What did NOT change

No assertion. Every claim resolves **by content** and the line number is only its hint, so this
pass moved the line each citation *names* and nothing about what is *checked*. The needles, the
route/role/resource counts other than the inventory, and the gate behaviour are untouched.

## Movement

None owed. No `server/` or `client/` file is touched; the only reader of
`scripts/verify-access-model.py` is `server/access-model-instrument.test.js` (grep: no served
path requires it). Markdown owes no movement by the standing rule.

## The shape question, handed over rather than decided

Roughly 15 citations went stale from one 41-line insertion; 60 across the drift since. The cost
is proportional to how much code lands **above** a cited line.

- **Keep line numbers** — the doc stays directly navigable, but every served-path merge owes a
  re-grounding pass, and a stale citation still *looks* exact to a reader who does not run the
  instrument.
- **Cite symbols** (`app.post('/api/exit-interviews'` in `server/index.js`) **with the line as an
  optional hint** — a moved line can no longer make the citation wrong; the instrument's content
  resolution becomes the mechanism instead of the rescue. Cost: the reader's jump-to-line
  convenience, and the doc's bare `:NNN` shorthand inside a cell has to be spelled out.

The instrument already resolves every claim by content, so the second option costs it nothing.
**This document's owner decides**; the drift above is the evidence.
