# Antum People — Intelligence Dashboard & Bilingual Reporting UI Design

> **Author:** Product Designer
> **Date:** September 2026
> **Base Design:** [BRAND-IDENTITY.md](./BRAND-IDENTITY.md) · [DASHBOARD-WIREFRAMES.md](./DASHBOARD-WIREFRAMES.md)
> **Prototype:** [intelligence-dashboard-prototype.html](./intelligence-dashboard-prototype.html)

---

## Table of Contents
1. [Design Goals](#1-design-goals)
2. [Leadership View — Intelligence Dashboard](#2-leadership-view--intelligence-dashboard)
3. [KPI Cards](#3-kpi-cards)
4. [Retention Lift — 1-Year Cohort](#4-retention-lift--1-year-cohort)
5. [Time-to-Value](#5-time-to-value)
6. [EOSB Liability Forecasting (GCC)](#6-eosb-liability-forecasting-gcc)
7. [Bilingual EN/AR RTL Switching](#7-bilingual-enar-rtl-switching)
8. [Schema & Data Mapping](#8-schema--data-mapping)
9. [Implementation Notes](#9-implementation-notes)

---

## 1. Design Goals

The **Leadership View** answers three executive questions in a single glance, tuned for GCC mid-market CHROs and CFOs:

1. **Are we keeping people longer?** → Retention Lift (1-year cohort)
2. **Are new hires productive faster?** → Time-to-Value (days to full productivity)
3. **What is our end-of-service exposure?** → EOSB Liability forecast across UAE/KSA

**Bilingual reporting is a first-class requirement, not a translation layer.** The entire surface mirrors RTL, swaps numerals and currencies, and reflows typography for Arabic — with a single EN/AR toggle that persists per session.

**Design principles applied:**
- **Clarity over density** — 4 KPI cards max, each chart answers one question.
- **GCC-first** — DD/MM/YYYY, AED/SAR, Arabic-Indic numerals optional, RTL-native.
- **Actionable insight** — every chart carries a one-line "so what" caption.
- **Trust through transparency** — data-freshness timestamp + jurisdiction basis shown on EOSB figures.

---

## 2. Leadership View — Intelligence Dashboard

### Location
Top-level route: `Dashboard > Intelligence` (default landing view for leadership-tier seats).

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ● Antum People   Intelligence Dashboard                                            │
│ ▸ Executive          [ EN ▾ | العربية ]   [Reporting: AED ▾]  [AE+SA ▾] [Q3 2026 ▾]│
│ ▸ Workforce Economics                                                           │
│ ▸ Retention                                                                    │
│ ▸ Time-to-Value                                                                │
│ ▸ EOSB Liability                                                               │
│ ▸ Compliance        (leadership-tier)                                          │
│                                                                                │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  HEADER ROW                                                                     │
│  Intelligence Dashboard                    Last refreshed: 06 Sep 2026, 09:00   │
│                                                                                │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌─────────────────────┐ │
│  │ RETENTION LIFT│ │ TIME-TO-VALUE │ │ COST-PER-HIRE │ │ EOSB LIABILITY      │ │
│  │ (1-yr cohort) │ │ (days)        │ │ (vs market)   │ │ (12-mo forecast)    │ │
│  │               │ │               │ │               │ │                     │ │
│  │  +4.2%        │ │  12.4 d       │ │  AED 18,200   │ │  AED 6.3M           │ │
│  │  ▲ +1.1 pts   │ │  ▼ -2.6 d     │ │  ▼ -8%        │ │  ▲ +12% QoQ         │ │
│  │  vs 2025      │ │  target 15 d  │ │  vs benchmark │ │  AE 3.1 · SA 3.2    │ │
│  └───────────────┘ └───────────────┘ └───────────────┘ └─────────────────────┘ │
│                                                                                │
│  ┌──────────────────────────────────────┐ ┌──────────────────────────────────┐ │
│  │ Retention Lift — 1-Yr Cohort         │ │ Time-to-Value Trend              │ │
│  │ [Grouped bars: cohort vs benchmark]  │ │ [Line: avg days to productivity] │ │
│  │                                      │ │                                  │ │
│  │  H1'25  ████ 84%  ▓▓ 80%             │ │  20 ─╮                           │ │
│  │  H2'25  ██████ 89% ▓▓ 81%            │ │  15 ──╯─╮    ╭── 12.4            │ │
│  │  H1'26  ████████ 93% ▓▓ 83%          │ │  10 ─────╯────╯                  │ │
│  │         (cohort)  (benchmark)        │ │   5 ─────────────────            │ │
│  │                                      │ │      Q1    Q2    Q3    Q4        │ │
│  │  ▸ Lift = cohort − benchmark          │ │  ▸ Onboarding bottleneck: IT     │ │
│  └──────────────────────────────────────┘ └──────────────────────────────────┘ │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ EOSB Liability Forecast — by Jurisdiction & Quarter (AED, consolidated)   │  │
│  │ [Stacked bar: UAE (basic-salary basis) + KSA (total-salary basis)]        │  │
│  │                                                                          │  │
│  │  3.0M ─            ┌───┐                                                  │  │
│  │  2.0M ─       ┌───┐│▓▓▓│┌───┐    ┌───┐                                     │  │
│  │  1.0M ─  ┌───┐│▓▓▓││▓▓▓││▓▓▓│ ┌──│▓▓▓│  ██ UAE   ▓▓ KSA                 │  │
│  │  0.0M ─  └───┘└───┘└───┘└───┘ │  └───┘                                    │  │
│  │          Q3'26   Q4'26   Q1'27  Q2'27                                      │  │
│  │                                                                          │  │
│  │  ▸ KSA Q1'27 spike driven by 3 end-of-contract exits + notice compensation     │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  ┌───────────────────────────────┐ ┌────────────────────────────────────────┐  │
│  │ EOSB Basis (jurisdiction)     │ │ Retention Risk Watchlist               │  │
│  │ ┌───────────────────────────┐ │ │                                        │  │
│  │ │ 🇦🇪 UAE  · basic salary    │ │ │ 🔴 Sales — 22% turnover (>15% limit)   │  │
│  │ │   AED 3.1M accrued (451)  │ │ │ 🟡 3 preventable exits this quarter     │  │
│  │ │ 🇸🇦 KSA  · total salary    │ │ │ 🟡 Engineering — 4 high-flight-risk    │  │
│  │ │   SAR 3.2M accrued (298)  │ │ │    employees (career-growth signal)     │  │
│  │ └───────────────────────────┘ │ │                                        │  │
│  └───────────────────────────────┘ └────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. KPI Cards

| KPI | Value | Delta | Basis / Source | Colour rule |
|-----|-------|-------|----------------|-------------|
| **Retention Lift** (1-yr cohort) | +4.2% | ▲ +1.1 pts YoY | cohort retention − market benchmark | Green if ≥ +3pts, amber +1–3, red < +1 |
| **Time-to-Value** | 12.4 d | ▼ -2.6 d vs 15 d target | `start_date → fully_productive_date` | Green if ≤ target, amber within +25%, red above |
| **Cost-per-Hire** | AED 18,200 | ▼ -8% vs market | `recruitment_cost` + onboarding cost | Green if ≤ market, amber +0–15%, red > +15% |
| **EOSB Liability** | AED 6.3M | ▲ +12% QoQ | sum of `eosb_calculations.net_amount` + accruals | Red if rising QoQ (cash-flow risk), amber flat, green falling |

### Card anatomy
- **Micro label** (11px, uppercase, tracking-wide, slate-500)
- **KPI value** (36px, 700, slate-900)
- **Delta line** (14px, semi-bold, green/amber/red + arrow glyph)
- **Context footnote** (12px, slate-400) — e.g. "AE 3.1 · SA 3.2"
- Click → drill into dedicated sub-view (Retention / TTV / Workforce Economics / EOSB).

---

## 4. Retention Lift — 1-Year Cohort

**Metric:** `cohort_1yr_retention − benchmark_1yr_retention`, grouped by hire half-year.

```
Retention Lift — 1-Yr Cohort
┌────────────────────────────────────────────────────────────────────────────┐
│ Cohort    │ Hires │ 1-Yr Retention │ Benchmark │ Lift  │ Trend            │
│───────────┼───────┼────────────────┼───────────┼───────┼──────────────────│
│ H1 2025   │  142  │      84%       │    80%    │ +4.0% │ ──               │
│ H2 2025   │  118  │      89%       │    81%    │ +8.0% │ ▲▲               │
│ H1 2026   │   96  │      93%*      │    83%    │ +10%* │ ▲▲  (*projected) │
└────────────────────────────────────────────────────────────────────────────┘
▸ So what: retention lift doubled in 3 cohorts — correlate with the new
  30-day onboarding checkpoint introduced H1 2026.
```

**Filtering:** department, jurisdiction (AE/SA), manager. **Projection:** dotted bar + asterisk for in-flight cohorts (H1 2026 not yet past 1-year).

---

## 5. Time-to-Value

**Metric:** median/mean of `fully_productive_date − start_date` in days, per department, against a configurable target (default 15 days).

```
Time-to-Value
┌────────────────────────────────────────────────────────────────────────────┐
│ Department   │ Avg TTV │ Target │ Over/Under │ Bottleneck                  │
│──────────────┼─────────┼────────┼────────────┼─────────────────────────────│
│ Engineering  │  18.2 d │  15 d  │  +3.2 d 🔴 │ IT access (5.2d, 12% overdue)│
│ Sales        │   8.4 d │  15 d  │  -6.6 d 🟢 │ ─                            │
│ Marketing    │  14.1 d │  15 d  │  -0.9 d 🟢 │ ─                            │
│ Operations   │  10.7 d │  15 d  │  -4.3 d 🟢 │ ─                            │
└────────────────────────────────────────────────────────────────────────────┘
▸ So what: Engineering is the only dept over target; auto-assign IT
  provisioning to clear the 5.2-day access bottleneck.
```

**Bottleneck drill:** task-level list sourced from `onboarding_tasks` (task, avg days, overdue %, flag).

---

## 6. EOSB Liability Forecasting (GCC)

**Metric:** projected end-of-service payout across jurisdictions, consolidated to a selectable reporting currency (AED default; SAR/USD supported).

**Two calculation bases must be visible together** because GCC law differs:
- **UAE (AE)** → accrues on **basic salary** only; tiered resignation discount (1–3y ⅓, 3–5y ⅔, 5y+ full); min 1 yr service.
- **KSA (SA)** → accrues on **total salary** (incl. allowances); half-month per year first 5y, full month after; pro-rated from day one; no resignation reduction.

```
EOSB Liability Forecast — by Jurisdiction & Quarter
┌────────────────────────────────────────────────────────────────────────────┐
│ Quarter │ 🇦🇪 UAE (basic) │ 🇸🇦 KSA (total) │ Combined (AED) │ Δ QoQ        │
│─────────┼────────────────┼────────────────┼────────────────┼──────────────│
│ Q3 2026 │  AED 1.9M      │  SAR 2.1M→AED 2.1M │ AED 4.0M    │  baseline    │
│ Q4 2026 │  AED 2.1M      │  SAR 1.8M→AED 1.8M │ AED 3.9M    │  -2% ▾       │
│ Q1 2027 │  AED 2.4M      │  SAR 2.6M→AED 2.6M │ AED 5.0M    │  +28% ▴ 🔴   │
│ Q2 2027 │  AED 2.2M      │  SAR 2.2M→AED 2.2M │ AED 4.4M    │  -12% ▾      │
└────────────────────────────────────────────────────────────────────────────┘
(1 SAR ≈ 1.00 AED at pegged/approximate rate — show FX note in footer)
▸ So what: Q1'27 liability spikes +28% on 3 KSA end-of-contract exits;
  pre-fund AED 1.1M before 31 Dec 2026 to smooth cash flow.
```

### Liability waterfall (drill-down)
```
EOSB Waterfall — Q1 2027 (AED)
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  5.5M ─                                ┌───┐                               │
│  5.0M ─                     ┌───┐      │+0.4│┌───┐                          │
│  4.5M ─          ┌───┐      │+0.8│┌───┐│KSA ││5.0│                          │
│  4.0M ─  ┌───┐   │+0.6│┌───┐│+0.4││+1.0│┌───┐│UAE │                          │
│          │3.9│   │notice││EOSB││EOSB││leave││  ││ │                          │
│          │base│   │penalty││grow││grow││encash││ ││ │                          │
│  ────────┴───┴───┴─────┴───┴───┴─────┴───┴───┴────────────────────────────── │
│   Q4'26   + notice  + UAE   + KSA   + leave  + FX   = Q1'27 forecast         │
│   close   penalties  accrual accrual encash    adj.                          │
└────────────────────────────────────────────────────────────────────────────┘
```

**Sources:** `eosb_calculations` (actual payouts, `net_amount`, `formula_used`, `jurisdiction`) + `employees.eosb_accrued` (unfunded accrual) + `employees.termination_type` (to anticipate upcoming exits).

---

## 7. Bilingual EN/AR RTL Switching

The same toggle pattern as the consent flow: a pill segmented control `EN ▾ | العربية`. One switch flips the entire surface.

### 7.1 What flips on AR
| Aspect | English (LTR) | Arabic (RTL) |
|--------|---------------|--------------|
| Direction | `dir="ltr"` | `dir="rtl"` |
| Sidebar | Left | Right (mirrored) |
| Text alignment | Left | Right |
| Icon order | icon → label | label → icon (flipped) |
| Numerals | Western `4.2`, `١` off | Arabic-Indic `٤٫٢` (optional toggle) |
| Currency | `AED 6,300,000` | `٦٬٣٠٠٬٠٠٠ د.إ` |
| Dates | `06/09/2026` | `٠٦/٠٩/٢٠٢٦` |
| Font | Inter | Inter Arabic (or Tajawal/IBM Plex Sans Arabic) |
| Chart axes | Left-to-right | Right-to-left (categories reversed) |

### 7.2 RTL layout mirroring
```
LTR (EN)                              RTL (AR)
┌─────────────────────────┐           ┌─────────────────────────┐
│ ● Antum People   [EN|عربية]│           │ ● Antum People   [عربية|EN]│
│ ┌──────┐                │           │                ┌──────┐ │
│ │ Side │   Content      │    →      │   Content      │ Side │ │
│ │ bar  │                │           │                │ bar  │ │
│ └──────┘                │           │                └──────┘ │
└─────────────────────────┘           └─────────────────────────┘
```

### 7.3 Localization tokens (not raw strings)
| Token | EN | AR |
|-------|----|----|
| `kpi.retention_lift` | Retention Lift | رفع معدل الاحتفاظ |
| `kpi.time_to_value` | Time-to-Value | الوقت حتى الإنتاجية |
| `kpi.cost_per_hire` | Cost-per-Hire | تكلفة التوظيف |
| `kpi.eosb_liability` | EOSB Liability | التزامات نهاية الخدمة |
| `jurisdiction.ae` | UAE | الإمارات |
| `jurisdiction.sa` | KSA | السعودية |
| `chart.retention.cohort` | Cohort | المجموعة |
| `chart.retention.benchmark` | Benchmark | المعيار |

### 7.4 Arabic numeral & currency rules
- Default: keep Western digits in AR (common in GCC business dashboards) but **offer** an Arabic-Indic toggle.
- Currency symbol placement: postfix in Arabic (`٣٫١ مليون د.إ`), prefix in English (`AED 3.1M`).
- Use **short scale** in AR: `مليون` (million), `مليار` (billion) — never "M"/"B".

---

## 8. Schema & Data Mapping

| Dashboard element | Source table.field | Notes |
|-------------------|--------------------|-------|
| Retention Lift (cohort) | `employees.start_date`, `employees.end_date`, `employees.status`; `analytics_metrics` (`metric_type='retention_lift'`) | Cohort = hire half-year; benchmark from market dataset |
| Time-to-Value | `employees.start_date`, `employees.fully_productive_date`; `onboarding_tasks` | TTV = `fully_productive_date − start_date` |
| Cost-per-Hire | `employees.recruitment_cost` (+ onboarding cost) | vs market benchmark |
| EOSB Liability | `eosb_calculations` (`jurisdiction`, `basic_salary`, `total_salary`, `net_amount`, `accrued_amount`, `formula_used`); `employees.eosb_accrued`, `employees.termination_type` | UAE = basic basis; KSA = total basis |
| Retention risk watchlist | `employees.department`, `employees.status`; `exit_interviews` | turnover % vs threshold |

### 8.1 Suggested `analytics_metrics.metric_type` vocabulary
| metric_type | value semantics | text |
|-------------|-----------------|------|
| `retention_lift_1yr` | lift % (REAL) | cohort + benchmark label |
| `time_to_value_days` | avg days (REAL) | department |
| `cost_per_hire` | AED (REAL) | department |
| `eosb_liability_forecast` | AED (REAL) | jurisdiction + quarter |

---

## 9. Implementation Notes

### 9.1 Component tree (React)
```
IntelligenceDashboard
├── DashboardHeader
│   ├── LanguageToggle (EN | العربية)          ← sets dir + locale
│   ├── ReportingCurrencySelect (AED/SAR/USD)
│   ├── JurisdictionFilter (All/AE/SA)
│   └── PeriodSelect (Q3 2026)
├── KpiRow
│   ├── KpiCard (RetentionLift, TimeToValue, CostPerHire, EosbLiability)
├── ChartGrid
│   ├── RetentionCohortChart (grouped bars + benchmark)
│   ├── TimeToValueTrendChart (line)
│   ├── EosbLiabilityStackedBar (by jurisdiction + quarter)
│   └── EosbBasisPanel (UAE basic vs KSA total)
└── RetentionRiskWatchlist
```

### 9.2 Localization architecture
- Use `react-i18next` (or native `Intl`) with `dir` + `lang` attributes on `<html>`.
- Store `locale` preference per user in `config` / session; default EN, KSA-tenants default AR.
- Charts re-render on locale change (reversed category order for RTL).
- Number formatting via `Intl.NumberFormat(locale, { style:'currency', currency })`; Arabic-Indic via `numberingSystem: 'arab'` option.

### 9.3 Key states
| State | Behaviour |
|-------|-----------|
| Loading | Skeleton KPI cards + chart placeholders |
| Empty | "No cohort data yet — onboarding begins capturing from day one." |
| Error | Inline retry per card, not a full-page block |
| Large volume | Server-side aggregation; client receives pre-computed series |

### 9.4 Accessibility
- Language toggle is `role="tablist"` with `aria-pressed`; never a `<select>` for two options.
- RTL: ensure `lang="ar"` on root so screen readers switch pronunciation.
- Colour is never the sole signal — deltas carry ▲/▼ glyphs and a text label.

---

*Version 1.0 — Product Designer, Antum*
