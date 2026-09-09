# VantageHR — Workforce Intelligence Dashboard Wireframes

## Dashboard Architecture

The dashboard follows a **hierarchy of insight** approach:
1. **Executive Summary** (top row: 4 headline KPIs)
2. **Trend Analysis** (middle: charts & cohorts)
3. **Actionable Lists** (bottom: drill-down tables & alerts)

---

## Page 1: Executive Dashboard (Home)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [VantageHR Logo]  Dashboard │ Employees │ Transitions │ Analytics  [👤]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ ▲ 89%    │  │ 12 days  │  │ $4,250   │  │ AED 2.1M │                   │
│  │ Retention│  │ Time-to  │  │ Cost-per │  │ EOSB     │                   │
│  │ Lift     │  │ -Value   │  │ -Hire    │  │ Liability│                   │
│  │ +4.2% YoY│  │ -1.5d vs│  │ -8% vs   │  │ +3 new   │                   │
│  │          │  │ target   │  │ Q1 avg   │  │ offboard │                   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                   │
│                                                                             │
│  ┌────────────────────────────┐  ┌────────────────────────────┐            │
│  │ Retention by Department    │  │ Time-to-Value Trend        │            │
│  │ [Horizontal Bar Chart]     │  │ [Line Chart — last 6 mo]   │            │
│  │                            │  │                            │            │
│  │ Engineering      ████ 92% │  │  ╱╲                          │            │
│  │ Sales            ███  78% │  │ ╱  ╲    ╱╲                   │            │
│  │ Marketing        █████96% │  │╱    ╲  ╱  ╲    ╱╲            │            │
│  │ Operations       ████ 88% │  │      ╲╱    ╲  ╱  ╲          │            │
│  │ Finance          █████94% │  │            ╲╱    ╲╲         │            │
│  └────────────────────────────┘  └────────────────────────────┘            │
│                                                                             │
│  ┌────────────────────────────────────────────────────────┐                 │
│  │ Recent Onboarding Activity                             │                 │
│  │                                                        │                 │
│  │ 🟢 Sarah Ahmed — Engineering — Day 14 — 4/6 tasks 👍   │                 │
│  │ 🟢 Omar Hassan — Sales — Day 7 — 2/6 tasks             │                 │
│  │ 🟡 Layla Khalid — Marketing — Day 21 — TTV expected D28│                 │
│  └────────────────────────────────────────────────────────┘                 │
│                                                                             │
│  ┌────────────────────────────────────────────────────────┐                 │
│  │ Attrition Alerts                                       │                 │
│  │                                                        │                 │
│  │ 🔴 Sales dept turnover at 22% — above threshold of 15% │                 │
│  │ 🟡 3 preventable departures this quarter — review      │                 │
│  └────────────────────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Page 2: Workforce Economics View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [VantageHR Logo]  Dashboard > Workforce Economics           [Export] [PDF] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────┐  ┌────────────────────────────┐            │
│  │ Cost-per-Hire Breakdown    │  │ Total Workforce Cost       │            │
│  │ [Donut Chart]              │  │ [Stacked Area Chart]       │            │
│  │                            │  │                            │            │
│  │    ┌──┐                    │  │ ╱╲    ╱╲    ╱╲             │            │
│  │    │  │ Recruitment 54%   │  │╱  ╲  ╱  ╲  ╱  ╲            │            │
│  │    │  │ Onboarding   22%  │  │   ╲╱    ╲╱    ╲              │            │
│  │    │  │ Equipment    16%  │  │          Salaries           │            │
│  │    └──┘ Other         8%  │  │          Benefits           │            │
│  └────────────────────────────┘  └────────────────────────────┘            │
│                                                                             │
│  Cost-per-Hire by Department                          ▲ = above market avg │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │ Department    │ Avg Cost │ Headcount │ Vs. Market │ Trend        │       │
│  ├──────────────────────────────────────────────────────────────────┤       │
│  │ Engineering   │ $6,200 ▲ │    42     │ +12%       │ ↑ 3% QoQ     │       │
│  │ Sales         │ $3,800   │    28     │ -5%        │ ↓ 2% QoQ     │       │
│  │ Marketing     │ $4,100   │    15     │ -2%        │ → Stable     │       │
│  │ Operations    │ $2,900   │    22     │ -8%        │ ↓ 1% QoQ     │       │
│  │ Finance       │ $4,800 ▲ │    10     │ +6%        │ ↑ 5% QoQ     │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  End-of-Service Liability Forecast                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Projected EOSB by Quarter                                            │    │
│  │ [Bar Chart]                                                         │    │
│  │                                                                     │    │
│  │  AED ██ 2.1M ████████████████████  Q3 2026                         │    │
│  │  AED ██ 1.8M ████████████████      Q4 2026                         │    │
│  │  AED ██ 2.4M ████████████████████████  Q1 2027                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Page 3: Retention Analytics View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [VantageHR Logo]  Dashboard > Retention Analytics       [Filter: Q2 2026]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────┐  ┌────────────────────────────┐            │
│  │ Retention Lift by Cohort   │  │ Attrition Drivers          │            │
│  │ [Grouped Bar Chart]        │  │ [Horizontal Bar]           │            │
│  │                            │  │                            │            │
│  │ H1 2025 ████████ 85%      │  │ Career Growth ██████████ 34%│            │
│  │ H2 2025 ██████████ 91%    │  │ Compensation ████████ 28%  │            │
│  │ H1 2026 ████████████ 94%  │  │ Management   ██████ 20%    │            │
│  │                            │  │ Personal     ████ 12%     │            │
│  │                            │  │ Involuntary  ██ 6%        │            │
│  └────────────────────────────┘  └────────────────────────────┘            │
│                                                                             │
│  Preventable Departures — Heatmap by Manager                                │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │            │ Q1 2026 │ Q2 2026 │ Change │ Risk Level             │       │
│  ├──────────────────────────────────────────────────────────────────┤       │
│  │ Ahmed R.   │    2    │    3    │  +50%  │ 🔴 High               │       │
│  │ Sara L.    │    1    │    0    │  -100% │ 🟢 Low                │       │
│  │ James M.   │    1    │    1    │  —     │ 🟡 Medium             │       │
│  │ Fatima A.  │    0    │    0    │  —     │ 🟢 Low                │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  ☐ Send Retention Alert to Ahmed R.'s Manager                               │
│                                                                             │
│  Departure Reason Breakdown (Last 12 Months)                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ [Pie Chart]                                                         │    │
│  │                                                                     │    │
│  │    Career Growth (34%) — Most common preventable reason             │    │
│  │    → Suggestion: Review promotion timelines & L&D budget            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Page 4: Time-to-Value Analytics View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [VantageHR Logo]  Dashboard > Time-to-Value          [Benchmark: Industry] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────┐  ┌────────────────────────────┐            │
│  │ Avg TTV by Department      │  │ TTV vs. Retention          │            │
│  │ [Bar Chart]                │  │ [Scatter Plot]             │            │
│  │                            │  │                            │            │
│  │ Engineering     ██ 18d    │  │ Retention ↑                │            │
│  │ Sales           ██████ 8d │  │  95% ·· ·· ·· ·· ·· ⬤     │            │
│  │ Marketing       ██ 14d    │  │  85% ·· ·· ⬤ ·· ··        │            │
│  │ Operations      ████ 10d  │  │  75% ·· ⬤ ·· ·· ··        │            │
│  │                 │         │  │  65% ⬤ ·· ·· ·· ··        │            │
│  │ Target: 12 days           │  │     5  10  15  20  25  TTV │            │
│  └────────────────────────────┘  └────────────────────────────┘            │
│                                                                             │
│  Onboarding Bottleneck Analysis                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Task                         │ Avg Days │ Overdue │ Bottleneck?     │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │ IT Access Provisioning       │   5.2    │   12%   │ 🔴 Yes          │    │
│  │ Hardware Setup               │   3.8    │   8%    │ 🟡 Moderate     │    │
│  │ Compliance Documents         │   2.1    │   3%    │ 🟢 No           │    │
│  │ First Checkpoint Completion  │   7.4    │   15%   │ 🔴 Yes          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ☐ Auto-assign IT to prioritize provisioning tasks                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Responsive Layout Specifications

