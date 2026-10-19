# The hook and its deploy, from one revision — 2026-10-19

Raw output for every claim: `both-directions.txt` (the re-runnable proof), `tallies.txt` (the suites),
`host-state.txt` (what the host had). All of it measured at the branch tip; the deployed tree is `e19a98a`.

**The defect, measured on this host.** The live hook was the **served tree's** — `ca4f9583…`, 4,722 B,
**0** mentions of `deploy-in-progress`, no provenance block — while the deploy copy in use **writes** that
marker. `origin/main`'s hook has **3** mentions, and the whole difference between the two is the #203
stand-down block. The preflight compared the hook against `${SHIPPED:-$EXPECT_SERVED}` **alone**, so it
printed green. The race #203 fixed was live again on every `--restart-only` run — every replacement
recovery — and the check that watches the pair was green by construction. It did not fire (no shell opened
in the window); nothing says it could not have. **Being blind at any size is the finding, not the size of
the gap.**

## The rule

**The hook and the deploy that writes the marker are one mechanism and must come from one revision.**

* **`deploy-main.sh` step 6b reads the revision out of its own provenance block (`$0`)** and passes it as
  `--hook-rev`. `$0`, not the tree, is the point: on `--restart-only` the tree is the SERVED revision,
  which may be far behind the copy executing; after a full movement's step 1b rewrites the file, `$0`
  names the tip instead, so the same line installs the tip's hook.
* **The fallback install does the same** — the path a replacement recovery takes, and the path that
  produced this defect: it takes the hook from the deploy copy's revision with `git show`, falling back to
  the tree only when that object cannot be resolved, **naming which it used in both cases**. The derivation
  and the fallback are bounded by markers (`ANTUM DEPLOY REVISION FROM $0`, `ANTUM FALLBACK HOOK SOURCE`)
  precisely so a harness can exercise the shipped lines rather than a retyped copy.
* **`install-host-tools.sh`** gained `--hook-rev` / `ANTUM_HOOK_REV` and logs the source it used. It stays
  the writer of all six copies, hook included: the provenance block is what makes a pair check possible.
* **`cutover-preflight.sh` names the revision the live hook IS**: it searches the hook's own history for the
  bytes it finds, reports which revision that is and when, compares that with the deploy copy's revision,
  warns on a mismatch, on a missing provenance block, and on a hook with no marker reader, then compares
  both candidates with `origin/main`. Naming by search, not by testing three candidates: on 2026-10-19 the
  live hook was a **third** version (the served revision's), which a candidate test called "no revision at
  all". The same words hold whether the gap is 3 commits or 300.
* **Every pair verdict is a WARN, never a FAIL.** A FAIL here would block the very movement that repairs
  the pairing, and this work is not on the movement's critical path — a full movement installs the hook
  from the tip at step 1b, before the kill window.

## Both directions, off-host — `prove.sh` (re-runnable)

Nothing touches `/etc`, the live hook, the guard, the service or port 3000: the deploy copy under test is
one the installer wrote into a scratch directory, and every hook install goes to a scratch `ANTUM_HOOK_DST`.
The "today" layout is rebuilt from git, not read off the host.

* **RED** — the served tree's hook installed raw, against a deploy copy whose provenance names the tip:
  `WARN … IS the hook at 5c166be (2026-10-13) — which is not the deploy copy's revision a5aa0e6…: UNPAIRED,
  so the marker that deploy writes has no reader`, and `WARN the marker this deploy writes has NO READER
  here: the live hook mentions deploy-in-progress 0 time(s), the deploy copy's hook 3 time(s)`.
* **GREEN** — after installing from the deploy's revision: `PASS … md5 728bf2cc… == the deploy copy's
  revision a5aa0e62f229 — PAIRED with the deploy that writes the marker`, and the marker line becomes a
  `note` ("has a reader here: 3 / 3").
* **The fallback, extracted from the committed deploy file**, given a provenance header and run against a
  scratch destination: `installing the hook from the deploy copy's revision a5aa0e6, which is the revision
  that writes the marker` → installed md5 `728bf2cc` = that revision's hook, **MATCH: YES**, and the marker
  it pairs with has **3** mentions against the served hook's **0**. With an unresolvable revision it says
  so and installs the tree's hook.
* The transcript also asserts **no hook line is a FAIL** in either direction, so the exit codes there are
  the other preconditions' business, not the pair check's.

## Tallies

```
# tests 170
```

* `guard-deploy-marker-test.sh` — **RESULT: 22 passed, 0 failed** (the marker order write < reap < remove is untouched)
* `install-host-tools-test.sh` — **RESULT: 64 passed, 0 failed**; section (i) is new (the pairing: the revision is named, the
  body is that revision's hook, an unresolvable revision falls back with the reason, the preflight's
  overrides exist), and section (g)'s two checks were re-grounded on the fallback's marker — the invariant
  is unchanged, the wording around it moved.

## Docs truth, same PR

`DEPLOY.md`'s "53 checks" was stale → corrected to the test's own count, and the pre-movement one-liner's
temporary file now comes from `mktemp`: a fixed `/tmp/install-host-tools.sh` is a collision on a shared
`/tmp`. The same one-liner, as echoed in the shared runbook, carries the same fix with a dated line.

## Held

No movement, no fetch/reset/build/seed on the deployed tree, no restart, no re-arming or killing the guard,
nothing sourced from the hook, nothing under `client/`. The live hook was **not** rewritten to prove a
point.

**Not movement-blocking**: the coming movement ships from a frozen tip and self-heals the pair at step 1b.
Until either the movement or a host-tool refresh runs, the host still carries the unpaired hook — but the
preflight now says so out loud, and names the revision, instead of printing green.
