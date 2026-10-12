# The acknowledgement route — implementation spec (decision 15(b), option B)

**For:** the engineer, who implements from this. **Owner position:** the gate asks whether **the notice was shown**, and the record carries **the basis the notice already assigns** — not `consent`.
**Read at:** `AhmadJ979/Antum-People` @ **`b54412d`**. Every value below cites the file and line it came from; there is no inferred cell.
**What this is not:** not code, not law. Every judgement that belongs to counsel is labelled **[PENDING COUNSEL]** and its question number named (§8).

> **The engineer cannot start the route, the gate's copy, or the per-item basis until this lands** — this is the only place the per-document basis values, the actor rule and the version source are stated.
> **Nothing here is in tonight's cutover:** that movement ships a bundle verified before this decision existed. The gate change needs its own cycle and its own evidence.

> **Movement, 2026-10-12 — the implementation this spec specifies has landed, and the code citations below
> have moved.** It merged as PR #143 (`ce9fe05`): `server/preboarding-items.js` now carries the per-item basis
> table (`NOTICE_BASES`), the acknowledgement writer and the per-item gate — `if (track === 'employee' …)` at
> `:466`, where this document cites `:326-332` — and a new `server/privacy-notice.js` is the single definition
> of the notice the server serves (§3). **The "Today" columns below describe the product before that change:**
> three of the four strings §6 quotes (`Record PDPL consent`, `PDPL consent recorded`, `No PDPL consent
> record`) no longer exist in the client, and the item set cited at `server/preboarding-items.js:71-77` is at
> `:76-82` today. Those readings stand as the record of the tree they were taken on (`b54412d`); §4's two
> citations were re-grounded at `5d61de5`, where they name their file.
> **§4 was implemented as written:** the two qualification certificates and the emergency contact are
> `collectible: false` in `NOTICE_BASES` (`pending_counsel: 'Q1'` and `'Q5'`), the gate refuses them with 409,
> and an un-shown notice is refused with 428 — no basis is written for any of the three.

---

## 0. What changes, in one paragraph

Today one row per case records `lawful_basis:'consent'`, `consent_version:'v1'`, typed by the client (`client/src/App.tsx:849`) and written with `input.actor || 'system'` (`server/preboarding-items.js:242`); the gate blocks collection on that row's existence (`server/preboarding-items.js:326-332`). Option B replaces the **instrument** — the case records that the notice was shown, per document, naming the person who showed it, against the notice version actually shown — and moves the basis from one case-level literal to the basis the notice assigns to each document. The gate keeps working the same way and the same documents stay blocked until the record exists **for that item**.

---

## 1. The record's values — one row per document type

Item set: `server/preboarding-items.js:71-77`. Notice purposes: `templates/privacy-notice.md:43-50`. Today's product value is the same for all seven (`App.tsx:849`).

| # | `item_key` | Label · category (cite) | **Basis the record must carry** | The notice line for it | The notice names the document? |
|---|---|---|---|---|---|
| 1 | `passport` | Passport copy · identity (`:71`) | **Legal obligation** | `:44` visa, immigration, government registration | Not in a purpose row; `:28` lists "passport number" under Identity Data |
| 2 | `visa_or_entry_permit` | Visa or entry permit · immigration (`:72`) | **Legal obligation** | `:44` | Yes, by category `:32` |
| 3 | `emirates_id` | Emirates ID · identity (`:73`) | **Legal obligation** | `:44` | Yes, `:28` |
| 4 | `education_certificate` | Education certificate · qualification (`:74`) | **Contractual necessity — only once the notice carries a purpose row for qualifications (§5). Until then: no basis, and the item is not collectible (§4).** | *(none today)* — nearest is `:43` | **No** — no purpose row, no category |
| 5 | `experience_certificate` | Experience certificate · qualification (`:75`) | **Contractual necessity — same condition as row 4** | *(none today)* | **No** |
| 6 | `bank_details` | Bank details (IBAN letter) · payroll (`:76`) | **Performance of the employment contract / contractual necessity** | `:43` payroll, including WPS | Yes, `:31` |
| 7 | `emergency_contact` | Emergency contact · welfare (`:77`) | **No basis. The record must carry none** — the notice has no purpose row at all and the data is a third person's (§4) | *(none)* | Yes as a category `:29`, never as a purpose |

**Other values every acknowledgement row must carry.** The closest existing pattern is P2-3's record and it is worth copying rather than inventing: `server/schema.sql:284-297` already stores `case_id`, `item_key`, `item_label`, `jurisdiction`, `recorded_by` (**NOT NULL**), `method` (default `'in_product_record'`), `note`, `acknowledged_at`, `UNIQUE (case_id, item_key)`.

