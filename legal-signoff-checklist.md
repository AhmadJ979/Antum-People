# Antum — Legal Sign-off Checklist

> Single source of truth for the owner before client sign-off. Every open field below matches a visible `[TO CONFIRM — …]` marker in the documents; every confirmed field is applied. Last updated 2026-09-18.

## Confirmed (applied)

| Item | Value | Where applied |
|---|---|---|
| DPO name | **Ahmad Aljairoudi** | `templates/privacy-notice.md` §1 (EN + AR), `templates/data-processing-agreement.md` §1.2 (EN + AR) |
| Registered address (city / country) | **Dubai, United Arab Emirates** | same documents |
| DPO email (reserved — mailbox NOT yet provisioned) | **dpo@antum.ae** | same documents |

## Controller vs processor DPO (by design — do not "fix")

Antum is the **processor**; each client (employer) is the **controller**. **Ahmad Aljairoudi** is Antum's DPO in Antum's own capacity and appears **only in the processor identity block** (`templates/privacy-notice.md` §1 and `templates/data-processing-agreement.md` §1.2, EN + AR).

The controller-side **data-protection contact** / `[dpo_name]` placeholder in the privacy notice belongs to **the client's own DPO**, and is deliberately left as a placeholder for each client to complete. It is **not an oversight** — do not populate it with Antum's DPO. If a document ever needs Antum's DPO on the controller side of a client contract, that is a question for the lead, not a field to fill.

## Open items — owner must supply before client sign-off

| # | Open field | Visible marker | Document & section | What is needed |
|---|---|---|---|---|
| 1 | Formal legal entity name + suffix | `[TO CONFIRM — formal entity name/suffix]` | privacy-notice.md §1 (EN + AR); data-processing-agreement.md §1.2 (EN + AR) | The registered legal entity name and suffix (e.g. FZ-LLC / LLC / Ltd) once registration completes. Currently rendered as "Antum (legal entity registration in progress)". |
| 2 | Trade licence / CR number | `[TO CONFIRM — trade licence / CR number]` | data-processing-agreement.md §1.2 (EN + AR) | The trade licence / commercial registration number. |
| 3 | Full registered address | `[TO CONFIRM — full registered address pending]` | privacy-notice.md §1 (EN + AR); data-processing-agreement.md §1.2 (EN + AR) | The full street address (currently only city/country "Dubai, United Arab Emirates"). |
| 4 | DPO phone | `[TO CONFIRM — DPO phone]` | privacy-notice.md §1 (EN + AR); data-processing-agreement.md §1.2 (EN + AR) | Antum DPO phone number (name is confirmed; phone is not). |
| 5 | Arabic brand wordmark | `[TO CONFIRM — Arabic wordmark transliteration]` | privacy-notice.md (header note) | The Arabic transliteration/wordmark for "Antum". Latin "Antum" is used in Arabic text until provided. |

## Status summary

- **Confirmed:** DPO name (Ahmad Aljairoudi), registered address city/country (Dubai, United Arab Emirates), DPO email reserved (dpo@antum.ae — not a live mailbox).
- **Open:** formal entity name/suffix, trade licence/CR number, full street address, DPO phone, Arabic wordmark.
- **Domains** `antum.ae` / `antum.me` are registered; no website, portal, inbox or data-subject-request channel is asserted as live.
