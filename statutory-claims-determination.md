# Unsourced "statutory" claims — source-or-drop determination (implementation spec)
**Prepared by:** Compliance Expert · 2026-10-06
**For:** the engineer, as the spec for the **single consolidated PR** (owner decision: one change, one PR).
**Base:** `main` @ `eeb4dd3`. Line numbers are as of that commit; every current string is quoted so it can be located if lines shift.
**Status of my earlier work:** I had opened branch `docs/statutory-claims-90day-notice` and PR #53. **Both are closed** (PR closed with a "superseded" comment, branch deleted, `main` left clean at `eeb4dd3`). Nothing of mine is in flight. This determination supersedes `/home/team/shared/statutory-claims-90day-notice-resolution.md` and the deadline half of `/home/team/shared/statutory-deadline-claims-resolution.md`.

## Determination, in one line
**Every item in this class is DROP THE QUALIFIER. Nothing in the class could be sourced. No item is asserted to be wrong — each is "unconfirmed", which is the honest and permitted outcome.**

**Why nothing could be sourced.** (a) No article is named in any of our materials — the exception is the stale `"Article 132"`, which is the repealed Law 8/1980, not FDL 33/2021. (b) The relevant questions are already with counsel: `uae-counsel-confirmation-request.md` points 4 (unpaid leave), 5 (notice) and 6 (settlement deadline); `ksa-counsel-confirmation-request.md` point 5 (settlement deadline) and 6 (notice). (c) I attempted to source the primary texts directly this session and could not: `uaelegislation.gov.ae` returns a Cloudflare 403 / challenge page to browser and plain fetches and holds no Wayback snapshot; `laws.boe.gov.sa` times out; NATLEX returns 403; the search engines available here return captchas or unrelated results. **We hold no consolidated text of either statute.** If counsel later supplies an article, the word comes back with a citation — that is a one-line follow-up, not a rewrite.

**Global rule the engineer should apply while landing this:** where a number stays, it stays *unchanged*; only the legal qualifier goes. Do not delete any finding, and do not reword anything not listed here.

---

# Group 1 — Settlement deadlines presented as statutory (code, user-facing)
Decision: **DROP the qualifier, keep the number as our operational standard.**

| # | File:line | Current wording | Replacement |
|---|---|---|---|
| 1.1 | `server/compliance_engine.js:27` (inside `checklistTemplates.UAE.offboarding`) | `{ title: 'Final Settlement Payment (within 14 days)', description: 'Complete final payment within 14 days statutory deadline.' }` | `{ title: 'Final Settlement Payment (within 14 days)', description: 'Complete final payment within 14 days.' }` — title unchanged (house-standard label, not a legal claim) |
| 1.2 | `server/compliance_engine.js:50` (inside `checklistTemplates.KSA.offboarding`) | `{ title: 'Final Settlement Payment', description: 'Pay salary + EOSB + leave + notice (within statutory deadline).' }` | `{ title: 'Final Settlement Payment', description: 'Pay salary + EOSB + leave + notice (within the settlement deadline).' }` — title unchanged |

This is the only pair that reaches a user-facing surface. The UAE string is the one on the live demo; the KSA one sits behind the Phase 2 pause.

# Group 2 — Settlement-deadline lines in the requirements doc
Decision: **DROP the qualifier, keep the numbers** (14 days / 2 weeks / 7 days) as our operational standard. These are the same claims as Group 1 in prose.

| # | File:line | Current wording | Replacement |
|---|---|---|---|
| 2.1 | `compliance-requirements.md:56` | `| **Final Settlement** | Full settlement within 14 days of termination. Includes: salary, gratuity, leave encashment, any other dues. | Final settlement checklist. Auto-generate settlement statement. |` | `| **Final Settlement** | Full settlement within 14 days of termination *(our operational standard — no article held; see counsel request point 6)*. Includes: salary, gratuity, leave encashment, any other dues. | Final settlement checklist. Auto-generate settlement statement. |` |
| 2.2 | `compliance-requirements.md:90` | `| **Final Settlement** | Payable within 2 weeks of termination (or 7 days if employer-initiated). Includes: salary, EOSB, leave encashment, notice pay. | Final settlement timeline stricter than UAE. |` | `| **Final Settlement** | Payable within 2 weeks of termination (or 7 days if employer-initiated) *(our operational standard — no article held; see KSA counsel request point 5)*. Includes: salary, EOSB, leave encashment, notice pay. | Final settlement timeline stricter than UAE. |` |
| 2.3 | `compliance-requirements.md:515` | `| **Offboarding Settlement Calculator** | **P0** | Auto-generates final settlement: salary, EOSB, leave encashment, notice pay. 14-day/UAE and 7-day/KSA settlement timelines. |` | `| **Offboarding Settlement Calculator** | **P0** | Auto-generates final settlement: salary, EOSB, leave encashment, notice pay. 14-day/UAE and 7-day/KSA settlement timelines *(our operational standard, not yet sourced — see Group 1)*. |` |

