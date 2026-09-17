# Antum People — Interactive Privacy Consent & Template UI Design Specs

> **Author:** Product Designer
> **Date:** June 2026
> **Prototype:** [/home/team/shared/design-concepts/interactive-consent-prototype.html](../interactive-consent-prototype.html)
> **Base Design:** [COMPLIANCE-UI.md](./COMPLIANCE-UI.md)

---

## 1. Language Toggle — States & Transitions

### 1.1 Toggle Anatomy

The language toggle is a pill-style segmented control with two options: **English** and **العربية**.

```
┌─────────────────────┐
│ 🇬🇧 English │ 🇸🇦 العربية │
└─────────────────────┘
    ↑ Active          ↑ Inactive
    white bg          transparent
    teal text         slate-600 text
    box-shadow        no shadow
```

### 1.2 State Matrix

| State | English Tab | Arabic Tab | Content Behavior |
|-------|-------------|------------|------------------|
| **Default (EN)** | Active: white bg, teal `#0F766E`, shadow | Inactive: transparent, slate-600 `#475569` | LTR direction. English privacy notice shown |
| **Arabic (AR)** | Inactive | Active: white bg, teal, shadow | RTL direction. Arabic privacy notice shown |
| **Hover (on inactive)** | Light blue `#DBEAFE`, dark blue `#0369A1` | Grey bg `#E2E8F0` | Hovered tab previews its language |
| **Disabled (submitted)** | Grey bg `#E2E8F0`, slate-400 text | Grey bg, slate-400 text | Both at 40% opacity. `pointer-events: none` |
| **KSA mode** | Appears second | Appears FIRST (left) | Arabic shown as primary language per KSA PDPL |

### 1.3 Transition Specs

| Property | Value |
|----------|-------|
| Animation | `all 0.15s ease` |
| Active bg transition | Transparent → white |
| Group bg | `#F1F5F9` (slate-100) |
| Border radius (group) | 8px |
| Border radius (buttons) | 6px |
| Padding (buttons) | 6px 16px |

---

## 2. Consent Checkboxes — States

### 2.1 Checkbox Anatomy

```
┌──────────────────────────────────────────────────┐
│ [✓] I have read and understood...               │
│     Required for onboarding to proceed           │
└──────────────────────────────────────────────────┘
   ↑ custom      ↑ Label text (13px, slate-700)
   checkbox      ↑ Subtitle (11px, slate-400)
   18×18px
```

### 2.2 State Matrix

| State | Checkbox Visual | Background | Cursor | Behavior |
|-------|----------------|------------|--------|----------|
| **Unchecked** | 2px slate-400 border, empty | Transparent | Pointer | Click → checked |
| **Checked** | Teal `#0F766E` fill + white ✓ | Transparent | Pointer | Click → unchecked |
| **Hover** | Border darkens to slate-600 | Slate-50 `#F8FAFC` | Pointer | Subtle bg highlight |
| **Error** | Red `#EF4444` border + red bg | Red-50 `#FEF2F2` + 1px red border | Pointer | Red label text. "⚠ This field is required" |
| **Disabled / Locked** | Greyed out at 50% opacity | 50% opacity | Not-allowed | "Submitted on 15 June 2026 at 10:30 AM" |
| **Indeterminate** (mixed group) | Teal `#14B8A6` fill + "–" | Transparent | Pointer | Used for "select all" |

### 2.3 Validation Logic

```javascript
function validateConsent() {
  const requiredChecked = document.querySelectorAll('[data-required].checked');
  if (requiredChecked.length < 2) {
    showError("Please accept the Privacy Notice and data processing consent to continue.");
    return false;
  }
  return true;
}
```

---

## 3. E-Signature Component — States

### 3.1 Method Selection

Two signature methods are available, displayed as selectable cards:

```
┌─────────────────────────┐  ┌─────────────────────────┐
│ ⌨️ Type Signature       │  │ ✍️ Draw Signature       │
│ Type your full name     │  │ Sign with mouse/touch   │
│ [____________________]  │  │ [✍️ Click to sign here] │
│ Preview: Sarah Ahmed    │  │ [Clear] [Accept ✓]      │
└─────────────────────────┘  └─────────────────────────┘
    ↑ Selected (teal border)    ↑ Unselected (slate border)
```

