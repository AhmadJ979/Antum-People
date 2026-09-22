# PDPL Infrastructure Hardening & DSR Logic

> **Author:** Compliance Expert
> **Date:** 2026-06-23
> **Purpose:** Add gross/net EOSB fields, DSR workflow definition, breach notification templates, and erasure pseudocode
> **References:** UAE PDPL (Law No. 45/2021), KSA PDPL (Royal Decree M/148), compliance-requirements.md

---

## 1. EOSB Calculations Audit Enhancement

### 1.1 Current Schema

```sql
eosb_calculations (
    id, employee_id, calculation_date, jurisdiction, start_date, end_date,
    basic_salary, total_salary, unpaid_leave_days, is_resignation,
    accrued_amount, formula_used, created_at
)
```

### 1.2 Migration DDL

Add gross/net breakdown fields to enable settlement audit and financial reconciliation:

```sql
-- Add gross_amount: EOSB before deductions (the full calculated amount)
ALTER TABLE eosb_calculations ADD COLUMN gross_amount REAL;

-- Add deductions: total deductions applied (resignation reduction, notice penalty, etc.)
ALTER TABLE eosb_calculations ADD COLUMN deductions REAL DEFAULT 0.0;

-- Add net_amount: EOSB after all deductions (the actual payable amount)
ALTER TABLE eosb_calculations ADD COLUMN net_amount REAL;
```

### 1.3 Calculation Logic Update

When inserting into `eosb_calculations`, compute all three fields:

```javascript
// In POST /api/compliance/calculate-eosb (server/index.js, around line 760):
// After calling calculateDetailedEOSB():
const result = calculateDetailedEOSB(...);

// Compute gross (full entitlement before any reductions)
const grossAmount = computeGrossEOSB(result, calcJurisdiction);

// Deductions = gross - net (or specified deductions)
const deductions = result.notice_penalty + /* other deductions */;
const netAmount = result.accrued_amount;

const auditSql = `
    INSERT INTO eosb_calculations (
        id, employee_id, calculation_date, jurisdiction, start_date, end_date,
        basic_salary, total_salary, unpaid_leave_days, is_resignation,
        accrued_amount, gross_amount, deductions, net_amount, formula_used
    )
    VALUES (
        ${db.escapeString(calcId)},
        ${db.escapeString(employee_id || 'manual-calc')},
        datetime('now'),
        ${db.escapeString(calcJurisdiction)},
        ${db.escapeString(calcStartDate)},
        ${db.escapeString(calcEndDate)},
        ${calcBasic}, ${calcTotal}, ${calcLeave}, ${isResignInt},
        ${netAmount},                 -- accrued_amount = net amount (preserve backward compat)
        ${grossAmount},               -- NEW: gross before deductions
        ${deductions},                -- NEW: deductions applied
        ${netAmount},                 -- NEW: net after deductions
        ${db.escapeString(formulaUsed)}
    )
`;
```

### 1.4 Gross Amount Helper Function

```javascript
/**
 * Computes the gross EOSB amount before any deduction/resignation reduction.
 * This is useful for audit/reconciliation — shows what 100% entitlement would be.
 */
function computeGrossEOSB(result, jurisdiction) {
    // result contains: raw_days, tenure_years, salary_base, accrued_days, etc.
    // Reconstruct the full (pre-reduction) amount
    const salaryBase = result.salary_base;
    
    if (jurisdiction === 'SA' || jurisdiction === 'KSA') {
        // KSA: gross = entitlement before notice penalty
        const monthlyRate = salaryBase;
        const years = result.tenure_years;
        
        // no minimum service period — EOSB pro-rates from day one
        
        let gross = 0;
        if (years <= 5) {
            gross = (monthlyRate / 3) * years;
        } else if (years <= 10) {
            gross = (monthlyRate * 2 / 3) * years;
        } else {
            gross = monthlyRate * years;
        }
        return Math.round(gross * 100) / 100;
    } else {
        // UAE: gross = full entitlement before resignation reduction
        const dailyRate = salaryBase / 30;
        const days = result.accrued_days;
        const gross = days * dailyRate;
        return Math.round(gross * 100) / 100;
    }
}
```

---

## 2. Data Subject Request (DSR) Workflow

### 2.1 DSR Types Supported

