const db = require('../server/db');
const eosb = require('../server/eosb');
const compliance = require('../server/compliance_engine');
const auth = require('../server/auth');
// Layer 2 (P2-2): the demo's pre-boarding cases are created through the product's own single
// case-creation path and item model. The seed writes no pre-boarding case or item row by hand,
// so the demo cannot drift from the behaviour a real caller gets.
const preboarding = require('../server/preboarding');
const preboardingItems = require('../server/preboarding-items');

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
      data_residency_country: 'SA',
      status: 'onboarding',
      // Genuinely mid-onboarding: not yet fully productive. Pairs with Omar (UAE) as
      // the demo's two coherent in-flight hires — UAE first, then KSA.
      // Kept KSA (2026-10-02): the task this seed change comes from requires "Leave KSA
      // alone … the KSA surface must keep computing as it does today". Moving an
      // existing KSA record to AE to give the UAE pipeline card a second person is the
      // same error class as pinning a figure so a card reads a certain way: it shrinks
      // the KSA surface (headcount, liability) that Phase 2 still has to test against.
      // The UAE pipeline really does show one person in flight; that is reported with
      // its number rather than patched here.
      fully_productive_date: null
    },
    {
      // Reviewer follow-up (2026-10-02, PR #50): the UAE-only surface had no offboarding
      // example — the walkthrough opens on offboarding, and the only in-progress case
      // was Sarah (KSA). This gives UAE its own credible, in-flight offboarding case.
      id: 'demo-emp-noura',
      first_name: 'Noura',
      last_name: 'Al-Suwaidi',
      email: 'noura.alsuwaidi@example.com',
      department: 'Sales',
      role: 'Account Manager',
      start_date: '2024-04-10',
      salary: 16000,
      basic_salary: 11000,
      recruitment_cost: 7000,
      data_residency_country: 'AE',
      status: 'offboarding',
      end_date: '2026-10-10',
      fully_productive_date: '2024-05-01'
    },
    {
      // Reviewer follow-up (2026-10-02, PR #50): a second UAE hire in the same H1 2023
      // cohort as the Yusuf leaver, who stayed past a year. Without this, UAE-only
      // showed a 1-person, 0%-retention cohort, which reads as broken data rather than
      // a real (if small) attrition event.
      id: 'demo-emp-salim',
      first_name: 'Salim',
      last_name: 'Al-Nuaimi',
      email: 'salim.alnuaimi@example.com',
      department: 'Finance',
      role: 'Senior Accountant',
      start_date: '2023-04-15',
      salary: 19000,
      basic_salary: 13000,
      recruitment_cost: 6000,
      data_residency_country: 'AE',
      status: 'active',
      fully_productive_date: '2023-05-10'
    }
  ];

  // Historical leavers: additional to the active roster above. Noura and Salim were
  // added to that roster above at the owner's direction (2026-10-02, task 0cf9c2fd);
  // these two leavers are pre-existing. They exist so retention cohort math has real,
  // varied data to compute instead of trivially reading 100% everywhere. Because their
  // liability is settled, they are excluded from the active EOSB liability and headcount
  // cards (server/index.js filters them out explicitly) — only the retention cohort
  // calculation, which intentionally looks at history, counts them. Yusuf is UAE (the
  // UAE cohort dip he creates still shows on the UAE-only surface); Sultan is KSA and
  // stays KSA, so the KSA surface keeps computing exactly as it did before this change.
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
      end_date: '2024-09-01', // ~180 days — same treatment in a second cohort.
      salary: 14000,
      basic_salary: 9500,
      recruitment_cost: 6000,
      data_residency_country: 'SA', // kept KSA — see the note on demo-emp-reem above
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
    // Layer 2 demo cases, keyed by their own offer references so the clear cannot reach a case
    // the product created from a real intake submission.
    await db.query("DELETE FROM preboarding_items WHERE case_id IN (SELECT id FROM preboarding_cases WHERE offer_reference LIKE 'OFR-2026-DEMO-%')");
    await db.query("DELETE FROM preboarding_reminders WHERE case_id IN (SELECT id FROM preboarding_cases WHERE offer_reference LIKE 'OFR-2026-DEMO-%')");
    await db.query("DELETE FROM preboarding_consents WHERE case_id IN (SELECT id FROM preboarding_cases WHERE offer_reference LIKE 'OFR-2026-DEMO-%')");
    await db.query("DELETE FROM preboarding_cases WHERE offer_reference LIKE 'OFR-2026-DEMO-%'");
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

  // Reem (KSA) — started 2026-08-05, two tasks done so far, five still open. Checklist
  // sourced from the KSA template because she stayed KSA (see the note on her persona).
  compliance.checklistTemplates.KSA.onboarding.forEach((t, idx) => {
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

  // 3. Offboarding Tasks (for Sarah, KSA; Noura, UAE — added per reviewer follow-up so
  // the UAE-only surface has its own in-progress offboarding example)
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

  compliance.checklistTemplates.UAE.offboarding.forEach((t, idx) => {
    offboardingTasks.push({
      id: `demo-task-off-uae-${idx+1}`,
      emp_id: 'demo-emp-noura',
      title: t.title,
      status: idx < 2 ? 'completed' : 'pending',
      due: '2026-10-10',
      done: idx < 2 ? '2026-10-01' : null
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

  // 4. Exit Interviews (Sarah's and Noura's pre-departure interviews, plus one per
  // historical leaver; jurisdiction follows each person's own record)
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
    },
    {
      id: 'demo-exit-4',
      employee_id: 'demo-emp-noura',
      interview_date: '2026-10-01',
      departure_reason: 'Better Opportunity',
      detailed_feedback: 'Moving to a larger account portfolio at another firm.',
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

  // 7. Layer 2 — pre-boarding demo cases (owner decision, 2026-10-07)
  //
  // Three cases, one per state the Pre-boarding screen has to show. Nothing here stores a flag:
  // Gate 2 (2026-10-07) decided the 48-hour flag is DERIVED from the start date and the item
  // statuses, so these dates and statuses are the whole input and the states arise by
  // construction when the surface reads them. P2-5 builds the flag and its notification; the
  // seed does neither, and adds no column to hold a state.
  //
  // Every date is an offset from the seed's own reference date, so what is fixed here is the
  // offset, not the date: the demo still reads "14 days out", "inside 48 hours" and "start date
  // already passed" whenever the seed runs.
  console.log('Upserting Layer 2 pre-boarding demo cases...');

  const dayOffset = (days) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  // Case 1 is the roster's own in-flight UAE hire, read back out of the row this seed just
  // upserted — that row's real id, not a lookalike name and not a new hire standing in for
  // them. preboarding_cases has no employee_id column and this change may not alter the
  // schema, so the pointer is the roster id carried in `source` (a column the case-creation
  // path already takes from its caller), together with the person's own name, email, role,
  // department and jurisdiction copied from the row rather than retyped.
  const rosterHireId = 'demo-emp-omar';
  const rosterHire = (await db.query(
    `SELECT * FROM employees WHERE id = ${db.escapeString(rosterHireId)}`
  ))[0];
  if (!rosterHire) {
    throw new Error(`Seed is inconsistent: ${rosterHireId} is not in the roster this seed writes`);
  }

  const demoCases = [
    {
      offer_reference: 'OFR-2026-DEMO-01',
      source: `roster:${rosterHireId}`,
      candidate_name: `${rosterHire.first_name} ${rosterHire.last_name}`,
      candidate_email: rosterHire.email,
      role: rosterHire.role,
      department: rosterHire.department,
      // The roster row carries no reporting line; the case requires one, so the seed states a
      // demo one derived from the department instead of inventing a named manager.
      reporting_line: `Head of ${rosterHire.department}`,
      jurisdiction: rosterHire.jurisdiction,
      offset_days: 14,
      request_items: ['passport', 'visa_or_entry_permit', 'emirates_id'],
      state: 'on track — 14 days out, three items requested, none verified',
    },
    {
      offer_reference: 'OFR-2026-DEMO-02',
      source: 'demo_seed',
      candidate_name: 'Mariam Al-Kaabi',
      candidate_email: 'mariam.alkaabi@example.com',
      role: 'Marketing Coordinator',
      department: 'Marketing',
      reporting_line: 'Head of Marketing',
      jurisdiction: 'AE',
      offset_days: 1,
      request_items: [],
      state: 'inside 48 hours with every item still open',
    },
    {
      offer_reference: 'OFR-2026-DEMO-03',
      source: 'demo_seed',
      candidate_name: 'Yousef Al-Hammadi',
      candidate_email: 'yousef.alhammadi@example.com',
      role: 'Operations Analyst',
      department: 'Operations',
      reporting_line: 'Head of Operations',
      jurisdiction: 'AE',
      offset_days: -1,
      request_items: [],
      state: 'start date already passed, items still open',
    },
  ];

  for (const demoCase of demoCases) {
    const startDate = dayOffset(demoCase.offset_days);
    const { case: caseRow, created } = await preboarding.recordOfferAcceptance({
      offer_reference: demoCase.offer_reference,
      candidate_name: demoCase.candidate_name,
      candidate_email: demoCase.candidate_email,
      role: demoCase.role,
      department: demoCase.department,
      reporting_line: demoCase.reporting_line,
      jurisdiction: demoCase.jurisdiction,
      start_date: startDate,
    }, { source: demoCase.source, actor: 'demo-seed' });

    // A replay must not leave a demo case showing a stale start date — the offset is what is
    // fixed, so re-seeding later has to move the date with it. The case-creation path
    // deliberately never rewrites a case that exists, so the seed refreshes the date on the
    // three rows it owns, and says so in the log.
    if (!created && caseRow.start_date !== startDate) {
      await db.query(`
        UPDATE preboarding_cases SET start_date = ${db.escapeString(startDate)},
          updated_at = CURRENT_TIMESTAMP
        WHERE offer_reference = ${db.escapeString(demoCase.offer_reference)}
      `);
      caseRow.start_date = startDate;
      console.log(`- Refreshed ${caseRow.offer_reference} start date to ${startDate}`);
    }

    // Items move through the product's own transition function, never by direct write. Only
    // not_started -> requested is used here: nothing in the demo holds a collected document,
    // so no case needs a consent record, and the PDPL gate on received stays demonstrable.
    for (const itemKey of demoCase.request_items) {
      const item = await preboardingItems.getItem(caseRow.id, itemKey);
      if (item && item.status === 'not_started') {
        await preboardingItems.setItemStatus({
          case_id: caseRow.id, item_key: itemKey, status: 'requested', actor: 'demo-seed',
        });
      }
    }

    const checklist = await preboardingItems.listItems(caseRow.id);
    const byStatus = {};
    for (const item of checklist) byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    console.log(
      `- ${created ? 'Opened' : 'Replayed'} ${caseRow.offer_reference} `
      + `(${caseRow.candidate_name}, ${caseRow.jurisdiction}, start ${caseRow.start_date}) — `
      + `${demoCase.state}; items: `
      + Object.keys(byStatus).map((s) => `${byStatus[s]} ${s}`).join(', ')
    );
  }

  // 8. Users (Deliverable 3: Demo credential stays the lead's)
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
