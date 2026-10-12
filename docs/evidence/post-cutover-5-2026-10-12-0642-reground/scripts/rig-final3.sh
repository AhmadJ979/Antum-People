#!/usr/bin/env bash
# Post-cutover re-grounding #3 (row 2740fb30): the SERVED tree, run against a COPY OF THE LIVE DB,
# so the figures are the live demo state read on a rig (rule 26 — credentialed passes stay off :3000).
set -u
export HOME=/home/agent-product-designer
SRC=$HOME/reground
TREE=$HOME/rig-final3
OUT=$HOME/rig-final3-out
PORT=4744
LIVE_DB=/home/team/.data/antum-product.db
mkdir -p "$OUT/raw"
cd "$SRC" || exit 1
git fetch -q origin --prune

echo "=== tree under test vs deployed: 9d2182a  ==  origin/main $(git rev-parse --short origin/main)" | tee "$OUT/run.txt"
if [ -d "$TREE" ]; then git worktree remove --force "$TREE" 2>/dev/null; fi
git worktree add --detach "$TREE" 9d2182a >>"$OUT/run.txt" 2>&1
ln -sfn "$SRC/../antum-work/server/node_modules" "$TREE/server/node_modules" 2>/dev/null || ln -sfn "$HOME/antum-work/server/node_modules" "$TREE/server/node_modules"
ln -sfn "$HOME/antum-work/client/node_modules" "$TREE/client/node_modules"

echo "=== build the served tree (both halves, exit codes)" | tee -a "$OUT/run.txt"
( cd "$TREE/client" && npx tsc -b --force ) > "$OUT/build.txt" 2>&1; echo "tsc -b exit: $?" | tee -a "$OUT/run.txt"
( cd "$TREE/client" && npx vite build ) >> "$OUT/build.txt" 2>&1; echo "vite exit: $?" | tee -a "$OUT/run.txt"
tail -3 "$OUT/build.txt" | tee -a "$OUT/run.txt"
for f in "$TREE"/client/dist/assets/*.js; do
  echo "built asset : $(basename "$f") $(stat -c%s "$f") bytes md5 $(md5sum "$f" | cut -d' ' -f1)" | tee -a "$OUT/run.txt"
done
{
  echo "live asset  : $(curl -s http://localhost:3000/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1) 274065 bytes md5 9cdfbe5da81f6acf38fdb10de8a5e6fd"
  echo "live page 3000 before: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
} | tee -a "$OUT/run.txt"

# free the port only if a previous rig of mine holds it
for p in $(lsof -t -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null); do
  cwd=$(readlink /proc/$p/cwd); case "$cwd" in "$TREE/server"*) kill $p; sleep 2;; *) echo "REFUSING to kill $p ($cwd)"; exit 1;; esac
done

echo "=== the live DB copy (the live demo state, read on a rig)" | tee -a "$OUT/run.txt"
LIVE_MD5=$(md5sum "$LIVE_DB" | cut -d' ' -f1)
cp "$LIVE_DB" "$OUT/live-copy.sqlite"
echo "live db      : $LIVE_DB $LIVE_MD5 $(stat -c%s "$LIVE_DB") bytes mtime $(stat -c%y "$LIVE_DB")" | tee -a "$OUT/run.txt"
echo "rig db copy  : md5 $(md5sum "$OUT/live-copy.sqlite" | cut -d' ' -f1)  (equal to the live db: $([ "$(md5sum "$OUT/live-copy.sqlite" | cut -d' ' -f1)" = "$LIVE_MD5" ] && echo YES || echo NO))" | tee -a "$OUT/run.txt"

export PRODUCT_DB_PATH="$OUT/live-copy.sqlite"
export JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
export ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64 | tr -d '\n' | cut -c1-32)
PASS=$(head -c 24 /dev/urandom | base64 | tr -d '\n/+=' | cut -c1-16); printf '%s' "$PASS" > "$OUT/pass.txt"
cd "$TREE/server" || exit 1
SCRATCH_PASS="$PASS" PRODUCT_DB_PATH="$PRODUCT_DB_PATH" node "$HOME/rig-cutover-user.cjs" > "$OUT/user.txt" 2>&1
tail -1 "$OUT/user.txt" | tee -a "$OUT/run.txt"
PORT=$PORT PRODUCT_DB_PATH="$PRODUCT_DB_PATH" JWT_SECRET="$JWT_SECRET" ENCRYPTION_KEY="$ENCRYPTION_KEY" nohup node index.js > "$OUT/server.log" 2>&1 &
sleep 5
{
  echo "listeners $PORT : $(lsof -t -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null | wc -l)  cwd $(for p in $(lsof -t -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null); do readlink /proc/$p/cwd; done)"
  echo "GET / rig            : $(curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT/)"
  echo "rig serves asset     : $(curl -s http://localhost:$PORT/ | grep -o 'assets/[A-Za-z0-9._-]*\.js' | head -1)"
  echo "no token /api/employees: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT/api/employees)"
} | tee -a "$OUT/run.txt"

SCRATCH_PASS="$PASS" PORT=$PORT OUT="$OUT" node "$HOME/rig-final3-facts.cjs" 2>&1 | tee "$OUT/facts.txt"
echo "=== live page 3000 after : $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)  (must be 200; this rig never addresses it)" | tee -a "$OUT/run.txt"
echo "=== done $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$OUT/run.txt"
