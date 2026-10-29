const { v4: uuidv4 } = require('uuid');

/**
 * Compliance Engine for Antum People
 * Handles jurisdiction-aware tasks, audit logging, and document rendering.
 */

const checklistTemplates = {
  UAE: {
    onboarding: [
      { title: 'MoHRE Contract Signing', description: 'Ensure the employee signs the official MoHRE contract template.' },
      { title: 'Entry Permit Issuance', description: 'Apply for and receive the entry permit for the employee.' },
      { title: 'Medical Fitness Test', description: 'Schedule and complete the mandatory medical fitness test in UAE.' },
      { title: 'Emirates ID Biometrics', description: 'Employee to attend biometrics appointment for Emirates ID.' },
      { title: 'Residence Visa Stamping', description: 'Complete the visa stamping/issuance in the passport or E-visa.' },
      { title: 'Wages Protection System (WPS) Registration', description: 'Register employee in the WPS for salary transfers.' },
      { title: 'Privacy Notice — Shown', description: 'Tick once the current privacy notice has been shown. This records the date only — no name is stored here, so the tick is an unnamed assertion; the named record (one per collectable document, with its basis, the notice version and the person who showed it) lives on the pre-boarding case. No consent flag is held on the employee record.' }
    ],
    offboarding: [
      { title: 'Hardware Return', description: 'Collect company-issued laptops, phones, and other assets.' },
      { title: 'Access Revocation', description: 'Revoke access to IT systems, email, and physical premises.' },
      { title: 'Notice Period Verification', description: 'Confirm notice period served (30–90 days per contract).' },
      { title: 'EOSB Calculation (UAE)', description: 'Calculate basis = basic wage only (FDL 33/2021 Arts. 51–53).' },
      { title: 'Annual Leave Encashment', description: 'Calculate and pay accrued but unused annual leave.' },
      { title: 'MoHRE Work Permit Cancellation', description: 'Cancel the work permit via MoHRE system.' },
      { title: 'Residency Visa Cancellation', description: 'Complete visa cancellation within 30 days.' },
      { title: 'Final Settlement Payment (within 14 days)', description: 'Complete final payment within 14 days.' }
    ]
  },
  KSA: {
    onboarding: [
      { title: 'Qiwa Job Offer Acceptance', description: 'Send and confirm job offer through the Qiwa portal.' },
      { title: 'Qiwa Employment Contract', description: 'Register the digital employment contract on Qiwa.' },
      { title: 'Medical Exam (KSA)', description: 'Complete the mandatory medical exam for Iqama.' },
      { title: 'Iqama Issuance', description: 'Apply for and receive the Iqama (Residency ID).' },
      { title: 'GOSI Registration', description: 'Register the employee with the General Organization for Social Insurance.' },
      { title: 'Mudad (WPS) Enrollment', description: 'Ensure employee is enrolled in Mudad for salary protection.' },
      { title: 'Privacy Notice — Shown', description: 'Show the current privacy notice in Arabic first, then tick. This records the date only — no name is stored here, so the tick is an unnamed assertion; the named record (one per collectable document, with its basis, the notice version and the person who showed it) lives on the pre-boarding case. No consent flag is held on the employee record.' }
    ],
    offboarding: [
      { title: 'Hardware Return', description: 'Collect company-issued laptops, phones, and other assets.' },
      { title: 'Access Revocation', description: 'Revoke access to IT systems, email, and physical premises.' },
      { title: 'Notice Period Verification', description: 'Confirm served or compensated (M/51 Arts. 74–75).' },
      { title: 'EOSB Calculation (KSA)', description: 'Calculate basis = total monthly salary including allowances (M/51 Art. 84).' },
      { title: 'GOSI De-registration', description: 'Remove employee from GOSI system.' },
      { title: 'Iqama Cancellation/Transfer', description: 'Complete Iqama formalities (within 90 days).' },
      { title: 'Final Exit Visa (or re-entry, if transferring)', description: 'Process visa through Jawazat (must follow Iqama).' },
      { title: 'Service Certificate Issuance', description: 'Issue mandatory service certificate (within 2 weeks).' },
      { title: 'Annual Leave Encashment', description: 'Calculate and pay accrued but unused annual leave.' },
      { title: 'Final Settlement Payment', description: 'Pay salary + EOSB + leave + notice (within the settlement deadline).' }
    ]
  }
};

/**
 * Generates tasks for an employee based on jurisdiction and transition type.
 */
function generateTasks(employeeId, jurisdiction, type) {
  const templates = checklistTemplates[jurisdiction] || checklistTemplates['UAE'];
  const tasks = templates[type] || [];
  
  return tasks.map(t => ({
    id: uuidv4(),
    employee_id: employeeId,
    title: t.title,
    description: t.description,
    status: 'pending',
    created_at: new Date().toISOString()
  }));
}

/**
 * Logs a data mutation for audit purposes.
 */
