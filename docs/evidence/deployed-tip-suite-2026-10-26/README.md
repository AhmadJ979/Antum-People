# The full suite at the deployed tip — and the close-out of `9148dee9`

Row `abc12967`. Two small things, both owed by the plan's own KPIs: a full suite run at the **deployed**
tree (the last recorded full run was 304 tests / 51 suites at `3257047`, and the run at the merge tree was
only valid for the merge), and the close-out of row `9148dee9` on evidence rather than on a claim.

## The trees, measured

| tree | what it is |
|---|---|
| **`2bd2f9dd7dfd70b30b95e27753eb02e08eaaf097`** | **the deployed tip** — the tree on disk, clean, and `origin/main` at the moment of these runs (`#300`, the WORKFLOW.md rule-40 merge) |
| **`ae85d4d2dafd6b4476f60bcf91bcc34b09d84d44`** | the tree the row names and the lead verified at 08:32Z — an **ancestor** of the tip |

`git diff --stat ae85d4d 2bd2f9d` is **`WORKFLOW.md | 8 ++++++--`** — one file, six insertions, two deletions.
The tip moved **while this row was open**, so the suite is run at **both** trees and each run is filed under
the revision it was taken at. That is the point of the pair: the row named one tree, the host carried
another, and a single run would have silently answered a question about neither.

## The runs (raw files, named for the revision each was taken at)

| check | tree | result | file |
|---|---|---|---|
| full suite | `2bd2f9d` (deployed tip) | **308 tests / 51 suites / 308 pass / 0 fail / 0 cancelled / 0 skipped, exit 0** | `01-suite-at-2bd2f9d.txt` |
| full suite | `ae85d4d` (the tree the row names) | **308 tests / 51 suites / 308 pass / 0 fail, exit 0**, 0 reds | `02-suite-at-ae85d4d.txt` |
| the two **doc-invariant gates** alone | `2bd2f9d` | **13 tests / 13 pass / 0 fail, exit 0** | `03-doc-invariant-gates-at-2bd2f9d.txt` |
| the entry point, `check-all --no-suite` | `2bd2f9d` | **exit 0** — OK 4, RED-KNOWN 1 (`doc-citations`), SKIP-FLAGGED 7 | `04-entry-point-at-2bd2f9d.txt` |
| the access-model instrument | `2bd2f9d`, by name | **137/137, exit 0**, hints stale=0 | `05-instrument-at-2bd2f9d.txt` |

**The gates are why this run was owed**, and they are green with the new evidence in place:
`server/design-concepts-index.test.js` and `server/privacy-notice.test.js` are doc-invariant gates, and the
merges under them added new files under `docs/`.

**`server/node_modules` resolved before every run** — a *dangling* symlink silently shrinks this suite and
reads as a false red (the 192/190/2 shape), so it is checked rather than assumed: `readlink -f` →
`/home/team/shared/probable-octo-sniffle/server/node_modules`, `test -d` → yes, 95 entries, and
`require('node:sqlite')`/`require('express')` load in the worktree. Both worktrees were scratch, created with
`git worktree add --detach`; the deployed tree was not built in, written to, or run from.

## `9148dee9` — closed, and here is the evidence

The defect: a check whose headline named one tree and whose body judged another. Closed by `#298` landing,
and the close is visible in the entry point's own output at the deployed tip:

```
[OK           ] access-model             tree=2bd2f9d   exit=0   0.2s
     home : IN the repository (scripts/verify-access-model.py) - a PR carries it; run by this entry
            point and by server/access-model-instrument.test.js
     said : 137/137 checks hold against 2bd2f9dd7dfd70b30b95e27753eb02e08eaaf097   (ran=137, fails=0, hints stale=0)
```

The headline names `2bd2f9d`; the check's own output names the **full sha of the same tree**. The mechanism
is `VERIFY_TREE=@HEAD`, substituted at run time with the tree the run names (`scripts/check-all.py`). The
lead took the same measurement at `ae85d4d` at 08:32Z; it is corroboration, not the basis — the output above
is from this run, at this tree (`04-entry-point-at-2bd2f9d.txt`).

**One copy remains, and the row's text is why this is worth saying:** the instrument has **one** authoritative
copy, `scripts/verify-access-model.py` in the repository. The host duplicate was retired
(`/home/team/shared/verify-access-model.py` → `/home/team/shared/retired/verify-access-model.py.2026-10-26-retired`,
same md5 `62c7c2d4…`) **by the lead**, not by me: when I went to move it, my own `mv` found nothing to move.
The absence is measured here — `ls` at the path returns "No such file or directory", and the retired file is
the only copy under `retired/` — and the entry point is re-run above with it gone, exit 0. A retirement
proved only by an absence would prove nothing; the entry point is what had to survive it.

## Files in this pack

`README.md` (this record), `manifest.txt` (the md5 of every frozen file), `pack-check.py` (the four
directions checked) and `pack-check-runs.txt` (the log of its own runs), beside the five raw runs the table
above names: `01-suite-at-2bd2f9d.txt`, `02-suite-at-ae85d4d.txt`,
`03-doc-invariant-gates-at-2bd2f9d.txt`, `04-entry-point-at-2bd2f9d.txt`, `05-instrument-at-2bd2f9d.txt`.

The checker and its run log are deliberately **not** in the manifest: they are about the pack rather than
part of it, and a file that records every run never has a stable md5.

## Files in this pack

`README.md` (this record), `manifest.txt` (the md5 of every frozen file), `pack-check.py` (the four
directions checked) and `pack-check-runs.txt` (the log of its own runs), beside the five raw runs the table
above names: `01-suite-at-2bd2f9d.txt`, `02-suite-at-ae85d4d.txt`,
`03-doc-invariant-gates-at-2bd2f9d.txt`, `04-entry-point-at-2bd2f9d.txt`, `05-instrument-at-2bd2f9d.txt`.

The checker and its run log are deliberately **not** in the manifest: they are about the pack rather than
part of it, and a file that records every run never has a stable md5.

## What this pack does not prove

- It judges the tree it names and nothing later: these runs read `2bd2f9d` and `ae85d4d`, not whatever
  `main` becomes next.
- `doc-citations` remains the one recorded RED-KNOWN in the entry point. It is a different family (the
  `App.tsx` anchors in `design-concepts/`) with its own recorded end, and this row does not touch it.
- No movement is owed: this change adds files under `docs/evidence/` only, and no served path loads any of
  it. The runs were taken in scratch worktrees; the deployed tree was never built in.
