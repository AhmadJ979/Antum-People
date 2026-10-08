# P2-3 evidence — the pre-reading package and its acknowledgement record

Everything here was produced on **the tree that will merge**, in a scratch instance with its own
database and credential, on port 4731. The live deployment was never touched (port 3000 answered 200
before and after the pass).

## Provenance (WORKFLOW rules 12, 15 and 19)

| What | Value |
|---|---|
| Base commit | `origin/main` = `50871365e1fad2147b4558469518f4aafa52daed` (PR #78, docs-only, merged after #77) |
| Branch | `feat/p2-3-pre-reading-package` = `5bf10eba8fc82ae25759a47e4abd6f646cda9714` |
| Merge result | `git merge-tree --write-tree` printed `9f2b6030b85d4d06b01a02a52dd98703267c9323` with **no conflict report** |
| Files proven identical | `git hash-object` of the rig tree equals the branch blob for all five changed files (see `01-…txt`) |
| Note | The base only advanced by the designer's docs PR #78; `git diff 8911a397 origin/main -- <the five files>` is empty, so the merged content of every file P2-3 touches is my branch's |

## Build proof (`01-rig-merge-result-and-build.txt`)

* `npx tsc -b --force` → **exit 0** (run from `client/`)
* `npx vite build` → **exit 0**, `dist/assets/index-…js 264.94 kB`
* the new module's own tests inside the merge tree: **19 tests, 19 pass, 0 fail**
* full suite on the branch, run six times: `# tests 103 # pass 103 # fail 0` each time

## What each file shows

1. **`01-rig-merge-result-and-build.txt`** — base commit, branch, clean `merge-tree`, blob identity per
   file, live-deployment check, tests, both build halves.
2. **`02-http-pass.txt`** — the package read over HTTP against the running instance:
   * the three **seeded demo cases**: nine items each, **`acknowledged=0`**, `required=0/2`,
     `missing_required=[signed_jd,nda]`, `delivery_channel=none`, every item `delivery=not_available`
     and `reading=not_tracked` — i.e. **the seed was left alone**;
   * a case opened through the product's own intake path (`OFR-2026-P23-EVIDENCE`, `201 created=true`);
   * **the refusal path**, over HTTP and not only in unit tests: 401 without a token (GET and POST),
     400 for an item outside the package (the message lists the nine keys), 400 for `method=e_signature`
     ("the product cannot obtain an e-signature"), 400 for a non-ISO `as_of`, **409** for a KSA case
     (set kept but not active);
   * recording the JD: `201 created=true recorded_by=scratch
     acknowledged_at=2026-10-08T07:34:55.740Z method=in_product_record`, replay `200 created=false`
     with the **same id and the same timestamp**;
   * afterwards: `acknowledged=1`, the other **eight still `not_recorded`**, `required=1/2`;
   * the time-stamped view: `?as_of=` two minutes before the record → `acknowledged=0`;
   * a search of the serialised payloads for `"sent"`, `"emailed"`, `"notified"`, `"delivered":true`,
     `"read":true` → **all absent**.
3. **`03-rows-in-the-database.txt`** — read from outside the tree: exactly **one**
   `preboarding_acknowledgements` row, the audit row is `action=ACKNOWLEDGE` with
   `new_values` carrying keys and the state change only (the free-text note is **not** in it), and the
   `preboarding_items` rows are untouched by P2-3.
4. **`04-dom-readout.txt`** — the strip's own `innerText` from the running page: header
   `PRE-READING PACKAGE · 1/9 acknowledged · 1/2 required`, the JD showing
   `scratch · 2026-10-08T07:34:55.740Z · in-product record, not an e-signature`, and eight rows reading
   `Sent: not available — no delivery channel in this release`,
   `Read: not tracked — no hire-facing portal in this release`, `Acknowledged: not recorded`, each with
   its `Record acknowledgement` control.
5. **`screenshots/`** — both PNGs were read back and confirmed to show the **strip**, not a chip:
   `p2-3-strip.png` (header, the acknowledged JD row, four unrecorded rows) and
   `p2-3-strip-scrolled.png` (rows six to nine).

## Reproducing

`proxy: `rig.sh` in the member's `~/p23-rig` did: fetch → `merge-tree` → worktree at `origin/main` →
`git apply` of `git diff <merge-base> <branch>` → symlink `node_modules` → tests → build → seed
(`DEMO_SEED=true`, own `PRODUCT_DB_PATH`) → own throwaway user → boot on 4731. The HTTP pass is
`http.mjs`; the row check is `dbcheck.cjs`. Teardown: kill by `/proc/<pid>/cwd`, `git worktree remove`,
delete the DB, confirm 4731 free and port 3000 still 200.