### 3.2 State Matrix

| State | Type Method | Draw Method | Shared |
|-------|-------------|-------------|--------|
| **Unselected** | 2px slate-200 border | 2px slate-200 border | Grey icon bg |
| **Selected** | 2px teal-deep border, teal-light bg | Same | Teal icon bg |
| **Empty** | Dashed input area. Placeholder: "Type your full name" | Canvas placeholder: "Click and drag to sign here" | Both disabled |
| **Active input** | Focus: bottom border turns teal. Cursive preview live | Canvas captures path. Crosshair cursor | Only one method can be active |
| **Completed** | Green border `#22C55E` | Green border | Green status bar shown below |

### 3.3 Data Captured on Completion

| Field | Source | Example |
|-------|--------|---------|
| `signer_name` | Type input or canvas image | "Sarah Ahmed" |
| `signature_method` | Selected method | "type" or "draw" |
| `signed_at` | System timestamp | "2026-06-15T10:30:00+04:00" |
| `ip_address` | Request IP | "192.168.1.100" |
| `consent_version` | Current version | "v2.1" |
| `signature_data` | Text or base64 canvas | "Sarah Ahmed" / data:image/png;base64,... |

---

## 4. Template Data Mapping — Field Injection

### 4.1 Architecture

```
┌──────────────────────────────────────────────┐
│                Employee Data                  │
│  ┌────────────────────────────────────────┐  │
│  │  employees table                       │  │
│  │  ├─ first_name, last_name               │  │
│  │  ├─ email, nationality, passport        │  │
│  │  ├─ basic_salary, total_salary          │  │
│  │  ├─ start_date, end_date                │  │
│  │  ├─ jurisdiction, contract_type         │  │
│  │  └─ ...                                 │  │
│  └────────────────────────────────────────┘  │
│                     ↓                          │
│  ┌────────────────────────────────────────┐  │
│  │         Template Engine                 │  │
│  │  Replaces {{field}} with actual data   │  │
│  └────────────────────────────────────────┘  │
│         ↓            ↓            ↓           │
│  ┌────────┐  ┌────────┐  ┌────────────┐      │
│  │UAE     │  │KSA     │  │Settlement  │      │
│  │Contract│  │Contract│  │Statement   │      │
│  └────────┘  └────────┘  └────────────┘      │
└──────────────────────────────────────────────┘
```

### 4.2 Field → Template Mapping

#### UAE Employment Contract (`uae-employment-contract.md`)

| Template Field | Data Source | Example Value |
|---------------|-------------|---------------|
| `{{employee_name}}` | `employees.first_name` + `last_name` | "Sarah Ahmed" |
| `{{nationality}}` | `employees.nationality` | "Emirati" |
| `{{passport_number}}` | `employees.passport_number` | "AB1234567" |
| `{{emirates_id}}` | `employees.emirates_id` | "784-1999-1234567-1" |
| `{{date_of_birth}}` | `employees.date_of_birth` | "15 Mar 1997" |
| `{{job_title}}` | `employees.role` | "Senior Developer" |
| `{{department}}` | `employees.department` | "Engineering" |
| `{{start_date}}` | `employees.start_date` | "15 Mar 2022" |
| `{{contract_type}}` | `employees.contract_type` | "Fixed-Term (3 years)" |
| `{{probation_end_date}}` | `employees.probation_end_date` | "14 Sep 2022" |
| `{{basic_salary}}` | `employees.basic_salary` | "AED 18,000" |
| `{{housing_allowance}}` | `employees.allowances_housing` | "AED 6,000" |
| `{{transport_allowance}}` | `employees.allowances_transport` | "AED 2,000" |
| `{{total_salary}}` | (calculated: basic + allowances) | "AED 28,000" |

#### KSA Employment Contract (`ksa-employment-contract.md`)

| Template Field | Data Source | Example Value |
|---------------|-------------|---------------|
| `{{employee_name}}` | `employees.first_name` + `last_name` | "Omar Al Ghamdi" |
| `{{nationality}}` | `employees.nationality` | "Saudi" |
| `{{iqama_number}}` | `employees.iqama_number` | "2XXXXXXXXXXXX" |
| `{{job_title}}` | `employees.role` | "Regional Manager" |
| `{{start_date}}` | `employees.start_date` | "10 Jan 2015" |
| `{{total_salary}}` | `employees.total_salary` | "SAR 22,000" |
| `{{nitaqat_band}}` | `employees.nitaqat_band` | "Medium Green" |
| `{{qiwa_reference}}` | `employees.qiwa_reference` | "Q-2024-123456" |

