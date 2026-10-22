# Recovery — the second replacement, and the restart-only recovery (2026-10-22T09:07Z)

The host was replaced a second time. This pack is the recovery's evidence, filed because evidence in
`/tmp` does not survive the next replacement.

**This is not the guard's acceptance.** That is row `57f2f3b8`, queued to another member. But its premise
moved with this replacement: the guard it was queued against (lock PID 15702) is dead, and the live guard
is now **1457**. The brief should be re-grounded against the live lock before that run happens.

## What the replacement did, measured at 09:07:10Z

| Check | Reading |
|---|---|
| `/etc/profile.d` | **no** antum hook — the replacement signature (env files rewritten at 09:06) |
| the product | gone; the lock still named **15702**, a corpse |
| port 3000 | re-taken by the platform's site dev server (pid 448) |
| the public URL | 200, `<title>My site</title>`, naming **no** bundle — the placeholder |
| the deployed tree | **`7000a70`**, clean, with `client/dist` intact (`e6ff5da3…` / `cb54e616…`) |
| the host tools | the merged copies still installed (deploy-main body `2cddb295…`, preflight `158e4a9e…`) |

Because the tree was already at the tip with its bundle on disk, this was the **`--restart-only`** case:
steps 4, 6 and 6b only — no fetch, no reset, no build, no re-seed.

## The recovery (20 seconds, 09:07:39Z -> 09:07:59Z)

`bash /home/team/shared/deploy-main.sh --restart-only` — full transcript in
`01-restart-only-recovery-run-stamped.txt`.

- **step 4** stopped the site's dev server (pid 448). **The platform respawned it as pid 1283 holding 3000
  again**, and the script's own `claim_port` pass evicted that listener once and re-claimed with the
  product (**pid 1381**). That is the contested-port case this team wrote down; it resolved inside the
  script's designed loop, with no second round of kills from the operator.
- **step 5** verified live: public 200 `<title>Antum People</title>`, demo login 215-char token, bad
  password 401, roster 13 employees, KSA offboarding 10 tasks, settlement rendered `19824.78` == the
  record. A pre-boarding flag also announced itself, which is the derived instrument behaving:
  *"This case reached the 48-hour mark while the app was not running (noticed 105.13h late). The flag
  itself is derived and read correctly on the first read after restart; nothing is marked missed."*
- **step 6** re-armed the guard: **pid 1457**.
- **step 6b** installed the login-shell hook from the deploy copy's revision `7000a70`.
- the served bytes were compared with the on-disk bundle and are **identical** — nothing was rebuilt.

## Measured after the recovery (09:08:34Z)

| Check | Reading |
|---|---|
| deployed tip | `7000a70abcd08f5932f69ef29be3086df1b30d9b`, tree clean |
| port 3000 | `node index.js` **pid 1381**, cwd the deployed tree's `server/`; `/api/employees` -> **401** |
| public URL | 200 `<title>Antum People</title>`, naming `assets/index-C9vf7pQB.js` |
| served vs on-disk | `index-C9vf7pQB.js` served `e6ff5da3…` = on-disk, 277,790 B; `index-BK_EwcpZ.css` served `cb54e616…` = on-disk, 35,306 B |
| the guard | lock **1457**, alive, `bash scripts/keep-alive.sh`, cwd the deployed tree, **sole lock holder**, **exactly ONE role-loop** by argv position |
| the hook | installed, 7,522 B, body md5 `728bf2cc…` |
| the marker | absent |
| the entry point | `python3 scripts/check-all.py --no-suite` -> **exit 0** (OK 4 / RED-KNOWN 1 `doc-citations` / SKIP-FLAGGED 7) |

**`--full` was NOT run against the host**, per the standing instruction that the guard's acceptance is a
separate run. The guard figures above are the mechanical reading: lock+PID in `/proc`, sole lock holder,
role-loop count by argv position rather than `pgrep -f`.

## Two measured consequences worth recording

1. **The site's dev server did not return to 3001 within the observation window** (measured 09:08:34Z:
   nothing listening on 3001). On 2026-10-21 it had come back on 3001; today the port was contested twice
   in ten seconds and the site's process was evicted both times. The public URL resolves to 3000 and
   therefore serves the product. Whether the site should keep a port of its own is decision 2, and this is
   a second observation of the same contention rather than a new question.
2. **The demo's third flag state has aged out.** The recovery's own verification expected three distinct
   flag states and measured **two** (`clear`, `started`): the case that read `inside_48_hours` on
   2026-10-21 has a start date of 2026-10-22, i.e. today, so it now reads `started`. The flags are derived
   from the seed day's offsets, which is the staleness decision 3 exists for — re-seed the morning of any
   demo. Not a defect in the recovery; the recovery's check is what surfaced it.

## The merge that preceded this

PR #279 merged at **09:05:44Z** (`35055f6`), two minutes before the replacement. The merge notice asked for
a new commit on the branch: **nothing was pushed, and nothing should be** — the review is an empty-bodied
`APPROVED` with 0 comments on both channels, the branch is deleted on the remote, my tip `e5bee13` is an
ancestor of `main`, all 19 files are blob-identical on `main`, the pack's manifest verifies **18/18 on
`main`**, and `git diff 7000a70 origin/main` is those same 19 docs files with **no `server/`, `client/` or
`scripts/` path among them** — so no movement is owed by it.

## Addendum, 09:12Z: the guard this recovery left was replaced, and that is measured

Everything above is true of **09:08:34Z**. It is no longer the current state, and an artefact that said
otherwise would be stale, so:

- **at 09:10:18Z the guard this recovery armed (pid 1457) was killed by SIGTERM** — the guard's own log
  records the fact, and nothing in it records who sent the signal;
- the lock then went stale, and for about twenty seconds a burst of login-shell hook arming attempts raced:
  each "armed as its own session leader", then most exiting with *"acquired the lock but another
  keep-alive.sh also guards … refusing to run a duplicate guard"*. **That refusal is the fix working** — the
  guard declines to run a duplicate rather than racing the port;
- **pid 4732 won and is the live guard.** At 09:11Z: lock names 4732, alive, **sole lock holder**, exactly
  **ONE role-loop** by argv position, and the hook idle: *"guard already running (pid 4732), nothing to do"*.
  The product still answers `/api/employees` **401** and the public URL still serves
  `assets/index-C9vf7pQB.js`.

**What the evidence does not say:** which process sent the SIGTERM. No guard test suite ran in that window —
no scratch tree for one was created today, and the burst's shape is a login-shell burst after the
replacement, not a rig's. A pattern kill (`pkill -f`) would produce this signature and is the team's
forbidden move, but this pack does not assert that: it records the kill and the burst, and names the two
candidates rather than choosing. `04-guard-log-tail-across-the-outage.txt` and
`05-guard-handover-1457-to-4732.txt` carry the raw lines.

**Consequence for the separate acceptance run (row `57f2f3b8`):** the guard that brief was queued against
has now died twice (15702, then 1457) and the live one is **4732**. That brief must be re-grounded against
the lock at the moment it runs, not against a PID written yesterday.

## Files

`01-…` the recovery's own run-stamped transcript; `02-…` the replacement inventory taken before the
recovery; `03-…` the post-recovery measurement and the merge check; `04-…` the guard's log across the
outage (a tail, with the full log left on the host); `05-…` the guard handover from 1457 to 4732.
`manifest.txt` lists every file here except itself.