| DSR Type | UAE PDPL Reference | KSA PDPL Reference | Description |
|---|---|---|---|
| **Access** | Art. 14(1) | Art. 17(1) | Employee requests copy of personal data |
| **Rectification** | Art. 14(2) | Art. 17(2) | Employee requests correction of inaccurate data |
| **Erasure** | Art. 14(3) | Art. 17(3) | Employee requests deletion ("Right to be Forgotten") |
| **Restriction** | Art. 14(4) | Art. 17(4) | Employee requests processing limitation |
| **Portability** | Art. 14(5) | Art. 17(5) | Employee requests data in machine-readable format |
| **Objection** | Art. 14(6) | Art. 17(6) | Employee objects to processing based on legitimate interest |

### 2.2 DSR State Machine

```
                          ┌──────────────────────────────────┐
                          │    SUBMITTED                     │
                          │  (Employee submits request)      │
                          └──────────┬───────────────────────┘
                                     │
                                     ▼
                          ┌──────────────────────────────────┐
                          │    VERIFYING                     │
                          │  (HR confirms identity:          │
                          │   - Check against Emirates ID/   │
                          │     Iqama number                 │
                          │   - Additional verification if   │
                          │     sensitive data involved)     │
                          └──────────┬───────────────────────┘
                           ┌─────────┴──────────┐
                           ▼                    ▼
              ┌────────────────────────┐  ┌──────────────────┐
              │ REJECTED               │  │ ACCEPTED         │
              │ (Identity cannot be    │  │ (Identity        │
              │  verified / Manifestly │  │  verified)       │
              │  unfounded / Excessive)│  └────────┬─────────┘
              │ Note: Can still be      │           │
              │ referred to regulator   │           ▼
              └────────────────────────┘  ┌────────────────────────────┐
                                          │ PROCESSING                 │
                                          │ Type-specific actions:     │
                                          │ - Access:  Gather data     │
                                          │ - Erasure: Anonymize/delete│
                                          │ - Rectify: Update records  │
                                          └────────────┬───────────────┘
                                                       │
                                                       ▼
                                          ┌────────────────────────────┐
                                          │ COMPLETED                  │
                                          │ - Response sent to employee│
                                          │ - Audit trail recorded     │
                                          └────────────────────────────┘
```

### 2.3 DSR SLA Timelines

| Step | UAE PDPL | KSA PDPL |
|---|---|---|
| Initial acknowledgment | Within 5 business days | Within 5 business days |
| Response to request | Within **30 days** | Within **30 days** |
| Extension (complex cases) | Can extend to 60 days (notify employee) | Can extend to 60 days (notify employee) |
| Extension notification | Provide reasons + expected date | Provide reasons + expected date |
| Response fee | Generally free; manifestly unfounded or excessive requests may incur a reasonable fee | Same principle |

### 2.4 DSR API Endpoints Design

```javascript
// =============================================================
// DATA SUBJECT REQUEST (DSR) API
// =============================================================

// POST /api/compliance/dsr — Submit a new DSR
app.post('/api/compliance/dsr', async (req, res) => {
    // 1. Validate request type is one of: access, rectification, erasure, restriction, portability, objection
    // 2. Create DSR record with status = 'submitted'
    // 3. Auto-send acknowledgment to employee
    // 4. Trigger identity verification workflow
});

// GET /api/compliance/dsr — List all DSRs (with filters: employee_id, status, request_type, date range)
app.get('/api/compliance/dsr', async (req, res) => {
    // Return paginated list of DSR records
});

// GET /api/compliance/dsr/:id — Get DSR detail
app.get('/api/compliance/dsr/:id', async (req, res) => {
    // Return full DSR record including processing notes
});

// PUT /api/compliance/dsr/:id/process — Process a DSR (HR action)
app.put('/api/compliance/dsr/:id/process', async (req, res) => {
    // 1. Accept or reject the request
    // 2. If accept: trigger type-specific processing logic
    // 3. Update status
    // 4. Log audit trail
});

// PUT /api/compliance/dsr/:id/complete — Mark DSR as completed
app.put('/api/compliance/dsr/:id/complete', async (req, res) => {
    // 1. Store response summary
    // 2. Set completion_date
    // 3. Status = 'completed'
    // 4. Notify employee
});
```

### 2.5 DSR Processing Logic by Type

#### Access Request Processing