Note the two docs disagree on the KSA figure (L90 "2 weeks / 7 days employer-initiated" vs L515 "7-day/KSA"); both are kept because neither is sourced and the inconsistency is now an explicit counsel question (KSA request point 5). Do not harmonise them by invention.

# Group 3 — The 90-day unpaid-leave "statutory allowance"
Decision: **DROP the qualifier.** The 90-day figure stays as the engine's rule; the claim that the law grants that allowance goes. Also: e **unconfirmed whether the threshold is "per year" or a single total** — that is counsel request point 4 and is not to be decided here.

| # | File:line | Current wording | Replacement |
|---|---|---|---|
| 3.1 | `eosb-review-report.md:9` (data-handling note) | `Statutory constants (e.g. 90 days, 21/30 days per year, the 2-year cap) are quoted because they are legal provisions, not employee data.` | `Engine constants (e.g. 90 days, 21/30 days per year, the 2-year cap) are quoted because they are calculation parameters, not employee data. **Not all of them are sourced legal provisions** — where no article is behind a number it is labelled as the engine's rule, not as law.` |
| 3.2 | `eosb-review-report.md:26` (Finding 2 summary) | `- **Finding 2 (P1, unpaid-leave over-deduction) — FIXED.** UAE now excludes only unpaid leave beyond 90 days per year of service; KSA subtracts all (no statutory exclusion), per the recommendation.` | `- **Finding 2 (P1, unpaid-leave over-deduction) — FIXED.** UAE now excludes only unpaid leave beyond 90 days per year of service; KSA subtracts all unpaid leave, per the recommendation. **The 90-day allowance is the engine's rule, not a sourced legal provision** — we hold no article for it, and the UAE counsel request asks for one (point 4).` |
| 3.3 | `eosb-review-report.md:66` (original problem) | `the engine subtracted *all* unpaid leave days from service for UAE, under-paying employees who took leave within the statutory allowance.` | `the engine subtracted *all* unpaid leave days from service for UAE, under-paying employees who took leave within the 90-day allowance the engine applies.` |
| 3.4 | `eosb-review-report.md:72` (inside a **verbatim quote** of the engine) | `    // KSA: No statutory exclusion for unpaid leave unless specified in contract.` | **DO NOT REWORD THE QUOTE** — it must keep matching the engine. Instead insert, immediately after the closing fence of that code block and before `**Verification (re-run):** T9…`, this note: `> **Unsourced qualifier in the quoted engine comment.** The block above quotes `server/eosb.js` verbatim, and its KSA comment reads "No statutory exclusion…". That word asserts a legal proposition (that KSA law provides no exclusion) with no article behind it. The quote is left verbatim so it still matches the engine; **the code comment itself is filed for a source-or-drop change** (not made here — the engine is frozen).` |
| 3.5 | `compliance-requirements.md:54` | `| **Unpaid Leave** | Unpaid leave periods > 90 days are excluded from EOSB calculation. | Track absence types and durations. |` | `| **Unpaid Leave** | Unpaid leave periods > 90 days are excluded from EOSB calculation *(the engine's rule — no article held, and whether it is "> 90 days per year" or a single 90-day total is unconfirmed; see UAE counsel request point 4)*. | Track absence types and durations. |` |

**Not mine to change (flagged, leave alone):** `server/eosb.js:18` carries the same `"No statutory exclusion"` comment. The lead's constraint is that `server/eosb.js` is not touched, so the comment stays and the note at 3.4 outs it. If the engineering PR is later allowed to touch that one comment line, the replacement is `// KSA: no exclusion for unpaid leave modelled for KSA; exclusion applied to UAE only.` — but **only on the lead's say-so.**

# Group 4 — The notice-period "statutory" wording
Decision: **DROP the qualifier.** The rule we keep and still hold as our reading is unchanged: **notice compensation is the wage for the unserved notice period, a separate settlement line, never a percentage of EOSB and never a deduction from it.** What goes is the word "statutory" and the presentation of the day counts as sourced law. **The KSA notice figure is genuinely uncertain and must not be asserted** — see the contradiction below.

