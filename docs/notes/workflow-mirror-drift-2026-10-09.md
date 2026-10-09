# The repo's `WORKFLOW.md` was 50 lines of workflow behind — dated note, 2026-10-09

**Task `2ff1fe23`, part 1. This is the record of a drift that was found, not a rewrite of history: the file it
describes was brought in line with the live copy in the same commit, and what it used to say is quoted below
because the failure is the interesting part.**

## What was wrong

The repository carried its own `WORKFLOW.md` (tracked, 26 lines) while the team's live policy lived at
`/home/team/shared/WORKFLOW.md` (76 lines). The two had diverged in four ways, and every one of them told a
reader of this repository something untrue or incomplete:

1. **It prescribed a merge path the team had stopped using.** Its Development Process said *"**Merge:** After
   approval, the lead will merge the PR using `gh pr merge`"*. That was superseded on **2026-10-07** by the
   owner-merges rule that every member has been working under for two days — the owner merges, and a member
   who acts on a "PR awaiting your action" notice by pushing is committing the ghost-commit failure rule 20
   exists to prevent.
2. **It was missing the eleven rules learned from actual rejected work** — 19 to 25: evidence for the tree
   that will merge, ghost commits, the credential dying as a hang, deploying what `origin/main` is rather
   than what the plan remembers, self-check values read after the last commit, withdrawing a change your own
   evidence refutes, and the three capture/sampling conditions. A reader of this repository got the workflow
   of roughly 2026-10-06.
3. **It was missing the Submission Gate entirely** — the five owner-confirmed checks (read remote state, build
   proof on client-touching PRs, and the rest) that the live file puts *above* the rules.
4. **Its managed linked-repos line named the old repository** (`AhmadJ979/probable-octo-sniffle`), so a clone
   pointed at the pre-rename name for the team's own code.

`git log --follow` on the file shows it was last touched before the rebrand-era rules were written: it never
received 19–25, because those were added to the live file and no one read the repo copy back. **That is the
failure mode worth remembering: a mirror nobody reads back drifts, and this one drifted while being the only
workflow document a clone could see.**

## What was done about it

- The repo copy is now a **mirror** of the live file, with a header saying plainly that
  `/home/team/shared/WORKFLOW.md` is authoritative for the team and this copy exists for clones. It was not
  deleted — a clone needs the workflow — and the duplication was not resolved silently.
- The header carries the **date** (`2026-10-09`) and the repo commit the sync was taken at, and the check for
  future drift:

  ```
  diff -B <(grep -v '^>' WORKFLOW.md) /home/team/shared/WORKFLOW.md
  ```

- Rule **26** (the credentialed-pass rule) was added to the live file in the same pass, so the mirror carries
  1–26 rather than 1–25 on the day it was made.
- **One thing this note cannot do by itself:** keep them in step. The live file is edited whenever the team
  learns something, and this copy only moves when someone syncs it. The next reader who finds them different
  should sync the repo copy and add a line here rather than trusting either file to be current.

---

## The read-back, done after the merge (2026-10-09, task `b1d378b9`)

This note's whole point is that a mirror nobody reads back drifts, so the check is run from the repository on
the **merged** copy and its output is pasted here rather than asserted:

```
$ git log --oneline -1 origin/main
cd9daa8 Merge pull request #129 from AhmadJ979/docs/workflow-mirror-and-1234-record
$ diff -B <(grep -v '^>' WORKFLOW.md) /home/team/shared/WORKFLOW.md ; echo "exit=$?"
exit=0
```

**It prints nothing and exits 0**, so as of commit `cd9daa8` this mirror says exactly what the live file says —
the same 79 lines of policy, rule 26 included on both sides. Two things that read-back does **not** cover, said
rather than implied: it compares against the live file *as it stands at that moment* (the next edit to the live
file makes the mirror behind again, which is the drift this note is about), and it ignores blank-line placement
(`-B`), so a future diff that is only whitespace would pass this check.
