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
      { title: 'Privacy Notice Consent', description: 'Capture explicit consent for UAE PDPL compliance.' }
    ],
    offboarding: [
      { title: 'Notice Period Verification', description: 'Confirm notice period served (min 30 days).' },
      { title: 'EOSB Calculation', description: 'Calculate End of Service Benefit based on UAE Basic Salary.' },
      { title: 'Annual Leave Encashment', description: 'Calculate and pay accrued but unused annual leave.' },
      { title: 'MoHRE Work Permit Cancellation', description: 'Cancel the work permit via MoHRE system.' },
      { title: 'Residency Visa Cancellation', description: 'Complete visa cancellation within 30 days of termination.' },
      { title: 'Final Settlement Statement', description: 'Generate and sign the final settlement statement.' }
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
      { title: 'Privacy Notice Consent', description: 'Capture explicit consent for KSA PDPL compliance (Arabic first).' }
    ],
    offboarding: [
      { title: 'Notice Period Verification', description: 'Verify notice period (30 days fixed-term / 60 days indefinite).' },
      { title: 'EOSB Calculation (KSA)', description: 'Calculate EOSB based on Total Monthly Salary (including allowances).' },
      { title: 'GOSI De-registration', description: 'Remove employee from GOSI system.' },
      { title: 'Exit/Re-entry or Final Exit Visa', description: 'Process the final exit visa for the employee.' },
      { title: 'Iqama Cancellation/Transfer', description: 'Complete Iqama formalities within 90 days.' },
      { title: 'Service Certificate Issuance', description: 'Issue the mandatory service certificate within 2 weeks.' }
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
  
  // We use team-db via CLI in this environment, but this function 
  // represents the logic that would be used in a real app.
  // For the sandbox, we'll assume the caller handles the DB execution.
  
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
 * Renders a markdown template by injecting employee data.
 */
function renderTemplate(templateContent, data) {
  let rendered = templateContent;
  
  // Mapping of template placeholders to data keys
  const mapping = {
    'employer_name': data.employer_name || 'Antum Regional Hub',
    'employer_address': data.employer_address || 'Dubai Internet City, UAE / Riyadh Business Gate, KSA',
    'trade_license': data.trade_license || 'TL-882733-G',
    'dpo_email': data.dpo_email || 'privacy@antum.ae',
    'current_date': data.current_date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    'full_name': data.full_name,
    'full_name_arabic': data.full_name_arabic || data.full_name, // Fallback if no Arabic name
    'dob': data.dob,
    'nationality': data.nationality,
    'passport_no': data.passport_no,
    'national_id': data.national_id,
    'start_date': data.start_date,
    'end_date': data.end_date || '[End Date]',
    'basic_salary': data.basic_salary,
    'total_salary': data.total_salary,
    'employee_id': data.employee_id,
    'role': data.role || '[Job Title]',
    'department': data.department || '[Department]',
    'contract_no': data.contract_no || `CTR-${Math.floor(100000 + Math.random() * 900000)}`,
    'termination_reason': data.termination_reason || '[Termination Reason]',
    'eosb_amount': data.eosb_amount || '0.00',
    'gross_settlement': data.gross_settlement || '0.00',
    'net_settlement': data.net_settlement || '0.00',
    'probation_period': data.probation_period || '6',
    'visa_status': data.visa_status || 'Employment Visa',
    'mohre_code': data.mohre_code || 'EST-99228',
    'qiwa_id': data.qiwa_id || 'QIWA-88271',
    'employer_representative': data.employer_representative || 'HR Director'
  };

  // Replace [key] placeholders
  for (const [key, val] of Object.entries(mapping)) {
    const placeholder = `[${key}]`;
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rendered = rendered.replace(new RegExp(escapedPlaceholder, 'g'), val || `[${key}]`);
  }

  // Handle some common variations if any
  rendered = rendered.replace(/\[____________________________\]/g, '[Pending Data]');

  return rendered;
}

module.exports = {
  generateTasks,
  logMutation,
  renderTemplate,
  checklistTemplates
};
