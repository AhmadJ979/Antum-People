# Row `198a2562` — the owner's storage decision, recorded where the code said it was open

**Branch:** `fix/l2-storage-decision-recorded`, base `origin/main` `cd4edca`.
**Rule 14 observed:** the live server was not restarted, not reconfigured, and the deployed tree
(`/home/team/shared/probable-octo-sniffle`, tree `2028894`) was not touched. Nothing in this branch is
deployed until the lead cuts over.

## 1. What was wrong

The owner decided on **2026-10-07**: document storage is **a reference string only, no bytes**, and the
**S3-compatible store is deliberately not built — IFZA registration is the gate (an event, not a date;
owner decision 10)**. `server/document-store.js` went on saying the choice was still open — in the
module's banner, in its option list, and in the refusal text a caller would actually read. That file is
where a future engineer looks to find out what was decided, so its wording is the record.

## 2. The fix, locus by locus

| locus (before) | before | after |
|---|---|---|
| `server/document-store.js:5` (banner) | `NO STORE HAS BEEN CHOSEN, AND CHOOSING ONE IS NOT A BUILDER'S CALL` | `THE DECISION IS MADE: A REFERENCE STRING ONLY, NO BYTES — UNTIL IFZA REGISTRATION` |
| `:7`–`:12` | "the one place where the contents will live **once the decision is made**"; "§10 Q5 **asks the owner** where collected documents live" | states the decision **in force**; the module holds a decision already taken |
| `:14`–`:15` | "refuses, loudly, rather than a store being picked in passing" | "refuses on every path that would write bytes — because refusing is what keeps the code honest while the store does not exist" |
| `:21`–`:22` | "If a **store** were chosen by accident" | "If **bytes** were stored by accident" |
| `:25`–`:38` | "The candidate stores, **for the owner's decision**" | the same four options kept for the record, each marked: a/b **not chosen**; c **the store the decision names for after IFZA registration — and it is not built**; d **the decision in force (owner, 2026-10-07)** |
| `:41`–`:43` | "**When a store is chosen**, it is implemented behind `saveDocument`/`readDocument`" | "When **IFZA registration completes and option c is built**…" |
| `:46`–`:47` | "The configuration a real store will need. Named here **so the decision has one obvious door**." | naming the variable **configures nothing** and creates no store; `isConfigured()` is a constant `false` |
| `:51` (default error message) | "No document store is configured, so no document content can be stored." | "Document bytes are not stored: **by decision (owner, 2026-10-07)** this release records a reference string only…" |
| `:58`–`:59` (`isConfigured` doc) | "it stays false **until the owner chooses a store**" | "**False by decision, not by omission**…" |
| `:72`–`:74` (**the refusal a caller reads**) | "No document store is configured: where collected documents live is **undecided**, so the product refuses to store document content rather than choose a place for it." | "Document bytes are not stored: the owner's decision (2026-10-07) is a reference string only — a file name, or the reference HR quoted — with no bytes, and the S3-compatible store is deliberately not built until IFZA registration completes…" |
| `:81` (`readDocument`) | "No document store is configured: nothing has been stored…" | "No document content is stored: **by decision (owner, 2026-10-07)** this release records a reference string only and holds no bytes…" |
| `server/preboarding-items.test.js:450`–`:451` | test "…refuses rather than choosing a place for the bytes"; message `'no store has been chosen'` | test "…says why — **not that it is undecided**"; message "the owner's decision (2026-10-07) is a reference string only — no bytes are stored" |
| `server/preboarding-items.test.js:452`–`:459` | asserted only `instanceof` + `status === 501`, and `/nothing has been stored/` on the read path | now also asserts the refusal carries `/reference string/`, `/2026-10-07/`, `/IFZA registration/` **and does not contain** `/undecided/i` — the wording is held by the test, not by review |
| `server/preboarding-items.test.js:466` | "`${forbidden}` would mean **a store had been chosen**" | "…would mean **document bytes are stored, which the owner's decision (a reference string only) does not permit**" |

**No behaviour change.** `isConfigured()` is still a constant `false`; both functions still throw the
same error class with `status = 501`; no route calls them; **no S3 client, no configuration and no
store were added** — the delimiter is the decision, not new machinery.

### Line citations this edit moved (re-grounded in the same branch)

The rewrite shifted every line in the file, so two documents that cite it by line were corrected. Both
had already recorded the *decision* correctly; only the arithmetic was stale:

- `design-concepts/LAYER2-PREBOARDING-UI.md:654` — `server/document-store.js:66`–`:78` → `:89`–`:109`
- `design-concepts/LAYER2-P2-2-IMPLEMENTATION-NOTES.md:37` — `saveDocument`/`readDocument` (`:70`, `:79`)
  → (`:89`, `:103`); `ANTUM_DOCUMENT_STORE` (`:47`) → (`:62`)

## 3. The sweep, and every locus it found

Class searched — the decision described as **still open**: `NO STORE HAS BEEN CHOSEN`, `no store has been
chosen`, `no store is configured`, `undecided`, `not yet decided`, `pending decision`, `candidate
stores`, `for the owner's decision`, `storage (decision )?is/remains (open|undecided|unresolved)`,
`where collected documents live is undecided`; over `*.js *.jsx *.ts *.tsx *.md *.txt *.html *.json`,
excluding `node_modules/` and `dist/`.

- `sweep-before.txt` — tree `cd4edca`, run in a **read-only worktree** at `/tmp/pre-fix` (removed after)
- `sweep-after.txt` — this branch's working tree

**17 hits before → every code locus fixed.** The remaining after-hits, named one by one rather than
quietly left:

| remaining hit | why it is left |
|---|---|
| `design-concepts/LAYER2-P2-2-IMPLEMENTATION-NOTES.md:37` | **Deliberately historical and self-correcting in the same sentence:** "*No store was chosen **when this module was built** — deliberately — **and the owner has since decided (2026-10-07)**…*". It is a dated account of the build moment at `5ed731e`, not a claim about now. Its two line citations were re-grounded (above). |
| `docs/evidence/p2-6-portal-spec/measurements.txt:87` | A **dated evidence transcript** quoting the refusal string as measured on the tree it was taken on. Rewriting it would falsify the record of what the surface said that day. |
| `roadmap-board-index.md:36`, `:37`, `:149`, `:165` | The tracker's **dated round records**. `:165` states the row's premise "is live on the deployed tree" — **still true**: this branch is undeployed until the lead cuts over, so the record is accurate as written. |
| `pdpl-portal-boundary-memo.md:29` | **Different subject** — "*a second, older **consent** store exists*". |
| `design-concepts/LAYER2-PREBOARDING-UI.md:1053` | **Different subject** — "*the hire's **identity** is undecided*" (§8C / D14). |
| `server/preboarding-items.test.js:450`, `:466`, `:473` | **My own new wording**: it mentions "undecided" in order to assert the refusal does *not* contain it. |
| `docs/evidence/l2-storage-decision/sweep-*.txt` | This directory: the before-file quotes the removed lines by definition. |

Not a hit but checked and correct: `pdpl-portal-boundary-memo.md:192` (option D described, IFZA gate
named), `design-concepts/LAYER2-PREBOARDING-UI.md:74`, `:650`–`:656`, `:917`, `:944`–`:950` (all
decision-language), and the **client** — `client/src` has no storage-decision copy at all, so no client
change was needed and rule 15's build proof does not apply to this branch.

## 4. Proof

`test-run.txt` — `cd server && npm test` at this branch's commit:

```
1..31
# tests 134
# suites 31
# pass 134
# fail 0
```