| # | File:line | Current wording | Replacement |
|---|---|---|---|
| 4.1 | `eosb-engine-gaps-spec.md:28` | `- Consequence: an employee who resigns without serving notice is **not** charged the statutory notice compensation, and an employer who waives notice is not credited — in both directions the number is silent about a real statutory item.` | `- Consequence: an employee who resigns without serving notice is **not** charged notice compensation, and an employer who waives notice is not credited — in both directions the number is silent about a real settlement line item.` |
| 4.2 | `eosb-engine-gaps-spec.md`, §2.2 (insert as the first thing under the heading `### 2.2 Statutory basis`, above the KSA paragraph) | *(nothing today — the section asserts a statutory basis that cites only our own `compliance-requirements.md`)* | `> **Sourcing status — read before relying on this section.** The notice rules below are our working reading of the two statutes. **We hold no article number and no verbatim text for the notice periods or for notice compensation in either jurisdiction**, and our own records contradict each other on the KSA period (`compliance-requirements.md` L87 says 60 days/indefinite and 30 days/fixed-term; this spec says "KSA 60/30"). The word "statutory" has therefore been **removed from the three strings below** and the figures kept as the engine's working assumption. Both counsel requests already ask for the articles (UAE point 5, KSA point 6).` |
| 4.3 | `eosb-engine-gaps-spec.md:66` | `| `notice_period_days` | integer (days) | contract/statutory notice; KSA 60/30, UAE 30–90 per contract |` | `| `notice_period_days` | integer (days) | notice period, **values not yet sourced** (KSA and UAE both set by contract/law — see the sourcing status at §2.2) |` |
| 4.4 | `eosb-engine-gaps-spec.md:96` | `| Termination during probation | no statutory notice is owed during probation → no notice compensation |` | `| Termination during probation | **unsourced** — no notice is modelled as owed during probation → no notice compensation. *(Our own records say otherwise: `compliance-requirements.md` L41/L50/L87 give 14 days UAE / 30 days KSA employer notice in probation. Counsel question below.)* |` |
| 4.5 | `eosb-engine-gaps-spec.md:98` | `... the only differences are the statutory notice length (KSA 60/30 vs UAE 30–90 contract) and the salary basis ...` | `... the only differences are the notice length (KSA and UAE each set by contract/law — **values not yet sourced**) and the salary basis ...` |

**Leave alone (already carries its own unverified flag or is not a figure claim):** `eosb-engine-gaps-spec.md:46` and `:179` ("the statutory **measure** is wage-for-unserved-notice" — the rule, already flagged "exact article numbers should be confirmed … before code lands"); `:52` ("EOSB is an accrued statutory benefit" — characterisation, no figure); `:71` ("selects statutory defaults for the notice period" — depends on the same missing article); `:18` and `:166` (sentence-level and retention-policy uses; `:166`'s "1-year limitation period" is an unsourced figure but is a retention input, not a customer claim — log it, don't change it here).

# New finding this determination records (no fix; needs the owner/lead to file)
**Our records contradict each other on the KSA notice period, and one of them contradicts its own framing.**
- `compliance-requirements.md:87` — `| **Notice Period** | Min 30 days during probation (by employer). Post-probation: 60 days for indefinite contracts, 30 days for fixed-term. Employee side: 30 days (non-Saudi) / 60 days (Saudi). |`
- `eosb-engine-gaps-spec.md:66` — `"KSA 60/30"` with no statement of which case is which.

These are not reconcilable by reading our own notes; they need the statute. The KSA counsel request already asks the question, so the resolution path exists — but the contradiction should be visible in the single PR (item 4.2 puts it in the doc). **No engineering change follows: nothing in `server/eosb.js` reads a notice period today** (notice compensation is unbuilt by design, gaps spec §2.3).

## What this determination did NOT do
- Did not touch `server/eosb.js` or the frozen UAE resignation tier (1/3–2/3 at `server/eosb.js:66–69`) — untouched, still flagged unconfirmed.
- Did not assert any claim is wrong. Every item is "unconfirmed", and the number stays in every case except the dropped qualifier.
- Did not delete any finding; every flag in Groups 3 and 4 was *added*, not removed.
- Did not change anything outside the quoted strings and the four inserted notes.
