# The KSA contract divergence — ruling, inventory, and one counsel question

*2026-10-12 · row `318cab7f` · measured against `origin/main` = `a11d5c8` and the host pack as it stands today.
Nothing in either copy was edited; this document is the ruling, and the edit is a separate step.*

## 1. It is three blocks, not one

Host copy `/home/team/shared/templates/ksa-employment-contract.md`, md5 **`3518c1af4931afc7b5cd54d0689987e0`**
(10,662 B, mtime **2026-09-17 06:31** — the pilot-pack snapshot).
Repository copy `templates/ksa-employment-contract.md`, md5 **`1c6ad895d403e8caf75606eea8c3db05`** (223 lines).

**Path convention — read this before any path below.** The two trees are told apart by the shape of the path,
and the same bare string must not mean both. A bare `templates/…` is **this repository's** tree (`git show
origin/main:templates/…`); the host pack is **always** written absolutely, `/home/team/shared/templates/…`.
The repository has **no `templates/retired/` directory at all** (`git ls-tree -r --name-only origin/main` → zero
files under it), so a bare `retired/` path resolves to nothing: everything retired lives in the host pack.
Both trees hold the same file names, so this is a live ambiguity, not a pedantic one — `templates/build-html.js`
exists in each.

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
3. **A stale copy is retired by removing it or moving it aside — never by a pointer at the same path.**
   *Amended 2026-10-12, later the same day, on the lead's ruling carried by #153 (`b5af270`): the pointer plan is
   **withdrawn**.* A pointer at the host path is read only by the old, host-first resolution — live until a cutover, and
   exactly what a rollback restores — so **any** text left there is a candidate to be served as the document, and "this
   is not the document any more" would be worse than the stale-but-real text. The resolution merged as #151 consults the
   repository for every template (`templatePath()` in `server/privacy-notice.js` is the single resolution for all of
   them), so **nothing needs installing at the host path**. The procedure and its byte-level read-back land in
   `docs/evidence/one-authoritative-notice-2026-10-12/host-copy-disposition.md` (#153).
   **Amended again 2026-10-12, after the cutover: "all fourteen" was the wrong rule, and the count is measured, not
   assumed.** **Divergence is the defect; duplication is inert.** Measured that day, of the **14 file pairs** §4
   compares, **12 were byte-identical** and exactly two diverged. One of the two is the notice's host copy
   `e011d3d6…` — **retired** at cutover #5, bytes preserved at
   `/home/team/shared/templates/retired/privacy-notice.md.retired-9d2182a`. The other is
   `/home/team/shared/templates/ksa-employment-contract.md`
   (`3518c1af…` against the repository's `1c6ad895…`), which is **not retired and must not be recorded as retired**:
   its disposition is the owner's under decision 19 and is still pending (§8). The 12 identical copies are duplicates
   that are inert today: they can drift, but nothing about their content is wrong, and the host path holding one of them
   is not by itself a defect. The earlier wording here ("the retirement
   covers all fourteen") is kept only as the record of what was believed before the measurement; it is not the rule, and
   no document should act on it.

## 6. What this row did not do

Did not edit either copy (per the brief). Did not settle the statutory questions in §3 — those are counsel's, and
"counsel required, here is the question" is the answer for them. Did not regenerate the pack artifacts. Did not touch
the notice's attestation block (on the owner's list separately).

## 7. Executed — the movement ran, and the served KSA text is now the repository's (2026-10-12)

§2's ruling is no longer a plan. Cutover #5 ran **06:41:58–06:42:25Z, exit 0, deploying `9d2182a`**, and the lead
measured the served route afterwards:

| what | measured after the cutover |
|---|---|
| `GET /api/compliance/templates/ksa-employment-contract/demo-emp-sarah` | **200** · contains **"never deducted from the EOSB"** · contains **no** "Up to 50" · contains **no** "Articles 74" |

So the three blocks §1 identifies are gone from what a client receives. The mechanism is the one that flipped the
notice in the same movement: `templatePath()` resolves every template inside this repository
(`server/privacy-notice.js`) and the route that serves them reads through that module (`server/index.js:369`). The
notice's own route reports the flip explicitly — `path` = the tree's `templates/privacy-notice.md` (**not** the host
directory), `version` `v2.3`, content md5 `6004b0a5…` = `origin/main`'s file — and its stale host copy was retired to
`/home/team/shared/templates/retired/privacy-notice.md.retired-9d2182a` with bytes preserved.

## 8. The host copy — **recommendation only, nothing executed**: retire it, the same way the notice was retired

**Status: NOT RETIRED. The file is still at its path, and no document may record it as retired until the owner rules.**
Measured by me on 2026-10-12, after the cutover: `/home/team/shared/templates/ksa-employment-contract.md` is present,
**10,662 bytes, md5 `3518c1af4931afc7b5cd54d0689987e0`**, mtime unchanged at 2026-09-17 06:31, `"Up to 50"` ×1; and
`/home/team/shared/templates/retired/` holds **one** file — `privacy-notice.md.retired-9d2182a` — with no KSA copy in
it. The lead measured the same file independently (same md5) and the live route read-only
(`GET /api/compliance/templates/ksa-employment-contract/demo-emp-omar`) → **200**, returning the **repository** text
(`"never deducted"` ×1, `"Up to 50"` ×0). So the stale text is **inert today**: this is a tidy-up and a
safety-of-the-pack question, **not** a served-text fix.
**The disposition is the owner's (decision 19), and it has three forms:** **(A)** retire it as the notice was — bytes
preserved under `/home/team/shared/templates/retired/`, nothing left at the path (the recommendation below); **(B)** keep it at the path
and label it as the superseded 2026-09-17 snapshot it is; **(C)** treat the host pack as a pack, and move the copies in
it as one. **Nothing below — no move, no label — happens until the owner rules.**
**How to check it, without repeating a week-old mistake (rule 32 in its fourth form).** A `50%` count is **not**
evidence of the retired wording: the served contract contains exactly one `50%`, and it sits inside `150%` — line 92,
the overtime-rate row (`150% (normal) / 200% (weekends/public holidays)`). Check the **phrase**
(`"Up to 50"` → expects 0; `"never deducted from the EOSB"` → expects 1), never the number. A hit count answers *does
this text appear*, never *in what role*.
**Recommendation (compliance's; the owner disposes under decision 19):** move
`/home/team/shared/templates/ksa-employment-contract.md` aside to
`/home/team/shared/templates/retired/ksa-employment-contract.md.retired-9d2182a`, bytes preserved, exactly as the notice was.
Do **not** leave a marker or any replacement text at the path.

**Four measurements decide it, and the first is new this cycle.**

1. **The host copy was *shadowing* this repository's, not sitting beside it.** Until 2026-10-12 the resolution was
   host-first with the repository as the fallback — `d618a96:14` ("*the host-shared templates directory first, this
   repository's own `templates/` as the fallback*"), `:36-45` (`SHARED_TEMPLATES_DIR = '/home/team/shared/templates'`,
   "the first existing candidate wins"). The divergent copy therefore **replaced** the reviewed text wherever it
   existed. Moving it aside cannot make any path worse — the fallback is the reviewed file — and it settles the
   rollback question in the safe direction: after the move, a rollback serves the reviewed text, which is the opposite
   of the hazard the notice's ordering rule was written for.
2. **It is wrong text about an employee's money, in a document a client reads.** The three blocks include "up to 50%
   of EOSB may be deducted" — a figure `eosb-engine-gaps-spec.md:46` supersedes and `statutory-claims-determination.md`
   Group 4 replaces with a separate settlement line — and an accrual ladder giving a KSA employee **no EOSB under two
   years**, against the Art. 84 accrual the engine actually computes (`server/eosb.js:38-48`). Both errors run against
   the employee, and a reader of the pack reads them as our contractual position.
3. **The pack is a delivery channel of its own** (§4, Tier 2): `build-html.js` renders `.md` → `.html`/`.pdf`, and the
   pack is what gets handed to a pilot. Retiring the file loses no history — the pilot snapshot survives under
   `/home/team/shared/templates/retired/`, named for the commit, bytes intact.
4. **After the move the pack is internally consistent, which is why this is *not* a pack-level decision.** Measured
   2026-10-12, after the notice's retirement: the pack holds six `.md` files, **five byte-identical** to the
   authoritative copies and **exactly one diverging — this one** (`3518c1af…` vs `1c6ad895…`; every other file:
   `770ae371` breach letters, `3326d10b` DPA, `770b522d` DPIA, `7b1ade31` final settlement, `f28dc42a` UAE contract).
   The pack-level question was never about the pack — it was about the one file in it that no longer matches the
   reviewed text. Retiring that file **dissolves** the question instead of deferring it, and leaves a pack that can be
   handed to a client through any channel, because every `.md` remaining in it is the reviewed text. (This is why I read
   the question as being about one file rather than about the pack — but the owner may still choose to move the pack as
   one unit, option (C) above, and that choice is not foreclosed by anything here.)

**Procedure — for (A) only, and only after the owner has ruled.** This is the notice's procedure, unchanged, so the team
has one procedure rather than two: record the source md5 **before**
the move (`3518c1af4931afc7b5cd54d0689987e0`); move it to `/home/team/shared/templates/retired/ksa-employment-contract.md.retired-9d2182a`;
read the md5 back and assert it equals the before value; then re-hit the route and assert it still returns the
repository's text — the move must be **inert by measurement**, as the notice's was. Ordering: **after** a restart on a
tree that resolves templates from this repository, which is already satisfied (the cutover happened, and the served
tree does not consult the host directory).

**What retiring it does *not* fix — stated so this is not read as "the pack is now clean":**

- **The notice's derivatives in the pack are stale against the reviewed notice.** `privacy-notice.html` carries
  `statutory retention` ×2 (EN + AR) and `v2.2` ×4, and with its `.md` now under `retired/`, the pack shows notice
  derivatives whose source no longer sits beside them. Regenerating is the owner's act (`/home/team/shared/templates/build-html.js`).
- **The paper attestation block is a live document question, not a stale-text one.** "I consent … ☐ Yes / نعم" is
  present in the **served** v2.3 (verified after the cutover). Nothing in this cycle touched it.
- **Five identical duplicates remain** (Tier 2). Inert under either resolution, but drift-prone; retiring them is a
  tidy-up, not a compliance fix.

## 9. Where counsel stands — plainly

The set is **six**, numbered as the product names them, because a client-facing 409 shows those numbers: **Q1** the
notice content elements (including the purpose row the two qualification certificates wait on), **Q2** the Arabic
notice, **Q4** acknowledgement-as-instrument — 15(b) itself, and the question the paper attestation block meets again
at the point of the document — **Q5** the emergency contact, **Q6** the retention floor: the five PDPL items of
`pdpl-lawful-basis-mapping.md` §4. The **sixth** is the KSA clause this ruling adds (§3: whether the notice
compensation may be set off against the EOSB, and the notice day counts). **Q3 is retired** — the Arabic-contract
question, dropped 2026-10-09 because our own baseline answers it (`compliance-requirements.md:38`); it takes no letter
item, which is why the letter numbers five where the spec numbers six. The product's own refusals carry this numbering:
`server/preboarding-items.js:135,142` refuse the two certificates with `pending_counsel: 'Q1'`, and `:154` refuses the
emergency contact with `'Q5'`.

**Send-ready as of 2026-10-12.** The two EOSB requests (`uae-counsel-confirmation-request--send-ready.txt`,
`ksa-counsel-confirmation-request--send-ready.txt`) have existed in `/home/team/shared/` since 09-28/10-02; the PDPL
five now have a letter too — `/home/team/shared/pdpl-counsel-request--send-ready.txt`, with its provenance and the
letter-item ↔ Q-number table in `pdpl-counsel-request.md`. The PDPL letter **quotes no internal document**, so §5's
permission question no longer gates it: that gap was closed by drafting, not by asking.

**No recipient for any of them.** The engineering is no longer what stands between this product and a pilot: a name does.

**The count is settled (amended 2026-10-12).** Plan revision 79 states the set once — **five PDPL items plus the KSA
clause = six**, in the product's numbering, with the paper attestation block read as the acknowledgement question met
**at the point of the document** rather than as a seventh. Revision 76's two readings (Current Focus #1's "six … five
plus the KSA statutory half" and #3's attestation block as "the sixth counsel question") are both superseded by that.
This section carried the discrepancy, so it is corrected here rather than left showing the older count; the resolution
is the plan's, recorded rather than chosen by me.

## Sources (all read at `origin/main` = `a11d5c8` unless a host path is named)

- Host: `/home/team/shared/templates/ksa-employment-contract.md` (`3518c1af…`), `/home/team/shared/templates/privacy-notice.html`, `…/privacy-notice.md` (`e011d3d6…`), `…/build-html.js`.
- Repository: `templates/ksa-employment-contract.md:134,138-142`, `:141-142`; `templates/privacy-notice.md`, `:62`, `:174`, `:5-6`, `:247`.
- Commit: `9f4426d` ("docs: apply 17 notice-compensation wording corrections (E1–E17)", 2026-09-24).
- Prior determinations: `eosb-engine-gaps-spec.md:15,36,46,58,100,178-179` · `eosb-review-report.md:137-147` ·
  `statutory-claims-determination.md:50-51` · `compliance-requirements.md:241,244,280,513` · `tech-stack.md:145` ·
  `compliance-audit-enhancement.md:30,50,89`.
- Serving path: `client/src/App.tsx:1564,1571,1579` · `server/index.js:369,414-416` · `server/privacy-notice.js:10,31,51`
  · `server/privacy-notice.test.js:35-38` · `server/eosb.js` (no notice parameter).
- **Addendum §7–§9 (2026-10-12), read at `origin/main` = `fa69750`:** the pre-2026-10-12 host-first resolution —
  `d618a96:14,36-45`; the repository-first resolution — `3712822` (`server/privacy-notice.js`, `templatePath()`); the
  cutover that executed the ruling — `9d2182a` (06:41:58–06:42:25Z, exit 0, bundle `index-Cc1GodRa.js`); the retirements
  — `/home/team/shared/templates/retired/privacy-notice.md.retired-9d2182a`; the counsel set — `pdpl-lawful-basis-mapping.md:78-92` and
  §5; the pack, measured 2026-10-12: five `.md` files byte-identical to the repository, `ksa-employment-contract.md`
  `3518c1af…` vs `1c6ad895…` the only divergence.
- **Second addendum, §5.3 / §8 / §9 (2026-10-12, after the cutover), read at `origin/main` = `1dae076`:** the host KSA
  file **still present and not retired** — `/home/team/shared/templates/ksa-employment-contract.md`, 10,662 bytes, md5
  `3518c1af4931afc7b5cd54d0689987e0`, mtime unchanged at 2026-09-17 06:31, `"Up to 50"` ×1; `/home/team/shared/templates/retired/`
  holding **one** file, the notice's; the served contract's **single** `50%` sitting inside `150%` —
  `templates/ksa-employment-contract.md:92` (overtime-rate row); the counsel numbering taken from the product itself —
  `server/preboarding-items.js:135,142` (`'Q1'`) and `:154` (`'Q5'`), asserted in
  `server/preboarding-items.test.js:288,296`; and the plan's settled count (revision 79). The dispositions these
  measurements are waiting on are the owner's: **decision 19** (this file) and 15(a) (the recipient).
