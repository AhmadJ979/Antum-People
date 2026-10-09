# Lawful basis for the seven pre-boarding document types — the mapping, a recommendation, and the questions for counsel

**For:** owner decision 15(b) (does the gate ask for **consent** or a **notice acknowledgement**?) and 15(a) (where the counsel questions go).
**Author:** Compliance Expert · **Date:** 2026-10-09
**Read at:** `AhmadJ979/Antum-People` @ **`cd9daa8`** (fetched 2026-10-09). **Every cell below names the file, line and version it was read from. No cell is inferred** — where a value does not exist in the notice or the code, the cell says so and is flagged.
**Status:** decision support, **not a legal ruling**. The law is counsel's call (§4). What this document does is state the product's position precisely enough to decide against, and to ask about.

---

## 1. The mechanism, measured once (it is the same for all seven rows)

| # | Fact | Evidence |
|---|---|---|
| 1 | **Collection is gated on a consent row.** A document on the *employee* track cannot reach `received`/`verified` until a consent record exists for the case; the refusal is HTTP 428. The workspace track is deliberately not gated. | `server/preboarding-items.js:47` (`COLLECTED_STATUSES`), gate at `:326-332` |
| 2 | **Every case's record carries three literals, regardless of documents:** `consent_type:'pdpl_notice'`, `lawful_basis:'consent'`, `consent_version:'v1'`. | `client/src/App.tsx:849` |
| 3 | **The acting party can be nobody.** The route sends `actor` = the signed-in username **or the literal `'system'`** (`server/index.js:721-728`), and the module itself falls back to `'system'` when writing the `recorded_by` column (`server/preboarding-items.js:242`). | `server/index.js:721-728`, `server/preboarding-items.js:242` |
| 4 | **The notice on file is v2.2**, and its own acknowledgement field reads v2.2 (`templates/privacy-notice.md:6,247`). The recorded `v1` resolves to **no document**. | `templates/privacy-notice.md:6,247`; literal at `client/src/App.tsx:849` |
| 5 | **The one-per-case record has no withdrawal column**: `preboarding_consents(id, case_id UNIQUE, consent_type, lawful_basis, consent_version, granted_at, recorded_by, created_at)`. | `server/schema.sql:258-267` |
| 6 | **In the demo, no consent row exists at all** — the live endpoint answers `{"consent": null}` for all three cases, which is why the demo's "3 WITHOUT CONSENT" is true today. | `demo-weak-screens.md:64` |
| 7 | **The same codebase holds a stricter standard one module away.** The pre-reading acknowledgement refuses an unnamed actor: *"no invented actor… there is no new-hire login in this release, so the record must name the person recording the acknowledgement."* | `server/preboarding-package.js:196-205` |

**Facts 3 and 7 together are the sharpest statement of the problem:** for the pre-reading acknowledgement the code refuses to invent an actor, and for the consent that gates document collection it permits `'system'`. One of those two standards is wrong, and the stricter one is the one the product already chose where it thought about it.

---

## 2. The mapping — one row per document type

The notice's purpose table is `templates/privacy-notice.md:43-50`. The document set is `server/preboarding-items.js:66-77` (UAE set, `active: true`).

| # | Document (`item_key`) | Category | Purpose row in notice v2.2 that covers it | Basis the notice assigns | Does the notice name *this document*? | What the product records | The gap |
|---|---|---|---|---|---|---|---|
| 1 | `passport` | identity (`:71`) | `:44` — visa, immigration, government registration (MoHRE) | **Legal obligation** | Not in a purpose row; `:28` lists "passport number" under Identity Data | `lawful_basis:'consent'` (`App.tsx:849`) | **Instrument mismatch** |
| 2 | `visa_or_entry_permit` | immigration (`:72`) | `:44` — as above | **Legal obligation** | Yes, by category: `:32` "Immigration & Visa Data: visa type/status" | same literals (`App.tsx:849`) | **Instrument mismatch** |
| 3 | `emirates_id` | identity (`:73`) | `:44` — government registration | **Legal obligation** | Yes: `:28` names "Emirates ID" | same literals (`App.tsx:849`) | **Instrument mismatch** |
| 4 | `education_certificate` | qualification (`:74`) | **no purpose row covers it** — nearest is `:43` (administering employment → contract performance) | **Unmapped** (contract performance only by extension) | **No** — no purpose row and no category names qualifications | same literals (`App.tsx:849`) | **Notice gap + instrument mismatch** |
| 5 | `experience_certificate` | qualification (`:75`) | as row 4 | **Unmapped** (same extension) | **No** | same literals (`App.tsx:849`) | **Notice gap + instrument mismatch** |
| 6 | `bank_details` | payroll (`:76`) | `:43` — administering employment and payroll, including WPS | **Performance of the employment contract / contractual necessity** | Yes: `:31` "bank account (IBAN)" under Financial Data | same literals (`App.tsx:849`) | **Instrument mismatch** |
| 7 | `emergency_contact` | welfare (`:77`) | **no purpose row at all** — the data belongs to a third person, and `:29` lists "emergency contact details" as Contact Data without a purpose | **None anywhere in the notice** | Yes as a category (`:29`), never as a purpose | same literals (`App.tsx:849`) | **No basis; and the hire is not the data subject** |

