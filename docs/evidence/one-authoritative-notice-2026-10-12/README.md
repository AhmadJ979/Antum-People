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

- **The version line.** The served text now changes bytes while the version stays `v2.2`, exactly the
  ambiguity this row removes for the *served* copy but cannot remove for a *record*: the bump is document
  content and belongs to the notice owner (the compliance expert was asked for the exact line; as of this
  run nothing had landed — both copies still read `v2.2` and no branch on the remote changes it). It lands in
  `templates/privacy-notice.md`, which after this change is the file clients receive, so it needs no code
  change.
- **The retention sentence itself.** "statutory retention" vs "retention period" is counsel's Q1/Q6, and
  whichever way it is answered the answer belongs in the repository copy. This row moves which file is
  authoritative; it does not rule on the wording.
- **The host file.** See `shared-pointer-privacy-notice.md` in this directory: the one-line pointer is
  written and handed over, but it must not replace the host copy **before** a cutover ships this change.
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

**The pointer must land at the cutover, never before it.** If the host file is replaced with a pointer while
the old code is still serving, every client downloading the notice gets a pointer statement instead of the
notice — a regression where a wrong-but-real document used to be. The cutover script's own check, "the
served HTML must name our asset", does not cover this: fetch the notice route and read the md5.

The exact bytes to install are `shared-pointer-privacy-notice.md` in this directory. Once the cutover has
shipped this change, land it with the served commit stamped in, then read the served bytes back:

```bash
DEPLOY=/home/team/shared/probable-octo-sniffle
SHA=$(git -C "$DEPLOY" rev-parse --short HEAD)
sed "s/<sha>/$SHA/" \
  docs/evidence/one-authoritative-notice-2026-10-12/shared-pointer-privacy-notice.md \
  > /home/team/shared/templates/privacy-notice.md

# the proof: the served bytes are the repository copy, not the pointer (any logged-in read works —
# `probe.cjs` in this evidence run takes exactly this route)
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/api/compliance/notice > /tmp/served.json
python3 -c "import json;d=json.load(open('/tmp/served.json'));print(d['path']);open('/tmp/served.md','w').write(d['content'])"
md5sum /tmp/served.md "$DEPLOY/templates/privacy-notice.md"   # these two must match
grep -c 'not the notice any more' /tmp/served.md              # must be 0
```

The served content must equal `$DEPLOY/templates/privacy-notice.md` and must not contain the pointer's
sentence. If it does contain it, the cutover did not ship this change and the host file must be restored
from `git -C "$DEPLOY" show HEAD:templates/privacy-notice.md`.