| Value | What it must be | Why |
|---|---|---|
| `case_id`, `item_key`, `item_label`, `jurisdiction` | As the item row already has them | one acknowledgement per item per case |
| `instrument` | an explicit value meaning *the notice was shown* — **not** `consent` | so a future reader can never confuse this record with a consent record, and so a genuinely consent-based item (biometrics, sensitive data — `templates/privacy-notice.md:47-48`, none in this set) can be told apart |
| `lawful_basis` | the per-document value in the table above — **per item, not per case** | the case-level single basis cannot express seven different bases |
| `notice_version` | the version of the notice shown (§3) | the record must say what the hire was shown |
| `recorded_by` | a named person, NOT NULL (§2) | the record's purpose is that somebody showed it |
| `method` | `'in_product_record'` (default) | matches P2-3 |
| `acknowledged_at` | server time | not client time |

**Structural requirement, structure is yours:** the record must express a **per-item basis**; `preboarding_consents` (`schema.sql:258-267`) is one row per case and cannot. Either extend `preboarding_acknowledgements` with a discriminator plus `lawful_basis`/`notice_version`, or add a sibling table — but do not overload the P2-3 table so that a **pre-reading** acknowledgement can read as a **notice** acknowledgement. The P2-3 table's `item_key` set is the pre-reading package's, not this one.

---

## 2. The actor rule — follow the stricter module, not the consent route

**Required: a named person. Refuse the record when none is present (HTTP 400).**

- Route passes the signed-in user explicitly: `recorded_by: (req.user && req.user.username) || null` — the pattern at `server/index.js:774`.
- Module validates and refuses: `server/preboarding-package.js:196-205` (`'no invented actor… the record must name the person recording the acknowledgement'`).
- **Do not** follow `server/index.js:728` / `server/preboarding-items.js:242`, where the fallback writes the literal `'system'`. That behaviour is defensible for an internal audit trail of a machine action; it is not defensible for a record whose entire evidential value is *that a person put the notice in front of the hire*. The same codebase already refuses it one module away.
- **The hire is not the actor this release.** There is no hire login (portal identity is decision 14, open), so the record means *"<named HR user> recorded that the notice was shown to <hire>"*. The hire-facing copy and the internal screen must both say that, and must not imply the hire signed or agreed anything.
- **Demo/seed consequence:** every seeded acknowledgement must name a person. If the seed writes `'system'` the new validation will refuse it, and the demo will show unacknowledged cases — which is why the seed moves in the same cycle, not later.

---

## 3. The version — the server reads it, the client never sends it

- **The value:** the notice's own version string, `templates/privacy-notice.md:6` — **`v2.2`** at this tree (its acknowledgement block reads v2.2 too, `:247`).
- **What fixes it there:** the notice is already a file the server serves (`GET /api/compliance/templates/:templateName/:employeeId`, `server/index.js:350`). The server must read the version from that same file, so the record cannot disagree with the notice a client could have downloaded. **The client stops sending it** — `client/src/App.tsx:849` sends the literal `'v1'`, which matches no document, and that literal is the defect.
- **The rule that keeps it true:** changing the notice's content means bumping that header line; a recorded acknowledgement keeps the version it was shown against and is never rewritten.
- **Read state to make visible:** if the notice's current version is newer than a case's acknowledgement, the UI must show *which* version that case was acknowledged against rather than present it as current.

---

## 4. The two items the notice does not cover

**[PENDING COUNSEL] — my judgement, given as the internal position the product needs, not as law.**

**Education and experience certificates** — `server/preboarding-items.js`, item keys `education_certificate` / `experience_certificate` (`:79-80` at `5d61de5`). The notice has no purpose row for qualifications and no category that names them, so there is **no basis to record**. My judgement: the notice gains the purpose row (§5) and from then on the record carries **contractual necessity**; **until that row exists the two items are not collectible** and their acknowledgement rows are not writable. Recording a basis the notice does not assign is the exact defect this work exists to remove — it must not be replaced with a different invented basis.
*Depends on:* question **1** (notice content).

**The emergency contact** — `server/preboarding-items.js`, item key `emergency_contact` (`:82` at `5d61de5`). No purpose row, no basis anywhere, and the data belongs to a third person who is not the hire. My judgement: **the record carries no basis for this item, ever, until counsel answers**; the item is **not collectible**, its copy must not suggest the hire's acknowledgement covers a third party's data, and nothing in the product may claim a basis for it.
*Depends on:* question **5**. It stays behind it whatever is decided here — this spec does not settle it.
**Demo arithmetic:** keep the item in the set (so the seeded counts stay 7 per case, 21 outstanding — `demo-weak-screens.md:29`) and mark it non-collectible. Dropping it from the set would move every demo figure in the walkthrough documents.

---

## 5. The notice-template fix option B requires

**[PENDING COUNSEL] — proposed wording, for counsel to confirm alongside the row you add. Do not ship the copy as settled.**

1. **Add one purpose row** to the purpose table (`templates/privacy-notice.md:43-50`), after `:43`:
   - **EN:** `| Verifying your qualifications and experience for the role | Performance of the employment contract / contractual necessity |`
   - **AR:** `| التحقق من مؤهلاتك وخبراتك للوظيفة | تنفيذ عقد العمل / الضرورة التعاقدية |`
