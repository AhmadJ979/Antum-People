# The observer — decision 5 (a)

*2026-10-19. What was built, what it measured, and what it still cannot see.*

## What this is, and why

Seven times this product has been replaced or gone dark, and **every time a person noticed, not a check**. The
shape of the failure is why a status check would not have helped: when a replacement hands the public URL to
the site's dev server, the URL answers **`200` with `<title>My site</title>`** and names none of our assets —
healthy to anything that asks for a status code. So the observer asserts the pair the recovery asserts,
positively, in one run from outside the product:

1. `GET /` on the public URL returns 200 — necessary, never sufficient;
2. the served HTML **names every asset the served tree's build emitted**, read out of the returned document;
3. fetching each of those assets off the URL and hashing it gives **the md5 that tree's own artifact has**.

| file | what it is |
| --- | --- |
| `scripts/observe-serve-pair.sh` | the observer: one run, `--loop <sec>`, `--status` |
| `scripts/observe-serve-pair-test.sh` | its suite: the red directions, the refusal, the record, the loop |
| `scripts/install-host-tools.sh` | carries it as an OPERATOR copy (0755), so a movement or an operator finds it |
| `DEPLOY.md` | "The observer" section, and step 6 of the movement is now this assertion instead of a hand-done fetch |

**Derive-or-refuse.** The expected asset names, byte counts and md5s are derived at run time from
`<tree>/client/dist/` — the artifact the host serves from — and the run prints where they came from. With no
derivable artifact it exits **3 and compares nothing** rather than comparing against a remembered number. A
literal can be pinned (`ANTUM_OBSERVE_EXPECT_ASSET` / `_MD5`); when a pinned value disagrees with the artifact
the run FAILS, **naming both** — a literal that cannot redden is a number nobody checks.

## Measured off the public URL (the real numbers, not a report of them)

`live-url-run.txt`, run at **2026-10-19T15:46:21Z** against
`https://b974147c03228029e277d1cbe6646fe6.ctonew.app`, deriving from
`/home/team/shared/probable-octo-sniffle` (tree HEAD `a5aa0e6`):

```
  measured: GET / → 200 | title: Antum People | page bytes: 799
            the page names: assets/index-BG0peuOK.js assets/index-pNSrK3wr.css
            assets/index-BG0peuOK.js  → 200, 274242 B, md5 f65f15c109e76e86cd8b8abe7102f748
            assets/index-pNSrK3wr.css → 200,  35365 B, md5 eda548202468a7e0293053981037a594
PAIR HOLDS (exit 0)
```

Those two hashes were **computed off the URL by this run** (fetched and hashed there), and they are the same
numbers the plan records for the served package — the observer reproduces the host's served measurement from
outside, which is the whole point. The run also wrote its own record line (in `live-url-run.txt`, and quoting
itself: `"verdict":"PASS"`, `"fetched_md5":"f65f15c1…"`, `"tree_head":"a5aa0e6"`).

## Both directions, off-host, with fixtures — never by breaking the live site

Each transcript is the observer's **full output** plus the record line and alert file it wrote. The fixture
servers are static servers on scratch ports; the fixture tree's artifact is 68 B, md5
`a2280fd1d1dcba22fd658c376019833a`.

| what the URL served | exit | what the observer printed | file |
| --- | --- | --- | --- |
| the pair (page names it, bytes are it) | **0** | `PAIR HOLDS`, with the md5 it measured | `raw/green-the-pair.txt` |
| 200 with `<title>My site</title>`, naming nothing | **1** | `does not name: assets/index-FIXTURE01.css …` + `title: My site` + *"a placeholder answers 200 too"* | `raw/red-placeholder.txt` |
| our asset's name, **different bytes** behind it | **1** | served `md5 7e928627…` vs expected `md5 a2280fd1…` | `raw/red-foreign-bytes.txt` |
| a tree whose build is missing | **3** | `REFUSED … will not compare against a remembered number`, and **no verdict line at all** | `raw/refused-no-build.txt` |

`raw/suite-observer-first-run.txt` is the suite's own first run, kept deliberately: five checks reddened.
One was a wrong expectation of mine (the derived asset list is sorted, so `.css` precedes `.js` — the pattern
could never have matched the real output), and four were a real bug in my test: the "a second loop refuses"
case wrote a literal `$$` that the shell layer mangled to a bare `$`, so the lock read as *stale* and the case
passed while testing nothing. Both were caught by the suite reddening, fixed, and the fixes are the checks
that pass now.

