const db = require('../server/db');
const eosb = require('../server/eosb');
const compliance = require('../server/compliance_engine');
const auth = require('../server/auth');

/**
 * Antum People Coherent Demo Seed v3.1
 * 
 * NOTE: This script targets the PRODUCT database (managed via server/db.js).
 * It is NON-DESTRUCTIVE by default (uses upsert-by-key).
 * Bulk deletion is only performed if the --force-clear flag is provided.
 * 
 * Deliverable 2 & 3: Deterministic demo dataset + Demo credential management.
 * Fix: Jurisdiction, total_salary, and offboarding pipeline population.
 */

async function seed() {
  const forceClear = process.argv.includes('--force-clear');
  
  console.log('--- Antum People Coherent Demo Seed v3.1 ---');
  console.log('Targeting: Product-owned SQLite database');
  
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
      start_date: '2026-08-20',
      salary: 14000,
      basic_salary: 9500,
      recruitment_cost: 6000,
      data_residency_country: 'AE',
      status: 'onboarding',
      // Genuinely mid-onboarding: not yet fully productive.
      fully_productive_date: null
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
      end_date: '2026-09-30',
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
      start_date: '2026-08-05',
      salary: 11000,
      basic_salary: 8000,
      recruitment_cost: 3000,
      data_residency_country: 'AE',
      status: 'onboarding',
      // Genuinely mid-onboarding: not yet fully productive. Pairs with Omar (UAE) as
      // the demo's two coherent in-flight hires. UAE-first (owner direction,
      // 2026-10-02): both in-flight hires are UAE so the pipeline card still has two
      // people once the active surface goes UAE-only. Dates/status unchanged from the
      // earlier seed — only the jurisdiction moved.
      fully_productive_date: null
    }
  ];

  // Historical leavers: additional to the 9-person active roster above (which must stay
  // at 9 — the walkthrough describes nine active employees). These exist so retention
  // cohort math has real, varied data to compute instead of trivially reading 100%
  // everywhere. Because their liability is settled, they are excluded from the active
  // EOSB liability and headcount cards (server/index.js filters them out explicitly) —
  // only the retention cohort calculation, which intentionally looks at history, counts
  // them. UAE-first (owner direction, 2026-10-02): both leavers are UAE so the retention
  // cohort dips they create still show once the active surface goes UAE-only.
  const historicalLeavers = [
    {
      id: 'demo-emp-yusuf',
      first_name: 'Yusuf',
      last_name: 'Hassan',
      email: 'yusuf.hassan@example.com',
      department: 'Operations',
      role: 'Logistics Coordinator',
      start_date: '2023-03-10',
      end_date: '2023-08-25', // ~168 days — leaves this cohort genuinely below 100%.
      salary: 12000,
      basic_salary: 8000,
      recruitment_cost: 4000,
      data_residency_country: 'AE',
      status: 'terminated',
      fully_productive_date: null
    },
    {
      id: 'demo-emp-sultan',
      first_name: 'Sultan',
      last_name: 'Al-Harbi',
      email: 'sultan.harbi@example.com',
      department: 'Engineering',
      role: 'Junior Developer',
      start_date: '2024-03-05',
      end_date: '2024-09-01', // ~180 days — same treatment in a second cohort. Dates/
      // status unchanged from the earlier seed — only the jurisdiction moved to AE.
      salary: 14000,
      basic_salary: 9500,
      recruitment_cost: 6000,
      data_residency_country: 'AE',
      status: 'terminated',
      fully_productive_date: null
    }
  ];

  const allEmployees = [...personas, ...historicalLeavers];

  if (forceClear) {
    console.log('FORCE CLEAR: Deleting existing demo data...');
    // Sequence matters for foreign keys
    await db.query("DELETE FROM onboarding_tasks WHERE employee_id LIKE 'demo-emp-%'");
    await db.query("DELETE FROM offboarding_tasks WHERE employee_id LIKE 'demo-emp-%'");
    await db.query("DELETE FROM exit_interviews WHERE employee_id LIKE 'demo-emp-%'");
    await db.query("DELETE FROM analytics_metrics WHERE employee_id LIKE 'demo-emp-%'");
    await db.query("DELETE FROM audit_logs WHERE entity_id LIKE 'demo-emp-%' OR entity_id LIKE 'demo-task-%' OR entity_id LIKE 'demo-exit-%'");
    await db.query("DELETE FROM consent_records WHERE employee_id LIKE 'demo-emp-%'");
    await db.query("DELETE FROM employees WHERE id LIKE 'demo-emp-%' OR email LIKE '%@example.com'");
  }

  console.log('Upserting demo employees...');
  for (const emp of allEmployees) {
    // Lead feedback: Match jurisdiction to data_residency_country and set total_salary
    const jurisdiction = emp.data_residency_country; // 'AE' or 'SA'
    const totalSalary = emp.salary;

    // Terminated leavers accrue as of their actual exit date, not "today" — the active
    // EOSB liability cards exclude them anyway (server/index.js), but the stored figure
    // should still reflect what was actually owed at departure, computed by the same
    // engine as everyone else (no manual overrides).
    const eosbAccrued = eosb.calculateEOSB(
      emp.start_date,
      emp.end_date || null,
      emp.basic_salary,
      emp.salary,
      emp.data_residency_country,
      'resignation',
      0
    );

    // INSERT OR REPLACE for idempotency
    const sql = `
      INSERT OR REPLACE INTO employees (
        id, first_name, last_name, email, department, role, start_date, end_date,
        status, salary, basic_salary, recruitment_cost, data_residency_country,
        jurisdiction, total_salary, national_id_value,
        eosb_accrued, fully_productive_date, consent_granted, consent_date, created_at, updated_at
      ) VALUES (
        ${db.escapeString(emp.id)}, ${db.escapeString(emp.first_name)}, ${db.escapeString(emp.last_name)},
        ${db.escapeString(emp.email)}, ${db.escapeString(emp.department)}, ${db.escapeString(emp.role)},
        ${db.escapeString(emp.start_date)}, ${db.escapeString(emp.end_date || null)},
        ${db.escapeString(emp.status)}, ${emp.salary}, ${emp.basic_salary},
        ${emp.recruitment_cost}, ${db.escapeString(emp.data_residency_country)},
        ${db.escapeString(jurisdiction)}, ${totalSalary}, ${db.escapeString(auth.encrypt('ID-' + emp.id))},
        ${eosbAccrued},
        ${db.escapeString(emp.fully_productive_date)}, 1, ${db.escapeString('2026-09-23')}, '2026-09-23 09:00:00', '2026-09-23 09:00:00'
      )
    `;
    await db.query(sql);
    console.log(`- Upserted ${emp.first_name} ${emp.last_name} (${jurisdiction})`);
  }

  // 2. Onboarding Tasks
  console.log('Upserting onboarding tasks...');
  const onboardingTasks = [];

  // Omar (UAE) — started 2026-08-20, two tasks done so far, five still open.
  compliance.checklistTemplates.UAE.onboarding.forEach((t, idx) => {
    onboardingTasks.push({
      id: `demo-task-on-omar-${idx+1}`,
      emp_id: 'demo-emp-omar',
      title: t.title,
      status: idx < 2 ? 'completed' : 'pending',
      due: '2026-09-10',
      done: idx < 2 ? '2026-08-25' : null
    });
  });

  // Reem (UAE) — started 2026-08-05, two tasks done so far, five still open.
  // UAE-first (owner direction, 2026-10-02): checklist source switched from KSA to
  // UAE to match her jurisdiction move above; same 7-item length, same completion
  // split, so her place in the onboarding pipeline is unaffected.
  compliance.checklistTemplates.UAE.onboarding.forEach((t, idx) => {
    onboardingTasks.push({
      id: `demo-task-on-reem-${idx+1}`,
      emp_id: 'demo-emp-reem',
      title: t.title,
      status: idx < 2 ? 'completed' : 'pending',
      due: '2026-09-05',
      done: idx < 2 ? '2026-08-12' : null
    });
  });

  // Ahmad (UAE - all completed)
  compliance.checklistTemplates.UAE.onboarding.forEach((t, idx) => {
    onboardingTasks.push({
      id: `demo-task-on-ahmad-${idx+1}`,
      emp_id: 'demo-emp-ahmad',
      title: t.title,
      status: 'completed',
      due: '2024-01-20',
      done: '2024-01-18'
    });
  });

  for (const t of onboardingTasks) {
    const sql = `
      INSERT OR REPLACE INTO onboarding_tasks (id, employee_id, title, status, due_date, completed_at, created_at)
      VALUES (${db.escapeString(t.id)}, ${db.escapeString(t.emp_id)}, ${db.escapeString(t.title)},
      ${db.escapeString(t.status)}, ${db.escapeString(t.due)}, ${t.done ? db.escapeString(t.done) : 'NULL'}, '2026-03-20 10:00:00')
    `;
    await db.query(sql);
  }

  // 3. Offboarding Tasks (for Sarah)
  console.log('Upserting offboarding tasks...');
  const offboardingTasks = [];
  compliance.checklistTemplates.KSA.offboarding.forEach((t, idx) => {
    offboardingTasks.push({
      id: `demo-task-off-ksa-${idx+1}`,
      emp_id: 'demo-emp-sarah',
      title: t.title,
      status: idx < 2 ? 'completed' : 'pending',
      due: '2026-09-30',
      done: idx < 2 ? '2026-09-24' : null
    });
  });

  for (const t of offboardingTasks) {
    const sql = `
      INSERT OR REPLACE INTO offboarding_tasks (id, employee_id, title, status, due_date, completed_at, created_at)
      VALUES (${db.escapeString(t.id)}, ${db.escapeString(t.emp_id)}, ${db.escapeString(t.title)},
      ${db.escapeString(t.status)}, ${db.escapeString(t.due)}, ${t.done ? db.escapeString(t.done) : 'NULL'}, '2026-09-23 11:00:00')
    `;
    await db.query(sql);
  }

  // 4. Exit Interviews (Sarah's pre-departure interview, plus one per historical leaver
  // — both UAE now, per the UAE-first jurisdiction move above)
  console.log('Upserting exit interviews...');
  const exitInterviews = [
    {
      id: 'demo-exit-1',
      employee_id: 'demo-emp-sarah',
      interview_date: '2026-09-24',
      departure_reason: 'Better Opportunity',
      detailed_feedback: 'Loved the team, but found a role closer to home with higher allowance.',
      satisfaction_score: 4
    },
    {
      id: 'demo-exit-2',
      employee_id: 'demo-emp-yusuf',
      interview_date: '2023-08-25',
      departure_reason: 'Career Change',
      detailed_feedback: 'Moving to a different industry.',
      satisfaction_score: 3
    },
    {
      id: 'demo-exit-3',
      employee_id: 'demo-emp-sultan',
      interview_date: '2024-09-01',
      departure_reason: 'Relocation',
      detailed_feedback: 'Moving out of the region for family reasons.',
      satisfaction_score: 4
    }
  ];

  for (const ex of exitInterviews) {
    await db.query(`
      INSERT OR REPLACE INTO exit_interviews (id, employee_id, interview_date, departure_reason, detailed_feedback, satisfaction_score)
      VALUES (${db.escapeString(ex.id)}, ${db.escapeString(ex.employee_id)},
      ${db.escapeString(ex.interview_date)}, ${db.escapeString(ex.departure_reason)},
      ${db.escapeString(ex.detailed_feedback)}, ${ex.satisfaction_score})
    `);
  }

  // 5. Audit Logs
  console.log('Upserting audit logs...');
  const auditLogs = [
    { id: 'demo-log-1', entity: 'employee', entity_id: 'demo-emp-omar', action: 'CREATE', perf: 'admin', ts: '2026-08-20 09:00:00' },
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

  // 6. Consent Records
  console.log('Upserting consent records...');
  for (const emp of allEmployees) {
    await db.query(`
      INSERT OR REPLACE INTO consent_records (id, employee_id, consent_type, status, consent_date)
      VALUES (${db.escapeString('demo-consent-' + emp.id)}, ${db.escapeString(emp.id)}, 'PDPL_DATA_PROCESSING', 'granted', '2026-09-23 09:00:00')
    `);
  }

  // 7. Users (Deliverable 3: Demo credential stays the lead's)
  const adminHash = process.env.DEMO_ADMIN_PASSWORD_HASH;
  if (adminHash) {
    console.log('Upserting demo admin user...');
    await db.query(`
      INSERT OR REPLACE INTO users (id, username, password_hash, role)
      VALUES ('demo-admin-id', 'admin', ${db.escapeString(adminHash)}, 'admin')
    `);
  } else {
    console.warn('WARNING: DEMO_ADMIN_PASSWORD_HASH not set. Admin user not created/updated.');
  }

  console.log('Seeding completed successfully.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
