const db = require('../server/db');
const eosb = require('../server/eosb');

async function seed() {
  if (process.env.DEMO_SEED !== 'true') {
    console.error('Safety check failed: DEMO_SEED=true environment variable must be set to run this script.');
    console.error('This script wipes data and is intended for demo environments only.');
    process.exit(1);
  }

  console.log('Cleaning up existing data...');
  // Delete in order to respect foreign keys
  await db.query('DELETE FROM onboarding_tasks');
  await db.query('DELETE FROM offboarding_tasks');
  await db.query('DELETE FROM exit_interviews');
  await db.query('DELETE FROM audit_logs');
  await db.query('DELETE FROM consent_records');
  await db.query('DELETE FROM employees');

  const employees = [
    {
      first_name: 'Ahmad',
      last_name: 'Al-Rashid',
      email: 'ahmad.alrashid@example.com',
      department: 'Engineering',
      role: 'QA Engineer',
      start_date: '2024-01-15',
      salary: 15000,
      basic_salary: 10000,
      recruitment_cost: 8000,
      data_residency_country: 'AE',
      status: 'active',
      fully_productive_date: '2024-02-01'
    },
    {
      first_name: 'Fatima',
      last_name: 'Al-Zahrani',
      email: 'fatima.alzahrani@example.com',
      department: 'HR',
      role: 'HR Business Partner',
      start_date: '2023-05-10',
      salary: 18000,
      basic_salary: 12000,
      recruitment_cost: 5000,
      data_residency_country: 'SA',
      status: 'active',
      fully_productive_date: '2023-05-25'
    },
    {
      first_name: 'Omar',
      last_name: 'Al-Farsi',
      email: 'omar.alfarsi@example.com',
      department: 'Finance',
      role: 'Finance Analyst',
      start_date: '2025-03-20',
      salary: 14000,
      basic_salary: 9500,
      recruitment_cost: 6000,
      data_residency_country: 'AE',
      status: 'onboarding',
      fully_productive_date: null
    },
    {
      first_name: 'Layla',
      last_name: 'Bin Jassim',
      email: 'layla.jassim@example.com',
      department: 'Operations',
      role: 'Operations Supervisor',
      start_date: '2022-11-01',
      salary: 16000,
      basic_salary: 11000,
      recruitment_cost: 7000,
      data_residency_country: 'SA',
      status: 'active',
      fully_productive_date: '2022-11-15'
    },
    {
      first_name: 'Hassan',
      last_name: 'Al-Mansoori',
      email: 'hassan.mansoori@example.com',
      department: 'Engineering',
      role: 'Software Developer',
      start_date: '2024-06-01',
      salary: 20000,
      basic_salary: 14000,
      recruitment_cost: 10000,
      data_residency_country: 'AE',
      status: 'active',
      fully_productive_date: '2024-06-20'
    },
    {
      first_name: 'Sarah',
      last_name: 'Al-Qasimi',
      email: 'sarah.qasimi@example.com',
      department: 'Marketing',
      role: 'Recruitment Specialist',
      start_date: '2023-09-12',
      salary: 13000,
      basic_salary: 9000,
      recruitment_cost: 4000,
      data_residency_country: 'SA',
      status: 'offboarding',
      fully_productive_date: '2023-09-30'
    },
    {
      first_name: 'Mohammed',
      last_name: 'Al-Sayed',
      email: 'mohammed.sayed@example.com',
      department: 'Product',
      role: 'Project Manager',
      start_date: '2024-02-15',
      salary: 17000,
      basic_salary: 11500,
      recruitment_cost: 9000,
      data_residency_country: 'AE',
      status: 'active',
      fully_productive_date: '2024-03-05'
    },
    {
      first_name: 'Reem',
      last_name: 'Al-Hashemi',
      email: 'reem.hashemi@example.com',
      department: 'Customer Support',
      role: 'Support Specialist',
      start_date: '2025-01-10',
      salary: 11000,
      basic_salary: 8000,
      recruitment_cost: 3000,
      data_residency_country: 'SA',
      status: 'active',
      fully_productive_date: '2025-01-25'
    }
  ];

  for (const emp of employees) {
    const id = require('crypto').randomUUID();
    const eosbAccrued = eosb.calculateEOSB(
      emp.start_date,
      null, // Current accrual
      emp.basic_salary,
      emp.salary,
      emp.data_residency_country,
      'resignation',
      0
    );

    const sql = `
      INSERT INTO employees (
        id, first_name, last_name, email, department, role, start_date,
        status, salary, basic_salary, recruitment_cost, data_residency_country,
        eosb_accrued, fully_productive_date, consent_granted
      ) VALUES (
        ${db.escapeString(id)}, ${db.escapeString(emp.first_name)}, ${db.escapeString(emp.last_name)},
        ${db.escapeString(emp.email)}, ${db.escapeString(emp.department)}, ${db.escapeString(emp.role)},
        ${db.escapeString(emp.start_date)}, ${db.escapeString(emp.status)}, ${emp.salary}, ${emp.basic_salary},
        ${emp.recruitment_cost}, ${db.escapeString(emp.data_residency_country)}, ${eosbAccrued},
        ${db.escapeString(emp.fully_productive_date)}, 1
      )
    `;

    await db.query(sql);
    console.log(`Seeded ${emp.first_name} ${emp.last_name} with EOSB: ${eosbAccrued} ${emp.data_residency_country === 'SA' ? 'SAR' : 'AED'}`);
  }

  console.log('Seeding completed successfully.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
