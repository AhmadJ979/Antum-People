# VantageHR — User Journey Maps

## Overview
These journey maps define the **onboarding** and **offboarding** workflows specifically identifying **strategic data capture points** where intelligence (cost-per-hire, retention drivers, sentiment) is gathered naturally — without creating administrative burden.

---

# ONBOARDING JOURNEY

## Persona: HR Manager at a 500-employee UAE tech company
**Primary User:** HR Operations Specialist / People Ops Manager
**Secondary Users:** Hiring Manager, IT Admin, New Employee

## Journey Stages

### Stage 1: Pre-Arrival (Days -14 to -1)

| Step | User Action | System Touchpoint | Strategic Data Captured | UX Consideration |
|------|-------------|-------------------|------------------------|------------------|
| 1.1 | HR initiates onboarding from recruitment handoff | "New Hire" form in VantageHR | **Recruitment Cost** (agency fees, internal sourcing cost, referral bonus) | ✨ **Auto-populate from ATS integration** — HR fills one field not five |
| 1.2 | HR enters salary, role, department | Employee profile creation | **Salary benchmark data** (for cost-per-hire + workforce economics) | ✨ **Market range tooltip** shows GCC percentile |
| 1.3 | HR selects manager & team | Manager selection dropdown | **Manager assignment** (for retention analysis by manager) | ✨ **Type-ahead search** for large orgs |
| 1.4 | System auto-generates onboarding task checklist | Onboarding tasks generated | **Task categories** (compliance, equipment, training, productivity) | ✨ **Milestone markers** ("Time-to-Value") appear automatically |

### Stage 2: First Week (Days 1-7)

| Step | User Action | System Touchpoint | Strategic Data Captured | UX Consideration |
|------|-------------|-------------------|------------------------|------------------|
| 2.1 | IT admin marks equipment & access as complete | Task status updates | **Equipment provisioning time** (benchmark for TTV) | ✨ **Bulk complete** for IT tasks — one click, not per-task |
| 2.2 | New employee attends onboarding session | Training task completion | **Training completion velocity** (predictor of early retention) | ✨ **Optional sentiment emoji** at bottom of task — quick pulse check |
| 2.3 | Manager marks "first checkpoint" complete | Milestone task marked | **First milestone TTV data point** | ✨ **Manager gets a prompt** "How's the new hire settling in?" with 1-tap response |

### Stage 3: Ramp-Up (Days 8-90)

| Step | User Action | System Touchpoint | Strategic Data Captured | UX Consideration |
|------|-------------|-------------------|------------------------|------------------|
| 3.1 | Manager marks "fully productive" milestone | Employee status → `active` | **Time-to-Value** (days from start to fully productive) | ✨ **NPS-lite prompt**: "On a scale of 1-5, how well-prepared was the employee?" |
| 3.2 | 30/60/90 day check-in | Analytics metrics capture | **Satisfaction score, early performance rating** | ✨ **Inline in Slack/email** — no login required for lightweight check-ins |

### Strategic Data Capture Points (Onboarding)
1. **Recruitment cost** captured at new-hire creation (single field, auto-populated where possible)
2. **Salary** captured for workforce economics benchmarking
3. **Manager assignment** for retention-by-manager analytics
4. **Time-to-Value** via milestone task completions and the "fully productive" date
5. **Early sentiment** via optional emoji/NPS prompts at key milestones

---

# OFFBOARDING JOURNEY

## Persona: HR Manager offboarding a departing employee

### Stage 1: Departure Initiation

| Step | User Action | System Touchpoint | Strategic Data Captured | UX Consideration |
|------|-------------|-------------------|------------------------|------------------|
| 1.1 | HR receives notice (resignation/termination) | Employee status → `offboarding` | **Departure type** (voluntary / involuntary) | ✨ **One-click status change** from employee list |
| 1.2 | HR enters end date | End date field | **Notice period compliance** (UAE/KSA labor law check) | ✨ **Auto-validate** against GCC labor law minimum notice periods |
| 1.3 | System auto-generates offboarding tasks | Offboarding checklist created | **Task types** (IT revocation, exit interview, admin, hardware) | ✨ **GCC-specific defaults** (EOSB calc, visa cancellation, emirates ID return) |

