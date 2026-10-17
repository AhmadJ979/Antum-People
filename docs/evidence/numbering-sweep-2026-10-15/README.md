# The numbering sweep — 2026-10-15 (Round 47)

**What this is.** The numbering audit of 2026-10-14 ratified **scheme A** (the code's, the board's and
this tracker's own scheme) and listed, separately, the sites that are wrong under **both** schemes —
"not caused by the renumbering, but found by it" (audit §3). The lead asked for those sites to be
**swept**: every one either **corrected** or **explicitly argued as correct**, because a site wrong
under both schemes cannot be left for the next person who greps.

**What the sweep found.** The audit's table named **seven**. Measuring the class **by text** — not by
the audit's own recorded line numbers, two of which have moved since they were measured — finds
**twelve**. Three of the four extras were already in the audit's TSV (it had measured them and its
§3 heading did not say it was listing a subset); the fourth is a `grep` capture.

**Method.** Every site was located by searching for its **text**, never by applying an offset to a
recorded line number, and each replacement asserts its own expected occurrence count before it writes
(`sweep-edits.py`, filed beside this file; the raw searches are in `raw-text-search.txt`). The audit's
own scheme mapping was used for values: **the kept `consent_records` table is decision 17** (17 retires
the instrument and keeps the subject), **the portal-identity question is decision 14**, **the
consent-versus-a-notice-acknowledgement question is decision 15(b)**, **the port-3000 collision is
decision 2**, and **the standing demo-credential rule is decision 13** (the two `decision 13` sites in
the tracker are that rule and are correct).

## The twelve, with their dispositions

| # | site (located by text) | read | is | disposition |
|---|---|---|---|---|
| 1 | `roadmap-board-index.md` — P2-6 *"unassigned behind owner decision 13"* | 13 | **14** | corrected in place |
| 2 | `pdpl-lawful-basis-mapping.md` — *"kept for decision 14's purpose-scoped consent"* | 14 | **17** | corrected in place + dated marker |
| 3 | `docs/evidence/p2-6-premise-sweep/README.md` — premise row: *"kept for decision 14's purpose-scoped consent"* | 14 | **17** | corrected in place + dated marker |
| 4 | `docs/evidence/p2-6-premise-sweep/README.md` — prose: *"stays for decision 14's purpose-scoped consent"* | 14 | **17** | corrected in place + dated marker |
| 5 | `docs/evidence/p2-6-premise-sweep/README.md` — owner bullet: *"kept for decision 14's purpose-scoped consent"* | 14 | **17** | corrected in place + dated marker |
| 6 | `docs/evidence/decisions-21-17-2026-10-13/README.md` — *"table and schema kept (purpose-scoped consent, decision 14)"* | 14 | **17** | corrected in place + dated marker |
| 7 | `un-operable-controls-inventory.md` — seeder row: *"table kept, decision 14"* | 14 | **17** | corrected in place + dated marker |
| 8 | `server/reachability-register.js` — *"purpose-scoped consent is decision 14's subject"* | 14 | **17** | corrected in place (not in the served closure — see below) |
| 9 | `server/index.js:361` — *"purpose-scoped consent is decision 14's"* | 14 | **17** | **HELD — a comment on the served path; owes the next movement** |
| 10 | `docs/evidence/pdpl-lawful-basis-mapping/README.md` — the fenced transcript of `demo-weak-screens.md:64` | 14 | **15(b)** | **quote kept byte-for-byte; a dated note appended under it** |
| 11 | `shared/post-cutover-reground.md` (host, not in the repo) — *"left open (owner decision 14)"* | 14 | **15(b)** | corrected on the host (no PR, no cutover) |
| 12 | `shared/post-replacement-availability-and-pii-window-2026-10-14.md` (host) — *"the port-3000 collision of owner decision 1"* | 1 | **2** | corrected on the host |
| — | `docs/evidence/decisions-21-17-2026-10-13/enumeration-and-route-table.txt` — quotes `server/index.js:357` | 14 | — | **left byte-identical: it is a `grep` capture, and both its line number and its sentence were true of the tree it read** |

