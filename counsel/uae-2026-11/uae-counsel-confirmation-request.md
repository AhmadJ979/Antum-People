# UAE end-of-service benefit (EOSB) — confirmation request

**From:** Antum People, an early-stage HR software product (legal entity not yet registered). **Contact:** Ahmad Aljairoudi, Dubai, UAE.

Our product calculates end-of-service benefit for UAE employees. We want it to state only what the law provides. Please confirm each point below with the current article number and statutory wording (Arabic and English). Where we name an article, that is the one we believe applies.

1. **Basis and rate.** We calculate on **basic wage only** (not allowances), at **21 days' basic wage per year for the first five years and 30 days for each later year**, capped at **two years' wage**, with a **one-year minimum service**. We believe this is **Art. 51, Federal Decree-Law 33/2021**. Correct? Please quote the wording and confirm the article.

2. **Resignation reduction.** We apply a reduction on resignation: **one-third** of the gratuity for 1–3 years' service, **two-thirds** for 3–5 years, and the **full** amount for 5+ years. We are **not certain** this survived the 2021 law — it was the rule under the repealed Federal Law No. 8/1980 (its Art. 132). **Our engine is frozen on this tier by owner decision pending your answer.** Where a termination record carries no reason, our engine computes the entitlement unreduced and shows that basis with the figure; it does not treat a blank reason as a resignation or as any other reason. Does FDL 33/2021 retain any resignation reduction, and if so, at what thresholds and under which article — **and if not, from what date (and under which transitional provision) did it cease to apply?**

3. **Forfeiture.** Our engine returns zero EOSB in two cases: on summary dismissal, which we read as **Art. 44**, and where service is under one year — the **one-year minimum service** stated in point 1, which we measure on service after the unpaid-leave deduction in point 4, so that deduction can by itself take a person below a year. It also returns zero when the service dates cannot be read at all; that is a computation failure, not a legal rule. Confirm Art. 44 and that it forfeits EOSB, and confirm that the **one-year minimum** in point 1 is correct.

4. **Unpaid leave.** Our engine deducts from service only the unpaid leave in excess of a cumulative allowance of 90 days multiplied by the employee's years of service, so a person with two years' service may take up to 180 unpaid days before any day is deducted. That is neither of the two readings we have met ("90 days per year", applied year by year, and a single 90-day total for the whole employment). Which article or resolution states this, and is the threshold "per year", a single 90-day total, or the cumulative allowance our engine applies?

5. **Notice and early resignation.** The product holds **no notice period**: our database has no field for one, and the UAE contract template leaves the period as a per-contract blank to be completed. A range of **30–90 days per contract** (and **14 days** by the employer during probation) appears in our internal requirements note and in the checklist string listed as **B1** in Appendix B, and we can source neither. We treat an unserved notice period as a **separate settlement line**, never deducted from EOSB. Our software does not yet compute that amount: the offboarding checklist asks a person to confirm the notice period was served, and no amount is calculated. Our records also mention an employer claim of **"up to 3 months' salary"** if an employee resigns before a fixed-term contract ends. Which article(s) govern each, and how do they interact with EOSB?

6. **Offboarding deadlines.** Our records say final settlement is payable within **14 days** and the visa must be cancelled within **30 days** of termination — but we have no article number for either. Which article governs each, and what are the correct deadlines?

7. **Statutory schedule (Appendix A).** Appendix A lists 17 claims drawn from our UAE template set — **10** of them name no article at all and **7** name one we cannot verify (U3, U10–U15) — plus the waiver of future claims in our settlement statement template. Please confirm the article for each row, or say which claim is wrong — we assert no article number of our own. The waiver row is U18: our template records the amount as full and final settlement of all dues, states that no further claims remain against the employer, and waives any rights to future claims related to the employment or its termination, in English and Arabic. Is a waiver of that breadth effective in the UAE, and what wording would you use? To be clear, no one has signed or received that statement: the product withholds it today, and our question is about the wording, not about an act.

8. **Probation term.** Our internal requirements note records probation as "max 6 months, one extension allowed", and our UAE contract template prints the term as a bracketed blank in months, to be completed per contract. We do not default it: a contract with no recorded term is withheld rather than issued with a term nobody agreed. We believe six months is the maximum and that Federal Decree-Law 33/2021 gives no route to extend it — that the "one extension allowed" in our note is the rule of the repealed Federal Law No. 8/1980 and does not survive it [TO CONFIRM — for counsel / للمستشار القانوني]. Is that right? Specifically: (a) is six months the ceiling, and must the term be stated in the written contract at signing rather than set by employer policy later; (b) may a probation term be extended in the UAE at all, and if so by what instrument and within what limit; (c) does the probation period count within the employee's period of service for end-of-service benefit; and (d) may the same employee be placed on probation more than once with the same employer? That control is now built and live: each client records one of two terms, 3 or 6 months, on its employer record, and a client who chooses 6 months sits at the ceiling. Notice during probation is a separate question and is asked at point 5.

