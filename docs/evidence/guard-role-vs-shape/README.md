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
