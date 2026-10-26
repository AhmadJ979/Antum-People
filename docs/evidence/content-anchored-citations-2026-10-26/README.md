# The access-model instrument moves in, and its citations become content-anchored

**Rows `becc12ff` (the recurrence guard) and `39a63c38` (the instrument lives outside the repository),
done as one change, as the lead directed: a content-anchored guard that lives in un-versioned host state
is not reviewable.**

Tree under judgement: branch tip **`b85857e00c2ff30d7c8bff3303dce1d68a26ec7f`**, cut from
`origin/main` = **`f2c7b2b8ad9b265a68a81c64abd4ce02ac1b0e73`** (the deployed tree at the time of writing).

| what | md5 |
|---|---|
| `scripts/verify-access-model.py` **before** (the host copy, byte-for-byte) | `62c7c2d412171c7c7e880c1daf143912` |
| `scripts/verify-access-model.py` **after** (content-anchored, final) | `909e998fcb7b2346094bd58608e48aae` |
| `scripts/check-all.py` | `3931a76c7d23dc96d6062b4a84957fc1` |
| `docs/access-model.md` | `bb08ea6484529b6fd7f7627735de3671` |

## What changed

1. **The instrument moved into the repository** (commit `21fec96`, pure: the two files' md5s are equal,
   quoted above). It was `/home/team/shared/verify-access-model.py`, so no PR could carry its change and
   no reviewer could re-run it. `scripts/check-all.py` now resolves it from its own directory, so the
   path the operator is told about is the path that ran.
2. **A line number is a hint, never the assertion** (commit `b1911fa`). Every claim in `CLAIMS` and every
   entry in `DOC_CITATIONS` resolves its **symbol** in the file at the tree under judgement; the recorded
   line only chooses between occurrences and is **reported** when it is out of date. What can still
   redden: a symbol that is gone or renamed, a resolution that is ambiguous (two hits equidistant from
   the hint), and a document that no longer cites the site at all. This is the row's whole purpose: one
   merge that inserted lines near the top of a served file reddened 54 claims whose content had not
   changed, and that class cost three re-grounds of one document (`#289`, `#291`, `#292`).
3. **`check-all`'s access-model check now judges the tree this run names** — `VERIFY_TREE=@HEAD`,
   substituted with the full sha of the tree under judgement. This closes **`9148dee9`** in the only
   place it could close (see "A byproduct" below).
4. **The suite runs it, with both controls inside the gate** (commit `74b6483`), and the fixing commit
   `b85857e` for the two defects the first run exposed (see "What the first run caught").

## The controls — raw runs, all taken against the FINAL instrument

| # | tree | instrument | result | file |
|---|---|---|---|---|
| A | the branch tip, unchanged | this one | **`137/137`, exit 0**, hints stale=0 | `A-branch-tip.txt` |
| B | the tip **+7 lines inserted at the top of `server/index.js`** | this one | **`137/137`, exit 0**, hints stale=**54** | `B-shifted-this-instrument.txt` |
| C | **the same shifted tree** | the **previous**, line-exact one | **`83/137`, exit 1, 54 FAILs** | `C-shifted-previous-instrument.txt` |
| D | the tip with one claim's needle **reworded** | this one | **`136/137`, exit 1**, `ran=137`, names the claim | `D-symbol-gone.txt` |
| E | the branch tip | the suite gate | **4 tests, 4 pass, exit 0** | `E-gate-test.txt` |
| E1 | the branch tip, **first run of that gate** | the suite gate | **4 tests, 3 pass, exit 1** — kept | `E1-gate-test-first-run-reddened.txt` |
| F | the branch tip | `scripts/check-all.py --no-suite` | **exit 0**, 5 run / 7 skipped, one recorded RED-KNOWN | `F-check-all-no-suite.txt` |

**B against C is the proof the change is load-bearing**: the same bytes, the same document, two
instruments — 54 claims redden under one and none under the other, and the second reports all 54 as stale
hints. **D is the proof it still bites**: the symbol is gone, the claim fails by name, and the denominator
stays `ran=137` so a shrunk run cannot read as a green.