2. **Add the matching category row** so the documents are named in the notice: `| **Qualification & Experience Data** | education certificates, experience certificates, references |` with its Arabic counterpart.
3. **Bump the version header** (`:6`) — a content change that does not change the version is how a record ends up describing a notice nobody can produce. Expect **`v2.3`**.
4. **Do not** add an emergency-contact purpose row in this change: question 5 is open, and a row invented now would be the same guess in a different place.

---

## 6. What the gate asks and shows — the meaning (the designer owns the wording)

**The meaning to agree:** the gate asks *"has the notice been shown on this case?"*, and it is satisfied per item. A case with no acknowledgement recorded **is not a case where the hire refused** — it is a case where HR has not yet put the notice in front of them. Every string must carry that distinction, and no string may say "consent", "agreed", "signed", or "accepted".

| Surface | Today | What it must read |
|---|---|---|
| The control that records it | `Record PDPL consent` (`client/src/App.tsx:1942`), posting three consent literals (`:849`) | *Record that the notice was shown* — and the notice itself must be openable from the gate before the control is usable. **Today the notice is only a download on an employee record** (`client/src/App.tsx:1479`), never at the point of collection; that is the real gap and the gate must close it |
| The recorded state | `PDPL consent recorded {date}` (`:1938`) | the notice was shown on `{date}`, against notice `{version}`, recorded by `{name}` |
| The empty state on a case | `No PDPL consent record — no document can be collected on this case yet.` (`:1916`) | the notice has not been shown on this case yet, so no document can be collected |
| The roll-up label | `Without consent` (`:1804`) | *notice not shown* — the count is unchanged, its meaning is not. This is the label that replaces the demo's "3 WITHOUT CONSENT", and the demo documents must be re-grounded with it |
| Refusal on collection | `A document cannot be collected before the PDPL consent record exists…` (`server/preboarding-items.js:330`) | the notice has not been shown for this item yet |


**Wording, settled 2026-10-13 (designer).** The one wording refinement to the table above: the roll-up label reads **`Cases · notice not shown`**, not a bare "notice not shown". The unit is named because that tile sits beside two **item** counts (`items_outstanding`, `items_verified`) inside a single panel, so a unit-less label reads as a third item count — and this one counts cases. The control, the recorded state, the empty state and the per-item line are as the table says. Every string was checked against the rule at the top of this section: none of them says consent, agreed, signed or accepted, and none of them claims the hire read the notice.

---

## 7. Implementation checklist (runbook)

1. Add the acknowledgement record's missing values (§1) — per **item**, not per case.
2. Add the route: record a notice acknowledgement for a case's item; `recorded_by` from the session; refuse when unnamed (§2); refuse when the item is one of §4's non-collectible two.
3. Server reads `notice_version` from `templates/privacy-notice.md:6`; remove the client literal (`App.tsx:849`).
4. Replace the gate's consent check (`server/preboarding-items.js:326-332`) with the acknowledgement check, per item; keep HTTP 428.
5. Copy: the four surfaces in §6 (designer's wording).
6. Seed: named actor, per-item acknowledgements, the two §4 items left uncollectible — so the demo's counts still read 7 per case.
7. Notice: §5 — **behind counsel**; the three product items above do not wait for it, and rows 4-5 stay uncollectible until it lands.
8. Evidence for the PR: before/after on a scratch instance — the refusal with no acknowledgement, the recorded version, and the per-item basis; plus the demo's counts re-read after the seed.

---

## 8. Which of the five counsel questions the open cells depend on

| Open cell | Depends on |
|---|---|
| Whether "the notice was shown" is the right instrument at all, and whether recording a basis other than consent is sufficient | **Q4** (consent as a basis for employer-collected documents) — this is 15(b) itself |
| Rows 4-5: what the record carries for the certificates, once the notice has a purpose row | **Q1** (notice content, including the row in §5) |
| Any basis whatsoever for the emergency contact | **Q5** — not in this spec's gift |
| Any change to the notice's other content or to retention | **Q1**, **Q6** |
| Arabic: whether the notice's Arabic must be certified; the Arabic wording in §5 ships as a draft until then | **Q2** |

**Nothing in this spec presents a legal position as settled.** Rows 4-5 and §5 are internal positions, labelled, and take effect as product behaviour only in the form above (no basis recorded where the notice assigns none).

---

## 9. Limits and what does not change

- **No code in this document.** The engineer owns the implementation.
- **Gate scope unchanged:** the employee track only; the workspace track stays ungated (`server/preboarding-items.js:326-332`).
- **Not in tonight's cutover** — the bundle that ships was verified before this decision existed; the gate change needs its own cycle and evidence.
- No real client data (RBAC is not built); L-2 stays behind counsel alone; `server/eosb.js` untouched (md5 `36b5dcdc0ee64e0cad5505dd757a5742`).
- **What this spec deliberately leaves alone:** the withdrawal question. Nothing in this set is consent-based, so nothing is withdrawable — but the `instrument` value in §1 exists so that the day an item *is* consent-based (biometrics, sensitive data, `templates/privacy-notice.md:47-48`), the record can carry the instrument that has a withdrawal path rather than quietly inheriting this one.
