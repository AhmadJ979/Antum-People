# The KSA contract divergence — ruling, inventory, and one counsel question

*2026-10-12 · row `318cab7f` · measured against `origin/main` = `a11d5c8` and the host pack as it stands today.
Nothing in either copy was edited; this document is the ruling, and the edit is a separate step.*

## 1. It is three blocks, not one

Host copy `/home/team/shared/templates/ksa-employment-contract.md`, md5 **`3518c1af4931afc7b5cd54d0689987e0`**
(10,662 B, mtime **2026-09-17 06:31** — the pilot-pack snapshot).
Repository copy `templates/ksa-employment-contract.md`, md5 **`1c6ad895d403e8caf75606eea8c3db05`** (223 lines).

| # | host (served today) | repository (served after the cutover) |
|---|---|---|
| **A** citation | *"EOSB shall be calculated in accordance with **Articles 74–86** of Saudi Labor Law (Royal Decree M/51), based on the employee's **total monthly salary**."* | *"…in accordance with **Article 84** of the Saudi Labor Law…, based on the employee's **total monthly salary**."* |
| **B** the EOSB ladder | `Less than 2 years` → **No entitlement**<br>`2 to 5 years` → 1/3 of a month's total salary per year<br>`5 to 10 years` → 2/3<br>`10+ years` → 1 full month | `First 5 years` → **Half a month's** total salary per year<br>`Each subsequent year` → **One full month's** total salary per year |
| **C** the notice money | *"**Penalty for Failure to Give Proper Notice:** Up to **50%** of EOSB **may be deducted** if the employee fails to serve the full notice period."* | *"**Compensation for Failure to Give Proper Notice:** If the employee fails to serve the full notice period, the employee owes compensation equal to the wage for the unserved notice period, **recorded as a separate settlement item — never deducted from the EOSB**."* |

The UAE contract is **byte-identical in both copies** (`f28dc42aa50e9b9ea3262af636f2d822`) — which is what proves
this is a *resolution* change, not a content refresh: the two trees were never the same vintage, and only the files
someone happened to correct afterwards differ.

