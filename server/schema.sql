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
  completed_by TEXT,
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
  completed_by TEXT,
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
  -- Which track created this item: 'employee' (P2-2's document collection) or 'workspace'
  -- (P2-4's provisioning checklist). One table, two tracks, and the column is what lets every
  -- reader keep them apart — the row shows two counts, the PDPL consent gate applies to the
  -- hire's documents only, and a reminder is about documents, not about a laptop. Existing rows
  -- predate the column and are employee-track items, which is what the default records.
  track TEXT NOT NULL DEFAULT 'employee',
  -- The responsible function on a workspace line: one of IT · Admin · HR · Manager (P2-4). NULL
  -- on the employee track, where no owner is recorded — and where none is therefore invented
  -- (see preboarding-flag.js). Stored rather than derived from the catalog, because an
  -- assignment is a record: changing the catalog must not silently reassign work that is
  -- already in flight. The line's DUE DATE is not stored — it is derived on every read from the
  -- case's start date and the catalog's offset, so it cannot go stale and a change to the
  -- offsets moves every line at once.
  owner TEXT,
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

-- RETIRED 2026-10-12 — kept, not dropped, and read by nothing.
--
-- This was the case-level PDPL consent record the document collection gate read. It is retired
-- because it recorded the wrong instrument: `consent` is the one basis a person can withdraw, and
-- the notice the hire is actually shown assigns consent to biometrics and sensitive data alone —
-- none of which are in the pre-boarding document set. It is also structurally incapable of the
-- replacement: one row per case cannot carry seven different lawful bases.
--
-- `preboarding_notice_acknowledgements` below is what the gate reads now. No code path writes or
-- reads this table any more (the writers were removed with the decision, so the old record cannot
-- be recreated), and the seed clears any row a previous deploy left behind rather than leaving a
-- stale row that claims a hire consented to something nobody asked them about. The table itself is
-- left in place because dropping it is a destructive migration with no benefit this cycle; nothing
-- in the product depends on its existence.
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

-- The record the document collection gate reads: that the privacy notice was SHOWN, one row per
-- document, naming the person who showed it, against the version of the notice actually shown.
--
-- Why one row per document rather than one per case, which is the whole point of the shape:
--   * the lawful basis differs per document (the notice's purpose table assigns legal obligation
--     to the passport/visa/Emirates ID, contractual necessity to the bank details), so a case-level
--     basis could only ever be one of them, stated as if it covered all seven;
--   * the gate is satisfied per item — "may this document be collected?" is a question about this
--     document, and a case-level flag would open the whole checklist on the strength of one;
--   * `instrument` says what this record IS, and the CHECK constraint makes the table capable of
--     holding nothing else. Option B exists because a consent record and a notice-shown record are
--     different instruments; the schema is where that separateness has to be structural, so a
--     future writer cannot store one as the other.
--
-- `recorded_by` is NOT NULL: the record's evidential value is that a person put the notice in front
-- of the hire, so a row with no named person must not be constructible (there is no hire login in
-- this release — portal identity is decision 14, open). `method` is an in-product record, never a
-- signature; the product cannot obtain an e-signature, so a row claiming one must not be writable.
-- `lawful_basis` is NOT NULL: an item the notice assigns no basis to is not recordable at all
-- (server/preboarding-items.js refuses it by name), so "no basis" is a refusal rather than a row
-- holding a NULL that a reader could mistake for "consent not needed".
-- UNIQUE (case_id, item_key) makes recording idempotent: a replay returns the existing row instead
-- of creating a second one, so the timestamp HR reads is the one first written.
CREATE TABLE IF NOT EXISTS preboarding_notice_acknowledgements (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  instrument TEXT NOT NULL CHECK (instrument = 'notice_shown'),
  lawful_basis TEXT NOT NULL,
  notice_version TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'in_product_record',
  note TEXT,
  acknowledged_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (case_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_preboarding_notice_ack_case
  ON preboarding_notice_acknowledgements (case_id);

-- -------------------------------------------------------------
-- LAYER 2 — PRE-READING PACKAGE (P2-3: the acknowledgement record)
-- -------------------------------------------------------------
-- The record P2-3 is built on: "nothing is marked acknowledged without the acknowledgement
-- existing" (spec §9 D6). One row per item the hire's package has actually recorded, and the
-- read derives its state from these rows alone — never from a case-level progress figure.
--
-- Two honest limits are encoded here rather than papered over:
--   * `recorded_by` is NOT NULL. There is no hire-facing portal (P2-6) and no new-hire login
--     (per-user accounts are Layer 3), so the only actor this release can name is the person
--     recording on the hire's behalf, and the record names them.
--   * `method` is an in-product record, never a signature. The product cannot obtain an
--     e-signature, so a row claiming one must not be constructible.
-- UNIQUE (case_id, item_key) makes recording idempotent: a replay returns the existing record
-- instead of creating a second one, so the timestamp HR reads is the one that was first written.
CREATE TABLE IF NOT EXISTS preboarding_acknowledgements (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  acknowledgement_required INTEGER NOT NULL DEFAULT 0,
  recorded_by TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'in_product_record',
  note TEXT,
  acknowledged_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (case_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_preboarding_ack_case ON preboarding_acknowledgements (case_id);
CREATE INDEX IF NOT EXISTS idx_preboarding_items_case ON preboarding_items (case_id);
CREATE INDEX IF NOT EXISTS idx_preboarding_reminders_case ON preboarding_reminders (case_id);
