# Deployment Documentation - Antum People

## Overview
The platform is a Node.js backend serving a React frontend (Vite). The production environment is a 4GB RAM server without swap.

## Environment Variables
The server requires these variables to be set in the environment:
- `ENCRYPTION_KEY`: 32-character hex key for AES-256-GCM (PII encryption).
- `JWT_SECRET`: Secret for signing JSON Web Tokens.
- `PORT`: Default is 3000.
- `PRODUCT_DB_PATH`: Absolute path to the product-owned SQLite database (e.g., `/home/team/.data/antum-product.db`).

**Hardening**: The server is configured to fail-fast and refuse to start if `ENCRYPTION_KEY` or `JWT_SECRET` is missing.

## Build and Deployment
1. **Frontend**:
   ```bash
   cd client && npm install && npm run build
   ```
   Output: `client/dist`.

2. **Backend**:
   ```bash
   cd server && npm install
   # Start detached (or via keep-alive loop)
   setsid nohup node index.js > server/server.log 2>&1 &
   ```

## Database Management
The product uses a private SQLite database, isolated from the team coordination store.
- **Schema**: Defined in `server/schema.sql`.
- **Migrations**: The server automatically executes `schema.sql` on startup (idempotent).
- **Seeding**: 
  ```bash
  export DEMO_SEED=true
  export DEMO_ADMIN_PASSWORD_HASH="<bcrypt-hash>"
  export PRODUCT_DB_PATH="/home/team/.data/antum-product.db"
  node scripts/seed-demo.js
  ```

## Maintenance & Stability
The **product** server is kept alive by a monitoring loop that restarts it when nothing answers on port 3000
— corrected 2026-10-22 to name the product; the loop is `scripts/keep-alive.sh`, and the correction is
recorded in **Port 3000 — who holds it, by owner decision** below.
- **Keep-Alive Script**: `scripts/keep-alive.sh`.
- **Log**: `server/keep-alive.log`.
- **Arming**: `nohup ./scripts/keep-alive.sh &`

**NOTE**: This host does not support systemd or crontab for non-root users. The loop must be manually re-armed after a host restart.

### Port 3000 — who holds it, by owner decision (decision 2, 2026-10-22)

**Ruling:** the product **keeps port 3000**, and the platform's site URLs serving the product is **accepted**.
Owner decision 2, ruled 2026-10-22; it upholds the 2026-10-09 finding recorded in
`cutover-20261009/README.md` under *Standing facts from this run*, which listed the same three options and left
the choice open. **The product is not moved off 3000.**

Read-only measurements on the live host, 2026-10-22, deployed tree **`7000a70`** — re-measured for the decision
rather than carried from that record. **A bundle name is a fact about a moment, not a constant**, so each name
below is stated with the moment and the tree it was read from; the dated note after the list carries the
current pair:

- port 3000 is held by **`node` pid 1381** (started 11:20:23), cwd `.../probable-octo-sniffle/server` — the product;
- the live URL and the `-dev` URL both answer **HTTP 200**, and both pages name the bundle the tree served **at
  that moment** — `assets/index-C9vf7pQB.js`;
- the deployed `client/dist/index.html` named the **same** bundle at that moment;
- `GET /api/employees` on the live URL answers **401** — the product's own gate, so the URL is served by the product.

**Dated note — the two later readings (2026-10-23 / 2026-10-24).** On **2026-10-23T15:33Z**, after a machine
replacement, the URL was **not** the product: **HTTP 200, 2,978 B, `<title>My site</title>`, no `assets/index-*`
reference at all, and `GET /api/employees` → 404** where the product's gate answers **401**. The product server was
down (no `node index.js`; `flock -n server/keep-alive.lock -c true` **succeeded**, so no holder; the install hook
`/etc/profile.d/zz-antum-product-guard.sh` **absent**), and port 3000 was held by the website's own dev server —
`node /home/team/shared/site/node_modules/.bin/vite dev`, pid 415, started 2026-10-23 15:32:56, parent
`bun run dev`. (The same page is described elsewhere as the platform's placeholder; what was measured on the host
is the website's dev server holding 3000 and serving it — either way the URL answered **200**, which is why a
status alone is not a serving test and the **gate** is.) The recovery at **2026-10-24T09:22:12Z** raised the
product and re-armed the guard — the guard's log records `armed as its own session leader (pid 5899)`, the lock's
`flock` probe **held** and its first line (the claim) reads `5899`, and the hook is back at
`/etc/profile.d/zz-antum-product-guard.sh` (written 09:22) — **without a rebuild**: `client/dist/index.html` is
still the 12:47Z movement's file (mtime 2026-10-22 12:47).
**Served pair now, read 2026-10-24T09:25Z on deployed tree `f4314d8`: HTTP 200, 799 B,
`<title>Antum People</title>`, naming `assets/index-Be_ijisC.js` and `assets/index-B7rk1n5J.css`, with
`GET /api/employees` → 401.** The recovery's own evidence is a separate record's pack.

