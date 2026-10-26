const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const compliance = require('./compliance_engine');
const auth = require('./auth');
const access = require('./access');
const eosb = require('./eosb');
const preboarding = require('./preboarding');
const preboardingItems = require('./preboarding-items');
const privacyNotice = require('./privacy-notice');
// P3-1 and P3-2 — the probation timeline, and the manager's submitted evaluation.
//
// `probationTimeline` WAS NEVER BOUND IN THIS FILE until P3-2, and the route below used it: measured
// 2026-10-26 at ec2a29e (this branch's starting tree), GET /api/probation/timelines answered 500
// {"error":"Internal Server Error"} while GET /api/employees answered 200 with the same token. The
// identifier resolved to nothing, the handler's own try/catch swallowed the ReferenceError, and that
// catch logs nothing — so the panel the client draws from this route was empty and every other check
// stayed green. P3-1's module and its suite were right; the binding, and the assertion that would have
// caught it, were missing. `server/probation-evaluations.test.js` now asserts this route's 200 body.
const probationTimeline = require('./probation-timeline');
const probationEvaluations = require('./probation-evaluations');
const preboardingWorkspace = require('./preboarding-workspace');
const preboardingPackage = require('./preboarding-package');
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
    // Layer 3, slice 2: the field is `access_role`, the permission — not `role` (§2.4). The name it
    // collided with is `employees.role`, a job title, and the roster already returns that one to the
    // same client (see the analytics payload below): one word for two things is the hazard, so the
    // permission is spelled out wherever it is the permission.
    res.json({ token, user: { id: user.id, username: user.username, access_role: user.access_role } });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Protect all /api routes except login
app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/health') return next();
  auth.authenticateToken(req, res, next);
}, (req, res, next) => {
  // Layer 3, slice 1 (decision 11): the role is ENFORCED, deny-by-default, from ONE table in
  // server/access.js — `users.role` used to be signed into the token and never checked, so any
  // authenticated caller reached every route. The bypass list is repeated here on purpose: these
  // two paths carry no token by design, and widening the list is a policy decision, not a
  // convenience. authenticateToken runs first, so 401 (no/invalid token) and 403 (not allowed)
  // stay different answers.
  if (req.path === '/login' || req.path === '/health') return next();
  access.gate(req, res, next);
});