async function logMutation(db, actorId, entityType, entityId, action, oldValue, newValue) {
  const logId = uuidv4();
  const timestamp = new Date().toISOString();
  
  // The app now uses a product-owned SQLite database.
  // This function represents the logic for logging actions.
  
  return {
    id: logId,
    actor_id: actorId,
    entity_type: entityType,
    entity_id: entityId,
    action: action,
    old_value: JSON.stringify(oldValue),
    new_value: JSON.stringify(newValue),
    timestamp: timestamp
  };
}

/**
 * THE FACTS A SERVED DOCUMENT MAY NAME, AND WHERE EACH ONE HAS TO COME FROM
 * ---------------------------------------------------------------------------
 * A document this product serves is read as an instrument: a contract somebody signs, a settlement
 * statement somebody is paid against, the notice a hire is shown. So every fact it states has to
 * come from a record. What stood here until 2026-10-28 was a table of *defaults* that invented one
 * where no record held it — `Antum Regional Hub`, `TL-882733-G`, `EST-99228`, `QIWA-88271`,
 * `HR Director`, `privacy@antum.ae`, `6` (printed as 6 months in the UAE contract and 6 days in the
 * KSA one) and `0.00` down every money row of the settlement statement.
 *
 * None of those facts is held anywhere in this product, and that was MEASURED rather than assumed
 * (2026-10-28, on a scratch instance seeded from this repository's own scripts/seed-demo.js):
 *
 *   * 19 tables in `sqlite_master`, and NONE of them is a company / employer / organisation /
 *     tenant / settings row — so no employer identity, licence or registration is stored at all;
 *   * the 37 `employees` columns (`pragma_table_info('employees')`) carry no employer, trade-licence,
 *     MoHRE, Qiwa or data-protection field;
 *   * no row of ANY table contains any of the invented strings (`LIKE '%<literal>%'` over every text
 *     column of every table: 0 rows for each of the seven);
 *   * the server reads seven environment variables and none of them is one of these facts.
 *
 * `employees.probation_end_date` and `employees.start_date` DO exist, so a probation period could be
 * DERIVED from them. Derived is not read: the contract states the term the parties agreed, and this
 * engine holds no record of that agreement — so the term is refused rather than computed from dates.
 *
 * The label is what a refusal names, so it has to be something a reader can go and record.
 */
const REQUIRED_FACTS = Object.freeze({
  // the party that issues the document, and its registrations
  employer_name: 'employer legal name',
  employer_address: 'employer registered address',
  employer_representative: 'employer signatory name',
  employer_representative_title: 'employer signatory title',
  trade_license: 'trade licence number',
  mohre_code: 'MoHRE establishment code',
  qiwa_id: 'Qiwa establishment ID',
  dpo_email: 'data protection contact email',
  // terms the document states as agreed
  probation_period: 'probation period',
  visa_status: 'visa status',
  // WHY the employment ended, when the document states it. A reason is a record of an event, so a
  // blank row is a missing fact and not a default: the settlement statement's Reason for Termination
  // row used to be served with the invented word 'Resignation' (owner ruling 2026-10-29). Naming it
  // here means the row renders as a legible "(reason for termination ... not held)", the refusal lists
  // it, and the document is withheld rather than issued on a reason nobody recorded.
  termination_reason: 'reason for termination',
  // amounts
  basic_salary: 'basic salary',
  total_salary: 'total monthly salary',
  eosb_amount: 'end-of-service benefit',
  final_pro_rated_salary: 'pro-rated final salary',
  unused_leave_amount: 'accrued leave amount',
  notice_pay: 'notice-period pay',
  ticket_allowance: 'ticket allowance',
  other_payments: 'other payments',
  gross_settlement: 'gross settlement total',
  loan_deduction: 'outstanding loan deduction',
  assets_deduction: 'unreturned assets deduction',
  fine_deduction: 'traffic fine deduction',
  total_deductions: 'total deductions',
  net_settlement: 'net settlement payable'
});

/**
 * WHICH DOCUMENT MAY BE ISSUED, AND WHICH MAY ONLY BE HANDED OVER AS A FORM
 * ------------------------------------------------------------------------
 * An **instrument** is a document a reader can act on or sign. When a fact it names is not held it is
 * not issued: a partially filled contract is the defect this file exists to stop, because a reader
 * cannot tell an invented licence number from a real one.
 *
 * A **form** is a working document a human fills in — a questionnaire, a notification letter, a DPA
 * draft whose own header says "Working template". It keeps a legible blank, which is what a reader
 * needs in order to see that it is not filled in.
 *
 * A template this table does not name is treated as an INSTRUMENT. That is the safe direction: an
 * unknown document is withheld rather than issued.
 */
const DOCUMENT_CLASS = Object.freeze({
  'uae-employment-contract': 'instrument',
  'ksa-employment-contract': 'instrument',
  'final-settlement-statement': 'instrument',
  'privacy-notice': 'instrument',
  'breach-notification-letters': 'form',
  'data-processing-agreement': 'form',
  'dpia-questionnaire': 'form'
});