**Origin of the divergence:** `9f4426d` (2026-09-24, *"docs: apply 17 notice-compensation wording corrections
(E1–E17)"*, in `main`) corrected block C in the repository **only** — the host pack was never re-cut. Its own diff
shows blocks A and B were *already* corrected in the repository before that commit, i.e. the host copy has been
frozen at its 2026-09-17 state throughout.

## 2. The ruling: the repository copy is the one to ship

Not by preference — by our own record, which has already ruled on two of the three blocks and points one way on the
third:

- **Block C — the 50% figure is our own retired error.** `eosb-engine-gaps-spec.md:46`: *"the original EOSB review
  (Finding 6) and `compliance-requirements.md` described the KSA notice penalty as 'a 50% deduction' / 'up to 50% of
  EOSB'. **That was a simplification. The measure we model is wage for the unserved notice period** (a number of days ×
  the daily wage), **not a percentage of EOSB. This spec supersedes the '50%' wording."*** Reinforced by
  `eosb-review-report.md:141–143` (the original claim, and the engine's current state: *no* 50% deduction),
  `statutory-claims-determination.md` Group 4 (*"notice compensation is the wage for the unserved notice period, a
  separate settlement line, **never a percentage of EOSB and never a deduction from it**"*), `compliance-requirements.md:244`
  and `tech-stack.md:145`. Five team records, one direction. The host text states a figure we have publicly retired.
- **Block B — the host ladder is the model our engine removed for KSA.** The host rows are the *resignation-reduction*
  ladders (1/3, 2/3, and "no entitlement under 2 years"), including the two-year zero. `eosb-review-report.md:143`
  records the removal: *"the resignation tier previously shown here has been **removed** under the Art. 84 correction
  (Option B: full EOSB on resignation, pro-rata from day one, **no tier, no under-2-year zero**)"*, and
  `eosb-engine-gaps-spec.md:58` flags the tier-vs-notice contradiction as the thing not to stack. The repository rows are
  the Art. 84 **accrual** formula (half a month for each of the first five years, one month for each following year) —
  consistent with the same clause's "Article 84 … total monthly salary". Note also the mislabelling, which is a defect
  independent of the model: the host table is titled *"EOSB Per Year of Service"* while its numbers are a
  resignation-reduction schedule, so read as a general entitlement it understates a dismissed employee's award.
- **Block A — the citation range is the unsourced kind we remove.** `eosb-engine-gaps-spec.md:36` says of exactly this:
  *"Reference in our own records: the notice-period provision, cited in `compliance-requirements.md` within 'Articles
  74–86' — **no article number held; not a pin-cite**."* The repository narrows the EOSB citation to Article 84, which is
  the article our records hold for the award.

**So: no counsel is needed to prefer the repository text, and the direction of risk is one-way.** If the cutover served
the host copy, we would publish (a) an unsourced deduction claim and (b) a ladder our own engine contradicts — to a
client, as contract text.

## 3. What is *not* settled — the one counsel question

The repository clause asserts that the compensation is *"never deducted from the EOSB"*. That is our model and our
drafting; it is **not** sourced law in our records, and it is stronger than "we record it separately" if it is read as
stating what KSA law forbids. The honest position is that the *treatment* is decided and the *statutory* half is not:

> **Q.** Under the KSA Labor Law, where a worker leaves without serving the full notice period: **(a)** what is the
> measure of the employer's claim, and under which article; **(b)** may the employer set that claim off against the
> end-of-service award, or must it be recovered separately; and **(c)** what are the notice-period day counts, and is
> the distinction the current contract table draws (30 days non-Saudi / 60 days Saudi, employer `[notice_period]`)
> correct?

**What each answer changes.** (a) and (c) supply the pin-cites our own spec is waiting on before code lands
(`eosb-engine-gaps-spec.md:179`). (b) decides whether "never deducted from the EOSB" stays as written, becomes a
statement of *our* settlement behaviour rather than of law, or is replaced. Nothing else in the clause depends on it.

Two things this question is **not**: it is not a re-opening of the 50% wording (already retired by our own record), and
it is not a reason to hold the cutover — the repository text is the safer of the two texts either way.

## 4. Inventory — every template, both locations, by md5

14 pairs, **12 byte-identical, 2 differ, none host-only or repo-only.** Ranked by client-visibility, measured from the
code rather than assumed: the product serves exactly four templates, through
`client/src/App.tsx:1564` (PDPL Privacy Notice), `:1571` (Employment Contract — KSA or UAE by the employee's
`data_residency_country`) and `:1579` (Final Settlement), all via
`GET /api/compliance/templates/:templateName/:employeeId` (`server/index.js:369`), which now resolves through
`server/privacy-notice.js` → the repository's `templates/`.

### Tier 1 — served by the product (a client downloads these inside the app)

| file | host md5 | repo md5 | verdict | status |
|---|---|---|---|---|
| `ksa-employment-contract.md` | `3518c1af` | `1c6ad895` | **DIFFERS** — 3 blocks (§1) | **ruled here: ship the repository copy** |
| `privacy-notice.md` | `e011d3d6` | `9c060b9f` | **DIFFERS** — one retention row, EN + AR | already ruled (the reviewed text is the repository's); #154 lands the v2.3 version line |
| `uae-employment-contract.md` | `f28dc42a` | `f28dc42a` | IDENTICAL | inert |
| `final-settlement-statement.md` | `7b1ade31` | `7b1ade31` | IDENTICAL | inert — note `:29` carries a `Notice Period Pay` line, so the settlement surface already keeps notice pay as its own line |

### Tier 2 — client-facing but delivered *outside* the product (the pilot pack; `build-html.js` renders `.md` → `.html`/`.pdf`)

| file | host md5 | repo md5 | verdict | status |
|---|---|---|---|---|
| `privacy-notice.html` | `68c8478a` | `68c8478a` | IDENTICAL **to each other — but stale against its own reviewed source**: it carries `statutory retention` ×2 (EN + AR) and `v2.2` ×4, while the repository `.md` reads "retention period" | **needs a decision**: regenerate after #154, or accept that the pack shows the old wording |
| `privacy-notice.pdf` | `4bb82afa` | `4bb82afa` | IDENTICAL | **content unverified** — the text is hex-encoded glyphs with a `ToUnicode` CMap and this host has no extractor (`pdftotext`/`mutool`/`pypdf` all absent). Same mtime batch as the HTML (2026-09-18 08:31) and rendered from the then-current `.md`, which still said "statutory retention". Settle cheaply by regenerating the pack |
| `data-processing-agreement.md` / `.html` / `.pdf` | `3326d10b` / `cf5c83c4` / `9a38d4b3` | identical | IDENTICAL | legal, client-facing, currently inert. Becomes a stale duplicate the moment the host directory is retired |
| `dpia-questionnaire.md` / `.html` / `.pdf` | `770b522d` / `9a5b3fc7` / `73b2b185` | identical | IDENTICAL | as above |
| `breach-notification-letters.md` | `770ae371` | `770ae371` | IDENTICAL | as above |

### Tier 3 — not client-facing

| file | md5 (both) | note |
|---|---|---|
| `build-html.js` | `206ff7ca` | the pack builder. It has a hardcoded `DATE = '2026-09-17'` and derives the version from the `.md` header it reads, so regenerating the pack also carries the version through |

**Counts:** 14 pairs · 12 IDENTICAL · 2 DIFFER · 0 host-only · 0 repo-only.
The engineer's "six further copies" that become stale duplicates are all in Tier 2; **none of them currently differ**,
which is the answer the brief asked for. Only the two Tier-1 files differ, and both are now ruled.

## 5. Related, but not part of this divergence (both copies agree — flagged so it is not lost)

1. **The notice-period day counts are identical in both copies** (30 days non-Saudi / 60 days Saudi /
   `[notice_period]` for the employer). This row therefore does not change them — but
   `statutory-claims-determination.md` Group 4 decided those day counts must **not** be presented as sourced law and
   that "the KSA notice figure is genuinely uncertain and must not be asserted". The contract tabulates them with no
   qualifier. That is a separate question, folded into §3(c) above.
2. **The engine does not compute either clause.** `server/eosb.js` has no notice parameter at all (grep: no `notice`
   match), so *neither* wording describes current product behaviour. That is legitimate for a contract term — but the
   clause must not be read by anyone as "what our software does".
3. **Retiring the host directory covers all 14 files, not just the notice — and by removal, not by a pointer.**
   *Amended 2026-10-12, later the same day, on the lead's ruling carried by #153 (`b5af270`): the pointer plan is
   **withdrawn**.* A pointer at the host path is read only by the old, host-first resolution — live until a cutover, and
   exactly what a rollback restores — so **any** text left there is a candidate to be served as the document, and "this
   is not the document any more" would be worse than the stale-but-real text. The resolution merged as #151 consults the
   repository for every template (`templatePath()` in `server/privacy-notice.js` is the single resolution for all of
   them), so **nothing needs installing at the host path**; each copy is retired by removing or moving it aside. That
   single resolution is also why the retirement covers all fourteen: until the movement — and after any rollback — the
   old code reads the host directory for every one of them, and the KSA contract is the file where stale text says
   something false about an employee's money. The procedure and its byte-level read-back land in
   `docs/evidence/one-authoritative-notice-2026-10-12/host-copy-disposition.md` (#153).

## 6. What this row did not do

Did not edit either copy (per the brief). Did not settle the statutory questions in §3 — those are counsel's, and
"counsel required, here is the question" is the answer for them. Did not regenerate the pack artifacts. Did not touch
the notice's attestation block (on the owner's list separately).

## Sources (all read at `origin/main` = `a11d5c8` unless a host path is named)

- Host: `/home/team/shared/templates/ksa-employment-contract.md` (`3518c1af…`), `/home/team/shared/templates/privacy-notice.html`, `…/privacy-notice.md` (`e011d3d6…`), `…/build-html.js`.
- Repository: `templates/ksa-employment-contract.md:134,138-142`, `:141-142`; `templates/privacy-notice.md`, `:62`, `:174`, `:5-6`, `:247`.
- Commit: `9f4426d` ("docs: apply 17 notice-compensation wording corrections (E1–E17)", 2026-09-24).
- Prior determinations: `eosb-engine-gaps-spec.md:15,36,46,58,100,178-179` · `eosb-review-report.md:137-147` ·
  `statutory-claims-determination.md:50-51` · `compliance-requirements.md:241,244,280,513` · `tech-stack.md:145` ·
  `compliance-audit-enhancement.md:30,50,89`.
- Serving path: `client/src/App.tsx:1564,1571,1579` · `server/index.js:369,414-416` · `server/privacy-notice.js:10,31,51`
  · `server/privacy-notice.test.js:35-38` · `server/eosb.js` (no notice parameter).