## The mechanism, named — and its blind spot

**There is no scheduler on this host, and none is invented.** `scheduler-absence.txt`, measured 2026-10-19:
PID 1 is `/bin/sh` (not systemd), there is no bus to talk to, `crontab` is not installed, and `/etc/cron.d` is
executed by nothing. `DEPLOY.md` has said the same since before this work. So the observer runs:

* **at every movement** — `DEPLOY.md` step 6, where the hand-done "confirm the served package off the URL" was;
* **when an operator arms `--loop <seconds>`** — the best mechanism that exists here, and a much weaker one
  than a scheduler: it is a process on the host it observes;
* **whenever a person runs it** — the only mechanism that works while the loop is dead.

**Blind spot, stated rather than implied.** A replacement does not wipe `/home` (the record survives) but it
kills every process, and it takes `/etc` — the login-shell hook that could re-arm anything is exactly what a
replacement removes. **A replacement therefore kills the observer, and nothing notices its death.** What
exists instead is the observer's own liveness line: every run prints the age of the previous recorded run,
`--status` answers "is the observer alive?" on demand, and a gap longer than twice the interval is called a
gap in the output. **And nothing on this host pushes a message to a person** — the failure is written where a
person looks, which is a weaker thing than being told, and it is what this business actually has.

## The record — this is what ends "no artifact timestamps the first answer"

Every run appends **one dated JSON line** to `/home/team/shared/observer/runs.jsonl` (overridable), timestamped
by the check itself, keeping the most recent 2000 runs. On a failure it writes
`/home/team/shared/observer/PAIR-BROKEN.txt`, which keeps the **FIRST** failure time so a window can be
measured; when the pair holds again that file is **moved aside, never deleted**, as
`PAIR-BROKEN-resolved-<stamp>.txt`, with the window appended to `restored.log` — bounded by the recorded runs,
and said to be bounded rather than exact. The alert names the recovery command
(`/home/team/shared/restore-product.sh`) and says it does not notify anyone.

## Read-only against the product

It queries the URL and writes only its own record directory. No restart, no marker, no guard interaction,
nothing under the deployed tree's `client/` or `server/`. Proven behaviourally in the suite: the observed
tree's files are byte-identical **with mtimes unchanged** after a run, the `/home/team/shared` copies and the
installed login-shell hook are unchanged by the whole suite, and the observer touches neither the guard's lock
nor the deploy marker.

## Tallies

Measured on the tree this record belongs to (`scripts/install-host-tools-test.sh` records the revision it did
its provenance work at — `d6dd576` — because the branch for this work was cut from the tree where the
after-state correction was still open; the code is identical at the branch head, verified after the final
commit):

* `scripts/observe-serve-pair-test.sh` → **73 passed, 0 failed** (`suite-observer.txt`). With the opt-in live
  case it is **75 passed, 0 failed** (`suite-observer-with-live.txt`), and it prints the live md5 it measured.
* `scripts/install-host-tools-test.sh` → **78 passed, 0 failed** (`suite-installer.txt`).
* **The count moved because the target moved, and the count check caught it**: adding the observer as a
  TARGET added five checks (a ×2, b ×1, l ×3), and the suite reddened at
  `FAIL (k) the total this suite reports (78) is the number DEPLOY.md states (71)`
  (`raw/count-check-reddened-before-the-doc-update.txt`) until `DEPLOY.md` was updated to 78 — the (#216)
  pattern working on the change that added to it.
* Scope: `client/` **0 files**, `server/` **0 files** — nothing the product serves changed, so **no build
  proof is owed and no movement is owed** while `client/` is unchanged.

## What is NOT done here (stated, not implied)

* **The host copy is not installed yet.** `/home/team/shared/observe-serve-pair.sh` lands at the next
  `install-host-tools.sh` run — the movement's step 1b. Installing from an unmerged branch would put an
  unreviewed script on the host, so every run in this record used the tree copy with a scratch record
  directory under `/tmp` (named in each file).
* **No loop is armed**; `--status` in `live-url-run.txt` reports "no lock file — no loop is armed".
* **The live suite case is opt-in** (`ANTUM_OBSERVE_LIVE=1`). It was run for this record; a reader running the
  suite without the flag sees the suite say it did not run it.
* **The observer cannot observe the window in which it is itself dead**, and nothing notifies a person. That
  is the blind spot above, not a gap to be discovered later.