**Who measures the pair.** `bash scripts/observe-serve-pair.sh`, run from the deployed tree, asserts it on every
run — it derives the expected asset names and md5s from `client/dist/` and hashes the bytes it fetches off the URL,
exiting 0 only if they agree. Read the current pair there; this page names a bundle only with the moment and the
tree revision it was read from.

**What an operator does about it.** A foreign process found on 3000 — the supervised `vite dev` for
`/home/team/shared/site` is the one that appears — is **evicted and the port re-claimed**; that is what the
movement already does at step 4 (`deploy-main.sh` resets, builds, seeds, restarts, **claims port 3000**, verifies,
re-arms the guard). Nothing in this ruling asks an operator to free 3000 for the website.

**The line above, corrected 2026-10-22.** It read *"The site is kept alive by a monitoring loop that restarts the
server if port 3000 is empty"* (written 2026-09-19, when the platform's website was not yet a second web surface
on the same port). The loop its own bullets name — `scripts/keep-alive.sh`, `server/keep-alive.log` — restarts the
**product**: that script's header states the health contract ("401 contract on PORT (default 3000). Nothing
listening -> start the server"), and what it starts is `node index.js` in the product's deploy directory. So the
loop is the product's guard, not the website's; the website has no serving path while the product holds 3000
(measured 2026-10-09; no website process was listening on any port when the figures above were taken). The
sentence above now names the product.

**Open question, not a claim.** The website's own code targets that same port — `site/vite.config.ts:9`,
`site/serve.ts:18` (`const PORT = 3000`), `site/publish.sh` restarts the site on 3000 — and `site/serve.ts:31-46`
frees the port before binding by killing whatever is listening on it, under `sudo`
(`lsof -t -iTCP:3000 -sTCP:LISTEN` → `kill`). **What a publish would do to what either URL serves has not been
measured.** Publishing is the owner's act; this ruling does not depend on its outcome. It is flagged only because
3000 is the port the ruling assigns to the product.

## Verification
1. **CLI**: `curl -s --noproxy '*' http://127.0.0.1:3000 | grep "Antum People"`
2. **Logs**: Check `server/server.log` for startup success.

## Cutover Procedure (to isolated DB)

**2026-10-19 — this section is the movement's PRE-2026-10-17 shape**, kept because its
database-isolation steps still apply: it stops the loop by pattern match (`pkill -f keep-alive.sh`) and starts
it again by hand, whereas the guard is armed by the script that holds `server/keep-alive.lock` and must be
killed by the pid in that file. The movement as it actually runs is **`## The movement — the repo-owned
procedure`** below; where the two disagree, that section is the procedure.
1. Ensure the new code is deployed to the production directory.
2. Stop any running server and existing keep-alive processes (`pkill -f keep-alive.sh`).
3. Set the `PRODUCT_DB_PATH` in the environment.
4. Run the seed: `DEMO_SEED=true node scripts/seed-demo.js`.
5. Start the loop: `nohup ./scripts/keep-alive.sh &`.

### Rollback
1. Stop the loop and server.
2. Check out the previous commit in the production directory.
3. Restart server.

## The movement — the repo-owned procedure

*Retired into the repository on 2026-10-19 from the host runbook `/home/team/shared/cutover-20261010-RUNBOOK.md`,
per the 2026-10-19 ruling: the repo-owned content lives here and the host file is a checklist plus a pointer.
The retired full text is kept byte-identically at
`/home/team/shared/retired/cutover-20261010-RUNBOOK-full-retired-2026-10-19.md` — a dated RECORD of the
2026-10-10 run and its 10-18/10-19 amendments, not a second copy of this procedure.*

### Before you start: derive the checks, never remember them

**A remembered md5 is a dated measurement, not a check.** The retired file's own precondition line proved it:
it recorded an md5 that belonged to a copy from a run **two days later**, and could not have been the
verification it claimed to be. Every precondition is therefore a command:

```
bash /home/team/shared/probable-octo-sniffle/scripts/install-host-tools.sh --verify   # copies vs their blobs; exit 1 on drift
bash /home/team/shared/probable-octo-sniffle/scripts/cutover-preflight.sh             # the movement's preconditions
```

Run the installer **from a tree**, never from `/home/team/shared`: a self-copy there would be a second,
quietly stale install path. The preflight names which revision the live hook is and whether it pairs with the
deploy that writes the marker — see "Host tooling" below.

### The sequence

1. `date -u` — check the clock against the timing rule below before anything else.
2. `git -C /home/team/shared/probable-octo-sniffle fetch origin main`, then read `git log --oneline -1 FETCH_HEAD`.
   The tip you name in the record is the tip you move to (rule 22).