**The held one, stated where it can be seen.** `server/index.js:361` is a comment on a path the running
server loads, so correcting it **re-owes a cutover**. It is deliberately **not** in Round 47's PR: the
owed movement had just been paid (#6) and the product restored after the host replacement, and a
one-word comment fix must not spend that cycle silently. It is recorded here, in the round block's
*"what I did not do"* bullet, and at trigger 7's site in the tracker.

## Why the register's site owes no cutover — measured, not assumed

The decisive test is the **running server's require closure**, not "does the file live under
`server/`". `server/index.js`'s own requires are: `db`, `compliance_engine`, `auth`, `eosb`,
`preboarding`, `preboarding-items`, `privacy-notice`, `preboarding-workspace`, `preboarding-package`,
`preboarding-flag-scheduler`. **`server/reachability-register.js` is not among them** — the two loaders
are `server/reachability.test.js` and `scripts/reachability-report.js`. The register's own entry for the
removed route says `decision: 'decision 17'` six lines above the sentence that called the kept table
*"decision 14's subject"*: the artifact contradicted itself, which is how the site was proved rather
than inferred.

## The class, with its bound

Twelve sites, twelve dispositions — **eight corrected in place**, **one held**, **one annotated over a
kept quote**, **one corrected on the host outside the repository**, and **one argued as correct and
left byte-identical**. Nothing else was touched: each edit script run reports its files' line counts
and digests before and after, and the only diffs are the ones in the table above.

**Corrected, not rewritten — the audit's own heading.** Its Table B said *seven sites wrong under both
schemes*; its TSV behind that table had measured ten of them. The seven were real; the heading read as
a bound when it was a subset. That is the same defect this team met three times on 2026-10-14 — *a
check that cannot be reddened proves nothing*, *an enumeration is smaller than its class*, and *a
report that can quietly omit a category cannot stay green* — met here in the audit's own output. The
correction is stated, not applied silently: the heading stands as written and this record is the bound.

## The residual, bounded and named

After the sweep the repository still carries **twelve** lines matching `decision 14`, and every one is
named here — an enumeration that does not state its bound reads as complete, and this is the same
discipline the sweep is about:

| line | why it stays |
|---|---|
| `docs/evidence/pdpl-lawful-basis-mapping/README.md:147` | the fenced transcript of `demo-weak-screens.md:64` — a quote, kept byte-for-byte |
| `docs/evidence/pdpl-lawful-basis-mapping/README.md:149` | the dated note appended under that quote (this sweep's own record) |
| `docs/evidence/decisions-21-17-2026-10-13/enumeration-and-route-table.txt:38` | the `grep` capture quoting `server/index.js:357` |
| `server/index.js:361` | **the held site** — a served-path comment, owes the next movement |
| `roadmap-board-index.md:214` | this round's corrected line (read 13, now 14) |
| `pdpl-lawful-basis-mapping.md:135` | the caution that *quotes* the stale label in order to flag it |
| `design-concepts/LAYER2-NOTICE-SHOWN-SURFACE-REVIEW.md:4`, `docs/evidence/p2-6-premise-sweep/README.md:49`, `server/schema.sql:295`, `pdpl-acknowledgement-route-spec.md:71`, `pdpl-lawful-basis-mapping.md:61`, `roadmap-board-index.md:294` | the **correct** portal-identity cites (six) |

## The gates, run rather than assumed

* **`scripts/check-index-ids.py` → exit 0** (`OK: every quoted id resolves, no removal is unrecorded, and
  the re-check section's trigger structure is intact`). **It reddened first**, on two 8-hex digests this
  round wrote with an ellipsis (`91f05725…`, `ca4f9583…`), which its short-ref rule reads as unresolvable
  board-id references. Both are now written in full — and the hook's `ca4f958365d7fd9bae5aec8d56aede71` was
  **verified against the file**: that md5 is the hook's, and the repository copy, the deployed copy and the
  installed `/etc/profile.d` copy are all byte-identical (`sha256
  774981c4e9de98e04b888670e74923b09eb4bcecce1e08b529d88540826ef276`). The record's hash was checked before
  being written as current.
* **`server/reachability.test.js` → 12 tests, 11 pass, 1 fail — and the failure is not this change's.**
  Proven by running the same suite in a pristine `git worktree` at `f05ebc4`: it fails identically. The red
  is test 6, *"no client call site names a route the product does not register"*, and its drift entry is
  **`GET /api/compliance/report at scripts/cutover-preflight.sh:223`** — i.e. **#196's own new preflight
  script mentions the retired route inside a probe string, and the scan reads a mention as a call site.**
  The report script prints the same thing as *"1 NEW finding"*. Reported to the lead; the fix belongs to
  #196's author, not to this sweep.
* **The whole suite, re-measured 2026-10-17 at the branch tip and on a pristine `git worktree` of
  `origin/main` (`2a44858`): `161 tests, 159 pass, 2 fail` — and the two reds are identical on both
  trees, so neither is this branch's.** The reds are `server/demo-seed.test.js` (top-level test 2) and the
  reachability scan (test 43 — the same `GET /api/compliance/report at scripts/cutover-preflight.sh:223`
  drift recorded above). **The first is this machine, not the repository:** `server/demo-seed.test.js:48`
  shells out to `scripts/seed-demo.js`, which loads `server/compliance_engine.js`, whose first line
  requires `uuid` — and this clone has **no `node_modules` at all** (`require.resolve('uuid')` unresolved
  from `server/`), so the test dies before any assertion runs. **So that count is a reading of this box,
  not of the deploy gate:** the `164/164 ×5` and `169/169` figures in the plan were taken on an installed
  tree, and the two are not interchangeable. The bullet above (`server/reachability.test.js` → 12/11/1) is
  scoped to **one file** and is still true of it; it is not a suite result and should not be read as one.

## What was not re-checked

The audit's §5 bounded its clean set: neither copy of `WORKFLOW.md` carries a decision-number citation,
the plan's own cross-reference was the lead's to change (done in revision 99/100), and no citation into
`design-concepts/LAYER2-PREBOARDING-UI.md` exists in the tracker. Those findings are not re-opened here.