Every synthetic tree is a dangling commit built from the tip with a throwaway index
(`GIT_INDEX_FILE`, `git read-tree`/`update-index`/`commit-tree`); the worktree and the real index were
never touched. `SHIFT=052a4ae1c38bd349271015d08c71ac1ce8d0d52e`,
`GONE=8e9012aeff5e6205d970f364c0f75ee371d4a051`.

## A byproduct, said out loud rather than folded in

**`9148dee9` is closed by this change** — `check-all`'s headline named the tree it judged while the
access-model check judged `origin/main`, so a branch-side green said nothing about the branch. The
mechanism was already in `check-all` (it computes the tree it names); the check now receives it. The lead
asked to be told rather than have it closed silently: it is closed on the evidence in
`F-check-all-no-suite.txt`, where the check's own output reads
`137/137 checks hold against b85857e00c2ff30d7c8bff3303dce1d68a26ec7f` — the sha in the headline. Its
limit, stated rather than hidden: the instrument reads **git objects**, so a worktree with uncommitted
edits is judged at its commit.

## The host copy is NOT retired yet, and the order is the reason

**Status: `/home/team/shared/verify-access-model.py` is still there, still executable, and now the OLD
instrument** (`62c7c2d4…`, line-exact). It is retired **after** a tree carrying this change is deployed, by
**moving it aside** (e.g. `/home/team/shared/retired/`), **never by leaving a pointer at its path**: the
deployed tree's `check-all` still resolves that path until the change ships, and a pointer there would be
executed as the instrument. Until the retirement, anyone quoting the shared copy's numbers is quoting the
line-exact behaviour — control C is exactly what it now does on a moved file.

## Files in this pack

`README.md` (this record), `manifest.txt` (the md5 of every file below), `pack-check.py` (the four
directions above), `pack-check-runs.txt` (the log of its own runs), and the seven raw runs the table
above names: `A-branch-tip.txt`, `B-shifted-this-instrument.txt`, `C-shifted-previous-instrument.txt`,
`D-symbol-gone.txt`, `E-gate-test.txt`, `E1-gate-test-first-run-reddened.txt`,
`F-check-all-no-suite.txt`.

The checker and its run log are deliberately **not** in the manifest, and not named by the manifest's
rule: they are about the pack, not part of it, and a file that records every run can never have a stable
md5. `pack-check-runs.txt` holds this pack's first run too - it FAILED, on the author's own checker, and
the failure is kept rather than overwritten.

## What this pack does NOT prove

- It judges citations and the module; it does not judge the document's prose or its arguments.
- The §10.2 coverage table is still **recounted** from the page (unchanged by this work), and
  `doc-citations` remains the one recorded RED-KNOWN in `F-check-all-no-suite.txt` — a different family
  (the `App.tsx` anchors in `design-concepts/`) with its own recorded end. This change does not touch it.
- No movement is owed: the delta is `scripts/` plus one test plus this pack, and **no served path loads
  any of them** — `scripts/verify-access-model.py` is imported by nothing under `server/` or `client/`;
  the product's served bytes are unchanged.

## What the first run caught

`E1-gate-test-first-run-reddened.txt` is the gate's first invocation: **3 of 4, exit 1**, reddening on my
own history note in `scripts/check-all.py`, which names the old host path **in a comment**. That is the documented
trap (`skills/antum-one-authoritative-copy` §4: strip comments before scanning, or the guard catches its
own documentation); the assertion now reads **code** and still catches the regression it exists for —
`ACCESS_MODEL` pointing back at the host. A second defect was in the same commit's making: the first
attempt to add the homes to the instrument's usage block died on a quoting bug and landed nothing, so that
commit changed one test file and no instrument bytes. Both are recorded here rather than tidied away.

The failing run is filed beside the passing one, because **a defect fixed silently is indistinguishable
from one never found**.
