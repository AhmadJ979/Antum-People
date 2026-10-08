# Evidence — demo weak-screen audit, re-grounded 2026-10-08

Task: `1860d1a1-67aa-458a-9be7-0dd29cd9e44b` — re-ground `demo-weak-screens.md` against current `main`
and fold in the Layer 2 findings. Docs-only: no client or server file changed, so no build proof applies.

## Provenance of every reading in this folder

| | |
| --- | --- |
| Repo / tree | `origin/main` = **`2584361`** (`git rev-parse origin/main`), fetched 2026-10-08 09:19Z |
| App.tsx blob | `b7a4cd819fd5db04b0b42a8c4d0a5d5f3f966800` — the same blob in the rig and on `origin/main` (checked in `01-rig-and-provenance.txt`) |
| Scratch instance | `~/ws-rig`, its own worktree, **own SQLite DB**, **own port 4771**, **own throwaway credential** (`scratch`), `JWT_SECRET`/`ENCRYPTION_KEY` from `/dev/urandom`, client built with `npx vite build` (exit 0). Seeded through `scripts/seed-demo.js` with `DEMO_SEED=true`. |
| Isolation (WORKFLOW rule 14) | the live tree at port 3000 answered **200 before and after** every pass; nothing was written to it, and it was never logged into. The only writes in this session went to the scratch DB (the probe in `06-scope-probe.txt`), never to the live tree. |
| Live surface | read **anonymously** only — root, bundle, no-token, foreign `Origin` (`04-live-public-url.txt`). The logged-in pass on the live deployment is the lead's (rule 10 keeps the demo credential with the lead), so no logged-in claim is made here about the published server. |

## What each reading is, and which file holds it

| Claim in the audit | How it was read this pass | File |
| --- | --- | --- |
| Seed state, tree, isolation, live untouched | rig setup transcript | `01-rig-and-provenance.txt` |
| Roster: 8 UAE rows / statuses / start dates / day arithmetic | `GET /api/employees?jurisdiction=AE` (and unfiltered) | `02-http-pass.txt` |
| Dashboard figures, cohorts, exits by reason, forecast ladder | `GET /api/analytics/dashboard` filtered and unfiltered | `02-http-pass.txt` |
| Settlement statement: header, employer, figures, "not calculated", no `[placeholder]` | `GET /api/compliance/templates/final-settlement-statement/<id>` **and** the rendered modal | `02-http-pass.txt`, `03-dom-settlement.txt`, `screenshots/06-settlement-modal.png` |
| Consent line, `Basic Salary (UAE Rule)`, document-preview subtitle | rendered Compliance Center screen | `03-dom-settlement.txt`, `screenshots/06-settlement-modal.png` |
| Offboarding 8 steps (UAE) vs 10 (KSA); onboarding 7 tasks | `GET /api/employees/<id>/offboarding` and `/onboarding`, every employee | `02-http-pass.txt` |
| The three pre-boarding cases, their states, chips and row lines | `GET /api/preboarding/checklist/overview` + the rendered roll-up | `02-http-pass.txt`, `03-dom-preboarding.txt`, `screenshots/02-preboarding-collapsed.png` |
| Pre-reading package: 9 items, 2 requiring acknowledgement, no delivery channel, no read tracking | `GET /api/preboarding/cases/<id>/package` for all three cases | `02-http-pass.txt` |
| The roll-up's scope sentence and the "no owner on this item" copy | rendered roll-up | `03-dom-preboarding.txt` |
| Retention cohorts and the illustrative benchmarks | `GET /api/analytics/dashboard` + the Strategic Intelligence screen | `02-http-pass.txt`, `03-dom-strategic.txt`, `screenshots/08-strategic.png` |
| Money formatting, accruals, the terminated row, `ONBOARDING · AED 0.00` | Employee Directory screen + API | `03-dom-directory.txt`, `screenshots/04-directory.png` |
| "Forgot Password?" copy, the sign-in one-liner | sign-in screen, clicked | `03-dom-signin.txt`, `screenshots/10-signin-forgot.png` |
| Health contract (401 / 403 / 200) on both surfaces | curl, no token and non-allowlisted `Origin` | `02-http-pass.txt`, `04-live-public-url.txt` |
| What the **live** bundle carries (P2-2 strings yes; package and chip no) | the published bundle fetched anonymously and grep'd | `04-live-public-url.txt` |
| F1 — the list is scoped to the header jurisdiction | one SA case opened on the **scratch** DB through the product's own path, then both reads compared: filtered **3**, unfiltered **4** | `06-scope-probe.txt` |
| F2, F3, F4 — tile label, breadcrumb, row distance | rendered roll-up + the client lines named in the audit | `03-dom-preboarding.txt`, `screenshots/02-preboarding-collapsed.png` |

## What this evidence does not do — read this before quoting the audit

- **It does not speak for the published server.** The bundle comparison says what the **live client** can
  render. The settlement statement's header, the EOSB figures and the compliance report are **server-side**,
  so `UAE / KSA` and `Antum Regional Hub` cannot appear in a bundle grep at all — the live bundle's zero for
  those two strings proves nothing either way about the live deployment. The live **case count** is likewise
  a server fact and is not claimed here.
- **The package strip was read from its payload, not from the screen, this pass.** The automated browser pass
  captured the roll-up with all three rows, their chips and their distances; the click meant to expand a row
  into the pre-reading strip resolved to a different control, so the strip's rendered copy is **not** claimed
  from this pass. The payload that the strip renders from is quoted instead, and says which file it is in.
- **No screen evidence for the `Day -n` finding.** It is a code-level finding (`App.tsx:1383`, unguarded
  arithmetic) and the audit says so. On this seed no row can render negative: all 8 UAE start dates are in
  the past (day counts 49 … 1682, in `02-http-pass.txt`).
- **The probe wrote to the scratch database only** — one extra `SA` case (`AUDIT-KSA-CHECK-01`) that exists
  nowhere but in `~/ws-rig`'s DB. Its first attempt failed with `candidate_name is required`; both attempts
  are kept in `06-scope-probe.txt` rather than the failure being tidied away, because the field name is the
  kind of thing the next reader will hit.
- **Figures are dated readings.** The EOSB liability read **85,249.00 AED** this pass; the 2026-10-06 audit
  recorded five different values in one day. Re-read before quoting.
- **Screenshots are of the scratch instance**, not of the live deployment, and two of them are hash-identical
  on purpose: `05-noura-detail.png` and `07-document-preview.png` are the **same bytes** (md5
  `100524b4bc5c2b6e5ff9d67b30714ee8`, both 114,900 B) because the second click matched no control — the pass
  log records `"NOTFOUND"` for that step — so it produced no new state. It is kept rather than deleted so the
  failed step is visible. Separately, `02-preboarding-collapsed.png` and `03-preboarding-row-open.png` **differ**
  (md5 `91a7fd8c…` vs `42bd69b2…`, 111,876 B vs 113,323 B) while the text captured for both was the same
  4,579 bytes — so the click changed the screen without changing the text the pass captured, and the audit
  therefore quotes the roll-up **once** rather than claiming two states. Screenshots are listed in
  `05-screenshots.md`.
