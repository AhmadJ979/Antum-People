# UAE counsel letter — D1–D5 applied, D6 fixed (2026-11-07)

**State: the package is send-ready. The only thing missing is a recipient** — a firm, a lawyer's name,
and the address the firm takes new enquiries on. Nothing was sent. Nothing was merged; the letter is
not in the repository, so there is no PR.

Measured against `main` `de22e80` (deployed tree `/home/team/shared/probable-octo-sniffle`, branch
`main`, `git status --porcelain --untracked-files=no` → **0 lines**; only pre-existing untracked
`client/dist.bak-…/` and `server/*.db`). `server/compliance_engine.js` at HEAD and in the worktree are
the same blob: md5 `a9d0c2d2397ad9726e30f077a7ee7387`.

## The pair

| copy | before | after |
|---|---|---|
| `uae-counsel-confirmation-request--send-ready.txt` (what is sent) | `f21ff5d7444d85ded79b1e3138715b05` | `89b2bd58b1e8d33ef348a534cdb084ea` |
| `uae-counsel-confirmation-request.md` (the twin) | `c399668030c7dd7b104a2c570f743372` | `7bd134df0e532950a7e1c5949927e660` |

Both are **65 lines before and after** (dated records cite items by line; none moved). Word streams
after stripping `#`/`**`/backtick decoration: **1681 tokens each, 0 differing tokens**
(`python3 /home/team/shared/uae-letter-wordstream-check.py`, exit 0).

## Every sentence changed (before → after)

### Item 3 (line 11) — D1, the blocking one
- **Before:** "We return zero EOSB only on summary dismissal, which we read as Art. 44. Confirm Art. 44 and that it forfeits EOSB."
- **After:** "Our engine returns zero EOSB in two cases: on summary dismissal, which we read as Art. 44, and where service is under one year — the one-year minimum service stated in point 1, which we measure on service after the unpaid-leave deduction in point 4, so that deduction can by itself take a person below a year. It also returns zero when the service dates cannot be read at all; that is a computation failure, not a legal rule. Confirm Art. 44 and that it forfeits EOSB, and confirm that the one-year minimum in point 1 is correct."
- **Why:** at `de22e80` the engine returns zero at `server/eosb.js:128` (`below_minimum_service`, tenure < 1 after exclusions) and at `:73` (`not_computable`, unreadable dates), as well as at `:97-98` (`forfeited`, summary dismissal). `:88-92` can drive tenure under a year on its own. The old sentence also contradicted the letter's own item 1 (one-year minimum). Item 3 now uses item 1's phrase **one-year minimum service** word for word.

### Item 4 (line 13) — D5
- **Before:** "We exclude unpaid leave beyond 90 days per year from service. Which article or resolution states this, and is the threshold "per year" or a single 90-day total?"
- **After:** "Our engine deducts from service only the unpaid leave in excess of a cumulative allowance of 90 days multiplied by the employee's years of service, so a person with two years' service may take up to 180 unpaid days before any day is deducted. That is neither of the two readings we have met ("90 days per year", applied year by year, and a single 90-day total for the whole employment). Which article or resolution states this, and is the threshold "per year", a single 90-day total, or the cumulative allowance our engine applies?"
- **Why:** `server/eosb.js:88-92` — `allowedUnpaidTotal = 90 * totalYears`, `excessUnpaid = max(0, leaveDays - allowed)`, `netDays = rawDays - excess`. A cumulative allowance, which is neither option the letter put to counsel. **The question stays**; only the description changed.

### Item 5 (line 15) — D4
- **Before:** "We use a notice period of 30–90 days per contract (and 14 days by the employer during probation)."
- **After:** "The product holds no notice period: our database has no field for one, and the UAE contract template leaves the period as a per-contract blank to be completed. A range of 30–90 days per contract (and 14 days by the employer during probation) appears in our internal requirements note and in the checklist string listed as B1 in Appendix B, and we can source neither."
- **Why:** `server/schema.sql` has no notice-period column (`gave_proper_notice` at `:39` is a different, inert field); the template carries the placeholder `[notice_period] days` at `templates/uae-employment-contract.md:121`; the 30–90 / 14-day figures live only in `compliance-requirements.md:50` and in the checklist string B1 that the letter itself lists as unsourced. The rest of item 5 (settlement line, nothing computed, "up to 3 months' salary") is untouched.

