# The hook and its deploy, from one revision — 2026-10-19

Raw output for every claim below: `both-directions.txt` (the off-host reproduction), `tallies.txt`
(the suites), `host-state.txt` (what the host actually had). Measured at `a5aa0e6` + this branch's
changes; the deployed tree is named at `e19a98a`.

## The defect, measured on this host

| fact | measurement |
|---|---|
| live `/etc/profile.d/zz-antum-product-guard.sh` | `ca4f9583…`, 4,722 B, **0** mentions of `deploy-in-progress`, **no** provenance block — byte-identical to `e19a98a:scripts/antum-product-guard-hook.sh` |
| the deploy copy in use (`/home/team/shared/deploy-main.sh`) | **writes** `server/deploy-in-progress` |
| `origin/main`'s hook | `728bf2cc…`, **3** mentions — the whole difference between the two is the #203 stand-down block |
| the preflight's hook line, before this change | compared the live hook with `${SHIPPED:-$EXPECT_SERVED}` **only** — green, and blind |

So the host was running a deploy that announces its kill window against a hook that cannot read the
announcement, and the check that watches the pair was green **by construction**. The race #203 fixed was
live on every `--restart-only` run — i.e. on every replacement recovery — and the recovery on
2026-10-19 wrote the marker (`pid 825`) and armed the guard cleanly because no login shell opened inside
the window. It did not fire; nothing here says it could not have.

## The rule

**The hook and the deploy that writes the marker are one mechanism and must come from one revision.**

* `scripts/deploy-main.sh` **step 6b** reads the revision out of its **own** provenance block (`$0`) and
  passes it as `--hook-rev`. `$0`, not the tree, is the point: on `--restart-only` the tree is the SERVED
  revision, which may be 40 commits behind the copy that is executing; after a full movement's step 1b
  rewrites the file, `$0` names the tip instead, so the same line installs the tip's hook.
* **The fallback install does the same** (the path a replacement recovery takes, and the one that produced
  today's unpaired hook): it reads the hook from the deploy copy's revision with `git show`, and only falls
  back to the tree when that object cannot be resolved — saying which it did in both cases.
* `scripts/install-host-tools.sh` gained `--hook-rev` / `ANTUM_HOOK_REV` and **logs which revision it
  installed from** (`hook source: the deploy's revision <rev>` or `the TREE — … could not be resolved`).
* `scripts/cutover-preflight.sh` now **attributes** the live hook's bytes to a revision (the deploy copy's,
  the served tree's, `origin/main`'s), prints **which**, warns when it is not the deploy copy's or when the
  live hook carries no provenance, and compares both candidates with `origin/main`, stating the distance
  when a hook is behind. **Every pair verdict is a WARN, never a FAIL** — a FAIL here would block the very
  movement that repairs the pairing, and the brief is explicit that this is not movement-blocking.

## Both directions, off-host

The layout reproduces today's host state in scratch: the SERVED tree's hook installed raw, plus a copy of
the host deploy script whose provenance names its revision. Nothing touched `/etc/profile.d`, the guard, or
the live service.

* **RED** — `WARN … carries NO provenance block`, `WARN … matches NO revision this repository has`
  (candidates and their md5s named), and the line that matters:
  `WARN the marker this deploy writes has NO READER here: the live hook mentions deploy-in-progress 0
  time(s), the deploy copy's hook 3 time(s)`. Preflight exit 0 — red, not blocking.
* **GREEN** — after installing the hook from the deploy's revision (`--hook-rev`, scratch destination):
  `PASS hook installed … md5 728bf2cc… == the deploy copy's revision a5aa0e62f229 — PAIRED with the deploy
  that writes the marker`, and the marker line becomes `note … has a reader here: 3 time(s) / 3 time(s)`.
* **The deploy's fallback resolves the same revision**, read-only, against the deployed tree:
  `git -C /home/team/shared/probable-octo-sniffle cat-file -e a5aa0e6…:scripts/antum-product-guard-hook.sh`
  → RESOLVES, bytes `728bf2cc…` — so a replacement recovery now installs the PAIRED hook.
* **Unresolvable revision** → the tree, named: `hook source: the TREE — the deploy's revision
  deadbeefdeadbeefdeadbeef could not be resolved in …`.

## Tallies

* `node --test server/*.test.js`, `PRODUCT_DB_PATH` pinned → **170 tests, 170 pass, 0 fail, 0 skipped**
* `scripts/guard-deploy-marker-test.sh` → **22 passed, 0 failed** (write < reap < remove untouched)
* `scripts/install-host-tools-test.sh` → **63 passed, 0 failed** (54 before; section (i) adds 9 for the
  pairing: the revision is named, the body is that revision's hook, an unresolvable revision falls back
  with the reason, and the preflight's overrides exist)

## Docs truth, same PR

`DEPLOY.md`'s "53 checks" was stale → **54** (the test and this directory's sibling both said so), and the
pre-movement one-liner now writes its temporary file through `mktemp` instead of a fixed
`/tmp/install-host-tools.sh` — `/tmp` is shared, so a fixed name is a collision waiting to overwrite
someone else's run. The same one-liner, as echoed in the shared runbook, was corrected there too, with a
dated line saying why.

## Held

No movement, no fetch/reset/build/seed on the deployed tree, no restart, no re-arming or killing the guard,
nothing sourced from the hook, nothing under `client/`. The live hook was **not** rewritten to prove a
point: every direction above ran against scratch destinations via `ANTUM_HOOK_DST`.

**Not movement-blocking.** A full movement installs the hook from the tip at step 1b, before the kill
window, so the coming movement is safe as it stands; and until it runs, the preflight now says *why* the
pair is wrong instead of printing green.
