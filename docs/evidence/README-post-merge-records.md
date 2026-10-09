# Post-merge verification records — re-landed on `main`

Both records below were written **after** their own PRs had merged, so they landed on the merged branches and never
reached `main`. They are re-landed here, unchanged, on a fresh branch cut from `main` (base `3f16330`). The merged
branches were left exactly as they are — nothing was re-opened or re-created, and the files here were copied from
those commits with `git checkout <sha> -- <path>`, so they are the same blobs.

| record | produced on | source commit (still on its merged branch) |
|---|---|---|
| `l2-a11y-intake-labels/post-merge-verification.md` + `post-merge-client-bundle.txt` | the merged tree `0dd1a97` | `632a139` on `fix/a11y-intake-labels` |
| `l2-storage-decision/post-merge-verification.md` + `post-merge-server-suite.txt` | the tree that shipped the storage-decision record | `7f963a2` on `fix/l2-storage-decision-recorded` |

They exist because a verification run *on the merged tree* is the only kind that describes what actually ships —
writing it on the author's own branch verifies a tree nobody runs. The two records say, respectively: every one of the
24 label↔control associations is present in the client bundle built from the merged tree, read twice; and the
storage-decision assertions pass against the shipped tree, with the decision, its date and its IFZA gate recorded
where the code lives.

**Docs-only: no code changed, so no cutover follows from this PR.** Neither record is a substitute for the
per-surface label pass on the served tree, which is a different measure and lives in
`docs/evidence/label-per-surface-2026-10-09/`.
