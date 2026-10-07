# Antum People — review of the P2-1 Pre-boarding tab against the Layer 2 design spec

**What this is:** a design review of the Pre-boarding surface that landed in **PR #66**
(`main` at **`75e3ff2`**, merged 2026-10-07), read against
`design-concepts/LAYER2-PREBOARDING-UI.md`. It records what the shipped tab already does the
spec's way, and the three places where the two disagree.
**What this is not:** a design of anything new, a demo script, or a statement about the live
deployment. **Nothing here is live** — the deployed build is older than #66, and every figure in
this file comes from a scratch instance, never from the running product (WORKFLOW rule 14).
**Author / date:** Product Designer, 2026-10-07. Read at `75e3ff2`; re-derive the line numbers
before quoting them (see the anchor recipe in the spec's header).

---

## 1. What the shipped tab is

| Piece | Where |
|---|---|
| Nav entry, fifth tab — **Pre-boarding**, between Transitions Hub and Strategic Intelligence | `App.tsx:628`–`:632` |
| The tab: header card + case count, intake form, case list | `App.tsx:1184`–`:1321` |
| "Record an accepted offer" form → `POST /api/preboarding/cases` | `App.tsx:1212`–`:1274`, client call `:378` |
| Case list → `GET /api/preboarding/cases` | `App.tsx:1282`–`:1318`, client call `:355` |
| The case model and its single writer | `schema.sql:177`–`:193`; `server/preboarding.js:119` |

## 2. What matches the spec — checked, not assumed

- **§1 placement is exact.** The spec recommended "a fifth top-level nav item — `Pre-boarding` —
  between Transitions Hub and Strategic Intelligence"; that is `App.tsx:631`.
- **The count is allowed by the spec's own rule.** §2 forbids "any aggregate that reads as a
  benchmark" and then says explicitly that *"counts of cases are fine; comparisons are not"* — so
  the `Cases open` counter (`App.tsx:1200`–`:1201`) is inside the rule, and neither the badge nor
  the count is dressed up as a rate. (See F2 for the label, not the count.)
- **No money, no score, no ranking.** §2 forbids a per-case cost, a risk rating and a
  percentage-complete ring on this surface. The tab shows name, role, department, jurisdiction
  chip, start date, reporting line, offer reference and source — nothing else.
- **No delivery claim anywhere.** §5's copy rules — a pre-boarding state may never say
  "sent/notified/emailed", because the product has no delivery channel (Gate 2, 2026-10-06) — hold
  on the shipped tab: the intake form says *"recording it here is what opens the case"*
  (`App.tsx:1210`) and the tab never implies anything was sent to the candidate.
- **UAE-first default on the intake form.** `offerForm.jurisdiction` initialises to `'AE'`, with
  AE and SA both offered (`App.tsx:1256`–`:1261`). The *case* is recorded in the jurisdiction on
  the accepted offer, not in whatever the header switch says — which is a reasonable reading of
  UAE-first, but it is the reason F1 matters.
- **The demo badge still covers it.** "Sample Demo Data" sits in the app-level header
  (`App.tsx:660`), outside the tab switch, so the new tab inherits it.
- **Correctly absent:** the derived 48-hour flag (§5), the two tracks (§3), the function view
  (§4), EN/AR (§7) and the consent gate (§8). Those are P2-2/P2-4/P2-5/P2-6, and nothing on the
  shipped tab pretends otherwise.

## 3. Where the shipped tab and the spec disagree

### F1 — the case list was the one screen in the product that is not jurisdiction-scoped *(decided by the owner 2026-10-07: scope it, keep the chip)*

The client calls the list with no filter (`App.tsx:355`), and the API filters only when a
`jurisdiction` parameter is present (`server/preboarding.js:97`–`:102`, route
`server/index.js:597`–`:600`). **Measured** on a scratch instance at `75e3ff2`, holding one AE case
and one SA case:

```
GET /api/preboarding/cases                      -> 2 cases; jurisdictions: AE,SA
GET /api/preboarding/cases?jurisdiction=AE      -> 1 case
GET /api/preboarding/cases?jurisdiction=SA      -> 1 case
GET /api/employees                              -> 13 rows   (for contrast)
GET /api/employees?jurisdiction=AE              ->  8 rows
```

So every other screen the demo shows is UAE-first, and the Layer 2 list — the surface the Layer 2
pitch opens on — is not. On the UAE-only demo flow the difference is invisible until an SA case
exists, and then the tab shows a KSA row with a green chip while the rest of the page is UAE.

**Decided — the owner, 2026-10-07: the list call passes the header's active jurisdiction (AE by
default), and the per-row chip stays.** The code change lands in the P2-2 PR, not in this review.
This review's own suggestion was the same fix, but the decision is the owner's — recorded here so
its source is not misattributed to the reviewer or to the lead. Because the chip stays, nothing on
the row is removed: S1's row anatomy now names it as a field (spec §2), and S2 shows the same value
on the case itself (spec §3).

