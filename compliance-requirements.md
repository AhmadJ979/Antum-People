# Antum People — GCC Compliance Requirements Report

> **Author:** Compliance Expert (Agent)
> **Date:** 2026-06-13
> **Revision:** Brand updated to Antum People on 2026-09-17.
> **Scope:** UAE & KSA — Labor Law, End-of-Service Benefits (EOSB), Data Privacy (PDPL)
> **Audience:** Engineering (schema/datastore design), Product Design (UX flows), Lead (strategy/prioritization)

---

## Table of Contents

1. [UAE Labor Law (Federal Decree-Law No. 33 of 2021)](#1-uae-labor-law)
2. [KSA Labor Law (Saudi Labor Law Royal Decree No. M/51)](#2-ksa-labor-law)
3. [End-of-Service Benefits (EOSB) — UAE](#3-eosb-uae)
4. [End-of-Service Benefits (EOSB) — KSA](#4-eosb-ksa)
5. [UAE PDPL (Federal Decree-Law No. 45 of 2021)](#5-uae-pdpl)
6. [KSA PDPL (Personal Data Protection Law)](#6-ksa-pdpl)
7. [Cross-Border & Dual-Jurisdiction Considerations](#7-cross-border)
8. [Compliance Feature Recommendations for Antum People](#8-feature-recommendations)
9. [Appendix: Key Legal References](#9-appendix)

---

## 1. UAE Labor Law

### 1.1 Governing Legislation

- **Primary Law:** Federal Decree-Law No. 33 of 2021 (the "UAE Labour Law"), effective 2 February 2022.
- **Amendments:** Federal Decree-Law No. 20 of 2023 (further amendments).
- **Cabinet Resolutions:** Cabinet Resolution No. 1 of 2022 (implementation regulations), Ministerial Resolution No. 46 of 2022 (employment of minors), etc.
- **Applies to:** All employers and employees in the private sector within the UAE mainland. Free zones may have their own regulations but typically align (notably, DIFC and ADGM have separate employment laws).

### 1.2 Onboarding Requirements

| Requirement | Details | Antum People Impact |
|---|---|---|
| **Employment Contract** | Must be in writing (Arabic + English/other). Must be the standard MoHRE contract template. Must specify: salary, duration, work location, working hours, leave entitlements. | Schema needs contract_type (limited/unlimited), contract_language fields. Generate compliant contract templates. |
| **Visa & Residency** | Employer-sponsored work visa required. Includes: entry permit, medical fitness test, Emirates ID, labour card, visa stamping. **Probation:** max 6 months, one extension allowed. | Track visa stages (status, expiry). Add probation_end_date field. Alert before visa/residency expiry. |
| **MoHRE Registration** | Employer must register the employment relationship in the MoHRE system (Wages Protection System - WPS). | Integrate WPS salary reporting in offboarding to verify last salary for EOSB calc. |
| **Probation Period** | Max 6 months. Employee can terminate with no notice during first 6 months (if not offered permanent). Employer must give 14 days' notice. | onboarding_tasks: add probation milestones. Track probation_end_date. |
| **Fixed-Term Contracts** | All contracts are now fixed-term (max 3 years, renewable by agreement). "Unlimited" contracts phased out for new hires under Law No. 33. | Contract type field: fixed_term. Capture renewal_dates and auto-reminders. |
| **Part-Time / Temporary** | Recognised work patterns under the Labour Law. Different contract templates exist. | Add employment_type enum: full_time, part_time, temporary, freelance. |
| **Emiratisation** | Mandatory 2% annual increase in Emirati hires for companies with 50+ employees. Monthly contributions of ~3,200 AED/employee for target shortfall. Nafis programme incentives. | Track nationality (Emirati/non-Emirati). Emiratisation quota dashboard. Nafis registration status. |

### 1.3 Offboarding Requirements

| Requirement | Details | Antum People Impact |
|---|---|---|
| **Notice Period** | Min 30 days, max 90 days (per contract). Either party can give notice. During probation: 14 days' notice by employer, none by employee. | Capture notice_period_days, notice_type. Calculate EOSB effective date. |
| **Termination Grounds** | Must be for a valid reason. Article 44 lists gross misconduct grounds for summary dismissal (no EOSB). | Categorise termination: resignation, redundancy, mutual_agreement, termination_with_cause, termination_without_cause. |
| **End-of-Service Benefits** | See [Section 3](#3-eosb-uae) below. | Dedicated EOSB calculation engine. |
| **Gratuity Eligibility** | Minimum 1 year of continuous service to qualify for EOSB. | Check service_years >= 1 before computing. |
| **Unpaid Leave** | Unpaid leave periods > 90 days are excluded from EOSB calculation. | Track absence types and durations. |
| **Leave Encashment** | Accrued but unused annual leave must be paid on termination. | Calculate leave_encashment_amount. |
| **Final Settlement** | Full settlement within 14 days of termination. Includes: salary, gratuity, leave encashment, any other dues. | Final settlement checklist. Auto-generate settlement statement. |
| **Visa Cancellation** | Employer must cancel visa within 30 days of termination. | Track visa cancellation status with automated reminders. |
| **Grace Period** | Employee has 30-90 days grace period to stay in UAE after visa cancellation (depending on visa type). | Notify HR of grace period expiry. |

---

## 2. KSA Labor Law

### 2.1 Governing Legislation

- **Primary Law:** Saudi Labor Law, Royal Decree No. M/51 dated 23 Sha'ban 1426 AH (27 September 2005), as amended.
- **Latest Amendments:** 2021 amendments (Royal Decree M/190). Ministerial resolutions from the Ministry of Human Resources and Social Development (MHRSD).
- **Applies to:** All employers and employees in the private sector within KSA.

### 2.2 Onboarding Requirements

| Requirement | Details | Antum People Impact |
|---|---|---|
| **Employment Contract** | Must be in Arabic (bilingual contracts permitted). Must specify: salary, duration, place of work, probation period, leave, notice period. Must be in writing. | Similar to UAE — support Arabic as mandatory language, contract templates. |
| **Visa & Residency** | Employer-sponsored work visa. Includes: job offer (through Qiwa), visa issuance, medical exam, fingerprinting, Iqama (residency ID). | Track visa/Iqama stages. Qiwa integration potential. |
| **Probation Period** | Max 90 calendar days (may be extended to 180 days by written agreement). During probation: either party can terminate without notice or EOSB. | probation_end_date field, limited to 90/180 days. |
| **Contract Types** | Fixed-term (renewable) and indefinite-term (convert to fixed-term). Fixed-term contracts apply to non-Saudi nationals. | contract_type, contract_end_date fields. |
| **Qiwa / Mudad** | Employers must register through Qiwa (or Mudad for outsourced payroll). All contracts must be registered on Qiwa. | Qiwa registration tracking. |
| **Saudization (Nitaqat)** | Colour-coded banding system: Red, Low Green, Medium Green, High Green, Premium. Band determines restrictions on hiring foreign nationals. | nitaqat_band field. Track Saudi/non-Saudi headcount. |
| **Wages Protection System** | Salaries must be paid through approved banks and reported to WPS (similar to UAE). | WPS compliance tracking. |
| **Trainee Programs** | Separate rules for training contracts (max 2 years, no EOSB entitlement unless converted to permanent). | employment_type: trainee. |

### 2.3 Offboarding Requirements

| Requirement | Details | Antum People Impact |
|---|---|---|
| **Notice Period** | Min 30 days during probation (by employer). Post-probation: 60 days for indefinite contracts, 30 days for fixed-term. Employee side: 30 days (non-Saudi) / 60 days (Saudi). | notice_period_days, complex role-based rules. |
| **Termination Grounds** | Must be for a valid reason. Art. 77 lists gross misconduct grounds. Art. 74 defines employer rights for summary dismissal. | Same categorisation as UAE but different qualifying criteria. |
| **End-of-Service Benefits** | See [Section 4](#4-eosb-ksa) below. | Dedicated KSA EOSB engine. |
| **Final Settlement** | Payable within 2 weeks of termination (or 7 days if employer-initiated). Includes: salary, EOSB, leave encashment, notice pay. | Final settlement timeline stricter than UAE. |
| **Iqama Transfer/Cancellation** | Iqama must be cancelled/transferred within 90 days. Employee can transfer without employer consent after contract expiry (recent reform). | iqama_status field. Auto-reminders. |
| **Exit/Re-entry Visa** | Must be cancelled as part of offboarding process. | Track exit visa status. |
| **Service Certificate** | Employer must provide a service certificate within 2 weeks of termination. | Auto-generate service certificate. |

---

## 3. EOSB — UAE

### 3.1 Legal Basis
- Articles 51, 52, 53, and 132 of Federal Decree-Law No. 33 of 2021.
- Cabinet Resolution No. 1 of 2022.

### 3.2 Eligibility
- Employee must have completed **1 continuous year of service**.
- EOSB is forfeited in cases of summary dismissal under Article 44 (gross misconduct).
- Employee resignation forfeits partially depending on service length.

### 3.3 Calculation Logic

#### 3.3.1 Basic Formula

EOSB is calculated on **basic salary only** (not including allowances, housing, transport, etc.).

| Service Duration | Gratuity Per Year |
|---|---|
| 1–5 years | 21 days' basic salary per year |
| 5+ years | 30 days' basic salary per year |

**Maximum total:** 2 years' basic salary (i.e., 730 days' worth).

#### 3.3.2 Daily Rate Calculation

```
daily_rate = basic_salary / 30
```

> Note: UAE uses 30-day months; 365-day year is not applied.

#### 3.3.3 Full Entitlement (Employer-Initiated Termination)

| Service Years | Calculation |
|---|---|
| < 1 year | No EOSB |
| 1–5 years | 21 days × daily_rate × years_of_service |
| 5+ years | (21 days × daily_rate × 5) + (30 days × daily_rate × (years - 5)) |
| Cap | Total ≤ 730 days' basic salary |

#### 3.3.4 Reduced Entitlement (Resignation)

| Service Years | Resignation Entitlement (% of Full) |
|---|---|
| 1–3 years | 1/3 of full EOSB |
| 3–5 years | 2/3 of full EOSB |
| 5+ years | 100% of full EOSB |

> **Note:** Under the new law (No. 33 of 2021), unlimited contracts were phased out. All contracts are now fixed-term. If an employee resigns before the end of a fixed-term contract without mutual agreement, the employer may be entitled to compensation (up to 3 months' salary).

#### 3.3.5 Periods Excluded from Service Calculation

- Unpaid leave exceeding 90 days per year.
- Leave without pay after the first 90 days.
- Periods of suspension or absence without pay.

#### 3.3.6 Implementation Pseudocode

```
function calculateEOSB_UAE(basicSalary, startDate, endDate, terminationType):
    years = fractionalYears(startDate, endDate)
    dailyRate = basicSalary / 30

    if years < 1:
        return 0

    if terminationType in ["employer_initiated", "mutual"]:
        fullAmount = fullEOSB(years, dailyRate)
        return min(fullAmount, 730 * dailyRate)

    if terminationType == "resignation":
        fullAmount = fullEOSB(years, dailyRate)
        cappedFullAmount = min(fullAmount, 730 * dailyRate)
        if years < 3:
            return cappedFullAmount / 3
        elif years < 5:
            return cappedFullAmount * 2 / 3
        else:
            return cappedFullAmount

function fullEOSB(years, dailyRate):
    if years <= 5:
        return 21 * dailyRate * years
    else:
        return (21 * dailyRate * 5) + (30 * dailyRate * (years - 5))
```

### 3.4 Data Fields Needed in Schema

| Field | Type | Description |
|---|---|---|
| `basic_salary` | REAL | Must be stored separately from total salary |
| `start_date` | TEXT | Date of employment start |
| `end_date` | TEXT | Date of termination |
| `termination_type` | TEXT | resignation, employer_initiated, mutual, summary_dismissal |
| `notice_period_days` | INTEGER | As per contract |
| `unpaid_leave_days` | INTEGER | Total unpaid leave days > 90 threshold |

---

## 4. EOSB — KSA

> **Legal note (tracked):** KSA EOSB per Royal Decree M/51 Art. 84 — pin-cite confirmation by KSA-qualified counsel pending (owner to obtain before any paying KSA client uses the module).

### 4.1 Legal Basis
- Articles 74-86 of the Saudi Labor Law (Royal Decree M/51).
- Ministerial Resolution No. 1315 dated 18/6/1437 AH.

### 4.2 Eligibility
- EOSB accrues **pro-rata from the first day of service**; there is no minimum service period.
- Articles 80, 81 define summary dismissal grounds where EOSB is forfeited.
- Resignation or termination both qualify — no tiered reduction like UAE.

### 4.3 Calculation Logic

#### 4.3.1 Basic Formula

EOSB is calculated on **final total salary** (includes all allowances: housing, transport, commission, etc.) — unlike UAE which uses basic salary only.

| Service Duration | Gratuity Per Year |
|---|---|
| First 5 years | Half a month's salary per year |
| Each subsequent year | One full month's salary per year |

#### 4.3.2 Daily Rate Calculation

```
monthly_rate = total_salary (full salary = basic + allowances)
daily_rate = total_salary / 30  // or total_salary × 12 / 365 (some interpretations)
```

> **Note:** Some KSA court decisions have used a 365-day year calculation. The safest approach for an automated system is 30-day months, consistent with regulatory guidance.

#### 4.3.3 Full Entitlement Table

| Service Years | EOSB Entitlement |
|---|---|
| 0–5 years | 0.5 × monthly_rate × years_of_service |
| 5+ years | (0.5 × 5 + 1.0 × (years_of_service − 5)) × monthly_rate |

#### 4.3.4 Termination by Employee (Resignation)

Under KSA law, the employee is entitled to full EOSB even upon resignation (no tiered reduction based on who terminates, as in UAE). The only differentiator is whether the employee has **given proper notice**:

- If proper notice is given: full EOSB entitlement.
- If notice is not given: employer may deduct up to 50% of EOSB as compensation for failure to give notice.
- If the employee worked while in violation of Art. 80/81: forfeits EOSB.

#### 4.3.5 Implementation Pseudocode

```
function calculateEOSB_KSA(totalSalary, startDate, endDate):
    years = fractionalYears(startDate, endDate)
    monthlyRate = totalSalary

    if years <= 5:
        entitlement = (monthlyRate / 2) * years            // half-month per year
    else:
        entitlement = (monthlyRate / 2) * 5 + monthlyRate * (years - 5)  // half for 5 + full after

    return entitlement  // full for both resignation and termination; notice compensation is separate
```

### 4.4 Data Fields Needed in Schema

| Field | Type | Description |
|---|---|---|
| `total_salary` | REAL | Full salary including all allowances |
| `basic_salary` | REAL | Still useful for reporting/audit |
| `start_date` | TEXT | Date of employment start |
| `end_date` | TEXT | Date of termination |
| `gave_proper_notice` | BOOLEAN | Whether employee served full notice period |
| `termination_type` | TEXT | resignation, employer_initiated, mutual, summary_dismissal |

### 4.5 UAE vs KSA EOSB Comparison

| Aspect | UAE | KSA |
|---|---|---|
| **Salary basis** | Basic salary only | Total salary (all allowances) |
| **Eligibility threshold** | 1 year | None (pro-rata from day one) |
| **Notice period min** | 30 days | 30 days |
| **Resignation reduction** | Yes (1/3, 2/3, full) | No (but notice penalty applies) |
| **Cap** | 2 years' basic salary | No explicit cap |
| **Excluded periods** | Unpaid leave > 90 days | Not specified in law |
| **Probation EOSB** | No entitlement | No entitlement |

---

## 5. UAE PDPL

### 5.1 Governing Legislation

- **Primary Law:** Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data ("UAE PDPL").
- **Effective Date:** Law published 20 September 2021; enforcement delayed. Enforcement began in 2024 with the establishment of the UAE Data Office.
- **Regulator:** UAE Data Office (established 2022).
- **Relationship with DIFC/ADGM:** The UAE PDPL is federal law. DIFC Law No. 5 of 2020 and ADGM Data Protection Regulations 2021 apply **within** those free zones. Antum must comply with whichever law applies based on the entity's location.

### 5.2 Key Requirements for Employee Data

| Requirement | Details | Antum People Impact |
|---|---|---|
| **Consent** | Processing employee data requires explicit consent. For HR processing (contractual necessity), Art. 4(2) allows processing without consent. | Consent capture on onboarding. Purpose limitation notices. |
| **Purpose Limitation** | Data must be collected for specified, explicit, legitimate purposes. | Privacy notice at data collection point. |
| **Data Minimisation** | Only collect data necessary for the employment relationship. | Review schema: do not collect unnecessary personal data. |
| **Data Retention** | Must not retain longer than necessary. Specific retention periods for HR data: typically 2-5 years post-termination (per UAE labour law). | Data retention policy and auto-purge schedules. |
| **Data Subject Rights** | Right of access, rectification, erasure, restriction, portability, objection. | Employee self-service portal for data requests. |
| **Cross-Border Transfer** | Personal data may not be transferred outside UAE unless the destination has adequate data protection (or contractual safeguards are in place). | Data residency requirement. Adequacy determination or SCCs. |
| **Data Protection Officer** | DPO required if core activities involve processing sensitive data or large-scale monitoring. | DPO registration feature for clients. |
| **Data Breach Notification** | Must notify regulator within 72 hours of becoming aware. | Breach notification workflow. |
| **Sensitive Data** | Health data, biometric data, trade union membership, etc. require higher safeguards. | Encrypt at rest. Access control flags. |

### 5.3 Implementation Requirements

1. **Privacy Notice:** Display during onboarding. Must include:
   - Controller identity (employer)
   - Purposes of processing
   - Categories of data collected
   - Data subject rights
   - Retention period
   - Cross-border transfer details (if any)

2. **Data Inventory / ROPA:** Record of Processing Activities required for entities with 50+ employees or processing sensitive data.

3. **Consent Management:**
   - Separate consent for marketing/promotional use (not employment-related).
   - Consent must be freely given, specific, informed, unambiguous.
   - Withdrawal must be as easy as giving consent.

4. **Data Subject Request Handling:**
   - Response within 30 days (extendable to 60).
   - Generally free, unless manifestly unfounded or excessive.
   - Identity verification required.

5. **Data Protection Impact Assessment (DPIA):**
   - Required for processing that poses high risk to data subjects.
   - HR profiling/analytics likely triggers DPIA requirement.

6. **Security Measures:**
   - Appropriate technical and organisational measures.
   - Encryption of personal data in transit and at rest.
   - Pseudonymisation where possible.
   - Access controls (role-based).

### 5.4 Schema/Data Residency

- Employee personal data must be stored **within UAE data centres** or servers.
- If the Antum People platform runs in a non-UAE jurisdiction, the employer (controller) remains responsible.
- Recommendation: Deploy on UAE-based infrastructure (or ensure adequate safeguards for cross-border transfer).

---

## 6. KSA PDPL

### 6.1 Governing Legislation

- **Primary Law:** Personal Data Protection Law ("KSA PDPL"), issued by Royal Decree M/148, approved 7/2/1443 AH (14 September 2021). Amended in 2023.
- **Effective Date:** Originally 23 March 2022. Enforcement delayed. Final enforcement date: **September 2024** (with additional grace periods for certain provisions).
- **Regulator:** Saudi Authority for Data and Artificial Intelligence (SDAIA) — National Data Management Office (NDMO).

### 6.2 Key Requirements for Employee Data

| Requirement | Details | Antum People Impact |
|---|---|---|
| **Consent** | Explicit consent required unless one of the legal exceptions applies (e.g., contractual necessity for employment). Art. 6 lists lawful bases. | Consent mechanism + lawful basis recording. |
| **Purpose Limitation** | Data collected for specific, explicit, legitimate purpose. | Privacy notice at collection. Purpose tags on data fields. |
| **Data Minimisation** | Only collect what is necessary for the purpose. | Schema audit: remove unnecessary fields. |
| **Data Retention** | Must not retain data after purpose is fulfilled. Employment records: min 2 years after termination per labour law. | Auto-purge schedules. |
| **Data Subject Rights** | Right to access, rectify, destroy (erasure), restrict, object, data portability. | Self-service portal for data requests. |
| **Cross-Border Transfer** | Personal data may only be transferred outside KSA if:
   - The transfer is necessary for contract performance
   - The destination ensures adequate protection
   - SDAIA approval obtained (for sensitive data) | Data residency assessment. Adequacy determination. Standard Contractual Clauses. |
| **Data Protection Officer** | Must appoint a DPO (mandatory for all controllers). | DPO registration in platform admin. |
| **Data Breach Notification** | Notify SDAIA within 72 hours. Notify affected individuals "without delay." | Breach notification workflow + templates. |
| **Sensitive Data** | Health, genetic, biometric, credit/criminal records, political/religious opinions — stricter protections. | Encrypted storage. Restricted access. |
| **Processing Record** | Must maintain record of processing activities (ROPA). | Automated ROPA generation feature. |

### 6.3 Notable Differences from UAE PDPL

| Aspect | UAE PDPL | KSA PDPL |
|---|---|---|
| **Regulator** | UAE Data Office | SDAIA/NDMO |
| **DPO Requirement** | Conditional (high-risk processing) | Mandatory for all controllers |
| **Cross-Border Transfer** | General prohibition with exceptions | General permission with adequacy requirement |
| **Data Destruction** | Retention limitation | Explicit right to demand destruction |
| **Processing Record** | Required (50+ employees or sensitive data) | Required (all controllers) |
| **Penalties** | Administrative fines up to 5M AED (~$1.36M) | Fines up to 5M SAR (~$1.33M), imprisonment |

### 6.4 Implementation Requirements

1. **Lawful Basis Recording:** Every processing operation must be tagged with its legal basis (consent, contractual necessity, legal obligation, vital interest, public interest, legitimate interest).

2. **Privacy Notice (Arabic First):** The KSA PDPL requires the privacy notice to be in Arabic (can be bilingual). Must include:
   - Controller identity and contact
   - Purposes of processing
   - Categories of data
   - Retention period
   - Data subject rights
   - Transfer details (if applicable)
   - Complaint mechanism to SDAIA

3. **Consent Management:**
   - Explicit opt-in required (no pre-ticked boxes).
   - Record consent timestamp and version.
   - Withdrawal mechanism must be as easy as giving consent.

4. **Automated Decision-Making:**
   - Employees have the right to object to solely automated decision-making.
   - Antum People's predictive analytics ("Intelligence Tier") must offer human oversight.

5. **Data Processing Agreement (DPA):**
   - Antum (data processor) must have a DPA with the employer (data controller).
   - DPA must specify: subject, duration, nature, purpose, data types, obligations.

6. **Personal Data Breach Register:**
   - Record all breaches (even those not notifiable).
   - Include: nature, data involved, affected individuals, consequences, remedial actions.

---

## 7. Cross-Border & Dual-Jurisdiction Considerations

### 7.1 Multi-GCC Operations

For enterprises operating across both UAE and KSA:

| Consideration | Recommendation |
|---|---|
| **Data Residency** | Keep each country's employee data within that country. Do not commingle. |
| **Group Transfers** | Intra-group transfers between UAE and KSA entities require adequacy assessment or SCCs. |
| **Unified Platform** | Single Antum People instance can serve both with data segregation by `jurisdiction` tag. |
| **EOSB Engine** | Must be jurisdiction-aware: calculate differently based on employee's governing law. |
| **Contract Templates** | Separate templates for UAE (MoHRE-based) and KSA (Qiwa-based). |

### 7.2 Recommended Schema Enhancements

```sql
-- Add jurisdiction awareness to employees table
ALTER TABLE employees ADD COLUMN jurisdiction TEXT NOT NULL DEFAULT 'UAE'; -- 'UAE' or 'KSA'
ALTER TABLE employees ADD COLUMN governing_law TEXT; -- which labor law applies
ALTER TABLE employees ADD COLUMN basic_salary REAL; -- for UAE EOSB calc
ALTER TABLE employees ADD COLUMN total_salary REAL; -- for KSA EOSB calc
ALTER TABLE employees ADD COLUMN allowances_housing REAL;
ALTER TABLE employees ADD COLUMN allowances_transport REAL;
ALTER TABLE employees ADD COLUMN unpaid_leave_days INTEGER DEFAULT 0;
ALTER TABLE employees ADD COLUMN probation_end_date TEXT;
ALTER TABLE employees ADD COLUMN nitaqat_band TEXT; -- KSA only
ALTER TABLE employees ADD COLUMN emirati_flag INTEGER DEFAULT 0; -- UAE only

-- New table for consent records
CREATE TABLE IF NOT EXISTS consent_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    consent_type TEXT NOT NULL, -- 'data_privacy', 'marketing', 'biometric'
    lawful_basis TEXT NOT NULL, -- 'consent', 'contractual_necessity', 'legal_obligation'
    granted_at TEXT NOT NULL,
    revoked_at TEXT,
    ip_address TEXT,
    consent_version TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- New table for data subject requests
CREATE TABLE IF NOT EXISTS data_subject_requests (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    request_type TEXT NOT NULL, -- 'access', 'rectification', 'erasure', 'portability', 'restriction', 'objection'
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'completed', 'rejected'
    requested_at TEXT NOT NULL,
    completed_at TEXT,
    response_summary TEXT
);

-- New table for breach register (KSA PDPL mandatory)
CREATE TABLE IF NOT EXISTS breach_register (
    id TEXT PRIMARY KEY,
    detected_at TEXT NOT NULL,
    notified_at TEXT,
    regulator TEXT, -- 'SDAIA' or 'UAE_Data_Office' or 'both'
    affected_count INTEGER,
    data_categories TEXT,
    description TEXT,
    remedial_actions TEXT,
    status TEXT DEFAULT 'open'
);

-- New table for EOSB calculations (audit trail)
CREATE TABLE IF NOT EXISTS eosb_calculations (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    jurisdiction TEXT NOT NULL,
    termination_type TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    years_of_service REAL NOT NULL,
    daily_rate REAL NOT NULL,
    basic_salary_used REAL, -- UAE
    total_salary_used REAL, -- KSA
    gross_eosb REAL NOT NULL,
    deductions REAL DEFAULT 0,
    net_eosb REAL NOT NULL,
    calculated_at TEXT NOT NULL,
    calculated_by TEXT -- user/system identifier
);
```

---

## 8. Compliance Feature Recommendations for Antum People

### Priority Matrix (P0 = must-have for MVP, P1 = v1.1, P2 = v2.0)

| Feature | Priority | Description |
|---|---|---|
| **Jurisdiction-Aware EOSB Engine** | **P0** | Dual calculation engine: UAE (basic salary, tiered resignation) and KSA (total salary, notice penalty). |
| **Onboarding Compliance Checklist** | **P0** | Jurisdiction-specific tasks: visa, MoHRE/Qiwa registration, WPS setup, contract generation. |
| **Offboarding Settlement Calculator** | **P0** | Auto-generates final settlement: salary, EOSB, leave encashment, notice pay. 14-day/UAE and 7-day/KSA settlement timelines. |
| **Privacy Notice Generator** | **P0** | Generate jurisdiction-specific privacy notices in Arabic and English for onboarding consent. |
| **Consent Management** | **P0** | Record lawful basis for each processing activity. Consent withdrawal mechanism. |
| **Data Subject Request Workflow** | **P1** | Intake, verify, respond (30-day SLA), track. Auto-responders for access/erasure where possible. |
| **Data Retention Auto-Purge** | **P1** | Configurable retention policies per jurisdiction. Auto-delete or anonymise data post-retention. |
| **Breach Notification Workflow** | **P1** | Templates, 72-hour timer, regulator notification, affected individual notification. |
| **DPO Registry & Assignment** | **P1** | Record DPO contact for each client entity. |
| **ROPA Generator** | **P2** | Auto-generate Record of Processing Activities from schema and data flows. |
| **DPIA Helper** | **P2** | Guided questionnaire for Data Protection Impact Assessment, especially for the Intelligence Tier analytics. |
| **Emiratisation/Saudization Dashboard** | **P1** | Real-time quota tracking, Nafis/Nitaqat band levels, missing target alerts. |
| **WPS Compliance Check** | **P2** | Verify salary payments in last 6 months match WPS records (for EOSB verification). |
| **Visa & Iqama Lifecycle Tracking** | **P0** | Visa stages, expiry dates, renewal reminders, cancellation workflow. |
| **Arabic Language Support** | **P0** | UI/contracts/notices must support Arabic (LTR + RTL rendering). KSA PDPL requires Arabic privacy notices. |
| **Contract Template Engine** | **P1** | Jurisdiction-specific compliant contract templates (MoHRE standard + Qiwa standard). |

### Data Privacy Architecture

```
┌─────────────────────────────────────────────────┐
│                  Antum People                       │
│  ┌──────────────┐    ┌──────────────────────┐   │
│  │ UAE Data     │    │ KSA Data             │   │
│  │ Partition    │    │ Partition            │   │
│  ├──────────────┤    ├──────────────────────┤   │
│  │ employees    │    │ employees            │   │
│  │ jurisdiction │    │ jurisdiction         │   │
│  │ = 'UAE'      │    │ = 'KSA'              │   │
│  └──────────────┘    └──────────────────────┘   │
│         │                      │                │
│         └──────────┬───────────┘                │
│                    │                             │
│         ┌──────────▼───────────┐                │
│         │  Cross-Border        │                │
│         │  Safeguard Logic     │                │
│         │  (SCCs / Adequacy)   │                │
│         └──────────────────────┘                │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Encryption Layer (AES-256 at rest, TLS) │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Access Control (RBAC)                   │    │
│  │ Roles: HR_Admin, Manager, Employee,     │    │
│  │         Compliance_Officer, DPO         │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

---

## 9. Appendix: Key Legal References

### UAE Primary Sources

| Document | Description |
|---|---|
| Federal Decree-Law No. 33 of 2021 | UAE Labour Law (private sector) |
| Cabinet Resolution No. 1 of 2022 | Implementation Regulations |
| Ministerial Resolution No. 46 of 2022 | Employment of Minors |
| Ministerial Resolution No. 728 of 2022 | Model Employment Contract |
| Federal Decree-Law No. 45 of 2021 | UAE PDPL (Data Privacy) |
| Cabinet Decision No. 65/2022 | Cross-Border Personal Data Transfer |
| Wages Protection System (WPS) | Central Bank / MoHRE system |
| Abu Dhabi Global Market (ADGM) Data Protection Regulations 2021 | ADGM-specific |
| DIFC Law No. 5 of 2020 (Data Protection Amendment Law) | DIFC-specific |

### KSA Primary Sources

| Document | Description |
|---|---|
| Royal Decree No. M/51 (Saudi Labor Law) | KSA Labour Law |
| 2021 Amendments (Royal Decree M/190) | Latest labour law amendments |
| Ministerial Resolution No. 1315 | EOSB calculation guidance |
| Royal Decree M/148 (KSA PDPL) | Personal Data Protection Law |
| SDAIA Implementing Regulations (2023) | PDPL Implementation Rules |
| Nitaqat Program | MHRSD Saudization banding |
| Qiwa Portal | MHRSD employment registration |
| Mudad Platform | Outsourced payroll registration |
| Wages Protection System (WPS) | KSA WPS requirements |

---

> **Next Steps for Engineering:**
> 1. Implement the recommended schema changes (jurisdiction columns, consent_records, dsr_requests, breach_register, eosb_calculations tables).
> 2. Build dual EOSB calculation engine with jurisdiction routing.
> 3. Add privacy notice generator and consent capture to onboarding flow.
> 4. Implement data subject request intake workflow.
>
> **Next Steps for Design:**
> 1. Design jurisdiction selector in employee profile (UAE/KSA).
> 2. Design EOSB calculator UI showing breakdown (basic salary, years, daily rate, gross, deductions, net).
> 3. Design privacy notice display and consent capture UI (Arabic + English).
> 4. Design compliance dashboard showing Emiratisation/Nitaqat status, visa expiries, consent coverage.
>
> **Next Steps for Product:**
> 1. Prioritise P0 items for MVP.
> 2. Plan Arabic language support for v1.0 (RTL layout, Arabic-first contract templates).
> 3. Plan UAE PDPL/KSA PDPL compliance certifications as part of go-to-market.