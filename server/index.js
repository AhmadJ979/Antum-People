const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const compliance = require('./compliance_engine');
const auth = require('./auth');
const eosb = require('./eosb');
const preboarding = require('./preboarding');
const preboardingItems = require('./preboarding-items');
const { createFlagWatcher } = require('./preboarding-flag-scheduler');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Hardening: Trust proxy for correct IP detection behind the platform edge
app.set('trust proxy', 1);

// Hardening: Remove X-Powered-By header
app.disable('x-powered-by');

// Hardening: Restrict CORS
//
// This must never throw. A throw from middleware does not get an HTTP response from the
// route table: it reaches express's default error handler, which answers 500 with an HTML
// page carrying the stack trace and this deployment's absolute filesystem paths — reachable
// by anyone who sets an Origin header. It also blanked the app on any host we do not own,
// because the built index.html loads its bundle with `crossorigin`, i.e. as a CORS-mode
// request, so an unlisted host got a 500 for /assets/*.js and rendered an empty page.
//
// Decision order:
//   1. no Origin header      -> serve. curl, uptime probes and the /api 401 contract send none.
//   2. Origin host == Host   -> serve. Same-origin is not a CORS question at all; this is what
//                               lets the app run from antum.ae, a client domain or a forwarded
//                               port without needing an allowlist entry per host.
//   3. Origin in allowlist   -> serve, and the cors middleware grants the CORS headers.
//   4. anything else         -> deliberate 403, short generic JSON body, detail to the log.
const allowedOrigins = [
  'https://b974147c03228029e277d1cbe6646fe6.ctonew.app',
  'https://b974147c03228029e277d1cbe6646fe6-dev.ctonew.app'
].concat(
  // Extra hosts for a deployment behind a proxy that rewrites Host, e.g.
  // ALLOWED_ORIGINS=https://antum.ae,https://app.client.example
  (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
);
const originHost = (origin) => {
  try {
    return new URL(origin).host.toLowerCase();
  } catch (e) {
    return null; // 'null', malformed, or non-http origin: not same-origin, not allowlisted
  }
};
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) return next();
  if (originHost(origin) !== null && originHost(origin) === String(req.headers.host || '').toLowerCase()) {
    return next();
  }
  // Log the refusal (control characters stripped: the header is caller-supplied), answer generically.
  console.warn(`[cors] refused Origin ${String(origin).replace(/[^\x20-\x7e]/g, '?').slice(0, 200)} for ${req.method} ${req.path}`);
  return res.status(403).json({ error: 'Forbidden' });
});
app.use(cors({
  origin: (origin, callback) => {
    callback(null, !origin || allowedOrigins.includes(origin));
  },
  credentials: false
}));

app.use(express.json());

// Hardening: Login rate limiting (failures only)
// 25 failures per minute per IP. Success resets the bucket.
const loginFailures = new Map();
const rateLimitLogin = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const window = 60000;
  const limit = 25;

  if (!loginFailures.has(ip)) {
    loginFailures.set(ip, []);
  }

  const failures = loginFailures.get(ip).filter(ts => now - ts < window);
  loginFailures.set(ip, failures);

  if (failures.length >= limit) {
    return res.status(429).json({ error: 'Too many failed login attempts. Please try again later.' });
  }
  next();
};

// Generate a valid bcrypt dummy hash once at boot for the timing fix
const dummyHash = auth.hashPasswordSync(require('crypto').randomBytes(32).toString('hex'), 12);

// -------------------------------------------------------------
// AUTHENTICATION
// -------------------------------------------------------------

app.post('/api/login', rateLimitLogin, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const users = await db.query(`SELECT * FROM users WHERE username = ${db.escapeString(username)}`);
    const user = users[0];
    
    // Hardening: Always bcrypt.compare to prevent timing side-channel
    const isValid = await auth.comparePassword(password, user ? user.password_hash : dummyHash);
    
    if (!user || !isValid) {
      // Increment failure count
      const ip = req.ip;
      const failures = loginFailures.get(ip) || [];
      failures.push(Date.now());
      loginFailures.set(ip, failures);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Success resets failure bucket
    loginFailures.delete(req.ip);

    const token = auth.generateToken(user);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Protect all /api routes except login
app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/health') return next();
  auth.authenticateToken(req, res, next);
});