### Item 7 (line 19) — D2
- **Before:** "Appendix A lists 17 claims our UAE contract template states with no article we can source, plus the waiver …"
- **After:** "Appendix A lists 17 claims drawn from our UAE template set — 10 of them name no article at all and 7 name one we cannot verify (U3, U10–U15) — plus the waiver …"
- **Why:** 7 of the 17 do name an article (U3 Art. 8; U10 Art. 42; U11 Art. 8; U12 and U13 Art. 43; U14 Art. 45; U15 Art. 47). 10 name none (U1, U2, U4–U9, U16, U17). Counted from the table itself.

### Appendix A preamble (line 29) — D2 + D3
- **Before:** "Each row is a claim our UAE contract template carries with no article we can source, and which no numbered item above puts in question."
- **After:** "Each of the 17 claims below (U1–U17) is one our UAE template set carries — 10 name no article at all and 7 name one we cannot verify — and no numbered item above puts any of them in question; the waiver in U18 is raised by point 7."
- **Why:** D3 — U18 lives in `templates/final-settlement-statement.md:53`/`:55`, not in the contract template, so "contract template" was false; the set is now named, matching item 7. D2 — the same 10/7 split, so the preamble and the table's own column agree. The U18 clause was added because the old "no numbered item puts in question" was false for U18 (point 7 raises it).

## D6 — the envelope around the letter

- **Cover email** `counsel-package-cover-email-2026-10-29.txt:77`: `[reply address] · [telephone]` → **`hello@antum.ae · [telephone]`** (`15c6a0d3…` → `df273054c733922330446363050c2547`). **The telephone stays a placeholder, deliberately** — we hold no number we may publish, and inventing one is not an option.
- **Send index** `counsel-package-send-index-2026-10-29.md:55` (`9fe3f0f2…` → `3784115914cd6ed192b9c65f2cddd1ac`): UAE hash re-set to `89b2bd58b1e8d33ef348a534cdb084ea` dated **2026-11-07**, with the twin's hash beside it, and the 2026-10-29 figure `6ab0e40263e380ea5cbcd42d51b40fd1` recorded as **correct for its day** — superseded by Appendix B (added after it) and by the 2026-11-07 re-wording, not contradicted by them.
- **`appendix-b-verify.py` check 6** (`ba9d6beb…` → `b755b3e9af617fea5c70afc56664b477`): its pinned letter md5s were already **stale before this session** (2 failures at the start: it wanted `873d643f…` / `76351f76…`, the 2026-11-04 state). Re-grounded to the new pair, with a comment saying the pin names a **state** and was superseded, not wrong. This is what makes that row able to redden again instead of being permanently red.

## Verification run (all printed, all after the edits)

```
python3 /home/team/shared/uae-letter-wordstream-check.py
  md 1681 tokens / txt 1681 tokens — WORD STREAMS IDENTICAL: yes (0 differing tokens)   exit 0

python3 /home/team/shared/verify-appendix-b-in-letter.py
  checks passed: 21   failures: 0   VERDICT: Appendix B in the letters is verbatim and intact. exit 0
  --selftest: 4 mutation(s) caught, 0 not caught  (en dash→hyphen in B1, line number moved, row deleted,
                                                   question reworded)                     exit 0

python3 /home/team/shared/appendix-b-verify.py
  checks run: 40   FAILING: 0                                                             exit 0

md5sum  uae-counsel-confirmation-request.md                        7bd134df0e532950a7e1c5949927e660
        uae-counsel-confirmation-request--send-ready.txt           89b2bd58b1e8d33ef348a534cdb084ea

cd /home/team/shared/probable-octo-sniffle
  git branch --show-current → main
  git rev-parse HEAD        → de22e80f69f4305e42981f35c52017e027d75aa9
  git status --porcelain --untracked-files=no | wc -l → 0   (no tracked file modified)
  server/compliance_engine.js  HEAD blob md5 == worktree md5 == a9d0c2d2397ad9726e30f077a7ee7387
  lines 22/23/26/27 still carry the four Appendix B strings verbatim
```

Appendix B's four quotations and their line numbers (`:22`, `:23`, `:26`, `:27`) are unchanged and
re-measured green. Appendix A's 18 `file:line` row references are untouched. The "17 + the waiver"
arithmetic is unchanged. Nothing in the repository was edited.

## The one blocking input that remains

**A named recipient:** the firm, the lawyer's name, and **the address the firm takes new enquiries
on**. Everything else in the package is filled: the letter is word-identical in both copies, the reply
address is a mailbox proven to receive mail, the hashes are current, and the phone is a deliberate
placeholder.
