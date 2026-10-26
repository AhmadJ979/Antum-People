# Can an actor — not the seeder — raise a termination flag?

Row `e707ce10`. A **finding**, not a change: nothing here alters behaviour, and neither decision 16 nor the
modal question is decided. Measured on a scratch rig of the deployed tree `2bd2f9dd7dfd70b30b95e27753eb02e08eaaf097`
(own port 4719, own throwaway `PRODUCT_DB_PATH`, own throwaway accounts, no live surface touched — the public
product answered 200 before and after). Raw transcript: `rig-transcript.txt`.

## The answer, in one line

**Yes.** An actor holding `employees:write` — HR_ADMIN today — can raise a third termination flag on a row the
seeder never flagged, and the Layer 4 figure appears on it; the write is attributed. The plan's sentence is
therefore false as written.

## 1. Which route writes it, and what gates it

| route | field | permission (`server/access.js`) | who holds it (`server/access.js:96`) |
|---|---|---|---|
| `PUT /api/employees/:id` | `termination_type` — in the update allow-list (`server/index.js:419`) | **`employees:write`** | **HR_ADMIN only** |
| `POST /api/exit-interviews` | `status='terminated'`, `end_date` — no `termination_type` | **`exit:write`** (`:115`) | **HR_ADMIN only** |

Measured, on the same row, in the same session: as `hr_admin` → **200**; as `compliance_viewer` →
**403 with an empty body (0 bytes)** — the policy's refusal in place; with **no token** → **401
`{"error":"Authentication token required"}`**.

## 2. Yes — the actor's write fires the Layer 4 figure

On `demo-emp-hassan` (status `active`, `termination_type` null, **not** flagged by the seeder):

* before any write — the route answers 200 with **`trigger: null`** and a null `departure_date`; the figure is
  present but unfired;
* `PUT /api/employees/:id {"termination_type":"resignation"}` → **200**, and the same route now returns
  **`trigger: {"key":"termination_flag","label":"Termination flag","detail":"status active, termination type
  resignation, no departure date recorded"}`**, with `recruitment` **calculated** (10,000 AED, "recorded on the
  employee's own record") and `vacancy_cover` `not_calculated` with its reason.

That is the mechanism, not an inference: `server/replacement-cost.js:252` treats
`employee.termination_type` as a trigger on its own, and its own unit test asserts exactly that
(`replacement-cost.test.js:187`, `status:'active'` + `termination_type:'resignation'` → `termination_flag`).
**The allow-list entry is the flag-writing path.**

## 3. The write is attributed — and the exit path is not

* **`PUT /api/employees/:id`: attributed.** The handler requires a named actor first
  (`actorOf(req)` = the token's username) and refuses otherwise — *before any lookup* — and it writes
  `audit_logs (performed_by, entity_type, entity_id, action, old_values, new_values, timestamp)`. Measured:
  `performed_by = "scratch-hr"`, `action = UPDATE`, `new_values = {"termination_type":"resignation"}`.
  Decision 22's rule is honoured on this path.
* **`POST /api/exit-interviews`: NOT attributed.** The handler (`server/index.js:805`) inserts the interview
  and runs `UPDATE employees SET status='terminated', end_date=…` with **no actor check and no audit row
  anywhere** — measured: the row reads `status terminated / end_date 2026-10-26` while
  `SELECT count(*) FROM audit_logs WHERE entity_id = that row` is **0**. It is reachable with the
  `exit:write` permission (201 in the rig). On this path there is no named actor to find, which is a
  different defect from an anonymous one and worth stating separately: decision 22 is **not** bypassed by a
  default here, it is simply absent.

## 4. One sentence for the plan

**An HR_ADMIN can raise a third termination flag with one attributed `PUT /api/employees/:id` carrying
`termination_type` — and that write produces the Layer 4 figure on a row the seeder never flagged — while
`POST /api/exit-interviews` terminates a row with no actor recorded at all; so "no actor can raise a third
flag" is false as written, and what the unreachable Exit modal costs is not that ability but the surface that
would have used it.**

## What this does not say

It does not rule on decision 16, on whether the Exit modal should be wired, or on whether `termination_type`
belongs in an update allow-list — those are the owner's. It does not claim the exit route is reachable **by a
person**: the modal is unreachable (decision 16), and this measured the route, which is reachable by path.
That is the distinction the row asks for (`setShowExitModal`'s lesson): *a route reachable by path is not a
control reachable by a person.* The same reading applies to the allow-list: it is reachable by a person who
holds the permission and uses the API, and by no screen today — which is exactly why the finding is a
sentence for the plan rather than a defect ticket.