| Breakpoint | Layout | Dashboard Behavior |
|------------|--------|--------------------|
| ≥1280px (Desktop) | 4-column KPI row, 2×2 chart grid | Full detail |
| 768-1279px (Tablet) | 2×2 KPI grid, single-column charts | Chart simplification |
| <768px (Mobile) | 1-column vertical stack | Alert-only summaries |

---

## Interactive Elements

| Component | Behavior |
|-----------|----------|
| KPI Cards | Click → drill into detail view for that metric |
| Charts | Hover → tooltip with exact values; click data point → filter dashboard |
| Department bars | Click → filter all downstream views to that department |
| Alerts | Click → navigate to affected employees or actions |
| Export button | Download current view as PDF (for board reporting) |

---

## Design System Integration

Every wireframe component maps to a Tailwind utility class from our brand system:

- **Cards**: `bg-white shadow-sm rounded-xl border border-slate-100 p-4`
- **KPI values**: `text-3xl font-bold text-slate-900`
- **KPI labels**: `text-xs font-semibold uppercase tracking-wider text-slate-500`
- **Delta indicators**: `text-sm font-medium text-green-600` or `text-red-600`
- **Charts**: Use teal (`text-teal-600`) as primary series color
- **Tables**: `text-sm`, alternating `bg-slate-50` rows, sticky headers

---

*Version 1.0 — Product Designer, VantageHR*
