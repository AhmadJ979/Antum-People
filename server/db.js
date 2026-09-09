const { exec } = require('child_process');

/**
 * Executes a SQL statement via the global `team-db` CLI.
 * Syncs automatically with Turso, executes, and returns parsed JSON.
 * 
 * @param {string} sql - The raw SQL statement to execute.
 * @returns {Promise<any[]>} - Returns an array of objects for SELECT, or [] for DDL/DML.
 */
function query(sql) {
  return new Promise((resolve, reject) => {
    // Escape double quotes inside the SQL command since we wrap the command in double quotes
    // e.g. team-db "SELECT * FROM x WHERE name = \"test\""
    const escapedSql = sql.replace(/"/g, '\\"');
    
    exec(`team-db "${escapedSql}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`[DB Error] SQL: ${sql}`);
        console.error(`[DB Error] Stderr: ${stderr}`);
        return reject(error);
      }
      
      try {
        const trimmed = stdout.trim();
        if (!trimmed) {
          return resolve([]);
        }
        const results = JSON.parse(trimmed);
        resolve(results);
      } catch (parseError) {
        console.warn(`[DB Warning] Failed to parse output as JSON, returning empty list. Output: ${stdout}`);
        resolve([]);
      }
    });
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
