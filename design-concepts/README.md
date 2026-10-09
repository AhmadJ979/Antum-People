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
| `LAYER2-PREBOARDING-UI.md` | **Layer 2 pre-boarding working surface** — the HR case list that shows every live case without opening one, the employee and workspace tracks, the derived 48-hour flag and its three states, the four provisioning functions, EN/AR layout, and the PDPL consent gate. Spec for P2-2/P2-4 plus the surfaces of P2-5/P2-6. **Design — with P2-2's first cut now on `main`; every gap it depends on is listed, and the questions it does not answer are left open for the owner. Re-grounded on `main` at `75e3ff2` (2026-10-07), after P2-1 landed, again at `5ed731e` after P2-2 landed, and again on 2026-10-09 after P2-3/P2-4/P2-5 merged and §§8A–8C went in (PRs #86 and #89) — the §0 rows P2-2 changed are marked in place, and the build-vs-design deltas are in `LAYER2-P2-2-IMPLEMENTATION-NOTES.md`. |
| `LAYER2-P2-1-IMPLEMENTATION-REVIEW.md` | **Review of the shipped P2-1 Pre-boarding tab** against the Layer 2 spec — what already matches it (placement, house style, no delivery claim, no money, no score) and the three disagreements: the case list was the one screen not jurisdiction-scoped (**decided by the owner 2026-10-07: scope the list call to the header's active jurisdiction, keeping the row's chip**), `Cases open` counting rows rather than open cases (**closed in PR #70, `5ed731e`**), and the breadcrumb spelling the tab differently from the nav (**fixed in PR #70, `5ed731e`**). Measured on an isolated scratch instance, never against the live product. **F1, F2 and F3 are all closed in PR #70 (`5ed731e`)** — the list call carries the header's jurisdiction and `status=open`, the tile's label now matches the list it counts, and the nav and breadcrumb read one list. |
| `LAYER2-P2-2-IMPLEMENTATION-NOTES.md` | **What P2-2 actually shipped, and where the build differs from the spec** — read at `main` `5ed731e` (PR #70, 2026-10-07) and cited to the engineer's own committed run: the item storage and the AE (7) / SA (6, inactive) sets, the status machine and its refusals, the PDPL consent gate (**428**), the in-product reminder, the HR roll-up, the document-byte boundary (**501**, no store chosen — four candidates for the owner), plus the honest deltas **as read then**: **no 48-hour flag and no derived state yet**, no workspace track, no per-item owner or due date, and an item set that is not the spec's list. *(Corrected 2026-10-09: three of those deltas have since resolved — **P2-5** shipped the flag and its chip, **P2-4** shipped the workspace track with one owner per line and a due date derived from the line's offset, and the note at the top of that file says which of its items are superseded; the employee track still records no owner and no due date.)* It also records the owner's 2026-10-07 decision that the demo carries three seeded pre-boarding cases, and the sequencing consequence that seed data alone cannot yet make three states appear. |

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