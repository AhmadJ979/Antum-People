-- Antum People Product Schema

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT,
  role TEXT,
  manager_id TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT DEFAULT 'onboarding',
  salary REAL,
  recruitment_cost REAL,
  fully_productive_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  national_id_type TEXT,
  national_id_value TEXT,
  data_residency_country TEXT,
  consent_granted INTEGER DEFAULT 0,
  consent_date TEXT,
  visa_status TEXT,
  visa_expiry_date TEXT,
  basic_salary REAL DEFAULT 0.0,
  eosb_accrued REAL DEFAULT 0.0,
  eosb_paid REAL DEFAULT 0.0,
  national_id_iqama TEXT,
  jurisdiction TEXT,
  total_salary REAL DEFAULT 0.0,
  unpaid_leave_days INTEGER DEFAULT 0,
  probation_end_date TEXT,
  nitaqat_band TEXT,
  emirati_flag INTEGER DEFAULT 0,
  governing_law TEXT,
  allowances_housing REAL DEFAULT 0.0,
  allowances_transport REAL DEFAULT 0.0,
  gave_proper_notice INTEGER DEFAULT 1,
  termination_type TEXT
);

CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  completed_at TEXT,
  status TEXT DEFAULT 'pending',
  category TEXT,
  ttv_milestone INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees (id)
);

CREATE TABLE IF NOT EXISTS offboarding_tasks (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  completed_at TEXT,
  status TEXT DEFAULT 'pending',
  category TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees (id)
);

CREATE TABLE IF NOT EXISTS exit_interviews (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  interview_date TEXT NOT NULL,
  departure_reason TEXT NOT NULL,
  detailed_feedback TEXT,
  satisfaction_score INTEGER,
  preventable INTEGER DEFAULT 0,
  new_employer TEXT,
  new_salary REAL,
  FOREIGN KEY (employee_id) REFERENCES employees (id)
);

CREATE TABLE IF NOT EXISTS analytics_metrics (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value REAL,
  metric_text TEXT,
  recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees (id)
);

CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT,
  consent_type TEXT,
  status TEXT,
  consent_date TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  lawful_basis TEXT,
  granted_at TEXT,
  revoked_at TEXT,
  consent_version TEXT
);

CREATE TABLE IF NOT EXISTS data_subject_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT,
  request_type TEXT,
  status TEXT,
  request_date TEXT,
  completion_date TEXT,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS breach_register (
  id TEXT PRIMARY KEY,
  incident_date TEXT,
  discovery_date TEXT, severity TEXT,
  description TEXT,
  affected_subjects_count INTEGER,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  data_categories TEXT,
  notified_regulator TEXT,
  notified_regulator_at TEXT,
  notified_subjects TEXT,
  notified_subjects_at TEXT,
  remedial_actions TEXT,
  jurisdiction TEXT
);

CREATE TABLE IF NOT EXISTS eosb_calculations (
  id TEXT PRIMARY KEY,
  employee_id TEXT,
  calculation_date TEXT,
  jurisdiction TEXT,
  start_date TEXT,
  end_date TEXT,
  basic_salary REAL,
  total_salary REAL,
  unpaid_leave_days INTEGER,
  is_resignation INTEGER,
  accrued_amount REAL,
  formula_used TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  gross_amount REAL,
  deductions REAL DEFAULT 0.0,
  net_amount REAL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  performed_by TEXT,
  old_values TEXT,
  new_values TEXT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  password_hash TEXT,
  role TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Layer 2 — Pre-boarding Intelligence (P2-1).
-- One row per ACCEPTED JOB OFFER. offer_reference is UNIQUE, and that constraint is what
-- makes the case creation idempotent: re-processing the same acceptance finds the case that
-- already exists instead of opening a second one. The only writer is
-- server/preboarding.js#recordOfferAcceptance (see the note at the top of that file).
CREATE TABLE IF NOT EXISTS preboarding_cases (
  id TEXT PRIMARY KEY,
  offer_reference TEXT NOT NULL UNIQUE,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT,
  role TEXT NOT NULL,
  department TEXT NOT NULL,
  reporting_line TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  start_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  source TEXT NOT NULL,
  offered_at TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