```javascript
function processAccessRequest(employeeId) {
    // 1. Query all employee data from relevant tables:
    //    - employees (profile data)
    //    - consent_records (consent history)
    //    - eosb_calculations (EOSB records)
    //    - exit_interviews (if applicable)
    //    - onboarding_tasks / offboarding_tasks
    //    - analytics_metrics
    // 2. Package into structured JSON/PDF response
    // 3. Mask sensitive third-party references
    // 4. Apply any exemptions (e.g., legal privilege, ongoing investigations)
    // 5. Deliver to employee via secure portal download
    return {
        collectedAt: new Date().toISOString(),
        dataCategories: [
            { category: 'Identity Data', fields: [...], source: 'employees' },
            { category: 'Contact Data', fields: [...], source: 'employees' },
            { category: 'Employment Data', fields: [...], source: 'employees' },
            { category: 'Consent Records', fields: [...], source: 'consent_records' },
            // etc.
        ],
        totalRecords: 14,
        format: 'JSON'
    };
}
```

#### Rectification Request Processing

```javascript
function processRectificationRequest(employeeId, field, newValue, justification) {
    // 1. Validate the field exists and is rectifiable
    // 2. Log the change request (before/after) in analytics_metrics
    // 3. Update the field in employees table
    // 4. If the field affects other records (e.g., name changes), cascade update
    // 5. Notify employee of completion
    // IMPORTANT: Keep audit trail of original value for compliance
    
    // Audit log:
    await db.query(`
        INSERT INTO analytics_metrics (id, employee_id, metric_type, metric_text)
        VALUES (
            ${generateId()},
            ${employeeId},
            'data_rectification',
            'Field: ${field} | Old: ${oldValue} | New: ${newValue} | Justification: ${justification}'
        )
    `);
}
```

#### Erasure Request Processing (see Section 4 for detailed pseudocode)

---

## 3. Breach Notification Templates

### 3.1 Regulatory Breach Notification — English

```
─────────────────────────────────────────────────────────────
[CONTROLLER LETTERHEAD]

PRIVILEGED AND CONFIDENTIAL
[Date]

[Regulator Name]
[Regulator Address]

Subject: Personal Data Breach Notification under
         [UAE PDPL / KSA PDPL]

Reference No: VHR-BR-[YYYYMMDD]-[XXXXX]

Dear Sir/Madam,

Pursuant to Article [Article Reference] of the [Applicable Law],
we hereby notify you of a personal data breach incident.

SECTION A: CONTROLLER INFORMATION

  Controller Name:        [Employer Legal Name]
  Contact Person:         [Name / Title]
  Email:                  [Email Address]
  Phone:                  [Phone Number]
  DPO Contact:            [DPO Name / Email]

SECTION B: BREACH DETAILS

  Incident Date:          [DD Month YYYY HH:MM]
  Discovery Date:         [DD Month YYYY HH:MM]
  Breach Type:            [Unauthorised Access / Disclosure / Loss / Theft / Destruction]
  Affected Systems:       [System / Database / Application Names]

SECTION C: DATA AFFECTED

  Categories of Personal Data:
    ☐ Identity Data (name, ID numbers, passport)
    ☐ Contact Data (address, email, phone)
    ☐ Financial Data (salary, bank account)
    ☐ Employment Data (job title, performance)
    ☐ Health Data (medical records)
    ☐ Biometric Data (fingerprints, facial recognition)
    ☐ Other: [________________]

  Approximate number of affected data subjects: [___]
  Approximate number of affected records: [___]
  Data subjects include: [Employees / Contractors / Applicants]

SECTION D: POTENTIAL CONSEQUENCES

  Describe the likely consequences of the breach:
  [________________________________________________________]
  [________________________________________________________]

  Risk level assessed: ☐ Low ☐ Medium ☐ High ☐ Critical

SECTION E: REMEDIAL ACTIONS

  Actions taken or proposed to address the breach:
  1. [Immediate containment measures]
  2. [System patches / access revocation]
  3. [Password reset / account lockdown]
  4. [Additional monitoring implemented]
  5. [Third-party forensic investigation]

SECTION F: NOTIFICATION TO DATA SUBJECTS

  ☐ Individuals have been notified (date: __________)
  ☐ Notification is in progress
  ☐ No notification required (risk to rights/freedoms unlikely)

SECTION G: TIMELINE

  Discovery:     [DD Month YYYY]
  This Notice:   [DD Month YYYY] (within 72 hours of discovery)
  Full Report:   [DD Month YYYY] (within [X] days, if required)

We undertake to provide further information as it becomes available
and to cooperate fully with your investigation.

Yours faithfully,

_______________________
[Name]
[Title, Data Protection Officer / Authorised Signatory]

─────────────────────────────────────────────────────────────
```

