const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

/**
 * Antum People - Product Database Module
 * 
 * Deliverable 1: The product owns its database.
 * This module implements a single query() seam against a product-owned SQLite file.
 * It replaces the previous implementation that shared the team's coordination store.
 */

// Database path comes from an environment variable with a default outside the git tree.
// The default belongs to the product itself. Under the test runner there is no legitimate reason to
// reach it — one unpinned test would bind the live database, and this module executes schema.sql on
// open, i.e. DDL against live data — so refuse loudly instead of binding it silently.
// The check that keeps test files pinned is server/live-db-guard.test.js; this is the second layer.
if (!process.env.PRODUCT_DB_PATH && process.env.NODE_TEST_CONTEXT) {
  throw new Error(
    'PRODUCT_DB_PATH is unset while running under the test runner, so db.js would bind the live '
    + 'product database and execute schema.sql against it. Pin PRODUCT_DB_PATH to a throwaway path '
    + 'above the first require that loads db.js (see server/live-db-guard.test.js).',
  );
}
const PRODUCT_DB_PATH = process.env.PRODUCT_DB_PATH || '/home/team/.data/antum-product.db';

// Ensure the directory exists
const dbDir = path.dirname(PRODUCT_DB_PATH);
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (err) {
    console.error(`[FATAL] Could not create directory for product database: ${dbDir}`);
    process.exit(1);
  }
}

/**
 * Columns added to a table that a live database already has.
 *
 * `CREATE TABLE IF NOT EXISTS` adds a NEW table to an existing database, which is how every
 * schema change up to P2-1 arrived. It does NOT add a column to a table that already exists —
 * so a database that predates P2-4 would keep `preboarding_items` without `track`/`owner`, and
 * the first query naming them would fail on the live deployment. This closes that gap
 * declaratively: one entry per column, applied only when the column is missing, so a restart
 * upgrades a live database and a second restart changes nothing.
 *
 * Deliberately NOT a general migration framework: no version numbers, no down-migrations, no
 * rewriting of existing rows. Each entry is additive and carries a default, which is the only
 * kind of change a table can absorb without touching the rows it already holds. A column that
 * needs a value computed per row is a data migration and belongs in its own change, not here.
 * (The two exceptions beside it are not that: a RENAME moves a name and a stored value keeps its
 * meaning, so `RENAMES`/`VALUE_RENAMES` below rename and nothing else — see their own notes.)
 *
 * Exported so this path is testable against a throwaway database
 * (server/column-migration.test.js) rather than only being exercised at boot.
 */
const COLUMN_MIGRATIONS = [
  // P2-4: the workspace track. `track` defaults to 'employee', so every row that predates the
  // column is labelled correctly by the default rather than by a backfill that could be wrong.
  { table: 'preboarding_items', column: 'track', ddl: "TEXT NOT NULL DEFAULT 'employee'" },
  { table: 'preboarding_items', column: 'owner', ddl: 'TEXT' },
  // Layer 3, slice 1 (decision 22): the tick's actor. A database that predates this slice keeps
  // onboarding_tasks/offboarding_tasks WITHOUT the column, and CREATE TABLE IF NOT EXISTS will not
  // add it to a table that already exists — so the column is declared in schema.sql (for a fresh
  // database) AND migrated here (for an existing one), and server/column-migration.test.js asserts
  // the two paths end up with the same columns.
  { table: 'onboarding_tasks', column: 'completed_by', ddl: 'TEXT' },
  { table: 'offboarding_tasks', column: 'completed_by', ddl: 'TEXT' },
  // Layer 3, slice 2 (prerequisite 1): the account → person link. A database that predates this
  // gets the column here rather than from CREATE TABLE IF NOT EXISTS, which cannot touch a table
  // that already exists. Additive and nullable with NO default: every existing row keeps NULL,
  // which is the truth about it — an account not tied to a person yet — so nothing is guessed and
  // the single live `admin` row is left exactly as it is. Idempotent by construction (the column is
  // applied only when `PRAGMA table_info` does not list it), so a second boot changes nothing.
  { table: 'users', column: 'employee_id', ddl: 'TEXT' },
];

function columnsOf(handle, table) {
  try {
    return handle.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
  } catch {
    return null; // no such table — schema.sql runs before this, so only a bad name reaches here
  }
}

