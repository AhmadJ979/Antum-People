# `scripts/cutover-preflight.sh` — the half-overridable record, the stale "serving today", and the false 404

Row `9e60797f`. Found by the lead while preparing the **16:08:51Z movement**, recorded rather than used
(`/home/team/shared/movements/2026-10-20T1607Z/preflight-defect.txt`), fixed here.

`tree-measured.txt` states the branch, the head and the script's own sha256 — the transcript's
self-identity line names the file that produced it, so a later reader can answer "is this the fixed
file?" from the pack alone.

## What was wrong

**(a) The half-overridable gate.** `MEASURED_TIP` was env-overridable; the six bundle fields beside it
were hardcoded (`index-BG0peuOK.js`, 274242 B, `f65f15c1…`, last measured 2026-10-17 at `d0422f4`).
Overriding the tip alone therefore re-pointed the gate while keeping another tip's bundle, and the run
went **green (exit 0) stating an after-state this tree had never built**:

```
ANTUM_EXPECT_SERVED=2b14a94 ANTUM_EXPECT_ASSET=index-C9vf7pQB.js \
  ANTUM_MEASURED_TIP=2b14a94 bash cutover-preflight.sh   -> exit 0 (PASS)
  ... assets/index-BG0peuOK.js   274242 B   md5 f65f15c109e76e86cd8b8abe7102f748
```

The real bundle at that tip is `index-C9vf7pQB.js` 277,790 B md5 `e6ff5da3…` — confirmed by the
movement's own build and by the bytes the public URL serves. **A gate whose knob is half-overridable is
defeated by its own override.**

**(b) The stale "serving today" expectations.** `EXPECT_SERVED` / `EXPECT_ASSET` were pinned to the
2026-10-14 cutover (`e19a98a` / `index-Bh1-0KrL.js`), so after any movement the preflight failed on the
host it was meant to certify. Measured bare on the live host before this change: exit 1,
**3 precondition(s) do not hold** (the two stale expectations plus the stale record).

**(c) The after-state it predicted was false.** The package stated the two retired routes answer **404**.
Measured (`movements/2026-10-20T1607Z/retired-routes.out`): with a token they answer **403 with
`Content-Length: 0`**, without one **401** — and `/api/nonexistent-route-xyz`, never registered at all,
answers **identically**, because the deny-by-default `/api` gate fires before routing. From outside,
*retired* and *never registered* are indistinguishable, so a probe cannot tell them apart.

## What changed (this PR touches `scripts/cutover-preflight.sh` only)

1. **The record is one knob.** All seven fields are overridable, and the run **refuses (exit 1)** unless
   the whole record moves together — naming the fields that are missing. A tip is not a measurement.
   And a refusal does not *state* a number: when the record is half-overridden the after-state is
   neutralised (`<undetermined …>`), because a refusal that still prints an unmeasured bundle is half a
   refusal. That second half was found **while writing this pack** — see "Found while assembling the
   pack" below, with the wrong transcript kept as `…-before-the-neutralisation.txt`.
2. **"Serving today" is derived, and a derived value is never asserted.** With no pinned value the tree
   is compared against itself, which cannot redden, so that line is now a **note**; pinning
   `ANTUM_EXPECT_SERVED` / `ANTUM_EXPECT_ASSET` makes it an assertion again. What replaces the tautology
   is a check that can redden: **the bytes the public URL serves must BE the deployed tree's own dist
   file of that name** — which is exactly what distinguishes our product from a foreign server on 3000
   (`ANTUM_DIST_DIR` overrides the dist, so that case is reachable off-host).
3. **The retired routes are audited in the source.** The router of the shipped revision must register
   no `GET /api/employees/:id` and no `GET /api/compliance/report`, **with a positive control** that a
   live route IS registered — so an "absent" verdict from a file that is not a router is refused rather
   than reported (`ANTUM_ROUTE_REF` picks the revision audited).
