const db = require('../server/db');
const eosb = require('../server/eosb');

async function seed() {
  const forceClear = process.argv.includes('--force-clear');
  
  console.log('--- Antum People Coherent Demo Seed v2 ---');
  console.log('NOTE: The app database is the SHARED team database.');
  console.log('This script is NON-DESTRUCTIVE by default (uses upsert).');
  
  if (process.env.DEMO_SEED !== 'true') {
    console.error('ERROR: DEMO_SEED=true environment variable must be set to run this script.');
    process.exit(1);
  }

  // 1. Employee Personas (Deterministic IDs for linking and idempotency)
  const personas = [
    {
      id: 'demo-emp-ahmad',
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
      id: 'demo-emp-fatima',
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
      id: 'demo-emp-omar',
      first_name: 'Omar',
      last_name: 'Al-Farsi',
      email: 'omar.alfarsi@example.com',
      department: 'Finance',
      role: 'Finance Analyst',
      start_date: '2026-03-20',
      salary: 14000,
      basic_salary: 9500,
      recruitment_cost: 6000,
      data_residency_country: 'AE',
      status: 'onboarding',
      fully_productive_date: '2026-04-05'
    },
    {
      id: 'demo-emp-leila',
      first_name: 'Leila',
      last_name: 'Mansour',
      email: 'leila.mansour@example.com',
      department: 'Engineering',
      role: 'Frontend Lead',
      start_date: '2022-03-01',
      salary: 25000,
      basic_salary: 17000,
      recruitment_cost: 12000,
      data_residency_country: 'AE',
      status: 'active',
      fully_productive_date: '2022-03-15'
    },
    {
      id: 'demo-emp-khalid',
      first_name: 'Khalid',
      last_name: 'Al-Dosari',
      email: 'khalid.dosari@example.com',
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
      id: 'demo-emp-hassan',
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
      id: 'demo-emp-sarah',
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
      id: 'demo-emp-mohammed',
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
      id: 'demo-emp-reem',
      first_name: 'Reem',
      last_name: 'Al-Hashemi',
      email: 'reem.hashemi@example.com',
      department: 'Customer Support',
      role: 'Support Specialist',
      start_date: '2026-01-10',
      salary: 11000,
      basic_salary: 8000,
      recruitment_cost: 3000,
      data_residency_country: 'SA',
      status: 'active',
      fully_productive_date: '2026-01-25'
    }
  ];

  if (forceClear) {
    console.log('FORCE CLEAR: Deleting existing demo data...');
    await db.query("DELETE FROM onboarding_tasks WHERE employee_id LIKE 'demo-emp-%'");
    await db.query("DELETE FROM offboarding_tasks WHERE employee_id LIKE 'demo-emp-%'");
    await db.query("DELETE FROM exit_interviews WHERE employee_id LIKE 'demo-emp-%'");
    await db.query("DELETE FROM audit_logs WHERE entity_id LIKE 'demo-emp-%' OR entity_id LIKE 'demo-task-%' OR entity_id LIKE 'demo-exit-%'");
    await db.query("DELETE FROM consent_records WHERE employee_id LIKE 'demo-emp-%'");
    await db.query("DELETE FROM employees WHERE id LIKE 'demo-emp-%' OR email LIKE '%@example.com'");
  }

  console.log('Upserting demo employees...');
  for (const emp of personas) {
    const eosbAccrued = eosb.calculateEOSB(
      emp.start_date,
      null,
      emp.basic_salary,
      emp.salary,
      emp.data_residency_country,
      'resignation',
      0
    );

    // INSERT OR REPLACE for idempotency
    const sql = `
      INSERT OR REPLACE INTO employees (
        id, first_name, last_name, email, department, role, start_date,
        status, salary, basic_salary, recruitment_cost, data_residency_country,
        eosb_accrued, fully_productive_date, consent_granted, created_at, updated_at
      ) VALUES (
        ${db.escapeString(emp.id)}, ${db.escapeString(emp.first_name)}, ${db.escapeString(emp.last_name)},
        ${db.escapeString(emp.email)}, ${db.escapeString(emp.department)}, ${db.escapeString(emp.role)},
        ${db.escapeString(emp.start_date)}, ${db.escapeString(emp.status)}, ${emp.salary}, ${emp.basic_salary},
        ${emp.recruitment_cost}, ${db.escapeString(emp.data_residency_country)}, ${eosbAccrued},
        ${db.escapeString(emp.fully_productive_date)}, 1, '2026-09-23 09:00:00', '2026-09-23 09:00:00'
      )
    `;
    await db.query(sql);
    console.log(`- Upserted ${emp.first_name} ${emp.last_name}`);
  }

  // 2. Onboarding Tasks (for Omar)
  console.log('Upserting onboarding tasks...');
  const onboardingTasks = [
    { id: 'demo-task-1', emp_id: 'demo-emp-omar', title: 'MoHRE Contract Signing', status: 'completed', due: '2026-03-22', done: '2026-03-21' },
    { id: 'demo-task-2', emp_id: 'demo-emp-omar', title: 'Medical Insurance Application', status: 'pending', due: '2026-03-25', done: null },
    { id: 'demo-task-3', emp_id: 'demo-emp-omar', title: 'Visa Stamping', status: 'pending', due: '2026-04-01', done: null }
  ];

  for (const t of onboardingTasks) {
    const sql = `
      INSERT OR REPLACE INTO onboarding_tasks (id, employee_id, title, status, due_date, completed_at, created_at)
      VALUES (${db.escapeString(t.id)}, ${db.escapeString(t.emp_id)}, ${db.escapeString(t.title)}, 
      ${db.escapeString(t.status)}, ${db.escapeString(t.due)}, ${t.done ? db.escapeString(t.done) : 'NULL'}, '2026-03-20 10:00:00')
    `;
    await db.query(sql);
  }

  // 3. Offboarding / Exit Interview (for Sarah)
  console.log('Upserting offboarding data...');
  const exitInterview = {
    id: 'demo-exit-1',
    employee_id: 'demo-emp-sarah',
    interview_date: '2026-09-24',
    departure_reason: 'Better Opportunity',
    detailed_feedback: 'Loved the team, but found a role closer to home with higher allowance.',
    satisfaction_score: 4
  };

  await db.query(`
    INSERT OR REPLACE INTO exit_interviews (id, employee_id, interview_date, departure_reason, detailed_feedback, satisfaction_score)
    VALUES (${db.escapeString(exitInterview.id)}, ${db.escapeString(exitInterview.employee_id)}, 
    ${db.escapeString(exitInterview.interview_date)}, ${db.escapeString(exitInterview.departure_reason)}, 
    ${db.escapeString(exitInterview.detailed_feedback)}, ${exitInterview.satisfaction_score})
  `);

  // 4. Audit Logs
  console.log('Upserting audit logs...');
  const auditLogs = [
    { id: 'demo-log-1', entity: 'employee', entity_id: 'demo-emp-omar', action: 'CREATE', perf: 'admin', ts: '2026-03-20 09:00:00' },
    { id: 'demo-log-2', entity: 'exit_interview', entity_id: 'demo-exit-1', action: 'CREATE', perf: 'admin', ts: '2026-09-24 14:00:00' },
    { id: 'demo-log-3', entity: 'employee', entity_id: 'demo-emp-sarah', action: 'OFFBOARD_START', perf: 'admin', ts: '2026-09-23 11:00:00' }
  ];

  for (const l of auditLogs) {
    await db.query(`
      INSERT OR REPLACE INTO audit_logs (id, entity_type, entity_id, action, performed_by, timestamp)
      VALUES (${db.escapeString(l.id)}, ${db.escapeString(l.entity)}, ${db.escapeString(l.entity_id)}, 
      ${db.escapeString(l.action)}, ${db.escapeString(l.perf)}, ${db.escapeString(l.ts)})
    `);
  }

  // 5. Consent Records
  console.log('Upserting consent records...');
  for (const emp of personas) {
    await db.query(`
      INSERT OR REPLACE INTO consent_records (id, employee_id, consent_type, status, consent_date)
      VALUES (${db.escapeString('demo-consent-' + emp.id)}, ${db.escapeString(emp.id)}, 'PDPL_DATA_PROCESSING', 'granted', '2026-09-23 09:00:00')
    `);
  }

  console.log('Seeding completed successfully.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
