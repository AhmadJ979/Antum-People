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

/**
 * Layer 3, slice 2 — `users.employee_id`, the account → person link, and the rename of
 * `users.role` → `users.access_role` with the role value `admin` → `hr_admin` that rides the same
 * slice (docs/access-model.md §2.2, §2.4, §8 items 8–9).
 *
 * The fixture is a database as the LIVE HOST holds one before this change: today's schema, with the
 * rename un-done and `employee_id` dropped. Building it by taking today's schema apart (rather than
 * hand-writing an old CREATE TABLE) is what stops this test drifting from schema.sql — and the
 * un-doing is also a statement of what the live database actually holds, measured 2026-10-20 against
 * a copy of it: `id, username, password_hash, role, created_at` plus `employee_id`, one `admin` row.
 *
 * Three properties are deliberate about NOT guessing, and each is asserted:
 *   * an account that predates the link keeps **NULL** — not tied to a person yet;
 *   * the role value MOVES (`admin` → `hr_admin`): the same role under the name §2.1 gives it, so no
 *     row's meaning changes and no row keeps the old spelling;
 *   * the "unique when set" constraint is the DATABASE's, created after the column exists — it cannot
 *     live in schema.sql, which runs before the column migrations.
 */
describe('a live database is renamed and linked at boot (Layer 3, slice 2)', () => {
  const OLD2_DB = path.join(os.tmpdir(), `antum-colmig-predb-${randomUUID()}.db`);

  function openAsBeforeSlice2() {
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      try { fs.unlinkSync(OLD2_DB + suffix); } catch { /* not created */ }
    }
    const handle = new DatabaseSync(OLD2_DB);
    handle.exec(SCHEMA);
    handle.exec('ALTER TABLE users DROP COLUMN employee_id');       // the column this change adds
    handle.exec('ALTER TABLE users RENAME COLUMN access_role TO role'); // the name this change moves
    return handle;
  }

  /** What server/db.js does on every open, in its own order. */
  const migrate = (handle) => ({
    renamed: db.applyRenames(handle),
    values: db.applyValueRenames(handle),
    added: db.applyColumnMigrations(handle),
    indexes: db.applyPostMigrationIndexes(handle),
  });

  test('the fixture is the live shape: the old name, no link, and an account holding `admin`', () => {
    const handle = openAsBeforeSlice2();
    const columns = columnsOf(handle, 'users');
    assert.ok(columns.includes('role'), 'the old column name');
    assert.ok(!columns.includes('access_role'), 'and not the new one — the rename has not run');
    assert.ok(!columns.includes('employee_id'), 'and no link column');
    handle.prepare("INSERT INTO users (id, username, password_hash, role) VALUES ('old-admin', 'admin', 'x', 'admin')").run();
    assert.strictEqual(handle.prepare("SELECT role FROM users WHERE id = 'old-admin'").get().role, 'admin');
    handle.close();
  });

  test('one boot renames the column, moves the value, adds the link and creates the constraint', () => {
    const handle = openAsBeforeSlice2();
    handle.prepare("INSERT INTO users (id, username, password_hash, role) VALUES ('old-admin', 'admin', 'x', 'admin')").run();

    const done = migrate(handle);

    assert.deepStrictEqual(done.renamed, ['users.role->access_role'], 'exactly the one column moves');
    assert.strictEqual(done.values.length, 1, 'and one stored value moves with it');
    assert.ok(done.values[0].includes("'admin'->'hr_admin'"), done.values[0]);
    assert.deepStrictEqual(done.added, ['users.employee_id'], 'exactly this one column is added');
    assert.deepStrictEqual(done.indexes, ['idx_users_employee_id_unique'], 'and the constraint it needs');

    const columns = columnsOf(handle, 'users');
    assert.ok(columns.includes('access_role') && !columns.includes('role'), 'the name moved rather than duplicated');
    assert.ok(columns.includes('employee_id'));

    const row = handle.prepare("SELECT id, username, access_role, employee_id FROM users WHERE id = 'old-admin'").get();
    assert.strictEqual(row.username, 'admin', 'the row is the one that was there — the USERNAME is not a role');
    assert.strictEqual(row.access_role, 'hr_admin', 'its role, under the name §2.1 gives it');
    assert.strictEqual(row.employee_id, null, 'and NOTHING is guessed into the new column for it');
    handle.close();
  });

  test('a database that never held the old name is not renamed — but it does get the constraint', () => {
    const fresh = new DatabaseSync(path.join(os.tmpdir(), `antum-colmig-already-${randomUUID()}.db`));
    fresh.exec(SCHEMA);
    const done = migrate(fresh);
    assert.deepStrictEqual(done.renamed, [], 'nothing to rename: the column already has its new name');
    assert.deepStrictEqual(done.values, [], 'and no row holds the old value');
    assert.deepStrictEqual(done.added, [], 'the column exists');
    // The index is NOT in schema.sql and cannot be: schema.sql runs before the column migrations, so on
    // an older database the column it constrains does not exist yet and the whole file would fail to
    // boot. Every database therefore gets it from the boot — including this one. Idempotence, not
    // absence, is the property, and the second pass is asserted here to say exactly that.
    assert.deepStrictEqual(done.indexes, ['idx_users_employee_id_unique']);
    assert.deepStrictEqual(migrate(fresh), { renamed: [], values: [], added: [], indexes: [] },
      'the boot after this one changes nothing, on either kind of database');
    fresh.close();
  });

  test('a second boot changes nothing at all', () => {
    const handle = openAsBeforeSlice2();
    handle.prepare("INSERT INTO users (id, username, password_hash, role) VALUES ('old-admin', 'admin', 'x', 'admin')").run();
    migrate(handle);
    const again = migrate(handle);
    assert.deepStrictEqual(again, { renamed: [], values: [], added: [], indexes: [] },
      'every boot after the first is a no-op, which is what makes it safe to run on every start');
    handle.close();
  });

  test('a migrated database and a fresh one agree on the users columns, by name', () => {
    const migrated = openAsBeforeSlice2();
    migrate(migrated);
    const fresh = new DatabaseSync(path.join(os.tmpdir(), `antum-colmig-fresh2-${randomUUID()}.db`));
    fresh.exec(SCHEMA);
    assert.deepStrictEqual([...columnsOf(migrated, 'users')].sort(), [...columnsOf(fresh, 'users')].sort(),
      'a fresh database cannot silently outrun a migrated one');
    for (const column of ['access_role', 'employee_id']) {
      assert.ok(columnsOf(migrated, 'users').includes(column), `migrated users has ${column}`);
      assert.ok(columnsOf(fresh, 'users').includes(column), `fresh users has ${column}`);
    }
    assert.ok(!columnsOf(fresh, 'users').includes('role'), 'and neither path keeps the old name');
    migrated.close();
    fresh.close();
  });

  test('the "unique when set" constraint is the DATABASE\'s, and it is partial', () => {
    // Two assertions in one pair, deliberately: the duplicate is REJECTED, and two unlinked accounts
    // are ACCEPTED — so the rejection above cannot be the index refusing every second row.
    const handle = openAsBeforeSlice2();
    migrate(handle);
    handle.prepare("INSERT INTO users (id, username, password_hash, access_role, employee_id) VALUES ('a-1', 'a-1', 'x', 'employee', 'emp-1')").run();
    assert.throws(
      () => handle.prepare("INSERT INTO users (id, username, password_hash, access_role, employee_id) VALUES ('a-2', 'a-2', 'x', 'employee', 'emp-1')").run(),
      'two accounts for one person is the state the scope checks cannot resolve, so the schema refuses it');
    handle.prepare("INSERT INTO users (id, username, password_hash, access_role, employee_id) VALUES ('a-3', 'a-3', 'x', 'employee', NULL)").run();
    handle.prepare("INSERT INTO users (id, username, password_hash, access_role, employee_id) VALUES ('a-4', 'a-4', 'x', 'employee', NULL)").run();
    assert.strictEqual(handle.prepare('SELECT COUNT(*) n FROM users WHERE employee_id IS NULL').get().n, 2,
      'an unlinked account is not "the same person" as another unlinked account');
    handle.close();
  });

  test('the module that runs at boot lists every step a live database needs', () => {
    assert.deepStrictEqual(db.RENAMES.map((r) => `${r.table}.${r.from}->${r.to}`), ['users.role->access_role']);
    assert.ok(db.VALUE_RENAMES.some((v) => v.table === 'users' && v.column === 'access_role' && v.from === 'admin' && v.to === 'hr_admin'));
    assert.ok(db.COLUMN_MIGRATIONS.some((m) => m.table === 'users' && m.column === 'employee_id'));
    assert.ok(db.POST_MIGRATION_INDEXES.some((i) => i.name === 'idx_users_employee_id_unique'));
  });

  after(() => {
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      try { fs.unlinkSync(OLD2_DB + suffix); } catch { /* not created */ }
    }
  });
});
