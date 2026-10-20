# Evidence — the movement of 2026-10-20 09:29:38Z → 09:30:36Z (58 s), served revision `7a4e00a`

Run stamp `20261020-092938`. Round 54. Filed by the program-manager from the run's own artifacts
plus my own reads; nothing here was re-run to make it tidier, and nothing here is quoted from a report.

**What the movement did** (all of it from `movement-7a4e00a.log`, the deploy script's own output):
fetch/reset to `7a4e00a` → 7 of 7 host tools installed/refreshed from that revision, and a second
install pass reporting "nothing to do — all 7 copies already match" (idempotence, measured once) →
client build OK → demo re-seed OK → restart (stopping pid 23610) → **guard re-armed at pid 28528** →
`WARNING: old watchdog still alive after 30s — forcing it down` (line 84).

**The forced kill is instance four of the day** (06:51, 08:50, 09:07, 09:29) — see
`board-and-plan-reads-r54.txt` for the row that tracks it. It is the diagnosed handoff defect's own
prediction, not a counter-example to any fix: the guard the *newer* code had armed is the subject of a
separate acceptance test, and **the movement that installs a fix cannot be its own acceptance test**.

## The files, and what each one is

| file | what it is |
| --- | --- |
| `movement-7a4e00a.log` | the run log, copied from `/tmp` and verified `cmp`-identical to its source. The wrapper's copy is this file plus one line (`EXIT=0`), 7 bytes larger. |
| `cutover-20261020-092938-evidence.txt` | the run's own end-of-run evidence summary (107 lines). |
| `cutover-20261020-092938-build.log` | the client build's output for this stamp. |
| `cutover-20261020-092938-seed.log` | the demo re-seed's output for this stamp. |
| `cutover-20261020-092938-pb-overview.json` | the pre-boarding overview the run captured after the re-seed. |
| `program-manager-live-r54.txt` | my own anonymous probe of the served surface at 09:40:01Z: page 200 + title, the JS and CSS digests, 401s without a token on three routes, a bad password 401, a good login (token length only, `access_role: hr_admin`), a fabricated token 403, roster 13, pre-boarding 3 cases / 21 items / three flag states, KSA 10 tasks, EOSB match. **It also records my own stray host write and its removal** — see below. |
| `observer-2026-10-20T0941.txt` + `observer-record-line-2026-10-20T0941.jsonl` | `observe-serve-pair.sh` run **once** at 09:41:04Z: `PAIR HOLDS (exit 0)`, both assets byte-identical, liveness 26 min since the previous run, record now 4 runs, no alert file, **no loop armed** — so this is a dated point and not an availability rate. |
| `suite-summary-r54.txt` | the suite run at the time of the round: served `7a4e00a` green (257/51/257/0 rc 0); `main` `ab7e9c3` **red** (257/51/256/1 rc 1); the same two trees with **no install** (171/2 and 170/3 failures of the module-resolution kind). |
| `suite-server-served-7a4e00a-deployed-install.txt` | raw TAP for the served tree, with the deployed `node_modules` symlinked in. |
| `suite-server-main-ab7e9c3-deployed-install.txt` | raw TAP for `main` at `ab7e9c3` — the run that **reddens**. |
| `suite-no-install-r54.txt` | raw TAP with no install present, for both trees. |
| `reachability-red-r54.txt` | the failure block, the scanner rule as it stood (lines 99–155), and the four `url.indexOf('/api/...')` matcher lines in `client/src/panelResults.js` that the scanner read as call sites. |
| `suite-tip-reread-94c6ef0.txt` | **the re-read at push time**, after `origin/main` moved to `94c6ef0`: the suite measured green there, the edited file proven unmoved, and the require-closure test showing no movement is owed for `9796d6b..94c6ef0`. |
| `suite-server-main-94c6ef0-deployed-install.txt` | raw TAP for the tip `94c6ef0` — 263/51/263/0 rc 0, with `ok 59 - no client call site names a route the product does not register`. |
| `suite-client-main-94c6ef0-deployed-install.txt` | raw TAP for the client at the same tip — 23/4/23/0 rc 0. |
| `board-and-plan-reads-r54.txt` | the board and plan reads the round rests on, with their timestamps. |
| `checker-r54-green.txt` | `scripts/check-index-ids.py` on the edited index: rc 0. |
| `checker-r54-green-after-repair-and-amendment.txt` | the same checker re-run **on the final bytes** — after the duplicated control-location fragment was removed and the push-time amendment was written in. rc 0. The earlier green was on the earlier bytes; both are kept, because the file changed after it. |
| `checker-r54-controls.txt` | the controls, **including the first attempt that failed for a reason worth keeping**: run from `/tmp`, all three read rc 1 no matter what was changed, because the checker resolves tokens against the tree the index sits in. Redone inside the repository root. |
| `cutover-20261020-094644-evidence.txt` + `-build.log` + `-seed.log` + `-pb-overview.json` | **the day's SECOND movement** (`9796d6b`, 09:46:44Z -> 09:47:41Z, 57 s, `MOVEMENT_RC=0`, carrying #253 + #254 + #258), filed at the lead's handover so this round files the earlier of two as the earlier of two; copied from `/tmp` with their bytes intact. |
| `second-movement-and-guard-acceptance.txt` | the second movement read as predicted, and **the guard fix's acceptance test** — step 6's force-kill is the FIFTH instance and the fix's own prediction, while the acceptance line lives in the *guard's* log. |
| `guard-log-excerpt-acceptance.txt` | the excerpt from the served tree's own `server/keep-alive.out` (not committed as it stands: `.gitignore` names it runtime state): armed 09:47:35 as pid 24780, `EXIT: killed by SIGTERM (loop pid 24780)` 09:48:41, a fresh guard armed 09:48:41. |

## Three files here carry a `.log` name, and `.gitignore` has `*.log`

`movement-7a4e00a.log`, `cutover-20261020-092938-build.log` and `cutover-20261020-092938-seed.log` are **ignored by this repository's `.gitignore` (line 6, `*.log`)** and had to be added with `git add -f`. The tell is worth keeping: a plain `git add` of this directory reports success and commits **18** of the 21 files, and `ls` still shows all 21, so the pack looks complete while three of its files are absent from the commit. Measured here: `ls -1 | wc -l` = 21, `git ls-tree -r --name-only HEAD -- <this dir> | wc -l` = 18 before the force-add and 21 after. **A file on disk is not a file in the commit** — the two counts, taken together, are the check. The earlier packs' run logs (`movement-241.log`, `movement-239.log`, `run.log`) carry the same `.log` names, so this is the house convention rather than a one-off.

## What this pack does not prove

- **The +30-byte stylesheet delta has a cause outside this pack.** The CSS measured 35,805 B / md5
  `3709a147a167307b5f46c2ecbc3e0431`, +30 bytes against the previous reading; the cause is row
  `2f39da0c`'s subject and is answered elsewhere. A stylesheet byte-delta is not evidence of a
  styling change, and no delta is not evidence of none.
- **The JS did not change while its filename did** (`index-B9iywLcl.js` → `index-CRGdjEGs.js`), both
  276,206 B / md5 `fd270c84cb2b34a2df5372a6e93505c8`: comments only, which esbuild strips. That is a
  measurement of two files, not a claim about any future bundle.
- **The suite counts are the suite's, at the trees named.** No count here describes the tip that
  will carry this document except `suite-tip-reread-94c6ef0.txt`.
- **A guard's exit line is not in this pack.** The acceptance test for the guard fix belongs to the
  movement that armed it; this movement reaped a guard the *older* code had armed.

## The one host write that was mine, and its removal

My probe passed `$TREE/server/product.db` as the record database. `sqlite3.connect` creates a file
that is not there, so it **created a 0-byte `server/product.db` inside the served tree**. The
movement's own script reads `/home/team/.data/antum-product.db` (`deploy-main.sh:41`) and that is the
path I should have used. The file was removed in the same session and the served tree verified clean
(`git status --porcelain` empty, `HEAD` `7a4e00a`); the failed probe, the correction and the removal
are filed in `program-manager-live-r54.txt` rather than tidied away.

## Digests

`README.md` is excluded from its own table — a file cannot carry its own digest. Everything else,
md5, computed in this directory after the last file was written:

```
367a1ff67c6bb880b6e7600bfbfc596e  board-and-plan-reads-r54.txt
fcc2450c503d713b6457b12a200247ec  checker-r54-controls.txt
558f543fe1d61272efc5710f3f41a6fa  checker-r54-green-after-repair-and-amendment.txt
7ac618cea7c929e4e1aaad6e98223c88  checker-r54-green-after-second-movement.txt
abc9f9d8cd76fdcc93e2a275bda4216f  checker-r54-green.txt
27646369daf8db5a071b82838281076a  cutover-20261020-092938-build.log
5acbe7bd05d23368e951cc3f3582684c  cutover-20261020-092938-evidence.txt
2ac055b459aa85ab027004b2195645f0  cutover-20261020-092938-pb-overview.json
08070dbd2a8c8decb784933ac80b3d13  cutover-20261020-092938-seed.log
e9aaadb554073f402e26e21ec527969d  cutover-20261020-094644-build.log
cbf79bacf5b0b729a815a27136954a0f  cutover-20261020-094644-evidence.txt
9c62cf19a339edbec3eff635d39596dc  cutover-20261020-094644-pb-overview.json
541e852bf49f0ece2c58ecc0cde8874a  cutover-20261020-094644-seed.log
0da1b9fa59bda94c5cf28e6744a9b5b5  guard-log-excerpt-acceptance.txt
a21322fc7ea064de2d38462beda23de8  movement-7a4e00a.log
153cd4fa3f4bf8736295d69a4dfb6ad6  observer-2026-10-20T0941.txt
793f07de2df552fe269b3733862a18ac  observer-record-line-2026-10-20T0941.jsonl
3cf5605de524180f600a2fbe1dee079a  program-manager-live-r54.txt
e54f6f30c10f7cbf4edf54d2d7496d5e  reachability-red-r54.txt
df8af111f7a47d9cc3b878117c3ab874  second-movement-and-guard-acceptance.txt
25116e7f58772ae40702092b771e5ef9  suite-client-main-94c6ef0-deployed-install.txt
75444b5fb54b41bd8c7c6632a05950a4  suite-no-install-r54.txt
7103b965539fdd857687c2bb47794803  suite-server-main-94c6ef0-deployed-install.txt
58d4d8d05de587a1e763e7045beca723  suite-server-main-ab7e9c3-deployed-install.txt
f4d7f0031923bb6678f28179ae97181f  suite-server-served-7a4e00a-deployed-install.txt
5faca2e9f15b7433fdeb62ef7b595fec  suite-summary-r54.txt
bd48817916eddfa3285686b14a5f70be  suite-tip-reread-94c6ef0.txt
```
