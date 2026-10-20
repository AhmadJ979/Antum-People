const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.env.PRODUCT_DB, { readOnly: true });
const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
console.log('users columns:', JSON.stringify(cols));
console.log('indexes on users:', JSON.stringify(db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'users'").all()));
console.log('users rows:', JSON.stringify(db.prepare('SELECT id, username, access_role, employee_id FROM users').all()));
try {
  const dup = db.prepare("INSERT INTO users (id, username, password_hash, access_role, employee_id) VALUES ('probe-dup', 'probe-dup', 'x', 'employee', 'demo-emp-omar')");
  console.log('unique-when-set probe: INSERT DUPLICATE SUCCEEDED (would be a defect)');
} catch (e) {
  console.log('unique-when-set probe (duplicate employee_id refused):', e.message.slice(0, 90));
}
console.log('users row count:', db.prepare('SELECT COUNT(*) c FROM users').get().c);
console.log("audit_logs performed_by = 'system':", db.prepare('SELECT COUNT(*) c FROM audit_logs WHERE performed_by = ?').get('system').c);
console.log('audit_logs total:', db.prepare('SELECT COUNT(*) c FROM audit_logs').get().c);
console.log('audit_logs entity_type=user:', db.prepare('SELECT COUNT(*) c FROM audit_logs WHERE entity_type = ?').get('user').c);
console.log('distinct performed_by:', JSON.stringify(db.prepare('SELECT DISTINCT performed_by FROM audit_logs LIMIT 12').all()));
console.log('sqlite_master tables count:', db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='table'").get().c);
