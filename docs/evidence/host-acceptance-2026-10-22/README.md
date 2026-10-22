# Host acceptance — 2026-10-22

**Row `57f2f3b8`.** A run **separate from the movement that re-established the host**, taken to accept
what that movement installed: the served pair, the deployed tree's own bytes, the guard and its own
exit path, and the one operator-reachable entry point.

**Not the engineer's run.** The movement's own measurements are in PR #279 (row `e1c27ae2`) and are
attributed there. Nothing in this pack is copied from it; where the two agree, they agree as two
independent readings of the same host — the movement measured at **10:12Z on 2026-10-21**, this run at
**09:08–09:12Z on 2026-10-22**.

## The host this run measured is not the machine the movement ran on

The movement ran on the host of 2026-10-21. **That machine was replaced again.** This host booted at
**09:06:10** on 2026-10-22 (`/proc/uptime`, `boot_id 6a6dd1ef…`), and re-established itself **without a
movement**: the platform's entrypoint (pid 1, `/entrypoint.sh`) started
`bash /home/team/shared/deploy-main.sh --restart-only` (pid 1380) at **09:07:48** — the product
listening on 3000 (pid 1381) and a guard armed at 09:07:53 follow from that.

**So the thing being accepted is the recovery path itself, exercised by the platform — not only the
engineer's movement.** The tree it deploys is the movement's tip, and the host tools are the ones the
movement merged.

