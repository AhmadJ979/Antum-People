# Evidence — one authoritative notice: the copy a client downloads is the reviewed copy

**Row:** `a4fea509-7d3b-43fc-82cc-f84cde00fcfd` · **Branch:** `fix/one-authoritative-notice-a4fea509`
**Base:** `origin/main` at `a63fc04` · **Run:** 2026-10-12
**Live product:** untouched. Port 3000 answered `200` before the rig, `200` after it, and the rig ran on
ports 4711/4712 in a scratch worktree with its own database. No cutover, no re-seed of the live demo.

Raw material in this directory: `rig-before-after.txt` (the whole run, quoted below), `probe-before.json`
and `probe-after.json` (the probe output verbatim), `raw-source-reads.txt`, `raw-scope-and-deploy-tree.txt`,
`reader-inventory.txt`, `test-run-149-pass.txt`, `build-tsc-raw.txt`, `build-vite-raw.txt`.

## 1. What was wrong, measured

The product served the privacy notice out of `/home/team/shared/templates/`, a directory outside the
repository whose copy had drifted. Both copies carried the same version string, so one `v2.2` described two
texts:

```
host copy (served first)   md5 e011d3d6f18eb8175050917bb4fb08fe  "Duration of employment + statutory retention"
repo copy (reviewed)       md5 9c060b9fd07129cdb466471bbed7945b  "Duration of employment + retention period"
```

The repository's copy is the reviewed one: `313a017` — *"land the PDPL boundary memo in the repo, and drop
the notice's unsourced retention qualifier"* — removed that qualifier on the record, in the repository only.
The whole-file diff is one row twice:

```diff
62c62
< | Consent records | Duration of employment + statutory retention | Duration of employment + statutory retention |
---
> | Consent records | Duration of employment + retention period | Duration of employment + retention period |
174c174
< | سجلات الموافقة | مدة التوظيف + مدة الاحتفاظ القانونية | مدة التوظيف + مدة الاحتفاظ القانونية |
---
> | سجلات الموافقة | مدة التوظيف + مدة الاحتفاظ | مدة التوظيف + مدة الاحتفاظ |
```

So the product served the text we had reviewed **out**, and a `v2.2` acknowledgement record could not say
which of the two texts a hire was shown.

## 2. The reader inventory, before any change

Every command behind this list is in `reader-inventory.txt`.

| # | reader | command | depends on the host-shared path |
|---|---|---|---|
| 1 | `server/index.js:415` — the template route, for every template except the notice | `grep -rn "shared/templates" .` (working tree) | **yes** |
| 2 | `server/privacy-notice.js:37` — `SHARED_TEMPLATES_DIR`, resolved first for the notice | same | **yes** |
| 3 | `/home/team/shared/probable-octo-sniffle/server/index.js:391` — **the live deployment at `b54412d`**, which resolves the host path directly with no fallback | `grep -rln "shared/templates" /home/team/shared` | **yes, until the next cutover** |
| 4 | `/home/team/shared/antum-people-working/server/index.js` — a second, non-git copy of the tree (dated 2026-06-15/09-09, no `templates/` of its own, nothing running from it) | same | a stale duplicate, not a serving path |
| 5 | docs that *name* the path, never read it: `compliance-dpia-vendor-risk.md:336`, `docs/evidence/notice-acknowledgement-2026-10-12/README.md:55`, and in the deployed/shared trees `legal-signoff-checklist.md`, `pdpl-portal-boundary-memo.md`, `pdpl-lawful-basis-mapping.md`, `demo-walkthrough-script.md`, `roadmap-board-index.md` | same | no |
| 6 | tests — `server/demo-seed.test.js`, `server/preboarding-items.test.js` read the notice only through `require('./privacy-notice')` | `grep -rn "privacy-notice\|noticeVersion" server/*.test.js` | no (they follow the module) |
| 7 | the seed and the cutover script — no reference to the shared path | `grep -rn "/home/team/shared" scripts/ server/` | no (`scripts/keep-alive.sh` names the *deploy dir*, not templates) |

**Nothing that runs the product depends on the host directory except the two code readers**, and reader 3 is
the live tree — it keeps resolving there until a cutover ships this change.

## 3. What the bytes a client downloads were, and are