// Helper to generate UUIDs
const generateId = () => {
  return require('crypto').randomUUID ? require('crypto').randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// -------------------------------------------------------------
// EMPLOYEE APIS
// -------------------------------------------------------------

app.get('/api/employees', async (req, res) => {
  try {
    // Jurisdiction filter: the active demo surface is UAE-first (owner direction,
    // 2026-10-02). ?jurisdiction=AE|SA filters the roster by data_residency_country;
    // omitting it (or any other value) returns everyone, unfiltered — nothing is
    // deleted or hidden at the data layer, only at the query the UI happens to send.
    const jurisdiction = (req.query.jurisdiction || '').toUpperCase();
    const sql = (jurisdiction === 'AE' || jurisdiction === 'SA')
      ? `SELECT * FROM employees WHERE data_residency_country = ${db.escapeString(jurisdiction)} ORDER BY start_date DESC`
      : `SELECT * FROM employees ORDER BY start_date DESC`;
    const employees = await db.query(sql);
    const decrypted = employees.map(emp => ({
      ...emp,
      national_id_value: auth.decrypt(emp.national_id_value),
      national_id_iqama: auth.decrypt(emp.national_id_iqama)
    }));
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/employees/:id', async (req, res) => {
  try {
    const employees = await db.query(`SELECT * FROM employees WHERE id = ${db.escapeString(req.params.id)}`);
    if (employees.length === 0) return res.status(404).json({ error: 'Employee not found' });
    const emp = employees[0];
    emp.national_id_value = auth.decrypt(emp.national_id_value);
    emp.national_id_iqama = auth.decrypt(emp.national_id_iqama);
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const data = req.body;
    
    if (!data.data_residency_country) {
      return res.status(400).json({ error: 'data_residency_country is required' });
    }
    
    const id = generateId();
    const country = data.data_residency_country;
    const bSalary = parseFloat(data.basic_salary) || 0;
    const tSalary = parseFloat(data.salary) || 0;
    
    const eosbAccrued = eosb.calculateEOSB(data.start_date, null, bSalary, tSalary, country, 'resignation', parseFloat(data.unpaid_leave_days) || 0);

    const encryptedNationalId = auth.encrypt(data.national_id_value);
    const encryptedIqama = auth.encrypt(data.national_id_iqama);

    const insertSql = `
      INSERT INTO employees (
        id, first_name, last_name, email, department, role, manager_id, start_date, status, salary, basic_salary, 
        recruitment_cost, national_id_type, national_id_value, national_id_iqama, data_residency_country, 
        jurisdiction, total_salary,
        consent_granted, 
        visa_status, visa_expiry_date, eosb_accrued, eosb_paid, termination_type, unpaid_leave_days
      )
      VALUES (
        ${db.escapeString(id)}, ${db.escapeString(data.first_name)}, ${db.escapeString(data.last_name)},
        ${db.escapeString(data.email)}, ${db.escapeString(data.department)}, ${db.escapeString(data.role)},
        ${db.escapeString(data.manager_id)}, ${db.escapeString(data.start_date)}, 'onboarding',
        ${tSalary}, ${bSalary}, ${parseFloat(data.recruitment_cost) || 0},
        ${db.escapeString(data.national_id_type)}, ${db.escapeString(encryptedNationalId)},
        ${db.escapeString(encryptedIqama)},
        ${db.escapeString(country)}, 
        ${db.escapeString(country)}, ${tSalary},
        0, ${db.escapeString(data.visa_status)},
        ${db.escapeString(data.visa_expiry_date)}, ${eosbAccrued}, 0,
        'resignation', ${parseFloat(data.unpaid_leave_days) || 0}
      )
    `;
    await db.query(insertSql);

    const auditData = { ...data, national_id_value: encryptedNationalId, national_id_iqama: encryptedIqama };
    await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, new_values, timestamp)
      VALUES (${db.escapeString(generateId())}, 'system', 'employee', ${db.escapeString(id)}, 'CREATE', ${db.escapeString(JSON.stringify(auditData))}, CURRENT_TIMESTAMP)`);

    const tasks = compliance.generateTasks(id, country === 'SA' || country === 'KSA' ? 'KSA' : 'UAE', 'onboarding');
    for (const task of tasks) {
      await db.query(`INSERT INTO onboarding_tasks (id, employee_id, title, description, status, due_date)
        VALUES (${db.escapeString(task.id)}, ${db.escapeString(task.employee_id)}, ${db.escapeString(task.title)}, 
        ${db.escapeString(task.description)}, 'pending', ${db.escapeString(new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0])})`);
    }

    res.status(201).json({ id, message: 'Employee and onboarding tasks created' });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const data = req.body;
    const empId = req.params.id;
    const existing = await db.query(`SELECT * FROM employees WHERE id = ${db.escapeString(empId)}`);
    if (existing.length === 0) return res.status(404).json({ error: 'Employee not found' });
    const emp = existing[0];

    const updates = [];
    Object.keys(data).forEach(key => {
      if (['first_name', 'last_name', 'email', 'department', 'role', 'manager_id', 'status', 'visa_status', 'visa_expiry_date', 'national_id_type', 'data_residency_country', 'start_date', 'end_date', 'fully_productive_date', 'termination_type'].includes(key)) {
        updates.push(`${key} = ${db.escapeString(data[key])}`);
        if (key === 'data_residency_country') {
          updates.push(`jurisdiction = ${db.escapeString(data[key])}`);
        }
      } else if (['national_id_value', 'national_id_iqama'].includes(key)) {
        updates.push(`${key} = ${db.escapeString(auth.encrypt(data[key]))}`);
      } else if (['salary', 'basic_salary', 'recruitment_cost', 'eosb_paid', 'consent_granted', 'unpaid_leave_days'].includes(key)) {
        const val = parseFloat(data[key]) || 0;
        updates.push(`${key} = ${val}`);
        if (key === 'salary') {
          updates.push(`total_salary = ${val}`);
        }
      }
    });

    if (updates.length > 0) {
      const mergedStatus = data.status || emp.status;
      const mergedEndDate = data.end_date || emp.end_date;
      const mergedTerminationType = data.termination_type || emp.termination_type || 'resignation';
      const mergedUnpaidLeave = data.unpaid_leave_days !== undefined ? data.unpaid_leave_days : (emp.unpaid_leave_days || 0);

      const newEosb = eosb.calculateEOSB(
        data.start_date || emp.start_date, 
        mergedEndDate, 
        data.basic_salary || emp.basic_salary, 
        data.salary || emp.salary, 
        data.data_residency_country || emp.data_residency_country, 
        mergedTerminationType,
        mergedUnpaidLeave
      );
      updates.push(`eosb_accrued = ${newEosb}`);
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      
      await db.query(`UPDATE employees SET ${updates.join(', ')} WHERE id = ${db.escapeString(empId)}`);
      
      const auditNewValues = { ...data };
      if (auditNewValues.national_id_value) auditNewValues.national_id_value = auth.encrypt(auditNewValues.national_id_value);
      if (auditNewValues.national_id_iqama) auditNewValues.national_id_iqama = auth.encrypt(auditNewValues.national_id_iqama);

      await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, old_values, new_values, timestamp)
        VALUES (${db.escapeString(generateId())}, 'system', 'employee', ${db.escapeString(empId)}, 'UPDATE', ${db.escapeString(JSON.stringify(emp))}, ${db.escapeString(JSON.stringify(auditNewValues))}, CURRENT_TIMESTAMP)`);

      if (data.status === 'offboarding' && emp.status !== 'offboarding') {
        const tasks = compliance.generateTasks(empId, (data.data_residency_country || emp.data_residency_country) === 'SA' ? 'KSA' : 'UAE', 'offboarding');
        for (const task of tasks) {
          await db.query(`INSERT INTO offboarding_tasks (id, employee_id, title, description, status, due_date)
            VALUES (${db.escapeString(task.id)}, ${db.escapeString(task.employee_id)}, ${db.escapeString(task.title)}, 
            ${db.escapeString(task.description)}, 'pending', ${db.escapeString(new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0])})`);
        }
      }
    }

    res.json({ message: 'Employee updated' });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/employees/:id/onboarding', async (req, res) => {
  const tasks = await db.query(`SELECT * FROM onboarding_tasks WHERE employee_id = ${db.escapeString(req.params.id)}`);
  res.json(tasks);
});

