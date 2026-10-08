# 06 — screenshots

Paths are relative to this directory. Every shot was read back and looked at, not just taken.

| File | State | What it shows |
|---|---|---|
| `screenshots/A-rollup-collapsed.png` | collapsed | Pre-boarding tab: the intake form, the case counter, the roll-up totals (21 outstanding / 0 verified / 3 without consent) and the first row's red chip |
| `screenshots/B-red-row-open.png` | row 1 opened | the same viewport with the row's own control flipped to `Close` — the opened content sits below the fold, which is why the next shot exists |
| `screenshots/C-reminder-and-package.png` | row 1 opened, scrolled to 1462 px in the app's own scroll container | the employee-track items with their `Request` controls, the reminder control and its honest copy, and the PRE-READING PACKAGE strip (`0/9 acknowledged · 0/2 required`) with the JD/NDA rows and `Record acknowledgement` |
| `screenshots/D-three-rows-and-intake.png` | collapsed, scrolled to 368 px | the intake form beside row 1: chip, row line, the rose panel with the seven open items, and `These were due before day one.` |

## Duplicates and dead ends — recorded, not hidden

* `D-three-rows-and-intake.png` and `C-reminder-and-package.png` are **not** duplicates:
  `md5` `21975170a01a2ff71af758ba305a8acc` vs `6e3f51236c746ed0adb8ffd06ea4c0c5`.
* **Two pairs of shots from earlier attempts are byte-identical and prove nothing new:**
  (a) a `scroll down 700` step left the page unchanged (`md5` `e4176d9e4561d37bad11e4d58f8521ee`
  both before and after — the app scrolls its own `flex-1 overflow-y-auto` container, not the
  window), and (b) a click on the text "Record an accepted offer" found no button because that
  text is a heading, not a control — the intake form is always rendered, and the screen it left
  behind is identical to the state before it (`md5` `e4176d9e…`). Neither pair was used for a
  claim in the walkthrough.
* The Compliance Center line `Basic Salary (UAE Rule)` was **not** re-opened on this pass:
  clicking the roster row did not surface a panel carrying that string, so it stays marked in the
  script as carried from the 2026-10-06 walk, with the rendering condition cited
  (`App.tsx:1337`) rather than claimed as a fresh reading.
