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
