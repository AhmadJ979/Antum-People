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

// Database path comes from an environment variable with a default outside the git tree
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
 *
 * Exported so this path is testable against a throwaway database
 * (server/column-migration.test.js) rather than only being exercised at boot.
 */
const COLUMN_MIGRATIONS = [
  // P2-4: the workspace track. `track` defaults to 'employee', so every row that predates the
  // column is labelled correctly by the default rather than by a backfill that could be wrong.
  { table: 'preboarding_items', column: 'track', ddl: "TEXT NOT NULL DEFAULT 'employee'" },
  { table: 'preboarding_items', column: 'owner', ddl: 'TEXT' },
];

function columnsOf(handle, table) {
  try {
    return handle.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
  } catch {
    return null; // no such table — schema.sql runs before this, so only a bad name reaches here
  }
}

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
  // …then the columns an existing table cannot gain from a CREATE TABLE IF NOT EXISTS.
  const addedColumns = applyColumnMigrations(db);
  if (addedColumns.length) {
    console.log(`[DB] Upgraded: added column(s) ${addedColumns.join(', ')}`);
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
};