**The count, stated exactly.** **Six of the seven** are collected for purposes the notice maps to contract performance or legal obligation — **four directly** (passport, visa/entry permit, Emirates ID → legal obligation; bank details → contract performance) and **two by extension** (the qualification certificates, which no purpose row and no category names). The seventh — the emergency contact — has **no basis in the notice at all**, and is a different person's personal data. Anyone repeating "six of seven" should repeat the extension with it; it is the honest form of the number.

**Where the product disagrees with its own notice:** for all seven, the stored basis is `'consent'` (`App.tsx:849`), while the notice assigns consent to **biometrics and certain sensitive data** only (`:47-48`) — and **no document in the pre-boarding set is either**. The record therefore asserts a basis the notice does not give it, for documents the notice says rest on something else, with a version string that matches no document, and an actor that may be nobody.

### 2.1 What each option would require, by gap class

| Gap class | Rows | **Option A — keep consent** | **Option B — notice acknowledgement, carrying the basis** |
|---|---|---|---|
| **Instrument mismatch** | 1, 2, 3, 6 | A real consent flow: the notice shown before collection, the hire (or a named recorder) as actor, the version resolved to the document shown, the scope of what was agreed, and a **withdrawal path** (which the table has no column for, `schema.sql:258-267`). And it still records a basis that contradicts the notice until the notice itself is changed. | Record the basis **the notice already assigns** (the `lawful_basis` column exists and is written today, `preboarding-items.js:234-242`) and change the copy from "consent" to "notice acknowledged". Values + copy; no schema change. |
| **Notice gap** | 4, 5 | Both options need this fixed first: **either** the notice gains a purpose row covering qualifications (a template change) **or** the product stops asking for these two certificates at pre-boarding. This is a notice-completeness decision, not an instrument decision. | same |
| **No basis; third party** | 7 | Neither option is honest here: the hire cannot consent for the emergency contact, and no purpose row exists. This one waits for counsel (§4 question 5); until it is answered, the item should not be presented as covered by the hire's acknowledgement. | same |

---

## 3. The recommendation (decision 15(b))

**Recommend Option B: the gate asks for an acknowledgement that the notice was shown, and the record carries the basis the notice assigns.** The four reasons, in the order they matter:

1. **The current record is not thin, it is wrong.** It states a basis (`consent`) the notice does not give for these documents — and it contradicts our own baseline as well: `compliance-requirements.md:300` (§5.2 UAE) says that for HR processing, contractual necessity (Art. 4(2)) allows processing without consent. A record that answers the regulator's question wrongly is worse than a record that answers it narrowly.
2. **Consent is the one basis that can be withdrawn.** Recording it for documents the employment requires hands the hire a right the workflow cannot honour — the case cannot proceed without a passport copy or an IBAN — so the product would be promising something it cannot deliver. Dressing contract performance as consent converts a workable process into a broken promise.
3. **Evidential quality is on Option B's side, and the codebase already knows it.** Option B can name the actor, resolve the version (v2.2), and state the scope. Option A as built cannot: the actor may be `'system'` (`preboarding-items.js:242`), the version matches no document (`v1` vs v2.2), and there is no column for withdrawal. The sibling acknowledgement module already refuses an unnamed actor (`preboarding-package.js:196-205`) — Option B moves the document gate onto the standard the product already holds.
4. **Cost.** Option B is a value and a copy change at one literal (`App.tsx:849`) plus labels. Option A is a hire-facing consent flow with identity, notice versioning and withdrawal — i.e. the portal, which is blocked on decision 14. Option A buys a wrong instrument at a much higher price.

