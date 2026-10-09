#!/usr/bin/env bash
# Pre-cutover gate rig v2 — idempotent, self-verifying.
# Fixes what v1 got wrong: it could run twice; the second run unlinked db.sqlite out from
# under the first server (which kept serving the deleted inode) and died on EADDRINUSE,
# leaving server.log describing a process that was not the one holding the port.
set -u
export HOME=/home/agent-product-designer
TREE=/home/agent-product-designer/rig-cutover
OUT=/home/agent-product-designer/rig-cutover-out
PASSFILE=$OUT/scratch-pass.txt
mkdir -p "$OUT"
PORT=4741
export PRODUCT_DB_PATH="$OUT/db.sqlite"

echo "== rig v2 start $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 1. Clear the port, but only a process that is demonstrably MINE.
for p in $(lsof -t -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null); do
  cwd=$(readlink /proc/$p/cwd)
  case "$cwd" in
    "$TREE/server"*) echo "   killing stale rig server pid $p (cwd $cwd)"; kill "$p"; sleep 2 ;;
    *) echo "   REFUSING to kill pid $p on $PORT: cwd is $cwd"; exit 1 ;;
  esac
done
echo "   listeners on $PORT after cleanup: $(lsof -t -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null | wc -l)"

# 2. Fresh database, fresh credential.
rm -f "$OUT/db.sqlite"
export JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
export ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64 | tr -d '\n' | cut -c1-32)
PASS=$(head -c 24 /dev/urandom | base64 | tr -d '\n/+=' | cut -c1-16)
printf '%s' "$PASS" > "$PASSFILE"

cd "$TREE" || exit 1
{
  echo "### seed: DEMO_SEED=true PRODUCT_DB_PATH=$PRODUCT_DB_PATH node scripts/seed-demo.js   (cwd=$TREE)"
  DEMO_SEED=true PRODUCT_DB_PATH="$PRODUCT_DB_PATH" node scripts/seed-demo.js
  echo "### seed exit code: $?"
} > "$OUT/seed2.txt" 2>&1
echo "   seed exit: $(tail -2 $OUT/seed2.txt | head -1)"

cd "$TREE/server" || exit 1
SCRATCH_PASS="$PASS" PRODUCT_DB_PATH="$PRODUCT_DB_PATH" node /home/agent-product-designer/rig-cutover-user.cjs > "$OUT/user2.txt" 2>&1
echo "   user insert: $(tail -1 $OUT/user2.txt)"

# 3. One server, and prove it is the one that owns the current database file.
PORT=$PORT PRODUCT_DB_PATH="$PRODUCT_DB_PATH" JWT_SECRET="$JWT_SECRET" ENCRYPTION_KEY="$ENCRYPTION_KEY" \
  nohup node index.js > "$OUT/server2.log" 2>&1 &
sleep 5

N=$(lsof -t -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null | wc -l)
echo "   listeners on $PORT: $N (must be 1)"
for p in $(lsof -t -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null); do
  echo "   pid $p cwd=$(readlink /proc/$p/cwd)"
  ls -l /proc/$p/fd 2>/dev/null | grep -i "sqlite" | sed 's/^/     /'
done
echo "   server2.log last line: $(tail -1 $OUT/server2.log)"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -d "{\"username\":\"scratch-admin\",\"password\":\"$(cat $PASSFILE)\"}" "http://localhost:$PORT/api/login")
echo "   login with the pass file: HTTP $CODE (must be 200)"
ANON=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/employees")
echo "   /api/employees with no token: HTTP $ANON (must be 401)"
LIVE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)
echo "   LIVE :3000: HTTP $LIVE (must be 200, untouched)"
SERVED=$(curl -s "http://localhost:$PORT/" | grep -o 'assets/[A-Za-z0-9._-]*\.js' | head -1)
curl -s "http://localhost:$PORT/$SERVED" -o "$OUT/served-bundle2.js"
echo "   rig serves: $SERVED  $(stat -c%s $OUT/served-bundle2.js) bytes  $(md5sum $OUT/served-bundle2.js | cut -d' ' -f1)"

if [ "$N" != "1" ] || [ "$CODE" != "200" ] || [ "$ANON" != "401" ]; then
  echo "== RIG NOT USABLE — aborting before any evidence is written (rule 19)"; exit 1
fi
echo "== rig v2 ready $(date -u +%Y-%m-%dT%H:%M:%SZ)"
