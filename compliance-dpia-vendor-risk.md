# GCC DPIA Framework & Vendor Risk Management

> **Author:** Compliance Expert (Agent)
> **Date:** 2026-09-09
> **Revision:** Brand updated to Antum People on 2026-09-17.
> **Scope:** Data Protection Impact Assessment (DPIA), Vendor (Processor) Risk Management, Data Processing Agreement (DPA), Privacy Maturity scoring
> **Jurisdictions:** UAE (PDPL — Federal Decree-Law No. 45/2021) & KSA (PDPL — Royal Decree M/148)
> **Audience:** Engineering (schema/datastore), Product Design (UX flows), Lead (prioritization)
> **Builds on:** `compliance-requirements.md`, `compliance-audit-enhancement.md`, `templates/*`

---

## Table of Contents

1. [Legal Basis — Cross-Border & Processor Obligations](#1-legal-basis)
2. [DPIA Framework](#2-dpia-framework)
3. [Vendor Risk Ledger (Schema)](#3-vendor-risk-ledger)
4. [Data Processing Agreement (DPA) Template](#4-dpa-template)
5. [Privacy Maturity Scoring Rubric](#5-privacy-maturity-rubric)
6. [Implementation Summary](#6-implementation-summary)

---

## 1. Legal Basis — Cross-Border & Processor Obligations

The two most consequential data-protection risks for Antum are (a) **engagement of third-party processors** (cloud hosting, payroll, insurance, background-check providers) and (b) **cross-border transfers** (Antum People SaaS itself, plus each client's processor ecosystem). Every artifact below is keyed to the following articles.

> **Note on citations:** GCC data protection law is evolving, and article numbering varies slightly between translations. The references below follow the team's established reference set (`compliance-requirements.md`, `compliance-audit-enhancement.md`) and the standard English translations of the two laws. Re-confirm article numbers against the final official English/Arabic text before any formal legal sign-off or client-facing certification claim.

### 1.1 UAE PDPL (Federal Decree-Law No. 45 of 2021)

| Obligation | Article | Requirement | Antum People impact |
|---|---|---|---|
| **Processor obligations** | Art. 7, Art. 8 | Controller must engage processors only under a written contract; processor must act only on the controller's documented instructions, implement security, maintain confidentiality, and assist the controller with compliance. | Every vendor touching employee data needs a DPA + instruction log. |
| **Security of processing** | Art. 11 | Appropriate technical & organisational measures (encryption at rest/in transit, access control, pseudonymisation). | Vendor security questionnaires; attestation of controls. |
| **Data Protection Officer** | Art. 13 | DPO required for high-risk / large-scale / sensitive processing. | Record DPO per client entity; route vendor escalations. |
| **Data subject rights** | Art. 14 | Access, rectification, erasure, restriction, portability, objection. | Vendor must support DSR (export/delete) within SLA. |
| **Breach notification** | Art. 16 | Notify UAE Data Office of breaches (without undue delay; ≤ 72h standard). | Vendor breach notification obligations written into DPA. |
| **Cross-border transfer** | Art. 22, Art. 23 | No transfer outside UAE unless: adequacy determination, **appropriate safeguards** (SCCs/BCRs), or a listed derogation (explicit consent, contract necessity). | Classify each transfer; apply UAE SCCs / adequacy; geo-partition data. |
| **Implementing decision** | Cabinet Decision No. 65/2022 | Operational rules for cross-border transfers (adequacy list, derogations, safeguards). | Configure transfer mechanism per destination country. |

### 1.2 KSA PDPL (Royal Decree M/148, as amended 2023)

| Obligation | Article | Requirement | Antum People impact |
|---|---|---|---|
| **Lawful bases** | Art. 6 | Processing requires a lawful basis (consent, contract necessity, legal obligation, legitimate interest, etc.). | Tag every processing purpose with lawful basis. |
| **Controller obligations** | Art. 7, Art. 10 | Controller must ensure lawful processing; publish a privacy policy in Arabic. | Arabic-first notices; controller register. |
| **Data Protection Officer** | Art. 11 | DPO is **mandatory for all controllers**. | DPO field is required, not optional, for KSA clients. |
| **Data subject rights** | Art. 12–13 (team ref. Art. 17) | Access, correction, **destruction** (explicit right), restriction, portability, objection. | Strong erasure flow (see `compliance-audit-enhancement.md` §4). |
| **Processing record (ROPA)** | Art. 19 | Maintain a record of processing activities. | Auto-generate ROPA from DPIA + vendor registry. |
| **Breach notification** | Art. 20 | Notify SDAIA within 72h; notify affected individuals without delay. | Breach register already in place; wire vendor breaches in. |
| **Cross-border transfer** | Art. 29 (pre-amendment numbering; 2023 amendment relaxed SDAIA pre-approval) + SDAIA Transfer Regulations | Transfer outside KSA permitted where: destination ensures adequate protection, transfer necessary for contract/legal reasons, or a derogation applies. Sensitive data transfers subject to stricter conditions. | Per-destination adequacy assessment; KSA SCCs; SDAIA notification where applicable. |
| **Penalties** | Art. 31 (up to SAR 5M) | Enforcement exposure for non-compliance. | Risk score drives remediation priority. |

### 1.3 Cross-Border Transfer Decision Matrix

| Destination | UAE mechanism | KSA mechanism |
|---|---|---|
| In-country (UAE↔UAE, KSA↔KSA) | No transfer; data residency maintained | No transfer; data residency maintained |
| UAE ↔ KSA intra-group | Adequacy? No — use UAE SCCs (Cab. 65/2022) | Adequacy? No — KSA SCCs / Art. 29 derogation |
| To US / EU / other | Adequacy if listed; else SCCs | Adequacy / SCCs; SDAIA conditions for sensitive data |
| To "third country" (no adequacy) | SCCs + risk assessment | SCCs + Art. 29 derogation, documented |

**Rule for the platform:** every processor + every transfer must resolve to exactly one mechanism, recorded in the schema below. "No mechanism" = blocked by default.

---

## 2. DPIA Framework

### 2.1 When a DPIA is required

| Trigger (UAE PDPL) | Trigger (KSA PDPL) | Antum People relevance |
|---|---|---|
| High risk to data subjects (Art. 22/23 context; general duty) | High risk to data subjects (Art. 7/29 context) | — |
| Large-scale processing of employee data | Same | Yes — every client |
| Systematic monitoring / profiling | Automated decision-making (Art. 12 objection right) | **Intelligence Tier analytics = always DPIA** |
| Processing sensitive data (health, biometric) | Sensitive data (Art. 9) | Medical fitness, biometric access |
| Cross-border transfer | Cross-border transfer | Cloud/vendor hosting outside GCC |

**Antum People rule:** a DPIA is **mandatory** for (1) any Intelligence-Tier deployment, (2) any client storing biometric/health data, and (3) any cross-border transfer of employee data. It is *recommended* for all mid-market (100–1,000 employee) onboardings.

### 2.2 DPIA Questionnaire Structure

The DPIA is a five-section, question-scored instrument. Each question has a weight, a 0–3 severity answer, and a mitigation note. **Purpose → Risk → Mitigation → Residual → Sign-off.**

#### Section A — Processing Overview (purpose)

| # | Question | Field type |
|---|---|---|
| A1 | What is the processing activity / project name? | text |
| A2 | What is the **purpose** of the processing (map to lawful basis: consent / contract necessity / legal obligation / legitimate interest)? | enum + note |
| A3 | Which **categories of data subjects**? (employees, applicants, dependents, ex-employees) | multi |
| A4 | Which **categories of personal data**? (identity, contact, financial, health, biometric, performance, location) | multi |
| A5 | Is **sensitive data** involved (health, biometric, ethnicity, religion)? | yes/no |
| A6 | Who is the **controller** and who is the **processor**? (Antum = processor; employer = controller) | refs |
| A7 | What is the **retention period** and **deletion** schedule? | text |
| A8 | Will data be **transferred cross-border**? If so, to which country, via which mechanism? | enum + ref |

#### Section B — Necessity & Proportionality

| # | Question | Field type |
|---|---|---|
| B1 | Is the processing **necessary** to achieve the purpose (could a less intrusive method work)? | yes/no + note |
| B2 | Is the data collected **minimised** (only what is required)? | yes/no + note |
| B3 | Are data subjects **informed** (privacy notice at collection)? | yes/no |
| B4 | Is there a **lawful basis** recorded for every purpose? | yes/no |
| B5 | Is there an **automated decision** with legal/significant effect? (→ requires human oversight) | yes/no |

#### Section C — Risk Identification

| # | Risk category | Question |
|---|---|---|
| C1 | **Unauthorised access** | Could data be accessed by unauthorised persons/systems? |
| C2 | **Data loss / integrity** | Could data be lost, corrupted, or altered? |
| C3 | **Excessive retention** | Could data be kept longer than necessary? |
| C4 | **Function creep / re-purposing** | Could data be used for a purpose data subjects did not consent to? |
| C5 | **Cross-border exposure** | Could data reside in a jurisdiction without adequate protection? |
| C6 | **Automated bias / profiling** | Could analytics produce unfair or biased outcomes for employees? |
| C7 | **Third-party compromise** | Could a vendor/processor expose or misuse the data? |
| C8 | **DSR non-fulfilment** | Could access/erasure requests be delayed or unfulfilled? |

Each C-question captures: **likelihood (1–5)** × **impact (1–5)** → **risk score (1–25)**.

#### Section D — Risk Assessment Matrix

| Score | Band | Required action |
|---|---|---|
| 1–4 | Low | Accept; document rationale |
| 5–9 | Medium | Mitigate; re-assess in 12 months |
| 10–19 | High | Mitigate before go-live; re-assess in 6 months |
| 20–25 | Critical | Do not proceed until residual risk ≤ Medium; escalate to DPO |

#### Section E — Mitigation Measures

| # | Control | Maps to risk |
|---|---|---|
| E1 | Encryption (AES-256 at rest, TLS 1.2+ in transit) | C1, C2 |
| E2 | Role-based access control (RBAC: HR_Admin, Manager, Employee, Compliance_Officer, DPO) | C1 |
| E3 | Retention auto-purge / anonymisation schedules | C3, C8 |
| E4 | Purpose tagging + lawful-basis enforcement | C4 |
| E5 | Geo-partitioning + SCCs / adequacy for transfers | C5 |
| E6 | Human-in-the-loop for predictive analytics | C6 |
| E7 | Vendor DPA + security questionnaire + breach clause | C7 |
| E8 | DSR workflow with 30-day SLA + erasure engine | C8 |

#### Section F — Sign-off

| Field | Description |
|---|---|
| Residual risk score | After mitigation |
| DPO review | Name + date |
| Controller sign-off | Name + date |
| Review due date | Based on residual band |

### 2.3 DPIA Schema (DDL)

```sql
-- One record per DPIA assessment (a processing activity / project / client deployment)
CREATE TABLE IF NOT EXISTS dpia_assessments (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,              -- client/entity the DPIA belongs to
    project_name TEXT NOT NULL,           -- e.g. "Intelligence Tier — Predictive retention scoring"
    jurisdiction TEXT NOT NULL,           -- 'UAE' | 'KSA' | 'both'
    status TEXT NOT NULL DEFAULT 'draft', -- draft | in_review | approved | remediation_required | archived
    purpose TEXT,                         -- A2
    lawful_basis TEXT,                    -- A2 enum
    data_subject_categories TEXT,         -- A3 JSON array
    data_categories TEXT,                 -- A4 JSON array
    sensitive_data INTEGER DEFAULT 0,     -- A5
    controller_ref TEXT,                  -- A6 (link to client entity)
    processor_ref TEXT,                   -- A6 (Antum / sub-processor)
    retention_schedule TEXT,              -- A7
    cross_border INTEGER DEFAULT 0,       -- A8
    transfer_destination TEXT,            -- A8 country/region
    transfer_mechanism TEXT,              -- A8 enum: adequacy | scc | derogation | none
    necessity_score INTEGER,              -- B section aggregate
    risk_scores TEXT,                     -- C section JSON: [{id, likelihood, impact, score}]
    total_risk_score INTEGER,             -- D: sum of C scores
    residual_risk_score INTEGER,          -- D/F: after mitigation
    mitigation_measures TEXT,             -- E JSON array
    dpo_reviewer TEXT,                    -- F
    dpo_review_date TEXT,                 -- F
    controller_sign_off TEXT,             -- F
    sign_off_date TEXT,                   -- F
    review_due_date TEXT,                 -- F
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

-- Individual question responses (auditable, per-question)
CREATE TABLE IF NOT EXISTS dpia_responses (
    id TEXT PRIMARY KEY,
    dpia_id TEXT NOT NULL REFERENCES dpia_assessments(id),
    section TEXT NOT NULL,                -- A | B | C | E
    question_id TEXT NOT NULL,            -- A1..C8
    response TEXT,                        -- answer / value
    likelihood INTEGER,                   -- C only (1-5)
    impact INTEGER,                       -- C only (1-5)
    risk_score INTEGER,                   -- C only (1-25)
    mitigation_note TEXT,                 -- E notes
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Vendor Risk Ledger (Schema)

Tracks every third-party processor (cloud hosting, payroll, insurance, background-check, ID-verification providers) and its compliance posture.

### 3.1 Vendor Registry

```sql
CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    vendor_type TEXT NOT NULL,            -- cloud_hosting | payroll | insurance | background_check | id_verification | saas_subprocessor | other
    country TEXT,                         -- where vendor is established
    data_hosting_country TEXT,            -- where data is actually processed/stored
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    website TEXT,
    status TEXT NOT NULL DEFAULT 'prospect', -- prospect | onboarding | approved | suspended | terminated
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

-- Contract/agreement terms between controller (client) and processor (vendor)
CREATE TABLE IF NOT EXISTS vendor_contracts (
    id TEXT PRIMARY KEY,
    vendor_id TEXT NOT NULL REFERENCES vendors(id),
    entity_id TEXT NOT NULL,              -- client entity the vendor serves
    contract_type TEXT NOT NULL,          -- dpa | saas_terms | msa | addendum
    dpa_signed INTEGER DEFAULT 0,         -- has a compliant DPA in force?
    dpa_ref TEXT,                         -- link to signed DPA / template used
    start_date TEXT,
    end_date TEXT,
    termination_notice_days INTEGER,
    breach_notification_hours INTEGER DEFAULT 72,
    subprocessor_consent INTEGER DEFAULT 0, -- client notified/consented to sub-processors?
    governing_law TEXT,                   -- UAE | KSA | other
    jurisdiction TEXT NOT NULL,           -- 'UAE' | 'KSA' | 'both'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Risk assessment per vendor (scored)
CREATE TABLE IF NOT EXISTS vendor_risk_assessments (
    id TEXT PRIMARY KEY,
    vendor_id TEXT NOT NULL REFERENCES vendors(id),
    assessed_by TEXT,
    assessed_date TEXT,
    -- scored dimensions (0-5 each)
    security_controls_score INTEGER,      -- encryption, access control, certs (SOC2/ISO27001)
    data_residency_score INTEGER,         -- can data stay in-country / adequate destination?
    breach_history_score INTEGER,         -- prior incidents, breach response maturity
    subprocessing_score INTEGER,          -- does vendor sub-contract processing (chain risk)?
    dsr_support_score INTEGER,            -- can vendor honour access/erasure within SLA?
    breach_notification_score INTEGER,    -- contractual 72h + subject notification capability
    contract_compliance_score INTEGER,    -- DPA in force, SCCs, law/mechanism recorded
    overall_score INTEGER,                -- weighted aggregate (see §3.3)
    risk_tier TEXT,                       -- critical | high | medium | low
    findings TEXT,                        -- JSON array of gap notes
    remediation_due_date TEXT,
    status TEXT DEFAULT 'open',           -- open | remediating | closed
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Every cross-border transfer, mapped to a legal mechanism
CREATE TABLE IF NOT EXISTS cross_border_transfers (
    id TEXT PRIMARY KEY,
    vendor_id TEXT REFERENCES vendors(id),
    entity_id TEXT NOT NULL,
    source_country TEXT NOT NULL,         -- UAE | KSA
    destination_country TEXT NOT NULL,
    data_categories TEXT,                 -- JSON array
    sensitive_data INTEGER DEFAULT 0,
    transfer_mechanism TEXT NOT NULL,     -- adequacy | scc | derogation | none
    legal_basis_ref TEXT,                 -- e.g. "UAE PDPL Art. 22/23 + Cabinet Decision 65/2022" | "KSA PDPL Art. 29"
    safeguard_document_ref TEXT,          -- SCCs signed, adequacy assessment, etc.
    tia_performed INTEGER DEFAULT 0,      -- Transfer Impact Assessment completed?
    risk_level TEXT,                      -- low | medium | high
    approved_by TEXT,
    approved_date TEXT,
    review_due_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Vendor Onboarding Workflow

```
IDENTIFY ──▶ CLASSIFY ──▶ ASSESS ──▶ CONTRACT ──▶ APPROVE ──▶ MONITOR
   │            │            │           │            │           │
   │        vendor_type   security   DPA + SCCs   risk_tier   annual re-│
   │        + data_hosting questionnaire + breach  (critical/  assessment
   │        _country      + DSR test  clause       high→DPO)   + breach
   ▼                                                     │           │
 Record in vendors ──────────────────────────────────────┴───────────┘
```

**Gates:**
1. **Classify** — determine `vendor_type`, `data_hosting_country`, whether sensitive data and cross-border transfer are involved.
2. **Assess** — security questionnaire, SOC2/ISO27001 evidence, breach history, sub-processor chain, DSR support. Score on the 7 dimensions in §3.1.
3. **Contract** — sign DPA (§4) + SCCs if cross-border. Record `dpa_signed`, `breach_notification_hours`, `subprocessor_consent`.
4. **Approve** — `risk_tier` computed from weighted score (§3.3); **critical/high → DPO approval required** before processing.
5. **Monitor** — annual re-assessment, breach register linkage, contract renewal reminders.

### 3.3 Vendor Scoring Weights

| Dimension | Weight | Rationale |
|---|---|---|
| Data residency | 25% | Directly drives cross-border legality (UAE Art. 22/23; KSA Art. 29) |
| Security controls | 20% | Art. 11 (UAE) / Art. 7 (KSA) technical measures |
| DSR support | 15% | Art. 14 (UAE) / Art. 12 (KSA) rights must be executable end-to-end |
| Breach notification | 15% | Art. 16 (UAE) / Art. 20 (KSA) 72h obligation |
| Contract compliance | 15% | DPA + SCCs in force (processor obligations) |
| Sub-processing risk | 5% | Chain risk — vendor's own processors |
| Breach history | 5% | Prior incidents signal maturity |

**`overall_score = round(Σ(dimension_score/5 × weight) × 100)`** → 0–100.

| Tier | Score | Action |
|---|---|---|
| Critical | 0–39 | Do not onboard; remediation plan required |
| High | 40–59 | DPO approval + remediation before processing |
| Medium | 60–79 | Conditional approval; monitor quarterly |
| Low | 80–100 | Approve; annual review |

---

## 4. DPA Template

The full **bilingual Data Processing Agreement** is provided in:

**`/home/team/shared/templates/data-processing-agreement.md`**

It covers the statutory minimums required by both regimes:

- **Parties & roles** — controller (employer) vs processor (vendor/Antum).
- **Subject-matter, duration, nature, purpose** of processing (UAE Art. 7/8; KSA Art. 7).
- **Categories of data subjects & personal data**.
- **Processor obligations** — documented instructions, confidentiality, security (Art. 11 UAE / Art. 7 KSA), sub-processor consent, DSR assistance, breach notification (72h), deletion/return on termination.
- **Cross-border transfer** — mechanism selection (adequacy / SCCs / derogation), destination, safeguards (UAE Art. 22–23 + Cabinet Decision 65/2022; KSA Art. 29).
- **Audit rights, liability, indemnity, governing law, termination**.

> The DPA template is written so that the **same document can be countersigned for UAE or KSA** by toggling the governing-law clause and the cross-border mechanism schedule.

---

## 5. Privacy Maturity Scoring Rubric

A self-assessment rubric for HR teams to score the **"Privacy Maturity"** of their internal onboarding processes. Used in the Intelligence Tier as a readiness signal and in sales as a compliance-led positioning tool.

### 5.1 Scoring Dimensions (5 pillars)

| # | Pillar | What it measures |
|---|---|---|
| P1 | **Notice & Transparency** | Is there an Arabic-first privacy notice at the point of collection? Are purposes + lawful bases stated? |
| P2 | **Consent Management** | Is consent explicit, versioned, timestamped, and withdrawable (as easy as giving)? |
| P3 | **Data Minimisation & Retention** | Is only necessary data collected? Are retention schedules + auto-purge configured? |
| P4 | **Data Subject Rights (DSR)** | Is there a defined DSR intake + 30-day SLA + erasure capability? |
| P5 | **Vendor & Transfer Governance** | Are all processors under a DPA? Are cross-border transfers mapped to a legal mechanism? |

### 5.2 Scoring Scale (per pillar)

Each pillar is answered against 4 maturity levels (0–3 points each), giving a max of **3 × 5 = 15 points**.

| Level | Score | Description |
|---|---|---|
| **Ad-hoc** | 0 | No documented process; compliance is reactive/manual. |
| **Defined** | 1 | Process documented but not consistently followed or tool-enforced. |
| **Managed** | 2 | Process documented + tracked in Antum People; periodic review. |
| **Optimised** | 3 | Fully automated, audited, and continuously improved; evidence available on demand. |

### 5.3 Rubric

| Pillar | Ad-hoc (0) | Defined (1) | Managed (2) | Optimised (3) |
|---|---|---|---|---|
| **P1 Notice** | No privacy notice | English-only notice | Bilingual (AR+EN) notice | Arabic-first, purpose-tagged, auto-served at collection |
| **P2 Consent** | Verbal / implied | Basic tickbox | Versioned + timestamped consent records | Consent lifecycle managed with one-click withdrawal |
| **P3 Minimisation** | Collects everything | Some fields pruned | Minimisation review + retention schedules | Auto-purge / anonymisation enforced |
| **P4 DSR** | No process | Manual email intake | Tracked DSR + 30-day SLA | Self-service portal + automated erasure |
| **P5 Vendors** | No vendor inventory | List of vendors, no DPAs | DPAs + security questionnaires | Full vendor ledger + transfer registry + annual review |

### 5.4 Maturity Bands

| Score (0–15) | Maturity | Label | Implication |
|---|---|---|---|
| 0–3 | Level 1 | **Reactive** | High compliance risk; DPIA required before Intelligence Tier |
| 4–7 | Level 2 | **Developing** | Remediation plan; basic platform features only |
| 8–11 | Level 3 | **Established** | Eligible for full platform incl. analytics with DPIA |
| 12–15 | Level 4 | **Leading** | Certification-ready; case-study / testimonial candidate |

**Usage:**
- **Sales/GTM:** quick maturity scan of a prospect's onboarding flow → positions Antum People as the compliance upgrade.
- **Product:** maturity score gates feature unlocks (e.g., Intelligence Tier requires ≥ Level 2 + DPIA).
- **Compliance KPI:** ties directly to the business plan's **Compliance Accuracy** KPI.

### 5.5 Privacy Maturity Schema (DDL)

```sql
CREATE TABLE IF NOT EXISTS privacy_maturity_assessments (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    assessed_by TEXT,
    assessed_date TEXT,
    p1_notice INTEGER, p2_consent INTEGER, p3_minimisation INTEGER,
    p4_dsr INTEGER, p5_vendors INTEGER,
    total_score INTEGER,                 -- 0-15
    maturity_level INTEGER,              -- 1-4
    findings TEXT,                       -- JSON array
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Implementation Summary

| Item | Deliverable | Priority |
|---|---|---|
| DPIA questionnaire + scoring matrix | §2 | P1 |
| DPIA schema (`dpia_assessments`, `dpia_responses`) | §2.3 | P1 |
| Vendor registry + contracts + risk + transfers schema | §3.1 | P1 |
| Vendor scoring weights & tiers | §3.3 | P1 |
| Bilingual DPA template | §4 + `templates/data-processing-agreement.md` | P0 |
| Privacy Maturity rubric + schema | §5 | P2 |
| Cross-border decision matrix | §1.3 | P1 |

### Next steps for Engineering

1. Run DDL for `dpia_assessments`, `dpia_responses`, `vendors`, `vendor_contracts`, `vendor_risk_assessments`, `cross_border_transfers`, `privacy_maturity_assessments` (align with existing `db.js` `query()` pattern).
2. Build the DPIA questionnaire as a guided flow (sections A–F) writing responses to `dpia_responses`.
3. Implement the vendor risk scoring function (§3.3) and auto-tiering.
4. Wire cross-border transfer registry to block processing where `transfer_mechanism = 'none'`.
5. Surface privacy maturity as a client-facing score in the compliance dashboard.

### Next steps for Design

1. DPIA wizard UI (sections A–F) with inline risk scoring + RTL Arabic.
2. Vendor registry table with risk-tier badges (critical/high/medium/low).
3. Privacy maturity radar/scorecard for HR teams (5 pillars).
4. Cross-border transfer map visualization (source → destination → mechanism).

### Next steps for Lead / GTM

1. Use the Privacy Maturity rubric as a sales diagnostic for the pilot program.
2. Require DPA (§4) for all three anchor pilot clients (Antum is a processor of their data).
3. Add "DPIA completed" and "Vendor DPAs in force" to the **Compliance Accuracy** KPI definition.
