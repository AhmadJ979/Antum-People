#!/usr/bin/env bash
set -u
HOME=/home/agent-senior-software-engineer
export HOME
DEP=/home/team/shared/probable-octo-sniffle
RIG=/tmp/rig-term
OUT=/tmp/rig-term-out.txt
: > "$OUT"
say() { echo "$@" | tee -a "$OUT"; }

say "=== the permission cells this question turns on (read at the rig's tree) ==="
cd "$DEP"
grep -n "'exit:write'\|'employees:write'" server/access.js | tee -a "$OUT"

TIP=$(git rev-parse HEAD)
say "rig tree: $TIP (the deployed tree)"
rm -rf "$RIG" "$RIG.db" "$RIG.db-journal"
mkdir -p "$RIG"
git worktree add -q --detach "$RIG" "$TIP" || { say "worktree failed"; exit 1; }
ln -sfn "$DEP/server/node_modules" "$RIG/server/node_modules"
ln -sfn "$DEP/client/node_modules" "$RIG/client/node_modules" 2>/dev/null || true

export JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
export ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64 | tr -d '\n' | cut -c1-32)
export PRODUCT_DB_PATH=/tmp/rig-term-db.sqlite
PASS="scratch-$(head -c 8 /dev/urandom | base64 | tr -d '/+=' | head -c 10)!"

say "=== seed ==="
cd "$RIG" && DEMO_SEED=true PRODUCT_DB_PATH="$PRODUCT_DB_PATH" node scripts/seed-demo.js >> "$OUT" 2>&1
say "seed exit=$?  db bytes=$(stat -c%s "$PRODUCT_DB_PATH" 2>/dev/null)"

say "=== two throwaway accounts: one hr_admin, one compliance_viewer ==="
# NOTE: the column is `access_role`, not `role` - the rename landed in schema.sql and the old
# column name makes the insert throw "table users has no column named role" (measured here).
cd "$RIG/server" && SCRATCH_PASS="$PASS" PRODUCT_DB_PATH="$PRODUCT_DB_PATH" node -e '
const db = require("./db"), bcrypt = require("bcryptjs");
const h = bcrypt.hashSync(process.env.SCRATCH_PASS, 12);
const ins = (id, user, role) => db.query("INSERT OR REPLACE INTO users (id,username,password_hash,access_role,created_at) VALUES (" +
  db.escapeString(id) + "," + db.escapeString(user) + "," + db.escapeString(h) + "," + db.escapeString(role) + "," + db.escapeString("2026-10-26 00:00:00") + ")");
(async () => { await ins("scratch-hr", "scratch-hr", "hr_admin"); await ins("scratch-cv", "scratch-cv", "compliance_viewer"); console.log("ok"); })();
' >> "$OUT" 2>&1
say "accounts exit=$?"

say "=== boot on port 4719 (never 3000) ==="
cd "$RIG/server"
PORT=4719 PRODUCT_DB_PATH="$PRODUCT_DB_PATH" nohup node index.js > /tmp/rig-term.log 2>&1 &
sleep 4
PID=$(lsof -nP -iTCP:4719 -sTCP:LISTEN -t 2>/dev/null | head -1)
say "listener pid=$PID cwd=$(readlink /proc/${PID:-0}/cwd 2>/dev/null)"
say "no-token health probe: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:4719/api/employees)"
say "live product (must be 200): $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
echo "$PASS" > /tmp/rig-pass.txt

