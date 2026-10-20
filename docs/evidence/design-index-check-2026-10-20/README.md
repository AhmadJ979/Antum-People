# The inventory gate (#267, row `a126c62f`) - what this pack holds

Two files, and both are named here (this README was added on 2026-10-20: before that the directory held
`runs.txt` alone, so the pack's rule that "the README names every file" had nothing to hold).

- `runs.txt` - the gate itself: the operator form, the suite gate, and the asserted reddening taken when
  the check was made a gate.
- `merged-at-d15f251.txt` - the acceptance re-taken **at the merge result**, because the merge result is
  the evidence and the branch no longer is. It also records what the re-measurement changed: the original
  "four blobs identical" sentence was measured against a `main` that *was* `d15f251`, and only three of
  those four still match today, because a later merge corrected one of them.

The check: `python3 scripts/check-design-concepts-index.py` (no arguments; it is also a gate in
`server/design-concepts-index.test.js`, in the suite the merge result is read from).
