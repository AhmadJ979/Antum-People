# Counsel package — send index, 2026-10-29

> **2026-11-07 — custody note.** The text below is the **2026-10-29 record** of a four-letter
> package, and it is left exactly as it was written on that day. What has changed is where the
> letters live: all four are now **in this repository**, each in a directory of its own beside
> this one — `counsel/uae-2026-11/` (this one), `counsel/ksa-2026-11/`, `counsel/pdpl-2026-11/`,
> `counsel/access-2026-11/` — and `/home/team/shared` holds a one-line **pointer** at each old
> path, never a second copy of the text. Two sentences of the record no longer read against the
> tree, and are named here rather than rewritten: **"the files in this directory"** (the
> preamble) meant the 2026-10-29 shared directory; and **§2's "the twins are word-identical to
> their `.txt` by construction"** holds for the UAE and KSA pairs but not for PDPL and access,
> whose `.md` is a working document that *contains* the letter — measured 2026-11-07 at 2316 md /
> 1412 txt tokens (pdpl, 70 differing regions) and 1628 / 720 (access, 38), and the PDPL draft
> before the 2026-10-29 appendix was not word-identical either (1599 / 752). `counsel/README.md`
> says which pair is which shape and why; `scripts/check-counsel-letter.py` judges all four
> pairs and the md5 pins in §6 below, which are untouched by this note.

**Status: NOTHING SENT.** No recipient exists (owner decision 15a). This file exists so that naming a recipient is the *only* thing between that decision and the email going out.

Prepared by the Compliance Expert (read-only pass, 2026-10-29), verified and filed by the lead. Every claim below was checked against the files in this directory; where something could not be checked it is listed as a question, not asserted.

---

## 1. What goes in the email

`counsel-package-cover-email-2026-10-29.txt` — paste-ready. Eight placeholders to fill: `[recipient name]`, `[firm]`, `[reply address]`, `[telephone]`, plus the review items in §4.

The email states, truthfully and in its second sentence, that **the legal entity is not yet registered**, that **no client uses the product**, that **no certification is held**, and that we are **not selling anything**. It does not imply a prior contact, a retainer, an agreement, or a fee. It asks for a decision on fees rather than assuming one, and it puts the calendar in the recipient's hands rather than manufacturing a deadline.

## 2. What is attached — four files, `.txt` only

| # | Attach this file | Asks | Items | Appendix A |
|---|---|---|---|---|
| 1 | `uae-counsel-confirmation-request--send-ready.txt` | UAE end-of-service benefit | 8 | U1–U17 + U18 (settlement waiver) = **18 rows** |
| 2 | `ksa-counsel-confirmation-request--send-ready.txt` | KSA end-of-service benefit | 7 | S1–S15 + S16 (same waiver) = **16 rows** |
| 3 | `pdpl-counsel-request--send-ready.txt` | UAE PDPL — the notice and the lawful-basis record | 5 | P1–P15 = **15 citations** |
| 4 | `access-model-counsel-request--send-ready.txt` | Access to personnel records | 3 | none |

**23 numbered items and 49 appendix rows.** The register's own row convention (`docs/statutory-claim-register.md:42`) matches this shape, and all 79 register rows are now `asked`.

*Annotated 2026-11-12: this table read **7 / 6** and this line read **21 numbered items** as recorded on 2026-10-29. The probation item was added to both letters that day — UAE item 8, KSA item 7 — so the three figures were re-counted to 8 / 7 / 23. The 2026-10-29 figures were correct for their day; the letters were longer afterwards. Appendix A does not move: no row was added, so 49 stays 49.*

**Never send the `.md` twins.** They carry material no recipient should see: `pdpl-counsel-request.md:3` opens "draft, not sent" and the file carries the internal cross-walk, decision numbers and repository paths; `access-model-counsel-request.md:5` says "Do not send from either file until a name is given". The twins are word-identical to their `.txt` by construction, so **any edit must land in both** — this is how the `S18`/`U18` slip (below) had to be fixed.

## 3. One line must be removed before sending

`access-model-counsel-request--send-ready.txt:1`:

```
NOTHING SENT — no recipient has been chosen (owner decision 15a). Remove this line before sending.
```

Verified two ways: all four letters read end to end, and a search of the whole shared tree for `Remove this line before sending` returns **that one file only**. The other three letters carry no status marker. It is the newest letter and therefore the easiest to forget.

## 4. What is deliberately **not** in the package

