# Row `bc89d0bd` — the intake form's controls get real accessible names

**Branch:** `fix/a11y-intake-labels`, base `origin/main` `cd4edca`, commit `06f206f`.
**Rule 14 observed:** two **scratch** instances (own port, own `PRODUCT_DB_PATH`, own throwaway credential), never
the live server and never the live credential. The live product on port 3000 answered `200` before and after the
whole pass, and the deployed tree was not touched.

## 1. What was wrong, and how it was measured

Reading the built app in a real browser, each control's accessible name was computed per the HTML-AAM order
(`aria-labelledby` → `aria-label` → `label[for]` → wrapping `label` → `title` → `placeholder`) by `probe.js`.
The **source** of the name is part of the record, because a name that falls back to a **placeholder** is exactly
what this row is about: the visible label was never associated with the control.

Two isolated instances of the app, same seed, same session, minutes apart:

| instance | tree | port | DB |
|---|---|---|---|
| **before** | `cd4edca` (= `origin/main`) | 4717 | `~/a11y/before.db` |
| **after** | `06f206f` (this branch) | 4718 | `~/a11y/after.db` |

## 2. The controls, one by one — before → after

Names as the browser computed them; `NONE` = **no accessible name at all**.

| # | screen (as reached) | control | before | after |
|---|---|---|---|---|
| 1 | sign-in | username | `placeholder` "Enter your username" | **label[for] "Username"** |
| 2 | sign-in | password | `placeholder` "••••••••" | **label[for] "Password"** |
| 3 | Pre-boarding · Record an accepted offer | offer reference | `placeholder` "e.g. OFR-2026-014" | **label[for] "Offer Reference"** |
| 4 | same form | candidate name | `NONE` | **label[for] "Candidate Name"** |
| 5 | same form | candidate email | `NONE` | **label[for] "Candidate Email"** |
| 6 | same form | role | `NONE` | **label[for] "Role"** |
| 7 | same form | department | `NONE` | **label[for] "Department"** |
| 8 | same form | reporting line | `placeholder` "Who the hire reports to" | **label[for] "Reporting Line"** |
| 9 | same form | jurisdiction (select) | `NONE` | **label[for] "Jurisdiction"** |
| 10 | same form | start date (date) | `NONE` | **label[for] "Start Date"** |
| 11 | Employee Directory · Hire Employee | first name | `NONE` | **label[for] "First Name"** |
| 12 | same modal | last name | `NONE` | **label[for] "Last Name"** |
| 13 | same modal | email | `NONE` | **label[for] "Email Address"** |
| 14 | same modal | department (select) | `NONE` | **label[for] "Department"** |
| 15 | same modal | role | `NONE` | **label[for] "Role"** |
| 16 | same modal | jurisdiction (select) | `NONE` | **label[for] "Jurisdiction"** |
| 17 | same modal | basic salary | `NONE` | **label[for] "Basic Salary (Monthly)"** |
| 18 | same modal | national ID | `placeholder` "784-XXXX-XXXXXXX-X" | **label[for] "National ID Value"** |
| 19 | same modal | start date (date) | `NONE` | **label[for] "Start Date"** |
| 20–23 | **Exit Intelligence Intake modal** | departure driver · preventable · new salary · feedback | `NONE` in source | associated in source — **not read live: see §4** |
| 24 | Employee Directory · a case's task list | task checkbox | `NONE` in source (no `label` at all) | `aria-labelledby` → the task title — **not rendered by this seed: see §4** |

Per screen, as the probe summed it: intake form **6 of 8 controls had no name at all** before, **0 of 8** after;
the employee modal **8 of 9 → 0 of 9**; sign-in **0 names from a label → 2**. The form itself is now named too
(`aria-labelledby="offer-intake-heading"`, the visible `Record an accepted offer` heading), which is how the
intake rows read `form: offer-intake-heading` in the after capture.

Raw captures: `before/0N-*.json`, `after/0N-*.json` (probe output, verbatim). Screens:
`before/bg-*.png`, `after/af-*.png` — the intake screen and the two modals, before and after, are
**visually identical**; the change is attributes only.

## 3. Proof that nothing else changed

`npm run build` (rule 15), from `client/`:

```
> tsc -b && vite build
dist/index.html                   0.46 kB │ gzip:  0.29 kB
dist/assets/index-gt1pFhU5.js   270.52 kB │ gzip: 75.36 kB
✓ built in 351ms
npm run build exit code: 0
```

A script took the diff, removed **exactly the attributes this change adds** (`htmlFor="…"`, `id="…"`,
`aria-labelledby=…`) and compared: **50 changed lines, 0 that change anything else.** No `className`, no copy,
no `type`, no `required` and no handler was touched — which is also why the dogfood's two behaviours hold:
`required` is still on the same fields and `onSubmit` still calls the same function.

## 4. Gaps, named rather than smoothed over

- **Rows 20–23 (the Exit Intelligence Intake modal) could not be read live: the modal has no opener.** Nothing in
  `client/src` ever calls `setShowExitModal(true)` — `showExitModal` is only ever set to `false` and rendered — so
  no user, and no screen reader, can reach those four controls today. Their association is in the source and in
  the built bundle, and **I could not verify it in a browser**. That the modal is unreachable is itself worth a
  row; it is not this row's fix.
- **Row 24 (the task checkbox) is not rendered by the demo seed.** Clicking an employee row produced a task list
  with no tasks (`before/03-employee-detail.json` and `after/03-employee-detail.json` both: `total: 0`), so the
  checkbox never existed to measure. Its name comes from `aria-labelledby` → the task title div, verified in
  source and in the bundle.
- **The dogfood's two behaviour checks: one is proven, one is not** (`after/behaviour.txt`, verbatim).
  *Empty start date → submit*: the browser's own `required` validation still fires — `validBefore: false`,
  `"Please fill out this field."` before and after the click, focus left inside the form — and **no case is
  created** (cases: 3 before, 3 after). *Fill → submit*: **my own check script was buggy**, not the app — it
  looked its values up by a hyphenated key while the table was keyed with underscores, so six fields were
  typed the literal string `undefined` and the start date stayed empty; the submit was then blocked by the same
  validation and the count stayed at 3. **I do not claim the submit leg from this run.** What stands behind it
  is the diff: no `required`, no `type` and no `onSubmit` changed, so the path the dogfood exercised is
  untouched — and the empty-submit leg above shows the form is alive and still gates on an incomplete submit.
- **The client was not rebuilt for the live deployment** — `client/dist` is not committed and nothing here is
  deployed. This is undeployed until the lead cuts over.

## 5. Reproduction

`probe.js` (accessible-name computation, pure DOM read), `pass.sh` (drives the app's own nav by clicking real
elements and probes at each step), `empty-submit.js`, `fill-submit.js` — all in `~/a11y/`, with the rig recipe in
the team skill `antum-scratch-evidence-rig`. Screenshots: `agent-browser --session <name> screenshot
--screenshot-dir <dir>`.
