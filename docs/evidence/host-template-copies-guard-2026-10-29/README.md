# Evidence — the retired host folder now has a guard (2026-10-29)

All of this was produced on the host, on this branch, cut from `origin/main` = **`414a007`**. Nothing
here reads or writes `client/dist`, and no repository file outside `scripts/` and this directory changed.

| file | what it is | how it was produced |
|---|---|---|
| `01-live-host-plant-proof.out` | **the redden proof**, run against the real `/home/team/shared/templates` | `bash 01-live-host-plant-proof.sh` at **17:15:48Z → 17:15:49Z**; P0 clean → P1 top-level plant **exit 1** → P1b clean → P2 nested-directory plant **exit 1** → P3 a name no list names **exit 1** → P4 clean, quarantine's 3 files green, and the folder listed identically before and after |
| `01-live-host-plant-proof.sh` | the script that produced it — **re-runnable**; it plants, measures, removes, and asserts the folder is restored | written to a file because this terminal's echo is not evidence (the transcribed commands above it are the session, not the artifact) |
| `02-check-host-template-copies-test.out` | the guard's own proof suite: **20 assertions, 0 failed** | `bash scripts/check-host-template-copies-test.sh` |
| `03-check-all-no-suite.out` | the entry point with the new check registered: **6 OK, 1 BROKEN (`doc-citations`, the known red at the tip), 8 skipped**; `host-template-copies` → **OK** | `python3 scripts/check-all.py --no-suite` |
| `04-host-file-inventory.txt` | every file under `/home/team/shared` outside the repository, the dependency tree and a scratch worktree — **1,420 files**; the population the duplicate search walked | `find` (the exact command is in the transcript below) |
| `05-host-duplicate-search.out` · `.py` | the Part-2 search: **1,130 repository documents** vs those 1,420 files, by name, by md5, and by an inverted index over long lines | `python3 05-host-duplicate-search.py`, ~40 s |

## What the redden proof actually shows, and what it does not

It shows that a document copy appearing at either of two paths the ruling covers is **named and fails the
run**, and that the quarantine's three files do not redden. It does **not** show anything about whether
the product serves the right bytes — the guard judges a folder, not a document, and it is **not a
monitor**: nothing schedules it. It reddens when a person or the entry point runs it.

## The two host-side pointer edits this round made

Not in this diff — they are in `/home/team/shared/`. Recorded in `host-duplicate-docs-pointer-2026-10-29.md`
(beside the search script and its transcript in the shared directory).