app.put('/api/onboarding-tasks/:id', async (req, res) => {
  const { status } = req.body;
  const completed_at = status === 'completed' ? `datetime('now')` : 'NULL';
  await db.query(`UPDATE onboarding_tasks SET status = ${db.escapeString(status)}, completed_at = ${completed_at} WHERE id = ${db.escapeString(req.params.id)}`);
  res.json({ message: 'Task updated' });
});

app.get('/api/employees/:id/offboarding', async (req, res) => {
  const tasks = await db.query(`SELECT * FROM offboarding_tasks WHERE employee_id = ${db.escapeString(req.params.id)}`);
  res.json(tasks);
});

app.put('/api/offboarding-tasks/:id', async (req, res) => {
  const { status } = req.body;
  const completed_at = status === 'completed' ? `datetime('now')` : 'NULL';
  await db.query(`UPDATE offboarding_tasks SET status = ${db.escapeString(status)}, completed_at = ${completed_at} WHERE id = ${db.escapeString(req.params.id)}`);
  res.json({ message: 'Task updated' });
});

app.post('/api/compliance/calculate-eosb', (req, res) => {
  const { start_date, end_date, basic_salary, total_salary, country, termination_type, unpaid_leave_days } = req.body;
  const amount = eosb.calculateEOSB(start_date, end_date, basic_salary, total_salary, country, termination_type, unpaid_leave_days);
  res.json({ amount });
});

