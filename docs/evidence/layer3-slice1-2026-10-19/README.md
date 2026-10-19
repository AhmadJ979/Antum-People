# Layer 3, slice 1 — a named person

*2026-10-19 · decision 11 · base commit `3eb0a7b` (the merge of #219), branch `feat/layer3-slice1-named-person`*

*Added after the merge: **PR #223 merged as `c2f9bba`** (on top of `8b32d45`). The merge result, the fresh
22/0 run of this slice's suite at the merged tip, and what the merge did NOT do (no movement yet; the
policy cells still `[ROLES.ADMIN]`; the `users.role` naming hazard unfixed) are recorded in
`merge-verification.txt`, measured at the merge rather than taken from the merge notice.*

The gate on any real pilot: the product had **one shared admin account** and its role was **decoration** —
`server/auth.js` signed `{id, username, role}` into the token, `/api/login` returned it, and **nothing else
read it**, so any authenticated caller reached every `/api` route. And the checklist tick recorded a date and
no name, while the pre-boarding side had refused an unnamed actor with 400 since 15(b).

## What landed

| file | what it is |
| --- | --- |
| `server/access.js` | **the ONE place the policy lives**: the resource table, the route table, and the gate |
| `server/index.js` | mounts the gate, adds the account path, and puts the actor on both ticks |
| `server/schema.sql` · `server/db.js` | `completed_by` — declared for a fresh database, migrated for an existing one |
| `server/access.test.js` | 22 tests on a scratch instance, each refusal named and falsified |

**Deny is the default, three ways**, and all three answer `403` **with no body** — the caller is told nothing
about what exists:

1. a route whose resource no cell covers (an unknown path is refused, not left open, and not a 404 that
   advertises the route table);
2. a cell that is empty;
3. a role that is not in the cell.

`401` stays a different answer for no-or-invalid token, and `authenticateToken` still runs first. The gate is
mounted on the existing `/api` `app.use` block (`server/index.js:134`), which already owns the `/login` and
`/health` bypass — so the mechanism did not require touching 25 route registrations.

**The policy today is every cell `[admin]`, written down rather than assumed.** `admin` is the only role in
this product's data (the seeded demo account), so this encodes *today's* behaviour instead of quietly
widening or narrowing it; `docs/access-model.md` is what fills the cells. Widening is one edit to one table in
one file, and the suite carries a check that the table has no hole and no cell names a role the product does
not know.

**Accounts** (plural, through an admin-authenticated path — the shape chosen, as asked): `POST /api/users`
and `GET /api/users`, authorized by `users:write` so *who may create an account* is the same question and the
same file as every other resource. It refuses a duplicate username `409`, a password under 12 characters
`400`, and a role the product does not know `400` — **a user whose role matches no cell could log in and do
nothing**, which is why that is not allowed to happen by typo. The seeded demo account keeps working and still
logs in.

**The actor on the tick (decision 22): yes, it needed a schema change.** `onboarding_tasks` and
`offboarding_tasks` had `completed_at` and no actor column, so `completed_by` is added — in `schema.sql` for a
fresh database **and** in `db.js`'s `COLUMN_MIGRATIONS` for one that already exists, because
`CREATE TABLE IF NOT EXISTS` never adds a column to a table that is already there. `server/column-migration.test.js`
holds the property that both paths end with the same columns. Completing a task now records the signed-in
username, **and an unnamed actor is refused 400 with the row left untouched** — which is what the pre-boarding
side does, so the two sides agree.

## The suite: 22 tests, 22 passed, 0 failed — on a scratch instance

`suite-access-scratch-22-0.txt`. It spawns a **real server on a scratch port against a throwaway database**
with its own credential (`cd server && node --test access.test.js`), and never touches the live service, the
live database or the live credential.

## The suite total, which this pack first failed to report — and the one check that was RED

**This slice left `origin/main` red, and the record says so rather than being quietly repaired.** At
`c2f9bba` (the merge of this slice) the full server suite was **192 tests, 191 pass, 1 FAIL**:

```
not ok 45 - every /api route is reachable from a caller, or registered as callerless with a reason
  reachability.test.js:59 -> [ 'GET /api/users (server/index.js:163)',
                               'POST /api/users (server/index.js:172)' ]
```

A control attributed it: the same file at this slice's base `3eb0a7b` is 13/13, at `c2f9bba` 12/13. The two
routes this slice added had no client caller and no entry in `server/reachability-register.js`'s
`CALLERLESS`, and this pack reported `access.test.js` **22/22** — true, and not the total. A claim printed
beside a number that contradicts it is the class the plan names; the total is now reported here.

**The fix is the register, not an exemption.** The two routes are registered in `CALLERLESS` with the truth:
`decision 11` ships the account path over HTTP while the surface that calls it is the next slice (design
`#221`, `design-concepts/LAYER3-IDENTITY.md`), and `client/` was 0 files in this slice by design. The check
was not weakened, skipped or deleted, and no client caller was invented to silence it. At the fix the same
command gives **192 tests, 192 pass, 0 failed, 0 skipped, rc 0** — `ok 45`.

`suite-server-192-red-then-green.txt` carries **both raw runs** (red at `6aa8600`, which contains `c2f9bba`;
green with the register entries), the exact command, and every count with the file it came from.

The refusals it holds, each named: `401` unauthenticated; `401` on a wrong password; `429` past the login
limiter; **`403` with an empty body** for a role with no allowance — on the roster, on a second resource, and
on a path that declares no resource; `400` for an unnamed actor; `409`/`400`/`403` on the account path; and
the policy-table checks (no route without a cell, no cell with an unknown role, every cell admin-only today).
The happy paths are held too: the seeded admin still reads the roster, a created account can log in, and the
tick records the name **beside** the date.

## Falsified, not asserted

`falsification-widen-then-restore.txt` — the row demanded it, so the policy was temporarily widened
(`'employees:read': [ROLES.ADMIN, 'hr']`) and the suite **reddened**:

```
not ok - an authenticated caller whose role allows nothing is 403 on the roster
not ok - no policy cell names a role this product does not know
not ok - today's policy allows admin only, explicitly — nothing silently widened
# tests 22 · # pass 19 · # fail 3
```

Restoring the table returns **22/22**. A check that cannot redden proves nothing, so this is the evidence the
403s are real refusals and not an open route.

## Two red runs of my own, kept because they are the mechanism working

* `first-run-setup-failure.txt` — every case failed at setup: the fixture's employee insert omitted
  `start_date`, and the schema's `NOT NULL` refused it. A fixture that cannot be built must stop the suite,
  and it did.
* `second-run-21-1-rate-limit-could-not-redden.txt` — 21/22: the rate-limit case sent **15** wrong passwords
  against a limiter configured at **25 per minute**, so it could only ever take the 401 branch. It was a check
  that could not redden. It now exceeds the real limit, names it, and its assertion quotes the limit rather
  than my guess at it.

## Not in this slice, stated

"My lines", the hire-facing portal (decision 14 still open), document storage (IFZA, decision 10), SSO,
password reset, MFA, and any JWT-in-localStorage-to-cookie change. `client/` is untouched — **no build proof
is owed**; `server/` is 5 files, so **this one does need a movement before it is in force on the host**, and
the migration adds `completed_by` at the next boot of the product on a database that predates it.
