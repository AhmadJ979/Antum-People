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
| `LAYER3-IDENTITY.md` | **Layer 3 slice 1 — signing in as a real person** (design, ahead of the build). The identity surfaces: sign-in as a named person, who-am-I / sign out, what a **reader of a record** sees when it names the actor (decision 22), and how an **unnamed-actor refusal** (the pre-boarding 400) and a **deny-by-default 403** look on screen. Measured at `7b073f8`: it names the two fallbacks in the shipped identity card that render an administrator when a field is missing (`App.tsx:1195`–`1198`), and the fact that `users` carries no display name and no link to `employees`. Roles and allow-list are the access model's (row `6071930d`). **Re-grounded 2026-10-19 onto `8b32d45`**
after `docs/access-model.md` merged (PR #220): the five roles are named (§2.1), the card is required to say
*which* role it shows because three `role` columns collide by name (§2.4), and the model's `'system'` actor
finding (§5.2.1) is cited as the stronger form of this document's own rule. Measurements not re-dated —
`client/`/`server/` are unchanged between `7b073f8` and `8b32d45`. |
| `LAYER3-EMPLOYEE-OWN-VIEW.md` | **Layer 3 — the employee's own read-only view** (design, ahead of the build): their own pre-boarding items and the flag on them, the notice **as it was shown to them** with its version and basis, the state of their own documents, the honest **empty state** (three empties, three sentences), and what must never appear — a colleague's pay or EOSB, another person's case, any company-wide figure. **§0 settles a name collision:** the plan calls this "My lines", but that name is already §4's function scope, owner-ratified 2026-10-07 — this document proposes **"My records"** and marks the naming as the owner's call. **§1 states the link the surface cannot work without** (`preboarding_cases` has no `employee_id`; `users` has no email) — **now decided by `docs/access-model.md` §2.2: `users.employee_id`.** **Re-grounded 2026-10-19 onto
`8b32d45`** after that document merged (PR #220): the link is closed, and §2 gains a named gap — the merged
matrix reads ✖ for role `employee` on every pre-boarding row (§3.2) and names `hr_admin` + `compliance_viewer`
for acknowledgements (§4), so three of the surface's four blocks have no permitted source yet. That is the
compliance expert's call, stated in the doc rather than assumed. |
| `CLIENT-STATES.md` | **The client's failure and empty states — one screen, four (five) different events.** Measured at `ee4bbdf`: the client handles `401` on 19 lines and **`403` nowhere** — the only `403` anywhere in `client/` is an SVG path coordinate (`assets/react.svg:1`) — so a **refusal**, an **ended session**, a **dead server** and a genuinely **empty result** all render as the same empty screen, and the dashboard call site (`fetchData`, `App.tsx:578`) has **no failure branch at all**. Supplies each state's **one sentence** and three structural discriminators (where it appears / whether it carries an action / whether it accuses anyone); states the rule **a refusal must be visible as a refusal** with its three corollaries (an empty result and a refusal may never wear each other's clothes; **silence is a claim**; a refusal is not a fault and a fault is not a refusal); and reconciles with the vocabulary already in the product rather than adding a fourth — `LAYER3-IDENTITY.md` §4's **write** refusal and `LAYER3-EMPLOYEE-OWN-VIEW.md` §4's three empties. **§3 corrects the discriminator the mechanism row (`d2328d67`) was handed:** `server/` has **five** 403 producers (`auth.js:31`, `index.js:65`, `access.js:376`, `:378`, `index.js:166`) and **two** carry a JSON body with *different* meanings, so *"a 403 with a body means the session expired"* would sign a valid user out on the CORS refusal — with a one-line server-side alternative (`auth.js:31` answers `401`, which collapses state 2 into the 19 handlers that already exist). Names a **fifth** event the row did not list. Every citation mechanically verified at `ee4bbdf` (46/46, with the verifier and both runs filed in `docs/evidence/client-states-cites-2026-10-20/`). The refusal copy for a real client user is the **owner's call**, marked in place. |
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