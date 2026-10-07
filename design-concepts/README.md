# Antum People — Design Concepts

This directory contains the Product Designer's deliverables for the Antum People Workforce Intelligence Platform.

## Contents

| File | Description |
|------|-------------|
| `BRAND-IDENTITY.md` | Complete brand identity system — color palette (Deep Teal `#0F766E`), typography (Inter), design principles, component styling, and data visualization semantics |
| `USER-JOURNEY-MAPS.md` | Detailed journey maps for Onboarding (3 stages) and Offboarding (3 stages), with strategic data capture points identified at each step — cost-per-hire, TTV, departure reasons, sentiment, EOSB |
| `DASHBOARD-WIREFRAMES.md` | ASCII wireframes for 4 dashboard views: Executive Summary, Workforce Economics, Retention Analytics, Time-to-Value Analytics — with interactive behaviors and responsive breakpoints |
| `dashboard-wireframe.html` | Live HTML/CSS wireframe of the Executive Dashboard — open in a browser to see the full layout with KPIs, charts, and activity panels |
| `dashboard-mockup.png` | AI-generated visual mockup of the Workforce Intelligence Dashboard |
| `user-journey-visual.png` | AI-generated infographic showing the Onboarding & Offboarding data-to-intelligence flow |
| `LAYER2-PREBOARDING-UI.md` | **Layer 2 pre-boarding working surface** — the HR case list that shows every live case without opening one, the employee and workspace tracks, the derived 48-hour flag and its three states, the four provisioning functions, EN/AR layout, and the PDPL consent gate. Spec for P2-2/P2-4 plus the surfaces of P2-5/P2-6. **Design only — not built, not live**; every gap it depends on is listed, and the questions it does not answer are left open for the owner. Re-grounded on `main` at `75e3ff2` (2026-10-07), after P2-1 landed. |
| `LAYER2-P2-1-IMPLEMENTATION-REVIEW.md` | **Review of the shipped P2-1 Pre-boarding tab** against the Layer 2 spec — what already matches it (placement, house style, no delivery claim, no money, no score) and the three disagreements: the case list is the one screen not jurisdiction-scoped, `Cases open` counts rows rather than open cases, and the breadcrumb spells the tab differently from the nav. Measured on an isolated scratch instance, never against the live product. |

## Strategic Data Capture Philosophy

Every data field collected during onboarding and offboarding maps directly to a dashboard KPI. Nothing is collected "just in case." The design eliminates admin burden through:

- **Auto-population** from ATS/integrations where possible
- **Structured inputs** (dropdowns, toggles) instead of blank text areas
- **Contextual nudges** at natural workflow moments
- **Built-in GCC compliance** (UAE/KSA labor law validations, EOSB auto-calc)

## Brand Identity Summary

- **Primary Color:** Deep Teal `#0F766E` / Teal `#14B8A6`
- **Font:** Inter (with Arabic variant support)
- **Design Principles:** Clarity, GCC-first, Progressive disclosure, Actionable insights

---

*Created by Product Designer — June 2026*