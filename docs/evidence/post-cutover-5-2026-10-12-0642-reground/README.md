# Post-cutover 5 — the served demo state, re-read (2026-10-12, cutover 06:41:58–06:42:25Z)

The cutover ran **2026-10-12 06:41:58–06:42:25Z**. This is the movement the team calls **cutover #5** (its own record is PR #160), and the pack is named for the run — `-5-2026-10-12-0642-` — so the ordinal the team uses and the run’s own timestamp sit in the same name. The tree deployed was `9d2182a`; `main` has moved on since. The
movement shipped the notice-shown acknowledgement gate, the corrected privacy notice (v2.3) and the KSA
contract ruling, and re-seeded the demo. This pack is the re-reading of the demo surface afterwards, on a
rig, at the state the live demo is in.

## Method (rule 26: credentialed passes never touch :3000)

- **The live asset, read off the live URL anonymously** (my own fetch, not from the tree):
  `assets/index-Cc1GodRa.js`, **274,065 bytes, md5 `9cdfbe5da81f6acf38fdb10de8a5e6fd`**, page title
  `Antum People`, css `assets/index-BLszozVg.css`. A rig built from `9d2182a` produces the *same* name,
  size and md5 — so the rig renders the shipped client.
- **The live demo state, read on a rig carrying a copy of the live DB**: source
  `/home/team/.data/antum-product.db`, **229,376 bytes, md5 `7c74c485fe925a6d0498df825d40f64c`,
  mtime 2026-10-12 06:42:04Z**; the copy's md5 equals the source's, so the figures below are the live
  demo's figures, read without signing in to the live product.
- The rig ran the served tree on its own port with its own scratch user and its own JWT/encryption keys.
  Live `:3000` answered 200 before and after every run and was never addressed by the pass.

## The figures (all traceable to this pack's raw payloads)

Roll-up totals, `GET /api/preboarding/checklist/overview?jurisdiction=AE` (`raw/overview-AE-pristine.json`):

```
cases 3 · items 21 · items_outstanding 21 · items_received 0 · items_verified 0
cases_notice_not_shown 1 · cases_ready 0 · workspace_lines 43 · workspace_lines_open 43 · cases_provisioned 0
```

| Case | Start | Flag | Chip | Notice shown |
|---|---|---|---|---|
| `OFR-2026-DEMO-03` Yousef Al-Hammadi | 2026-10-11 | `started` rose | "Started 1 day ago · 21 items open" | 4 of 4 collectible |
| `OFR-2026-DEMO-02` Mariam Al-Kaabi | 2026-10-13 | `inside_48_hours` amber | "Inside 48 hours · 21 items open" | 4 of 4 collectible |
| `OFR-2026-DEMO-01` Omar Al-Farsi | 2026-10-26 | `clear` slate | "On track" | **0 of 4 — left open on purpose** |

`items_outstanding` 21 is the **employee track** (7 × 3). The workspace track is its own field:
**43** lines open (14 + 14 + 15). The two are never summed. Each row's own flag count is *every item on
the case* (7 employee + that case's workspace lines), which is why case 01 reads 22.

## The rendered surface (exact strings, from `raw/` DOM captures)

- Header: `3 CASES OPEN`; tiles: `21 ITEMS OUTSTANDING` · `0 ITEMS VERIFIED` · **`1 CASES · NOTICE NOT SHOWN`**.
- Clear case, notice not yet shown: `The privacy notice has not been shown on this case yet, so no document can be collected on it.`
- Control: `Record that the notice was shown` — with `One act, one record per document — each carries that document's own basis from the notice. Not a signature; the product cannot obtain one.`
- Per collectible item, before: `Notice basis: Legal obligation · the notice has not been shown for this document yet`.
- Per no-basis item: `Not collectible in this release: the privacy notice has no purpose row for qualifications, so no basis is assigned to it (pending counsel Q1).`

## The refusals, verbatim (captured at the API)

- **428** — `The privacy notice has not been shown for Passport copy yet, so it cannot be collected. Record that the notice was shown first.`
- **409 (no basis, on collection)** — `Education certificate cannot be collected in this release: the privacy notice has no purpose row for qualifications, so no basis is assigned to it (pending counsel Q1).`
- **409 (no basis, on the record itself)** — `Education certificate is not collectible in this release: … No acknowledgement can be recorded for it, because the notice has no basis to record.`
- **409 (state machine, first)** — `Item education_certificate is not_started; it cannot move to received (allowed: requested)`.
- A record with no actor in the body is **not** refused: the route takes the actor from the session
  (`server/index.js:753`, `recorded_by = req.user.username || null`), so the body's value is ignored and
  cannot be spoofed. The module's 400/`unnamed record` guard is therefore not reachable through the HTTP
  route — see the surface review.

## The live action, demonstrated

`POST /api/preboarding/cases/<clear case>/notice-acknowledgements` (the button's own call) wrote **one row
per collectible document**, each carrying `instrument: notice_shown`, the basis the notice assigns, the
notice version `v2.3` and `recorded_by` = the signed-in user — and the derived tile **fell 1 → 0**
(`raw/overview-AE-after-ack.json`, `raw/rig-facts-live-action.txt`).

## Findings

The interface review — tile label, the item-level record, the refusal's legibility, and the dead-end
control — is in **`design-concepts/LAYER2-NOTICE-SHOWN-SURFACE-REVIEW.md`**, which is a report with
proposed fixes, not applied changes.

## What this pack does not establish

- The live **sign-in** session's own rendering (rule 26 keeps credentialed passes on a rig).
- Any bundle figure for a tree built after `9d2182a`.
- The two demo documents' older readings, which are kept as history in place.