3. If the host copies are older than that tip, refresh them from it first — the one-liner in "Host tooling".
4. `bash /home/team/shared/deploy-main.sh` — one movement: reset → build → seed `--force-clear` → restart →
   claim port 3000 → verify → re-arm the guard. Steps 1b and 6b install the copies from the tip it moves to.
5. Read the run's own output for its own claims: the build's asset name, `seed OK`, port 3000 held by the
   product server, the demo credential, the flag states, a non-empty `watchdog pid:`.
6. **Independently confirm the served package — with the observer, not by hand**: run
   `bash scripts/observe-serve-pair.sh` from the deployed tree. It asserts the pair the recovery asserts,
   positively: `GET /` returns 200, the served HTML NAMES the assets this tree's build emitted, and the
   bytes fetched off the URL hash to those artifacts' md5s — the expected names and md5s DERIVED from
   `client/dist/`, never typed in. It prints the status, the asset it found in the page, the bytes and md5
   it computed, and the timestamp. **Exit 0 = the pair holds · 1 = it does not · 3 = it could not derive**
   (and then it compared nothing). A 200 from the wrong server is the failure this catches, and a 200
   alone is not health — a fallback that hands the URL to the site's dev server answers 200 with
   `title My site`. See "The observer" below.
7. Write the record into `docs/evidence/cutover-<date>-<HHMM>/`: README, run log, build and seed logs, before
   and after readings — **staging the logs with `git add -f`**, because `.gitignore` carries `*.log` and has
   swallowed a record's own evidence twice (rule 27).
8. Only then the plan's follow-ups.

### Timing: why a re-seed waits for 00:00 UTC (04:00 GST)

The seeder derives every date as an offset (+14 / +1 / −1) **from the day it runs**, so a re-seed before
midnight UTC dates the demo's amber case to the wrong day and its derived flag leaves `inside_48_hours` by
morning; a re-seed on or after midnight restores the window. Measured 2026-10-09: `hours_to_start 8.72`
against a date-only start. **The wait is a measurement.**

## Host tooling (the operator copies)

The scripts an operator runs live OUTSIDE the repository, in `/home/team/shared`, because every movement
does `git reset --hard` in the deployed tree and would destroy anything kept inside it. Each copy carries a
provenance block naming the revision it was installed from and the md5 of the blob its body came from.

**There is one install path: `scripts/install-host-tools.sh`.**

```
bash scripts/install-host-tools.sh                    # install from this tree
bash scripts/install-host-tools.sh --commit <rev>     # install the blobs at <rev>, without moving the tree
bash scripts/install-host-tools.sh --verify           # compare every copy's BODY with its blob; exit 1 on drift
```

