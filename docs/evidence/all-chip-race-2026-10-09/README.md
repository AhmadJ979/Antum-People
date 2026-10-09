# The `All` chip and the workspace board can no longer disagree — row `2c37f2da`

**Tree under test:** `origin/main` at `1557d72` (fetched at the time of the work; the task text
named `f24a91c`, which was already stale). Client-only change: `client/src/App.tsx`.
PR: https://github.com/AhmadJ979/Antum-People/pull/119

> **Update, 2026-10-09 13:46 UTC — the after bundle in this pack is now the served bundle.** Cutover #3
> deployed tree `0dd1a97` → **`da3330d`**, and the bundle this pack measured its "after" pass on —
> **`assets/index-B8Hoaanh.js`, 270,982 bytes, md5 `abfe49feb21dc90b77743922f76a7399`** — is byte-for-byte
> what `:3000` and the public URL now serve. So every "after" figure here is a figure about the live
> surface, and the `before` numbers are about the bundle the public had before that cutover. The pack also
> carries one **withdrawn** artifact: `withdrawn-after-2-race-window-DEPICTS-DEFECT-STATE.png`, which sits at
> the root of this directory (it moved up a level out of `shots/`) and depicts the *defect*, not the fix —
> see the correction section below for what it really shows and why the race window with the fix is not
> photographed. Run record: `cutover-20261009-1346/README.md`.

## What was wrong, in the shipped code

`caseWorkspaces` held **one board per case**. `handleWorkspaceFunction` moved the chip on the click
and issued the read after it, so for the whole length of the `/workspace` read the *previous* view's
board was still what the panel drew: an `All (n) [SELECTED]` chip over a narrowed group set, with the
panel header reading the narrowed total. Measured on the served surface in the P2-4 rendered pass
(`docs/evidence/p2-4-served-pass/race-samples.json`: `All (14)[SEL]` over `IT · 0/5` from t=57061 to
58933 ms, resolving at 60592 ms). It is not a data leak — the filtered read is never served as the
unfiltered board — it is the chip and the board disagreeing for a tick.

## The fix

**Cache keyed by case AND view, plus the render rule that only a board whose view the chip names is
drawn.** The row allowed either a mode switch as a loading state or a cache keyed by case+mode; this
is the second, with the first as its fallback.

- `workspaceViewKey` / `workspaceReadKey`: the view is `all` or the function name the endpoint names.
- `fetchCaseWorkspace` files each response under the view it was **read for** — never under whichever
  chip is selected by the time it lands — and holds the read's own state (`reading` | `failed`).
- The render draws `wsData = boards[workspaceViewKey(workspaceFunction)]`: groups and totals are the
  selected view's alone. A view with no board in hand says `Reading the workspace track...`
  (or `The workspace track could not be read.`), so a narrowed board cannot be drawn under an `All` chip.
- `wsFacts` (any board of that case) supplies the facts the server derives from every line whatever the
  view is — the per-function counts, the derivation, the view label and note — so the chip counts do not
  blink out while a new view is read. Server source: `server/preboarding-workspace.js`
  (`functionCounts(allLines)`, returned as `available_functions` on every view).
- A line move drops that case's other views' boards; the view in hand stays up while it is re-read.

## How it was measured

Isolated rig: a worktree of `origin/main` `1557d72` on port 4718, its own seeded DB, its own throwaway
credential (never the live demo credential). The server process was **the same process for both passes** —
only the built bundle was swapped — so nothing here is a server-side difference. The live deployment on
port 3000 answered 200 before and after.

**Pre-flight (the rig discipline):** a clean build of the unmodified tree reproduced the live asset byte
for byte — `assets/index-gt1pFhU5.js`, 270,523 bytes, md5 `fb6e0df5493fc67a9d9cd9fba5dfa9e2`
(`preflight-main-build.txt`, `rig-setup-log.txt`). The fixed build is `assets/index-B8Hoaanh.js`,
270,982 bytes, md5 `abfe49feb21dc90b77743922f76a7399` (`build-fixed-log.txt`).

**The sequence, three times per pass:** open case `OFR-2026-DEMO-01` (15 workspace lines: IT 6, Admin 3,
HR 2, Manager 4) → click the `IT` chip (board narrows to `IT · 0/6`) → click `All` with a **6000 ms induced
client-side delay on `/workspace`** → sample the chip row and the board's group headers every tick.

**Honest limits, stated rather than glossed:**
- The window is **induced**. 6000 ms was chosen because agent-browser calls cost 1–3 s each: the 2500 ms
  delay the original P2-4 pass used is over before the first sample lands (a first attempt at 2500 ms
  produced exactly that — every sample already settled). **The product's own latency is unmeasured**, and
  no figure here should be read as its duration.
