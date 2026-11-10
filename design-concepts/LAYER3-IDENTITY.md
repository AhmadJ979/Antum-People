# Layer 3 · Slice 1 — signing in as a real person

**Design for owner decision 11's first slice** (accounts, RBAC, "My lines"), written beside the build, not
after it. This file covers the **identity surfaces**: how a person signs in as themselves, how the product
says who is signed in, what a reader sees when a **record names the person who made it** (decision 22), and
what an **unnamed-actor refusal** looks like on screen.

- **Re-measured 2026-11-06 onto `origin/main` = `48da36e`** (`client/src/App.tsx`, **3,400 lines**; `server/index.js`
  1,856; `server/schema.sql` 474) — the fifth doc-truth pass. Every pointer below was re-derived **by content**
  against those files, not by arithmetic; a pointer that moved is re-numbered, one that still lands is left alone.
  A pointer carrying `@rev <sha>` is a **record at that tree** and is not re-numbered to today's lines. A sentence
  saying a screen **is** X is a claim and was judged against the code; one saying it **should** be X is design intent
  and is left as intent — not marked false for being unbuilt, but not left reading as though it were built either.
- **Re-measured 2026-10-20 onto `origin/main` = `ab7e9c3`** (`client/src/App.tsx`, **2,539 lines**) — the **third tree in one day**: **PR #254 merged at
  09:37:41, one minute before this document merged at 09:38:21**, and moved `App.tsx` again (+10 lines). A
  re-measurement is only as fresh as the tree it is measured against, so this branch ships **`check-doc-citations.py`**
  (in `docs/evidence/no-403-claim-sweep-2026-10-20/`), which **fails** when an `App.tsx:<n>` citation here does not
  land on the content it names. Readings: `7a4e00a` 2,529 lines, `7b073f8` 2,494. The justification this file
  used for leaving its citations un-re-dated — that `git diff --name-only 7b073f8 origin/main -- client server` was
  **empty** — **is no longer true**: that diff now lists **21 paths** (`client/src/httpStatus.js` and
  `client/src/httpStatus.test.js` by **PR #241**; `App.tsx` grew **+45 lines**), so **every citation below was
  re-measured and re-numbered**, and the identity card's role field is now `access_role`.
- **Measured at `origin/main` = `7b073f8`** (`client/src/App.tsx`, 2,494 lines). The login card, the sidebar
  identity block and the checklist record line are read from the shipped file, not from a sketch.
- **Re-grounded 2026-10-19 onto `8b32d45`**, after `docs/access-model.md` merged (PR #220, row `6071930d`) — the
  document this file was written against while it was still in progress. That pass changed the **policy** citations only: what was `(open)` is now answered, and each answer is cited to its section.
- **What this file does not do:** it does not decide permissions. The roles and the roles × resources matrix
  are the compliance expert's (`docs/access-model.md`, row `6071930d`, in progress) and the mechanism that
  enforces them is the engineer's (row `7d54faac`). Every place the surface depends on either is marked
  **`(open)`** and named.
- No `client/` or `server/` file is changed by this document. It is a spec.

---

## 1. The surfaces

| # | Surface | State today | This slice |
|---|---------|-------------|------------|
| **S-L1** | Sign-in | `App.tsx:583` (card opens), its `Sign In` button at `:656` (the block was `@rev 7b073f8` `:327`–`431`) — a username field, a password field, `Sign In`, a recovery note | unchanged in shape; the copy stops implying the account *is* the person |
| **S-L2** | Who am I / sign out | `App.tsx:1767` (icon-only `Sign Out`), `:1773`–`:1785` identity card | the card shows a **person's name and role**, and its two fallbacks are removed |
| **S-L3** | The named actor on a record | `App.tsx:2977` prints `recorded by {ack.recorded_by} · basis {ack.lawful_basis}`; the second site `:3221` prints `{item.acknowledgement.recorded_by}` without the words; the checklist tick stores `completed_at` **and** `completed_by` (`server/schema.sql:50`, `:67`) and refuses a completion with no named actor (`server/index.js:814`–`:826`, `:856`–`:858`) | every record reads as *made by a person*, and says **which kind of person** |
| **S-L4** | The unnamed-actor refusal | the server answers **400**; the client renders the server's own sentence in a checklist notice bar (`App.tsx:3117`–`:3118`) | the refusal says what is missing and what to do, in the product's words |

---

## 2. S-L2 — who am I, and the two fallbacks that must go

**Today, read from the shipped file.** The sidebar card renders two fallback divs,
`{user?.username || 'Admin User'}` and `{user?.access_role || 'Administrator'}` — at `@rev 48da36e` `App.tsx:1726`–`1727`; at `@rev ab7e9c3` `App.tsx:1222`–`1223`;
at `@rev 7a4e00a` `App.tsx:1212`–`1213`, the same `{user?.access_role || 'Administrator'}` pair;
at `@rev 7b073f8` `App.tsx:1196`/`App.tsx:1197` — `{user?.username || 'Admin User'}`, then `{user?.role || 'Administrator'}` (the role fallback there reads `role`, not `access_role`):

```
<div className="text-xs font-bold text-white truncate">{user?.username || 'Admin User'}</div>
<div className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{user?.access_role || 'Administrator'}</div>
```

Two findings, both worth fixing in this slice because slice 1 is what makes them false:

1. **The default renders an administrator.** If `user` is missing a field — a partial `antum_user` in
   `localStorage`, an older token payload — the card shows **`Admin User` / `Administrator`**. That is a
   *claim of privilege* produced by an absence of data, on the one screen whose job is to say who you are.
   A default must never be the most privileged value. **Proposed:** no name → no name. Render the handle
   with a visible qualifier (see 2 below) and, if the role is absent, render nothing rather than a role.
2. **A login handle is displayed where a person's name belongs.** `username` is an identifier
   (`scratch-admin`); it is not a name. Measured at `@rev 48da36e`: `users` carries `id, username, password_hash, access_role, created_at, employee_id` (`server/schema.sql:187`–`:194`) — **still no display name, no email**, but the link to `employees` now exists. So "sign in as
   a real person" needs a **display-name** field the schema does not have; the link is decided (`users.employee_id`, §2.2), the name is not. The design's requirement is only this:
   the card must be able to read as a person, and when it cannot, it must say what it is instead of
   guessing.

**Proposed card (same classes, same place, no restyle):**

```
Placed where the card is today — sidebar, under the brand row (`@rev 48da36e` `App.tsx:1706`, the `<div className="flex items-center space-x-3">` brand row; `:1215` at `ab7e9c3`)
  ┌──────────────────────────────────────────────┐
  │  [avatar]  Layla Haddad                      │   ← person's name, when the account carries one
  │            HR · Pre-boarding                 │   ← role, as the access model names it (open)
  └──────────────────────────────────────────────┘
  when the account carries no name:
  ┌──────────────────────────────────────────────┐
  │  [avatar]  scratch-admin                     │   ← the handle, and a qualifier that is true
  │            account — not linked to a person  │   ← (open: wording); never "Administrator"
  └──────────────────────────────────────────────┘
```

- **Sign out stays one tap and stays icon-only** (`App.tsx:1767`, `title="Sign Out"`). Do not move it, do
  not add a menu: a person must be able to leave the product without hunting, and the button already
  announces itself. Add an accessible name if the icon is ever unlabelled — today it relies on `title`.
- **The `role` string is the access model's vocabulary, not invented here** (`user?.access_role` at `App.tsx:1782` — the field is no longer named `role`) — and it is no longer
  `(open)`: `docs/access-model.md` **§2.1** names the five (`hr_admin`, `manager`, `finance`, `employee`,
  `compliance_viewer`). The card displays one of those; it makes no claim about what it permits.
- **The card must say *which* role it is showing.** The model's **§2.4** records a naming hazard this
  surface runs straight into: `users.role` (a permission) collides by name with `employees.role` and
  `preboarding_cases.role` (both **job titles**), and recommends renaming it to `access_role`. A card that
  renders the bare word *manager* beside a person whose job title is also Manager is the collision, on the
  one screen whose job is to say who you are. **Requirement: label it as an access role, and read
  `access_role`.** The rename has landed (`server/schema.sql:191`; `server/index.js:299`), so the card reads it today.

---

## 3. S-L3 — what a reader sees when a record names a person

Three different readers read the same record, and the design must serve all three without lying to any:

| Reader | Where they meet the record | What they need | What must never happen |
|--------|---------------------------|----------------|------------------------|
| **HR, at work** | checklist row / case detail | who did this, so they can ask them | a name that is really a shared login |
| **The person themselves** | their own view (§ see `LAYER3-EMPLOYEE-OWN-VIEW.md`) | who acted *on my record* | "recorded by admin" — unreadable to the person it is about |
| **An auditor / counsel** | the record as stored | a name, a time, a basis, and no inference | a claim that the *person acted* when only a device did |

**The record's anatomy, as stored today** — measured, not proposed:

- `preboarding_notice_acknowledgements` (`server/schema.sql`): `recorded_by TEXT NOT NULL` (currently a
  **string** — `scratch-admin` in the served pass), `instrument CHECK ('notice_shown')`, `lawful_basis`,
  `notice_version`, `acknowledged_at`, `method`, `note`. The record already carries the basis and the notice
  version; it is the *actor* that is a bare string.
- `preboarding_items.last_actor TEXT` — also a string (the seeded rows read `demo-seed`).
- The checklist tick — **measured here, and there are two of them**: `server/index.js:801`–`:819`
  (`PUT /api/onboarding-tasks/:id`) and `:838`–`:851` (`PUT /api/offboarding-tasks/:id`) both write
  `completed_at = datetime('now')` on completion **and `completed_by`** — decision 22, which has since landed:
  a completion with no named actor is refused 400 (`:814`–`:816`, `:846`–`:848`). *(At `7b073f8` the same
  two routes were `:315`–`:318` and `:321`–`:324` and wrote no actor; the engineer's row cited `:317`–`330`.)*
- **The model found a worse case than a missing actor, and it strengthens rule 2 below.** Its **§5.2.1**:
  `POST /api/employees` and `PUT /api/employees/:id` recorded the literal `'system'` as the actor (`server/index.js:224`,
  `:292` at `7b073f8`) — *"a field that exists and holds a false name is a record a future reader will trust."*
  That is this document's rule stated better than I had it: **an actor field that is present and wrong is worse than
  one that is absent.** **Corrected since:** both paths now refuse an unnamed actor (`server/index.js:538`, `:645`).
- **The policy for the tick is now settled:** `docs/access-model.md` **§5.2.3** — the tick gains
  `completed_by` (decision 22) with **the same 400** as the pre-boarding side. §5.2.2 adds that the
  `|| 'system'` fallbacks become `|| null` plus that refusal, and §5.2.4 makes the autonomous actor an
  explicit separate value, never a fallback.

**Proposed reading of a record — three parts, in this order:**

```
Privacy Notice — Shown
  Passport copy · identity                        ← what the act was about
  shown 12 Oct 2026 · notice v2.3 · basis Legal obligation   ← when, which text, on what basis
  recorded by Layla Haddad (HR) — the signed-in user         ← WHO, and what kind of who
  One act, one record per document. Not a signature; the product cannot obtain one.
```

Three rules the design asks for, each traceable to something already decided:

1. **The actor is a person, and the surface says which kind of acting it is.** `recorded_by` names the
   person who *showed* the notice on the hire's behalf — not the hire, and not a signature. The server's own
   refusal already says this (`preboarding-items.js`: *"the record must name the person who showed the
   notice, on the hire's behalf"*), and the model confirms it independently
   (`docs/access-model.md` **§7**: the acknowledgement's actor *"is the HR user showing the notice, not the
   hire, and that stays true until 14 is decided"*). The surface may not say anything stronger than that.
2. **A record with no actor renders as incomplete, never as anonymous.** After this slice, an absent actor is
   a defect; the surface says *"no actor recorded"* in the gap rather than showing only a date. (The tick's
   schema change has landed; rows written before it still carry no actor, which is what §6.2 now asks.)
3. **The stored value and the displayed label are not the same string.** Display *name (role)* when the
   account carries them; otherwise display the stored handle **with its nature visible** — e.g.
   `recorded by scratch-admin (account — not linked to a person)`. This is the same defect decision 20's
   item 3 covers on the HR side, and it is worse here: the reader can do nothing about a handle they do not
   recognise.

---

## 4. S-L4 — how the unnamed-actor refusal looks on screen

**Measured, from the server** (`server/preboarding-items.js`), when `recorded_by` is empty:

> HTTP **400** — *"recorded_by is required: there is no new-hire login in this release, so the record must
> name the person who showed the notice, on the hire's behalf"*

**Measured, from the client at `@rev 48da36e`** (`App.tsx`): a failure is dispatched into `preboardingNoticesReducer` and
rendered by `checklistBar` (`:3080`–`:3081`) with `data.error` if the server sent one — the `checklistNotice` banner measured
at `@rev 7b073f8` is gone. So the honest sentence **does** reach the screen; the question is whether it reads right.

**Proposed behaviour:**

- **400 = the request was incomplete (a bug or a bad client).** The banner shows the server's sentence, in
  the product's voice, and the surface marks the field it is about. It does not say "permission denied" —
  that is the 403 below and it means something else.
- **403 = this account may not make this record at all** (the engineer's deny-by-default mechanism). The
  design's rule: a 403 renders as *"Your account cannot record this."* plus **what would** — who to ask
  `(open: the asking path — decision 14's identity question is not this and is not answered here)`. A 403
  must never render the server's raw body or an empty banner: the body is empty by design, so the client
  must own this sentence.
- **Both refusals leave the record untouched** and say so: nothing was written, and the row still shows its
  previous state. A refusal that leaves the screen looking as if it succeeded is the failure this rule
  exists to prevent.

**Why this is a design item and not only a server one:** at `@rev 7b073f8` the checklist tick wrote `completed_at`
server-side with no actor, so the *only* actor refusal in the product was the pre-boarding 400. The tick now refuses
the same way (`server/index.js:814`–`:816`), so a person can hit it — and the UI has to be ready to say why.
Its sentence is *"a named actor is required to complete a task"*, which names the gap but not the remedy.

---

## 5. EN/AR and RTL — what these surfaces cost

No Arabic copy ships with this slice (decision 15(c) is open). The requirement is that nothing added here
**blocks** the pass. Read on `main` at `cb819d7`, with each row's `7b073f8` figure kept wherever it has moved:

| Pattern | Count in `client/src/App.tsx` (`@rev cb819d7`) | Note |
|---------|------------------------------|------|
| `space-x-*` | **30** | physical; `space-x-reverse` is used **0** times — was **28** at `7b073f8` |
| `gap-*` | **32** | direction-agnostic — use it for new groups; was **23** at `7b073f8` |
| `ml-` / `mr-` | **4** / **6** | → `ms-` / `me-` when the pass runs; `mr-` was **5** at `7b073f8`, `ml-` is unchanged |
| `text-left` / `text-right` | **7** / **3** | → `text-start` / `text-end`; `text-left` was **6** at `7b073f8`, `text-right` is unchanged |
| `text-start` / `text-end`, `border-s-`/`-e-`, `rounded-s-`/`-e-` | **0** | nothing logical is used yet — still **0** at `cb819d7` |
| `border-r-*` | **2** | both are **chart rule lines**, not chrome: a benchmark marker (`:1681`) and a target marker (`:1711`) at `7b073f8` — `:2399` and `:2429` at `48da36e`, and the same two lines at `cb819d7`, still 2 — each drawn with an inline `left:`. Neither is on these surfaces, and whether a chart mirrors is a real decision, not a bug — flagged here only so it is not mistaken for spacing. |
| `dir=` / `lang=` | **1** / **0** in `App.tsx` — **4** / **0** in `client/src` | The groundwork exists; the interface does not. **4** elements carry `dir="auto"` in the rendered DOM: `markdownView.js:107` (a `th`), `:122` (a `td`) and `:153` (the served-document container `div`), written as `dir: 'auto'` props so a `dir=` grep of that file returns only prose — plus `App.tsx:3571` (a `<p>`; the file's other `dir=` match, `:3547`, is a comment). `lang=` is genuinely **0**. What does **not** exist: no language state, no switch, no mirrored layout, no Arabic UI string — the only Arabic in `client/src` is the wordmark in a comment at `typefaces.test.js:33`. |

**The two surfaces added here are the ones with the most physical markup in the product**, measured in place:
the identity block (`App.tsx:1773`–`:1785`, `space-x-3` at `:1774`) and the login card (opens `:583`) use `justify-end` (`:625`), `ml-3` (the dismiss button, `:643`) and `mr-2` (the error icon, `:596`); the card's block was `@rev 7b073f8` `:357`–`431`. Rules for anything
new:

1. **Spacing inside the identity card and any new row goes through `gap-*` on a flex container**, never
   `space-x-*`. This avoids the whole `space-x-reverse` class of bug rather than pairing around it.
2. **The dismiss control moves to the row's logical end** (`ms-auto`), not `ml-3`. In RTL the close button
   belongs on the left, and `justify-end` on a flex row already handles that — keep the flex, drop the
   physical margin.
3. **What must not mirror:** `username`, emails, and any identifier in the identity card. The avatar block
   mirrors; the handle does not. Wrap handles, emails and IDs in `<bdi>` so a Latin run cannot reorder
   inside an Arabic sentence.
4. **A name is not a string to be uppercased.** The card's role line is `uppercase` today
   (`App.tsx:1755`; `:1216` at `7b073f8`); keep that only for values that are Latin-cased
   vocabulary from the access model, and drop it for a person's name.
5. **The refusal banner wraps, it does not truncate.** Arabic is longer; the refusal is the one message that
   must stay readable in full. No `truncate` on it (the identity card's name may truncate; the refusal may
   not).

The full direction pass, its costs and its numerals/date rules are already specified in
`LAYER2-PREBOARDING-UI.md` §8B — **follow that document; do not invent a second convention.** This section
adds only what the two new surfaces change.

---

## 6. Open questions — asked, not answered

1. **Narrowed, not closed: what field carries a person's *name*?** The *link* is now decided —
   `docs/access-model.md` **§2.2** adds `users.employee_id` (nullable, unique when set) and **§8.7** assigns
   it to slice 2. But a **display name** is still unmodelled: `users` is
   `(id, username, password_hash, access_role, created_at, employee_id)` (`server/schema.sql:187`–`:194`), so until a name field exists the card shows a handle
   plus a qualifier — which is exactly what §2 below specifies.
2. **Answered: the checklist tick's actor did need a schema change, and it has landed.** `completed_by` is on both
   task tables (`server/schema.sql:50`, `:65`) and both routes refuse a completion with no named actor
   (`server/index.js:814`–`:816`, `:846`–`:848`), so §3.2's "no actor recorded" state renders only for older rows.
3. **Answered for the vocabulary, still the model's for the matrix:** `docs/access-model.md` **§2.1** names
   the five roles and **§3** is the allow-list. The card shows one of the five; this design coins none. Open
   only in that the model's **§8.5** and **§8.6** are owner questions (`compliance_viewer` in the minimum
   set; departmental scoping as a scope rather than a role).
4. **`(open)` Decision 13 (standing):** new accounts must not reuse or expose the demo credential. The
   sign-in surface does not change; the *accounts* the demo ships with must change. Worth stating on the
   surface that a shared login is not a person if the demo is shown before plural accounts land.

---

## 7. What this document does not claim

- It does **not** claim any of it is built. Parts have since shipped (the `access_role` rename, the tick's
  `completed_by`, the unnamed-actor 400, the refusal screen) and are marked so above; the rest is still design.
- It does **not** claim the identity card is a security boundary. It is a **display** of who is signed in;
  the boundary is the deny-by-default mechanism the engineer is building, and the matrix behind it.
- It does **not** restyle anything. Every proposal reuses the shipped classes and the shipped placement; the
  only removals are two fallbacks that are wrong.
