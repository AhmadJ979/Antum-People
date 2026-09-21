# Deployment Documentation - Antum People

## Overview
The platform is a Node.js backend serving a React frontend (Vite). The production environment is a 4GB RAM server without swap.

## Environment Variables
The server requires these variables to be set in the environment:
- `ENCRYPTION_KEY`: 32-character hex key for AES-256-GCM (PII encryption).
- `JWT_SECRET`: Secret for signing JSON Web Tokens.
- `PORT`: Default is 3000.

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
   # Start detached
   setsid nohup node index.js > server/server.log 2>&1 &
   ```

## Maintenance & Stability
The site is kept alive by a monitoring loop that restarts the server if port 3000 is empty.
- **Keep-Alive Script**: `scripts/keep-alive.sh`.
- **Log**: `server/keep-alive.log`.

## Verification
1. **CLI**: `curl -s https://b974147c03228029e277d1cbe6646fe6.ctonew.app | grep "Antum People"`
2. **Logs**: Check `server/server.log` for startup success.

## Secrets Rotation Procedure
### 1. JWT Secret Rotation
- Update `JWT_SECRET` in the environment.
- Restart the server. (Note: This invalidates all active sessions).

### 2. PII Encryption Key Rotation
- Set `ENCRYPTION_KEY` to the new value in the environment.
- Use a migration script (not stored in the repository) to decrypt existing records with the old key and re-encrypt with the new key.
- Restart the server.
- Verify data via the Employees dashboard.

### 3. Demo Admin Password
- Handled exclusively via the `users` table. Do not store in code or scripts.

## After a Machine Restart
The platform is configured to self-heal after a machine restart using a systemd user unit that re-arms the keep-alive loop.

### Automatic Recovery
A systemd service (`antum-keep-alive.service`) is installed for the `agent-senior-software-engineer` user. With lingering enabled (`loginctl enable-linger`), this service starts automatically on boot.
- It verifies if port 3000 is occupied by the Antum People server.
- It checks for the existence of the frontend bundle (`client/dist/index.html`) and rebuilds it if missing.
- It starts the Node.js backend if no instances are already running.

### Manual Verification/Recovery
If the automatic recovery fails, follow these steps:
1. Check if a foreign process is holding port 3000:
   ```bash
   sudo lsof -i :3000
   ```
   If a non-Antum process (like the platform's "My site" placeholder) is listening, kill it to free the port:
   ```bash
   sudo kill -9 <PID>
   ```
2. Verify the systemd service status:
   ```bash
   systemctl --user status antum-keep-alive.service
   ```
3. Manually trigger the keep-alive script if needed:
   ```bash
   /home/team/shared/probable-octo-sniffle/scripts/keep-alive.sh
   ```
