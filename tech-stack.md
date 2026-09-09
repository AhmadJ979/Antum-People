# VantageHR Tech Stack & Database Schema Documentation

This document outlines the technical architecture, data model, and compliance design of the VantageHR platform, emphasizing our specialized support for the GCC region (UAE, Saudi Arabia).

---

## 1. Technical Architecture Overview

VantageHR employs a single-origin, lightweight, and high-performance stack optimized for GCC enterprises.

*   **Frontend**: React (v18), TypeScript, TailwindCSS (for high-fidelity localized HR UI/UX), Vite (fast build-tooling).
*   **Backend**: Node.js, Express, REST APIs, and background processing for automated onboarding and offboarding tasks.
*   **Database**: SQLite synced globally with Turso using the custom team coordination layer (`team-db`). All state mutations are instantly synchronized across distributed nodes.
*   **Production Port Binding**: The application binds and serves both the Express APIs and pre-built React production bundle on **Port 3000** (bound to `0.0.0.0` for public client ingress).

---

## 2. Updated Core Database Schema

The database relies on a highly structured SQLite database. To meet the stringent localization standards (UAE PDPL, KSA PDPL, and labor laws), the table schema includes specific localization attributes.

### Table: `employees`
Contains critical employee demographic, operational, financial, and regulatory metadata.

