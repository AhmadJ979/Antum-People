# The served workspace note — corrected against the access model, with a guard

**One bounded fix, 2026-10-28.** Branch: `fix/preboarding-access-claim`. Server-only: no
`client/src` file is touched (PR #319 is open on `client/src/App.tsx`).

## The defect

`server/preboarding-workspace.js` built the note that travels in `view.note` of every workspace
board — returned at `:421` (`note: VIEW_NOTE`) and drawn by the client at `client/src/App.tsx:2443`:

> This narrows the board to one function. It is a filter, not access control: everyone signed in can
> still open any case and see every line. Per-user scoping — "My lines" — ships with per-user
> accounts at Layer 3.

False in the tree it shipped in, twice over:

- the route that serves that payload, `GET /preboarding/cases/:id/workspace`, is mapped to the
  resource `preboarding:read:own` (`server/access.js:281`), whose cell in `POLICY` is
  **`hr_admin` alone** (`server/access.js:123`). The gate refuses every other role with **403 and no
  body** (`server/access.js:428-432`), before the handler runs, so a signed-in `manager`, `finance`,
  `employee` or `compliance_viewer` cannot open any case at all;
- per-user scoping has since shipped (Layer 3 is built, served and escalating). What is actually
  missing is the **case → person join** (`PENDING_CELLS`, `server/access.js:159-162`) — a schema gap,
  not a Layer-3 one.

## The sentence that replaces it

`server/preboarding-workspace.js:159-166`, served at `:421`:

> This narrows the board to one function. It is a filter, not access control: it changes which lines
> are drawn, never who may open a case. Opening a case is decided by the policy gate on the resource
> preboarding:read:own, whose cell holds hr_admin alone — a signed-in manager, finance, employee or
> compliance_viewer is refused before this board is built. Every caller who reaches it can open every
> case; a per-person read is not built: nothing joins a pre-boarding case to a person, and whether
> this board belongs on that view at all is open with counsel.

The two readings it is derived from, re-read this session:

| reading | what it says |
| --- | --- |
| `server/access.js:123` | `'preboarding:read:own': [ROLES.HR_ADMIN],` — the cell: `hr_admin` alone |
| `server/access.js:281` | `['GET', '/preboarding/cases/:id/workspace', 'preboarding:read:own'],` — the route → resource |

Two supporting readings: the refusal itself at `server/access.js:432`
(`if (allowed.indexOf(req.user.access_role) === -1) return res.status(403).end();`), and the missing
link at `server/access.js:159-162` (`PENDING_CELLS['preboarding:read:own']` names the absent
case → person join for `employee` and `manager`).

`SCOPES` has no entry for this resource, so `scopeFor` answers `all` and the cell is the whole
control — which is why the sentence says a caller who reaches the board can open every case. That is
the honest reading in the other direction: the corrected note neither understates the gate nor
claims a per-row scope that does not exist.

Also corrected in the same branch (same defect family, not served): the module's rule-4 comment, the
route comment at `server/index.js:957-960`, and the stale premise in
`server/preboarding-workspace.test.js`'s header and in one assertion message.

## The guard, and the run under which it holds

`server/preboarding-access-claim.test.js` — 5 tests, run by the **server** suite:

```
cd server && npm test                                   # node --test; this file is one of 55 suites
cd server && PRODUCT_DB_PATH=/tmp/claim.db node --test preboarding-access-claim.test.js
```

It reads the truth out of `server/access.js` at run time (`ROUTES`, `POLICY`, `ROLE_LIST`), strips
comments before sweeping for the removed claim's shapes (so this pack's own quotes cannot self-trip
it), and reads the sentence off a **real board payload**, not off the constant.

- `guard-green-0839Z.txt` — `# tests 5 / # suites 1 / # pass 5 / # fail 0`, exit 0.
- `server-suite-branch-0839Z.txt` — the whole server suite on the branch:
  **`# tests 349 / # suites 55 / # pass 349 / # fail 0`** (the pre-change baseline is 344/54; the
  delta is this guard's 5 tests and 1 suite).

## The falsification — three mutations, and the restore

Produced by `falsify-guard.py` in this directory — the three logs below are that script's own output, so the recipe is verified, not just described. The script mutates `VIEW_NOTE` in place, runs the
guard, writes the log, restores from its in-memory copy and prints the md5 of the restored file.
Restored file md5 before and after: **`d28a2abe5e5cc32995bddf73457965de`**, 22 634 bytes — equal, so
the tree that is committed is the tree that was measured.

| mutation | what it does | exit | result |
| --- | --- | --- | --- |
| A | pastes the **original sentence** back | 1 | `5 tests / 1 pass / 4 fail` — `guard-falsified-old-sentence-back-0840Z.txt` |
| B | drops `finance` from the note (a role the cell refuses) | 1 | `5 tests / 3 pass / 2 fail` — `guard-falsified-role-dropped-from-note-0840Z.txt` |
| C | names the refused roles but never refuses them | 1 | `5 tests / 3 pass / 2 fail` — `guard-falsified-role-not-refused-0840Z.txt` |

A is the check rule 41's sibling rule demands (a check that cannot redden proves nothing); B and C
show the derived check has teeth in both directions — a note that omits a refused role, and a note
that grants one, each redden.

## What the guard does not prove

It does **not** prove the gate behaves as the sentence says — that every other role is really refused,
403 with an empty body, on this route. That is `server/access.test.js`'s job against the gate itself.
Nor does it prove any screen renders the sentence: the client draws `view.note` verbatim, and a
rendered claim needs a rig pass. The guard holds text against the table and the table against the
text; nothing more.

## Movement

This is a `server/` delta **loaded by a served path** (`server/index.js` serves the route;
`server/preboarding-workspace.js` builds the payload), so it owes **one movement** — owed, not run. No
client byte changes, so no rebuild proof exists or is needed: the served payload changes when the
server restarts on the new tree.

## Left as records, not rewritten

- `docs/evidence/p2-4-filter-scope/*`, `docs/evidence/p2-4-rendered/*`, `docs/evidence/p2-4-served-pass/*`
  — dated captures that quote the old sentence. Historical records: unchanged.
- `design-concepts/LAYER2-PREBOARDING-UI.md:83,309`, `design-concepts/LAYER2-INTERFACE-FIXES-PICK-LIST.md:20`,
  `demo-weak-screens.md:221` — dated design/audit documents that carry the same shared-account
  premise. Reported, not rewritten (a dated record is history). If the lead wants them regrounded it
  is a separate dated annotation, not this fix.
