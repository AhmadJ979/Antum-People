# The lock file's PID is a CLAIM; the flock holder is the FACT (2026-10-22)

Row `8e4be298`, found independently by the acceptance run (`docs/evidence/host-acceptance-2026-10-22/`)
and by the second recovery — they agree, and the host's own logs (transcript 10) carry both directions:

- **(a) after a replacement** the lock named the previous machine's dead guard (`15702`);
- **(b) after the guard's own exit** (`kill -TERM 1457`, 09:10:18Z) it went on naming `1457` until
  **09:10:37** while the successor **4077 already held the flock**. In that ~19 s window the reading said
  "a dead PID holds the lock" about a guard that was **up**, and the login-shell hook — which trusted the
  file's first line — armed a candidate per shell and logged **`FAILED to start the guard` three times
  while a guard was holding the flock**.

## The mechanism, measured rather than assumed

| question | what actually answers it |
|---|---|
| who holds the lock? | **`flock -n <lock> -c true`** — fails immediately when held, releases the instant it exits, cannot steal |
| who has the file open? | `lsof -t` — **not the same thing**: it lists a candidate loop sitting in its retry loop while holding nothing (measured: transcript 04) |
| who holds it, precisely? | `/proc/locks` would say — **it exposes no FLOCK rows on this host at all (0)**, measured, so `lsof` + a `/proc` cmdline check stays the naming instrument |

So the fix is one rule applied on both sides of the mechanism:

- **the writer** (`keep-alive.sh`) publishes its PID **at flock acquisition**, not after the duplicate
  scan that follows (the scan is the slow part under an arm storm — that is the 19 s), and a candidate that
  turns out to be a **duplicate hands the claim back to the live guard it measured** instead of leaving its
  own soon-dead PID behind;
- **the readers** (the login-shell hook, the preflight, the role-vs-shape control) take the **flock holder
  first**, the file's line as the **fallback for the orphaned-inode case**, and both are verified in
  `/proc` as a `keep-alive.sh` loop. A bare `pgrep -f` was never used and still is not.

## The required proof

**The exact window, forced, in a scratch rig (rig tree, rig port 3999 — the live host untouched):**

| hook | outcome in the window (holder alive, file naming a dead PID) |
|---|---|
| **OLD** (`origin/main` = the installed host hook, `728bf2cc…`) | **`FAILED to start the guard` — 1 line, judged running: 0** |
| **NEW** (`bf80c94d…`) | **`guard already running (pid 1178), nothing to do` — 0 FAILED lines** |

**The controls, all measured:**

- **two guards still cannot both run** (the duplicate refusal is intact): the second candidate logged
  `refusing to start: a live keep-alive.sh already guards … - 1178 …` and the live guard was not disturbed;
- **an opener is not a holder**: with a process holding the file **open and no flock** (`flock` probe FREE,
  `lsof` listing it), the NEW hook does **not** stand down — it arms and verifies. A pure-`lsof` test would
  have read that opener as a holder and left the port unguarded;
- **the handover**: with the lock file renamed (the stale-reclaim shape), a candidate *acquired* the new
  file's flock, found the live guard, and the **new lock file names the live guard** — not the exited
  candidate;
- **the shrunken window**: the same lock file now says, in the guard's own words,
  `the file names PID 999999 (DEAD - the file LAGS the live holder: read the HOLDER, not the file)`;
- **final state**: `flock HELD`, holder `2299`, file names `2299`, **claim == holder**, **one loop, sole
  holder, one role-loop** (transcript 04).

**Suites** (all at this branch): `keep-alive-deploypath-test.sh` **15 passed / 0 failed** ·
`guard-deploy-marker-test.sh` **22 / 0** · `install-host-tools-test.sh` **78 / 0** ·
`check-all.py --no-suite` **exit 0**.

**On the live host, read-only** (transcript 08/09): claim `13046` == holder `13046`, flock HELD, one
role-loop; the branch's preflight prints **`PASS guard alive (flock holder): pid 13046`** with **0 FAILs**;
the role-vs-shape control resolves the real loop **by flock holder** and still returns exit 0 with the
anti-vacuous half (`BOTH count the real loop`).

## Movement position — stated, not assumed

`scripts/` only. **Nothing served loads any of these files**: `git grep` for `keep-alive.sh` /
`antum-product-guard-hook` over `server/` and `client/` returns **nothing** (transcript 08, last line), so
**no movement is owed for correctness** — but two of the four files are **host tools**, so:

**the live host still runs the old bytes until the next movement.** The installed hook
(`/etc/profile.d/zz-antum-product-guard.sh`, body md5 `728bf2cc…`) is the OLD one, and the guard process now
running executes the deployed tree's OLD `scripts/keep-alive.sh`. A movement installs both (step 1b installs
host tools; step 6 kills and re-arms the guard, which is when the new writer takes effect). **This pack is
the evidence that the fix is correct, not a claim that the host is already fixed.**

## One thing I got wrong, recorded because it nearly shipped

The first edit collapsed **`$$` to `$`** in the line that publishes the PID (`publish_pid "$"`), which would
have written a literal `$` into the lock file — a false claim in the very mechanism under repair. **`bash -n`
passed anyway.** Caught by reading the bytes (`grep … | cat -A`), fixed with `self_pid="$BASHPID"` (no `$$`
literal to mangle). The rule that generalises: **after an edit round-trip, check the bytes of the line you
changed, not just that the file parses.**