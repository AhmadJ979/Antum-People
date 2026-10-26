# The merge record for #305 — rule 41, and the rule it exists because of

Row `8b461294`. Rule 41 was appended to the live workflow file, mirrored into the repository, and merged as
**#305**. This pack is the merge record: the merge measured rather than believed (rule 33), the file identity,
the mirror's own drift check re-run **on the merged bytes**, the team's entry point at the merged tree, and the
scope proof that says whether a movement is owed. Its own checker is `pack-check.py`, and its runs — including
the ones that redden — are in `pack-check-runs.txt`.

## Why a merge *record*, and not just the merge

Rule 41's own subject is the gap this record closes: **a review approves a commit; a merge can land its child.**
The team has already lost a fix to that once — the `docs/stylesheet-30-bytes` branch was cut from another
branch's head instead of from main, so #258's merge carried #256's commit and **closed both PRs in one move**,
leaving the fix looking as if it had never landed. A record written from the branch that merged cannot catch
that class of error, because the branch is deleted the moment the merge lands. So every reading below is taken
from **the merge result on the remote**, and the pack says so where it matters.

## The merge, measured (not the notice)

| what | value |
|---|---|
| reviewed + approved commit (PR head) | `0d1f56a9f7fda374d7de127a00cebe6c4277b045` |
| the merge result, named for the checker to read **out of this file**: | `7361aba6bab041cd33cbb17f5029b5c7522bfdb9` |
| its parents | `ec2a29e` (main before the merge) and `0d1f56a` (the approved commit) |
| what the merge itself added | **one file**: the repository-root mirror, `5 +++--` (3 insertions, 2 deletions) |
| PR state | closed, `merged: True` at 2026-10-26T10:38:44Z, merged by `AhmadJ979` |
| reviews | one `APPROVED`, **on commit `0d1f56a9`** — the same commit the merge took as its second parent |
| branch after the merge | `docs/workflow-rule-41` **deleted** on the remote |

The last two rows are the ones rule 41 asks for: the approval names a commit, and a merge record must say
which commit that was and whether the merge landed it or a child of it. **Here it landed exactly the approved
commit** — the review and the merge agree, which is the case the rule says to *check for*, not to assume.
The file's isolation is measured too: `git diff --name-only 0d1f56a origin/main -- ../WORKFLOW.md` is **empty**,
so the version of the mirror that landed is byte-for-byte the version that was reviewed (`755b3b95`), and the
merge tree (`94d6bc36`) differs from my commit's tree (`2f248c56`) only because main carried #304's `server/`
change into the union — which is why a merge result is judged per file and never per commit alone.

## The measurement that counts, and the control that proves it counts

The mirror's own drift check, run against **main's copy** rather than against a branch that no longer exists,
reads **0 lines** — the live file and the mirror agree on the merged bytes. On its own that is a check that
might have been written green: the same check against the mirror main carried *before* #305 reads **2 lines**,
the rule-41 hunk. A check that reads 0 on both sides of a change is not evidence; this one reddens on the
pre-merge copy, which is `03-drift-on-merged-bytes.txt`.

Both sides of the sync also share a content identity, and it is worth saying exactly which number that is,
because two different md5s live in this record and confusing them is how a stale claim is born:

- the merged mirror **as a file** (`git show 7361aba:WORKFLOW.md | md5sum`), md5 of every byte: `745b245663ab6b4f1db05b02f1d9017a`;
- the **shared content identity**: the mirror with its `>` header lines dropped and blank lines removed, and the
  live file with blank lines removed, hash to **the same number**, `fee66c8b191875f8eab1b32a1afe4aca`. That is
  what makes the two texts "the same document" across the sync, and it is *not* the file md5 above.

`pack-check.py` asserts both — against **the merge result**, not against the working tree, so a later rule that
legitimately changes the mirror cannot redden this record. The first run of that checker caught this record
mislabelling the two (it compared the file md5 against the shared-content claim and read red); the wording here
is what the second run was written against.

## The files

Every file in this directory — README.md itself included, which the checker's first run caught this README
failing to name — is in the table below, and `manifest.txt` carries the md5 of each one.

| file | what it holds |
|---|---|
| `01-merge-identity.txt` | remote head, ancestry of the submitted commit, the merge commit and its parents, branch state, what landed around it |
| `02-merged-file-identity.txt` | the blob identity of the merged file, the empty file-diff, the merge tree and why it differs from my commit's tree |
| `03-drift-on-merged-bytes.txt` | the mirror's drift check on main (0 lines) and its control on the pre-merge mirror (2 lines), plus the shared content md5 |
| `04-rule-41-in-the-merged-file.txt` | rule 41 exactly once on main, rule 40 exactly once, the numbered-rule sequence, the mirror header's own range clause, and the rule's full text |
| `05-pull-request-305-and-its-review.txt` | the PR and review fields read from the API in this session — the commit the approval names |
| `06-entry-point-at-the-merged-tree.txt` | `scripts/check-all.py --no-suite` at the merged tree: the verdict, the 137/137 access-model reading, and the one red that is a recorded defect state |
| `07-scope-no-movement-owed.txt` | what the merge actually changed, whether that is served content, where the deploy directory stands, and the movement rule applied |
| `08-observer-run-at-the-time-of-the-record.txt` | one observer run — an observer reading, never called a monitor — showing the served pair and the same served tree |
| `manifest.txt` | the md5 of every file above, so the pack can be checked without trusting this README |
| `pack-check.py` | the pack's own checker: the four naming/manifest/tracking directions the team's packs use, **plus** the rule-41 content assertions |
| `pack-check-runs.txt` | every run of that checker, oldest first, including the runs that FAIL |

## What this record does not claim

- **It does not re-derive the live file.** `/home/team/shared/WORKFLOW.md` lives outside the repository, so a
  clone can only judge the mirror side. `pack-check.py` says that in its own output rather than pretending to
  have checked both; the live file was read in the session that produced `03-drift-on-merged-bytes.txt`.
- **It does not say a movement was run for #305, nor that it was not needed for #304.** It measures the deploy
  directory's revision and the diff, and states which delta each conclusion rests on (`07`).
- **It does not say the served product was watched.** One observer run is one reading; the team has no monitor,
  and `08` repeats decision 5's own caveats rather than dropping them.
- **It does not claim the merge tree equals the reviewed tree** — they differ, for a reason that is named and
  measured in `02`. The claim is narrower and it is the one that matters: the *file* that landed is the file
  that was reviewed.

## A trap this pack had to avoid, written down because it bit the previous one

In this README, the repository-root mirror is written as `../WORKFLOW.md` or in plain words — **never as a bare
backticked filename**. The pack convention (and the checker here) reads a backticked token like that as a claim
about a file *in this directory*, so naming the root file bare makes a correct pack fail with a missing-file
finding. That is recorded in the sibling pack's run log as RUN 4 → RUN 5; it is repeated here so the next pack
does not rediscover it.