/**
 * Columns RENAMED on a database that already exists — SQLite's `ALTER TABLE ... RENAME COLUMN`.
 *
 * WHY A RENAME AND NOT A SECOND COLUMN: docs/access-model.md §2.4 asks for `users.role` →
 * `users.access_role`, because the permission collides by name with `employees.role` (a job title)
 * and an access check written against the wrong one gates on the job title. Keeping `role` beside
 * `access_role` would keep the collision and add a third name; a rename leaves exactly one.
 *
 * WHY IT IS SAFE HERE, measured 2026-10-20 against a copy of the live database: the rename preserves
 * every row's value (the single account's `'admin'` became `'admin'` under the new column name),
 * `RENAME COLUMN` is idempotent by the guard below (the second boot sees `to` present and does
 * nothing), and it succeeds on a table whose stored DDL carries an inline `--` comment — unlike
 * `DROP COLUMN`, which is the strict one and is why schema.sql's `users` list carries none.
 *
 * Ordering: this runs BEFORE `applyColumnMigrations`, so a database that predates BOTH the rename and
 * `employee_id` is renamed first and gains the column second, whichever order they were introduced in.
 */
const RENAMES = [
  { table: 'users', from: 'role', to: 'access_role' },
];

/**
 * Stored VALUES renamed with their column — an enumeration whose name moved, not a computed value.
 *
 * `admin` is the role docs/access-model.md §2.1 calls `hr_admin`; it is one role under a new name, so
 * every row that held the old name now holds the new one. Idempotent by construction: the UPDATE
 * matches rows holding `from`, and after the first boot there are none. It is kept apart from
 * COLUMN_MIGRATIONS on purpose — that table is documented as never touching the rows a table already
 * holds, and this one does exactly that, once, in the one direction that cannot invent a value.
 */
const VALUE_RENAMES = [
  { table: 'users', column: 'access_role', from: 'admin', to: 'hr_admin' },
];

/**
 * Objects that must exist AFTER the column work, and CANNOT live in schema.sql.
 *
 * `CREATE UNIQUE INDEX ... WHERE employee_id IS NOT NULL` is the "nullable, unique when set"
 * constraint docs/access-model.md §2.2 asks for, and it is here rather than in the schema for a
 * measured reason: schema.sql is executed BEFORE the column migrations (below), so on a database
 * that predates `users.employee_id` the index would name a column that does not exist yet and the
 * boot would fail. After the migrations the column is always there, on both paths.
 *
 * A duplicate `employee_id` already in the data would make this throw, which is a loud boot failure
 * rather than a silently absent constraint: two accounts for one person is exactly the state the
 * scope checks in server/access.js cannot resolve, so it must not be possible to hold it quietly.
 */
const POST_MIGRATION_INDEXES = [
  {
    name: 'idx_users_employee_id_unique',
    requires: { table: 'users', column: 'employee_id' },
    sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id_unique ON users (employee_id) WHERE employee_id IS NOT NULL',
  },
];

/**
 * Apply every missing column to an open database handle and return the ones it added, so a boot
 * can log an upgrade and a test can assert that a second run adds nothing.
 */
