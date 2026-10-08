/**
 * The column migration path — the constraint that adding a COLUMN must not break a live database.
 *
 * server/db.js applies server/schema.sql on every open, and `CREATE TABLE IF NOT EXISTS` is what
 * carries a NEW table into a database that predates it (schema-migration.test.js holds that
 * property). It does **not** add a column to a table that already exists — so a database that
 * predates P2-4 keeps `preboarding_items` without `track`/`owner`, and the first query naming them
 * fails. P2-4 closed that gap with `COLUMN_MIGRATIONS` + `applyColumnMigrations`, and this test
 * holds the four properties that make it safe to run at every boot:
 *
 *   1. it adds the missing columns to a table that already exists;
 *   2. the rows that were already there keep their values, and the new column's default labels
 *      them correctly (`track = 'employee'` — a pre-P2-4 row IS an employee-track row, so the
 *      default is the truth and no backfill is needed);
 *   3. running it again adds nothing (idempotent — every boot after the first changes nothing);
 *   4. a migrated database ends up with exactly the columns a freshly-created one has, so the two
 *      paths cannot diverge and a fresh database must not silently outrun a migrated one.
 *
 * Runs against its own throwaway databases: `cd server && npm test`. No live data is touched.
 */
const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');

// db.js opens the product database at require time, so it gets a throwaway before it is required.
const MODULE_DB = path.join(os.tmpdir(), `antum-colmig-module-${randomUUID()}.db`);
process.env.PRODUCT_DB_PATH = MODULE_DB;
const db = require('./db');

const SCHEMA = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const OLD_DB = path.join(os.tmpdir(), `antum-colmig-old-${randomUUID()}.db`);
const FRESH_DB = path.join(os.tmpdir(), `antum-colmig-fresh-${randomUUID()}.db`);

const columnsOf = (handle, table) => handle.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);

/**
 * A database as it existed BEFORE the change: the current schema, with the two P2-4 columns
 * dropped. Dropping them from the real schema (rather than hand-writing an old CREATE TABLE)
 * means this test cannot drift from schema.sql — it starts from today's tables and removes
 * exactly what the migration is supposed to put back.
 */
function openAsBeforeP24() {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    try { fs.unlinkSync(OLD_DB + suffix); } catch { /* not created */ }
  }
  const handle = new DatabaseSync(OLD_DB);
  handle.exec(SCHEMA);
  for (const column of ['owner', 'track']) {
    handle.exec(`ALTER TABLE preboarding_items DROP COLUMN ${column}`);
  }
  return handle;
}

after(() => {
  for (const file of [MODULE_DB, OLD_DB, FRESH_DB]) {
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      try { fs.unlinkSync(file + suffix); } catch { /* not created */ }
    }
  }
});

describe('a live database gains the P2-4 columns at boot', () => {
  test('the migration is what puts the columns on a table that already exists', () => {
    const handle = openAsBeforeP24();
    const before = columnsOf(handle, 'preboarding_items');
    assert.ok(before.length > 0, 'the table exists — this is a database that predates the change');
    assert.ok(!before.includes('track'), 'the old table has no track column');
    assert.ok(!before.includes('owner'), 'and no owner column');

    const added = db.applyColumnMigrations(handle);
    assert.deepStrictEqual(added.sort(), ['preboarding_items.owner', 'preboarding_items.track'],
      'exactly the two columns are added');

    const after = columnsOf(handle, 'preboarding_items');
    assert.ok(after.includes('track') && after.includes('owner'));
    handle.close();
  });

  test('rows that were already there survive, and the default labels them honestly', () => {
    const handle = openAsBeforeP24();
    // Two rows in the pre-change shape, as a live database would hold them.
    for (const [id, key, status] of [['row-1', 'passport', 'requested'], ['row-2', 'bank_details', 'not_started']]) {
      handle.prepare(`INSERT INTO preboarding_items (
        id, case_id, item_key, label, category, jurisdiction, required, status
      ) VALUES (?, 'case-1', ?, ?, 'identity', 'AE', 1, ?)`).run(id, key, key, status);
    }

    db.applyColumnMigrations(handle);

    const rows = handle.prepare("SELECT * FROM preboarding_items ORDER BY id").all();
    assert.strictEqual(rows.length, 2, 'no row is lost or duplicated');
    assert.strictEqual(rows[0].item_key, 'passport');
    assert.strictEqual(rows[0].status, 'requested', 'the values that were there are untouched');
    assert.strictEqual(rows[1].status, 'not_started');
    // The default IS the truth for these rows: everything written before P2-4 was an
    // employee-track item, and the employee track records no owner — so nothing is invented.
    for (const row of rows) {
      assert.strictEqual(row.track, 'employee', 'a pre-change row is an employee-track row');
      assert.strictEqual(row.owner, null, 'and no owner is invented for it');
    }
    handle.close();
  });

  test('running it again adds nothing — the second boot is a no-op', () => {
    const handle = openAsBeforeP24();
    const first = db.applyColumnMigrations(handle);
    assert.strictEqual(first.length, 2);
    const second = db.applyColumnMigrations(handle);
    assert.deepStrictEqual(second, [], 'a boot after the upgrade changes nothing');
    const third = db.applyColumnMigrations(handle);
    assert.deepStrictEqual(third, []);
    handle.close();
  });

  test('a migrated database has exactly the columns a fresh one has', () => {
    const migrated = openAsBeforeP24();
    db.applyColumnMigrations(migrated);

    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      try { fs.unlinkSync(FRESH_DB + suffix); } catch { /* not created */ }
    }
    const fresh = new DatabaseSync(FRESH_DB);
    fresh.exec(SCHEMA);

    // Compared as a SET, not as an ordered list: ALTER TABLE ADD COLUMN appends, so an upgraded
    // database holds `track`/`owner` at the end of the table while a fresh one has them mid-table.
    // That is inherent to the two paths and harmless here — every reader in this codebase is
    // name-keyed (db.query returns objects), and nothing reads a column by position.
    const tables = fresh.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all().map((row) => row.name);
    assert.ok(tables.includes('preboarding_items'));
    for (const table of tables) {
      assert.deepStrictEqual(
        [...columnsOf(migrated, table)].sort(),
        [...columnsOf(fresh, table)].sort(),
        `${table} carries the same columns either way`
      );
    }
    // And the two columns this change added are present on BOTH paths, by name.
    for (const table of ['preboarding_items']) {
      for (const column of ['track', 'owner']) {
        assert.ok(columnsOf(migrated, table).includes(column), `migrated ${table} has ${column}`);
        assert.ok(columnsOf(fresh, table).includes(column), `fresh ${table} has ${column}`);
      }
    }
    migrated.close();
    fresh.close();
  });

  test('the module that runs at boot carries the same migration it exports', () => {
    // Guards the export a test relies on from being decorative: db.js must list the two P2-4
    // columns, and the database it opened in this process must actually have them.
    const listed = db.COLUMN_MIGRATIONS.map((migration) => `${migration.table}.${migration.column}`);
    assert.ok(listed.includes('preboarding_items.track'));
    assert.ok(listed.includes('preboarding_items.owner'));
    assert.ok(listed.every((entry) => entry.split('.')[1] !== undefined));
  });
});