app.post('/api/compliance/consent', async (req, res) => {
  const { employee_id, consent_type, lawful_basis, version } = req.body;
  const id = generateId();
  const now = new Date().toISOString();
  await db.query(`INSERT INTO consent_records (id, employee_id, consent_type, lawful_basis, granted_at, consent_version) 
    VALUES (${db.escapeString(id)}, ${db.escapeString(employee_id)}, ${db.escapeString(consent_type)}, ${db.escapeString(lawful_basis)}, ${db.escapeString(now)}, ${db.escapeString(version)})`);
  await db.query(`UPDATE employees SET consent_granted = 1, consent_date = ${db.escapeString(now.split('T')[0])} WHERE id = ${db.escapeString(employee_id)}`);
  res.json({ id });
});

app.get('/api/compliance/templates/:templateName/:employeeId', async (req, res) => {
  try {
    const { templateName, employeeId } = req.params;
    const employees = await db.query(`SELECT * FROM employees WHERE id = ${db.escapeString(employeeId)}`);
    if (employees.length === 0) return res.status(404).json({ error: 'Employee not found' });
    const emp = employees[0];
    emp.national_id_value = auth.decrypt(emp.national_id_value);
    emp.national_id_iqama = auth.decrypt(emp.national_id_iqama);

    // FIX 1: Settlement Statement Calculations
    let eosb_amount = (emp.eosb_accrued || 0).toFixed(2);
    let final_pro_rated_salary = 'not calculated';
    if (emp.end_date && emp.salary) {
      const endDate = new Date(emp.end_date);
      const day = endDate.getDate();
      const month = endDate.getMonth();
      const year = endDate.getFullYear();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      final_pro_rated_salary = (emp.salary * (day / daysInMonth)).toFixed(2);
    }
    
    const gross_val = (parseFloat(final_pro_rated_salary) || 0) + parseFloat(eosb_amount);
    const total_deductions = (0).toFixed(2);
    const net_settlement = (gross_val - parseFloat(total_deductions)).toFixed(2);

    const templateData = {
      ...emp,
      full_name: `${emp.first_name} ${emp.last_name}`,
      national_id: emp.national_id_value,
      employee_id: emp.id,
      total_salary: (emp.salary || 0).toFixed(2),
      basic_salary: (emp.basic_salary || 0).toFixed(2),
      eosb_amount,
      final_pro_rated_salary,
      gross_settlement: gross_val.toFixed(2),
      total_deductions,
      net_settlement,
      termination_reason: emp.termination_type || 'Resignation',
      current_date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    };

    const templatePath = path.join('/home/team/shared/templates', `${templateName}.md`);
    if (!fs.existsSync(templatePath)) return res.status(404).json({ error: 'Template not found' });
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const rendered = compliance.renderTemplate(templateContent, templateData);
    res.json({ content: rendered });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/compliance/report', async (req, res) => {
  const employees = await db.query(`SELECT * FROM employees`);
  const decrypted = employees.map(emp => ({
    ...emp,
    national_id_value: auth.decrypt(emp.national_id_value),
    national_id_iqama: auth.decrypt(emp.national_id_iqama)
  }));
  const total = decrypted.length;
  const consent = decrypted.filter(e => e.consent_granted).length;
  const alerts = decrypted.filter(e => e.visa_expiry_date && new Date(e.visa_expiry_date) < new Date(Date.now() + 60*24*60*60*1000));
  res.json({ total, consentGranted: consent, visaAlerts: alerts.length, alerts });
});

app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    // Jurisdiction filter: the active demo surface is UAE-first (owner direction,
    // 2026-10-02) — every card here is computed from UAE records by default. KSA data
    // is not deleted or hidden from the engine; ?jurisdiction=SA (or an explicit
    // switch in the UI) still computes a real figure from it for testing.
    const jurisdiction = (req.query.jurisdiction || '').toUpperCase();
    const allEmployees = await db.query(`SELECT * FROM employees`);
    const employees = (jurisdiction === 'AE' || jurisdiction === 'SA')
      ? allEmployees.filter(e => e.data_residency_country === jurisdiction)
      : allEmployees;
    const employeeIds = new Set(employees.map(e => e.id));

    const allExits = await db.query(`SELECT * FROM exit_interviews`);
    const exits = allExits.filter(ex => employeeIds.has(ex.employee_id));
    const allOnboardingTaskRows = await db.query(`SELECT employee_id, status FROM onboarding_tasks`);
    const onboardingTaskRows = allOnboardingTaskRows.filter(t => employeeIds.has(t.employee_id));

    // A terminated employee's liability is settled and they are no longer part of the
    // active workforce — every "active" card (headcount, payroll, EOSB liability,
    // cost-per-hire, time-to-value) must be computed off this list, not the raw table.
    // Terminated employees still belong in the retention cohort math below, which is the
    // one place their history should count.
    const activeEmployees = employees.filter(e => e.status !== 'terminated');

    const totalSalary = activeEmployees.reduce((s, e) => s + (e.salary || 0), 0);
    const totalEosb = activeEmployees.reduce((s, e) => s + (e.eosb_accrued || 0), 0);

    const withRecruitmentAE = activeEmployees.filter(emp => emp.data_residency_country === 'AE' && emp.recruitment_cost > 0);
    const avgCostPerHireAE = withRecruitmentAE.length > 0
      ? Math.round(withRecruitmentAE.reduce((sum, emp) => sum + emp.recruitment_cost, 0) / withRecruitmentAE.length)
      : 0;
    const withRecruitmentSA = activeEmployees.filter(emp => emp.data_residency_country === 'SA' && emp.recruitment_cost > 0);
    const avgCostPerHireSA = withRecruitmentSA.length > 0
      ? Math.round(withRecruitmentSA.reduce((sum, emp) => sum + emp.recruitment_cost, 0) / withRecruitmentSA.length)
      : 0;

    const withTtv = activeEmployees.filter(e => e.start_date && e.fully_productive_date);
    const avgTtvDays = withTtv.length > 0
      ? Math.round(withTtv.reduce((sum, e) => {
          const start = new Date(e.start_date);
          const prod = new Date(e.fully_productive_date);
          return sum + (prod.getTime() - start.getTime()) / (1000 * 3600 * 24);
        }, 0) / withTtv.length * 10) / 10
      : 0;

    const ttvByDepartment = [];
    const depts = [...new Set(employees.map(e => e.department))];
    depts.forEach(dept => {
      const deptEmployees = withTtv.filter(e => e.department === dept);
      if (deptEmployees.length > 0) {
        const avg = Math.round(deptEmployees.reduce((sum, e) => {
          const start = new Date(e.start_date);
          const prod = new Date(e.fully_productive_date);
          return sum + (prod.getTime() - start.getTime()) / (1000 * 3600 * 24);
        }, 0) / deptEmployees.length * 10) / 10;
        ttvByDepartment.push({ department: dept, avgDays: avg, target: 15 });
      }
    });

    const cohorts = {};
    employees.forEach(e => {
      const start = new Date(e.start_date);
      const half = start.getMonth() < 6 ? 'H1' : 'H2';
      const cohort = `${half} ${start.getFullYear()}`;
      if (!cohorts[cohort]) cohorts[cohort] = { total: 0, retained: 0 };
      cohorts[cohort].total++;
      
      const isTerminated = e.status === 'terminated';
      const tenureDays = e.end_date 
        ? (new Date(e.end_date).getTime() - start.getTime()) / (1000 * 3600 * 24)
        : (new Date().getTime() - start.getTime()) / (1000 * 3600 * 24);
      
      if (!isTerminated || tenureDays >= 365) {
        cohorts[cohort].retained++;
      }
    });

    const retentionLiftSeries = Object.keys(cohorts).map(cohort => {
      const retention = Math.round((cohorts[cohort].retained / cohorts[cohort].total) * 100);
      const benchmark = 80 + (parseInt(cohort.split(' ')[1]) % 5); 
      return {
        cohort,
        retention,
        benchmark,
        lift: retention - benchmark
      };
    }).sort((a, b) => a.cohort.localeCompare(b.cohort));

    const eosbByJurisdiction = {
      AE: activeEmployees.filter(e => e.data_residency_country === 'AE').reduce((s, e) => s + (e.eosb_accrued || 0), 0),
      SA: activeEmployees.filter(e => e.data_residency_country === 'SA').reduce((s, e) => s + (e.eosb_accrued || 0), 0)
    };

    // Onboarding Pipeline is derived from the work, not a status label: an employee is
    // "in the pipeline" if they have at least one onboarding task that isn't completed yet.
    // This is the single source of truth the dashboard card and the transitions list both
    // read from, so they can never disagree with each other or with the checklist itself.
    const incompleteOnboardingIds = new Set(
      onboardingTaskRows.filter(t => t.status !== 'completed').map(t => t.employee_id)
    );
    const onboardingPipeline = employees
      .filter(e => incompleteOnboardingIds.has(e.id))
      .map(e => ({ id: e.id, first_name: e.first_name, last_name: e.last_name, role: e.role, start_date: e.start_date }));

    // Forecast: project each active employee's own EOSB forward to each quarter-end
    // using the same engine calculateEOSB() call as everywhere else, instead of an
    // arbitrary growth multiplier. Tenure only ever increases, so each quarter's total
    // is >= the previous one for a stable workforce — no unexplained dip, and the
    // trajectory is the engine's own output, not a guess (rule 16).
    const forecastQuarterEnds = [
      { quarter: 'Q3 2026', date: '2026-09-30' },
      { quarter: 'Q4 2026', date: '2026-12-31' },
      { quarter: 'Q1 2027', date: '2027-03-31' },
      { quarter: 'Q2 2027', date: '2027-06-30' }
    ];
    const eosbLiabilitySeries = forecastQuarterEnds.map(({ quarter, date }) => {
      let uae = 0, ksa = 0;
      activeEmployees.forEach(e => {
        const projected = eosb.calculateEOSB(e.start_date, date, e.basic_salary, e.salary, e.data_residency_country, 'resignation', 0);
        if (e.data_residency_country === 'AE') uae += projected;
        else if (e.data_residency_country === 'SA') ksa += projected;
      });
      return { quarter, uae: Math.round(uae), ksa: Math.round(ksa), combined: Math.round(uae + ksa) };
    });

    const reasonsMap = {};
    exits.forEach(ex => {
      reasonsMap[ex.departure_reason] = (reasonsMap[ex.departure_reason] || 0) + 1;
    });

    res.json({
      activeHeadcount: activeEmployees.length,
      monthlyPayroll: Math.round(totalSalary / 12),
      eosbLiability: Math.round(totalEosb),
      attritionRate: exits.length > 0 ? Math.round((exits.length / employees.length) * 100) : 0,
      avgCostPerHireAE,
      avgCostPerHireSA,
      avgTtvDays,
      ttvByDepartment,
      retentionLiftSeries,
      eosbLiabilitySeries,
      eosbByJurisdiction,
      onboardingPipeline,
      exitsByReason: Object.keys(reasonsMap).map(reason => ({ reason, count: reasonsMap[reason] })),
      activeSalarySpend: totalSalary,
      totalRecruitingSpend: employees.reduce((sum, emp) => sum + (emp.recruitment_cost || 0), 0)
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post('/api/exit-interviews', async (req, res) => {
  const data = req.body;
  const id = generateId();
  await db.query(`INSERT INTO exit_interviews (id, employee_id, interview_date, departure_reason, detailed_feedback, satisfaction_score)
    VALUES (${db.escapeString(id)}, ${db.escapeString(data.employee_id)}, ${db.escapeString(data.interview_date)}, 
    ${db.escapeString(data.departure_reason)}, ${db.escapeString(data.detailed_feedback)}, ${data.satisfaction_score})`);
  await db.query(`UPDATE employees SET status = 'terminated', end_date = ${db.escapeString(data.interview_date)} WHERE id = ${db.escapeString(data.employee_id)}`);
  res.status(201).json({ id });
});

// -------------------------------------------------------------
// LAYER 2 — PRE-BOARDING (P2-1: an accepted offer opens a case)
// -------------------------------------------------------------
// These routes are transport only: they carry no case rules of their own. Validation, the
// start-date invariant, the single-write and the per-offer idempotency all live in
// preboarding.recordOfferAcceptance(), which is also what a future ATS adapter will call —
// two callers of one function, not two implementations.
app.post('/api/preboarding/cases', async (req, res) => {
  try {
    const { case: createdCase, created } = await preboarding.recordOfferAcceptance(req.body, {
      actor: (req.user && req.user.username) || 'system',
      source: 'intake_form',
    });
    // 201 when this acceptance opened the case, 200 when the offer already had one:
    // re-processing the same accepted offer is not an error.
    res.status(created ? 201 : 200).json({ created, case: createdCase });
  } catch (err) {
    if (err instanceof preboarding.OfferAcceptanceError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Preboarding] Failed to record offer acceptance:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// The endpoint's own contract: `?jurisdiction=` (the client sends the header's active
// jurisdiction, UAE-first) and `?status=` (the screen's tile is labelled "Cases open", so the
// client asks for the open ones — the number and the label cannot disagree). An unknown status
// is a 400, never a filter that quietly matches nothing.
app.get('/api/preboarding/cases', async (req, res) => {
  try {
    const cases = await preboarding.listCases({
      jurisdiction: req.query.jurisdiction,
      status: req.query.status,
    });
    res.json(cases);
  } catch (err) {
    if (err instanceof preboarding.OfferAcceptanceError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Preboarding] Failed to list cases:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.get('/api/preboarding/cases/:id', async (req, res) => {
  try {
    const preboardingCase = await preboarding.getCase(req.params.id);
    if (!preboardingCase) return res.status(404).json({ error: 'Pre-boarding case not found' });
    res.json(preboardingCase);
  } catch (err) {
    console.error('[Preboarding] Failed to read case:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -------------------------------------------------------------
// LAYER 2 — PRE-BOARDING EMPLOYEE TRACK (P2-2: document collection)
// -------------------------------------------------------------
// Transport only, exactly as above: the status machine, the jurisdiction document set, the
// reminder record and the PDPL consent gate all live in preboarding-items.js. A refusal comes
// back with the status that module chose (400 / 404 / 409 / 428) and its reason, so the caller
// can act on it rather than guess.
const sendItemError = (res, err, context) => {
  if (err instanceof preboardingItems.PreboardingItemError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`[Preboarding] ${context}:`, err);
  return res.status(500).json({ error: 'Internal Server Error' });
};

// The roll-up HR reads: every case with its outstanding items named, in one call.
app.get('/api/preboarding/checklist/overview', async (req, res) => {
  try {
    res.json(await preboardingItems.checklistOverview({ jurisdiction: req.query.jurisdiction }));
  } catch (err) {
    sendItemError(res, err, 'Failed to build the checklist roll-up');
  }
});

app.get('/api/preboarding/cases/:id/checklist', async (req, res) => {
  try {
    res.json(await preboardingItems.caseChecklist(req.params.id));
  } catch (err) {
    sendItemError(res, err, 'Failed to read the case checklist');
  }
});

app.post('/api/preboarding/cases/:id/items/:itemKey/status', async (req, res) => {
  try {
    const item = await preboardingItems.setItemStatus({
      case_id: req.params.id,
      item_key: req.params.itemKey,
      status: req.body && req.body.status,
      document_reference: req.body && req.body.document_reference,
      note: req.body && req.body.note,
      actor: (req.user && req.user.username) || 'system',
    });
    res.json({ item });
  } catch (err) {
    sendItemError(res, err, 'Failed to move a checklist item');
  }
});

app.post('/api/preboarding/cases/:id/reminders', async (req, res) => {
  try {
    const result = await preboardingItems.recordReminder({
      case_id: req.params.id,
      item_keys: (req.body && req.body.item_keys) || null,
      note: req.body && req.body.note,
      actor: (req.user && req.user.username) || 'system',
    });
    res.status(201).json(result);
  } catch (err) {
    sendItemError(res, err, 'Failed to record a reminder');
  }
});

app.get('/api/preboarding/cases/:id/consent', async (req, res) => {
  try {
    res.json({ consent: await preboardingItems.getConsent(req.params.id) });
  } catch (err) {
    sendItemError(res, err, 'Failed to read the consent record');
  }
});

app.post('/api/preboarding/cases/:id/consent', async (req, res) => {
  try {
    const result = await preboardingItems.recordConsent({
      case_id: req.params.id,
      consent_type: req.body && req.body.consent_type,
      lawful_basis: req.body && req.body.lawful_basis,
      consent_version: req.body && req.body.consent_version,
      actor: (req.user && req.user.username) || 'system',
    });
    res.status(result.created ? 201 : 200).json(result);
  } catch (err) {
    sendItemError(res, err, 'Failed to record PDPL consent');
  }
});

// -------------------------------------------------------------
// SERVE FRONTEND
// -------------------------------------------------------------

app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// -------------------------------------------------------------
// LAYER 2 — P2-5: THE IN-PROCESS FLAG WATCHER (a record, not a notification)
// -------------------------------------------------------------
// This host has no cron and no working systemd, so a time-based check cannot be delegated to the
// OS: the watch runs inside this process, on a tick, and its first tick is the restart catch-up —
// a boundary that fell while the process was down is recorded late and says so, and a boundary is
// never silently skipped. It records; it does not store the flag (the flag is derived on every
// read) and it does not send anything (the product has no delivery channel). The route below is
// the read side of that record; nothing in the product renders the flag from it.
const flagWatcher = createFlagWatcher({
  snapshot: () => preboardingItems.flagWatchSnapshot(),
  log: (line) => console.log(line),
});
app.get('/api/preboarding/flag-watch', async (req, res) => {
  try {
    res.json(flagWatcher.status());
  } catch (err) {
    sendItemError(res, err, 'Failed to read the flag watcher record');
  }
});
flagWatcher.start();

// -------------------------------------------------------------
// CATCH-ALL ERROR HANDLER
// -------------------------------------------------------------
// Must stay last, after every route. Without it express answers any thrown error with its
// default HTML page — HTTP 500, the stack trace and this deployment's absolute paths — so a
// single throw in middleware or in an unguarded route handed internals to the caller. Here
// every such error becomes the same short JSON error the rest of the API returns, and the
// detail goes to the log instead. Express needs all four parameters to treat this as an
// error handler.
const GENERIC_ERROR_BY_STATUS = {
  400: 'Bad Request',
  401: 'Authentication token required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  429: 'Too many requests. Please try again later.'
};
app.use((err, req, res, next) => {
  const upstream = err && Number.isInteger(err.status) ? err.status : null;
  const status = upstream >= 400 && upstream <= 499 ? upstream : 500;
  console.error(`[error] ${req.method} ${req.originalUrl} -> ${status}\n${(err && err.stack) || String(err)}`);
  if (res.headersSent) return next(err); // response already streaming: let express close it
  res.status(status).json({ error: GENERIC_ERROR_BY_STATUS[status] || 'Internal Server Error' });
});
// Bind server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Antum server listening on port ${PORT}`);
});
