# Evidence — P2-6 PDPL boundary memo landed, and the notice's retention qualifier dropped

Task row `be70474d`. Two deliverables, one PR. Everything below was measured on this host by the
commands shown next to it; nothing is restated from another member's report.

## 1. The move: the shared copy is complete, byte for byte

The memo was written and approved at `/home/team/shared/pdpl-portal-boundary-memo.md`. Before
anything replaced it, the copy taken into the repository was compared with it:

```
sha256sum /home/team/shared/pdpl-portal-boundary-memo.md pdpl-portal-boundary-memo.md
  396a754be05fa73847b4e1a227ef126a390e415839ac6f823852bb1423890dc0  /home/team/shared/pdpl-portal-boundary-memo.md
  396a754be05fa73847b4e1a227ef126a390e415839ac6f823852bb1423890dc0  pdpl-portal-boundary-memo.md
wc -l -c ...   ->  277 lines, 30148 bytes (both files)
cmp ...        ->  byte-identical
```

Command: `sha256sum <both> && wc -l -c <both> && cmp <shared> <copy>`.

- **sha256 (shared, at the moment of copying):** `396a754be05fa73847b4e1a227ef126a390e415839ac6f823852bb1423890dc0`
- **sha256 (repository copy, same moment):** `af8200cc5f90a4d0a8f14144658b8dd3948264577f3504d8a124d185a2df6d67` — identical
- **lines / bytes:** 277 / 30148 — identical
- **`cmp`:** byte-identical

After that, the repository copy received **five edits, all of them re-stamps, corrections or added
provenance, none of them substantive**: the header's landed-on line (instructed), §10's now-false sentence
about #84/#87 and `b7630cb` (instructed), §6.3 (which said the memo does not change the notice, and the
change below is that notice change), the evidence-index heading, and §5.1's `consent_version` row, which
now carries the measured history of the `v1` literal — the notice has read v2.2 since `02aa858`
(2026-09-17) and the literal was typed in `9c07344` (2026-10-07), so it was never a version reference at
all rather than a stale one. Commands: `git log --format=%H -S"consent_version: 'v1'" -- client/src/App.tsx`
and the same form over `templates/privacy-notice.md` for the version string. The landed-on line was refreshed once more when
`main` moved to `2ca2c19` and the branch was rebased onto it. **No finding, answer, prohibition or
citation in the approved memo was altered**; the sha256 above pins the approved text, so the diff against
it is auditable even though the shared path is now only a pointer.

## 2. The tree it lands on, and why no citation moved

```
git fetch origin main
git log -1 --format='%h %s' origin/main   ->  6221995 Merge pull request #93 from AhmadJ979/docs/tracker-round-27
git diff --name-only b7630cb..6221995 | grep -c '^client/\|^server/'                                    ->  0
git diff --name-only b7630cb..6221995 | grep -E 'compliance-requirements|legal-signoff|compliance-dpia-vendor-risk|^templates/' | wc -l   ->  0
```

The memo was **written** against `b7630cb` and is **landed** against `6221995`. Six PRs merged while the row
was open — `main` moved three times during this task — verified over the public API (channel: anonymous REST,
`GET /repos/AhmadJ979/Antum-People/pulls/<n>`):

| PR | state | merged_at | what it touched |
|---|---|---|---|
| #84 | closed, merged: true | 2026-10-09T06:21:15Z | `roadmap-board-index.md` |
| #87 | closed, merged: true | 2026-10-09T06:21:46Z | `demo-weak-screens.md` |
| #88 | closed, merged: true | 2026-10-09T06:22:16Z | `roadmap-board-index.md` |
| #91 | closed, merged: true | 2026-10-09T08:01:12Z | `design-concepts/LAYER2-PREBOARDING-UI.md`, `docs/evidence/p2-4-rendered/**` |
| #92 | closed, merged: true | 2026-10-09T08:04:22Z | `demo-walkthrough-script.md`, `demo-weak-screens.md`, `design-concepts/**`, `pilot-outreach-messages.md` |
| #93 | closed, merged: true | 2026-10-09T08:06:41Z | `roadmap-board-index.md` |

**No `client/` or `server/` file, and no compliance document or template the memo cites**, in any of them.
That is the reason no `file:line` in the memo moved — stated in the memo's header as a reason rather than a
re-dating, together with the two commands a later reader can re-run if `main` has moved again. The branch was
rebased onto `6221995` before this evidence was taken, so the tree reviewed is the tree that merges.

## 3. The template change: one row, two languages, nothing else

`templates/privacy-notice.md` — the retention table's consent-record row. Before → after:

Verbatim — the two cells in each line are the UAE and KSA columns and hold the same phrase:

```
:62  (EN)  -| Consent records | Duration of employment + statutory retention | Duration of employment + statutory retention |
           +| Consent records | Duration of employment + retention period  | Duration of employment + retention period  |

:174 (AR)  -| سجلات الموافقة | مدة التوظيف + مدة الاحتفاظ القانونية | مدة التوظيف + مدة الاحتفاظ القانونية |
           +| سجلات الموافقة | مدة التوظيف + مدة الاحتفاظ | مدة التوظيف + مدة الاحتفاظ |
```

Meaning kept, the unsourced qualifier dropped, nothing else in the row or the table changed:

```
git diff -U0 -- templates/privacy-notice.md   ->  exactly 2 hunks, 1 line each (@@ -62 +62 @@, @@ -174 +174 @@)
git diff --stat -- templates/privacy-notice.md ->  1 file changed, 2 insertions(+), 2 deletions(-)
```

**Still in the template, deliberately untouched (not in scope, each a flag rather than a ruling):**
`:66` (EN) and `:178` (AR) — the paragraph under the table, "financial/statutory records";
`:76` (EN) — the third-party-sharing row, "Statutory employment registration".
The acknowledgement block (`:245` blanket-consent box, `:248` signature row) was **not** touched: it is
an open owner question.

## 4. Nothing else moved

```
git diff --name-only origin/main | grep -c '^client/\|^server/'   ->  0
grep -rn 'pdpl-portal-boundary-memo' --include='*.md' .            ->  nothing outside the memo itself
```

No file in the repository referenced the memo at the shared path, so no pointer needed repointing —
checked rather than assumed.

Measured 2026-10-09T08:03:54Z (UTC).