### 3.2 إخطار انتهاك البيانات للجهة التنظيمية — العربية

```
─────────────────────────────────────────────────────────────
[ترويسة جهة التحكم]

سري ومحمي
[التاريخ]

[اسم الجهة التنظيمية]
[عنوان الجهة التنظيمية]

الموضوع: إخطار بانتهاك البيانات الشخصية بموجب
         [قانون حماية البيانات الشخصية الإماراتي / نظام حماية البيانات الشخصية السعودي]

الرقم المرجعي: VHR-BR-[YYYYMMDD]-[XXXXX]

سعادة / سعادة،

عملاً بالمادة [رقم المادة] من [القانون المعمول به]،
نفيدكم علماً بحدوث انتهاك للبيانات الشخصية على النحو التالي:

القسم أ: معلومات جهة التحكم

  اسم جهة التحكم:      [الاسم القانوني لصاحب العمل]
  جهة الاتصال:         [الاسم / المنصب]
  البريد الإلكتروني:    [البريد الإلكتروني]
  الهاتف:              [رقم الهاتف]
  مسؤول حماية البيانات: [الاسم / البريد الإلكتروني]

القسم ب: تفاصيل الانتهاك

  تاريخ الانتهاك:          [يوم شهر سنة ساعة:دقيقة]
  تاريخ الاكتشاف:          [يوم شهر سنة ساعة:دقيقة]
  نوع الانتهاك:           [وصول غير مصرح به / إفشاء / فقدان / سرقة / إتلاف]
  الأنظمة المتأثرة:        [قاعدة البيانات / النظام / التطبيق]

القسم ج: البيانات المتأثرة

  فئات البيانات الشخصية:
    ☐ بيانات الهوية (الاسم، أرقام الهوية، جواز السفر)
    ☐ بيانات الاتصال (العنوان، البريد الإلكتروني، الهاتف)
    ☐ البيانات المالية (الراتب، الحساب البنكي)
    ☐ بيانات التوظيف (المسمى الوظيفي، الأداء)
    ☐ البيانات الصحية (السجلات الطبية)
    ☐ البيانات البيومترية (بصمات الأصابع، التعرف على الوجه)
    ☐ أخرى: [________________]

  العدد التقريبي للأشخاص المتأثرين: [___]
  العدد التقريبي للسجلات المتأثرة: [___]
  يشمل الأشخاص: [موظفين / مقاولين / متقدمين]

القسم د: العواقب المحتملة

  وصف العواقب المحتملة للانتهاك:
  [________________________________________________________]
  [________________________________________________________]

  مستوى المخاطر المقدر: ☐ منخفض ☐ متوسط ☐ مرتفع ☐ خطير

القسم هـ: الإجراءات التصحيحية

  الإجراءات المتخذة أو المقترحة لمعالجة الانتهاك:
  1. [إجراءات الاحتواء الفورية]
  2. [تصحيح الأنظمة / إلغاء صلاحيات الوصول]
  3. [إعادة تعيين كلمة المرور / إغلاق الحسابات]
  4. [تنفيذ مراقبة إضافية]
  5. [التحقيق الجنائي الخارجي]

القسم و: إخطار الأشخاص المتأثرين

  ☐ تم إخطار الأفراد (التاريخ: __________)
  ☐ جاري الإخطار
  ☐ لا يلزم الإخطار (عدم وجود خطر على الحقوق والحريات)

القسم ز: الجدول الزمني

  الاكتشاف:       [يوم شهر سنة]
  هذا الإخطار:    [يوم شهر سنة] (خلال 72 ساعة من الاكتشاف)
  التقرير الكامل: [يوم شهر سنة] (خلال [X] يوماً، إذا لزم الأمر)

نتعهد بتقديم معلومات إضافية فور توفرها وبالتعاون الكامل مع تحقيقكم.

وتفضلوا بقبول فائق الاحترام،

_______________________
[الاسم]
[المنصب، مسؤول حماية البيانات / المفوض بالتوقيع]

─────────────────────────────────────────────────────────────
```

