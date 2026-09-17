# Antum People — Compliance Audit & DSR Management UI Design

> **Based on:** GCC Compliance Requirements Report §§5-8 (UAE PDPL, KSA PDPL, Schema)
> **Brand Alignment:** Antum Identity — Deep Teal `#0F766E`, Inter font, slate card system
> **Tables:** `consent_records`, `data_subject_requests`, `breach_register`

---

## Table of Contents

1. [Consent Audit Trail](#1-consent-audit-trail)
2. [Breach Register](#2-breach-register)
3. [DSR Management](#3-dsr-management)
4. [Template Mapping Tool](#4-template-mapping-tool)
5. [Schema & Data Flow](#5-schema--data-flow)
6. [Implementation Notes](#6-implementation-notes)

---

## 1. Consent Audit Trail

### Location
Admin sidebar: `Compliance > Consent Audit`

Provides HR admins and DPOs with a complete, searchable log of every consent interaction — who consented, when, under which version, and whether it was revoked.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Antum People Logo]  Compliance > Consent Audit              [Export CSV] [🔍]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  📊 CONSENT COVERAGE SUMMARY                                       │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ 120          │  │ 8            │  │ 3            │              │   │
│  │  │ Active       │  │ Pending      │  │ Revoked      │              │   │
│  │  │ Consents     │  │ Consents     │  │ Consents     │              │   │
│  │  │ ▲ +5 this Q │  │ ⚠ 4 expiring│  │ ▼ Show all  │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │                                                                      │   │
│  │  Consent Version: v2.1 (June 2026)  |  Latest: v2.2 (pending)       │   │
│  │  [📢 Push Re-consent Campaign]                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  CONSENT RECORDS                                      Filters ▾    │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  [Search by employee name, email, ID...                           ] │   │
│  │                                                                      │   │
│  │  ┌────┬────────────┬────────┬────────┬────────┬────────┬────────┐  │   │
│  │  │ #  │ Employee   │ Type   │ Status │ Granted│ Version│ Revoked│  │   │
│  │  ├────┼────────────┼────────┼────────┼────────┼────────┼────────┤  │   │
│  │  │ 1  │ Sarah A.   │ Data   │ ✅     │15/06/26│ v2.1   │ —      │  │   │
│  │  │    │ (EMP-042)  │Privacy │ Active │10:30AM │        │        │  │   │
│  │  │    │ UAE        │        │        │        │        │        │  │   │
│  │  │ 2  │ Omar H.    │ Data   │ ⏳     │15/06/26│ v2.1   │ —      │  │   │
│  │  │    │ (EMP-089)  │Privacy │ Pending│—       │        │        │  │   │
│  │  │    │ KSA        │        │        │        │        │        │  │   │
│  │  │ 3  │ Layla K.   │ Market-│ 🔴     │10/01/26│ v1.0   │01/04/26│  │   │
│  │  │    │ (EMP-031)  │ ing    │ Revoked│        │        │14:20PM │  │   │
│  │  │    │ UAE        │        │        │        │        │        │  │   │
│  │  │ 4  │ Ahmed M.   │ Data   │ ✅     │01/01/26│ v1.0   │ —      │  │   │
│  │  │    │ (EMP-042*) │Privacy │ Active │        │        │        │  │   │
│  │  │    │ UAE        │        │        │        │        │        │  │   │
│  │  │    │ ...        │ ...    │ ...    │ ...    │ ...    │ ...    │  │   │
│  │  └────┴────────────┴────────┴────────┴────────┴────────┴────────┘  │   │
│  │                                                                      │   │
│  │  Showing 1-20 of 131 records  ◀ 1 2 3 ... 7 ▶                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  CONSENT DETAIL (click row to expand)                                │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Employee:    Sarah Ahmed (EMP-042)  │  ☐ Withdraw Consent          │   │
│  │  Jurisdiction: UAE                    │                               │   │
│  │  Type:        Data Privacy           │  Consent Items:               │   │
│  │  Lawful Basis: contractual_necessity │  ✓ Employment admin           │   │
│  │               legitimate_interest    │  ✓ Payroll processing         │   │
│  │               consent                │  ✓ Workforce analytics        │   │
│  │                                      │  ✓ Compliance                 │   │
│  │  Granted:     15 Jun 2026 10:30 GST  │  ☐ Marketing (not consented) │   │
│  │  IP:          192.168.1.100          │                               │   │
│  │  Version:     v2.1 (June 2026)       │  [📄 View Full Consent Log]  │   │
│  │  Revoked:     —                       │                               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Consent summary cards** | Active / Pending / Revoked counts with jurisdiction filter |
| **Version tracker** | Current consent version + ability to push re-consent campaigns when version updates |
| **Searchable table** | Full-text search + filter by type, status, jurisdiction, date range |
| **Detail drawer** | Expandable row shows full consent payload: items, IP, version, lawful basis |
| **Withdraw action** | One-click consent withdrawal with timestamp recording |
| **Export** | CSV/PDF export for audit documentation |

### Filter Options

| Filter | Values |
|--------|--------|
| Jurisdiction | All, UAE, KSA |
| Consent Type | Data Privacy, Marketing, Biometric |
| Status | Active, Pending, Revoked |
| Version | v1.0, v2.0, v2.1, v2.2 |
| Date Range | Custom date picker |
| Lawful Basis | Consent, Contractual Necessity, Legal Obligation, Legitimate Interest |

---

## 2. Breach Register

### Location
Admin sidebar: `Compliance > Breach Register`

A mandatory record (KSA PDPL Art. 6.4.6 requires breach register) for logging all personal data breaches — even those below the notification threshold.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Antum People Logo]  Compliance > Breach Register          [+ New Breach Log] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  🚨 BREACH NOTIFICATION TIMELINE                   ⏱ 72h deadline  │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Open: 2  |  Under Investigation: 1  |  Resolved: 5  |  All: 8     │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐│   │
│  │  │ ⚠️ 1 breach needs action — 48h elapsed (24h remaining)          ││   │
│  │  └──────────────────────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  BREACH REGISTER                                        Filters ▾  │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  ┌────┬────────┬────────┬────────┬────────┬────────┬──────────┬───┐ │   │
│  │  │ ID │ Date   │ Desc   │ Affected│ Status │Notified│ Regulator│ ⚡ │ │   │
│  │  ├────┼────────┼────────┼────────┼────────┼────────┼──────────┼───┤ │   │
│  │  │ B- │22/06/26│Unauth- │  12    │ 🔴     │ ❌ Not │ SDAIA    │⚠️ │ │   │
│  │  │ 004│09:15   │orized  │ emp    │Open    │ yet    │ (KSA)    │48h│ │   │
│  │  │    │        │access  │ records│        │        │          │   │ │   │
│  │  │ B- │15/06/26│Phishing│  3     │ 🟡     │ ✅ Yes │ UAE Data │   │ │   │
│  │  │ 003│14:30   │email   │ contacts│Investig│ 15/06  │ Office   │   │ │   │
│  │  │    │        │        │        │        │ 16:00  │          │   │ │   │
│  │  │ B- │01/05/26│Lost    │  0     │ 🟢     │ N/A    │ N/A      │   │ │   │
│  │  │ 002│11:00   │laptop  │ (enc.) │Resolved│ (below │          │   │ │   │
│  │  │    │        │(encrypt│        │        │ thresh)│          │   │ │   │
│  │  │    │        │ed)     │        │        │        │          │   │ │   │
│  │  │ B- │10/04/26│Misdir- │  1     │ 🟢     │ ✅ Yes │ UAE Data │   │ │   │
│  │  │ 001│09:45   │ected   │ payroll │Resolved│ 10/04  │ Office   │   │ │   │
│  │  │    │        │email   │ record │        │ 11:30  │          │   │ │   │
│  │  └────┴────────┴────────┴────────┴────────┴────────┴──────────┴───┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  B-004 DETAIL — Unauthorized Access (Open)                          │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  🚨 48 HOURS ELAPSED — 24h remaining before mandatory notification   │   │
│  │  ┌────────────────────────────────────────────────────────────┐      │   │
│  │  │ ⏱  Detected:  22 Jun 2026 09:15 GST                       │      │   │
│  │  │ ⏰ Deadline:  25 Jun 2026 09:15 GST                       │      │   │
│  │  │ ⏳ Remaining: 23h 45m                                      │      │   │
│  │  └────────────────────────────────────────────────────────────┘      │   │
│  │                                                                      │   │
│  │  Description:                                                       │   │
│  │  Unauthorized access to employee database by terminated employee's   │   │
│  │  credentials. Access logs show 12 records viewed before revocation.  │   │
│  │                                                                      │   │
│  │  Data Categories: Names, Emirates IDs, salary data                   │   │
│  │  Affected Individuals: 12 (list attached)                           │   │
│  │  Status: Under Investigation                                         │   │
│  │  Remedial Actions: Credentials revoked, MFA enforced, access logs    │   │
│  │  preserved for forensic analysis.                                   │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────┐  ┌──────────────────────────┐         │   │
│  │  │ 📨 Notify SDAIA          │  │ 📧 Notify Individuals    │         │   │
│  │  │ Template pre-filled ✓    │  │ Template pre-filled ✓   │         │   │
│  │  └──────────────────────────┘  └──────────────────────────┘         │   │
│  │                                                                      │   │
│  │  [🔒 Mark as Resolved]  [📋 Add Remedial Action]  [📥 Export Report] │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Features

| Feature | Description |
|---------|-------------|
| **72-hour countdown timer** | Visual urgency indicator — turns amber at 48h, red at 60h |
| **Pre-filled notification templates** | Separate templates for SDAIA (KSA) and UAE Data Office |
| **Individual notification workflow** | Automated email to affected employees with breach details |
| **Severity status** | Open (🔴), Under Investigation (🟡), Resolved (🟢) |
| **Below-threshold logging** | Track even non-notifiable breaches (e.g., encrypted device lost) |
| **Audit trail** | Full changelog of actions taken, timestamps, user who performed each action |

### Color Semantics

| Metric | Green (🟢) | Amber (🟡) | Red (🔴) |
|--------|-----------|------------|----------|
| Time remaining | >48h | 24-48h | <24h |
| Status | Resolved | Under Investigation | Open/Unresolved |
| Severity (affected) | 0-5 individuals | 5-20 individuals | 20+ individuals |

---

## 3. DSR Management

### Location
Admin sidebar: `Compliance > DSR Requests`

Manages Data Subject Requests (right of access, rectification, erasure, portability, restriction, objection) with SLA tracking.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Antum People Logo]  Compliance > DSR Requests              [+ New Request]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  📋 DSR SUMMARY                               SLA: 30 days          │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Open: 3  |  In Progress: 2  |  Completed: 15  |  Overdue: 1 ⚠️   │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐│   │
│  │  │ ⚠️ 1 request overdue — EMP-031 (Erasure) — Day 33 of 30        ││   │
│  │  └──────────────────────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  DSR REQUESTS                                          Filters ▾    │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  ┌────┬────────┬────────┬────────┬────────┬────────┬────────┬────┐  │   │
│  │  │ #  │ Employee│ Type   │ Status │ Day of │Remain- │Assignee│ ⚡ │  │   │
│  │  ├────┼────────┼────────┼────────┼────────┼────────┼────────┼────┤  │   │
│  │  │ 1  │ Layla K.│ 🗑     │🔴      │ Day 33 │ -3 ⚠️ │ —      │🔥  │  │   │
│  │  │    │(EMP-031)│Erasure │Overdue │        │        │        │    │  │   │
│  │  │ 2  │ Ahmed M.│ 👁     │🟡      │ Day 18 │ 12 days│ J.Smith│    │  │   │
│  │  │    │(EMP-042)│Access  │Progrss │        │ left   │ (HR)   │    │  │   │
│  │  │ 3  │ Omar H. │ ✏️     │🟡      │ Day 10 │ 20 days│ —      │    │  │   │
│  │  │    │(EMP-089)│Rectify │Progrss │        │ left   │        │    │  │   │
│  │  │ 4  │ Sara N. │ 🔄     │✅      │ Day 22 │ 8 days │ J.Smith│    │  │   │
│  │  │    │(EMP-112)│Portable│Completed│        │ early  │ (HR)   │    │  │   │
│  │  │ 5  │ Fahad A.│ 🚫     │🟢      │Day 5   │ 25 days│ Auto   │    │  │   │
│  │  │    │(EMP-067)│Object  │Rejected│        │ left   │(system)│    │  │   │
│  │  │    │ ...    │ ...    │ ...    │ ...    │ ...    │ ...    │    │  │   │
│  │  └────┴────────┴────────┴────────┴────────┴────────┴────────┴────┘  │   │
│  │                                                                      │   │
│  │  Showing 1-20 of 21 requests  ◀ 1 2 ▶                              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  DSR DETAIL — EMP-031 Erasure Request (Overdue)                     │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Request Type:  🗑 Erasure (Right to be Forgotten)                   │   │
│  │  Employee:      Layla Khalid (EMP-031) — Terminated (15 May 2026)   │   │
│  │  Status:        🔴 Overdue                                          │   │
│  │                                                                      │   │
│  │  ⚠️ This request is 3 days past the 30-day SLA deadline             │   │
│  │                                                                      │   │
│  │  ⏱ Timeline:                                                        │   │
│  │  ┌────────────────────────────────────────────────────────────┐     │   │
│  │  │ 21 May 2026 — Request submitted                             │     │   │
│  │  │ 21 May 2026 — Identity verified (automatic)                │     │   │
│  │  │ 22 May 2026 — Acknowledged (1 day)                         │     │   │
│  │  │ 22 May 2026 — Data inventory scan started                   │     │   │
│  │  │ [⚠️ ACTION REQUIRED] — Erasure pending legal hold check    │     │   │
│  │  └────────────────────────────────────────────────────────────┘     │   │
│  │                                                                      │   │
│  │  Action Required:                                                    │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │ □ Verify no legal hold applies to this employee's records    │   │   │
│  │  │ □ Confirm data to be erased: [12 systems identified]         │   │   │
│  │  │ □ Approve erasure execution                                   │   │   │
│  │  │ □ Send confirmation to employee                              │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  [✅ Approve & Execute Erasure]  [⏸ Place on Hold]  [❌ Reject]     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### DSR Request Types & Icons

| Type | Icon | SLA | Description |
|------|------|-----|-------------|
| Access | 👁 | 30 days | Employee wants to view their data |
| Rectification | ✏️ | 30 days | Employee wants to correct inaccurate data |
| Erasure | 🗑 | 30 days | Right to be forgotten |
| Portability | 🔄 | 30 days | Export data in machine-readable format |
| Restriction | ⏸ | 30 days | Restrict processing of their data |
| Objection | 🚫 | 30 days | Object to processing (esp. automated decision-making) |

### SLA Tracking

| Status | Color | Day Range |
|--------|-------|-----------|
| On track | 🟢 | 0-20 days |
| Approaching deadline | 🟡 | 21-28 days |
| Urgent | 🔴 | 29-30 days |
| Overdue | 🔥 | 31+ days (shows negative count) |

---

## 4. Template Mapping Tool

### Location
Admin sidebar: `Settings > Template Mapping`

Allows HR admins to configure which database fields map to which template placeholders for automated document generation. This is a power-user tool with a visual mapping interface.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Antum People Logo]  Settings > Template Mapping                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  TEMPLATE MAPPING CONFIGURATION                                      │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Step 1: Select Template                                            │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐│   │
│  │  │ 📄 UAE Employment Contract  │  📄 KSA Employment Contract      ││   │
│  │  │ 📄 Final Settlement Stmt    │  📄 Privacy Notice               ││   │
│  │  │                                                                  ││   │
│  │  │ Selected: UAE Employment Contract     🇦🇪                     ││   │
│  │  │ Version: v1.0  |  Last mapped: 15 Jun 2026                     ││   │
│  │  └──────────────────────────────────────────────────────────���───────┘│   │
│  │                                                                      │   │
│  │  Step 2: Map Fields                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐│   │
│  │  │  Template Field          │ Source Table  │ Source Field    │ ⚡  ││   │
│  │  ├──────────────────────────────────────────────────────────────────┤│   │
│  │  │ {{employee_name}}        │ employees     │ first_name +    │ ✅  ││   │
│  │  │                          │               │ last_name       │     ││   │
│  │  │ {{nationality}}          │ employees     │ nationality     │ ✅  ││   │
│  │  │ {{passport_number}}      │ employees     │ passport_number │ ✅  ││   │
│  │  │ {{emirates_id}}          │ employees     │ emirates_id     │ ✅  ││   │
│  │  │ {{date_of_birth}}        │ employees     │ date_of_birth   │ ✅  ││   │
│  │  │ {{job_title}}            │ employees     │ role            │ ✅  ││   │
│  │  │ {{department}}           │ employees     │ department      │ ✅  ││   │
│  │  │ {{start_date}}           │ employees     │ start_date      │ ✅  ││   │
│  │  │ {{basic_salary}}         │ employees     │ basic_salary    │ ✅  ││   │
│  │  │ {{housing_allowance}}    │ employees     │ allowances_hous-│ ✅  ││   │
│  │  │                         │               │ ing             │     ││   │
│  │  │ {{total_salary}}         │ [formula]     │ basic + housing │ ✅  ││   │
│  │  │                         │               │ + transport     │     ││   │
│  │  │ {{employer_name}}        │ config        │ company_name    │ ✅  ││   │
│  │  │ {{employer_address}}     │ config        │ company_address │ ⚠️  ││   │
│  │  │                         │               │ (not set)       │     ││   │
│  │  └──────────────────────────────────────────────────────────────────┘│   │
│  │                                                                      │   │
│  │  Step 3: Preview                                                     │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐│   │
│  │  │ ┌─── Template Preview ─────────────────────────────────────┐    ││   │
│  │  │ │                                                        │    ││   │
│  │  │ │  LIMITED TERM EMPLOYMENT CONTRACT                      │    ││   │
│  │  │ │                                                        │    ││   │
│  │  │ │  Employee Name: Sarah Ahmed                            │    ││   │
│  │  │ │  Nationality:   Emirati                                │    ││   │
│  │  │ │  Passport No:   AB1234567                              │    ││   │
│  │  │ │  Emirates ID:   784-1999-1234567-1                     │    ││   │
│  │  │ │  Job Title:     Senior Developer                       │    ││   │
│  │  │ │  Basic Salary:  AED 18,000                             │    ││   │
│  │  │ │                                                        │    ││   │
│  │  │ └────────────────────────────────────────────────────────┘    ││   │
│  │  └──────────────────────────────────────────────────────────────────┘│   │
│  │                                                                      │   │
│  │  [💾 Save Mapping]  [🔄 Reset to Default]  [📋 Validate All Fields]  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  FIELD SOURCES                                                    │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Available database columns for mapping:                             │   │
│  │                                                                      │   │
│  │  employees            │ consent_records      │ config               │   │
│  │  ─────────────────────┼──────────────────────┼──────────────────────│   │
│  │  first_name     TEXT  │ consent_type   TEXT  │ company_name   TEXT  │   │
│  │  last_name      TEXT  │ lawful_basis   TEXT  │ company_addr   TEXT  │   │
│  │  email          TEXT  │ granted_at     TEXT  │ dpo_email      TEXT  │   │
│  │  nationality    TEXT  │ revoked_at     TEXT  │ dpo_phone      TEXT  │   │
│  │  passport_num   TEXT  │ consent_vers   TEXT  │ jurisdiction   TEXT  │   │
│  │  emirates_id    TEXT  │ ip_address     TEXT  │ default_lang   TEXT  │   │
│  │  iqama_number   TEXT  │ consent_items  TEXT  │                    │   │
│  │  date_of_birth  TEXT  │                      │                    │   │
│  │  role           TEXT  │ eosb_calculations    │                    │   │
│  │  department     TEXT  │ ───────────────────  │                    │   │
│  │  basic_salary   REAL  │ net_eosb       REAL  │                    │   │
│  │  total_salary   REAL  │ gross_eosb     REAL  │                    │   │
│  │  allowances_h   REAL  │ daily_rate     REAL  │                    │   │
│  │  allowances_t   REAL  │ years_service  REAL  │                    │   │
│  │  start_date     TEXT  │ termination    TEXT  │                    │   │
│  │  end_date       TEXT  │                      │                    │   │
│  │  contract_type  TEXT  │                      │                    │   │
│  │  jurisdiction   TEXT  │                      │                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Template selector** | Choose between 4 document templates (UAE/KSA contract, settlement, privacy notice) |
| **Visual mapping grid** | Each template field (blueprint) with its source table and column |
| **Drag-and-drop** | Admins can drag column names from source panel into template field rows |
| **Formula builder** | For calculated fields like `total_salary = basic_salary + allowances_housing + allowances_transport` |
| **Validation status** | ✅ mapped, ⚠️ missing/warning, ❌ error |
| **Live preview** | Render sample employee data through current mapping |
| **Source panel** | All available database columns organized by table, searchable |
| **Version control** | Mapping config is versioned alongside templates |

### Mapping Rules Engine

| Rule Type | Example | UI Control |
|-----------|---------|------------|
| **Direct field** | `{{employee_name}}` = `employees.first_name` + `last_name` | Dropdown + concat options |
| **Formula** | `{{total_salary}}` = `basic_salary + housing + transport` | Formula builder with + - × ÷ |
| **Conditional** | If jurisdiction=KSA, use `total_salary`; if UAE, use `basic_salary` for EOSB | Conditional logic builder |
| **Config lookup** | `{{employer_name}}` = `config.company_name` | Table/dropdown selector |
| **Static value** | `{{contract_date}}` = current date | Auto-fill or manual override |

---

## 5. Schema & Data Flow

### 5.1 Entity Relationships

```
┌──────────────┐        ┌─────────────────┐        ┌──────────────────┐
│  employees   │◄───────│ consent_records  │        │ breach_register  │
│──────────────│  1:N   │─────────────────│        │──────────────────│
│ id           │        │ id              │        │ id               │
│ first_name   │        │ employee_id     │        │ detected_at      │
│ last_name    │        │ consent_type    │        │ notified_at      │
│ nationality  │        │ lawful_basis    │        │ regulator        │
│ basic_salary │        │ granted_at      │        │ affected_count   │
│ total_salary │        │ revoked_at      │        │ data_categories  │
│ jurisdiction │        │ ip_address      │        │ description      │
│ ...          │        │ consent_version │        │ remedial_actions │
└──────────────┘        │ consent_items   │        │ status           │
         │              └─────────────────┘        └──────────────────┘
         │                       │
         │              ┌────────┴──────────┐
         │              │                   │
         ▼              ▼                   ▼
┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐
│ template_map │  │ data_subject_    │  │ eosb_calculations  │
│              │  │ requests         │  │                    │
│──────────────│  │──────────────────│  │────────────────────│
│ id           │  │ id               │  │ id                 │
│ template_id  │  │ employee_id      │  │ employee_id        │
│ field_name   │  │ request_type     │  │ jurisdiction       │
│ source_table │  │ status           │  │ net_eosb           │
│ source_field │  │ requested_at     │  │ gross_eosb         │
│ formula      │  │ completed_at     │  │ ...               │
│ created_at   │  │ response_summary │  └────────────────────┘
└──────────────┘  └──────────────────┘
```

### 5.2 Data Flow Diagram

```
HR Employee Actions                    Admin/DPO Actions                    Regulatory
───────────────────                    ────────────────                    ──────────
                                       
Onboarding Consent ──► consent_records ──► Consent Audit Trail ──► Export for audit
                                       
                                       Breach Event ──► breach_register ──► 72h SDAIA/UAE
                                                            │                Notification
                                                            ▼
                                                     Individual Notification
                                       
Employee DSR ──► data_subject_requests ──► DSR Dashboard ──► SLA Tracking
                  ▲                    │                    │
                  │                    ▼                    ▼
                  └───────── Response ──── Complete / Reject / Hold
                                       
                                       Template Mapping ──► template_map ──► Document
                                       Config (admin)          │            Generation
                                                                ▼
                                                         UAE/KSA Contract
                                                         Settlement Statement
                                                         Privacy Notice
```

---

## 6. Implementation Notes

### Priority Matrix

| Feature | Priority | Complexity | Dependencies |
|---------|----------|------------|-------------|
| Consent Audit Trail | P0 | Low | `consent_records` table |
| Breach Register | P0 | Medium | `breach_register` table, notification templates |
| DSR Management | P1 | Medium | `data_subject_requests` table, email integration |
| Template Mapping Tool | P1 | High | `templates` config, field mapping engine |

### Key States

| State | Consent Audit | Breach Register | DSR Management | Template Mapping |
|-------|--------------|-----------------|----------------|------------------|
| **Loading** | Skeleton table | Skeleton + count cards | Skeleton table | Skeleton grid |
| **Empty** | "No consent records yet. Consent is captured during onboarding." | "No breaches logged. Maintain this register for compliance." | "No DSR requests yet." | "No mappings configured. Select a template to begin." |
| **Error** | "Could not load consent records. Retry." | "Could not load breach register." | "Could not load DSR requests." | "Could not load template mapping." |
| **Edge: Large volume** | Pagination (50/page) + date range filter | Pagination + severity filter | Pagination + status filter | N/A (config, not data) |

### Component Tree (React)

```
ComplianceAuditPage
├── ConsentAuditSection
│   ├── ConsentSummaryCards (active | pending | revoked)
│   ├── VersionTracker + ReConsentButton
│   ├── ConsentTable (searchable, filterable, paginated)
│   └── ConsentDetailDrawer (expandable row)
├── BreachRegisterSection
│   ├── BreachSummaryCards (open | investigating | resolved)
│   ├── BreachTimelineAlert (72h countdown)
│   ├── BreachTable (searchable, filterable)
│   ├── BreachDetailPanel (with notification buttons)
│   └── NewBreachModal
│       ├── DescriptionForm
│       ├── DataCategoriesSelector
│       ├── AffectedCountInput
│       └── NotifyCheckboxes (regulator, individuals)
├── DSRManagementSection
│   ├── DSRSummaryCards (open | progress | completed | overdue)
│   ├── DSRTable (with type icons, SLA indicators)
│   ├── DSRDetailPanel (timeline, action checklist)
│   └── NewDSRModal
└── TemplateMappingSection
    ├── TemplateSelector (4 templates)
    ├── MappingGrid (add/remove/update field mappings)
    ├── SourceFieldPanel (searchable columns by table)
    ├── FormulaBuilder (for calculated fields)
    ├── LivePreviewPanel (render sample)
    └── ValidationButton
```

---

*Version 1.0 — Product Designer, Antum | June 2026*