- Sampling is per-request round trip, so the tick times are the times the browser answered, not a
  continuous trace.
- The `Reading the workspace track...` branch is exercised by a view that has no board in hand (a chip
  never read for that case, or any view after a line move). The pass clicked `IT` then `All` on one case,
  so what it exercises directly is the **pairing rule** — which is the acceptance criterion — and the
  reading line is reasoned from the same lookup, not captured here.
- Two passes on one seed, minutes apart, in one session: this is a comparison of two bundles, not a
  change-of-seed repeatability check.

## Correction, 2026-10-09 — a withdrawn shot, and a rig hazard worth naming

**What was wrong.** `shots/after-2-race-window.png` was captioned "the same moment with the fix". It does
not show a fixed state. It shows `All (15) [SELECTED]` over a board with only `IT · 0/6` drawn — the
defect — and it is near-identical to the before pass's own race-window frame (4 bytes and 760 pixels
apart, all of them the scrollbar track). **The caption was false and is withdrawn with the file.**

**What the same pass's own record says.** Everything else in the after pass shows the fixed behaviour:
every tick of `after-samples.json` run 1 (t=485, 1042, 1800, 2758, 3118, 4076, 5735, 8392, 12051 ms) has
`All (15) [SELECTED]` with all four groups drawn, `reading:false`; the scoring counts **0 defect ticks
in 3 runs** against **11 in the before pass**; and `shots/after-3-settled.png` is a normal settled board
identical to the before pass's settled shot.

**So: did the capture path get a stale bundle while the sampling path got the new one?** Something of
that kind happened, and it is a rig hazard rather than a typo. The capture and the sampling disagreed
about what the page was rendering *in the same pass, seconds apart*, and the file lands on the wrong
side of the fix — so the capture path cannot be assumed to depict the page the samples read. What I did
that made that possible is named plainly: **I ran both passes in ONE browser session and swapped the
bundle underneath it**, so the session held a page from the first pass while the second pass's reads and
screenshots were being taken. The most likely mechanism is that the two commands resolved to different
page targets in that session (the newly loaded one for `eval`, the older one for `screenshot`). **I did
not verify the mechanism** — I am reporting the conditions I created and the disagreement the artifacts
show, not a diagnosis I proved.

**Rules this bundle now carries for the future:**
1. **One browser session per bundle.** Never swap a bundle under a live session and then reuse it.
2. **A screenshot must carry its own identity**: record the page's own script src (`/assets/index-…js`)
   and the panel's DOM reading in the same breath as the shot, so the file cannot be read against the
   wrong bundle. This capture predates that rule; the before/after figures still name their bundles, but
   the shots did not carry it themselves, and that is how the wrong one survived review.
3. A shot that contradicts the machine-scored samples of its own pass is a defect in the bundle, not a
   curiosity: the samples are per-tick DOM readings and win.

**Was the race window photographed with the fix, then?** No — and this is the honest answer rather than a
replacement claim. I attempted a verified re-capture on the merged `main` (`da3330d`, where the blob
`7fb5678d0861d977efac3b1521bcaaebdb7e0337` for `client/src/App.tsx` is identical in the rig, on
`origin/main` and on the branch, and where the served asset answers md5 `abfe49feb21dc90b77743922f76a7399`)
with the page's script src recorded around every shot; the capture hung at the sampling step and I
abandoned it rather than keep spending on it. **So the race window with the fix is not captured, and the
machine-scored samples are the evidence**: `after-samples.json` (per-tick chip row, group headers, read
state) against `before-samples.json`, scored by `after-verdict.json` / `before-verdict.json`. `shots/`
still carries one trustworthy race-window frame — the before pass's, which is the side that needed
photographing to show the defect existed.

## Verdict, straight from the samples

