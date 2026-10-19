# Layer 3 · The employee's own read-only view

**What a person sees of their own record** — their pre-boarding items and the flag on them, the privacy
notice *as it was shown to them*, and the state of their own documents. And, less comfortably, what they
must never see.

- **Measured at `origin/main` = `7b073f8`.** Every claim about the schema is read from `server/schema.sql`
  and `server/preboarding-items.js`; every claim about the screen is read from `client/src/App.tsx`.
- **Re-grounded 2026-10-19 onto `8b32d45`**, after `docs/access-model.md` merged (PR #220). The
  measurements are **not** re-dated: `client/` and `server/` are byte-identical between `7b073f8` and
  `8b32d45` (`git diff --name-only` empty), so every `file:line` still describes the surface it measured.
  Two things this file called `(open)` are now answered (§1, §6) — and one thing it assumed is now in
  dispute with the merged matrix (§2, the pre-boarding blocks).
- **Depends on the compliance expert's `docs/access-model.md`** (row `6071930d`, in progress) for the roles
  and the basis on which a person reads their own record. This design invents no permission; where a cell is
  that document's, it says **`(open)`**.
- **Not the hire-facing portal.** That is P2-6 / decision 14 (`LAYER2-PREBOARDING-UI.md` §8A, §8C) and the
  owner's identity question is still open. This is the employee's **own account** view inside the product.

---

## 0. The name — "My lines" already means something else in this repository

**This has to be settled before the surface is built, because it is not a style question.**

The plan (decision 11) calls this surface **"My lines"**, and so does the row that commissioned this design.
But **"My lines" is already a defined, owner-ratified term here — and it means a different surface**:

- `LAYER2-PREBOARDING-UI.md` **§4, "Screen S3 — Function view ('my lines')"** (lines 303–327): the
  pre-boarding board's **function scope** — the chips `All · IT · Admin · HR · Manager`, where IT sees only
  IT's provisioning lines. §4 records the owner's 2026-10-07 answer: per-user accounts land **at Layer 3
  build time**, **"My lines" ships with them**, and no real client data enters the product until per-user
  RBAC is live. Its label rule is explicit: while it is only a filter, it must be called
  **"View by function"**, because calling a filter "My lines" would tell a client IT cannot see HR's lines
  when nothing stops it.
- The plan's Layer 3 lists "My lines" as **the employee's own read-only view** of their own records.

So **one name now denotes two surfaces, both of which are Layer 3**, which is exactly the configuration
where a reader assumes they are one thing:

| Working title in this doc | The surface | Whose rows | Ratified where |
|---|---|---|---|
| **"My lines"** *(existing)* | the **function scope** on the pre-boarding board | the lines of the signed-in user's function | §4, owner 2026-10-07 |
| **"My records"** *(proposed)* | the **employee's own view** | the signed-in person's own record | plan decision 11, this doc |

**Recommendation:** keep **"My lines"** for the function scope (it is ratified, and §4 has a label rule
attached to it) and name this surface **"My records"** — or the owner's own word. **Do not ship two surfaces
under one name**, and do not let a document say "My lines ships at Layer 3" as though that describes both.

**`(open)` — the owner's naming call.** This document uses "My records" throughout as a working title and
says so wherever the name would reach a user's screen.

---

## 1. What makes "my" true — the link this surface cannot work without

A read-only view of *my* record needs to know **which record is mine**. Measured today:

- `preboarding_cases` has **no `employee_id` column** — `candidate_name`, `candidate_email`, `role`,
  `department`, `reporting_line`, `jurisdiction`, `start_date`, `status`, `source`, `offered_at`,
  `created_by` (`server/schema.sql`). The engineer's own test asserts the absence deliberately and states
  the reason: *"the link is by roster id in source until a schema change is decided"*
  (`server/demo-seed.test.js:228`).
- `users` carries `id, username, password_hash, role, created_at` — **no email, no name, no link to
  `employees`.**

So there is **no link** between an account and a person's record at either end. That is the honest state,
and it is the first thing this design must not paper over.

| Option | What it means | Cost / risk | Verdict |
|---|---|---|---|
| **A. Match on `candidate_email`** | the account's email equals the case's `candidate_email` | `users` has no email today; an email changes when a person's name changes at marriage — a *record of identity* behind a mutable string | `(open)` — needs the email field and a rule for change |
| **B. An explicit link** (account → person, or account → case) | one stored reference, set when the account is created | needs the field and a way to create it; unambiguous afterwards | **recommended**, `(open)` |
| **C. Roster id in source / seed-time only** | what the demo does today | fine for a seeded demo, **cannot** answer "mine" for a real person | not a solution for a client |

**Decided — but not by this design.** `docs/access-model.md` **§2.2** answers the question this section
raises, in the same terms: `employee` *"cannot be expressed"* without a link, **`users.employee_id`
(nullable, unique when set) is the prerequisite**, and **§8.7** assigns it to the engineer's slice 2. Option
**B** is therefore the answer, and A and C are settled against — **A** because a mutable string is not a
record of identity, **C** because seed-time linking cannot answer "mine" for a real person.

**What that changes here:** nothing about the surface, everything about its first state. Until the column
exists, this view is honest only as an **empty** view that explains itself (§4, case **C**) — which is why
that sentence is specified rather than deferred. The model also notes what the link buys beyond this screen:
**`manager` is derivable only from the same column** (`employees.manager_id` gives the set, the caller's
`employee_id` gives the caller), so two of its five roles are unenforceable without it.

---

## 2. The surface

One screen, read-only, reached from the nav as its own item. Nothing on it can be changed by the person
reading it — no action buttons, no uploads, no toggles. **Read-only is the design, not a limitation to be
refined away in this slice.**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  My records                                          [ EN ]                │
│  Omar Al-Farsi · Finance Analyst · Finance · UAE                            │
│  Start date 26 Oct 2026                                                     │
├────────────────────────────────────────────────────────────────────────────┤
│  YOUR PRE-BOARDING                                    ● On track            │
│  (flag state, the product's own words — see below)                          │
├────────────────────────────────────────────────────────────────────────────┤
│  DOCUMENTS WE ASKED YOU FOR                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │ Passport copy            requested       you were asked 12 Oct   │       │
│  │ Visa or entry permit     requested       you were asked 12 Oct   │       │
│  │ Emirates ID              not requested yet                       │       │
│  │ Bank details (IBAN)      not requested yet                       │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│  Two of these cannot be collected yet and we will not pretend otherwise.     │
├────────────────────────────────────────────────────────────────────────────┤
│  THE PRIVACY NOTICE, AS IT WAS SHOWN TO YOU                                  │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │ Passport copy · shown 12 Oct 2026 · notice v2.3                   │       │
│  │ basis: Legal obligation · recorded by Layla Haddad (HR)          │       │
│  │ Read the notice v2.3 →                                            │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│  Shown is not the same as agreed. The product records that the notice was    │
│  put in front of you, with the basis; it cannot obtain your signature.       │
└────────────────────────────────────────────────────────────────────────────┘
```

### The gap: the merged matrix does not give role `employee` most of this surface

Stated here rather than discovered at build time. Read against `docs/access-model.md` §3:

- **§3.1** gives `employee` exactly two permitted reads about themselves: `GET /api/employees/:id/onboarding`
  and `GET /api/employees/:id/offboarding`, both `scoped (own)` — and refuses `PUT /api/onboarding-tasks/:id`
  (§6.4), which is why this surface is read-only.
- **§3.2** reads **✖ for `employee` on every row** — the case, the checklist, the workspace, and the notice
  acknowledgements.
- **§4**'s notice-acknowledgement row names `hr_admin` and `compliance_viewer` (read) — **not `employee`**.
- **§3.3** gives every role the notice document itself (deliberately: `GET /api/compliance/notice` is the
  text a data subject is shown, and §4's row says so).

So **three of the four blocks below — the items, the flag, and the notice-as-shown — have no permitted
source in the matrix as merged.** That is a policy question, not a design one, and it is the compliance
expert's to answer: either the employee's own pre-boarding record and their own acknowledgement rows get
`scoped (own)` cells (the natural reading of "their own record only"), or the pre-boarding half of this
surface belongs to the decision-14 portal — which §7 puts explicitly out of Layer 3's scope.

**One nuance to hand them, because it decides which of the two it is:** §2.2 says the `employee` cells
cannot be *enforced* until `users.employee_id` exists, so a ✖ in that column may mean **"not yet
expressible"** rather than **"denied by policy"**. The matrix does not distinguish those two, and a surface
can only be built against the second.

### What each block is, and where it comes from

1. **The person's own header** — name, role, department, jurisdiction, start date: the case's own fields
   (`candidate_name`, `role`, `department`, `jurisdiction`, `start_date`). **No salary, no EOSB, no ID
   number** (§3).
2. **The flag, in the product's own words.** The flag is derived from **every item on the case**
   (`server/preboarding-flag.js` — employee documents *and* the workspace track's provisioning lines), and
   its `scope_note` says so. The employee's view must use **the same chip and the same state** as every
   other surface — never a second computation — and where the count is shown it must carry its scope, or the
   person reads a number that does not match the four documents listed below it. *(This is the same defect
   decision 20's item 6 names on the HR side; **on this surface it is worse**, because the reader has no way
   to reconcile the two.)*
3. **Their own document rows** — label, the status **in the hire's vocabulary** (`LAYER2-PREBOARDING-UI.md`
   §8A.3 defines the four words; reuse them, do not coin new ones), and the date they were asked. Items with
   **no basis in the notice** are shown as the honest refusal they are — the existing copy is
   *"Not collectible in this release…"* and on this surface it must say what it means for the reader:
   **we will not ask you for this yet**. It must not expose counsel question numbers (`Q1`, `Q5`) — those are
   internal, and this is the one screen a non-HR person reads.
4. **The notice as it was shown** — one line per document, from
   `preboarding_notice_acknowledgements`: `item_label`, `acknowledged_at`, `notice_version`,
   `lawful_basis`, `recorded_by`. Plus **a link to the notice itself** at the version recorded
   (`GET /api/compliance/notice`, served, v2.3). The version matters: a person reading their own record must
   be able to read **the text that was shown to them**, not the latest text.
5. **The honesty line under it.** *Shown* is not *agreed*, and the product must say so on the surface where
   the person is most likely to read it as consent. This mirrors the HR-side wording already shipped and
   the notice's own instrument name (`CHECK (instrument = 'notice_shown')`).

---

## 3. What this surface must never show

Rules, not preferences. The first three are the brief's; the rest carry the portal's own rules
(`LAYER2-PREBOARDING-UI.md` §8A.7) onto a surface that did not exist when they were written.

| Never | Why |
|---|---|
| **A colleague's pay, EOSB or allowances** | `employees` carries `basic_salary`, `total_salary`, `eosb_accrued`, `eosb_paid`, `allowances_housing`, `allowances_transport` (`server/schema.sql`). A colleague's are another person's data, full stop. |
| **Another person's case** | no listing, no search, no count that spans cases. This surface shows exactly one record: the one linked to the account. |
| **The roster or any company-wide figure** | not one headcount, not one average, not one "N outstanding" tile. A person's own view is not a dashboard. |
| **Their own EOSB, salary or runway figures** | **`(open)` — recommended: not in this slice.** The brief forbids a colleague's, and says nothing about their own. The product has no basis row for showing an employee their own accrual, the exit path is unreachable (decision 16), and a number shown once is a number someone will act on. If the owner wants it, it is a separate decision with its own basis — not a side effect of this screen. |
| **The workspace track's owner names** | §8A.7 already forbids this to the hire. The provisioning lines (laptop, badge, desk) are *about* this person but are worked by functions; if any are shown, show **the function**, never a colleague's name — and **`(open)`** whether they are shown at all (recommended: yes, without owners — "your laptop is with IT" is useful and harmless, "Priya has your laptop" is not). |
| **Any claim that the product holds a document** | there is no file storage: `preboarding_items.document_reference` is a reference string. No "uploaded", no "attached", no preview, no thumbnail. |
| **"Sent", "delivered", "notified"** | there is no delivery channel — the product records in-app actions only. |
| **"Signed", "e-signed", "consent given"** | the instrument is `notice_shown`. The product cannot obtain a signature and must not imply one. |
| **Counsel question numbers, internal refusals, the 409/400 bodies** | internal vocabulary on a non-HR surface. The person gets the meaning; counsel gets the question. |
| **Any illustrative figure without its label** | the demo's own standing rule. On this surface, prefer no figure. |

---

## 4. The empty state — empty *and* saying why

The brief is right that this is the part most likely to ship broken. A person with nothing pending must not
meet a blank panel or a spinner that never resolves. **Three different empties, three different sentences** —
because they mean different things and only one of them is good news:

| Case | What is true | The surface says |
|---|---|---|
| **A. Linked, nothing pending** | every item on the case is verified | *"Nothing is outstanding. Everything we asked you for is in hand."* — plus the last item's date. This is the good empty state and it must look finished, not blank. |
| **B. Linked, no open case** | the person has no open pre-boarding case | *"There is no open pre-boarding case for you."* — and nothing else. No tile with a `0` in it, no roll-up, no suggestion that they are missing something. |
| **C. Not linked yet** | the account exists but is not connected to a person's record (§1) | *"This account is not linked to a person's record yet, so there is nothing to show. Your HR team can connect it."* — the honest one, and the one that will be live first, because the link may not exist when the account does. **This is the sentence that stops a real defect looking like a broken screen.** |

Two rules across all three:

- **An empty state never shows a red, an amber, or an error icon.** Empty is a state, not a fault. (The
  product's own flag already does this correctly — the `clear` state is slate, not rose.)
- **No count of anything the person cannot see.** "You have 0 outstanding items" is fine; "0 of 4 documents"
  is not, when the four documents are not listed on the screen.

---

## 5. EN/AR and RTL — what this surface adds

No Arabic copy ships here (decision 15(c) is open). The pass itself is specified in
`LAYER2-PREBOARDING-UI.md` §8B — **follow it; do not invent a second convention.** Measured at `7b073f8`,
the four rules that matter most for *this* screen:

1. **`dir` goes on the document element, once** — never per panel. Half-mirrored tables are worse than LTR.
2. **The notice line is the canary on this surface**: an Arabic label + an ISO date + a Latin basis term +
   a person's name + a `·` separator — four directionalities in one line. Wrap ISO dates, `v2.3`, `Q1`-style
   tokens and the basis string in `<bdi>`; keep the separator out of the bidi run.
3. **What must not mirror:** the notice version token, ISO dates, IBANs, Emirates ID values, emails — and
   **the document list's order**, which is semantic (the notice's own order), not visual.
4. **The refusal sentence wraps and never truncates** — it is the one place the person must read the whole
   reason. (`truncate` is fine on a name; never on a refusal.)

Numeral and date decision, if Arabic lands before this screen is built: **Arabic-Indic for counts and
distances; Latin for identifiers** (ISO dates, `v2.3`, IBAN, Emirates ID, currency codes). The client
currently renders money with `toLocaleString(undefined, …)` — **7 sites** — where `undefined` means the
runtime locale, so digits would change while the words stay English. That is `LAYER2-PREBOARDING-UI.md`
§8B.1's finding and it applies here unchanged.

---

## 6. Open questions — asked, not answered

1. **`(open)` The name** — §0. "My lines" is taken; is this "My records"?
2. **`(open)` The link** — §1. Which field makes "my" true, and who sets it?
3. **`(open)` Whether the person's own EOSB appears** — §3. Recommended: not in this slice.
4. **`(open)` Whether the workspace track appears at all**, and without owner names if it does — §3.
5. **Narrowed: the account's display name** (`LAYER3-IDENTITY.md` §2). The link is decided
   (`docs/access-model.md` §2.2: `users.employee_id`); a display *name* is not, and this surface shows the
   **other** person's name (`recorded_by`), so it reads badly until accounts carry real names.
6. **`(open)` Decision 14 — how a person proves who they are.** This surface sits behind a normal
   account login, so it does not answer the portal's identity question; it must not be presented as if it
   did.
7. **Answered in part.** `docs/access-model.md` **§4** gives the basis for the employment record —
   *contract performance; the employer is the controller* — with all roles scoped to the relationship they
   hold with that person, which is the basis a self-reading `employee` sits on. What is **still open** is the
   acknowledgement row's basis for an `employee` reader (the model names `hr_admin`/`compliance_viewer` only,
   §4) — that is the cell that matters for §2's notice block, and it is the same open item as the gap
   above. This design assumes no basis of its own.

---

## 7. What this document does not claim

- It does **not** claim the surface is built, or that the link in §1 exists. Neither is true today.
- It does **not** claim read-only is an access boundary. Read-only is what the screen *offers*; the boundary
  is the deny-by-default mechanism plus the access model's matrix. A read-only UI over an open API is a
  promise, not a control.
- It does **not** replace the portal spec. Where this document and `LAYER2-PREBOARDING-UI.md` §8A differ,
  §8A governs the hire-facing portal and this governs the employee's own account view; the overlap is
  deliberate and the two must not drift into two different words for the same status.
