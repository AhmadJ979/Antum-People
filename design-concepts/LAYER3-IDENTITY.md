# Layer 3 · Slice 1 — signing in as a real person

**Design for owner decision 11's first slice** (accounts, RBAC, "My lines"), written beside the build, not
after it. This file covers the **identity surfaces**: how a person signs in as themselves, how the product
says who is signed in, what a reader sees when a **record names the person who made it** (decision 22), and
what an **unnamed-actor refusal** looks like on screen.

- **Measured at `origin/main` = `7b073f8`** (`client/src/App.tsx`, 2,493 lines). The login card, the sidebar
  identity block and the checklist record line are read from the shipped file, not from a sketch.
- **What this file does not do:** it does not decide permissions. The roles and the roles × resources matrix
  are the compliance expert's (`docs/access-model.md`, row `6071930d`, in progress) and the mechanism that
  enforces them is the engineer's (row `7d54faac`). Every place the surface depends on either is marked
  **`(open)`** and named.
- No `client/` or `server/` file is changed by this document. It is a spec.

---

## 1. The surfaces

| # | Surface | State today | This slice |
|---|---------|-------------|------------|
| **S-L1** | Sign-in | `App.tsx:317`–`431` — a username field, a password field, `Sign In`, a recovery note | unchanged in shape; the copy stops implying the account *is* the person |
| **S-L2** | Who am I / sign out | `App.tsx:1182` (icon-only `Sign Out`), `:1188`–`1200` identity card | the card shows a **person's name and role**, and its two fallbacks are removed |
| **S-L3** | The named actor on a record | `App.tsx:2062` / `:2117` print `recorded by {recorded_by}`; the checklist tick stores `completed_at` and **no actor** | every record reads as *made by a person*, and says **which kind of person** |
| **S-L4** | The unnamed-actor refusal | the server answers **400**; the client shows a generic error banner | the refusal says what is missing and what to do, in the product's words |

---

## 2. S-L2 — who am I, and the two fallbacks that must go

**Today, read from the shipped file** (`App.tsx:1195`–`1198`):

```
<div className="text-xs font-bold text-white truncate">{user?.username || 'Admin User'}</div>
<div className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{user?.role || 'Administrator'}</div>
```

Two findings, both worth fixing in this slice because slice 1 is what makes them false:

1. **The default renders an administrator.** If `user` is missing a field — a partial `antum_user` in
   `localStorage`, an older token payload — the card shows **`Admin User` / `Administrator`**. That is a
   *claim of privilege* produced by an absence of data, on the one screen whose job is to say who you are.
   A default must never be the most privileged value. **Proposed:** no name → no name. Render the handle
   with a visible qualifier (see 2 below) and, if the role is absent, render nothing rather than a role.
2. **A login handle is displayed where a person's name belongs.** `username` is an identifier
   (`scratch-admin`); it is not a name. Measured: `users` carries `id, username, password_hash, role,
   created_at` (`server/schema.sql`) — **no display name, no email, no link to `employees`.** So "sign in as
   a real person" needs a field the schema does not have. **`(open)` — which field, decided by the
   access-model row and the engineer's slice, not by this design.** The design's requirement is only this:
   the card must be able to read as a person, and when it cannot, it must say what it is instead of
   guessing.

**Proposed card (same classes, same place, no restyle):**

