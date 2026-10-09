#!/usr/bin/env bash
# Scratch rig for the P2-4 scope_note fix: one instance, built from the branch tip,
# which I first verify IS the merge result of origin/main + the branch.
set -u
export HOME=/home/agent-senior-software-engineer
RIG=$HOME/rig-scope-note
RIGDATA=$HOME/rig
TREE_TIP=cd5f896
MERGE_TREE=ead2fb6e93b81b6823f0854dd46c81270f3dd19f
PORT=4717

mkdir -p "$RIGDATA"
cd "$HOME/antum-people"
git worktree remove --force "$RIG" 2>/dev/null
git worktree add --detach "$RIG" "$TREE_TIP" 2>&1 | tail -2
ln -sfn "$HOME/antum-people/server/node_modules" "$RIG/server/node_modules"
ln -sfn "$HOME/antum-people/client/node_modules" "$RIG/client/node_modules"

echo "=== is the rig tree the merge result?"
echo "rig App.tsx blob : $(git -C "$RIG" hash-object client/src/App.tsx)"
echo "branch blob      : $(git rev-parse $TREE_TIP:client/src/App.tsx)"
echo "merge-tree       : $MERGE_TREE  (git merge-tree origin/main fix/p2-4-scope-note-single-source)"
echo "rig tree hash    : $(git -C "$RIG" rev-parse HEAD^{tree})"
echo "=== fix present in the rig tree?"
sed -n '1722,1735p' "$RIG/client/src/App.tsx"

echo "=== build client (fresh worktree has no dist/):"
( cd "$RIG/client" && npm run build ) 2>&1 | tail -6

export JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
export ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64 | tr -d '\n' | cut -c1-32)

echo "=== seed demo data:"
( cd "$RIG" && DEMO_SEED=true PRODUCT_DB_PATH="$RIGDATA/scope.db" node scripts/seed-demo.js ) 2>&1 | tail -4

echo "=== scratch user:"
SCRATCH_PASS=scope-rig-$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')
printf '%s' "$SCRATCH_PASS" > "$RIGDATA/scratch-pass.txt"
( cd "$RIG/server" && PRODUCT_DB_PATH="$RIGDATA/scope.db" SCRATCH_PASS="$SCRATCH_PASS" node -e '
const db=require("./db"), bcrypt=require("bcryptjs");
const h=bcrypt.hashSync(process.env.SCRATCH_PASS,12);
db.query("INSERT OR REPLACE INTO users (id,username,password_hash,role,created_at) VALUES ("+db.escapeString("scratch-admin")+","+db.escapeString("scratch")+","+db.escapeString(h)+","+db.escapeString("admin")+","+db.escapeString("2026-10-02 00:00:00")+")").then(()=>console.log("scratch user ok"))' )

echo "=== live deployment before (must stay 200):"
curl -s -o /dev/null -w "port3000=%{http_code}\n" http://localhost:3000/

echo "=== start scratch instance on $PORT:"
cd "$RIG/server" && PORT=$PORT PRODUCT_DB_PATH="$RIGDATA/scope.db" nohup node index.js > "$RIGDATA/scope.log" 2>&1 &
sleep 3
echo "listeners on $PORT: $(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t | wc -l)"
for p in $(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t); do echo "  pid $p cwd: $(readlink /proc/$p/cwd)"; done

echo "=== health contract:"
curl -s -o /dev/null -w "no-token /api/employees = %{http_code}\n" http://localhost:$PORT/api/employees
curl -s -o /dev/null -w "root = %{http_code}\n" http://localhost:$PORT/
TOKEN=$(curl -s -X POST http://localhost:$PORT/api/login -H 'Content-Type: application/json' \
  -d "{\"username\":\"scratch\",\"password\":\"$SCRATCH_PASS\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token","NO_TOKEN"))')
echo "token length: ${#TOKEN}"
printf '%s' "$TOKEN" > "$RIGDATA/token.txt"
curl -s -o /dev/null -w "authed /api/employees = %{http_code}\n" -H "Authorization: Bearer $TOKEN" http://localhost:$PORT/api/employees

echo "=== the payload's scope_note, from the instance the browser will read:"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:$PORT/api/preboarding/checklist-overview?jurisdiction=AE" \
  > "$RIGDATA/overview-ae.json"
python3 - "$RIGDATA/overview-ae.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
print("cases:", len(d["cases"]))
for c in d["cases"]:
    print(" ", c["offer_reference"], "| flag.state", c["flag"]["state"], "| open_count", c["flag"]["open_count"])
print("scope_note (payload, case 1):")
print(repr(d["cases"][0]["flag"]["scope_note"]))
PY
echo "=== rig setup done"
