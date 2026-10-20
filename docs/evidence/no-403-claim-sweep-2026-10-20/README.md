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
  the pattern dropped rather than kept to look productive. **That citation was itself stale by the time `main`
  moved again** (PR #247 took that sentence to `:530`) — see §6.

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
| `sweep-output-f5c19ec.txt` | its run **after** the corrections, on the pushed revision: the citations now land |
| `measure-app-tsx-anchors.py` | the anchor measurement. `python3 measure-app-tsx-anchors.py 7b073f8 7a4e00a` |
| `anchors-7b073f8-vs-7a4e00a.txt` | its output (and `anchors-7b073f8-vs-1f471ef.txt`, the earlier tree). The run filed as `7bcbd67` was the pre-squash commit of this same tree; `f5c19ec` is the pushed one. |

## 6. This record's own citations, re-verified after `main` moved — twice

The lesson of §2 applies to the artifact that states it. `origin/main` moved **twice** while this branch was being
written (`1f471ef` → `7a4e00a` → `58d8417`), so the citations in this record were re-checked rather than assumed:

- `git diff --name-only 7a4e00a 58d8417 -- client server` is **empty**, and **all ten `App.tsx:<n>` anchors written
  into `design-concepts/LAYER3-IDENTITY.md` still land** on the content they name at `58d8417` (Admin User,
  `access_role`, `Sign Out`, `space-x-3`, `recorded by`, `checklistNotice` ×2, `max-w-md`, `ml-3`, `mr-2`).
- **One citation in this file *was* stale:** `docs/access-model.md:504`, quoted in §3 above, moved to **`:530`**
  when PR #247 landed (decisions 25/26/27). It is now stated with its tree rather than as a bare line number.

That is the rule this whole record argues for: **a line citation is a measurement, and a measurement has a
revision.** Where a number is quoted here, the tree it was read at is named beside it.

## 7. The instrument, and what its first run says — including about itself

**`check-doc-citations.py`** (this directory) fails when an `App.tsx:<n>` citation in `design-concepts/` does not
land on what it names. It reads the expectation **out of the document it judges**, so no table in this file can
go stale on its own: the backticked symbols on the citing line are what that citation claims.

**Red, on the document as it merged.** The document that landed as PR #255 was measured on `7a4e00a`; **PR #254
merged at 09:37:41, one minute before it merged at 09:38:21**, and moved `client/src/App.tsx` again. Judged against
the tree #254 left:

```
python3 check-doc-citations.py 1155913 ab7e9c3      # rc=1  ->  6 ok, 47 FAILING, 30 unchecked
```

**Re-grounded here onto `ab7e9c3`** (`App.tsx` **2,539 lines**) — `LAYER3-IDENTITY.md` and its index row: identity
card `:1212`–`1213` → **`:1222`–`:1223`**, `Sign Out` `:1198` → **`:1208`**, identity block `:1202`/`:1215`, the
`recorded by` prints `:2107`/`:2162`, the `checklistNotice` banner `:2393`–`:2394`, the login card opens `:356`,
`ml-3` `:416`, `mr-2` `:369`. Every one of those numbers was measured, not shifted.

**And the instrument is not yet a gate, which its own run shows.** On *this* branch's tree against *this* branch's
doc:

```
python3 check-doc-citations.py da8a761 da8a761             # rc=1  ->  11 ok, 42 FAILING, 30 unchecked
```

**Two of the 42 are false positives, verified by hand** — the checker fails on a *correct* document, which
disqualifies it as a gate in that form:

- `LAYER3-IDENTITY.md:37` — the citing line describes a block and names the button text (`Sign In`), which lives a
  few lines below the cited div. A descriptive token is not a symbol of the cited line.
- `README.md:17` — a range end written without backticks (`:1222`–`1223`), so only the first number was captured.

The first version also read **times** (`09:37:41`) and **ports** (`:5173`) as line numbers; number extraction now
accepts only an `App.tsx:<n>` anchor or a backticked `:n`. **The red count is an upper bound, not a defect count.**

**The other 40 are real**, and they are the finding this row existed to produce — sibling documents whose
citations #254 moved exactly as it moved mine:

- `design-concepts/LAYER2-PREBOARDING-UI.md` — **19**
- `design-concepts/LAYER2-P2-1-IMPLEMENTATION-REVIEW.md` — **9**
- `design-concepts/LAYER2-INTERFACE-FIXES-PICK-LIST.md` — **5**
- `design-concepts/CLIENT-STATES.md` — **4**
- `design-concepts/LAYER2-P2-2-IMPLEMENTATION-NOTES.md` — **3**
- `design-concepts/LAYER3-IDENTITY.md` — **1**
- `design-concepts/README.md` — **1**

**Re-grounding those is a separate row** (their citations are stale, not false — the fix is measurement, not
wording). What the instrument is good for *today* is that it would have caught #254's movement across all of them,
which nothing did.

**And this file's own §6 is now false.** It said all ten `App.tsx` anchors still land at `58d8417`. They did, at
`58d8417`. #254 moved them. **A statement about a tree is only true of the tree it names** — which is why every
number above is followed by its revision.
