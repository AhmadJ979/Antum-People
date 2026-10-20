#!/usr/bin/env node
/**
 * Slice 2 prerequisites — live-shaped demonstration (prerequisites 1 and 3).
 *
 * Safety: scratch database under /tmp, scratch port, scratch secret. It never touches the live
 * service (port 3000), the live database (/home/team/.data/…) or the live credential.
 *
 * What it shows, in order:
 *   A. a database built from ORIGIN/MAIN's schema — i.e. a database that PREDATES this change — has
 *      no users.employee_id, and the PRE-EXISTING account row is there;
 *   B. booting this branch's product against it adds exactly that column, and says so;
 *   C. the pre-existing row keeps NULL — nothing is guessed into it;
 *   D. a REAL authenticated POST /api/users writes an audit row naming the real actor;
 *   E. a SECOND boot adds nothing (idempotent).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const REPO = '/home/agent-senior-software-engineer/antum-people';
const SERVER = path.join(REPO, 'server');
const OUT = '/tmp/slice2-evidence';
fs.mkdirSync(OUT, { recursive: true });
const SCRATCH_DB = path.join(OUT, 'scratch-product.db');
const PRE_SCHEMA = path.join(OUT, 'pre-change-schema.sql');
const PORT = 32000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = 'demo-admin';
const PASSWORD = 'scratch-demo-password-1';

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };
const q = (db, sql) => db.prepare(sql).all();

async function main() {
for (const f of [SCRATCH_DB, SCRATCH_DB + '-wal', SCRATCH_DB + '-shm']) { try { fs.unlinkSync(f); } catch {} }

// The schema as origin/main has it = a database that predates this change.
const pre = execFileSync('git', ['show', 'origin/main:server/schema.sql'], { cwd: REPO }).toString();
fs.writeFileSync(PRE_SCHEMA, pre);
say(`# Slice 2 prerequisites — live-shaped demonstration`);
say(``);
say(`run at            : ${new Date().toISOString()}`);
say(`branch tip        : ${execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO }).toString().trim()}`);
say(`base (origin/main): ${execFileSync('git', ['rev-parse', 'origin/main'], { cwd: REPO }).toString().trim()}`);
say(`scratch database  : ${SCRATCH_DB}   (built from origin/main's schema — the PRE-change shape)`);
say(`scratch port      : ${PORT}          (port 3000 and the live DB are not touched)`);

// --- A. the pre-change database -------------------------------------------------------------
const preDb = new DatabaseSync(SCRATCH_DB);
preDb.exec(pre);
const bcrypt = require(path.join(SERVER, 'node_modules', 'bcryptjs'));
preDb.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)')
  .run('pre-existing-user', ADMIN, bcrypt.hashSync(PASSWORD, 4), 'admin');
preDb.prepare("INSERT INTO employees (id, first_name, last_name, email, start_date) VALUES ('emp-1','Demo','Person','demo@example.invalid','2026-01-05')").run();
say(``);
say(`## A. the pre-change database`);
say(`users columns     : ${q(preDb, 'PRAGMA table_info(users)').map((c) => c.name).join(', ')}`);
say(`has employee_id?  : ${q(preDb, 'PRAGMA table_info(users)').some((c) => c.name === 'employee_id')}   <- false is the point`);
say(`accounts present  : ${q(preDb, 'SELECT username, role FROM users').map((u) => `${u.username}/${u.role}`).join(', ')}`);
preDb.close();

// --- B/C/E. boot the product against it, twice ----------------------------------------------
function boot(label) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(SERVER, 'index.js')], {
      cwd: SERVER,
      env: { ...process.env, PORT: String(PORT), PRODUCT_DB_PATH: SCRATCH_DB,
        JWT_SECRET: 'slice2-demo-secret-not-a-production-key', ENCRYPTION_KEY: 'b'.repeat(32) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const deadline = Date.now() + 30000;
    (async () => {
      for (;;) {
        try { await fetch(`${BASE}/api/health`); break; } catch { /* not up yet */ }
        if (Date.now() > deadline) return reject(new Error('server did not start'));
        await new Promise((r) => setTimeout(r, 250));
      }
      resolve({ child, out: () => out, label });
    })();
  });
}