| | |
|---|---|
| deployed tree | `/home/team/shared/probable-octo-sniffle` at **`7000a70`**, **0 uncommitted paths** |
| `origin/main` | **`35055f6`** (#279, the movement's evidence — docs-only) |
| deployed == main | **NO** — main is past the tip by that docs-only merge; the deployed tree is the tip the movement deployed |

## The five points

### 1. The served pair, pulled from the public URL — **PASS** (`01-index-html.txt`, `02-served-vs-dist.txt`)

`https://b974147c03228029e277d1cbe6646fe6.ctonew.app/` → **200**, **799 B**, md5
`889e7270d1555c8acf65d23f1cccbd86`, and it names **`assets/index-C9vf7pQB.js`** and
**`assets/index-BK_EwcpZ.css`** — the product, not the platform placeholder (which is 2,978 B and names
no `index-*.js`).

| asset | HTTP | bytes | md5 |
|---|---|---|---|
| `index-C9vf7pQB.js` | 200 | **277,790** | `e6ff5da3fd614ddcfe2c0beaa68164f4` |
| `index-BK_EwcpZ.css` | 200 | **35,306** | `cb54e6164a8e741ed807bac94577efcd` |

### 2. The same bytes on disk, at the deployed tree — **PASS** (`02-served-vs-dist.txt`)

Both files in the deployed tree's own `client/dist/assets/` (built 2026-10-21 10:12), compared against
the bytes the URL served, at tree **`7000a70`**:

```
SAME BYTES  index-C9vf7pQB.js  e6ff5da3fd614ddcfe2c0beaa68164f4
SAME BYTES  index-BK_EwcpZ.css  cb54e6164a8e741ed807bac94577efcd
```

This is the check that can redden: a foreign server holding port 3000 answers 200 with a bundle this
tree never built. Both served files are `dist/` files of the named tree, byte for byte. The dist
directory holds **exactly these two** files.

### 3. The guard, and its own exit path — **PASS, with a recorded transient** (`03-guard.txt`, `07`, `08`, `10`)

**Armed by lock + PID, not by `pgrep -f`:**

| reading | value |
|---|---|
| lock file names | `1457` |
| `/proc/1457` | exists |
| argv of 1457 | `bash scripts/keep-alive.sh` |
| **lock actually held by** | `bash 1457 … 9u … server/keep-alive.lock` (`lsof`) — a held lock, not a corpse |
| role-loops **by argv** (not `pgrep -f`) | **1** |
| login-shell hook | **present**, 7,522 B, md5 `47243c0c15da383801dca39888b61219`, Birth **09:07:59** |

**Its own end, by its own exit path — no 30 s SIGKILL, no `pkill -f`:**

```
kill -TERM 1457 at 2026-10-22T09:10:18+00:00
2026-10-22T09:10:18+00:00 EXIT: killed by SIGTERM (loop pid 1457)
```

**Re-armed through the hook's own route** — a login shell (`bash -l -c 'exit 0'`) runs
`/etc/profile.d/zz-antum-product-guard.sh`, which verifies a guard by lock + `/proc` and starts one only
when none can be verified. **Settled state:** lock names **`4732`**, `/proc/4732` exists, `lsof` shows
4732 holding the lock, role-loops by argv = **1**, and the hook logs
`guard already running (pid 4732), nothing to do`.

**What re-armed it, and from where:** after this boot, the **platform entrypoint's
`deploy-main.sh --restart-only`** (pid 1380, 09:07:48) armed the first guard and installed the hook from
the deployed tree's own `scripts/antum-product-guard-hook.sh`; after the SIGTERM, **the login-shell hook
did** — not a movement, and not a hand-start.

### 4. The one operator-reachable entry point, at the deployed tree — **PASS** (`04-entry-point.txt`)

```
cd /home/team/shared/probable-octo-sniffle
python3 scripts/check-all.py --no-suite          -> EXIT CODE = 0
VERDICT: no check is unexpectedly red. 1 check(s) are red in a state that is RECORDED as the
         defect state (doc-citations)
```

`OK 4 / RED-KNOWN 1 (doc-citations) / SKIP-FLAGGED 7`, every check naming `tree=7000a70`.
`doc-citations` is the standing recorded defect, unchanged by this work.

Extra identity readings (labelled extra — not one of the five): port 3000 is held by
`node 1381` (child of the boot's `deploy-main.sh --restart-only`); `GET /api/employees` →
**401** both on the host and at the public URL; `/` on the host names the same two assets.

## The transient, recorded rather than smoothed

**The lock file is stale in both directions, and both windows are real.**

1. **After a replacement**, it names the *previous machine's* dead guard. My recon at ~09:07:55 read
   the lock as **`15702`** — 2026-10-21's guard, gone — while this boot's guard had already armed.
   (`06-recon-superseded-hook-absent.txt`)
2. **After the guard's own exit**, it keeps naming the dead PID until its successor finishes starting.
   Between 09:10:18 and 09:10:37 the lock said `1457` while 1457 was gone. In that window the hook
   could not verify a guard, so **every login shell armed another one** — the tree's own log shows
   `armed as its own session leader` (4448, 4544, 5145, 5238, 5313, 5433, 5512, 5585 …) each immediately
   followed by `EXIT: acquired the lock but another keep-alive.sh also guards … refusing to run a
   duplicate guard: 4732`. **The outcome is correct — exactly one guard survives — but the counting
   instrument reads "a dead PID holds the lock" for ~19 s, which is the reading that looked like a dead
   guard on 2026-10-21.** The hook logged `FAILED to start the guard` three times in that window even
   though a guard was running and holding the flock.

**One reading is superseded, and is filed rather than dropped.** `06-…` also captured
**`HOOK ABSENT`** at ~09:07:55; the hook's **Birth is 09:07:59.535** — four seconds later, installed by
the boot movement still in progress. The reading was true when taken and false by the time it was
transcribed; it is kept, with its hash, because a run that reads a host mid-movement needs to know that
this is what it looks like.

**Nothing in this pack is judged void** — every file below is the bytes the run produced. The
`guard-hook.log` line count for today (337) is dominated by *this run's own* login shells: the agent's
command wrapper sources `/etc/profile` per command, so the hook runs per command. That is an artefact of
how the acceptance was driven, not of the guard.

## What this does NOT claim

- **Not a monitor, and not an availability rate.** It is one settling of a point in time; the guard can
  die with the host and nothing notifies a person — the observer says so itself, in its own words.
- **Not a claim about `--full`.** These runs are `--no-suite` and bare; the off-host checks
  (`cors-error-contract`, `guard-deploy-marker`, `install-host-tools`, `keep-alive-deploypath`,
  `observe-serve-pair`, `guard-role-vs-shape`) are `SKIP-FLAGGED` here and were not exercised.
- **Not a statement that the deployed tree equals `main`.** It is `7000a70`; `main` is `35055f6` on top
  of it, docs-only.

## Reproduce

```sh
URL=https://b974147c03228029e277d1cbe6646fe6.ctonew.app
D=/home/team/shared/probable-octo-sniffle
curl -s --noproxy '*' -o /tmp/pub.html "$URL/"                       # 1: names assets/index-*.js
n=$(grep -oE 'assets/index-[A-Za-z0-9._-]+\.js' /tmp/pub.html | head -1)
curl -s --noproxy '*' -o /tmp/url.js "$URL/$n"; md5sum /tmp/url.js < "$D/client/dist/$n"   # 2
lsof -iTCP:3000 -sTCP:LISTEN -P -n                                    # `ss` does NOT exist on this host
cat "$D/server/keep-alive.lock"; lsof "$D/server/keep-alive.lock"     # 3: lock + PID, never pgrep -f
kill -TERM "$(cat "$D/server/keep-alive.lock")"; tail -1 "$D/server/keep-alive.log"
bash -l -c 'exit 0'; tail -1 "$D/server/guard-hook.log"              # re-arm through the hook
cd "$D" && python3 scripts/check-all.py --no-suite; echo "exit=$?"    # 4
```

## Files

| file | what it is |
|---|---|
| `01-index-html.txt` | the URL's HTML, its md5, the assets it names |
| `02-served-vs-dist.txt` | both assets off the URL vs the deployed tree's `dist`, with the equality test |
| `03-guard.txt` | armed state, `kill -TERM`, the printed `EXIT:` line, the login-shell re-arm, settled state |
| `04-entry-point.txt` | `check-all.py --no-suite` at the deployed tree, exit code, verdict |
| `04-check-all-full-output.txt` | that run's full output |
| `05-host-state.txt` | boot evidence, entrypoint chain, deployed tree vs main, guard history, hook provenance |
| `06-recon-superseded-hook-absent.txt` | the ~09:07:55 reading: lock `15702`, `HOOK ABSENT` four seconds before the hook existed |
| `07-guard-identify.txt` | parent chain (`1457 <- 1 /entrypoint.sh`), argv census, the guard's exit code path |
| `08-hook-provenance.txt` | the hook's provenance header, its md5 vs the tree's blob, mtime stability |
| `09-movement-in-flight.txt` | `deploy-main.sh --restart-only` as the server's parent; the guard's log history |
| `10-guard-settled.txt` | the settled guard: `4732`, lock matching, hook "already running" |
| `md5sums.txt` | md5 of every file above, except itself and the run log below |
| `pack-check-runs.txt` | every `pack-check.py` run: the red one before `git add`, and the green one after |
| `pack-check.py` | the four directions this pack must hold, run against its own directory |
| `README.md` | this file |

### The check that had to redden first

`pack-check.py` failed on its first run and **two of the three failures were defects in the checker,
not in the pack**: it demanded that `README.md` name itself, and it treated every backticked
filename — including *host* files like `guard-hook.log` and `index-C9vf7pQB.js` — as a file this pack
must contain. Both are fixed: the README names itself, and external names are now an asserted block
that must be named **and must be absent** here, so a real file of that name would be caught. The third
failure was real and intended (`0 tracked, 14 UNTRACKED` before `git add`). Both runs are in
`pack-check-runs.txt`; the final run is exit 0.

## Re-take at 09:18–09:19Z, to the wider scope

The scope asked for a **bare** entry-point run and named the pair observer as the instrument that can
redden, so all five points were re-taken on the same state, fresh — nothing recalled from the run above
(`11-retake-pair.txt`, `12-guard-retake.txt`, `13-observer.txt`, `14-entry-point-bare.txt`).

**The state the acceptance was asked to verify had already moved, and that outranks the rest.** The
lock PID `15702` in the scope is **dead** — it belongs to the machine before the second replacement.
The guard on this host is a different process entirely, and the reading in force is the one below.

| point | re-take |
|---|---|
| served pair, names **from the served HTML** | `GET /` 200, 799 B, md5 `889e7270…`; js **277,790 B `e6ff5da3…`**, css **35,306 B `cb54e616…`** — both **SAME BYTES** (size *and* md5) as the deployed tree's own `client/dist` at `7000a70` |
| guard armed by lock+PID | lock PID **`4732`** printed; alive; argv `/usr/bin/bash scripts/keep-alive.sh`; **sole** lock holder (`lsof`, one row); **exactly ONE role-loop by argv position** — and `pgrep -f` agreed here (`4732`), which is not the same as trusting it |
| guard armed AGAIN by its own exit path | `kill -TERM 4732` → **`2026-10-22T09:18:30+00:00 EXIT: killed by SIGTERM (loop pid 4732)`** (its own line — not a SIGKILL). Re-arm through the hook: **`2026-10-22T09:18:31+00:00 hook: guard not running, started it (pid 13046)`** — **one second**, clean. Final state: lock PID **`13046`**, alive, sole holder, **1** role-loop by argv, port 3000 still `node 1381` |
| entry point, **bare** at the deployed tree | `python3 scripts/check-all.py` → **exit 0**, **OK 5 / RED-KNOWN 1 / SKIP-FLAGGED 6** (suite ran: 276/51/276/0) |
| revisions | deployed tree **`7000a70`** (clean); this acceptance **binds the deployed tree, not `main`** |

**Refuted, precisely:** the expected `SKIP-FLAGGED 7` is a **`--no-suite`** reading. Bare, the `suite`
check *runs* and counts `OK`, so the bare counts are **OK 5 / RED-KNOWN 1 / SKIP-FLAGGED 6** — and with
`--no-suite` they are `OK 4 / RED-KNOWN 1 / SKIP-FLAGGED 7`. Exit code and `RED-KNOWN 1
(doc-citations)` are confirmed either way; which command was run is what decides the count.

**The pair observer, run as the instrument it is** (`13-observer.txt`): `bash
/home/team/shared/observe-serve-pair.sh` → **`PAIR HOLDS (exit 0)`**, deriving its expectations *at run
time from the deployed tree's own dist* (2 assets, sizes and md5s) rather than from a remembered value,
and agreeing with the derivation above byte for byte. Its own header reports `2857 min since the last
recorded run` — the observer is a process on the host it observes, not a scheduler.

**`main` moved during this acceptance — because this pack merged.** `origin/main` is now **`043b752`**
(merge of #281) while the deployed tree is `7000a70`. The acceptance is of the host and the deployed
tree; a docs-only merge of the evidence itself does not move either.

**One process observation, recorded because it differs between the two re-arms:** the first exercise
(09:10Z, right after the boot movement) took ~19 s and produced `FAILED to start the guard` three times
plus eight duplicate spawns; this one took **1 s** with no duplicate at all. The difference is not the
guard's code changing — it is that the first was driven by many concurrent login shells during a boot
movement, and this one by a single shell. The hook is racy under *concurrent* shells, and correct under
one; both outcomes leave exactly one guard.

### Files added by this re-take

| file | what it is |
|---|---|
| `11-retake-pair.txt` | the served pair re-derived from the served HTML, vs the deployed tree's `dist` |
| `12-guard-retake.txt` | lock+PID, sole holder, one role-loop by argv, the TERM line, the re-arm, the final state |
| `13-observer.txt` | `observe-serve-pair.sh`: `PAIR HOLDS`, exit 0, expectations derived from the tree |
| `14-entry-point-bare.txt` | the **bare** entry-point run: exit 0, OK 5 / RED-KNOWN 1 / SKIP-FLAGGED 6 |
| `14-check-all-bare-full-output.txt` | that run's full output |

`pack-check.py` was re-run over the enlarged pack — runs 5 (red: the new files were untracked) and 6
(green) are appended to `pack-check-runs.txt`.