### 3.3 Data Subject Breach Notification — English

```
─────────────────────────────────────────────────────────────
[EMPLOYER LETTERHEAD]

[Date]

Dear [Employee Name],

NOTICE OF PERSONAL DATA BREACH

Reference No: VHR-BR-[YYYYMMDD]-[XXXXX]

We are writing to inform you of a personal data breach that
may involve your personal data.

What happened:
[Brief description of the breach in plain language]

What data was involved:
[Categories of your personal data that may have been affected]

What we have done:
[Steps taken to contain and remediate the breach]

What you can do:
[Recommended actions for the affected individual]
- [Monitor your accounts for suspicious activity]
- [Contact your bank if financial data was involved]
- [Report any identity theft concerns to authorities]

Who to contact:
  Data Protection Officer: [Name]
  Email: [Email]
  Phone: [Phone]
  Reference: [Reference No]

We sincerely regret this incident and are taking all necessary
steps to prevent recurrence.

Yours sincerely,

_______________________
[Name]
[Title]

─────────────────────────────────────────────────────────────
```

### 3.4 إخطار الأشخاص المتأثرين بانتهاك البيانات — العربية

```
─────────────────────────────────────────────────────────────
[ترويسة صاحب العمل]

[التاريخ]

عزيزي / عزيزتي [اسم الموظف]،

إخطار بانتهاك البيانات الشخصية

الرقم المرجعي: VHR-BR-[YYYYMMDD]-[XXXXX]

نفيدكم علماً بحدوث انتهاك للبيانات الشخصية قد يشمل بياناتكم.

ما حدث:
[وصف مختصر للانتهاك بلغة بسيطة]

ما هي البيانات المتأثرة:
[فئات البيانات الشخصية التي قد تكون تأثرت]

ما قمنا به:
[الخطوات المتخذة لاحتواء الانتهاك ومعالجته]

ما يمكنك فعله:
[الإجراءات الموصى بها للفرد المتأثر]
- [مراقبة حساباتك بحثاً عن أي نشاط مشبوه]
- [الاتصال ببنكك إذا كانت البيانات المالية متأثرة]
- [الإبلاغ عن أي مخاوف تتعلق بسرقة الهوية للسلطات]

من تتصل به:
  مسؤول حماية البيانات: [الاسم]
  البريد الإلكتروني: [البريد الإلكتروني]
  الهاتف: [رقم الهاتف]
  المرجع: [الرقم المرجعي]

نأسف بشدة لهذا الحادث ونعمل على اتخاذ جميع الإجراءات اللازمة
لمنع تكراره.

وتفضلوا بقبول فائق الاحترام،

_______________________
[الاسم]
[المنصب]

─────────────────────────────────────────────────────────────
```

### 3.5 Breach Notification API Design

```javascript
// =============================================================
// BREACH NOTIFICATION API
// =============================================================

// POST /api/compliance/breach — Register a new breach incident
app.post('/api/compliance/breach', async (req, res) => {
    // 1. Create breach_register record with status = 'open'
    // 2. Automatically start 72-hour timer for regulator notification
    // 3. Trigger severity assessment workflow
});

// PUT /api/compliance/breach/:id/notify-regulator — Generate regulator notification
app.put('/api/compliance/breach/:id/notify-regulator', async (req, res) => {
    // 1. Populate the regulatory notification template
    // 2. Set regulator = 'UAE_Data_Office' or 'SDAIA' based on jurisdiction
    // 3. Generate PDF for download/submission
    // 4. Update breach_register with regulator_notified_at timestamp
});

// PUT /api/compliance/breach/:id/notify-subjects — Notify affected individuals
app.put('/api/compliance/breach/:id/notify-subjects', async (req, res) => {
    // 1. Generate personalized notifications for each affected employee
    // 2. Send via email (and/or SMS)
    // 3. Update breach_register with subjects_notified_at timestamp
});

// GET /api/compliance/breach — List all breach incidents
// GET /api/compliance/breach/:id — Get breach details
```

### 3.6 Breach Register Enhancement

Add the following columns to the `breach_register` table for full compliance:

```sql
-- Add notification tracking fields
ALTER TABLE breach_register ADD COLUMN data_categories TEXT;       -- JSON array of affected data categories
ALTER TABLE breach_register ADD COLUMN notified_regulator TEXT;    -- regulator notified? (yes/no/pending)
ALTER TABLE breach_register ADD COLUMN notified_regulator_at TEXT; -- timestamp of regulator notification
ALTER TABLE breach_register ADD COLUMN notified_subjects TEXT;     -- subjects notified? (yes/no/pending)
ALTER TABLE breach_register ADD COLUMN notified_subjects_at TEXT;  -- timestamp of subject notification
ALTER TABLE breach_register ADD COLUMN remedial_actions TEXT;       -- JSON array of remediation steps
ALTER TABLE breach_register ADD COLUMN jurisdiction TEXT;          -- 'UAE' or 'KSA' for routing the notification
```

---

## 4. Erasure (Right to be Forgotten) Pseudocode

### 4.1 Legal Context

Under both UAE PDPL (Art. 14(3)) and KSA PDPL (Art. 17(3)), employees have the right to request erasure of their personal data. However, **financial records must be retained** as required by:
- **UAE:** Commercial Transactions Law (retention: 5 years post-termination)
- **UAE Labour Law:** Records retention: 2 years post-termination
- **KSA Labour Law:** Records retention: 2 years post-termination
- **KSA ZATCA/Tax:** Invoices and financial records: 6 years

### 4.2 Erasure Strategy

```
ERASURE PRINCIPLE:
"Anonymize identity, retain financial truth"

Strategy: Replace all directly identifying personal data fields
with NULLs or anonymized tokens, while keeping aggregate/
financial records intact for statutory retention periods.

TABLE BEHAVIOR:
┌─────────────────────┬────────────────────┬───────────────────┐
│ Table               │ What to erase      │ What to retain    │
├─────────────────────┼────────────────────┼───────────────────┤
│ employees           │ first_name,        │ id, salary,       │
│                     │ last_name, email,  │ start_date,       │
│                     │ phone, address,    │ end_date,         │
│                     │ national_id,       │ department (anon),│
│                     │ passport, visa,    │ status,           │
│                     │ iqama              │ eosb_accrued,     │
│                     │                    │ eosb_paid,        │
│                     │                    │ recruitment_cost  │
├─────────────────────┼────────────────────┼───────────────────┤
│ consent_records     │ ip_address         │ id, employee_id   │
│                     │                    │ (kept for audit), │
│                     │                    │ consent_type,     │
│                     │                    │ status, dates     │
├─────────────────────┼────────────────────┼───────────────────┤
│ eosb_calculations   │ (no change)        │ ALL — financial   │
│                     │                    │ audit trail       │
├─────────────────────┼────────────────────┼───────────────────┤
│ exit_interviews     │ detailed_feedback  │ id, employee_id,  │
│                     │ (anonymize),       │ departure_reason, │
│                     │ new_employer       │ satisfaction_score│
│                     │ (erase)            │ (aggregate stats) │
├─────────────────────┼────────────────────┼───────────────────┤
│ onboarding_tasks    │ (no PII)           │ ALL               │
├─────────────────────┼────────────────────┼───────────────────┤
│ offboarding_tasks   │ (no PII)           │ ALL               │
├─────────────────────┼────────────────────┼───────────────────┤
│ analytics_metrics   │ metric_text        │ ALL numeric data  │
│                     │ (if contains PII)  │ (for aggregation) │
└─────────────────────┴────────────────────┴───────────────────┘
```

### 4.3 Erasure Pseudocode

