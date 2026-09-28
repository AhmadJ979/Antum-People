const eosb = require('../server/eosb');
const db = require('../server/db');

async function test() {
  const [emp] = await db.query("SELECT * FROM employees WHERE id = 'demo-emp-sarah'");
  console.log('--- Employee Record ---');
  console.log('ID: ' + emp.id);
  console.log('Name: ' + emp.first_name + ' ' + emp.last_name);
  console.log('EOSB Accrued (DB): ' + emp.eosb_accrued);
  
  const eosbValue = emp.eosb_accrued;
  
  console.log('\n--- Rendered Line Simulation ---');
  console.log('End-of-Service Gratuity: SAR ' + eosbValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  
  const [consent] = await db.query("SELECT * FROM consent_records WHERE employee_id = 'demo-emp-sarah'");
  console.log('\n--- Compliance Center Simulation ---');
  console.log('✓ GRANTED ON ' + (consent ? consent.consent_date.split(' ')[0] : 'null'));
}

test();