```
Placed where the card is today — sidebar, under the brand row (App.tsx:1188)
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

- **Sign out stays one tap and stays icon-only** (`App.tsx:1182`, `title="Sign Out"`). Do not move it, do
  not add a menu: a person must be able to leave the product without hunting, and the button already
  announces itself. Add an accessible name if the icon is ever unlabelled — today it relies on `title`.
- **The `role` string is the access model's vocabulary, not invented here.** Until `docs/access-model.md`
  lands, the card shows the role value the login response already returns (`{id, username, role}`) and the
  design makes no claim about what it permits.

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
- The checklist tick — **measured here, and there are two of them**: `server/index.js:315`–`318`
  (`PUT /api/onboarding-tasks/:id`) and `:321`–`324` (`PUT /api/offboarding-tasks/:id`) both write
  `completed_at = datetime('now')` on completion and **no actor** — decision 22, which this slice closes,
  and both routes need it. *(The engineer's slice-1 row cites the same tick as `:317`–`330`; the range above
  is what I read on `7b073f8`. Either way it is the same two routes.)*

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
   notice, on the hire's behalf"*), so the surface may not say anything stronger.
2. **A record with no actor renders as incomplete, never as anonymous.** After this slice, an absent actor is
   a defect; the surface says *"no actor recorded"* in the gap rather than showing only a date. (Until the
   schema change lands, existing rows have no actor — that is what `(open)` above is about.)
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

**Measured, from the client** (`App.tsx`): failures render into one banner (`checklistNotice`,
`:2348`–`2349`) with `data.error` if the server sent one. So the honest sentence **does** reach the screen —
the design question is whether it reads correctly and is attributed to the right act.

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

**Why this is a design item and not only a server one:** today the checklist tick writes `completed_at`
server-side with no actor, so the *only* actor refusal in the product is the pre-boarding 400. This slice
makes the tick refuse the same way — and the moment it does, a person can hit it. The UI has to be ready to
say why.

---

## 5. EN/AR and RTL — what these surfaces cost

No Arabic copy ships with this slice (decision 15(c) is open). The requirement is that nothing added here
**blocks** the pass. Read on `main` at `7b073f8`:

| Pattern | Count in `client/src/App.tsx` | Note |
|---------|------------------------------|------|
| `space-x-*` | **28** | physical; `space-x-reverse` is used **0** times |
| `gap-*` | **23** | direction-agnostic — use it for new groups |
| `ml-` / `mr-` | **4** / **5** | → `ms-` / `me-` when the pass runs |
| `text-left` / `text-right` | **6** / **3** | → `text-start` / `text-end` |
| `text-start` / `text-end`, `border-s-`/`-e-`, `rounded-s-`/`-e-` | **0** | nothing logical is used yet |
| `border-r-*` | **2** | both are **chart rule lines**, not chrome: a benchmark marker (`:1681`) and a target marker (`:1711`), each drawn with an inline `left:`. Neither is on these surfaces, and whether a chart mirrors is a real decision, not a bug — flagged here only so it is not mistaken for spacing. |
| `dir=` / `lang=` | **0** / **0** | no direction handling exists |

**The two surfaces added here are the ones with the most physical markup in the product**, measured in place:
the identity block (`App.tsx:1173`–`1200`) uses `space-x-3` twice, and the login card (`:347`–`431`) uses
`justify-end`, `ml-3` (the dismiss button, `:409`) and `mr-2` (the error icon, `:362`). Rules for anything
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
   (`:1197`); keep that only for values that are Latin-cased vocabulary from the access model, and drop it
   for a person's name.
5. **The refusal banner wraps, it does not truncate.** Arabic is longer; the refusal is the one message that
   must stay readable in full. No `truncate` on it (the identity card's name may truncate; the refusal may
   not).

The full direction pass, its costs and its numerals/date rules are already specified in
`LAYER2-PREBOARDING-UI.md` §8B — **follow that document; do not invent a second convention.** This section
adds only what the two new surfaces change.

---

## 6. Open questions — asked, not answered

1. **`(open)` What field carries a person's name?** `users` has `username` and no display name, no email,
   no link to `employees` (`server/schema.sql`). Until this is decided the identity card can only show a
   handle plus a qualifier.
2. **`(open)` Does the checklist tick's actor need a schema change?** The engineer's row asks it explicitly
   (`server/index.js:315`–`324` → `completed_by`, on **two** routes). The design needs only to know *whether
   an actor is always present* — that decides whether §3.2's "no actor recorded" state ever renders.
3. **`(open)` The role vocabulary and the allow-list** — `docs/access-model.md` (row `6071930d`). The card
   shows whatever that document names; this design does not coin a role.
4. **`(open)` Decision 13 (standing):** new accounts must not reuse or expose the demo credential. The
   sign-in surface does not change; the *accounts* the demo ships with must change. Worth stating on the
   surface that a shared login is not a person if the demo is shown before plural accounts land.

---

## 7. What this document does not claim

- It does **not** claim any of it is built. Slice 1 is in flight (rows `7d54faac`, `6071930d`); this is the
  design it should be built against, delivered ahead of it on purpose.
- It does **not** claim the identity card is a security boundary. It is a **display** of who is signed in;
  the boundary is the deny-by-default mechanism the engineer is building, and the matrix behind it.
- It does **not** restyle anything. Every proposal reuses the shipped classes and the shipped placement; the
  only removals are two fallbacks that are wrong.