We also cite "Articles 51, 52, 53, and 132 of FDL 33/2021" internally; we believe "132" is a stale reference to the repealed Law 8/1980. Please confirm the correct current article numbers.

Until you confirm, we will not describe the UAE calculation as "compliant", and the article numbers our own offboarding checklist and contract template carry stay unconfirmed until you answer.

**Please reply with (1) your confirmation or correction on each point with pin-cites, and (2) your fee and turnaround.**

## Appendix A — statutory schedule (UAE)

Row references are `file:line` in our template set; the line numbers are those of commit `2ff2891`, which the templates have not moved from. Each of the 17 claims below (U1–U17) is one our UAE template set carries — 10 name no article at all and 7 name one we cannot verify — and no numbered item above puts any of them in question; the waiver in U18 is raised by point 7. Please answer each row: the article that governs it, or that no article does, or that the claim is wrong.

| # | Where | The claim as our template carries it |
|---|---|---|
| U1 | `templates/uae-employment-contract.md:3` | governing instrument: UAE (Mainland), Federal Decree-Law No. 33 of 2021 — no article named |
| U2 | `templates/uae-employment-contract.md:7` | contracts must be filed with MoHRE; the final version should be bilingual (Arabic and English) per UAE law — no article named |
| U3 | `templates/uae-employment-contract.md:58` | this is a limited-term (fixed-term) contract under Article 8 of Federal Decree-Law No. 33 of 2021 |
| U4 | `templates/uae-employment-contract.md:101` | basic salary must be at least 50% of total salary, per MoHRE guidelines |
| U5 | `templates/uae-employment-contract.md:108` | annual leave: 30 working days per year |
| U6 | `templates/uae-employment-contract.md:109` | sick leave: 90 days per year (15 at full pay, 30 at half pay, 45 unpaid) |
| U7 | `templates/uae-employment-contract.md:110` | maternity leave: 60 days (45 at full pay, 15 at half pay) |
| U8 | `templates/uae-employment-contract.md:111` | parental leave: 5 working days |
| U9 | `templates/uae-employment-contract.md:112` | Hajj leave: up to 30 days, unpaid, once per employment |
| U10 | `templates/uae-employment-contract.md:163` | termination ground — mutual agreement: Art. 42 |
| U11 | `templates/uae-employment-contract.md:164` | termination ground — expiry of the fixed term: Art. 8 |
| U12 | `templates/uae-employment-contract.md:165` | termination ground — resignation by the employee: Art. 43 |
| U13 | `templates/uae-employment-contract.md:166` | termination ground — termination by the employer (valid reason): Art. 43 |
| U14 | `templates/uae-employment-contract.md:168` | termination ground — redundancy: Art. 45 |
| U15 | `templates/uae-employment-contract.md:169` | termination ground — constructive dismissal: Art. 47 |
| U16 | `templates/uae-employment-contract.md:175` | internal grievance: written grievance to HR within 14 days |
| U17 | `templates/uae-employment-contract.md:181` | personal data processed in accordance with the UAE PDPL (Federal Decree-Law No. 45 of 2021) |
| U18 | `templates/final-settlement-statement.md:53` (English) and `templates/final-settlement-statement.md:55` (Arabic) | settlement waiver: the amount acknowledged as full and final settlement of all dues, no further claims against the employer, and waiver of rights to future claims related to the employment or its termination |

## Appendix B — the checklist strings we are keeping (UAE)

These four rows are the sentences our product's UAE offboarding checklist displays to a signed-in user, each carrying an article number or a stated deadline that we cannot source. They are listed apart from Appendix A because they are not template claims but the exact text on the screen, so an answer has to reach the string itself. The Saudi (`M/51`) rows that carry a similar citation are out of scope for a UAE letter and are not included here.

Row references are `file:line` in `server/compliance_engine.js` at `2a23e43`, the module the product serves.

| # | Where | Checklist row (its title) | The string as the product serves it (verbatim) | Question to counsel |
|---|---|---|---|---|
| B1 | `server/compliance_engine.js:22` | Notice Period Verification | "Confirm notice period served (30–90 days per contract)." | Which article governs this, or is the claim wrong? |
| B2 | `server/compliance_engine.js:23` | EOSB Calculation (UAE) | "Calculate basis = basic wage only (FDL 33/2021 Arts. 51–53)." | Which article governs this, or is the claim wrong? |
| B3 | `server/compliance_engine.js:26` | Residency Visa Cancellation | "Complete visa cancellation within 30 days." | Which article governs this, or is the claim wrong? |
| B4 | `server/compliance_engine.js:27` | Final Settlement Payment (within 14 days) | "Complete final payment within 14 days." | Which article governs this, or is the claim wrong? |

Appendix B lists the 4 UAE offboarding-checklist entries our product shows with an article number or a deadline and no source we hold. Each is quoted exactly as the product serves it, byte for byte. They stay in the product unchanged until you answer, and each answer will be applied to the string itself. The only article numbers in Appendix B are the ones our own strings already carry, quoted in the row beside them; we assert none of our own. If a string is simply wrong, say so and we will correct or remove it — that answer ends the question for that row just as an article number would.