Raw: `rig-before-after.txt`, `probe-before.json`, `probe-after.json`. The probe logs in, reads the roster
(13 employees), and fetches each document exactly as the UI does.

| what the probe fetched | BEFORE (`origin/main`, as shipped) | AFTER (this branch) |
|---|---|---|
| `GET /api/compliance/notice` → `path` it resolved | `/home/team/shared/templates/privacy-notice.md` | `<tree>/templates/privacy-notice.md` |
| ↳ content bytes / md5 | 23566 B / `e011d3d6f18eb8175050917bb4fb08fe` | 23522 B / `9c060b9fd07129cdb466471bbed7945b` |
| ↳ contains `statutory retention` | **true** | **false** |
| ↳ contains `Duration of employment + retention period` | false | **true** |
| ↳ contains `مدة الاحتفاظ القانونية` | **true** | **false** |
| `GET /api/compliance/templates/privacy-notice/demo-emp-omar` (rendered, as the modal shows it) | `ae566fc1697b92c5c7ca4f0bdc182bc2` | `418b3d7580570acea19c9468d65fe527` |
| same, `statutory retention` present | **true** | **false** |
| `GET /api/compliance/templates/uae-employment-contract/demo-emp-omar` | `94bfb21702dd316b16e9f90227edd1db` | `94bfb21702dd316b16e9f90227edd1db` |

The notice route reports the path it resolved, and the content md5 equals that file's md5 on disk — so the
BEFORE content is the host copy byte for byte (`e011d3d6…` = `md5sum /home/team/shared/templates/privacy-notice.md`)
and the AFTER content is the repository copy byte for byte (`9c060b9f…` = `md5sum templates/privacy-notice.md`,
also the md5 the deployed tree already carries at `/home/team/shared/probable-octo-sniffle/templates/privacy-notice.md`).

The UAE contract is byte-identical in both runs on purpose: the two copies of that document never differed,
so a resolution change must not move it — and it does not.

## 4. The same defect, on a second document — measured, not assumed

`templates/ksa-employment-contract.md` had drifted too, and it is a document the product renders (the
"Employment Contract" button on a KSA employee). `9f4426d` — *"apply 17 notice-compensation wording
corrections (E1–E17)"* — corrected it in the repository only:

```diff
135c135
< EOSB shall be calculated in accordance with Articles 74–86 of Saudi Labor Law (Royal Decree M/51), based on the employee's **total monthly salary**.
---
> EOSB shall be calculated in accordance with Article 84 of the Saudi Labor Law (Royal Decree M/51), based on the employee's **total monthly salary**.
139,142c139,140
< | Less than 2 years / أقل من سنتين | No entitlement |
< | 2 to 5 years / من 2 إلى 5 سنوات | 1/3 of one month's total salary per year |
< | 5 to 10 years / من 5 إلى 10 سنوات | 2/3 of one month's total salary per year |
< | 10+ years / أكثر من 10 سنوات | 1 full month's total salary per year |
---
> | First 5 years / أول 5 سنوات | Half a month's total salary per year / نصف شهر من إجمالي الراتب عن كل سنة |
> | Each subsequent year / كل سنة تالية | One full month's total salary per year / شهر كامل من إجمالي الراتب عن كل سنة |
144c142
< > **Penalty for Failure to Give Proper Notice:** Up to 50% of EOSB may be deducted if the employee fails to serve the full notice period.
---
> > **Compensation for Failure to Give Proper Notice:** If the employee fails to serve the full notice period, the employee owes compensation equal to the wage for the unserved notice period, recorded as a separate settlement item — never deducted from the EOSB.
```

Served through the product, the difference is not cosmetic:

| `GET /api/compliance/templates/ksa-employment-contract/demo-emp-reem` | BEFORE | AFTER |
|---|---|---|
| content bytes / md5 | 10649 B / `4e150ef34c60a26e073507a42bf4e7e4` | 10745 B / `d23c70cf15f7b1d5f995fa7a7a471857` |
| cites | `Articles 74–86 of Saudi Labor Law` | `Article 84 of the Saudi Labor Law` |
| notice-period clause | `Up to 50% of EOSB may be deducted` | `compensation equal to the wage … never deducted from the EOSB` |
| host-shared file md5 `3518c1af…` vs repository `1c6ad895…` | served the host copy | serves the repository copy |

