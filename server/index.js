const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const compliance = require('./compliance_engine');
const auth = require('./auth');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// -------------------------------------------------------------
// AUTHENTICATION
// -------------------------------------------------------------

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = await db.query(`SELECT * FROM users WHERE username = ${db.escapeString(username)}`);
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = users[0];
    const isValid = await auth.comparePassword(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = auth.generateToken(user);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

/**
 * Calculates End-of-Service Benefits (EOSB) based on GCC rules.
 */
function calculateEOSB(startDateStr, endDateStr, basicSalary, totalSalary, country, terminationType = 'resignation', unpaidLeaveDays = 0) {
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  
  const rawDiffTime = Math.max(0, end.getTime() - start.getTime());
  const rawDays = rawDiffTime / (1000 * 60 * 60 * 24);
  const leaveDays = parseInt(unpaidLeaveDays) || 0;
  
  let netDays;
  if (country === 'SA' || country === 'KSA') {
    // KSA: No statutory exclusion for unpaid leave unless specified in contract. 
    // Following compliance recommendation Finding 2: subtract all.
    netDays = Math.max(0, rawDays - leaveDays);
  } else {
    // UAE: Only exclude unpaid leave exceeding 90 days per year of service (Decree-Law 33/2021)
    const totalYears = rawDays / 365.25;
    const allowedUnpaidTotal = 90 * totalYears;
    const excessUnpaid = Math.max(0, leaveDays - allowedUnpaidTotal);
    netDays = Math.max(0, rawDays - excessUnpaid);
  }
  
  const tenureYears = netDays / 365.25;
  
  if (terminationType === 'summary_dismissal') {
    return 0; // Forfeit entire EOSB for gross misconduct
  }

  let accrued = 0;
  const isResignation = terminationType === 'resignation';
  
  if (country === 'SA' || country === 'KSA') {
    // Saudi Arabia: Based on Total Salary (including allowances)
    const monthlyRate = parseFloat(totalSalary) || parseFloat(basicSalary) || 0;
    if (tenureYears < 2) return 0;

    if (tenureYears <= 5) {
      accrued = (monthlyRate / 2) * tenureYears;
    } else {
      accrued = (monthlyRate / 2) * 5 + (monthlyRate) * (tenureYears - 5);
    }

    if (isResignation) {
      if (tenureYears >= 2 && tenureYears < 5) accrued *= (1/3);
      else if (tenureYears >= 5 && tenureYears < 10) accrued *= (2/3);
      // tenureYears >= 10 is full amount
    }
  } else {
    // UAE: Based on Basic Salary
    const bSalary = parseFloat(basicSalary) || 0;
    const dailyBasic = bSalary / 30;
    if (tenureYears < 1) return 0;

    const firstPeriodYears = Math.min(5, tenureYears);
    accrued += firstPeriodYears * 21 * dailyBasic;
    
    if (tenureYears > 5) {
      const secondPeriodYears = tenureYears - 5;
      accrued += secondPeriodYears * 30 * dailyBasic;
    }

    // UAE Cap: 2 years of Basic Salary
    accrued = Math.min(accrued, bSalary * 24);

    if (isResignation) {
      if (tenureYears >= 1 && tenureYears < 3) accrued *= (1/3);
      else if (tenureYears >= 3 && tenureYears < 5) accrued *= (2/3);
    }
  }
  
  return Math.round(accrued * 100) / 100;
}

// -------------------------------------------------------------
// EMPLOYEE APIS
// -------------------------------------------------------------

app.get('/api/employees', async (req, res) => {
  try {
    const employees = await db.query(`SELECT * FROM employees ORDER BY start_date DESC`);
    const decrypted = employees.map(emp => ({
      ...emp,
      national_id_value: auth.decrypt(emp.national_id_value),
      national_id_iqama: auth.decrypt(emp.national_id_iqama)
    }));
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const data = req.body;
    const id = generateId();
    const country = data.data_residency_country || 'AE';
    const bSalary = parseFloat(data.basic_salary) || 0;
    const tSalary = parseFloat(data.salary) || 0;
    
    const eosbAccrued = calculateEOSB(data.start_date, null, bSalary, tSalary, country, 'resignation', parseFloat(data.unpaid_leave_days) || 0);

    const encryptedNationalId = auth.encrypt(data.national_id_value);
    const encryptedIqama = auth.encrypt(data.national_id_iqama);

    const insertSql = `
      INSERT INTO employees (
        id, first_name, last_name, email, department, role, manager_id, start_date, status, salary, basic_salary, 
        recruitment_cost, national_id_type, national_id_value, national_id_iqama, data_residency_country, consent_granted, 
        visa_status, visa_expiry_date, eosb_accrued, eosb_paid, termination_type, unpaid_leave_days
      )
      VALUES (
        ${db.escapeString(id)}, ${db.escapeString(data.first_name)}, ${db.escapeString(data.last_name)},
        ${db.escapeString(data.email)}, ${db.escapeString(data.department)}, ${db.escapeString(data.role)},
        ${db.escapeString(data.manager_id)}, ${db.escapeString(data.start_date)}, 'onboarding',
        ${tSalary}, ${bSalary}, ${parseFloat(data.recruitment_cost) || 0},
        ${db.escapeString(data.national_id_type)}, ${db.escapeString(encryptedNationalId)},
        ${db.escapeString(encryptedIqama)},
        ${db.escapeString(country)}, 0, ${db.escapeString(data.visa_status)},
        ${db.escapeString(data.visa_expiry_date)}, ${eosbAccrued}, 0,
        'resignation', ${parseFloat(data.unpaid_leave_days) || 0}
      )
    `;
    await db.query(insertSql);

    // Audit Log (Match schema) - Encrypt sensitive data in audit logs too
    const auditData = { ...data, national_id_value: encryptedNationalId, national_id_iqama: encryptedIqama };
    await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, new_values, timestamp)
      VALUES (${db.escapeString(generateId())}, 'system', 'employee', ${db.escapeString(id)}, 'CREATE', ${db.escapeString(JSON.stringify(auditData))}, CURRENT_TIMESTAMP)`);

    // Generate tasks (Match schema)
    const tasks = compliance.generateTasks(id, country === 'SA' || country === 'KSA' ? 'KSA' : 'UAE', 'onboarding');
    for (const task of tasks) {
      await db.query(`INSERT INTO onboarding_tasks (id, employee_id, title, description, status, due_date)
        VALUES (${db.escapeString(task.id)}, ${db.escapeString(task.employee_id)}, ${db.escapeString(task.title)}, 
        ${db.escapeString(task.description)}, 'pending', ${db.escapeString(new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0])})`);
    }

    res.status(201).json({ id, message: 'Employee and onboarding tasks created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      } else if (['national_id_value', 'national_id_iqama'].includes(key)) {
        updates.push(`${key} = ${db.escapeString(auth.encrypt(data[key]))}`);
      } else if (['salary', 'basic_salary', 'recruitment_cost', 'eosb_paid', 'consent_granted', 'unpaid_leave_days'].includes(key)) {
        updates.push(`${key} = ${parseFloat(data[key]) || 0}`);
      }
    });

    if (updates.length > 0) {
      const mergedStatus = data.status || emp.status;
      const mergedEndDate = data.end_date || emp.end_date;
      const mergedTerminationType = data.termination_type || emp.termination_type || 'resignation';
      const mergedUnpaidLeave = data.unpaid_leave_days !== undefined ? data.unpaid_leave_days : (emp.unpaid_leave_days || 0);

      const newEosb = calculateEOSB(
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
      
      // Audit Log - Encrypt sensitive data in audit logs
      const auditNewValues = { ...data };
      if (auditNewValues.national_id_value) auditNewValues.national_id_value = auth.encrypt(auditNewValues.national_id_value);
      if (auditNewValues.national_id_iqama) auditNewValues.national_id_iqama = auth.encrypt(auditNewValues.national_id_iqama);

      await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, old_values, new_values, timestamp)
        VALUES (${db.escapeString(generateId())}, 'system', 'employee', ${db.escapeString(empId)}, 'UPDATE', ${db.escapeString(JSON.stringify(emp))}, ${db.escapeString(JSON.stringify(auditNewValues))}, CURRENT_TIMESTAMP)`);

      // Trigger offboarding tasks if status changed
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
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// COMPLIANCE & TASK APIS
// -------------------------------------------------------------

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
  const amount = calculateEOSB(start_date, end_date, basic_salary, total_salary, country, termination_type, unpaid_leave_days);
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

    const templateData = {
      ...emp,
      full_name: `${emp.first_name} ${emp.last_name}`,
      national_id: emp.national_id_value,
      total_salary: emp.salary,
      current_date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    };

    const templatePath = path.join('/home/team/shared/templates', `${templateName}.md`);
    if (!fs.existsSync(templatePath)) return res.status(404).json({ error: 'Template not found' });
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const rendered = compliance.renderTemplate(templateContent, templateData);
    res.json({ content: rendered });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// -------------------------------------------------------------
// ANALYTICS & DASHBOARD
// -------------------------------------------------------------

app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    const employees = await db.query(`SELECT * FROM employees`);
    const exits = await db.query(`SELECT * FROM exit_interviews`);
    
    const totalSalary = employees.filter(e => e.status !== 'terminated').reduce((s, e) => s + (e.salary || 0), 0);
    const totalEosb = employees.reduce((s, e) => s + (e.eosb_accrued || 0), 0);

    const withRecruitment = employees.filter(emp => emp.recruitment_cost > 0);
    const avgCostPerHire = withRecruitment.length > 0
      ? Math.round(withRecruitment.reduce((sum, emp) => sum + emp.recruitment_cost, 0) / withRecruitment.length)
      : 0;

    // 1. Time-to-Value (TTV)
    const withTtv = employees.filter(e => e.start_date && e.fully_productive_date);
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

    // 2. Retention Lift (1-yr cohort)
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

    // 3. EOSB Liability by Jurisdiction & Quarter
    const eosbByJurisdiction = {
      AE: employees.filter(e => e.data_residency_country === 'AE').reduce((s, e) => s + (e.eosb_accrued || 0), 0),
      SA: employees.filter(e => e.data_residency_country === 'SA').reduce((s, e) => s + (e.eosb_accrued || 0), 0)
    };

    const eosbLiabilitySeries = [
      { quarter: 'Q3 2026', uae: Math.round(eosbByJurisdiction.AE), ksa: Math.round(eosbByJurisdiction.SA), combined: Math.round(totalEosb) },
      { quarter: 'Q4 2026', uae: Math.round(eosbByJurisdiction.AE * 1.05), ksa: Math.round(eosbByJurisdiction.SA * 1.08), combined: Math.round(totalEosb * 1.06) },
      { quarter: 'Q1 2027', uae: Math.round(eosbByJurisdiction.AE * 1.15), ksa: Math.round(eosbByJurisdiction.SA * 1.25), combined: Math.round(totalEosb * 1.20) },
      { quarter: 'Q2 2027', uae: Math.round(eosbByJurisdiction.AE * 1.10), ksa: Math.round(eosbByJurisdiction.SA * 1.15), combined: Math.round(totalEosb * 1.12) }
    ];

    const reasonsMap = {};
    exits.forEach(ex => {
      reasonsMap[ex.departure_reason] = (reasonsMap[ex.departure_reason] || 0) + 1;
    });

    res.json({
      activeHeadcount: employees.filter(e => e.status !== 'terminated').length,
      monthlyPayroll: Math.round(totalSalary / 12),
      eosbLiability: Math.round(totalEosb),
      attritionRate: exits.length > 0 ? Math.round((exits.length / employees.length) * 100) : 0,
      avgCostPerHire,
      avgTtvDays,
      ttvByDepartment,
      retentionLiftSeries,
      eosbLiabilitySeries,
      eosbByJurisdiction,
      exitsByReason: Object.keys(reasonsMap).map(reason => ({ reason, count: reasonsMap[reason] })),
      activeSalarySpend: totalSalary,
      totalRecruitingSpend: employees.reduce((sum, emp) => sum + (emp.recruitment_cost || 0), 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
// SERVE FRONTEND
// -------------------------------------------------------------

app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Bind server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`VantageHR server listening on port ${PORT}`);
});
