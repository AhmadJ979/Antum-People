#!/usr/bin/env bash
# Second scratch instance: the UNFIXED tree (origin/main), same screen, so the fix has a
# rendered before/after pair taken the same way.
set -u
export HOME=/home/agent-senior-software-engineer
RIG=$HOME/rig-scope-before
RIGDATA=$HOME/rig
PORT=4718
BEFORE_TIP=$(git -C "$HOME/antum-people" rev-parse --short origin/main)

mkdir -p "$RIGDATA"
cd "$HOME/antum-people"
git worktree remove --force "$RIG" 2>/dev/null
git worktree add --detach "$RIG" origin/main 2>&1 | tail -1
ln -sfn "$HOME/antum-people/server/node_modules" "$RIG/server/node_modules"
ln -sfn "$HOME/antum-people/client/node_modules" "$RIG/client/node_modules"
echo "=== before tree: origin/main at $BEFORE_TIP"
echo "=== the paragraph as it stands on main (client/src/App.tsx:1722-1726):"
sed -n '1722,1726p' "$RIG/client/src/App.tsx"

echo "=== build client:"
( cd "$RIG/client" && npm run build ) 2>&1 | tail -3

export JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
export ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64 | tr -d '\n' | cut -c1-32)

echo "=== seed + scratch user:"
( cd "$RIG" && DEMO_SEED=true PRODUCT_DB_PATH="$RIGDATA/before.db" node scripts/seed-demo.js ) 2>&1 | tail -2
SCRATCH_PASS=scope-before-$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')
printf '%s' "$SCRATCH_PASS" > "$RIGDATA/scratch-pass-before.txt"
( cd "$RIG/server" && PRODUCT_DB_PATH="$RIGDATA/before.db" SCRATCH_PASS="$SCRATCH_PASS" node -e '
const db=require("./db"), bcrypt=require("bcryptjs");
const h=bcrypt.hashSync(process.env.SCRATCH_PASS,12);
db.query("INSERT OR REPLACE INTO users (id,username,password_hash,role,created_at) VALUES ("+db.escapeString("scratch-admin")+","+db.escapeString("scratch")+","+db.escapeString(h)+","+db.escapeString("admin")+","+db.escapeString("2026-10-02 00:00:00")+")").then(()=>console.log("scratch user ok"))' )

curl -s -o /dev/null -w "live port3000=%{http_code}\n" http://localhost:3000/

echo "=== start before-instance on $PORT:"
cd "$RIG/server" && PORT=$PORT PRODUCT_DB_PATH="$RIGDATA/before.db" nohup node index.js > "$RIGDATA/before.log" 2>&1 &
sleep 3
for p in $(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t); do echo "  pid $p cwd: $(readlink /proc/$p/cwd)"; done
TOKEN=$(curl -s -X POST http://localhost:$PORT/api/login -H 'Content-Type: application/json' \
  -d "{\"username\":\"scratch\",\"password\":\"$SCRATCH_PASS\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token","NO_TOKEN"))')
printf '%s' "$TOKEN" > "$RIGDATA/token-before.txt"
echo "token length: ${#TOKEN}"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:$PORT/api/preboarding/checklist/overview?jurisdiction=AE" > "$RIGDATA/overview-ae-before.json"
echo "before setup done"