Which of the two clauses is correct is the compliance owner's call, not this row's. What this row measured is
that the product was serving one of two copies, and which one it served was an accident of the host.

## 5. The change

- `server/privacy-notice.js` — `templatePath(name)` is now the single resolution: `<repo>/templates/<name>.md`,
  with `path.basename` so the route's `:templateName` parameter cannot walk out of the directory. The
  host-shared directory is not consulted at all. `noticePath()` is `templatePath(NOTICE_TEMPLATE)`, so the
  route that serves the notice and the route that writes a record still read one file.
- `server/index.js` — the template route calls `privacyNotice.templatePath(templateName)` for every template;
  the hard-coded `/home/team/shared/templates` join is gone.
- `server/privacy-notice.test.js` — new: the notice path is the repository copy, the bytes served are that
  file's bytes, the version is read from the served file, every document the UI offers (the four
  `fetchTemplate(...)` names) exists in `templates/`, a caller cannot walk out of the directory, and **no
  module under `server/` reads the host-shared directory**.

The last guard strips comments before scanning, because a module that *names* the path in prose is not a
module that reads it — the guard failed on its own documentation the first time it ran, which is a check
reporting on text rather than on behaviour.

## 6. The guard fails on the unfixed tree

`rig-before-after.txt`, first block: the new test file copied into the BEFORE tree and run there —
`# tests 6 / # pass 1 / # fail 5`, both new suites failing. A guard that passes on the tree it is meant to
catch proves nothing.

## 7. Suite and build

- `cd server && npm test` → **149 tests, 33 suites, 0 fail** (`test-run-149-pass.txt`), against 144/31/0
  before this change.
- `cd client && npx tsc -b --force` → **exit 0**; `npx vite build` → **exit 0**, raw line
  `dist/assets/index-BcziNE91.js   274.05 kB │ gzip: 76.39 kB`, 274056 bytes, md5
  `e29f5ef4bc6ffb6a1e09907e7bc5980b` — the same asset #146 measured, because this branch touches no file
  under `client/` (`raw-scope-and-deploy-tree.txt`). Nothing here changes what the next cutover ships to the
  browser.

## 8. What this does *not* do