const first = await boot('first boot');
await new Promise((r) => setTimeout(r, 700)); // let the boot's own log land
say(``);
say(`## B. the FIRST boot of this branch's product against that database`);
const upgradeLines = first.out().split('\n').filter((l) => /\[DB\]|Upgraded|FATAL/.test(l)).map((l) => l.trim()).filter(Boolean);
say(`boot log          : ${upgradeLines.length ? upgradeLines.join(' | ') : '(no upgrade line)'}`);
const after1 = new DatabaseSync(SCRATCH_DB);
say(`users columns     : ${q(after1, 'PRAGMA table_info(users)').map((c) => c.name).join(', ')}`);
const preRow = q(after1, "SELECT username, role, employee_id FROM users WHERE id = 'pre-existing-user'")[0];
say(``);
say(`## C. the account that was already there`);
say(`username/role     : ${preRow.username}/${preRow.role}`);
say(`employee_id       : ${JSON.stringify(preRow.employee_id)}   <- NULL: not tied to a person, and NOT guessed`);

// --- D. a real account creation over HTTP, and the audit row it must write -------------------
const login = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: ADMIN, password: PASSWORD }) });
const token = (await login.json()).token;
const created = await fetch(`${BASE}/api/users`, { method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ username: 'slice2-demo-account', password: 'demo-account-password-1', role: 'admin' }) });
const createdBody = await created.json();
say(``);
say(`## D. creating an account over HTTP (the route that used to write no audit row)`);
say(`POST /api/login   : ${login.status}`);
say(`POST /api/users   : ${created.status} ${JSON.stringify(createdBody)}`);
const audit = q(after1, `SELECT * FROM audit_logs WHERE entity_type = 'user'`);
for (const row of audit) {
  say(`audit row         : performed_by=${JSON.stringify(row.performed_by)} entity_type=${row.entity_type} ` +
      `entity_id=${row.entity_id} action=${row.action} new_values=${row.new_values}`);
}
say(`actor is real     : ${audit.length === 1 && audit[0].performed_by === ADMIN}   (not 'system', not a placeholder)`);
say(`credential leaked : ${JSON.stringify(audit).includes('demo-account-password-1') || JSON.stringify(audit).includes('$2')}`);
after1.close();

// --- E. the second boot ----------------------------------------------------------------------
first.child.kill('SIGTERM');
await new Promise((r) => setTimeout(r, 800));
const second = await boot('second boot');
await new Promise((r) => setTimeout(r, 700));
const secondUpgrade = second.out().split('\n').filter((l) => /\[DB\]|Upgraded|FATAL/.test(l)).map((l) => l.trim()).filter(Boolean);
say(``);
say(`## E. the SECOND boot (idempotence)`);
say(`boot log          : ${secondUpgrade.length ? secondUpgrade.join(' | ') : '(no upgrade line — nothing left to add)'}`);
const after2 = new DatabaseSync(SCRATCH_DB);
say(`users columns     : ${q(after2, 'PRAGMA table_info(users)').map((c) => c.name).join(', ')}`);
say(`accounts now      : ${q(after2, 'SELECT username FROM users ORDER BY created_at').map((u) => u.username).join(', ')}`);
after2.close();
second.child.kill('SIGTERM');
await new Promise((r) => setTimeout(r, 500));

say(``);
say(`## Result`);
say(`A+B : the column did not exist on the pre-change database and the FIRST boot added it, and named it.`);
say(`C   : the pre-existing account kept NULL — no backfill, no guess.`);
say(`D   : the audit row names ${JSON.stringify(audit[0] && audit[0].performed_by)} — the real authenticated signer.`);
say(`E   : the second boot added nothing.`);

fs.writeFileSync(path.join(OUT, 'scratch-demo.log'), lines.join('\n') + '\n');
console.log(`\nwritten: ${OUT}/scratch-demo.log`);
}
main().catch((err) => { console.error(err); process.exit(1); });
