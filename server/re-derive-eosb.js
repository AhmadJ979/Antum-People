const db = require('./db');
const { calculateEOSB } = require('./eosb');

async function reDerive() {
  console.log('Re-deriving EOSB for all employees...');
  const employees = await db.query('SELECT * FROM employees');
  
  for (const emp of employees) {
    const eosbAccrued = calculateEOSB(
      emp.start_date,
      emp.end_date,
      emp.basic_salary || 0,
      emp.salary || 0,
      emp.data_residency_country || 'AE',
      emp.termination_type || 'resignation',
      emp.unpaid_leave_days || 0
    );
    
    await db.query(`UPDATE employees SET eosb_accrued = ${eosbAccrued} WHERE id = ${db.escapeString(emp.id)}`);
    console.log(`Updated ${emp.first_name} ${emp.last_name}: ${eosbAccrued}`);
  }
  
  // Also update some recruitment costs and TTV dates to make demo look good
  console.log('Updating sample metrics...');
  
  // Employee 1: recruitment cost 5000, fully productive after 10 days
  const emp1 = employees[0];
  const prodDate1 = new Date(new Date(emp1.start_date).getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  await db.query(`UPDATE employees SET recruitment_cost = 5000, fully_productive_date = ${db.escapeString(prodDate1)} WHERE id = ${db.escapeString(emp1.id)}`);

  // Employee 2: recruitment cost 7500, fully productive after 20 days
  const emp2 = employees[1];
  const prodDate2 = new Date(new Date(emp2.start_date).getTime() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  await db.query(`UPDATE employees SET recruitment_cost = 7500, fully_productive_date = ${db.escapeString(prodDate2)} WHERE id = ${db.escapeString(emp2.id)}`);

  console.log('Sample data updated.');
}

reDerive().catch(console.error);
