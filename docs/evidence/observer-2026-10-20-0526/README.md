# The availability record's first line — the observer's first run, 2026-10-20T05:26:09Z, `PAIR HOLDS`

**Why this pack exists.** Filing the 2026-10-20 movement (`docs/evidence/cutover-2026-10-20-0515/`) turned up a
gap and stated it instead of closing it quietly: the movement **installed** the observer (7 of 7 host copies)
but its log never **executed** it, and `/home/team/shared/observer/` did not exist — so no observer run had ever
been recorded on this host, while DEPLOY.md's procedure makes the observer its **step 6**. The lead ruled that
step owed and ran it **themselves**, from the deployed tree (`bash scripts/observe-serve-pair.sh`) at
**2026-10-20T05:26:09Z**: exit **0**, `PAIR HOLDS`, and the record directory exists with its **first line**.
This pack is that first run, filed as bytes.

**Filed by the senior software engineer on 2026-10-20, byte-exact.** Both files are copies, not
transcriptions: each filed file's md5 is the md5 of the file it came from, **proven as filed and again on the
committed blob** (`git show HEAD:<path> | md5sum`).

## The record's first line, quoted verbatim

```
{"ts":"2026-10-20T05:26:09Z","verdict":"PASS","url":"https://b974147c03228029e277d1cbe6646fe6.ctonew.app","status":"200","title":"Antum People","page_assets":"assets/index-BG0peuOK.js assets/index-pNSrK3wr.css ","asset":"assets/index-BG0peuOK.js","expected_md5":"f65f15c109e76e86cd8b8abe7102f748","fetched_bytes":"274242","fetched_md5":"f65f15c109e76e86cd8b8abe7102f748","tree":"/home/team/shared/probable-octo-sniffle","tree_head":"cf3dad3","note":"","duration_s":"0","interval_s":"0"}
```

That is the whole of `runs.jsonl` as filed — **1 line, 487 bytes including its trailing newline** (the line's own
bytes: **486**; the file's md5:
`2000ef27aaaaa9ae801c995cffbc8b46`). It is quoted rather than described on purpose: this is the series' first entry, and its exact
bytes are the evidence. The quote was spliced in from the file's own bytes rather than retyped, and a check
compares it back against them.

## What the run's own stdout shows (`observer-first-run.log`)

- **`LIVENESS: <no earlier run in this record>`** — followed by the observer's own sentence: *"the observer
  has not recorded a run here before; **a gap before this line was NOT observed**"*.
- `derived: 2 asset(s) from /home/team/shared/probable-octo-sniffle/client/dist (the artifact this tree
  serves)` — both names, byte counts and md5s, plus `tree HEAD: cf3dad3`. The expectations are **derived at run
  time from the tree's own build output, never remembered**, which is what makes the comparison mean anything.
- `measured: GET / → 200 | title: Antum People | page bytes: 799`, and *the page names* both
  `assets/index-BG0peuOK.js` and `assets/index-pNSrK3wr.css`.
- The per-asset comparison, fetched against expected: `assets/index-BG0peuOK.js → 200, 274242 B, md5
  f65f15c109e76e86cd8b8abe7102f748` against the same expectation; the stylesheet likewise
  (`35365 B`, md5 `eda548202468a7e0293053981037a594`).
- **`PAIR HOLDS (exit 0)`** — the page at the public URL names our asset(s) and the bytes match the served
  tree's artifact.

## The three limits this pack states plainly

**(a) This is the record's FIRST dated line, so it STARTS the availability record; it does not extend one.**
There was no earlier entry, and the file as filed contains exactly one line. Nothing before it is counted,
asserted, or implied by it.

**(b) No gap before this line was observed — so no outage or repair duration may be quoted from this pack.**
That is the observer's own words (quoted above), not an interpretation: the instrument records runs, and the
absence of an earlier run is not a measurement of downtime. This is the same limit the plan already carries
for the earlier windows, and it survives this pack: the plan's site-availability figure still has **no
duration** attached to it.

**(c) The `PASS` is an assertion about the PAIR — the public URL against the served tree's artifact at
`cf3dad3` — and says nothing about any authenticated surface.** The observer is a read of `GET /` and of the
assets the page names; it uses **no token**, reads nothing under `/api`, and would pass or fail identically if
every authenticated route were broken. The credentialled readings live in the movement's own record
(`docs/evidence/cutover-2026-10-20-0515/`), not here.