/** `instrument` unless the table above says otherwise — never "all of them". */
function documentClassFor(templateName) {
  return DOCUMENT_CLASS[templateName] || 'instrument';
}

/** The placeholders a text leaves for a record to fill — `[employer_name]` and its siblings. */
function placeholdersIn(text) {
  const found = [];
  for (const match of String(text).matchAll(/\[([a-z][a-z0-9_]*)\]/g)) {
    if (found.indexOf(match[1]) === -1) found.push(match[1]);
  }
  return found;
}

/**
 * The placeholders still unfilled in a served text — what a reader sees as a bracketed blank.
 * The notice is served as published (see its route), and no record holds its Controller or its
 * data-protection contact, so this is how a route can say which lines a reader will find blank.
 */
function unpopulatedPlaceholders(text) {
  return placeholdersIn(text);
}

/**
 * Renders a markdown template from what the records hold.
 *
 * Each placeholder the template actually uses is resolved once, in the order it appears:
 *   * a REQUIRED_FACTS key no record supplies is rendered as `— (label — not held)` and its label is
 *     returned in `missing`, so the route can refuse to issue the document;
 *   * any other placeholder with no value is left exactly as the template wrote it, so it stays a
 *     visible blank instead of becoming a string that reads like a value.
 *
 * Nothing is filled in from a default. A caller that wants a document issued has to supply the fact.
 *
 * @returns {{content: string, missing: string[]}} `missing`, in document order, deduplicated.
 */
function renderTemplate(templateContent, data = {}) {
  // The employee-record fields the templates name. `not calculated` is not a value either, but it is
  // the wording these fields have carried since before this change; what this change stops is a fact
  // being INVENTED, and these are left alone deliberately (see the PR body's scope note).
  const values = {
    current_date: data.current_date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    full_name: data.full_name,
    full_name_arabic: data.full_name_arabic || data.full_name,
    dob: data.dob,
    nationality: data.nationality || 'not calculated',
    passport_no: data.passport_no || 'not calculated',
    national_id: data.national_id || 'not calculated',
    start_date: data.start_date || 'not calculated',
    end_date: data.end_date || 'not calculated',
    employee_id: data.employee_id || 'not calculated',
    role: data.role || 'not calculated',
    department: data.department || 'not calculated',
    contract_no: data.contract_no || 'not calculated',
    // `termination_reason` is deliberately NOT defaulted here any more. It is a REQUIRED_FACT (see
    // the table above), so the line below overwrites this entry with the record's own value — and
    // the `|| 'not calculated'` that used to sit here was a second place a reason-shaped word could
    // come from. One value, one source: the record (owner ruling 2026-10-29).
  };
  for (const key of Object.keys(REQUIRED_FACTS)) values[key] = data[key];

  let rendered = templateContent;
  const missing = [];
  for (const key of placeholdersIn(templateContent)) {
    const placeholder = '[' + key + ']';
    const value = values[key];
    const held = value !== undefined && value !== null && value !== '';
    if (held) {
      rendered = rendered.split(placeholder).join(String(value));
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(REQUIRED_FACTS, key)) continue; // the template's own blank
    rendered = rendered.split(placeholder).join('\u2014 (' + REQUIRED_FACTS[key] + ' \u2014 not held)');
    if (missing.indexOf(REQUIRED_FACTS[key]) === -1) missing.push(REQUIRED_FACTS[key]);
  }
  // Handle some common variations if any
  rendered = rendered.replace(/\[____________________________\]/g, '[Pending Data]');
  return { content: rendered, missing };
}

/**
 * WHAT A READER GETS WHEN THE DOCUMENT CANNOT BE ISSUED: not the document.
 *
 * It carries no part of the template — no clause, no signature block, no figure — so it cannot be
 * mistaken for the instrument, read out, signed or filed. It names the facts that are missing,
 * because "an error occurred" tells a reader nothing they can act on.
 */
function refusalDocument({ templateName, employeeId, missing }) {
  return [
    '# Document not issued / \u0644\u0645 \u064a\u062a\u0645 \u0625\u0635\u062f\u0627\u0631 \u0627\u0644\u0645\u0633\u062a\u0646\u062f',
    '',
    '**NOT ISSUED.** This response is not the document you asked for. It contains no clause, no',
    'signature block and no figure, and nothing in it may be read, signed or presented as one.',
    '',
    'The document `' + templateName + '`, for the record `' + employeeId + '`, states facts that no',
    'record in this product holds. Filling such a hole with a plausible licence number, a party name',
    'or a 0.00 is what we will not do, so the document is withheld until the facts are recorded:',
    '',
    ...missing.map((fact) => '- ' + fact),
    '',
    'Record them and request the document again. The employer-side facts are the employer own',
    'identity and registration; the rest are amounts and terms the employee record does not carry.'
  ].join('\n');
}

module.exports = {
  generateTasks,
  logMutation,
  renderTemplate,
  refusalDocument,
  documentClassFor,
  unpopulatedPlaceholders,
  REQUIRED_FACTS,
  DOCUMENT_CLASS,
  checklistTemplates
};

