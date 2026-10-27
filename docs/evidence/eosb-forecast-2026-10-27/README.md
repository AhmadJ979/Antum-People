# Evidence pack — P4-3, the 12-month EOSB liability forecast spec

**What this pack is.** The raw measurements behind `eosb-liability-forecast-spec.md` (repo root), taken
on **2026-10-27** at **`main` = `77be6fb`**. Nothing here touches the live deployment.

**Where it was measured.** An isolated scratch rig: a detached git worktree at `origin/main`
(`/tmp/r79/tree`), its **own** SQLite database (`/tmp/r79/rig/eosb.db`, seeded by the tree's own
`scripts/seed-demo.js`), port **4782**. The live product on port 3000 answered **200** before and after
every run (`07-rig-identity.txt`). No live database, no live service, no live port was written to.

**The seed is sample data.** Every figure is off the 14-person demo roster with seeded salaries — an
illustration of the rule, not a client figure. No client data exists.

## Files

| file | what it holds |
|---|---|
| `01-engine-at-main.txt` | `server/eosb.js` in full at `77be6fb`, and the blob identity of the four files the spec depends on at `23a3ff3` and at `77be6fb` (byte-identical at both — which is why a reading at either tree is the same reading) |
| `02-roster-and-trajectory.txt` | probe A: the roster fields, the stored-cache sum vs the engine at both bases, the 12-month trajectory, every tier crossing with the step at the boundary, who carries an `end_date` |
| `03-failure-modes.txt` | probe B: the served surface unfiltered and filtered, the served series vs the engine recomputed per employee, and the four failure modes demonstrated on the rig DB (a past departure still counted; a country the engine does not know; a missing accrual basis; the headline as a cache) |
| `04-movers-and-crossings.txt` | probe C: the exact-date cross-check of all four served points, per-employee 12-month deltas with tier crossings marked, and the two served numbers disagreeing about the same person |
| `05-pack-check-first-run-red.txt` | **the pack's first run — RED 17/26 on an untouched spec.** Every red was a wrong pattern in the pack, not a wrong figure in the document. Kept because a check pack that has never reddened proves nothing, and because it is the honest record of how the pack was built |
| `06-pack-check-falsified.txt` | the two falsification runs: the **spec** mutated (three numbers changed → the pack notices its claims have left the document), and the **transcripts** mutated (the spec untouched → both sides shown). Both exit 1 |
| `07-rig-identity.txt` | the rig: tree hash, seed log tail, the port, the scratch-account count, and the **live port 3000 control** |
| `pack-check.txt` | the green run: **27 / 27 claims verified, exit 0** |
| `check-pack.py` | the checker |

## How the checker is built (and why it is built that way)

The pack holds **27 claims**. For each one it **reads the claim out of the spec** (a regex over the
document it judges) and compares it with a value **extracted from the raw transcript** that produced it.
Nothing is hard-coded beside the document: a claim that has been edited out of the spec reads as
"CLAIM MISSING FROM THE SPEC" and reddens, and a transcript that has been edited reddens with both sides
shown. It refuses to judge at all (exit 2) if the spec does not name the revision it was measured at,
and it prints the tree it is running in.

`python3 check-pack.py` → 27/27, exit 0. Both falsifications → exit 1.

## What the pack does **not** claim

The 27 claims are the measured figures the spec states. They are not a proof that the spec's *rule* is
right (that is §4 and the tests in §9), and they say nothing about the live deployment — the rig is a
different database on a different port, by design.
