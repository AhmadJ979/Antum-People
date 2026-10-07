# Layer 2 — what P2-2 shipped, and where the build and the spec differ

**Read at:** `5ed731e` (`main`, the merge of PR #70, 2026-10-07 13:09:08Z) · **Written:** 2026-10-07
**Companion to:** `LAYER2-PREBOARDING-UI.md` (the design) and
`LAYER2-P2-1-IMPLEMENTATION-REVIEW.md` (the review of the tab before this landed).
**Authorities for the claims below:** the code at that revision and the engineer's own committed
run, `docs/evidence/p2-2/http-acceptance.txt` and `docs/evidence/p2-2/build-proof.txt`. Nothing here
was re-run by the author, and nothing here is a substitute for those files.

**Re-derive any line number instead of trusting one:**
```bash
grep -n "const NAV_ITEMS"  client/src/App.tsx
grep -n "^CREATE TABLE"    server/schema.sql
grep -n "documentSetFor\|isDocumentSetActive" server/preboarding-items.js
grep -n "app.get('/api/preboarding" server/index.js
```

## 1. Why this file exists

P2-2 changed `client/src/App.tsx` from 1458 to 1797 lines and added four server files, so every
citation in the spec's §§2–3 was stale within the day — the same thing that happened to §0 when
P2-1 landed. Rather than silently renumber those screens, this file states what is built now and
where it differs from the design, so a reader can tell a **design decision** from a **build fact**.

## 2. What is built (all of it on `main` at `5ed731e`)

| Piece | Where | The fact that matters |
|---|---|---|
| Per-case checklist storage | `schema.sql:202`–`:227` (`preboarding_items`), `:228`–`:243` (`preboarding_reminders`), `:244`–`:255` (`preboarding_consents`) | An item carries `item_key, label, category, jurisdiction, required, status, document_reference, note, requested_at, received_at, verified_at, last_actor`. `UNIQUE (case_id, item_key)` makes seeding idempotent. **No owner column, no due date, no track column.** |
| The item sets | `server/preboarding-items.js:64`–`:72` (AE), `:77`–`:84` (SA) | **AE = 7 items**: passport, visa or entry permit, Emirates ID, education certificate, experience certificate, bank details (IBAN letter), emergency contact. **SA = 6** (no Emirates ID) and is **kept but inactive this release** (`isDocumentSetActive`, `:107`). |
| Status machine | `preboarding-items.js` (transition checks ~`:240`–`:320`) | `not_started → requested → received → verified`. A skipped step is refused **409**, an invented status **400**, a non-existent case **404**, no token **401**. Measured in the committed run, steps 11–13 and 18–19. |
| PDPL consent gate | `preboarding-items.js:195` (`recordConsent`); routes `server/index.js:690`, `:698` | Collection before consent exists is refused **428** with a plain-language reason; the refusal leaves the item untouched. One consent row per case (`UNIQUE`), carrying `consent_type`, `lawful_basis`, `consent_version`, `granted_at`, `recorded_by`. Re-recording is a no-op (`created:false`). |
| Reminders | `preboarding-items.js:350` (`recordReminder`); route `index.js:676` | Recorded **in-product only** (`channel: 'in_product'`) with the outstanding keys and count at that moment, "not that we sent anything". Nothing is emailed or pushed — **the product still has no delivery channel**. |
| The HR roll-up | `preboarding-items.js:418`–`:446`; route `index.js:644` | One call answers "what is outstanding, on which case, named": totals (`items_outstanding`, `items_verified`, `cases_without_consent`, `cases_ready`) plus per case `days_to_start`, `by_status`, `outstanding[]` (key + label + status + required), consent state, last reminder. `outstanding` is **derived on every read** — `:328` says plainly that nothing stores an outstanding flag that could go stale. |
| The document byte boundary | `server/document-store.js` | **No store was chosen when this module was built — deliberately — and the owner has since decided (2026-10-07): Option D ships now (a reference string, no bytes), and Option C (an S3-compatible object store) is built when the entity is registered. IFZA registration is the gate — an event, not a date.** `saveDocument`/`readDocument` (`:70`, `:79`) throw **501**; `ANTUM_DOCUMENT_STORE` (`:47`) is the single door. The item records a short `document_reference` — a file name or the reference HR quoted — and never the document's contents. Four candidate stores are named in the file with the PDPL consequences of each; the owner has since chosen **Option D for now and Option C at entity registration**, which is exactly the shape this boundary was left ready for. |
| The list call | `client/src/App.tsx:439` | Now `?jurisdiction=${jurisdiction}&status=open` — the owner's 2026-10-07 jurisdiction decision, and the status filter the "Cases open" label needs. `:437` says why. |
| The tab's own name | `App.tsx:115` (`NAV_ITEMS`), `:124` (`navLabel`) | The sidebar and the breadcrumb now read one list, so the breadcrumb can no longer spell a tab differently from the nav. |
| The screen as it stands | `App.tsx:1413` (the tile), `:1497` (the roll-up panel), `:1525` (the empty state), `:1546`–`:1640` (a case row and its checklist) | The Layer 2 tab is: the accepted-offer intake form, then **"HR roll-up — outstanding items"**: three totals (items outstanding · items verified · without consent), an empty state reading *"No pre-boarding cases open. Record an accepted offer to open one."*, and one row per case (name · role · department, the jurisdiction chip, `Start: <date> · <n> d`, `Verified: n/m`, outstanding count in red when non-zero). Expanding a row fetches that case's checklist: consent state and a "Record PDPL consent" control (`:1596`), the amber note *"set not active in this release"* for an inactive set (`:1589`), and per item the label, category, status, reference and the actions `Request` → `Mark received` (disabled with no consent, and a tooltip saying why) → `Verify` / `Send back`, plus a `Remind` control disabled when nothing is outstanding. |

## 3. Where the build and the spec's screens differ

The spec's **S1** and **S2** are still design. What exists is a first cut of them, and the honest
deltas are:

1. **No flag chip, and no derived state at all.** The spec's §5 — the 48-hour rule and its three
   states — is **not built**: nothing in `server/` or `client/` derives a state from
   `days_to_start` + `outstanding`. The roll-up carries exactly the inputs the derivation needs, and
   the tile count and the red outstanding figure are the only attention signals on the screen. So
   the spec's §5 remains a design decision with no implementation behind it.
2. **One list of items, not two tracks.** The spec's split into an employee track and a workspace
   track (P2-4) is not there yet — the built checklist is the document set only. `item.category`
   exists (identity, immigration, qualification, payroll, welfare) and is displayed, but it is a
   different axis from the spec's employee/workspace split.
3. **No owner per item and no due date per item.** The spec's §9 D1 and D3 are still open; the
   build needed neither. So §10 Q3 (the due-date offset) is unanswered **and still unblocking
   nothing** — when P2-4 lands it becomes real.
4. **The item set is not the spec's §3 list.** The built AE set has no *Signed JD* and no *Signed
   NDA*, and the row detail the spec draws ("needs the scan, not the number", per-item due dates,
   owner functions) does not exist. The spec's §3 mock is a design for a fuller screen, not a
   description of this one.
5. **Consent and documents are shaped as the spec assumed, but stricter.** The spec asked for the
   consent record to gate collection; the build refuses collection with 428 and records
   `lawful_basis` and `consent_version` too. The spec's §9 D5 (document storage) is **answered by
   the owner (2026-10-07): Option D now — a reference string, no bytes — with Option C at entity
   registration.** The boundary as shipped therefore stands, and the exposure under it is the
   **pointer**: an item says which document, whose, when recorded, and where it lives, so the PDPL
   position is about that reference and the consent that precedes it — which is why the consent gate
   matters **more** under Option D, not less.
6. **The roll-up is a screen the spec does not have.** It is good — it answers "what is outstanding,
   named, without opening a case", which is S1's stated purpose — but it is a panel inside the
   intake screen rather than the case list S1 specifies. Whether S1 replaces it or grows from it is
   a design call to make when the flag lands, not something to pretend is settled.

## 4. The owner's decision on the demo's Layer 2 data (2026-10-07)

Recorded here because it **overrides** what the spec's §10 said before it: the owner has decided the
demo **will** carry **three seeded pre-boarding cases**, one per flag state — a case on track (14
days out, items requested, none verified), a case inside 48 hours with items open, and a case whose
start date has passed with items still open — built as **demo-seed data only**, no schema change, no
real-person PII, and with the "Sample Demo Data" badge intact. The owner's own words, the full rules
and the gate are on the board task `[L2 seed]` (`86749e1f`), and the states are to arise **by
construction** from the seeded dates and item statuses: the 48-hour flag stays *derived*, and the
seed must not store or pre-compute a state.

**The same sitting answered the spec's other two questions** — per-user accounts land at Layer 3
build time, with "My lines", gated by *no real client data until RBAC is live* (spec §10 Q4); and
document storage is Option D now, Option C at entity registration (spec §10 Q5). Both are recorded in
the spec's own §10 and §4/§8, not duplicated here.

**One consequence the sequence has to face, measured in §3.1 above:** because no derivation exists
yet, seeding three cases makes the *underlying facts* true but cannot make three **states** appear on
the screen. Either the derivation lands first (or alongside), or the seed task's acceptance is about
the data the flag will read — not about three visible states. That is a sequencing decision for the
lead, not something the seed can solve by itself.

## 5. What the spec still owns, unchanged

Everything in §§4–8 — the flag and its three states (§5), the four provisioning functions and their
checklists (P2-4), the case list's row anatomy and ordering (S1), the case detail's two tracks (S2),
the pre-reading package, EN/AR layout (§8 and §10 Q6), the PDPL consent copy on the screen, and the
48-hour notification (P2-5) — remains **design, not build**. Nothing in this file should be read as
claiming any of it exists.
