# One empty screen, four different events — refusal, session, fault, empty

**Design for row `66636525`**, written beside the engineer's mechanism row (`d2328d67`). This file supplies
**the states and the sentences**; the mechanism is the engineer's, and §7 states the seam.

- **Measured at `origin/main` = `ee4bbdf`** — `client/src/App.tsx`, 2,493 lines. `client/src` holds seven
  files and `App.tsx` is the only application source.
- **How the four events were counted, so the counts can be re-taken:**
  `git grep -c '401' -- client/` → `client/src/App.tsx:19` (lines). `git grep -c '403' -- client/` → **one
  hit, `client/src/assets/react.svg:1`** — an SVG path coordinate, not code. **The client contains no 403
  handling at all**, across 2,493 lines and 19 lines of 401 handling.
- **What these measurements are, and are not.** Every claim below is a **reading of a code path**, with the
  path named, at `ee4bbdf`. A credentialed pass against the live product is out of bounds, so **nothing here
  was rendered** — the render is derived from the path, not photographed. §7 says who owes the render proof.
- **No `client/` or `server/` file is changed by this document.** Where a change is needed it is said here
  and in the PR body, and it becomes its own row.
- **§3 corrects the discriminator this row was handed.** On measurement, `server/` has **five** 403 producers
  and **two** of them carry a JSON body with **different** meanings — so *"403 with a body means the session
  expired"* is false, and obeying it signs a valid user out.

---

## 0. The rule, stated as a rule

**A refusal must be visible as a refusal.** Three corollaries, because the inverse failures are just as bad
and two of them are in the code today:

1. **An empty result must never wear a refusal's clothes, and a refusal must never wear an empty result's.**
   They are different facts about the world and the reader does something different about each.
2. **Silence is a claim.** A blank panel says *"there is nothing here"* — an assertion about data the client
   has not verified. When a read fails today the client answers **for** the server, and its answer is
   "nothing". The client may render an empty state **only** after a *successful* response said so; where it
   cannot classify what came back, it must say **that**, not nothing.