```javascript
/**
 * RIGHT TO BE FORGOTTEN — Erasure Processing Engine
 * 
 * Comply with UAE PDPL Art. 14(3) and KSA PDPL Art. 17(3)
 * while maintaining financial record retention requirements.
 * 
 * @param {string} employeeId - The employee to erase
 * @param {string} requestedBy - The person requesting (employee_id or 'self')
 * @param {string} justification - Reason for erasure request
 * @returns {object} Result with erased fields and retained records
 */
async function processErasureRequest(employeeId, requestedBy, justification) {
    // ==========================================================
    // PHASE 1: VALIDATION
    // ==========================================================
    
    // 1.1 Verify the employee exists
    const employees = await db.query(
        `SELECT * FROM employees WHERE id = ${db.escapeString(employeeId)}`
    );
    if (employees.length === 0) {
        throw new Error('Employee not found');
    }
    const employee = employees[0];
    
    // 1.2 Check for legal holds (ongoing litigation, regulatory investigation)
    const legalHolds = await checkLegalHolds(employeeId);
    if (legalHolds.active) {
        // Cannot erase while under legal hold — notify employee
        return {
            status: 'deferred',
            reason: 'Legal hold active',
            expectedResolutionDate: legalHolds.expectedEndDate
        };
    }
    
    // 1.3 Check if record has financial data that must be retained
    // Financial retention periods:
    const hasFinancialRecords = (
        employee.salary > 0 || 
        employee.eosb_accrued > 0 || 
        employee.eosb_paid > 0 ||
        employee.recruitment_cost > 0
    );
    
    // ==========================================================
    // PHASE 2: EXECUTE ERASURE
    // ==========================================================
    
    const erasedFields = [];
    const retainedFields = [];
    
    // 2.1 ERASE personal data from employees table
    // Keep: id, salary amounts, dates, department (anonymized), status, eosb fields
    // Erase: name, email, phone, address, national IDs, passport, visa, iqama
    
    const eraseSql = `
        UPDATE employees SET
            first_name = '[REDACTED]',
            last_name = '[REDACTED]',
            email = NULL,
            manager_id = NULL,
            national_id_type = NULL,
            national_id_value = NULL,
            national_id_iqama = NULL,
            data_residency_country = NULL,
            visa_status = '[ERASED]',
            visa_expiry_date = NULL,
            probation_end_date = NULL,
            nitaqat_band = NULL,
            consent_granted = 0,
            consent_date = NULL,
            gave_proper_notice = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${db.escapeString(employeeId)}
    `;
    await db.query(eraseSql);
    erasedFields.push('first_name', 'last_name', 'email', 'national_id', 'visa', 'iqama');
    
    // Retained: id, salary, total_salary, basic_salary, allowances, start_date,
    //           end_date, status, department, role, eosb_accrued, eosb_paid,
    //           recruitment_cost, jurisdiction, governing_law, emirati_flag,
    //           unpaid_leave_days
    retainedFields.push('id', 'salary', 'total_salary', 'basic_salary', 'start_date',
                        'end_date', 'status', 'department', 'role', 'eosb_accrued',
                        'eosb_paid', 'jurisdiction');
    
    // 2.2 Anonymize ip_address in consent_records
    await db.query(`
        UPDATE consent_records SET
            ip_address = '[REDACTED]'
        WHERE employee_id = ${db.escapeString(employeeId)}
    `);
    
    // 2.3 Anonymize personal details in exit_interviews
    await db.query(`
        UPDATE exit_interviews SET
            detailed_feedback = '[This feedback has been anonymized per data subject erasure request]',
            new_employer = NULL,
            new_salary = NULL
        WHERE employee_id = ${db.escapeString(employeeId)}
    `);
    
    // 2.4 Anonymize any PII in analytics_metrics
    await db.query(`
        UPDATE analytics_metrics SET
            metric_text = '[REDACTED]'
        WHERE employee_id = ${db.escapeString(employeeId)}
        AND metric_text IS NOT NULL
    `);
    
    // 2.5 FINANCIAL RECORDS — INTENTIONALLY RETAINED
    // EOSB calculations remain intact for financial audit trail
    // Onboarding/offboarding task records remain (no PII)
    // Salary/compensation data retained for tax/law compliance
    
    // ==========================================================
    // PHASE 3: AUDIT LOGGING
    // ==========================================================
    
    const auditEntry = {
        employeeId: employeeId,
        erasedFields: erasedFields,
        retainedFields: retainedFields,
        justification: justification,
        processedBy: requestedBy,
        processedAt: new Date().toISOString(),
        hasRetainedFinancialRecords: hasFinancialRecords,
        retentionPolicies: [
            { table: 'eosb_calculations', reason: 'Financial audit trail (5yrs UAE / 6yrs KSA)' },
            { table: 'employees', reason: 'Salary/compensation records (2yrs labour law)' },
            { table: 'onboarding_tasks', reason: 'No PII retained — operational data' },
            { table: 'offboarding_tasks', reason: 'No PII retained — operational data' }
        ]
    };
    
    // Log to analytics_metrics for audit trail
    const auditId = generateId();
    await db.query(`
        INSERT INTO analytics_metrics (id, employee_id, metric_type, metric_text)
        VALUES (
            ${db.escapeString(auditId)},
            ${db.escapeString(employeeId)},
            'data_erasure',
            ${db.escapeString(JSON.stringify(auditEntry))}
        )
    `);
    
    // ==========================================================
    // PHASE 4: RETURN RESULT
    // ==========================================================
    
    return {
        status: 'completed',
        employeeId: employeeId,
        erasedFields: erasedFields,
        retainedFields: retainedFields,
        rationale: hasFinancialRecords
            ? 'Personal data erased. Financial records retained per statutory retention requirements.'
            : 'All employee data erased.',
        auditId: auditId,
        processedAt: auditEntry.processedAt,
        dataSubjectNotice: {
            message: 'Your personal data has been erased in accordance with your request.',
            retainedData: 'The following data is retained for legal compliance: salary history, EOSB records, and employment dates. These will be automatically purged after the applicable statutory retention period.',
            retentionEndDate: calculateRetentionEndDate(employee.start_date)
        }
    };
}

/**
 * Calculates the earliest date when all financial records can be fully purged.
 * Returns the maximum of all applicable retention periods.
 */
function calculateRetentionEndDate(startDate) {
    const maxRetentionYears = 6; // KSA ZATCA tax retention: 6 years
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + maxRetentionYears);
    return endDate.toISOString().split('T')[0];
}

/**
 * Checks if the employee has active legal holds that prevent erasure.
 */
async function checkLegalHolds(employeeId) {
    // Check for:
    // 1. Active litigation involving the employee
    // 2. Regulatory investigation in progress
    // 3. Internal disciplinary investigation
    // For MVP, return false (no holds)
    return { active: false };
}

/**
 * Helper: Generate UUID
 */
function generateId() {
    return require('crypto').randomUUID();
}
```