4. Incidentals: private `mktemp -d` scratch (the fixed `/tmp/preflight-public.html` was shared with the
   movement's own scripts), `Accept-Encoding: identity` so the hashed bytes are the file's bytes, and
   the header now states the three rules. Every existing knob and the self-identity line are kept.

## The proof — raw runs, exit codes included

| run | command | verdict | file |
|---|---|---|---|
| bare, no overrides, live host | `bash scripts/cutover-preflight.sh` | **exit 1**, and **one** fail only: the recorded measurement is stale (the shipped tip moved, `client/` changed) | `preflight-bare-live-host.txt` |
| the tip alone | `ANTUM_MEASURED_TIP=2b14a94` | **exit 1 — REFUSED**: `HALF-OVERRIDDEN RECORD: 0/6 bundle field(s) supplied, missing: ASSET ASSET_BYTES ASSET_MD5 CSS CSS_BYTES CSS_MD5` | `preflight-refuse-tip-alone.txt` |
| a partial record | `… + ANTUM_MEASURED_ASSET=index-C9vf7pQB.js` | **exit 1 — REFUSED**: `1/6 … missing: ASSET_BYTES ASSET_MD5 CSS CSS_BYTES CSS_MD5` | `preflight-refuse-partial-record.txt` |
| the whole record, coherently | rig clone whose `origin/main` is `58acdac`, all six fields supplied | **exit 0 — PREFLIGHT PASS**, and the after-state says the record was *supplied by this run* | `preflight-whole-record-green.txt` |
| a pinned asset the live HTML does not name | `ANTUM_EXPECT_ASSET=index-WRONGNOPE.js` | exit 1 | `preflight-red-pinned-asset.txt` |
| a pinned served commit that is not there | `ANTUM_EXPECT_SERVED=deadbee` | exit 1 | `preflight-red-pinned-served.txt` |
| a dist that does not hold the served asset | `ANTUM_DIST_DIR=<empty dir>` | exit 1 — `the product answering is NOT this tree's build (the platform placeholder on port 3000 looks exactly like this)` | `preflight-red-dist-not-holding.txt` |
| the retired-route audit, against the revision that still registered them | `ANTUM_ROUTE_REF=ff0138c^` | exit 1 — both routes named | `preflight-red-route-audit.txt` |
| **anti-vacuous control**: a readable `server/index.js` that is not a router | `ANTUM_ROUTE_REF=<rig stub>` | exit 1 — `read no router … leave it unjudged: an 'absent' verdict from a file that is not a router is vacuous` | `preflight-red-audit-vacuous-control.txt` |

The checks that read this file, and the suite, on the same tree:

- `check-all.py --no-suite` → the only red is the **known** `access-model` STALE-EXCEPTION created by the
  #262 merge (PR #275 clears it), which is not this change. `check-all-on-branch.txt`.
- `scripts/install-host-tools-test.sh` → **78 passed, 0 failed** (it greps the preflight's text for
  shape/marker agreement, so this file is an importer in the check sense). `install-host-tools-test.txt`.
- server suite → **276 / 276 / 0 / 0**. `server-suite.txt`.

## Found while assembling the pack — the refusal was half a refusal

Capturing the tip-alone transcript for the table above showed the first cut of this fix refusing (exit 1,
naming the missing fields) **and then still printing `assets/index-BG0peuOK.js 274242 B` as the
after-state** — the *default* record's bundle, carried onto an overridden tip `2b14a94` whose real bundle
is `index-C9vf7pQB.js` (the one the host actually served at that tip). The mechanism: the moved-tip check
asked whether `client/` had changed since **the overridden tip**, found it unchanged, and therefore reused
**the default record's** asset — two different baselines in one sentence. That is the same class as (a):
a number nobody measured, stated as the after-state. The run was already FAILING, so it was not a green —
but a refusal that still names an unmeasured number is half a refusal.

The fix: when the record is half-overridden the after-state is **neutralised**, nothing is inferred from
`client/` and no bundle is named.

| the same invocation | before | after |
|---|---|---|
| `ANTUM_MEASURED_TIP=2b14a94` | exit 1, and `assets/index-BG0peuOK.js 274242 B` stated as the after-state | exit 1, after-state `<undetermined - the record is half-overridden, so nothing is stated here>` |

`preflight-refuse-tip-alone-before-the-neutralisation.txt` (and the partial-record twin,
`preflight-refuse-partial-record-before-the-neutralisation.txt`) keep the wrong state; `preflight-refuse-tip-alone.txt`
and `preflight-refuse-partial-record.txt` are the fixed runs, and `preflight-whole-record-green.txt` is
the control that the neutralisation did not touch the coherent path (still exit 0, PASS).

## Movement: **none owed** — the importer absent, shown not asserted

```
$ git grep -ln cutover-preflight -- server/ client/
(no output — no served code path names it, let alone loads it)
```

The script is **host tooling**: the operator runs it by hand immediately before a movement
(`DEPLOY.md:87`), and `scripts/install-host-tools.sh:132` installs a copy with a provenance block at
`/home/team/shared/cutover-preflight.sh`. `scripts/check-all.py` *names* it as a deliberately not-run
check (its preconditions are host state, not tree state) — a citation is not a load. So no movement is
owed for this delta.

**But the operator's copy is the installed one**, and it is still the old bytes (its body md5 is
`5cde6f20…`, installed from `58acdac`). The fix reaches the host the next time host tools are installed
(`bash scripts/install-host-tools.sh`, which the movement runs at step 1b/6b). Until then, running
`bash /home/team/shared/cutover-preflight.sh` runs the unfixed file — the transcripts in this pack name
the repository path for exactly that reason.

## Recorded, not silently repaired

- `docs/evidence/decision-17-columns-2026-10-15/README.md:97,100,218` cites
  `scripts/cutover-preflight.sh:223` as the `echo` describing the retired routes. That was already a
  line number in a file that moves; this change moves it further. Left alone — it is a dated evidence
  record, and renumbering a record is not a repair.
- The byte-identity check **can redden transiently while a movement replaces `client/dist` in place**:
  observed once at about 17:12Z (two extra fails) and gone again by 17:13:55Z. It is a FAIL and not a
  WARN deliberately — the preflight is meant to be run *before* a movement, not during one.
- The recorded measurement (`d0422f4` / `index-BG0peuOK.js`) is many commits behind the shipped tip.
  The next movement must re-measure the build and supply the **whole** record; the gate now refuses to
  paper over a stale one, which is the point of this change.