- **The version line.** The served text changes bytes while the version stays `v2.2`; the ruling of
  2026-10-12 splits the numbers and both halves are now recorded where the record needs them — in the
  `noticeVersion()` docblock of `server/privacy-notice.js`: **`v2.2` = the text served to date** (the host
  copy, md5 `e011d3d6…`, "statutory retention"; every existing acknowledgement and consent row names it
  because it is the text the route resolved), **`v2.3` = the corrected text** in `templates/privacy-notice.md`,
  served to nobody yet; `v2.4` is the qualifications purpose row behind counsel. So `v2.2` is not meaningless
  — it names a producible document, and re-labelling the served text retrospectively would misdescribe every
  record written against it. The three lines that carry the number move together in the notice owner's own
  row (the compliance expert's `f8b3f4ca`, a cutover gate); this row adds only the guard that all three
  agree (below).
- **The retention sentence itself.** "statutory retention" vs "retention period" is counsel's Q1/Q6, and
  whichever way it is answered the answer belongs in the repository copy. This row moves which file is
  authoritative; it does not rule on the wording.
- **The host file.** See `host-copy-disposition.md` in this directory: the pointer plan is withdrawn
  (any text at that path can be served as the notice by a host-first resolution — i.e. by the old code
  still live until a cutover, and by any rollback). The host copy is retired by removing or moving it
  aside, never by leaving replacement text in its place.
- **The other duplicates in the host directory.** After this change nothing serves from it, but six other
  documents (the DPA, the DPIA, the breach letters, the settlement statement, the two contracts) still sit
  there in copies that will now silently diverge from the repository's. Same treatment needed; not done here
  because those files belong to the compliance owner and the row scopes the pointer to the notice.
- **The `.html`/`.pdf` derivatives.** `templates/privacy-notice.html` is byte-identical in both directories
  and still contains `statutory retention` — the derivatives were never regenerated when the qualifier was
  dropped, in either copy. A reader who opens the HTML or the PDF still reads the removed claim. Not fixed
  here: regenerating a legal document is the owner's act, and `templates/build-html.js` is the tool.

## 9. When this becomes true, and the one ordering constraint

The change is visible only after a cutover: the live tree at `b54412d` runs its own copy of the old code
(reader 3 above) until then, so **today's live product still serves the host copy**, and the probe's BEFORE
row is what a client receives right now. This change rides the next movement.

**The disposition of the host copy, amended 2026-10-12 — the pointer plan is withdrawn.** A pointer at
that path is read only by a resolution that looks at the host path first, which is the *old* code: live until
the cutover, and what a rollback restores. Any text left there is therefore a candidate to be served as the
privacy notice, so a pointer saying "this is not the notice any more" would be served *as* the notice — worse
than the stale-but-real document it replaced. The merged change removes the host directory from the resolution
entirely, so nothing needs installing there. Retire the copy by removing or moving it aside, never by leaving
text at the same path; the exact procedure, the ordering rule and the byte-level read-back are in
`host-copy-disposition.md`.

The read-back that decides it — by the bytes the route returns, not by reading the code — is:

```bash
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/api/compliance/notice > /tmp/served.json
python3 -c "import json;d=json.load(open('/tmp/served.json'));print(d['path']);open('/tmp/served.md','w').write(d['content'])"
md5sum /tmp/served.md /home/team/shared/probable-octo-sniffle/templates/privacy-notice.md  # must match
# then the ROLE-AWARE content check from `host-copy-disposition.md`. Do NOT fall back to a bare
# count: `grep -c 'statutory retention'` is 1 on a correct v2.3 notice, because the version line
# quotes the retired wording to record the correction. Assert the roles, never the count.
```

## 10. Amendment — 2026-10-12, after `#151` merged

Three amendments, all recorded here rather than in a rewritten history:

1. **The pointer plan is withdrawn** (§8, §9, `host-copy-disposition.md`): install nothing at the host path;
   retire the copy by removing or moving it aside.
2. **The v2.2/v2.3 split is recorded in the code that reads the number** — the `noticeVersion()` docblock of
   `server/privacy-notice.js` — not in the served notice, which is client-facing and has no business carrying
   an internal fork record. Answering the open question: the docblock was chosen over a line in spec §3.
3. **A shape guard was added** to `server/privacy-notice.test.js`: the status line, the version header and the
   consent-version table row must name the same version, and there must be exactly one version header (so
   `:247` can never become a second one). It asserts no particular number, so it passes before and after the
   notice owner's bump and cannot pre-empt it.

## 11. The amendment's own run — raw output in this directory

`raw-rig-run-notice-numbering-2026-10-12.txt` (the whole run) and
`probe-route-notice-numbering-2026-10-12.json` (the probe's output verbatim). A scratch instance only: a
worktree of `a11d5c8` carrying this amendment's files, its own database, port 4733, a throwaway credential.
The live product answered `200` before the rig and `200` after it, and no listener survived on 4733.

- **The rig tree is this branch's content, by blob hash, not by trust:** `server/privacy-notice.js`
  `ac8b0f7b4e24ea68753168fb85af1d4eb317f758` and `server/privacy-notice.test.js`
  `b011a720439193c4facfc10e941d0a29a1eb3fdb`, each equal in the rig tree and the branch.
- **Suite in the rig tree:** 152 tests / 34 suites / 0 fail.
- **Negative control.** Only the consent-version row was bumped, to `v9.9`, the version header untouched:
  the new guard went red — `not ok 3 - the served notice states one version in all three places`,
  8 tests / 7 pass / **1 fail**. Restored from git, the same file ran 8/8 green. A guard that cannot fail on
  the defect it names proves nothing.
- **The bytes the route returns, with the wrong copy present the whole run.** Worth stating plainly: the
  host copy carrying "statutory retention" (`e011d3d6f18eb8175050917bb4fb08fe`) existed at
  `/home/team/shared/templates/privacy-notice.md` throughout, and the route still returned the repository
  copy — `GET /api/compliance/notice` → `HTTP 200`, 23522 B, md5 `9c060b9fd07129cdb466471bbed7945b`,
  `statutory_retention=false`, `plain_retention=true`. The rendered `privacy-notice` template agreed
  (`418b3d7580570acea19c9468d65fe527`), and the KSA contract came back as the corrected repository text
  (`d23c70cf15f7b1d5f995fa7a7a471857`, `article84=true`, `articles74_86=false`). The still-existing host copy
  is the adversarial input, and nothing served it.

## 12. Merge check against post-`#154` main, and a hash that went stale

Raw: `raw-merge-check-2026-10-12.txt`. The compliance expert's `#154` (the three v2.3 version lines) merged to
`main` while this branch was open, and this branch was cut from `a11d5c8` — before that bump. So the question
that matters before an owner merges #153 is not "does it conflict" but "**does it revert the bump**". It does
not, and here is the measurement rather than the reasoning:

- **This branch touches no `templates/` file at all.** `git diff --name-only <merge-base> <head>` lists seven
  files under `server/` and `docs/evidence/` only — so it cannot carry an older notice text.
- **The scratch merge into current `main` is clean**, and the merged notice is byte-identical to `main`'s:
  both md5 `6004b0a5b23ac5aa68415da5e45ec2cd`. The three lines still read `v2.3` at `:5`, `:6` and `:247`, the
  evidence files land, and the withdrawn pointer file is gone.
- **The suite on the merged tree: 152 tests / 34 suites / 0 fail.** That is the guard passing *against a v2.3
  notice* — the claim that it cannot pre-empt the notice owner's bump, now measured instead of asserted.

**The stale hash, recorded rather than quietly left.** Sections 3 and 11 quote
`9c060b9fd07129cdb466471bbed7945b` as the repository copy's md5. That was the corrected text as it stood while
labelled `v2.2`; `#154` then changed three version lines, so the repository copy is now
`6004b0a5b23ac5aa68415da5e45ec2cd`. The claim those sections make is an **equality** — the bytes the route
returns are the bytes of the repository file — not a fixed hash, and the equality is unaffected by the bump.
Anyone needing today's figure should re-read the route rather than quote a number from this directory.

## 13. The read-back is role-aware, not a count — corrected 2026-10-12

The cutover ran at 06:41:58Z and the retirement was executed after the restart: the host copy at
`/home/team/shared/templates/privacy-notice.md` was moved aside, never replaced with text, and no code reader
remains on that path. **The post-move check as this directory first wrote it does not survive the text that
shipped**, and the correction is the point of this section.

The check was `grep -c 'statutory retention' /tmp/served.md # must be 0`. On the deployed v2.3 notice
(md5 `6004b0a5b23ac5aa68415da5e45ec2cd`) that count is **1**, because line 6 records the correction by
quoting the retired wording:

```
6:> **Version / الإصدار:** v2.3 (2026-10-12) — retention wording corrected: "statutory retention" → "retention period"
```

So the check flagged *correct* text as wrong and passed *older* text — it inverted. A count answers "does this
text appear", never "in what role". Measured on the deployed notice, the roles are:

| role | occurrences |
|---|---|
| the version header quoting it, as the record of the correction | **1** (line 6) |
| any content line (`^>`-excluded) | **0** |
| the English retention row, line 62 | `Duration of employment + retention period` — clean |
| the Arabic retention row, line 174 | `مدة التوظيف + مدة الاحتفاظ` — clean |
| the retired Arabic qualifier `مدة الاحتفاظ القانونية` anywhere | **0** |

The check is now role-aware in both places it appears (`host-copy-disposition.md`, and section 9 above), and it
is enforced rather than documented: `server/privacy-notice.test.js` asserts the qualifier appears in no content
line and that the Arabic form is absent entirely. It asserts no version number, so it passes on the text as
labelled `v2.2` and on the `v2.3` text that quotes the correction.

The guard was then *controlled*, not merely run: raw output in `raw-role-aware-guard-2026-10-12.txt`. On a scratch
merge of the branch into current main (the v2.3 text, md5 `6004b0a5…`) the suite is **154 tests / 35 suites /
0 fail**; writing the qualifier into the English retention content row turns the guard red with "the retired
qualifier is in the notice content", writing its Arabic form into the Arabic row turns it red again, and restoring
the file returns it to green with identical bytes. A guard no injection turns red is vacuous.

**Sections 3 and 11's `false` rows are dated readings, not prescriptions.** They measured the text as it stood
during that run — the corrected wording before `v2.3` recorded the change. Read them as history; run the
role-aware check above for today's answer.
