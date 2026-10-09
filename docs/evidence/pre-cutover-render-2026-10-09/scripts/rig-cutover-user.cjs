const db = require('/home/agent-product-designer/rig-cutover/server/db.js');
const bcrypt = require('/home/agent-product-designer/rig-cutover/server/node_modules/bcryptjs');
const pass = process.env.SCRATCH_PASS;
if (!pass) { console.error('SCRATCH_PASS not set'); process.exit(1); }
const h = bcrypt.hashSync(pass, 12);
db.query(
  'INSERT OR REPLACE INTO users (id,username,password_hash,role,created_at) VALUES (' +
  db.escapeString('scratch-admin') + ',' +
  db.escapeString('scratch-admin') + ',' +
  db.escapeString(h) + ',' +
  db.escapeString('admin') + ',' +
  db.escapeString('2026-10-09 00:00:00') + ')'
).then(() => { console.log('scratch-admin inserted'); process.exit(0); })
 .catch((e) => { console.error('insert failed:', e.message); process.exit(1); });
