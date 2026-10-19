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
The site is kept alive by a monitoring loop that restarts the server if port 3000 is empty.
- **Keep-Alive Script**: `scripts/keep-alive.sh`.
- **Log**: `server/keep-alive.log`.
- **Arming**: `nohup ./scripts/keep-alive.sh &`

**NOTE**: This host does not support systemd or crontab for non-root users. The loop must be manually re-armed after a host restart.

## Verification
1. **CLI**: `curl -s --noproxy '*' http://127.0.0.1:3000 | grep "Antum People"`
2. **Logs**: Check `server/server.log` for startup success.

## Cutover Procedure (to isolated DB)
1. Ensure the new code is deployed to the production directory.
2. Stop any running server and existing keep-alive processes (`pkill -f keep-alive.sh`).
3. Set the `PRODUCT_DB_PATH` in the environment.
4. Run the seed: `DEMO_SEED=true node scripts/seed-demo.js`.
5. Start the loop: `nohup ./scripts/keep-alive.sh &`.

### Rollback
1. Stop the loop and server.
2. Check out the previous commit in the production directory.
3. Restart server.

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
`success-test.sh` and the login-shell hook — **atomically** (a temporary file is renamed over the target, so
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

`scripts/install-host-tools-test.sh` proves all of it off the host (71 checks: bodies, provenance,
idempotence, the red direction of `--verify`, the refusal of a file that does not parse, and that the live
copies are untouched by the test itself).

**The count is asserted, not remembered:** the suite compares its own printed total against
this sentence and reddens on a drift, so a stale number fails a run instead of reaching a
reader. The pre-pairing subtotal was 54 — history, not this claim.

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