cat > /tmp/rig-probe.mjs <<'EOF'
const P = '4719', B = `http://localhost:4719`;
const pass = (await import('node:fs')).readFileSync('/tmp/rig-pass.txt', 'utf8').trim();
const j = async (m, p, body, tok) => {
  const r = await fetch(B + p, { method: m, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let parsed; try { parsed = JSON.parse(t); } catch { parsed = t.slice(0, 200); }
  return { status: r.status, body: parsed, bytes: t.length };
};
const login = async (u) => (await j('POST', '/api/login', { username: u, password: pass })).body.token;
const hr = await login('scratch-hr'), cv = await login('scratch-cv');
console.log('login hr_admin:', hr ? 'token' : 'NO TOKEN', '| compliance_viewer:', cv ? 'token' : 'NO TOKEN');

const roster = (await j('GET', '/api/employees', null, hr)).body;
const rows = Array.isArray(roster) ? roster : (roster.employees || []);
const active = rows.filter((e) => e.status === 'active');
const unflagged = active.filter((e) => !e.termination_type);
console.log(`roster ${rows.length}; active ${active.length}; active AND termination_type null ${unflagged.length}`);
const A = unflagged[0], Bx = unflagged[1];
console.log('candidate A (PUT target):', A && A.id, A && A.status, '| candidate B (exit-interview target):', Bx && Bx.id, Bx && Bx.status);

const flagOf = (e) => e.termination_type || e.status;
console.log('--- before, on a row the seeder did not flag ---');
console.log('A replacement-cost:', JSON.stringify(await j('GET', `/api/employees/${A.id}/replacement-cost`, null, hr)).slice(0, 240));

console.log('--- the write the row asks about: termination_type through PUT /api/employees/:id ---');
console.log('PUT A {termination_type:"resignation"} as hr_admin:', JSON.stringify(await j('PUT', `/api/employees/${A.id}`, { termination_type: 'resignation' }, hr)).slice(0, 200));
const afterA = await j('GET', `/api/employees/${A.id}/replacement-cost`, null, hr);
console.log('A replacement-cost after:', JSON.stringify(afterA).slice(0, 700));

console.log('--- the gate: the same write without the permission, and without a token ---');
console.log('PUT A as compliance_viewer:', JSON.stringify(await j('PUT', `/api/employees/${A.id}`, { termination_type: 'dismissal' }, cv)).slice(0, 160));
console.log('PUT A with NO token:', JSON.stringify(await j('PUT', `/api/employees/${A.id}`, { termination_type: 'dismissal' }, null)).slice(0, 160));

console.log('--- POST /api/exit-interviews: the route behind the unreachable modal ---');
const today = new Date().toISOString().slice(0, 10);
console.log('POST exit-interviews on B:', JSON.stringify(await j('POST', '/api/exit-interviews', { employee_id: Bx.id, interview_date: today, departure_reason: 'resignation', detailed_feedback: '', satisfaction_score: 3 }, hr)).slice(0, 200));
const afterB = await j('GET', `/api/employees/${Bx.id}/replacement-cost`, null, hr);
console.log('B replacement-cost after:', JSON.stringify(afterB).slice(0, 500));
const roster2 = (await j('GET', '/api/employees', null, hr)).body;
const r2 = Array.isArray(roster2) ? roster2 : (roster2.employees || []);
const b2 = r2.find((e) => e.id === Bx.id);
console.log('B row after the exit interview: status', b2 && b2.status, '| termination_type', JSON.stringify(b2 && b2.termination_type), '| end_date', b2 && b2.end_date);
console.log('IDS', A.id, Bx.id);
EOF
say "=== the probe ==="
node /tmp/rig-probe.mjs >> "$OUT" 2>&1
say "probe exit=$?"

cat > /tmp/rig-dbcheck.cjs <<'EOF'
const db = require('/tmp/rig-term/server/db.js');
(async () => {
  const [idA, idB] = process.argv.slice(2);
  const q = async (label, sql) => console.log(label, JSON.stringify(await db.query(sql)).slice(0, 500));
  await q('A row:', `SELECT id, status, termination_type, end_date, eosb_accrued FROM employees WHERE id = '${idA}'`);
  await q('B row:', `SELECT id, status, termination_type, end_date FROM employees WHERE id = '${idB}'`);
  await q('audit rows for A:', `SELECT performed_by, action, entity_type, substr(new_values,1,90) AS newv, timestamp FROM audit_logs WHERE entity_id = '${idA}'`);
  await q('audit rows for B:', `SELECT count(*) AS n FROM audit_logs WHERE entity_id = '${idB}'`);
  await q('audit rows naming anyone, last 3:', `SELECT performed_by, entity_type, action, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 3`);
})();
EOF
say "=== the rows and the audit trail, straight from the rig DB ==="
IDS=$(grep -o '^IDS .*' "$OUT" | tail -1 | cut -d' ' -f2-)
say "IDS: $IDS"
cd "$RIG/server" && PRODUCT_DB_PATH="$PRODUCT_DB_PATH" node /tmp/rig-dbcheck.cjs $IDS >> "$OUT" 2>&1
say "dbcheck exit=$?"

say "=== teardown ==="
for p in $(lsof -nP -iTCP:4719 -sTCP:LISTEN -t 2>/dev/null); do
  cwd=$(readlink /proc/$p/cwd)
  say "killing $p (cwd=$cwd)"
  case "$cwd" in /tmp/rig-term/*) kill "$p" ;; *) say "REFUSING to kill $p - not the rig" ;; esac
done
sleep 1
say "listeners on 4719 after: $(lsof -nP -iTCP:4719 -sTCP:LISTEN -t 2>/dev/null | wc -l)"
say "live product (must still be 200): $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
cd "$DEP" && git worktree remove --force "$RIG" 2>&1 | head -2
rm -f /tmp/rig-term-db.sqlite
say "rig tree removed: $([ -d "$RIG" ] && echo NO || echo yes)"
say "DONE"