```
waited 30s; after pass marker: 1
== BEFORE (unmodified origin/main 1557d72, bundle index-gt1pFhU5.js md5 fb6e0df5493fc67a9d9cd9fba5dfa9e2) ==
 samples 31 all-view groups 4 narrowed sets seen [1]
  run 1 ticks 9 defect ticks 7 window t 484 - 5738
  run 2 ticks 11 defect ticks 2 window t 4025 - 5684
  run 3 ticks 11 defect ticks 2 window t 4032 - 5691
 total defect ticks 11
== AFTER (same tree + fix, bundle index-B8Hoaanh.js md5 abfe49feb21dc90b77743922f76a7399) ==
 samples 31 all-view groups 4 narrowed sets seen [1]
  run 1 ticks 9 defect ticks 0
  run 2 ticks 11 defect ticks 0
  run 3 ticks 11 defect ticks 0
 total defect ticks 0
listeners on 4718 after teardown: 0
live 3000: 200
evidence dir:
/home/agent-senior-software-engineer/antum-people/docs/evidence/all-chip-race-2026-10-09:
total 136
drwxr-xr-x  3 root root  4096 Oct  9 13:38 .
drwxr-xr-x 24 root root  4096 Oct  9 13:37 ..
-rw-r--r--  1 root root   703 Oct  9 13:38 VERDICT-summary.txt
-rw-r--r--  1 root root   828 Oct  9 13:38 after-fetches.json
-rw-r--r--  1 root root   282 Oct  9 13:38 after-narrowed-it.json
-rw-r--r--  1 root root  2042 Oct  9 13:38 after-panel-settled.txt
-rw-r--r--  1 root root 10229 Oct  9 13:38 after-samples.json
-rw-r--r--  1 root root   332 Oct  9 13:38 after-settled-all.json
-rw-r--r--  1 root root     0 Oct  9 13:38 after-verdict.err
-rw-r--r--  1 root root 13399 Oct  9 13:38 after-verdict.json
-rw-r--r--  1 root root   282 Oct  9 13:37 before-narrowed-it.json
-rw-r--r--  1 root root  9779 Oct  9 13:37 before-samples.json
-rw-r--r--  1 root root   332 Oct  9 13:37 before-settled-all.json
-rw-r--r--  1 root root     0 Oct  9 13:37 before-verdict.err
-rw-r--r--  1 root root 12544 Oct  9 13:37 before-verdict.json
-rw-r--r--  1 root root   442 Oct  9 13:37 build-fixed-log.txt
-rw-r--r--  1 root root  8216 Oct  9 13:37 preflight-main-build.txt
-rw-r--r--  1 root root  1967 Oct  9 13:37 rig-setup-log.txt
drwxr-xr-x  2 root root   110 Oct  9 13:38 shots
-rw-r--r--  1 root root 10556 Oct  9 13:38 transcript-after.txt
-rw-r--r--  1 root root 10012 Oct  9 13:37 transcript-before.txt

/home/agent-senior-software-engineer/antum-people/docs/evidence/all-chip-race-2026-10-09/shots:
total 296
drwxr-xr-x 2 root root    110 Oct  9 13:38 .
drwxr-xr-x 3 root root   4096 Oct  9 13:38 ..
-rw-r--r-- 1 root root 101116 Oct  9 13:38 after-2-race-window.png
-rw-r--r-- 1 root root  92529 Oct  9 13:38 after-3-settled.png
-rw-r--r-- 1 root root 101120 Oct  9 13:37 before-race-window.png
```

And one line to read the block above correctly: that summary is a **verbatim capture from before the
correction below**, so its trailing `ls` still lists `after-2-race-window.png` under the old name. That
entry is the withdrawn file; nothing else in the block is affected, and the figures in it are the ones
the correction quotes.

## Files

| file | what it is |
| --- | --- |
| `before-samples.json` / `after-samples.json` | every tick captured, with its chip row, group headers, read state and ms-since-click |
| `before-verdict.json` / `after-verdict.json` | the scoring of those ticks (a defect tick = an `All`-selected chip over fewer groups than the `All` view holds, with no read in flight) |
| `before-narrowed-it.json` / `after-narrowed-it.json` | the narrowed state each pass started from |
| `shots/before-race-window.png` | the defect photographed during the induced window (unmodified tree) — the only race-window capture in this bundle that is trustworthy, and the one the `before-*` samples agree with |
| `shots/after-3-settled.png` | the settled board with the fix — md5 `55ffece74dc9787f65bd7ddc3c15d5f1`, **byte-identical to the before pass's settled shot**, which is the expected result of a fix to a transient state: both bundles settle on the same board |
| `withdrawn-after-2-race-window-DEPICTS-DEFECT-STATE.png` | **WITHDRAWN — do not read as evidence for the fix.** It depicts the *defect* state: `All (15) [SELECTED]` over a board showing only `IT · 0/6`. md5 `e556b8c6e86049769d60cd17b84b8aea`, 101,116 bytes; it differs from `before-race-window.png` (101,120 bytes) by 4 bytes and 760 pixels, every one of them in the scrollbar track. Kept so the record shows what was withdrawn rather than quietly deleting it |
| `transcript-before.txt` / `transcript-after.txt` | the driving transcript of each pass |
| `preflight-main-build.txt`, `rig-setup-log.txt`, `build-fixed-log.txt` | the builds and the rig's own record |
| `before-fetches.json` / `after-fetches.json` | the `/workspace` requests the page made, with each one's induced delay |
| `before-verdict.*` | the before pass's scoring (the after pass's owns `after-verdict.json`) |