function applyColumnMigrations(handle, migrations = COLUMN_MIGRATIONS) {
  const added = [];
  for (const migration of migrations) {
    const columns = columnsOf(handle, migration.table);
    if (columns === null || columns.indexOf(migration.column) !== -1) continue;
    handle.exec(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.ddl}`);
    added.push(`${migration.table}.${migration.column}`);
  }
  return added;
}

/** Rename the columns RENAMES lists, and return the ones this boot moved. Nothing else is touched. */
function applyRenames(handle, renames = RENAMES) {
  const renamed = [];
  for (const rename of renames) {
    const columns = columnsOf(handle, rename.table);
    if (columns === null) continue;                    // no such table: nothing to rename
    if (columns.indexOf(rename.to) !== -1) continue;   // already renamed — a later boot does nothing
    if (columns.indexOf(rename.from) === -1) continue; // neither name present: not this migration's
    handle.exec(`ALTER TABLE ${rename.table} RENAME COLUMN ${rename.from} TO ${rename.to}`);
    renamed.push(`${rename.table}.${rename.from}->${rename.to}`);
  }
  return renamed;
}

/** Rename the stored values VALUE_RENAMES lists, and return how many rows this boot moved. */
function applyValueRenames(handle, renames = VALUE_RENAMES) {
  const moved = [];
  for (const rename of renames) {
    const columns = columnsOf(handle, rename.table);
    if (columns === null || columns.indexOf(rename.column) === -1) continue;
    const before = handle
      .prepare(`SELECT COUNT(*) AS n FROM ${rename.table} WHERE ${rename.column} = ?`)
      .get(rename.from).n;
    if (before === 0) continue; // nothing holds the old value: a later boot does nothing
    handle.exec(`UPDATE ${rename.table} SET ${rename.column} = '${rename.to}' WHERE ${rename.column} = '${rename.from}'`);
    moved.push(`${rename.table}.${rename.column}: '${rename.from}'->'${rename.to}' (${before} row${before === 1 ? '' : 's'})`);
  }
  return moved;
}

/** Create the objects POST_MIGRATION_INDEXES lists, once their columns are in place. */
function applyPostMigrationIndexes(handle, indexes = POST_MIGRATION_INDEXES) {
  const created = [];
  for (const index of indexes) {
    if (index.requires) {
      const columns = columnsOf(handle, index.requires.table);
      if (columns === null || columns.indexOf(index.requires.column) === -1) continue;
    }
    const existing = handle
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name = ?")
      .get(index.name);
    handle.exec(index.sql); // IF NOT EXISTS: a second boot creates nothing
    if (!existing) created.push(index.name);
  }
  return created;
}

let db;
try {
  // Use node:sqlite (DatabaseSync) as instructed
  db = new DatabaseSync(PRODUCT_DB_PATH);
  
  // Idempotent migration: execute the schema on every startup
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  } else {
    console.warn(`[DB Warning] Schema file not found at ${schemaPath}`);
  }
  // …then the columns an existing table cannot gain from a CREATE TABLE IF NOT EXISTS, the names this
  // slice moved, the stored role values that moved with them, and the constraints that need those
  // columns to exist first — in that order, because a later step may name an earlier one's result.
  const renamedColumns = applyRenames(db);
  if (renamedColumns.length) {
    console.log(`[DB] Upgraded: renamed column(s) ${renamedColumns.join(', ')}`);
  }
  const renamedValues = applyValueRenames(db);
  if (renamedValues.length) {
    console.log(`[DB] Upgraded: renamed stored value(s) ${renamedValues.join(', ')}`);
  }
  const addedColumns = applyColumnMigrations(db);
  if (addedColumns.length) {
    console.log(`[DB] Upgraded: added column(s) ${addedColumns.join(', ')}`);
  }
  const createdIndexes = applyPostMigrationIndexes(db);
  if (createdIndexes.length) {
    console.log(`[DB] Upgraded: created index(es) ${createdIndexes.join(', ')}`);
  }
} catch (error) {
  // FAIL LOUDLY at startup if the database cannot be opened or initialized
  console.error(`[FATAL] Failed to initialize product database at ${PRODUCT_DB_PATH}`);
  console.error(error);
  process.exit(1);
}

/**
 * Executes a SQL statement against the product database.
 * Matches the previous signature and return shape.
 * 
 * @param {string} sql - The raw SQL statement to execute.
 * @returns {Promise<any[]>} - Returns an array of objects for SELECT, or [] for DDL/DML.
 */
function query(sql) {
  return new Promise((resolve, reject) => {
    try {
      const trimmedSql = sql.trim();
      const isSelect = trimmedSql.toUpperCase().startsWith('SELECT') || 
                       trimmedSql.toUpperCase().startsWith('WITH') ||
                       trimmedSql.toUpperCase().startsWith('PRAGMA');
      
      if (isSelect) {
        const results = db.prepare(sql).all();
        resolve(results);
      } else {
        db.exec(sql);
        resolve([]);
      }
    } catch (error) {
      console.error(`[DB Error] SQL: ${sql}`);
      console.error(error);
      reject(error);
    }
  });
}

/**
 * Escapes single quotes for standard SQL text insertion.
 * 
 * @param {string} value 
 * @returns {string}
 */
function escapeString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

module.exports = {
  query,
  escapeString,
  applyColumnMigrations,
  COLUMN_MIGRATIONS,
  applyRenames,
  RENAMES,
  applyValueRenames,
  VALUE_RENAMES,
  applyPostMigrationIndexes,
  POST_MIGRATION_INDEXES,
};