### Stage 2: Exit Interview (Strategic Intelligence Goldmine)

| Step | User Action | System Touchpoint | Strategic Data Captured | UX Consideration |
|------|-------------|-------------------|------------------------|------------------|
| 2.1 | HR conducts exit interview | Exit interview form | **Departure reason** (categorized: comp, career, management, personal, involuntary) | ✨ **Structured dropdown** + optional free text — guides but doesn't force |
| 2.2 | HR rates preventability | Preventable flag (Y/N) | **Preventable departure flag** (key retention metric) | ✨ **Conditional follow-up**: "What could have prevented this?" appears only if "Yes" |
| 2.3 | HR captures satisfaction score | 1-5 scale | **Satisfaction score** (correlated with retention health) | ✨ **Emoji scale** for warmth (😞 😐 🙂 😊 🤩) |
| 2.4 | HR enters destination employer/salary | Text + number fields | **Competitor intelligence**, **market salary delta** | ✨ **Auto-suggest known competitors** in GCC market |
| 2.5 | HR logs detailed feedback | Free text area | **Qualitative attrition insights** | ✨ **Smart prompt**: "What was the #1 reason they'd have stayed?" |

### Stage 3: Exit Processing

| Step | User Action | System Touchpoint | Strategic Data Captured | UX Consideration |
|------|-------------|-------------------|------------------------|------------------|
| 3.1 | IT admin revokes access | Task completion | **System deprovisioning time** (security compliance metric) | ✨ **Bulk IT revocation** — one click per system category |
| 3.2 | HR processes EOSB calculation | Auto-calculated by system | **EOSB liability amount** (workforce economics) | ✨ **Visual breakdown**: Years of service × base salary calculation |
| 3.3 | HR finalizes termination | Employee status → `terminated` | **Final retention metric** (tenure length, cost-to-date) | ✨ **Summary card**: "Employee contributed X months at Y cost" |

### Strategic Data Capture Points (Offboarding)
1. **Departure reason** (categorized) — the single most important retention metric
2. **Preventability assessment** — distinguishes unavoidable from actionable churn
3. **Exit satisfaction score** — correlates with employer brand health
4. **Destination employer & salary** — competitive intelligence and market rate gaps
5. **EOSB liability** — financial impact calculation per departure
6. **Tenure calculation** — retention cohort analysis

---

## UX Design Principles across Both Journeys

| Principle | Application |
|-----------|-------------|
| **Friction disappears** | Strategic data fields are pre-populated, auto-calculated, or use structured inputs — never blank text boxes for critical data |
| **Contextual nudges** | Mini-prompts ("How was their ramp-up?") appear at natural moments, not as separate tasks |
| **Progress visibility** | Visual progress bars on onboarding/offboarding give HR leaders at-a-glance status |
| **Compliance confidence** | UAE/KSA labor law validations (notice periods, EOSB, visa steps) appear inline as green checkmarks |
| **Data feeds intelligence** | Every field captured is mapped to a dashboard KPI — nothing is collected "just in case" |

---

## Data-to-Intelligence Flow Diagram

```
                 ONBOARDING                              OFFBOARDING
                     |                                        |
    ┌────────────────┼────────────────┐       ┌───────────────┼───────────────┐
    ↓                ↓                ↓       ↓               ↓               ↓
recruitment_cost   salary         ttv_date  departure_reason preventable   new_salary
    ↓                ↓                ↓       ↓               ↓               ↓
┌────────┐     ┌─────────┐     ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐
│Cost-per│     │Workforce│     │ Time-to- │ │Attrition│ │Retention │ │Market Rate   │
│-Hire   │     │Economics│     │  Value   │ │ Drivers │ │Health    │ │Intelligence   │
└────────┘     └─────────┘     └──────────┘ └─────────┘ └──────────┘ └──────────────┘
    ↓                ↓                ↓            ↓           ↓              ↓
              ┌─────────────────────────────────────────────────────┐
              │           WORKFORCE INTELLIGENCE DASHBOARD          │
              │  Retention Lift  •  Cost-per-Hire  •  TTV  •  EOSB │
              └─────────────────────────────────────────────────────┘
```

---

*Version 1.0 — Product Designer, VantageHR*
