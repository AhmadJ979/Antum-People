const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

/**
 * Antum People - Product Database Module
 * 
 * This module replaces the previous implementation that shared the team's 
 * coordination store. It now uses a product-owned SQLite file.
 */

// Database path from environment variable, with a default outside the git tree
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
} catch (error) {
  // FAIL LOUDLY at startup if the database cannot be opened or initialized
  console.error(`[FATAL] Failed to initialize product database at ${PRODUCT_DB_PATH}`);
  console.error(error);
  process.exit(1);
}

/**
 * Executes a SQL statement against the product database.
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
  escapeString
};
