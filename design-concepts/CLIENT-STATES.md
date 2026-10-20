# One empty screen — five states, and the event the row did not name

**Design for row `66636525`.** This is the **re-grounded** revision, and it is a **correction of merged work**.
Three things happened to this file while it was being written, and the third one is why it must be read as a
correction rather than a proposal:

1. **PR #241 merged** as `0e401cf` (`client/session-vs-refusal`) — the mechanism this document checks. The
   earlier draft, cut from `ee4bbdf`, asserted that the client had no 403 handling at all. That was true at
   `ee4bbdf` and false the moment #241 landed, so the draft was rewritten from scratch against the code that
   had just shipped.
2. **`main` moved twice more** — `70cdd91` (PR #245, the `users.employee_id` index control) and `8ec9f69`
   (PR #242, round 52's cutover evidence). Measured, not assumed: neither touches a file cited below, and the
   same 72-claim checker re-run at each holds **72/72**, control **71/72**. So every number here is valid at
   the current `main`, not only at the revision it was first read from.
3. **The draft itself merged** — as **PR #244**, at **`8ec9f69`**, one second before its withdrawal could
   land. So **`main` carries the refuted sentences today**, in the file this revision replaces:
   *"The client contains no 403 handling at all"* and, in its §2, *"There is no `403` branch anywhere."*
   They are not annotated here; they are **removed**, and the measurement that refutes them is filed beside
   this document. The merged text is blob `567bfd49a63b00ded44cf7bc22ea3953ce534b08`, md5
   `e8234aafab2c22f92896c4b2191d721f`; this revision's own hash is recorded in the evidence directory's
   README, because a file cannot state the hash of the bytes a reader is currently holding.
   *The rule is the one the access model used for a rename it had recorded as deferred: the fact moved, so the
   sentence moves with it.*

- `client/src/App.tsx` is **2,528 lines** at `0e401cf` (2,493 at `ee4bbdf`) — the merged text's counts were
  right when taken and describe a tree `main` no longer has.
- **What these measurements are, and are not.** Every claim is a **reading of a code path**, with the path
  named. A credentialed pass against the live product is out of bounds, so **nothing here was rendered** — the
  renders below are derived from the path, and §9 says who owes the photograph.
- **No `client/` or `server/` file is changed by this document.** Where a change is needed it is said, and it
  becomes its own row.

---

## 0. The rule, stated as a rule

**A refusal must be visible as a refusal.** Three corollaries, because the inverse failures are as bad and two
of them are live on `main`:

1. **An empty result must never wear a refusal's clothes, and a refusal must never wear an empty result's.**
   They are different facts about the world and the reader does something different about each. **§3 finds
   both on one screen.**
2. **Silence is a claim.** A blank panel says *"there is nothing here"* — an assertion about data the client
   has not verified. The client may render an empty state **only** after a *successful* response said so.
3. **A refusal is not a fault, and a fault is not a refusal.** The product already rules this for empty
   states (`LAYER3-EMPLOYEE-OWN-VIEW.md` §4 `:212`: *"an empty state never shows a red, an amber, or an error
   icon. Empty is a state, not a fault"*). **§8 measures the shipped refusal against it.**

---

## 1. What landed in #241, and what it does not do

**It landed, and it is good work.** `client/src/httpStatus.js` (142 lines) classifies once for every
authenticated call, and `App.tsx` routes all of them through it:

- `classifyHttpStatus(status, bodyText)` (`:59`) — `401` → `SESSION_INVALID`; **`403` → `hasBody ?
  SESSION_INVALID : REFUSAL`** (`:62`); 2xx → `OK`; else `OTHER`.
- `actionFor` (`:42`) — `SESSION_INVALID` → `'sign-out'`, `REFUSAL` → `'refusal-notice'` (`:47`).
- The wrapper (`:113`) classifies only for 401/403 (`:124`), calls `onSessionInvalid` and **throws
  `SessionExpiredError` on a 403-with-body** (`:133`) so no caller parses an error payload as data, and calls
  `onRefusal` and **throws `RefusalError`** (`:138`) on a refusal — keeping the session.
- `App.tsx`: the refusal is **one global banner above the content** (`:1283`–`:1302`), `role="alert"`, amber,
  a lock icon, dismissible, and retired when the tab or jurisdiction changes (`:577`).

**Three things it does not do**, all still measured on `main`:

1. **The dashboard's call site still has no failure branch.** `fetchData` (`:594`) fetches `/api/employees`
   (`:599`) and the analytics dashboard, tests nothing but the wrapper's throws, then coerces
   (`safeEmpData = Array.isArray(empData) ? empData : []` `:612`; `setAnalytics(anaData && !anaData.error ?
   anaData : null)` `:614`), and swallows everything in `catch (err)` (`:624`, logging at `:625`). `employees`
   starts as `[]` (`:443`) and `analytics` as `null` (`:447`).
2. **A refused region still asserts emptiness** — §3.
3. **A request that never completed still renders as `No data yet`** — §5.

---

## 2. The four states

One sentence each. "Form" is how they differ **structurally**, because colour alone is not a difference — it
fails for a colour-blind reader, in Arabic, in a screenshot, and in a printout.

| # | Trigger (measured) | What is true | The sentence | Form | Action |
|---|---|---|---|---|---|
| **1** | **401** — `auth.js:26` | the caller never presented a session | *(the existing sign-in card, `App.tsx:363`–`:364`)* | the **whole surface** is replaced | sign in |
| **2** | **403 + body** — `auth.js:31` | a session existed and is over | **"Your session has ended. Sign in again to continue."** (proposed — #241 reaches the card but states no reason) | the card, plus that line | sign in |
| **3** | **403, empty** — `access.js:376`, `:378`, `index.js:166` | the session is **fine**; this request was refused | **shipped: "You don't have access to that. Nothing was changed, and you are still signed in."** (`App.tsx:8`) | a banner above the content | dismiss |
| **4** | **200** + empty result | genuinely nothing there | the sentences already shipped — §6 | sentence only, italic slate, **no heading, no action** | none |

**The three structural discriminators** — all four are distinguishable with styling removed:

- **Where it appears.** 1 and 2 replace the surface. 3 is a banner *above* it; 4 is *inside* it. (That
  difference is exactly what §3 is about.)
- **Whether there is an action.** 3 carries one; **4 must not** (an empty state has nothing to do).
- **Whether it accuses anyone.** 3 is about access; 4 is about the world. Neither may carry the other's words.

**On the shipped copy for state 3 — I am adopting it, not replacing it.** *"Nothing was changed, and you are
still signed in"* does two things the draft's alternative did not: it satisfies §7's rule that a refusal says
the record is untouched (*"both refusals leave the record untouched and say so"*, `LAYER3-IDENTITY.md` §4
`:170`–`:172`), and it states the one fact that distinguishes state 3 from state 2. The only thing it does not
carry is **what would** — who to ask — which §7 keeps open for the owner. **States 1 and 2 must render
identically; #241 reaches state 2 for the first time.**

---

## 3. Two opposite claims on one screen — the refusal banner over an empty dashboard

**This is the finding I would act on first, because it is a consequence of the merged design rather than a
gap it left open.** Measured from the code path:

1. The gate refuses `/api/employees` for the signed-in role → `403` with an empty body.
2. `createAuthedFetch` calls `onRefusal` (`httpStatus.js:137`) → `setRefusal(REFUSAL_NOTICE)` (`App.tsx:572`)
   → **the banner renders** (`:1283`).
3. Then it **throws** `RefusalError` (`:138`).
4. `fetchData`'s `catch (err)` (`:624`) swallows it; `setEmployees` never runs, so `employees` stays `[]`
   (`:443`); `setAnalytics` never runs, so `analytics` stays `null` (`:447`).
5. The dashboard below the banner therefore renders **six `No data yet` tiles** (`:1321`, `:1339`, `:1371`,
   `:1375`, `:1408`, `:1412`) plus `No active onboardings.` (`:1449`) and `No active offboardings.` (`:1477`).

**One screen, two contradictory statements:** *"You don't have access to that"* above four panels saying
*"there is no data"*. Corollary 1 of §0, exactly. And the second statement is the dangerous one, because it is
the one a demo viewer reads as *"the product has no data"* — which is the defect #241 set out to remove,
reached through a different door. **The refusal is now visible; it is the emptiness underneath that still
lies.**

The fix is a design choice, not a patch, and it is a small one — **whichever of these is taken, the region and
the banner must not contradict each other:**

- **(a) In place.** The refusal occupies the region it is about, replacing it. Then there is no second
  statement to contradict. Cost: a per-region refusal surface rather than one global banner.
- **(b) Suppress the empty state under an active refusal for that region.** Cheapest; keeps one banner. Cost:
  needs the banner to know *which* region it came from, which today's `onRefusal(url, status)` already
  receives (`:572` discards the url) and the state does not keep.
- **(c) Change the empty copy** so it cannot read as data-absence. Weakest: it treats the symptom in every
  string rather than the cause in one place.

**Recommendation: (b)** — the wrapper already passes the url to `onRefusal`, so keeping the *last refused
route* instead of a boolean is a one-line state change, and it makes "the notice must not outlive the request
that raised it" (the author's own comment at `:575`–`:577`) true for the region as well as for the tab.

---

## 4. The one 403 the classifier gets wrong — and why its own control misses it

`httpStatus.js:62` reads:

```js
if (status === 403) return hasBody ? SESSION_INVALID : REFUSAL;
```

and the docstring states the rule as a choice (`:21`–`:25`): *"a 403 carrying ANY body is treated as a dead
session… Where the split is ambiguous, signing out is the recoverable mistake."* **The reasoning is sound —
and the enumeration behind it is short by one.** Every 403 producer in `server/` at `0e401cf`:

| # | Site | Body | What it actually means |
|---|---|---|---|
| 1 | `server/auth.js:31` | `{"error":"Invalid or expired token"}` | `jwt.verify` failed — **the session is over** ✅ |
| 2 | **`server/index.js:65`** | **`{"error":"Forbidden"}`** | **the CORS origin guard** — the session is fine ❌ |
| 3 | `server/access.js:376` | *(empty)* | the resource is unnamed, or nobody may use it |
| 4 | `server/access.js:378` | *(empty)* | the caller's `access_role` is not in the resource's list |
| 5 | `server/index.js:166` | *(empty)* | the per-row **scope** refusal (`refuse`; named on 7 lines of that file) |

`httpStatus.js:8` names #1 as *the* body-carrying 403. **#2 was not in the list**, and it is the one the
classifier gets backwards: a valid session, on a refusal, is signed out.

**Why "signing out is the recoverable mistake" does not cover this one.** A sign-out is recoverable when the
next sign-in can succeed. For the CORS producer it cannot: the guard refuses **every** request from that
origin, so the user signs in and is signed out again, on a loop, with nothing on screen explaining why. A
recoverable mistake that recurs is not recoverable — it is a lockout, and the cause (a foreign `Origin`) is
invisible in the UI and only in the server's `console.warn` (`index.js:64`).

**And it is reachable in the product's own dev topology, not just a hypothetical.** `App.tsx:10`:

```js
const API_BASE = window.location.port === '5173' ? 'http://localhost:3000' : '';
```

When the client is served by Vite on **:5173** and the API is on **:3000**, the request carries
`Origin: http://localhost:5173` while `Host` is `localhost:3000`, so the same-host passthrough at
`index.js:60` **does not** apply, and unless `ALLOWED_ORIGINS` names `http://localhost:5173` the guard answers
`403 {"error":"Forbidden"}` — a body — for **every** call. On the served product (one host, no foreign Origin)
the branch is dead; in the dev configuration the client itself documents, it is live. *(I have not read the
deployed `ALLOWED_ORIGINS`; that is a one-line check for whoever takes this, and it decides whether this is a
demo-blocking case or a latent one — either way the classifier's rule is wrong.)*

**The cheapest correct fix is on the server and it makes the classifier simpler, not more complex:**
`auth.js:31` should answer **`401`**. An unverifiable token is an *authentication* failure — that is what 401
means in RFC 9110, and on the wire the server currently has 401/403 the wrong way round. Then **every 403 in
the product means one thing — refused** — and `classifyHttpStatus` needs no body inspection at all. It is a
`server/` change (its own row), and it does not disturb #241's structure: `actionFor`, both error classes and
the per-call-site wiring all still hold.

**If 401 is declined, the session signal must be machine-readable.** Then `auth.js` owes a stable field the
client keys on, and the fallback for an unclassifiable 403 must be **state 3** — never a sign-out and never
silence. A body-shaped guess cannot be made safe, only made lucky.

**The control already exists and has one named hole.** `httpStatus.test.js:61` is titled
*"the anti-vacuous control: a refusal must never be wired to a sign-out"* — the right instinct, already
written. What it does not do is send a **403 that carries a body and is not the session error**: the only
bodies in the file are `{"error":"Invalid or expired token"}` (`:32`) and a **404's** `{"error":"Employee not
found"}` (`:56`, `:123` — correctly `OTHER`). `Forbidden` appears nowhere. So:

> **the test owed is one line — a 403 carrying `{"error":"Forbidden"}` must not sign anyone out.**

That single case is the difference between a control that proves the refusal path and one that proves the
classifier.

---

## 5. Two things the row did not name — a screen only PARTLY allowed, and a request that never came back

### 5a. **State 5 — the screen was partly allowed and the granted part renders empty**

**The mechanism, measured by me at `ea6a531` and again at `8ec9f69`** (the served tree the defect was reported
from, and this branch's base): both loaders fetch **two things in one `Promise.all`** — `fetchData`
(`App.tsx:594`) pairs the roster with the analytics roll-up (`:598`), `fetchTasks` (`:997`) pairs onboarding
with offboarding (`:1000`). **One refused sibling rejects the pair, so the sibling that was granted is never
applied.** A region the caller is entitled to renders empty, under a notice saying they are not entitled to
something. For a `manager` — roster cell allowed, analytics cell not, per the matrix itself — **that is the
whole dashboard.**

**Unreachable today; reachable the moment a second account exists.** The one account is `hr_admin` and holds all
17 resources, so no demo path reaches it. It arrives with the second account — what decisions 25, 26 and 13 are
about.

| | |
|---|---|
| **what the screen shows** | every **granted** region renders its own data; the **refused** region renders the refusal *where its content would have been* |
| **where the refusal belongs** | **per panel, never one bar over everything.** A single bar is a claim about the whole screen, and when part of it was allowed that claim is false — **the same defect as §3, one level down**: §3 is two opposite claims on one screen, this is one true claim applied to the wrong region |
| **the rule** | **a refusal may not empty a region that was granted.** State 3 is not a substitute for data the caller is entitled to |
| **the mechanism** | each leg resolves independently (`allSettled`, or two awaits) and each region derives its state from **its own** result; the pair-rejection then becomes impossible by construction rather than by care |
| **the copy** | names **the area the client asked for**, never a resource the server holds — see 5c |

**What the client may say, given the empty body.** The server refuses with an **empty body on purpose**, so a
scoped caller learns nothing about what exists — this document does not weaken that. But **the client knows
which request it made**: naming the *area it asked for* ("the roster") tells the reader only what the client
already sent, so it is allowed. It is never allowed to say *what is in* the area, *how much of it*, or *that
the area exists at all* to a caller who did not ask for it.

### 5b. **Event 6 — the request that never came back**

Server down, connection dropped, non-JSON body. Measured: the wrapper does not catch a rejected `fetch`
(`:113`), so it propagates to the callers' swallows (`App.tsx:624`, `:743`), state is kept, and the dashboard
reads **`No data yet` while the server is unreachable**. **Proposed: "We couldn't load this."** with a
**Retry**. This is the one of the six that **is** a fault, so it is the one that may carry a fault colour;
states 3 and 5a must not. **Still unhandled by #241**, and I am not folding it in silently — a fix for the
four that leaves a dead server rendering `No data yet` has moved the defect rather than closed it.

### 5c. **The reviewed copy — these words are mine to set, not the owner's**

The shipped sentence is *"You don't have access to that. Nothing was changed, and you are still signed in."*
It is honest, and the copy is the design team's to set. Reviewed:

| where | the sentence | why this, and not the shipped one |
|---|---|---|
| **state 3**, per region | **"The roster isn't shared with your account. You're still signed in, and nothing was changed."** + **"Ask an administrator to grant access"** | *"that"* points at nothing the reader can see and reads as an accusation; the **area** is nameable (5a), and naming it is what turns a dead end into a fact. The action is the "what would" §7.1 asked for |
| **state 5a** | the **granted** panel gets **no notice at all**; the refused panel takes the state-3 sentence **with its own area named** | one page-wide bar would tell a manager their whole dashboard is refused when most of it is not |
| **state 1 / 2** | **"Your session has ended. Sign in again to continue."** | an unexplained return to the sign-in card mid-shift is what makes a user phone someone; saying *why* costs nothing |
| **event 6** | **"We couldn't load this."** + **Retry** | the only one that may say *couldn't*: the only one where something went wrong rather than was withheld |

**Never, in any of them:** that the data is *missing*; that an *error* occurred (states 3, 5a); that the session
*died* (states 3, 5a); a named person to ask; a promise of a time; an apology — an apology concedes a fault the
product does not have. Second person, present tense, no blame. **Who to ask is still the owner's to rule
(§7.1); the sentence that carries it is set above.** The amber-vs-neutral treatment of the notice stays the
owner's (§8) — but the copy and the chrome must not say opposite things.
## 6. Reconciling with the vocabulary already in the product

This document adds **no new empty-state vocabulary**, and #241 adds none either — it adds one refusal
sentence, which is the seat that was missing. Four sets already exist and each keeps its job:

- **`LAYER3-IDENTITY.md` §4 (S-L4, `:149`–`:177`)** specs the 403 on a **write** — *"Your account cannot
  record this."* plus what would, client-owned, never the raw body, both refusals leaving the record untouched
  and saying so. **#241's sentence is that spec's read-side sibling** and satisfies the "untouched" clause
  verbatim. The two differ in exactly the second clause, and whoever touches one touches both.
- **`LAYER3-EMPLOYEE-OWN-VIEW.md` §4 (`:198`–`:215`)** specs the employee's own three empties — linked and
  nothing pending, linked with no case, not linked yet — with their sentences and two rules (no red; no count
  of anything the person cannot see). **Those are state 4's instances**, not a rival set; its case **C** was
  the precedent — *"the sentence that stops a real defect looking like a broken screen."*
- **The HR surface's shipped state-4 sentences** stay: `No data yet` (×6), `No active onboardings.`,
  `No active offboardings.`, `No tasks generated for this stage.`, and the pre-boarding panel's
  *"No open {jurisdiction} pre-boarding cases — nothing outstanding to show for this jurisdiction. Record an
  accepted offer to open one."* (`:1951`). **§3 is where they collide with the new banner.**
- **One existing rule looks like it forbids the client owning a sentence, and does not.** `App.tsx:1911`–
  `:1918` records that a client-composed *claim* about the data was deleted, because *"a client-side copy is
  the structure that produced the drift… Nothing is composed here, and with no cases there is no sentence to
  state rather than a page-level claim about a list that is not on screen."* The distinction it was making:
  the client must not **assert facts about the data or about scope** — that is the server's (`scope_note`). A
  **refusal sentence asserts nothing about the data**, and for state 3 the client *must* own it, because the
  body is empty by design. `REFUSAL_NOTICE` is correct on that rule; it must stay free of counts, resource
  names, and any "exists"/"does not exist".

---

## 7. What is the owner's call, not mine

1. **Whether state 3 names anyone to ask** — the *name*, not the sentence. **The copy is set in §5c (mine);
   it reads "Ask an administrator to grant access".** Whether the product offers an in-product request
   path at all, and whether the ask is a role or a named person, is a product claim and the owner's.

2. **Whether state 2 says why.** The client knows the session ended; saying so costs nothing and an
   unexplained return to the sign-in card, mid-shift, is what makes a user phone someone.
3. **The treatment of a refusal (§8): amber and a lock, or neutral.**
4. **Whether a route the account cannot use stays in the navigation** — a refusal is a poor substitute for a
   nav item that should not have been drawn. Interacts with decisions 23/24.
5. **Which of §3's three shapes**, and **whether state 5a and event 6 ship with the other four** (§5).

---

## 8. The shipped refusal, measured against the product's own rules

- **Colour and mark.** `App.tsx:1284` is `bg-amber-50 border-amber-200 text-amber-900` with **a lock icon**.
  The product's own rule for a non-fault state is slate, not amber, and it says so with an example: *"the
  product's own flag already does this correctly — the `clear` state is slate, not rose"*
  (`LAYER3-EMPLOYEE-OWN-VIEW.md` §4 `:213`–`:214`). The author's own comment (`:5`–`:7`) says a refusal *"is
  not an error"* — **so the copy and the treatment disagree, and the treatment is the louder of the two.**
  The counter-argument is real: a refusal is worth interrupting for, and amber is not red. **It is the owner's
  call (§7.3); what is not arguable is that the copy and the chrome should not say opposite things.**
- **`role="alert"`** (`:1284`) makes a screen reader announce it as it appears. Correct for a fault;
  **questionable for a correct refusal**, and it will interrupt whatever the user was reading. If the
  treatment stays amber, this is the right role; if it goes neutral, `role="status"` is the honest one.
- **Dismissible, and retired on tab/jurisdiction change** (`:577`, `:1293`) — good, and it matches the design
  rule that a notice must not become furniture. **§3(b) extends it: it must also not outlive *the region* it
  was about.**
- **The sentence wraps and never truncates** — `LAYER3-IDENTITY.md` §5 `:212` already rules this for the
  refusal banner, and it is the one message that must be readable in full. It is also the one place a Latin
  token could enter an Arabic sentence (a role name, if §7.1 adds one) and would need `<bdi>`; the shipped
  sentence contains no dates, versions, names or IBANs, so it needs none today.
- **No state may differ from another by colour alone** — hence the three structural discriminators in §2. This
  is an accessibility requirement and an RTL one: a mirrored layout must not be the only thing separating
  *"nothing here"* from *"not yours"*.
- **State 4's existing sentences carry the jurisdiction label** (`UAE`/`KSA`, `:1951`) — a Latin token in
  Arabic copy, already the canary `LAYER3-EMPLOYEE-OWN-VIEW.md` §5 names.

---

## 9. What this document does not do

- **It does not re-derive the mechanism**, which is the engineer's and is merged. It is a check on it: one
  defect (§4, with the test that would catch it), one contradiction to close (§3), one unhandled event (§5).
- **It does not place code or copy in the app** — the document is design; the sentence it adopts is already
  shipped.
- **It carries no render proof.** Every statement is a reading of a code path at `0e401cf`, not a photograph.
  The before-state worth capturing, by whoever builds §3's fix: *a refusal on `/api/employees` with six
  `No data yet` tiles underneath it* — the two claims, on one screen, in one image.
- **It does not touch**: JWT-in-`localStorage` (open by design), the 400 actor refusal (decision 22, done),
  the compliance wording, or the access matrix (the compliance expert's).
