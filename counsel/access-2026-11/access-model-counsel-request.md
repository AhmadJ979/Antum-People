# Access to personnel records — three questions (decision 27): internal twin

**Prepared by:** Compliance Expert · 2026-10-26 · measured at `f2c7b2b` = `main` = the deployed tree
**Send-ready text:** `access-model-counsel-request--send-ready.txt` (the letter; line 1 is a status line, not part of the letter)
**Status: NOTHING SENT.** No recipient exists. Decision 15(a) is the owner's, and a recipient is not ours to choose or guess. Do not send from either file until a name is given.

**What this closes.** Decision 27 is the counsel block over `docs/access-model.md` §8 items **3, 4 and 5** — the document states that in three places (`:108`, `:390-395`, `:465-466`, and its own check command at `:448`: *"and 27, which covers §8 items 3, 4 and 5"*). Those three questions had no send-ready text anywhere in `/home/team/shared`; they do now. Nothing about the questions themselves is new: they are written in the access model already, and this file only turns them into a letter and audits every sentence of it.

---

## 1. The cross-walk (letter item → the model's own numbering → the code marker → the product state)

| Letter item | `docs/access-model.md` §8 | Decision | Code at `f2c7b2b` | Product state, measured |
|---|---|---|---|---|
| **1.** Aggregates that could identify a person | item **3** | **27** | `COUNSEL_PENDING['analytics:read'][MANAGER]` — `server/access.js:176-178`; cell `[HR_ADMIN, FINANCE, COMPLIANCE_VIEWER]` — `access.js:114` | the dashboard is served to three roles; a manager is refused (403, **no body** — `access.js:401`, `:403`); **no minimum cohort size exists anywhere** (`git grep -niE 'min_?cohort|minimum cohort|suppress'` → the only hit is the comment naming the question) |
| **2.** A candidate's contact details before the start date | item **4** | **27** | `COUNSEL_PENDING['preboarding:read'][MANAGER]` — `access.js:170-172`; **and** `PENDING_CELLS['preboarding:read'][MANAGER]` — `access.js:157-159` | refused twice over: by the missing case→person link and by this question. `preboarding_cases` has no `employee_id`; it carries `candidate_name`, `candidate_email`, `role`, `department`, `reporting_line`, `jurisdiction`, `start_date`, `source` (`server/schema.sql`) |
| **3.** What the person sees of their own pre-boarding record | item **5** | **27** | `COUNSEL_PENDING['preboarding:read:own'][EMPLOYEE]` — `access.js:173-175`; the own cell is granted to `HR_ADMIN` only — `access.js:126` | the own view is **ruled** (option (a), bounded: read-only, own record, field-limited — `docs/access-model.md:196-224`) and **not served** (the same missing link). The workspace track is active for `['AE']` only (`server/preboarding-workspace.js:138`) |

## 2. Premise audit — every sentence of the letter that describes our software

