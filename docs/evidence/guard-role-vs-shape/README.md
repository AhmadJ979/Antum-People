# The duplicate-guard check reads a process's ROLE, not a string's SHAPE

Row `11705f3c`. The log is the source: `server/keep-alive.log`, 2026-10-20T15:13:46 to 15:13:56 —
**six refusals in 27 seconds**, the product served by nothing:

    EXIT: acquired the lock but another keep-alive.sh also guards <deploy> on port 3000 -
    refusing to run a duplicate guard: 27193 sh -c bash -lc 'HOME=/home/agent-lead bash -lc
      '\''cd "$HOME"; test -f ".../scripts/keep-alive.sh" && echo "exists"'\'''; 27195 bash -lc
      cd "$HOME" 2>/dev/null; test -f ".../scripts/keep-alive.sh" && echo "exists";

Neither pid was a guard. 27193 was the host's own session-bootstrap shell; 27195 and the rest were
transient probes. The candidate test asked only *"is argv[0] an interpreter, and does the string
`keep-alive.sh` appear somewhere later?"* — which is exactly the shape of a shell running a command
that **mentions** the path. The loop is `bash <script>`: the script path is the interpreter's **first
argument**, and that argument is never a flag. `bash -lc '...'` puts a flag there.

**The fix** (`scripts/keep-alive.sh`): a new `is_loop_argv()` decides, positionally — skipping
wrapper words (`setsid`, `nohup`, `env`, ...) and env-style `VAR=value`, then requiring an interpreter
followed by a **non-flag** argument whose basename is `keep-alive.sh`. `live_loops()` and
`handoff_loops()` both use it. `pgrep -f` remains the candidate net on purpose — it has to be wide,
because a loop can be armed by more than one route — but it no longer decides. The header's own
guidance was part of the defect and is corrected: it taught `pgrep -af keep-alive.sh` for counting and
`pkill -f keep-alive.sh` for stopping, and a shape match would have the operator count probes and
signal their own shell.

**How this was measured** — `scripts/guard-role-vs-shape-test.sh`, run against **live pids** on this
host. It extracts the process-identification block from each version of the script (never retyped) and
reports what each one calls a duplicate guard. `role-vs-shape-measured.txt` is the run:

| | decoys called guards | real loop called guard |
|---|---|---|
| **OLD** (`origin/main`, md5 `ed31f528…`) | **2** | 1 |
| **NEW** (this branch, md5 `9cc7d9d0…`) | **0** | 1 |

The decoys are the log's own shapes, held open (`sleep`), with their argv asserted before the verdict
is reported — argv[0] an interpreter, argv[1] a flag, the path later — so a decoy that drifted out of
shape fails the run instead of passing quietly. The **real loop** is the one actually armed on this
host, taken from `server/keep-alive.lock` (pid 27783, argv `/usr/bin/bash scripts/keep-alive.sh`).
Both controls matter: without the decoy half a green says nothing about the defect, and without the
true-positive half the check could be "fixed" by not checking at all.

**The test caught a regression in the first draft of the fix, before it shipped.** Reading
`/proc/PID/cmdline` raw made the whole command line one item (it is NUL-separated **argv items**, not
lines), so `argv[1]` was never seen and NEW missed the real loop — `FAIL ... the check no longer
protects the port`. That is what the true-positive control is for.

Re-run: `bash scripts/guard-role-vs-shape-test.sh` (add `--keep` to leave the decoys up for inspection).
It never signals, starts or stops a guard.

## Post-merge correction to this test's default (found by re-running it on the merge result)

The merged form defaulted `--old` to `origin/main`. That was right while the fix was on a branch and
wrong the moment it merged: on the merge result of #272 (`58acdac`, a descendant of `2b14a94`) a **no-argument run
FAILED** -

    FAIL  the OLD check did not count a decoy - this test is not reproducing the defect ...

because OLD was `origin/main`, i.e. the fixed code compared with itself (both sides md5 `9cc7d9d0...`).
A control whose default is the green reports a defect where there is none, so **the defect side is now
PINNED**, never a moving ref: `OLD` defaults to the recorded defective revision `2b14a94`, whose
`scripts/keep-alive.sh` md5 is `ed31f5285babe7f265414376cb3d63b8`. A before/after red cannot have a ref
on the defect side that moves forward - eventually that ref IS the fix.

Same bytes on both sides is now **CANNOT-JUDGE (exit 2)**, naming the md5 and saying the named revision
already contains the fix - never a `FAIL` that reads like the fix is broken. Same for an `OLD` that
carries `is_loop_argv`, and for an `OLD` that counts no decoy (exit 2, naming both md5s). Exit codes:
`0` the red reproduced on OLD and not on NEW with the live loop counted by both; `1` a genuine
assertion failure; `2` CANNOT-JUDGE.

### The three states, measured (raw, with exit codes)

Run from a foreign cwd (`/`) against a checkout at a different absolute path
(`/tmp/h3path/antum-people`) - the test assumes neither.

- **Bare, no arguments -> exit 0.** `# --old defaulted to the recorded defective revision 2b14a94
  (keep-alive.sh md5 ed31f5285babe7f265414376cb3d63b8)`. OLD counts 2 decoys **plus** the live loop
  (lock pid 27964, argv `bash scripts/keep-alive.sh`); NEW counts 0 decoys **plus** the live loop.
- **`--old origin/main` -> exit 2**, `CANNOT-JUDGE: OLD and NEW are the SAME BYTES (md5
  9cc7d9d040718828a7fd1a960ab988c8). The revision named by --old ALREADY CONTAINS THE FIX ...`.
  Re-measured after `main` moved to `61914f4`: the same verdict.
- **`--old 2b14a94`, the recorded defect revision named explicitly -> exit 0**, the same three `ok`
  lines.

The anti-vacuous control survives unchanged: NEW must count **no** decoy *and* both sides must count the
live loop read from `server/keep-alive.lock` - the control that caught the `/proc/PID/cmdline`
regression. The two revisions it compares:

| what | value |
|---|---|
| recorded defective revision | `2b14a94` |
| `scripts/keep-alive.sh` there (the defect) | `ed31f5285babe7f265414376cb3d63b8` |
| `scripts/keep-alive.sh` at `main` (the fix) | `9cc7d9d040718828a7fd1a960ab988c8` |

### Movement: none owed for this delta - shown, not asserted

This is a hand-run test: **no served code path loads it.** `git grep guard-role-vs-shape` finds only
prose citations in this README and two **comment** lines in `scripts/keep-alive.sh` (`:27`, `:232`); the
only non-comment, non-markdown hit is the test's own `mktemp` line. No runner globs `scripts/*-test.sh`:
`scripts/check-all.py` names its script-tests explicitly, and `grep -c guard-role-vs-shape
scripts/check-all.py` is `0`. Nothing under `/etc/profile.d/`, no cron job and no systemd unit names it.
A citation is not a load and a comment is not a load, so **no movement is owed**.

*Reachability gap, disclosed not hidden:* the five sibling `*-test.sh` are reachable from
`scripts/check-all.py`; this one is not. By the team's own maxim - a control the operator cannot reach
is a false green - that is a gap. It cannot join the fast read-only default set (it spawns decoy
processes and needs a live guard), so the honest options are the `--full` host-instrument set or an
explicit "deliberately hand-run" note here. Awaiting a ruling; not silently wired.
