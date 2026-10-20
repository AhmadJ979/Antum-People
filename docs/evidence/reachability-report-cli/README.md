# The reachability report ignored its own arguments (row `422a77db`)

`scripts/reachability-report.js` parses no argv. Every flag was discarded, so:

- an operator could not reproduce the anti-vacuous control from a shell — the control lived **only in the
  test runner** (`server/reachability.test.js`), and
- a wrong invocation **looked exactly like a clean pass**. There is no error, no usage line, no
  difference in the output: exit 0 and "Nothing new".

The one script in this repository whose whole job is to fail loudly was the one that could not be made
to fail. That is a **false green**, and a false green is the failure mode nobody investigates — the
operator's own reference for re-running a control must not be able to buy a pass by accident.

## The premise, measured before the fix (re-checkable, not asserted)

```
$ node scripts/reachability-report.js --extra-root /tmp/probe2      # /tmp/probe2/planted.js:
authedFetch('/api/definitely-not-registered');                      # a real request-shaped call
exit=0
```

`before-the-fix-false-green.txt` is that run in full. Counted in it:

| what to look for | count |
|---|---|
| occurrences of `extra-root` | **0** |
| occurrences of `definitely-not-registered` | **0** |
| closing line | `Nothing new: every un-operable element on this product is registered with an owner.` |

The flag was heard by nobody, the probe was never scanned, and the run was green. Compare
`after-2-extra-root-honoured.txt`: the *same command* now exits **1** and names the site.

## After the fix

| file | command | exit | what it shows |
|---|---|---|---|
| `after-1-plain-run-unchanged.txt` | *(no flags)* | 0 | the ordinary invocation still prints the ordinary report — the argv code did not buy the operator's path at the cost of the default one |
| `after-2-extra-root-honoured.txt` | `--extra-root /tmp/probe2` | **1** | the flag is honoured: `GET /api/definitely-not-registered at …/planted.js:1`, `1 NEW finding(s)` |
| `after-3-missing-root-refused.txt` | `--extra-root /nonexistent-root-xyz` | **2** | a root that does not exist is refused, not scanned: an empty scan prints the same green as a clean tree |
| `after-4-unknown-flag-refused.txt` | `--nope` | **2** | usage on stderr and **no report on stdout** — a refused invocation cannot be read as a pass |
| `after-5-help.txt` | `--help` | 0 | the usage, on request; asking for help is not asking for a report |

The plain run was diffed against a capture of the same command taken **before** the change: **identical**
(154 lines, byte for byte). `this change moves nothing on the default path` is measured, not claimed.

Exit codes are now three, and the header of the script says so: **0** nothing new · **1** a NEW
un-operable element that no decision owns · **2** the invocation itself was wrong and **no report was
printed**. The third code exists because the first two cannot express "I did not understand you", and
that state must never be indistinguishable from the first.

## The new tests are load-bearing (control run, not a claim)

`server/reachability-report-cli.test.js` spawns the script the way a person does. Run against the
**pre-fix** script (a worktree at `origin/main` with only the test file copied in) —
`control-new-tests-against-pre-fix-script.log` is that run in full:

```
# tests 5   # pass 0   # fail 5
not ok 1 - the report REFUSES an invocation it does not understand, and prints no report
not ok 2 - a root that does not exist is refused rather than scanned
not ok 3 - ANTI-VACUOUS CONTROL, OPERATOR-REACHABLE: the planted caller reddens the report
not ok 4 - the control is load-bearing: without the flag the planted caller is not found
not ok 5 - the ordinary invocation still prints the ordinary report, and --help is not a report
```

All five fail against the script as it was — with assertion failures, not load errors — so none of them
is a green that would have been green anyway.

## Suites

- `server/`: **268 tests / 51 suites / 268 pass / 0 fail** (was 263 before this branch: **+5**, exactly
  this file; nothing removed, nothing skipped). Each top-level `test()` is a test, not a suite, which is
  why the suite count is unchanged.
- `client/`: **23 / 4 / 23 / 0** — unchanged, and no client file is touched by this change.

## This rides the next movement; it does not buy one

`scripts/` is refreshed by every movement, so a `scripts/` delta nominally owes one. It does not here,
and that is measured rather than assumed:

- **no served path loads it.** The only non-test mention of `server/reachability.js` anywhere in the tree
  is `scripts/reachability-report.js`'s own `require`; `server/index.js` names the *register* three times,
  **all three in comments** (lines 333, 578, 650). Nothing the product runs reaches either file.
- **nothing on the host runs the report.** `reachability-report` is named only in
  `un-operable-controls-inventory.md` and `roadmap-board-index.md` — documentation, not a deploy script,
  service unit or scheduler.

So this rides the next movement that carries a client- or server-bearing delta (with the Tailwind
`@source` mitigation, `022ff68b`), and the deployed tree's copy of this script is the old one until then.
**The host's suite count is 268 only after that movement** — until it runs, the host still reports the
number it measured before.

## One cosmetic thing, said rather than hidden

A root outside the repository is printed as a path relative to the repository root
(`../../../tmp/probe2/planted.js`). The route name and the verdict — what the operator acts on — are
exact; the path is merely ugly. Left alone deliberately: the fix for it would change how the module
renders call sites that are inside the tree, which is a measurement this row did not ask to touch.
