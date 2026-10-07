/**
 * The schema migration path — the constraint that a schema change must not break existing
 * rows or callers.
 *
 * server/db.js applies server/schema.sql on EVERY open, so an additively-written schema is
 * the migration path: a database that predates a table gains it at the next start. This test
 * holds that property for the P2-1 block (preboarding_cases) and for anything added after it:
 *
 *   1. build a database from the schema WITHOUT the new block — i.e. as it existed before the
 *      change — and fill it with rows, the way a live database looks;
 *   2. apply the current schema.sql, which is what a restart does;
 *   3. the rows are all still there with their values, and the new table exists and is empty;
 *   4. applying it a second time changes nothing (idempotent), and data written after the
 *      upgrade survives another application.
 *
 * Runs against its own throwaway database: `cd server && npm test`.
 */
const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
// Everything from this marker on is the P2-1 addition; the text before it is the schema as a
// database that predates P2-1 has it. If the block moves, this test says so rather than
// quietly testing nothing.
const P2_1_MARKER = '-- Layer 2 — Pre-boarding Intelligence (P2-1).';

const TMP = path.join(os.tmpdir(), `antum-schema-migration-${process.pid}.db`);
const TMP_BEFORE = path.join(os.tmpdir(), `antum-schema-migration-before-${process.pid}.db`);

const openAt = (file, sql) => {
  fs.rmSync(file, { force: true });
  const handle = new DatabaseSync(file);
  handle.exec(sql);
  return handle;
};

const counts = (handle) => ({
  employees: handle.prepare('SELECT COUNT(*) n FROM employees').get().n,
  onboarding_tasks: handle.prepare('SELECT COUNT(*) n FROM onboarding_tasks').get().n,
  offboarding_tasks: handle.prepare('SELECT COUNT(*) n FROM offboarding_tasks').get().n,
  audit_logs: handle.prepare('SELECT COUNT(*) n FROM audit_logs').get().n,
  users: handle.prepare('SELECT COUNT(*) n FROM users').get().n,
});

const hasTable = (handle, table) =>
  handle.prepare(`SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='${table}'`).get().n === 1;

after(() => {
  for (const file of [TMP, TMP_BEFORE]) {
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      try { fs.unlinkSync(file + suffix); } catch { /* not created */ }
    }
  }
});

describe('schema.sql migrates a database that already has rows', () => {
  test('the schema text really does contain a pre-P2-1 half and a post-P2-1 half', () => {
    const markerAt = SCHEMA.indexOf(P2_1_MARKER);
    assert.ok(markerAt > 0, `marker not found in schema.sql — update this test if the ${P2_1_MARKER} block moved`);

    const before = SCHEMA.slice(0, markerAt);
    assert.ok(!before.includes('preboarding_cases'), 'the pre-change half must not contain the new table');
    assert.ok(SCHEMA.includes('preboarding_cases'), 'the current schema must contain it');
  });

  test('an existing database gains the new table with every row intact', () => {
    const markerAt = SCHEMA.indexOf(P2_1_MARKER);
    const schemaBefore = SCHEMA.slice(0, markerAt);

    // 1. a database as it exists before the change
    const handle = openAt(TMP, schemaBefore);
    assert.ok(!hasTable(handle, 'preboarding_cases'), 'the table does not exist yet');

    handle.exec(`
      INSERT INTO employees (id, first_name, last_name, email, department, role, manager_id, start_date, status, jurisdiction, salary, basic_salary)
      VALUES ('existing-1','Existing','Employee','existing@example.com','Finance','Analyst','mgr-1','2024-01-01','active','AE',20000,12000)`);
    handle.exec(`
      INSERT INTO employees (id, first_name, last_name, email, start_date, status, jurisdiction)
      VALUES ('existing-2','Second','Row','second@example.com','2025-04-01','active','SA')`);
    handle.exec(`INSERT INTO onboarding_tasks (id, employee_id, title, description, status, due_date)
      VALUES ('task-1','existing-1','Existing onboarding task','written before the change','pending','2024-01-08')`);
    handle.exec(`INSERT INTO offboarding_tasks (id, employee_id, title, description, status)
      VALUES ('off-1','existing-1','Existing offboarding task','written before the change','pending')`);
    handle.exec(`INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by)
      VALUES ('audit-1','employee','existing-1','CREATE','system')`);
    handle.exec(`INSERT INTO users (id, username, password_hash, role) VALUES ('user-1','admin','hash-value','admin')`);

    const before = counts(handle);

    // 2. the migration: the same thing server/db.js does on every open
    handle.exec(SCHEMA);

    // 3. nothing lost, the new table exists, empty
    assert.deepStrictEqual(counts(handle), before, 'row counts must be unchanged by the migration');
    assert.ok(hasTable(handle, 'preboarding_cases'), 'the new table is created on an existing database');
    assert.strictEqual(
      handle.prepare('SELECT COUNT(*) n FROM preboarding_cases').get().n,
      0,
      'it starts empty: the migration stores no rows of its own'
    );

    const employee = handle.prepare("SELECT * FROM employees WHERE id='existing-1'").get();
    assert.strictEqual(employee.role, 'Analyst');
    assert.strictEqual(employee.jurisdiction, 'AE');
    assert.strictEqual(employee.salary, 20000);
    assert.strictEqual(
      handle.prepare("SELECT title FROM onboarding_tasks WHERE employee_id='existing-1'").get().title,
      'Existing onboarding task'
    );

    // 4. restarting again is a no-op, and a case written after the upgrade survives the next one
    handle.exec(SCHEMA);
    assert.deepStrictEqual(counts(handle), before, 'a second application changes nothing');
    assert.strictEqual(handle.prepare('SELECT COUNT(*) n FROM preboarding_cases').get().n, 0);

    handle.exec(`
      INSERT INTO preboarding_cases (id, offer_reference, candidate_name, role, department, reporting_line, jurisdiction, start_date, status, source)
      VALUES ('case-1','OFR-MIGRATION-1','Layla Haddad','Financial Analyst','Finance','Head of Finance','AE','2026-11-02','open','intake_form')`);
    handle.exec(SCHEMA);
    assert.strictEqual(handle.prepare('SELECT COUNT(*) n FROM preboarding_cases').get().n, 1,
      'the schema must not drop or recreate the table on a later start');
    handle.close();
  });

  test('a fresh database gets every table, including the new one', () => {
    const fresh = openAt(TMP_BEFORE, SCHEMA);
    for (const table of ['employees', 'onboarding_tasks', 'offboarding_tasks', 'preboarding_cases', 'audit_logs', 'users']) {
      assert.ok(hasTable(fresh, table), `${table} must exist on a fresh database`);
    }
    fresh.close();
  });
});