### 4.4 Erasure API Endpoints

```javascript
// POST /api/compliance/dsr/:id/erasure — Execute erasure for a DSR
app.post('/api/compliance/dsr/:id/erasure', async (req, res) => {
    try {
        const dsrId = req.params.id;
        
        // 1. Load the DSR record
        const dsrs = await db.query(
            `SELECT * FROM data_subject_requests WHERE id = ${db.escapeString(dsrId)}`
        );
        if (dsrs.length === 0) {
            return res.status(404).json({ error: 'DSR not found' });
        }
        const dsr = dsrs[0];
        
        // 2. Verify it's an erasure request
        if (dsr.request_type !== 'erasure') {
            return res.status(400).json({ error: 'This DSR is not an erasure request' });
        }
        
        // 3. Execute erasure
        const result = await processErasureRequest(
            dsr.employee_id, 
            'system', 
            dsr.details || 'DSR request'
        );
        
        // 4. Update DSR status
        await db.query(`
            UPDATE data_subject_requests SET
                status = 'completed',
                completion_date = datetime('now'),
                details = ${db.escapeString(JSON.stringify(result))}
            WHERE id = ${db.escapeString(dsrId)}
        `);
        
        res.json({
            message: 'Erasure completed successfully',
            result: {
                status: result.status,
                erasedFields: result.erasedFields,
                retainedFields: result.retainedFields,
                rationale: result.rationale
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

---

## 5. Implementation Summary

| Item | Deliverable | Priority |
|---|---|---|
| **EOSB Audit Schema** | DDL to add `gross_amount`, `deductions`, `net_amount` columns to `eosb_calculations` | P1 |
| **DSR Workflow** | State machine, API endpoints, SLA timelines, per-type processing logic | P0 |
| **Breach Templates** | Regulator notification (EN+AR) + Data subject notification (EN+AR) | P0 |
| **Erasure Engine** | Pseudocode + API endpoint for Right to be Forgotten with financial retention | P0 |
| **Breach Schema Enhancement** | DDL to add notification tracking columns to `breach_register` | P1 |

### Next Steps for Engineering

1. Run the DDL migrations for `eosb_calculations` and `breach_register`
2. Implement the DSR state machine and API endpoints in `server/index.js`
3. Implement Erasure API endpoint using the pseudocode in Section 4
4. Implement Breach API endpoints using the templates in Section 3
5. Wire up the breach notification 72-hour timer workflow
6. Connect DSR erasure completion to consent record revocation