3. **A refusal is not a fault, and a fault is not a refusal.** No red on a refusal — the product's own rule
   (`LAYER3-EMPLOYEE-OWN-VIEW.md` §4: *"an empty state never shows a red, an amber, or an error icon. Empty
   is a state, not a fault"*) — and no "you're not allowed" on a request that simply failed.

---

## 1. Measured: what the client does today

**It handles 401 and nothing else.** `App.tsx` tests `status === 401` on 19 lines (`:587`, `:626`, `:661`,
`:697`, `:714`, `:742`, `:769`, `:828`, `:875`, `:901`, `:934`, `:964`, `:989`, `:1008`, `:1036`, `:1075`,
`:1097`, `:1117`, `:1145`), and every one of them calls `handleLogout()` (`:546`) and returns — the correct
outcome. There is no `403` branch anywhere.

**The empty screen has a specific home, and it is not a mystery.** `fetchData` (`App.tsx:578`) is the effect that
fills the dashboard: it fetches `/api/employees` and `/api/analytics/dashboard` (`:583`–`:584`), tests **only**
401 (`:587`), then parses both bodies unconditionally (`:592`–`:593`) and coerces:

```js
const safeEmpData = Array.isArray(empData) ? empData : [];   // :596  — an error object becomes []
setAnalytics(anaData && !anaData.error ? anaData : null);    // :598  — an error object becomes null
```

**This call site has no failure branch at all** — measured: the guard region `App.tsx:584`–`:612` contains `res.json()`
twice and `catch (err)` once, and **no `res.ok` check**. So any non-401 failure lands as `employees = []` and
`analytics = null`, and the dashboard renders **six `No data yet` tiles** (`:1286`, `:1304`, `:1336`, `:1340`,
`:1373`, `:1377`) plus `No active onboardings.` (`:1414`) and `No active offboardings.` (`:1442`). That is the
"empty screen" — not a missing component, but a **success-shaped state produced by a failure**.

**Elsewhere the failure is loud but wrong.** 16 lines test `res.ok`, and their fallback is

```js
// App.tsx:719-:720
setChecklistNotice({ kind: 'error', text: data.error || `The checklist could not be read (HTTP ${res.status}).` });
```

so on those paths a **correct refusal is reported as a broken read**, with the status code in the user's face.
And where the server did send a body, the body's text is shown verbatim — which today means an expired
session displays the string **`Invalid or expired token`** to a client user. That string is internal
vocabulary, and the product's own rule already forbids it reaching a non-HR surface
(`LAYER3-EMPLOYEE-OWN-VIEW.md` §3 (`:193`): *"counsel question numbers, internal refusals, the 409/400 bodies —
internal vocabulary on a non-HR surface"*).

---

## 2. The four states

One sentence each. "Form" is how they differ **structurally**, because colour alone is not a difference — it
fails for a colour-blind reader, in Arabic, in a screenshot, and in a printout.

| # | Trigger (measured) | What is true | The one sentence | Form | Action |
|---|---|---|---|---|---|
| **1** | **401**, no token — `auth.js:26` | the caller never presented a session | *(the existing sign-in card — no new copy)* | the **whole surface** is replaced by the card (`App.tsx:357`–`:358`) | sign in |
| **2** | **403 + body** `{error:'Invalid or expired token'}` — `auth.js:31` | a session existed and is over | **"Your session has ended. Sign in again to continue."** | **identical to state 1** — the same card, plus that one line | sign in |
| **3** | **403**, empty body — `access.js:376`, `:378`, `index.js:166` | the session is **fine**; this request was refused | **"Your account can't see this."** + *what would*¹ | **in place**, where the data would have been: a heading, the sentence, and an action | ask for access¹ |
| **4** | **200** + empty result | genuinely nothing there | *(the sentences already shipped — §5)* | sentence only, italic slate, no heading, **no action** | none |

**The three structural discriminators** — a reader can tell all four apart with styling removed:

- **Where it appears.** 1 and 2 replace the surface. 3 and 4 occupy the region the data would have filled.
- **Whether there is an action.** 3 carries one; **4 must not** (an empty state has nothing to do).
- **Whether it accuses anyone.** 3 is about access, 4 is about the world. Neither may carry the other's wording.

¹ The second clause of state 3 — whether the product names anyone to ask, and what it calls them — is the
**owner's call**, not mine. §6 states exactly what is his.

**States 1 and 2 must render identically, and today only 1 does.** This is the sharpest thing in the row:
state 2 is not a *new* surface to design, it is the *existing* surface that the client fails to reach. It is
not silent because 403 is unhandled in the abstract; it is silent because a session that ends in the middle of
a shift takes a path no check in the file looks at.

---

## 3. Why 2 and 3 cannot be told apart today — the five producers, and the cheapest honest fix

This row and the engineer's both describe the pair as *"403 with a body = session over; 403 with an empty body
= refused"*. **That is false, and the enumeration shows it.** Every 403 producer in `server/` at `ee4bbdf`:

| # | Site | Body | What it actually means |
|---|---|---|---|
| 1 | `server/auth.js:31` | `{"error":"Invalid or expired token"}` | `jwt.verify` failed — **the session is over** |
| 2 | `server/index.js:65` | `{"error":"Forbidden"}` | **the CORS origin guard** — nothing to do with the session |
| 3 | `server/access.js:376` | *(empty)* | the resource is unnamed, or nobody may use it |
| 4 | `server/access.js:378` | *(empty)* | the caller's `access_role` is not in the resource's list |
| 5 | `server/index.js:166` | *(empty)* | the **per-row scope** refusal (`refuse`; named on 7 lines of that file) |

**Two body-carrying 403s, two different meanings.** The proposed rule reads #2 as a dead session and signs a
perfectly valid user out. Honest scope on how reachable that is: for the **served product** the CORS guard's
second branch (`index.js:60` — same host as the `Origin`) lets the app's own pages through, so it is a dead
path there; it is live for a **foreign origin**, which is exactly a scratch/dev topology where the client and
the API sit on different ports. So it is not a production fire — it is a rule that is **wrong in the one
situation a developer tests in**, and that is how a wrong rule survives.

**The client cannot honestly classify a 403 from what it is given.** It would have to match the human string
`'Invalid or expired token'` — a sentence, not a signal, which breaks silently the day anyone rewords it. This
team has a name for that structure: *a client-side copy is the structure that produced the drift*
(`App.tsx:1881`–`:1885`).

**Two ways out. I recommend (A); it is the engineer's to take and the lead's to rule on.**

**(A) A one-line server fix that deletes the problem: `auth.js:31` should answer `401`, not `403`.** An
unverifiable token is a failure of *authentication*; RFC 9110's 401 is *"the request lacks valid authentication
credentials"* and 403 is *"the server understood the request but refuses to authorise it"*. On the wire today
the server has them backwards. Changing that one status code:

- collapses **state 2 into state 1**, which the client **already implements correctly on 19 lines** — so ~19
  new branches become **zero**;
- leaves **every remaining 403 meaning one thing — "refused"** — with no inference, no string matching, and
  no dependency on the body's emptiness;
- handles the CORS 403 correctly for free: it *was* a refusal, and the session *is* fine;
- costs one line in `server/auth.js`, which is a `server/` change → **its own row**, with the movement rules
  that a `server/` delta owes.

**(B) If (A) is declined, the session signal must be machine-readable, not inferable.** Then `auth.js` owes a
stable code on the session response (e.g. `code: 'token_invalid'`), the client keys on the code, and the
client's fallback for a 403 it cannot classify is **state 3** — never a sign-out and never silence. A 403 the
client has not been taught to read must never be allowed to end a session.

**The anti-vacuous control this owes** (the engineer's row already asks for one, and this names the one that
bites): a test that sends a 403 **that carries a body and is not the session error** — i.e. the CORS shape —
and asserts that **no sign-out happens**. A test that only proves "403 → sign out" is green while a valid
session is being thrown away, which is the defect, not the fix.

**And the constraint the row asks me to design within, kept:** state 3's body **stays empty**. The emptiness is
load-bearing — `access.js:19`: *"a refusal is `403` with no body — the caller is told nothing about what exists"*.
Nothing in this document asks the server to say *which* refusal it was, and the client must not try to work it
out. The only distinction the client needs is **session-over vs refused**, and (A) gives it that for free.

---

## 4. The fifth event the row did not name

The row names four. Reading the code finds a fifth that renders exactly like state 4, and it is the most
demo-dangerous of the five because it is the one that is *true* about the world:

**A request that never completed** — the server is down, the connection dropped, or the response was not JSON.
Where this lands today: `res.json()` throws into `catch (err) { console.error(...) }` (`:608`–`:609`,
`:727`–`:728`, and the same shape at the write sites) — **a console line and no user-visible state at all**.
On the mount path the state variables keep their previous value, which after a first load is `[]`, so the
dashboard shows **`No data yet` while the server is unreachable.**

**Proposed: state 5 — "We couldn't load this."** A sentence plus **Retry**. This is the one of the five that
*is* a fault, so it is the one that may carry an amber or red mark; state 3 must not, and state 4 must not.

This is beyond the four the row listed, and I am not folding it in silently: I measured it, it shares the
failure path, and any fix for the four that leaves a dead server rendering `No data yet` has moved the defect
rather than closed it. **Flagged for the lead** — it either rides the engineer's row or becomes its own.

---

## 5. Reconciling with the vocabulary already in the product — do not invent a fourth

This document adds **no new empty-state vocabulary**. Four sets already exist and each keeps its job:

- **`LAYER3-IDENTITY.md` §4 (S-L4, `:149`–`:177`) already specs the 403 on a *write***, with the sentence
  *"Your account cannot record this."* plus what would, client-owned, never the raw body, and both refusals
  leaving the record untouched and saying so. **That is not this document's state 3** and must not be
  overwritten: S-L4's is a **write** that was refused, mine is a **read** that was refused. Same status code,
  two events, two sentences — and they differ in exactly the second clause (what would satisfy each). Whoever
  implements one implements both; §7 says so.
- **`LAYER3-EMPLOYEE-OWN-VIEW.md` §4 (`:198`–`:215`)** already specs the employee's own three empties — linked
  and nothing pending, linked with no case, not linked yet — with their sentences, and two rules (no red; no
  count of anything the person cannot see). **Those are state 4's instances**, not a rival set: state 4 is the
  general rule those three were written from. Its case **C** is the precedent this document generalises —
  *"this is the sentence that stops a real defect looking like a broken screen."*
- **The HR surface's shipped state-4 sentences** stay as they are: `No data yet` (×6), `No active onboardings.`,
  `No active offboardings.`, `No tasks generated for this stage.`, and the pre-boarding panel's
  *"No open {jurisdiction} pre-boarding cases — nothing outstanding to show for this jurisdiction. Record an
  accepted offer to open one."* (`:1916`). **State 4 must keep the house form**: italic, centred, sentence
  only, no heading, no action.
- **One existing rule looks like it forbids what this document asks for, and does not.** `:1876`–`:1885`
  records that a client-composed *claim* about the data was deleted, because *"a client-side copy is the
  structure that produced the drift… Nothing is composed here, and with no cases there is no sentence to state
  rather than a page-level claim about a list that is not on screen."* Read it with the distinction it was
  making: the client must not **assert facts about the data or about scope** — that stays the server's
  (`scope_note`). A **refusal sentence is not a fact about the data**, and for state 3 the client *must* own it,
  because the body is empty by design. So the rule composes rather than conflicts: **the server owns every
  claim about the data; the client owns the shape and voice of a refusal — which must therefore assert nothing
  about the data.** No counts, no resource names, no "exists" or "does not exist".

---

## 6. What is the owner's call, not mine

Marked as the row instructs. Each is a product decision with a plausible case either way; I have a
recommendation and have not taken it.

1. **The refusal copy for a real client user** — specifically whether state 3 **names anyone to ask**, and what
   it calls them. My proposal's first clause, *"Your account can't see this."*, asserts nothing about the data
   and nothing about who grants access; the second clause is where a product claim would enter. Recommendation:
   keep a second clause, because a refusal with no next step is a dead end — but the *name* is the owner's.
2. **Whether state 2 says why.** *"Your session has ended."* states a cause the client is inferring. The
   alternative is the bare sign-in card with no explanation. Recommendation: say it — an unexplained return to
   the login screen, mid-shift, is what makes a user phone someone.
3. **Whether a route the account cannot use stays in the navigation.** A refusal is a poor substitute for a
   nav item that should not have been drawn. This is not copy; it is whether the product hides by permission or
   refuses on arrival. It interacts with decision 23/24 and the `compliance_viewer` matrix.
4. **Whether state 5 ships with the other four** (§4).

---

## 7. The seam with row `d2328d67`, and what this file does not do

**The engineer's row owns:** the classification mechanism, the per-call-site coverage, the build proof (rule
15 — a `client/` change *must* carry `cd client && npm run build`'s raw tail, and the built bundle's hash and
size), and the tests. **This row owns:** the four (five) states, their sentences, their structural
discriminators, and the reconciliation in §5.

**The one thing I would change in their brief is §3** — the discriminator — and I have put the measurement, not
a preference, in front of it.

**Not in this document, deliberately:** the mechanism; any code; any copy placed in the app; the JWT-in-
`localStorage` question (still open by design); new screens; compliance wording.

**Two follow-ups this row cannot carry, named so they are not lost:**

- **A render proof is owed by whoever builds this.** Every sentence above describes a code path, not a
  photograph — I did not render the four states against the live product, which is out of bounds. The rig that
  can photograph them is `antum-scratch-evidence-rig`; the before-state worth capturing is *a 403 on
  `/api/employees` while the dashboard shows six `No data yet` tiles*.
- **`index.js:65`'s CORS 403** is a second body-carrying 403 that will sit in the same classifier. If (A) is
  taken it needs nothing; if (B) is taken it needs a code too, or it will be misread as a session.

---

## 8. EN/AR, RTL and accessibility — what these states add

Arabic copy does not ship (decision 15(c) is open), so this is what the states cost the pass, following
`LAYER2-PREBOARDING-UI.md` §8B — **not a second convention**:

1. **`LAYER3-IDENTITY.md` §5 `:212` already rules that the refusal banner wraps and never truncates** — it is
   the one message that must be readable in full. State 3's sentence is that banner.
2. **No state may differ from another by colour alone** — hence the three structural discriminators in §2. This
   is an accessibility requirement and an RTL one: a mirrored layout must not be the only thing distinguishing
   *"nothing here"* from *"not yours"*.
3. **The refusal sentence contains no dates, versions, names or IBANs**, so it needs no `<bdi>`; if the owner's
   second clause names a role, that token is Latin in an Arabic sentence and **does** need wrapping.
4. **State 4's existing sentences carry the jurisdiction label** (`UAE`/`KSA`, `:1916`) — a Latin token in
   Arabic copy, already the canary `LAYER3-EMPLOYEE-OWN-VIEW.md` §5 names.