**The trade-off, stated rather than buried.** Option B is not free:
- The word "consent" disappears from a screen a prospect sees, and the demo's **"3 WITHOUT CONSENT"** wording follows it (`demo-walkthrough-script.md:202,371`, `demo-weak-screens.md:29,64`). That label is currently true only because no record exists at all (fact 6); under Option B its meaning changes from "the hire has not consented" to "the notice has not been shown yet" — the *real* gap this product has (see `pdpl-portal-boundary-memo.md` §2).
- An acknowledgement is weaker *evidence of transparency* than a consent record: it says the notice was shown, not that anything was agreed. That is the honest thing to say about contract-performance processing — but if the owner wants the stronger-looking artifact for the demo, Option B is the wrong trade and should be chosen knowingly.
- Under Option A the same objection cuts the other way: it *looks* stronger while being less accurate, and it cannot be made accurate without also changing the notice.

**This is a product recommendation, not a legal ruling.** If counsel answers that consent is in fact required for any of these seven, the recommendation changes **for that row only** — the table in §2 is built to take a per-document answer.

**If the owner would rather decide nothing until counsel replies, this is the narrow question to ask** (one question, answerable per document):

> For each of the seven UAE pre-boarding document types above, is the basis our notice assigns — performance of the employment contract or legal obligation — available to the employer for that document as collected at the pre-boarding stage, and would **an acknowledgement that the notice was shown**, rather than consent, satisfy the requirement to inform the data subject at the point of collection?

That single question decides 15(b) for six of the seven. The seventh (emergency contact) is question 5 in §4.

---

## 4. The counsel question set — audited against our own repository, then shortened

Assembled so that the moment the owner names a recipient, the letter is one edit from sending. **Each of the six was then checked against our own materials, to see whether the repository already answers it** — an audited question is worth less than no question, and a shorter letter is a better letter. **One is dropped, two are narrowed to the part our materials leave open, three stand as written: the letter asks five things.**

| # | The letter's question | Verdict | What the repository already says (checked for this audit, not remembered) |
|---|---|---|---|
| 1 | **Notice content:** which elements a UAE notice must contain — and whether the six we use are those (controller identity, purposes, categories, rights, retention, cross-border, `compliance-requirements.md:312-318`) | **stands** | Nothing answers it. Those six are *our own* list — the repository presents them as a requirement with no article behind it, and the notice template carries the caution *"Article references follow the Antum People compliance reference set. Confirm against final official translations before client use."* (`templates/privacy-notice.md:8`) |
| 2 | **Arabic notice:** must a UAE privacy notice be in Arabic — and if so, must our Arabic be a certified translation or is an in-house version enough? | **stands, sharpened** | Our materials place the Arabic-notice obligation on **KSA, not the UAE**: *"Controller must ensure lawful processing; publish a privacy policy in Arabic"* sits under **§1.2 KSA PDPL (Royal Decree M/148)** (`compliance-dpia-vendor-risk.md:42,47`). For the UAE the repository is silent — re-checked here, still no citation either way. Product note: the notice template is **already bilingual** (`:174`), so the answer cannot change *whether* we ship Arabic, only whether the copy must be certified — which today it is not |
| 3 | ~~**Arabic contract:** must the employment contract be in Arabic?~~ | **DROPPED — the repository answers it** | Yes for the UAE, in our own baseline: §1.2 UAE requires the contract *"in writing (Arabic + English/other)"* (`compliance-requirements.md:38`) — Arabic required, bilingual permitted. The row reading *"Must be in Arabic (bilingual contracts permitted)"* is **KSA §2.2** (`:74`), a held jurisdiction. **This also corrects my own first draft, which cited `:74` as if it were the UAE row.** Nothing in the product changes either way, so it leaves the letter |
| 4 | **Does an acknowledgement of the notice discharge the duty to inform** for the six documents whose basis is contract performance or legal obligation — and what is required where the hire cannot yet hold an account? | **narrowed** | The broad form is answered by our own **§5.2 UAE** baseline: *"For HR processing (contractual necessity), Art. 4(2) allows processing without consent"* (`compliance-requirements.md:300`). So "is consent required?" leaves the letter; what remains is whether an acknowledgement is the right instrument — which is decision 15(b) itself |
| 5 | **Emergency contact:** whose personal data is it, what basis permits collecting it before day one, and who may give that basis? | **stands** | Nothing addresses it. The notice lists *"emergency contact details"* under Contact Data (`templates/privacy-notice.md:29`) with **no purpose row** anywhere in the table (`:43-50`), and no other document in the repository gives it a basis |
| 6 | **Retention:** does the floor our notice states hold for the acknowledgement record, and does a floor attach to that record specifically? | **narrowed** | The notice already asserts the floor — *"Employment & payroll records \| Minimum **2 years** post-termination (Labour Law)"* (`templates/privacy-notice.md:60`) — so "is there a statutory minimum?" leaves the letter. What remains is whether that figure and its source hold, and whether the floor attaches to the acknowledgement record itself, whose own row (`:62`) says only "Duration of employment + retention period" |

