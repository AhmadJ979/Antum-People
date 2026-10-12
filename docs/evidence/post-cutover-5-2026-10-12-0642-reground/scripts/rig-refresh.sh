#!/usr/bin/env bash
# Refresh the rig back to the LIVE demo state: stop my rig's server, re-copy the live DB, re-insert a
# scratch user, restart. Used before probes and before the rendered pass, so both see tile=1.
set -u
export HOME=/home/agent-product-designer
TREE=$HOME/rig-final3
OUT=$HOME/rig-final3-out
PORT=${PORT:-4744}
LIVE_DB=/home/team/.data/antum-product.db
for p in $(lsof -t -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null); do
  cwd=$(readlink /proc/$p/cwd); case "$cwd" in "$TREE/server"*) kill $p; sleep 2;; *) echo "REFUSING to kill $p ($cwd)"; exit 1;; esac
done
cp "$LIVE_DB" "$OUT/live-copy.sqlite"
echo "refreshed from live db md5 $(md5sum "$OUT/live-copy.sqlite" | cut -d' ' -f1) (live $(md5sum "$LIVE_DB" | cut -d' ' -f1))"
export PRODUCT_DB_PATH="$OUT/live-copy.sqlite"
export JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
export ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64 | tr -d '\n' | cut -c1-32)
PASS=$(head -c 24 /dev/urandom | base64 | tr -d '\n/+=' | cut -c1-16); printf '%s' "$PASS" > "$OUT/pass.txt"
cd "$TREE/server" || exit 1
SCRATCH_PASS="$PASS" PRODUCT_DB_PATH="$PRODUCT_DB_PATH" node "$HOME/rig-cutover-user.cjs" > "$OUT/user.txt" 2>&1
tail -1 "$OUT/user.txt"
PORT=$PORT PRODUCT_DB_PATH="$PRODUCT_DB_PATH" JWT_SECRET="$JWT_SECRET" ENCRYPTION_KEY="$ENCRYPTION_KEY" nohup node index.js >> "$OUT/server.log" 2>&1 &
sleep 5
echo "listeners $PORT: $(lsof -t -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null | wc -l) cwd $(for p in $(lsof -t -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null); do readlink /proc/$p/cwd; done)"
echo "GET / : $(curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT/)  asset $(curl -s http://localhost:$PORT/ | grep -o 'assets/[A-Za-z0-9._-]*\.js' | head -1)"
echo "live :3000 : $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
