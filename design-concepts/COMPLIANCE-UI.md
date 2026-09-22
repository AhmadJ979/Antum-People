# Antum People — Compliance & EOSB Management UI Design

> **Based on:** GCC Compliance Requirements Report (compliance-expert)
> **Brand Alignment:** Antum Identity — Deep Teal `#0F766E`, Inter font, slate card system
> **Jurisdictions:** UAE & KSA

---

## Table of Contents

1. [Compliance Overview Dashboard](#1-compliance-overview-dashboard)
2. [EOSB Calculator UI](#2-eosb-calculator-ui)
3. [Privacy Consent Step (Onboarding)](#3-privacy-consent-step)
4. [Brand Alignment Notes](#4-brand-alignment-notes)
5. [Implementation Notes](#5-implementation-notes)

---

## 1. Compliance Overview Dashboard

### Layout & Navigation

The Compliance Dashboard lives as a tab within the main Analytics section (sidebar nav: `Dashboard > Compliance`). It provides GCC HR leaders with a single-pane view of their regulatory health.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Antum People Logo]  Dashboard > Compliance                  [🇦🇪 UAE] [🇸🇦 KSA]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌──────────────────────────────────────────────────────────────────────┐    │
│ │  📋 LOCALISATION TARGETS                  [Quarter: Q2 2026]        │    │
│ ├──────────────────────────────────────────────────────────────────────┤    │
│ │                                                                      │    │
│ │  UAE — Emiratisation                    KSA — Saudization (Nitaqat) │    │
│ │  ┌─────────────────────────────┐        ┌─────────────────────────┐  │    │
│ │  │ Current: 34 / Required: 42 │        │ Band:  Medium Green     │  │    │
│ │  │ ████████████████████████░░ │        │ Saudi: 28 / Total: 120  │  │    │
│ │  │ 81% — 8 more needed       │        │ ████████████████████░░   │  │    │
│ │  │ 🟡 2 months until review  │        │ 23% — Premium target: 25%│  │    │
│ │  └─────────────────────────────┘        └─────────────────────────┘  │    │
│ │                                                                      │    │
│ │  [📥 Download Nafis Report]  [📥 Download Nitaqat Report]           │    │
│ └──────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│ ┌────────────────────────────┐  ┌────────────────────────────┐             │
│ │  🛂 VISA & IQAMA STATUS   │  │  🔐 PDPL CONSENT COVERAGE  │             │
│ ├────────────────────────────┤  ├────────────────────────────┤             │
│ │                           │  │                            │             │
│ │ Expiring This Month:   5  │  │ UAE PDPL Compliance        │             │
│ │ Expiring Next Month:   8  │  │ ████████████████████ 92%   │             │
│ │ Total Active:         68  │  │ Active consents:    112     │             │
│ │                           │  │ Pending consents:   8       │             │
│ │ 🔴 3 expired (action)    │  │ Revoked:            3       │             │
│ │ 🟡 5 renewing in 14d    │  │                            │             │
│ │ 🟢 60 within valid term  │  │ KSA PDPL Compliance        │             │
│ │                           │  │ ██████████████████░░ 78%  │             │
│ │ [View All Expiries →]    │  │ Active consents:    52     │             │
│ │                           │  │ Pending:            15    │             │
│ └────────────────────────────┘  └────────────────────────────┘             │
│                                                                             │
│ ┌──────────────────────────────────────────────────────────────────────┐    │
│ │  ⚠️ COMPLIANCE ALERTS                                    [Dismiss]  │    │
│ ├──────────────────────────────────────────────────────────────────────┤    │
│ │ 🔴 | 3 employees with expired visas — action required within 30 days│    │
│ │ 🟡 | Emiratisation target may be missed — 8 hires needed in 2 months│    │
│ │ 🟡 | 5 KSA employees missing Iqama renewal — 14 days to deadline   │    │
│ │ 🟢 | No data breach incidents this quarter                         │    │
│ │ ℹ️  | New privacy notice v2.1 available — 45 employees need re-consent │    │
│ └──────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Design Specifications

| Component | Description | Tailwind Mapping | Color |
|-----------|-------------|------------------|-------|
| **Page header** | Breadcrumb: Dashboard > Compliance + jurisdiction pills | `text-sm text-slate-500` / pills `rounded-full px-4 py-1.5 text-xs font-semibold` | Slate |
| **Localisation card** | Dual-pane UAE/KSA nationalisation targets | `bg-white shadow-sm rounded-xl p-5 border border-slate-100` | White |
| **Progress bars** | % of target achieved, color-coded by status | `h-3 rounded-full` with `bg-teal-500`, `bg-amber-400`, or `bg-red-500` fill | Teal/Amber/Red |
| **Visa/Iqama card** | Summary with counts + color-coded status badges | Three-category list with colored dot indicators | Green/Amber/Red dots |
| **Consent card** | Per-jurisdiction compliance % + stats table | Donut ring concept (CSS circle with stroke) or simple bar + table | Teal for compliant |
| **Alerts panel** | Stacked alert items with severity icons | Space-y-2, each item with severity icon + text + timestamp | Per severity |

### Color Semantics

| Metric | Green (🟢) | Amber (🟡) | Red (🔴) |
|--------|-----------|------------|----------|
| Quota target | ≥85% met | 70-84% | <70% |
| Visa/Iqama expiry | >30 days valid | 1-30 days | Expired |
| Consent coverage | ≥90% | 75-89% | <75% |

### Interactive Behaviors

| Element | Behavior |
|---------|----------|
| Jurisdiction pills | Toggle between UAE-only, KSA-only, or both views |
| Progress bars | Hover → tooltip: "34 of 42 Emirati employees (81%)" |
| Count badges (🔴3) | Click → filter employee list to that segment |
| Alert items | Click → navigate to relevant action workflow |
| Download buttons | Generate PDF from Nafis/Nitaqat data |
| "View All Expiries" | Drill into full visa/Iqama lifecycle view |

### Data Sources

| Metric | Source |
|--------|--------|
| Emiratisation count | `employees WHERE jurisdiction='UAE' AND emirati_flag=1` |
| Saudization count | `employees WHERE jurisdiction='KSA' AND nationality='Saudi'` |
| Nitaqat band | `employees.nitaqat_band` (aggregated) |
| Visa expiries | `employees.visa_expiry_date` |
| Iqama expiries | `employees.iqama_expiry_date` |
| Consent stats | `consent_records GROUP BY jurisdiction, status` |

---

## 2. EOSB Calculator UI

### 2.1 Access Points

The EOSB Calculator can be opened from:
- **Employee profile** → "Calculate EOSB" button (visible during offboarding)
- **Transitions** → Offboarding checklist → Step "Calculate Settlement"
- **Dashboard** → Compliance Overview → EOSB Liability card → "View details"

### 2.2 UAE EOSB Calculator View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  💰 End-of-Service Benefit Calculator                [🇦🇪 UAE] [🇸🇦 KSA]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Employee: Ahmed Al Mansouri (EMP-042)                                     │
│  Department: Engineering                      Role: Senior Developer       │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  EMPLOYEE DETAILS                                [Edit]            │     │
│  ├────────────────────────────────────────────────────────────────────┤     │
│  │                                                                     │     │
│  │  Start Date:      15 Mar 2022     (4 years 3 months)               │     │
│  │  End Date:        30 Jun 2026     (Notice: 30 days)                │     │
│  │  Basic Salary:    AED 18,000                                       │     │
│  │  Unpaid Leave:    0 days (>90 excluded from EOSB)                  │     │
│  │  Termination:     ✦ Employer Initiated    💼 Resignation            │     │
│  │  Governing Law:   UAE Labour Law (Federal Decree-Law No.33)        │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  📊 EOSB CALCULATION BREAKDOWN                  [Recalculate]      │     │
│  ├────────────────────────────────────────────────────────────────────┤     │
│  │                                                                     │     │
│  │  Daily Rate           AED 18,000 ÷ 30 =  AED 600/day              │     │
│  │  Years of Service     4 years 3 months =  4.25 years              │     │
│  │                                                                     │     │
│  │  Tiers Applied:                                                     │     │
│  │  ┌──────────────────────────────────────────────────────────┐      │     │
│  │  │ Tier 1 (1-5 yrs): 21 days × AED 600 × 4.25 years        │      │     │
│  │  │                =  **AED 53,550**                         │      │     │
│  │  │ Since < 5 years: No Tier 2 applied                      │      │     │
│  │  │ Cap check: 53,550 vs (730 × 600 = AED 438,000) ✅       │      │     │
│  │  └──────────────────────────────────────────────────────────┘      │     │
│  │                                                                     │     │
│  │  ⚠️ Resignation (4.25 yrs: 3-5 yr bracket → 2/3 entitlement)       │     │
│  │                                                                     │     │
│  │  ┌────────────────────────────────────────────────────┐            │     │
│  │  │  GROSS EOSB                  AED 53,550            │            │     │
│  │  │  Resignation Adjustment     -AED 17,850 (-33.3%)  │            │     │
│  │  │  ─────────────────────────────────                 │            │     │
│  │  │  **NET EOSB ENTITLEMENT**    **AED 35,700**       │            │     │
│  │  └────────────────────────────────────────────────────┘            │     │
│  │                                                                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  📋 FINAL SETTLEMENT SUMMARY                                       │     │
│  ├────────────────────────────────────────────────────────────────────┤     │
│  │                                                                     │     │
│  │  Item                    │ Amount          │ Notes                 │     │
│  │  ─────────────────────────────────────────────────────────          │     │
│  │  Accrued Leave (15d)     │ AED 9,000      │ 15d × AED 600         │     │
│  │  Notice Pay              │ AED 18,000     │ 1 month basic (served)│     │
│  │  End-of-Service Benefit  │ AED 35,700     │ As calculated above   │     │
│  │  ─────────────────────────────────────────                          │     │
│  │  **TOTAL SETTLEMENT**    │ **AED 62,700** │ Due within 14 days    │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  [📄 Generate Settlement Statement]  [⏳ Schedule Payment (14d deadline)]   │
│                                                                             │
│  ℹ️  Final settlement must be paid within 14 days of termination (UAE law) │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 KSA EOSB Calculator View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  💰 End-of-Service Benefit Calculator                [🇦🇪 UAE] [🇸🇦 KSA]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Employee: Omar Al Ghamdi (EMP-089)                                        │
│  Department: Sales                            Role: Regional Manager       │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  EMPLOYEE DETAILS                                [Edit]            │     │
│  ├────────────────────────────────────────────────────────────────────┤     │
│  │                                                                     │     │
│  │  Start Date:         10 Jan 2015     (11 years 5 months)           │     │
│  │  End Date:           15 Jun 2026     (Notice: 60 days)             │     │
│  │  Total Salary:       SAR 22,000 (basic + housing + transport)      │     │
│  │  Proper Notice:      ✅ Yes (full entitlement)                     │     │
│  │  Governing Law:      KSA Labour Law (Royal Decree M/51)            │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  ⚠️ KSA uses TOTAL salary (all allowances included)               │     │
│  ├────────────────────────────────────────────────────────────────────┤     │
│  │                                                                     │     │
│  │  Monthly Rate        SAR 22,000 (total salary = basic + allowances)│     │
│  │  Years of Service    11 years 5 months = 11.42 years              │     │
│  │  Eligibility:        From day one (pro-rata) ✅                  │     │
│  │                                                                     │     │
│  │  Accrual (Art. 84):                                               │     │
│  │  ┌──────────────────────────────────────────────────────────┐      │     │
│  │  │ First 5 yrs:  0.5 × SAR 22,000 × 5.0 yrs              │      │     │
│  │  │           =  SAR 55,000                                 │      │     │
│  │  │                                                          │      │     │
│  │  │ Years 6+:    1.0 × SAR 22,000 × 6.42 yrs              │      │     │
│  │  │           =  SAR 141,240                                │      │     │
│  │  └──────────────────────────────────────────────────────────┘      │     │
│  │                                                                     │     │
│  │  Proper notice given → Full entitlement (no 50% reduction) ✅       │     │
│  │                                                                     │     │
│  │  ┌────────────────────────────────────────────────────┐            │     │
│  │  │  GROSS EOSB                 SAR 126,573             │            │     │
│  │  │  Notice Penalty             SAR 0 (deduction: 0%) │            │     │
│  │  │  ─────────────────────────────────                 │            │     │
│  │  │  **NET EOSB ENTITLEMENT**   **SAR 126,573**        │            │     │
│  │  └────────────────────────────────────────────────────┘            │     │
│  │                                                                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  📋 FINAL SETTLEMENT SUMMARY                                       │     │
│  ├────────────────────────────────────────────────────────────────────┤     │
│  │                                                                     │     │
│  │  Item                    │ Amount          │ Notes                 │     │
│  │  ─────────────────────────────────────────────────────────          │     │
│  │  Accrued Leave (10d)     │ SAR 7,333      │ 10d × SAR 733         │     │
│  │  Notice Pay              │ SAR 22,000     │ 1 month (served)      │     │
│  │  End-of-Service Benefit  │ SAR 126,573    │ As calculated above   │     │
│  │  ─────────────────────────────────────────                          │     │
│  │  **TOTAL SETTLEMENT**    │ **SAR 155,906**│ Due within 7 days     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  [📄 Generate Settlement Statement]  [⏳ Schedule Payment (7d deadline)]    │
│                                                                             │
│  ℹ️  Final settlement must be paid within 7 days of termination (KSA law)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Dual-Jurisdiction Comparison View

For employees who have worked across both UAE and KSA entities:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📊 CROSS-JURISDICTION COMPARISON                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Employee served in both UAE (3 yrs) and KSA (8 yrs). Each calculated      │
│  separately under its governing law.                                       │
│                                                                             │
│  ┌────────────────────────────┐  ┌────────────────────────────┐            │
│  │  🇦🇪 UAE (3 yrs service)   │  │  🇸🇦 KSA (8 yrs service)   │            │
│  ├────────────────────────────┤  ├────────────────────────────┤            │
│  │                           │  │                            │            │
│  │ Salary Basis:  Basic      │  │ Salary Basis:  Total       │            │
│  │ Threshold:     1 year     │  │ Threshold:     None       │            │
│  │ Daily Rate:    AED 600    │  │ Monthly Rate:  SAR 22,000  │            │
│  │                           │  │                            │            │
│  │ Gross:         AED 37,800 │  │ Yrs 0-5:       SAR 55,000  │            │
│  │ Resign Adj:    -33.3%     │  │ Yrs 5-8:       SAR 66,000  │            │
│  │                           │  │ No notice pen  SAR 0       │            │
│  │ **Net:**       **AED 25,200**│  │**Net:**       **SAR 95,333** │            │
│  └────────────────────────────┘  └────────────────────────────┘            │
│                                                                             │
│  ℹ️  Each entity processes settlement independently per local law.         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.5 EOSB Calculator Visual Semantics

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Gross EOSB value | Slate 900 | `#0F172A` | Pre-adjustment total |
| Deduction line | Amber | `#F59E0B` | Resignation/penalty deductions |
| Net EOSB value | Deep Teal | `#0F766E` | Final entitlement (highlighted) |
| Legal info bar | Sky Blue | `#3B82F6` | Deadline reminders & disclaimers |
| Missing notice warning | Coral Red | `#EF4444` | "No proper notice → 50% reduction" |

---

## 3. Privacy Consent Step

### 3.1 Location in Onboarding Wizard

The Privacy Consent step appears in the onboarding flow:
```
Step 1: Employee Details → Step 2: Contract Info → Step 3: Privacy Consent → Step 4: Onboarding Tasks
```

### 3.2 Bilingual Privacy Consent UI (Arabic/English)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Antum People Logo]  Onboarding > Privacy Consent  [🌐 English] [🌐 العربية] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Employee: Sarah Ahmed — Engineering                           Step 3 of 4 │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  📋 DATA PRIVACY CONSENT — UAE PDPL                               │     │
│  ├────────────────────────────────────────────────────────────────────┤     │
│  │                                                                     │     │
│  │  ┌── EN (English) ─────────────────────────────────────────┐       │     │
│  │  │                                                         │       │     │
│  │  │  DATA PRIVACY NOTICE                                    │       │     │
│  │  │  ====================                                   │       │     │
│  │  │                                                         │       │     │
│  │  │  Company:      Acme Tech FZ-LLC                        │       │     │
│  │  │  Controller:   HR Department                            │       │     │
│  │  │  Jurisdiction: UAE PDPL (Fed. Decree-Law No.45/2021)    │       │     │
│  │  │                                                         │       │     │
│  │  │  We collect and process your personal data for:         │       │     │
│  │  │                                                         │       │     │
│  │  │  ✓ Employment admin (contractual necessity)             │       │     │
│  │  │  ✓ Payroll & benefits processing                        │       │     │
│  │  │  ✓ Workforce analytics (legitimate interest)            │       │     │
│  │  │  ✓ UAE Labour Law compliance                            │       │     │
│  │  │  ☐ Marketing comms (consent required)                   │       │     │
│  │  │                                                         │       │     │
│  │  │  Data collected: name, contact, passport, Emirates ID,  │       │     │
│  │  │  salary, bank details, employment history, performance  │       │     │
│  │  │                                                         │       │     │
│  │  │  Retention: 5 years post-termination                   │       │     │
│  │  │  Rights: Access | Rectify | Erase | Port | Restrict    │       │     │
│  │  │  Transfers: Within UAE only                            │       │     │
│  │  └─────────────────────────────────────────────────────────┘       │     │
│  │                                                                     │     │
│  │  ┌── AR (العربية) ─────────────────────────────────────────┐       │     │
│  │  │                                                        │       │     │
│  │  │             إشعار الخصوصية                              │       │     │
│  │  │             ==============                              │       │     │
│  │  │                                                        │       │     │
│  │  │  الشركة: أكمة تك    |  بيانات التحكم: قسم الموارد البشرية  │       │     │
│  │  │                                                        │       │     │
│  │  │  نقوم بجمع ومعالجة بياناتك الشخصية للأغراض التالية:     │       │     │
│  │  │                                                        │       │     │
│  │  │  ✓ إدارة التوظيف (ضرورة تعاقدية)                       │       │     │
│  │  │  ✓ معالجة الرواتب والمزايا                              │       │     │
│  │  │  ✓ تحليلات القوى العاملة (مصلحة مشروعة)                 │       │     │
│  │  │  ✓ الامتثال لقانون العمل الإماراتي                       │       │     │
│  │  │  ☐ الاتصالات التسويقية (يتطلب الموافقة)                │       │     │
│  │  │                                                        │       │     │
│  │  │  فترة الاحتفاظ: 5 سنوات بعد انتهاء الخدمة              │       │     │
│  │  │  الحقوق: الوصول | التصحيح | المسح | النقل | التقييد    │       │     │
│  │  └─────────────────────────────────────────────────────────┘       │     │
│  │                                                                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  CONSENT ACKNOWLEDGMENT                                            │     │
│  ├────────────────────────────────────────────────────────────────────┤     │
│  │                                                                     │     │
│  │  ☐ I have read and understood the above Privacy Notice.            │     │
│  │    لقد قرأت وفهمت إشعار الخصوصية أعلاه                              │     │
│  │                                                                     │     │
│  │  ☐ I consent to the processing of my personal data for the         │     │
│  │    purposes described in this notice.                               │     │
│  │    أوافق على معالجة بياناتي الشخصية للأغراض المذكورة في هذا الإشعار │     │
│  │                                                                     │     │
│  │  ☐ I consent to receive marketing communications (optional)        │     │
│  │    أوافق على تلقي الاتصالات التسويقية (اختياري)                     │     │
│  │                                                                     │     │
│  │  [✍ Sign Here]  [🖱 E-Sign]  [📄 Download PDF Copy]                │     │
│  │                                                                     │     │
│  │  Signed at: [Dubai, UAE] on [15 June 2026] at [10:30 AM GST]       │     │
│  │  IP Address: 192.168.x.x    Consent Version: v2.1 (June 2026)      │     │
│  │                                                                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  [← Back: Contract Info]                          [Next: Onboarding →]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 KSA-Specific Variations

When jurisdiction is KSA, the Privacy Consent step adjusts:

| Aspect | KSA Variation |
|--------|---------------|
| **Header** | "KSA PDPL (Royal Decree M/148)" |
| **Arabic position** | Arabic panel appears FIRST (top), English second — reflecting KSA's primacy of Arabic |
| **Lawful basis** | All processing must be tagged with explicit KSA lawful bases |
| **DPO Contact** | Mandatory DPO details displayed (name, email, phone) |
| **Complaint right** | Must include: "You may lodge a complaint with SDAIA/NDMO" |
| **Consent version** | Separate version tracking for KSA PDPL v1.0 |

### 3.4 Consent Record After Submission

On submission, the system records in `consent_records`:

```json
{
  "id": "c7f3a2b1-...",
  "employee_id": "emp-042",
  "consent_type": "data_privacy",
  "lawful_basis": "consent, contractual_necessity, legal_obligation, legitimate_interest",
  "granted_at": "2026-06-15T10:30:00+04:00",
  "ip_address": "192.168.1.100",
  "consent_version": "v2.1",
  "jurisdiction": "UAE",
  "consent_items": {
    "employment_admin": true,
    "payroll_processing": true,
    "workforce_analytics": true,
    "compliance": true,
    "marketing": false
  }
}
```

---

## 4. Brand Alignment Notes

All three interfaces (Compliance Dashboard, EOSB Calculator, Privacy Consent) are aligned with the Antum brand system defined in `BRAND-IDENTITY.md`:

| Brand Element | Application |
|---------------|-------------|
| **Deep Teal `#0F766E`** | Primary CTAs, NET EOSB values, progress fills, consent checkmarks |
| **Teal `#14B8A6`** | Interactive elements, active jurisdiction tabs, hover states |
| **Inter font** | All UI copy — English and Arabic (Inter Arabic variant) |
| **Card system** | White cards (`bg-white shadow-sm rounded-xl border border-slate-100`) |
| **Slate 900 / Slate 600** | Primary and secondary text hierarchy |
| **Amber / Red semantics** | Warnings, deductions, risks (unchanged from brand system) |
| **Sky Blue `#3B82F6`** | Legal info bars, disclaimers, help tooltips |

### Arabic Support Requirements

1. **RTL Layout**: Consent step supports `dir="rtl"` for Arabic-priority view (KSA)
2. **Dual-column**: Arabic and English panels side by side or tabbed
3. **Font**: Use `'Inter Arabic', 'Inter', sans-serif` for Arabic text
4. **Date formats**: Hijri dates optional alongside Gregorian for KSA

---

## 5. Implementation Notes

### Priority Matrix (per compliance expert recommendations)

| Feature | Priority | Implementation Complexity |
|---------|----------|--------------------------|
| Compliance Overview Dashboard | P1 | Medium — new page, data aggregation queries |
| EOSB Calculator (UAE + KSA) | P0 | High — dual calculation engine, audit trail |
| Privacy Consent Step | P0 | Medium — bilingual UI, consent_records integration |
| Settlement Statement Generation | P0 | Low — PDF generation from template |
| Dual-Jurisdiction Comparison | P2 | Medium — split service periods |

### Key States

| State | Handling |
|-------|----------|
| **Loading** | Skeleton cards with pulse animation (Tailwind `animate-pulse`) |
| **Empty** | "No offboarding employees yet" or "No visa expiries this month" with illustration |
| **Error** | "Failed to load EOSB calculation. Please verify employee data." with retry button |
| **Edge: <1yr service** | EOSB calculator shows: "UAE requires 1 year of service; KSA pro-rates from day one" |
| **Edge: Summary dismissal** | EOSB calculator shows: "EOSB forfeited — summary dismissal under Article 44/80" |

### Component Tree (React)

```
CompliancePage
├── JurisdictionTabs (UAE | KSA | Both)
├── LocalisationCard
│   ├── EmiratisationPane
│   │   ├── ProgressBar (emirati_count / target)
│   │   └── ActionButton (Download Nafis Report)
│   └── SaudizationPane
│       ├── NitaqatBadge
│       ├── ProgressBar (saudi_count / total)
│       └── ActionButton (Download Nitaqat Report)
├── VisaIqamaCard
│   ├── StatusSummary (expired, renewing, valid counts)
│   └── EmployeeListLink
├── ConsentCoverageCard
│   ├── JurisdictionConsentRing (UAE %)
│   └── JurisdictionConsentRing (KSA %)
└── ComplianceAlertsPanel
    └── AlertItem[] (severity, message, action)

EOSBCalculator
├── JurisdictionToggle (UAE | KSA)
├── EmployeeSummaryCard
├── CalculationBreakdown
│   ├── DailyRateDisplay
│   ├── YearsOfServiceDisplay
│   ├── TierBreakdown[]
│   ├── AdjustmentLine (resignation/notice)
│   └── NetEntitlement (highlighted)
├── FinalSettlementTable
└── ActionButtons (Generate PDF, Schedule Payment)

PrivacyConsentStep
├── LanguageToggle (English | العربية)
├── PrivacyNoticePanel
│   ├── EnglishNotice
│   └── ArabicNotice
├── ConsentCheckboxes (bilingual labels)
├── SignatureMethod (Type | E-Sign | Download)
└── MetadataFooter (IP, version, timestamp)
```

---

*Version 1.0 — Product Designer, Antum | June 2026*