| Column Name | SQLite Data Type | Default/Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT` | `PRIMARY KEY` | Unique UUID for the employee. |
| `first_name` | `TEXT` | `NOT NULL` | Employee's first name. |
| `last_name` | `TEXT` | `NOT NULL` | Employee's family name. |
| `email` | `TEXT` | `NOT NULL` | Corporate email address. |
| `department` | `TEXT` | - | Department identifier (e.g., Engineering, HR). |
| `role` | `TEXT` | - | Designation/job title. |
| `manager_id` | `TEXT` | - | Self-referencing UUID pointing to the manager. |
| `start_date` | `TEXT` | `NOT NULL` | Contract start date (YYYY-MM-DD). |
| `end_date` | `TEXT` | - | Contract end or termination date (YYYY-MM-DD). |
| `status` | `TEXT` | `'onboarding'` | Transition status (`onboarding`, `active`, `offboarding`, `terminated`). |
| `salary` | `REAL` | `0.0` | Total/gross monthly salary (inclusive of standard allowances). |
| `recruitment_cost` | `REAL` | `0.0` | Cost-per-hire tracking metric. |
| `fully_productive_date` | `TEXT` | - | Date on which onboarding is completed and TTV is achieved. |
| `national_id_type` | `TEXT` | - | Type of localized identity document (`Emirates ID`, `Iqama`, `National ID`). |
| `national_id_value` | `TEXT` | - | Document identifier value. |
| `national_id_iqama` | `TEXT` | - | Iqama number specifically (dual-mapped for Saudi compatibility). |
| `data_residency_country`| `TEXT` | `'AE'` | Physical host country of the employee's personal data. |
| `consent_granted` | `INTEGER` | `0` (False) | PDPL/GDPR explicit privacy consent flag (1 = True, 0 = False). |
| `consent_date` | `TEXT` | - | Timestamp when privacy consent was explicitly granted. |
| `visa_status` | `TEXT` | - | Visa residency processing stage (`citizen`, `sponsored`, `pending_clearance`). |
| `visa_expiry_date` | `TEXT` | - | Visa expiration date (for proactive compliance alerting). |
| `basic_salary` | `REAL` | `0.0` | Contractual basic salary (used as the primary base for UAE EOSB). |
| `eosb_accrued` | `REAL` | `0.0` | Dynamically calculated accrued End-of-Service Benefit (gratuity) liability. |
| `eosb_paid` | `REAL` | `0.0` | Actual EOSB amount paid out at offboarding/termination. |
| `jurisdiction` | `TEXT` | - | Standardized country code for local labor law jurisdiction (`AE` or `SA`). |
| `total_salary` | `REAL` | `0.0` | Total monthly salary including KSA allowances (base for Saudi EOSB calculations). |
| `unpaid_leave_days` | `INTEGER` | `0` | Number of unpaid leave days taken. Deducted from overall service tenure. |
| `probation_end_date` | `TEXT` | - | End date of probation period (standard 90 or 180 days in the GCC). |
| `nitaqat_band` | `TEXT` | - | Saudi Arabian Saudization rating band (`Red`, `Yellow`, `Low Green`, `Platinum`). |
| `emirati_flag` | `INTEGER` | `0` | Flag denoting UAE National status for Emiratisation tracking. |
| `created_at` | `TEXT` | `CURRENT_TIMESTAMP` | Audit timestamp of record creation. |
| `updated_at` | `TEXT` | `CURRENT_TIMESTAMP` | Audit timestamp of last update. |

---

## 3. Audit & Compliance Tables (P0 Security Items)

To comply with the strict record-keeping requirements of the **Saudi Personal Data Protection Law (KSA PDPL)** and the **UAE Personal Data Protection Law (UAE PDPL)**, four high-fidelity audit tables have been established.

### A. Table: `consent_records`
Maintains a tamper-proof ledger of employee privacy consents and revocations.

*   `id` (`TEXT PRIMARY KEY`): Unique audit log record ID.
*   `employee_id` (`TEXT`): Foreign key matching the associated employee.
*   `consent_type` (`TEXT`): Area of processing consented to (e.g., `'data_processing'`, `'marketing_outreach'`).
*   `status` (`TEXT`): Explicit status of consent (`'granted'`, `'revoked'`).
*   `consent_date` (`TEXT`): Date and time the status was recorded.
*   `ip_address` (`TEXT`): Client network IP address from which the consent action originated.
*   `created_at` (`TEXT DEFAULT CURRENT_TIMESTAMP`): Record creation audit timestamp.

### B. Table: `data_subject_requests`
Maintains records of individual rights fulfillment actions (KSA/UAE PDPL Articles of Data Subject Rights).

*   `id` (`TEXT PRIMARY KEY`): Unique request tracking ID.
*   `employee_id` (`TEXT`): ID of the requesting data subject.
*   `request_type` (`TEXT`): Nature of the right being exercised (`'access'`, `'rectification'`, `'erasure'`).
*   `status` (`TEXT`): Processing status (`'pending'`, `'completed'`, `'rejected'`).
*   `request_date` (`TEXT`): Date the request was formally received.
*   `completion_date` (`TEXT`): Date of final resolution and communication to the subject.
*   `details` (`TEXT`): Descriptions, log notes, and resolution actions.
*   `created_at` (`TEXT DEFAULT CURRENT_TIMESTAMP`): Log entry timestamp.

### C. Table: `breach_register`
Secures a mandatory internal register of data processing and security incidents, essential for reporting to supervisory authorities within legal time windows (e.g., 72 hours).

*   `id` (`TEXT PRIMARY KEY`): Incident identifier.
*   `incident_date` (`TEXT`): Estimated or confirmed date/time of the event.
*   `discovery_date` (`TEXT`): Timestamp when internal security teams identified the incident.
*   `severity` (`TEXT`): Risk classification (`'low'`, `'medium'`, `'high'`, `'critical'`).
*   `description` (`TEXT`): Detailed assessment of affected systems and files.
*   `affected_subjects_count` (`INTEGER`): Approximate count of individuals whose PI/data was exposed.
*   `status` (`TEXT`): Event lifecycle status (`'under_investigation'`, `'contained'`, `'reported_to_authority'`).
*   `created_at` (`TEXT DEFAULT CURRENT_TIMESTAMP`): Log entry timestamp.

### D. Table: `eosb_calculations` (Gratuity Audit Trail)
Acts as an immutable audit trail of all End-of-Service Benefit (gratuity) calculations, preserving legal parameters and exact formulas used at the time of exit.

*   `id` (`TEXT PRIMARY KEY`): Calculation audit record ID.
*   `employee_id` (`TEXT`): Target employee ID.
*   `calculation_date` (`TEXT`): Execution timestamp of the calculation.
*   `jurisdiction` (`TEXT`): Country code applying to the calculation (`'AE'` or `'SA'`).
*   `start_date` (`TEXT`): Contract start date entered into the engine.
*   `end_date` (`TEXT`): Contract end date entered into the engine.
*   `basic_salary` (`REAL`): Basic salary used.
*   `total_salary` (`REAL`): Total salary used.
*   `unpaid_leave_days` (`INTEGER`): Unpaid leave deduction used.
*   `is_resignation` (`INTEGER`): Binary indicator (1 = Yes, 0 = No).
*   `accrued_amount` (`REAL`): Accrued final gratuity payout calculated.
*   `formula_used` (`TEXT`): Text explanation of the exact legal tier, thresholds, caps, penalties, or multipliers applied.
*   `created_at` (`TEXT DEFAULT CURRENT_TIMESTAMP`): Creation timestamp.

---

## 4. Double-Logic EOSB Calculation Formulas

The compliance engine inside the backend exposes high-fidelity calculation endpoints and runs the following logic:

### United Arab Emirates (UAE Jurisdiction: `AE`)
1.  **Salary Base**: `basic_salary`.
2.  **Unpaid Leave Deduction**: `tenureYears = (Raw Days - unpaid_leave_days) / 365.25`.
3.  **Accrual Rates**:
    *   `< 1 Year`: 0 days gratuity.
    *   `1 to 5 Years`: 21 days basic salary per year.
    *   `> 5 Years`: 30 days basic salary per year for each year over 5.
4.  **Resignation Entitlement (Tiered)**:
    *   `1 to 3 Years`: 1/3 of the calculated amount.
    *   `3 to 5 Years`: 2/3 of the calculated amount.
    *   `>= 5 Years`: Full amount.
5.  **Absolute Cap**: Total accrued days cannot exceed **730 days** of basic salary.

### Saudi Arabia (KSA Jurisdiction: `SA`)
1.  **Salary Base**: `total_salary`.
2.  **Unpaid Leave Deduction**: `tenureYears = (Raw Days - unpaid_leave_days) / 365.25`.
3.  **Accrual Rates**:
    *   `< 2 Years`: 0 days gratuity (unless terminated by employer without cause).
    *   `First 5 Years`: 15 days total salary per year (half-month).
    *   `Subsequent Years`: 30 days total salary per year (full-month).
4.  **Resignation Multiplier (Article 85)**:
    *   `2 to 5 Years`: 1/3 of calculated benefit.
    *   `5 to 10 Years`: 2/3 of calculated benefit.
    *   `>= 10 Years`: Full benefit.
5.  **Notice Penalty**: If notice is unserved during a resignation, a penalty equal to 1 month of total salary is deducted from the gratuity total.
