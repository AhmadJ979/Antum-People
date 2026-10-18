# Marker: `main`'s tracker index is one round stale, as of 2026-10-17

**This is a marker, not a round.** It states what `main` does not yet carry and where the pending
record lives. It is superseded in one line when the owner rules on the closed PR.

Read against **`origin/main` = `d0422f4`** (#209), 2026-10-17. **Re-derive before quoting** — the
tip moved three times while this note was being written, and every count below moved with it:
`git log --oneline --first-parent 94166c3..origin/main | wc -l` for the merges, and
`git diff --name-only e19a98a..origin/main | wc -l` for the files on the divergence.

## What a reader of `main` is told by omission

`roadmap-board-index.md` on `main` (last touched `b667eb1`) still presents **Round 46** as its last
reading — re-checked 2026-10-12 against a tip of `94166c3`. Since that read, **thirteen merges** have
landed (Round 46 counted seven) and **none of it is recorded in the file `main` serves**:

`fa58787` #191 · `e19a98a` #193 · `b20e4eb` #194 · `659d0a4` #195 · `f05ebc4` #196 · `4b30e63` #197 ·
`2a44858` #200 · `662e881` #201 · `81c1dc5` #202 · `29a2a4d` #203 · `72f6a67` **#205** · `8fb4390` **#206** ·
`d0422f4` **#209**

1. **The cutover of 2026-10-14 ran and is discharged**: served tree `9d2182a → e19a98a`, all four
   success tests green, 2.5–2.8 MB consumed, the rollback rehearsed and not needed. `main` still
   describes cutover #6 as OWED.
2. **A movement is now owed for a different reason, and the index cannot show it.** At `29a2a4d` the
   divergence `e19a98a..main` was 14 files with **zero** under `client/` or `server/`. At `d0422f4`
   it is **19 files, three of them code**: `client/src/App.tsx` (1 line — a client change, so the
   served bundle can no longer be rebuilt from `main`), `server/compliance_engine.js` (**4 executable
   changed lines**, and it is required at `server/index.js:5` — inside the running server's require
   closure), and `server/reachability.js` (31 executable lines). **Merges #205 (the notice-shown
   wording batch) and #206 (the drift rule) put a movement back on the table after the previous one
   had been discharged.** The nineteenth file, `scripts/seed-demo.js` (#209, +17/−8), is *not*
   required by the server (`grep -c require server/*.js` → 0), so what is inside the closure stays
   three — but it does change what the demo seeder writes, so any datastore seeded before it holds
   rows the current script would not produce: **movement, then re-seed, then demo.**
3. **Three availability events on this host**: the movement itself (10-14), a replacement on 10-15
   (trigger 9's INSTANCE 4) and a second replacement on 10-17 (INSTANCE 5). Each has its own cause,
   date and measurement; none is in `main`.
4. **Decision 17 closed** (2026-10-17, #202 `81c1dc5`) and **decision 21 already executed**; the
   numbering sweep that reconciled the plan's, the code's and the board's numbering — with its
   captured searches and edit script — is recorded only on a branch.

## Where the pending record is

- **`docs/round-47-recut` @ `b5dce11`** — the round content: 11 files, **+477/−11**, cut on
  `29a2a4d`: the index's `## Last re-checked` and Round 47 block, four files under
  `docs/evidence/numbering-sweep-2026-10-15/`, three evidence READMEs, `pdpl-lawful-basis-mapping.md`,
  `un-operable-controls-inventory.md`, and the one-string subject correction in
  `server/reachability-register.js` (decision 14 → 17). `scripts/check-index-ids.py` exits 0 on it.
  **It is now three merges behind `main`** (#205, #206, #209) and will be re-grounded if it opens.
- It **supersedes** `docs/round-47-numbering-sweep-and-cutover` @ `86a77fd` (PR #198, closed).
- **`b5dce11` is the round content.** This note was added on top of it, and the branch tip moves
  whenever the note is edited — so quote **`b5dce11`** for the round, and the **branch name** for
  the note. (An earlier draft of this line named the tip, and was wrong within ten minutes: a sha
  that moves is not a reference.)

## What the mitigation has never done — measured on the 2026-10-17 event

**The login-shell hook has never yet been observed to re-arm a guard after an event. The recovery
has, twice.**

- The installed hook is `/etc/profile.d/zz-antum-product-guard.sh`, and its **mtime is 18:51:06** —
  *after* the event began, not before.
- `server/guard-hook.log` is **silent from 18:40:01 to 19:02:53**: no login shell ran it across the
  outage.
- What re-armed the guard was the **recovery path**: `server/keep-alive.log` records
  `18:41:52 armed as its own session leader (pid 21036)` and `18:42:15 … (pid 22723)`.
- By **19:16** the public URL served the cutover's own bytes (274,243 B, md5 `91f05725…`) with the
  API answering 401.

**Re-checked after `d0422f4` (#209) landed**: the public URL still answers 200, its page still names
`assets/index-Bh1-0KrL.js`, and `/api/compliance/notice` still answers **401** — so the tree the
product serves is still the cutover's, and the movement this note says is owed **has not run**.
(`GET /` → 200 is only the placeholder question; the pair that means *our* build is served is the
asset name on the page plus the bytes behind it.)

**No artifact on this host timestamps the first answer**, so no outage or repair duration may be
quoted from this event. `ps lstart` is 17m56s late on both live processes, and `/proc/stat btime`
reads later than live processes' own records.

## Why it is not on `main`

**PR #198 was closed unmerged** at 2026-10-17T18:38:34Z (`merged:false` measured off the API;
`merge_commit_sha` is populated even so and is not evidence), twenty seconds after **#199** closed at
18:38:14Z. `86a77fd` is not an ancestor of `main`, and `main` contains no Round 47
(`grep -c "Round 47"` = 0). The whole `docs/evidence/numbering-sweep-2026-10-15/` directory existed
nowhere but on that closed branch.

**Whether that close was intended has not been stated by the owner.** No replacement PR has been
opened for the round, because re-issuing the same content would reverse an act we do not yet
understand. The re-cut branch is pushed and inert, ready to open on one word.

## What the close costs, measured rather than assumed

- **No gate failure**: `python3 scripts/check-index-ids.py` on `origin/main` → **exit 0**. `main`'s
  script already carries `CONTENT_SHA` (×2) and its index quotes no digest needing the exemption.
- **One latent wrong number**: `server/reachability-register.js:148` on `main` still reads
  `decision 14's subject` where the decision is 17. It is a `why` prose field that
  `scripts/reachability-report.js:161,191` do print, but the entry is not in today's report output
  (`node scripts/reachability-report.js | grep "decision 14's subject"` → no match), so it is
  latent, not displayed.
- **The real cost is this file's existence**: the tracker's record of three availability events,
  the cutover's discharge and the sweep lives on a branch nobody reads.


## Carriage: which copy of this note is authoritative (measured 2026-10-18)

The note exists on **two branches, and `main` carries neither**. Measured with `git cat-file`:

| branch | tip at measurement | blob | bytes | what it says |
|---|---|---|---|---|
| `docs/marker-index-stale-2026-10-17` — PR **#208**, open | `0d370f1` | `9efe782` *(pre-append)* | 7,007 | thirteen merges, read at `d0422f4`, read-tip line present |
| `docs/round-47-recut` — the pending record | `69eb593` | `19fdec2` | 5,057 | an **earlier draft**: no read-tip line, and "**Ten merges**" |

The two texts differ by 43 insertions and 20 deletions, and on the recut branch this path is a **pure
addition** (+79 against its merge-base `29a2a4d`). So if the round is re-cut the documented way — laying
the closed branch's final tree for its changed paths — and this path is in that list, the **older copy
arrives second and overwrites the newer one**: a silent regression on the one record whose purpose is to
state what is stale. (Row 1's blob is the *pre-append* content; appending this section changed it. Row 2's
blob is stable only while the recut is untouched, which the standing hold requires.)

**The rule, in the order it must be applied:**

1. **#208 merges first.** From that moment `main`'s copy is authoritative, and this file is **not** the
   recut's cargo.
2. When the owner rules on the closed round: **rebase the recut onto `main` and take `main`'s bytes** —
   `git checkout origin/main -- docs/evidence/round-47-staleness-2026-10-17.md` — or simply leave the path
   out of the set the re-cut lays. **Never re-add this path from `docs/round-47-recut`.**
3. If instead the recut is to carry the note, **#208 is closed first** and the recut's copy is brought up
   to date before it goes up. **Not both.**

**Telling the two apart without trusting a sha that moves** (both tips move; the blobs above are a
measurement, not a reference): the current text carries a `Read against **origin/main = …**` line and its
own re-derive commands; the older draft carries neither and opens its list with "Ten merges". A reader
holding the 5,057-byte draft is holding the one that arrives second.
