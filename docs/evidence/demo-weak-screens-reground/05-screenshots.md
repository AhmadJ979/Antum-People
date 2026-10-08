# Screenshots — scratch instance of `origin/main` = `2584361`, 2026-10-08

All ten were taken in a browser on the **scratch** instance (`~/ws-rig`, port 4771, own DB, throwaway
credential), never against the live deployment. The live tree answered 200 before and after the pass.
MD5 and byte size are given so a reader can tell which are genuinely different states and which are not.

| # | File | Bytes / md5 | What it shows | Used in the audit for |
| --- | --- | --- | --- | --- |
| 01 | `01-dashboard.png` | 89,938 · `b9b342e2` | Executive Dashboard, UAE header: retention lift +19%, time-to-value 19.2 d (target 15), cost-per-hire AE 8,286.00 AED, EOSB liability AE 85,249.00 AED, the "Illustrative" labels, Onboarding Pipeline (Omar, started 2026-08-20) and Offboarding Pipeline (Noura, Exit 2026-10-10) | items 4, 7, 8, 9 |
| 02 | `02-preboarding-collapsed.png` | 111,876 · `91a7fd8c` | The Pre-boarding roll-up: tile **3 / CASES OPEN**, totals 21 outstanding / 0 verified / 3 without consent, the three rows with their chips (🔴 `Started 1 day ago · 7 items open`, 🟠 `Inside 48 hours · 7 items open`, ⚪ `On track`), the row distance lines, the "no owner on this item" copy and the scope sentence about the workspace track | F2, F3, F4, the chip |
| 03 | `03-preboarding-row-open.png` | 113,323 · `42bd69b2` | the same screen after a click meant to expand a row. **It differs from 02** (hash and size), but the text captured for both was identical (4,579 B), so the audit does **not** claim a second rendered state from it | — (recorded, not relied on) |
| 04 | `04-directory.png` | 114,898 · `96e3526d` | Employee Directory (UAE): 8 rows — 5 active, 1 onboarding (Omar, **AED 0.00**, "Accrued to date"), 1 offboarding (Noura), 1 terminated — with 2-decimal accruals | items 5 and 8 |
| 05 | `05-noura-detail.png` | 114,900 · `100524b4` | Noura's record: the 8-step offboarding checklist, `PRIVACY CONSENT (PDPL) ✓ GRANTED ON 2026-09-23`, `EOSB CALCULATION BASIS: Basic Salary (UAE Rule)`, and the Document Previews | items 1, 2, 3, 6 |
| 06 | `06-settlement-modal.png` | 62,231 · `5339f08e` | the Settlement Statement open: **"PILOT-READY DRAFT — SUBJECT TO YOUR COUNSEL'S REVIEW"**, then the document — **"Jurisdiction: UAE / KSA"**, **"Antum Regional Hub"**, the figures (5161.29 / not calculated ×3 / **6415.79** / **11577.08** / deductions 0.00 / **NET 11577.08**) and the waiver clause | items 1 and 6 |
| 07 | `07-document-preview.png` | 114,900 · `100524b4` | **byte-identical to 05** — the click meant to open Document Preview matched no control (`"NOTFOUND"` in the pass log), so this step produced no new state. Kept so the failed step is visible | — (a failed step, recorded) |
| 08 | `08-strategic.png` | 94,273 · `792284e4` | Strategic Intelligence: the three Illustrative insight cards, the cohort ladder (100 / **50** / 100 / 100 with lift +18 / **−33** / +16 / +19 against illustrative benchmarks), TTV by department and the EOSB forecast with its **`KSA: 0.00 SAR`** column | items 4, 7, 10 |
| 09 | `09-transitions.png` | 53,260 · `8ade9441` | Transitions Hub (the screen a prospect lands on for the transition story) | context |
| 10 | `10-signin-forgot.png` | 32,794 · `67cf673e` | the sign-in screen with **"HR Onboarding/Offboarding Intelligence Platform"** and `Forgot Password?` → **"To reset your password, contact your Antum administrator."** | items 7 and 8 |

**Not captured on screen this pass** (and therefore not claimed): the pre-reading package strip (read from
its payload instead — see `FINDINGS.md`), and the roster's `Day -n` (a code-level finding, invisible on this
seed). The raw rendered text behind each screenshot is in `03-dom-<screen>.txt`.
