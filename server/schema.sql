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

-- -------------------------------------------------------------
-- LAYER 2 — PRE-BOARDING EMPLOYEE TRACK (P2-2: document collection)
-- -------------------------------------------------------------
-- One row per checklist item on a case. Items are seeded from the case's jurisdiction set
-- (server/preboarding-items.js), never typed per case, so the same role in the same
-- jurisdiction always gets the same list. UNIQUE (case_id, item_key) is what makes seeding
-- idempotent: a replayed offer acceptance cannot duplicate a checklist item.
CREATE TABLE IF NOT EXISTS preboarding_items (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'not_started',
  -- A reference to the document (a file name, the reference the hire quoted), never its
  -- contents: this release has no file storage, and no personal data belongs in this column.
  document_reference TEXT,
  note TEXT,
  requested_at TEXT,
  received_at TEXT,
  verified_at TEXT,
  last_actor TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (case_id, item_key)
);

-- The record that HR asked for the outstanding items. The product has no delivery channel
-- (no mailer, webhook or SMS), so this is the honest in-product record of the request — not
-- proof that a message reached the hire. `outstanding_keys` is the snapshot the reminder
-- covered; what is outstanding *now* is always derived from preboarding_items, never stored.
CREATE TABLE IF NOT EXISTS preboarding_reminders (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  item_key TEXT,
  outstanding_count INTEGER NOT NULL,
  outstanding_keys TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_product',
  note TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- The PDPL consent record the collection gate reads. P2-6 owns the consent lifecycle (notice
-- versioning, withdrawal, the Arabic-first notice, the hire-facing capture); P2-2 ships only
-- what the gate needs — does a consent record exist for this case, and on what basis. Case
-- scoped, because a pre-boarding hire has no employee row yet.
CREATE TABLE IF NOT EXISTS preboarding_consents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE,
  consent_type TEXT NOT NULL,
  lawful_basis TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  recorded_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_preboarding_items_case ON preboarding_items (case_id);
CREATE INDEX IF NOT EXISTS idx_preboarding_reminders_case ON preboarding_reminders (case_id);
