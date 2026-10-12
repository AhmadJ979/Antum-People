# Evidence — the notice-shown acknowledgement route (15(b), option B)

**Rig tree:** this working tree at `d618a96` (branch `feat/notice-acknowledgement-bbf54b1a`), copied to a
scratch directory with its own database and its own port. The live product on port 3000 was not touched
and was re-read as still serving (`200`) while the rig ran.

- `rig-module-level-raw.txt` — the raw run. Everything below is quoted from it.
- `test-run-143-pass.txt` — `cd server && node --test`: **143 tests, 31 suites, 0 fail** (the baseline on
  `b87b065` was 137/31/0 — six net new tests).
- `build-and-test-gate-raw.txt` — the gate the commit passed: `npx tsc -b` exit 0, then the suite, then the
  staged list read back before the commit.

## What the rig shows, quoted

| what was done | what happened |
|---|---|
| receive the passport with nothing recorded | `428 The privacy notice has not been shown for Passport copy yet, so it cannot be collected. Record that the notice was shown first.` |
| record the notice with **no actor** | `400 recorded_by is required: there is no new-hire login in this release, so the record must name the person who showed the notice, on the hire's behalf` |
| record it for the passport, named actor | `created:true, basis "Legal obligation", version "v2.2", instrument "notice_shown"` |
| record it again | `created:false` — same row, nothing written twice |
| receive the passport now | received, `received_at` stamped |
| receive the bank details, whose notice was **not** shown | `428 …has not been shown for Bank details (IBAN letter) yet…` — the gate is per document, not per case |
| record the notice for the education certificate | `409 …no purpose row for qualifications, so no basis is assigned to it (pending counsel Q1)…` |
| record the notice for the emergency contact | `409 …the data is a third person's, not the hire's (pending counsel Q5)…` |
| receive the education certificate | `409 Education certificate cannot be collected in this release…` — a 428 would be wrong: there is nothing HR could show |

The case's roll-up as the server derived it, after those calls:

```
{"notice_version":"v2.2","notice_recorded":true,"notice_items_collectible":4,
 "notice_items_acknowledged":1,"notice_items_no_basis":3,"items_total":7,"outstanding_count":6}
```

and `notice version the record carries == the served file: true` — the version is read from the notice, never
taken from a caller.

## Two gaps in this evidence, stated rather than papered over

1. **The HTTP leg of the rig did not complete.** The rig's own login succeeded and was used for the first
   request; the second attempt against the same rig returned the login route's rate-limit response, so the
   authenticated `GET /api/compliance/notice` and the two `POST`s returned the module's own 401/403 rather
   than a result. The route layer is therefore evidenced by the test suite only (it calls the same module
   functions these routes call, and the retired `POST …/consent` route is asserted gone by its absence from
   the route table), not by a rendered or re-driven request. A second pass on the rig, off the rate-limit
   window, is the honest next step.
2. **No screenshot.** Nothing here is a picture of the screen; the copy and the empty states are reviewed as
   text in the diff.

## Finding — the notice the product serves is not the notice in the repository

Measured on this host, both at version `v2.2`:

| copy | md5 | "statutory retention" |
|---|---|---|
| served — `/home/team/shared/templates/privacy-notice.md` (the template route's absolute path) | `e011d3d6f18eb8175050917bb4fb08fe` | 1 |
| repository — `templates/privacy-notice.md` | `9c060b9fd07129cdb466471bbed7945b` | 0 |

Same version, different bytes, and the qualifier removed as unsourced still ships in the copy a client can
download. `server/privacy-notice.js` resolves the file the route has always served, and records this instead
of silently preferring the repository's copy: which copy is authoritative is a decision, not a side effect.
The version an acknowledgement carries is unaffected — both copies read `v2.2`.
