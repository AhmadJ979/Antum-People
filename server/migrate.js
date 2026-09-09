const db = require('./db');
const auth = require('./auth');
const { randomUUID } = require('crypto');

async function migrate() {
  console.log('Starting migration...');

  // 1. Seed Admin User
  const adminUsername = 'admin';
  const adminPassword = 'VantageHR_Admin_2026!';
  const existingUsers = await db.query(`SELECT * FROM users WHERE username = ${db.escapeString(adminUsername)}`);
  
  if (existingUsers.length === 0) {
    const hashedPassword = await auth.hashPassword(adminPassword);
    const id = randomUUID();
    await db.query(`INSERT INTO users (id, username, password_hash, role) VALUES (
      ${db.escapeString(id)}, 
      ${db.escapeString(adminUsername)}, 
      ${db.escapeString(hashedPassword)}, 
      'admin'
    )`);
    console.log(`Admin user created: ${adminUsername} / ${adminPassword}`);
  } else {
    console.log('Admin user already exists.');
  }

  // 2. Encrypt existing National IDs
  const employees = await db.query('SELECT id, national_id_value, national_id_iqama FROM employees');
  console.log(`Found ${employees.length} employees to check for encryption.`);

  for (const emp of employees) {
    let needsUpdate = false;
    let encryptedValue = emp.national_id_value;
    let encryptedIqama = emp.national_id_iqama;

    // Check if national_id_value needs encryption (not already in our format)
    if (emp.national_id_value && !emp.national_id_value.includes(':')) {
      encryptedValue = auth.encrypt(emp.national_id_value);
      needsUpdate = true;
    }

    // Check if national_id_iqama needs encryption
    if (emp.national_id_iqama && !emp.national_id_iqama.includes(':')) {
      encryptedIqama = auth.encrypt(emp.national_id_iqama);
      needsUpdate = true;
    }

    if (needsUpdate) {
      await db.query(`UPDATE employees SET 
        national_id_value = ${db.escapeString(encryptedValue)}, 
        national_id_iqama = ${db.escapeString(encryptedIqama)} 
        WHERE id = ${db.escapeString(emp.id)}`);
      console.log(`Encrypted IDs for employee: ${emp.id}`);
    }
  }

  console.log('Migration complete.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
