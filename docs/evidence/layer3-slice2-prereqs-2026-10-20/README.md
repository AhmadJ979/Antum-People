# Layer 3, slice 2 — the three prerequisites, and the live-shaped evidence for two of them

**What this pack answers.** Row *"Layer 3 slice 2 prerequisites: users.employee_id, split
preboarding:read, and an audit row for POST /api/users"* asked for three shape changes and for a
**live-shaped demonstration** of two of them: *"the column exists after migration and running the
migration twice changes nothing; the audit row appears with the real actor's name."* This is that
demonstration, filed as bytes rather than described, beside the change it belongs to.

**Measured at:** the code commit `43fce95` on `layer3/slice2-prerequisites` (base `origin/main`
`ae3a438`). The whole test run and the run below were made at that commit; this pack is filed on top
of it and changes no code, so the measured tree and the tree under review differ by these three files
only.

**How it was produced.** `node docs/evidence/layer3-slice2-prereqs-2026-10-20/slice2-demo.js` — the
script is filed here byte-identical to the one that ran (`slice2-demo.js`, md5 in the table below), so
a reviewer can re-run it rather than trust the transcript. It reads `origin/main:server/schema.sql`
out of the repository it is run from (adjust the `REPO` constant at the top if you clone it
elsewhere). It builds its scratch
database from **`origin/main:server/schema.sql`**, i.e. the database as it existed *before* this
change, so the migration is exercised for real rather than against a database that already has the
column.

**Safety, stated because it is the first thing to check in any evidence run.** Scratch database under
`/tmp`, scratch port (32183 in this run), scratch `JWT_SECRET`/`ENCRYPTION_KEY`. The live service on
port 3000, the live database at `/home/team/.data/antum-product.db` and the live credential are
**never touched** by this run — no request is sent to the deployed product and no movement is
implied or owed by this pack.

## The run's own bytes

```
# Slice 2 prerequisites — live-shaped demonstration

run at            : 2026-10-20T05:54:23.789Z
branch tip        : 43fce953f574aa598e3807cc000ba59dd8c2f6b6
base (origin/main): ae3a438aeca92aa5688a601f35c402b7b5c6ae78
scratch database  : /tmp/slice2-evidence/scratch-product.db   (built from origin/main's schema — the PRE-change shape)
scratch port      : 32183          (port 3000 and the live DB are not touched)

## A. the pre-change database
users columns     : id, username, password_hash, role, created_at
has employee_id?  : false   <- false is the point
accounts present  : demo-admin/admin

## B. the FIRST boot of this branch's product against that database
boot log          : [DB] Upgraded: added column(s) users.employee_id
users columns     : id, username, password_hash, role, created_at, employee_id

## C. the account that was already there
username/role     : demo-admin/admin
employee_id       : null   <- NULL: not tied to a person, and NOT guessed

## D. creating an account over HTTP (the route that used to write no audit row)
POST /api/login   : 200
POST /api/users   : 201 {"id":"0e9489ae-eb4b-437f-9969-77b92d2f5d6a","username":"slice2-demo-account","role":"admin"}
audit row         : performed_by="demo-admin" entity_type=user entity_id=0e9489ae-eb4b-437f-9969-77b92d2f5d6a action=CREATE new_values={"username":"slice2-demo-account","role":"admin"}
actor is real     : true   (not 'system', not a placeholder)
credential leaked : false

## E. the SECOND boot (idempotence)
boot log          : (no upgrade line — nothing left to add)
users columns     : id, username, password_hash, role, created_at, employee_id
accounts now      : demo-admin, slice2-demo-account

## Result
A+B : the column did not exist on the pre-change database and the FIRST boot added it, and named it.
C   : the pre-existing account kept NULL — no backfill, no guess.
D   : the audit row names "demo-admin" — the real authenticated signer.
E   : the second boot added nothing.
```

## What each part is evidence for

| part | shows | the row's requirement |
|---|---|---|
| **A** | the pre-change database has **no** `employee_id` (`has employee_id? : false`) and holds the account that was already there | the fixture is genuinely pre-change — without this the rest proves nothing |
| **B** | the **first** boot of this product against it logs `[DB] Upgraded: added column(s) users.employee_id`, and the column is then listed | *"the column exists after migration"* |
| **C** | the pre-existing `demo-admin` row keeps **`null`** | nothing is backfilled with a guess — the row said NULL means "not tied to a person yet" and this is that row |
| **D** | `POST /api/login` 200, `POST /api/users` **201**, and the audit row reads `performed_by="demo-admin" … action=CREATE` | *"the audit row appears with the real actor's name"* — the real authenticated signer, not the literal `'system'` |
| **E** | a **second** boot adds nothing (`(no upgrade line — nothing left to add)`), the column is still there, and both accounts are present | *"running the migration twice changes nothing"* |

**It also checks that the new audit row carries no credential**: `credential leaked : false` — the
row's `new_values` is `{"username":"slice2-demo-account","role":"admin"}`, and neither the password
nor a bcrypt hash appears anywhere in it.

## What this pack does NOT show

- **Nothing about the deployed host.** This is a scratch instance of the same code. The host serves
  `cf3dad3` and no movement is owed by this change or requested in it: `cf3dad3..ae3a438` is
  documentation plus these three prerequisites, and slice 2's own view — which is what would make a
  movement worth running — is deliberately NOT in this row.
- **Nothing about what a second *role* can do.** Every policy cell is still `[admin]`; the split makes
  the ruling writable, not live. No account, role or grant was added anywhere.
- **Not a statement that the register changed.** It did not: no route gained or lost a caller in this
  change, so `server/reachability-register.js` is untouched and the two `CALLERLESS` entries for the
  account routes (`GET`/`POST /api/users`, added by the slice-1 fix-forward) keep their reasons.

## Files

| filed as | from | bytes | md5 |
|---|---|---|---|
| `scratch-demo.log` | the run's stdout, `/tmp/slice2-evidence/scratch-demo.log` | 1992 | `7166da75ec1fc601b3af051651cfc5e1` |
| `slice2-demo.js` | the script that produced it, `/tmp/slice2-demo.js` | 8298 | `7571140d7f208b3a825cefe8669c58bc` |

**Staging note.** `.gitignore:6` is `*.log`, so `scratch-demo.log` is staged with **`git add -f`**,
and `git ls-tree -r HEAD` is what proves it is in the commit rather than merely staged. The README
quotes the log by **splicing its bytes**, not by retyping them.
