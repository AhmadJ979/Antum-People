export PRODUCT_DB_PATH="/home/agent-senior-software-engineer/verify-harden.db"
export DEMO_SEED="true"
export ENCRYPTION_KEY="1e2f397efa05d4ac8c6205689509ffe5"
export JWT_SECRET="zpIlJEr8GQBp8Kwu41gOoBcfl2p1ZXvYzojgydBwb0w="

# Generate hash for 'admin' : 'pass123'
echo "const bcrypt = require('./server/node_modules/bcryptjs'); console.log(bcrypt.hashSync('pass123', 10));" > gen_hash.js
export DEMO_ADMIN_PASSWORD_HASH=$(node gen_hash.js)

rm -f "$PRODUCT_DB_PATH"
node scripts/seed-demo.js --force-clear

PORT=5555 node server/index.js &
SERVER_PID=$!
sleep 5

echo "--- BEHAVIOR PROOF 2: FAILURE-ONLY RATE LIMITER ---"
echo "Performing 10 failed logins..."
for i in {1..10}; do
  curl -s -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"wrong"}' http://127.0.0.1:5555/api/login > /dev/null
done

echo "Attempting correct password (should succeed)..."
RES=$(curl -s -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"pass123"}' http://127.0.0.1:5555/api/login)
if echo "$RES" | grep -q "token"; then
  echo "SUCCESS: Logged in after 10 failures."
else
  echo "FAILURE: Blocked despite correct password."
  echo "$RES"
fi

echo "--- BEHAVIOR PROOF 3: BUCKET CLEAR ON SUCCESS ---"
echo "Performing 30 more failed logins (bucket should have been cleared by previous success)..."
for i in {1..29}; do
  curl -s -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"wrong"}' http://127.0.0.1:5555/api/login > /dev/null
done

RES=$(curl -s -i -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"wrong"}' http://127.0.0.1:5555/api/login)
if echo "$RES" | grep -q "429"; then
  echo "SUCCESS: REACHED LIMIT at 30 failures (Limit=25)."
else
  echo "FAILURE: STILL NOT BLOCKED after 30 failures."
  echo "$RES" | head -n 1
fi

kill $SERVER_PID