| Letter sentence | Verdict | Measured |
|---|---|---|
| "Our product holds two kinds of personnel record … employee record … salary, department, start and end dates" | TRUE | `server/schema.sql` — `employees` carries `basic_salary`, `total_salary`, `department`, `start_date`, `end_date` |
| "… a pre-boarding case: a candidate's name, an email address, the role and department … the reporting line, the start date, and the documents and steps we chase" | TRUE | `preboarding_cases.candidate_name`, `.candidate_email`, `.role`, `.department`, `.reporting_line`, `.start_date`; the items are `preboarding_items` |
| "a person signs in with one role" | TRUE | one `users.access_role` per account; the gate matches a single `req.user.access_role` (`access.js:403`) |
| "… where a role reaches nothing, the request is refused and the caller is told nothing about what exists" | TRUE | `res.status(403).end()` (`access.js:401`, `:403`; `index.js:166`) |
| "We serve a dashboard … to HR, to finance, and to a read-only compliance role" | TRUE | `access.js:114`; matrix row `docs/access-model.md:238` |
| "headcount, payroll cost, accrued end-of-service liability, an average time-to-productivity per department, a retention percentage per half-year start cohort" | TRUE | `server/index.js:700-740` — `ttvByDepartment.push({department, avgDays, target: 15})`; `retentionLiftSeries` keyed `{half} {year}`; `eosbByJurisdiction`; the payroll/headcount cards read the same active set |
| "We publish no cohort's size" | TRUE | the retention payload is `{cohort, retention, benchmark, lift}` — no `total` (`index.js:729-738`) |
| "we apply no minimum group size" | TRUE | no threshold in `server/` or `client/src`; the only occurrence of the phrase is the comment naming the question (`access.js:177`) |
| "A manager of a team is refused the dashboard altogether" | TRUE | `MANAGER` is not in `analytics:read` (`access.js:114`) |
| "… and we have marked that refusal as waiting on your answer" | TRUE | `COUNSEL_PENDING` (`access.js:169-179`) |
| "We intend the manager of that reporting line to be able to read their own line's pre-boarding cases" | TRUE as policy intent | `PENDING_CELLS['preboarding:read'][MANAGER]` = *"permitted by policy, NOT YET EXPRESSIBLE"* (`access.js:136-159`) |
| "We do not serve that today: nothing in our data yet says which case belongs to which person" | TRUE | `preboarding_cases` has no `employee_id`; the only link is the demo convention `source = 'roster:<employee id>'`, and a real case is `source = 'intake_form'` (`access.js:145-155`) |
| "… so the manager's access is refused" | TRUE | the gate reads `POLICY` alone, so a `PENDING_CELLS` role cannot pass (`access.js:136-141`) |
| "For each case we keep two tracks …" | TRUE | `preboarding_items.track` ∈ {employee, workspace}; `preboarding-workspace.js:18-33` |
| "… each line names the function responsible for it (IT, Admin, HR or the manager), its due date, and who last moved it" | TRUE | `WORKSPACE_CATALOG` — `owner: 'IT' \| 'Admin' \| 'HR' \| 'Manager'`, `due_offset_days`; the due date is derived on read; `last_actor` is read back as who moved the line (`preboarding-items.js:191`) |
| "We have ruled that a person may read their own pre-boarding record — their own items, and the notice as it was shown to them — read-only and limited to the fields asked of them" | TRUE as a ruling | `docs/access-model.md:196-224` (option (a), with the projection's strip-list) |
| "we do not serve it yet" | TRUE | `preboarding:read:own` = `[HR_ADMIN]` (`access.js:126`); the employee's cell is `COUNSEL_PENDING` |
| "Until you confirm … we will not describe this access model as "compliant"" | TRUE | `git grep -ni 'compliant' -- server client/src` → **no hits** |

**Sentences that assert nothing about us and need no measurement:** the request for the article and the Arabic wording, the offer of a fee and turnaround, and the framing *"We are asking what the law permits or requires, not for a design opinion."*

## 3. What this letter deliberately does **not** do

- **It takes no legal position.** Every numbered item is a question. No article is named, no requirement asserted, no safe harbour offered — the product's own refusal is described as a refusal, not as compliance.
- **It quotes no internal document.** No file path, no §-number, no decision number, no refusal body appears in the letter. The mapping lives in §1 above, which is not sent.
- **It chooses no recipient.** Decision 15(a).
- **It does not repair anything.** The three cells stay refused; the schema question (`preboarding_cases.employee_id`) stays a schema decision; nothing in `server/` or `client/src` is touched by this deliverable.
- **It does not touch the KSA or PDPL letters.** Those are audited separately (`ksa-eosb-counsel-claim-set-2026-10-26.md`, `counsel-package-premise-audit-2026-10-24.md`).

## 4. One correction to the task that assigned this letter

The task describes decision 27's three questions as *"a manager reading its own onboarding tasks; the write/read-only item; departmental scoping"*. Measured, those are three **owner** decisions, not counsel items, and not decision 27:

| Described as | Actually is | Where |
|---|---|---|
| a manager reading its **own** onboarding tasks | **decision 25** — §8 item **9**, *owner* | `docs/access-model.md:404-410` |
| the write / read-only item | **decision 26** — §8 item **10**, *owner* (`compliance_viewer` vs the acknowledgement POST) | `:411-417` |
| departmental scoping | **decision 24** — §8 item **7**, *owner* | `:398-400` |

**Decision 27 is §8 items 3, 4 and 5** — the document says so in three places and in its own check command. The letter above is written for **3, 4 and 5**, which is what the task's own title names. The three owner items cannot go to counsel: they are policy calls (does a manager read their own steps; may a read-only role write one field; is scope a role attribute), and a counsel letter asking them would be asking a lawyer to make a product decision.

## 5. What I could not measure

1. **What a manager actually receives today** — no token was used; the refusal is measured from the policy table and the gate's own shape, and from `server/access.test.js:334-345` (which asserts the two markers are distinct and that a `COUNSEL_PENDING` role is never in the cell). A live manager request was not issued.
2. **Whether a counsel answer on item 4 is implementable when it arrives.** It is **not**, today: the missing case→person link (§8 item 8) is a schema decision, and until it lands the cell cannot be enforced in either direction. That is stated in the letter as a fact about our data, not as a request.
3. **The dashboard's live figures** — not read (no token). The payload's *shape* is measured from `server/index.js:700-740`, which is what the letter describes.
4. **Whether the notice says anything about managers or aggregates.** Checked: it does not, so the letter makes no claim about it (the PDPL letter is where the notice's content is asked about).

## 6. Reproduction

```bash
git -C /home/team/shared/probable-octo-sniffle rev-parse HEAD                    # f2c7b2b
git diff --name-only 3257047 f2c7b2b -- server client scripts templates           # empty
git show f2c7b2b:docs/access-model.md | sed -n '386,400p;443,450p;460,470p'       # §8 items 3-5 and decision 27
git show f2c7b2b:server/access.js | sed -n '108,130p;136,180p'                    # cells, PENDING_CELLS, COUNSEL_PENDING
git show f2c7b2b:server/index.js | sed -n '700,740p'                              # the aggregate payload's shape
git show f2c7b2b:server/schema.sql | sed -n '/preboarding_cases/,/);/p'           # no employee_id
git grep -niE 'min_?cohort|minimum cohort|suppress' f2c7b2b -- server client/src   # no threshold
git grep -ni 'compliant' f2c7b2b -- server client/src                             # no hits
```

**Sign-off:** nothing sent, no recipient named, no legal position asserted, no code or document edited — this twin and the letter beside it are the only writes, and the letter is the first send-ready text decision 27 has had.