- **The data-processing agreement.** Confirmed absent from all four letters by search. It cannot be issued before registration, and its open fields are the owner's decisions, not counsel's answers. It is also the **only** document carrying the trade-licence/CR field — so if it does not travel, counsel never meets that field.
- **Our internal change records.** No letter cites the register, the dated records, or any audit. Where the letters describe internal disagreement they do so in descriptive terms only ("our KSA model brief", "our records say") with no path, line or decision number.
- **The underlying templates and the notice** — unless Question 1 below says otherwise. The email offers to send them on request.

## 5. The open fields a lawyer will notice

The notice (`templates/privacy-notice.md:20`) carries three: entity name and suffix, registered address, DPO phone — each self-labelled as pending, with "registration in progress" inline. The trade-licence field sits only in the DPA. **A fourth placeholder is uncertain:** `privacy-notice.md:9` still reads `[TO CONFIRM — Arabic wordmark transliteration]` with "Latin 'Antum' used in Arabic text until provided", while the plan records the wordmark as **decided (أنتم, 2026-10-29)**. Whether the decision has landed in that file could not be checked in a read-only pass, and the last served-notice evidence still carries the placeholder. **This is the open version question on the notice and it is the owner's to answer** — it does not block the send if the notice is not attached.

## 6. Pre-send checklist — in order

1. Fill `[recipient name]` and `[firm]`; confirm the address and how the firm takes enquiries.
2. **Delete line 1 of the access letter.**
3. Answer Question 1 (below) and, per that answer, keep or delete the email's "we will send them straight away" line.
4. Answer Question 2 (reply address) — **do not send with an address that cannot receive mail.**
5. Attach the four `.txt` files, nothing else.
6. Re-hash all four at send time and record the tree they were measured from. Current **2026-11-12**: UAE `7737c39222ab447c3094795b6519db2e` (the twin `.md` is `67c70e31db4e19cb15c86c10cdc8a275`), KSA `2caeffade23e6d7ab594772ddcee20a2`, PDPL `e20c67ae8a462586d14a616d7811b0ef`, access `3baa46aba857ef275e9750b7abeb4c56`. The 2026-11-07 pair this line carried (UAE `89b2bd58…` send copy / `7bd134df…` twin, KSA `9c7d63dd…`) was correct for its day: **the probation item was applied on 2026-11-12** as UAE item 8 and KSA item 7, which superseded those two hashes and left the PDPL and access letters untouched. The same day, #419 having made the probation control live, the item's tense was corrected in all four letter files to state the shipped behaviour; that moved the UAE and KSA hashes again and again left PDPL and access untouched. Those edits superseded the hashes; they did not contradict them. The UAE figure this line carried on 2026-10-29 (`6ab0e40263e380ea5cbcd42d51b40fd1`) was correct for its day: **Appendix B was added to the letter after it**, and the letter was re-worded again on 2026-11-07 (points 3, 4, 5, 7 and the Appendix A preamble). Those edits superseded the hash; they did not contradict it.
7. Read the email once for the two sentences that carry the most weight: the registration admission (first paragraph) and the fee paragraph. Neither may be softened — they are what makes the letter safe to send.

## 7. Three questions the owner must answer

**Q1 — do the cited documents travel with the letters?**
The appendices answer by `file:line` in documents counsel will not have. Every row also **quotes the claim verbatim**, so the citation is a convenience, not a dependency. **Recommendation: letters only**, keep the offer line. Reason: attaching the notice drags in the wordmark placeholder and the open identity fields, and invites questions about our paperwork instead of about the law. Sending them later on request costs one email and no explanation.

**Q2 — which reply address, and can it receive mail?**
No letter gives an email address; all four say "Contact: Ahmad Aljairoudi, Dubai, UAE". `dpo@antum.ae` is **reserved but not provisioned**, and `antum.me` / `antum.ae` publish no DNS — **so neither can receive mail today.** A cover note whose reply address bounces wastes the whole exercise. The one address that demonstrably receives mail today is the team inbox; using it is a decision the owner should make knowingly, or provision a mailbox first.

**Q3 — resolved.** The UAE letter called its waiver row `S18` in prose while its own table labelled it `U18`. **Corrected 2026-10-29** in both twins (line counts unchanged, twins still word-identical, the other three letters byte-identical). Recorded as an errata in `counsel-letter-statutory-schedule-2026-10-29.md` rather than silently rewriting that record.

## 8. What this package cannot do

It cannot prove counsel read anything, and it does not pretend a review has happened: every legal unit in the product remains **`unreviewed`** until a recipient answers. It also cannot be signed by us — no agreements, including a DPA, until registration completes.
