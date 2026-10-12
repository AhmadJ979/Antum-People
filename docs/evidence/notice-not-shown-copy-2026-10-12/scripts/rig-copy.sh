#!/usr/bin/env bash
# Rig for the [Demo] acknowledgement-copy row (7cfe0ac3): a scratch instance of the MERGED tree
# carrying the designer's copy change, so the roll-up tile can be read from a rendered page.
set -uo pipefail
export HOME=/home/agent-product-designer
SRC=$HOME/reground
RIG=$HOME/rig-copy
EV=$HOME/rig-evidence
PORT=4716
BR=copy/notice-not-shown-2026-10-13
mkdir -p "$EV"

echo "=== live deployment before (must be 200): $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
echo "=== base: origin/main = $(git -C $SRC rev-parse --short origin/main)   branch tip = $(git -C $SRC rev-parse --short $BR)"

echo "=== merge-tree check (branch vs current origin/main):"
git -C $SRC merge-tree --write-tree origin/main "$BR" | head -2

rm -rf "$RIG"
git -C $SRC worktree prune
git -C $SRC worktree add --detach "$RIG" origin/main >/dev/null 2>&1 || { echo "worktree add FAILED"; exit 1; }
git -C $SRC diff "$(git -C $SRC merge-base origin/main $BR)" "$BR" > "$EV/branch.diff"
git -C "$RIG" apply "$EV/branch.diff" || { echo "apply FAILED"; exit 1; }

echo "=== rig tree vs branch, blob hashes (equal means the rig IS the merge result):"
for f in client/src/App.tsx demo-walkthrough-script.md demo-weak-screens.md design-concepts/LAYER2-P2-2-IMPLEMENTATION-NOTES.md pdpl-acknowledgement-route-spec.md pdpl-lawful-basis-mapping.md; do
  a=$(git -C "$RIG" hash-object "$f"); b=$(git -C $SRC rev-parse "$BR:$f")
  if [ "$a" = "$b" ]; then echo "  equal   $f"; else echo "  DIFFER  $f  rig=$a branch=$b"; fi
done

ln -sfn $HOME/rig-served/server/node_modules "$RIG/server/node_modules"
ln -sfn $HOME/rig-served/client/node_modules "$RIG/client/node_modules"

echo "=== build (both halves, with exit codes):"
( cd "$RIG/client" && npx tsc -b --force ) > "$EV/tsc.log" 2>&1; echo "  tsc -b exit code: $?"
( cd "$RIG/client" && npx vite build ) > "$EV/vite.log" 2>&1; echo "  vite build exit code: $?"
tail -4 "$EV/vite.log"

echo "=== built bundle: the new label in, the retired wording out:"
for f in "$RIG"/client/dist/assets/*.js; do
  echo "  $(basename $f) $(stat -c%s $f) bytes"
  echo "     'Cases · notice not shown' occurrences: $(grep -c 'Cases · notice not shown' "$f")"
  echo "     old label 'Notice not shown' (bare)     : $(grep -o '>Notice not shown<' "$f" | wc -l)"
  echo "     'WITHOUT CONSENT' occurrences          : $(grep -c 'WITHOUT CONSENT' "$f")"
done

echo "=== seed a scratch DB (DEMO_SEED) + a throwaway admin:"
export JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
export ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64 | tr -d '\n' | cut -c1-32)
DB=$EV/copy.db; rm -f "$DB"
( cd "$RIG" && DEMO_SEED=true PRODUCT_DB_PATH="$DB" node scripts/seed-demo.js ) > "$EV/seed.log" 2>&1
echo "  seed exit code: $?  ($(wc -l < $EV/seed.log) lines)"
SCPASS=$(head -c 12 /dev/urandom | base64 | tr -d '\n/+=' | cut -c1-12); echo "$SCPASS" > "$EV/scratch-pass.txt"
( cd "$RIG/server" && PRODUCT_DB_PATH="$DB" SCRATCH_PASS="$SCPASS" node -e '
   const db=require("./db"), bcrypt=require("bcryptjs");
   const h=bcrypt.hashSync(process.env.SCRATCH_PASS,12);
   db.query("INSERT OR REPLACE INTO users (id,username,password_hash,role,created_at) VALUES ("+db.escapeString("scratch-admin")+","+db.escapeString("scratch")+","+db.escapeString(h)+","+db.escapeString("admin")+","+db.escapeString("2026-10-13 00:00:00")+")").then(()=>console.log("user ok"))' ) 2>&1 | tail -2

echo "=== boot the scratch server on $PORT:"
( cd "$RIG/server" && PORT=$PORT PRODUCT_DB_PATH="$DB" JWT_SECRET="$JWT_SECRET" ENCRYPTION_KEY="$ENCRYPTION_KEY" nohup node index.js > "$EV/server.log" 2>&1 & )
sleep 4
for i in 1 2 3 4 5; do
  p=$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null | head -1)
  [ -n "$p" ] && break; sleep 2
done
echo "  listener pid: ${p:-none}  cwd: $( [ -n "${p:-}" ] && readlink /proc/$p/cwd )"
echo "  health contract (/api/employees without a token, want 401): $(curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT/api/employees)"
echo "  page (want 200): $(curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT/)"
echo "  served asset: $(curl -s http://localhost:$PORT/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)"
echo "=== live deployment after (must still be 200): $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