// Helper to generate UUIDs
const generateId = () => {
  return require('crypto').randomUUID ? require('crypto').randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// -------------------------------------------------------------
// THE SCOPE CHECKS (Layer 3, slice 2) — the per-row half of the policy
// -------------------------------------------------------------
// The gate in server/access.js answers "may this ROLE use this resource". It cannot answer "may THIS
// caller touch THIS row", because that is a question about data. The RULE still lives there
// (`scopeFor` + `scopedAllows`); what lives here is the lookup that feeds it, and the refusal shape is
// the gate's own — 403 with no body, so a scoped caller learns nothing about a row they may not see.

const refuse = (res) => res.status(403).end();

/** The employees row this account is tied to, or null when the account is tied to none. */
async function callerEmployeeId(req) {
  const rows = await db.query(`SELECT employee_id FROM users WHERE id = ${db.escapeString(req.user.id)}`);
  return rows.length ? (rows[0].employee_id || null) : null;
}

/**
 * The relation between the signed-in account and one employees row (access.RELATION).
 *
 * `unknown` covers the honest cases: the account carries no `employee_id` (today's single `admin`
 * row), or the row asked for does not exist. Neither is a relation, and no scope permits on it.
 */
async function relationTo(req, employeeId) {
  if (!employeeId) return access.RELATION.UNKNOWN;
  const me = await callerEmployeeId(req);
  if (!me) return access.RELATION.UNKNOWN;
  if (me === employeeId) return access.RELATION.SELF;
  const reports = await db.query(
    `SELECT id FROM employees WHERE id = ${db.escapeString(employeeId)} AND manager_id = ${db.escapeString(me)}`
  );
  return reports.length ? access.RELATION.REPORT : access.RELATION.OTHER;
}

/**
 * May this caller reach this employee's row? True only when the policy states how far their role
 * reaches AND the row is inside it. `SCOPE.ALL` short-circuits (HR reads the company, as before);
 * an unstated scope (`null`) is refused rather than widened.
 */
async function scopeAllowsTarget(req, employeeId) {
  if (req.accessScope === access.SCOPE.ALL) return true;
  if (!req.accessScope) return false;
  return access.scopedAllows(req.accessScope, await relationTo(req, employeeId));
}

/** The actor of a write, or null when the token names none. A write must name a person (§5.2 rule 1). */
const actorOf = (req) => (req.user && req.user.username) || null;

// -------------------------------------------------------------
// ACCOUNTS (Layer 3, slice 1) — plural accounts through an admin-authenticated path
// -------------------------------------------------------------
// Chosen shape: HTTP, admin-authenticated (POST /api/users) rather than a hand-written SQL insert.
// WHO may create an account is the same question, and the same file, as every other resource: the
// policy table in server/access.js ('users:write' -> hr_admin today). It refuses a username that
// already exists (409), a password shorter than 12 characters (400), and a role this product does
// not know (400) — a user whose role matches no policy cell could log in and do nothing.
// Layer 3, slice 2 adds the one field the scope checks need: `employee_id`, the account → person link
// (docs/access-model.md §2.2). Without it a `manager` account resolves to nobody's manager and an
// `employee` account to nobody, which is safe but useless; with it, a role's reach can be resolved.
// The link is refused if it names no employee, and refused if that employee already has an account.

app.get('/api/users', async (req, res) => {
  try {
    // `access_role` is the renamed column (§2.4); the payload still carries no password material.
    const users = await db.query('SELECT id, username, access_role, created_at FROM users ORDER BY created_at');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, access_role: accessRole, employee_id: employeeId } = req.body || {};
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'username is required' });
    }
    const name = username.trim();
    if (typeof password !== 'string' || password.length < 12) {
      return res.status(400).json({ error: 'password must be at least 12 characters' });
    }
    if (!access.isKnownRole(accessRole)) {
      return res.status(400).json({ error: 'unknown role', known_roles: access.ROLE_LIST });
    }
    const existing = await db.query(`SELECT id FROM users WHERE username = ${db.escapeString(name)}`);
    if (existing.length) return res.status(409).json({ error: 'that username already exists' });

    // The account → person link, when one is given. Three refusals, each naming what is wrong: the
    // employee must exist, must not already have an account, and a link that is absent stays NULL
    // (the honest state of an account that is not tied to a person yet — today's single admin row).
    let linkedEmployee = null;
    if (employeeId !== undefined && employeeId !== null && String(employeeId).trim() !== '') {
      linkedEmployee = String(employeeId).trim();
      const employee = await db.query(`SELECT id FROM employees WHERE id = ${db.escapeString(linkedEmployee)}`);
      if (!employee.length) return res.status(400).json({ error: 'employee_id does not name an employee' });
      const alreadyLinked = await db.query(`SELECT id FROM users WHERE employee_id = ${db.escapeString(linkedEmployee)}`);
      if (alreadyLinked.length) return res.status(409).json({ error: 'that employee already has an account' });
    }

    const id = generateId();
    const password_hash = await auth.hashPassword(password);
    await db.query(`INSERT INTO users (id, username, password_hash, access_role, employee_id) VALUES (${db.escapeString(id)}, ${db.escapeString(name)}, ${db.escapeString(password_hash)}, ${db.escapeString(accessRole)}, ${db.escapeString(linkedEmployee)})`);
    // Layer 3, slice 2 (prerequisite 3): creating an account is now attributable. Before this the
    // route wrote no audit row at all, so nothing said WHO made an account — and the two employee
    // write paths (the CREATE and UPDATE handlers below) wrote the literal 'system' into this same
    // field, which was a false name in a column that exists to hold a person's. This slice fixes
    // those two as well, so `'system'` no longer appears in any audit row on a write path.
    // The actor is the authenticated caller: the gate (`users:write`) runs before this handler, so
    // `req.user.username` is the real signer, and the `|| null` is the same honest fallback the
    // pre-boarding paths use rather than a fake name.
    const actor = actorOf(req);
    // The password is NOT recorded: `new_values` carries what was created, never the credential.
    await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, new_values, timestamp)
      VALUES (${db.escapeString(generateId())}, ${db.escapeString(actor)}, 'user', ${db.escapeString(id)}, 'CREATE', ${db.escapeString(JSON.stringify({ username: name, access_role: accessRole, employee_id: linkedEmployee }))}, CURRENT_TIMESTAMP)`);
    res.status(201).json({ id, username: name, access_role: accessRole, employee_id: linkedEmployee });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -------------------------------------------------------------
// EMPLOYEE APIS
// -------------------------------------------------------------

app.get('/api/employees', async (req, res) => {
  try {
    // Jurisdiction filter: the active demo surface is UAE-first (owner direction,
    // 2026-10-02). ?jurisdiction=AE|SA filters the roster by data_residency_country;
    // omitting it (or any other value) returns everyone, unfiltered — nothing is
    // deleted or hidden at the data layer, only at the query the UI happens to send.
    // Layer 3, slice 2 (the same point, sharpened): a FILTER is not an access control, and this
    // route is where that claim was always about to be tested. The row scope below is the control.
    const conditions = [];
    const jurisdiction = (req.query.jurisdiction || '').toUpperCase();
    if (jurisdiction === 'AE' || jurisdiction === 'SA') {
      conditions.push(`data_residency_country = ${db.escapeString(jurisdiction)}`);
    }
    // §3.1/§6.1: a manager reads their own reporting line and NOT the company. The line is resolved
    // from `employees.manager_id` against the caller's own `users.employee_id`, so an account with no
    // link has no reports — an empty roster, which is the truth about it, not the company's.
    if (req.accessScope === access.SCOPE.REPORTS) {
      const me = await callerEmployeeId(req);
      if (!me) return res.json([]);
      conditions.push(`manager_id = ${db.escapeString(me)}`);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const employees = await db.query(`SELECT * FROM employees${where} ORDER BY start_date DESC`);

    // The field half of the cell. `null` means the policy does not say which columns this role may
    // see, and the honest answer to that is to serve none of them rather than all (§3.1: the roster
    // decrypts both national-ID columns, so "encrypted at rest" discloses nothing if everyone's read
    // decrypts them; and a manager must not see a report's pay — §4).
    const removed = access.fieldsRemovedFor('employees:read', req.user.access_role);
    if (removed === null) return refuse(res);
    const project = (emp) => {
      const row = {};
      for (const key of Object.keys(emp)) {
        if (removed.indexOf(key) === -1) row[key] = emp[key];
      }
      // Decrypt ONLY what this role is being served: a column that is removed is never decrypted,
      // so no role's response passes through the plaintext on its way out.
      if (removed.indexOf('national_id_value') === -1) row.national_id_value = auth.decrypt(row.national_id_value);
      if (removed.indexOf('national_id_iqama') === -1) row.national_id_iqama = auth.decrypt(row.national_id_iqama);
      return row;
    };
    res.json(employees.map(project));
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// REMOVED 2026-10-13, owner decision 21 executed: the single-employee read `GET /api/employees/:id`
// used to sit here. Its response body WAS the decrypted identifier — `SELECT * FROM employees`
// filtered to one row, `auth.decrypt()` on both national-ID columns, then `res.json(emp)` — and it
// had no caller at all: the roster above is what the UI reads, and the detail view takes its
// employee from that list. The retirement is asserted rather than remembered: the path is written
// down in RETIRED (server/reachability-register.js), and server/reachability.test.js reddens if it
// is answerable again.

app.post('/api/employees', async (req, res) => {
  try {
    const data = req.body;

    // §5.2 rule 1: every write names the signed-in actor, and an unnamed one is REFUSED rather than
    // recorded (rule 3). This path used to write the literal 'system' into `performed_by` — a field
    // that exists to hold a person's name, holding a false one, which is worse than a blank.
    const actor = actorOf(req);
    if (!actor) return res.status(400).json({ error: 'a named actor is required to create an employee' });

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

    // Decision 17 fence (2026-10-13, lead's ruling): this INSERT no longer names
    // `consent_granted`. The company-visible column keeps its schema DEFAULT 0 — what is removed is
    // the product's second write path to a retired instrument, not the column.
    const insertSql = `
      INSERT INTO employees (
        id, first_name, last_name, email, department, role, manager_id, start_date, status, salary, basic_salary, 
        recruitment_cost, national_id_type, national_id_value, national_id_iqama, data_residency_country, 
        jurisdiction, total_salary,
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
        ${db.escapeString(data.visa_status)},
        ${db.escapeString(data.visa_expiry_date)}, ${eosbAccrued}, 0,
        'resignation', ${parseFloat(data.unpaid_leave_days) || 0}
      )
    `;
    await db.query(insertSql);

    const auditData = { ...data, national_id_value: encryptedNationalId, national_id_iqama: encryptedIqama };
    await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, new_values, timestamp)
      VALUES (${db.escapeString(generateId())}, ${db.escapeString(actor)}, 'employee', ${db.escapeString(id)}, 'CREATE', ${db.escapeString(JSON.stringify(auditData))}, CURRENT_TIMESTAMP)`);

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

    // §5.2 rule 1/3, exactly as on the CREATE path above: the actor is signed in and named, or the
    // write does not happen. This path used to attribute every edit to the literal 'system'.
    const actor = actorOf(req);
    if (!actor) return res.status(400).json({ error: 'a named actor is required to update an employee' });

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
      // Decision 17 fence (2026-10-13): `consent_granted` was removed from this numeric whitelist.
      // A retired instrument must not keep a write path; the column stays with DEFAULT 0.
      } else if (['salary', 'basic_salary', 'recruitment_cost', 'eosb_paid', 'unpaid_leave_days'].includes(key)) {
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
        VALUES (${db.escapeString(generateId())}, ${db.escapeString(actor)}, 'employee', ${db.escapeString(empId)}, 'UPDATE', ${db.escapeString(JSON.stringify(emp))}, ${db.escapeString(JSON.stringify(auditNewValues))}, CURRENT_TIMESTAMP)`);

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
  // §3.1: HR reads anyone's; a manager their reports'; an `employee` their OWN row only — this is the
  // cell the ruling's `⊘ scoped (own)` becomes now that `users.employee_id` can say which row is
  // theirs. A caller outside their scope is refused with the gate's own shape: 403, no body.
  if (!(await scopeAllowsTarget(req, req.params.id))) return refuse(res);
  const tasks = await db.query(`SELECT * FROM onboarding_tasks WHERE employee_id = ${db.escapeString(req.params.id)}`);
  res.json(tasks);
});

// Decision 22: the tick records WHO ticked it. Before this slice the row carried a date and no
// name, while the pre-boarding side already refuses an unnamed actor with 400 — this makes the two
// sides agree: completing without a named actor is refused, and the name is the signed-in user's
// (never 'system', never a placeholder).
//
// Layer 3, slice 2 adds the OTHER half of the same question (§6.4): requiring an actor names WHO
// ticked it, not THAT THEY WERE ENTITLED TO. The route takes a task id and no employee id, so the
// task is resolved first and its employee checked against the caller's scope — HR may tick any, a
// manager only their reports', and an `employee` never (§6.4: the view is read-only, so the write
// stays refused for them by the policy cell). A task that resolves to nothing is refused rather than
// answered "Task updated" — the route does not report a change it did not make.
app.put('/api/onboarding-tasks/:id', async (req, res) => {
  try {
    const { status } = req.body || {};
    const actor = actorOf(req);
    if (req.accessScope !== access.SCOPE.ALL) {
      const task = await db.query(`SELECT employee_id FROM onboarding_tasks WHERE id = ${db.escapeString(req.params.id)}`);
      if (!task.length) return refuse(res);
      if (!(await scopeAllowsTarget(req, task[0].employee_id))) return refuse(res);
    }
    if (status === 'completed' && !actor) {
      return res.status(400).json({ error: 'a named actor is required to complete a task' });
    }
    const completed_at = status === 'completed' ? `datetime('now')` : 'NULL';
    const completed_by = status === 'completed' ? db.escapeString(actor) : 'NULL';
    await db.query(`UPDATE onboarding_tasks SET status = ${db.escapeString(status)}, completed_at = ${completed_at}, completed_by = ${completed_by} WHERE id = ${db.escapeString(req.params.id)}`);
    res.json({ message: 'Task updated', completed_by: status === 'completed' ? actor : null });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/employees/:id/offboarding', async (req, res) => {
  // §3.1: HR reads anyone's, an `employee` their own, and a manager is NOT in this cell at all — the
  // reporting line does not carry an exit view.
  if (!(await scopeAllowsTarget(req, req.params.id))) return refuse(res);
  const tasks = await db.query(`SELECT * FROM offboarding_tasks WHERE employee_id = ${db.escapeString(req.params.id)}`);
  res.json(tasks);
});

// Decision 22: the tick records WHO ticked it. Before this slice the row carried a date and no
// name, while the pre-boarding side already refuses an unnamed actor with 400 — this makes the two
// sides agree: completing without a named actor is refused, and the name is the signed-in user's
// (never 'system', never a placeholder).
app.put('/api/offboarding-tasks/:id', async (req, res) => {
  try {
    const { status } = req.body || {};
    const actor = actorOf(req);
    if (status === 'completed' && !actor) {
      return res.status(400).json({ error: 'a named actor is required to complete a task' });
    }
    const completed_at = status === 'completed' ? `datetime('now')` : 'NULL';
    const completed_by = status === 'completed' ? db.escapeString(actor) : 'NULL';
    await db.query(`UPDATE offboarding_tasks SET status = ${db.escapeString(status)}, completed_at = ${completed_at}, completed_by = ${completed_by} WHERE id = ${db.escapeString(req.params.id)}`);
    res.json({ message: 'Task updated', completed_by: status === 'completed' ? actor : null });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/compliance/calculate-eosb', (req, res) => {
  const { start_date, end_date, basic_salary, total_salary, country, termination_type, unpaid_leave_days } = req.body;
  const amount = eosb.calculateEOSB(start_date, end_date, basic_salary, total_salary, country, termination_type, unpaid_leave_days);
  res.json({ amount });
});

// The privacy notice the product serves. One definition, read by the route below and by the
// pre-boarding acknowledgement record, so a record's version cannot disagree with the notice a
// client can download (server/privacy-notice.js).
app.get('/api/compliance/notice', async (req, res) => {
  try {
    // No substitution: this is the notice as published — the document the hire is shown — not a
    // per-employee rendering. A pre-boarding case has no employee row to render against, which is
    // exactly why the gate needs this read.
    res.json({
      version: privacyNotice.noticeVersion(),
      content: privacyNotice.readNotice(),
      path: privacyNotice.noticePath(),
    });
  } catch (err) {
    console.error('[Compliance] Failed to read the privacy notice:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// REMOVED 2026-10-13, owner decision 17 executed: `POST /api/compliance/consent` used to sit here.
// It was the employee-record consent instrument's only writer inside the product — one INSERT into
// consent_records plus `UPDATE employees SET consent_granted = 1, consent_date = ...` — and no
// client code called it. The `consent_records` TABLE stays: purpose-scoped consent is decision 17's
// subject, and this removal takes away the door, not the store. Asserted in RETIRED
// (server/reachability-register.js).

app.get('/api/compliance/templates/:templateName/:employeeId', async (req, res) => {
  try {
    const { templateName, employeeId } = req.params;

    // §6.2: the response is a document ABOUT A NAMED PERSON'S MONEY, in a form that looks official.
    // The cell admits HR and finance; this is finance's own limit within it — the settlement
    // statement and not the contracts or the notices. A role the table does not cover is refused,
    // so `templatesAllowedFor` returning `undefined` is a refusal and never "all of them".
    const allowedTemplates = access.templatesAllowedFor(req.user.access_role);
    if (allowedTemplates === undefined) return refuse(res);
    if (allowedTemplates !== access.ALL_TEMPLATES && allowedTemplates.indexOf(templateName) === -1) return refuse(res);

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

    // Every template resolves through the same module the acknowledgement record reads, so the
    // document a client downloads and the version a record names can never come from two different
    // files — and both come from this repository, never from the host-shared copy that had drifted
    // (see server/privacy-notice.js).
    const templatePath = privacyNotice.templatePath(templateName);
    if (!fs.existsSync(templatePath)) return res.status(404).json({ error: 'Template not found' });
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const rendered = compliance.renderTemplate(templateContent, templateData);
    res.json({ content: rendered });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// REMOVED 2026-10-13, owner decision 21 executed: `GET /api/compliance/report` used to sit here. No
// client code called it, and what it would have returned is the reason: it decrypted
// `national_id_value` and `national_id_iqama` for EVERY employee, filtered that decrypted array by
// visa expiry, and returned `alerts` whole — a plaintext national ID and Iqama for every employee
// whose visa expires within 60 days — alongside `consentGranted`, the seeder-written flag decision
// 17 retires. Removing it also removed the only server-side READER of `employees.consent_granted`.
// Asserted in RETIRED (server/reachability-register.js).

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

// §5.2 rules 1 and 3 (decision 22), on the third path that ends an employment. This route inserts
// the exit interview and terminates the employee row — the same effect the PUT path reaches two hundred
// lines above. Until this change it had no actor gate and wrote no audit row, so a row could be ended
// with NOBODY's name on it (measured 2026-10-26 on a scratch rig: a token carrying no username was
// answered 201, the row went to status='terminated', and audit_logs for that employee still held only
// its CREATE row). It matters beyond bookkeeping: `status='terminated'` is one of the records
// replacement-cost.js reads to raise the Layer 4 flag, so the figure could move unattributably too.
// A route that ends someone's employment is a write path, and every write path names the person.
app.post('/api/exit-interviews', async (req, res) => {
  try {
    const data = req.body;
    // The actor is signed in and named, or nothing is written — before any lookup, as on the other paths.
    const actor = actorOf(req);
    if (!actor) return res.status(400).json({ error: 'a named actor is required to record an exit interview' });
    const empId = data.employee_id;
    const existing = await db.query(`SELECT * FROM employees WHERE id = ${db.escapeString(empId)}`);
    if (existing.length === 0) return res.status(404).json({ error: 'Employee not found' });
    const emp = existing[0];
    const id = generateId();
    // `satisfaction_score` was the ONE client value in this file interpolated straight into SQL. An
    // absent one put the bare word `undefined` in the statement, and the client's own
    // `parseInt('')` puts `NaN` there: both are a SQL logic error, and with no try/catch on the route
    // the rejected handler ended the PROCESS — measured 2026-10-26, one malformed request and the
    // product was gone. Coerced to a finite Number or NULL, as the numeric allow-list in the PUT path
    // coerces its own; a value that is not a number is stored as NULL, never as SQL.
    const scoreRaw = data.satisfaction_score;
    const score = (scoreRaw === null || scoreRaw === undefined || scoreRaw === '') ? null : Number(scoreRaw);
    const scoreSql = (score === null || !Number.isFinite(score)) ? 'NULL' : String(score);
    await db.query(`INSERT INTO exit_interviews (id, employee_id, interview_date, departure_reason, detailed_feedback, satisfaction_score)
      VALUES (${db.escapeString(id)}, ${db.escapeString(empId)}, ${db.escapeString(data.interview_date)},
      ${db.escapeString(data.departure_reason)}, ${db.escapeString(data.detailed_feedback)}, ${scoreSql})`);
    await db.query(`UPDATE employees SET status = 'terminated', end_date = ${db.escapeString(data.interview_date)} WHERE id = ${db.escapeString(empId)}`);
    // The audit row the attributed path writes, for the effect THIS path has: the employee row, action
    // UPDATE, the before and after values, and the actor's name in the column that holds a person's
    // name. The interview's id rides in new_values, so the two records are joined by the log rather
    // than by a second convention invented here.
    await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, old_values, new_values, timestamp)
      VALUES (${db.escapeString(generateId())}, ${db.escapeString(actor)}, 'employee', ${db.escapeString(empId)}, 'UPDATE', ${db.escapeString(JSON.stringify(emp))}, ${db.escapeString(JSON.stringify({ status: 'terminated', end_date: data.interview_date, exit_interview_id: id }))}, CURRENT_TIMESTAMP)`);
    res.status(201).json({ id });
  } catch (err) {
    console.error('[ExitInterview] Failed to record an exit interview:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
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
    // §5.2 rule 3: an unnamed actor is REFUSED, not defaulted to 'system'. The `|| 'system'` that
    // stood here was the same false-name class the two employee paths carried: `actor` is used for
    // the case's `created_by` and for its audit row, so a 'system' here says a mechanism opened a
    // case that a person opened, and the pre-boarding record's whole value is that it names them.
    const actor = actorOf(req);
    if (!actor) return res.status(400).json({ error: 'a named actor is required to record an offer acceptance' });
    const { case: createdCase, created } = await preboarding.recordOfferAcceptance(req.body, {
      actor,
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
// The response is the module's envelope, `{ cases, totals }`, served unchanged: this route is
// transport and shapes nothing, so a second caller of `listCases` cannot receive a different
// payload than this one does.
app.get('/api/preboarding/cases', async (req, res) => {
  try {
    const envelope = await preboarding.listCases({
      jurisdiction: req.query.jurisdiction,
      status: req.query.status,
    });
    res.json(envelope);
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
  if (err instanceof preboardingItems.PreboardingItemError
      || err instanceof preboardingWorkspace.PreboardingWorkspaceError) {
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

// P2-4 — the workspace track's board for one case. `?function=IT|Admin|HR|Manager` is the
// "View by function" FILTER (the design review is explicit that it is not an access boundary
// while the product has one shared account; the payload says so in `view`). Transport only: the
// catalog, the derivation, the due dates and the refusals all live in preboarding-workspace.js.
// A line's status is moved by the existing item route above — one item model, two tracks.
app.get('/api/preboarding/cases/:id/workspace', async (req, res) => {
  try {
    res.json(await preboardingWorkspace.workspaceBoard(req.params.id, {
      function: req.query.function,
      collected_statuses: preboardingItems.COLLECTED_STATUSES,
    }));
  } catch (err) {
    sendItemError(res, err, 'Failed to read the workspace track');
  }
});

app.post('/api/preboarding/cases/:id/items/:itemKey/status', async (req, res) => {
  try {
    // §5.2 rule 3: the actor is refused when unnamed, never defaulted — this row's `last_actor` is
    // read by the workspace track as who moved the line, so 'system' would be a false name there too.
    const actor = actorOf(req);
    if (!actor) return res.status(400).json({ error: 'a named actor is required to move a checklist item' });
    const item = await preboardingItems.setItemStatus({
      case_id: req.params.id,
      item_key: req.params.itemKey,
      status: req.body && req.body.status,
      document_reference: req.body && req.body.document_reference,
      note: req.body && req.body.note,
      actor,
    });
    res.json({ item });
  } catch (err) {
    sendItemError(res, err, 'Failed to move a checklist item');
  }
});

app.post('/api/preboarding/cases/:id/reminders', async (req, res) => {
  try {
    const actor = actorOf(req);
    if (!actor) return res.status(400).json({ error: 'a named actor is required to record a reminder' });
    const result = await preboardingItems.recordReminder({
      case_id: req.params.id,
      item_keys: (req.body && req.body.item_keys) || null,
      note: req.body && req.body.note,
      actor,
    });
    res.status(201).json(result);
  } catch (err) {
    sendItemError(res, err, 'Failed to record a reminder');
  }
});

// The record the collection gate reads: that the privacy notice was SHOWN, per document. The two
// consent routes that stood here are removed rather than reworded — `consent` is the instrument
// option B replaces, and leaving a writer in place would keep the defect reachable while the screen
// said something else. Nothing else in the product called them.
//
// `item_key` in the body names one document. With no `item_key`, the caller means "the notice was
// shown for this case" — the notice is one document covering all of its purposes, so the act is
// one act — and every collectible document without a record yet is recorded through the SAME module
// function, one row each. The record stays per document either way, because the lawful basis it
// carries is per document; a per-case row could only state one of them.
//
// The actor is the signed-in user, passed explicitly: the module refuses a record that does not
// name a person, so this route cannot write the literal 'system' its predecessor wrote.
app.post('/api/preboarding/cases/:id/notice-acknowledgements', async (req, res) => {
  try {
    const caseId = req.params.id;
    const recordedBy = (req.user && req.user.username) || null;
    const requested = req.body && req.body.item_key;
    let targets;
    if (requested) {
      targets = [requested];
    } else {
      const checklist = await preboardingItems.caseChecklist(caseId);
      targets = checklist.items
        .filter((item) => preboardingItems.isNoticeCollectible(item.item_key))
        .map((item) => item.item_key);
    }
    const results = [];
    for (const itemKey of targets) {
      results.push(await preboardingItems.recordNoticeAcknowledgement({
        case_id: caseId,
        item_key: itemKey,
        recorded_by: recordedBy,
        note: req.body && req.body.note,
      }));
    }
    const created = results.filter((result) => result.created).length;
    res.status(created > 0 ? 201 : 200).json({
      acknowledgements: results.map((result) => result.acknowledgement),
      created,
      considered: results.length,
      // The record's own version, echoed from the row that was written rather than from the file
      // read: what the caller is told is what the record says.
      notice_version: results.length ? results[0].acknowledgement.notice_version : null,
      // The case re-read, the way the pre-reading acknowledgement route returns its package: the
      // caller renders the state the server holds instead of assuming the write landed.
      checklist: await preboardingItems.caseChecklist(caseId),
    });
  } catch (err) {
    sendItemError(res, err, 'Failed to record that the privacy notice was shown');
  }
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
// -------------------------------------------------------------
// LAYER 2 — PRE-READING PACKAGE (P2-3: the acknowledgement record)
// -------------------------------------------------------------
// Transport only. Every rule that matters — there is no delivery channel, an item is
// acknowledged only where its record exists, the actor must be named, a signature cannot be
// recorded — lives in preboarding-package.js, so a caller that is not this route gets the same
// refusals. `?as_of=` is the time-stamped view: what was outstanding on a given date.
app.get('/api/preboarding/cases/:id/package', async (req, res) => {
  try {
    res.json(await preboardingPackage.casePackage(req.params.id, { as_of: req.query.as_of }));
  } catch (err) {
    if (err instanceof preboardingPackage.PreboardingPackageError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[PreboardingPackage] Failed to read the pre-reading package:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/preboarding/cases/:id/package/:itemKey/acknowledgement', async (req, res) => {
  try {
    const result = await preboardingPackage.recordAcknowledgement({
      case_id: req.params.id,
      item_key: req.params.itemKey,
      // The actor is the signed-in user, and it is passed explicitly: the module refuses a
      // record that does not name one.
      recorded_by: (req.user && req.user.username) || null,
      method: req.body && req.body.method,
      note: req.body && req.body.note,
    });
    res.status(result.created ? 201 : 200).json(result);
  } catch (err) {
    if (err instanceof preboardingPackage.PreboardingPackageError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[PreboardingPackage] Failed to record an acknowledgement:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.get('/api/preboarding/flag-watch', async (req, res) => {
  try {
    res.json(flagWatcher.status());
  } catch (err) {
    sendItemError(res, err, 'Failed to read the flag watcher record');
  }
});
flagWatcher.start();

// P4-1 — the replacement cost of a seat, read by the roster when a row carries a termination flag.
//
// APPENDED AT THE END OF THE ROUTES SECTION, and that placement is the point: docs/access-model.md
// cites `server/index.js:<line>` for every route (see its §3 matrix), so a route inserted between
// two existing routes stales every citation below it. P3-1 (row d73f8760) inserted its route
// mid-file and this repository paid for it — 137/137 checks on the instrument, then 80/137 on the
// merged tree. A route added here cannot move a citation above it. The §3.1 row for this route is
// part of the same change; a route without its row is the other half of that same defect.
app.get('/api/employees/:id/replacement-cost', async (req, res) => {
  try {
    // Required here, not at the top of the file: a line added above every route shifts every
    // `file:line` citation docs/access-model.md carries, which is the defect P3-1 taught us.
    const replacementCost = require('./replacement-cost');
    // The row scope is narrower than the roster's on purpose: the figure prices the role's daily
    // salary, so a manager reading a report's would be reading their pay by arithmetic (§4). Read
    // the company-wide scope, or a caller's own row; refuse everything else.
    const ownRow = (await callerEmployeeId(req)) === req.params.id;
    if (req.accessScope !== access.SCOPE.ALL && !ownRow) return refuse(res);

    const rows = await db.query(`SELECT * FROM employees WHERE id = ${db.escapeString(req.params.id)}`);
    if (!rows.length) return res.status(404).json({ error: 'employee not found' });
    const employee = rows[0];

    // The replacement is found in the roster — the earliest employee recorded in the same department
    // and role whose start date is after the departure date — and the payload names both the row it
    // found and the rule that found it, so a reader can disagree with the derivation rather than
    // having to trust the number. No replacement is NOT an error: the engine then says the vacancy
    // window is unknown instead of inventing one.
    let successor = null;
    if (employee.end_date && employee.department && employee.role) {
      const found = await db.query(
        `SELECT id, start_date FROM employees`
        + ` WHERE department = ${db.escapeString(employee.department)}`
        + ` AND role = ${db.escapeString(employee.role)}`
        + ` AND id <> ${db.escapeString(employee.id)}`
        + ` AND start_date > ${db.escapeString(employee.end_date)}`
        + ` ORDER BY start_date ASC LIMIT 1`
      );
      if (found.length) successor = found[0];
    }

    res.json(replacementCost.computeReplacementCost({
      employee,
      successor,
      asOf: new Date().toISOString().slice(0, 10),
    }));
  } catch (err) {
    console.error('[ReplacementCost] Failed to compute:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// The watcher's route is registered BEFORE the static/SPA catch-all below: that catch-all
// answers every unknown /api path with a JSON 404, so a route added after it is unreachable.
// -------------------------------------------------------------
// SERVE FRONTEND
// -------------------------------------------------------------

app.use(express.static(path.join(__dirname, '../client/dist')));

/**
 * P3-1 (row `d73f8760`) — the probation timeline of every hire whose probation is still running.
 *
 * DERIVED ON READ. No milestone row exists in the schema and none is authored per employee: the three
 * dates are a function of `start_date` and the probation window's length, with the negative cases and
 * the proof written down in `server/probation-timeline.js` and its suite. `?as_of=YYYY-MM-DD` reads
 * the same derivation as of another day — the instrument the demo and the evidence rig use to show
 * the same figures twice; a value that is not a date is refused (400) rather than silently ignored,
 * because an instrument that quietly does nothing is the "reading taken with a tool that is not
 * installed" this team has already paid for once.
 *
 * AUTHORIZATION: the resource is `employees:read` (server/access.js) and the ROW scope below is the
 * roster's own — HR the company, a manager their line, finance the company — so this route's audience
 * is exactly the audience of the rows the dates are computed from. Nothing here discloses a column
 * the caller could not already read.
 *
 * A terminated hire is not in the list: their probation is not running, which is the same reading the
 * dashboard's headcount already takes of `status = 'terminated'`.
 */
app.get('/api/probation/timelines', async (req, res) => {
  try {
    const asOf = req.query.as_of;
    if (asOf !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(asOf))) {
      return res.status(400).json({ error: 'as_of must be a date, YYYY-MM-DD' });
    }
    const unpinned = { timelines: [], completions_recorded: true, note: probationTimeline.COMPLETION_NOTE };

    const conditions = [`status != 'terminated'`];
    const jurisdiction = (req.query.jurisdiction || '').toUpperCase();
    if (jurisdiction === 'AE' || jurisdiction === 'SA') {
      conditions.push(`data_residency_country = ${db.escapeString(jurisdiction)}`);
    }
    if (req.accessScope === access.SCOPE.REPORTS || req.accessScope === access.SCOPE.OWN) {
      const me = await callerEmployeeId(req);
      // An account tied to no employee has no line and no record: an empty list is the truth about
      // it, exactly as the roster route reports it.
      if (!me) return res.json(unpinned);
      conditions.push(req.accessScope === access.SCOPE.OWN ? `id = ${db.escapeString(me)}` : `manager_id = ${db.escapeString(me)}`);
    }

    const rows = await db.query(
      `SELECT id, first_name, last_name, start_date, probation_end_date FROM employees WHERE ${conditions.join(' AND ')}`
    );
    // P3-2: the submitted evaluations ARE the `completed` state. Read for the whole list in ONE query
    // rather than one per hire (server/probation-evaluations.js), and filtered by `?as_of` when that is
    // given — a reading pinned to a past day must not show a milestone completed by a submission made
    // after it, or the "same figures read twice" instrument would be reading today's state under
    // yesterday's date.
    const completionsByEmployee = await probationEvaluations.completionsFor(rows.map((row) => row.id), { asOf });
    const timelines = probationTimeline.timelinesFor(
      rows.map((row) => ({ ...row, name: `${row.first_name} ${row.last_name}`.trim() })),
      { now: asOf, completionsByEmployee }
    );
    res.json({ timelines, completions_recorded: true, note: probationTimeline.COMPLETION_NOTE });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * P3-2 (row `69dbf57d`) — a manager submits the structured evaluation for one milestone. That
 * submission is the ONLY thing that makes the milestone read `completed`; the rules (empty content, an
 * index that is not this hire's, a second submission for the same milestone) live in
 * server/probation-evaluations.js, and this handler is transport: the actor gate, the row scope, the
 * typed refusal, and nothing else.
 *
 * AUTHORIZATION: the resource is `onboarding:write` (server/access.js — HR_ADMIN and MANAGER), and the
 * ROW scope below is narrower than the role: a caller who is not company-wide may submit only for a
 * hire whose `manager_id` is their own employee record. A hire cannot submit their own evaluation: the
 * record's premise is that a manager wrote it. Refused with the gate's own shape (403, no body), which
 * `client/src/httpStatus.js` classifies as a refusal in place rather than a session ending.
 *
 * The actor gate is FIRST and refuses before any lookup (decision 22), so an unnamed token cannot even
 * learn whether the employee exists.
 */
app.post('/api/employees/:id/probation-evaluations', async (req, res) => {
  try {
    const actor = actorOf(req);
    if (!actor) return res.status(400).json({ error: 'a named actor is required to submit a probation evaluation' });
    const subject = await probationEvaluations.loadSubject(req.params.id);
    // The row scope, through the codebase's own helper: ALL reaches the company, REPORTS reaches the
    // caller's own line, an unstated scope reaches nothing. PLUS one refusal the helper cannot express:
    // nobody submits an evaluation about THEMSELVES - the record's premise is that a manager wrote it -
    // so SELF is refused even though `scopeAllowsTarget` would allow it.
    const relation = await relationTo(req, subject.id);
    if (relation === access.RELATION.SELF || !(await scopeAllowsTarget(req, subject.id))) {
      return res.status(403).end();
    }
    const { evaluation, milestone } = await probationEvaluations.recordEvaluation(subject, req.body, { actor });
    res.status(201).json({ evaluation, milestone });
  } catch (err) {
    if (err instanceof probationEvaluations.ProbationEvaluationError) {
      const payload = { error: err.message };
      if (err.known_milestones) payload.known_milestones = err.known_milestones;
      if (err.recorded_by) { payload.recorded_by = err.recorded_by; payload.recorded_at = err.recorded_at; }
      return res.status(err.status).json(payload);
    }
    console.error('[Probation] Failed to record an evaluation:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

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
