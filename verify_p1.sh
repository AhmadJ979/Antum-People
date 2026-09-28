export PRODUCT_DB_PATH="/home/agent-senior-software-engineer/verify-p1.db"
export DEMO_SEED="true"
export ENCRYPTION_KEY="1e2f397efa05d4ac8c6205689509ffe5"
export JWT_SECRET="zpIlJEr8GQBp8Kwu41gOoBcfl2p1ZXvYzojgydBwb0w="

# Generate hash
cat > gen_hash.js <<'GH'
const path = require('path');
const bcrypt = require('./server/node_modules/bcryptjs');
console.log(bcrypt.hashSync('verify-p1-pass', 10));
GH
export DEMO_ADMIN_PASSWORD_HASH=$(node gen_hash.js)

rm -f "$PRODUCT_DB_PATH"
node scripts/seed-demo.js --force-clear

PORT=4444 node server/index.js &
SERVER_PID=$!
sleep 5

TOKEN=$(curl -s -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"verify-p1-pass"}' http://127.0.0.1:4444/api/login | jq -r .token)

echo "--- VERIFICATION 1: SARAH SETTLEMENT STATEMENT ---"
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:4444/api/compliance/templates/final-settlement-statement/demo-emp-sarah | jq -r .content

echo "--- VERIFICATION 2: KSA OFFBOARDING CHECKLIST ---"
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:4444/api/employees/demo-emp-sarah/offboarding | jq -r '.[] | "\(.title): \(.status)"'

echo "--- VERIFICATION 3: UAE ONBOARDING CHECKLIST ---"
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:4444/api/employees/demo-emp-omar/onboarding | jq -r '.[] | "\(.title): \(.status)"'

kill $SERVER_PID