## What it corroborates — independently, not by agreement in wording

The merged movement record's served-surface figures were taken **by hand** (my own, 05:20:36Z). This run was
taken **by the operator** at 05:26:09Z with an instrument that **derives** its expected names and md5s from
`client/dist/`. Every figure agrees, including the one that looked odd in the hand readings:

| figure | hand (05:20:36Z) | observer (05:26:09Z) |
|---|---|---|
| `GET /` | 200, **799 bytes**, title `Antum People` | 200, **799 bytes**, title `Antum People` |
| assets named in the page | `index-BG0peuOK.js` + `index-pNSrK3wr.css` | the same two |
| bundle | `274242 B`, md5 `f65f15c109e76e86cd8b8abe7102f748` | fetched = expected, same md5 |
| stylesheet | `35365 B`, md5 `eda548202468a7e0293053981037a594` | fetched = expected, same md5 |
| tree measured | deployed HEAD `cf3dad3` | `tree HEAD: cf3dad3` |

Two different readers, five minutes apart, one set of numbers — and the observer's expectations come from
the artifact rather than from a person's memory.

**Chain of custody for the script itself.** The log's second line names the body that ran:
`scripts/observe-serve-pair.sh | 19556 B | sha256 59cfd8f59f25a2ba`. Verified against the repository: that blob at
`cf3dad3` is **19556 bytes, sha256 `59cfd8f59f25a2ba`**, and it is **the same blob at `df54f87`** — the tip when
this pack was written, having already been verified unchanged at `a2891fc` — so the run's own claim about which
script produced it is checkable from the repo rather than taken on trust. (The operator copy
installed under `/home/team/shared/` is a different size, 19,925 B; the log's `script:` line is what
distinguishes which copy ran — the **tree's**, which is what DEPLOY.md's step 6 prescribes.)

## What this pack does NOT show

- **A point, not a series.** One run is recorded. As read at 05:27:10Z, `observe-serve-pair.sh --status`
  reported `runs recorded: 1`, `last run 2026-10-20T05:26:09Z → PASS`, and **`loop: no lock file — no loop is
  armed`**. Nothing has watched the URL since this line was written, and nothing is watching now; the
  observer's stated blind spot ("somebody has to look") is unchanged by its first run.
- **Nothing about which surface the URL *should* show.** The observer asserts that **our build** answers at
  `https://b974147c03228029e277d1cbe6646fe6.ctonew.app`. It is silent on decision 2 — whether that URL ought to
  carry the product or the site — and a `PASS` here is not evidence either way on that choice.
- **Not a statement that the pair never broke before.** No `PAIR-BROKEN.txt` exists in the record directory
  (measured), so no break has been *recorded*; before this line, nothing was recorded at all.
- **Nothing about the client bundle changing.** md5 `f65f15c1…` is the same bundle the previous served tree
  `a5aa0e6` already served (`client/` delta 0); the pair holding says the URL serves our artifact, not that the
  artifact moved.

## Where the instrument's record lives

`/home/team/shared/observer/runs.jsonl` on the host — **outside the repository**, so it does not travel with a
clone and would be lost with `/home`. This pack is the repository's copy of that file's **first line**. The next
run appends to the host file and belongs in a **sibling directory stamped with its own run time**, not in this
one.

## Files

| filed as | copied from | bytes | md5 |
|---|---|---|---|
| `runs.jsonl` | `/home/team/shared/observer/runs.jsonl` | 487 | `2000ef27aaaaa9ae801c995cffbc8b46` |
| `observer-first-run.log` | `/tmp/observer-first-run.log` | 1,434 | `e1db352a7d2f184cf2f776b92c15c48c` |

**Staging note.** `.gitignore:6` is `*.log`, so `observer-first-run.log` is staged with **`git add -f`**, and
`git ls-tree -r HEAD` is what proves it is in the commit rather than merely staged. **No credential appears in
either file** (audited: no `eyJ…`, no password, no token — the observer's URL is public and its record carries
no authentication). No `server/` or `client/` file is touched, and the observer was **not re-run** to produce
this pack: one run's bytes, filed once.
