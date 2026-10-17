# Marker: `main`'s tracker index is one round stale, as of 2026-10-17

**This is a marker, not a round.** It states what `main` does not yet carry and where the pending
record lives. It is superseded in one line when the owner rules on the closed PR.

## What a reader of `main` is told by omission

`roadmap-board-index.md` on `main` (last touched `b667eb1`) still presents **Round 46** as its last
reading — re-checked 2026-10-12, against a tip of `94166c3`. Since that read, the following has
happened and **none of it is recorded in the file `main` serves**:

1. **Ten merges**, not the seven Round 46 counted: #191 `fa58787`, #193 `e19a98a`, #194 `b20e4eb`,
   #195 `659d0a4`, #196 `f05ebc4`, #197 `4b30e63`, #200 `2a44858`, #201 `662e881`, #202 `81c1dc5`,
   #203 `29a2a4d` (2026-10-17T18:49:18Z, the deploy now owns the guard during a movement —
   `scripts/` only, no cutover owed).
2. **The cutover of 2026-10-14 ran and is discharged**: served tree `9d2182a → e19a98a`, all four
   success tests green, 2.5–2.8 MB consumed, the rollback rehearsed and not needed. `main` still
   describes cutover #6 as OWED.
3. **Three availability events on this host**: the movement itself (10-14), a replacement on
   10-15 (trigger 9's INSTANCE 4) and a second replacement on 10-17 (INSTANCE 5). Each has its own
   cause, date and measurement; none is in `main`.
4. **Decision 17 closed** (2026-10-17, #202 `81c1dc5`) and **decision 21 already executed**; the
   numbering sweep that reconciled the plan's, the code's and the board's numbering — with its
   captured searches and edit script — is recorded only on a branch.

## Where the pending record is

- **`docs/round-47-recut` @ `b5dce11`** — the round content: 11 files, **+477/−11**, laid on `29a2a4d`: the index's
  `## Last re-checked` and Round 47 block, four files under `docs/evidence/numbering-sweep-2026-10-15/`,
  three evidence READMEs, `pdpl-lawful-basis-mapping.md`, `un-operable-controls-inventory.md`, and
  the one-string subject correction in `server/reachability-register.js` (decision 14 → 17).
  `scripts/check-index-ids.py` exits 0 on it.
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

**No artifact on this host timestamps the first answer**, so no outage or repair duration may be
quoted from this event. `ps lstart` is 17m56s late on both live processes, and `/proc/stat btime`
reads later than live processes' own records.

## Why it is not on `main`

**PR #198 was closed unmerged** at 2026-10-17T18:38:34Z (`merged:false` measured off the API;
`merge_commit_sha` is populated even so and is not evidence), twenty seconds after **#199** closed at
18:38:14Z. `86a77fd` is not an ancestor of `main`, and `main` at `b667eb1` contains no Round 47
(`grep -c "Round 47"` = 0). The whole `docs/evidence/numbering-sweep-2026-10-15/` directory existed
nowhere but on that closed branch.

**Whether that close was intended has not been stated by the owner.** No replacement PR has been
opened, because re-issuing the same content would reverse an act we do not yet understand. The
re-cut branch is pushed and inert, ready to open on one word.

## What the close costs, measured rather than assumed

- **No gate failure**: `python3 scripts/check-index-ids.py` on `origin/main` → **exit 0**. `main`'s
  script already carries `CONTENT_SHA` (×2) and its index quotes no digest needing the exemption.
- **One latent wrong number**: `server/reachability-register.js:148` still reads
  `decision 14's subject` where the decision is 17. It is a `why` prose field that
  `scripts/reachability-report.js:161,191` do print, but the entry is not in today's report output
  (`node scripts/reachability-report.js | grep "decision 14's subject"` → no match), so it is
  latent, not displayed.
- **The real cost is this file's existence**: the tracker's record of three availability events,
  the cutover's discharge and the sweep lives on a branch nobody reads.