#### Final Settlement Statement (`final-settlement-statement.md`)

| Template Field | Data Source | Example Value |
|---------------|-------------|---------------|
| `{{employee_name}}` | `employees.name` | "Sarah Ahmed" |
| `{{accrued_leave_days}}` | `employees.accrued_leave_days` | 15 |
| `{{daily_rate}}` | (basic_salary / 30) | AED 600 |
| `{{accrued_leave_amount}}` | `accrued_leave_days × daily_rate` | AED 9,000 |
| `{{notice_pay}}` | `employees.notice_period_basic` | AED 18,000 |
| `{{net_eosb}}` | `eosb_calculations.net_eosb` | AED 35,700 |
| `{{total_settlement}}` | (accrued + notice + eosb) | AED 62,700 |

### 4.3 Field Status Indicators

| Status | Color | Meaning |
|--------|-------|---------|
| **Filled** (`filled`) | Green bg #DCFCE7 | Data exists and ready to inject |
| **Pending** (`pending`) | Slate-100, dashed border | Field exists but data not yet entered |
| **Missing** (`empty`) | Red bg #FEF2F2 | Critical missing data — document can't be generated |
| **Calculated** | Blue bg #DBEAFE | Value derived from formula, not direct input |

---

## 5. Consent Flow — Full User Journey

### 5.1 Step Progression

```
Step 1                    Step 2                    Step 3                    Step 4
Employee Details          Contract Info             Privacy Consent           Onboarding Tasks
┌──────────┐     →     ┌──────────┐     →     ┌──────────┐     →     ┌──────────┐
│ ○ ○ ○ ●  │           │ ○ ○ ○ ●  │           │ ● ○ ○ ○  │           │ ○ ○ ○ ○  │
└──────────┘           └──────────┘           └──────────┘           └──────────┘
                                                ↑ ACTIVE
```

### 5.2 Consent Step Sub-Flow

```
Consent Step Entry
       │
       ▼
┌──────────────────┐
│ 1. Read Notice   │ ← Language toggle (EN/AR)
│    EN + AR panels│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 2. Accept Check- │ ← Checkbox interactions
│    boxes         │    Validation on blur
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 3. Sign          │ ← Choose method
│    Type / Draw    │    Enter / Sign
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 4. Confirm &     │ ← Review summary
│    Submit        │    "I acknowledge..."
└────────┬─────────┘
         │
         ▼
    ┌──────────┐
    │  SUCCESS  │ ← Green confirmation
    │  ✓ Consent│    Redirect to Step 4
    │  recorded │
    └──────────┘
```

### 5.3 Consent Record (Database Entry)

```json
{
  "id": "c7f3a2b1-4d5e-6f78-9abc-def012345678",
  "employee_id": "emp-042",
  "consent_type": "data_privacy",
  "lawful_basis": "consent, contractual_necessity, legal_obligation, legitimate_interest",
  "granted_at": "2026-06-15T10:30:00+04:00",
  "ip_address": "192.168.1.100",
  "consent_version": "v2.1",
  "jurisdiction": "UAE",
  "language": "en",
  "signature_method": "type",
  "consent_items": {
    "read_understood": true,
    "processing_consent": true,
    "marketing_consent": false
  }
}
```

---

## 6. Implementation Checklist

| Component | Priority | Files to Create | Dependencies |
|-----------|----------|----------------|-------------|
| Language Toggle | P0 | `ConsentLanguageToggle.tsx` | React state for lang, CSS variables |
| Consent Checkbox | P0 | `ConsentCheckbox.tsx` | Shared checkbox component with states |
| E-Signature | P0 | `ESignaturePad.tsx`, `TypeSignature.tsx` | Canvas API or library |
| Template Engine | P0 | `TemplateRenderer.tsx` | Mustache.js or custom template syntax |
| Mapping UI | P1 | `TemplateDataMapping.tsx` | Field-source relationship data |

---

*Version 1.0 — Product Designer, Antum | June 2026*