### F2 — "Cases open" counts rows, not open cases *(low today; wrong the day a case can close)*

`status` exists and defaults to `'open'` (`schema.sql:187`), and no code writes any other value
yet (`server/preboarding.js:133` sets it only on insert, from the default). The list query has no
status filter at all (`server/preboarding.js:97`–`:102`). Measured: with one case moved to
`status='closed'` in the scratch DB, the client's own call still returned **2 rows** — so the label
`Cases open` would read 2 while only one case is open.

**Recommendation:** either filter `status = 'open'` in the list (which is what the label claims) or
label it `Cases` until a closed state exists. A one-line change, worth doing when case closing
lands — not worth a PR on its own.

**Status (confirmed by the lead on `main`, 2026-10-07):** `client/src/App.tsx:1200` renders
`preboardingCases.length` under the label at `:1201`, and `listCases` filters by nothing
(`server/preboarding.js:97`–`:102`) — so the number and the label disagree the moment a case can
close. It is latent rather than live-visible today, because nothing writes a status other than
`'open'` yet, which is exactly why testing it with a closed row was worth doing. The fix is in the
P2-2 PR.

### F3 — the breadcrumb spells the tab differently from the nav *(cosmetic)*

The header renders `{activeTab} Panel` (`App.tsx:657`), which prints "Preboarding Panel" for a nav
entry labelled `Pre-boarding` (`App.tsx:631`). Every other tab's id happens to match its label, so
this is the first one where it shows. Fix by mapping ids to labels for the breadcrumb, or by
choosing one spelling; it should match the nav.

**Status (lead, 2026-10-07):** confirmed on `main` and fixed. Root cause as above — the breadcrumb
prints the tab's **id**, so a nav label that differs from its id spells differently in the header.
Same defect class as the settlement header still reading "UAE / KSA".

### F4 — the KSA switch's tooltip already answers half of owner decision #5 *(note, not a defect)*

The switch carries `title="Active demo surface is UAE-first; KSA stays reachable here for testing
the Phase 2 surface."` (`App.tsx:663`). That copy leans to the "testing-only flag" option while
the owner's decision on the visible switch is still open — and it has been there since the UAE-first
commit (`34fdd63`, 2026-10-02), so it predates this work rather than coming from it. Flagging it
only so the copy and the decision do not drift apart; no change recommended without the owner's
answer.

## 4. How this was measured, and how to re-check it

One scratch instance, isolated from the live tree: a git worktree of `75e3ff2` on port **4731**,
its own throwaway DB, its own throwaway admin credential, seeded with `scripts/seed-demo.js`. The
2 cases were created through the product's own `POST /api/preboarding/cases` (no direct writes
except the single `status='closed'` used for F2). The instance was torn down afterwards; the live
deployment was left running and was not touched, tested against, or written to.

- Raw output: `/home/team/shared/layer2-p2-1-evidence/evidence.txt` and `evidence2.txt`.
- Scripts: `/home/team/shared/layer2-p2-1-evidence/scripts/` (paths in them are the author's).
- Recipe: the team skill `antum-scratch-evidence-rig`.

**A side finding worth keeping:** re-posting the same offer reference returned
`{"created":false, ...}` — the case already existed and nothing was created twice, which is Gate 1's
idempotency visible from outside the product. The UI surfaces it honestly too ("nothing was created
twice", `App.tsx:397`).

---

*Product Designer — 2026-10-07. Review only: no product code, no seed and no deployed asset was
changed by this document.*
