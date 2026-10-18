# The measured movement package, re-cut at the tip it will ship (2026-10-18)

Raw output only. Nothing here is a summary: the two tallies and the PASS are in the transcripts,
and each transcript names the tree it was taken on.

## Why this folder exists

The measured package (PR #207) stated its after-state for `8fb4390`. Then PR #209 merged, and the
tip moved to `d0422f4`. **A measurement taken at a tip stops being a measurement the moment the tip
moves**, so the package was re-cut rather than allowed to stand one merge stale.

## What is in here

| file | what it is | tree |
|---|---|---|
| `preflight-d0422f4.txt` | `bash scripts/cutover-preflight.sh`, exit 0, **PREFLIGHT PASS** — the moved-tip gate now reads *"the shipped commit IS the commit this package measured (d0422f4)"* | deployed tree `e19a98a`, remote tip `d0422f4` |
| `suite-merge-result-d0422f4-tap.txt` | full suite TAP — **169 tests / 169 pass / 0 fail / 0 skipped** | merge result `d0422f4` |
| `suite-pr209-head-fc898a9-tap.txt` | full suite TAP on the branch head that became the merge — same tally | `fc898a9` |

Suite invocation, identical in both runs: `node --test server/*.test.js` from the repo root with
`PRODUCT_DB_PATH` pinned to a throwaway and both `node_modules` present (12 test files; `ls` and
`find` agree on the count, so nothing was silently skipped).

## What authorises carrying the SAME bundle bytes from `8fb4390` to `d0422f4`

Measured, not assumed:

- the merge changed exactly **one file** — `git diff --stat 8fb4390 d0422f4` → `scripts/seed-demo.js`,
  17 insertions / 8 deletions;
- `git diff --name-only 8fb4390 d0422f4 -- client/` is **empty**, so the build input is byte-identical
  and the emitted `assets/index-BG0peuOK.js` (274,242 B, md5 `f65f15c1…`) stands;
- the merge commit's tree hash equals the measured branch head's tree hash —
  `8a6c790d3fd57036f0d81ef81b2c60947dd05263` for both `fc898a9` and `d0422f4`;
- **no movement is owed by #209 by itself**: nothing the server serves loads the changed file.
  `server/index.js`'s require closure contains no `seed-demo` entry (`git grep -n 'seed-demo'` in
  `server/` hits only the test that spawns it, the reachability register that indexes it, and nothing
  else). The change is a **script the seeder runs**, so it lands with the movement as a behaviour
  change in the re-seed step, not as a change to the served bundle.

## Two runs during this work that were *my* ruler failing, not the suite

Kept in the team skill rather than here, but stated so the record is not one-sided:

1. `node --test server/` **runs the server** (it treats the directory as one script) — TAP said
   `1 test, 1 fail`, `EADDRINUSE 0.0.0.0:80`, `location: .../server:1:1`.
2. a `git worktree` with only the root `node_modules` symlinked is not dependency-complete — a stable
   `161 / 160 / 1`, failing on `Cannot find module 'uuid'`, because `uuid` lives in
   `server/node_modules` and `scripts/seed-demo.js` resolves upward from `scripts/`.
