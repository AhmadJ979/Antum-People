# Host tooling, 2026-10-18 — one install path, and the drift that made it necessary

Raw output of every measurement below is filed beside this file. Each was produced by running the
command, not reconstructed; the commands are named where they appear.

## The defect, measured

The operator copies in `/home/team/shared` were installed by hand, at different times, from different
commits, and the pair was inconsistent in the worst direction (`host-copies-before.txt`):

| copy | state found | consequence |
|---|---|---|
| `/home/team/shared/deploy-main.sh` | installed from `662e881` (merge of PR #201), `grep -c deploy-in-progress` = **0** | it writes **no** `deploy-in-progress` marker |
| `/etc/profile.d/zz-antum-product-guard.sh` | PR #203's hook: it **waits** for that marker (`server/deploy-in-progress`, pid alive AND fresh) | a movement could not stand its own hook down |

The runbook's step 3 and DEPLOY.md both run `/home/team/shared/deploy-main.sh`, so the race PR #203
fixed was still live on the documented path. Three copies of the tooling carried the line "Regenerate
with: `scripts/install-host-tools.sh` in the repository" — and `git ls-tree f1aaeab | grep install-host-tools`
returned nothing. The documented regenerator did not exist.

Also measured, and separately filed to the lead: `cutover-20261010-RUNBOOK.md`'s precondition (line 29)
cites `deploy-main.sh` md5 `e76df174731a3b8c306a00a3b0b949de`. That value is in exactly two files on this
host — that runbook, and the repository's own `cutover-20261012-0642/README.md:3`, where it is the copy
that ran the **2026-10-12** cutover (15,105 B, "measured here"). That is two days *after* the run the
runbook documents, whose precondition section is dated 2026-10-09 15:19Z: the line cannot be the
verification it claims to be. It was never committed either — the script was host state until 2026-10-17,
`git rev-list --all -- scripts/deploy-main.sh` lists three commits, and none of their blobs carries that
md5. The runbook is amended in place with a dated block (the original text is byte-identical) and left
outside the repository, where it already was; the live procedure is DEPLOY.md's "Host tooling (the
operator copies)".

## What was done

1. **`scripts/install-host-tools.sh`** — the single documented means. Installs `deploy-main.sh`,
   `cutover-preflight.sh`, `restore-product.sh`, `rollback-to-9d2182a.sh`, `success-test.sh` and the
   login-shell hook, from this tree or from a named revision (`--commit <rev>`, blobs read with
   `git show`, so the deployed tree is never reset). Each copy gets a provenance block **derived at
   install time** — source revision, source blob md5, tree state — so a block can no longer record a
   value that matches no copy. Writes are **atomic** (temp + rename, so replacing a script that is
   executing cannot corrupt the running process) and **idempotent** (a second run changes no byte and no
   mtime). A source that does not parse as shell is **refused**. `--verify` compares each copy's BODY
   and exits 1 on drift.
2. **`scripts/deploy-main.sh`** — the drift cannot recur. **Step 1b** refreshes the host tooling
   immediately after the reset, so the next movement starts from a copy as new as the tip even if this
   run fails later; **step 6b** now calls the same installer instead of writing the hook itself. That
   second path wrote the raw blob, stripping the provenance block and leaving the preflight's comparison
   permanently unable to go green. The old inline install survives only as a labelled fallback for a
   tree that predates the installer (`--restart-only` against an old tree), and says so.
3. **`scripts/cutover-preflight.sh`** — the hook check compares the **body**, and names which comparison
   ran. Whole-file comparison reported drift on every run against a host whose hook body was
   byte-identical (`54c964b4…` vs `728bf2cc…`, differing by exactly the three provenance lines): a WARN
   that can never go green trains the reader to ignore the line. Its hook path also became an override
   (`${ANTUM_HOOK_DST:-…}`) — without that knob the check could not be reddened off-host at all, and the
   first red attempt silently graded the LIVE file while pointing elsewhere.
4. **The host copies on this machine were regenerated through it** (`install.txt`, `verify.txt`,
   `host-copies-after-verify.txt`). Backups of every replaced copy, both mine and the installer's own:
   `/home/team/shared/host-tools-backup-20261018T085333Z/`.
5. **`scripts/install-host-tools-test.sh`** — 54 checks off the host, all green
   (`install-host-tools-test.txt`), including that the live copies are untouched by the test.

## After-state

* every host copy's **body** equals its repository blob — by the installer's `--verify` and by an
  independent `awk` strip, both MATCH on all six (`host-copies-after-verify.txt`);
* the marker write is in the host copy (`deploy-main.sh:266`; the `grep -c` reads 2 because the step-1b
  comment names the marker in prose — the code line is the one that matters);
* preflight hook line **green**: `body md5 728bf2cc… == the shipped tree's hook (whole-file 9d110e8c…;
  the provenance block is the only difference)` — and RED both ways: a mutated body (`body 7811a8e6…
  / shipped 728bf2cc…`) and a missing hook (`FAIL`, exit 1) (`preflight-green.txt`,
  `preflight-red-mutated-body.txt`, `preflight-red-no-hook.txt`);
* `guard-deploy-marker-test.sh` still **22/22, 0 failed** — write < reap < remove and the pinned kill
  pattern are untouched (`guard-deploy-marker-test.txt`);
* **the live service is unchanged** (`live-service-unchanged.txt`): public `GET /` 200 naming
  `assets/index-Bh1-0KrL.js`, notice 401 without a token, port 3000 still ours, one `keep-alive` process.

## What was deliberately not done

No movement, no restart, no touch to the guard, nothing under `client/`. The installer's promises are
proved off-host and the deploy's two new call sites are proved by `bash -n`, by the marker-order test,
and by the installer's own idempotence — the movement path itself was not executed, because running it is
the owner's word, not ours. The installed copies' provenance names the branch commit they were installed
from; after the merge, `--verify` against `origin/main` confirms the same bodies, and the next movement
re-labels them with the tip it moved to.
