# The roll-up's third total, renamed — `Cases · notice not shown`

**Row:** `7cfe0ac3` — *[Demo] The acknowledgement copy: retire "3 WITHOUT CONSENT" and every document that quotes it*
**Date:** 2026-10-13 · **Author:** product designer · **Branch:** `copy/notice-not-shown-2026-10-13` (tip `391fe1d`, cut from `origin/main` `a63fc04`)

## The decision this serves

Owner decision **15(b)**: the gate records that the **notice was shown**, per document, and the record carries the
basis the notice itself assigns. The compliance spec's **§6** fixes the meaning and says the wording is the
designer's (`pdpl-acknowledgement-route-spec.md`):

> A case with no acknowledgement recorded **is not a case where the hire refused** — it is a case where HR has not
> yet put the notice in front of them. Every string must carry that distinction, and no string may say "consent",
> "agreed", "signed", or "accepted".

The engineer implemented the surfaces (§6 rows 1–5: the control, the recorded state, the empty state, the roll-up
label, the server's refusal) in PR **#143** (`d618a96`), which shipped both the `cases_without_consent` →
`cases_notice_not_shown` rename and the bare label `Notice not shown`. This pass is the designer's half: **the
wording itself**, and the document sweep.

**The one wording change:** the label reads **`Cases · notice not shown`**, not a bare "notice not shown". The
reason is a unit ambiguity on the screen, not a legal one: that tile sits in a three-tile grid beside
**`Items outstanding`** and **`Items verified`**, so a unit-less third label reads as a *third item count* — and
this one counts **cases**. §6 now carries the refinement.

## What changed

| File | Change |
|---|---|
| `client/src/App.tsx` | the tile label → `Cases · notice not shown`, with the unit rationale in the comment (the count itself is untouched) |
| `demo-walkthrough-script.md` | the spoken roll-up line; a **dated note** under the figures table; the two dated re-reads no longer assert a retired mechanism; the provenance row annotated |
| `demo-weak-screens.md` | the screen row, the payload field lists (`cases_without_consent` → `cases_notice_not_shown`), and the governing paragraph **rewritten** (it used to say the label "stays as it is") |
| `design-concepts/LAYER2-P2-2-IMPLEMENTATION-NOTES.md` | the field list and the "three totals" description |
| `pdpl-lawful-basis-mapping.md` | facts 6 and the consequence bullet now read as achieved, with the new name and current line citations |
| `pdpl-acknowledgement-route-spec.md` | §6 gains a dated **"Wording, settled 2026-10-13"** block (additive; no substance changed) |

**No number moved.** Every figure in those documents is the one the post-cutover re-grounding froze; this pass
changes labels, field names and meaning only, and deliberately does not restate the bundle or the seed.

## Evidence

### 1. The rig tree IS the merge result (not the branch alone)

`git merge-tree --write-tree origin/main copy/notice-not-shown-2026-10-13` → `5e0f29e3…`, no conflicts. The rig
worktree was made from `origin/main` (`a63fc04`) and the branch's diff applied, then verified by content:

```
  equal   client/src/App.tsx                    (blob hash equals branch tip 391fe1d)
  equal   demo-walkthrough-script.md
  equal   demo-weak-screens.md
  equal   design-concepts/LAYER2-P2-2-IMPLEMENTATION-NOTES.md
  equal   pdpl-acknowledgement-route-spec.md
  equal   pdpl-lawful-basis-mapping.md
```

### 2. Build, both halves, with exit codes (`raw/rig-run.txt`)

```
  tsc -b exit code: 0
  vite build exit code: 0
dist/assets/index-Cc1GodRa.js   274.06 kB
=== built bundle: the new label in, the retired wording out:
  'Cases · notice not shown' occurrences: 1
  old label 'Notice not shown' (bare)     : 0
  'WITHOUT CONSENT' occurrences          : 0
```

### 3. The payload rename is real, and the count is unchanged (`raw/api-check.txt`)

```
totals keys: [cases, items, items_outstanding, items_received, items_verified,
              cases_notice_not_shown, cases_ready, workspace_lines, workspace_lines_open, cases_provisioned]
cases: 3 · items_outstanding: 21 · items_verified: 0 · cases_ready: 0
cases_notice_not_shown: 3
retired field cases_without_consent present? False
distinct flag states: ['clear', 'inside_48_hours', 'started']
```

### 4. The rendered screen, machine-read (`raw/dom-tiles.txt`)

```
panelHeading: "HR roll-up — outstanding items"
tiles: [ {21, Items outstanding}, {0, Items verified}, {3, Cases · notice not shown} ]
exactLabelNodes: ["Cases · notice not shown"]        (textContent, before CSS uppercasing)
retiredWordingOnScreen: false                        (no /WITHOUT CONSENT|without consent/ anywhere on the page)
linesWithNotice: ["CASES · NOTICE NOT SHOWN"]        (rendered innerText)
```

Screenshot: `rollup-tiles.png` (rig only).

### 5. The BEFORE reading, and where it comes from

The served instance has not been cut over since the acknowledgement change, so it still prints the old words. That
reading is **not** re-measured here — it is the dated DOM sample already in the repository, captured from the
served surface on 2026-10-12:

```
docs/evidence/demo-weak-screens-reground/03-dom-preboarding.txt
  … 21 nITEMS OUTSTANDING n0 nITEMS VERIFIED n3 nWITHOUT CONSENT n …
  … No PDPL consent record — no document can be collected on this case yet. …
```

So the pair is: **BEFORE** = that dated sample (served tree), **AFTER** = this pass's rig read. The numbers differ
between them because the seeds differ; the label is what is being compared, and it is compared by name.

### Rig hygiene

Scratch tree `~/rig-copy` (worktree of `origin/main` + the branch diff), scratch DB `~/rig-evidence/copy.db`,
port **4716**, throwaway credential in `~/rig-evidence/scratch-pass.txt` (never the live demo credential). The live
deployment on **port 3000 answered 200 before and after** the pass and was never addressed.

## What this pass does NOT do

- **The served instance still prints the old label.** The change is in the code on `main` once merged; the demo will
  say it the new way only after the next cutover. Until then the demo documents say both states, dated.
- **No cutover, no re-seed, no figure re-read** — deliberately (this row must not restate the bundle or the seed).
- **Two occurrences left in place, with reasons:**
  - `compliance-requirements.md:300` — "for HR processing (contractual necessity), Art. 4(2) allows processing without consent": that is a statement about **PDPL lawful bases**, not the retired product label. Editing it would corrupt the baseline the mapping document cites.
  - `roadmap-board-index.md:202` — the tracker index quotes **the lead's own measurement** ("3 without consent"). It is a dated record in another owner's document; it is flagged to the lead rather than edited here.
- **One finding, not fixed (needs an owner decision):** the employee record still shows a consent badge —
  `✓ GRANTED ON {date}` / `✗ MISSING / REQUIRED` (`client/src/App.tsx:1548-1549`), written by a *different* route
  (`server/index.js:365`, `UPDATE employees SET consent_granted = 1`). That is Layer 1's employee-level consent
  capture, not the pre-boarding gate, so this rename does not touch it — but it is a prospect-facing string that
  says "consent", and whether option B also retires that instrument is the owner's call (Layer 1 is frozen).
- **Overlap with PR #147** (open): that PR appends a state note to the same `demo-weak-screens.md` paragraph this
  pass rewrites. This branch's version is the superseding text; whichever merges second needs a one-paragraph
  rebase, and #147 should be closed as superseded if this lands first.

## Reproduce

The three scripts that produced this pack are copied here verbatim (`scripts/`), so the run is
re-runnable rather than summarized. `rig-copy.sh` expects a clone at `$HOME/reground` and a tree with
installed `client/`+`server/` `node_modules` to symlink from; edit those two paths at the top if yours
differ. It never touches port 3000.

```bash
D=docs/evidence/notice-not-shown-copy-2026-10-13
HOME=/home/agent-product-designer bash $D/scripts/rig-copy.sh        # worktree of origin/main + the branch
                                                                    # diff, tsc + vite, seed, boot on 4716
HOME=/home/agent-product-designer bash $D/scripts/api-check.sh       # payload / field-rename check
agent-browser --session <n> open http://localhost:4716/              # inject token from rig-evidence/token.txt
agent-browser --session <n> eval "$(cat $D/scripts/probe-click.js)"  # click Pre-boarding
agent-browser --session <n> eval "$(cat $D/scripts/probe-tiles.js)"  # read the tiles
```

Raw outputs of that run: `raw/rig-run.txt`, `raw/api-check.txt`, `raw/dom-tiles.txt`.
The BEFORE sample is not re-run — it is the served surface's dated capture, copied verbatim as
`raw/03-dom-preboarding-BEFORE-served-2026-10-12.txt`.
