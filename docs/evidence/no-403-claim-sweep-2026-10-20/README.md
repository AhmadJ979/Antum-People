# Sweep: documents that said the client has no 403 handling — and the one that said the client had not moved

**Row `a685c1c0`** (*"[DOCS] Sweep every document that still says the client has no 403 handling — the false
sentence has siblings"*), 2026-10-20. Measured at `origin/main` = **`7a4e00a`**. This branch changes **no
`client/` or `server/` path**, so it owes **no build proof and no movement** — the host stays where it is.

## 1. The class is clean. The site the row named does not carry the claim.

`sweep-no-403-claim.py` scans **every tracked `.md` at a given revision** and prints the denominator first, so a
reviewer can re-run it and get the same set: **112** files scanned, **25** mentioning `403` at all,
**6** claim-class hits with the digits, **0** without.

**All 6 hits are one thing: a quotation of the refuted sentence inside narration about it.** They are
records, not live claims — `design-concepts/CLIENT-STATES.md:8` (*"…asserted that the client had no 403 handling
at all. **That was true at `ee4bbdf` and false the moment #241 landed**"*), `:17` (the two sentences marked
**removed**), and `docs/evidence/client-states-cites-2026-10-20/README.md:19`, `:56`, `:57`.

**The named site is refuted by its own text.** `design-concepts/README.md:17` (the `LAYER3-IDENTITY.md` row) says
the design covers *"how an **unnamed-actor refusal** (the pre-boarding 400) and a **deny-by-default 403** look on
screen"* — it **presupposes** the client renders a 403. It does not say handling is absent. The other `.md` files
mentioning `401`/`403` (enumerated by the same sweep) are live endpoint measurements and mechanism notes, all
still true. **Nothing was "fixed" here that was not wrong.**

## 2. What the sweep found instead — a claim about the client, refuted by a merge

`design-concepts/LAYER3-IDENTITY.md` reads its citations out of the shipped `client/src/App.tsx`, and its header
excused leaving them un-re-dated with:

> *"**The measurements are not re-dated and do not need to be:** `git diff --name-only 7b073f8 origin/main -- client server` is **empty**"*

**That is false from PR #241 on.** `git diff --name-only 7b073f8 7a4e00a -- client server` lists **19 paths**;
`client/src/App.tsx` grew **2,494 → 2,529 lines**. So **every `App.tsx:<n>` citation in the file was stale**, and
`measure-app-tsx-anchors.py` measured each one:

| citation | `7b073f8` | `7a4e00a` | note |
|---|---|---|---|
| identity card — name / role line | `:1196` / `:1197` | **`:1212` / `:1213`** | the field is `access_role`, no longer `role` |
| icon-only `Sign Out` (`title="Sign Out"`) | `:1182` | **`:1198`** | |
| identity block (`space-x-3` twice) | `:1173`–`1200` | **`:1192`–`:1216`** | |
| `checklistNotice` banner | `:2348`–`:2349` | **`:2383`–`:2384`** | its state is still `:529` — the shift is regional |
| `recorded by {recorded_by}` prints | `:2062` / `:2117` | **`:2097` / `:2152`** | |
| login card / dismiss `ml-3` / error icon `mr-2` | `:347`–`431` / `:409` / `:362` | opens **`:355`** / **`:415`** / **`:368`** | +6 in that block |
| `Antum People` heading | `:357` | **`:363`** | |

Corrected in place, in the **past tense** where the claim was about a moving tree: the header now states the
re-measurement and *why* the old judgement died; the citations it excused are re-numbered; the quoted fallback
line reads `{user?.access_role || 'Administrator'}`; the index row is corrected the same way.
**Post-fix, PASS 3 shows 8 citations in `LAYER3-IDENTITY.md` landing on the lines they name.**

Hashes, taken **after** the edits: `design-concepts/LAYER3-IDENTITY.md` blob `5478cbe7a52c91486be378d795464e38759411f0` md5 `95de5e814c8b6b7a0dee67260cfc2f55`;
`design-concepts/README.md` blob `7a4b5758eebc7424174b6a29d3ad15fbd5427219` md5 `320dfea98f57f183cf87dc115c5c60fb`.

## 3. The controls — the check reddens on the stale file and passes on a fresh one

- The same citation check over `design-concepts/CLIENT-STATES.md` (re-grounded yesterday onto this same tree)
  **passes on all 8 of its citations** — `:594` `const fetchData`, `:8` `const REFUSAL_NOTICE`, `:572`
  `onRefusal: () => setRefusal(REFUSAL_NOTICE)`, `:1284` `<div role="alert"`, `:363` the sign-in heading. A check
  that only ever prints is not a check.
- **A false positive, reported and rejected:** an earlier pattern for `19 lines` (the client's 401-branch count)
  matched `docs/access-model.md:504` inside *"`server/index.js` grew from 939 to **1,119 lines**"*. Rejected, and
  the pattern dropped rather than kept to look productive.

## 4. Two instruments' own bugs, caught by their own asserts — stated because they are the reason to trust §2

- The anchor measurement **first reported the role line as missing**: the pattern was written `|| 'access_role'`,
  the field is `access_role ||`. The assert on the anchor set stopped the run before anything was written.
- The edit script **died twice with the document unmodified**: one citation in the file carries a **non-ASCII
  colon** (`2348` matches; `:2349` does not), and a second site's old text occurs **twice** in `README.md`. Both
  failures were the assert doing its job — nothing was written until every site matched **exactly once**.

## 5. Limits, stated

- PASS 1/PASS 2 find the phrasings **enumerated in the script**, whitespace-tolerant (a wrapped sentence is still
  one sentence) but **not semantic**: a reader judges a hit's role — that judgement is §1.
- PASS 3 is scoped to the three `design-concepts/` files that carry this claim class. A repo-wide `App.tsx:<n>`
  citation sweep is a **different row** and is not claimed here.
- The sweep reads the **tracked tree at a revision**; an untracked or in-flight file is outside it.
- Line numbers are `split`-line counts, the same convention as the instrument that produced them.

## Files

| file | what it is |
|---|---|
| `sweep-no-403-claim.py` | the sweep. `python3 sweep-no-403-claim.py <rev>` — denominator, both passes, doc citations |
| `sweep-output-1f471ef.txt` | its run at `1f471ef` (committed earlier, still valid) |
| `sweep-output-7a4e00a.txt` | its run at `origin/main` — the class scan this record rests on |
| `sweep-output-7bcbd67.txt` | its run **after** the corrections: the citations now land |
| `measure-app-tsx-anchors.py` | the anchor measurement. `python3 measure-app-tsx-anchors.py 7b073f8 7a4e00a` |
| `anchors-7b073f8-vs-7a4e00a.txt` | its output (and `anchors-7b073f8-vs-1f471ef.txt`, the earlier tree) |
