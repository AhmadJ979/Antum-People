# Instrument honesty: the hybrid tree, and the control that could be disarmed — 2026-10-26

Board row **7daa1d44**, found while reviewing #308. Two defects in `scripts/verify-access-model.py`'s
own honesty, plus **a third the work turned up**: the marker `scripts/check-all.py` passes had never
resolved at all, so the operator entry point's model check was judging nothing.

Branch `fix/access-model-instrument-honesty`, base `main` = `6466284`. Two files, 195 insertions,
13 deletions — `docs/access-model.md` is **not** touched (the row forbids it: #308 re-grounded it
this cycle, and re-grounding again would move the thing it measured).

## (a) The instrument could judge a HYBRID tree

It reads the **code** from a revision (`git show <TREE>:…`, `git grep <TREE>`) and the **document**
from the working copy beside the script, and it defaulted to `origin/main`. Whenever those are not
the same revision — any branch that changes `server/` and the doc together, which #306 was — one run
judges one tree's code against another tree's document and prints **one clean headline**.

**Before / after, measured on the same hybrid tree** (a synthetic commit whose document differs from
the working copy's, code unchanged) — `01-hybrid-and-athead-controls-redden.txt`:

```
OLD instrument: exit 0 | claims printed 137 | 137/137 checks hold against 506b1e6598ef…   ← scored it green
NEW instrument: exit 2 | claims printed   0 | CANNOT-JUDGE: HYBRID RUN - the document judged is
                                              not the document at the tree judged
```

The control is in the suite: **test 7**, `a document from another revision than the judged tree is
REFUSED - the hybrid that used to score green`. It asserts exit **2**, that the refusal names both
revisions, that no verdict headline was printed, and that the refusal names the tree it judged.

What the fix does:

- the judged revision is **resolved to a full sha** (`resolve_rev`), and the headline names that sha,
  never a ref name — a ref can move between the run and the reading;
- with no `VERIFY_TREE`, it judges **the working tree's own HEAD** (it used to judge `origin/main`
  while reading a document that was not `origin/main`'s);
- if the document is not byte-identical to `docs/access-model.md` **at the judged revision**, the run
  **refuses** (exit 2, `CANNOT-JUDGE`) and prints how to judge an older tree honestly (pin that
  tree's own document with `VERIFY_DOC`). `07-old-doc-usage-still-works.txt` shows that path still
  working: `VERIFY_DOC=/tmp/old-doc.md VERIFY_TREE=62665dc` judges that pair and reports 133/137 —
  it does not refuse, because the document matches the tree.
- an unresolvable revision now **fails closed before the header** (exit 2,
  `06-unresolvable-ref-after-the-fix.txt`). It used to crash with a `TypeError` halfway through.

## (a2) The third defect: `VERIFY_TREE=@HEAD` never resolved

`scripts/check-all.py` passes `env={"VERIFY_TREE": "@HEAD"}`, and a test asserted the **string**
was passed — nothing asserted that it **worked**. It does not: `@HEAD` is not a git revision
(`git rev-parse`, `git log` and `git grep` all answer `fatal: invalid object name '@HEAD'`).

**Measured, same working tree, same document:**

```
OLD instrument: exit 1 | claims printed 111 | 13/111 checks hold against @HEAD (ran=111, fails=98)
NEW instrument: exit 0 | claims printed 137 | 137/137 checks hold against 6466284f4d9ea403…(VERIFY_TREE=@HEAD)
```

98 FAILs, every one of them `not in @HEAD`. **The operator entry point's access-model check has been
near-vacuous since it adopted that marker** — and check-all can only report that as "one red check",
which is why the 28→29 route-inventory FAIL looked like the whole story on 2026-10-26. `@HEAD` now
means "the tree this run names", and the suite has the control that was missing: **test 6** asserts
`@HEAD` resolves, that no claim says `not in @HEAD`, that the denominator is not shrunk (`ran >= 130`),
and that the headline names this tree's sha.

## (b) The "must NOT fire" control could be disarmed by hint drift

The suite's third test asserted `staleCount(shifted) > staleCount(base)`: a 7-line insert had to
**add** stale hints. With the table already stale it adds none — measured 2026-10-26 at `62665dc`:
**60 vs 60**, so the control could not fire and the suite was red for the wrong reason. Re-grounding
to `stale=0` fixed the symptom; nothing kept drift from re-arming it.

**The disarm, reproduced on demand** (`03-stale-table-disarm-probe.txt`, shifts 45–70):

```
shift 45: base stale=54 -> +7 stale=54   old-shape-fires=false
shift 50: base stale=54 -> +7 stale=54   old-shape-fires=false
shift 60: base stale=54 -> +7 stale=53   old-shape-fires=false
```

The control is now **per symbol**, not per count: every claim in the shifted file must resolve
exactly `delta` lines lower, no claim elsewhere may move, and no claim may vanish from the run —
`shiftReport()` in the test file. That holds in **any** table state.

**It is load-bearing in both directions** (`01-…`):

```
NEW per-symbol control on the REAL shift (60 lines staled, then 7 more): moved=52 still=35 wrong=0   ← passes
NEW per-symbol control on a NON-shift (same run twice):                  wrong=52  e.g. [gate comment] 0 != 7
```

Suite control: **test 8**, `the MOVED control still fires when the hint table has no headroom`, which
builds the staled table, moves the symbols 7 lines on top of it, asserts the per-symbol delta, and
**asserts the old shape is silent here** (`!(staleCount(moved) > staleCount(base))`) so the row's
claim is re-checked on every run rather than remembered.

## The instrument's own tests

**8 tests / 8 pass / 0 fail** (`02-instrument-own-tests-8of8.txt`) — the four that existed plus the
four controls added here. Before this row the file held four tests; the two defects above are exactly
the cases those four could not see.

## Movement

**None owed, shown** (`git grep` output in the PR body): the instrument's only readers are
`scripts/check-all.py` and `server/access-model-instrument.test.js`, and `server/index.js` and
`client/` do not mention it at all. No served path loads it.

**One consequence to state plainly:** because the instrument is read from the deployed tree by
`check-all`, the deployed copy keeps the old behaviour — including the vacuous `@HEAD` check — until
some future movement installs this file. #308 already needs a movement, so this PR can ride it.

## What is not changed

No assertion in the instrument's claim set, no citation in `docs/access-model.md`, no hint number.
This row is about *which tree* is judged and *how the control reads its result*, not about
re-grounding.

## The full suite at this branch's head

```
# tests 327   # suites 52   # pass 327   # fail 0   # skipped 0   EXIT=0
```

(`08-full-suite-at-this-branch.txt`.) 327 = the 323 that ran at `6466284` plus the **four controls
added here**; the instrument's own file goes 4 -> 8. Measured in a detached worktree of
`fix/access-model-instrument-honesty` with `npm test` from `server/`.