**The two questions the repository answers are worth more to us than the answers would have been.** `compliance-requirements.md:300` is *our own compliance baseline* saying that contractual necessity, not consent, is the basis for this processing — the same conclusion as §3's recommendation — while `client/src/App.tsx:849` records `'consent'` for every case. So the contradiction is not only between the record and the notice: **it is between the record and the baseline this team wrote.** That is the sentence to take to the owner, and it is stronger than anything counsel could send back.

**One limit on dropping, stated so it cannot be forgotten.** The dropped question and the two narrowed ones are settled by *our own* materials — the UAE contract row carries no article-level source, and Art. 4(2) is cited without a link. That is strong enough to keep them out of the letter; it is **not** strong enough to be quoted to a client as law.

## 5. Decision 15(a) — where these questions go (both framings; the owner chooses)

**One UAE letter.** The six join the existing UAE counsel request. *For:* one counterparty, one scope, one reply, one fee; the notice and the EOSB letter both sit with the same adviser, so a contradiction between them is less likely. *Against:* it mixes labour law with data protection (different expertise), and re-issuing the existing letter delays the EOSB answer that is already outstanding. **A letter of its own.** The six travel as a PDPL request, with no EOSB content. *For:* it can go to a privacy specialist, the EOSB letter keeps the scope it already has, and the two can move at different speeds. *Against:* a second engagement, and somebody must keep the two answers consistent where they touch (the notice touches both — question 1 and the retention floor). I have no preference to argue; what either framing needs from the owner is the same: **a recipient, and whether the letter may quote our internal documents** (the memo, this mapping, the notice template).

---

## 6. How each cell was read (re-runnable)

Every citation above came from one of these, run against `origin/main`:

```bash
git show <sha>:templates/privacy-notice.md | grep -n '<purpose row text>'   # the notice's side (v2.2)
git show <sha>:server/preboarding-items.js | sed -n '66,77p'                 # the document set
git grep -n "consent_version\|lawful_basis" <sha> -- client/src/App.tsx     # the three literals
git grep -n "actor:" <sha> -- server/index.js                                # who is recorded
git show <sha>:server/schema.sql | sed -n '258,267p'                         # the consent table
```

The transcripts, with the output of each, are in `docs/evidence/pdpl-lawful-basis-mapping/README.md`.

---

## 7. Limits, and what this document does not do

- **No code, no gate change.** The shipped gate, the literals and the copy are untouched; this is the decision's input. Facts 2 and 3 will change the day 15(b) is decided, not before.
- **No legal ruling.** Every legal question above is counsel's. Where I have a view it is labelled as a product recommendation (§3) and can be overturned per row.
- **The UAE engine is frozen and byte-identical:** `server/eosb.js` md5 `36b5dcdc0ee64e0cad5505dd757a5742` at this tree, with `:18`'s unsourced comment untouched.
- **No real client data** (RBAC is not built) and **L-2 stays behind counsel alone.**
- **A numbering caution:** the demo documents attribute the consent-versus-acknowledgement decision to "owner decision 14" (`demo-weak-screens.md:64`). The current plan numbers it **15(b)** (14 is the portal-identity question). Same decision, stale number — flagged so nobody decides the wrong one.
- **The sibling memo is corrected in the same PR as this file:** `pdpl-portal-boundary-memo.md`'s fact 5 and its `App.tsx`/`index.js` line citations were re-ground at this tree; the correction is recorded there and in the PR body. Its finding is unchanged — but its description of the actor was too generous to the product, and that matters here, where the actor is what the record has to prove.
