const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.env.PRODUCT_DB);
const emp = db.prepare('SELECT id FROM employees LIMIT 1').get().id;
const ins = (id, e) => db.prepare('INSERT INTO users (id,username,password_hash,access_role,employee_id) VALUES (?,?,?,?,?)').run(id, id, 'x', 'employee', e);
console.log('employee probed:', emp);
console.log('before:', db.prepare('SELECT COUNT(*) c FROM users').get().c, 'users;',
  db.prepare('SELECT COUNT(*) c FROM users WHERE employee_id = ?').get(emp).c, 'linked to it');
try { ins('probe-a', emp); console.log('1st link to', emp, ': accepted (correct — the link was free)'); }
catch (e) { console.log('1st link refused (unexpected):', e.message.slice(0,70)); }
try { ins('probe-b', emp); console.log('2nd link to', emp, ': ACCEPTED -> index not load-bearing'); }
catch (e) { console.log('2nd link to', emp, ': refused ->', e.message.slice(0,70)); }
try { ins('probe-n1', null); ins('probe-n2', null); console.log('two unlinked accounts: accepted (correct — the index is partial)'); }
catch (e) { console.log('two unlinked accounts refused (index is not partial):', e.message.slice(0,70)); }
console.log('after:', db.prepare('SELECT COUNT(*) c FROM users').get().c, 'users');