It installs `deploy-main.sh`, `cutover-preflight.sh`, `restore-product.sh`, `rollback-to-9d2182a.sh`,
`success-test.sh`, `observe-serve-pair.sh` and the login-shell hook — **atomically** (a temporary file is renamed over the target, so
replacing a script that is executing cannot corrupt the running process) and **idempotently** (a second run
with the same source changes no byte, so the copies' mtimes stay put).

**The hook is installed from the deploy's revision, not from the tree.** `deploy-main.sh` step 6b reads the
revision out of its own provenance block (`$0`) and passes it as `--hook-rev`; the installer resolves that
revision, installs the hook from it, and **logs which revision it used** — or, when the object cannot be
resolved, that it fell back to the tree and why. The two must come from one revision: the hook is what reads
`server/deploy-in-progress`, and the deploy is what writes it, so a hook from an older revision cannot see
the kill window its own deploy announces. This bit on 2026-10-19: a replacement left the host running
`e19a98a`'s hook (0 occurrences of `deploy-in-progress`) against an installed deploy copy from a revision
40 commits ahead, and the preflight printed green because it compared the hook with the **served** tree.
The preflight now attributes the live hook to a revision by its bytes, compares that with the deploy copy's
revision, warns when they differ or when the live hook carries no provenance, and states how far the served
tree is behind `origin/main` — the distance that makes a raw install dangerous at all.

`deploy-main.sh` calls it itself: **step 1b**, immediately after the reset, and again in **step 6b**. So the
copies the NEXT movement runs are always as new as the tip it moved to, even if a run fails later at the
build or the seed. Before this existed, the copy an operator invoked was the one the PREVIOUS movement had
installed: on 2026-10-18 the host copy came from PR #201 and carried no `deploy-in-progress` marker write,
while the installed hook was PR #203's and WAITS for that marker — so the movement could not stand its own
hook down. See `docs/evidence/host-tools-2026-10-18/`.

**Before a movement on a host whose copies are older than the tip, refresh them from the tip first:**

```
bash -c 'cd /home/team/shared/probable-octo-sniffle && git fetch origin main && T=$(mktemp -t install-host-tools.XXXXXX.sh) && git show FETCH_HEAD:scripts/install-host-tools.sh > "$T" && ANTUM_REPO=/home/team/shared/probable-octo-sniffle bash "$T" --commit FETCH_HEAD'
```

That shape is deliberate: it reads the blobs out of the fetched commit, so it never resets the deployed
tree — a reset without a build would leave the tree's server code newer than the bundle it serves.

`scripts/install-host-tools-test.sh` proves all of it off the host (78 checks: bodies, provenance,
idempotence, the red direction of `--verify`, the refusal of a file that does not parse, the
hook/deploy pairing exercised both ways, that the observer is wired where the movement will look for
it, and that the live copies are untouched by the test itself).

**The count is asserted, not remembered:** the suite compares its own printed total against
this sentence and reddens on a drift, so a stale number fails a run instead of reaching a
reader. The pre-pairing subtotal was 54 — history, not this claim.

## The observer (decision 5 (a))

**What it is.** `scripts/observe-serve-pair.sh` (installed as an operator copy at
`/home/team/shared/observe-serve-pair.sh`) asks the only question that matters when this product disappears:
*is the public URL serving OUR build?* One run asserts three things, positively — `GET /` returns 200; the
served HTML names every asset the served tree's build emitted; and the bytes fetched off the URL hash to that
artifact's md5. The expected names, byte counts and md5s are **derived at run time from `<tree>/client/dist/`**:
with no derivable artifact it exits 3 and compares nothing, rather than comparing against a remembered number.
A pinned literal can be supplied (`ANTUM_OBSERVE_EXPECT_ASSET` / `_MD5`) and a disagreement with the artifact
FAILS, naming both — a literal that cannot redden is a number nobody checks.

```
bash /home/team/shared/observe-serve-pair.sh              # one run: 0 the pair holds · 1 it does not · 3 refused
bash /home/team/shared/observe-serve-pair.sh --loop 600   # every 10 min; ONE loop per host, lock holds its pid
bash /home/team/shared/observe-serve-pair.sh --status     # last run, its age, whether a loop is armed, the alert
```

**Who runs it, and when — no scheduler exists here and none is invented.** Measured on this host 2026-10-19:
PID 1 is `/bin/sh`, there is no systemd bus to talk to, no `crontab` binary, and `/etc/cron.d` is executed by
nothing (the note under "Maintenance & Stability" above says the same). So the observer runs (1) at every
movement, as step 6 above, where the hand-done URL fetch used to be; (2) when an operator arms `--loop`; and
(3) whenever a person runs it.

**Blind spot, stated rather than implied.** The loop is a process on the host it observes. A replacement does
not wipe `/home`, but it kills every process, and it takes `/etc` — the login-shell hook that could re-arm
anything is exactly what a replacement removes. **A replacement therefore kills the observer, and nothing
notices its death.** What exists instead is the next run's own liveness line: every run prints the age of the
previous recorded run, `--status` prints it on demand, and a gap longer than twice the interval is called a
gap in the output. Somebody has to look; nothing pushes a message to a person.

**The record** — this is what ends the plan's "no artifact timestamps the first answer". Each run appends one
dated JSON line to `/home/team/shared/observer/runs.jsonl` (overridable), timestamped by the check itself and
keeping the most recent 2000 runs. On a failure it writes `/home/team/shared/observer/PAIR-BROKEN.txt`, which
keeps the FIRST failure time so a window can be measured; when the pair holds again that file is moved aside
(never deleted) as `PAIR-BROKEN-resolved-<stamp>.txt`, with the window in `restored.log` — bounded by the
recorded runs, and said to be bounded rather than exact.

**Read-only against the product**: it queries the URL and writes only its own record directory. No restart, no
marker, no guard interaction, nothing under the deployed tree's `client/` or `server/`. Its own suite,
`scripts/observe-serve-pair-test.sh`, prints its own total (**77 passed, 0 failed at the tip that added its
cleanup check**; 79 with the opt-in live case) and reddens on a fixture that answers 200 with a placeholder
body, on one serving different bytes, and on the refusal path; it also reddens if its own fixture servers stop
being killed (section `(k)` — it leaked four per run once), and states the measured process delta, not only
that files were untouched. The run against the live URL is recorded in `docs/evidence/observer-2026-10-19/`.

## Secrets Rotation Procedure
### 1. JWT Secret Rotation
- Update `JWT_SECRET` in the environment.
- Restart the server. (Note: This invalidates all active sessions).

### 2. PII Encryption Key Rotation
- Set `ENCRYPTION_KEY` to the new value in the environment.
- Use a migration script to decrypt existing records with the old key and re-encrypt with the new key.
- Restart the server.

### 3. Demo Admin Password
- Set `DEMO_ADMIN_PASSWORD_HASH` and re-run `scripts/seed-demo.js`.
